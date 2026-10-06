> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# LOADS production migration verification — 2026-10-03

Project: `YOUR_PROJECT_REF`. Applied only `20261003074946_gym_social_improvements.sql` via Supabase CLI 2.119.0 authenticated Management API. SQL and history registration committed atomically. No migration application errors.

History after apply:
- `20261001171755_following_feed`
- `20261003074946_gym_social_improvements`

Created `public.notification_preferences`, `public.push_devices`, `public.workout_completions`, `public.post_partners`, `loads_private.push_deliveries`. Added `public.posts.training_partner_ids` (`uuid[]`, NOT NULL, empty-array default, max three constraint).

All five new tables and existing posts have RLS enabled. `posts_following_read` retained OID 17892, authenticated role, SELECT command and restrictive behavior. Its existing own-post/followed-author expression remains, OR `loads_private.is_training_partner(id)` was added through ALTER POLICY. No DROP/recreation.

Before/after counts: profiles 4/4, posts 5/5, follows 0/0. Inside the apply transaction, share locks prevented concurrent writes while complete existing row JSON snapshots were compared; all previous values, including post Strength/Cardio snapshots, were unchanged (excluding the newly added empty partner column). Follow/tag positive behavior is covered by local PostgreSQL tests; production currently has no follows or tags, and no test users/posts were inserted into production.

Independent post-commit query verified history, objects, column, RLS, policy identity/expression and counts.

Security Advisor: no ERROR results. WARN entries: existing handle_new_user/rls_auto_enable callable SECURITY DEFINER functions, disabled leaked-password protection, and the two intentionally authenticated-only SECURITY DEFINER RPCs register_push_device/record_workout_completion. New RPCs check auth.uid(), account state, empty search_path and revoke anon/PUBLIC execution; worker RPCs are service-role only. Existing Auth settings/functions were not modified.

Next: deploy push-worker, schedule reviewed push Cron, configure APNs/Expo credentials, build TestFlight, and verify notifications/tags on two physical devices. No worker/Cron deployment performed in this task.
