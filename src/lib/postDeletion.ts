import { beginAccountOperation } from './accountActivity';
import { currentUserId, type FeedPost } from './cloudPosts';
import { getLocalPosts, saveLocalPost } from './postOutbox';
import { supabase } from './supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { deletionFailureDiagnostic } from './deletionDiagnostics';

export async function deleteOwnPost(post: FeedPost) {
  const release = beginAccountOperation({ name: 'delete-post', source: 'postDeletion.deleteOwnPost' });
  try {
    release.setPhase?.('auth-get-session');
    if (await currentUserId() !== post.userId) throw new Error('Only the owner can delete this post.');
    release.setPhase?.('delete-post-function');
    const startedAt = Date.now();
    const { data, error } = await supabase.functions.invoke('delete-post', { body: { postId: post.id } }).catch((error: unknown) => {
      if (__DEV__) console.warn('Post deletion failed', JSON.stringify(deletionFailureDiagnostic(error, startedAt)));
      throw new Error('Could not confirm deletion. Check your connection and try again.');
    });
    if (error || data?.deleted !== true) {
      const status = error instanceof FunctionsHttpError ? error.context.status : undefined;
      if (__DEV__) console.warn('Post deletion failed', JSON.stringify(deletionFailureDiagnostic(error, startedAt)));
      if (status === 401) throw new Error('Your session could not be verified. Sign in again before deleting.');
      throw new Error('Could not confirm deletion. Check your connection and try again.');
    }
    // The server tombstone is authoritative even when this local update fails.
    release.setPhase?.('retire-local-post');
    try {
      const entry = (await getLocalPosts(post.userId)).find(item => item.post.id === post.clientPostId);
      if (entry) await saveLocalPost({ ...entry, status: 'deleted', error: null });
    } catch { /* Retrying later checks the server tombstone first. */ }
    return { photoCleanupPending: data.photoCleanupPending === true };
  } finally { release(); }
}
