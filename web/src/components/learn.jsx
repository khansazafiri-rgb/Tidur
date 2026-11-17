// Komponen bersama untuk kurikulum dan soal.
import {
  ArrowLeftRight, BookOpen, Brain, Calculator, CircleDot, Equal, FileText, GitBranch, Hash, Languages, Link2, ListOrdered,
  MessageSquare, PenLine, Puzzle, Scale, Shapes, Sigma, SpellCheck, Table2, Triangle, Users, Workflow,
} from 'lucide-react';

export const UNIT_TONE = {
  VERBAL: { bg: 'bg-verbal-soft', ink: 'text-verbal-ink', fill: 'bg-verbal', ring: 'rgb(var(--verbal))', lip: 'var(--verbal-lip)', solid: 'var(--verbal)', img: '/illustrations/unit-verbal' },
  ENGLISH: { bg: 'bg-english-soft', ink: 'text-english-ink', fill: 'bg-english', ring: 'rgb(var(--english))', lip: 'var(--english-lip)', solid: 'var(--english)', img: '/illustrations/unit-english' },
  NUMERIK: { bg: 'bg-numerik-soft', ink: 'text-numerik-ink', fill: 'bg-numerik', ring: 'rgb(var(--numerik))', lip: 'var(--numerik-lip)', solid: 'var(--numerik)', img: '/illustrations/unit-numerik' },
  LOGIKA: { bg: 'bg-logika-soft', ink: 'text-logika-ink', fill: 'bg-logika', ring: 'rgb(var(--logika))', lip: 'var(--logika-lip)', solid: 'var(--logika)', img: '/illustrations/unit-logika' },
  NONVERBAL: { bg: 'bg-nonverbal-soft', ink: 'text-nonverbal-ink', fill: 'bg-nonverbal', ring: 'rgb(var(--nonverbal))', lip: 'var(--nonverbal-lip)', solid: 'var(--nonverbal)', img: '/illustrations/unit-nonverbal' },
  KHUSUS: { bg: 'bg-khusus-soft', ink: 'text-khusus-ink', fill: 'bg-khusus', ring: 'rgb(var(--khusus))', lip: 'var(--khusus-lip)', solid: 'var(--khusus)', img: '/illustrations/unit-khusus' },
};

export const toneOf = (unit) => UNIT_TONE[unit] || UNIT_TONE.KHUSUS;

/** Nama maskot. Ubah di sini bila ingin nama lain. */
export const MASCOT_NAME = 'Oyen';

