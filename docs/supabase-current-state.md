> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# LOADS Supabase inspection

## Latest verification — 2026-09-29 (owner post deletion)

Owner deletion migration and conflict-hardening migration have been applied to the same project. `delete-post` and `deletion-worker` Edge Functions are deployed; Cron runs the worker every minute using a server-only credential. See [account release verification](account-release-verification.md) for file changes, authorization tests, deployment details and remaining device checks.

Real rollback-only authorization tests passed. The user-approved disposable photo post D-01 was created and deleted through the PC app. Final persisted data at that check: **3 original posts, 2 users, 1 deletion tombstone**; D-01's Storage photo is gone. Original A-01/A-02/A-03 posts remain. Photo deletion failures are tested through fault injection; actual worker HTTP execution is also verified. Account deletion is not implemented yet.

The sections below are historical and their zero-post counts no longer describe the live database.

## Latest verification — 2026-09-28 (resumed session)

**The historical inspection below is superseded by this section.** Application implementation and both SQL migrations already existed when this session resumed. The previous session had successfully applied the photo migration; it was not reapplied.

Project: `YOUR_PROJECT_REF`. Verified through authenticated dashboard SQL and the actual Data/Storage APIs.

- `public.posts` exists, RLS enabled. `authenticated` has SELECT and INSERT only; no table grants to `anon` or PUBLIC were returned.
- Policies: `posts_read_authenticated` (authenticated SELECT), `posts_insert_own` (authenticated INSERT with `auth.uid() = user_id`).
- `post-photos` exists: private (`public=false`), 6,291,456-byte maximum, `image/jpeg` only.
- `storage.objects` RLS enabled. Its complete policy listing returned only `post_photos_insert_own` and `post_photos_read`, matching the local photo migration. Upload path must belong to the authenticated user and have the expected JPEG filename. Reads allow the owner, or authenticated users when a published post references the object. No UPDATE/DELETE policy exists.
- `posts_photo_identity` constraint and `posts_photo_path_idx` exist; the transaction verification below asserted both.
- Real database authorization assertions passed: owner INSERT; another authenticated identity can read the shared feed; duplicate client ID rejected; foreign photo path rejected; forged owner INSERT rejected; UPDATE and DELETE denied; anonymous SELECT denied. SQL used transaction-local role/JWT-sub settings, not actual user login tokens. All writes were rolled back; persisted posts remain **0**.
- Actual unauthenticated Data API request returned HTTP 401 / PostgreSQL `42501` (`permission denied for table posts`). Actual unauthenticated Storage list returned an empty array. Because the bucket has no verified uploaded test object, an empty list alone is not proof of object-level authorization.
- HTTP verification used the existing public application key, with Node's `--use-system-ca` to trust the Windows certificate store. TLS verification was not disabled. No secrets were printed or added to source.
- Current `npm run typecheck`: passed. `npm run lint`: 0 errors, 3 existing exhaustive-deps warnings in `src/app/profile.tsx` (lines 143, 147, 151).
- Prior session's 7 tests and successful iOS/Android/Web export were retained; they were not rerun because application and migration code were not changed in this session.

No bucket, policy, Auth setting, or application code was changed during this resumed session. No persistent test posts, users, or photos were created. Migration-history registration was not verified; do not blindly push/reapply the existing CREATE migrations against this project.

Remaining: authenticated Storage API upload / duplicate-object retry / signed URL download, and real-device end-to-end confirmation. These require an application login and a test photo; dashboard login is not an app user session. See [device verification checklist](cloud-feed-verification.md). Repeatable rollback-only DB checks: `supabase/verify-cloud-feed.sql`.

## Historical inspection (before implementation)

Inspected on 2026-09-28 through the authenticated Supabase dashboard and read-only SQL against project `YOUR_PROJECT_REF`. No schema, policies, Auth settings, or application code were changed. This is metadata inspection, not an end-to-end authorization test.

## Current application schema

The only table in `public` is `profiles`. RLS is enabled. `posts` does not exist in `public`.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | no | none |
| username | text | no | none |
| display_name | text | yes | none |
| bio | text | yes | none |
| avatar_url | text | yes | none |
| created_at | timestamptz | no | now() |
| updated_at | timestamptz | no | now() |

Constraints: primary key `id`; unique `username`; `id` references `auth.users(id)` with `ON DELETE CASCADE`. No username format/length CHECK was returned.

## Existing profiles policies and grants

