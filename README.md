# Voka — React / Capacitor

Voka is a deliberately minimal, authentication-first application that shares one TypeScript/React codebase across browsers, installable PWA, iPhone/iPad and Android (Capacitor). The authenticated home now manages subjects, vocabulary lists and cards. Account management is accessible via the floating profile button.

## Stack

Eine ausführliche Dokumentation aller Technologien, SaaS-Dienste, Einsatzzwecke, Alternativen und des verifizierten Konfigurationsstands steht in **[docs/TECH_STACK.md](docs/TECH_STACK.md)**.

| Layer | Technology | Main artifact |
| --- | --- | --- |
| Language/build | TypeScript, Vite | `tsconfig.json`, `vite.config.ts` |
| UI | React 19, Tailwind CSS 4, shadcn-style components (Radix UI) | `src/App.tsx`, `src/components/ui/`, `src/styles.css`, `components.json` |
| PWA | vite-plugin-pwa, Workbox | `vite.config.ts`, `public/` |
| Native | Capacitor 8 (iOS and Android) | `capacitor.config.ts` |
| Identity | Supabase Auth, Google, Apple and email/password | `src/auth/manager.ts` |
| Multi-account persistence | Separate Supabase Auth clients and browser storage keys per user | `src/auth/manager.ts`, `src/auth/registry.ts` |
| Unit tests | Vitest | `tests/unit/` |
| UI acceptance tests | Cucumber/Gherkin with Playwright | `tests/features/`, `tests/steps/`, `tests/support/` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

## Start locally

1. Install Node.js 22+ and run `npm install`.
2. The committed `.env` already contains the existing shared Supabase project URL and **publishable** key. No manual key entry is needed. Optional local overrides can be placed in git-ignored `.env.local`.
3. In the Supabase Dashboard, enable **Authentication > Providers > Email, Apple, Google** as required. Set up OAuth credentials in Apple Developer and Google Cloud Console; see [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md).
4. Run `npm run dev` and open the Vite URL.

The checked-in `.env` contains **only public, non-secret frontend configuration**. The Supabase publishable key is intended to be visible to clients; protect data with Auth and RLS. Never commit or bundle service-role/secret keys. `.env.local` remains ignored for local overrides.

## Build and test

```sh
npm run build
npm run test:unit
npx playwright install chromium
npm run dev -- --mode test-e2e
# In another terminal:
npm run test:e2e
```

The Gherkin suite uses a Playwright-intercepted fake Supabase Auth API. It **does not** connect to or modify the live database. The CI workflow executes build, unit tests and the browser scenarios. Native device testing and provider credentials require separate manual setup.

## Native builds

```sh
npm run native:add:ios       # Requires macOS and Xcode
npm run native:add:android   # Requires Android SDK
npm run native:sync
npm run native:open:ios
npm run native:open:android
```

Before shipping, change the placeholder bundle identifier in `capacitor.config.ts`, set the matching native deep-link scheme, register the iOS URL type and Android intent filter and add all redirect URLs in Supabase. See [docs/NATIVE.md](docs/NATIVE.md). Native `ios/` and `android/` platform folders are generated locally and excluded from version control until identifiers and signing are finalized.

## Architecture and behavior

- `src/auth/registry.ts` stores **only** the account list and active account ID in `localStorage`.
- `src/auth/manager.ts` creates a **distinct** Supabase Auth client, with a unique `storageKey`, for every signed-in account. Refresh token rotation is handled by each client. A temporary `voka:pending` client processes new email, OAuth and recovery flows; successful sessions are adopted by the appropriate account client. Switching active accounts does not invalidate other accounts.
- `src/auth/config.ts` centralizes runtime keys and platform callback URLs.
- `src/App.tsx` retains sign-in/registration/recovery and account management; authenticated users open `src/voka/VokaApp.tsx`, backed by Supabase `voka_*` data. See [docs/VOKA_DATA_MODEL.md](docs/VOKA_DATA_MODEL.md).
- Sign-out only deletes the selected account's **local** session; other locally signed-in accounts remain intact. This differs from global session revocation.

