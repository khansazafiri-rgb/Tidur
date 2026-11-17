import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, setDb } from '../db.js';
import { resetRateLimits } from '../lib/ratelimit.js';

process.env.NODE_ENV = 'test';
const db = openDb(':memory:');
setDb(db);
const { createApp } = await import('../app.js');
const { commit, preview } = await import('../lib/importer.js');

let server;
let base;

before(async () => {
  server = createApp({ serveStatic: false }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

/** Klien kecil yang menyimpan cookie sesi. */
function client() {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  };
}

function makeFile(n = 12, sub = 'NUMERIK.BARISAN') {
  return {
    meta: { source_file: 'tes.pdf', university: 'UNAIR', year: 2025, language: 'en', progress: { status: 'complete' } },
    passages: [{ id: 'p1', title: 'Bacaan', text: 'Cats sleep a lot.' }],
    questions: Array.from({ length: n }, (_, i) => ({
      seq: i + 1, number: i + 1, type: 'mcq', unit: sub.split('.')[0], subtopic: sub,
      difficulty_ai: ['easy', 'medium', 'hard'][i % 3],
      stem: `Berapa suku berikutnya dari $${i}, ${i + 2}, ${i + 4}$? (soal ${i})`,
      options: { A: `${i + 5}`, B: `${i + 6}`, C: `${i + 7}`, D: `${i + 8}` },
      answer: 'B', answer_source: 'pdf_key', explanation: `Selisihnya 2, jadi ${i + 6}.`, explanation_source: 'pdf',
      passage_id: i === 0 ? 'p1' : null, images: [], revision: null,
    })),
    skipped: [],
  };
}

test('impor: validasi, idempoten, dan versi baru saat isi berubah', () => {
  const file = makeFile();
  const p = preview(db, file, { filename: 'TES_barisan.json', folder: 'Tes' });
  assert.equal(p.ok, true, p.errors.join('\n'));
  assert.equal(p.counts.new, 12);

  const c1 = commit(db, file, { filename: 'TES_barisan.json', folder: 'Tes' });
  assert.equal(c1.committed, true);
  const c2 = commit(db, file, { filename: 'TES_barisan.json', folder: 'Tes' });
  assert.equal(c2.counts.new, 0);
  assert.equal(c2.counts.unchanged, 12);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM questions').get().n, 12);

  const changed = structuredClone(file);
  changed.questions[3].explanation = 'Pembahasan yang diperbaiki.';
  const c3 = commit(db, changed, { filename: 'TES_barisan.json', folder: 'Tes' });
  assert.equal(c3.counts.updated, 1);
  const q = db.prepare('SELECT id, version FROM questions WHERE seq = 4').get();
  assert.equal(q.version, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM question_versions WHERE question_id = ?').get(q.id).n, 1);

  // Duplikat persis di file lain tidak diimpor ulang.
  const dupe = commit(db, file, { filename: 'TES_kembar.json', folder: 'Tes' });
  assert.equal(dupe.counts.duplicates, 12);
  assert.equal(dupe.counts.new, 0);
});

test('impor: file rusak ditolak utuh', () => {
  const bad = makeFile(3);
  bad.questions[1].answer = 'E';
  bad.questions[2].explanation = '';
  bad.questions[0].stem = 'Rumus $x + 1 tidak ditutup';
  bad.questions.push({ ...bad.questions[0], seq: 5 });
  const out = commit(db, bad, { filename: 'TES_rusak.json' });
  assert.equal(out.committed, false);
  const all = out.errors.join('\n');
  assert.match(all, /tidak ada di pilihan/);
  assert.match(all, /pembahasan kosong/);
  assert.match(all, /dolar/);
  assert.match(all, /seq tidak lengkap/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM source_files WHERE filename = 'TES_rusak.json'").get().n, 0);
});

test('impor: SOAL STRIKE masuk antrean pengayaan, soal bergambar dilewati', () => {
  const strike = {
    title: 'SOAL TES STRIKE UNAIR 2025', format: 'question_bank_json', language: 'en', contexts: {},
    questions: [
      { id: 'a', number: 1, type: 'multiple_choice', section: 'Number sequence', question: 'Next: 2, 4, 6, ?', options: [{ key: 'A', text: '7' }, { key: 'B', text: '8' }], correct_answer: '' },
      { id: 'b', number: 2, type: 'multiple_choice', section: 'Figure reasoning', question: 'Lihat gambar', options: [], correct_answer: 'A', image_data_uri: 'data:image/png;base64,AAA' },
    ],
  };
  const out = commit(db, strike, { filename: 'SOAL_STRIKE_tes.json' });
  assert.equal(out.committed, true, out.errors?.join('\n'));
  assert.equal(out.counts.pending_enrichment, 1);
  assert.equal(out.counts.skipped, 1);
  const q = db.prepare("SELECT status, subtopic_code FROM questions WHERE stem LIKE 'Next:%'").get();
  assert.equal(q.status, 'pending_enrichment');
  assert.equal(q.subtopic_code, 'NUMERIK.BARISAN');
});

test('alur pengguna: daftar, onboarding, latihan santai dan ujian, rahasia jawaban', async () => {
  resetRateLimits();
  const call = client();
  let r = await call('POST', '/api/auth/register', { email: 'siswa@contoh.id', password: 'rahasia123', display_name: 'Siswa' });
  assert.equal(r.status, 201);
  r = await call('PATCH', '/api/me/profile', { target_universities: ['UNAIR'], exam_date: '2027-03-01', onboarded: true });
  assert.deepEqual(r.body.user.target_universities, ['UNAIR']);

  r = await call('GET', '/api/curriculum?university=UNAIR');
  const barisan = r.body.units.flatMap((u) => u.subtopics).find((s) => s.code === 'NUMERIK.BARISAN');
  assert.equal(barisan.status, 'active');
  assert.equal(barisan.question_count, 12);
  const figural = r.body.units.flatMap((u) => u.subtopics).find((s) => s.code === 'NONVERBAL.FIGURAL');
  assert.equal(figural.status, 'soon');

  // Mode ujian: tidak ada kunci maupun pembahasan sebelum dikumpulkan.
  r = await call('POST', '/api/sessions', { subtopics: ['NUMERIK.BARISAN'], count: 10, difficulty: 'mixed', mode: 'ujian' });
  assert.equal(r.status, 201);
  const exam = r.body;
  assert.equal(exam.items.length, 10);
  const raw = JSON.stringify(exam);
  assert.doesNotMatch(raw, /correct_answer|explanation|Selisihnya/);
  r = await call('PATCH', `/api/sessions/${exam.id}/items/0`, { answer: 'B', time_ms: 4000 });
  assert.equal(r.status, 200);
  assert.doesNotMatch(JSON.stringify(r.body), /correct_answer|explanation/);
  r = await call('PATCH', `/api/sessions/${exam.id}/items/1`, { answer: 'A', flagged: true });
  r = await call('GET', `/api/sessions/${exam.id}`);
  assert.doesNotMatch(JSON.stringify(r.body), /correct_answer|Selisihnya/);
  assert.equal(r.body.items[1].flagged, true);
  r = await call('POST', `/api/sessions/${exam.id}/submit`);
  assert.equal(r.body.status, 'submitted');
  assert.equal(r.body.result.correct, 1);
  assert.equal(r.body.result.wrong, 1);
  assert.equal(r.body.result.blank, 8);
  assert.ok(r.body.items[0].explanation);
  assert.equal(r.body.items[0].is_correct, true);

  // Ulangi yang salah: 9 soal (1 salah + 8 kosong).
  r = await call('POST', '/api/sessions', { source: 'retry', retryOf: exam.id, mode: 'santai' });
  assert.equal(r.status, 201);
  assert.equal(r.body.items.length, 9);

  // Mode santai: pembahasan muncul setelah menjawab, dan jawaban terkunci.
  const santai = r.body;
  assert.doesNotMatch(JSON.stringify(santai), /Selisihnya/);
  r = await call('PATCH', `/api/sessions/${santai.id}/items/0`, { answer: 'B' });
  assert.equal(r.body.item.correct_answer, 'B');
  assert.match(r.body.item.explanation, /Selisihnya/);
  r = await call('PATCH', `/api/sessions/${santai.id}/items/0`, { answer: 'A' });
  assert.equal(r.status, 409);
  r = await call('GET', `/api/sessions/${santai.id}`);
  assert.ok(r.body.items[0].explanation);
  assert.equal(r.body.items[1].explanation, undefined);

  // Bookmark, nilai pembahasan, dan beranda.
  const qid = santai.items[0].question_id;
  r = await call('POST', `/api/questions/${qid}/bookmark`, { on: true });
  assert.equal(r.body.bookmarked, true);
  r = await call('POST', `/api/questions/${qid}/rate`, { helpful: true });
  assert.equal(r.body.ok, true);
  r = await call('POST', `/api/questions/${santai.items[1].question_id}/rate`, { helpful: true });
  // Soal ini sudah terbuka lewat sesi ujian yang dikumpulkan, jadi boleh dinilai.
  assert.equal(r.status, 200);
  r = await call('GET', '/api/me/home');
  assert.equal(r.body.active_session.id, santai.id);
  assert.equal(r.body.totals.bookmarks, 1);
  assert.ok(r.body.today.length >= 1);

  // Soal yang belum pernah muncul tidak bisa dilapor atau ditandai.
  const unseen = db.prepare("SELECT id FROM questions WHERE status = 'pending_enrichment' LIMIT 1").get().id;
  r = await call('POST', `/api/questions/${unseen}/report`, { category: 'salah_ketik' });
  assert.equal(r.status, 404);

  // Bukan admin.
  r = await call('GET', '/api/admin/metrics');
  assert.equal(r.status, 403);
});

test('waktu habis: sesi dikumpulkan otomatis', async () => {
  resetRateLimits();
  const call = client();
  await call('POST', '/api/auth/register', { email: 'timer@contoh.id', password: 'rahasia123' });
  let r = await call('POST', '/api/sessions', { subtopics: ['NUMERIK.BARISAN'], count: 10, mode: 'ujian', timerMinutes: 1 });
  const id = r.body.id;
  db.prepare('UPDATE practice_sessions SET deadline_at = ? WHERE id = ?').run(new Date(Date.now() - 10_000).toISOString(), id);
  r = await call('PATCH', `/api/sessions/${id}/items/0`, { answer: 'B' });
  assert.equal(r.status, 410);
  r = await call('GET', `/api/sessions/${id}`);
  assert.equal(r.body.status, 'submitted');
  assert.equal(r.body.result.auto, true);
});

test('laporan: tiga laporan kunci salah menyembunyikan soal', async () => {
  resetRateLimits();
  const qid = db.prepare("SELECT id FROM questions WHERE status = 'active' AND passage_id IS NULL AND source_file_id = (SELECT id FROM source_files WHERE filename = 'TES_barisan.json') ORDER BY seq LIMIT 1").get().id;
  for (let i = 0; i < 3; i++) {
    const call = client();
    await call('POST', '/api/auth/register', { email: `pelapor${i}@contoh.id`, password: 'rahasia123' });
    // Buat sesi yang memuat soal ini lewat bookmark tidak bisa, jadi pakai sesi subtopik lalu cari soalnya.
    let found = false;
    for (let k = 0; k < 3 && !found; k++) {
      const s = await call('POST', '/api/sessions', { subtopics: ['NUMERIK.BARISAN'], count: 30, mode: 'santai' });
      found = s.body.items.some((it) => it.question_id === qid);
    }
    assert.ok(found);
    const r = await call('POST', `/api/questions/${qid}/report`, { category: 'kunci_salah', note: 'harusnya C' });
    assert.equal(r.status, 201);
  }
  assert.equal(db.prepare('SELECT status FROM questions WHERE id = ?').get(qid).status, 'hidden');
});

test('admin: impor lewat API, laporan, dan hapus akun', async () => {
  resetRateLimits();
  const call = client();
  await call('POST', '/api/auth/register', { email: 'admin@contoh.id', password: 'rahasia123' });
  db.prepare("UPDATE profiles SET role = 'owner' WHERE user_id = (SELECT id FROM users WHERE email = 'admin@contoh.id')").run();
  const file = makeFile(5, 'LOGIKA.SILOGISME');
  file.questions.forEach((q) => { q.stem = `Semua A adalah B (${q.seq}). Maka?`; });
  let r = await call('POST', '/api/admin/import/preview', { filename: 'TES_silogisme.json', content: JSON.stringify(file) });
  assert.equal(r.status, 200);
  assert.equal(r.body.counts.new, 5);
  assert.equal(r.body.samples.length, 5);
  r = await call('POST', '/api/admin/import/commit', { filename: 'TES_silogisme.json', content: file, publish: false });
  assert.equal(r.status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM questions WHERE subtopic_code = 'LOGIKA.SILOGISME' AND status = 'draft'").get().n, 5);
  r = await call('GET', '/api/admin/sources');
  const src = r.body.sources.find((s) => s.filename === 'TES_silogisme.json');
  r = await call('POST', '/api/admin/sources/publish', { ids: [src.id] });
  assert.equal(r.body.changed, 5);

  r = await call('GET', '/api/admin/reports?status=open');
  assert.ok(r.body.reports.length >= 3);
  r = await call('PATCH', `/api/admin/reports/${r.body.reports[0].id}`, { status: 'closed', resolution_note: 'Kunci sudah diperbaiki' });
  assert.equal(r.status, 200);

  r = await call('GET', '/api/admin/metrics');
  assert.ok(r.body.users_total >= 5);

  // Hapus akun pengguna biasa.
  const u = client();
  await u('POST', '/api/auth/register', { email: 'hapus@contoh.id', password: 'rahasia123' });
  r = await u('DELETE', '/api/me', { password: 'salah' });
  assert.equal(r.status, 401);
  r = await u('DELETE', '/api/me', { password: 'rahasia123' });
  assert.equal(r.status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'hapus@contoh.id'").get().n, 0);
});

test('keamanan: origin asing ditolak', async () => {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://jahat.example' }, body: '{}',
  });
  assert.equal(res.status, 403);
});

test('misi harian, streak, dan status tutorial', async () => {
  resetRateLimits();
  const call = client();
  await call('POST', '/api/auth/register', { email: 'misi@contoh.id', password: 'rahasia123' });
  let r = await call('GET', '/api/me/daily');
  assert.equal(r.body.today_answered, 0);
  assert.equal(r.body.daily_goal, 10);
  assert.equal(r.body.streak, 0);
  assert.equal(r.body.week.length, 7);
  r = await call('POST', '/api/sessions', { subtopics: ['NUMERIK.BARISAN'], count: 10, mode: 'santai' });
  const sid = r.body.id;
  for (let i = 0; i < r.body.items.length; i++) await call('PATCH', `/api/sessions/${sid}/items/${i}`, { answer: 'B' });
  r = await call('GET', '/api/me/daily');
  assert.ok(r.body.today_answered >= 10);
  assert.equal(r.body.streak, 1);
  assert.equal(r.body.week[6].done, true);
  r = await call('PATCH', '/api/me/profile', { tutorial_status: 'done' });
  assert.equal(r.body.user.tutorial_status, 'done');
  r = await call('PATCH', '/api/me/profile', { tutorial_status: 'asal' });
  assert.equal(r.status, 400);
});
