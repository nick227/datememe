# AI List Generation Runbook

This document is the single entrypoint for AI agents generating and processing lists for the Datememe catalog. It is an operator runbook: the agent makes content decisions; the pipeline makes infrastructure decisions.

## Goal
Generate useful new Lists without duplicating the catalog.

## Before Generating
1. **Read `catalog/review/coverage.production.json` first.** Refresh it with the command below. Generate only in domains marked `missing` or `thin`, and none in `overrepresented` ones. Check `flaggedLists` so you don't add another copy of a list already flagged as a duplicate.
   ```bash
   DATABASE_URL="$(railway variables --service MySQL --environment production --kv | sed -n 's/^MYSQL_PUBLIC_URL=//p')" \
     REVIEW_ENV=production pnpm --filter worker exec tsx src/scripts/catalog-audit.ts
   ```
   Every `pnpm prod:publish-catalog` run also rewrites it. The domains and their targets live in `catalog/domains.json`.
2. Read `catalog/lists/*.json`
3. Inspect existing groups and entity types
4. Avoid semantic duplicates

## Generate
5. Create list JSON only (in `catalog/lists/`).
6. AI supplies names and content, **not** IDs, slugs, QIDs, or media paths.
7. Follow value-count and list-rule constraints.

### List File Format (`catalog/lists/*.json`)
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
- **Every list offers exactly its own values** (its `CategoryEntity` rows); re-importing with more values adds them. No list ever offers "every value of its type" (legacy lists were snapshotted on 2026-09-29, `curate-all-lists.ts`), so a new value never appears anywhere it wasn't named. A `"pool"` field is ignored.
- A title that matches an existing category must use that category's entity type — otherwise the import is refused.
- **Growing a broader list is explicit:** `"alsoExpands": ["Top Movies"]` adds this list's values to that existing list of the same type too (validation prints `also Top Movies +N`). An unknown title or a list of another type is an error; a list edited in Admin is left alone with a warning, like the list itself.
- An unknown `groupSlug` is an error unless the list declares `"createGroup": { "label": "…" }` (same rule as `createEntityType`; other lists in the batch may then use that group).
- Every new list needs a cover brief in `catalog/cover-briefs.json`.
- `groupSlug` must exist. An unknown `entityTypeSlug` is an error unless `createEntityType` says the new type is intentional.
- `values` may also be `{ "name": "…" }` objects. Duplicates (by key) are errors.
- Re-importing never modifies an existing category or entity — edits made by admins in production win.

**Identity:** Slugs come from `key()` (e.g., "Pelé" → `pelé`). A value resolves to an existing entity by key, exact name, or exact alias; matching two different entities is an error, not a guess.

## Validate
8. Run the catalog validator/import dry-run against the local DB.
9. Stop on ambiguity or errors; **never** "fix" identity by guessing.

## Publish
10. Run `pnpm prod:publish-catalog --dry-run`
11. Review summary.
12. Run `pnpm prod:publish-catalog`

## Canonical Commands

The orchestrator owns catalog import, identity review routing, Railway media sync, rankings rebuild, and audits. You only need to run:

```bash
# 1. Creative, local: write AI output to catalog/lists/<batch>.json
pnpm --filter server catalog:validate

# 2. Deterministic, production: commit the file, then
pnpm prod:publish-catalog --dry-run
pnpm prod:publish-catalog                 # add --identities to also resolve entity images (optional)
```

### Publishing from a clean copy
The preflight refuses uncommitted changes under `apps/server` and `packages/*`, even ones unrelated to the catalog. When other work is in progress, commit only the catalog files, push, and publish from a worktree of HEAD inside the repo (so the Railway CLI link still applies):
```bash
echo '/.pubwt/' >> .git/info/exclude            # once
git worktree add --detach .pubwt HEAD && cd .pubwt
pnpm install --frozen-lockfile --prefer-offline
pnpm --filter @project/db exec prisma generate && pnpm --filter "./packages/*" build
cp -a ../catalog/review catalog/ && cp ../.env .env   # review files are gitignored
pnpm prod:publish-catalog                         # then pick covers in catalog/review/covers.production.json, --apply-review
cp -a catalog/review/. ../catalog/review/ && cd .. && git worktree remove --force .pubwt
```

## Media Safety
13. Never fetch or store production media locally.
14. Never use free-text first-result image matching.
15. Media identity must be verified.
16. Media sync runs inside Railway only.
17. Existing valid assets are skipped.
18. Known misses are cached and rechecked later.

### Images: Identity First
`media:sync` only fetches images for entities with a **verified Wikidata identity**:
- `fixture`: hand-reviewed in `apps/server/src/scripts/taxonomyMediaFixtures.ts`
- `auto-strict`: label/alias equals the name **and** its P31 class is allowed for the type **and** it is the only such item **within the top 10 search results** (a lone match deeper in the results is usually an obscure namesake, so it goes to review)
- `review`: approved in `catalog/review/identities.<environment>.json` (one file per database, since entries are keyed by entity ID)
- `admin`: admin attached an image in the app

Everything else goes to `catalog/review/identities.<environment>.json` (`identities.production.json` for a production run). Set `"approve"` to a QID or `"none"`, then `pnpm prod:publish-catalog --apply-review`. Pending review never blocks a publish. **Entity types not in `identity-classes.json` are never auto-identified**.

Allowed classes live in `catalog/identity-classes.json`; `media:identify` reads `identity-classes.generated.json`, which adds every P279* subclass (so "action role-playing game" counts as a video game). *Human* and *literary work* are deliberately not expanded — their subclasses are roles and comics/songs, not people or books. After editing the source, regenerate: `pnpm --filter server exec tsx src/scripts/generate-identity-classes.ts` (identify refuses a stale generated file).

### List covers
Lists carry the imagery; values are shown as text (mobile `ui/mediaPolicy.ts`, `SHOW_VALUE_IMAGES = false`). A list's cover is **picked by a person**: `covers:propose` searches Openverse with the list's brief in `catalog/cover-briefs.json` (2–3 words; every word must match) for reusable wide images from approved hosts (StockSnap, Rawpixel, Wikimedia, Flickr; CC0 first) and writes 6 candidates per list to `catalog/review/covers.<env>.json` plus a `.html` contact sheet. Set `"approve"` to a number (1–6), an Openverse id, or `"none"`, then `pnpm prod:publish-catalog --apply-review`; `media:sync` downloads approved covers in the container at up to 1600px with their credit. New lists need a brief.

Every list shows its **own** cover, and no two active lists share one. Until a person picks one, `media:sync` assigns a cover from each list's choices (in list order; a broad list uses its type's most-used entities), reusing the stored file. A list with no unused image among its choices shows the placeholder — never another list's photo, never its type's photo. `audit:media` fails on a shared cover.

## Production Safety
19. All stages must be idempotent.
20. Never bypass audit or repair guards.
21. Ambiguous identities go to review.
22. Final audit must pass.

**The one rule**: DB-only work may run locally against Railway MySQL. Anything that writes media files runs inside Railway (`railway ssh --service server -- …`), because only the container sees the volume. `assertMediaWritesAreServable()` refuses media writes anywhere else.

## DO NOT:
- invent or edit QIDs casually
- write directly to production tables by ad-hoc SQL
- upload local media into production
- alter Railway volume paths
- bypass duplicate/entity resolution
- weaken media quality gates to make an import pass
- run destructive repair without dry-run first
