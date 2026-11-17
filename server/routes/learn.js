import express from 'express';
import { getDb, uid, getSetting, parseJson } from '../db.js';
import { requireUser } from '../lib/auth.js';
import { rateLimit } from '../lib/ratelimit.js';
import { track } from '../lib/events.js';
import {
  createSession, sessionPayload, updateItem, submitSession, PracticeError, userHasSeen, userHasRevealed,
} from '../lib/practice.js';

export const learnRouter = express.Router();

export const REPORT_CATEGORIES = {
  kunci_salah: 'Kunci jawaban salah',
  salah_ketik: 'Salah ketik',
  ambigu: 'Soal ambigu',
  pembahasan_salah: 'Pembahasan salah',
  gambar_rusak: 'Gambar rusak',
  duplikat: 'Soal duplikat',
  hak_cipta: 'Masalah hak cipta',
};

function handle(fn) {
  return (req, res) => {
    try {
      const out = fn(req, res);
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (e) {
      if (e instanceof PracticeError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.' });
    }
  };
}

// ---------------------------------------------------------------- publik

learnRouter.get('/public/overview', handle(() => {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) AS n FROM questions WHERE status = 'active' AND type = 'mcq'").get().n;
  const universities = db.prepare('SELECT code, name, tagline FROM universities ORDER BY sort').all();
  const units = db.prepare(`SELECT u.code, u.name, u.description,
      (SELECT COUNT(*) FROM questions q JOIN subtopics s ON s.code = q.subtopic_code WHERE s.unit_code = u.code AND q.status = 'active' AND q.type = 'mcq' AND s.status = 'active') AS question_count,
      (SELECT COUNT(*) FROM subtopics s WHERE s.unit_code = u.code AND s.status != 'hidden') AS subtopic_count
    FROM units u ORDER BY u.sort`).all();
  return { question_count: total, universities, units, mascot_enabled: getSetting(db, 'mascot_enabled', true) };
}));

// Satu cuplikan soal tetap untuk landing (bukan daftar soal massal).
learnRouter.get('/public/sample', handle(() => {
  const db = getDb();
  const q = db.prepare(`SELECT q.stem, q.options, q.answer, q.explanation, q.explanation_source, s.name AS subtopic_name, q.difficulty_final AS difficulty
    FROM questions q JOIN subtopics s ON s.code = q.subtopic_code
    WHERE q.status = 'active' AND q.type = 'mcq' AND q.passage_id IS NULL AND q.subtopic_code = 'NUMERIK.BARISAN'
      AND length(q.stem) < 200 AND q.explanation_source IS NOT NULL ORDER BY q.difficulty_final = 'easy' DESC, q.id LIMIT 1`).get()
    || db.prepare(`SELECT q.stem, q.options, q.answer, q.explanation, q.explanation_source, s.name AS subtopic_name, q.difficulty_final AS difficulty
    FROM questions q JOIN subtopics s ON s.code = q.subtopic_code WHERE q.status = 'active' AND q.type = 'mcq' AND q.passage_id IS NULL ORDER BY q.id LIMIT 1`).get();
  if (!q) return { sample: null };
  return { sample: { ...q, options: parseJson(q.options, {}) } };
}));

learnRouter.get('/settings/public', handle(() => ({ mascot_enabled: getSetting(getDb(), 'mascot_enabled', true) })));

learnRouter.get('/guides/:code', handle((req) => {
  const db = getDb();
  const code = String(req.params.code).toUpperCase();
  const uni = db.prepare('SELECT code, name, tagline FROM universities WHERE code = ?').get(code);
  if (!uni) throw new PracticeError('Kampus tidak ditemukan.', 404);
  const g = db.prepare('SELECT content_md, updated_at FROM guides WHERE university_code = ?').get(code);
  const subs = db.prepare(`SELECT s.code, s.name, s.unit_code, s.status FROM university_subtopics us JOIN subtopics s ON s.code = us.subtopic_code
    WHERE us.university_code = ? AND s.status != 'hidden' ORDER BY s.sort`).all(code);
  return { university: uni, content_md: g?.content_md || '', updated_at: g?.updated_at || null, subtopics: subs };
}));

// ---------------------------------------------------------------- kurikulum

learnRouter.get('/curriculum', requireUser, handle((req) => {
  const db = getDb();
  const uni = String(req.query.university || '').toUpperCase();
  const showAll = req.query.all === '1';
  const universities = db.prepare('SELECT code, name, tagline FROM universities ORDER BY sort').all();
  const mapped = uni ? new Set(db.prepare('SELECT subtopic_code FROM university_subtopics WHERE university_code = ?').all(uni).map((r) => r.subtopic_code)) : null;

  const counts = new Map();
  for (const r of db.prepare(`SELECT subtopic_code, difficulty_final AS d, COUNT(*) AS n FROM questions
    WHERE status = 'active' AND type = 'mcq' GROUP BY subtopic_code, difficulty_final`).all()) {
    const c = counts.get(r.subtopic_code) || { total: 0, easy: 0, medium: 0, hard: 0 };
    c[r.d] = r.n; c.total += r.n;
    counts.set(r.subtopic_code, c);
  }
  const prog = new Map(db.prepare(`SELECT q.subtopic_code AS code, COUNT(*) AS answered, SUM(ua.correct_count) AS correct, SUM(ua.attempts) AS attempts
    FROM user_answers ua JOIN questions q ON q.id = ua.question_id WHERE ua.user_id = ? GROUP BY q.subtopic_code`).all(req.user.id).map((r) => [r.code, r]));

  const subs = db.prepare("SELECT * FROM subtopics WHERE status != 'hidden' ORDER BY sort").all();
  const units = db.prepare('SELECT * FROM units ORDER BY sort').all().map((u) => {
    const list = subs.filter((s) => s.unit_code === u.code).map((s) => {
      const c = counts.get(s.code) || { total: 0, easy: 0, medium: 0, hard: 0 };
      const p = prog.get(s.code);
      return {
        code: s.code, name: s.name, description: s.description,
        status: s.status === 'active' && c.total > 0 ? 'active' : 'soon',
        in_university: mapped ? mapped.has(s.code) : true,
        question_count: c.total,
        difficulties: { easy: c.easy, medium: c.medium, hard: c.hard },
        answered: p?.answered || 0,
        accuracy: p?.attempts ? p.correct / p.attempts : null,
      };
    }).filter((s) => showAll || s.in_university);
    const answered = list.reduce((n, s) => n + s.answered, 0);
    const total = list.reduce((n, s) => n + s.question_count, 0);
    return { code: u.code, name: u.name, description: u.description, subtopics: list, answered, question_count: total };
  }).filter((u) => u.subtopics.length);
  const hiddenCount = mapped ? subs.filter((s) => !mapped.has(s.code)).length : 0;
  return { university: uni || null, universities, units, hidden_count: showAll ? 0 : hiddenCount };
}));

// ---------------------------------------------------------------- sesi latihan

const answerLimit = rateLimit({ name: 'answer', windowMs: 60_000, max: 240, key: 'user' });

learnRouter.post('/sessions', requireUser, rateLimit({ name: 'session', windowMs: 60_000, max: 20, key: 'user' }), handle((req, res) => {
  const db = getDb();
  const id = createSession(db, req.user.id, req.body || {});
  res.status(201);
  return sessionPayload(db, req.user.id, id);
}));

learnRouter.get('/sessions/:id', requireUser, handle((req) => sessionPayload(getDb(), req.user.id, req.params.id)));

learnRouter.patch('/sessions/:id/items/:idx', requireUser, answerLimit, handle((req) => {
  const idx = Number(req.params.idx);
  if (!Number.isInteger(idx) || idx < 0) throw new PracticeError('Nomor soal tidak valid.');
  return updateItem(getDb(), req.user.id, req.params.id, idx, req.body || {});
}));

learnRouter.post('/sessions/:id/submit', requireUser, handle((req) => {
  const db = getDb();
  submitSession(db, req.user.id, req.params.id);
  return sessionPayload(db, req.user.id, req.params.id);
}));

learnRouter.delete('/sessions/:id', requireUser, handle((req) => {
  const db = getDb();
  const s = db.prepare('SELECT user_id, status FROM practice_sessions WHERE id = ?').get(req.params.id);
  if (!s || s.user_id !== req.user.id) throw new PracticeError('Sesi tidak ditemukan.', 404);
  if (s.status !== 'active') throw new PracticeError('Sesi yang sudah dikumpulkan tidak bisa dibuang.', 409);
  db.prepare('DELETE FROM session_items WHERE session_id = ?').run(req.params.id);
  db.prepare('DELETE FROM practice_sessions WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

// ---------------------------------------------------------------- aksi per soal

learnRouter.post('/questions/:id/bookmark', requireUser, handle((req) => {
  const db = getDb();
  if (!userHasSeen(db, req.user.id, req.params.id)) throw new PracticeError('Soal tidak ditemukan.', 404);
  const on = req.body?.on !== false;
  if (on) {
    const r = db.prepare('INSERT OR IGNORE INTO bookmarks(user_id, question_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    if (r.changes) track(db, 'bookmark_added', req.user.id, { question_id: req.params.id });
  } else {
    db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?').run(req.user.id, req.params.id);
  }
  return { ok: true, bookmarked: on };
}));

learnRouter.post('/questions/:id/rate', requireUser, handle((req) => {
  const db = getDb();
  if (!userHasRevealed(db, req.user.id, req.params.id)) throw new PracticeError('Pembahasan belum terbuka untuk soal ini.', 403);
  const helpful = req.body?.helpful ? 1 : 0;
  db.prepare(`INSERT INTO explanation_ratings(question_id, user_id, helpful) VALUES (?, ?, ?)
    ON CONFLICT(question_id, user_id) DO UPDATE SET helpful = excluded.helpful, created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(req.params.id, req.user.id, helpful);
  const q = db.prepare('SELECT explanation_source FROM questions WHERE id = ?').get(req.params.id);
  track(db, 'explanation_rated', req.user.id, { question_id: req.params.id, helpful: !!helpful, source: q?.explanation_source });
  return { ok: true, helpful: !!helpful };
}));

learnRouter.post('/questions/:id/report', requireUser, rateLimit({ name: 'report', windowMs: 60 * 60_000, max: 20, key: 'user' }), handle((req, res) => {
  const db = getDb();
  if (!userHasSeen(db, req.user.id, req.params.id)) throw new PracticeError('Soal tidak ditemukan.', 404);
  const category = String(req.body?.category || '');
  if (!REPORT_CATEGORIES[category]) throw new PracticeError('Pilih kategori laporan.');
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  const dup = db.prepare("SELECT id FROM reports WHERE question_id = ? AND user_id = ? AND category = ? AND status != 'closed'").get(req.params.id, req.user.id, category);
  if (dup) return { ok: true, id: dup.id, duplicate: true };
  const id = uid('r_');
  db.prepare('INSERT INTO reports(id, question_id, user_id, category, note) VALUES (?, ?, ?, ?, ?)').run(id, req.params.id, req.user.id, category, note);
  track(db, 'question_reported', req.user.id, { question_id: req.params.id, category });

  // Tiga laporan "kunci jawaban salah" dari pengguna berbeda: sembunyikan sementara dari latihan.
  if (category === 'kunci_salah') {
    const threshold = getSetting(db, 'auto_hide_wrong_key_reports', 3);
    const n = db.prepare("SELECT COUNT(DISTINCT user_id) AS n FROM reports WHERE question_id = ? AND category = 'kunci_salah' AND status != 'closed'").get(req.params.id).n;
    if (n >= threshold) {
      db.prepare("UPDATE questions SET status = 'hidden', hidden_reason = 'Disembunyikan otomatis: 3 laporan kunci jawaban salah' WHERE id = ? AND status = 'active'").run(req.params.id);
    }
  }
  res.status(201);
  return { ok: true, id };
}));

learnRouter.get('/report-categories', (_req, res) => res.json({ categories: REPORT_CATEGORIES }));
