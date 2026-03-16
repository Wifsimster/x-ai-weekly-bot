import Anthropic from '@anthropic-ai/sdk';
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
  const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  return { filterAndSummarize };

  async function filterAndSummarize(tweets: Tweet[]): Promise<string | null> {
    const tweetTexts = tweets
      .map((t, i) => {
        const urls = t.urls.length > 0 ? `\nURLs: ${t.urls.join(', ')}` : '';
        return `[${i + 1}] ${t.text}${urls}`;
      })
      .join('\n\n');

    const response = await anthropic.messages.create({
      model: config.CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here are the tweets from the past ${config.TWEETS_LOOKBACK_DAYS} days:\n\n${tweetTexts}`,
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    logger.info('Claude API usage', {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
    });

    if (text.trim() === 'NO_AI_NEWS_FOUND') {
      logger.info('No AI-related news found in tweets');
      return null;
    }

    return text.trim();
  }
}
