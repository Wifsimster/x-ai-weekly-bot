# 0002. Scraper parse instrumentation and resilience

Date: 2026-03-17

## Status

Accepted

## Context

The X timeline scraper (`scraper-reader.ts`) silently drops most entries during parsing, resulting in runs that collect only 1-2 messages despite X returning 40+ entries per page. The `parseTweetEntry()` function has 5 distinct `return null` paths with no logging, making it impossible to diagnose data loss without modifying the code.

Additionally, `parseHomeTimelineResponse()` only processes `TimelineTimelineItem` entries, ignoring `TimelineTimelineModule` entries that contain conversation threads and grouped messages — a significant portion of any active timeline.

The bare `catch {}` on line 368 swallows all exceptions including structural errors from X API changes, creating a blind spot that can cause the entire pipeline to silently produce zero output.

## Decision

We will add structured parse instrumentation to the scraping pipeline and expand parsing coverage to handle additional entry types.

Specifically:
1. Track a `ParseStats` object through `fetchRecentTweets()` → `parseTweetEntry()` that counts raw entries, successful parses, and drops by reason (no result, no legacy, schema fail, retweet unparseable, tombstone, exception).
2. Handle `TimelineTimelineModule` entries by unwrapping their `items[]` array and feeding each sub-item through the existing `parseTweetEntry()` pipeline.
3. Detect `TweetTombstone` and `TweetUnavailable` via `__typename` and skip them intentionally (counted, not silent).
4. Fix retweet parsing to also try the `['result', 'tweet', 'legacy']` path for retweets wrapped in `TweetWithVisibilityResults`.
5. Replace the bare `catch {}` with a logged catch that records the error at `warn` level.
6. Emit a `warn`-level alert when the drop rate exceeds 80%, signaling a possible API structure change.

## Consequences

### Positive
- Every raw entry from X is now accounted for in structured logs — diagnosing collection issues no longer requires code changes
- Conversation threads and grouped messages are now collected, significantly increasing message volume
- Retweets of visibility-limited tweets are no longer silently dropped
- High drop rates surface as warnings, enabling early detection of X API changes

### Negative
- Slightly increased log volume from parse stats (one structured JSON line per `fetchRecentTweets` call)
- Module unwrapping may introduce duplicate tweet IDs that hit the `INSERT OR IGNORE` dedup — not harmful but inflates the `fetched` count relative to `newTweets`

### Neutral
- The `ParseStats` object is internal to the scraper closure — no API or schema changes needed

## Alternatives Considered

### Use a third-party Twitter scraping library
Libraries like `rettiwt-api` or `agent-twitter-client` would replace the custom parser. Rejected because: it trades one fragile parser for another with the added risk of an npm dependency we don't control; the session cookie approach is correct, only the parsing layer needed work.

### Add a full discriminated union return type
A `ParseResult = { status: 'ok'; tweet: Tweet } | { status: 'skipped'; reason: ... }` return type for `parseTweetEntry()` was considered. Rejected for now: the stats counter approach achieves the same observability with less refactoring. Can be revisited if parseTweetEntry needs to expose drop reasons to callers.

## Participants

- SOLID Alex (Senior Backend Engineer) — Instrument first, fix second. Advocated for structured ParseResult union and regression test fixtures.
- Edge-Case Nico (QA Engineer) — Identified 6 silent-drop edge cases including `__typename` wrappers and retweet visibility paths. Pushed for test harness.
- Whiteboard Damien (Tech Lead / Architect) — Two-phase approach: instrument then expand. Proposed canary metric for drop rate alerting.

---
_Decision recorded automatically from fast-meeting analysis._
