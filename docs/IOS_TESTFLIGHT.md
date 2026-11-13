# Cloud iOS / TestFlight publishing

Bundle ID: `de.mhuhn.voka`. Apple Developer Team ID: `5C4R48LJZC`.
Native OAuth callback: `de.mhuhn.voka://auth/callback`.

The [TestFlight workflow](../.github/workflows/testflight.yml) runs when a `testflight-v*` tag is pushed, or manually through **Run workflow**. It runs on a GitHub-hosted macOS runner and does **not** require a locally installed Mac. It generates a Capacitor iOS project, builds a Release archive, signs it, exports an IPA, and uploads it to TestFlight.

Before the first run:

1. In App Store Connect, create an iOS app with Bundle ID `de.mhuhn.voka`.
2. In Apple Developer, create/download an **Apple Distribution** certificate with its *private key* exported together as a password-protected `.p12`, and an **App Store Connect** distribution provisioning profile for `de.mhuhn.voka` using the same certificate.
   A `.cer` file alone is **not** sufficient. You can use an ephemeral cloud Mac to generate the CSR/private key and export `.p12`; never commit the certificate or private key to Git.
3. In App Store Connect → Users and Access → Integrations → App Store Connect API, create a **Team API key** with appropriate upload permissions. Download the `.p8` file once and retain the Issuer ID and Key ID.
4. In GitHub repository → Settings → Environments, create `testflight`. Configure these values in the environment (or repository):
   - Secret `IOS_DISTRIBUTION_P12_BASE64`: Base64-encoded bytes of the complete `.p12`.
   - Secret `IOS_DISTRIBUTION_P12_PASSWORD`: Password for that `.p12`.
   - Secret `IOS_APP_STORE_PROFILE_BASE64`: Base64-encoded bytes of the `.mobileprovision` profile.
   - Variable `IOS_APP_STORE_PROFILE_NAME`: Exact provisioning-profile name in the Apple Developer portal.
   - The nonsecret App Store Connect Key ID (`27TM6KXCGU`) and Issuer ID (`69a6de81-6434-47e3-e053-5b8c7c11a4d1`) are configured in the workflow; no GitHub variables are needed for these IDs.
   - Secret `APPSTORE_API_PRIVATE_KEY`: Full text of the downloaded `AuthKey_*.p8` (not Base64).
5. In Supabase Authentication → URL Configuration → Redirect URLs add `de.mhuhn.voka://auth/callback`. The Apple Services ID callback remains the Supabase Auth endpoint, not this deep link.
6. Trigger **Publish Voka iOS to TestFlight** either manually or with a version tag as described below.

The unsigned simulator workflow (`ios.yml`) does not need signing secrets. The signing/upload workflow has been validated with a successful TestFlight upload. Never paste Apple private keys, certificate passwords, or provisioning files into chat.

## Export compliance / Verschlüsselung

Der TestFlight-Workflow erzeugt das Capacitor-iOS-Projekt bei jedem Release neu.
Deshalb setzt er nach `npx cap add ios` in der generierten
`ios/App/App/Info.plist` automatisch den booleschen Eintrag:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Damit erklärt Voka, dass die App **einschließlich eingebundener Bibliotheken**
keine nicht von der Exportdokumentation ausgenommene Verschlüsselung nutzt.
Dies passt zum derzeitigen Voka-Stack, der auf der üblichen Plattform-/
Browser-Verschlüsselung für HTTPS/TLS aufbaut und keine eigens implementierten
Verschlüsselungsalgorithmen verwendet. Nach dem Xcode-Archivieren prüft ein
zusätzlicher Workflow-Schritt, dass `ITSAppUsesNonExemptEncryption = NO`
**wirklich in der archivierten App** enthalten ist, bevor die IPA hochgeladen wird.

Apple verwendet die Deklaration, um künftig bei neuen Builds die wiederholte
Export-Compliance-Frage zu vermeiden. **Bereits hochgeladene Builds werden
nicht rückwirkend geändert**; für diese muss eine eventuell fehlende
Compliance-Angabe noch manuell in App Store Connect gemacht werden.

**Wichtig:** Falls Voka in Zukunft eigene kryptografische Funktionen,
nicht ausgenommene Verschlüsselung oder neue Bibliotheken mit entsprechender
Funktionalität integriert, muss die Einstufung vor dem nächsten Release erneut
geprüft und dieser Eintrag gegebenenfalls angepasst werden. Die Deklaration
ersetzt keine eventuell erforderlichen sonstigen rechtlichen Pflichten.

Apple-Dokumentation: [ITSAppUsesNonExemptEncryption](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption) · [Export compliance for beta builds](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-export-compliance-information-for-beta-builds).


## Publishing a tagged TestFlight build

Publish the desired commit to `main`, then create and push a new tag using a three-part iOS version number:

```bash
git switch main
git pull --ff-only origin main
git tag testflight-v0.16.2
git push origin testflight-v0.16.2
```

GitHub Actions starts automatically on the tag push and builds the **tagged commit**, not whatever commit happens to be at the tip of `main` later. The tag example is illustrative; use a new version number for each release. Normal pushes to `main` do **not** trigger TestFlight. You may also create a version tag using GitHub's **Releases → Draft a new release → Choose a tag → Create new tag** flow, selecting `main` as the target.

Tags must use the `testflight-vX.Y.Z` naming convention (e.g. `testflight-v0.16.2`). The workflow sets the native `CFBundleShortVersionString` using Xcode's `MARKETING_VERSION` from the tag. The native build number (`CFBundleVersion`) uses the increasing GitHub Actions run number. On a manual `workflow_dispatch` run, the native version comes from `package.json` instead.

The tag must point to a commit containing this workflow configuration. Do not move an already published tag to a different commit; create a new tag/version instead. Creating a tag alone in a local Codespace does not start the workflow: it must also be pushed to GitHub.
