# List Values Runbook

How an AI agent measures and grows the values each list offers, safely, against production. Reading is done by `pnpm prod:list-values`, which never writes to the database. Writing goes only through the catalog pipeline (`docs/ai-list-pipeline.md`), plus reviewed one-off manifest scripts. **Never write list values with ad-hoc SQL.**

## Start here (handoff)

**State on 2026-10-02:** 193 active lists, 4,832 values (average 25.0), smallest list 20. `SHALLOW 0`, `COMPLETE 53`, `BOUNDED 30`, `DEPTH_GAP 110`, total gap 1,740. Every list has exactly one pinned catalog entry. Run `pnpm prod:list-values --limit 0` to get the live numbers. History is in `catalog/review/list-values.production.history.jsonl`, which is gitignored.

**Done:**
- Minimum fill: every list has at least 20 values.
- Compatibility tier: dating, communication and stress, social life, home and routine, money, career and work-life, travel, causes. All at 30 or bounded.
- The 11 canonical lists are at 50+.
- Cleanup pass (`scripts/catalog-cleanup-2026-09-30.ts`).
- The canonical lists' first 20 reordered (`scripts/catalog-reorder-2026-10-01.ts`).

**Next, in this order:**
1. **Taste lists toward 40.** Groups film-tv, music, food-drink, literature, gaming, podcasts, sports, creators and craft, about 64 lists. Select them with `pnpm prod:list-values --status depth-gap --group film-tv` and so on. Batches of about 20, broadest and most-answered first.
2. **Novelty and long tail toward 30.** Groups myths-mysteries, substances, history-politics, tech, plus slang and illusions.
3. **Optional, needs the user's OK:**
   - Add "Clue" as an alias of "Cluedo".
   - Decide what to do with the hidden duplicate list `top-hip-hop-artists`. Leave it alone unless asked.
   - Check any other list whose first 20 aren't its strongest answers. The reorder script is the pattern; it needs a new dated manifest, reviewed by the user before `--apply`.

**Rules the user set, which are not negotiable:**
- Fill toward the target, never to it at the expense of quality. Bound a list instead of padding it.
- Every batch runs in a clean worktree off `origin/main`, and you push only that commit.
- No generic or internal names anywhere a member can see them.
- Substance lists are intentional and candid, and always offer "None of these".
- Anything other than appending (merge, remove, rename, reorder) is a reviewed manifest script, dry run first, applied once after the user approves.

## Terms
- **List** = a `Category` row. **Group** = a `CategoryGroup` (`--group <slug>`, e.g. `food-drink`). **Type** = an `EntityType` (`--type <slug>`). Lists of one type share entities: "Hiking" in Weekend Vibe and in Friend Hangouts is the same entity.
- **values** = the list's `CategoryEntity` rows that are not excluded, whose entity is `APPROVED` and not merged. Pending user submissions show as `pending:N` and never count.
- **floor** = the list's target. **gap** = `max(0, floor - values)`.

## Minimum, targets, statuses
`catalog/value-floor.json` (committed) has two layers:
- **`minimum` (20): the presentation floor.** The builder shows the first 20 values before search, so a list below 20 is **shallow**. The first 20 must be the strongest, most common answers. Appends go after them.
- **Depth targets, which `gap` measures:**
  - `default` 30: compatibility, lifestyle, money, home, career, travel.
  - `types` 28: narrow personality, routine and habit types (social-habit, daily-habit, texting-style, party-role, social-obligation, humor-style, decision-style, planning-style, sleep-preference, sunday-morning).
  - `groups` 40: taste domains (film-tv, music, food-drink, literature, gaming, podcasts, tabletop, sports, creators, craft).
  - `lists` 50: broad canonical lists (Top Movies, Top TV Shows, Books, Authors, Artists, Albums, Video Games, Podcasts, Tabletop Games, Sports Teams, YouTubers). For canonical lists, 50 is a minimum target; strong answers beyond it are fine.

Precedence, first match wins: `--floor N`, then `lists[<category slug>]`, then `types[<type slug>]`, then `groups[<group slug>]`, then `default`. A list's **normal target** is its type's, else its group's, else the default. A `lists` entry below the normal target makes the list **bounded**. When the same honest stopping point repeats across a coherent set of lists, set a `types` or `groups` target instead of adding one override per list.

