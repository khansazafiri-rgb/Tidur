import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export const config = {
  root,
  port: num(process.env.PORT, 8787),
  host: process.env.HOST || '127.0.0.1',
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'iup.db'),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  isProd: process.env.NODE_ENV === 'production',
  sessionDays: num(process.env.SESSION_DAYS, 60),
  // Email (Resend). Tanpa kunci, email dicetak ke log server.
  resendApiKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || 'Web Persiapan IUP <no-reply@example.com>',
  // Masuk dengan Google (opsional).
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  // Kalibrasi kesulitan dijalankan berkala (jam).
  calibrationIntervalHours: num(process.env.CALIBRATION_INTERVAL_HOURS, 24),
  importMaxMb: num(process.env.IMPORT_MAX_MB, 40),
};
