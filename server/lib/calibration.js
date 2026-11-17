// Kalibrasi kesulitan dari data nyata (PRD: Kalibrasi kesulitan).
// - Hanya jawaban dari sesi yang sudah dikumpulkan.
// - Label AI (difficulty_ai) tidak pernah ditimpa; hasil masuk ke difficulty_calibrated.
// - Minimal N pengguna berbeda sebelum label diubah.

import { getSetting, nowIso, tx } from '../db.js';

const LEVELS = ['easy', 'medium', 'hard'];

function median(nums) {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

export function runCalibration(db) {
  const cfg = getSetting(db, 'calibration', {});
  const minUsers = cfg.min_distinct_users ?? 30;
  const easyAbove = cfg.easy_above ?? 0.75;
  const hardBelow = cfg.hard_below ?? 0.4;
  const targets = cfg.target_seconds || { easy: 45, medium: 90, hard: 120 };
  const slow = cfg.slow_factor ?? 2;

  const rows = db.prepare(`SELECT i.question_id, s.user_id, i.is_correct, i.time_ms
    FROM session_items i JOIN practice_sessions s ON s.id = i.session_id
    WHERE s.status = 'submitted' AND i.answer IS NOT NULL`).all();

  const byQ = new Map();
  for (const r of rows) {
    let e = byQ.get(r.question_id);
    if (!e) { e = { attempts: 0, correct: 0, users: new Set(), times: [] }; byQ.set(r.question_id, e); }
    e.attempts++;
    e.correct += r.is_correct ? 1 : 0;
    e.users.add(r.user_id);
    if (r.time_ms > 0) e.times.push(r.time_ms);
  }

  let calibrated = 0;
  tx(db, () => {
    const upStats = db.prepare(`INSERT INTO question_stats(question_id, attempts, distinct_users, pct_correct, median_ms, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(question_id) DO UPDATE SET attempts = excluded.attempts, distinct_users = excluded.distinct_users,
      pct_correct = excluded.pct_correct, median_ms = excluded.median_ms, updated_at = excluded.updated_at`);
    const setCal = db.prepare('UPDATE questions SET difficulty_calibrated = ? WHERE id = ?');
    const now = nowIso();
    for (const [qid, e] of byQ) {
      const pct = e.attempts ? e.correct / e.attempts : null;
      const med = median(e.times);
      upStats.run(qid, e.attempts, e.users.size, pct, med, now);
      if (e.users.size < minUsers || pct == null) continue;
      let level = pct > easyAbove ? 'easy' : pct >= hardBelow ? 'medium' : 'hard';
      if (med != null && med > slow * (targets[level] ?? 90) * 1000) level = LEVELS[Math.min(2, LEVELS.indexOf(level) + 1)];
      setCal.run(level, qid);
      calibrated++;
    }
  });
  return { questions_with_data: byQ.size, calibrated };
}
