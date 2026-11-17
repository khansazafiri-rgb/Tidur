import { Markdown } from '../components/Markdown.jsx';

function InfoPage({ eyebrow, title, md }) {
  return (
    <div className="wrap max-w-3xl py-8 sm:py-12">
      <p className="eyebrow mb-1">{eyebrow}</p>
      <h1 className="text-page">{title}</h1>
      <div className="card mt-6 p-5 sm:p-8"><Markdown>{md}</Markdown></div>
    </div>
  );
}

const ABOUT = `
Web Persiapan IUP adalah web latihan soal **gratis** untuk calon mahasiswa kedokteran jalur IUP (International Undergraduate Program) di UNAIR, UGM, dan UI.

## Yang bisa kamu lakukan

- Melihat peta kurikulum tes tiap kampus: unit dan subtopik yang diuji.
- Berlatih per subtopik dengan pilihan jumlah soal, tingkat kesulitan, mode santai atau ujian, dan timer.
- Membaca pembahasan di setiap soal, lalu mengulang soal yang salah.
- Melihat subtopik dengan akurasi terendah untuk dilatih berikutnya.

## Yang perlu kamu tahu

- Web ini **bukan situs resmi** UNAIR, UGM, maupun UI, dan tidak berafiliasi dengan kampus mana pun.
- Web ini **tidak menjamin kelulusan**. Label seperti "Siap" atau "Bagus" hanya penyemangat, bukan prediksi hasil tes.
- Informasi format tes disusun dari isi file soal dan cerita peserta tahun lalu, sehingga bisa berbeda dari tes yang sebenarnya.
- Sebagian pembahasan disusun dengan bantuan AI lalu diperiksa. Pembahasan seperti itu diberi label kecil **"dibuat dengan bantuan AI"**.
- Kunci jawaban yang ditandai sebagai hasil inferensi bukan kunci resmi. Kalau menurutmu ada yang keliru, pakai tombol **Lapor soal**.
`;

const PRIVACY = `
Kami mengumpulkan data **seminimal mungkin** dan hanya untuk menjalankan fitur latihan.

## Data yang kami simpan

- Email dan kata sandi (disimpan dalam bentuk hash, tidak bisa dibaca siapa pun).
- Nama tampil, kampus target, tanggal tes, dan waktu belajar per hari, bila kamu mengisinya.
- Riwayat jawaban latihan, soal yang kamu tandai, penilaian pembahasan, dan laporan soal.

## Yang tidak kami lakukan

- Tidak ada iklan dan tidak ada pelacak iklan.
- Analitik hanya mencatat kejadian teknis (misalnya "sesi latihan selesai") tanpa nama atau email.
- Data tidak dijual atau dibagikan ke pihak lain, termasuk ke kampus.

## Hak kamu

- Mengunduh salinan datamu dari **Profil → Akun → Unduh data saya**.
- Menghapus akun beserta seluruh datanya dari **Profil → Akun → Hapus akun**.

## Pengguna di bawah 18 tahun

Sebagian pengguna mungkin berusia di bawah 18 tahun. Kalau kamu termasuk, pastikan orang tua atau walimu mengetahui dan menyetujui penggunaan web ini.

## Penyimpanan di perangkat

Preferensi tampilan (tema, ukuran teks, maskot) disimpan di perangkatmu sendiri, bukan di server. Cookie hanya dipakai untuk menjaga kamu tetap masuk.
`;

const TERMS = `
## Pemakaian

- Web ini untuk belajar pribadi. Jangan menyalin bank soal secara massal atau memakai otomasi untuk mengambil soal.
- Satu akun untuk satu orang. Kamu boleh masuk dari beberapa perangkat sekaligus.

## Konten soal

- Soal berasal dari berbagai sumber latihan dan diolah ulang. Kami tidak pernah menampilkan PDF aslinya.
- Kalau kamu pemilik materi dan keberatan soalmu tampil di sini, pakai tombol **Lapor soal → Masalah hak cipta** atau hubungi pengelola. Laporan hak cipta ditanggapi paling lambat **48 jam**.

## Tanpa jaminan

Web ini disediakan apa adanya. Kami berusaha menjaga kunci dan pembahasan tetap benar, tetapi kesalahan tetap mungkin terjadi. Web ini tidak menjamin kelulusan dan bukan situs resmi kampus mana pun.
`;

export const About = () => <InfoPage eyebrow="Tentang" title="Tentang web ini" md={ABOUT} />;
export const Privacy = () => <InfoPage eyebrow="Privasi" title="Kebijakan privasi" md={PRIVACY} />;
export const Terms = () => <InfoPage eyebrow="Ketentuan" title="Ketentuan penggunaan" md={TERMS} />;
