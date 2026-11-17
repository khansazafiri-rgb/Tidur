// Impor bank soal dari JSON hasil skill pemrosesan PDF.
//
// Tiga bentuk file dikenali dari kuncinya:
//   - "iup"        : skema skill terbaru (meta, passages, questions, skipped)
//   - "iup_legacy" : skema skill lama, sama tetapi soalnya memakai needs_review/review_note
//   - "strike"     : SOAL STRIKE (question_bank_json: title, contexts, options [{key,text}], correct_answer)
//
// Alurnya: normalize() -> validate() -> plan() (bandingkan dengan isi DB) -> commit().
// Impor idempoten: kunci unik soal adalah (file sumber, seq).

import crypto from 'node:crypto';
import { tx, uid, nowIso, parseJson } from '../db.js';

export const SUBTOPIC_ALIASES = {
  'SJT.RANKING': 'KHUSUS.SJT',
  'SJT.SELECT_THREE': 'KHUSUS.SJT',
  'SJT': 'KHUSUS.SJT',
  'KHUSUS.LAINNYA': 'LAINNYA',
};

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const ANSWER_SOURCES = new Set(['pdf_key', 'computed', 'ai_inferred', 'corrected']);
const QUESTION_TYPES = new Set(['mcq', 'short_answer', 'sjt_ranking', 'sjt_select_three']);
const KNOWN_IUP_KEYS = new Set([
  'seq', 'number', 'type', 'unit', 'subtopic', 'difficulty_ai', 'stem', 'options', 'answer', 'answer_source',
  'explanation', 'explanation_source', 'passage_id', 'images', 'revision', 'needs_review', 'review_note',
]);
const IMAGE_KEYS = [
  'image_data_uri', 'diagram_image_data_uri', 'image_svg', 'figure_data_uri', 'image', 'diagram_svg_data_uri',
  'option_E_image_data_uri', 'formula_source_image_data_uri', 'source_equation_image_data_uri', 'continuation_image_data_uri',
];

// ---------------------------------------------------------------- utilitas teks

export function normText(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function contentHash(stem, options) {
  const opts = Object.keys(options || {}).sort().map((k) => `${k}:${normText(options[k])}`).join('|');
  return crypto.createHash('sha256').update(normText(stem) + '||' + opts).digest('hex').slice(0, 32);
}

/** Kunci "mirip": sama setelah angka dihapus. Menangkap versi 2023 vs 2025 yang hanya beda angka. */
export function nearHash(stem, options) {
  const strip = (s) => normText(s).replace(/[0-9.,]+/g, '#');
  const opts = Object.keys(options || {}).sort().map((k) => strip(options[k])).join('|');
  return crypto.createHash('sha256').update(strip(stem) + '||' + opts).digest('hex').slice(0, 32);
}

/** Jumlah tanda $ yang tidak di-escape harus genap. */
export function dollarsBalanced(s) {
  const text = String(s ?? '');
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === '$' && text[i - 1] !== '\\') n++;
  return n % 2 === 0;
}

const FORBIDDEN = [
  { re: /�/, label: 'karakter rusak (U+FFFD)' },
  // eslint-disable-next-line no-control-regex
  { re: /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/, label: 'karakter kontrol' },
  { re: /[-]/, label: 'karakter private-use (sisa font PDF)' },
  { re: /<\s*\/?\s*(script|iframe|style|object|embed|img|svg|link|meta)\b[^<>]*>|<a\s[^<>]*href/i, label: 'tag HTML mentah' },
  { re: /\bjavascript:/i, label: 'tautan javascript:' },
];

function findForbidden(s) {
  for (const f of FORBIDDEN) if (f.re.test(String(s ?? ''))) return f.label;
  return null;
}

function guessUniversity(...texts) {
  const t = texts.join(' ').toUpperCase();
  if (/\bUNAIR\b|AIRLANGGA/.test(t)) return 'UNAIR';
  if (/\bUGM\b|GADJAH|GMST|ACEPT/.test(t)) return 'UGM';
  if (/\bUI\b|SIMAK|KKI/.test(t)) return 'UI';
  return null;
}

function guessYear(...texts) {
  const m = texts.join(' ').match(/\b(20[12]\d)\b/);
  return m ? Number(m[1]) : null;
}

