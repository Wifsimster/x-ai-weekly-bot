import type { Config } from './config.js';
import { getDb, type MonthlySummaryRecord } from './db.js';
import { getSuccessfulRunsByMonth } from './run-service.js';
import { createAIFilter } from './ai-filter.js';
import { logger } from './logger.js';

const MAX_INPUT_SUMMARIES = 10;
const MAX_INPUT_CHARS = 20000;

export async function generateMonthlySummary(config: Config, year: number, month: number): Promise<MonthlySummaryRecord> {
  const runs = getSuccessfulRunsByMonth(year, month);

  if (runs.length === 0) {
    throw new Error(`Aucun run réussi avec résumé trouvé pour ${year}-${String(month).padStart(2, '0')}.`);
  }

  const summaries = runs
    .map((r) => r.summary!)
    .slice(0, MAX_INPUT_SUMMARIES);

  const totalChars = summaries.reduce((sum, s) => sum + s.length, 0);
  if (totalChars > MAX_INPUT_CHARS) {
    logger.warn('Monthly summary input truncated', { totalChars, maxChars: MAX_INPUT_CHARS, summaryCount: summaries.length });
  }

  const aiFilter = createAIFilter(config);
  const monthlySummary = await aiFilter.synthesizeMonthlySummary(summaries, year, month);

  if (!monthlySummary) {
    throw new Error(`L'IA n'a pas pu générer de résumé mensuel pour ${year}-${String(month).padStart(2, '0')}.`);
  }

  const runIds = runs.map((r) => r.id);
  const db = getDb();

  db.prepare(
    `INSERT INTO monthly_summaries (year, month, summary, source_run_ids, generated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(year, month) DO UPDATE SET
       summary = excluded.summary,
       source_run_ids = excluded.source_run_ids,
       generated_at = excluded.generated_at`
  ).run(year, month, monthlySummary, JSON.stringify(runIds));

  logger.info('Monthly summary generated', { year, month, sourceRuns: runIds.length });

  return getMonthlySummary(year, month)!;
}

export function getMonthlySummary(year: number, month: number): MonthlySummaryRecord | undefined {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM monthly_summaries WHERE year = ? AND month = ?'
  ).get(year, month) as MonthlySummaryRecord | undefined;
}

export function listMonthlySummaries(limit = 12): MonthlySummaryRecord[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM monthly_summaries ORDER BY year DESC, month DESC LIMIT ?'
  ).all(limit) as MonthlySummaryRecord[];
}

export function getAvailableMonths(): { year: number; month: number; run_count: number }[] {
  const db = getDb();
  return db.prepare(
    `SELECT
       CAST(strftime('%Y', started_at) AS INTEGER) as year,
       CAST(strftime('%m', started_at) AS INTEGER) as month,
       COUNT(*) as run_count
     FROM runs
     WHERE status = 'success' AND summary IS NOT NULL
     GROUP BY strftime('%Y-%m', started_at)
     ORDER BY year DESC, month DESC`
  ).all() as { year: number; month: number; run_count: number }[];
}
