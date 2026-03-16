import { TwitterApi } from 'twitter-api-v2';
import type { Config } from '../config.js';
import type { Tweet, TweetReader } from '../ports.js';
import { isXUrl } from '../ports.js';
import { logger } from '../logger.js';

export function createApiReader(config: Config): TweetReader {
  if (!config.X_API_KEY || !config.X_API_SECRET || !config.X_ACCESS_TOKEN || !config.X_ACCESS_TOKEN_SECRET) {
    throw new Error('X API credentials are required when X_READ_METHOD=api');
  }

  const client = new TwitterApi({
    appKey: config.X_API_KEY,
    appSecret: config.X_API_SECRET,
    accessToken: config.X_ACCESS_TOKEN,
    accessSecret: config.X_ACCESS_TOKEN_SECRET,
  });

  return { fetchRecentTweets };

  async function fetchRecentTweets(): Promise<Tweet[]> {
    const user = await client.v2.userByUsername(config.X_USERNAME);
    if (!user.data) {
      throw new Error(`User @${config.X_USERNAME} not found`);
    }

    const userId = user.data.id;
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - config.TWEETS_LOOKBACK_DAYS);

    const timeline = await client.v2.userTimeline(userId, {
      max_results: Math.min(config.MAX_TWEETS, 100),
      start_time: startTime.toISOString(),
      'tweet.fields': ['created_at', 'entities', 'referenced_tweets'],
      exclude: ['retweets'],
    });

    const tweets: Tweet[] = [];

    for await (const tweet of timeline) {
      if (tweets.length >= config.MAX_TWEETS) break;

      const urls = (tweet.entities?.urls ?? [])
        .map((u) => u.expanded_url)
        .filter((url): url is string => !!url && !isXUrl(url));

      tweets.push({
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at ?? new Date().toISOString(),
        urls,
      });
    }

    logger.info('Fetched tweets via API', { count: tweets.length, userId });
    return tweets;
  }
}
