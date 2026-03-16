import cron from 'node-cron';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { run } from './index.js';

const config = loadConfig();

logger.info('X AI Weekly Bot scheduler started', {
  username: config.X_USERNAME,
  cron: '0 18 * * 0',
  dryRun: config.DRY_RUN,
});

// Run every Sunday at 18:00 UTC
cron.schedule(
  '0 18 * * 0',
  async () => {
    logger.info('Cron triggered — starting weekly summary');
    try {
      await run(config);
    } catch (err) {
      logger.error('Weekly summary failed', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  },
  { timezone: 'UTC' },
);
