import { TwitterApi } from 'twitter-api-v2';
import type { Config } from './config.js';
import { logger } from './logger.js';

export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  urls: string[];
}

export function createXClient(config: Config) {
  const client = new TwitterApi({
    appKey: config.X_API_KEY,
    appSecret: config.X_API_SECRET,
    accessToken: config.X_ACCESS_TOKEN,
    accessSecret: config.X_ACCESS_TOKEN_SECRET,
  });

  return { fetchRecentTweets, postThread };

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

    logger.info('Fetched tweets', { count: tweets.length, userId });
    return tweets;
  }

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

      logger.info('Posted tweet', { index: i + 1, total: chunks.length, id: result.data.id });

      if (i < chunks.length - 1) {
        await sleep(1000);
      }
    }

    return tweetIds;
  }
}

function isXUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'twitter.com' || hostname === 'x.com' || hostname.endsWith('.twitter.com') || hostname.endsWith('.x.com');
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
