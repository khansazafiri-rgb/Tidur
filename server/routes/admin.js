import express from 'express';
import { config } from '../config.js';
import { getDb, tx, parseJson, getSetting, setSetting, nowIso } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { preview, commit, contentHash, nearHash, SUBTOPIC_ALIASES } from '../lib/importer.js';
import { runCalibration } from '../lib/calibration.js';
import { track } from '../lib/events.js';
import { REPORT_CATEGORIES } from './learn.js';

export const adminRouter = express.Router();
const staff = requireRole('contributor', 'owner');
const owner = requireRole('owner');
adminRouter.use(staff);

const bigJson = express.json({ limit: `${config.importMaxMb}mb` });

function bad(res, msg, status = 400) {
  return res.status(status).json({ error: msg });
}

// ---------------------------------------------------------------- impor JSON

function readImportBody(req, res) {
  const filename = String(req.body?.filename || '').trim();
  if (!filename.toLowerCase().endsWith('.json')) { bad(res, 'Nama file harus berakhiran .json.'); return null; }
  let json = req.body?.content;
  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch (e) { bad(res, `Isi file bukan JSON yang valid: ${e.message}`); return null; }
  }
  if (!json || typeof json !== 'object') { bad(res, 'Isi file kosong.'); return null; }
  return { filename, folder: req.body?.folder ? String(req.body.folder).slice(0, 120) : null, json };
}

adminRouter.post('/import/preview', bigJson, (req, res) => {
  const body = readImportBody(req, res);
  if (!body) return;
  res.json(preview(getDb(), body.json, { filename: body.filename, folder: body.folder }));
});

adminRouter.post('/import/commit', bigJson, (req, res) => {
  const body = readImportBody(req, res);
  if (!body) return;
  const db = getDb();
  const out = commit(db, body.json, { filename: body.filename, folder: body.folder, publish: req.body?.publish !== false, actor: req.user.id });
  if (out.committed) {
    track(db, 'import_committed', req.user.id, { filename: body.filename, new: out.counts.new, skipped: out.counts.skipped, revised: out.counts.revised });
  }
  res.status(out.committed ? 200 : 422).json(out);
});

adminRouter.get('/import/logs', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM import_logs ORDER BY id DESC LIMIT 200').all();
  res.json({ logs: rows.map((r) => ({ ...r, summary: parseJson(r.summary, {}) })) });
});

// ---------------------------------------------------------------- sumber soal (file)

adminRouter.get('/sources', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT f.id, f.filename, f.folder, f.format, f.university, f.year, f.language, f.question_count, f.progress_status, f.imported_at,
      SUM(q.status = 'active') AS active, SUM(q.status = 'draft') AS draft, SUM(q.status = 'pending_enrichment') AS pending,
      SUM(q.status = 'hidden') AS hidden, SUM(q.status = 'retired') AS retired,
      (SELECT COUNT(*) FROM skipped_questions k WHERE k.source_file_id = f.id) AS skipped
    FROM source_files f LEFT JOIN questions q ON q.source_file_id = f.id GROUP BY f.id ORDER BY f.folder, f.filename`).all();
  res.json({ sources: rows });
});

adminRouter.post('/sources/publish', (req, res) => {
  const db = getDb();
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  const folder = req.body?.folder ? String(req.body.folder) : null;
  const to = req.body?.unpublish ? 'draft' : 'active';
  const from = to === 'active' ? 'draft' : 'active';
  let changed = 0;
  tx(db, () => {
    const now = nowIso();
    if (folder) {
      changed += db.prepare(`UPDATE questions SET status = ?, updated_at = ? WHERE status = ? AND source_file_id IN (SELECT id FROM source_files WHERE folder = ?)`).run(to, now, from, folder).changes;
    }
    for (const id of ids) changed += db.prepare('UPDATE questions SET status = ?, updated_at = ? WHERE status = ? AND source_file_id = ?').run(to, now, from, id).changes;
  });
  res.json({ ok: true, changed });
});

adminRouter.get('/skipped', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT k.id, k.seq, k.number, k.page, k.subtopic_code, k.reason, k.needs_image, f.filename, f.folder
    FROM skipped_questions k JOIN source_files f ON f.id = k.source_file_id ORDER BY f.folder, f.filename, k.seq LIMIT ? OFFSET ?`)
    .all(Math.min(500, Number(req.query.limit) || 200), Number(req.query.offset) || 0);
  const total = db.prepare('SELECT COUNT(*) AS n FROM skipped_questions').get().n;
  res.json({ skipped: rows, total });
});

