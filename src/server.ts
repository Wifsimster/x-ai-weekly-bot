import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { serve } from '@hono/node-server';
import { logger } from './logger.js';
import { getRunHistory, getLastRun, isRunning, triggerRun } from './run-service.js';
import { getSettings, setSetting, isEditableKey, isCredentialKey, getSettingsMap, getSetting, maskCredential } from './settings-service.js';
import { layout, dashboardPage, runsPage, settingsPage, setupPage, setupLayout } from './web/templates.js';
import { REQUIRED_CREDENTIALS, type Config } from './config.js';
import { validateXCookies } from './adapters/scraper-reader.js';

interface MissingCredential {
  key: string;
  label: string;
  docUrl: string;
  message: string;
}

export function startServer(
  config: Config | null,
  missingCredentials: MissingCredential[] | null,
  cronSchedule: string,
  port = 3000,
) {
  const app = new Hono();
  const isConfigured = config !== null;

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
  app.get('/healthz', (c) => {
    if (isConfigured) {
      return c.json({ status: 'ok' });
    }
    return c.json({
      status: 'unconfigured',
      missing: (missingCredentials || []).map((m) => m.key),
    }, 503);
  });

  // Setup page — shown when config is incomplete
  app.get('/setup', (c) => {
    if (isConfigured) {
      return c.redirect('/');
    }
    const credentials = REQUIRED_CREDENTIALS.map((cred) => ({
      ...cred,
      configured: !!process.env[cred.key] || !!getSetting(cred.key),
    }));
    const content = setupPage(credentials);
    return c.html(setupLayout('Configuration requise', content));
  });

  if (!isConfigured) {
    // In setup mode — redirect all main routes to /setup
    app.get('/', (c) => c.redirect('/setup'));
    app.get('/runs', (c) => c.redirect('/setup'));
    app.get('/settings', (c) => c.redirect('/setup'));
    app.post('/settings', (c) => c.redirect('/setup'));
    app.post('/settings/credentials', (c) => c.redirect('/setup'));
    app.post('/api/trigger', (c) =>
      c.html('<div class="flash flash-error">Configuration incomplète. Configurez les variables d\'environnement requises.</div>')
    );
    app.get('/api/status', (c) =>
      c.json({ running: false, configured: false, missing: (missingCredentials || []).map((m) => m.key) })
    );
    app.get('/api/runs', (c) => c.json([]));
    app.get('/api/settings', (c) => c.json([]));
  } else {
    // Normal operational mode
    // Dashboard
    app.get('/', (c) => {
      const lastRun = getLastRun();
      const totalRuns = getRunHistory(1000).length;
      const cookiesExpired = lastRun?.error_message?.includes('401') || lastRun?.error_message?.includes('403') || lastRun?.error_message?.includes('Session cookies') || false;
      const content = dashboardPage(lastRun, cronSchedule, isRunning(), totalRuns, cookiesExpired);
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
        AI_MODEL: config.AI_MODEL,
        TWEETS_LOOKBACK_DAYS: String(config.TWEETS_LOOKBACK_DAYS),
        MAX_TWEETS: String(config.MAX_TWEETS),
        DRY_RUN: String(config.DRY_RUN),
        CRON_SCHEDULE: cronSchedule,
      };
      const authToken = getSetting('X_SESSION_AUTH_TOKEN') ?? config.X_SESSION_AUTH_TOKEN ?? '';
      const csrfToken = getSetting('X_SESSION_CSRF_TOKEN') ?? config.X_SESSION_CSRF_TOKEN ?? '';
      const credentialInfo = {
        authTokenMasked: authToken ? maskCredential(authToken) : '',
        csrfTokenMasked: csrfToken ? maskCredential(csrfToken) : '',
        hasAuth: !!process.env.ADMIN_PASSWORD,
      };
      const content = settingsPage(settings, envDefaults, undefined, credentialInfo);
      return c.html(layout('Paramètres', content, '/settings'));
    });

    // Settings form POST (tuning parameters)
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
        AI_MODEL: config.AI_MODEL,
        TWEETS_LOOKBACK_DAYS: String(config.TWEETS_LOOKBACK_DAYS),
        MAX_TWEETS: String(config.MAX_TWEETS),
        DRY_RUN: String(config.DRY_RUN),
        CRON_SCHEDULE: cronSchedule,
      };
      const authToken = getSetting('X_SESSION_AUTH_TOKEN') ?? config.X_SESSION_AUTH_TOKEN ?? '';
      const csrfToken = getSetting('X_SESSION_CSRF_TOKEN') ?? config.X_SESSION_CSRF_TOKEN ?? '';
      const credentialInfo = {
        authTokenMasked: authToken ? maskCredential(authToken) : '',
        csrfTokenMasked: csrfToken ? maskCredential(csrfToken) : '',
        hasAuth: !!process.env.ADMIN_PASSWORD,
      };
      const content = settingsPage(settings, envDefaults, {
        type: 'success',
        message: `${updated} paramètre(s) mis à jour. Les changements seront appliqués au prochain run.`,
      }, credentialInfo);
      return c.html(layout('Paramètres', content, '/settings'));
    });

    // Credentials form POST (session cookies — validate then save)
    app.post('/settings/credentials', async (c) => {
      const body = await c.req.parseBody();
      const authToken = typeof body.X_SESSION_AUTH_TOKEN === 'string' ? body.X_SESSION_AUTH_TOKEN.trim() : '';
      const csrfToken = typeof body.X_SESSION_CSRF_TOKEN === 'string' ? body.X_SESSION_CSRF_TOKEN.trim() : '';

      const settings = getSettings();
      const envDefaults: Record<string, string> = {
        AI_MODEL: config.AI_MODEL,
        TWEETS_LOOKBACK_DAYS: String(config.TWEETS_LOOKBACK_DAYS),
        MAX_TWEETS: String(config.MAX_TWEETS),
        DRY_RUN: String(config.DRY_RUN),
        CRON_SCHEDULE: cronSchedule,
      };

      if (!authToken || !csrfToken) {
        const credentialInfo = {
          authTokenMasked: authToken || (getSetting('X_SESSION_AUTH_TOKEN') ? maskCredential(getSetting('X_SESSION_AUTH_TOKEN')!) : ''),
          csrfTokenMasked: csrfToken || (getSetting('X_SESSION_CSRF_TOKEN') ? maskCredential(getSetting('X_SESSION_CSRF_TOKEN')!) : ''),
          hasAuth: !!process.env.ADMIN_PASSWORD,
        };
        const content = settingsPage(settings, envDefaults, {
          type: 'error',
          message: 'Les deux champs (auth_token et ct0) sont requis.',
        }, credentialInfo);
        return c.html(layout('Paramètres', content, '/settings'));
      }

      // Validate cookies against X API
      const validation = await validateXCookies(
        authToken,
        csrfToken,
        config.X_USERNAME,
        config.X_GQL_USER_BY_SCREEN_NAME_ID,
      );

      if (!validation.valid) {
        const credentialInfo = {
          authTokenMasked: getSetting('X_SESSION_AUTH_TOKEN') ? maskCredential(getSetting('X_SESSION_AUTH_TOKEN')!) : '',
          csrfTokenMasked: getSetting('X_SESSION_CSRF_TOKEN') ? maskCredential(getSetting('X_SESSION_CSRF_TOKEN')!) : '',
          hasAuth: !!process.env.ADMIN_PASSWORD,
        };
        const content = settingsPage(settings, envDefaults, {
          type: 'error',
          message: `Cookies invalides : ${validation.error}. Vérifiez les valeurs et réessayez.`,
        }, credentialInfo);
        return c.html(layout('Paramètres', content, '/settings'));
      }

      // Save validated cookies
      setSetting('X_SESSION_AUTH_TOKEN', authToken);
      setSetting('X_SESSION_CSRF_TOKEN', csrfToken);

      const credentialInfo = {
        authTokenMasked: maskCredential(authToken),
        csrfTokenMasked: maskCredential(csrfToken),
        hasAuth: !!process.env.ADMIN_PASSWORD,
      };
      const content = settingsPage(settings, envDefaults, {
        type: 'success',
        message: 'Cookies de session mis à jour et validés avec succès. Les prochains runs utiliseront ces valeurs.',
      }, credentialInfo);
      return c.html(layout('Paramètres', content, '/settings'));
    });

    // Manual trigger (htmx)
    app.post('/api/trigger', async (c) => {
      if (isRunning()) {
        return c.html('<div class="flash flash-error">Un run est déjà en cours.</div>');
      }

      const overrides = getSettingsMap();
      const mergedConfig = buildMergedConfig(config, overrides);

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
        configured: true,
        lastRun,
        cronSchedule,
      });
    });

    app.get('/api/runs', (c) => {
      const limit = Number(c.req.query('limit') || '20');
      return c.json(getRunHistory(limit));
    });

    app.get('/api/settings', (c) => {
      // Mask credential values in API response
      const settings = getSettings().map((s) =>
        isCredentialKey(s.key) ? { ...s, value: maskCredential(s.value) } : s
      );
      return c.json(settings);
    });
  }

  // Error handler
  app.onError((err, c) => {
    logger.error('HTTP error', { error: err.message, path: c.req.path });
    return c.text('Internal Server Error', 500);
  });

  serve({ fetch: app.fetch, port }, () => {
    logger.info('Back-office server started', {
      port,
      auth: !!process.env.ADMIN_PASSWORD,
      mode: isConfigured ? 'operational' : 'setup',
    });
  });

  return app;
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
  };
}
