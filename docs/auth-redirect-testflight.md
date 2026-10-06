> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# Auth Redirect / TestFlight preparation — 2026-10-02

## Cause and scope

Before this change, signup supplied no `emailRedirectTo`, the app had no callback route, and Supabase `detectSessionInUrl` was false. Therefore the app relied on the project's Site URL and could not consume a confirmation redirect itself. The actual production Site URL has not been inspected here; the precise unreachable host must be checked by ChatGPT. Existing Follow/Following Feed is accepted as production-verified and unchanged.

Changed: `src/lib/authRedirect.ts`, `src/app/auth/callback.tsx`, signup, Supabase client and root layout; `app.json`, `app.config.js`, `eas.json`, `.env.example`, build environment validator, package/lockfile (Expo-compatible dev client), auth tests and this document. No migrations, RLS, Storage policy or Edge Function changes.

## Redirects

| Environment | Redirect |
| --- | --- |
| TestFlight / installed native development / preview | `loads://auth/callback` |
| Expo Go LAN | `exp://<PC LAN address>:8081/--/auth/callback` (actual running server URL) |
| Expo Go tunnel | Running tunnel's `exp://` URL plus `/--/auth/callback` |
| PC web | `http://localhost:8081/auth/callback` (or actual page origin) |

`Linking.createURL` resolves Expo Go/Web. Native `loads:` URLs are normalized to the stable production route even if the development manifest carries a Metro host. Expo Go does not register `loads`. Its server must be running and reachable from the phone; use the same LAN or the currently running tunnel. Never allow a placeholder host literally. Its address may change between sessions. A native build is the stable callback test.

Signup uses PKCE. The verifier persists in the existing Supabase AsyncStorage; callback exchanges `code` for a session. Legacy implicit `access_token` + `refresh_token` fragments are also handled. Duplicate delivery/remount shares the exchange promise; wrong destinations and incomplete/expired links show a safe login message. Tokens/URLs are not logged. An already logged-in account is not silently replaced. Auth startup cannot overwrite a newer callback session with an older initial read.

For PKCE, open the email on the same device/app storage where signup started. Confirming elsewhere may verify the email but cannot establish the originating app session; use password login there. Previously issued email links retain their old redirect. Use a newly issued signup email for testing. Existing password login, local account isolation and account deletion gates remain in place.

## Supabase Dashboard — ChatGPT/user action only

Project: `YOUR_PROJECT_REF` → Authentication → URL Configuration.

1. Add exact Redirect URLs: `loads://auth/callback`, `http://localhost:8081/auth/callback`, and the current Expo Go callback URL if testing Go. Avoid broad production wildcards. Preserve other required existing entries.
2. Inspect Site URL: do not leave an unreachable localhost address as the mobile fallback. If LOADS is mobile-only, use `loads://auth/callback`; if a real web fallback already exists, confirm its purpose before changing it. Explicit signup redirects are now sent for each platform.
3. Authentication → Email Templates → Confirm signup: the confirmation button should use the normal `{{ .ConfirmationURL }}` flow. Check custom templates are not forcing `{{ .SiteURL }}` and discarding the requested redirect. No template/backend change has been applied by Codex.
4. Keep email confirmation enabled. Do not change token/RLS/Edge Function settings for this fix.

