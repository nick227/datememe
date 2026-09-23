# Android-first mobile publishing foundation

Status: proposed; sequenced into three practical milestones following review. Codebase assessment dated September 23, 2026 against working tree based on `ee150a8`.

## Recommendation

Keep Railway for the API, background worker, database, and Expo web export. Add an Android delivery system built around GitHub Actions, Expo Application Services (EAS) Build/Submit, and Google Play. Treat the installed app as a versioned product that must continue working independently of backend deployments.

The implementation sequence is: **standalone QA APK → trustworthy automated QA → Play internal testing**. Complete each milestone before expanding into the next. The broader publishing foundation remains a direction, not one implementation batch.

The exact milestone 1 acceptance target is:

> From a clean GitHub checkout, produce an installable `com.datememe.app.staging` Android APK through EAS, pointed exclusively at an isolated Railway staging backend/database, requiring no Metro or developer machine.

A clean checkout still requires documented organization-owned EAS credentials and staging configuration. It must not require untracked local files, a local API, or a developer's running bundler. A full GitHub build/test workflow belongs to milestone 2; a minimal manually triggered build is enough to establish milestone 1.

This document proposes environments, ownership, testing, and release gates. It does not provision infrastructure or change delivery behavior. Findings reflect the reviewed source, including existing uncommitted work; Railway account state, GitHub protection settings, EAS ownership, Play Console setup, and device behavior were not inspected. No builds or tests were run for this documentation review.

## Three milestones and acceptance criteria

| Milestone | Scope | Evidence required to finish |
| --- | --- | --- |
| **1. Get a real Android QA APK working** | Fix package identities; add `app.config.ts` and `eas.json`; explicitly configure the staging HTTPS API URL; provision isolated Railway staging API, worker, and database; build a standalone APK through EAS | Install `com.datememe.app.staging`, cold-start without Metro, authenticate with a QA account, and read/write staging data. Confirm resolved package/API configuration and isolation from production. Reproduce the build from a clean checkout. |
| **2. Make that build trustworthy** | Maestro smoke: launch → login → discovery/list → message → logout; GitHub Action builds/tests the APK; versioned database migrations before automated deployments; durable media storage | The action records a successful build and smoke run; a broken journey fails the gate. Migrations apply to fresh and existing-data fixtures. An uploaded photo remains available after API redeployment. |
| **3. Prepare Play internal testing** | Production package/signing; production AAB; Play internal testing; release/version-code discipline; production backend compatibility | Testers install the identified AAB through Play, use the intended production backend, and successfully upgrade to the next version. Record commit, build ID, package ID, and version code. |

Permanent package identities are selected in milestone 1: staging is `com.datememe.app.staging`; proposed development and production identities are `com.datememe.app.dev` and `com.datememe.app`. Confirm production namespace ownership before store registration. Production signing and Play configuration wait until milestone 3.

Database migrations and persistent media are the immediate structural follow-ups. A bounded first APK trial can use a manually initialized, disposable staging database and temporary media, provided the limitations are documented. Do not automate hosted schema changes using `prisma db push`, and do not call QA durable until media survives redeployment. Prefer completing these foundations early in milestone 2 over polishing CI.

Real email, push delivery, billing, public-store policy work, and account deletion may remain incomplete during private QA. Use synthetic accounts and controlled fixtures, and document unavailable flows. Public launch remains a separate readiness decision after these three milestones.

## Explicitly deferred

Until the first QA APK builds and runs, defer nightly full regressions, elaborate release manifests, previous-client compatibility matrices, OTA infrastructure, lower-memory device matrices, staged rollout processes, and recovery drills. They are follow-on work, not milestone 1 acceptance criteria. iOS delivery is also deferred.

After the APK works, add the single Maestro smoke journey before broadening coverage. After that workflow is reliable, move to Play internal testing. Basic credential hygiene, environment isolation, and existing service checks apply throughout.

## Current codebase assessment

