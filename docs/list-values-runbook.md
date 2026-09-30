# List Values Runbook

How an AI agent inspects how many values each list offers, against a floor. **Phase 1 is read-only**: `pnpm prod:list-values` never writes to the database. Filling lists (below) writes only through the catalog pipeline in `docs/ai-list-pipeline.md` — never by SQL.

## Terms
- **List** = a `Category` row. **Group** = a `CategoryGroup` (`--group <slug>`, e.g. `food-drink`). **Type** = an `EntityType`.
- **values** = the list's `CategoryEntity` rows that are not excluded, whose entity is `APPROVED` and not merged. Pending user submissions are shown as `pending:N` and never counted.
- **floor** = target value count. **gap** = `max(0, floor - values)`.

## Floor
`catalog/value-floor.json` (committed). Precedence, first match wins:
1. `--floor N` on the command line
2. `lists[<category slug>]`
3. `groups[<group slug>]`
4. `default` (20 — the list builder shows 20 values before search)

The production catalog audit still uses its own minimum of 8 (`needs-values` in `apps/worker/src/lib/catalogAudit.ts`); it does not read this file yet.

## Commands
```bash
pnpm prod:list-values                                      # summary + every active list
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
LISTS 193  VALUES 2,486  AVG 12.88  MEDIAN 12  MIN 8  MAX 87  BELOW_FLOOR 184  GAP 1,506  (active lists; floor default 20)
values  floor  gap  takes  group       title               notes
8       20     12   2      food-drink  Grocery Stores      no-file
LIST_VALUES {"target":"production","lists":193,...,"matched":2,"shown":2}
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