References: [Expo SDK 57 Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/), [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## iOS / EAS

- App name LOADS; scheme `loads`; version `1.0.0`; local initial buildNumber `1`.
- Candidate Bundle ID `com.gyuta.loads` (user reports unregistered). Confirm/register this exact ID in Apple Developer and App Store Connect before first upload; availability/team ownership is not verified.
- EAS remote build numbering with production autoIncrement. Actual upload number comes from EAS remote state, not necessarily local `1`.
- Photos and camera have explicit workout-photo usage descriptions; microphone disabled via image picker plugin. No new URL-query permission or associated domain is required for receiving this custom scheme.
- Info.plist encryption declaration is false for the present standard HTTPS/system crypto usage; reassess if custom non-exempt encryption is introduced.
- Existing icon/splash preserved. No native directories generated or edited.
- `development`: internal development client, EAS development environment. `preview`: internal distribution, preview environment. `production`: store/TestFlight, production environment. Internal iOS builds need registered test devices. These profiles share Bundle ID; installing another native profile can replace the installed app. Use separate test accounts and preserve needed data.
- `expo-dev-client` installed with Expo SDK-compatible version; Expo Go still uses `npx expo start --go` (dependency can otherwise make Expo default to development-client mode).

### Required EAS setup (not yet performed remotely)

1. From `<repository-root>`: `npx eas-cli@latest login`, then `npx eas-cli@latest init`. Link the intended project; this adds the real projectId, never invent one.
2. Expo dashboard → intended project → Environment variables: create the following in **production** (and in development/preview if those profiles are used). Use plain text visibility for public client variables. Values are bundled and are not secrets.

| Variable | Value |
| --- | --- |
| EXPO_PUBLIC_SUPABASE_URL | `https://YOUR_PROJECT_REF.supabase.co` |
| EXPO_PUBLIC_SUPABASE_KEY | This project's publishable key or legacy anon key from Supabase API settings |
| EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED | `true` |

Never use service_role / sb_secret keys. Build configuration rejects missing required variables on EAS workers and rejects private/non-anon keys. The ignored local `.env` is not the cloud configuration. No key values are copied into docs or Expo extra. EAS remote values were not inspected.

3. After Apple registration, redirect settings and EAS variables are confirmed: `npx eas-cli@latest build --platform ios --profile production`. Sign with the intended Apple team. Then `npx eas-cli@latest submit --platform ios --profile production`; select the matching App Store Connect app. These commands have NOT been executed. No paid build/submission has been started.

References: [EAS profiles](https://docs.expo.dev/build/eas-json/), [EAS variables](https://docs.expo.dev/eas/environment-variables/), [EAS version management](https://docs.expo.dev/build-reference/app-versions/).

## Manual checks after external settings

1. **Expo Go, new disposable account**: start `npx expo start --go`; confirm actual Go callback is allowed. Register on iPhone, open the newly received email on the same iPhone. Expect LOADS → EMAIL CONFIRMATION → HOME (or existing saved-records gate). Restart and confirm session remains. Keep EXISTING_USER_A's account/data untouched.
2. **TestFlight, new disposable account**: with TestFlight LOADS installed, register and open the email on the same iPhone. Expect `loads://auth/callback` to open LOADS, establish session, then HOME. Repeat with app closed to verify cold launch, using a fresh registration/link. No Metro server should be needed.
3. **Existing account**: normal login → own Workout/Template still present, HOME shows own + following; check normal photo post and its deletion. Automated account-deletion regression is covered; do not delete a real account for redirect testing.
4. **PC**: register in the localhost browser, open email in that same browser profile, verify HOME and session after reload. The web server must still run. An old/expired link should offer LOGIN without exposing tokens or crashing.

Do not share full confirmation URLs, tokens, passwords or private keys. Report the visible error and whether the app opened.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed, zero warnings (initial callback effect lint error corrected).
- `npm test`: 63/63 passed, zero failures/skips. Includes callback code/token handling, duplicate delivery, safe errors, account-switch protection, callback navigation, environment validation, and existing Follow/post/photo/outbox/deletion/account-deletion/Workout/Template regressions. Auth network/native UI behavior is mocked in these tests.
- `npx expo export --platform ios --output-dir dist/auth-ios`: passed; Hermes bundle, 1296 modules. Initial sandbox Hermes permission failure resolved by approved execution outside sandbox.
- Expo config introspection: LOADS, 1.0.0, com.gyuta.loads, buildNumber 1; registered loads/com.gyuta.loads and generated exp+loads schemes; photo/camera descriptions present; microphone absent.
- Local bundle/config checks do not prove Apple signing, Supabase allowlist, EAS remote variable configuration or real email delivery. Those remain external/manual checks. No EAS build/upload or remote setting change was performed.
