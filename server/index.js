import { config } from './config.js';
import { getDb } from './db.js';
import { createApp } from './app.js';
import { runCalibration } from './lib/calibration.js';
import { cleanupExpired } from './routes/auth.js';

const db = getDb();
const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`Web Persiapan IUP berjalan di http://${config.host}:${config.port}`);
  const n = db.prepare("SELECT COUNT(*) AS n FROM questions WHERE status = 'active'").get().n;
  console.log(`Soal aktif: ${n}${n ? '' : ' (bank soal masih kosong, jalankan "npm run import -- <folder>")'}`);
});

// Kalibrasi kesulitan dan pembersihan token kedaluwarsa, berkala.
const every = config.calibrationIntervalHours * 36e5;
function housekeeping() {
  try {
    const r = runCalibration(db);
    cleanupExpired(db);
    console.log(`[kalibrasi] ${r.calibrated} soal dikalibrasi dari ${r.questions_with_data} soal yang punya data`);
  } catch (e) {
    console.error('[kalibrasi] gagal:', e.message);
  }
}
setTimeout(housekeeping, 60_000).unref();
setInterval(housekeeping, every).unref();
