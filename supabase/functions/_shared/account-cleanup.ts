import type { adminClient } from './runtime.ts';
type Admin = ReturnType<typeof adminClient>;
type Job = { user_id: string; phase: string; lease_id: string };

async function move(admin: Admin, job: Job, phase: string, failure: string | null = null) {
  const result = await admin.rpc('advance_account_deletion', { actor: job.user_id, lease: job.lease_id, next_phase: phase, failure });
  if (result.error) throw result.error;
}
async function removePhotos(admin: Admin, actor: string) {
  const result = await admin.rpc('account_photo_paths', { actor });
  if (result.error) throw result.error;
  const paths = (result.data ?? []).map((row: { path: string }) => row.path);
  if (!paths.length) return true;
  const removed = await admin.storage.from('post-photos').remove(paths);
  if (removed.error) throw removed.error;
  return false; // Always verify with a fresh listing on a subsequent run.
}
function absent(error: { code?: string } | null) { return error?.code === 'user_not_found'; }

export async function processAccountDeletion(admin: Admin) {
  const claimed = await admin.rpc('claim_account_deletion');
  if (claimed.error) throw claimed.error;
  const job: Job | null = claimed.data;
  if (!job) return { processed: 0 };
  switch (job.phase) {
    case 'photos':
      try { await move(admin, job, await removePhotos(admin, job.user_id) ? 'rows' : 'photos'); }
      catch { await move(admin, job, 'failed', 'PHOTO_CLEANUP_FAILED'); }
      break;
    case 'rows':
      try { await move(admin, job, 'delete_auth'); }
      catch { await move(admin, job, 'failed', 'DATA_CLEANUP_FAILED'); }
      break;
    case 'delete_auth':
      // Record intent BEFORE touching Auth. Lost response/crash must reconcile, not fail.
      await move(admin, job, 'verify_auth');
      break;
    case 'verify_auth': {
      try {
        const lookup = await admin.auth.admin.getUserById(job.user_id);
        if (absent(lookup.error)) { await move(admin, job, 'final_storage_cleanup'); break; }
        if (lookup.error || !lookup.data.user) { await move(admin, job, 'verify_auth', 'AUTH_RESULT_UNKNOWN'); break; }
        // Pre-cleanup phases completed. Rechecking absence after this request is mandatory.
        await admin.auth.admin.deleteUser(job.user_id);
        await move(admin, job, 'verify_auth', null);
      } catch { await move(admin, job, 'verify_auth', 'AUTH_RESULT_UNKNOWN'); }
      break;
    }
    case 'final_storage_cleanup':
      try {
        await move(admin, job, await removePhotos(admin, job.user_id) ? 'completed' : 'final_storage_cleanup');
      } catch { await move(admin, job, 'final_storage_cleanup', 'FINAL_STORAGE_CLEANUP_PENDING'); }
      break;
    default: throw new Error('INVALID_ACCOUNT_PHASE');
  }
  return { processed: 1 };
}

export async function cleanupCompletedAccounts(admin: Admin) {
  const result = await admin.rpc('completed_account_cleanup_paths');
  if (result.error) throw result.error;
  const paths = (result.data ?? []).map((row: { path: string }) => row.path);
  if (paths.length) {
    const removed = await admin.storage.from('post-photos').remove(paths);
    if (removed.error) throw removed.error;
  }
  return paths.length;
}
