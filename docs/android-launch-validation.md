# Android staging launch validation — September 25, 2026

## Data and media

Staging is isolated from production. The baseline migration and additive result-table migration are applied; the API pre-deploy command uses `prisma migrate deploy`. The MySQL schema was compared against the deployed baseline with no drift before baselining.

- API deployment `69db66fa-12e1-455d-a566-28a5a6303b0d` succeeded with volume-backed uploads.
- API persistence redeploy `4742b8a9-55eb-43ad-b877-44dfe6cc55f3` reached `SUCCESS`.
- Worker deployment `85193244-eaa1-417d-be40-b5a3e7d1717d` reached `SUCCESS` from committed snapshot `2227e24`.
- API volume is mounted at `/data`; uploaded files live at `/data/uploads`.
- Six synthetic adults have biographies, Chicago locations, four completed ranked lists each, matching preferences, and owned geometric test images. Five have QA membership grants; Riley exercises free-tier behavior. These are synthetic fixtures, not real dating profiles.
- All 14 fixture taxonomy/result/compatibility jobs completed successfully after deploying the updated worker.
- Private MySQL backups and a readable six-file media archive are retained outside Railway under `~/.local/state/datememe/backups/2026-09-25/`. See [operations](mobile-data-operations.md).

## Focused hosted API regression

All of these were exercised against the staging HTTPS API, not local services:

| Flow | Result |
| --- | --- |
| Login and authenticated current user | Passed |
| Logout and rejection of the old session token | Passed |
| Login again | Passed |
| Profile bio and avatar/photo updates | Passed |
| Four seeded lists and saving changed rank order | Passed |
| Discovery candidates and current Lists/Discover feeds | Passed |
| Existing conversations, sending, and recipient reading | Passed |
| Image upload, normalized WebP, and stable public route | Passed |
| Different user attempting to delete the image | Rejected with 404; file remained |
| API redeploy persistence | Session, profile bio/photo URL, edited ranks, and message retained; image SHA-256 identical |

Eighteen focused media tests passed using real image decoding, filesystem serving, and database ownership records. Server typecheck passed. Hosted API checks are separate from Android UI coverage.

## Android artifact and source boundary

The next artifact is an AAB for `com.datememe.app.staging`, version `1.0.0`, Android code `2`. It uses the staging endpoint and existing EAS staging signing identity. Build: [6ae5635b-6622-44b2-940e-d0cb312a736a](https://expo.dev/accounts/hzane111/projects/datememe/builds/6ae5635b-6622-44b2-940e-d0cb312a736a).

Source is isolated branch `codex/android-qa-release`, commit `1c372ad`, based on `2227e24` plus compile and logout fixes. Later ongoing UI, messaging, taxonomy, and test changes in the main workspace are outside this artifact. The release worktree is `/tmp/datememe-android-release-worktree`; the branch retains the committed source independently of that temporary path.

The source passed mobile and SDK typecheck, all 14 build config tests, and two logout/session-expiry regression tests. Android production bundle export passed for the compile fixes before the SDK-only logout change. EAS performs the final native bundling.

The earlier code-1 APK exposed a real logout navigation failure: stored credentials cleared, but the account screen remained until cold relaunch. The release fix retains and updates the observed auth query, cancels in-flight queries, and removes other users' cached data. A 401 current-user response also clears the displayed identity. Regression tests verify mounted hook observers see both transitions.

## Remaining release gates

A physical Android phone has not been connected for testing. Google Play submission credentials are not configured in EAS, and no Play Console app or test release has been created in this session. The production package `com.datememe.app` remains separate from staging; this AAB is not a production backend release. Play ownership/access and public support/legal details are still needed for store setup.
