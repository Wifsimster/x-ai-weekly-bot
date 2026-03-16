import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { serve } from '@hono/node-server';
import { logger } from './logger.js';
import { getRunHistory, getLastRun, isRunning, triggerRun } from './run-service.js';
import { getSettings, setSetting, isEditableKey, getSettingsMap } from './settings-service.js';
import { layout, dashboardPage, runsPage, settingsPage } from './web/templates.js';
import type { Config } from './config.js';

export function startServer(config: Config, cronSchedule: string, port = 3000) {
  const app = new Hono();

  // Basic auth if ADMIN_PASSWORD is set
  if (process.env.ADMIN_PASSWORD) {
    app.use(
      '*',
      basicAuth({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD,
      })
    );
  }

  // Health check (no auth)
  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  // Dashboard
  app.get('/', (c) => {
    const lastRun = getLastRun();
    const totalRuns = getRunHistory(1000).length;
    const content = dashboardPage(lastRun, cronSchedule, isRunning(), totalRuns);
    return c.html(layout('Dashboard', content, '/'));
  });

  // Run history
  app.get('/runs', (c) => {
    const runs = getRunHistory(50);
    const content = runsPage(runs);
    return c.html(layout('Historique', content, '/runs'));
  });

  // Settings page
  app.get('/settings', (c) => {
    const settings = getSettings();
    const envDefaults: Record<string, string> = {
      CLAUDE_MODEL: config.CLAUDE_MODEL,
      TWEETS_LOOKBACK_DAYS: String(config.TWEETS_LOOKBACK_DAYS),
      MAX_TWEETS: String(config.MAX_TWEETS),
      DRY_RUN: String(config.DRY_RUN),
      CRON_SCHEDULE: cronSchedule,
    };
    const content = settingsPage(settings, envDefaults);
    return c.html(layout('Paramètres', content, '/settings'));
  });

  // Settings form POST
  app.post('/settings', async (c) => {
    const body = await c.req.parseBody();
    let updated = 0;

    for (const [key, value] of Object.entries(body)) {
      if (isEditableKey(key) && typeof value === 'string') {
        setSetting(key, value);
        updated++;
      }
    }

    const settings = getSettings();
    const envDefaults: Record<string, string> = {
      CLAUDE_MODEL: config.CLAUDE_MODEL,
      TWEETS_LOOKBACK_DAYS: String(config.TWEETS_LOOKBACK_DAYS),
      MAX_TWEETS: String(config.MAX_TWEETS),
      DRY_RUN: String(config.DRY_RUN),
      CRON_SCHEDULE: cronSchedule,
    };
    const content = settingsPage(settings, envDefaults, {
      type: 'success',
      message: `${updated} paramètre(s) mis à jour. Les changements seront appliqués au prochain run.`,
    });
    return c.html(layout('Paramètres', content, '/settings'));
  });

  // Manual trigger (htmx)
  app.post('/api/trigger', async (c) => {
    if (isRunning()) {
      return c.html('<div class="flash flash-error">Un run est déjà en cours.</div>');
    }

    // Build config with settings overrides
    const overrides = getSettingsMap();
    const mergedConfig = buildMergedConfig(config, overrides);

    // Fire and forget — respond immediately
    triggerRun(mergedConfig, 'manual').catch((err) => {
      logger.error('Manual trigger failed', { error: err instanceof Error ? err.message : String(err) });
    });

    return c.html('<div class="flash flash-success">Run lancé ! Rafraîchissez la page pour suivre la progression.</div>');
  });

  // API endpoints
  app.get('/api/status', (c) => {
    const lastRun = getLastRun();
    return c.json({
      running: isRunning(),
      lastRun,
      cronSchedule,
    });
  });

  app.get('/api/runs', (c) => {
    const limit = Number(c.req.query('limit') || '20');
    return c.json(getRunHistory(limit));
  });

  app.get('/api/settings', (c) => {
    return c.json(getSettings());
  });

  // Error handler
  app.onError((err, c) => {
    logger.error('HTTP error', { error: err.message, path: c.req.path });
    return c.text('Internal Server Error', 500);
  });

  serve({ fetch: app.fetch, port }, () => {
    logger.info('Back-office server started', { port, auth: !!process.env.ADMIN_PASSWORD });
  });

  return app;
}

function buildMergedConfig(baseConfig: Config, overrides: Record<string, string>): Config {
  return {
    ...baseConfig,
    ...(overrides.CLAUDE_MODEL && { CLAUDE_MODEL: overrides.CLAUDE_MODEL }),
    ...(overrides.TWEETS_LOOKBACK_DAYS && { TWEETS_LOOKBACK_DAYS: Number(overrides.TWEETS_LOOKBACK_DAYS) }),
    ...(overrides.MAX_TWEETS && { MAX_TWEETS: Number(overrides.MAX_TWEETS) }),
    ...(overrides.DRY_RUN !== undefined && { DRY_RUN: overrides.DRY_RUN === 'true' || overrides.DRY_RUN === '1' }),
  };
}
