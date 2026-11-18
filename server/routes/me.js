import express from 'express';
import { getDb, tx } from '../db.js';
import { publicUser, requireUser, verifyPassword, clearSessionCookie } from '../lib/auth.js';
import { track } from '../lib/events.js';

export const meRouter = express.Router();
meRouter.use(requireUser);

const UNIS = ['UNAIR', 'UGM', 'UI'];

meRouter.patch('/profile', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const sets = [];
  const vals = [];
  if (b.display_name !== undefined) {
    const name = String(b.display_name).trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Nama tampil tidak boleh kosong.' });
    sets.push('display_name = ?'); vals.push(name);
  }
  if (b.target_universities !== undefined) {
    const list = [...new Set((Array.isArray(b.target_universities) ? b.target_universities : []).filter((u) => UNIS.includes(u)))].slice(0, 3);
    sets.push('target_universities = ?'); vals.push(JSON.stringify(list));
  }
  if (b.exam_date !== undefined) {
    const d = b.exam_date ? String(b.exam_date).slice(0, 10) : null;
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return res.status(400).json({ error: 'Format tanggal tes belum benar.' });
    sets.push('exam_date = ?'); vals.push(d);
  }
  if (b.daily_minutes !== undefined) {
    const m = b.daily_minutes == null ? null : Math.max(5, Math.min(600, Math.round(Number(b.daily_minutes)) || 0));
    sets.push('daily_minutes = ?'); vals.push(m);
  }
  if (b.font_scale !== undefined) {
    const f = Math.max(1, Math.min(1.5, Number(b.font_scale) || 1));
    sets.push('font_scale = ?'); vals.push(f);
  }
  if (b.tutorial_status !== undefined) {
    if (![null, 'done', 'skipped'].includes(b.tutorial_status)) return res.status(400).json({ error: 'Status tutorial tidak valid.' });
    sets.push('tutorial_status = ?'); vals.push(b.tutorial_status);
  }
  let finishedOnboarding = false;
  if (b.onboarded !== undefined) {
    sets.push('onboarded = ?'); vals.push(b.onboarded ? 1 : 0);
    finishedOnboarding = !!b.onboarded;
  }
  if (sets.length) {
    const before = db.prepare('SELECT onboarded FROM profiles WHERE user_id = ?').get(req.user.id);
    db.prepare(`UPDATE profiles SET ${sets.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = ?`).run(...vals, req.user.id);
    if (finishedOnboarding && !before.onboarded) {
      const p = publicUser(db, req.user.id);
      track(db, 'onboarding_completed', req.user.id, { universities: p.target_universities, has_exam_date: !!p.exam_date });
    }
  }
  res.json({ user: publicUser(db, req.user.id) });
});

