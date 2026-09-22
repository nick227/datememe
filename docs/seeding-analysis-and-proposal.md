# Seeding analysis and proposed content workflow

Research date: 2026-09-21. Repository revision: `39d2327`. Status: proposal; no seed, schema, or production data changes were executed during this spike.

Current implementation scope: [AI content factory: V1 implementation spec](ai-catalog-authoring-mvp.md) is the authoritative next-build specification. V1 adds Concept, GenerationOperation, CategoryDraft, EntityCandidate, and EntityFacet. Concepts are cheap AI-generated authoring seeds with bulk use/skip, separate from permanent taxonomy. The flow is Concept Inbox → generate/review Lists → assign taxonomy per List → generate/review Values → publish locally. Plain developer-owned prompt files make each generation stage easy to tune. Release ledgers, revision infrastructure, production promotion, and broader operations below are future work, not prerequisites for this POC. The current-state findings remain applicable.

## Recommendation

Keep generating and reviewing content locally, but promote **immutable data bundles**, not a copy of the development database. Build a small importer with stable identities, validation, dry-run diffs, transactional checkpoints, and a database-backed release ledger. Run production content imports explicitly inside Railway, independently of ordinary application deployments.

The existing core seed is useful for development bootstrap and repeated insertion of unchanged fixtures. It is **not yet a reliable mass-content release system**: there is no production automation, release history, conflict policy, resumable run tracking, or all-or-nothing publication. Exact duplicate protection exists; semantic duplicate protection is incomplete.

In this document, “Lists” means the catalog users answer: `Category` definitions, `Entity` choices, tags, groups, and curation. `List` and `ListItem` are actual profile answers and should remain dev fixtures, excluded from production content bundles.

## 1. What exists today

### Deployment and infrastructure, verified read-only

