> Public copy: account, project and user identifiers have been replaced with synthetic placeholders. Historical verification notes are not ready-to-run production instructions.

# Follow / Following Feed completion record

Updated 2026-10-02 JST. Local implementation complete; production migration NOT applied.
No design expansion, browser automation, production changes or real account deletion was performed in this continuation.

## Reviewed implementation scope (16 files from prior work)

- `supabase/migrations/20261001091938_following_feed.sql`
- `src/types/database.ts`
- `src/lib/follows.ts`, `src/lib/cloudPosts.ts`
- `src/hooks/use-cloud-feed.ts`
- `src/components/social-layout.tsx`, `src/components/my-connections.tsx`, `src/components/feed-post-card.tsx`
- `src/app/people.tsx`, `src/app/athlete.tsx`, `src/app/connections.tsx`
- `src/app/profile.tsx`, `src/app/_layout.tsx`, `src/app/index.tsx`
- `tests/following-db.test.cjs`, `tests/cloud-posts.test.cjs`

The checkout contains earlier uncommitted cloud/deletion changes too; the full Git diff is not a Follow-only diff. Earlier work was preserved.

## Completion fixes and checks

- Fixed the PL/pgSQL CASE-expression parentheses in the new, unapplied migration. No historical migration edits.
- Regenerated Expo Router types through Expo startup, without casting away route type errors.
- Removed redundant reload-counter dependencies; profile/count refresh uses request generations to reject stale responses.
- Follow completion notifies an active HOME even if the user navigated back while the mutation was running. A fresh load clears old posts immediately and obsolete responses cannot restore them.
- Added client, profile rendering, interaction and HOME lifecycle tests: `following-client.test.cjs`, `following-profile-ui.test.cjs`, `following-interactions.test.cjs`, `following-feed-hook.test.cjs`.
- Client component tests mock native host components/router and execute callbacks; they are not PC/iPhone end-to-end visual acceptance.

## Preserved design

- RLS exposes only edges involving the caller. A participant may know their own edge to another user, but cannot fetch edges exclusively between third parties or their full graph.
- Only follower_id=auth.uid() can INSERT/DELETE; no UPDATE permission. Self edges and duplicate edges are rejected. The UI treats a duplicate insert as the same desired Follow state.
- Trigger blocks incoming/outgoing Follow involving an accepted deletion job, using the existing account-deletion advisory locks.
- Both profile foreign keys cascade. Existing account deletion removes profiles before Auth; incoming and outgoing follows disappear at that stage. Unrelated follows remain. Edge Functions need no changes.
- `following_feed` uses security_invoker; posts also have a restrictive SELECT policy. HOME has no fallback to the old global feed if the view is missing.
- Existing private Storage read policy references posts, so new reads/signing are restricted with posts. Previously issued signed URLs can remain usable until their existing one-hour expiry; downloaded/browser-cached photos are not remotely erased by Unfollow.
- Own counts RPC takes no owner parameter. Lists derive owner from the authenticated app context; other profiles fetch identity and the caller's Follow state only.
- Search is normalized username equality (not prefix/wildcard), never an initial directory. Existing profiles read policy is unchanged; this does not claim that public profile metadata is secret at the API level.
- No automatic follow backfill. Immediately after migration, each user's HOME contains only their own posts until they explicitly follow someone.

## Production scope — pending, do not db push

Only `20261001091938_following_feed.sql` is required. It creates follows, its index/constraints/policies and insertion trigger, restrictive posts SELECT policy, following_feed invoker view and own-count RPC.
No Edge Function deployment, Cron/credential changes, or account-deletion migration reapplication.
The source now requires this migration; prior to its application HOME/follow operations will report missing view/function/table errors instead of exposing a global feed.

After separate authorization, apply this file alone using the already-established authenticated CLI path:

```powershell
npx supabase db query --linked --project-ref YOUR_PROJECT_REF --file supabase/migrations/20261001091938_following_feed.sql
```

External verification should be narrowly scoped: new objects/grants/policies, the actual PostgREST `following_feed` -> `profiles` embedding/schema cache, and signed URL issuance under the caller. Local PGlite tests do not run PostgREST or Storage HTTP services.

## Manual acceptance after migration

1. Account A (EXISTING_USER_A): note own Workout/Template baseline; HOME should initially show only own posts. PROFILE shows own counts and list entries. FIND BY USERNAME with B's exact username (TEST) returns B; a nonmatching full username returns no result.
2. A opens B: identity and FOLLOW only, no relationship counts/lists. Follow B; button becomes FOLLOWING. HOME shows A+B including B's photo posts. A's Following list includes B.
3. Account B (TEST): own Followers includes A; B's HOME still only shows B unless B separately follows A. Opening A shows no counts/lists.
4. A unfollows B, then immediately returns HOME: B's posts disappear and cannot be restored by refresh/navigation. New photo reads/signing for B are denied; an already-issued URL is not an immediate-revocation test.
5. A/B: normal photo post, outbox retry without duplicate, owner post deletion and original Workout/Template remain usable. Do not delete EXISTING_USER_A/TEST for testing. A real cascade deletion check requires a separately authorized disposable account; local DB lifecycle coverage already passes.

## Validation

- TypeScript typecheck and lint completed successfully (no warnings).
- Final full suite: 55/55 passed, zero failures or skipped tests, including interaction/navigation, HOME lifecycle, existing posting/photo/outbox/deduplication/deletion/account-deletion/profile/Workout/Template isolation coverage and DB authorization tests.
- No new dependencies, native APIs or build settings. Builds and device UI acceptance have not been rerun in this completion step.
