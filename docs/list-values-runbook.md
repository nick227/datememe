# List Values Runbook

How an AI agent inspects how many values each list offers, against a floor. **Phase 1 is read-only**: `pnpm prod:list-values` never writes to the database. Filling lists (below) writes only through the catalog pipeline in `docs/ai-list-pipeline.md` — never by SQL.

## Terms
- **List** = a `Category` row. **Group** = a `CategoryGroup` (`--group <slug>`, e.g. `food-drink`). **Type** = an `EntityType`.
- **values** = the list's `CategoryEntity` rows that are not excluded, whose entity is `APPROVED` and not merged. Pending user submissions are shown as `pending:N` and never counted.
- **floor** = target value count. **gap** = `max(0, floor - values)`.

## Minimum and floors
`catalog/value-floor.json` (committed) has two layers:
- **`minimum` (20): the presentation floor.** The list builder shows the first 20 values before search, so a list below 20 is **shallow**. Shallow lists come first. Because values are appended, a list's first 20 are its strongest; keep new additions strong enough to deserve their place if they end up in the first 20.
- **Floors: the catalog depth target** that `gap` measures. `default` 30 covers compatibility, lifestyle, money, home, career and travel. `groups` sets 40 for entertainment and taste domains (film-tv, music, food-drink, literature, gaming, podcasts, tabletop, sports, creators, craft). `lists` sets 50 for broad canonical lists (Top Movies, Top TV Shows, Books, Authors, Artists, Albums, Video Games, Podcasts, Board Games, Sports Teams, YouTubers).

Floor precedence, first match wins: `--floor N`, then `lists[<category slug>]`, then `groups[<group slug>]`, then `default`.

Every row has a **status**, and the summary line counts each one:
- `shallow`: below the minimum. This is a product-quality problem, so fix these first.
- `depth-gap`: at the minimum, below its depth target. Incomplete, not broken.
- `complete`: at or past its target.
- `bounded`: has its own `lists` floor below its normal target, and meets it. Its own floor is also its minimum, so a list with five honest answers isn't shallow.

Batching order once `SHALLOW` is 0: compatibility and high-signal lists 20 → 30, then broad canonical lists toward 50, then entertainment and taste lists toward 40, then novelty and the long tail. Select with `--status depth-gap --group …`.

Depth targets are not quotas. **Never pad a list to hit its floor.** When a domain honestly runs out of good answers (seasons, love languages, a stance on substances), give that list its own lower entry under `lists` and move on.

## Commands
```bash
pnpm prod:list-values                                      # summary + every active list
pnpm prod:list-values --shallow --sort gap                # below the minimum of 20: fix these first
pnpm prod:list-values --status depth-gap --group dating-relationships
pnpm prod:list-values --below-floor --sort gap --limit 20
pnpm prod:list-values --list "Top Movies"                  # slug, or title substring; repeatable
pnpm prod:list-values --group dating-relationships --max 15
pnpm prod:list-values --type movie --min 10 --max 19
pnpm prod:list-values --list "Top Movies" --values         # names, in presentation order (≤10 lists)
pnpm prod:list-values --below-floor --json
pnpm prod:list-values --snapshot                           # also record progress (see Monitoring)
pnpm prod:list-values --selftest                           # verify target + read-only, nothing else
pnpm prod:list-values --local ...                          # the local dev database instead
```
Filters combine (AND). Unknown options, group slugs and type slugs are errors, not empty results.

## Reading the output
```
target=production proxy=altaria.proxy.rlwy.net:52742 readonly=verified
LISTS 193  VALUES 3,438  AVG 17.81  MEDIAN 20  MIN 8  MAX 87  SHALLOW 67  DEPTH_GAP 125  COMPLETE 1  BOUNDED 0  GAP 3,249  (active lists; minimum 20, floor default 30)
values  floor  gap  status   takes  group       title               notes
8       40     32   shallow  2      food-drink  Grocery Stores      no-file
LIST_VALUES {"target":"production","lists":193,...,"shallow":67,"minimum":20,...,"matched":2,"shown":2}
```
- The summary line always covers **all active lists**; the table shows only the matches.
- **Token rule:** read the final `LIST_VALUES {…}` line first. Ask for `--values` only for the exact lists you are about to work on.
- `notes`: `pending:N`, `excluded:N`, `admin-edited` (only a pinned, synced entry can add values to it), `no-file` (no `catalog/lists/*.json` entry maps to it — adopt it with `prod:list-stub`), `stale` (its pinned entry predates the latest Admin edit — re-sync), `inactive`.
- Values print in admin order (`sortOrder`), then name. Legacy lists all share sortOrder 0, so theirs read alphabetically.

