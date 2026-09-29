# Adversarial Review: Workers & Worker Strategy

This review analyzes the `apps/worker` codebase against three primary pillars: Performance Profiling, Memory Efficiency, and Control Flow Simplification. The goal is to identify points of excessive allocation, unnecessary nested iterations, and logic that can be flattened or pushed to the database layer.

---

## 1. Performance Profiling Focus

### `CalculateMatchesJob.ts`
- **Recomputation inside loops**: In the inner candidate loop (`for (const candidateId of candidateIds)`), the worker iterates through `candidateCatIdsArray` and fetches the axes for each category (`categoryMap.get(catId)`). Because axes are static per category, the `axisIDF` sum for each category can be precalculated.
  - **Recommendation**: Precompute a `catId -> axisScoreContribution` mapping. Instead of double-looping over categories and their axes for all 1000 candidates, simply sum the precomputed category scores.
- **Expensive Float Math in inner loops**: `computeCosineSimilarity` is called for every candidate. You can pre-calculate the norms. For `viewerAxisVec`, the norm is static. For candidates, since we only need ranking, we might be able to simplify or vectorize this.

### `UpdateTaxonomyJob.ts`
- **O(N) queries within a loop**: The job loops over `allAffectedEntities` and executes sequential Prisma queries and transactions for each entity.
  - **Recommendation**: Replace the loop with a single grouped query using an `IN (...)` clause.

### `RankingsRebuildJob.ts`
- **Application-side sorting**: The worker fetches unsorted aggregate rows into memory and runs a JavaScript `.sort()` for each category: `(a, b) => b.score - a.score || b.pickCount - a.pickCount...`.
  - **Recommendation**: Push the sorting down to MySQL by adding `ORDER BY score DESC, pickCount DESC, firstPlaceCount DESC, e.id ASC` to the raw SQL query. This uses the highly optimized DB sorting engine and prepares the data incrementally.

---

## 2. Memory Efficiency Focus

### Heavy Heap Allocations & Temporary Objects

#### `CalculateMatchesJob.ts` (Critical Offender)
- **Massive nested maps**: The job builds `candidateItems` as a `Map<string, Map<string, Map<string, any>>>` (Profile -> Category -> Entity -> Item) to deduplicate items. For 1000 candidates, each with multiple lists and items, this deeply nested object creation exerts massive heap pressure and garbage collection overhead.
  - **Fix**: Deduplicate using a SQL `ROW_NUMBER() OVER (PARTITION BY profileId, categoryId, entityId ORDER BY rank ASC)` in the `candidateItemsRaw` query, or at least flatten the map to a single composite string key (`${profileId}:${catId}:${entityId}`).
- **Batching arrays**: `upsertPromises` and `deletePromises` store up to 1000 complex Prisma query objects in memory before chunking.
  - **Fix**: Execute the transaction chunks as you iterate rather than storing all promises in a massive array.

#### `UpdateTaxonomyJob.ts`
- **Object materialization for counting**: The job executes `db.listItem.findMany(...)` to pull every single list item for an entity into Node.js memory just to count distinct profile IDs via `new Set(items.map(...)).size`. For popular entities, this forces thousands of rows into the heap.
  - **Fix**: Use database aggregations. Execute a `COUNT(DISTINCT profileId)` query grouped by `categoryId`. This reduces data transfer to a few bytes per category instead of megabytes of raw list items.

#### `RankingsRebuildJob.ts`
- **Unbounded raw aggregate**: `rows` holds the aggregated list items for *all* active categories and *all* approved entities across the *entire site* at once. As the app scales, this query will return millions of rows into Node.js memory.
  - **Fix**: Cursor over the categories. Query the aggregates for one category at a time, process, write, and move on. Alternatively, execute an `INSERT INTO ... SELECT ... ON DUPLICATE KEY UPDATE` entirely within MySQL.

---

## 3. Control Flow Simplification Focus

### Complex Branching and Nested Logic

#### `CalculateMatchesJob.ts`
- **Deep nesting in Exact Overlap**: The algorithm for calculating exact overlaps nests 4 levels deep: Candidate Loop -> Shared Categories Loop -> Viewer Entity Loop -> Candidate Item check.
  - **Simplification**: Since we already have the raw items, we can flatten this. By creating an intersection of `viewerEntityIds` and candidate items, we can iterate over the matched entities directly, rather than looping through categories and looking up maps.

#### `ProfileSocialInsightsRefreshJob.ts`
- **Redundant baseline calculations**: The baseline rate is recalculated in the `userList` loop using `totalUsersCount`. `totalUsersCount` is fetched globally.
  - **Simplification**: Pre-calculate significance thresholds before the loop. The fingerprint check relies on JSON string comparison which can be brittle; relying on a proper hash of the payload would be cleaner.

#### Job Router (`index.ts`)
- **If/Else Chain**: The job queue router uses a cascading `if/else` block. 
  - **Simplification**: Transition to a command/handler dictionary (e.g., `const JOB_HANDLERS = { 'CALCULATE_MATCHES': calculateMatchesJob, ... }`). This flattens the execution path, simplifies extending the worker, and avoids sequential evaluation.
