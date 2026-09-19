# Datememe

A favorites-based match-making app: profiles are ranked "favorites" lists (bands, movies, jobs, fruits, IDEs, games, streamers, authors...) instead of bio/photos. See `docs/project-requirements.md` and `docs/data-schema-proposal.md` for the product and data-model rationale — this monorepo implements them.

## Stack

- **Database:** MySQL via Prisma (`packages/db`)
- **API contract:** OpenAPI 3.0 (`packages/api-spec/openapi.yaml`) — the single source of truth for every route
- **API client + hooks:** framework-agnostic React Query hooks (`packages/sdk`) — consumed by both the server's tests and the mobile app
- **Server:** Fastify + `fastify-openapi-glue` (`apps/server`) — spec-driven routing, no hand-registered routes
- **Mobile app:** Expo (React Native + TypeScript) (`apps/mobile`) — the only frontend; there is no web app in this pass

## Setup

1. You need a MySQL (or MariaDB) server reachable locally. Create a database and user, e.g.:
   ```sql
   CREATE DATABASE datememe_dev;
   CREATE USER 'datememe'@'localhost' IDENTIFIED BY '<password>';
   GRANT ALL PRIVILEGES ON datememe_dev.* TO 'datememe'@'localhost';
   ```
2. `cp .env.example .env` and fill in `DATABASE_URL` with those credentials.
3. `cp apps/mobile/.env.example apps/mobile/.env` — the default `EXPO_PUBLIC_API_URL` works for iOS simulator / Expo web; see the comments in that file for Android emulator / physical device.
4. `pnpm bootstrap` — installs dependencies, generates the Prisma client, pushes the schema, generates SDK types, seeds demo data (two users: `alice@example.com` / `bob@example.com`, password `password123`).

## Dev

```bash
pnpm --filter server dev     # API at http://localhost:3002 (Swagger UI at /docs) — port set via PORT in .env; 3001 is taken by another project on this machine
pnpm --filter mobile start   # Expo dev server — press i/a/w for simulator/emulator/web
```

## Commands

| Command | Description |
|---|---|
| `pnpm bootstrap` | First-run: install, push schema, generate SDK, seed |
| `pnpm typecheck` | TypeScript check across every package |
| `pnpm test` | Run all tests |
| `pnpm sdk:generate` | Regenerate SDK types from the OpenAPI spec |
| `pnpm sdk:check` | Fail if committed SDK types have drifted from the spec |
| `pnpm db:push` | Push the Prisma schema to the database |
| `pnpm db:seed` | Re-run the seed script |
| `pnpm db:studio` | Open Prisma Studio |

## What's implemented

The full MVP loop from `docs/project-requirements.md` §5: register → onboarding (categories/lists) → build a list with autocomplete → swipe (Like/Pass, with a compatibility percentage + insight highlights) → match → message (with the free/premium gates from §4.1) → subscribe (simulated).

See `CLAUDE.md` for phase status and known follow-ups (real Apple/Google IAP wiring, drag-to-reorder in the list builder, the moderation admin panel, and a live-database smoke test — this pass validated the stack via `prisma generate`, spec lint, SDK generation, full-workspace typecheck, server unit tests, and an Expo Metro export, but couldn't reach a live MySQL instance in this environment to run `db:push`/`db:seed`/a real request end-to-end).
