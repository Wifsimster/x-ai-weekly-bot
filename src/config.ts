import { z } from 'zod';

const configSchema = z
  .object({
    X_USERNAME: z.string().min(1),

    // Transport method for reads and writes (default: scraper for free usage)
    X_READ_METHOD: z.enum(['api', 'scraper']).default('scraper'),
    X_WRITE_METHOD: z.enum(['api', 'scraper']).default('scraper'),

    // X API credentials — required when method = api
    X_API_KEY: z.string().min(1).optional(),
    X_API_SECRET: z.string().min(1).optional(),
    X_ACCESS_TOKEN: z.string().min(1).optional(),
    X_ACCESS_TOKEN_SECRET: z.string().min(1).optional(),

    // Session tokens — required when method = scraper
    // auth_token: from browser cookie after login
    // ct0: CSRF token from browser cookie after login
    X_SESSION_AUTH_TOKEN: z.string().min(1).optional(),
    X_SESSION_CSRF_TOKEN: z.string().min(1).optional(),

    // Optional: override GraphQL operation IDs when X changes them
    X_GQL_USER_BY_SCREEN_NAME_ID: z.string().optional(),
    X_GQL_USER_TWEETS_ID: z.string().optional(),
    X_GQL_CREATE_TWEET_ID: z.string().optional(),

    ANTHROPIC_API_KEY: z.string().min(1),
    CLAUDE_MODEL: z.string().default('claude-sonnet-4-20250514'),
    TWEETS_LOOKBACK_DAYS: z.coerce.number().int().positive().default(7),
    MAX_TWEETS: z.coerce.number().int().positive().default(200),
    DRY_RUN: z
      .enum(['true', 'false', '1', '0'])
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
  })
  .refine(
    (c) => {
      if (c.X_READ_METHOD === 'api' || c.X_WRITE_METHOD === 'api') {
        return !!(c.X_API_KEY && c.X_API_SECRET && c.X_ACCESS_TOKEN && c.X_ACCESS_TOKEN_SECRET);
      }
      return true;
    },
    { message: 'X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET are required when using api mode' },
  )
  .refine(
    (c) => {
      if (c.X_READ_METHOD === 'scraper' || c.X_WRITE_METHOD === 'scraper') {
        return !!(c.X_SESSION_AUTH_TOKEN && c.X_SESSION_CSRF_TOKEN);
      }
      return true;
    },
    { message: 'X_SESSION_AUTH_TOKEN and X_SESSION_CSRF_TOKEN are required when using scraper mode' },
  );

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${missing.join('\n')}`);
  }
  return result.data;
}
