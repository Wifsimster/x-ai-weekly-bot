import type { Config } from './config.js';
import type { TweetReader, TweetPoster } from './ports.js';
import { createApiReader } from './adapters/api-reader.js';
import { createApiPoster } from './adapters/api-poster.js';
import { createScraperReader } from './adapters/scraper-reader.js';
import { createScraperPoster } from './adapters/scraper-poster.js';
import { logger } from './logger.js';

export type { Tweet } from './ports.js';

export function createXClient(config: Config): TweetReader & TweetPoster {
  logger.info('X client transport', {
    read: config.X_READ_METHOD,
    write: config.X_WRITE_METHOD,
  });

  const reader: TweetReader =
    config.X_READ_METHOD === 'scraper'
      ? createScraperReader(config)
      : createApiReader(config);

  const poster: TweetPoster =
    config.X_WRITE_METHOD === 'scraper'
      ? createScraperPoster(config)
      : createApiPoster(config);

  return {
    fetchRecentTweets: () => reader.fetchRecentTweets(),
    postThread: (chunks) => poster.postThread(chunks),
  };
}
