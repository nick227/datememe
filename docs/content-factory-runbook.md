# Content factory V1: local use and developer tuning

Implemented 2026-09-22. Entry: **Profile → Account → Admin → Content factory**.

## What is available

- AI-generated or manually entered Concepts with bulk Use/Skip. Concepts have no taxonomy/public-site relationship.
- Bulk List generation from selected Use concepts, saved private drafts, definition editing/approval, and individual or bulk group/type assignment.
- Bulk Values generation for approved, assigned Lists. Review options individually or approve selected exact existing name/key matches in bulk. New identities require an explicit review action.
- Atomic publication into the local catalog, additive expansion, and shared Entity reuse. Generated lists use a curated allowlist in autocomplete, list saving, and both Quick Pick write paths.
- Optional shared EntityFacet suggestions/acceptance/removal. Suggestions do not change accepted facets automatically.
- Saved prompt/model/version/input/output per GenerationOperation, progress, explicit resume of pending work, cancellation, and retry of failed/stale operations.

Generation is dispatched sequentially by the open admin screen. Closing the page pauses further dispatch. Pending operations remain in the database. Resume pending from the progress section; retry a RUNNING operation only after its timeout plus a 30-second grace period. Independent operation failures do not discard completed work.

## Start locally

Use the existing local database/environment setup. The schema change has been applied to `datememe_dev` on localhost in this workspace.

```bash
pnpm --filter @project/db exec prisma generate
pnpm --filter @project/db build
pnpm --filter server build
node --env-file=.env apps/server/dist/index.js
```

In another terminal, run the existing Expo web dev command or export/serve it:

```bash
pnpm --filter mobile run export:web
PORT=8081 node apps/mobile/serve-static.js
```

Use an existing admin login. Match the web origin with `CORS_ORIGIN` (this workspace uses `http://localhost:8081`) and point `EXPO_PUBLIC_API_URL` at the local server (`http://localhost:3002`). The API must receive `OPENAI_API_KEY`; no credentials are sent to the browser.

On another development checkout, apply the updated Prisma schema to a local database using the project's existing schema workflow. Do not reset or reseed existing data. A unique `(conceptId, slug)` constraint protects repeated List ideas within the same concept; inspect any duplicate rows before adding it to an already populated draft table.

## Tune generation without changing pipeline code

Edit [prompt templates](../apps/server/src/prompts/catalog/concepts.system.md) under `apps/server/src/prompts/catalog/`. Each stage has separate `.system.md` and `.user.md` files:

- `concepts`: short creative seeds such as coffee, space, nostalgia.
- `lists`: varied polls inspired by a seed, without imposing a taxonomy branch.
- `values`: real options for an approved question and assigned value type.
- `facets`: subjective suggestions from a small allowed vocabulary.

[config.ts](../apps/server/src/prompts/catalog/config.ts) contains counts/limits, model fallback, timeout, vocabulary, and prompt version. `CATALOG_MODEL` overrides the model. Increment the prompt version when changing templates. Rendered prompts are saved when an operation is enqueued, so an existing pending operation retains its original prompt. Retry creates a new operation using current templates and context.

Preview without an API call:

```bash
pnpm --filter server prompt:preview LIST_IDEAS
pnpm --filter server prompt:preview CONCEPTS '{"count":3,"brief":"Short everyday interests"}'
```

The server build copies templates into `dist/prompts/catalog`; rebuild/restart the compiled server after edits. Template replacement is literal, not executable code. OpenAI output is schema-constrained and independently validated before proposals are stored.

## Publication and deployment boundary

V1 authoring mutations require a loopback database host and reject `NODE_ENV=production`. This is intentionally a local content-factory pilot; it does not deploy, promote, or generate content in production. Existing public taxonomy/admin screens remain in place.

The new application code expects five authoring tables and `Category.poolMode`. The [reviewable additive SQL](../packages/db/prisma/changes/20260922_catalog_factory.sql) describes that change against the pre-feature schema. It is **not** a migration baseline or an automatically executed deployment hook. No production SQL or Railway settings have been changed. Review/apply the schema through the production migration process before deploying code that reads the new field. The earlier [seeding analysis](seeding-analysis-and-proposal.md) explains the missing migration automation.

The Railway compiler failure was fixed by restoring `ContentFeedService.resultCategorySlugsFor` and sharing it with the Results builder. Explore now excludes ordinary category cards already owned by Results. No feed redesign was introduced. The observed workspace count is six app/package projects plus the workspace root (seven pnpm importers); that count alone is not evidence of a stale deployment.

## Current limits

- No background content worker, immutable release bundle, or production promotion flow yet.
- V1 rules are min/max answers, ordering, and a strict curated pool. Parent/tag rule editing is not added to the factory.
- Factual API adapters and provider-ID deduplication are not newly implemented. Generated details are unverified review hints; they are not written as verified Entity metadata. Existing-name/key conflicts stop new identity creation for review.
- Concept keys deduplicate normalized exact labels. Semantic duplicates still need review. Shared entities use existing typed slugs and explicit resolution; do not assume a matching title proves identity.
- Existing identity collisions during publication stop that List transaction. Resolve to the shared Entity and retry; other ready Lists can still publish.
- New Lists require at least `maxItems` approved distinct choices. Publication reports net relationships added. User answers, matching scores, and popularity counters are untouched.
- The compact API uses `/admin/catalog` for workspace reads and validated commands. The SDK exposes typed workspace records; operation output remains stage-specific JSON.

## Verification

[Catalog integration tests](../apps/server/src/__tests__/catalog.test.ts) exercise real local database transactions with mocked model output: independent concept/taxonomy state, approved draft gates, shared identities, replay, expansion, curated eligibility, cancellation, retry, rollback, stale input rejection, facet acceptance, and actual OpenAPI authentication/serialization. The live API smoke test is separate from deterministic automated tests.

```bash
pnpm --filter @project/db exec prisma generate && pnpm --filter @project/db build && pnpm --filter server build
pnpm --filter server test
pnpm --filter mobile typecheck
pnpm --filter @project/sdk typecheck
pnpm --filter mobile run export:web
pnpm sdk:check
```
