import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { loadUser } from './lib/auth.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { learnRouter } from './routes/learn.js';
import { adminRouter } from './routes/admin.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join('; ');

export function createApp({ serveStatic = true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': CSP,
    });
    next();
  });

  app.use(cookieParser());
  // Rute impor admin memakai batas ukuran sendiri yang lebih besar.
  app.use((req, res, next) => (req.path.startsWith('/api/admin/import') ? next() : express.json({ limit: '1mb' })(req, res, next)));
  app.use(loadUser);

  // Perlindungan CSRF: permintaan yang mengubah data harus berasal dari origin yang sama.
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin) {
      const host = req.get('x-forwarded-host') || req.get('host');
      let ok = false;
      try { ok = new URL(origin).host === host || origin === config.publicUrl; } catch { ok = false; }
      if (!ok) return res.status(403).json({ error: 'Permintaan ditolak (origin tidak cocok).' });
    }
    next();
  });

  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', learnRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Alamat API tidak ditemukan.' }));

  // Galat JSON yang rusak atau terlalu besar.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: `File terlalu besar (maksimal ${config.importMaxMb} MB).` });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Isi permintaan bukan JSON yang valid.' });
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan di server.' });
  });

  const dist = path.join(config.root, 'web', 'dist');
  if (serveStatic && fs.existsSync(dist)) {
    app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    const indexHtml = path.join(dist, 'index.html');
    app.get('*', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }
  return app;
}
