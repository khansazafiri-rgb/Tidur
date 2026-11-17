# Impor bank soal

Soal masuk ke web lewat satu jalur: PDF diproses skill menjadi satu JSON per file, lalu diimpor admin setelah
lolos validasi (*Admin → Impor JSON*), atau sekaligus dengan `npm run import -- <folder>`.
Logika ada di `server/lib/importer.js`.

## Bentuk file yang dikenali

| Bentuk | Ciri | Penanganan |
|---|---|---|
| `iup` (skema skill terbaru) | `meta`, `passages`, `questions`, `skipped` | Impor langsung |
| `iup_legacy` (skema lama, `UNAIR_*`, `UGM_*`, `FIXED_*`) | sama, tetapi soal punya `needs_review` / `review_note` | Tanda review diubah menjadi revisi bertipe `flag_lama` |
| `strike` (SOAL STRIKE, `question_bank_json`) | `title`, `contexts`, `options: [{key, text}]`, `correct_answer` | Lewat adaptor ke skema IUP. Semua soal berstatus **menunggu pengayaan** dan tidak tampil ke pengguna. Soal yang memakai gambar disimpan di daftar *dilewati*. Subtopik ditebak dari judul bagian dan bisa diperbaiki admin |

## Validasi (file yang gagal ditolak utuh)

- `seq` lengkap 1..N tanpa celah dan tanpa ganda, gabungan `questions` dan `skipped`.
- Jawaban ada di pilihan (termasuk huruf-huruf jawaban SJT).
- Subtopik ada di taksonomi. Alias: `SJT.RANKING`, `SJT.SELECT_THREE` → `KHUSUS.SJT`.
- Pembahasan terisi, `difficulty_ai` berisi easy/medium/hard.
- `passage_id` menunjuk bacaan yang ada.
- Tanda dolar KaTeX tertutup (jumlah `$` yang tidak di-escape genap). Untuk mata uang tulis `\$`.
- Simbol terlarang: karakter rusak U+FFFD, karakter kontrol, karakter *private-use* (sisa font PDF), tag HTML mentah.

Untuk file `strike`, masalah format hanya menjadi peringatan karena soalnya tetap ditinjau saat pengayaan.

## Aturan impor

- **Idempoten.** Kunci unik soal adalah (file sumber, `seq`). Mengimpor ulang file yang sama tidak menggandakan soal.
- **Versi.** Mengimpor ulang file yang isinya berubah menyimpan versi lama di `question_versions` dan menaikkan `version`.
  Jawaban pengguna lama tetap menunjuk ke soal yang sama.
- **Duplikat persis** (hash teks soal + pilihan yang dinormalkan) tidak diimpor ulang. Bila versi baru lebih lengkap
  (punya kunci dan pembahasan), versi baru dipakai dan yang lama dipensiunkan.
- **Soal mirip** (sama setelah angka dihapus, mis. versi 2023 vs 2025) hanya ditandai untuk dicek admin, tidak dihapus.
- **Catatan revisi** (`revision`: jenis, alasan, versi asli) disimpan dan hanya terlihat admin.
- File dengan status belum selesai boleh diimpor dengan peringatan.
- Pratinjau menampilkan jumlah soal baru, duplikat, dilewati, direvisi, sebaran per subtopik dan kesulitan, serta lima soal acak.

## Hasil impor awal (17 November 2026)

Dari 137 file JSON di 14 folder Drive:

- 136 file diterima, 1 ditolak (`UI_Structure_and_Written_Expression_Updated_Materi.json`: berisi materi, bukan soal).
- **3.332 soal aktif** (3.232 pilihan ganda + 100 SJT yang masih *segera hadir*).
- **1.767 soal menunggu pengayaan** (SOAL STRIKE tanpa kunci/pembahasan).
- 872 soal dilewati karena butuh gambar (antrean Fase 4).
- Duplikat antarfile (salinan, varian `Rev`/`Copy`/`Kunci_Jawaban`) tersaring otomatis.

## Pengayaan soal STRIKE

Lengkapi jawaban, pembahasan, subtopik, dan kesulitan dengan skill yang sama, lalu impor sebagai file skema IUP.
Atau sunting satu per satu di *Admin → Bank soal* (filter status *Menunggu pengayaan*): jawaban yang diisi admin
ditandai `corrected`, dan status bisa diubah ke *Aktif* setelah jawaban dan pembahasan terisi.
