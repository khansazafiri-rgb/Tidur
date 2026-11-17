import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { getDb, uid, nowIso, parseJson } from '../db.js';

const scrypt = promisify(crypto.scrypt);
export const SESSION_COOKIE = 'iup_sid';

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltB64, keyB64] = stored.split('$');
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(key, expected);
}

export function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function createAuthSession(db, userId, userAgent) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 864e5).toISOString();
  db.prepare('INSERT INTO auth_sessions(token_hash, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, expires, String(userAgent || '').slice(0, 200));
  return { token, expires };
}

export function setSessionCookie(res, token, expires) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: config.isProd, expires: new Date(expires), path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function createEmailToken(db, userId, kind, hours) {
  const token = crypto.randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO email_tokens(token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, kind, new Date(Date.now() + hours * 36e5).toISOString());
  return token;
}

export function consumeEmailToken(db, token, kind) {
  const row = db.prepare('SELECT * FROM email_tokens WHERE token_hash = ? AND kind = ?').get(sha256(String(token || '')), kind);
  if (!row || row.used_at || row.expires_at < nowIso()) return null;
  db.prepare('UPDATE email_tokens SET used_at = ? WHERE token_hash = ?').run(nowIso(), row.token_hash);
  return row.user_id;
}

export function createUser(db, { email, passwordHash = null, googleSub = null, displayName = '', verified = false }) {
  const id = uid('u_');
  db.prepare('INSERT INTO users(id, email, password_hash, google_sub, email_verified) VALUES (?, ?, ?, ?, ?)')
    .run(id, email.toLowerCase(), passwordHash, googleSub, verified ? 1 : 0);
  db.prepare('INSERT INTO profiles(user_id, display_name) VALUES (?, ?)').run(id, displayName || email.split('@')[0]);
  return id;
}

/** Bentuk data pengguna yang aman dikirim ke klien. */
export function publicUser(db, userId) {
  const u = db.prepare(`SELECT u.id, u.email, u.email_verified, u.created_at, u.password_hash IS NOT NULL AS has_password,
      u.google_sub IS NOT NULL AS has_google, p.* FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`).get(userId);
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    email_verified: !!u.email_verified,
    has_password: !!u.has_password,
    has_google: !!u.has_google,
    created_at: u.created_at,
    display_name: u.display_name,
    target_universities: parseJson(u.target_universities, []),
    exam_date: u.exam_date,
    daily_minutes: u.daily_minutes,
    role: u.role,
    onboarded: !!u.onboarded,
    font_scale: u.font_scale,
  };
}

/** Middleware: isi req.user bila cookie sesi valid. */
export function loadUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  req.user = null;
  if (token) {
    const db = getDb();
    const row = db.prepare(`SELECT s.user_id, s.expires_at, p.role FROM auth_sessions s JOIN profiles p ON p.user_id = s.user_id
      WHERE s.token_hash = ?`).get(sha256(token));
    if (row && row.expires_at > nowIso()) {
      req.user = { id: row.user_id, role: row.role };
      req.sessionTokenHash = sha256(token);
    }
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Kamu perlu masuk dulu.' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Kamu perlu masuk dulu.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Halaman ini khusus admin.' });
    next();
  };
}

/** Id pelaku untuk analitik, tanpa data pribadi. */
export function actorHash(userId) {
  return userId ? sha256('actor:' + userId).slice(0, 16) : null;
}
