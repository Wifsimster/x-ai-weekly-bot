import { loadConfig, type Config } from './config.js';
import { logger } from './logger.js';
import { createXClient } from './x-client.js';
import { createAIFilter } from './ai-filter.js';
import { buildThread } from './thread-builder.js';
import { getCurrentRunId, updateRunStats } from './run-service.js';

export async function run(config: Config) {
  logger.info('Starting weekly summary', {
    username: config.X_USERNAME,
    lookbackDays: config.TWEETS_LOOKBACK_DAYS,
    dryRun: config.DRY_RUN,
  });

  const xClient = createXClient(config);
  const aiFilter = createAIFilter(config);
  const runId = getCurrentRunId();

  // 1. Fetch recent tweets
  const tweets = await xClient.fetchRecentTweets();
  if (runId) updateRunStats(runId, { tweets_fetched: tweets.length });

  if (tweets.length === 0) {
    logger.warn('No tweets found in the lookback period');
    return;
  }

  // 2. Filter and summarize AI news
  const summary = await aiFilter.filterAndSummarize(tweets);
  if (runId && summary) updateRunStats(runId, { summary });

  if (!summary) {
    logger.info('No AI news to post — skipping');
    return;
  }

  // 3. Build thread chunks
  const chunks = buildThread(summary);
  logger.info('Thread built', { chunkCount: chunks.length });

  // 4. Post or dry-run
  if (config.DRY_RUN) {
    logger.info('DRY RUN — thread would be posted:');
    chunks.forEach((chunk, i) => {
      logger.info(`Tweet ${i + 1}/${chunks.length}`, {
        text: chunk,
        length: chunk.length,
      });
    });
    return;
  }

  const tweetIds = await xClient.postThread(chunks);
  if (runId) updateRunStats(runId, { tweets_posted: tweetIds.length, thread_ids: JSON.stringify(tweetIds) });
  logger.info('Thread posted successfully', { tweetIds });
}

// One-shot mode when run directly
const isDirectRun = process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  const config = loadConfig();
  run(config).catch((err) => {
    logger.error('Fatal error', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  });
}
