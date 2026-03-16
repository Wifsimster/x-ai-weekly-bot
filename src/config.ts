import { z, type ZodIssue } from 'zod';

const configSchema = z.object({
  X_USERNAME: z.string().min(1),

  // Session tokens for web scraping — extract from browser cookies
  // auth_token: from browser cookie after login
  // ct0: CSRF token from browser cookie after login
  X_SESSION_AUTH_TOKEN: z.string().min(1),
  X_SESSION_CSRF_TOKEN: z.string().min(1),

  // Optional: override GraphQL operation IDs when X changes them
  X_GQL_USER_BY_SCREEN_NAME_ID: z.string().optional(),
  X_GQL_USER_TWEETS_ID: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-20250514'),
  TWEETS_LOOKBACK_DAYS: z.coerce.number().int().positive().default(7),
  MAX_TWEETS: z.coerce.number().int().positive().default(200),
  DRY_RUN: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  ADMIN_PASSWORD: z.string().optional(),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  CRON_SCHEDULE: z.string().default('0 18 * * 0'),
});

export type Config = z.infer<typeof configSchema>;

// Minimal schema for boot — only needs web server params
const bootSchema = z.object({
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  CRON_SCHEDULE: z.string().default('0 18 * * 0'),
  ADMIN_PASSWORD: z.string().optional(),
});

export type BootConfig = z.infer<typeof bootSchema>;

export const REQUIRED_CREDENTIALS = [
  { key: 'X_USERNAME', label: 'X (Twitter) Username', docUrl: 'https://x.com/' },
  { key: 'X_SESSION_AUTH_TOKEN', label: 'X Session Auth Token (cookie: auth_token)', docUrl: 'https://x.com/' },
  { key: 'X_SESSION_CSRF_TOKEN', label: 'X Session CSRF Token (cookie: ct0)', docUrl: 'https://x.com/' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', docUrl: 'https://console.anthropic.com/' },
] as const;

export interface ConfigResult {
  success: true;
  config: Config;
}

export interface ConfigError {
  success: false;
  missing: { key: string; label: string; docUrl: string; message: string }[];
}

export function tryLoadConfig(): ConfigResult | ConfigError {
  const result = configSchema.safeParse(process.env);
  if (result.success) {
    return { success: true, config: result.data };
  }

  const failedKeys = new Set(result.error.issues.map((i: ZodIssue) => i.path[0] as string));
  const missing = REQUIRED_CREDENTIALS.filter((c) => failedKeys.has(c.key)).map((c) => ({
    ...c,
    message: result.error.issues.find((i: ZodIssue) => i.path[0] === c.key)?.message || 'Required',
  }));

  return { success: false, missing };
}

export function loadBootConfig(): BootConfig {
  return bootSchema.parse(process.env);
}

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${missing.join('\n')}`);
  }
  return result.data;
}
