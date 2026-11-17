// Data referensi: kampus, unit, subtopik, pemetaan kurikulum, panduan, blueprint, dan pengaturan.
// Fungsi seed hanya menambah baris yang belum ada, jadi suntingan admin tidak tertimpa.

export const UNIVERSITIES = [
  { code: 'UNAIR', name: 'Universitas Airlangga', tagline: 'TPA empat blok: Numerik, Logika, Verbal, Reading', sort: 1 },
  { code: 'UGM', name: 'Universitas Gadjah Mada', tagline: 'GMST, ACEPT, dan SJT', sort: 2 },
  { code: 'UI', name: 'Universitas Indonesia', tagline: 'SIMAK KKI: Logika, English, Matematika', sort: 3 },
];

export const UNITS = [
  { code: 'VERBAL', name: 'Verbal', description: 'Kosakata dan hubungan antarkata.', sort: 1 },
  { code: 'ENGLISH', name: 'English', description: 'Bacaan, struktur kalimat, dan paragraf berbahasa Inggris.', sort: 2 },
  { code: 'NUMERIK', name: 'Numerik', description: 'Pola bilangan, hitungan, dan penalaran kuantitatif.', sort: 3 },
  { code: 'LOGIKA', name: 'Logika', description: 'Penarikan kesimpulan, urutan, dan teka-teki penalaran.', sort: 4 },
  { code: 'NONVERBAL', name: 'Nonverbal', description: 'Pola gambar dan diagram.', sort: 5 },
  { code: 'KHUSUS', name: 'Khusus', description: 'SJT dan latihan wawancara.', sort: 6 },
];

export const SUBTOPICS = [
  ['VERBAL.SINONIM', 'VERBAL', 'Sinonim', 'Mencari kata yang paling dekat maknanya.'],
  ['VERBAL.ANTONIM', 'VERBAL', 'Antonim', 'Mencari kata yang maknanya paling berlawanan.'],
  ['VERBAL.ANALOGI', 'VERBAL', 'Analogi', 'Menemukan hubungan yang sama antara dua pasang kata.'],
  ['VERBAL.SENTENCE_COMPLETION', 'VERBAL', 'Sentence completion', 'Melengkapi kalimat dengan kata yang paling tepat.'],
  ['ENGLISH.READING', 'ENGLISH', 'Reading', 'Memahami bacaan: ide pokok, detail, dan inferensi.'],
  ['ENGLISH.STRUCTURE', 'ENGLISH', 'Structure', 'Tata bahasa dan menemukan bagian kalimat yang salah.'],
  ['ENGLISH.PARAGRAF', 'ENGLISH', 'Paragraf', 'Menyusun dan melengkapi paragraf yang padu.'],
  ['NUMERIK.BARISAN', 'NUMERIK', 'Barisan', 'Menemukan pola deret angka dan huruf.'],
  ['NUMERIK.ARITMETIKA', 'NUMERIK', 'Aritmetika', 'Hitungan dasar, pecahan, persen, dan soal cerita.'],
  ['NUMERIK.ALJABAR', 'NUMERIK', 'Aljabar', 'Persamaan, pertidaksamaan, dan fungsi.'],
  ['NUMERIK.GEOMETRI', 'NUMERIK', 'Geometri', 'Bangun datar, bangun ruang, sudut, dan luas.'],
  ['NUMERIK.PERBANDINGAN_KUANTITAS', 'NUMERIK', 'Quantitative comparison', 'Membandingkan dua besaran P dan Q.'],
  ['NUMERIK.HIMPUNAN', 'NUMERIK', 'Himpunan', 'Diagram Venn dan operasi himpunan.'],
  ['NUMERIK.DATA', 'NUMERIK', 'Interpretasi data', 'Membaca tabel dan data berbentuk teks.'],
  ['LOGIKA.SILOGISME', 'LOGIKA', 'Silogisme', 'Menarik kesimpulan dari dua premis atau lebih.'],
  ['LOGIKA.KONDISIONAL', 'LOGIKA', 'Kondisional', 'Pernyataan jika-maka dan aturan bersyarat.'],
  ['LOGIKA.URUTAN', 'LOGIKA', 'Urutan dan puzzle', 'Posisi duduk, jadwal, dan urutan objek.'],
  ['LOGIKA.PENALARAN_KRITIS', 'LOGIKA', 'Penalaran kritis', 'Menilai argumen, asumsi, dan kesimpulan.'],
  ['LOGIKA.HUBUNGAN_KELUARGA', 'LOGIKA', 'Hubungan keluarga', 'Menelusuri silsilah dan hubungan darah.'],
  ['LOGIKA.BAHASA_BUATAN', 'LOGIKA', 'Bahasa buatan', 'Menerjemahkan kode dan kata dari bahasa rekaan.'],
  ['NONVERBAL.FIGURAL', 'NONVERBAL', 'Figural', 'Pola dan rotasi gambar.', 'soon'],
  ['NONVERBAL.DIAGRAM', 'NONVERBAL', 'Diagram', 'Membaca hubungan dalam diagram.', 'soon'],
  ['KHUSUS.SJT', 'KHUSUS', 'SJT', 'Situational Judgement Test: menilai respons di situasi kerja.', 'soon'],
  ['KHUSUS.WAWANCARA', 'KHUSUS', 'Wawancara', 'Latihan menjawab pertanyaan wawancara.', 'soon'],
  ['LAINNYA', 'KHUSUS', 'Lainnya', 'Soal yang belum masuk subtopik mana pun.', 'hidden'],
];

