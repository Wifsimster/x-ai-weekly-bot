import type { Config } from './config.js';
import type { TweetReader } from './ports.js';
import { createScraperReader } from './adapters/scraper-reader.js';

export type { Tweet } from './ports.js';

export function createXClient(config: Config): TweetReader {
  return createScraperReader(config);
}