Statuses, one per row and counted in the summary:
- `shallow`: below the minimum. A product-quality problem; fix these first.
- `depth-gap`: at the minimum, below its target. Incomplete, not broken.
- `complete`: at or past its target.
- `bounded`: meets its own lower `lists` floor. A bounded list's floor is also its minimum.

**Fill toward the target, never to it at the expense of answer quality.** Values 21 and up must still be real answers a member would pick as their own. When a list runs out of those, stop and bound it at that count (`prod:list-append --bound`).

## Commands
```bash
pnpm prod:list-values                                   # summary + every active list
pnpm prod:list-values --limit 0                         # summary + LIST_VALUES marker only (cheapest)
pnpm prod:list-values --status depth-gap --group film-tv --sort gap
pnpm prod:list-values --shallow                         # same as --status shallow
pnpm prod:list-values --list top-movies --values        # names in builder order (≤10 lists per call)
pnpm prod:list-values --type movie --min 10 --max 19
pnpm prod:list-values --json                            # rows as JSON (line 3 of the output)
pnpm prod:list-values --snapshot                        # also append to the progress history
pnpm prod:list-values --selftest                        # verify target + read-only, nothing else
pnpm prod:list-stub --list <slug> [--list <slug>…]      # sync entries from production (writes catalog files)
pnpm prod:list-stub --no-file                           # adopt any list no catalog file defines
pnpm prod:list-append additions.json [--bound]          # append your names to the entries
```
Filters combine (AND). Unknown options, groups and types are errors, not empty results. **Token rule:** read the final `LIST_VALUES {…}` line first, and ask for `--values` only for the lists you are about to fill.

Output notes: `pending:N`, `excluded:N`, `admin-edited`, `no-file` (adopt it with `prod:list-stub --no-file`), `stale` (re-sync it), `inactive`. Values print in builder order (`sortOrder`).

## Batch procedure (exactly as practiced)
One batch = about 20 lists of one tier, shipped as one catalog-only commit. Run every step from the batch worktree.

```bash
# 0. Clean worktree off origin/main (never the main checkout: other sessions commit there)
cd ~/web/datememe && git fetch -q origin
git worktree add -b catalog/<batch> .fillwt origin/main && cd .fillwt
pnpm install --frozen-lockfile --prefer-offline && pnpm --filter @project/db exec prisma generate && pnpm --filter "./packages/*" build
cp ../.env .env && cp -a ../catalog/review catalog/      # .env and review files are gitignored

# 1. Pick targets
pnpm prod:list-values --status depth-gap --group <group> --sort gap --json

# 2. Sync their entries. Expect "unchanged"; "synced" means the file had drifted (now fixed)
pnpm prod:list-stub --list <slug> --list <slug> …

# 3. Read the current values, ≤10 lists per call
pnpm prod:list-values --list <slug> … --values

# 4. Write additions.json (outside the repo, e.g. the scratchpad), then append
pnpm prod:list-append /path/additions.json            # add --bound when lists honestly stop short

# 5. Validate against production. Retry when the proxy drops (see Pitfalls)
URL="$(railway variables --service MySQL --environment production --kv | sed -n 's/^MYSQL_PUBLIC_URL=//p')"
[ -n "$URL" ] && DATABASE_URL="$URL" pnpm --filter server catalog:validate
#    Required: errors 0, stale 0, newCategories 0; only your targets change; check the reused-entity counts (below)

# 6. Commit, then push exactly this commit
git add catalog && git commit -m "feat(catalog): <batch> — …"
git fetch -q origin && git log --oneline HEAD..origin/main     # behind? → git rebase origin/main (others never touch catalog/)
git push origin HEAD:main

# 7. Publish from the same worktree. Retry on a proxy failure; a failed validate writes nothing
pnpm prod:publish-catalog

# 8. Measure, then clean up only after the push and the publish both succeeded
pnpm prod:list-values --snapshot --limit 0
cp -a catalog/review/. ../catalog/review/ && cd .. && git worktree remove --force .fillwt && git branch -D catalog/<batch>
```

**Check the reuse count in step 5.** A line such as `8 new / 13 existing entities, 10 choices added` means 2 of your names matched entities that already exist in that type. Make sure each is the same thing: the same person, work or idea. A wrong match means the type is leaking. The film list once had films sitting in a TV-series type, for example.

