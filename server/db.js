import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { seed } from './seed.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  target_universities TEXT NOT NULL DEFAULT '[]',
  exam_date TEXT,
  daily_minutes INTEGER,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','contributor','owner')),
  onboarded INTEGER NOT NULL DEFAULT 0,
  font_scale REAL NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('verify','reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS universities (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS units (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subtopics (
  code TEXT PRIMARY KEY,
  unit_code TEXT NOT NULL REFERENCES units(code),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','soon','hidden')),
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS university_subtopics (
  university_code TEXT NOT NULL REFERENCES universities(code),
  subtopic_code TEXT NOT NULL REFERENCES subtopics(code),
  weight REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (university_code, subtopic_code)
);

CREATE TABLE IF NOT EXISTS source_files (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  folder TEXT,
  format TEXT NOT NULL,
  university TEXT,
  year INTEGER,
  language TEXT,
  question_count INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL,
  progress_status TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  imported_by TEXT
);

CREATE TABLE IF NOT EXISTS passages (
  id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  title TEXT,
  text TEXT NOT NULL,
  UNIQUE (source_file_id, local_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL REFERENCES source_files(id),
  seq INTEGER NOT NULL,
  number TEXT,
  type TEXT NOT NULL DEFAULT 'mcq',
  unit_code TEXT,
  subtopic_code TEXT,
  stem TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '{}',
  answer TEXT,
  answer_source TEXT,
  explanation TEXT,
  explanation_source TEXT,
  passage_id TEXT REFERENCES passages(id),
  images TEXT NOT NULL DEFAULT '[]',
  difficulty_ai TEXT,
  difficulty_calibrated TEXT,
  difficulty_final TEXT GENERATED ALWAYS AS (COALESCE(difficulty_calibrated, difficulty_ai, 'medium')) VIRTUAL,
  revision TEXT,
  year INTEGER,
  language TEXT,
  content_hash TEXT NOT NULL,
  near_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','retired','draft','pending_enrichment')),
  hidden_reason TEXT,
  duplicate_of TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  extra TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (source_file_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic ON questions(subtopic_code, status);
CREATE INDEX IF NOT EXISTS idx_questions_hash ON questions(content_hash);
CREATE INDEX IF NOT EXISTS idx_questions_passage ON questions(passage_id);
CREATE INDEX IF NOT EXISTS idx_questions_near ON questions(near_hash);
CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(source_file_id, status);

CREATE TABLE IF NOT EXISTS question_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS skipped_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id TEXT NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  seq INTEGER,
  number TEXT,
  page INTEGER,
  subtopic_code TEXT,
  reason TEXT,
  needs_image INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL DEFAULT '{}',
  UNIQUE (source_file_id, seq)
);

CREATE TABLE IF NOT EXISTS tryout_blueprints (
  id TEXT PRIMARY KEY,
  university_code TEXT NOT NULL REFERENCES universities(code),
  name TEXT NOT NULL,
  sections TEXT NOT NULL DEFAULT '[]',
  rules TEXT NOT NULL DEFAULT '{}',
  source_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'practice',
  mode TEXT NOT NULL CHECK (mode IN ('santai','ujian')),
  title TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deadline_at TEXT,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','submitted')),
  current_idx INTEGER NOT NULL DEFAULT 0,
  correct INTEGER,
  wrong INTEGER,
  blank INTEGER,
  score REAL,
  total_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON practice_sessions(user_id, status);

CREATE TABLE IF NOT EXISTS session_items (
  session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  answer TEXT,
  is_correct INTEGER,
  time_ms INTEGER NOT NULL DEFAULT 0,
  flagged INTEGER NOT NULL DEFAULT 0,
  revealed INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT,
  PRIMARY KEY (session_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_items_question ON session_items(question_id);

CREATE TABLE IF NOT EXISTS user_answers (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  attempts INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  last_correct INTEGER NOT NULL DEFAULT 0,
  last_answered_at TEXT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','handling','closed')),
  handler_id TEXT,
  resolution_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_question ON reports(question_id);

CREATE TABLE IF NOT EXISTS explanation_ratings (
  question_id TEXT NOT NULL REFERENCES questions(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helpful INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (question_id, user_id)
);

CREATE TABLE IF NOT EXISTS question_stats (
  question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  distinct_users INTEGER NOT NULL DEFAULT 0,
  pct_correct REAL,
  median_ms INTEGER,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS guides (
  university_code TEXT PRIMARY KEY REFERENCES universities(code),
  content_md TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  props TEXT NOT NULL DEFAULT '{}',
  actor TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name, created_at);

CREATE TABLE IF NOT EXISTS import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  folder TEXT,
  outcome TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

let db;

export function openDb(file = config.dbPath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  d.exec(SCHEMA);
  seed(d);
  return d;
}

export function getDb() {
  if (!db) db = openDb();
  return db;
}

export function setDb(d) {
  db = d;
}

/** Jalankan fn di dalam transaksi. Tidak boleh bersarang. */
export function tx(d, fn) {
  d.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (e) {
    try { d.exec('ROLLBACK'); } catch { /* sudah dibatalkan */ }
    throw e;
  }
}

export function uid(prefix = '') {
  return prefix + crypto.randomBytes(9).toString('base64url');
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseJson(s, fallback) {
  if (s == null || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

export function getSetting(d, key, fallback) {
  const row = d.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? parseJson(row.value, fallback) : fallback;
}

export function setSetting(d, key, value) {
  d.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}
