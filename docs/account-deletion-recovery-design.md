# Account deletion implementation and handoff

Updated: 2026-09-30. Local implementation only; NOT deployed to Supabase.
The earlier proposal is superseded by this file. The user approved the receipt design
and required final Storage verification before completion.

## Completion contract

`pending -> processing -> completed`; pre-Auth failures can become `failed`.
Only normal Auth plus password reauthentication may resume `failed -> pending`.
Receipt requests only update rate-limit metadata and never run/resume/schedule deletion.

Worker phases (one bounded batch/phase per scheduled invocation):

1. `photos`: delete up to 100 paths under the user's UUID in `post-photos` through Storage API. Re-list on the next run; never infer emptiness from successful removal alone.
2. `rows`: verify photos still absent, then atomically delete posts, post tombstones and profile.
3. `delete_auth`: persist `verify_auth` BEFORE any Auth deletion attempt.
4. `verify_auth`: use admin getUserById. Only explicit `user_not_found` proves absence. Existing user is deleted; success, timeout or lost response is reconciled on a later run. Network errors retain processing.
5. `final_storage_cleanup`: after verified Auth absence, scan the UUID prefix again. Remove leftovers and re-list. Any failure stays processing, with a generic failure code.
6. `completed`: DB guard additionally checks Auth, profile, posts, tombstones and Storage metadata are absent. Delete matching UUID-prefix photo_cleanup_jobs in the same transaction. Completed is terminal. Set receipt expiry to completion + 30 days.

A separate completed-account scan removes late orphan photos without changing completion.
This mitigates uploads already in flight before the freeze; cross-service atomicity is
not claimed. Minimal UUID/job/receipt metadata and cleanup markers are retained; workout,
profile and photo content are not. Current scope is LOADS's known tables and post-photos
bucket, not arbitrary future user-owned tables/buckets.

## Receipt and permissions

- Prepare requires valid Auth; issues 32 random bytes encoded as hex, stores SHA-256 only.
- Prepare does not create a deletion job/freeze. Unused receipt expires after one day.
- Client stores receipt before submitting the destructive request. Password is memory-only.
- Start/retry requires verified Auth and matching password identity. Body user IDs are ignored.
- Status endpoint returns only status/completed_at/failure_code. `not_started` describes a
  prepared receipt with no job; it is not a fifth job state. Invalid/expired receipts give 404.
- Unstarted requests can be cancelled via normal Auth (not receipt authentication).
  DB row locking serializes cancellation with acceptance. Accepted jobs cannot be cancelled.
- Private tables have RLS and no client grants. Service-role-only RPCs use fixed empty
  search_path and SECURITY DEFINER to access the private schema without exposing it to REST.
- `loads_private.current_account_writable()` accepts no arguments and returns only the
  current JWT subject's boolean. Auth users must still exist and have no deletion job.
  Authenticated EXECUTE is necessary for policy use; PostgreSQL cannot restrict execution
  exclusively to policy evaluation. This schema must remain absent from exposed schemas.
- Restrictive INSERT/UPDATE policies apply to posts, profiles and Storage. Existing post
  delete RPC and tombstone guard are unchanged. No permissive grants are added.
- Receipt status uses an atomic DB token bucket: burst 4, refill 12/minute. Limits apply across Edge instances; 429 exposes Retry-After to browsers. No IP limit is added. Invalid receipts do not create throttle rows. Only throttle metadata changes on reads.

## Local UX

- Account deletion control in PROFILE, password field and explicit permanent confirmation.
- Default OFF: `EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED=true` enables the control after deployment.
- Persisted recovery gate remains available regardless of the flag; it survives logout/restart.
- Request errors/20-second timeouts keep the receipt and local data. CHECK STATUS never changes deletion state. Manual checks use receipt-scoped 5/10/20/30-second backoff for processing/errors and honor longer Retry-After. Concurrent checks are blocked; no automatic deletion retry is added. This local cooldown resets on app restart; the DB limit persists.
- Failed or unstarted requests offer password reauthentication. Confirmed unstarted requests
  can be cancelled without deleting local records.
- After completed, FINISH LOCAL CLEANUP removes only that user's workouts, active workout,
  templates, outbox and app-managed native photos. Imported legacy copies are removed only
  when the migration record assigns them to that owner. Other users/unassigned records remain.
- Local cleanup failures retain recovery state for retry. Local late writes are blocked;
  outbox writes share the serialized storage queue.
- Expired/unavailable receipt never means completed: local-only cleanup requires a separate
  explicit two-step confirmation and does not claim server deletion succeeded.
- Other offline devices cannot be remotely wiped. New server writes are denied by the helper;
  automatic local cleanup on other devices is not implemented.

## Files

- Migration: `supabase/migrations/20260929191218_account_deletion_recovery.sql` (CLI generated).
- Edge: `delete-account`, `account-deletion-status`, `_shared/account-receipt.ts`,
  `_shared/account-cleanup.ts`; integration in `deletion-worker/index.ts` and `config.toml`.
- Client: `accountDeletion.ts`, `accountDeletionLocalData.ts`, `accountLocalWrites.ts`,
  account-deletion-control/gate components, profile and root layout.
- Existing storage changes: userLocalData, postOutbox, native/web postPhotoFiles.
- Dashboard bundle generator includes the new endpoints and worker helper.
- Tests: account-deletion-client/db/endpoints/worker; existing cloud fixture includes Auth users.

## Deployment by user / ChatGPT

1. ChatGPT confirmed the production inventory: profiles/posts/deleted_posts/photo_cleanup_jobs, private cleanup_credentials, and post-photos. No additional owned tables/buckets were found. This preparation uses that result without another production review.
2. Apply ONLY the new migration above after review. Do not blindly db push: old migrations
   were applied through the dashboard and their migration history has not been verified.
3. Deploy delete-account (verify_jwt=true), account-deletion-status (verify_jwt=false,
   receipt-only read access), and updated deletion-worker with its existing secret check.
   `node scripts/prepare-edge-dashboard.cjs` prepares exact single-file sources under
   `.expo/deletion-deploy/`. No new worker secret is required. Existing delete-post unchanged.
4. Existing loads-deletion-cleanup Cron must be active. It handles one account batch/phase
   each minute, so an empty-account deletion still takes several invocations. Check failures
   and rate limits before enabling the client flag. No production access was used by Codex.
5. Enable the flag, restart Expo, test with a NEW DISPOSABLE account; do not delete the
   existing EXISTING_USER_A/TEST accounts or A-01/A-02/A-03 just to verify this feature.

## Manual acceptance checks

- Wrong password: no freeze/deletion; CHECK STATUS shows not_started; cancellation retains data.
- Correct request: writes stop; restart the app; CHECK STATUS still works from the saved receipt.
- Observe processing through final Storage cleanup, then completed only after Auth/rows/photos absent.
- FINISH LOCAL CLEANUP clears this owner; another account's saved workouts/templates remain.
- Simulated pre-cleanup failure on a disposable test setup: failed preserves Auth; status polls do
  not resume; correct password retry resumes. Do not induce a production outage.
- Simulated post-Auth final-cleanup failure: processing persists and automatically retries;
  no failed transition. Expired receipt: explicit local-only cleanup and no false success claim.
- PC/iPhone regression: login/logout, photo post/feed, manual post deletion and restart/outbox retry.

GitHub synchronization is pending real-environment acceptance; the checkout also contains
previous uncommitted work. No account or production data was deleted in this implementation turn.
