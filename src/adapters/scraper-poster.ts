import type { Config } from '../config.js';
import type { TweetPoster } from '../ports.js';
import { logger } from '../logger.js';

// Public bearer token embedded in X's web app JavaScript bundle
const BEARER_TOKEN =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// Feature flags for the CreateTweet mutation
const GRAPHQL_FEATURES = {
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
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
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  rweb_video_timestamps_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  articles_preview_enabled: true,
};

export function createScraperPoster(config: Config): TweetPoster {
  const authToken = config.X_SESSION_AUTH_TOKEN;
  const csrfToken = config.X_SESSION_CSRF_TOKEN;

  if (!authToken || !csrfToken) {
    throw new Error(
      'X_SESSION_AUTH_TOKEN and X_SESSION_CSRF_TOKEN are required when X_WRITE_METHOD=scraper',
    );
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${BEARER_TOKEN}`,
    cookie: `auth_token=${authToken}; ct0=${csrfToken}`,
    'x-csrf-token': csrfToken,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
    'content-type': 'application/json',
  };

  return { postThread };

  async function postThread(chunks: string[]): Promise<string[]> {
    const tweetIds: string[] = [];
    const queryId = config.X_GQL_CREATE_TWEET_ID ?? 'bDE2rBtZb3uyrczSZ_pI9g';

    for (let i = 0; i < chunks.length; i++) {
      const variables: Record<string, unknown> = {
        tweet_text: chunks[i],
        dark_request: false,
        media: {
          media_entities: [],
          possibly_sensitive: false,
        },
        semantic_annotation_ids: [],
      };

      if (i > 0 && tweetIds.length > 0) {
        variables.reply = {
          in_reply_to_tweet_id: tweetIds[tweetIds.length - 1],
          exclude_reply_user_ids: [],
        };
      }

      const body = JSON.stringify({
        variables,
        features: GRAPHQL_FEATURES,
        queryId,
      });

      const url = `https://x.com/i/api/graphql/${queryId}/CreateTweet`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `Scraper: failed to post tweet ${i + 1}/${chunks.length}: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody.slice(0, 200)}` : ''}`,
        );
      }

      const json = (await response.json()) as Record<string, unknown>;
      const tweetResult = json?.data as Record<string, unknown> | undefined;
      const createResult = tweetResult?.create_tweet as
        | Record<string, unknown>
        | undefined;
      const tweetResults = createResult?.tweet_results as
        | Record<string, unknown>
        | undefined;
      const result = tweetResults?.result as
        | Record<string, unknown>
        | undefined;
      const restId = result?.rest_id as string | undefined;

      if (!restId) {
        throw new Error(
          `Scraper: posted tweet ${i + 1}/${chunks.length} but could not extract tweet ID from response`,
        );
      }

      tweetIds.push(restId);
      logger.info('Posted tweet via scraper', {
        index: i + 1,
        total: chunks.length,
        id: restId,
      });

      if (i < chunks.length - 1) {
        await sleep(1500);
      }
    }

    return tweetIds;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
