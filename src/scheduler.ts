import cron from 'node-cron';
import { tryLoadConfigWithOverrides, loadBootConfig } from './config.js';
import { logger } from './logger.js';
import { triggerRun } from './run-service.js';
import { getSettingsMap } from './settings-service.js';
import { startServer } from './server.js';
import { getDb } from './db.js';
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
  const cronSchedule = config.CRON_SCHEDULE;

  logger.info('X AI Weekly Bot scheduler started', {
    username: config.X_USERNAME,
    cron: cronSchedule,
    dryRun: config.DRY_RUN,
    webPort: bootConfig.WEB_PORT,
  });

  // Scheduled run
  cron.schedule(
    cronSchedule,
    async () => {
      logger.info('Cron triggered — starting weekly summary');
      try {
        const overrides = getSettingsMap();
        const mergedConfig = buildMergedConfig(config, overrides);
        await triggerRun(mergedConfig, 'cron');
      } catch (err) {
        logger.error('Weekly summary failed', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    },
    { timezone: 'UTC' },
  );
} else {
  logger.warn('X AI Weekly Bot started in setup mode — missing credentials', {
    missing: configResult.missing.map((m) => m.key),
    webPort: bootConfig.WEB_PORT,
  });
}

function buildMergedConfig(baseConfig: Config, overrides: Record<string, string>): Config {
  return {
    ...baseConfig,
    ...(overrides.AI_MODEL && { AI_MODEL: overrides.AI_MODEL }),
    ...(overrides.TWEETS_LOOKBACK_DAYS && { TWEETS_LOOKBACK_DAYS: Number(overrides.TWEETS_LOOKBACK_DAYS) }),
    ...(overrides.MAX_TWEETS && { MAX_TWEETS: Number(overrides.MAX_TWEETS) }),
    ...(overrides.DRY_RUN !== undefined && { DRY_RUN: overrides.DRY_RUN === 'true' || overrides.DRY_RUN === '1' }),
    ...(overrides.X_SESSION_AUTH_TOKEN && { X_SESSION_AUTH_TOKEN: overrides.X_SESSION_AUTH_TOKEN }),
    ...(overrides.X_SESSION_CSRF_TOKEN && { X_SESSION_CSRF_TOKEN: overrides.X_SESSION_CSRF_TOKEN }),
    ...(overrides.X_GQL_USER_BY_SCREEN_NAME_ID && { X_GQL_USER_BY_SCREEN_NAME_ID: overrides.X_GQL_USER_BY_SCREEN_NAME_ID }),
    ...(overrides.X_GQL_HOME_TIMELINE_ID && { X_GQL_HOME_TIMELINE_ID: overrides.X_GQL_HOME_TIMELINE_ID }),
  };
}