// ---------------------------------------------------------------- bank soal

adminRouter.get('/questions', (req, res) => {
  const db = getDb();
  const where = [];
  const vals = [];
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(q.stem LIKE ? OR q.id = ?)'); vals.push(`%${q}%`, q); }
  for (const [param, col] of [['subtopic', 'q.subtopic_code'], ['status', 'q.status'], ['source', 'q.source_file_id'], ['unit', 'q.unit_code']]) {
    if (req.query[param]) { where.push(`${col} = ?`); vals.push(String(req.query[param])); }
  }
  if (req.query.difficulty) { where.push('q.difficulty_final = ?'); vals.push(String(req.query.difficulty)); }
  if (req.query.revised === '1') where.push('q.revision IS NOT NULL');
  if (req.query.reported === '1') where.push("EXISTS (SELECT 1 FROM reports r WHERE r.question_id = q.id AND r.status != 'closed')");
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(100, Number(req.query.limit) || 25);
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM questions q ${w}`).get(...vals).n;
  const rows = db.prepare(`SELECT q.id, q.seq, q.stem, q.subtopic_code, q.unit_code, q.difficulty_ai, q.difficulty_calibrated, q.difficulty_final,
      q.status, q.answer_source, q.explanation_source, q.revision IS NOT NULL AS revised, q.version, f.filename,
      (SELECT COUNT(*) FROM reports r WHERE r.question_id = q.id AND r.status != 'closed') AS open_reports
    FROM questions q JOIN source_files f ON f.id = q.source_file_id ${w} ORDER BY f.filename, q.seq LIMIT ? OFFSET ?`).all(...vals, limit, offset);
  res.json({ total, questions: rows.map((r) => ({ ...r, stem: r.stem.length > 200 ? r.stem.slice(0, 200) + '…' : r.stem })) });
});

adminRouter.get('/questions/:id', (req, res) => {
  const db = getDb();
  const q = db.prepare(`SELECT q.*, f.filename, f.folder, p.title AS passage_title, p.text AS passage_text
    FROM questions q JOIN source_files f ON f.id = q.source_file_id LEFT JOIN passages p ON p.id = q.passage_id WHERE q.id = ?`).get(req.params.id);
  if (!q) return bad(res, 'Soal tidak ditemukan.', 404);
  const versions = db.prepare('SELECT version, snapshot, reason, created_at, created_by FROM question_versions WHERE question_id = ? ORDER BY id DESC').all(q.id)
    .map((v) => ({ ...v, snapshot: parseJson(v.snapshot, {}) }));
  const stats = db.prepare('SELECT * FROM question_stats WHERE question_id = ?').get(q.id) || null;
  const ratings = db.prepare('SELECT SUM(helpful) AS helpful, COUNT(*) AS total FROM explanation_ratings WHERE question_id = ?').get(q.id);
  const reports = db.prepare('SELECT id, category, note, status, created_at FROM reports WHERE question_id = ? ORDER BY created_at DESC').all(q.id);
  res.json({
    question: { ...q, options: parseJson(q.options, {}), images: parseJson(q.images, []), revision: parseJson(q.revision, null), extra: parseJson(q.extra, {}) },
    versions, stats, ratings, reports,
  });
});

adminRouter.patch('/questions/:id', (req, res) => {
  const db = getDb();
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!q) return bad(res, 'Soal tidak ditemukan.', 404);
  const b = req.body || {};
  const next = {
    stem: b.stem !== undefined ? String(b.stem) : q.stem,
    options: b.options !== undefined ? b.options : parseJson(q.options, {}),
    answer: b.answer !== undefined ? (b.answer ? String(b.answer).trim().toUpperCase() : null) : q.answer,
    explanation: b.explanation !== undefined ? String(b.explanation) : q.explanation,
    subtopic_code: b.subtopic_code !== undefined ? (SUBTOPIC_ALIASES[b.subtopic_code] || String(b.subtopic_code)) : q.subtopic_code,
    difficulty_calibrated: b.difficulty_calibrated !== undefined ? (b.difficulty_calibrated || null) : q.difficulty_calibrated,
    status: b.status !== undefined ? String(b.status) : q.status,
  };
  if (!['active', 'hidden', 'retired', 'draft', 'pending_enrichment'].includes(next.status)) return bad(res, 'Status tidak valid.');
  if (next.difficulty_calibrated && !['easy', 'medium', 'hard'].includes(next.difficulty_calibrated)) return bad(res, 'Kesulitan tidak valid.');
  if (typeof next.options !== 'object' || Array.isArray(next.options)) return bad(res, 'Format pilihan tidak valid.');
  const sub = db.prepare('SELECT unit_code FROM subtopics WHERE code = ?').get(next.subtopic_code);
  if (!sub) return bad(res, 'Subtopik tidak ada di taksonomi.');
  if (next.status === 'active') {
    if (q.type === 'mcq' && (!next.answer || !(next.answer in next.options))) return bad(res, 'Soal aktif harus punya jawaban yang ada di pilihan.');
    if (!String(next.explanation || '').trim()) return bad(res, 'Soal aktif harus punya pembahasan.');
  }
  const contentChanged = next.stem !== q.stem || JSON.stringify(next.options) !== q.options || next.answer !== q.answer
    || next.explanation !== q.explanation || next.subtopic_code !== q.subtopic_code;
  tx(db, () => {
    if (contentChanged) {
      db.prepare('INSERT INTO question_versions(question_id, version, snapshot, reason, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(q.id, q.version, JSON.stringify(q), String(b.reason || 'disunting admin').slice(0, 300), req.user.id);
    }
    // Soal pengayaan yang jawabannya baru dilengkapi ditandai sebagai inferensi AI/manual, sesuai PRD.
    const answerSource = q.answer !== next.answer ? (b.answer_source || 'corrected') : q.answer_source;
    const explSource = q.explanation !== next.explanation ? (b.explanation_source || q.explanation_source || 'ai') : q.explanation_source;
    db.prepare(`UPDATE questions SET stem = ?, options = ?, answer = ?, answer_source = ?, explanation = ?, explanation_source = ?, subtopic_code = ?, unit_code = ?,
        difficulty_calibrated = ?, status = ?, hidden_reason = CASE WHEN ? = 'hidden' THEN COALESCE(?, hidden_reason) ELSE NULL END,
        content_hash = ?, near_hash = ?, version = version + ?, updated_at = ? WHERE id = ?`)
      .run(next.stem, JSON.stringify(next.options), next.answer, answerSource, next.explanation, explSource, next.subtopic_code, sub.unit_code,
        next.difficulty_calibrated, next.status, next.status, b.hidden_reason || null,
        contentHash(next.stem, next.options), nearHash(next.stem, next.options), contentChanged ? 1 : 0, nowIso(), q.id);
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- laporan

adminRouter.get('/reports', (req, res) => {
  const db = getDb();
  const status = ['open', 'handling', 'closed'].includes(req.query.status) ? req.query.status : null;
  const rows = db.prepare(`SELECT r.*, q.stem, q.status AS question_status, q.subtopic_code, f.filename,
      (SELECT COUNT(*) FROM reports r2 WHERE r2.question_id = r.question_id AND r2.status != 'closed') AS open_on_question
    FROM reports r JOIN questions q ON q.id = r.question_id JOIN source_files f ON f.id = q.source_file_id
    ${status ? 'WHERE r.status = ?' : ''} ORDER BY r.created_at DESC LIMIT 300`).all(...(status ? [status] : []));
  const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS n FROM reports GROUP BY status').all().map((r) => [r.status, r.n]));
  res.json({ reports: rows.map((r) => ({ ...r, user_id: undefined, stem: r.stem.length > 200 ? r.stem.slice(0, 200) + '…' : r.stem })), counts, categories: REPORT_CATEGORIES });
});

adminRouter.patch('/reports/:id', (req, res) => {
  const db = getDb();
  const status = String(req.body?.status || '');
  if (!['open', 'handling', 'closed'].includes(status)) return bad(res, 'Status laporan tidak valid.');
  const r = db.prepare('UPDATE reports SET status = ?, resolution_note = ?, handler_id = ?, updated_at = ? WHERE id = ?')
    .run(status, String(req.body?.resolution_note || '').slice(0, 1000), req.user.id, nowIso(), req.params.id);
  if (!r.changes) return bad(res, 'Laporan tidak ditemukan.', 404);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- kurikulum (pemilik)

adminRouter.get('/curriculum', (_req, res) => {
  const db = getDb();
  res.json({
    universities: db.prepare('SELECT * FROM universities ORDER BY sort').all(),
    units: db.prepare('SELECT * FROM units ORDER BY sort').all(),
    subtopics: db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM questions q WHERE q.subtopic_code = s.code AND q.status = 'active') AS active_count
      FROM subtopics s ORDER BY sort`).all(),
    mapping: db.prepare('SELECT * FROM university_subtopics').all(),
  });
});

