// Sesi latihan: pemilihan soal, penyimpanan jawaban, dan pengumpulan.
//
// Aturan kerahasiaan (PRD F6, F8): jawaban benar dan pembahasan hanya dikirim bila
//   - mode santai dan soal itu sudah dijawab (revealed = 1), atau
//   - sesi sudah dikumpulkan.

import { tx, uid, nowIso, parseJson, getSetting } from '../db.js';
import { track } from './events.js';

export const COUNTS = [10, 20, 30];
export const MODES = ['santai', 'ujian'];
export const DIFFS = ['mixed', 'easy', 'medium', 'hard'];
const DEADLINE_GRACE_MS = 5000;
const MAX_ITEM_MS = 60 * 60 * 1000;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class PracticeError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/**
 * Pilih soal sesuai aturan PRD:
 *   1. belum pernah dijawab, 2. pernah salah > 3 hari, 3. pernah benar > 14 hari,
 *   lalu (bila stok habis) soal lama yang paling lama tidak dikerjakan.
 * Bobot kesulitan campuran 30/50/20. Soal satu bacaan diambil bersama dan berurutan.
 */
export function selectQuestions(db, userId, { subtopics, count, difficulty, questionIds }) {
  let pool;
  if (questionIds) {
    if (!questionIds.length) return [];
    const ph = questionIds.map(() => '?').join(',');
    pool = db.prepare(`SELECT q.id, q.passage_id, q.seq, q.source_file_id, q.difficulty_final AS diff, ua.last_correct, ua.last_answered_at
      FROM questions q LEFT JOIN user_answers ua ON ua.question_id = q.id AND ua.user_id = ?
      WHERE q.id IN (${ph}) AND q.status = 'active' AND q.type = 'mcq'`).all(userId, ...questionIds);
  } else {
    const ph = subtopics.map(() => '?').join(',');
    pool = db.prepare(`SELECT q.id, q.passage_id, q.seq, q.source_file_id, q.difficulty_final AS diff, ua.last_correct, ua.last_answered_at
      FROM questions q LEFT JOIN user_answers ua ON ua.question_id = q.id AND ua.user_id = ?
      WHERE q.subtopic_code IN (${ph}) AND q.status = 'active' AND q.type = 'mcq'`).all(userId, ...subtopics);
  }
  if (difficulty && difficulty !== 'mixed') pool = pool.filter((q) => q.diff === difficulty);
  if (!pool.length) return [];

  const now = Date.now();
  const age = (q) => (q.last_answered_at ? now - Date.parse(q.last_answered_at) : Infinity);
  const bucketOf = (q) => {
    if (!q.last_answered_at) return 0;
    if (!q.last_correct && age(q) > 3 * 864e5) return 1;
    if (q.last_correct && age(q) > 14 * 864e5) return 2;
    return 3;
  };

  // Kelompokkan soal satu bacaan menjadi satu unit pilihan.
  const groups = new Map();
  for (const q of pool) {
    const key = q.passage_id ? `p:${q.passage_id}` : `q:${q.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  const units = [...groups.values()].map((items) => {
    items.sort((a, b) => a.seq - b.seq);
    const bucket = Math.min(...items.map(bucketOf));
    const oldest = Math.max(...items.map(age));
    const diffs = items.map((i) => i.diff);
    return { items, bucket, oldest, diff: diffs.sort((a, b) => diffs.filter((d) => d === b).length - diffs.filter((d) => d === a).length)[0] };
  });

  // Urutan prioritas: bucket kecil dulu; di dalam bucket diacak; bucket 3 urut dari yang paling lama.
  const byBucket = [0, 1, 2, 3].map((b) => units.filter((u) => u.bucket === b));
  byBucket.slice(0, 3).forEach(shuffle);
  byBucket[3].sort((a, b) => b.oldest - a.oldest);
  const ordered = byBucket.flat();

  const mix = getSetting(db, 'difficulty_mix', { easy: 0.3, medium: 0.5, hard: 0.2 });
  const target = difficulty === 'mixed'
    ? { easy: Math.round(count * mix.easy), hard: Math.round(count * mix.hard) }
    : null;
  if (target) target.medium = count - target.easy - target.hard;

  const chosen = [];
  const used = new Set();
  const taken = { easy: 0, medium: 0, hard: 0 };
  const take = (u) => {
    const room = count - chosen.length;
    const items = u.items.slice(0, room);
    for (const it of items) { chosen.push(it); taken[it.diff] = (taken[it.diff] || 0) + 1; }
    used.add(u);
  };
  if (target) {
    // Putaran pertama: hormati kuota kesulitan. Putaran kedua: isi sisa dari mana saja.
    for (const u of ordered) {
      if (chosen.length >= count) break;
      if ((taken[u.diff] || 0) < (target[u.diff] ?? 0)) take(u);
    }
  }
  for (const u of ordered) {
    if (chosen.length >= count) break;
    if (!used.has(u)) take(u);
  }

  // Acak urutan antarkelompok, tetapi soal satu bacaan tetap berdampingan.
  const blocks = [];
  const blockOf = new Map();
  for (const q of chosen) {
    const key = q.passage_id ? `p:${q.passage_id}` : `q:${q.id}`;
    if (!blockOf.has(key)) { const b = []; blockOf.set(key, b); blocks.push(b); }
    blockOf.get(key).push(q);
  }
  return shuffle(blocks).flat().map((q) => q.id);
}

export function activeSubtopics(db) {
  return new Set(db.prepare("SELECT code FROM subtopics WHERE status = 'active'").all().map((r) => r.code));
}

/**
 * Buat sesi latihan baru.
 * @param {object} cfg { source: 'subtopic'|'unit'|'retry'|'bookmarks', subtopics?, unit?, count, difficulty, mode, timerMinutes?, retryOf? }
 */
export function createSession(db, userId, cfg) {
  const mode = MODES.includes(cfg.mode) ? cfg.mode : 'santai';
  const difficulty = DIFFS.includes(cfg.difficulty) ? cfg.difficulty : 'mixed';
  const timer = cfg.timerMinutes ? Math.max(1, Math.min(180, Math.round(Number(cfg.timerMinutes)))) : null;
  const active = activeSubtopics(db);
  let count = COUNTS.includes(Number(cfg.count)) ? Number(cfg.count) : 10;
  let ids;
  let title;
  let subtopics = [];

  if (cfg.source === 'retry') {
    const s = db.prepare('SELECT * FROM practice_sessions WHERE id = ? AND user_id = ?').get(cfg.retryOf, userId);
    if (!s || s.status !== 'submitted') throw new PracticeError('Sesi asal tidak ditemukan atau belum dikumpulkan.', 404);
    const wrong = db.prepare('SELECT question_id FROM session_items WHERE session_id = ? AND (is_correct IS NULL OR is_correct = 0) ORDER BY idx').all(s.id).map((r) => r.question_id);
    if (!wrong.length) throw new PracticeError('Tidak ada soal salah di sesi ini. Mantap!');
    count = wrong.length;
    ids = selectQuestions(db, userId, { questionIds: wrong, count, difficulty: 'mixed' });
    title = `Ulangi yang salah: ${s.title}`;
    subtopics = parseJson(s.config, {}).subtopics || [];
  } else if (cfg.source === 'bookmarks') {
    const marked = db.prepare('SELECT question_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC').all(userId).map((r) => r.question_id);
    if (!marked.length) throw new PracticeError('Belum ada soal yang kamu tandai.');
    ids = selectQuestions(db, userId, { questionIds: marked, count: Math.min(count, marked.length), difficulty });
    title = 'Soal yang ditandai';
  } else {
    if (cfg.source === 'unit') {
      subtopics = db.prepare("SELECT code FROM subtopics WHERE unit_code = ? AND status = 'active'").all(String(cfg.unit || '')).map((r) => r.code);
      const unit = db.prepare('SELECT name FROM units WHERE code = ?').get(String(cfg.unit || ''));
      if (!unit) throw new PracticeError('Unit tidak ditemukan.', 404);
      title = `Unit ${unit.name}`;
    } else {
      subtopics = (Array.isArray(cfg.subtopics) ? cfg.subtopics : []).map(String).filter((c) => active.has(c));
      const names = subtopics.length
        ? db.prepare(`SELECT name FROM subtopics WHERE code IN (${subtopics.map(() => '?').join(',')}) ORDER BY sort`).all(...subtopics).map((r) => r.name)
        : [];
      title = names.join(', ');
    }
    if (!subtopics.length) throw new PracticeError('Pilih minimal satu subtopik yang aktif.');
    ids = selectQuestions(db, userId, { subtopics, count, difficulty });
  }
  if (!ids.length) throw new PracticeError('Belum ada soal yang cocok dengan pilihanmu. Coba ganti tingkat kesulitan.');

  const id = uid('s_');
  const started = nowIso();
  const deadline = timer ? new Date(Date.now() + timer * 60_000).toISOString() : null;
  const config = { source: cfg.source || 'subtopic', subtopics, unit: cfg.unit || null, count, difficulty, timerMinutes: timer, retryOf: cfg.retryOf || null };
  tx(db, () => {
    db.prepare('INSERT INTO practice_sessions(id, user_id, kind, mode, title, config, started_at, deadline_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, 'practice', mode, title, JSON.stringify(config), started, deadline);
    const ins = db.prepare('INSERT INTO session_items(session_id, idx, question_id) VALUES (?, ?, ?)');
    ids.forEach((qid, i) => ins.run(id, i, qid));
  });
  track(db, 'practice_started', userId, { source: config.source, subtopics, count: ids.length, mode, difficulty });
  return id;
}

function getOwnedSession(db, userId, sessionId) {
  const s = db.prepare('SELECT * FROM practice_sessions WHERE id = ?').get(sessionId);
  if (!s || s.user_id !== userId) throw new PracticeError('Sesi tidak ditemukan.', 404);
  return s;
}

function isExpired(s) {
  return s.status === 'active' && s.deadline_at && Date.now() > Date.parse(s.deadline_at) + DEADLINE_GRACE_MS;
}

/** Bentuk sesi untuk klien. Jawaban dan pembahasan hanya disertakan bila boleh. */
export function sessionPayload(db, userId, sessionId) {
  let s = getOwnedSession(db, userId, sessionId);
  if (isExpired(s)) { submitSession(db, userId, sessionId, { auto: true }); s = getOwnedSession(db, userId, sessionId); }
  const submitted = s.status === 'submitted';
  const rows = db.prepare(`SELECT i.*, q.stem, q.options, q.type, q.subtopic_code, q.unit_code, q.difficulty_final, q.passage_id,
      q.answer AS correct_answer, q.explanation, q.explanation_source, q.answer_source, q.status AS q_status,
      sub.name AS subtopic_name, p.title AS passage_title, p.text AS passage_text,
      (SELECT 1 FROM bookmarks b WHERE b.user_id = ? AND b.question_id = q.id) AS bookmarked,
      (SELECT helpful FROM explanation_ratings r WHERE r.user_id = ? AND r.question_id = q.id) AS rating
    FROM session_items i JOIN questions q ON q.id = i.question_id
    LEFT JOIN subtopics sub ON sub.code = q.subtopic_code
    LEFT JOIN passages p ON p.id = q.passage_id
    WHERE i.session_id = ? ORDER BY i.idx`).all(userId, userId, sessionId);

  const passages = {};
  const items = rows.map((r) => {
    if (r.passage_id && !passages[r.passage_id]) passages[r.passage_id] = { id: r.passage_id, title: r.passage_title, text: r.passage_text };
    const reveal = submitted || (s.mode === 'santai' && r.revealed);
    const item = {
      idx: r.idx,
      question_id: r.question_id,
      stem: r.stem,
      options: parseJson(r.options, {}),
      type: r.type,
      subtopic: r.subtopic_code,
      subtopic_name: r.subtopic_name,
      unit: r.unit_code,
      difficulty: r.difficulty_final,
      passage_id: r.passage_id,
      answer: r.answer,
      flagged: !!r.flagged,
      time_ms: r.time_ms,
      bookmarked: !!r.bookmarked,
      revealed: !!reveal,
    };
    if (reveal) {
      item.correct_answer = r.correct_answer;
      item.is_correct = r.answer == null ? null : r.answer === r.correct_answer;
      item.explanation = r.explanation;
      item.explanation_source = r.explanation_source;
      item.rating = r.rating == null ? null : !!r.rating;
    }
    return item;
  });

  const cfg = parseJson(s.config, {});
  return {
    id: s.id,
    title: s.title,
    mode: s.mode,
    status: s.status,
    config: cfg,
    started_at: s.started_at,
    deadline_at: s.deadline_at,
    submitted_at: s.submitted_at,
    server_now: nowIso(),
    current_idx: s.current_idx,
    result: submitted ? { correct: s.correct, wrong: s.wrong, blank: s.blank, score: s.score, total_ms: s.total_ms, auto: !!cfg.autoSubmitted } : null,
    items,
    passages,
  };
}

function recordUserAnswer(db, userId, questionId, correct, at) {
  db.prepare(`INSERT INTO user_answers(user_id, question_id, attempts, correct_count, last_correct, last_answered_at)
    VALUES (?, ?, 1, ?, ?, ?)
    ON CONFLICT(user_id, question_id) DO UPDATE SET attempts = attempts + 1, correct_count = correct_count + excluded.correct_count,
      last_correct = excluded.last_correct, last_answered_at = excluded.last_answered_at`)
    .run(userId, questionId, correct ? 1 : 0, correct ? 1 : 0, at);
}

/**
 * Simpan jawaban/ragu/waktu untuk satu soal.
 * Mode santai: jawaban terkunci setelah dipilih dan pembahasan langsung dikirim.
 * Mode ujian: jawaban boleh diganti dan tidak ada yang dibuka sampai dikumpulkan.
 */
export function updateItem(db, userId, sessionId, idx, patch) {
  const s = getOwnedSession(db, userId, sessionId);
  if (s.status !== 'active') throw new PracticeError('Sesi ini sudah dikumpulkan.', 409);
  if (isExpired(s)) {
    submitSession(db, userId, sessionId, { auto: true });
    throw new PracticeError('Waktu habis. Sesi sudah dikumpulkan otomatis.', 410);
  }
  const item = db.prepare('SELECT i.*, q.answer AS correct_answer, q.options FROM session_items i JOIN questions q ON q.id = i.question_id WHERE i.session_id = ? AND i.idx = ?').get(sessionId, idx);
  if (!item) throw new PracticeError('Soal tidak ditemukan di sesi ini.', 404);

  const now = nowIso();
  const sets = [];
  const vals = [];
  let revealedNow = false;

  if (patch.time_ms != null) {
    const t = Math.max(0, Math.min(MAX_ITEM_MS, Math.round(Number(patch.time_ms) || 0)));
    sets.push('time_ms = MAX(time_ms, ?)'); vals.push(t);
  }
  if (patch.flagged != null) { sets.push('flagged = ?'); vals.push(patch.flagged ? 1 : 0); }
  if (patch.answer !== undefined) {
    const options = parseJson(item.options, {});
    const ans = patch.answer === null ? null : String(patch.answer).toUpperCase();
    if (ans !== null && !(ans in options)) throw new PracticeError('Pilihan jawaban tidak valid.');
    if (s.mode === 'santai') {
      if (item.revealed) throw new PracticeError('Jawaban soal ini sudah dikunci.', 409);
      if (ans === null) throw new PracticeError('Pilih salah satu jawaban.');
      const correct = ans === item.correct_answer;
      sets.push('answer = ?', 'is_correct = ?', 'revealed = 1', 'answered_at = ?'); vals.push(ans, correct ? 1 : 0, now);
      revealedNow = true;
    } else {
      sets.push('answer = ?', 'answered_at = ?'); vals.push(ans, ans === null ? null : now);
    }
  }
  if (!sets.length && patch.current_idx == null) return { ok: true };

  tx(db, () => {
    if (sets.length) db.prepare(`UPDATE session_items SET ${sets.join(', ')} WHERE session_id = ? AND idx = ?`).run(...vals, sessionId, idx);
    if (patch.current_idx != null) db.prepare('UPDATE practice_sessions SET current_idx = ? WHERE id = ?').run(Math.max(0, Number(patch.current_idx) | 0), sessionId);
    if (revealedNow) recordUserAnswer(db, userId, item.question_id, patch.answer.toUpperCase() === item.correct_answer, now);
  });
  if (patch.answer !== undefined && patch.answer !== null) {
    track(db, 'question_answered', userId, { question_id: item.question_id, mode: s.mode, ...(revealedNow ? { correct: patch.answer.toUpperCase() === item.correct_answer } : {}) });
  }
  if (revealedNow) {
    const p = sessionPayload(db, userId, sessionId);
    return { ok: true, item: p.items[idx] };
  }
  return { ok: true };
}

export function submitSession(db, userId, sessionId, { auto = false } = {}) {
  const s = getOwnedSession(db, userId, sessionId);
  if (s.status === 'submitted') return;
  const now = nowIso();
  tx(db, () => {
    const items = db.prepare('SELECT i.*, q.answer AS correct_answer FROM session_items i JOIN questions q ON q.id = i.question_id WHERE i.session_id = ?').all(sessionId);
    let correct = 0; let wrong = 0; let blank = 0; let totalMs = 0;
    const upd = db.prepare('UPDATE session_items SET is_correct = ? WHERE session_id = ? AND idx = ?');
    for (const it of items) {
      totalMs += it.time_ms || 0;
      if (it.answer == null) { blank++; upd.run(null, sessionId, it.idx); continue; }
      const ok = it.answer === it.correct_answer;
      if (ok) correct++; else wrong++;
      upd.run(ok ? 1 : 0, sessionId, it.idx);
      // Mode santai sudah dicatat saat jawaban dibuka.
      if (!(s.mode === 'santai' && it.revealed)) recordUserAnswer(db, userId, it.question_id, ok, it.answered_at || now);
    }
    const elapsed = Date.now() - Date.parse(s.started_at);
    const cfg = parseJson(s.config, {});
    if (auto) cfg.autoSubmitted = true;
    db.prepare(`UPDATE practice_sessions SET status = 'submitted', submitted_at = ?, correct = ?, wrong = ?, blank = ?, score = ?, total_ms = ?, config = ? WHERE id = ?`)
      .run(now, correct, wrong, blank, items.length ? Math.round((correct / items.length) * 1000) / 10 : 0, totalMs || elapsed, JSON.stringify(cfg), sessionId);
    track(db, 'practice_completed', userId, { correct, total: items.length, total_ms: totalMs, mode: s.mode, auto });
  });
}

/** Pengguna hanya boleh berinteraksi dengan soal yang pernah muncul di sesinya. */
export function userHasSeen(db, userId, questionId) {
  return !!db.prepare(`SELECT 1 FROM session_items i JOIN practice_sessions s ON s.id = i.session_id
    WHERE s.user_id = ? AND i.question_id = ? LIMIT 1`).get(userId, questionId);
}

/** Pembahasan sudah terbuka untuk pengguna ini (santai sudah dijawab, atau sesi dikumpulkan). */
export function userHasRevealed(db, userId, questionId) {
  return !!db.prepare(`SELECT 1 FROM session_items i JOIN practice_sessions s ON s.id = i.session_id
    WHERE s.user_id = ? AND i.question_id = ? AND (s.status = 'submitted' OR (s.mode = 'santai' AND i.revealed = 1)) LIMIT 1`).get(userId, questionId);
}
