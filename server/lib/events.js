import { actorHash } from './auth.js';

// Event analitik tanpa data pribadi: hanya nama event, properti teknis, dan hash pelaku.
export function track(db, name, userId, props = {}) {
  try {
    db.prepare('INSERT INTO events(name, props, actor) VALUES (?, ?, ?)').run(name, JSON.stringify(props), actorHash(userId));
  } catch (e) {
    console.error('[event] gagal mencatat', name, e.message);
  }
}
