# Android staging launch validation — September 25–27, 2026

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

The corrected AAB finished successfully on September 26, 2026 UTC: `com.datememe.app.staging`, version `1.0.0`, Android code `3`, targeting API 36. It uses the staging endpoint and existing EAS staging signing identity. [EAS build](https://expo.dev/accounts/hzane111/projects/datememe/builds/76278fb9-18e5-4a00-8ff1-41d96f2bcfa4) · [signed AAB](https://expo.dev/artifacts/eas/R6GOtvhc3LnvbRQj4vjdZ234LkYVbd2xvlbtdHcLc9U.aab).

SHA-256: `ca0f5ab680f3f751443e46779416dababe8759ec514c98416d75181b4e478e22`. Local bundle: `C:\Users\Administrator\Downloads\datememe-staging-v3.aab`. Version code 2 is superseded because native photo upload exposed an Expo multipart incompatibility during emulator testing.

Source is isolated branch `codex/android-qa-release`, commit `f2ea325`, based on `2227e24` plus compile, logout, and native multipart upload fixes. Later ongoing UI, messaging, taxonomy, and test changes in the main workspace are outside this artifact. The release worktree is `/tmp/datememe-android-release-worktree`; the branch retains the committed source independently of that temporary path.

The source passed mobile and SDK typecheck, all 14 build config tests, and all eight SDK regression tests, including logout/session expiry and native/web multipart requests. The final native EAS build succeeded.

The earlier code-1 APK exposed a real logout navigation failure: stored credentials cleared, but the account screen remained until cold relaunch. The release fix retains and updates the observed auth query, cancels in-flight queries, and removes other users' cached data. A 401 current-user response also clears the displayed identity. Regression tests verify mounted hook observers see both transitions.

The earlier native picker upload failed with `Unsupported FormDataPart implementation`. Expo SDK 57 installs its Fetch implementation globally; it requires actual file bytes rather than the legacy React Native URI object. The app now supplies an `expo-file-system` File adapter to the SDK. Web blob uploads keep their existing path.

## Release bundle device verification

The AAB was converted with Google bundletool 1.18.3 into the emulator-specific APK set, signed with the existing EAS staging key, and installed as an update. This was derived from the AAB, not a separate EAS APK build. Android reports package `com.datememe.app.staging`, version code `3`, version `1.0.0`, min API 24, target API 36. The emulator is Android 15 / API 35, x86_64.

- Cold launch retained the previous signed-in session and reached Lists.
- Native photo picker → crop → upload → profile save passed. The second gallery photo is persisted in MySQL and served as normalized WebP by staging.
- Logout immediately returned to the login screen; the older APK required a restart.
- Login after that logout returned to Lists. Opening profile editing confirmed the second gallery photo remained saved.
- Sending `AAB v3 smoke` rendered in the native conversation and was confirmed through the recipient's authenticated API session.
- Discovery opened Casey's seeded profile. A subsequent force-stop/cold relaunch retained the new authenticated session, reached Lists, and retained the second gallery photo. The uploaded photo still returned identical WebP bytes.
- No staging-app crash entry or ReactNativeJS/AndroidRuntime error was found in the final inspected logs. This is one Android 15 emulator, not physical-device coverage.
- Earlier native testing exercised list edits (adding Blur to the ranked bands) and hosted profile/media rendering; code 3 also loaded those retained lists.

## Pre-upload artifact checks — September 27 UTC

The local AAB's SHA-256 still matches the completed EAS artifact. Google bundletool validation passed. The bundle includes `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`; its manifest does not enable `debuggable`.

All 44 ARM64/x86_64 native libraries have ELF load-segment alignment of at least 16 KB. The bundle requests `PAGE_ALIGNMENT_16K`, and all four installed emulator APK splits pass Android build-tools 35 `zipalign -c -P 16 4`. These are artifact checks, not a 16 KB runtime test or evidence of Play acceptance. See [Android's alignment guidance](https://developer.android.com/guide/practices/page-sizes).

A supplementary RELRO-end modulo check flagged 39 libraries. Inspecting the rounded protection ranges found no overlap with writable or executable load-segment bytes outside RELRO. Bionic rounds those boundaries when applying protection, and the inspected libraries leave sufficient gaps. We infer these flags are conservative false positives for this layout; no dependency rebuild was made on that basis. [Bionic linker implementation](https://android.googlesource.com/platform/bionic/+/refs/heads/main/linker/linker_phdr.cpp) · [LLD 18 segment layout](https://raw.githubusercontent.com/llvm/llvm-project/release/18.x/lld/ELF/Writer.cpp). A 16 KB runtime remains untested.

The [Play Internal packet](android-play-internal.md) records upload steps, release notes, and the public upload-certificate fingerprint. A verified local copy is collected in `C:\Users\Administrator\Downloads\datememe-play-internal-v3`. Only the emulator is connected. The owner signed in to Google but chose to defer paid developer registration until the app has been vetted further. Play app creation, upload, and publishing are deferred by choice. No Play app or release has been created.

## Remaining release gates

A physical Android phone has not been connected for testing. Continue private emulator and direct-install phone testing without Play registration. The existing AAB can supply signed installable APKs through bundletool; it cannot be installed directly as an AAB. Store registration, upload, and support/legal setup will resume only when the owner chooses to proceed with Play.

The production package `com.datememe.app` remains separate from staging. Uploading this bundle fixes the QA Play app's package to `com.datememe.app.staging`; it cannot be promoted into the production listing. See [Google's testing guidance](https://support.google.com/googleplay/android-developer/answer/9845334). Production requires its own configured EAS profile, an update to the profile guard in `app.config.ts`, signing identity, backend migration/volume adoption, and any applicable [closed-testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465).

Five seeded accounts have explicit QA membership grants. New/free accounts can reach the unfinished purchase flow, whose development endpoint is disabled in the hosted runtime. Provision intentional tester access or implement the real purchase flow before extending testing to users who need those features. Email and push delivery are also still simulated. This validation establishes private staging readiness, not public-launch readiness.
