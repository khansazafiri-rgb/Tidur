#!/usr/bin/env node
// Unduh file JSON soal dari Google Drive berdasarkan daftar (manifest), lalu impor dengan
//   npm run import -- data/soal
//
//   npm run fetch-drive -- <manifest.tsv> [folder-tujuan=data/soal]
//
// Format manifest (dipisah tab, satu file per baris):  folder<TAB>nama_file.json<TAB>id_file_drive
// File Drive harus dibagikan "siapa saja yang memiliki link". Manifest TIDAK disimpan di repo
// karena repo ini publik dan bank soal berhak cipta; simpan di data/ (sudah di-.gitignore).
import fs from 'node:fs';
import path from 'node:path';

const [manifest, outDir = 'data/soal'] = process.argv.slice(2);
if (!manifest || !fs.existsSync(manifest)) {
  console.error('Pemakaian: npm run fetch-drive -- <manifest.tsv> [folder-tujuan]');
  process.exit(1);
}
const rows = fs.readFileSync(manifest, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split('\t')).filter((r) => r.length >= 3);

let ok = 0;
let fail = 0;
const seen = new Set();
async function fetchOne([folder, filename, id]) {
  const dir = path.join(outDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  let target = path.join(dir, filename);
  if (seen.has(target)) target = target.replace(/\.json$/i, `__${id}.json`);
  seen.add(target);
  const url = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      JSON.parse(text);
      fs.writeFileSync(target, text);
      ok++;
      console.log(`OK    ${folder}/${filename}`);
      return;
    } catch (e) {
      if (attempt === 3) { fail++; console.error(`GAGAL ${folder}/${filename}: ${e.message}`); }
      else await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const queue = [...rows];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await fetchOne(queue.shift()); }));
console.log(`\nSelesai: ${ok} berhasil, ${fail} gagal. Lanjutkan dengan: npm run import -- ${outDir}`);
