# Mobile staging data and media

The fast-track release path uses MySQL migrations and a Railway volume before Android core-flow testing. Production is a separate environment and has not been changed by this staging setup.

## Database migrations

`packages/db/prisma/migrations/0_init` captures the pre-existing schema. `20260925022000_results` adds the result tables used by the current application. CI and bootstrap apply these migrations with `pnpm db:migrate:deploy`. Keep `db:push` limited to disposable local prototyping.

For an empty database, run `pnpm db:migrate:deploy`, then `pnpm db:seed` for taxonomy. For subsequent schema changes, create a migration on a development database with `pnpm db:migrate:dev --name descriptive_name`, review its SQL, and commit it with the schema change.

An existing database created with `db push` must be baselined once. Before doing this:

1. Confirm the database identity and save a logical backup outside its volume. For MySQL, use `mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF --routines --events --triggers` with credentials supplied privately.
2. Compare its live schema with the schema represented by `0_init`; investigate any drift. Never mark a migration applied just to suppress a deployment failure.
3. Only when that baseline already exists, run `pnpm db:migrate:baseline`, followed by `pnpm db:migrate:deploy` and `pnpm db:migrate:status`.

Staging was backed up and baselined on September 24, 2026 (September 25 UTC). The deployed schema had no drift from the baseline. Both migrations are now applied. The API service's pre-deploy command is `pnpm --filter @project/db db:migrate:deploy`; the worker does not independently run migrations. A failed migration prevents the new API deployment from starting. Production still needs its own backup, drift assessment, and baseline before adopting that command.

## Persistent media

Staging API `qa-server` owns Railway volume `qa-media-data` (`812efad8-57a7-4424-9e19-699c4c2ee663`), mounted at `/data`. It uses:

```dotenv
STORAGE_PROVIDER=local
UPLOADS_DIR=/data/uploads
BASE_URL=https://qa-server-staging.up.railway.app
```

Only the API mounts this volume. The upload provider and static `/uploads/` route resolve the same directory. Hosted local storage requires an explicit absolute directory and HTTPS base URL. Profile uploads are decoded, checked against the declared type, limited in size and pixel count, stripped of metadata, and encoded as WebP. Random filenames prevent collisions and user-controlled paths. MySQL stores the media key, URL, type, size, and owner; deletion requires that owner.

Before major data/storage changes, take a database dump and a volume snapshot or file archive, retain them off-service, and verify they can be read. Railway's snapshot API returned `Not Authorized` for this session; the staging database instead has a private off-volume logical backup on the operator machine. An on-volume backup alone is insufficient. Arrange a retained media snapshot/archive before production use. A restore must pair the database metadata with the corresponding files.

Keep one API replica while using a single attached filesystem. Scaling to multiple independent upload services requires shared object storage. An eventual S3/R2 migration can retain stable API media URLs or redirect old keys.

## Launch boundary

These changes establish staging data durability. Physical-device testing, a production environment with its own volume and migration baseline, Play account access, and public policy/support information remain separate release requirements. Simulated email, push, and purchases must not be presented as working public features.
