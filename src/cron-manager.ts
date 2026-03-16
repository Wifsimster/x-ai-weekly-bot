import cron, { type ScheduledTask } from 'node-cron';
import { logger } from './logger.js';
import { triggerRun } from './run-service.js';
import { getSettingsMap } from './settings-service.js';
import type { Config } from './config.js';

let currentTask: ScheduledTask | null = null;
let currentSchedule = '';

export function getCurrentSchedule(): string {
  return currentSchedule;
}

export function scheduleCron(
  schedule: string,
  baseConfig: Config,
  buildMergedConfig: (base: Config, overrides: Record<string, string>) => Config,
): boolean {
  if (!cron.validate(schedule)) {
    logger.error('Invalid cron expression, not scheduling', { schedule });
    return false;
  }

  // Stop previous task if any
  if (currentTask) {
    currentTask.stop();
    logger.info('Previous cron task stopped', { previous: currentSchedule });
  }

  currentSchedule = schedule;

  currentTask = cron.schedule(
    schedule,
    async () => {
      logger.info('Cron triggered — starting daily summary');
      try {
        const overrides = getSettingsMap();
        const mergedConfig = buildMergedConfig(baseConfig, overrides);
        await triggerRun(mergedConfig, 'cron');
      } catch (err) {
        logger.error('Daily summary failed', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    },
    { timezone: 'Europe/Paris' },
  );

  logger.info('Cron task scheduled', { schedule });
  return true;
}

export function reschedule(
  newSchedule: string,
  baseConfig: Config,
  buildMergedConfig: (base: Config, overrides: Record<string, string>) => Config,
): boolean {
  if (!cron.validate(newSchedule)) {
    return false;
  }
  return scheduleCron(newSchedule, baseConfig, buildMergedConfig);
}