// Pemetaan judul bagian SOAL STRIKE ke subtopik. Hanya tebakan awal untuk antrean pengayaan.
const STRIKE_SECTION_RULES = [
  [/antonym|opposite/i, 'VERBAL.ANTONIM'],
  [/synonym|vocabular/i, 'VERBAL.SINONIM'],
  [/analog/i, 'VERBAL.ANALOGI'],
  [/sentence completion|fill in/i, 'VERBAL.SENTENCE_COMPLETION'],
  [/reading|passage|comprehension/i, 'ENGLISH.READING'],
  [/structure|grammar|written expression|error/i, 'ENGLISH.STRUCTURE'],
  [/paragraph/i, 'ENGLISH.PARAGRAF'],
  [/figure|figural|visual|odd one out/i, 'NONVERBAL.FIGURAL'],
  [/venn|set relation|himpunan|\bset\b/i, 'NUMERIK.HIMPUNAN'],
  [/series|sequence|deret|pola|pattern/i, 'NUMERIK.BARISAN'],
  [/data interpretation|statistic|graph|tabel|table/i, 'NUMERIK.DATA'],
  [/geometr|area|volume|trigonometr|angle/i, 'NUMERIK.GEOMETRI'],
  [/quantitative comparison/i, 'NUMERIK.PERBANDINGAN_KUANTITAS'],
  [/equation|inequalit|algebra|aljabar|function|exponent|quadratic/i, 'NUMERIK.ALJABAR'],
  [/syllogism|silogisme|deductive/i, 'LOGIKA.SILOGISME'],
  [/conditional|if.?then/i, 'LOGIKA.KONDISIONAL'],
  [/blood relation|family|keluarga/i, 'LOGIKA.HUBUNGAN_KELUARGA'],
  [/seating|arrangement|order|ranking|puzzle|schedul|analytical/i, 'LOGIKA.URUTAN'],
  [/coding|decoding|artificial language|bahasa buatan/i, 'LOGIKA.BAHASA_BUATAN'],
  [/critical|argument|assumption|logic|penalaran|reasoning/i, 'LOGIKA.PENALARAN_KRITIS'],
  [/numer|arithmetic|aritmetika|percent|ratio|rate|probab|number|math|matematika|mtk/i, 'NUMERIK.ARITMETIKA'],
];

export function strikeSubtopic(section, filename) {
  const s = `${section || ''}`;
  for (const [re, code] of STRIKE_SECTION_RULES) if (re.test(s)) return code;
  for (const [re, code] of STRIKE_SECTION_RULES) if (re.test(filename || '')) return code;
  return 'LAINNYA';
}

// ---------------------------------------------------------------- deteksi & normalisasi

export function detectFormat(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return 'unknown';
  if (json.meta && Array.isArray(json.questions)) {
    const legacy = json.questions.some((q) => q && ('needs_review' in q || 'review_note' in q));
    return legacy ? 'iup_legacy' : 'iup';
  }
  if (Array.isArray(json.questions) && (json.format === 'question_bank_json' || 'contexts' in json)) return 'strike';
  return 'unknown';
}

function optionsToObject(options) {
  if (!options) return {};
  if (Array.isArray(options)) {
    const out = {};
    options.forEach((o, i) => {
      if (o && typeof o === 'object') out[String(o.key || String.fromCharCode(65 + i)).trim()] = String(o.text ?? '');
      else out[String.fromCharCode(65 + i)] = String(o ?? '');
    });
    return out;
  }
  if (typeof options === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(options)) out[String(k).trim()] = String(v ?? '');
    return out;
  }
  return {};
}

