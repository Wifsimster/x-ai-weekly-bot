import { z } from 'zod';
import type { Config } from '../config.js';
import type { Tweet, TweetReader } from '../ports.js';
import { isXUrl } from '../ports.js';
import { logger } from '../logger.js';

// Public bearer token embedded in X's web app JavaScript bundle
const BEARER_TOKEN =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// Feature flags required by X's GraphQL API — these may need updating when X changes them
const GRAPHQL_FEATURES = {
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

const FEATURES_ENCODED = encodeURIComponent(JSON.stringify(GRAPHQL_FEATURES));

// Zod schema for validating tweet data from the GraphQL response
const tweetLegacySchema = z.object({
  id_str: z.string(),
  full_text: z.string(),
  created_at: z.string(),
  entities: z.object({
    urls: z
      .array(z.object({ expanded_url: z.string().optional() }))
      .default([]),
  }),
  retweeted_status_result: z.unknown().optional(),
});

export function createScraperReader(config: Config): TweetReader {
  const authToken = config.X_SESSION_AUTH_TOKEN;
  const csrfToken = config.X_SESSION_CSRF_TOKEN;

  if (!authToken || !csrfToken) {
    throw new Error(
      'X_SESSION_AUTH_TOKEN and X_SESSION_CSRF_TOKEN are required when X_READ_METHOD=scraper',
    );
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${BEARER_TOKEN}`,
    cookie: `auth_token=${authToken}; ct0=${csrfToken}`,
    'x-csrf-token': csrfToken,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
  };

  return { fetchRecentTweets };

  async function fetchRecentTweets(): Promise<Tweet[]> {
    const userId = await getUserId(config.X_USERNAME);

    const startTime = new Date();
    startTime.setDate(startTime.getDate() - config.TWEETS_LOOKBACK_DAYS);

    const tweets: Tweet[] = [];
    let cursor: string | undefined;

    while (tweets.length < config.MAX_TWEETS) {
      const { entries, nextCursor } = await fetchTimelinePage(userId, cursor);

      if (entries.length === 0) break;

      for (const entry of entries) {
        const tweet = parseTweetEntry(entry);
        if (!tweet) continue;

        if (new Date(tweet.createdAt) < startTime) {
          logger.info('Fetched tweets via scraper', {
            count: tweets.length,
            userId,
          });
          return tweets;
        }

        tweets.push(tweet);
        if (tweets.length >= config.MAX_TWEETS) break;
      }

      if (!nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    }

    logger.info('Fetched tweets via scraper', {
      count: tweets.length,
      userId,
    });
    return tweets;
  }

  async function getUserId(username: string): Promise<string> {
    const variables = JSON.stringify({
      screen_name: username,
      withSafetyModeUserFields: true,
    });

    const queryId =
      config.X_GQL_USER_BY_SCREEN_NAME_ID ?? 'qW5u-DAuXpMEG0zA1F7UGQ';
    const url = `https://x.com/i/api/graphql/${queryId}/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${FEATURES_ENCODED}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Scraper: failed to fetch user @${username}: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      );
    }

    const json = (await response.json()) as Record<string, unknown>;
    const userId = getNestedValue(json, [
      'data',
      'user',
      'result',
      'rest_id',
    ]);
    if (typeof userId !== 'string') {
      throw new Error(
        `Scraper: user @${username} not found or response structure changed`,
      );
    }

    return userId;
  }

  async function fetchTimelinePage(
    userId: string,
    cursor?: string,
  ): Promise<{ entries: unknown[]; nextCursor: string | undefined }> {
    const variables: Record<string, unknown> = {
      userId,
      count: Math.min(config.MAX_TWEETS, 40),
      includePromotedContent: false,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true,
    };

    if (cursor) {
      variables.cursor = cursor;
    }

    const queryId = config.X_GQL_USER_TWEETS_ID ?? 'E3opETHurmVJflFsUBVuUQ';
    const url = `https://x.com/i/api/graphql/${queryId}/UserTweets?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${FEATURES_ENCODED}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Scraper: failed to fetch timeline: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      );
    }

    const json = (await response.json()) as Record<string, unknown>;

    const instructions = (getNestedValue(json, [
      'data',
      'user',
      'result',
      'timeline_v2',
      'timeline',
      'instructions',
    ]) ?? []) as Array<Record<string, unknown>>;

    const entries: unknown[] = [];
    let nextCursor: string | undefined;

    for (const instruction of instructions) {
      if (instruction.type === 'TimelineAddEntries') {
        for (const entry of (instruction.entries ?? []) as Array<
          Record<string, unknown>
        >) {
          const content = entry.content as Record<string, unknown> | undefined;
          if (!content) continue;

          if (content.entryType === 'TimelineTimelineItem') {
            entries.push(entry);
          } else if (
            content.entryType === 'TimelineTimelineCursor' &&
            content.cursorType === 'Bottom'
          ) {
            nextCursor = content.value as string;
          }
        }
      }
    }

    return { entries, nextCursor };
  }

  function parseTweetEntry(entry: unknown): Tweet | null {
    try {
      const tweetResult = getNestedValue(entry as Record<string, unknown>, [
        'content',
        'itemContent',
        'tweet_results',
        'result',
      ]) as Record<string, unknown> | undefined;

      if (!tweetResult) return null;

      // Handle tweet types: regular tweet or tweet-with-visibility-results
      const legacy =
        tweetResult.legacy ??
        getNestedValue(tweetResult, ['tweet', 'legacy']);
      if (!legacy) return null;

      const parsed = tweetLegacySchema.safeParse(legacy);
      if (!parsed.success) {
        logger.debug('Scraper: failed to parse tweet', {
          errors: parsed.error.issues.map((i) => i.message),
        });
        return null;
      }

      // Skip retweets
      if (parsed.data.retweeted_status_result) return null;

      const urls = parsed.data.entities.urls
        .map((u) => u.expanded_url)
        .filter((url): url is string => !!url && !isXUrl(url));

      return {
        id: parsed.data.id_str,
        text: parsed.data.full_text,
        createdAt: new Date(parsed.data.created_at).toISOString(),
        urls,
      };
    } catch {
      return null;
    }
  }
}

function getNestedValue(
  obj: unknown,
  path: string[],
): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