const ALL = (prefix) => SUBTOPICS.filter((s) => s[0].startsWith(prefix + '.')).map((s) => s[0]);

export const UNIVERSITY_SUBTOPICS = {
  UNAIR: [
    ...ALL('VERBAL'), 'ENGLISH.READING', 'ENGLISH.PARAGRAF',
    ...ALL('NUMERIK'), ...ALL('LOGIKA'), ...ALL('NONVERBAL'), 'KHUSUS.WAWANCARA',
  ],
  UGM: [
    ...ALL('VERBAL'), ...ALL('ENGLISH'), ...ALL('NUMERIK'), ...ALL('LOGIKA'), ...ALL('NONVERBAL'), 'KHUSUS.SJT',
  ],
  UI: [
    'VERBAL.ANALOGI', 'VERBAL.SINONIM', 'VERBAL.ANTONIM', ...ALL('ENGLISH'), ...ALL('NUMERIK'), ...ALL('LOGIKA'), 'NONVERBAL.FIGURAL',
  ],
};

const DISCLAIMER = '> Informasi di halaman ini disusun dari isi file soal dan cerita peserta tahun lalu. Ini **bukan informasi resmi** dan bisa berubah. Selalu cek pengumuman resmi kampus.';

export const GUIDES = {
  UNAIR: `${DISCLAIMER}

## Bagian tes

- **TPA** berbahasa Inggris dan Indonesia dengan empat blok: Numerik, Logika, Verbal, dan Reading.
- **Wawancara** tanpa skor.

Dari sampel sekitar 55 soal, komposisinya kira-kira: Numerik 40%, Logika 30%, Reading 17%, Verbal 13%. Simulasi 2025 yang pernah dibuka berisi 50 soal.

## Yang belum diketahui

Durasi dan komposisi resmi.

## Tips umum

- Mulai dari **Barisan** dan **Aritmetika**, karena Numerik porsinya paling besar.
- Latih **Urutan dan puzzle** dengan menggambar tabel kecil di kertas coretan.
- Untuk Reading, baca pertanyaannya dulu baru bacaannya.
`,
  UGM: `${DISCLAIMER}

## Bagian tes

- **GMST**: Verbal, Quantitative, dan Nonverbal.
- **ACEPT**: vocabulary, structure, reading, dan composing.
- **SJT** (Situational Judgement Test).

## Yang belum diketahui

Durasi, jumlah soal resmi, dan format SJT UGM.

## Tips umum

- Bagian Verbal GMST banyak memakai **Analogi**, **Sinonim**, dan **Antonim**.
- Untuk ACEPT, perkuat **Structure**: subjek-predikat, tenses, dan bentuk kata.
- Soal Nonverbal dan SJT di web ini masih **segera hadir**.
`,
  UI: `${DISCLAIMER}

## Bagian tes

- **SIMAK KKI Logika**: verbal reasoning, silogisme, posisi duduk, hubungan keluarga, deret, dan diagram Venn.
- **English** format ACT: Reading (sekitar 40 soal dalam 35 menit) dan English (sekitar 75 soal dalam 45 menit).
- **Matematika dasar** dan quantitative reasoning.

## Yang belum diketahui

Durasi dan jumlah soal bagian logika dan matematika.

## Tips umum

- Waktu English sangat ketat: kurang dari 1 menit per soal. Latih Reading dengan **mode ujian** dan timer.
- Untuk logika, buat daftar syarat sebelum mencoba menebak pilihan.
`,
};

