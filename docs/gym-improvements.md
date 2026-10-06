> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# Gym improvements

## Files and compatibility

- Exercise catalog/search: `src/lib/exerciseLibrary.ts`; category picker: `src/app/workout.tsx`.
- Optional set result: `src/lib/workoutStorage.ts`, `src/lib/setResult.ts`, `src/components/set-options.tsx`, `src/lib/workoutPost.ts`, `src/lib/workoutText.ts`, `src/app/history-detail.tsx`, `src/app/post.tsx`, `src/components/feed-post-card.tsx`, `src/lib/postStorage.ts`, `src/lib/postValidation.ts`.
- Notifications: `src/lib/notifications.ts`, `src/lib/pushDevice.ts`, `src/lib/registerPush.ts`, `src/components/notification-gate.tsx`, `src/app/settings.tsx`, `src/app/_layout.tsx`, `src/app/profile.tsx`, `src/lib/accountSession.ts`, `src/lib/userLocalData.ts`.
- Partners: `src/components/training-partner-picker.tsx`, `src/app/tagged.tsx`, `src/lib/cloudPosts.ts`, post composer/feed/types.
- Native dependencies: SDK 57 `expo-notifications`, `expo-crypto`; `package.json`, `package-lock.json`, `app.json` notifications plugin. Bundle ID, icon, version, splash, scheme and EAS version settings remain intact.
- Backend: `supabase/migrations/20261003074946_gym_social_improvements.sql`, `supabase/functions/push-worker/index.ts`, `supabase/functions/_shared/push.ts`, `supabase/config.toml`, `supabase/ops/schedule-push.sql`, `src/types/database.ts`.
- Added tests: `tests/gym-features.test.cjs`, `tests/gym-social-db.test.cjs`, `tests/gym-ui.test.cjs`, `tests/completion-sync.test.cjs`, `tests/push.test.cjs`, `tests/push-device.test.cjs`, `tests/push-worker.test.cjs`.
- Updated regression tests: `tests/account-session.test.cjs`, `tests/cardio.test.cjs`, `tests/cardio-ui.test.cjs`, `tests/cloud-posts.test.cjs`, `tests/workout-text.test.cjs`. This document is also new.
- Migration review coverage: `tests/gym-migration-review.test.cjs` checks non-destructive SQL, policy identity/extra clauses, repeated execution with saved data, and rollback on incompatible objects.

## Exercise catalog

47 entries: 42 Strength + existing 5 Cardio. All entries have `aliases`, `bodyPart`, `equipment`, `variation`, `category`, `type`. NFKC normalization supports fullwidth Latin and halfwidth katakana; matching ignores case, spacing and hyphens. Multiword queries match every term. Search crosses categories. Without a query, the initial picker shows Chest / Back / Legs / Shoulders / Arms / Cardio, then category exercises.

Four new independent entries: Smith Machine Bench Press, Smith Machine Incline Bench Press, Paused Bench Press, Larsen Press. Existing BENCH PRESS / INCLINE BENCH PRESS / INCLINE DUMBBELL PRESS / CLOSE GRIP BENCH PRESS are retained to preserve history and PR identity; Barbell Bench Press / Incline Barbell Bench Press / Dumbbell Incline Bench Press / Close-Grip Bench Press resolve through aliases to these definitions rather than creating semantic duplicates. Close Grip is selectable in Chest as well as Arms.

## Set results

Optional `targetReps: string` and `status: completed | failed | stopped` extend existing `WorkoutSet`. Missing fields preserve legacy behavior. Actual reps below a positive target infer FAILED; explicit `failed` works without a target. STOPPED is reserved for later UI. DONE still means the set was recorded, including an unsuccessful attempt. PR calculations continue to use actual weight/reps and have not changed.

These fields persist in active workout and history JSON. Posts optionally contain `setResults` only for exercises using the extension; existing aggregates/PRs retain their contracts. Current workout, history, composer/feed and COPY include the target/result. No schema rewrite of exercise snapshots.

## DB and server-side delivery

Public RLS tables: `notification_preferences` (user_id, workout_enabled default OFF, partner_enabled default ON), `push_devices` (id, user_id, device_id, token, platform, enabled, updated_at), `workout_completions` (id, user_id, client_workout_id, finished_at, duration_seconds, created_at), `post_partners` (post_id, author_id, user_id, username snapshot). `posts.training_partner_ids uuid[]` defaults empty, max three. Private RLS table `loads_private.push_deliveries` stores durable per-event/per-device delivery state, ticket, actor/recipient/post references. No token or queue access for other users; worker RPCs are service-role only.

FINISH first saves the original local history. Completion synchronization uses a per-account local baseline, explicit pending IDs and acknowledged IDs; old histories do not suddenly notify. Offline events resume while the app is open or when it becomes active after reopening. Completion metadata is committed through an authenticated RPC; the workout exercise history remains in its original storage. A failure here or in Push delivery never rejects FINISH. The server idempotency key is `(user_id, client_workout_id)`, queue uniqueness is `(event_key, device_id)`. The transaction queues only opted-in followers, excludes self/deleting users, and caps excessive finish events. Worker rechecks preference/follow state and account deletion before claiming. Each registered device can receive one notification per event. Logout disconnects its token before removing Auth; an offline disconnect requires retry to prevent previous-account pushes.

Tags are server-validated against the author's following, max three distinct non-self IDs. Trigger inserts association rows and notification queue in the same post transaction. Clients cannot write associations or notification recipients directly. Stored username snapshots come from profiles, not client text. Post retry retains its original snapshot/id; duplicate insert cannot queue a second tag event. A tagged user can read that post and signed photo through existing RLS even without following the author. PROFILE → TAGGED WORKOUTS lists tagged posts; HOME includes them. Push tap routes authenticated recipient to Tagged Workouts or athlete profile. Tags are immutable after posting. Deletion cascades remove tags/devices/queue references. `partner_enabled` allows a future partner notification toggle; separate recipient/actor keys allow future per-author preferences.

