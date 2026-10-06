import { adminClient, json } from '../_shared/runtime.ts';
import { processPushQueue } from '../_shared/push.ts';
Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const credential = req.headers.get('x-cleanup-secret');
  if (!credential) return json({ error: 'UNAUTHORIZED' }, 401);
  try {
    const admin = adminClient();
    const verified = await admin.rpc('verify_cleanup_worker', { candidate: credential });
    if (verified.error || verified.data !== true) return json({ error: 'UNAUTHORIZED' }, 401);
    return json(await processPushQueue(admin, fetch, Deno.env.get('EXPO_ACCESS_TOKEN')));
  } catch { return json({ error: 'PUSH_PROCESSING_FAILED' }, 503); }
});