The existing shared Supabase project contains the `voka` app entry, `public.profiles` and the row-level security policies. The new `voka_*` tables are private to eligible signed-in users and do not change shared authorization roles, approval flows or other apps. SQL migrations are versioned in `supabase/migrations/`.

### Session security and persistence limits

The browser client persists refresh tokens in origin-scoped local storage. This supports staying signed in across restarts and automatic access-token refresh for as long as the Supabase Auth session remains valid, the user does not sign out, tokens are not revoked and storage is retained. **A months-long session cannot be guaranteed**: browser/WebView eviction, account security policies, inactivity limits, single-session policies, provider revocation or cross-site protections can require reauthentication. On a shared device, any person who can unlock the device/app can switch between locally saved users. Do **not** use this design for accounts requiring separate device-level access controls.

For production handling of higher-value data, implement platform keychain/keystore-backed encrypted session storage, an app-level unlock, CSP and XSS hardening, and test multi-device refresh-token behavior. Each Supabase client operates with the same **publishable** key; authorization for protected data must always be enforced server-side with RLS and validated identity (not a client-selected account ID).

## GitHub Pages deployment

`main` is the sole long-lived development and release branch for Voka.
Create short-lived feature branches (for example `feat/*`) and target all pull
requests at `main`. The retired `react` branch must not be used.

`.github/workflows/ci.yml` checks pull requests and pushes to `main`
(build, unit tests and end-to-end tests). The GitHub Pages deployment workflow
`.github/workflows/pages.yml` runs on pushes to `main` and builds the
React PWA with `VITE_PAGES_BASE=/voka/` for:
`https://mhuhn.github.io/voka/`.

In GitHub > Settings > Pages > Build and deployment, select
**GitHub Actions** as the source. The workflow uses the `github-pages`
environment and needs Pages write permissions. For a custom domain,
adjust the base path accordingly.

For Supabase OAuth and password recovery, authorize the published root URL
under Authentication > URL Configuration > Redirect URLs:

```
https://mhuhn.github.io/voka/
```

The production redirect uses the published directory root; the local Vite
build may use `/auth/callback`. Identity providers' Supabase callback
configuration remains unchanged. See `docs/AUTH_SETUP.md`.

The default build `npm run build` uses base `/` for native packaging;
the Pages workflow sets its base separately.

## Language, Google login, and code version

The app supports German (`de`), English (`en`), French (`fr`), Dutch (`nl`), Danish (`da`), and Italian (`it`). The first preferred browser or WebView locale determines the language, including regional variants. Unsupported languages fall back to English. Capacitor uses the same OS-backed WebView
language preferences on iOS/iPadOS and Android. The UI listens to the
`languagechange` event when the runtime provides it, and reads preferences
again whenever the application starts. Authentication and account screens,
feedback messages, accessibility text, and system error summaries are
localized. Unknown Supabase error text is not leaked untranslated on German UI.

Google sign-in remains hidden while
`VITE_GOOGLE_LOGIN_ENABLED=false`. After enabling Google in Supabase,
setting up the OAuth client, and verifying sign-in, configure this setting as
`true` before building the application.

The faint label fixed at bottom-left displays the `package.json` version
and the Git committer timestamp of the most recent change to application
code under `src/` or to application build configuration.
Within 60 minutes it shows relative minutes; for an older change on the
current calendar day it shows the time, and for earlier days it shows date and
time, in the viewer's locale/timezone. A minute-based timer keeps the label
current without rebuilding. CI and Pages fetch Git history to ensure that
the source timestamp (not the deployment time) is embedded in the build.

All profile actions, including sign-out, account switching, and adding accounts, use translated labels. Browser-based Gherkin tests verify each supported language.
