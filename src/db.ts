import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

export interface RunRecord {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'no_news' | 'no_tweets' | 'error';
  trigger_type: 'cron' | 'manual';
  tweets_fetched: number;
  tweets_posted: number;
  thread_ids: string | null;
  summary: string | null;
  error_message: string | null;
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
