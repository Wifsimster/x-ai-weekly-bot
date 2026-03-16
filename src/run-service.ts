import type { Config } from './config.js';
import { getDb, type RunRecord } from './db.js';
import { logger } from './logger.js';
import { run } from './index.js';

let running = false;

export function isRunning(): boolean {
  return running;
}

export async function triggerRun(config: Config, trigger: 'cron' | 'manual' = 'manual'): Promise<RunRecord> {
  if (running) {
    throw new Error('A run is already in progress');
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO runs (started_at, status, trigger_type) VALUES (datetime('now'), 'running', ?)`
  );
  const { lastInsertRowid } = insert.run(trigger);
  const runId = Number(lastInsertRowid);

  running = true;

  try {
    await run(config);

    // Determine status based on what happened
    const lastRun = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as RunRecord;
    const status = lastRun.summary ? 'success' : lastRun.tweets_fetched > 0 ? 'no_news' : 'no_tweets';

    db.prepare(
      `UPDATE runs SET finished_at = datetime('now'), status = ? WHERE id = ?`
    ).run(status, runId);

    return db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as RunRecord;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare(
      `UPDATE runs SET finished_at = datetime('now'), status = 'error', error_message = ? WHERE id = ?`
    ).run(message, runId);

    logger.error('Run failed', { runId, error: message });
    return db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as RunRecord;
  } finally {
    running = false;
  }
}

export function getRunHistory(limit = 20): RunRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit) as RunRecord[];
}

export function getLastRun(): RunRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 1').get() as RunRecord | undefined;
}

export function updateRunStats(runId: number, updates: Partial<Pick<RunRecord, 'tweets_fetched' | 'tweets_posted' | 'thread_ids' | 'summary'>>) {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.tweets_fetched !== undefined) {
    sets.push('tweets_fetched = ?');
    values.push(updates.tweets_fetched);
  }
  if (updates.tweets_posted !== undefined) {
    sets.push('tweets_posted = ?');
    values.push(updates.tweets_posted);
  }
  if (updates.thread_ids !== undefined) {
    sets.push('thread_ids = ?');
    values.push(updates.thread_ids);
  }
  if (updates.summary !== undefined) {
    sets.push('summary = ?');
    values.push(updates.summary);
  }

  if (sets.length > 0) {
    values.push(runId);
    db.prepare(`UPDATE runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }
}

export function getCurrentRunId(): number | undefined {
  if (!running) return undefined;
  const db = getDb();
  const row = db.prepare("SELECT id FROM runs WHERE status = 'running' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
  return row?.id;
}