`railway status --json` identified the linked [datememe project](https://railway.com/project/3ef0c206-b810-46f8-b945-93ec52a4a8c5). Its returned environment list contains only `production` (`20a07674-f26c-438d-8a66-e1244cea015d`). Services are MySQL, server, worker, and mobile.

The latest server, worker, and mobile deployments reported `SUCCESS`, from commit `39d2327f11295f716f8cc9f4c86173592c931a35`. Their effective deployment manifests contain **`preDeployCommand: null`**. Server and worker build Prisma Client and compile the applications; their start commands invoke the corresponding package's `start` script. Neither seeds nor applies database schema changes. The source startup paths do not add a hidden seeding step.

| Layer | Observed behavior | Implication |
| --- | --- | --- |
| Local bootstrap | Install, Prisma generate/build, `db:push`, SDK generation, `db:seed` | Seeding is built into local setup |
| GitHub CI | MySQL 8, `db:push`, tests; no seed step | CI does not explicitly exercise seed replay or content promotion |
| Checked-in Railway JSON | Generate/build/start; no migration or seed hook | Repo deploy configuration does not seed |
| Live Railway manifests | Railpack, package start scripts, no pre-deploy hooks | Current deployed services do not seed or migrate automatically |
| Production DB | `mysql:9`, persistent `/var/lib/mysql` volume | Validate on production's MySQL major version before mass import |
| Server storage | Latest deployment has no volume mounts | Local uploaded media cannot be assumed durable across deployments |

There is configuration drift: checked-in `railway.*.json` files declare Nixpacks, whereas live manifests use Railpack and different start/retry settings. Deployment metadata has empty `fileServiceManifest` and `propertyFileMapping`. Do not assume editing `railway.server.json` changes production until the service's config-file path and effective configuration are reconciled.

**Limits of verification:** no production SQL queries, table counts, uniqueness introspection, backup verification, or seed execution were performed. The database image and volume are platform observations, not proof of the running SQL engine version or schema fidelity. Constraints below describe the checked-in schema; inspect production before relying on them. Deployment success is not content readiness: `/health` currently returns `{status: 'ok'}` without checking schema or seed state. Historical manual seed runs cannot be reconstructed from this inspection.

### Seed entry points

| Entry point | Purpose | Reliability assessment |
| --- | --- | --- |
| `pnpm db:seed` → `packages/db/prisma/seed.ts` | Types, tags, entities, category groups/definitions, Site Picks, subscription plans | Mostly insert-if-missing upserts; partial replay safety, no release tracking |
| `pnpm --filter @project/db db:seed:users` | Demo users including an admin, sessions, subscription, profile lists, social fixtures | Development only; no production-target guard |
| `apps/server/src/scripts/seed-cars.ts` | Hierarchical car taxonomy and two curated categories | Plain entity/category creates fail on rerun; errors nevertheless exit 0 |
| `pnpm --filter server seed:taxonomy-media` | Reviewed external identities and downloaded images; quarantine old mismatches | Some replay checks and audit events, but external API dependencies and partial progress |

The core seed does not currently create demo users despite its unused `bcrypt`/`randomUUID` imports. Demo accounts live in the separate user script. It creates a known-password admin and updates roles of matching emails; keep that script out of production pipelines.

The older [schema proposal](data-schema-proposal.md), section 5.1, describes per-type JSON files and external ID deduplication as a design. There is currently no `prisma/seed-data/` directory or implementation of that proposed data-file pipeline. There is also no checked-in Prisma migrations directory. `prisma generate` generates application code; it does not apply the schema or import data.

## 2. Duplicate protection and failure modes

### Existing database identities

| Record | Declared unique identity | What it protects |
| --- | --- | --- |
| EntityType, Tag, CategoryGroup, Category, SitePickGroup, Plan | `slug` | Exact key replay |
| Entity | `(entityTypeId, slug)` | Same slug within the same type |
| EntityTag, CategoryTag, CategoryEntity, SitePickItem | Composite primary keys | Duplicate relationships |
| EntityAlias | `(entityId, alias)` | Same alias repeated on one entity |
| EntityExternalRef | `(entityId, provider)` | One reference per provider on an entity |
| List | `(profileId, categoryId)` | One answer list per profile/category |
| ListItem | `(listId, rank)` and `(listId, entityId)` | Duplicate ranks or entities in a profile list |

These constraints prevent exact duplicate rows; they do not guarantee successful concurrent imports or identify two differently named records as the same real-world thing.

Specific gaps:

1. **Identity is generated from display names.** The ASCII slugifier can collapse distinct names (`AC/DC` and `AC DC`), discard non-Latin names, or create a new identity when a title is corrected. An upsert can silently reuse the wrong entity on a slug collision. Remakes, editions, and same-name people require explicit disambiguation.
2. **External identity is not globally unique.** `(provider, externalId)` is indexed, not unique; two entities can claim the same external identity. The older `Entity.externalIds` JSON field provides no uniqueness constraint. Alias uniqueness is also per entity, not an identity-resolution system.
3. **Most core updates are empty.** Changing an existing category prompt, entity metadata, type label, or plan in the script does not update the target. Local and production can retain different historical values after running identical code.
4. **Relationships accumulate.** Removed tags and Site Pick memberships are not removed by core replay. Site Pick labels and ordering *are* overwritten, so reruns can undo admin curation while preserving stale memberships.
5. **Partial writes remain.** Core operations run sequentially without a transaction spanning each logical content unit. A category can become visible before its tags are attached; a failure leaves earlier writes committed. There is no checkpoint, lock, run ID, or durable failure report.
6. **Cars script is not replay-safe.** Unique constraints reject its repeated creates, but earlier type updates may already commit. `.catch(console.error).finally(() => process.exit(0))` makes the failed invocation appear successful to automation.
7. **Demo answers bypass application effects.** `seed-users.ts` increments usage only when a rank is first created, separately from the item write. A crash between them, concurrent runs, or changing an entity at an existing rank produces incorrect counts. It does not enqueue the normal taxonomy/matching work. Missing categories/entities are silently skipped and lists may already be marked complete.
8. **Media replay is best effort.** The script checks an existing primary asset before downloading, but `MediaAsset` has no unique import identity. Concurrent runs can race. Missing taxonomy, missing images, or rights-review outcomes need not fail the script. It chooses the first admin as its audit actor, which is not accurate operator attribution for a production release.

### Content correctness is also an application concern

`TaxonomyService.searchCategoryEntities` enforces type, required tags, and status. It does **not** apply `Category.parentEntityId` or `CategoryEntity` curation. `ListService.upsertMyList` checks type/status and maximum length but does not enforce required tags, parent restrictions, or curated membership. Thus a “Top Honda Models” definition can be stored correctly without the List builder enforcing its intended pool.

Before generating many constrained Lists, define whether curation means a strict allowlist or suggested ordering, and implement/test one eligibility policy across autocomplete, answer validation, and Quick Picks. Do not assume the schema alone implements these rules.

`isActive: false` helps hide categories from catalog listings, but it is not a complete draft-access boundary: direct category lookup, search, and list writes do not consistently reject inactive categories. Approved entities can also appear in other active categories of the same type. Full invisible staging requires additional publication gates; an importer flag alone cannot provide it.

## 3. Proposed bundle format and identity policy

Start with checked-in JSON under `packages/db/seed-data/<dataset>/<version>/`, separate from executable importer code. Use JSONL or object-storage artifacts later if size warrants it. Each release contains a manifest, normalized entities, categories, relationships, and optional media references.

Example manifest (proposed format):

```json
{
  "dataset": "launch-music",
  "version": "2026-09-21.1",
  "formatVersion": 1,
  "requiresSchema": "seed-ledger-v1",
  "requiresDatasets": [],
  "files": [
    { "path": "entities.json", "sha256": "<file digest>" },
    { "path": "categories.json", "sha256": "<file digest>" }
  ]
}
```

Compute the bundle digest from canonical manifest bytes and the declared file digests; exclude the bundle's own digest to avoid self-reference. Record that digest in the release ledger. A published `(dataset, version)` is immutable: different bytes under the same version are an error.

Use explicit stable keys such as `entity:band:radiohead` and `category:top-90s-bands`. References use keys, never local database CUIDs. The importer resolves keys to target-environment IDs. Freeze identity keys when first published; label/slug changes require an explicit rename mapping, not delete-and-recreate.

For existing data, perform a reviewed adoption pass: match known slugs/type slugs and verified external references, flag disagreements, and attach ownership mappings without recreating records. Do not silently claim all same-name admin-created or user-submitted entities.

Use `EntityExternalRef` as the normalized identity source. Audit existing collisions before adding a database uniqueness constraint on provider/external ID. Decide provider namespace scope first: if a provider's IDs are type-scoped, include that scope in the identity. Preserve `externalIds` JSON compatibility until consumers are migrated. Fuzzy matches and aliases produce review candidates, never automatic merges.

Record provenance with the bundle: source URLs/IDs, retrieval date, generation model/prompt version if applicable, reviewer, and relevant media rights. Generated data stays a draft until reviewed; generation and external API calls do not run during production import.

Validation must reject unresolved references, duplicate keys, slug collisions, cyclic hierarchies, conflicting external identities, invalid enum/length values, and invalid min/max bounds. Check eligible choice counts against `minItems` and the displayed prompt (a “top five” prompt needs at least five choices). Validate parent/type relationships, tags, curation semantics, and Site Pick references. Compare MySQL collation behavior as well as normalized strings; JavaScript case comparisons alone do not reproduce database uniqueness.

## 4. Import semantics and tracking

### Tracking to implement before mass production seeding

| Proposed model | Responsibility |
| --- | --- |
| `SeedRelease` | Unique dataset/version, immutable checksum, format/schema requirements, artifact location |
| `SeedRun` | One attempt: target identity, actor or CI identity, commit/importer version, status, timestamps, counts, error summary, plan digest |
| `SeedRecord` | Stable key → model/target ID, owning dataset, last applied managed values/hash, last release |
| `SeedRunItem` | Checkpoint and result per record/logical unit, before/after managed values, error; unique within run |
| `SeedLease` | One active content writer per database, with expiry/heartbeat and fencing token |

The ledger lives independently in each environment. Dev success is never copied into production. Keep every attempt; distinguish `PLANNED`, `RUNNING`, `FAILED`, `APPLIED`, and `VERIFIED`, and record publication separately. A process crash leaves a stale run eligible for explicit resume after lease recovery.

Use short transactions per dependency batch or category plus its relationships. Commit the content change, ownership snapshot, and checkpoint in the **same transaction**. Do not hold a transaction across the full dataset or during network/media work. Enforce the lease/fencing check in every write transaction so an expired runner cannot continue alongside its replacement. Unique constraints remain the final duplicate defense; use bounded retries for transient transaction conflicts.

On replay, already-applied unchanged units are no-ops. A previous success does not mean the current target cannot drift: verification should compare managed fields and report later admin edits. Failure stops dependent units, marks the attempt failed, and exits nonzero. Resume checks bundle digest, prerequisites, and current target values before skipping committed checkpoints.

### Preserve admin edits with explicit ownership

For managed fields, use a three-way comparison: last imported value, current database value, incoming value. Update automatically only if the current value still matches the last imported value, or already equals the incoming value. Otherwise report a conflict for review. Treat previously unmanaged rows as adoption conflicts until reviewed.

Never import user answers, engagement counters, moderation decisions, or merge state from a content bundle. Existing category changes that affect eligibility, matching, or maximum length need impact counts for affected profile lists and an explicit remediation/recompute decision.

Relationships require the same policy. Replace the importer-owned tag/curation/Site Pick set transactionally; preserve unmanaged relationships and report collisions. Omission is not deletion of a business record. Retirement should explicitly deactivate content while preserving references and user history.

### Admin UI

Yes, add admin tracking, but start with the ledger and CLI report. A first admin page should show releases, run status, target, actor, checksum, created/updated/unchanged/conflicted counts, failed records, and verification/publication results. Later add reviewable diffs, conflict decisions, and a resumable action using the same importer service.

Reuse `AdminAuditEvent` for human-triggered release/publication events. It currently requires a real `User` actor; CLI/CI identity belongs in `SeedRun` unless an explicit service-principal design is added. Do not impersonate the first admin. Existing category and Site Pick handlers are not a complete audit trail; category creation explicitly skips audit logging, and category field/tag updates are not one transaction. Add those audits and transactional updates so content ownership conflicts remain explainable.

## 5. Local-to-Railway workflow

1. **Generate locally into draft files.** Produce a small vertical first, for example 10–20 category definitions and a few hundred reusable entities. Review factual identity, prompts, tags, aliases, and eligibility. Keep demo answers separate.
2. **Validate offline.** Schema validation, reference resolution, deterministic hashes, collision detection, and provenance checks run without database credentials.
3. **Plan against a disposable local database.** Emit a diff with target identity, dependencies, counts, changed fields, conflicts, and affected existing answers. Target selection must be explicit; never infer safety from `NODE_ENV` alone. The existing Prisma `.env` symlink points to the root `.env`, so incidental shell configuration is not an adequate target guard.
4. **Apply locally and replay.** Use the same importer intended for Railway. Inspect the app and run verification. A second apply must make zero content changes; ledger entries may record the second attempt. Simulate failure and resume, conflicting admin edits, and simultaneous writers.
5. **Freeze the release.** Commit reviewed JSON and importer changes. CI validates bundles and exercises the importer on a disposable MySQL instance matching production's major version. Record bundle checksum and importer revision. Never regenerate data independently for production.
6. **Rehearse in Railway staging.** Create an isolated environment/database before the first large release; none appeared in the inspected project. Use synthetic fixtures or sanitized test data, never credentials or copied user sessions. Test cold initialization and adoption of representative preexisting content.
7. **Plan and apply in production.** Run the pinned importer/artifact in a dedicated finite Railway importer service, with explicit project/environment selection, no public endpoint or cron, one replica, and restart policy disabled for automatic retries. The reviewed plan is tied to target and digest; re-check preconditions under the lease at apply time. Abort stale plans rather than overwriting intervening edits.
8. **Verify, then publish in small batches.** Check expected keys/relationships, usable eligible pools, autocomplete and answer flows, and media URLs. Activate reviewed definitions and Site Picks only after validation. Until full draft gating exists, treat each committed batch as potentially visible and require it to be complete on its own.

The following is a **proposed CLI contract**, not commands available today:

```text
seed:validate --bundle <path>
seed:plan --bundle <path> --target <explicit-target> --out <plan.json>
seed:apply --plan <plan.json> --expected-checksum <digest>
seed:resume --run <run-id> --expected-checksum <digest>
seed:verify --release <dataset@version> --target <explicit-target>
seed:publish --release <dataset@version> --target <explicit-target>
```

For the initial remote runner, package bundles in its built image and invoke the importer as its finite start command. Ensure the package build includes data files and compiled importer code; current DB TypeScript compilation alone will not package a new JSON pipeline automatically. Verify terminal results through `SeedRun` and post-import checks, not Railway service health alone. Existing application `JobQueue` can support imports later, but currently dispatches only matching, taxonomy-counter, and push jobs. It is not already a bulk-import system.

`railway run` launches a process locally with Railway variables; it is not remote execution. Do not assume a private database hostname becomes reachable merely through variable injection. Prefer the runner inside Railway, or explicitly configure and verify a supported networking path for a local read-only plan. [Railway run documentation](https://docs.railway.com/cli/run), [private networking](https://docs.railway.com/networking/private-networking).

## 6. What belongs in deployment

Separate three concerns:

- **Schema migrations:** introduce checked-in Prisma migrations and baseline the existing database after comparing actual production schema with the intended baseline. Only mark a baseline applied when the target already matches. Do not replay a create-all migration onto populated production. This is the purpose of [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining).
- **Small required reference data:** after extracting a guarded, deterministic reference-only seed, it may run after migrations if application startup requires it. Exclude demo users, generated catalog releases, media downloads, and mutable editorial curation.
- **Large content releases:** explicit importer runs using the workflow above, independently scheduled from server/mobile deploys.

Once migrations and image contents are ready, configure the effective server pre-deploy command to run `pnpm --filter @project/db exec prisma migrate deploy`. That command applies committed migration files; it does not infer schema changes or establish the missing history. Keep generation in the build. [Prisma CLI reference](https://docs.prisma.io/docs/orm/reference/prisma-cli-reference).

Railway pre-deploy commands execute with application variables/private networking and fail the deployment on command failure, making them suitable for bounded schema work. They are not the place for lengthy generation/import work. [Railway pre-deploy documentation](https://docs.railway.com/deployments/pre-deploy-command).

Server and worker deploy independently and share the database. Use backward-compatible expand/contract schema changes and gate worker rollout when it needs a new schema; server pre-deploy completion alone does not order a simultaneous worker deployment. Schema migration locking does not replace a content-import lease.

This repo uses Prisma 5.x. Implement commands and migration generation against its pinned installed version; current online docs may describe later major versions. No Prisma upgrade is required to start this workflow.

## 7. Media, recovery, and verification gates

**Media:** only the local storage provider implementation exists in the inspected tree; S3/R2 factory branches expect files that are absent. The local provider writes under `apps/server/uploads`. With no server volume in the observed deployment, production media persistence is an unresolved requirement. Implement durable object storage or a deliberately managed volume before mass media import. Store portable source/asset keys and hashes, not `localhost` URLs or workstation paths. Verify actual production storage configuration before choosing a backend. Import media separately with bounded retries and per-asset results; keep identity and licensing review from the existing media workflow.

**Recovery:** verify a restorable database backup before the first production adoption/import. A successful application rollback does not revert seeded content. Default recovery is a corrective release or explicit deactivation, using recorded before/after values and checking for later edits. Never bulk-delete a failed release's entities once user answers may reference them. Whole-database restoration would discard subsequent user writes, so reserve it for disaster recovery. A persistent database volume alone is not evidence of a backup.

**Acceptance gates before mass seeding:**

- Fresh apply, unchanged replay, interrupted resume, changed-checksum rejection, and two-writer contention pass integration tests on production-compatible MySQL.
- Adoption preserves existing IDs; duplicate external identities and ambiguous slugs stop for review.
- Admin changes become conflicts; removing one owned relationship preserves unrelated relationships.
- A failed category transaction leaves neither half a category nor a committed checkpoint without its data.
- Draft/publication behavior is tested through public APIs, including direct slug access and entity-type discovery.
- Eligibility is consistent across autocomplete, saving answers, and Quick Picks for the supported category modes.
- Content imports leave user/session/subscription tables and engagement counters untouched. Separate dev-answer fixtures exercise `ListService` and its transactional jobs or an equivalent shared domain path.
- Reports distinguish failed imports, optional media omissions, missing dependencies, and successful verification; no swallowed failures or unconditional success exits.
- Every production release is traceable to its immutable bundle, importer revision, operator, target, and result.

## 8. Suggested implementation sequence

| Phase | Deliverable | Completion criterion |
| --- | --- | --- |
| 1: Inventory and foundations | Read-only production schema/content collision audit; reconcile Railway config; migration baseline; isolate dev seed and fix cars exit behavior | Known production schema and target guards; repeatable schema release |
| 2: Local content pilot | Bundle format, validator, plan/apply/verify importer, adoption mapping, ledger, lease, conflict policy | One small vertical replays and resumes correctly; eligibility issues resolved for supported modes |
| 3: Production rehearsal | Staging, production-compatible MySQL CI, pinned finite importer runner, recovery rehearsal | Same artifact passes cold and existing-data imports, failure and publication checks |
| 4: First production content release | Small verified batch with ledger and post-import app checks | Traceable content, no duplicates or unintended answer changes |
| 5: Scale and operations | Admin release screen, generation automation, durable media, larger bounded batches | Operators can review, diagnose, resume, and correct without editing seed code |

The first useful implementation is phase 2's small local pilot alongside phase 1's production foundations. A full admin CMS is not a prerequisite. Stable identity, conflict handling, run tracking, and replay/resume verification are prerequisites for mass production import.

## Evidence map

Repository links below point to inspected implementation, rather than older design intent:

- [Bootstrap](../scripts/bootstrap.ts), [root commands](../package.json), [DB commands](../packages/db/package.json), [CI](../.github/workflows/ci.yml).
- [Core seed](../packages/db/prisma/seed.ts), [demo users](../packages/db/prisma/seed-users.ts), [cars seed](../apps/server/src/scripts/seed-cars.ts), [media seed](../apps/server/src/scripts/seed-taxonomy-media.ts).
- [Schema and constraints](../packages/db/prisma/schema.prisma), [server config](../railway.server.json), [worker config](../railway.worker.json), [web config](../railway.web.json).
- [Taxonomy search](../apps/server/src/services/TaxonomyService.ts), [answer write path](../apps/server/src/services/ListService.ts), [worker dispatcher](../apps/worker/src/index.ts), [counter reconciliation](../apps/worker/src/jobs/UpdateTaxonomyJob.ts).
- [Category administration](../apps/server/src/handlers/adminCategories.ts), [Site Pick administration](../apps/server/src/handlers/adminSitePicks.ts), [storage factory](../apps/server/src/providers/storage.ts), [local uploads](../apps/server/src/providers/LocalStorageProvider.ts).
- Live evidence: Railway CLI 5.59.0, `railway status --json`; server deployment `435efcc9-63a9-4baa-bb89-6cb841d9d1e6`, worker `894c77fc-9ae2-4cb1-86c4-033e5ac094ec`, mobile `8d174d1f-0248-42cd-8c81-54e77043a198`. Snapshot observations may change after this research date.
