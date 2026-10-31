# Category ranking publication

Votes are authoritative. Poll detail, the Rankings feed, and category previews
read a published category snapshot. A snapshot becomes visible after the first
eligible vote; `RANKINGS_MIN_TAKES` controls `isFeatureEligible`, not visibility.
Weighted scoring and existing eligibility rules are unchanged.

## Normal write and publication

1. `ListService` locks the Category, increments `answerRevision`, replaces the
   answer, and upserts one `CategoryRankingRefresh` row in the same transaction.
   The server enforces the minimum item count before marking an answer complete.
2. The response contains `answerRevision`. Done can navigate once this commit
   succeeds; it does not wait for aggregation.
3. A dedicated worker loop checks the outbox every 500 ms, independently of the
   general matching/audit job queue. Multiple edits coalesce into one category row.
4. The publisher locks Category before reading the answer snapshot. It validates
   the repeatable-read category revision against the current locked revision and
   retries conflicting transactions. Save transactions use read-committed after
   acquiring that same lock, so an old outbox row cannot be mistaken for one that
   a concurrent publisher already consumed.
5. Scores, picks, first-place counts, take count, entries, source revision, and
   Category popularity/top pick are replaced in one transaction. Consuming the
   outbox row is part of that transaction. Empty snapshots are retained so the
   last-vote removal can also be acknowledged.
6. A failed transaction leaves the old snapshot and pending request intact.
   Failures retry with a capped 1–30 second backoff; a later vote wakes the row.
   There is no terminal retry limit that silently discards a vote refresh.

The worker always calculates current answers after locking. It never publishes
precomputed payloads from old jobs. The existing 15-minute rebuild calls the same
publisher as reconciliation for imports, moderation, merges, and account changes.
Those bypass paths are not yet guaranteed the normal vote-publication latency.

## Client freshness

`CategoryRankings` returns `answerRevision`, `resultsRevision`, and `isUpdating`.
The SDK also remembers the revision acknowledged by the save response. A GET
with an older revision cannot clear pending feedback, even when its own
`isUpdating` field is false.

Poll detail polls every second while pending and every three seconds otherwise.
Active feed/category queries refresh every three seconds, including for other
viewers. Web background polling is disabled by React Query's default behavior.
This is an MVP polling approach; it increases read traffic and should be replaced
with lightweight version checks or push invalidation if traffic warrants it.

Existing results stay visible while updating. After ten seconds, the poll explains
that answers are saved but publication is delayed. Read failures retain cached
results and expose a retry action. No community vote totals are calculated
optimistically on the client.

## Operational notes

Apply the additive `20261030000000_category_ranking_publication` migration and
regenerate/build `@project/db` before running the new server and worker. The
migration queues existing categories for publication under the first-vote rule.
Deploy the API/worker before clients that consume the new required fields.

Normal latency is worker scheduling + one category rebuild + client polling,
with a target of a few seconds. This is not a hard SLA: database contention,
large categories, queue backlog, worker downtime, or network failures can extend
it. `CATEGORY_RANKING_PUBLISHED` logs revision and `lagMs`; pending row timestamps,
attempts, and last errors expose backlog and failures.

Category aggregation holds a category row lock while scanning that category's
votes. Measure large-category latency before replacing this with incremental
counters or calculation outside the lock with version-checked publication.

## Verification

`apps/server/src/__tests__/liveRankings.test.ts` uses real MariaDB fixtures and
covers atomic vote/outbox commits, first-vote visibility, coalescing, empty
snapshots, rollback, concurrent publishers and votes, failure recovery, periodic
repair, and real OpenAPI response serialization. Run with the development worker
stopped, since a running worker legitimately consumes the test outbox rows.

SDK tests cover ordered saves, navigation independent of publication, cache
invalidation, delayed/stale GET responses, and retaining pending state on errors.
