# AGENT.md

## Project Summary

X AI Weekly Bot est une application full-stack TypeScript qui scrape une timeline X (Twitter), filtre les contenus liés à l'IA via GitHub Models, et publie un résumé hebdomadaire sous forme de thread. Le projet inclut un tableau de bord React pour la configuration et le monitoring.

## Essential Commands

```bash
npm install          # Install dependencies
npm run build        # Build backend + frontend (required before running)
npm run dev          # Run with .env loading (scheduler mode)
npm run dev:once     # Single run (no cron, for testing)
npm run lint         # ESLint
npm run format       # Prettier
```

## Project Structure

- `src/` — Backend TypeScript (Hono server, scraper, AI filter, DB)
- `frontend/` — React 19 SPA (dashboard, settings, setup wizard)
- `src/scheduler.ts` — Production entry point (web server + cron)
- `src/server.ts` — REST API endpoints
- `src/adapters/scraper-reader.ts` — X GraphQL web scraper
- `src/config.ts` — Zod-based config validation
- `src/db.ts` — SQLite schema and initialization

## Code Conventions

- TypeScript strict mode, ESM modules
- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- French for user-facing text; English for code and comments
- Zod for all validation
- No credentials in logs or API responses

## Development Workflow

1. Create a feature branch from `main`
2. Use conventional commit messages
3. Push to `main` triggers CI: lint → build → Docker → deploy
4. CI auto-detects release type (major/minor/patch) from commits

## Important Notes

- **Never commit `.env`** — contains real credentials
- **Never modify `data/`** — contains the SQLite database (gitignored)
- **Always run `npm run build`** after modifying TypeScript or React code
- **Always run `npm run lint`** before committing
- X scraping uses session cookies, not the official API — handle auth_token and ct0 carefully
- GraphQL IDs change periodically — the scraper handles this automatically
- The web dashboard must work in "setup mode" (no credentials) — don't break the boot path
