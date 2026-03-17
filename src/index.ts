import { loadConfig, type Config } from './config.js';
import { logger } from './logger.js';
import { createXClient } from './x-client.js';
import { createAIFilter } from './ai-filter.js';
import { getCurrentRunId, updateRunStats } from './run-service.js';
import { getUnpublishedTweets, markTweetsAsUsed, storeTweets } from './tweet-store.js';
import { getTodayDateParis } from './date-utils.js';

export async function run(config: Config) {
  const collectionDate = getTodayDateParis();

  logger.info('Starting daily summary (publish)', {
    username: config.X_USERNAME,
    collectionDate,
  });

  const runId = getCurrentRunId();

  // 1. Do a final collection sweep before summarizing
  const xClient = createXClient(config);
  const liveTweets = await xClient.fetchRecentTweets();
  if (liveTweets.length > 0) {
    storeTweets(liveTweets, collectionDate);
  }

  // 2. Read all accumulated tweets for today
  const tweets = getUnpublishedTweets(collectionDate);
  if (runId) updateRunStats(runId, { tweets_fetched: tweets.length });

  if (tweets.length === 0) {
    logger.warn('No tweets found in accumulated collection');
    return;
  }

  logger.info('Tweets accumulated for summary', { count: tweets.length });

  // 3. Filter and summarize AI news
  const aiFilter = createAIFilter(config);
  const summary = await aiFilter.filterAndSummarize(tweets);
  if (runId && summary) updateRunStats(runId, { summary });

  if (!summary) {
    logger.info('No AI news found — skipping');
    // Mark tweets as used even if no AI news, to avoid re-processing
    if (runId) markTweetsAsUsed(tweets.map((t) => t.id), runId);
    return;
  }

  // 4. Mark tweets as consumed by this run
  if (runId) markTweetsAsUsed(tweets.map((t) => t.id), runId);

  logger.info('Summary generated', { length: summary.length });
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
