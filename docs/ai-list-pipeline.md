# AI list pipeline

How AI-generated lists get from a local file into a Railway environment, with images.

**The principle:** AI proposes content — titles, prompts, value names. Code owns everything with identity or side effects: slugs, entity resolution, Wikidata identities, image files, publication, derived data.

## The two commands

```bash
# 1. Creative, local: write AI output to catalog/lists/<batch>.json (format below)
pnpm --filter server catalog:validate              # against your local DB

# 2. Deterministic, production: commit the file, then
pnpm prod:publish-catalog                          # --dry-run first if unsure
```

`prod:publish-catalog` (`scripts/prod-publish-catalog.ts`) only coordinates. Every stage below is its own idempotent command; the run stops at the first failure, and re-running is always safe — that is how you resume.

| Stage | Where it runs | What it does |
|---|---|---|
| preflight | local | Refuses unless the code here matches what Railway runs (`git diff <deployed> HEAD -- apps/server packages/db packages/api-spec`) and `catalog/` is committed. Reads the MySQL proxy URL from `railway variables` — never stored on disk. |
| `catalog:validate` | local → Railway MySQL, read-only | Schema, duplicate titles/values, groups and entity types exist. |
| `catalog:publish` | local → Railway MySQL | `ListImporterService`: creates missing categories and entities, reuses existing ones. |
| `media:identify` | local → Railway MySQL + Wikidata | Decides which Wikidata item each entity is (below). |
| `media:sync` | **inside the server container** | Fetches images for verified identities into `/app/uploads`. Repeated until `remaining` is 0. |
| `derived:enqueue` | local → Railway MySQL | Queues a rankings rebuild; the worker runs it. |
| audit | **inside the server container** | `audit-media.ts`: DB URLs ↔ files on the volume ↔ verified identities. |

**The one rule:** DB-only work may run locally against Railway MySQL. Anything that writes media files runs inside Railway (`railway ssh --service server -- …`), because only the container sees the volume. `assertMediaWritesAreServable()` refuses media writes anywhere else — the 2026-09-26 incident was a local run that saved 172 images to a laptop and their `localhost` URLs to production.

## List file format (`catalog/lists/*.json`)

A file holds one list or an array of lists — one file per generated batch is the convention.

```json
{
  "schemaVersion": 1,
  "groupSlug": "food-drink",
  "entityTypeSlug": "snack",
  "createEntityType": { "label": "Snack", "pluralLabel": "Snacks" },
  "title": "Favorite Road Trip Snacks",
  "prompt": "Rank your go-to road trip snacks.",
  "axes": ["food", "travel"],
  "values": ["Beef Jerky", "Potato Chips", "Trail Mix", "…at least 8"],
  "isAbstract": false
}
```

- No IDs, slugs, QIDs, image URLs or database fields. Anything extra is ignored; code derives all of it.
- `groupSlug` must exist. An unknown `entityTypeSlug` is an error unless `createEntityType` says the new type is intentional.
- `values` may also be `{ "name": "…" }` objects. Duplicates (by key) are errors.
- Re-importing never modifies an existing category or entity — edits made by admins in production win.

**Identity:** slugs come from `key()` (`apps/server/src/lib/identityKey.ts`, Unicode-aware: "Pelé" → `pelé`). A value resolves to an existing entity by key, the pre-2026-09-27 ASCII key, exact name, or exact alias; matching two different entities is an error, not a guess.

## Images: identity first

`media:sync` only fetches images for entities with a **verified Wikidata identity** — an `EntityExternalRef` (provider `wikimedia`) whose metadata has a `verification` record:

| method | source |
|---|---|
| `fixture` | hand-reviewed in `apps/server/src/scripts/taxonomyMediaFixtures.ts` (authoritative for its entities) |
| `auto-strict` | `media:identify`: the item's label/alias equals the name **and** its P31 class is allowed for the type in `catalog/identity-classes.json` **and** it is the only search result passing both |
| `review` | you approved it in `catalog/review/identities.json` |
| `admin` | an admin attached an image for that QID in the app |

Everything `media:identify` can't auto-accept goes to `catalog/review/identities.json` (gitignored working state) with its candidates and their descriptions. Set `"approve"` to a QID or `"none"`, then `pnpm prod:publish-catalog --apply-review`. Pending review never blocks a publish.

There is no name-search fallback anywhere in the automatic path. Name matching alone produced "Alien" → *invasive species*, "Catan" → *Catania*, "Go" → *Goiás*.

**Entity types not in `identity-classes.json` are never auto-identified** (memes, slang, emotes…). Add a type only with classes you have checked — the current list was derived from the classes of the verified fixtures.

**Redundancy and cost:** a servable image is never re-fetched; a missing, unlicensed or quality-rejected image is remembered for `RECHECK_DAYS` (30); identical bytes are stored once (sha256). Images are normalized once to ≤1000px WebP (~100 KB). Wikimedia calls are serial with a 5 s gap (sync) or backoff on 429 (identify); a rate-limited run stops cleanly and resumes next time.

## Maintenance commands

All under `pnpm --filter server …`:

- `audit:media` — read-only consistency report; exit 1 on problems. Inside the container for production.
- `repair:taxonomy-media [--apply]` — fixes what the audit reports (dry run by default).
- `verify:media-fixtures` — prints each fixture beside Wikidata's label and description. Run after editing fixtures; read the descriptions.
- `media:identify --apply-review` — apply review decisions (the orchestrator's `--apply-review` does this against Railway).

## Not part of this pipeline

- The in-app **Content factory** (`CatalogService`, Admin → Content) is a separate, admin-reviewed generation flow that publishes directly; it shares `key()` but not these files.
- `apps/worker/src/scripts/map-axes.ts`, `seed-new-categories.ts` — one-off migrations.
