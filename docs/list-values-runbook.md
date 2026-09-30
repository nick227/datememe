# List Values Runbook

How an AI agent inspects how many values each list offers, against a floor. **Phase 1 is read-only**: `pnpm prod:list-values` never writes to the database. Filling lists (phase 2) writes only through the catalog pipeline in `docs/ai-list-pipeline.md` — never by SQL.

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
- `notes`: `pending:N`, `excluded:N`, `admin-edited` (the importer will not add values to it from a file), `no-file` (no `catalog/lists/*.json` defines it — legacy or admin-made), `inactive`.
- Values print in admin order (`sortOrder`), then name. Legacy lists all share sortOrder 0, so theirs read alphabetically.

## Safety
- **Target check is mandatory.** The URL comes from `railway variables --service MySQL --environment production` (`MYSQL_PUBLIC_URL`) or `--url`; its host:port must equal `RAILWAY_DATEMEME_DATABASE_PROXY` in `.env`, or the run stops. Credentials are never printed.
- **Read-only is proven, not assumed.** One `mysql2` connection, `SET SESSION TRANSACTION READ ONLY`, then a zero-row probe `UPDATE` that must be refused with error 1792 before any read. Reads run inside `START TRANSACTION READ ONLY`.

## Monitoring
`--snapshot` writes `catalog/review/list-values.<target>.json` (every active list) and appends one line to `list-values.<target>.history.jsonl` (lists, values, avg, belowFloor, gap). Both are gitignored. Without `--snapshot` the command touches no files.

## Phase 2 (not built)
Pick targets with this inspector → write the added values as catalog JSON (same title, group, type) → `pnpm --filter server catalog:validate` → `pnpm prod:publish-catalog --dry-run` → publish → re-run the inspector. Known gaps to close first: Admin-edited lists refuse file additions; appended values should sort after the existing ones.
