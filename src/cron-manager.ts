import cron, { type ScheduledTask } from 'node-cron';
import { logger } from './logger.js';
import { triggerRun, triggerCollect } from './run-service.js';
import { getSettingsMap } from './settings-service.js';
import type { Config } from './config.js';

const tasks = new Map<string, ScheduledTask>();
const schedules = new Map<string, string>();

export function getSchedule(name: string): string {
  return schedules.get(name) || '';
}

export function getCurrentSchedule(): string {
  return getSchedule('publish');
}

export function getCollectSchedule(): string {
  return getSchedule('collect');
}

export function schedulePublishCron(
  schedule: string,
  baseConfig: Config,
  buildMergedConfig: (base: Config, overrides: Record<string, string>) => Config,
): boolean {
  return scheduleNamedCron('publish', schedule, async () => {
    logger.info('Cron triggered — starting daily summary (publish)');
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
  });
}

export function scheduleCollectCron(
  schedule: string,
  baseConfig: Config,
  buildMergedConfig: (base: Config, overrides: Record<string, string>) => Config,
): boolean {
  return scheduleNamedCron('collect', schedule, async () => {
    logger.info('Cron triggered — starting tweet collection');
    try {
      const overrides = getSettingsMap();
      const mergedConfig = buildMergedConfig(baseConfig, overrides);
      await triggerCollect(mergedConfig);
    } catch (err) {
      logger.error('Tweet collection failed', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  });
}

function scheduleNamedCron(
  name: string,
  schedule: string,
  handler: () => Promise<void>,
): boolean {
  if (!cron.validate(schedule)) {
    logger.error('Invalid cron expression, not scheduling', { name, schedule });
    return false;
  }

  const existing = tasks.get(name);
  if (existing) {
    existing.stop();
    logger.info('Previous cron task stopped', { name, previous: schedules.get(name) });
  }

  schedules.set(name, schedule);
  tasks.set(name, cron.schedule(schedule, handler, { timezone: 'Europe/Paris' }));

  logger.info('Cron task scheduled', { name, schedule });
  return true;
}

// Backward-compatible: scheduleCron still schedules the publish task
export function scheduleCron(
  schedule: string,
  baseConfig: Config,
  buildMergedConfig: (base: Config, overrides: Record<string, string>) => Config,
): boolean {
  return schedulePublishCron(schedule, baseConfig, buildMergedConfig);
}

export function reschedule(
  newSchedule: string,
  baseConfig: Config,
  buildMergedConfig: (base: Config, overrides: Record<string, string>) => Config,
): boolean {
  if (!cron.validate(newSchedule)) {
    return false;
  }
  return schedulePublishCron(newSchedule, baseConfig, buildMergedConfig);
}

export function stopAll(): void {
  for (const [name, task] of tasks) {
    task.stop();
    logger.info('Cron task stopped', { name });
  }
  tasks.clear();
}

export function rescheduleCollect(
  newSchedule: string,
  baseConfig: Config,
  buildMergedConfig: (base: Config, overrides: Record<string, string>) => Config,
): boolean {
  if (!cron.validate(newSchedule)) {
    return false;
  }
  return scheduleCollectCron(newSchedule, baseConfig, buildMergedConfig);
}