| Area | Observed state | Implication |
| --- | --- | --- |
| App | `apps/mobile/package.json` declares Expo `~57.0.24`, React Native `0.86.3`, native navigation, image picker, notifications, and SecureStore. | We already have a native app foundation. Validate dependency compatibility and an actual Android build before assuming release readiness. |
| Hosting | `railway.server.json`, `railway.worker.json`, and `railway.web.json` build three services; the web service exports Expo for browsers. | Preserve this hosting model. A successful web export provides no evidence of a working Android binary. |
| Native identity | `apps/mobile/app.json` has icons and Android settings, but no Android package ID, version code, or EAS project association. No tracked EAS build/submit configuration was found. | Define permanent production identity, separate QA identity, ownership, signing, and build profiles. App config version is `1.0.0`; package version is `1.0.1`, so establish one release-version source. |
| Environments | `apps/mobile/src/lib/apiClient.ts` inlines `EXPO_PUBLIC_API_URL` and falls back to `http://localhost:3001`; examples use port 3002 and document emulator/LAN addressing. | Remove silent fallbacks from distributable builds and validate the resolved environment before building. |
| CI | `.github/workflows/ci.yml` installs dependencies, typechecks, generates/checks SDK types, pushes a schema into disposable MySQL, and runs workspace tests. | Useful starting point; no Android build, emulator test, lint step, store submission, or promotion gate is defined. |
| Contract checks | CI generates SDK types before `sdk:check`, which compares the working generated file with freshly generated output. | This can conceal stale committed types. Check drift before generation, or assert a clean generated diff afterward, and typecheck the final generated result. |
| Tests | Server has Vitest suites, including authorization, moderation, messaging, and contract tests; SDK has query invalidation tests. Mobile `test` only echoes “no tests for mobile.” `docs/test-ids.md` defines useful native selectors. | Preserve service coverage and build native journey tests on the existing selectors. A green workspace test command currently does not mean mobile was tested. |
| Database | Scripts use `prisma db push`; an ad hoc SQL change exists under `packages/db/prisma/changes`. No managed migration deployment workflow was found. | Establish a baseline and versioned migrations before unattended staging/production schema changes. |
| Media | Local disk is the implemented default provider; R2/S3 branches expect provider files absent from the reviewed provider directory. | A cloud-provider environment variable alone is insufficient. Implement durable storage and verify upload persistence across redeploys. |
| Email and push | `apps/server/src/lib/email.ts` logs email content; `apps/worker/src/jobs/PushNotificationJob.ts` simulates delivery. Mobile has a foreground notification listener. | Password recovery and notifications need real provider integration, credentials, and end-to-end device verification. |
| Monetization | `PaywallScreen.tsx` uses simulated purchase; `SubscriptionService.devPurchase` rejects `NODE_ENV=production`. | Production cannot present this as a functioning checkout. Either deliver Play billing or explicitly ship a free launch experience. |
| Safety and deletion | Backend block/report and moderation functionality exists; no `useBlock`/`useReport` use was found in mobile. No self-service account deletion flow was identified. | Verify and complete user-facing safety and deletion before public release. Admin deletion fields alone do not establish an account deletion journey. |
| Observability | Fastify logging and a simple `/health` response exist; no mobile crash reporting setup was identified. | Add release-aware crash/error reporting, readiness checks, worker monitoring, and alerts. |

Some README/CLAUDE.md feature notes lag current source: reset/verification screens, image-picker integration, and admin moderation screens now exist. Source inspection is the basis of this proposal; device verification remains outstanding.

## Environment model

Milestone 1 adds isolated staging alongside the existing hosting setup. The eventual hosted model is staging and production; creating a new production environment is not necessary to prove the first APK. Disposable native CI environments arrive in milestone 2. Avoid a third permanent hosted backend without a clear need.