export const BLUEPRINTS = [
  {
    id: 'unair-simulasi-tpa', university_code: 'UNAIR', name: 'Simulasi TPA', sort: 1,
    sections: [{ name: 'TPA campuran', minutes: 50, composition: { NUMERIK: 20, LOGIKA: 15, 'ENGLISH.READING': 9, VERBAL: 6 } }],
    rules: { allowBack: true, penaltyWrong: 0, difficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 } },
    source_note: 'Simulasi 2025 yang dibuka berisi 50 soal. Komposisi dari perkiraan sampel. Durasi sementara 1 soal 1 menit.',
  },
  {
    id: 'ugm-gmst', university_code: 'UGM', name: 'GMST', sort: 2,
    sections: [
      { name: 'Verbal', minutes: 40, composition: { VERBAL: 40 } },
      { name: 'Quantitative', minutes: 40, composition: { NUMERIK: 40 } },
    ],
    rules: { allowBack: false, penaltyWrong: 0, difficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 } },
    source_note: 'Simulasi GMST yang dibuka. Bagian Nonverbal ditunda. Durasi sementara.',
  },
  {
    id: 'ugm-acept', university_code: 'UGM', name: 'ACEPT', sort: 3,
    sections: [
      { name: 'Vocabulary', minutes: 20, composition: { 'VERBAL.SINONIM': 10, 'VERBAL.ANTONIM': 10 } },
      { name: 'Structure', minutes: 20, composition: { 'ENGLISH.STRUCTURE': 20 } },
      { name: 'Reading', minutes: 20, composition: { 'ENGLISH.READING': 20 } },
    ],
    rules: { allowBack: false, penaltyWrong: 0, difficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 } },
    source_note: 'Jumlah soal belum diketahui. Sementara 1 menit per soal.',
  },
  {
    id: 'ui-simak-english', university_code: 'UI', name: 'SIMAK KKI English', sort: 4,
    sections: [
      { name: 'Reading', minutes: 35, composition: { 'ENGLISH.READING': 40 } },
      { name: 'English', minutes: 45, composition: { 'ENGLISH.STRUCTURE': 60, 'ENGLISH.PARAGRAF': 15 } },
    ],
    rules: { allowBack: false, penaltyWrong: 0, difficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 } },
    source_note: 'File English format ACT yang dibuka.',
  },
  {
    id: 'ui-simak-logika', university_code: 'UI', name: 'SIMAK KKI Logika', sort: 5,
    sections: [{ name: 'Logika', minutes: 60, composition: { LOGIKA: 60 } }],
    rules: { allowBack: true, penaltyWrong: 0, difficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 } },
    source_note: 'File intro logika yang dibuka. 60 soal dikurangi soal figural. Sementara 1 menit per soal.',
  },
  {
    id: 'ui-simak-matematika', university_code: 'UI', name: 'SIMAK KKI Matematika', sort: 6,
    sections: [{ name: 'Matematika', minutes: 40, composition: { NUMERIK: 40 } }],
    rules: { allowBack: true, penaltyWrong: 0, difficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 } },
    source_note: 'Jumlah soal belum diketahui. Sementara 1 menit per soal.',
  },
];

export const DEFAULT_SETTINGS = {
  mascot_enabled: true,
  auto_hide_wrong_key_reports: 3,
  calibration: {
    min_distinct_users: 30,
    easy_above: 0.75,
    hard_below: 0.4,
    target_seconds: { easy: 45, medium: 90, hard: 120 },
    slow_factor: 2,
  },
  difficulty_mix: { easy: 0.3, medium: 0.5, hard: 0.2 },
};

export function seed(d) {
  const insUni = d.prepare('INSERT OR IGNORE INTO universities(code, name, tagline, sort) VALUES (?, ?, ?, ?)');
  for (const u of UNIVERSITIES) insUni.run(u.code, u.name, u.tagline, u.sort);

  const insUnit = d.prepare('INSERT OR IGNORE INTO units(code, name, description, sort) VALUES (?, ?, ?, ?)');
  for (const u of UNITS) insUnit.run(u.code, u.name, u.description, u.sort);

  const insSub = d.prepare('INSERT OR IGNORE INTO subtopics(code, unit_code, name, description, status, sort) VALUES (?, ?, ?, ?, ?, ?)');
  SUBTOPICS.forEach(([code, unit, name, desc, status], i) => insSub.run(code, unit, name, desc, status || 'active', i + 1));

  const hasMap = d.prepare('SELECT COUNT(*) AS n FROM university_subtopics').get().n > 0;
  if (!hasMap) {
    const insMap = d.prepare('INSERT OR IGNORE INTO university_subtopics(university_code, subtopic_code, weight) VALUES (?, ?, 1)');
    for (const [uni, subs] of Object.entries(UNIVERSITY_SUBTOPICS)) for (const s of subs) insMap.run(uni, s);
  }

  const insGuide = d.prepare('INSERT OR IGNORE INTO guides(university_code, content_md) VALUES (?, ?)');
  for (const [uni, md] of Object.entries(GUIDES)) insGuide.run(uni, md);

  const insBp = d.prepare('INSERT OR IGNORE INTO tryout_blueprints(id, university_code, name, sections, rules, source_note, sort) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const b of BLUEPRINTS) insBp.run(b.id, b.university_code, b.name, JSON.stringify(b.sections), JSON.stringify(b.rules), b.source_note, b.sort);

  const insSet = d.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSet.run(k, JSON.stringify(v));
}
