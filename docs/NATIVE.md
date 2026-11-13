# Native Capacitor setup

Capacitor wraps the same `dist/` build for iOS/iPadOS and Android. The bundle identifiers and URL schemes are intentionally placeholders.

## Provision

1. Choose your final reverse-DNS app ID; edit `appId` in `capacitor.config.ts`.
2. Set `VITE_NATIVE_REDIRECT_URL` to a matching custom URL, for example `com.example.voka://auth/callback`.
3. Run `npm run native:add:ios`, `npm run native:add:android`, then `npm run native:sync`.
4. In Xcode, add a URL Type to your app target's Info > URL Types with URL scheme `com.example.voka`. This adds `CFBundleURLTypes` to the generated `Info.plist`.
5. In `android/app/src/main/AndroidManifest.xml`, inside the main activity, add an intent filter:

```xml
<intent-filter android:autoVerify="false">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="com.example.voka" android:host="auth" android:path="/callback" />
</intent-filter>
```

6. Add the exact native redirect URL to Supabase Auth redirect URL allow list; enable Google and Apple providers and platform-specific credentials as needed.
7. Build/run the project in Xcode or Android Studio. Validate first launch, email sign-in, provider sign-in, email verification, password reset, background/foreground, account switching, token refresh, and OS process termination.

## Deep links and session renewal

Native OAuth is launched in the system browser using `@capacitor/browser`, with `skipBrowserRedirect`. `@capacitor/app` receives `appUrlOpen` and `getLaunchUrl` callbacks. Supabase PKCE exchanges run in the app. On the web, OAuth redirects normally. Deep link configuration must match the URL emitted from `src/auth/config.ts`.

The native WebView currently uses the same localStorage session persistence as the PWA. For stronger security on production devices, replace the Supabase Auth storage adapter with a Keychain/Keystore-backed adapter and consider biometric/app lock. Store no service-role keys in the binary. Shared device multi-account switching intentionally does not require a separate login while other sessions are valid.

## Not yet provisioned

Native platform directories, provisioning profiles, signing keys, developer-account credentials, final identifiers, store metadata, and distribution are not included. Native builds have not been verified until the above steps are completed on the platform toolchains.