All three policies target the Postgres `public` role (all roles):

| Policy | Command | USING | WITH CHECK |
| --- | --- | --- | --- |
| Profiles are publicly readable | SELECT | true | — |
| Users can insert own profile | INSERT | — | auth.uid() = id |
| Users can update own profile | UPDATE | auth.uid() = id | auth.uid() = id |

No DELETE policy was returned. Both `anon` and `authenticated` have SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER and TRUNCATE table grants. Ordinary row operations remain subject to RLS; broad grants alone do not mean anonymous users can update other profiles. Tightening unnecessary grants is a separate follow-up.

## Profile creation trigger

`on_auth_user_created` runs AFTER INSERT on `auth.users`, once per row, invoking `public.handle_new_user()`.

The function is PL/pgSQL, SECURITY DEFINER, with an empty search_path. It inserts `new.id`, `new.raw_user_meta_data ->> 'username'` and `new.raw_user_meta_data ->> 'display_name'` into `public.profiles`, then returns NEW. Metadata is used as profile content, not an authorization claim.

Missing usernames violate NOT NULL; duplicates violate UNIQUE. Those failures can prevent signup. No update trigger for `profiles.updated_at` was returned; its default alone does not refresh it on updates.

## Auth settings observed

- New user signup: enabled.
- Email provider: enabled.
- Email confirmation: enabled.
- Anonymous sign-ins: disabled.
- Manual identity linking: disabled.
- Other listed built-in providers: disabled; no custom providers listed.
- Secure email change: enabled.
- Secure password change: disabled.
- Require current password when updating: disabled.
- Leaked password protection: disabled (dashboard indicates paid plan requirement).
- Email OTP expiration: 3600 seconds; length: 8 digits.
- Minimum password length was not reliably exposed by the inspected accessibility value and is not reported here.
- Site URL: `http://localhost:3000`.
- Allowed redirect URLs: none.

The mobile email-confirmation return path needs configuration before a complete mobile onboarding flow can be considered verified. No registration or login test was performed, and sessions, SMTP delivery and rate limits were not audited.

## Proposed first cloud-feed phase (not applied)

Keep workout/history/template persistence and PR calculation local. Preserve the WorkoutPost shape through an adapter, with cloud-only author fields added separately.

Proposed `public.posts`:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references public.profiles(id) on delete cascade`
- `client_post_id text not null` and unique `(user_id, client_post_id)` for retry deduplication
- `workout_id text not null` (local identifier; workouts are not yet a cloud table)
- `created_at timestamptz not null default now()`
- `caption text not null default ''` with length <= 300
- `photo_url text null` (device-local URIs cannot be shared across devices)
- `duration_seconds integer`, `total_sets integer`, `total_volume numeric`, `pr_count integer`, all required with nonnegative checks
- `exercises jsonb not null`, constrained to an array, retaining existing exercise snapshot fields
- Indexes for `(created_at desc, id desc)` and `user_id`.

RLS proposal: authenticated users can SELECT the shared feed; INSERT requires `(select auth.uid()) = user_id`. If UPDATE/DELETE are included, restrict both to the owner, with both USING and WITH CHECK on UPDATE. Grant only operations actually used; give anon no post access. Join profiles by user_id and select only required author fields.

New posts should retain a user-scoped local copy and distinguish pending/failed upload from successful publication. Retry with the same client identifier. Do not automatically assign old ownerless local posts to the current account or silently publish them. Preserve the old local store during migration.

Photos need a deliberate Storage upload/policy design; writing a local `file:` URI to posts is not a working cloud photo implementation. Decide this before enabling cloud publication of photo posts.

Likely files: `src/lib/postStorage.ts`, a new cloud post adapter and database types, `src/app/post.tsx`, `src/app/index.tsx`, SQL migration and focused validation. Existing `/explore` type error in `src/components/app-tabs.web.tsx` also needs correction if still present. Profile PR display remains limited to BENCH PRESS, SQUAT and DEADLIFT; no popularity counters are planned.

Repository reconciliation completed on 2026-09-28: the authenticated GitHub main page for https://github.com/YOUR_GITHUB_ACCOUNT/LOADS shows commit `11ad446c912fe248426b5c61e65c201e99541e2b`, exactly matching local HEAD. Tracked local files have no differences from HEAD at reconciliation time. The earlier absence of a remote and uncommitted application changes is historical, not the current state. See `cloud-feed-change-plan.md` for the reconciled change plan. No migration has been applied.
