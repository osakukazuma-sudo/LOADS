import { adminClient, authenticatedUser, headers, json } from '../_shared/runtime.ts';
import { cleanupPhotos } from '../_shared/photo-cleanup.ts';

export async function handle(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const admin = adminClient();
    const { user } = await authenticatedUser(req, admin);
    const { postId } = await req.json();
    if (typeof postId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(postId)) return json({ error: 'INVALID_POST' }, 400);
    const { data, error } = await admin.rpc('delete_owned_post', { actor: user.id, target: postId });
    if (error) return json({ error: error.message === 'POST_NOT_FOUND' ? 'POST_NOT_FOUND' : 'DELETE_FAILED' }, error.message === 'POST_NOT_FOUND' ? 404 : 503);
    // Commit of the post deletion is independent of Storage availability; durable job retries it.
    let photoCleanupPending = true;
    try { photoCleanupPending = (await cleanupPhotos(admin, `${user.id}/${data.client_post_id}.jpg`)).failed > 0; } catch { /* Worker retries the durable job. */ }
    return json({ deleted: true, photoCleanupPending });
  } catch (error) {
    return json({ error: error instanceof Error && error.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'DELETE_FAILED' }, error instanceof Error && error.message === 'UNAUTHORIZED' ? 401 : 503);
  }
}
Deno.serve(handle);