adminRouter.put('/curriculum/subtopics/:code', owner, (req, res) => {
  const db = getDb();
  const s = db.prepare('SELECT * FROM subtopics WHERE code = ?').get(req.params.code);
  if (!s) return bad(res, 'Subtopik tidak ditemukan.', 404);
  const b = req.body || {};
  const status = b.status ?? s.status;
  if (!['active', 'soon', 'hidden'].includes(status)) return bad(res, 'Status tidak valid.');
  db.prepare('UPDATE subtopics SET name = ?, description = ?, status = ? WHERE code = ?')
    .run(String(b.name ?? s.name).slice(0, 80), String(b.description ?? s.description).slice(0, 300), status, s.code);
  if (b.universities) {
    tx(db, () => {
      db.prepare('DELETE FROM university_subtopics WHERE subtopic_code = ?').run(s.code);
      for (const u of b.universities) db.prepare('INSERT OR IGNORE INTO university_subtopics(university_code, subtopic_code) SELECT code, ? FROM universities WHERE code = ?').run(s.code, String(u));
    });
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------- panduan kampus

adminRouter.put('/guides/:code', (req, res) => {
  const db = getDb();
  const code = String(req.params.code).toUpperCase();
  if (!db.prepare('SELECT 1 FROM universities WHERE code = ?').get(code)) return bad(res, 'Kampus tidak ditemukan.', 404);
  const md = String(req.body?.content_md || '').slice(0, 50_000);
  db.prepare(`INSERT INTO guides(university_code, content_md, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(university_code) DO UPDATE SET content_md = excluded.content_md, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .run(code, md, nowIso(), req.user.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- blueprint try out (pemilik)

adminRouter.get('/blueprints', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM tryout_blueprints ORDER BY sort').all();
  res.json({ blueprints: rows.map((b) => ({ ...b, sections: parseJson(b.sections, []), rules: parseJson(b.rules, {}) })) });
});

adminRouter.put('/blueprints/:id', owner, (req, res) => {
  const db = getDb();
  const b = db.prepare('SELECT * FROM tryout_blueprints WHERE id = ?').get(req.params.id);
  if (!b) return bad(res, 'Blueprint tidak ditemukan.', 404);
  const sections = req.body?.sections;
  if (!Array.isArray(sections) || !sections.every((s) => s && typeof s.name === 'string' && Number(s.minutes) > 0 && s.composition && typeof s.composition === 'object')) {
    return bad(res, 'Bagian harus berisi nama, menit, dan komposisi.');
  }
  db.prepare('UPDATE tryout_blueprints SET name = ?, sections = ?, rules = ?, source_note = ?, updated_at = ? WHERE id = ?')
    .run(String(req.body?.name || b.name).slice(0, 80), JSON.stringify(sections), JSON.stringify(req.body?.rules || parseJson(b.rules, {})),
      String(req.body?.source_note ?? b.source_note).slice(0, 500), nowIso(), b.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- metrik ringkas

adminRouter.get('/metrics', (_req, res) => {
  const db = getDb();
  const since = (days) => new Date(Date.now() - days * 864e5).toISOString();
  const perDay = (sql) => db.prepare(sql).all(since(14));
  res.json({
    users_total: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    users_new_7d: db.prepare('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?').get(since(7)).n,
    sessions_per_day: perDay("SELECT substr(started_at,1,10) AS day, COUNT(*) AS n FROM practice_sessions WHERE started_at >= ? GROUP BY day ORDER BY day"),
    answers_per_day: perDay("SELECT substr(answered_at,1,10) AS day, COUNT(*) AS n FROM session_items WHERE answered_at >= ? GROUP BY day ORDER BY day"),
    reports_open: db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status != 'closed'").get().n,
    questions_by_status: Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS n FROM questions GROUP BY status').all().map((r) => [r.status, r.n])),
    skipped_total: db.prepare('SELECT COUNT(*) AS n FROM skipped_questions').get().n,
    helpful_rate: db.prepare('SELECT AVG(helpful) AS r, COUNT(*) AS n FROM explanation_ratings').get(),
    funnel: {
      signup: db.prepare("SELECT COUNT(*) AS n FROM events WHERE name = 'signup_completed'").get().n,
      onboarding: db.prepare("SELECT COUNT(*) AS n FROM events WHERE name = 'onboarding_completed'").get().n,
      first_practice: db.prepare("SELECT COUNT(DISTINCT actor) AS n FROM events WHERE name = 'practice_completed'").get().n,
    },
  });
});

// ---------------------------------------------------------------- pengaturan & peran (pemilik)

adminRouter.get('/settings', (_req, res) => {
  const db = getDb();
  res.json({
    mascot_enabled: getSetting(db, 'mascot_enabled', true),
    auto_hide_wrong_key_reports: getSetting(db, 'auto_hide_wrong_key_reports', 3),
    calibration: getSetting(db, 'calibration', {}),
    difficulty_mix: getSetting(db, 'difficulty_mix', {}),
  });
});

adminRouter.put('/settings', owner, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (b.mascot_enabled !== undefined) setSetting(db, 'mascot_enabled', !!b.mascot_enabled);
  if (b.auto_hide_wrong_key_reports !== undefined) setSetting(db, 'auto_hide_wrong_key_reports', Math.max(1, Number(b.auto_hide_wrong_key_reports) | 0));
  if (b.calibration && typeof b.calibration === 'object') setSetting(db, 'calibration', { ...getSetting(db, 'calibration', {}), ...b.calibration });
  if (b.difficulty_mix && typeof b.difficulty_mix === 'object') {
    const m = b.difficulty_mix;
    const sum = Number(m.easy) + Number(m.medium) + Number(m.hard);
    if (Math.abs(sum - 1) > 0.01) return bad(res, 'Bobot kesulitan harus berjumlah 100%.');
    setSetting(db, 'difficulty_mix', { easy: Number(m.easy), medium: Number(m.medium), hard: Number(m.hard) });
  }
  res.json({ ok: true });
});

adminRouter.post('/calibrate', owner, (_req, res) => {
  res.json(runCalibration(getDb()));
});

adminRouter.put('/roles', owner, (req, res) => {
  const db = getDb();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = String(req.body?.role || '');
  if (!['user', 'contributor', 'owner'].includes(role)) return bad(res, 'Peran tidak valid.');
  const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!u) return bad(res, 'Pengguna dengan email itu belum terdaftar.', 404);
  if (u.id === req.user.id && role !== 'owner') return bad(res, 'Kamu tidak bisa menurunkan peranmu sendiri.');
  db.prepare('UPDATE profiles SET role = ? WHERE user_id = ?').run(role, u.id);
  res.json({ ok: true });
});

adminRouter.get('/staff', (_req, res) => {
  const rows = getDb().prepare("SELECT u.email, p.display_name, p.role FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.role != 'user' ORDER BY p.role DESC").all();
  res.json({ staff: rows });
});