// Petunjuk strategi per subtopik untuk tombol "Minta petunjuk" maskot.
// Isinya cara berpikir, bukan jawaban, jadi aman ditampilkan sebelum menjawab.
export const SUBTOPIC_HINTS = {
  'VERBAL.SINONIM': ['Tebak dulu artinya sebelum melihat pilihan, lalu cari yang paling dekat.', 'Coba masukkan tiap pilihan ke kalimat sederhana. Mana yang maknanya tetap?', 'Hati-hati pilihan yang hanya "berhubungan", bukan "sama arti".'],
  'VERBAL.ANTONIM': ['Cari lawan kata yang paling tepat, bukan sekadar "berbeda".', 'Tentukan dulu kata itu positif atau negatif, lalu cari kebalikannya.', 'Kalau ada dua kandidat, pilih yang kelas katanya sama.'],
  'VERBAL.ANALOGI': ['Ucapkan hubungan pasangan pertama dalam satu kalimat: "A adalah ... dari B".', 'Pakai kalimat yang sama untuk tiap pilihan. Yang paling pas, itu jawabannya.', 'Perhatikan urutan: hubungan A:B tidak sama dengan B:A.'],
  'VERBAL.SENTENCE_COMPLETION': ['Cari kata penanda: "but", "although", "because". Itu petunjuk arah makna.', 'Isi titik-titik dengan kata sendiri dulu, baru cocokkan.', 'Kalau dua bagian kosong, kerjakan yang paling jelas dulu.'],
  'ENGLISH.READING': ['Baca pertanyaannya dulu, baru cari bagian bacaan yang relevan.', 'Pilihan yang terlalu mutlak ("always", "never") sering keliru.', 'Jawaban harus didukung bacaan, bukan pengetahuan umummu.'],
  'ENGLISH.STRUCTURE': ['Cek subjek dan kata kerja: tunggal atau jamak? Tense-nya cocok?', 'Perhatikan kata setelah preposisi: biasanya kata benda atau -ing.', 'Baca kalimat utuh dengan tiap pilihan, dengarkan mana yang janggal.'],
  'ENGLISH.PARAGRAF': ['Cari kalimat topik dulu, biasanya yang paling umum.', 'Kata sambung ("however", "then") menunjukkan urutan kalimat.', 'Kata ganti ("this", "they") harus merujuk ke kalimat sebelumnya.'],
  'NUMERIK.BARISAN': ['Hitung selisih antarsuku. Kalau belum terlihat, hitung selisih dari selisihnya.', 'Coba juga pola kali, kuadrat, atau dua barisan yang berselang-seling.', 'Untuk huruf, ubah ke angka urutan alfabet (A=1, B=2, ...).'],
  'NUMERIK.ARITMETIKA': ['Tulis yang diketahui dan yang ditanya sebelum menghitung.', 'Bulatkan dulu untuk menebak kisaran jawaban, lalu buang pilihan yang jauh.', 'Persen: ubah ke pecahan (25% = 1/4) supaya hitungan lebih cepat.'],
  'NUMERIK.ALJABAR': ['Pindahkan semua variabel ke satu ruas, angka ke ruas lain.', 'Kadang lebih cepat mencoba memasukkan pilihan jawaban ke persamaan.', 'Cek syarat: penyebut tidak boleh nol, akar tidak boleh negatif.'],
  'NUMERIK.GEOMETRI': ['Gambar ulang bangunnya dan tulis ukuran yang diketahui.', 'Ingat rumus dasar: luas, keliling, dan Pythagoras (3-4-5, 5-12-13).', 'Bangun rumit bisa dipecah jadi bangun sederhana.'],
  'NUMERIK.PERBANDINGAN_KUANTITAS': ['Sederhanakan P dan Q ke bentuk yang sama sebelum membandingkan.', 'Coba nilai ekstrem (0, 1, negatif, pecahan) untuk menguji apakah hubungannya selalu sama.', 'Kalau hasilnya bisa berubah tergantung nilai, jawabannya "tidak dapat ditentukan".'],
  'NUMERIK.HIMPUNAN': ['Gambar diagram Venn dan isi bagian irisan lebih dulu.', 'Total = A + B − (A ∩ B). Jangan hitung irisan dua kali.', 'Jangan lupa bagian di luar semua lingkaran.'],
  'NUMERIK.DATA': ['Baca judul, satuan, dan keterangan tabel sebelum menghitung.', 'Banyak soal cukup dengan perkiraan kasar; hitung teliti hanya bila pilihan berdekatan.', 'Kenaikan persen = (baru − lama) ÷ lama.'],
  'LOGIKA.SILOGISME': ['Gambar setiap premis sebagai lingkaran Venn.', '"Semua A adalah B" tidak berarti "semua B adalah A".', 'Kesimpulan harus pasti benar, bukan sekadar mungkin.'],
  'LOGIKA.KONDISIONAL': ['"Jika P maka Q" setara dengan "Jika tidak Q maka tidak P".', 'Q benar tidak membuktikan P benar. Itu jebakan umum.', 'Tulis aturan pakai panah: P → Q.'],
  'LOGIKA.URUTAN': ['Buat tabel atau garis kecil, isi syarat yang paling pasti dulu.', 'Syarat negatif ("tidak di sebelah") dipakai untuk mencoret kemungkinan.', 'Kalau buntu, coba satu kemungkinan dan cek apakah ada yang bertentangan.'],
  'LOGIKA.PENALARAN_KRITIS': ['Temukan kesimpulan argumen, lalu cari alasan yang mendukungnya.', 'Pernyataan yang "memperlemah" menyerang hubungan alasan dan kesimpulan.', 'Jangan menambah asumsi yang tidak ada di teks.'],
  'LOGIKA.HUBUNGAN_KELUARGA': ['Gambar silsilah kecil: laki-laki kotak, perempuan lingkaran.', 'Mulai dari orang yang paling banyak disebut.', 'Perhatikan kata kunci: "satu-satunya anak", "saudara ipar".'],
  'LOGIKA.BAHASA_BUATAN': ['Bandingkan dua kalimat yang punya satu kata sama, cari kodenya.', 'Coret kode yang sudah pasti, sisanya lebih mudah.', 'Urutan kata dalam kode bisa berbeda dari urutan aslinya.'],
};

export function hintFor(code) {
  return SUBTOPIC_HINTS[code] || ['Baca soal pelan-pelan dan garis bawahi kata kuncinya.', 'Buang dulu pilihan yang jelas salah.', 'Kalau ragu, tandai dan kembali lagi nanti.'];
}

const SUBTOPIC_ICON = {
  'VERBAL.SINONIM': Equal,
  'VERBAL.ANTONIM': ArrowLeftRight,
  'VERBAL.ANALOGI': Link2,
  'VERBAL.SENTENCE_COMPLETION': PenLine,
  'ENGLISH.READING': BookOpen,
  'ENGLISH.STRUCTURE': SpellCheck,
  'ENGLISH.PARAGRAF': FileText,
  'NUMERIK.BARISAN': ListOrdered,
  'NUMERIK.ARITMETIKA': Calculator,
  'NUMERIK.ALJABAR': Sigma,
  'NUMERIK.GEOMETRI': Triangle,
  'NUMERIK.PERBANDINGAN_KUANTITAS': Scale,
  'NUMERIK.HIMPUNAN': CircleDot,
  'NUMERIK.DATA': Table2,
  'LOGIKA.SILOGISME': Workflow,
  'LOGIKA.KONDISIONAL': GitBranch,
  'LOGIKA.URUTAN': Puzzle,
  'LOGIKA.PENALARAN_KRITIS': Brain,
  'LOGIKA.HUBUNGAN_KELUARGA': Users,
  'LOGIKA.BAHASA_BUATAN': Languages,
  'NONVERBAL.FIGURAL': Shapes,
  'NONVERBAL.DIAGRAM': Hash,
  'KHUSUS.SJT': MessageSquare,
  'KHUSUS.WAWANCARA': MessageSquare,
};

export function SubtopicIcon({ code, className = 'h-5 w-5' }) {
  const Icon = SUBTOPIC_ICON[code] || BookOpen;
  return <Icon className={className} aria-hidden="true" />;
}

/** Ilustrasi unit (WebP transparan + PNG cadangan, dimuat malas). */
export function UnitImage({ unit, className = '', eager = false }) {
  const t = toneOf(unit);
  return (
    <picture>
      <source srcSet={`${t.img}.webp`} type="image/webp" />
      <img src={`${t.img}.png`} alt="" className={className} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </picture>
  );
}
