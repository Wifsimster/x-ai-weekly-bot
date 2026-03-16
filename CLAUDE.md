# CLAUDE.md

## Project Overview

X AI Weekly Bot — a full-stack TypeScript application that scrapes an X (Twitter) timeline, filters AI-related content using GitHub Models, and publishes weekly summary threads. Includes a React web dashboard for configuration and monitoring.

## Tech Stack

- **Runtime:** Node.js >= 24 (ES2024, ESM)
- **Backend:** Hono v4 (HTTP framework), TypeScript strict mode
- **Database:** SQLite via better-sqlite3 (WAL mode)
- **AI:** OpenAI SDK v6 targeting GitHub Models endpoint
- **Scheduling:** node-cron
- **Frontend:** React 19, React Router 7, Vite
- **Styling:** Tailwind CSS 4, Radix UI primitives, Lucide icons
- **Validation:** Zod schemas

## Project Structure

```
src/                        # Backend TypeScript
├── scheduler.ts            # Entry point — boots web server + cron
├── index.ts                # One-shot run (for testing)
├── server.ts               # Hono REST API
├── config.ts               # Zod config validation
├── db.ts                   # SQLite schema + initialization
├── run-service.ts          # Run orchestration + DB tracking
├── ai-filter.ts            # GitHub Models AI integration
├── x-client.ts             # X client factory
├── settings-service.ts     # DB-backed settings persistence
├── ports.ts                # Interface definitions (Tweet, TweetReader)
├── logger.ts               # JSON structured logging
└── adapters/
    └── scraper-reader.ts   # X GraphQL web scraper

frontend/                   # React SPA
├── src/
│   ├── App.tsx             # Route definitions
│   ├── pages/              # Dashboard, Runs, Settings, Setup
│   ├── components/         # Radix/shadcn-ui components
│   └── hooks/use-api.ts    # API fetching hook
└── vite.config.ts

.github/workflows/release.yml  # CI/CD pipeline
deploy/deploy.sh               # Production deploy script
Dockerfile                     # Multi-stage build
compose.yml                    # Docker Compose config
```

## Commands

```bash
npm install          # Install dependencies
npm run build        # Build backend (tsc) + frontend (vite)
npm run dev          # Run scheduler with .env loading
npm run dev:once     # One-shot run (no cron)
npm run lint         # ESLint on src/
npm run format       # Prettier formatting
npm run start        # Production start (scheduler)
```

## Architecture Patterns

- **Config merging:** Environment variables are the base; DB settings override them (`tryLoadConfigWithOverrides`)
- **Boot vs full config:** `loadBootConfig()` for web server startup (minimal), `loadConfig()` for full run
- **Run tracking:** Every scrape/filter/publish cycle is a "run" tracked in SQLite with status, metadata, and summary
- **Concurrency guard:** Only one run at a time (checked in `run-service.ts`)
- **Adapter pattern:** `TweetReader` interface in `ports.ts`, implemented by `scraper-reader.ts`
- **Frontend served by backend:** Hono serves the built React SPA via `serveStatic`

## Code Conventions

- TypeScript strict mode, ESM imports
- Single quotes, semicolons, 2-space indent (Prettier defaults)
- French user-facing text (AI prompts, UI labels, log messages for users)
- English for code, comments, and variable names
- Zod for all config/input validation
- Structured JSON logging via `logger.ts`
- Credentials are never logged or exposed in API responses (masked to last 4 chars)

## Git Workflow

- Branch: `main` is the production branch
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- CI triggers on push to `main` — auto-detects release type from commit messages
- Version bumps are automated by CI (skip `chore: bump version` commits)

## Key Notes

- X scraping uses session cookies (auth_token + ct0), NOT the official API
- GraphQL operation IDs change periodically — the scraper auto-detects new ones from x.com JS bundles
- The web dashboard works in "setup mode" even without credentials configured
- SQLite database lives in `./data/bot.db` (Docker volume at `/app/data`)
- Docker container runs as non-root user `bot` (uid 1001)
