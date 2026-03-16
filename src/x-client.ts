import type { Config } from './config.js';
import type { TweetReader } from './ports.js';
import { createScraperReader } from './adapters/scraper-reader.js';
import { setSetting, isEditableKey } from './settings-service.js';

export type { Tweet } from './ports.js';

export function createXClient(config: Config): TweetReader {
  return createScraperReader(config, {
    save(key, value) {
      if (isEditableKey(key)) {
        setSetting(key, value);
      }
    },
  });
}
