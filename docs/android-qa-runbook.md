# Android QA builds

The available artifact is the **version-code-4 staging AAB** and its locally generated universal APK. Native testing found composer/keyboard and first-visit paywall navigation defects; a corrected code-6 AAB is building. Check [current validation status](android-launch-validation.md#composer-and-navigation-correction--september-29-utc) before choosing a phone candidate. It contains the logout, native photo upload, expired-session cache, and messaging upgrade-route fixes. Use the exact artifact/source and coverage in [Android launch validation](android-launch-validation.md). **Play developer registration and upload remain deferred by choice.** Physical-phone coverage is pending. Staging already has versioned migrations and a persistent media volume; see [mobile data operations](mobile-data-operations.md). Broad automation remains deferred.

The [first Play Internal release packet](android-play-internal.md) is historical code-3 material retained for later. Use the code-4 files below for current private testing. Neither Play registration nor another cloud APK build is required.

## Direct phone installation

Install `C:\Users\Administrator\Downloads\datememe-staging-v4-universal.apk` (100,346,884 bytes). It includes ARM64/ARMv7 phone architectures and both emulator architectures, uses package `com.datememe.app.staging`, version `1.0.0`, code `4`, and retains the EAS staging signing identity. APK signature verification and 16 KB ZIP alignment passed. SHA-256: `de5437bacfb74fdcbe52be968037b5a3d96e3b4439e2e1504a24671bc7882d2c`.

Transfer the APK to the phone and open it, allowing installation from that file source if Android prompts. Alternatively, install with `adb -s PHONE_SERIAL install -r APK_PATH`, selecting the phone explicitly while the emulator is connected. This updates prior QA installations without uninstalling or clearing app data. The adjacent README contains setup instructions and the focused test checklist. Newer ongoing changes on main are outside this pinned release candidate.

The universal APK is ready to install. As an optional alternative, connect a phone and authorize USB debugging, then use Google's `bundletool` to generate a smaller device-specific APK set from `datememe-staging-v4.aab`:

1. Select the phone's ADB serial explicitly.
2. Run `bundletool build-apks` with the code-4 AAB, `--connected-device`, and the phone's `--device-id`, supplying the **existing EAS staging signing identity** privately. Do not use the default debug signing identity.
3. Run `bundletool install-apks` with the resulting `.apks` archive and the same phone serial.

These are the official [bundletool device generation and installation steps](https://developer.android.com/tools/bundletool). Keep signing material outside the repository. The AAB cannot be installed directly. Record actual physical-phone results after installation; emulator results do not establish phone coverage.

## Superseded first QA artifact

The code-1 APK below is historical evidence of the initial standalone milestone. Use the current code-4 candidate for further private testing.

- [EAS build d40dec2f-55d8-422a-b98f-e5601527b508](https://expo.dev/accounts/hzane111/projects/datememe/builds/d40dec2f-55d8-422a-b98f-e5601527b508) finished successfully on September 23, 2026.
- [Download the signed APK](https://expo.dev/artifacts/eas/bkBnlG_LAyEpoNblmyVdq3LpeD-eBuY__YCujb__4os.apk): version `1.0.0`, Android version code `1`, package `com.datememe.app.staging`.
- SHA-256: `a0e2e74646df0106c266c200762e0cbf626a099ef7fd8ff386ac6a660fbcbad7`.
- The APK contains the JavaScript bundle and the approved staging URL in its embedded app configuration. It installs on the Android 15 / API 35 emulator and targets API 36.
- Device checks on September 24: a cold launch rendered the native login screen; a synthetic account signed in against hosted staging and loaded the seeded lists screen. A profile bio edited and saved in the app remained visible after force-stop and cold relaunch, with the authenticated session retained. No development-server prompt appeared, ADB reverse forwarding was empty, and no native crash or fatal JavaScript/development-server error was found in the inspected logs. The existing local Metro process was left running for other development; the release app used its embedded bundle and hosted API.
- This validates installation, standalone launch, authentication, hosted reads/writes, and persistence on one emulator. Automated smoke, messaging/discovery regression, physical-device coverage, and Play installation remain outside this milestone.
- This first artifact was built from the uploaded working tree based on `1b79598`, including the new QA configuration. A clean archive of the subsequently committed implementation at `e2423fc` passed frozen installation, all seven config tests, mobile typecheck, and QA config resolution on September 24. The clean-archive check is separate from the first artifact's build provenance.

This is a private QA artifact, not a Play release. Download it from the build page if the direct artifact link becomes unavailable.

## Identities and infrastructure

| Resource | Value |
| --- | --- |
| QA application | `Datememe QA` / `com.datememe.app.staging` |
| Local development package | `com.datememe.app.dev` |
| Reserved production package | `com.datememe.app` (no production build profile yet) |
| EAS project | [hzane111/datememe](https://expo.dev/accounts/hzane111/projects/datememe) |
| EAS project ID | `6343c118-dcf3-4516-a55a-cea4b9245654` |
| API | `https://qa-server-staging.up.railway.app` |
| Railway project | `3ef0c206-b810-46f8-b945-93ec52a4a8c5` |
| Railway staging environment | `9862b525-734a-47c7-9e76-69bf8d26e308` |
| QA API service | `qa-server` / `ef845c94-872b-4fc9-b2a6-712a5201d11e` |
| QA worker service | `qa-worker` / `cd9af5bf-ba17-4eef-b645-3467917fd608` |
| QA database service | `qa-mysql` / `f61fdbf1-7d54-42d9-8ccd-13dcbf2620f5` |
| QA database | `datememe_staging` on `qa-mysql.railway.internal` |

Staging was created empty, with a separate MySQL volume and newly generated credentials. Production services were not duplicated or changed. API and worker use the staging-only reference `${{qa-mysql.MYSQL_URL}}`. Their `APP_ENV` is `staging`, while `NODE_ENV` remains `production`. The QA API hostname is explicitly allowlisted in `app.config.ts`; pointing QA at production or localhost fails before building.

The first schema setup used a guarded, one-time `prisma db push` against the new staging database, followed by the existing taxonomy seed. Staging has since been backed up and baselined, and the result-table migration has been applied. The API now runs versioned migrations before deployment. See [migration and media operations](mobile-data-operations.md) for the exact commands, backup limits, and production adoption requirements.

## Build from a clean checkout

This section is for a new candidate after source changes. Reuse the existing AAB for the current private testing pass.

Use Node **22.22.0** (also recorded in `.node-version`) and pnpm **10.12.1**. From the repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm --filter mobile test
pnpm --filter mobile qa:config
pnpm --filter mobile qa:store:build
```

The build command runs pinned EAS CLI **24.7.0** through `pnpm dlx`. Authenticate with an Expo account that has access to `hzane111/datememe`; for unattended use, supply `EXPO_TOKEN` through the runner's secret store. The initial keystore has been created in EAS for the staging package. This is a QA signing identity, separate from future production signing.

The primary `qa-store` command builds an AAB; derive installable APKs locally as described above. The optional `qa:build` command produces a cloud-built APK. Both inherit the same staging configuration. The `qa` profile supplies `APP_VARIANT=staging` and the explicit API URL, selects the EAS `preview` environment, and builds a release APK with `developmentClient=false`. No local `.env`, Metro, local backend, or Android toolchain is needed to build on EAS. `app.json` holds shared assets/plugins and the EAS project association; `app.config.ts` derives variant identity and validated runtime configuration. The runtime reads that same validated endpoint through Expo Constants.

The installed app version comes from `expo.version` in `app.json`, currently `1.0.0`; the workspace package version is not a store version. The verified first APK has Android version code `1`. New EAS builds use remote version management and auto-increment, shared by the staging APK and AAB profiles. The local `versionCode: 1` is an initialization seed, not the version of a subsequent cloud artifact. EAS initializes from that seed when no remote counter exists, then increments it. Record the actual version code from each build; do not reset the remote counter or reuse a Play upload's code. See [Expo app version management](https://docs.expo.dev/build-reference/app-versions/).

Do not put overriding API/variant values in the EAS preview environment. If staging moves, update both the allowlist and profile together and rerun the configuration tests. The EAS archive uses the repository-root `.easignore`, excluding local environments, credentials, uploads, generated native trees, and build output while retaining workspace dependencies and lockfile.

For a build status check from `apps/mobile`, supply the same explicit configuration:

```sh
APP_VARIANT=staging \
EXPO_PUBLIC_API_URL=https://qa-server-staging.up.railway.app \
pnpm dlx eas-cli@24.7.0 build:view BUILD_ID
```

Record the build ID, source commit, and artifact link. Download the AAB and derive signed APKs locally, or download the APK directly if the optional APK profile was selected. Private installation has no Play Console dependency.

## Prepare the staging Play AAB

`qa-store` inherits `qa` and changes only distribution to `store` and Android output to `app-bundle`. It retains `Datememe QA`, `com.datememe.app.staging`, the staging-only API allowlist, the EAS preview environment, release mode, and automatic version-code increments. The `qa` profile remains available for directly installable APKs. These profile options follow the [EAS configuration reference](https://docs.expo.dev/eas/json/).

After validating the source intended for the next store candidate, run from the repository root:

```sh
pnpm --filter mobile test
pnpm --filter mobile typecheck
pnpm --filter mobile qa:config
pnpm --filter mobile qa:store:build
```

The final command starts an EAS AAB build; it does not submit to Google Play. Code `4` is the latest successfully built artifact; preserve the remote counter so subsequent uploads advance it. Inspect each completed AAB's package, staging endpoint, version, version code, and signing identity before upload, and retain its build ID and source commit.

This AAB is intended for a separate **Datememe QA** Play application with package `com.datememe.app.staging`, using its internal testing track and staging data. It cannot become the future production `com.datememe.app` application: [Play fixes the package name after the first upload](https://support.google.com/googleplay/android-developer/answer/9845334). Production needs its own package registration, signing setup, backend configuration, and build profile; `app.config.ts` currently permits only staging EAS profiles and must also be updated. Any applicable [production-access testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465) must be satisfied for the production app.

Play registration, app creation, signing enrollment, tester setup, and upload are deferred while private testing continues. When Play distribution resumes, the signed AAB can be uploaded manually through Play Console; EAS submission credentials are not required for that route. This repository has no `submit` profile or automatic submission command.

## Verify the installed app

1. Install alongside any development app; confirm the label is **Datememe QA** and the package is `com.datememe.app.staging`.
2. Cold-start without relying on Metro or a local API. A fresh install must reach login; an update or relaunch with a valid session must return to the signed-in app. Neither should ask for a development server.
3. Register a synthetic account or use an existing QA account; sign in over the hosted staging API.
4. Save a profile/photo change and a ranked list edit, open discovery and a profile, and send a message. Sign out and back in, then force-stop/relaunch and verify the saved changes and session survive.
5. With a free synthetic account, open an incoming locked message → Unlock → paywall, then return to messaging. After reaching the daily message allowance, verify Go Premium opens the paywall and the rejected message draft remains available when returning. Do not treat these navigation checks as working purchase integration.
6. Log out of a populated account and register/sign into a different account. The previous account's lists and messages must not appear.
7. Record the source AAB build ID, installed version code, Android version/device, whether this was a fresh install or an update retaining data, results, and any crash/log evidence. Check database identity through the staging API service configuration rather than relying only on the app label.

The `android-qa@example.test` account was created for initial verification with a generated password, not a shared production credential. Create your own QA account in the app if you do not have its credentials. No real email delivery is needed for initial registration/login.

## Backend operations and current limitations

The QA services use the full monorepo. API build command:

```sh
pnpm --filter @project/db exec prisma generate && pnpm --filter @project/db build && pnpm --filter server build
```

Worker substitutes `worker` for `server`; starts are `node apps/server/dist/index.js` and `node apps/worker/dist/index.js`. Node is pinned with `RAILPACK_NODE_VERSION=22.22.0`. API health path is `/health`. Set `BASE_URL` to the staging HTTPS endpoint; keep DB/session credentials server-side. CORS is deliberately restricted because this milestone distributes a native client, not a staging web frontend.

Deploy only with explicit project/environment/service IDs. For example, from the repository root:

```sh
railway up \
  --project 3ef0c206-b810-46f8-b945-93ec52a4a8c5 \
  --environment 9862b525-734a-47c7-9e76-69bf8d26e308 \
  --service ef845c94-872b-4fc9-b2a6-712a5201d11e \
  --detach --json --message 'QA API update'
```

An upload is not deployment success: confirm that returned deployment ID reaches `SUCCESS` and verify the hosted API. Source auto-deployment is not configured. The API's pre-deploy command is `pnpm --filter @project/db db:migrate:deploy`; the worker does not run migrations independently.

Staging media uses a dedicated Railway volume at `/data/uploads`; retain one API replica and follow the backup guidance in [mobile data operations](mobile-data-operations.md). Email and push delivery remain simulated; native purchases are not implemented and the server disables the simulated purchase endpoint in production runtime mode. These limitations are expected for private QA. Do not use real personal data or treat this environment as a public launch.

Local development remains explicit: copy `apps/mobile/.env.example` to `.env` and select the emulator/LAN endpoint documented there. Railway web builds should explicitly set `APP_VARIANT=production` with their existing HTTPS API URL when adopting this configuration; the deployed production web service was not changed during QA setup.
