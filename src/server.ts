import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import cron from 'node-cron';
import { logger } from './logger.js';
import {
  getRunHistory,
  getLastRun,
  isRunning,
  isCollecting,
  triggerRun,
  triggerCollect,
  getSuccessfulSummaries,
  countSuccessfulSummaries,
  getSuccessfulRunsByMonth,
  getRunById,
  updateNotificationStatus,
  deleteSummary,
  triggerRerun,
  countRuns,
} from './run-service.js';
import {
  generateMonthlySummary,
  getMonthlySummary,
  listMonthlySummaries,
  getAvailableMonths,
} from './monthly-summary-service.js';
import {
  getSettings,
  setSetting,
  deleteSetting,
  isEditableKey,
  isCredentialKey,
  getSettingsMap,
  getSetting,
  maskCredential,
} from './settings-service.js';
import { REQUIRED_CREDENTIALS, type Config } from './config.js';
import { countUnpublishedTweets, countTweetsForDate, getTweetsByRunId } from './tweet-store.js';
import { getTodayDateParis } from './date-utils.js';
import { validateXCookies, detectGqlIds, DEFAULT_GQL_IDS } from './adapters/scraper-reader.js';
import { testDiscordWebhook, sendDiscordNotification } from './adapters/discord-notifier.js';
import { reschedule, rescheduleCollect, getCurrentSchedule, getCollectSchedule } from './cron-manager.js';
import { buildMergedConfig } from './scheduler.js';

interface MissingCredential {
  key: string;
  label: string;
  docUrl: string;
  message: string;
}

function buildCredentialInfo(config: Config) {
  const authToken = getSetting('X_SESSION_AUTH_TOKEN') ?? config.X_SESSION_AUTH_TOKEN ?? '';
  const csrfToken = getSetting('X_SESSION_CSRF_TOKEN') ?? config.X_SESSION_CSRF_TOKEN ?? '';
  const discordWebhook = getSetting('DISCORD_WEBHOOK_URL') ?? config.DISCORD_WEBHOOK_URL ?? '';
  return {
    authTokenMasked: authToken ? maskCredential(authToken) : '',
    csrfTokenMasked: csrfToken ? maskCredential(csrfToken) : '',
    discordWebhookMasked: discordWebhook ? maskCredential(discordWebhook) : '',
    hasAuth: !!process.env.ADMIN_PASSWORD,
  };
}

