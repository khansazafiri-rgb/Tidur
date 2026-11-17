# Web Persiapan IUP

Web latihan soal **gratis** untuk calon mahasiswa kedokteran jalur IUP di **UNAIR, UGM, dan UI**.
Setiap soal punya pembahasan, subtopik, dan tingkat kesulitan. Pengguna memilih kampus target, melihat peta
kurikulum, berlatih per subtopik, lalu tahu subtopik mana yang masih lemah.

Dibangun dari PRD *Web Persiapan Tes Masuk FK IUP* versi 0.1. Maskot kucing dokter beranimasi mengikuti
`web/src/mascot/mascot-animation.json`.

## Isi MVP (Fase 1)

| PRD | Fitur | Status |
|---|---|---|
| F1 | Daftar/masuk email + kata sandi, Google (opsional), verifikasi email, lupa sandi, hapus akun | ✅ |
| F2 | Onboarding 3 langkah: kampus target, tanggal tes, waktu belajar (semua bisa dilewati) | ✅ |
| — | **Tutorial interaktif** bersama Oyen setelah onboarding (`/tutorial`): pengguna mencoba sendiri tiap langkah. Status tersimpan di server, bisa diulang dari panel Oyen atau Profil | ✅ |
| F3 | Beranda berbentuk **jalur belajar** (bulatan subtopik per unit, mahkota bila dikuasai), hitung mundur, *Lanjutkan*, misi harian + streak | ✅ |
| F4 | Peta kurikulum per kampus, kartu unit bergambar, subtopik *segera hadir*, tombol *semua subtopik* | ✅ |
| F5 | Latihan per subtopik/unit: 10/20/30 soal, kesulitan, mode santai/ujian, timer, ragu-ragu, bookmark, navigator, lanjutkan sesi, *Ulangi yang salah* | ✅ |
| F6 | Pembahasan dengan rumus ter-render, label *dibuat dengan bantuan AI*, *Membantu/Kurang membantu*, lapor soal | ✅ |
| F7 | KaTeX + tabel Markdown dengan gulir horizontal, teks soal sampai 150%, urutan pilihan tidak diacak | ✅ |
| F13 | Lapor soal (7 kategori), sembunyi otomatis setelah 3 laporan *kunci salah*, status laporan di profil | ✅ |
| F14 | Panduan kampus yang bisa diubah admin | ✅ |
| F15 | Panel admin: impor JSON (validasi, pratinjau, simpan), sumber soal per folder, bank soal, versi & revisi, laporan, kurikulum, blueprint, metrik, peran | ✅ |
| — | Kalibrasi kesulitan harian dari data nyata (`difficulty_ai` tidak pernah ditimpa) | ✅ |
| F8–F12, F16 | Try out, analitik lanjutan, antrean ulang 1/3/7 hari, gamifikasi, konten bergambar | Fase 2–4 (skema & blueprint sudah disiapkan) |

Keamanan inti dari PRD: **jawaban benar dan pembahasan tidak pernah dikirim ke perangkat sebelum waktunya**.
Mode ujian hanya membukanya setelah sesi dikumpulkan; mode santai hanya untuk soal yang sudah dijawab
(diuji di `server/tests/api.test.js` dan uji end-to-end).

## Teknologi

- **Frontend:** React 18 + Vite + Tailwind CSS. Gaya "juicy" (tombol & kartu 3D dengan bibir bawah, warna cerah per unit),
  tema terang sebagai bawaan (mode gelap opsional), huruf Fredoka + Nunito di-host sendiri (tanpa Google Fonts, tanpa pelacak).
- **Backend:** Node.js ≥ 22.13 + Express + SQLite bawaan Node (`node:sqlite`). Satu proses, satu file database.
- **Hosting:** satu VPS dengan Caddy sebagai reverse proxy (lihat [`docs/DEPLOY.md`](docs/DEPLOY.md)).

> **Catatan perbedaan dari PRD.** PRD menyarankan PocketBase. Versi ini memakai Node + SQLite karena seluruh
> alur (impor, sesi, kerahasiaan jawaban) bisa diuji otomatis di sini, sedangkan binari PocketBase tidak bisa
> dijalankan di lingkungan pembuatannya. Arsitekturnya tetap sama dengan PRD: satu VPS, Caddy di depan,
> jawaban hanya keluar lewat server, dan skema tabel mengikuti bab *Model data*.

## Menjalankan di komputer sendiri

```bash
npm install
```

```bash
npm run dev
```

Buka `http://localhost:5173`. API berjalan di port 8787. Email (verifikasi, atur ulang sandi) dicetak ke log server selama `RESEND_API_KEY` kosong.

### Mengisi bank soal

Bank soal **tidak** ada di repo ini (repo publik, soal berhak cipta). Dua cara mengisinya:

1. **Impor awal sekaligus** dari folder JSON (misalnya hasil unduhan folder Drive):

   ```bash
   npm run fetch-drive -- data/drive-manifest.tsv data/soal
   ```

   ```bash
   npm run import -- data/soal --report data/laporan-impor.md
   ```

   Sesuai PRD, soal skema IUP masuk sebagai **draf**. Periksa sampelnya di *Admin → Sumber soal*, lalu terbitkan per folder.
   Tambahkan `--publish` untuk langsung aktif. Impor ulang aman: soal tidak akan tergandakan.

2. **Satu per satu** lewat *Admin → Impor JSON*.

Format yang dikenali dan aturan validasinya ada di [`docs/IMPOR.md`](docs/IMPOR.md).

### Menjadi admin

Daftar dulu lewat web, lalu:

```bash
npm run make-admin -- emailkamu@contoh.id owner
```

Pemilik bisa menunjuk kontributor dari *Admin → Pengaturan*.

## Perintah lain

| Perintah | Kegunaan |
|---|---|
| `npm test` | Uji API: impor, alur latihan, kerahasiaan jawaban, timer, laporan, admin |
| `npm run build` | Build frontend ke `web/dist` |
| `npm start` | Jalankan server produksi (melayani `web/dist` + API) |
| `npm run calibrate` | Jalankan kalibrasi kesulitan sekali (server juga menjalankannya tiap hari) |
| `npm run backup` | Cadangkan database (`VACUUM INTO`), simpan 14 terakhir |

## Struktur

```
server/            API Express + SQLite
  db.js            skema tabel (mengikuti bab Model data PRD)
  seed.js          kampus, unit, 22 subtopik, pemetaan kampus, panduan, blueprint
  lib/importer.js  normalisasi 3 bentuk file, validasi, duplikat, versi
  lib/practice.js  pemilihan soal, sesi, kerahasiaan jawaban
  lib/calibration.js
  routes/          auth, me, learn (kurikulum, sesi, soal), admin
web/
  src/mascot/      mesin maskot (membaca mascot-animation.json)
  src/pages/       halaman pengguna dan admin
  public/mascot/   pose maskot (WebP transparan + PNG cadangan)
scripts/           import-folder, fetch-drive, make-admin, calibrate, backup, process-images
deploy/            Caddyfile, unit systemd, timer cadangan
docs/              DEPLOY.md, IMPOR.md, MASKOT.md
```

## Maskot

Semua animasi, pose, aturan event, prioritas, dan cooldown dibaca dari `mascot-animation.json`.
Detailnya di [`docs/MASKOT.md`](docs/MASKOT.md).