meRouter.delete('/', async (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (u.password_hash) {
    if (!(await verifyPassword(String(req.body?.password || ''), u.password_hash))) {
      return res.status(401).json({ error: 'Kata sandi tidak cocok.' });
    }
  } else if (req.body?.confirm !== 'HAPUS') {
    return res.status(400).json({ error: 'Ketik HAPUS untuk mengonfirmasi.' });
  }
  tx(db, () => {
    const uid = req.user.id;
    db.prepare('DELETE FROM session_items WHERE session_id IN (SELECT id FROM practice_sessions WHERE user_id = ?)').run(uid);
    db.prepare('DELETE FROM practice_sessions WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM user_answers WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM bookmarks WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM explanation_ratings WHERE user_id = ?').run(uid);
    db.prepare('UPDATE reports SET user_id = NULL WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM email_tokens WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM profiles WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  });
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** Akurasi per subtopik dari riwayat jawaban pengguna. */
export function subtopicProgress(db, userId) {
  return db.prepare(`SELECT q.subtopic_code AS code, COUNT(*) AS answered, SUM(ua.correct_count) AS correct, SUM(ua.attempts) AS attempts
    FROM user_answers ua JOIN questions q ON q.id = ua.question_id WHERE ua.user_id = ? GROUP BY q.subtopic_code`).all(userId)
    .map((r) => ({ code: r.code, answered: r.answered, attempts: r.attempts, correct: r.correct, accuracy: r.attempts ? r.correct / r.attempts : null }));
}

// Hari dihitung dalam WIB (UTC+7). Hari "belajar" untuk streak = minimal 10 soal dijawab (PRD: Aturan bisnis).
const STREAK_MIN = 10;
const wibDay = (d = new Date()) => new Date(d.getTime() + 7 * 36e5).toISOString().slice(0, 10);

export function dailyGoal(minutes) {
  if (!minutes || minutes <= 15) return 10;
  if (minutes <= 30) return 20;
  if (minutes <= 60) return 30;
  return 40;
}

/** Misi harian, streak, dan tujuh hari terakhir untuk beranda dan maskot. */
export function dailyStats(db, userId, dailyMinutes) {
  const rows = db.prepare(`SELECT date(i.answered_at, '+7 hours') AS day, COUNT(*) AS n, SUM(i.is_correct = 1) AS correct
    FROM session_items i JOIN practice_sessions s ON s.id = i.session_id
    WHERE s.user_id = ? AND i.answer IS NOT NULL AND i.answered_at >= ?
    GROUP BY day`).all(userId, new Date(Date.now() - 400 * 864e5).toISOString());
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const today = wibDay();
  const dayStr = (offset) => wibDay(new Date(Date.now() - offset * 864e5));
  let streak = 0;
  // Hari ini belum mencapai target tidak memutus streak; hitung mundur mulai kemarin.
  const start = (byDay.get(today)?.n || 0) >= STREAK_MIN ? 0 : 1;
  for (let o = start; o < 400; o++) {
    if ((byDay.get(dayStr(o))?.n || 0) >= STREAK_MIN) streak++;
    else break;
  }
  const week = Array.from({ length: 7 }, (_, k) => {
    const day = dayStr(6 - k);
    const n = byDay.get(day)?.n || 0;
    return { day, n, done: n >= STREAK_MIN };
  });
  return {
    today_answered: byDay.get(today)?.n || 0,
    today_correct: byDay.get(today)?.correct || 0,
    daily_goal: dailyGoal(dailyMinutes),
    streak,
    streak_min: STREAK_MIN,
    week,
  };
}

meRouter.get('/daily', (req, res) => {
  const db = getDb();
  const user = publicUser(db, req.user.id);
  const active = db.prepare("SELECT id, title FROM practice_sessions WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1").get(req.user.id) || null;
  const weakest = subtopicProgress(db, req.user.id).filter((p) => p.attempts >= 5).sort((a, b) => a.accuracy - b.accuracy)[0] || null;
  const weakName = weakest ? db.prepare('SELECT name FROM subtopics WHERE code = ?').get(weakest.code)?.name : null;
  res.json({ ...dailyStats(db, req.user.id, user.daily_minutes), active_session: active, weakest: weakest ? { code: weakest.code, name: weakName, accuracy: weakest.accuracy } : null });
});

meRouter.get('/home', (req, res) => {
  const db = getDb();
  const user = publicUser(db, req.user.id);
  const targets = user.target_universities.length ? user.target_universities : UNIS;

  const active = db.prepare(`SELECT id, title, mode, started_at, deadline_at, current_idx,
      (SELECT COUNT(*) FROM session_items i WHERE i.session_id = s.id) AS total,
      (SELECT COUNT(*) FROM session_items i WHERE i.session_id = s.id AND i.answer IS NOT NULL) AS answered
    FROM practice_sessions s WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1`).get(req.user.id) || null;

  const progress = subtopicProgress(db, req.user.id);
  const progMap = new Map(progress.map((p) => [p.code, p]));
  const ph = targets.map(() => '?').join(',');
  const subs = db.prepare(`SELECT DISTINCT s.code, s.name, s.unit_code, s.description, s.sort,
      (SELECT COUNT(*) FROM questions q WHERE q.subtopic_code = s.code AND q.status = 'active' AND q.type = 'mcq') AS question_count
    FROM subtopics s JOIN university_subtopics us ON us.subtopic_code = s.code
    WHERE us.university_code IN (${ph}) AND s.status = 'active' ORDER BY s.sort`).all(...targets).filter((s) => s.question_count > 0);

  // Latih hari ini: tiga subtopik dengan akurasi terendah (minimal 5 soal), atau subtopik pertama untuk pengguna baru.
  const tried = subs.filter((s) => (progMap.get(s.code)?.attempts || 0) >= 5)
    .map((s) => ({ ...s, ...progMap.get(s.code) }))
    .sort((a, b) => a.accuracy - b.accuracy);
  let today = tried.slice(0, 3).map((s) => ({ ...s, reason: 'weak' }));
  if (today.length < 3) {
    const fresh = subs.filter((s) => !progMap.has(s.code)).slice(0, 3 - today.length).map((s) => ({ ...s, reason: 'new' }));
    today = [...today, ...fresh];
  }
  if (today.length < 3) {
    const rest = subs.filter((s) => !today.some((t) => t.code === s.code)).map((s) => ({ ...s, ...progMap.get(s.code), reason: 'more' }));
    today = [...today, ...rest.slice(0, 3 - today.length)];
  }

  const units = db.prepare('SELECT code, name, sort FROM units ORDER BY sort').all().map((u) => {
    const inUnit = subs.filter((s) => s.unit_code === u.code);
    let attempts = 0; let correct = 0; let answered = 0;
    for (const s of inUnit) { const p = progMap.get(s.code); if (p) { attempts += p.attempts; correct += p.correct; answered += p.answered; } }
    const total = inUnit.reduce((n, s) => n + s.question_count, 0);
    return { code: u.code, name: u.name, answered, total, accuracy: attempts ? correct / attempts : null };
  }).filter((u) => u.total > 0);

  const totals = db.prepare('SELECT COUNT(*) AS answered, COALESCE(SUM(correct_count),0) AS correct, COALESCE(SUM(attempts),0) AS attempts FROM user_answers WHERE user_id = ?').get(req.user.id);
  const studyDays = db.prepare("SELECT COUNT(DISTINCT substr(last_answered_at, 1, 10)) AS n FROM user_answers WHERE user_id = ?").get(req.user.id).n;
  const bookmarks = db.prepare('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?').get(req.user.id).n;

  res.json({
    user,
    daily: dailyStats(db, req.user.id, user.daily_minutes),
    active_session: active,
    today: today.map((s) => ({ code: s.code, name: s.name, unit: s.unit_code, description: s.description, question_count: s.question_count, accuracy: s.accuracy ?? null, reason: s.reason })),
    units,
    totals: { ...totals, study_days: studyDays, bookmarks },
  });
});

meRouter.get('/progress', (req, res) => {
  const db = getDb();
  const progress = subtopicProgress(db, req.user.id);
  const names = new Map(db.prepare('SELECT code, name, unit_code FROM subtopics').all().map((s) => [s.code, s]));
  res.json({
    subtopics: progress.map((p) => ({ ...p, name: names.get(p.code)?.name || p.code, unit: names.get(p.code)?.unit_code })).sort((a, b) => a.accuracy - b.accuracy),
  });
});

meRouter.get('/sessions', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT id, title, mode, status, started_at, submitted_at, correct, wrong, blank, score, total_ms,
      (SELECT COUNT(*) FROM session_items i WHERE i.session_id = s.id) AS total
    FROM practice_sessions s WHERE user_id = ? ORDER BY started_at DESC LIMIT 50`).all(req.user.id);
  res.json({ sessions: rows });
});

meRouter.get('/bookmarks', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT b.question_id, b.created_at, q.stem, q.subtopic_code, q.difficulty_final AS difficulty, s.name AS subtopic_name, q.unit_code
    FROM bookmarks b JOIN questions q ON q.id = b.question_id LEFT JOIN subtopics s ON s.code = q.subtopic_code
    WHERE b.user_id = ? AND q.status = 'active' ORDER BY b.created_at DESC`).all(req.user.id);
  res.json({ bookmarks: rows.map((r) => ({ ...r, stem: r.stem.length > 220 ? r.stem.slice(0, 220) + '…' : r.stem })) });
});

meRouter.get('/reports', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT r.id, r.category, r.note, r.status, r.resolution_note, r.created_at, r.updated_at, q.stem
    FROM reports r JOIN questions q ON q.id = r.question_id WHERE r.user_id = ? ORDER BY r.created_at DESC`).all(req.user.id);
  res.json({ reports: rows.map((r) => ({ ...r, stem: r.stem.length > 160 ? r.stem.slice(0, 160) + '…' : r.stem })) });
});

meRouter.get('/export', (req, res) => {
  // Salinan data pribadi pengguna (hak akses data).
  const db = getDb();
  const uid = req.user.id;
  res.setHeader('Content-Disposition', 'attachment; filename="data-saya.json"');
  res.json({
    profile: publicUser(db, uid),
    sessions: db.prepare('SELECT id, title, mode, status, started_at, submitted_at, correct, wrong, blank, score FROM practice_sessions WHERE user_id = ?').all(uid),
    answers: db.prepare('SELECT question_id, attempts, correct_count, last_correct, last_answered_at FROM user_answers WHERE user_id = ?').all(uid),
    bookmarks: db.prepare('SELECT question_id, created_at FROM bookmarks WHERE user_id = ?').all(uid),
    reports: db.prepare('SELECT question_id, category, note, status, created_at FROM reports WHERE user_id = ?').all(uid),
  });
});