function normalizeIup(json, format, opts) {
  const meta = json.meta || {};
  const filename = opts.filename;
  const university = meta.university || guessUniversity(filename, opts.folder || '', meta.source_file || '');
  const year = Number.isInteger(meta.year) ? meta.year : guessYear(filename, meta.source_file || '');
  const language = meta.language || null;

  const passages = (json.passages || []).map((p) => ({
    local_id: String(p.id), title: p.title ? String(p.title) : null, text: String(p.text ?? ''),
  }));

  const questions = (json.questions || []).map((q) => {
    const extra = {};
    for (const [k, v] of Object.entries(q)) if (!KNOWN_IUP_KEYS.has(k)) extra[k] = v;
    let revision = q.revision ?? null;
    if (q.needs_review) {
      const flag = { type: 'flag_lama', note: q.review_note || '' };
      if (!revision) revision = flag;
      else extra.flag_lama = flag;
    }
    const rawSub = String(q.subtopic || '').trim();
    const subtopic = SUBTOPIC_ALIASES[rawSub] || rawSub;
    if (subtopic !== rawSub) extra.original_subtopic = rawSub;
    return {
      seq: q.seq,
      number: q.number == null ? null : String(q.number),
      type: q.type || 'mcq',
      unit: q.unit ? String(q.unit) : null,
      subtopic,
      stem: String(q.stem ?? ''),
      options: optionsToObject(q.options),
      answer: q.answer == null ? null : String(q.answer).trim(),
      answer_source: q.answer_source || null,
      explanation: q.explanation == null ? null : String(q.explanation),
      explanation_source: q.explanation_source || null,
      passage_local_id: q.passage_id == null ? null : String(q.passage_id),
      images: Array.isArray(q.images) ? q.images : [],
      difficulty_ai: q.difficulty_ai || null,
      revision,
      extra,
      status: 'active',
    };
  });

  const skipped = (json.skipped || []).map((s) => {
    const rawSub = String(s.subtopic || '').trim();
    return {
      seq: s.seq, number: s.number == null ? null : String(s.number), page: Number.isInteger(s.page) ? s.page : null,
      subtopic: SUBTOPIC_ALIASES[rawSub] || rawSub || null, reason: s.reason || '', needs_image: !!s.needs_image, data: s,
    };
  });

  return {
    format, filename, folder: opts.folder || null, university, year, language,
    progress_status: meta.progress?.status || null,
    meta, passages, questions, skipped,
  };
}

function normalizeStrike(json, opts) {
  const filename = opts.filename;
  const title = json.title || '';
  const university = guessUniversity(filename, title, opts.folder || '');
  const year = guessYear(title, filename);
  const language = json.language || null;

  const passages = [];
  const ctx = json.contexts;
  if (Array.isArray(ctx)) {
    ctx.forEach((c, i) => passages.push({ local_id: String(c.id ?? c.context_id ?? i), title: c.title || null, text: String(c.text ?? c.content ?? '') }));
  } else if (ctx && typeof ctx === 'object') {
    for (const [id, c] of Object.entries(ctx)) {
      if (typeof c === 'string') passages.push({ local_id: id, title: null, text: c });
      else passages.push({ local_id: id, title: c?.title || null, text: String(c?.text ?? c?.content ?? '') });
    }
  }
  const passageIds = new Set(passages.map((p) => p.local_id));

  const questions = [];
  const skipped = [];
  (json.questions || []).forEach((q, i) => {
    const seq = i + 1;
    const subtopic = strikeSubtopic(q.section, filename);
    const hasImage = IMAGE_KEYS.some((k) => q[k]) || subtopic.startsWith('NONVERBAL');
    const stem = String(q.question ?? q.source_question_text ?? '');
    if (hasImage) {
      skipped.push({
        seq, number: q.number == null ? null : String(q.number), page: Number.isInteger(q.source_page) ? q.source_page : null,
        subtopic, reason: 'Soal memakai gambar (dari SOAL STRIKE)', needs_image: true,
        data: { section: q.section || null, question: stem, image_description: q.image_description || q.figure_description || q.diagram_description || null, correct_answer: q.correct_answer || null },
      });
      return;
    }
    const extra = {};
    for (const k of ['id', 'section', 'source_page', 'source_question_number', 'source_note', 'transcription_note', 'test_number', 'set_name', 'answer_key_status', 'answer_status', 'needs_manual_review', 'question_latex', 'source_question_missing']) {
      if (q[k] !== undefined) extra[k] = q[k];
    }
    const answer = q.correct_answer ? String(q.correct_answer).trim() : null;
    const ctxId = q.context_id == null ? null : String(q.context_id);
    questions.push({
      seq,
      number: q.number == null ? null : String(q.number),
      type: 'mcq',
      unit: subtopic.split('.')[0] === 'LAINNYA' ? 'KHUSUS' : subtopic.split('.')[0],
      subtopic,
      stem,
      options: optionsToObject(q.options),
      answer,
      answer_source: answer ? 'pdf_key' : null,
      explanation: q.explanation ? String(q.explanation) : null,
      explanation_source: q.explanation ? 'pdf' : null,
      passage_local_id: ctxId && passageIds.has(ctxId) ? ctxId : null,
      images: [],
      difficulty_ai: null,
      revision: null,
      extra: { ...extra, adapter: 'strike' },
      status: 'pending_enrichment',
    });
  });

  return {
    format: 'strike', filename, folder: opts.folder || null, university, year, language,
    progress_status: 'complete',
    meta: { title, description: json.description || '', source: json.source || null, question_count: json.question_count ?? null },
    passages, questions, skipped,
  };
}

