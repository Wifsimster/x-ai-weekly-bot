import { tryLoadConfigWithOverrides, loadBootConfig } from './config.js';
import { logger } from './logger.js';
import { getSettingsMap } from './settings-service.js';
import { startServer } from './server.js';
import { getDb } from './db.js';
import { schedulePublishCron, scheduleCollectCron } from './cron-manager.js';
import type { Config } from './config.js';

// Always initialize database and boot the web server
getDb();

const bootConfig = loadBootConfig();
const dbOverrides = getSettingsMap();
const configResult = tryLoadConfigWithOverrides(dbOverrides);

// Start web server — always, even if config is incomplete
startServer(
  configResult.success ? configResult.config : null,
  configResult.success ? null : configResult.missing,
  bootConfig.CRON_SCHEDULE,
  bootConfig.WEB_PORT,
);

if (configResult.success) {
  const config = configResult.config;
  const publishSchedule = config.CRON_SCHEDULE;
  const collectSchedule = config.COLLECT_CRON_SCHEDULE;

  logger.info('X AI Daily Bot scheduler started', {
    username: config.X_USERNAME,
    publishCron: publishSchedule,
    collectCron: collectSchedule,
    dryRun: config.DRY_RUN,
    webPort: bootConfig.WEB_PORT,
  });

  // Schedule both cron tasks via the manager (supports hot-reload)
  schedulePublishCron(publishSchedule, config, buildMergedConfig);
  scheduleCollectCron(collectSchedule, config, buildMergedConfig);
} else {
  logger.warn('X AI Daily Bot started in setup mode — missing credentials', {
    missing: configResult.missing.map((m) => m.key),
    webPort: bootConfig.WEB_PORT,
  });
}

export function buildMergedConfig(baseConfig: Config, overrides: Record<string, string>): Config {
  return {
    ...baseConfig,
    ...(overrides.AI_MODEL && { AI_MODEL: overrides.AI_MODEL }),
    ...(overrides.TWEETS_LOOKBACK_DAYS && {
      TWEETS_LOOKBACK_DAYS: Number(overrides.TWEETS_LOOKBACK_DAYS),
    }),
    ...(overrides.DRY_RUN !== undefined && {
      DRY_RUN: overrides.DRY_RUN === 'true' || overrides.DRY_RUN === '1',
    }),
    ...(overrides.X_SESSION_AUTH_TOKEN && { X_SESSION_AUTH_TOKEN: overrides.X_SESSION_AUTH_TOKEN }),
    ...(overrides.X_SESSION_CSRF_TOKEN && { X_SESSION_CSRF_TOKEN: overrides.X_SESSION_CSRF_TOKEN }),
    ...(overrides.X_GQL_USER_BY_SCREEN_NAME_ID && {
      X_GQL_USER_BY_SCREEN_NAME_ID: overrides.X_GQL_USER_BY_SCREEN_NAME_ID,
    }),
    ...(overrides.X_GQL_HOME_TIMELINE_ID && {
      X_GQL_HOME_TIMELINE_ID: overrides.X_GQL_HOME_TIMELINE_ID,
    }),
    ...(overrides.DISCORD_WEBHOOK_URL && {
      DISCORD_WEBHOOK_URL: overrides.DISCORD_WEBHOOK_URL,
    }),
    ...(overrides.COLLECT_CRON_SCHEDULE && {
      COLLECT_CRON_SCHEDULE: overrides.COLLECT_CRON_SCHEDULE,
    }),
  };
}