## Writing good values
- **Strongest first.** Common, obvious answers before the long tail. Never filler, rewordings or near-duplicates of existing values ("Meditation" vs "Meditation app").
- **On-type only.** Hip hop artists in Hip Hop, feature films in movie lists (no TV series), bands that were actually active in the 90s, and so on. When unsure, leave it out.
- **Avoid names that are ambiguous between versions** (remakes, reboots: *Beauty and the Beast*, *Ghostbusters*, *It*), unless the existing entity already pins the meaning.
- **Reuse exact names across sister lists of the same type** when you mean the same thing, e.g. "Going to a concert", "Prayer", "Hiking". A slightly different name creates a duplicate entity.
- **Match each list's voice and naming convention:** first-person phrases in habit lists, "Album - Artist" in Top Albums, official names for brands and teams.
- **Political and values lists stay balanced** across the spectrum (Causes You Care About, Political Podcasts, Political Commentators).
- **Substance lists stay candid,** with "None of these" kept.
- **Bound honestly.** Love languages, seasons and drinking styles run out early. That's fine: `--bound`.

## Pinned entries
`prod:list-stub` writes two fields that only code may write; never edit them by hand:
- **`categorySlug`** names the list exactly, whatever the entry's title. A pinned entry never creates a list. Example: Top Hip Hop Artists' title-slug belongs to an inactive duplicate, so it must be pinned.
- **`adminEditedAt`** records the Admin edit the entry was synced from. Admin replaces a list's values wholesale and keeps no record of removals, so the importer adds to an Admin-edited list only while this matches. After a later Admin edit, the entry is `stale`: validation warns and adds nothing. Re-sync with `prod:list-stub`.

The stub keeps a file's spelling only for a name that is the entity's own. After a merge or rename, the kept name wins.

## Safety
- **Target check is mandatory.** The URL comes from `railway variables --service MySQL --environment production` (`MYSQL_PUBLIC_URL`) or `--url`. Its host:port must equal `RAILWAY_DATEMEME_DATABASE_PROXY` in `.env`. Credentials are never printed.
- **Read-only is proven.** One `mysql2` connection, `SET SESSION TRANSACTION READ ONLY`, and a zero-row probe `UPDATE` that must be refused (error 1792) before any read.
- **Anything beyond appending** (merge duplicates, exclude off-type values, rename, reorder) is a dated, fixed-manifest script in `scripts/`, modelled on `catalog-cleanup-2026-09-30.ts`. It runs as a dry run by default. Show the user the dry run, `--apply` once, re-run the dry run to confirm it's idempotent, re-sync the touched entries with `prod:list-stub`, and validate for 0 changes.
  - Removals set `isExcluded`, which hides the value and stops imports re-adding it.
  - Merges follow moderation's convention: `REJECTED` + `mergedIntoId`, saved picks moved, and the old name kept as an alias.

## Pitfalls (all hit for real)
- **The Railway proxy drops connections intermittently** ("Can't reach database server", "Connection lost"). Validation can then fail on a random list. Publish validates before writing, so nothing half-ships. Before a publish, wait for three consecutive `--selftest` passes, and retry the publish up to 3 times.
- **`railway variables` can fail** (a DNS error), leaving `URL` empty. Check `[ -n "$URL" ]` before using it.
- **Interactive Prisma transactions time out after 5 s** over the proxy. Manifest scripts pass `{ timeout: 120_000, maxWait: 30_000 }`. They're idempotent, so after a timeout, fix the script and re-run.
- **Push rejected** because another session pushed. Fetch, rebase or cherry-pick onto `origin/main`, then push again. Keep the worktree until both the push and the publish succeed.
- **The publish preflight refuses** when local server code differs from what's deployed. Publish from the batch worktree, which matches `origin/main`, never from the main checkout. If `origin/main` has undeployed server commits, wait for Railway to deploy them.
- **Server deploys skip** when only root files change (watch paths). If a root-only fix must deploy: `railway redeploy --service server --environment production --from-source -y`.
- **Root `scripts/` are not typechecked by the repo.** Check them with `tsc --strict` against `apps/server/node_modules/@types`. Don't import root scripts from `apps/server`, because its `tsc` build rejects anything outside `rootDir`.
- **`alsoExpands`** on an entry silently grows another list. Horror → Top Movies and Sitcoms → Top TV Shows are intended. A niche list must not widen a canonical one.

## Monitoring
`--snapshot` writes `catalog/review/list-values.<target>.json` and appends one line to `list-values.<target>.history.jsonl` (values, average, shallow, gap…). Both are gitignored. Without `--snapshot` the inspector touches no files.
