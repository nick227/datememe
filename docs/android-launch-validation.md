# Android staging launch validation — September 25–29, 2026

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

Source is isolated branch `codex/android-qa-release`, commit `f2ea325`, based on `2227e24` plus compile, logout, and native multipart upload fixes. Later ongoing UI, messaging, taxonomy, and test changes in the main workspace are outside this artifact. The build used the temporary worktree `/tmp/datememe-android-release-worktree`, which was removed by a later local environment restart. Branch `codex/android-qa-release` retains the committed source; check out the recorded commit for reproduction.

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

## Private testing follow-up — September 28 UTC

Play registration remains deferred by the owner. A universal APK was generated locally from the exact code-3 AAB without another EAS build: `C:\Users\Administrator\Downloads\datememe-staging-v3-universal.apk` (100,346,884 bytes). Its SHA-256 is `91bfdb424010a4185545e32a21c2da225fec7eb9574c82fe31ccbdcd39a573f1`. APK signature verification, the expected EAS staging certificate, and 16 KB ZIP alignment passed. This APK still contains artifact source `f2ea325`.

An additional native journey used a newly registered synthetic adult account, Taylor QA, with **FREE** membership and no grant:

- Registration reached Lists; hosted reads confirmed an empty profile and zero saved lists, with no previous QA account's data carried into the new account.
- Saved the first complete ranked list: Blur, Radiohead, Oasis, Nirvana, Pearl Jam. The hosted API returned all five in that order; discovery then returned eight candidates and rendered people under the Music filter.
- Opened Casey's profile, completed a mutual like against the synthetic Casey fixture, and opened the resulting conversation. A native outgoing message was confirmed by Casey's API session.
- An incoming reply was locked for the free account; the API withheld its body. The app rendered the locked message.
- Reproduced a broken **Unlock** action: the conversation stayed open. The Account screen's **Go Premium** action reached the paywall, confirming this is a conversation navigation bug. Both conversation upgrade links now target `ProfileTab` in source.

Search selection worked with direct taps. UIAutomator clipped the absolute dropdown's accessibility bounds, causing the initial scripted taps to miss; this was corrected in the manual test coordinates, with no search code change.

The expired-session cache fix is in main commit `0161d57` and backported as `ea58866`; the upgrade navigation fix is in isolated release commit `ae8b296`. Release source at `ae8b296` passes mobile/SDK typecheck and all nine SDK tests, including removing another account's cached lists/messages and ignoring late responses after session expiry. **These later fixes are not in the code-3 APK/AAB and still need native validation in a subsequent candidate.** At that prebuild check, main's ongoing admin, messaging, and content UI changes failed the full mobile typecheck; that workspace was not the source of the tested artifact. This does not describe subsequent main changes.

The universal code-3 APK was installed over the emulator's split installation using the same signing identity. Cold launch retained the new account and its one completed list/five picks. The inspected crash and ReactNativeJS/AndroidRuntime logs contained no Datememe crash or runtime error. Physical-phone coverage is still pending.

## Corrected candidate — September 29 UTC

