import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

export interface RunRecord {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'no_news' | 'no_tweets' | 'error' | 'deleted';
  trigger_type: 'cron' | 'manual' | 'collect';
  tweets_fetched: number;
  tweets_posted: number;
  thread_ids: string | null;
  summary: string | null;
  error_message: string | null;
  notification_status: 'pending' | 'sent' | 'failed' | 'skipped' | null;
}

export interface MonthlySummaryRecord {
  id: number;
  year: number;
  month: number;
  summary: string;
  source_run_ids: string;
  generated_at: string;
}

export interface SettingRecord {
  key: string;
  value: string;
  updated_at: string;
}

// Safe ALTER TABLE migration — runs after initial CREATE TABLE migrations.
// SQLite ignores ADD COLUMN if column already exists when wrapped in try/catch.
function runAlterMigrations(database: Database.Database) {
  const alterMigrations = [`ALTER TABLE runs ADD COLUMN notification_status TEXT DEFAULT NULL`];
  for (const sql of alterMigrations) {
    try {
      database.exec(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    trigger_type TEXT NOT NULL DEFAULT 'cron',
    tweets_fetched INTEGER NOT NULL DEFAULT 0,
    tweets_posted INTEGER NOT NULL DEFAULT 0,
    thread_ids TEXT,
    summary TEXT,
    error_message TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS monthly_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    summary TEXT NOT NULL,
    source_run_ids TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(year, month)
  )`,
  `CREATE TABLE IF NOT EXISTS tweets (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    urls TEXT NOT NULL DEFAULT '[]',
    collected_at TEXT NOT NULL DEFAULT (datetime('now')),
    collection_date TEXT NOT NULL,
    used_in_run_id INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tweets_collection_date ON tweets(collection_date, used_in_run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tweets_used_in_run_id ON tweets(used_in_run_id)`,
];

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'bot.db');
    mkdirSync(path.dirname(dbPath), { recursive: true });

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');

    for (const sql of MIGRATIONS) {
      db.exec(sql);
    }

    runAlterMigrations(db);

    logger.info('Database initialized', { path: dbPath });
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
