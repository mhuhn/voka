# Native Capacitor setup

Capacitor wraps the same `dist/` build for iOS/iPadOS and Android. The iOS bundle identifier is registered as `de.mhuhn.voka` in Apple Developer; its callback scheme is `de.mhuhn.voka`.

## Provision

1. Use the registered bundle identifier `de.mhuhn.voka`, already set in `capacitor.config.ts`.
2. Use the native callback `de.mhuhn.voka://auth/callback`; set `VITE_NATIVE_REDIRECT_URL` to this value when overriding the default.
3. Run `npm run native:add:ios`, `npm run native:add:android`, then `npm run native:sync`.
4. In Xcode, add a URL Type to your app target's Info > URL Types with URL scheme `de.mhuhn.voka`. This adds `CFBundleURLTypes` to the generated `Info.plist`.
5. In `android/app/src/main/AndroidManifest.xml`, inside the main activity, add an intent filter:

```xml
<intent-filter android:autoVerify="false">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="de.mhuhn.voka" android:host="auth" android:path="/callback" />
</intent-filter>
```

6. Add the exact native redirect URL to Supabase Auth redirect URL allow list; enable Google and Apple providers and platform-specific credentials as needed.
7. Build/run the project in Xcode or Android Studio. Validate first launch, email sign-in, provider sign-in, email verification, password reset, background/foreground, account switching, token refresh, and OS process termination.

## Deep links and session renewal

Native OAuth is launched in the system browser using `@capacitor/browser`, with `skipBrowserRedirect`. `@capacitor/app` receives `appUrlOpen` and `getLaunchUrl` callbacks. Supabase PKCE exchanges run in the app. On the web, OAuth redirects normally. Deep link configuration must match the URL emitted from `src/auth/config.ts`.

The native WebView currently uses the same localStorage session persistence as the PWA. For stronger security on production devices, replace the Supabase Auth storage adapter with a Keychain/Keystore-backed adapter and consider biometric/app lock. Store no service-role keys in the binary. Shared device multi-account switching intentionally does not require a separate login while other sessions are valid.

## Not yet provisioned

Native platform directories, provisioning profiles, signing keys, developer-account credentials, store metadata, and distribution are not included. Native builds have not been verified until the above steps are completed on the platform toolchains.
