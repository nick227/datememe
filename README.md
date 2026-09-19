# Datememe

A favorites-based match-making app: profiles are ranked "favorites" lists (bands, movies, jobs, fruits, IDEs, games, streamers, authors...) instead of just bio/photos, then matched via a swipe (Like/Pass) flow with a computed compatibility score. See `docs/project-requirements.md` and `docs/data-schema-proposal.md` for the product and data-model rationale — this monorepo implements them (v2/v3 per those docs' changelogs).

## Stack

- **Database:** MySQL via Prisma (`packages/db`)
- **API contract:** OpenAPI 3.0 (`packages/api-spec/openapi.yaml`) — the single source of truth for every route
- **API client + hooks:** framework-agnostic React Query hooks (`packages/sdk`) — consumed by both the server's tests and the mobile app
- **Server:** Fastify + `fastify-openapi-glue` (`apps/server`) — spec-driven routing, no hand-registered routes
- **Background worker:** polling job processor (`apps/worker`) — claims rows from a `JobQueue` MySQL table (`FOR UPDATE SKIP LOCKED`) and runs match-calculation, taxonomy-update, and push-notification jobs
- **Mobile app:** Expo (React Native + TypeScript) (`apps/mobile`) — the primary frontend, also exportable as a static web SPA via `react-native-web` (`expo export --platform web`)

## Repo layout

```
apps/
  server/   Fastify API
  worker/   background job processor
  mobile/   Expo app (native + web export)
packages/
  db/       Prisma schema + client
  api-spec/ OpenAPI spec (source of truth)
  sdk/      generated API types + React Query hooks
docs/       product requirements & data-schema proposal
```

## Setup

1. You need a MySQL (or MariaDB) server reachable locally. Create a database and user, e.g.:
   ```sql
   CREATE DATABASE datememe_dev;
   CREATE USER 'datememe'@'localhost' IDENTIFIED BY '<password>';
   GRANT ALL PRIVILEGES ON datememe_dev.* TO 'datememe'@'localhost';
   ```
2. `cp .env.example .env` and fill in `DATABASE_URL` with those credentials.
3. `cp apps/mobile/.env.example apps/mobile/.env` — the default `EXPO_PUBLIC_API_URL` works for iOS simulator / Expo web; see the comments in that file for Android emulator / physical device.
4. `pnpm bootstrap` — installs dependencies, generates the Prisma client, pushes the schema, generates SDK types, seeds demo data (users `alice@example.com` / `bob@example.com` / `carol@example.com`, password `password123`).

## Dev

```bash
pnpm dev                       # server + worker + mobile dev servers, in parallel
pnpm --filter server dev       # API only, at http://localhost:3002 (Swagger UI at /docs)
pnpm --filter worker dev       # background job processor only
pnpm --filter mobile start     # Expo dev server — press i/a/w for simulator/emulator/web
pnpm --filter mobile run web   # Expo dev server, web target directly
```

Port 3002, not 3001 — 3001 is occupied by an unrelated project on this machine; see `PORT` in `.env`.

## Commands

| Command | Description |
|---|---|
| `pnpm bootstrap` | First-run: install, push schema, generate SDK, seed |
| `pnpm dev` | Run every app's dev server in parallel |
| `pnpm typecheck` | TypeScript check across every package |
| `pnpm test` | Run all tests |
| `pnpm sdk:generate` | Regenerate SDK types from the OpenAPI spec |
| `pnpm sdk:check` | Fail if committed SDK types have drifted from the spec |
| `pnpm db:push` | Push the Prisma schema to the database |
| `pnpm db:seed` | Re-run the seed script |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm --filter mobile run export:web` | Build the static web bundle to `apps/mobile/dist` |

## Deployment

Configured for Railway as three services sharing one MySQL plugin, each pinned to its own committed config-as-code file at the repo root (all three build from the full monorepo tree, not an isolated subfolder, since `apps/server` resolves `packages/api-spec/openapi.yaml` by relative path and everything shares pnpm workspace deps):

| Service | Config | Runs |
|---|---|---|
| `server` | `railway.server.json` | Fastify API, `node apps/server/dist/index.js` |
| `web` | `railway.web.json` | static Expo-web export, served via `serve -s` |
| `worker` | `railway.worker.json` | background job processor, no HTTP/port |

`EXPO_PUBLIC_API_URL` on the `web` service is a **build-time** var (Expo inlines it into the bundle) — point it at the `server` service's public domain and redeploy `web` whenever that domain changes. Uploaded media (`STORAGE_PROVIDER=local`) needs a Railway Volume mounted at `apps/server/uploads` or it won't survive a redeploy.

## What's implemented

The full MVP loop from `docs/project-requirements.md` §5: register (with email verification + password reset, both OTP-style) → onboarding (categories/lists) → build a list with autocomplete → swipe (Like/Pass, with a compatibility percentage + insight highlights) → match → message (with the free/premium gates from §4.1) → subscribe (simulated, no real Apple/Google IAP yet). Also: rarity-weighted discovery, a safety baseline (block/report, backend-only), real photo upload, and a background worker for match calculation, taxonomy updates, and push notifications.

See `CLAUDE.md` for full phase status and session-by-session history.

## Known follow-ups

- Admin / moderation panel and the `JobQueue`-backed worker are mid-implementation — `apps/server` won't currently pass `pnpm typecheck` until that work lands (a few exports/types the new code references don't exist yet).
- Safety (block/report), media upload, and auth-completion flows are backend-only — no mobile screens wired up yet.
- No real Apple/Google IAP, no drag-to-reorder in the list builder, no search-engine sync (MVP autocomplete is MySQL prefix/FULLTEXT + in-process Levenshtein).
- No iOS/Android simulator verification yet in this environment — verified via live HTTP testing and a headless-Chromium (`react-native-web`) pass instead.
