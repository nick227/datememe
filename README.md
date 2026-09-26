# Datememe 💘

Welcome to **Datememe**! We're rethinking match-making by focusing on what you actually care about. Instead of endless bios and generic photos, profiles here are built entirely out of your **ranked favorites**—from your top 90s bands to your essential streaming services. 

Match with people who share your vibe, get a computed compatibility score, and start conversations that actually matter.

## 🏗️ What's Under the Hood

This is a modern, full-stack monorepo built for speed and type safety:

- **Database:** MySQL powered by Prisma (`packages/db`)
- **API Contract:** OpenAPI 3.0 (`packages/api-spec/openapi.yaml`) — our single source of truth.
- **API Client:** Generated React Query hooks (`packages/sdk`) for seamless frontend integration.
- **Backend:** Fastify API (`apps/server`) and a robust background worker (`apps/worker`) for crunching compatibility scores and handling notifications.
- **Frontend:** Expo (React Native + TypeScript) (`apps/mobile`) for iOS, Android, and Web — the sole DATEMEME UI, including the Admin surface (gated to `role === ADMIN`).

## 📂 Project Structure

```text
apps/
  server/   → Fastify API
  worker/   → Background job processor
  mobile/   → Expo app (native + web export)
packages/
  db/       → Prisma schema, client, and seed logic
  api-spec/ → OpenAPI spec
  sdk/      → Generated API types + React Query hooks
```

## 🚀 Getting Started

Want to spin this up locally? It's super easy.

1. **Database Setup:** You'll need a local MySQL or MariaDB instance. Create a database (e.g., `datememe_dev`).
2. **Environment Variables:** 
   - Run `cp .env.example .env` in the root and fill in your `DATABASE_URL`.
   - Run `cp apps/mobile/.env.example apps/mobile/.env` for your frontend config.
3. **Bootstrap Everything:**
   ```bash
   pnpm bootstrap
   ```
   *This magic command installs dependencies, pushes the database schema, generates the SDK, and seeds the core taxonomy data.*

### 🧪 Test Users
Want to test out the matching flow right away? Run our dedicated user seed script:
```bash
pnpm --filter db run db:seed:users
```
This populates the database with three ready-to-use personas (all use the password `password123`):
- `admin@datememe.com` (Admin features)
- `premium@example.com` (Active subscription + fitness/foodie insights)
- `free@example.com` (Standard user + pop-culture insights)

## 💻 Development

You don't need to start each app manually. To fire up the API, background worker, and mobile bundler all at once, just run:

```bash
pnpm dev
```

*(Note: The API usually defaults to port `3000` or `3001` depending on your `.env` config. The Swagger UI will be available at `/docs`!)*

### Useful Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Starts **all** development servers in parallel. |
| `pnpm typecheck` | Runs TypeScript checks across the entire monorepo. |
| `pnpm db:migrate:dev` | Creates/applies a reviewed migration against a development database. |
| `pnpm db:migrate:deploy` | Applies committed migrations to an initialized database. |
| `pnpm db:push` | Disposable local prototyping only; never staging/production deployment. |
| `pnpm db:studio` | Opens Prisma Studio to easily view your local data. |
| `pnpm sdk:generate`| Regenerates frontend hooks if you change the OpenAPI spec. |

## 🚢 Deployment

For the standalone Android staging APK, see the [Android QA runbook](docs/android-qa-runbook.md). It documents the EAS build, isolated Railway backend, and device verification steps.

Hosted schema changes use committed migrations; see [database and media operations](docs/mobile-data-operations.md) before deploying to an existing database.

Datememe is built to be easily deployed on modern PaaS providers like **Railway** or **Render**. 

It runs as three separate services:
1. **API Server:** `node apps/server/dist/index.js`
2. **Background Worker:** Runs headless to process the `JobQueue`.
3. **Web Frontend:** A static Expo-web export (`apps/mobile/dist`) served via your preferred static host.

*Make sure your API URL is correctly set in your frontend's environment variables at build time!*

## 🛣️ Roadmap

We've completely overhauled the core MVP loop. The matching engine is now mathematically robust—prioritizing rare exact overlaps and utilizing a secondary semantic axis layer to generate meaningful matches even on low evidence. The catalog taxonomy has been rebuilt to ensure a wide breadth of domains (lifestyle, entertainment, food) so the engine can accurately capture a user's vibe.

**Recently Completed:**
- **Smarter Match Engine:** Log-based rarity weighting, mathematically capped axis confidence damping, and configuration extraction (`apps/worker/src/config/scoring.ts`).
- **Broadened Catalog:** Pruned redundancies and added diverse semantic axes (e.g., Weekend Vibe, Comfort Food) to avoid purely entertainment-heavy profiles.
- **Three-Pillar UI Primitive:** A unified, contextual `PreviewListCard` that seamlessly bridges prompt taking, match discovering, and global ranking exploration.

**Up Next:**
- Wait for real-world beta users to tune the provisional `SCORING_CONFIG` parameters (k-shrinkage, axis floor).
- Implement TTL compute-on-read logic for stale scores via `updatedAt`.
- Integrating real Apple/Google In-App Purchases for subscriptions.

---
*Built with ❤️ for better connections.*
