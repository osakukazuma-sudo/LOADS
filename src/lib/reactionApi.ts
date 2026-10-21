import { beginAccountOperation } from './accountActivity';
import { supabase } from './supabase';
import type { ReactionType } from './workoutReactions';
import { reportReactionFailure } from './workoutReactions';

async function diagnosed<T>(phase: Parameters<typeof reportReactionFailure>[0], operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) { reportReactionFailure(phase, error); throw error; }
}

async function assertOwner(owner: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== owner) throw new Error('Account changed.');
}
export async function readReaction(owner: string, postId: string): Promise<ReactionType | null> {
  return diagnosed('read_one', async () => {
    await assertOwner(owner);
    const result = await supabase.from('workout_reactions').select('reaction_type').eq('post_id', postId).eq('user_id', owner).maybeSingle();
    if (result.error) throw result.error;
    await assertOwner(owner);
    return result.data?.reaction_type as ReactionType ?? null;
  });
}
export async function writeReaction(owner: string, postId: string, value: ReactionType | null) {
  return diagnosed(value === null ? 'cancel' : 'save', async () => {
    const release = beginAccountOperation({ name: 'reaction-write', source: 'reactionApi.writeReaction' });
    try {
      await assertOwner(owner);
      const result = value === null
        ? await supabase.from('workout_reactions').delete().eq('post_id', postId).eq('user_id', owner).select('post_id')
        : await supabase.from('workout_reactions').upsert({ post_id: postId, user_id: owner, reaction_type: value }, { onConflict: 'post_id,user_id' });
      if (result.error) throw result.error;
      if (value === null && !result.data?.length) {
        // RLS may silently filter DELETE to zero rows. Only accept an idempotent
        // cancellation if the post is still visible; otherwise reconcile the UI.
        const post = await supabase.from('posts').select('id').eq('id', postId).maybeSingle();
        if (post.error || !post.data) throw new Error('Post unavailable. Refresh the feed.');
        if (await readReaction(owner, postId) !== null) throw new Error('Reaction cancellation was not allowed.');
      }
      await assertOwner(owner);
    } finally { release(); }
  });
}

// One read per feed page; cards never perform their own initial network request.
export async function readPageReactions(owner: string, ids: string[]) {
  if (!ids.length) return new Map<string, ReactionType>();
  return diagnosed('read_page', async () => {
    await assertOwner(owner);
    const result = await supabase.from('workout_reactions').select('post_id,reaction_type').eq('user_id', owner).in('post_id', ids);
    if (result.error) throw result.error;
    await assertOwner(owner);
    return new Map(result.data.map(row => [row.post_id, row.reaction_type as ReactionType]));
  });
}
