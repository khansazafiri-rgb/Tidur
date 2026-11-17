#!/usr/bin/env node
// Jalankan kalibrasi kesulitan sekali (server juga menjalankannya otomatis tiap hari).
import { getDb } from '../server/db.js';
import { runCalibration } from '../server/lib/calibration.js';

const r = runCalibration(getDb());
console.log(`Kalibrasi selesai: ${r.calibrated} soal dikalibrasi dari ${r.questions_with_data} soal yang punya data.`);
