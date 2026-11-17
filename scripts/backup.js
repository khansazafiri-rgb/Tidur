#!/usr/bin/env node
// Cadangan database harian (dipanggil timer systemd). Menyimpan 14 cadangan terakhir.
//   node scripts/backup.js [folder-cadangan=/var/backups/iup]
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../server/db.js';

const dir = process.argv[2] || '/var/backups/iup';
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `iup-${new Date().toISOString().slice(0, 10)}.db`);
if (fs.existsSync(file)) fs.rmSync(file);
getDb().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
const all = fs.readdirSync(dir).filter((f) => /^iup-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.rmSync(path.join(dir, old));
console.log(`Cadangan ditulis ke ${file}`);
