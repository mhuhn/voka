# Cloud iOS / TestFlight publishing

Bundle ID: `de.mhuhn.voka`. Apple Developer Team ID: `5C4R48LJZC`.
Native OAuth callback: `de.mhuhn.voka://auth/callback`.

The [TestFlight workflow](../.github/workflows/testflight.yml) is manual and runs on a GitHub-hosted macOS runner. It does **not** require a locally installed Mac. It generates a Capacitor iOS project, builds a Release archive, signs it, exports an IPA, and uploads it to TestFlight.

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
6. In GitHub Actions run **Publish Voka iOS to TestFlight** manually.

The unsigned simulator workflow (`ios.yml`) does not need signing secrets. Signing/upload has **not been validated** until the configured workflow succeeds. Never paste Apple private keys, certificate passwords, or provisioning files into chat.
