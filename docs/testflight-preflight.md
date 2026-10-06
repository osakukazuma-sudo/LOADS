> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# TestFlight preparation — 2026-10-02

- Auth Redirect and Follow are accepted as verified by the user; not re-investigated.
- Linked EAS project: https://expo.dev/accounts/YOUR_EXPO_ACCOUNT/projects/LOADS
- Owner: YOUR_EXPO_ACCOUNT. Project ID: 00000000-0000-4000-8000-000000000001. Created/linked using EAS CLI; app.json now has the real owner/projectId.
- LOADS / com.gyuta.loads / version 1.0.0 / local buildNumber 1 verified.
- production: distribution store, environment production, remote version source. Auto-increment disabled for the first build to preserve 1. This is a new EAS project; confirm remote buildNumber is 1 before dispatch. Subsequent submissions require a higher build number or re-enabling auto-increment.
- Generated Info.plist has camera/photo usage text and no microphone usage permission. Dev-launcher local-network description is present during introspection; its installed plugin has a non-Debug build phase to remove its development-only description/Bonjour service. Final signed IPA remains unverified.
- production environment list succeeded and reports no variables. All three required variables are missing: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY (publishable/anon only), EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED=true. No values were printed and no remote variables were written.
- Apple membership, Bundle ID registration, App Store Connect app record, signing credentials are unverified. No Apple login, certificate creation, build, payment or submission performed.
- Existing submit.production profile is usable interactively; no ascAppId invented. Add the actual numeric App Store Connect app ID after the user creates/selects the app.

## Verification

Typecheck and lint passed; 63/63 automatic tests passed; iOS Hermes export passed (1296 modules) to ignored dist/testflight-preflight. These ran before the EAS metadata-only link; app behavior has not changed. Final configuration assertions check project ID, app identifiers and production settings separately. Native signing/EAS build is not proven by a Metro export.

## Next user action (only one)

Open the EAS project above, go to Environment variables, and create one variable:
Name EXPO_PUBLIC_SUPABASE_URL; value https://YOUR_PROJECT_REF.supabase.co; environment production; visibility Plain text. Save and confirm its name appears under production. Other two variables will be guided separately; never paste a private key in chat.

## Later, not executed now

After all three variables and Apple prerequisites are confirmed:
`npx eas-cli@latest build --platform ios --profile production`

After a successful signed build and matching App Store Connect record:
`npx eas-cli@latest submit --platform ios --profile production`

The user handles Apple login/agreements and signing prompts. TestFlight upload does not authorize App Store public release.

This document supersedes the older auth-redirect-testflight.md statements that EAS is unlinked and autoIncrement is enabled.