export function normalize(json, opts) {
  const format = detectFormat(json);
  if (format === 'iup' || format === 'iup_legacy') return normalizeIup(json, format, opts);
  if (format === 'strike') return normalizeStrike(json, opts);
  return { format: 'unknown', filename: opts.filename, folder: opts.folder || null, meta: {}, passages: [], questions: [], skipped: [] };
}

// ---------------------------------------------------------------- validasi (setara merge_soal.py)

/**
 * @param {object} n hasil normalize()
 * @param {{subtopics: Map<string, {unit_code: string}>}} taxonomy
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validate(n, taxonomy) {
  const errors = [];
  const warnings = [];
  const err = (q, msg) => errors.push(q ? `Soal seq ${q.seq}: ${msg}` : msg);

  if (n.format === 'unknown') {
    errors.push('Bentuk file tidak dikenali. Harus berisi meta + questions (skema IUP) atau title + contexts + questions (SOAL STRIKE).');
    return { errors, warnings };
  }
  if (!n.questions.length && !n.skipped.length) errors.push('File tidak berisi soal.');

  // Kelengkapan urutan soal: seq 1..N tanpa celah, gabungan questions dan skipped.
  const seqs = [...n.questions.map((q) => q.seq), ...n.skipped.map((s) => s.seq)];
  const bad = seqs.filter((s) => !Number.isInteger(s) || s < 1);
  if (bad.length) errors.push(`Ada ${bad.length} seq yang bukan bilangan bulat positif.`);
  const seen = new Set();
  const dup = new Set();
  for (const s of seqs) { if (seen.has(s)) dup.add(s); seen.add(s); }
  if (dup.size) errors.push(`seq ganda: ${[...dup].slice(0, 10).join(', ')}`);
  const max = seqs.length ? Math.max(...seqs.filter(Number.isInteger)) : 0;
  const missing = [];
  for (let i = 1; i <= max; i++) if (!seen.has(i)) missing.push(i);
  if (missing.length) errors.push(`seq tidak lengkap, hilang: ${missing.slice(0, 15).join(', ')}${missing.length > 15 ? ', ...' : ''}`);

  const passageIds = new Set(n.passages.map((p) => p.local_id));
  const strict = n.format !== 'strike'; // STRIKE masuk antrean pengayaan, jadi kosong masih boleh.
  for (const p of n.passages) {
    const out = strict ? errors : warnings;
    if (!p.text.trim()) warnings.push(`Bacaan ${p.local_id} kosong.`);
    if (!dollarsBalanced(p.text)) out.push(`Bacaan ${p.local_id}: tanda dolar KaTeX tidak tertutup.`);
    const f = findForbidden(p.text);
    if (f) out.push(`Bacaan ${p.local_id}: mengandung ${f}.`);
  }


  for (const q of n.questions) {
    if (!QUESTION_TYPES.has(q.type)) err(q, `type "${q.type}" tidak dikenal`);
    if (!q.stem.trim() && strict) err(q, 'teks soal kosong');

    const sub = taxonomy.subtopics.get(q.subtopic);
    if (!sub) err(q, `subtopik "${q.subtopic}" tidak ada di taksonomi`);
    else {
      const expectUnit = sub.unit_code;
      if (q.unit && q.unit !== expectUnit && !(q.unit === 'SJT' && expectUnit === 'KHUSUS')) {
        warnings.push(`Soal seq ${q.seq}: unit "${q.unit}" tidak cocok dengan subtopik ${q.subtopic}; dipakai ${expectUnit}.`);
      }
      q.unit = expectUnit;
    }

    const keys = Object.keys(q.options);
    if (q.type === 'mcq' || q.type.startsWith('sjt')) {
      if (keys.length < 2 && strict) err(q, 'pilihan jawaban kurang dari dua');
      if (q.answer) {
        const letters = q.type === 'mcq' ? [q.answer] : q.answer.replace(/[^A-Z]/gi, '').toUpperCase().split('');
        const notIn = letters.filter((l) => !keys.includes(l));
        if (notIn.length) {
          const msg = `jawaban "${q.answer}" tidak ada di pilihan (${keys.join(', ') || 'kosong'})`;
          if (strict) err(q, msg); else warnings.push(`Soal seq ${q.seq}: ${msg}`);
        }
      } else if (strict) err(q, 'jawaban kosong');
    }
    if (strict && !String(q.explanation || '').trim()) err(q, 'pembahasan kosong');
    if (q.answer_source && !ANSWER_SOURCES.has(q.answer_source)) warnings.push(`Soal seq ${q.seq}: answer_source "${q.answer_source}" tidak dikenal.`);
    if (q.difficulty_ai && !DIFFICULTIES.has(q.difficulty_ai)) err(q, `difficulty_ai "${q.difficulty_ai}" harus easy, medium, atau hard`);
    if (strict && !q.difficulty_ai) err(q, 'difficulty_ai kosong');
    if (q.passage_local_id && !passageIds.has(q.passage_local_id)) err(q, `passage_id "${q.passage_local_id}" tidak ada di daftar bacaan`);

    // Untuk SOAL STRIKE masalah format hanya peringatan: soalnya tetap ditinjau saat pengayaan.
    const fmt = strict ? (m) => err(q, m) : (m) => warnings.push(`Soal seq ${q.seq}: ${m}`);
    for (const [field, val] of [['stem', q.stem], ['explanation', q.explanation], ...keys.map((k) => [`pilihan ${k}`, q.options[k]])]) {
      if (val == null) continue;
      if (!dollarsBalanced(val)) fmt(`${field}: tanda dolar KaTeX tidak tertutup`);
      const f = findForbidden(val);
      if (f) fmt(`${field}: mengandung ${f}`);
    }
  }

  for (const s of n.skipped) {
    if (s.subtopic && !taxonomy.subtopics.has(s.subtopic)) warnings.push(`Soal dilewati seq ${s.seq}: subtopik "${s.subtopic}" tidak dikenal.`);
  }

  if (n.progress_status && n.progress_status !== 'complete') {
    warnings.push(`Status file "${n.progress_status}": pemrosesan belum selesai. Soal yang sudah ada tetap bisa diimpor.`);
  }
  if (!n.university) warnings.push('Kampus file tidak diketahui dari meta maupun nama file.');
  if (n.format === 'strike') {
    warnings.push('File SOAL STRIKE: semua soal masuk antrean "menunggu pengayaan" dan tidak tampil ke pengguna sampai jawaban dan pembahasannya dilengkapi.');
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------- rencana & commit

export function loadTaxonomy(db) {
  const subtopics = new Map();
  for (const r of db.prepare('SELECT code, unit_code, status FROM subtopics').all()) subtopics.set(r.code, r);
  return { subtopics };
}

function completeness(q) {
  let s = 0;
  if (q.answer) s += 2;
  if (q.explanation && String(q.explanation).trim()) s += 2;
  if (q.subtopic_code && q.subtopic_code !== 'LAINNYA') s += 1;
  if (q.answer_source === 'pdf_key') s += 1;
  if (q.status === 'active' || q.status === 'draft') s += 1;
  return s;
}

function rowFromNormalized(q, n, sourceId, passageMap) {
  return {
    seq: q.seq,
    number: q.number,
    type: q.type,
    unit_code: q.unit,
    subtopic_code: q.subtopic,
    stem: q.stem,
    options: JSON.stringify(q.options),
    answer: q.answer,
    answer_source: q.answer_source,
    explanation: q.explanation,
    explanation_source: q.explanation_source,
    passage_id: q.passage_local_id ? passageMap.get(q.passage_local_id) ?? null : null,
    images: JSON.stringify(q.images || []),
    difficulty_ai: q.difficulty_ai,
    revision: q.revision ? JSON.stringify(q.revision) : null,
    year: n.year,
    language: n.language,
    content_hash: contentHash(q.stem, q.options),
    near_hash: nearHash(q.stem, q.options),
    extra: JSON.stringify(q.extra || {}),
  };
}

const COMPARE_FIELDS = ['number', 'type', 'unit_code', 'subtopic_code', 'stem', 'options', 'answer', 'answer_source', 'explanation', 'explanation_source', 'passage_id', 'images', 'difficulty_ai', 'revision', 'content_hash'];

function fileChecksum(json) {
  return crypto.createHash('sha256').update(JSON.stringify(json)).digest('hex');
}

/**
 * Bandingkan file dengan isi database tanpa menulis apa pun.
 * Mengembalikan ringkasan untuk pratinjau dan daftar aksi untuk commit.
 */
