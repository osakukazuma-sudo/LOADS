> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# Production Push deployment — 2026-10-03

Project `YOUR_PROJECT_REF`: push-worker ACTIVE, version 1. Deployed with CLI 2.119.0 --use-api. JWT gateway verification disabled as configured; verify_cleanup_worker validates the private existing credential before privileged work. Other Functions unchanged.

Cron loads-push-delivery: job 2, active, `* * * * *`, correct Function URL, 60-second timeout. Existing deletion Cron/extensions unchanged. Credential remains inside cleanup_credentials; no value was displayed.

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exist. EXPO_ACCESS_TOKEN absent; required only when Expo enhanced Push security is enabled. Human must check Expo project YOUR_EXPO_ACCOUNT/LOADS and securely set that secret in Supabase if enabled. Never put it in EXPO_PUBLIC_ variables.

Smoke request [REDACTED_REQUEST_ID]: HTTP 200, {"attempted":0}, no error/timeout. Cron succeeded and four empty worker responses observed. Deployed pending_push_receipts/claim_push_deliveries successfully reference public.push_devices and loads_private.push_deliveries. Empty Expo receipt probe 6124: HTTP 200, {"data":{}}, proving connectivity from Supabase without transmitting recipient data or sending notifications. Actual worker send/APNs delivery remains unverified until real device registration.

Existing profiles/posts/follows remain 4/5/0; devices/deliveries remain 0. Existing schema/RLS and data unchanged. Persistence remains independent of Push failures; existing server self-exclusion/dedup retained.

Token path reviewed: Settings ON -> registerPush(owner,true) -> OS permission -> getExpoPushTokenAsync({projectId}) -> stable local device UUID -> authenticated register_push_device RPC. NotificationGate refreshes permitted registration on foreground/token changes. expo-notifications plugin present; EAS projectId 00000000-0000-4000-8000-000000000001.

Human handoff: run `npx eas-cli@latest credentials --platform ios`, select production, inspect/configure APNs Push Key and com.gyuta.loads Push capability/provisioning. Check Expo enhanced Push security. No Apple/Expo credentials or settings were changed by this task. Build a new native binary using `npx eas-cli@latest build --platform ios --profile production`, then submit/install TestFlight.

Two-device checks: B follows A; B grants notifications and enables Workout notifications. Confirm device registration, close B app, A finishes workout, verify one B push and saved workout. Check no self push, OFF/unfollowed suppression, offline saves/retry dedup, partner tags and notification navigation. Receipts are checked after 15 minutes. Never publish tokens in logs.

Typecheck/lint passed; all 123 tests passed, including Push failure/self/dedup/preferences and Strength/Cardio/COPY/signup regressions.
