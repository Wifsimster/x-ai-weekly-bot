# 0001. Hourly tweet collection with daily publish summarization

Date: 2026-03-17

## Status

Accepted

## Context

The bot previously ran once daily at 07:30, scraping the X timeline and immediately summarizing found tweets. This single-shot approach missed tweets posted outside the scraping window — the home timeline only shows recent content, so tweets from earlier in the day were lost by the time the 07:30 run executed.

The user requested the bot run every hour to capture tweets throughout the day, progressively building a more comprehensive corpus, and publish a single high-quality summary at 07:30.

## Decision

We split the pipeline into two independent phases with separate cron schedules:

1. **Hourly Collection** (`0 * * * *`): Scrapes the timeline and stores raw tweets in a new `tweets` SQLite table, deduplicated by tweet ID via `INSERT OR IGNORE`. No AI call, no summary generation. Lightweight and fast.

2. **Daily Publish** (`30 7 * * *`): Performs one final collection sweep, then reads all accumulated unpublished tweets for the day from the `tweets` table, generates a single AI summary, marks tweets as consumed, and sends the Discord notification.

The two phases use separate concurrency guards so a collection run never blocks the publish run. Each phase is tracked independently in the `runs` table with distinct `trigger_type` values (`collect` vs `cron`/`manual`).

## Consequences

### Positive
- 24x more tweet coverage per day for the same AI cost (1 API call/day)
- Natural deduplication via SQLite primary key eliminates duplicate tweets across hourly fetches
- Clean separation of concerns: collection is pure data ingestion, summarization is pure AI processing
- Both schedules are independently configurable via the dashboard

### Negative
- 24x increase in X scraping frequency raises the risk of rate limiting or session cookie invalidation
- The `runs` table will contain ~24 additional lightweight `collect` entries per day, requiring UI filtering
- New `tweets` table adds storage overhead (though minimal for text data)

### Neutral
- The monthly summary system continues to work unchanged — it aggregates from `runs` with `status = 'success'`, which only publish runs produce
- The existing single-shot mode (`npm run dev:once`) still works as before via the `run()` function

## Alternatives Considered

### Progressive AI summarization (re-summarize every hour)
Call the AI every hour to iteratively refine a draft summary with newly accumulated tweets. Rejected because: 24x AI API cost increase for marginal quality improvement; the AI model is not stateful so each call is a full regeneration, not an "improvement"; no consumer reads intermediate summaries before 07:30.

### Single cron with time-of-day branching
Keep one cron running hourly and use `if (hour === 7 && minute === 30) publish else collect` logic. Rejected because: couples two concerns into one schedule with fragile time-based branching; impossible to reschedule collection and publication independently; harder to test and reason about.

### In-memory tweet accumulation
Store tweets in a runtime array instead of SQLite. Rejected because: Docker container restarts would lose all accumulated tweets; no durability guarantee; SQLite is already available and `INSERT OR IGNORE` on a text primary key is effectively free.

## Participants

- SOLID Alex (Senior Backend Engineer) — Advocated for new `tweets` table with `INSERT OR IGNORE`, two named cron tasks, and Strategy pattern for handlers
- Whiteboard Damien (Tech Lead / Architect) — Confirmed two-phase architecture with `tweets` table as buffer; pushed back on progressive AI summarization
- Sprint Zero Sarah (Product Owner) — Prioritized shipping fast with minimal changes; confirmed no user value in intermediate summaries
- Edge-Case Nico (QA Engineer) — Identified concurrency collision risk at 07:30 and tweet dedup edge cases; recommended separate concurrency guards

---
_Decision recorded automatically from fast-meeting analysis._
