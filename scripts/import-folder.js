#!/usr/bin/env node
// Impor awal: baca semua file JSON di sebuah folder (rekursif) dan masukkan ke bank soal.
//
//   npm run import -- <folder> [--publish] [--dry-run] [--report laporan.md]
//
// Bawaan sesuai PRD: soal masuk sebagai DRAF. Admin memeriksa sampel per folder lalu
// menerbitkannya dari halaman Admin > Sumber soal. Pakai --publish untuk langsung aktif.
// Nama subfolder dipakai sebagai nama "folder pengumpulan" di laporan.

import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../server/db.js';
import { plan, commit, detectFormat } from '../server/lib/importer.js';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const publish = args.includes('--publish');
const dryRun = args.includes('--dry-run');
const reportIdx = args.indexOf('--report');
const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : null;

if (!dir || !fs.existsSync(dir)) {
  console.error('Pemakaian: npm run import -- <folder-berisi-json> [--publish] [--dry-run] [--report laporan.md]');
  process.exit(1);
}

function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.toLowerCase().endsWith('.json')) out.push(p);
  }
  return out;
}

const db = getDb();
const files = walk(dir).map((p) => {
  let json = null;
  let parseError = null;
  try { json = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { parseError = e.message; }
  const folder = path.relative(dir, path.dirname(p)) || '.';
  // Nama berakhiran __<driveId> dibuat skrip fetch-drive untuk file kembar bernama sama.
  const filename = path.basename(p).replace(/__[A-Za-z0-9_-]{20,}\.json$/i, '.json');
  return { p, json, parseError, folder, filename, format: json ? detectFormat(json) : 'rusak' };
});

// Skema IUP lebih dulu supaya versi yang lengkap menjadi soal utama saat ada duplikat dengan SOAL STRIKE.
const rank = { iup: 0, iup_legacy: 1, strike: 2, unknown: 3, rusak: 4 };
files.sort((a, b) => rank[a.format] - rank[b.format] || a.p.localeCompare(b.p));

const perFolder = new Map();
const rows = [];
for (const f of files) {
  const agg = perFolder.get(f.folder) || { files: 0, accepted: 0, rejected: 0, unchanged: 0, questions_new: 0, updated: 0, duplicates: 0, pending: 0, skipped: 0 };
  perFolder.set(f.folder, agg);
  agg.files++;
  let s;
  if (!f.json) {
    s = { ok: false, outcome: 'ditolak', errors: [`JSON tidak bisa dibaca: ${f.parseError}`], counts: {} };
  } else if (dryRun) {
    s = plan(db, f.json, { filename: f.filename, folder: f.folder }).summary;
    s.outcome = s.ok ? (s.already_imported ? 'sudah ada' : 'akan diterima') : 'ditolak';
  } else {
    // Unggahan ulang file yang sama di folder lain dicatat sebagai tidak berubah.
    s = commit(db, f.json, { filename: f.filename, folder: f.folder, publish, actor: 'cli' });
  }
  const c = s.counts || {};
  if (s.outcome === 'ditolak') agg.rejected++;
  else if (s.outcome === 'tidak berubah') agg.unchanged++;
  else agg.accepted++;
  agg.questions_new += c.new || 0;
  agg.updated += c.updated || 0;
  agg.duplicates += c.duplicates || 0;
  agg.pending += f.format === 'strike' ? (c.new || 0) : 0;
  agg.skipped += c.skipped || 0;
  rows.push({ folder: f.folder, filename: f.filename, format: f.format, outcome: s.outcome, counts: c, errors: s.errors || [], warnings: s.warnings || [] });
  const tag = s.outcome === 'ditolak' ? 'TOLAK ' : s.outcome === 'tidak berubah' ? 'SAMA  ' : 'OK    ';
  console.log(`${tag} [${f.format}] ${f.folder}/${f.filename}  baru=${c.new || 0} ubah=${c.updated || 0} dup=${c.duplicates || 0} lewati=${c.skipped || 0}${s.errors?.length ? `  galat: ${s.errors[0]}` : ''}`);
}

console.log('\nRingkasan per folder');
console.log('folder'.padEnd(34), 'file', 'terima', 'tolak', 'soal_baru', 'pengayaan', 'duplikat', 'dilewati');
for (const [folder, a] of [...perFolder.entries()].sort()) {
  console.log(folder.padEnd(34), String(a.files).padStart(4), String(a.accepted + a.unchanged).padStart(6), String(a.rejected).padStart(5),
    String(a.questions_new - a.pending).padStart(9), String(a.pending).padStart(9), String(a.duplicates).padStart(8), String(a.skipped).padStart(8));
}
const totals = db.prepare('SELECT status, COUNT(*) AS n FROM questions GROUP BY status').all();
console.log('\nIsi bank soal sekarang:', Object.fromEntries(totals.map((t) => [t.status, t.n])));
if (!publish && !dryRun) console.log('Soal skema IUP masuk sebagai draf. Terbitkan per folder dari Admin > Sumber soal.');

if (reportPath) {
  const lines = ['# Laporan impor', '', `Tanggal: ${new Date().toISOString()}`, '', '| Folder | File | Diterima | Ditolak | Soal baru | Menunggu pengayaan | Duplikat | Dilewati (gambar) |', '|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [folder, a] of [...perFolder.entries()].sort()) {
    lines.push(`| ${folder} | ${a.files} | ${a.accepted + a.unchanged} | ${a.rejected} | ${a.questions_new - a.pending} | ${a.pending} | ${a.duplicates} | ${a.skipped} |`);
  }
  lines.push('', '## Per file', '', '| Folder | File | Bentuk | Status | Baru | Diubah | Duplikat | Dilewati | Alasan ditolak |', '|---|---|---|---|---:|---:|---:|---:|---|');
  for (const r of rows) {
    lines.push(`| ${r.folder} | ${r.filename} | ${r.format} | ${r.outcome} | ${r.counts.new || 0} | ${r.counts.updated || 0} | ${r.counts.duplicates || 0} | ${r.counts.skipped || 0} | ${(r.errors || []).slice(0, 3).join('; ').replace(/\|/g, '/')} |`);
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n');
  console.log(`Laporan ditulis ke ${reportPath}`);
}
