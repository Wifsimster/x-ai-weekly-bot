import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';
import { getRunHistory, getLastRun, isRunning, triggerRun } from './run-service.js';
import { getSettings, setSetting, isEditableKey, isCredentialKey, getSettingsMap, getSetting, maskCredential } from './settings-service.js';
import { REQUIRED_CREDENTIALS, type Config } from './config.js';
import { validateXCookies, detectGqlIds, DEFAULT_GQL_IDS } from './adapters/scraper-reader.js';

interface MissingCredential {
  key: string;
  label: string;
  docUrl: string;
  message: string;
}

function buildCredentialInfo(config: Config) {
  const authToken = getSetting('X_SESSION_AUTH_TOKEN') ?? config.X_SESSION_AUTH_TOKEN ?? '';
  const csrfToken = getSetting('X_SESSION_CSRF_TOKEN') ?? config.X_SESSION_CSRF_TOKEN ?? '';
  return {
    authTokenMasked: authToken ? maskCredential(authToken) : '',
    csrfTokenMasked: csrfToken ? maskCredential(csrfToken) : '',
    hasAuth: !!process.env.ADMIN_PASSWORD,
  };
}

function buildEnvDefaults(config: Config, cronSchedule: string) {
  return {
    AI_MODEL: config.AI_MODEL,
    TWEETS_LOOKBACK_DAYS: String(config.TWEETS_LOOKBACK_DAYS),
    MAX_TWEETS: String(config.MAX_TWEETS),
    DRY_RUN: String(config.DRY_RUN),
    CRON_SCHEDULE: cronSchedule,
    X_GQL_USER_BY_SCREEN_NAME_ID: config.X_GQL_USER_BY_SCREEN_NAME_ID || DEFAULT_GQL_IDS.UserByScreenName,
    X_GQL_USER_TWEETS_ID: config.X_GQL_USER_TWEETS_ID || DEFAULT_GQL_IDS.UserTweets,
  };
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

  // --- API endpoints (JSON only) ---

  app.get('/api/version', (c) => {
    return c.json({
      version: process.env.APP_VERSION || 'dev',
      buildDate: process.env.APP_BUILD_DATE || null,
    });
  });

  // Setup status
  app.get('/api/setup', (c) => {
    const credentials = REQUIRED_CREDENTIALS.map((cred) => ({
      ...cred,
      configured: !!process.env[cred.key] || !!getSetting(cred.key),
    }));
    return c.json({ configured: isConfigured, credentials });
  });

  if (!isConfigured) {
    // In setup mode — limited API
    app.post('/api/trigger', (c) =>
      c.json({ success: false, message: 'Configuration incomplète. Configurez les variables d\'environnement requises.' })
    );
    app.get('/api/status', (c) =>
      c.json({ running: false, configured: false, missing: (missingCredentials || []).map((m) => m.key), cronSchedule, totalRuns: 0 })
    );
    app.get('/api/runs', (c) => c.json([]));
    app.get('/api/settings', (c) => c.json([]));
    app.get('/api/config', (c) => c.json({ envDefaults: {}, credentialInfo: { authTokenMasked: '', csrfTokenMasked: '', hasAuth: false } }));
  } else {
    // Normal operational mode — full API

    app.get('/api/status', (c) => {
      const lastRun = getLastRun();
      const totalRuns = getRunHistory(1000).length;
      return c.json({
        running: isRunning(),
        configured: true,
        lastRun,
        cronSchedule,
        totalRuns,
      });
    });

    app.get('/api/runs', (c) => {
      const limit = Number(c.req.query('limit') || '20');
      return c.json(getRunHistory(limit));
    });

    app.get('/api/settings', (c) => {
      const settings = getSettings().map((s) =>
        isCredentialKey(s.key) ? { ...s, value: maskCredential(s.value) } : s
      );
      return c.json(settings);
    });

    app.get('/api/config', (c) => {
      return c.json({
        envDefaults: buildEnvDefaults(config, cronSchedule),
        credentialInfo: buildCredentialInfo(config),
      });
    });

    app.post('/api/settings', async (c) => {
      const body = await c.req.json();
      let updated = 0;

      for (const [key, value] of Object.entries(body)) {
        if (isEditableKey(key) && typeof value === 'string') {
          setSetting(key, value);
          updated++;
        }
      }

      return c.json({
        success: true,
        message: `${updated} paramètre(s) mis à jour. Les changements seront appliqués au prochain run.`,
      });
    });

    app.post('/api/credentials', async (c) => {
      const body = await c.req.json();
      const authToken = typeof body.X_SESSION_AUTH_TOKEN === 'string' ? body.X_SESSION_AUTH_TOKEN.trim() : '';
      const csrfToken = typeof body.X_SESSION_CSRF_TOKEN === 'string' ? body.X_SESSION_CSRF_TOKEN.trim() : '';

      if (!authToken || !csrfToken) {
        return c.json({
          success: false,
          message: 'Les deux champs (auth_token et ct0) sont requis.',
        });
      }

      const validation = await validateXCookies(
        authToken,
        csrfToken,
        config.X_USERNAME,
        config.X_GQL_USER_BY_SCREEN_NAME_ID,
      );

      if (!validation.valid) {
        return c.json({
          success: false,
          message: `Cookies invalides : ${validation.error}. Vérifiez les valeurs et réessayez.`,
        });
      }

      setSetting('X_SESSION_AUTH_TOKEN', authToken);
      setSetting('X_SESSION_CSRF_TOKEN', csrfToken);

      return c.json({
        success: true,
        message: 'Cookies de session mis à jour et validés avec succès. Les prochains runs utiliseront ces valeurs.',
      });
    });

    app.post('/api/detect-gql-ids', async (c) => {
      try {
        const ids = await detectGqlIds();
        const saved: Record<string, string> = {};
        if (ids.UserByScreenName) {
          setSetting('X_GQL_USER_BY_SCREEN_NAME_ID', ids.UserByScreenName);
          saved.UserByScreenName = ids.UserByScreenName;
        }
        if (ids.UserTweets) {
          setSetting('X_GQL_USER_TWEETS_ID', ids.UserTweets);
          saved.UserTweets = ids.UserTweets;
        }
        if (Object.keys(saved).length === 0) {
          return c.json({ success: false, message: 'Aucun ID GraphQL trouvé dans les bundles JS de x.com.' });
        }
        return c.json({ success: true, message: 'IDs GraphQL détectés et sauvegardés.', ids: saved });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return c.json({ success: false, message: `Erreur de détection : ${msg}` });
      }
    });

    app.post('/api/trigger', async (c) => {
      if (isRunning()) {
        return c.json({ success: false, message: 'Un run est déjà en cours.' });
      }

      const overrides = getSettingsMap();
      const mergedConfig = buildMergedConfig(config, overrides);

      triggerRun(mergedConfig, 'manual').catch((err) => {
        logger.error('Manual trigger failed', { error: err instanceof Error ? err.message : String(err) });
      });

      return c.json({ success: true, message: 'Run lancé ! La page se rafraîchira automatiquement.' });
    });
  }

  // --- Serve React SPA static files ---
  app.use('/*', serveStatic({ root: './dist/frontend' }));

  // SPA fallback — serve index.html for all non-API routes
  app.get('*', async (c) => {
    try {
      const indexPath = path.join(process.cwd(), 'dist', 'frontend', 'index.html');
      const html = await readFile(indexPath, 'utf-8');
      return c.html(html);
    } catch {
      return c.text('Frontend not built. Run npm run build:frontend', 500);
    }
  });

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
    ...(overrides.X_GQL_USER_BY_SCREEN_NAME_ID && { X_GQL_USER_BY_SCREEN_NAME_ID: overrides.X_GQL_USER_BY_SCREEN_NAME_ID }),
    ...(overrides.X_GQL_USER_TWEETS_ID && { X_GQL_USER_TWEETS_ID: overrides.X_GQL_USER_TWEETS_ID }),
  };
}
