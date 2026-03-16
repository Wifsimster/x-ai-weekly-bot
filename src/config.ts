import { z } from 'zod';

const configSchema = z.object({
  X_API_KEY: z.string().min(1),
  X_API_SECRET: z.string().min(1),
  X_ACCESS_TOKEN: z.string().min(1),
  X_ACCESS_TOKEN_SECRET: z.string().min(1),
  X_USERNAME: z.string().min(1),
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

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${missing.join('\n')}`);
  }
  return result.data;
}
