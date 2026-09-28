# Datememe QA: first Play Internal release

Prepared September 27, 2026 UTC. **Play developer registration and upload are deferred by choice while private testing continues.** No Play release or tester opt-in is available. The current focus is emulator regression and direct installation on one physical Android phone. The existing AAB has passed the emulator checks in [Android launch validation](android-launch-validation.md); physical-phone coverage is still pending. A verified copy, checksum, and release notes are also collected in `C:\Users\Administrator\Downloads\datememe-play-internal-v3`.

Reuse this AAB now: when a phone is connected, generate its device-specific APK set with `bundletool`, sign that set with the existing EAS staging identity, and install it on the selected phone. The AAB is not directly installable; this route needs neither Play registration nor another EAS APK build. Follow the [direct-install runbook](android-qa-runbook.md#direct-phone-installation-from-the-existing-aab). The Play steps below are retained for when store distribution resumes.

## Artifact retained for later upload

| Field | Value |
| --- | --- |
| App | Datememe QA |
| Package | `com.datememe.app.staging` |
| Version / code | `1.0.0` / `3` |
| Suggested release name | `1.0.0 (3) — staging QA` |
| Source | `codex/android-qa-release`, commit `f2ea325` |
| Backend | `https://qa-server-staging.up.railway.app` |
| Local AAB | `C:\Users\Administrator\Downloads\datememe-staging-v3.aab` |
| SHA-256 | `ca0f5ab680f3f751443e46779416dababe8759ec514c98416d75181b4e478e22` |

[EAS build](https://expo.dev/accounts/hzane111/projects/datememe/builds/76278fb9-18e5-4a00-8ff1-41d96f2bcfa4) · [Download AAB](https://expo.dev/artifacts/eas/R6GOtvhc3LnvbRQj4vjdZ234LkYVbd2xvlbtdHcLc9U.aab) · [Release notes](releases/android-staging-v3.txt)

The first upload permanently establishes the package for this Play app. Create a separate QA listing: this artifact cannot become the reserved production app `com.datememe.app`. Later production work needs its own configuration and listing. [Google app setup](https://support.google.com/googleplay/android-developer/answer/9859152)

## When Play distribution resumes: create the QA app and release

1. Sign in to [Play Console](https://play.google.com/console/) using the intended developer account. Expo access does not establish Play ownership or access. The operator needs permission to create the app and release to testing tracks.
2. Choose **Home → Create app**. Use **Datememe QA**, **English (United States)**, **App**, and **Free** for this QA distribution. Supply the owner's actual contact email and complete the factual declarations and Play App Signing terms. No support address or legal identity has been established in this packet. [Google app creation](https://support.google.com/googleplay/android-developer/answer/9859152)
3. Open **Test and release → Testing → Internal testing → Create new release**. If disabled, follow the specific outstanding Dashboard tasks. Internal testing can start before full app setup; Google may initially show a temporary app name. [Google Internal Testing](https://support.google.com/googleplay/android-developer/answer/9845334)
4. Complete the first-release Play App Signing setup described below, then upload the AAB above. Confirm package `com.datememe.app.staging`, version `1.0.0`, code `3`. Enter the suggested release name and paste the release-note text inside the Console's `en-US` language tags.
5. Save the draft, select **Next**, and resolve reported errors. Review the destination **Internal testing** before publishing. If Console requires review, save and submit the changes through **Publishing overview**. Record the displayed release status; a saved draft is not a distributed release. These are Google's [release preparation and rollout steps](https://support.google.com/googleplay/android-developer/answer/9859348).

This manual browser upload uses the already signed AAB. It does not invoke EAS Submit, require an EAS submission profile, or require a service-account JSON credential.

## Signing choice

Use Google's generated **app signing key** for this new QA Play app. Google signs the APKs delivered by Play; the existing EAS staging key signs uploaded bundles and serves as the **upload key**. Keep using that EAS key for subsequent QA builds. Record both certificate fingerprints from the signing page; they represent different roles. [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)

The current AAB's upload certificate SHA-256 is `0D:35:95:12:CF:41:E8:94:93:FF:2F:2E:10:20:08:2C:08:4A:4F:50:14:85:78:75:95:D9:18:50:F9:EE:3C:A4`, read directly from the signed artifact. This is a public certificate fingerprint, not the private key or the future Play app-signing certificate.

The emulator's current sideload uses the EAS key. A Play build with a different app signing certificate cannot replace it as an ordinary update. For that case, use a clean test device or deliberately uninstall the QA sideload before installing from Play. Uninstalling clears local app/session state; record any unsaved work first. Hosted staging records remain on the server. This installation consequence follows from Android's [signing requirements for updates](https://developer.android.com/studio/publish/app-signing#considerations).

## When Play distribution resumes: add testers and verify delivery

On **Internal testing → Testers**, create/select an email list using the testers' actual Google Account addresses. Supply an owner-approved feedback address or URL, then save. Internal testing supports up to 100 testers. Once published, copy its opt-in link; each tester must open it with the listed Google Account, opt in, and install through Play. Search is not the distribution route. First availability can take several hours. [Google tester setup and opt-in](https://support.google.com/googleplay/android-developer/answer/9845334)

Assign distinct staging app accounts separately from Play tester membership. Five seeded accounts have QA membership grants; Riley is the free-tier fixture. New/free accounts can encounter the unfinished purchase flow, whose simulated purchase endpoint is disabled on hosted staging. Play tester access does not grant Datememe membership. Provision intentional QA access for feature testing; do not promise working purchases. Email and push delivery remain simulated. Credentials belong in a private channel, never these files or release notes.

On one physical phone, confirm the Play-installed version and run login → profile/photo save → ranked list edit → discovery/profile → message → logout/login → force-stop/relaunch. Record device/Android version, installed version code, failures, and persistence results in the validation report. Record the actual Play app URL, release status, and tester opt-in link after publication; none is known yet.