## Safety
- **Target check is mandatory.** The URL comes from `railway variables --service MySQL --environment production` (`MYSQL_PUBLIC_URL`) or `--url`; its host:port must equal `RAILWAY_DATEMEME_DATABASE_PROXY` in `.env`, or the run stops. Credentials are never printed.
- **Read-only is proven, not assumed.** One `mysql2` connection, `SET SESSION TRANSACTION READ ONLY`, then a zero-row probe `UPDATE` that must be refused with error 1792 before any read. Reads run inside `START TRANSACTION READ ONLY`.

## Monitoring
`--snapshot` writes `catalog/review/list-values.<target>.json` (every active list) and appends one line to `list-values.<target>.history.jsonl` (lists, values, avg, belowFloor, gap). Both are gitignored. Without `--snapshot` the command touches no files.

## Filling lists (Phase 2)
The only production write path is the catalog pipeline. **Never write list values with SQL.** Every list has exactly one catalog entry; filling a list means appending names to its entry.

1. **Pick targets:** `pnpm prod:list-values --below-floor --sort gap --limit 10` and read the `LIST_VALUES` line.
2. **Sync their entries:** `pnpm prod:list-stub --list <slug> [--list <slug>…]` (exact slugs; `prod:list-values --json` shows them). This rewrites each entry from the database and pins it (below). A list no file defines is adopted into `catalog/lists/adopted-lists.json`. Run it right before filling, every time.
3. **See the values:** `pnpm prod:list-values --list <slug> --values`.
4. **Append** new names to the entry's `values`, strongest first. Edit nothing else; never write or change `categorySlug`/`adminEditedAt`. Don't re-add names that are missing on purpose.
5. **Validate** against production: `DATABASE_URL="$(railway variables --service MySQL --environment production --kv | sed -n 's/^MYSQL_PUBLIC_URL=//p')" pnpm --filter server catalog:validate`. Each target must show `N choices added`; every other list must be unchanged; `stale` must be 0.
6. **Publish:** commit, then `pnpm prod:publish-catalog --dry-run` and `pnpm prod:publish-catalog` (`docs/ai-list-pipeline.md`).
7. **Re-run step 1:** the targets' `values` and `gap` should have moved.

### Pinned entries
`prod:list-stub` writes two fields that only code may write:
- `categorySlug` names the list exactly, whatever the entry's title. A pinned entry never creates a list, so an Admin rename can't turn it into a duplicate, and a title that happens to match another list's slug can't send values to that list. (That happened with Top Hip Hop Artists: its title's slug belongs to an inactive duplicate, `top-hip-hop-artists`; the live list is `top-hiphop-artists`.)
- `adminEditedAt` records the Admin edit the entry was synced from. Admin edits replace a list's values wholesale and keep no record of removals, so the importer adds to an Admin-edited list only while this still matches the list. After any later Admin edit the entry is **stale**: validation warns `stale: … Re-sync: pnpm prod:list-stub --list <slug>`, it adds nothing, and `prod:list-values` notes `stale`. Re-syncing drops the entry's unpublished names in that case, since they can't be told apart from Admin removals; append them again if they're still wanted.

Unpinned entries (the original batches) behave as before: a list edited in Admin is skipped with a warning.

### Needs a person, not a fill
- **Primary Browser** has duplicate values ("Chrome"/"Google Chrome", "Firefox"/"Mozilla Firefox"). Merge them in Admin first.
- **Top 90s Bands** holds artists who aren't 90s bands (Billie Eilish, Dua Lipa, Ariana Grande…). Clean it before growing it.
- **`top-hip-hop-artists`** is an inactive duplicate of Top Hip Hop Artists.
