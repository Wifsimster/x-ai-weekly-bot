import { TwitterApi } from 'twitter-api-v2';
import type { Config } from '../config.js';
import type { TweetPoster } from '../ports.js';
import { logger } from '../logger.js';

export function createApiPoster(config: Config): TweetPoster {
  if (!config.X_API_KEY || !config.X_API_SECRET || !config.X_ACCESS_TOKEN || !config.X_ACCESS_TOKEN_SECRET) {
    throw new Error('X API credentials are required when X_WRITE_METHOD=api');
  }

  const client = new TwitterApi({
    appKey: config.X_API_KEY,
    appSecret: config.X_API_SECRET,
    accessToken: config.X_ACCESS_TOKEN,
    accessSecret: config.X_ACCESS_TOKEN_SECRET,
  });

  return { postThread };

  async function postThread(chunks: string[]): Promise<string[]> {
    const tweetIds: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const options: { text: string; reply?: { in_reply_to_tweet_id: string } } = {
        text: chunks[i],
      };

      if (i > 0 && tweetIds.length > 0) {
        options.reply = { in_reply_to_tweet_id: tweetIds[tweetIds.length - 1] };
      }

      const result = await client.v2.tweet(options.text, options.reply ? { reply: options.reply } : undefined);
      tweetIds.push(result.data.id);

      logger.info('Posted tweet via API', { index: i + 1, total: chunks.length, id: result.data.id });

      if (i < chunks.length - 1) {
        await sleep(1000);
      }
    }

    return tweetIds;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
