# LOADS Supabase inspection

Inspected on 2026-09-28 through the authenticated Supabase dashboard and read-only SQL against project `ocdslwzxeqilppyxvfhi`. No schema, policies, Auth settings, or application code were changed. This is metadata inspection, not an end-to-end authorization test.

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

GitHub repository URL is still pending. The earlier local inspection found no Git remote and existing uncommitted user changes; those must be preserved and compared with GitHub before implementation. This proposal must be finalized against the current repository, not treated as an applied migration.