function buildEnvDefaults(config: Config, cronSchedule: string) {
  const activeCron = getCurrentSchedule() || getSetting('CRON_SCHEDULE') || cronSchedule;
  const activeCollectCron = getCollectSchedule() || getSetting('COLLECT_CRON_SCHEDULE') || config.COLLECT_CRON_SCHEDULE;
  return {
    AI_MODEL: config.AI_MODEL,
    TWEETS_LOOKBACK_DAYS: String(config.TWEETS_LOOKBACK_DAYS),
    DRY_RUN: String(config.DRY_RUN),
    CRON_SCHEDULE: activeCron,
    COLLECT_CRON_SCHEDULE: activeCollectCron,
    X_GQL_USER_BY_SCREEN_NAME_ID:
      config.X_GQL_USER_BY_SCREEN_NAME_ID || DEFAULT_GQL_IDS.UserByScreenName,
    X_GQL_HOME_TIMELINE_ID: config.X_GQL_HOME_TIMELINE_ID || DEFAULT_GQL_IDS.HomeLatestTimeline,
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
      }),
    );
  }

  // CSRF protection on state-mutating requests
  app.use('*', async (c, next) => {
    const method = c.req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }
    // Allow health check without CSRF
    if (c.req.path === '/healthz') {
      return next();
    }
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');
    // If Origin is present, it must match the request host
    if (origin) {
      const requestHost = c.req.header('host');
      try {
        const originHost = new URL(origin).host;
        if (originHost !== requestHost) {
          logger.warn('CSRF: Origin mismatch', { origin, host: requestHost });
          return c.json({ success: false, message: 'Forbidden: origin mismatch' }, 403);
        }
      } catch {
        return c.json({ success: false, message: 'Forbidden: invalid origin' }, 403);
      }
    } else if (referer) {
      // Fallback to Referer check
      const requestHost = c.req.header('host');
      try {
        const refererHost = new URL(referer).host;
        if (refererHost !== requestHost) {
          logger.warn('CSRF: Referer mismatch', { referer, host: requestHost });
          return c.json({ success: false, message: 'Forbidden: referer mismatch' }, 403);
        }
      } catch {
        return c.json({ success: false, message: 'Forbidden: invalid referer' }, 403);
      }
    }
    // If neither Origin nor Referer is present, allow the request
    // (CLI tools, curl, etc. don't send these headers)
    return next();
  });

  // Health check (no auth)
  app.get('/healthz', (c) => {
    if (isConfigured) {
      return c.json({ status: 'ok' });
    }
    return c.json(
      {
        status: 'unconfigured',
        missing: (missingCredentials || []).map((m) => m.key),
      },
      503,
    );
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
      c.json({
        success: false,
        message: "Configuration incomplète. Configurez les variables d'environnement requises.",
      }),
    );
    app.get('/api/status', (c) =>
      c.json({
        running: false,
        configured: false,
        missing: (missingCredentials || []).map((m) => m.key),
        cronSchedule,
        totalRuns: 0,
      }),
    );
    app.get('/api/runs', (c) => c.json([]));
    app.get('/api/settings', (c) => c.json([]));
    app.get('/api/config', (c) =>
      c.json({
        envDefaults: {},
        credentialInfo: {
          authTokenMasked: '',
          csrfTokenMasked: '',
          discordWebhookMasked: '',
          hasAuth: false,
        },
      }),
    );
  } else {
    // Normal operational mode — full API

    app.get('/api/status', (c) => {
      const lastRun = getLastRun();
      return c.json({
        running: isRunning(),
        collecting: isCollecting(),
        configured: true,
        lastRun,
        cronSchedule,
        collectCronSchedule: getCollectSchedule() || config.COLLECT_CRON_SCHEDULE,
        totalRuns: countRuns(),
      });
    });

    app.get('/api/runs', (c) => {
      const limit = Number(c.req.query('limit') || '20');
      const offset = Number(c.req.query('offset') || '0');
      const type = c.req.query('type'); // optional: 'collect', 'cron', 'manual'
      const runs = getRunHistory(limit, offset);
      const total = countRuns();
      if (type) {
        const filtered = runs.filter((r) => r.trigger_type === type);
        return c.json({ runs: filtered, total });
      }
      return c.json({ runs, total });
    });

    app.get('/api/collect-status', (c) => {
      const today = getTodayDateParis();
      return c.json({
        collecting: isCollecting(),
        today,
        tweetsCollected: countTweetsForDate(today),
        tweetsUnpublished: countUnpublishedTweets(today),
        collectCronSchedule: getCollectSchedule() || config.COLLECT_CRON_SCHEDULE,
      });
    });

    app.get('/api/settings', (c) => {
      const settings = getSettings().map((s) =>
        isCredentialKey(s.key) ? { ...s, value: maskCredential(s.value) } : s,
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
      const authToken =
        typeof body.X_SESSION_AUTH_TOKEN === 'string' ? body.X_SESSION_AUTH_TOKEN.trim() : '';
      const csrfToken =
        typeof body.X_SESSION_CSRF_TOKEN === 'string' ? body.X_SESSION_CSRF_TOKEN.trim() : '';

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
        message:
          'Cookies de session mis à jour et validés avec succès. Les prochains runs utiliseront ces valeurs.',
      });
    });

    // --- Summaries API ---

    app.get('/api/summaries', (c) => {
      const limit = Number(c.req.query('limit') || '20');
      const offset = Number(c.req.query('offset') || '0');
      const month = c.req.query('month'); // YYYY-MM format
      const search = c.req.query('search');
      const filters = {
        ...(month && /^\d{4}-\d{2}$/.test(month) ? { month } : {}),
        ...(search && search.trim() ? { search: search.trim() } : {}),
      };
      const hasFilters = Object.keys(filters).length > 0;
      const summaries = getSuccessfulSummaries(limit, offset, hasFilters ? filters : undefined);
      const total = countSuccessfulSummaries(hasFilters ? filters : undefined);
      return c.json({ summaries, total });
    });

    app.get('/api/monthly-summaries', (c) => {
      const summaries = listMonthlySummaries();
      return c.json(summaries);
    });

    app.get('/api/monthly-summaries/available', (c) => {
      return c.json(getAvailableMonths());
    });

    app.get('/api/monthly-summaries/:year/:month', (c) => {
      const year = Number(c.req.param('year'));
      const month = Number(c.req.param('month'));
      if (!year || !month || month < 1 || month > 12) {
        return c.json({ error: 'Année et mois invalides.' }, 400);
      }
      const summary = getMonthlySummary(year, month);
      if (!summary) {
        const runs = getSuccessfulRunsByMonth(year, month);
        return c.json({ exists: false, availableRuns: runs.length });
      }
      return c.json({ exists: true, summary });
    });

    app.post('/api/monthly-summaries/generate', async (c) => {
      const body = await c.req.json();
      const year = Number(body.year);
      const month = Number(body.month);
      if (!year || !month || month < 1 || month > 12) {
        return c.json({ success: false, message: 'Année et mois invalides.' }, 400);
      }
      try {
        const overrides = getSettingsMap();
        const mergedConfig = buildMergedConfig(config, overrides);
        const summary = await generateMonthlySummary(mergedConfig, year, month);
        return c.json({ success: true, summary });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return c.json({ success: false, message: msg }, 500);
      }
    });

    app.delete('/api/summaries/:id', (c) => {
      const runId = Number(c.req.param('id'));
      if (!runId || runId < 1) {
        return c.json({ success: false, message: 'ID de run invalide.' }, 400);
      }
      const result = deleteSummary(runId);
      return c.json(result, result.success ? 200 : 400);
    });

    app.post('/api/summaries/:id/rerun', async (c) => {
      const runId = Number(c.req.param('id'));
      if (!runId || runId < 1) {
        return c.json({ success: false, message: 'ID de run invalide.' }, 400);
      }

      const overrides = getSettingsMap();
      const mergedConfig = buildMergedConfig(config, overrides);
      const result = await triggerRerun(mergedConfig, runId);
      return c.json(result, result.success ? 200 : 400);
    });

    app.post('/api/detect-gql-ids', async (c) => {
      try {
        const ids = await detectGqlIds();
        const saved: Record<string, string> = {};
        if (ids.UserByScreenName) {
          setSetting('X_GQL_USER_BY_SCREEN_NAME_ID', ids.UserByScreenName);
          saved.UserByScreenName = ids.UserByScreenName;
        }
        if (ids.HomeLatestTimeline) {
          setSetting('X_GQL_HOME_TIMELINE_ID', ids.HomeLatestTimeline);
          saved.HomeLatestTimeline = ids.HomeLatestTimeline;
        }
        if (Object.keys(saved).length === 0) {
          return c.json({
            success: false,
            message: 'Aucun ID GraphQL trouvé dans les bundles JS de x.com.',
          });
        }
        return c.json({
          success: true,
          message: 'IDs GraphQL détectés et sauvegardés.',
          ids: saved,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return c.json({ success: false, message: `Erreur de détection : ${msg}` });
      }
    });

    // --- Cron schedule hot-reload ---

    app.get('/api/cron-schedule', (c) => {
      const dbSchedule = getSetting('CRON_SCHEDULE');
      const dbCollectSchedule = getSetting('COLLECT_CRON_SCHEDULE');
      const active = getCurrentSchedule() || cronSchedule;
      const activeCollect = getCollectSchedule() || config.COLLECT_CRON_SCHEDULE;
      return c.json({
        active,
        saved: dbSchedule || cronSchedule,
        envDefault: cronSchedule,
        collect: {
          active: activeCollect,
          saved: dbCollectSchedule || config.COLLECT_CRON_SCHEDULE,
          envDefault: config.COLLECT_CRON_SCHEDULE,
        },
      });
    });

    app.post('/api/cron-schedule', async (c) => {
      const body = await c.req.json();
      const schedule = typeof body.schedule === 'string' ? body.schedule.trim() : '';

      if (!schedule) {
        return c.json({ success: false, message: 'La planification cron est requise.' });
      }

      if (!cron.validate(schedule)) {
        return c.json({
          success: false,
          message: `Expression cron invalide : "${schedule}". Format attendu : minute heure jour mois jour-semaine`,
        });
      }

      setSetting('CRON_SCHEDULE', schedule);
      const ok = reschedule(schedule, config, buildMergedConfig);

      if (ok) {
        return c.json({
          success: true,
          message: 'Planification mise a jour et appliquee immediatement.',
        });
      }
      return c.json({
        success: false,
        message: 'Erreur lors de la replanification.',
      });
    });

    app.post('/api/collect-cron-schedule', async (c) => {
      const body = await c.req.json();
      const schedule = typeof body.schedule === 'string' ? body.schedule.trim() : '';

      if (!schedule) {
        return c.json({ success: false, message: 'La planification cron de collecte est requise.' });
      }

      if (!cron.validate(schedule)) {
        return c.json({
          success: false,
          message: `Expression cron invalide : "${schedule}". Format attendu : minute heure jour mois jour-semaine`,
        });
      }

      setSetting('COLLECT_CRON_SCHEDULE', schedule);
      const ok = rescheduleCollect(schedule, config, buildMergedConfig);

      if (ok) {
        return c.json({
          success: true,
          message: 'Planification de collecte mise a jour et appliquee immediatement.',
        });
      }
      return c.json({
        success: false,
        message: 'Erreur lors de la replanification de collecte.',
      });
    });

    app.post('/api/trigger', async (c) => {
      if (isRunning()) {
        return c.json({ success: false, message: 'Un run est déjà en cours.' });
      }

      const overrides = getSettingsMap();
      const mergedConfig = buildMergedConfig(config, overrides);

      triggerRun(mergedConfig, 'manual').catch((err) => {
        logger.error('Manual trigger failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return c.json({
        success: true,
        message: 'Run lancé ! La page se rafraîchira automatiquement.',
      });
    });

    app.post('/api/trigger-collect', async (c) => {
      if (isCollecting()) {
        return c.json({ success: false, message: 'Une collecte est déjà en cours.' });
      }

      const overrides = getSettingsMap();
      const mergedConfig = buildMergedConfig(config, overrides);

      triggerCollect(mergedConfig).catch((err) => {
        logger.error('Manual collect trigger failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return c.json({
        success: true,
        message: 'Collecte de tweets lancée !',
      });
    });

    // --- Discord webhook ---

    app.post('/api/discord-webhook', async (c) => {
      const body = await c.req.json();
      const url =
        typeof body.DISCORD_WEBHOOK_URL === 'string' ? body.DISCORD_WEBHOOK_URL.trim() : '';

      if (!url) {
        return c.json({ success: false, message: "L'URL du webhook est requise." });
      }

      if (!url.startsWith('https://discord.com/api/webhooks/')) {
        return c.json({
          success: false,
          message: "L'URL doit commencer par https://discord.com/api/webhooks/",
        });
      }

      setSetting('DISCORD_WEBHOOK_URL', url);
      return c.json({
        success: true,
        message: 'Webhook Discord sauvegardé.',
      });
    });

    app.delete('/api/discord-webhook', (c) => {
      deleteSetting('DISCORD_WEBHOOK_URL');
      return c.json({ success: true, message: 'Webhook Discord supprimé.' });
    });

    app.get('/api/runs/:id/tweets', (c) => {
      const runId = Number(c.req.param('id'));
      if (!runId || runId < 1) {
        return c.json({ success: false, message: 'ID de run invalide.' }, 400);
      }

      const targetRun = getRunById(runId);
      if (!targetRun) {
        return c.json({ success: false, message: 'Run introuvable.' }, 404);
      }

      const limit = Math.min(Number(c.req.query('limit') || '50'), 200);
      const offset = Number(c.req.query('offset') || '0');
      const result = getTweetsByRunId(runId, limit, offset);
      return c.json(result);
    });

    app.post('/api/runs/:id/send-discord', async (c) => {
      const runId = Number(c.req.param('id'));
      if (!runId || runId < 1) {
        return c.json({ success: false, message: 'ID de run invalide.' }, 400);
      }

      const targetRun = getRunById(runId);
      if (!targetRun) {
        return c.json({ success: false, message: 'Run introuvable.' }, 404);
      }

      if (!targetRun.summary) {
        return c.json({
          success: false,
          message: 'Ce run ne contient pas de resume a envoyer.',
        }, 400);
      }

      const webhookUrl = getSetting('DISCORD_WEBHOOK_URL') ?? config.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        return c.json({
          success: false,
          message: "Aucun webhook Discord configure. Ajoutez l'URL dans les parametres.",
        }, 400);
      }

      const result = await sendDiscordNotification(webhookUrl, targetRun.summary, runId);
      const notifStatus = result.success ? 'sent' : 'failed';
      updateNotificationStatus(runId, notifStatus);

      if (result.success) {
        return c.json({
          success: true,
          message: 'Resume envoye sur Discord avec succes.',
          notification_status: notifStatus,
        });
      }
      return c.json({
        success: false,
        message: `Echec de l'envoi : ${result.error}`,
        notification_status: notifStatus,
      });
    });

    app.post('/api/test-discord', async (c) => {
      const webhookUrl = getSetting('DISCORD_WEBHOOK_URL') ?? config.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        return c.json({
          success: false,
          message: "Aucun webhook Discord configuré. Ajoutez l'URL dans les paramètres.",
        });
      }

      const result = await testDiscordWebhook(webhookUrl);
      if (result.success) {
        return c.json({
          success: true,
          message: 'Message de test envoyé avec succès sur Discord.',
        });
      }
      return c.json({
        success: false,
        message: `Échec de l'envoi : ${result.error}`,
      });
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