The corrected AAB completed successfully at `2026-09-29T03:39:24.984Z`: [EAS build 7f2918ed-c05b-4377-833b-64093533ab25](https://expo.dev/accounts/hzane111/projects/datememe/builds/7f2918ed-c05b-4377-833b-64093533ab25) · [signed AAB](https://expo.dev/artifacts/eas/SZR5y8s_fRlSxsNtWpL-j72P8TVvkWeYXaidJQv87L0.aab). Source is release commit `ae8b2966b775022d7959af49f642997f79e58f5d`, version `1.0.0`, code `4`, package `com.datememe.app.staging`. It includes the expired-session cache and conversation upgrade-route fixes. Later work on main is outside this artifact.

Local artifacts in `C:\Users\Administrator\Downloads`:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `datememe-staging-v4.aab` | 67,264,978 | `b1bb42e31a8b54ca741fa5b21bbdba8f5939a8decb7a8f03657b375622e0d596` |
| `datememe-staging-v4-universal.apk` | 100,346,884 | `de5437bacfb74fdcbe52be968037b5a3d96e3b4439e2e1504a24671bc7882d2c` |

The universal APK was generated locally from that exact AAB with Google bundletool 1.18.3 and the existing EAS staging signing identity. Bundle validation, APK signature/certificate verification, and 16 KB ZIP alignment passed. It includes ARM64, ARMv7, x86, and x86_64, min API 24 and target API 36. Temporary local signing exports were removed after packaging. Checksums are stored beside both artifacts.

Expo usage after the build remains on the Free plan: 4 of 15 Android builds used, zero overage and zero estimated cost. No Play registration or paid plan was initiated.

Code 4 installed as an update over code 3. The existing emulator became very slow during installation/startup; after a full emulator cold boot without wiping data, the app loaded Taylor QA and the saved one-list/five-pick state. Both locked-message **Unlock** and daily-limit **Go Premium** opened the paywall. Two short native messages were confirmed by the recipient API session. The rejected daily-limit draft remained when returning from the paywall. A later logout returned immediately to Login, and signing in as Casey showed Casey's profile and four lists/twelve picks instead of Taylor's one list/five picks. Paywall Back returns to Lists; selecting Messages restores the existing conversation.

This pass found an additional Android composer defect: the visible software keyboard covers the input, and a longer draft expands the unconstrained text-field wrapper until Send leaves the screen. Short messages can be sent after dismissing the keyboard. A minimal layout correction is being prepared; code 4 is retained as evidence, not an approval of the messaging typing experience. Physical-phone coverage remains pending.

## Composer and navigation correction — September 29 UTC

The code-4 pass also reproduced a first-visit navigation problem: after opening an incoming message's paywall before visiting Profile, Back returned to Lists and the Profile button reopened the paywall instead of exposing profile/account settings. Messaging paywall navigation now sets `initial: false` so the Profile route remains beneath Paywall, following [React Navigation's nested initial-route behavior](https://reactnavigation.org/docs/nesting-navigators/#rendering-initial-route-defined-in-the-navigator).

The layout fix wraps the messages and composer together in keyboard avoidance on Android and gives the text-field wrapper constrained flex space, preserving room for Send as the draft grows. The equivalent changes have been applied to current main while retaining its newer system-conversation UI. Main's full mobile typecheck still reports unrelated admin, discovery, profile-editor, and content-card errors; the isolated release source passes.

Isolated release branch `codex/android-qa-composer` at `c5ac6a1cc85b5be94d40342004beca8dff4cb6c7` contains the composer and first-visit paywall corrections. Mobile typecheck and 14 build-configuration checks passed. The new [version-code-6 AAB build](https://expo.dev/accounts/hzane111/projects/datememe/builds/e8a3d91d-c3f0-4709-bd03-89d20657b6bd) is pending; it must complete and pass native checks before replacing code 4. The earlier code-5 build `f4b21554-1671-4225-97bc-6558aec50161` was canceled in the queue to include the additional navigation fix in one candidate. No code-5 artifact was tested or distributed.

## Remaining release gates

A physical Android phone has not been connected for testing. Continue private emulator and direct-install phone testing without Play registration. The existing AAB can supply signed installable APKs through bundletool; it cannot be installed directly as an AAB. Store registration, upload, and support/legal setup will resume only when the owner chooses to proceed with Play.

The production package `com.datememe.app` remains separate from staging. Uploading this bundle fixes the QA Play app's package to `com.datememe.app.staging`; it cannot be promoted into the production listing. See [Google's testing guidance](https://support.google.com/googleplay/android-developer/answer/9845334). Production requires its own configured EAS profile, an update to the profile guard in `app.config.ts`, signing identity, backend migration/volume adoption, and any applicable [closed-testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465).

Five seeded accounts have explicit QA membership grants. New/free accounts can reach the unfinished purchase flow, whose development endpoint is disabled in the hosted runtime. Provision intentional tester access or implement the real purchase flow before extending testing to users who need those features. Email and push delivery are also still simulated. This validation establishes private staging readiness, not public-launch readiness.
