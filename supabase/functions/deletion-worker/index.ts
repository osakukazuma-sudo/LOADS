import { adminClient, json } from '../_shared/runtime.ts';
import { cleanupPhotos } from '../_shared/photo-cleanup.ts';
import { processAccountDeletion, cleanupCompletedAccounts } from '../_shared/account-cleanup.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const credential = req.headers.get('x-cleanup-secret');
  if (!credential) return json({ error: 'UNAUTHORIZED' }, 401);
  try {
    const admin = adminClient();
    const verified = await admin.rpc('verify_cleanup_worker', { candidate: credential });
    if (verified.error || verified.data !== true) return json({ error: 'UNAUTHORIZED' }, 401);
    // Isolate account cleanup failure so the existing post cleanup still runs.
    const photos = await cleanupPhotos(admin);
    let accountCleanupPending = false;
    try { await processAccountDeletion(admin); await cleanupCompletedAccounts(admin); }
    catch { accountCleanupPending = true; }
    return json({ ...photos, accountCleanupPending });
  } catch { return json({ error: 'CLEANUP_FAILED' }, 503); }
});
