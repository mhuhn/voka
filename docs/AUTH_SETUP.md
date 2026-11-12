# Authentication configuration

## Shared backend

Supabase project: \`vqpsrqepcypqmfmceiqr\` (existing \`storage\` project, hosted in EU West). App key: \`voka\`. The existing \`public.profiles\` table is provisioned by an Auth trigger; no migrations are required for this shell.

1. Set the project's publishable key in \`.env.local\` as \`VITE_SUPABASE_PUBLISHABLE_KEY\`. The URL is \`https://vqpsrqepcypqmfmceiqr.supabase.co\`.
2. Supabase > Authentication > URL Configuration: set the actual deployed URL as site URL and allow \`http://localhost:5173/auth/callback\`, production \`https://YOUR_DOMAIN/auth/callback\`, and the final native scheme callback URL. For local development on other ports/hosts, explicitly allow those exact origins.
3. Supabase > Authentication > Providers > Email: enable email/password and decide whether to require email confirmation. The app supports both immediate session and email confirmation, and uses Supabase's hosted email templates.
4. Supabase > Authentication > Providers > Google: configure an OAuth 2.0 client and set its authorized redirect URI to \`https://vqpsrqepcypqmfmceiqr.supabase.co/auth/v1/callback\`; paste client ID/secret into Supabase.
5. Supabase > Authentication > Providers > Apple: configure Sign in with Apple, Services ID, Team ID, Key ID and signing key. Set Apple's return URL to the same Supabase callback endpoint; configure Apple provider in the Supabase Dashboard. Apple may require additional iOS entitlements depending on the eventual native integration. Review Apple credential/key rotation requirements.
6. Test all flows on real devices and production HTTPS origins. OAuth providers are **not** automatically enabled by deploying code.

## Account callback

The client uses PKCE. The temporary auth client begins sign-in and receives redirects at \`/auth/callback\` (web) or the custom scheme on native. It exchanges the authorization code for a session, then stores that session under the appropriate user's separate storage key. Password recovery carries \`?flow=recovery\` to identify the password-update screen; no new password is sent to our server.

## Existing RLS

The application displays the Auth user email and metadata; it does not yet modify \`public.profiles\` or manage \`app_users\` and role assignments. The existing access model of the shared Supabase project remains intact. User-provided Auth metadata is for **display only**, never authorization.

## Operational limits

Refresh-token persistence is conditional on Supabase session policies, token revocation and persistent WebView storage. A saved account whose session is invalid remains visible, so the user can remove it and log in again. Switching users is a local convenience function, not a strong isolation boundary on a shared unlocked device.