export function plan(db, json, opts) {
  const n = normalize(json, opts);
  const taxonomy = loadTaxonomy(db);
  const { errors, warnings } = validate(n, taxonomy);
  const checksum = fileChecksum(json);

  const existingFile = db.prepare('SELECT * FROM source_files WHERE filename = ?').get(n.filename);
  const sourceId = existingFile?.id || uid('src_');
  const existingRows = new Map();
  if (existingFile) {
    for (const r of db.prepare('SELECT * FROM questions WHERE source_file_id = ?').all(sourceId)) existingRows.set(r.seq, r);
  }
  const existingPassages = new Map();
  if (existingFile) {
    for (const p of db.prepare('SELECT id, local_id FROM passages WHERE source_file_id = ?').all(sourceId)) existingPassages.set(p.local_id, p.id);
  }
  const passageMap = new Map(n.passages.map((p) => [p.local_id, existingPassages.get(p.local_id) || `${sourceId}_${p.local_id}`]));

  const byHash = db.prepare("SELECT id, source_file_id, seq, answer, explanation, subtopic_code, answer_source, status FROM questions WHERE content_hash = ? AND status != 'retired' AND duplicate_of IS NULL");
  const byNear = db.prepare("SELECT q.id, q.seq, s.filename FROM questions q JOIN source_files s ON s.id = q.source_file_id WHERE q.near_hash = ? AND q.content_hash != ? AND q.status != 'retired' LIMIT 1");

  const actions = [];
  const counts = { total: n.questions.length, new: 0, updated: 0, unchanged: 0, duplicates: 0, replaces_duplicate: 0, skipped: n.skipped.length, revised: 0, pending_enrichment: 0, near_duplicates: 0 };
  const bySubtopic = {};
  const byDifficulty = {};
  const duplicates = [];
  const nearDuplicates = [];
  const hashesInFile = new Map();

  for (const q of n.questions) {
    const row = rowFromNormalized(q, n, sourceId, passageMap);
    if (q.revision) counts.revised++;
    if (q.status === 'pending_enrichment') counts.pending_enrichment++;
    bySubtopic[row.subtopic_code] = (bySubtopic[row.subtopic_code] || 0) + 1;
    const diff = row.difficulty_ai || 'tanpa label';
    byDifficulty[diff] = (byDifficulty[diff] || 0) + 1;

    const existing = existingRows.get(q.seq);
    if (existing) {
      const changed = COMPARE_FIELDS.some((f) => String(existing[f] ?? '') !== String(row[f] ?? ''));
      if (changed) { counts.updated++; actions.push({ kind: 'update', q, row, existing }); }
      else { counts.unchanged++; actions.push({ kind: 'unchanged', q, row, existing }); }
      continue;
    }

    // Duplikat persis: di file lain, atau di file yang sama dengan seq lebih awal.
    if (hashesInFile.has(row.content_hash)) {
      counts.duplicates++;
      duplicates.push({ seq: q.seq, of: `seq ${hashesInFile.get(row.content_hash)} di file yang sama` });
      actions.push({ kind: 'duplicate', q, row });
      continue;
    }
    hashesInFile.set(row.content_hash, q.seq);
    const twin = byHash.get(row.content_hash);
    if (twin && twin.source_file_id === sourceId) {
      // Soal kembar di file yang sama yang sudah tersimpan pada impor sebelumnya.
      counts.duplicates++;
      duplicates.push({ seq: q.seq, of: `seq ${twin.seq} di file yang sama` });
      actions.push({ kind: 'duplicate', q, row });
      continue;
    }
    if (twin) {
      const twinFile = db.prepare('SELECT filename FROM source_files WHERE id = ?').get(twin.source_file_id)?.filename;
      const mine = completeness({ ...row, status: q.status });
      const theirs = completeness(twin);
      if (mine > theirs) {
        counts.replaces_duplicate++;
        duplicates.push({ seq: q.seq, of: `${twinFile} seq ${twin.seq}`, action: 'menggantikan (lebih lengkap)' });
        actions.push({ kind: 'new', q, row, retire: twin.id });
        counts.new++;
      } else {
        counts.duplicates++;
        duplicates.push({ seq: q.seq, of: `${twinFile} seq ${twin.seq}` });
        actions.push({ kind: 'duplicate', q, row });
      }
      continue;
    }

    const near = byNear.get(row.near_hash, row.content_hash);
    if (near) {
      counts.near_duplicates++;
      nearDuplicates.push({ seq: q.seq, similar_to: `${near.filename} seq ${near.seq}` });
      row.extra = JSON.stringify({ ...(q.extra || {}), near_duplicate_of: near.id });
    }
    counts.new++;
    actions.push({ kind: 'new', q, row });
  }

  // Lima soal acak untuk diperiksa mata.
  const pool = n.questions.filter((q) => q.stem.trim());
  const samples = [];
  const picked = new Set();
  while (samples.length < Math.min(5, pool.length)) {
    const i = Math.floor(Math.random() * pool.length);
    if (picked.has(i)) continue;
    picked.add(i);
    const q = pool[i];
    const passage = q.passage_local_id ? n.passages.find((p) => p.local_id === q.passage_local_id) : null;
    samples.push({
      seq: q.seq, subtopic: q.subtopic, difficulty: q.difficulty_ai, stem: q.stem, options: q.options, answer: q.answer,
      explanation: q.explanation, explanation_source: q.explanation_source, passage: passage ? { title: passage.title, text: passage.text } : null,
      revision: q.revision,
    });
  }

  const fileUnchanged = existingFile && existingFile.checksum === checksum;
  return {
    n, sourceId, existingFile, passageMap, actions, checksum,
    summary: {
      filename: n.filename,
      folder: n.folder,
      format: n.format,
      university: n.university,
      year: n.year,
      language: n.language,
      progress_status: n.progress_status,
      already_imported: !!existingFile,
      file_unchanged: !!fileUnchanged,
      ok: errors.length === 0,
      errors,
      warnings,
      counts,
      by_subtopic: bySubtopic,
      by_difficulty: byDifficulty,
      duplicates: duplicates.slice(0, 50),
      near_duplicates: nearDuplicates.slice(0, 50),
      samples,
    },
  };
}

