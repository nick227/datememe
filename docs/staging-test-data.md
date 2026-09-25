# Synthetic staging data

`packages/db/prisma/seed-staging.ts` creates six fictional adult profiles in Chicago, 24 public ranked lists with 72 valid taxonomy picks, five manual QA membership grants, two mutual matches/conversations, six messages, and one incoming like. It never creates paid subscriptions or copies production data.

Run this only against the isolated staging database, after migrations and the normal taxonomy seed (`pnpm --filter @project/db db:seed`). Do not use `db:seed:users`: that older local demo seed has shared hardcoded credentials and fabricated compatibility scores.

The script requires `APP_ENV=staging`, a MySQL `DATABASE_URL` whose database name is exactly `datememe_staging`, and `QA_SEED_PASSWORD` supplied through a private shell environment or secret store. The password must be at least 12 characters and no more than 72 UTF-8 bytes. It is never printed. Check the Railway project/environment/service before supplying the staging connection; the database-name guard cannot establish the identity of an arbitrary host.

```bash
# DATABASE_URL and QA_SEED_PASSWORD must already be exported privately.
APP_ENV=staging pnpm --filter @project/db db:seed:staging --check
APP_ENV=staging pnpm --filter @project/db db:seed:staging
```

`--check` validates environment and fixture definitions without connecting to MySQL. The real run first validates required categories, approved entities, category tags, and any supplied upload ownership before writing. There is no production override or alternate-database switch.

| Login email | Username | Purpose |
| --- | --- | --- |
| `qa-alex@example.test` | `qa_alex` | Main member account: profile edits, lists, discovery, messages |
| `qa-maya@example.test` | `qa_maya` | Existing mutual match with Alex; strong overlap; reply from a second session |
| `qa-jordan@example.test` | `qa_jordan` | Already likes Alex; Alex's first Like should form a new mutual match |
| `qa-sam@example.test` | `qa_sam` | Discover candidate with low overlap; horror, books, board games, music |
| `qa-casey@example.test` | `qa_casey` | Discover candidate with high overlap; age 30s filter |
| `qa-riley@example.test` | `qa_riley` | Free-tier photo/message gates and send limit; existing Alex conversation |

Every login uses the supplied `QA_SEED_PASSWORD`. All identities use deterministic `staging-qa-v1-*` IDs and the reserved `example.test` domain. Each profile has an adult birthdate, mutually compatible gender/age preferences, discoverable visibility, and neighborhood coordinates within Chicago. Riley receives no seed membership grant; an independently configured global membership promotion or an existing grant could still elevate that account. Check `/auth/me` before asserting free-tier limits.

The four list categories are Top Movies, Favorite Books, Favorite Board Games, and Top 90s Bands. Each contains three distinct ranked picks. For example, Alex and Maya share Inception, Parasite, Dune, The Martian, Wingspan, Ticket to Ride, and Radiohead. The real worker calculates compatibility; percentages vary with taxonomy usage and are not fixture constants.

The seed queues four `UPDATE_TAXONOMY` jobs, six `CALCULATE_MATCHES` jobs, and four `LIST_RESULTS_REFRESH` jobs with deterministic IDs. Counter jobs are scheduled before matching, then list results. Run a single staging worker and wait for all `staging-qa-v1-*` jobs to reach `DONE` before inspecting discovery. A stopped/failed worker can produce empty discovery despite successful seeding. Alex will initially see Jordan, Sam, and Casey; Maya and Riley are excluded because Alex has already liked them, and remain available through Messages.

## Volume-backed photos

Profiles start without photos. Generate or provide clearly synthetic scenery fixtures, log in as the account that will own each image, and upload through `POST /media/upload`. This writes both the Railway volume file and its `MediaAsset` ownership record. Keep the returned URL; do not manufacture filenames or insert container-local paths.

Either attach uploads using the normal profile API/UI, or supply an optional `QA_SEED_MEDIA_URLS` JSON object on a rerun. Its keys are usernames from the table and its values are arrays of up to six upload URLs. The shape is `{"qa_alex":["<URL returned from Alex's upload>"],"qa_maya":["<URL returned from Maya's upload>"]}`. Only URLs under `https://qa-server-staging.up.railway.app/uploads/` with a matching `PROFILE_UPLOAD` media row owned by that exact fixture account are accepted. Unknown usernames, external media, duplicate URLs, and cross-account uploads are rejected before seed writes.

The seed attaches supplied photos only when the profile has no existing photos, and sets its avatar only when currently empty. Existing uploaded photos and tester changes are preserved. Test actual file delivery and retention after an API redeploy; a database photo row alone does not prove that the volume file exists.

## Focused regression

1. Sign in as Alex, inspect `/auth/me` membership, edit the bio, and verify the saved profile after logout/login.
2. Upload a photo as Alex, set it on the profile, and open its returned media URL. Repeat retrieval after the API redeploy and a cold app launch.
3. Open and reorder Top Movies, save, navigate away, and return. The order must survive a force-stop and later sign-in.
4. Browse Discover with Near Me, 20s/30s, and music/book filters. Open a candidate profile and its ranked lists. Like Jordan once to create a new mutual-match conversation.
5. Open Maya's seeded conversation, send a unique test message, then sign in as Maya in a separate session and reply. Verify both directions and persistence after restart. Seed messages should remain readable for these members.
6. Sign in as Riley, verify the actual free entitlements, and inspect the Alex conversation. Incoming content/photo gating and the daily send limit must match those entitlements; this is separate from the member messaging regression.
7. Force-stop/relaunch, log out/in, and redeploy the API. Verify profile edits, list order, messages, and uploaded media still exist before calling persistence passed.

Reruns refresh the six fixture passwords from the supplied secret. They create missing seed records while preserving existing profile/list edits, swipes, read states, messages, grants, and uploaded photos; they do not reset tester accounts or delete other data. Missing original lists/messages are recreated, so complete a deletion test before rerunning the seed. Failed seed worker jobs are retried, and completed jobs are rescheduled when missing seed lists are restored. Tests that consume a Like or send messages are consequently stateful: do not expect rerunning the seed to erase those actions.
