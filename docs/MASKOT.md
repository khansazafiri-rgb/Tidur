# Sistem maskot

Maskot kucing dokter dijalankan oleh satu komponen bersama (`web/src/mascot/Mascot.jsx`) yang membaca
`web/src/mascot/mascot-animation.json`. Ubah file JSON itu untuk mengubah perilaku maskot; tidak ada angka
animasi yang ditulis di kode.

## Dari JSON ke layar

| Bagian JSON | Dipakai untuk |
|---|---|
| `assets` | Nama file pose di `web/public/mascot/`. WebP transparan dipakai lebih dulu (`preferTransparentWebP`), PNG sebagai cadangan. Pose yang tidak ada (mis. `sad.png`) otomatis jatuh ke `idle`. |
| `animations` | Diubah menjadi `@keyframes mascot-<nama>` dan kelas `.mascot-a-<nama>` saat aplikasi dimuat (`engine.js → buildKeyframesCss`). Durasi, easing, dan jumlah ulang persis dari JSON. |
| `states` | Pasangan pose + animasi. State dengan `durationMs` dimainkan sekali lalu kembali (`returnTo`); `confetti: true` memicu konfeti kecil sekali jalan. |
| `eventRules` | `emit('<event>')` dari halaman memicu state yang sesuai. `oncePerPageVisit` dihitung per kunjungan halaman. |
| `interactionRules` | `eventPriority` (event lebih rendah tidak memotong state yang sedang berjalan), `interactionCooldownMs` untuk klik maskot, jeda saat tab tersembunyi dan saat maskot di luar layar, hanya satu animasi state sekaligus. |
| `placement` | Pojok kanan bawah, 140 px (desktop) / 96 px (ponsel), sadar *safe area*, bisa disembunyikan pengguna (dikembalikan dari *Profil → Tampilan*). |
| `contextRules` | Halaman memasang konteks dengan `useMascotContext('<konteks>')`. |
| `accessibility` | `prefers-reduced-motion` → pose statis, tanpa konfeti. Tombol maskot punya label untuk pembaca layar dan bisa ditekan dengan papan ketik. |

## Event yang dikirim aplikasi

| Event | Dipicu oleh |
|---|---|
| `first_page_visit` | Landing (konteks `landingPage`) |
| `mascot_click` | Menekan maskot: menyapa + tips belajar acak |
| `study_started` | Memulai sesi latihan |
| `answer_submitted` | Memilih jawaban di mode santai (pose berpikir sampai jawaban diperiksa) |
| `answer_correct` / `answer_wrong` | Hasil jawaban mode santai |
| `lesson_completed` | Halaman hasil sesi (konfeti sekali) |
| `bookmarks_empty` | Halaman ditandai kosong |
| `connection_lost` / `connection_restored` | Event `offline`/`online` browser |
| `page_not_found` | Halaman 404 |

## Konteks halaman

| Konteks | Halaman | Perilaku |
|---|---|---|
| `landingPage` | Landing | Menyapa sekali per kunjungan |
| `learningPage` | Beranda, kurikulum, atur latihan | Pose membaca |
| `quizPage` | Layar soal mode santai | Idle + reaksi jawaban. Di ponsel maskot *mengintip* dari tepi kanan dan keluar hanya saat bereaksi, supaya tidak menutupi pilihan jawaban |
| `focusedExam` | Layar soal mode ujian | Maskot diperkecil dan diam (tanpa gerak dekoratif) |
| `emptyState` | Layar kosong, 404, halaman masuk | Ilustrasi kontekstual tampil di halaman; maskot melayang disembunyikan agar tidak dobel |

Di ponsel, maskot juga menyingkir ke tepi saat pengguna menggulir (`avoidBlockingContent`).

## Saklar admin

*Admin → Pengaturan → Tampilkan maskot di seluruh web* mematikan maskot melayang dan reaksinya untuk semua
pengguna. Ilustrasi di layar kosong tetap tampil karena berfungsi sebagai penunjuk isi halaman.

## Menambah pose baru

1. Taruh gambar di Drive, lalu potong latarnya dengan `scripts/process-images.sh <folder-sumber> <folder-keluaran>`
   (butuh ImageMagick). Skrip menghapus latar biru muda, memangkas, dan membuat WebP + PNG.
2. Salin hasilnya ke `web/public/mascot/`.
3. Tambahkan nama file di `assets`, buat state baru di `states`, dan (bila perlu) aturan di `eventRules`.

Animasi tangan atau mata yang sebenarnya butuh lapisan gambar terpisah (lihat `developerInstructions` di JSON);
versi ini menggerakkan seluruh pose dengan `transform` dan `opacity` saja.