export function preview(db, json, opts) {
  return plan(db, json, opts).summary;
}

/**
 * Simpan file ke bank soal. File yang gagal validasi ditolak utuh.
 * @param {{filename: string, folder?: string, publish?: boolean, actor?: string}} opts
 */
export function commit(db, json, opts) {
  const p = plan(db, json, opts);
  const { n, sourceId, summary } = p;
  if (!summary.ok) {
    db.prepare('INSERT INTO import_logs(filename, folder, outcome, summary, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(n.filename, n.folder, 'ditolak', JSON.stringify({ errors: summary.errors.slice(0, 50), counts: summary.counts }), opts.actor || null);
    return { ...summary, committed: false, outcome: 'ditolak' };
  }
  const activeStatus = opts.publish === false ? 'draft' : 'active';
  const now = nowIso();

  tx(db, () => {
    if (p.existingFile) {
      db.prepare(`UPDATE source_files SET folder = COALESCE(?, folder), format = ?, university = ?, year = ?, language = ?,
        question_count = ?, checksum = ?, progress_status = ?, meta = ?, imported_at = ?, imported_by = ? WHERE id = ?`)
        .run(n.folder, n.format, n.university, n.year, n.language, n.questions.length + n.skipped.length, p.checksum,
          n.progress_status, JSON.stringify(n.meta || {}), now, opts.actor || null, sourceId);
    } else {
      db.prepare(`INSERT INTO source_files(id, filename, folder, format, university, year, language, question_count, checksum, progress_status, meta, imported_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(sourceId, n.filename, n.folder, n.format, n.university, n.year, n.language, n.questions.length + n.skipped.length,
          p.checksum, n.progress_status, JSON.stringify(n.meta || {}), opts.actor || null);
    }

    const upPassage = db.prepare(`INSERT INTO passages(id, source_file_id, local_id, title, text) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source_file_id, local_id) DO UPDATE SET title = excluded.title, text = excluded.text`);
    for (const ps of n.passages) upPassage.run(p.passageMap.get(ps.local_id), sourceId, ps.local_id, ps.title, ps.text);

    const ins = db.prepare(`INSERT INTO questions(id, source_file_id, seq, number, type, unit_code, subtopic_code, stem, options, answer, answer_source,
      explanation, explanation_source, passage_id, images, difficulty_ai, revision, year, language, content_hash, near_hash, status, extra)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const snap = db.prepare('INSERT INTO question_versions(question_id, version, snapshot, reason, created_by) VALUES (?, ?, ?, ?, ?)');
    const upd = db.prepare(`UPDATE questions SET number = ?, type = ?, unit_code = ?, subtopic_code = ?, stem = ?, options = ?, answer = ?, answer_source = ?,
      explanation = ?, explanation_source = ?, passage_id = ?, images = ?, difficulty_ai = ?, revision = ?, year = ?, language = ?, content_hash = ?, near_hash = ?,
      extra = ?, version = version + 1, updated_at = ?,
      status = CASE WHEN status IN ('hidden','retired') THEN status WHEN ? = 'pending_enrichment' THEN 'pending_enrichment'
                    WHEN status = 'pending_enrichment' THEN ? ELSE status END
      WHERE id = ?`);
    const retire = db.prepare("UPDATE questions SET status = 'retired', duplicate_of = ?, updated_at = ? WHERE id = ?");

    for (const a of p.actions) {
      const r = a.row;
      const status = a.q.status === 'pending_enrichment' ? 'pending_enrichment' : activeStatus;
      if (a.kind === 'new') {
        const id = uid('q_');
        ins.run(id, sourceId, r.seq, r.number, r.type, r.unit_code, r.subtopic_code, r.stem, r.options, r.answer, r.answer_source,
          r.explanation, r.explanation_source, r.passage_id, r.images, r.difficulty_ai, r.revision, r.year, r.language, r.content_hash, r.near_hash, status, r.extra);
        if (a.retire) retire.run(id, now, a.retire);
      } else if (a.kind === 'update') {
        const e = a.existing;
        snap.run(e.id, e.version, JSON.stringify(e), 'impor ulang dengan isi berubah', opts.actor || null);
        upd.run(r.number, r.type, r.unit_code, r.subtopic_code, r.stem, r.options, r.answer, r.answer_source, r.explanation, r.explanation_source,
          r.passage_id, r.images, r.difficulty_ai, r.revision, r.year, r.language, r.content_hash, r.near_hash, r.extra, now,
          a.q.status, activeStatus, e.id);
      }
    }

    const upSkip = db.prepare(`INSERT INTO skipped_questions(source_file_id, seq, number, page, subtopic_code, reason, needs_image, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_file_id, seq) DO UPDATE SET number = excluded.number, page = excluded.page,
      subtopic_code = excluded.subtopic_code, reason = excluded.reason, needs_image = excluded.needs_image, data = excluded.data`);
    for (const s of n.skipped) upSkip.run(sourceId, s.seq, s.number, s.page, s.subtopic, s.reason, s.needs_image ? 1 : 0, JSON.stringify(s.data || {}));

    const outcome = summary.file_unchanged ? 'tidak berubah' : 'diterima';
    db.prepare('INSERT INTO import_logs(filename, folder, outcome, summary, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(n.filename, n.folder, outcome, JSON.stringify({ counts: summary.counts, warnings: summary.warnings.slice(0, 20), format: n.format }), opts.actor || null);
  });

  return { ...summary, committed: true, outcome: summary.file_unchanged ? 'tidak berubah' : 'diterima', samples: undefined };
}

export function parseRevision(s) {
  return parseJson(s, null);
}
