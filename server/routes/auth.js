import crypto from 'node:crypto';
import express from 'express';
import { config } from '../config.js';
import { getDb, nowIso } from '../db.js';
import {
  hashPassword, verifyPassword, createAuthSession, setSessionCookie, clearSessionCookie, createUser, publicUser,
  createEmailToken, consumeEmailToken, requireUser,
} from '../lib/auth.js';
import { sendMail, verifyEmailText, resetPasswordText } from '../lib/mail.js';
import { rateLimit } from '../lib/ratelimit.js';
import { track } from '../lib/events.js';

export const authRouter = express.Router();
const authLimit = rateLimit({ name: 'auth', windowMs: 60_000, max: 10 });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validPassword(p) {
  return typeof p === 'string' && p.length >= 8 && p.length <= 200;
}

async function sendVerification(db, userId, email) {
  const token = createEmailToken(db, userId, 'verify', 48);
  await sendMail({ to: email, subject: 'Verifikasi email kamu', text: verifyEmailText(`${config.publicUrl}/verifikasi?token=${token}`) });
}

authRouter.get('/providers', (_req, res) => {
  res.json({ google: !!(config.googleClientId && config.googleClientSecret) });
});

authRouter.post('/register', authLimit, async (req, res) => {
  const db = getDb();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password;
  const name = String(req.body?.display_name || '').trim().slice(0, 60);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Format email belum benar.' });
  if (!validPassword(password)) return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email ini sudah terdaftar. Coba masuk, atau atur ulang kata sandi.' });
  }
  const userId = createUser(db, { email, passwordHash: await hashPassword(password), displayName: name });
  const { token, expires } = createAuthSession(db, userId, req.get('user-agent'));
  setSessionCookie(res, token, expires);
  track(db, 'signup_completed', userId, { method: 'email' });
  sendVerification(db, userId, email).catch(() => {});
  res.status(201).json({ user: publicUser(db, userId) });
});

authRouter.post('/login', authLimit, async (req, res) => {
  const db = getDb();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  const ok = user && (await verifyPassword(String(req.body?.password || ''), user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Email atau kata sandi tidak cocok.' });
  const { token, expires } = createAuthSession(db, user.id, req.get('user-agent'));
  setSessionCookie(res, token, expires);
  res.json({ user: publicUser(db, user.id) });
});

authRouter.post('/logout', (req, res) => {
  if (req.sessionTokenHash) getDb().prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(req.sessionTokenHash);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: publicUser(getDb(), req.user.id) });
});

authRouter.post('/verify/resend', requireUser, authLimit, async (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT email, email_verified FROM users WHERE id = ?').get(req.user.id);
  if (u.email_verified) return res.json({ ok: true, already: true });
  await sendVerification(db, req.user.id, u.email);
  res.json({ ok: true });
});

authRouter.post('/verify', authLimit, (req, res) => {
  const db = getDb();
  const userId = consumeEmailToken(db, req.body?.token, 'verify');
  if (!userId) return res.status(400).json({ error: 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.' });
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
  res.json({ ok: true });
});

authRouter.post('/forgot', authLimit, async (req, res) => {
  const db = getDb();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (user) {
    const token = createEmailToken(db, user.id, 'reset', 1);
    await sendMail({ to: email, subject: 'Atur ulang kata sandi', text: resetPasswordText(`${config.publicUrl}/atur-sandi?token=${token}`) });
  }
  // Jawaban selalu sama supaya tidak membocorkan email mana yang terdaftar.
  res.json({ ok: true });
});

authRouter.post('/reset', authLimit, async (req, res) => {
  const db = getDb();
  if (!validPassword(req.body?.password)) return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
  const userId = consumeEmailToken(db, req.body?.token, 'reset');
  if (!userId) return res.status(400).json({ error: 'Tautan atur ulang tidak valid atau sudah kedaluwarsa.' });
  db.prepare('UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?').run(await hashPassword(req.body.password), userId);
  db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
  const { token, expires } = createAuthSession(db, userId, req.get('user-agent'));
  setSessionCookie(res, token, expires);
  res.json({ ok: true, user: publicUser(db, userId) });
});

// ---------------------------------------------------------------- Google (opsional)

const GOOGLE_STATE = 'iup_gstate';

authRouter.get('/google', (req, res) => {
  if (!config.googleClientId) return res.status(404).send('Masuk dengan Google belum diaktifkan.');
  const state = crypto.randomBytes(16).toString('base64url');
  res.cookie(GOOGLE_STATE, state, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 10 * 60_000, path: '/' });
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: `${config.publicUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRouter.get('/google/callback', async (req, res) => {
  const fail = (why) => res.redirect(`/masuk?galat=${encodeURIComponent(why)}`);
  if (!config.googleClientId) return fail('Masuk dengan Google belum diaktifkan.');
  if (!req.query.state || req.query.state !== req.cookies?.[GOOGLE_STATE]) return fail('Sesi masuk Google kedaluwarsa. Coba lagi.');
  res.clearCookie(GOOGLE_STATE, { path: '/' });
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code || ''), client_id: config.googleClientId, client_secret: config.googleClientSecret,
        redirect_uri: `${config.publicUrl}/api/auth/google/callback`, grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('Google menolak permintaan masuk.');
    const tok = await tokenRes.json();
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const info = await infoRes.json();
    if (!info.sub || !info.email || !info.email_verified) return fail('Email Google belum terverifikasi.');
    const db = getDb();
    let user = db.prepare('SELECT id FROM users WHERE google_sub = ?').get(info.sub)
      || db.prepare('SELECT id FROM users WHERE email = ?').get(info.email.toLowerCase());
    let isNew = false;
    if (user) {
      db.prepare('UPDATE users SET google_sub = ?, email_verified = 1 WHERE id = ?').run(info.sub, user.id);
    } else {
      user = { id: createUser(db, { email: info.email, googleSub: info.sub, displayName: info.given_name || info.name || '', verified: true }) };
      isNew = true;
      track(db, 'signup_completed', user.id, { method: 'google' });
    }
    const { token, expires } = createAuthSession(db, user.id, req.get('user-agent'));
    setSessionCookie(res, token, expires);
    res.redirect(isNew ? '/mulai' : '/beranda');
  } catch (e) {
    console.error('[google] gagal:', e.message);
    fail('Gagal menghubungi Google. Coba lagi.');
  }
});

export function cleanupExpired(db) {
  const now = nowIso();
  db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM email_tokens WHERE expires_at < ?').run(now);
}