Use the staging identity specified above; confirm the proposed development and production namespaces before fixing them in configuration. Expo supports side-by-side variants through distinct application IDs. [Expo app variants](https://docs.expo.dev/build-reference/variants/)

| Context | Android identity / artifact | Backend and data | Distribution |
| --- | --- | --- | --- |
| Local development | `com.datememe.app.dev`; development client | Local API/MySQL; local or disposable media and email sink | Developer device or emulator; Metro available |
| Disposable CI | Dev/test identity; emulator APK with embedded JS for journey tests | Job-owned API, worker, MySQL, deterministic fixtures; fake external delivery | CI only; resources and credentials expire with the run |
| Hosted QA | `com.datememe.app.staging`; visibly labeled QA release APK | Railway staging API/worker, separate DB and media, restricted email/push recipients | EAS internal distribution; no Metro required |
| Store candidate and public app | `com.datememe.app`; signed production AAB | Production API and services, controlled tester accounts | Play internal → closed testing when needed → production |

**A Play track is a distribution audience, not a backend environment.** The production candidate uploaded to internal testing already uses production configuration. Promote that same version code/AAB through subsequent tracks. The staging APK is a separate artifact and cannot be promoted into the production app. Production test accounts must be kept out of normal discovery and restricted to controlled interactions; do destructive testing in CI/staging.

Railway staging should mirror production service topology, build commands, schema, and integration behavior while using separate credentials, databases, media namespaces, and notification registrations. Production deserves a separate project if needed for stronger access control; the essential requirement is verified resource isolation, not a particular project count. Dashboard configuration must be inventoried before implementation because the repository does not prove what is deployed today.

### Configuration and credentials

In milestone 1, introduce `apps/mobile/app.config.ts` and `apps/mobile/eas.json`, with a standalone `qa` APK profile explicitly mapped to the EAS preview environment. Configure variant identities now; add development/emulator profiles when needed and the production AAB/submit profile in milestone 3. Profile names, backend environments, and Play tracks must not be inferred from one another.

Use an explicit app variant/environment value. Keep `NODE_ENV=production` for release-mode staging and production servers; do not switch it to development to enable purchase simulation. Use preconfigured QA membership fixtures so testing does not require the simulated purchase endpoint. Changing simulation access is outside milestone 1.

| Configuration | Owner/location | Rule |
| --- | --- | --- |
| Package ID, app name, version policy, build profiles | Repository | Review changes; QA icon/name must be distinguishable. |
| API URL, app environment, release identifier | EAS environment and validated app config | Public, embedded configuration; require HTTPS and allowlisted hosts for distributed builds. |
| DB, email, storage, push-service credentials | Railway environment | Server-only; separate values and permissions by environment. |
| Expo automation token and Play submission credentials | Protected CI/EAS secret storage | Restricted release jobs; no production credentials in pull-request code execution. |
| Android signing material | Organization-controlled EAS credentials / Play App Signing | Document upload-key recovery, access holders, and rotation; keep keys out of Git and build logs. |

All `EXPO_PUBLIC_*` values are readable by app users. Changing a Railway variable does not change an installed app's embedded API URL. Validate resolved config and generated Android metadata, rather than trusting a profile name. [Expo environment variables](https://docs.expo.dev/guides/environment-variables/) · [EAS environment usage](https://docs.expo.dev/eas/environment-variables/usage/)

## Milestone 1: prove the standalone APK

Read the installed Expo version's documentation before implementing native configuration. Preserve the existing icons/plugins and verify dependency compatibility through a real EAS Android build.

The QA profile must embed its JavaScript, produce an installable APK, and use an explicit staging HTTPS endpoint. Fail configuration validation if that endpoint is missing or points at production, localhost, an emulator alias, or a developer LAN address. Verify the resolved Android package and API endpoint before the build.

Provision staging API/worker/database with separate credentials and synthetic seed data. Verify that staging services cannot reach production resources through their configured credentials. Keep a short setup/build/install guide and record the commit and EAS build ID for the successful artifact.

Acceptance is a real installation and staging data round trip with Metro and local servers absent. Automated journey coverage is the next milestone, not a condition for finishing this one.

## Milestone 2: make the APK trustworthy

Use Maestro against the standalone APK for one deterministic journey: **launch → login → discovery/list → message → logout**. Existing selectors in `docs/test-ids.md` provide the starting point. Seed compatible users, a conversation/match, taxonomy, and sufficient membership entitlements so the journey does not depend on email, push, or real purchases. Use test-run-specific records and never run destructive fixtures against production. [Maestro React Native support](https://docs.maestro.dev/get-started/supported-platform/react-native)

Add a GitHub Action that checks out the selected commit, installs frozen dependencies, runs existing checks, produces the EAS APK, waits for completion, downloads that exact artifact, and runs the smoke journey on an Android emulator. Keep basic screenshots/logs on failure and link the APK/build result. Credentials must be restricted to trusted workflow contexts; untrusted PR code must not receive staging or signing secrets.

Correct the existing SDK drift ordering so generation cannot hide stale committed types. Keep the first workflow small; do not require a full component suite, nightly matrix, or comprehensive contract matrix to establish the smoke gate.

Before adding automated hosted deployments, baseline the database and introduce versioned migrations. Verify both fresh setup and migration of existing-data fixtures, and serialize migration execution. `db push` can remain a local/disposable development convenience; it must not serve as staging/production deployment automation.

Implement a durable media provider with staging/production isolation. The current R2/S3 factory branches alone are insufficient. Verify upload, read, deletion, and persistence through API redeployment. If a persistent volume is used temporarily, document its scaling and backup limitations.

Only after these foundations pass should merge-to-main automate staging deployment, wait for readiness, and test the corresponding QA build. Check Railway auto-deploy settings so they do not bypass the required checks. Full regressions and broader device coverage remain follow-on work.

## Milestone 3: prepare Play internal testing

Configure production signing under organization ownership, build the production AAB with a monotonically increasing version code, and upload the exact EAS artifact to Play internal testing. Verify processing/track status and install through Play. An accepted upload request does not prove availability. [EAS Android submission](https://docs.expo.dev/submit/android/)

Record only the essentials initially: commit, EAS build ID, package ID, app version/version code, and test result. Defer an elaborate release-manifest system. Document signing access and key recovery sufficiently that builds do not depend on one person's machine.

The Play candidate uses production configuration. Exercise controlled tester accounts against the intended backend, keep them out of normal discovery, and verify an upgrade from one internal release to the next. Deploy additive backend prerequisites first; avoid removing API/schema behavior needed by the installed candidate. A formal previous-client compatibility matrix can follow once there are public releases to support.

Public release automation, staged rollouts, full recovery drills, and OTA remain outside this milestone. Native-library changes require rebuilding the binary; OTA can be considered separately later. [Expo runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/)

## Public launch prerequisites

This is a later readiness checklist, outside the three-milestone implementation scope. These are gates for public availability, not prerequisites for producing the first private QA APK. Recheck the linked platform requirements when preparing launch.

- **Authentication:** real email delivery, abuse controls on login/OTP endpoints, verified recovery/session revocation, and no OTP/message bodies in production logs.
- **Media:** implemented durable storage with restricted upload/delete access, environment isolation, backup/retention policy, and verified persistence across deployments.
- **Notifications:** either ship a complete token-registration/permission/delivery/receipt-cleanup/tap-navigation path or explicitly defer push and remove misleading prompts. Verify on physical devices with production signing/configuration.
- **Monetization:** decide between a free initial launch and implemented Play billing. If paid features ship, test server-side purchase validation, restore, renewal, cancellation, refund/revocation, and entitlement reconciliation. Disable simulated purchase UI and endpoints in production.
- **Safety:** working in-app reporting and blocking, a staffed moderation process, adult-only access behavior, and published child-safety standards/contact. Google has specific standards for social/dating apps and requires applicable dating apps to restrict minors through Play Console. [Google policy](https://support.google.com/googleplay/android-developer/answer/16543315?hl=en) · [Age-restricted functionality](https://support.google.com/googleplay/android-developer/answer/16302250?hl=en)
- **Account deletion:** usable in-app initiation and a public web deletion-request path, with documented handling of profile data, photos, messages, sessions, backups, and any justified retention. [Google account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- **Store readiness:** organization/account verification, final package identity, privacy/support URLs, accurate Data safety and content-rating declarations, permission justification, screenshots, and working reviewer access. As of this review, Android's published target requirement for new phone apps/updates is API 36; confirm the effective requirement and inspect the built manifest at submission time. [Target SDK policy](https://developer.android.com/google/play/requirements/target-sdk)
- **Testing eligibility:** determine Play account type/date early. New personal accounts subject to Google's policy require at least 12 opted-in testers for 14 continuous days before applying for production access; passing that period is not automatic production approval. [Personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- **Operations:** mobile crash/ANR visibility and symbol/source-map upload, release/environment labels, API error/latency and worker backlog alerts, on-call ownership, and a tested incident/recovery runbook. Keep sensitive dating-profile and message content out of telemetry.

## Decisions needed next

For milestone 1, resolve EAS organization/project ownership and build credentials, confirm package namespaces, identify the isolated Railway staging resources and HTTPS API URL, and choose synthetic QA credentials. Document a bounded staging/build budget. These are the inputs needed to produce the APK.

Play account setup, launch countries, billing/push scope, expanded device support, and public support ownership can be settled as the relevant milestone approaches. Keep the later checklist visible without pulling those decisions into the first build.

The next implementation slice is **only milestone 1**. Finish with an installed staging APK and evidence of the exact acceptance target; then add Maestro and CI; then prepare Play internal testing.
