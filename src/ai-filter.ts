import OpenAI from 'openai';
import type { Config } from './config.js';
import type { Tweet } from './ports.js';
import { logger } from './logger.js';

const SYSTEM_PROMPT = `You are an AI news curator. You receive a list of tweets from a user's X timeline.

Your task:
1. Identify tweets related to artificial intelligence (AI, ML, LLMs, generative AI, computer vision, robotics, AI policy, etc.)
2. Group them by theme
3. Write a concise summary (under 2000 characters) in French
4. Include source links where available
5. Use a professional but engaging tone

Format your response as a thread-ready text with clear sections separated by blank lines.
Each section should have a bold theme header using uppercase.

If none of the tweets are related to AI, respond with exactly: NO_AI_NEWS_FOUND`;

export function createAIFilter(config: Config) {
  const client = new OpenAI({
    baseURL: 'https://models.github.ai/inference',
    apiKey: config.GITHUB_TOKEN,
  });

  return { filterAndSummarize };

  async function filterAndSummarize(tweets: Tweet[]): Promise<string | null> {
    const tweetTexts = tweets
      .map((t, i) => {
        const urls = t.urls.length > 0 ? `\nURLs: ${t.urls.join(', ')}` : '';
        return `[${i + 1}] ${t.text}${urls}`;
      })
      .join('\n\n');

    const response = await client.chat.completions.create({
      model: config.AI_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here are the tweets from the past ${config.TWEETS_LOOKBACK_DAYS} days:\n\n${tweetTexts}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';

    logger.info('GitHub Models API usage', {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      model: response.model,
    });

    if (text.trim() === 'NO_AI_NEWS_FOUND') {
      logger.info('No AI-related news found in tweets');
      return null;
    }

    return text.trim();
  }
}
