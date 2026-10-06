> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# Expo Push Security review — 2026-10-04 (Asia/Tokyo)

Read-only GraphQL query through the existing official EAS CLI session confirmed project `@YOUR_EXPO_ACCOUNT/LOADS`, EAS ID `00000000-0000-4000-8000-000000000001`, owner account `YOUR_EXPO_ACCOUNT`, `pushSecurityEnabled: false`. This is an owner-account setting, not a field in app.json.

Current signed-in owner has zero Access Token metadata records (active 0, revoked 0). Session login is not a personal Access Token. No token values queried or printed. Supabase secret metadata independently confirms EXPO_ACCESS_TOKEN is absent.

OFF: EXPO_ACCESS_TOKEN is not required. ON: a valid owner-authorized Access Token must be supplied via Authorization: Bearer on Expo Push API requests. Current worker reads EXPO_ACCESS_TOKEN and adds that header to send/getReceipts when present, so it supports both configurations. No setting changes required for the current OFF state.

Client registerPush uses OS permission, getExpoPushTokenAsync({ projectId }) with the configured matching EAS ID, stable device UUID and authenticated register_push_device RPC. Token is stored server-side in public.push_devices; local AsyncStorage stores device identity. Foreground/token-change registration refresh exists. Static implementation confirmed; real TestFlight token acquisition/delivery still requires physical-device verification.

No Expo/Apple settings, Access Tokens, Supabase database/RLS/Functions/Cron changed. Added only local read-only review script and this report. Typecheck/lint passed.

Next: build/install a production TestFlight binary with the already configured APNs credentials and test two-device notifications. No Access Token issuance or Push Security change is needed. If enabling security later, human must issue a token and securely store EXPO_ACCESS_TOKEN server-side before relying on authenticated sends.

Reference: https://docs.expo.dev/push-notifications/sending-notifications/#additional-security
