import cron from 'node-cron';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { triggerRun } from './run-service.js';
import { getSettingsMap } from './settings-service.js';
import { startServer } from './server.js';
import { getDb } from './db.js';

const config = loadConfig();
const cronSchedule = config.CRON_SCHEDULE;

// Initialize database
getDb();

// Start back-office web server
startServer(config, cronSchedule, config.WEB_PORT);

logger.info('X AI Weekly Bot scheduler started', {
  username: config.X_USERNAME,
  cron: cronSchedule,
  dryRun: config.DRY_RUN,
  webPort: config.WEB_PORT,
});

// Scheduled run
cron.schedule(
  cronSchedule,
  async () => {
    logger.info('Cron triggered — starting weekly summary');
    try {
      // Merge settings overrides
      const overrides = getSettingsMap();
      const mergedConfig = {
        ...config,
        ...(overrides.CLAUDE_MODEL && { CLAUDE_MODEL: overrides.CLAUDE_MODEL }),
        ...(overrides.TWEETS_LOOKBACK_DAYS && { TWEETS_LOOKBACK_DAYS: Number(overrides.TWEETS_LOOKBACK_DAYS) }),
        ...(overrides.MAX_TWEETS && { MAX_TWEETS: Number(overrides.MAX_TWEETS) }),
        ...(overrides.DRY_RUN !== undefined && { DRY_RUN: overrides.DRY_RUN === 'true' || overrides.DRY_RUN === '1' }),
      };
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