Expo Push tickets are checked, receipts polled after 15 minutes, DeviceNotRegistered disables a device. Delivery uncertain after a timeout/lost response is not retried blindly, preventing app-generated duplicates at the cost of potentially missed notifications. Expo/APNs delivery itself cannot guarantee exactly-once or successful display. Pending notifications expire from sending eligibility after 24 hours. The worker uses the existing DB-verified private cleanup credential, never a client or personal token. Optional EXPO_ACCESS_TOKEN belongs only in Edge secrets when Expo push security is enabled.

## Deployment (not yet applied to the hosted project)

The migration has been revised for non-destructive review. It extends the actual `posts_following_read` expression through `ALTER POLICY`, preserving its OID, command, roles, restrictive/permissive flag and existing visibility clauses. A security-invoker `loads_private.is_training_partner` lookup adds tagged access. No table/column/policy removal, truncation, or row-removal statements remain, including inside function bodies. `ON DELETE CASCADE` declarations and the existing token-removal privilege remain solely to preserve the account/logout lifecycle; migration application does not invoke that lifecycle.

Tables, indexes and the post column use `IF NOT EXISTS`; new policies and the post constraint are created only when absent; functions/triggers use `CREATE OR REPLACE`. Required column types/nullability, empty-array default, post constraint, primary/unique keys and foreign keys are checked. An incompatible existing object aborts the entire transaction. Local PostgreSQL tests reapply the migration with stored Strength/Cardio posts, follows, profiles, preferences, devices, completions and tags, confirming unchanged rows and policy identity. Hosted schema compatibility must still be checked immediately before applying.

Token re-registration now disables and retires the prior binding without removing its device row or delivery history. Queued deliveries require the device's current owner to match their recipient. Automatic 30-day queue purging has been removed; inactive history is retained, while the existing 24-hour sending limit remains. Any future purge requires a separately reviewed maintenance operation.

Production migration `20261003074946_gym_social_improvements` was applied on 2026-10-03 to `YOUR_PROJECT_REF` using the authenticated CLI Management API. See `verification/gym-production-result.md`. Push worker and every-minute Cron are now deployed and verified; APNs/Expo credential confirmation and real device delivery remain outstanding. See `verification/push-production-result.md`. The CLI requires an explicit project reference; do not blindly push all local migrations because the historical following-feed version differs from production.

1. Deploy the Push worker to the known project:

   ```powershell
   npx supabase functions deploy push-worker --project-ref YOUR_PROJECT_REF
   ```

2. Run `supabase/ops/schedule-push.sql` in the project's SQL editor. It schedules worker delivery every minute using the private existing credential. Confirm the private credential and existing `verify_cleanup_worker` setup were already deployed. Do not print credentials in logs or copy them into the app.
3. If Expo push security is enabled, set EXPO_ACCESS_TOKEN with Supabase Edge secrets. Configure production iOS APNs Push Key via `npx eas-cli@latest credentials --platform ios`. For Android, configure FCM v1 credentials separately.
4. Build the native modules and notification entitlement:

   ```powershell
   npx eas-cli@latest build --platform ios --profile production
   ```

The native changes require a new TestFlight build; an OTA update alone does not add notification capabilities. Do not ship this client before the migration: new feed queries join `post_partners`.

## Verification and devices

Run `npm run typecheck`, `npm run lint`, `npm test`. Tests exercise English/Japanese/fullwidth search, category UI, equipment distinctions, absent/under-target/explicit failure, actual-rep PR preservation, extended snapshots/copy, completion persistence/offline/restart/account isolation, notification preferences, PostgreSQL follower/tag/photo RLS and dedup, Push tickets/receipts/failures, plus existing Strength/Cardio/signup/deletion regression coverage.

Final local results after migration review: TypeScript passed; lint passed with no warnings; all **123 tests passed**, including the existing Strength/Cardio/COPY/signup tests. PNG header confirms 1024×1024 and app config references the same rose/plate icon. Bundle identifier, version, scheme, remote EAS version source and production autoIncrement are preserved. Native push delivery has not been exercised on physical devices or the hosted backend.

`npx deno check supabase/functions/push-worker/index.ts` also passed. `npx expo install --check` reports newer patch versions of seven pre-existing Expo dependencies; the newly installed notifications/crypto modules are not flagged. Existing dependency versions were preserved instead of introducing a broad SDK patch update with this feature.

On two physical devices A/B: B follows A, B enables Workout notifications and grants OS permission; A finishes Strength-only, Cardio-only and mixed workouts. Confirm B receives the completion while app is closed; confirm no A self push, no B push when OFF/unfollowed, and FINISH succeeds offline. Reopen to synchronize the saved finish; repeated sync must not duplicate it. Confirm OS denial gives a clear settings error, turning OFF prevents workout pushes, and switching/logging out disconnects previous account's device.

For tags: A follows B, chooses B (max three), posts; B receives a partner notification and sees `with @username`, Tagged Workouts, HOME and photo even if B does not follow A. Confirm unregistered devices simply receive no push, unavailable partner rejects the post safely, retry preserves tags, deletion removes tagged access. Verify Japanese keyboard/search, category back/reset, dark styling, keyboard scrolling, optional SET OPTIONS, failed actual-zero attempts, restart restoration and COPY target/results. Confirm existing icon/signup/PR behavior.
