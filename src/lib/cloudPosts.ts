import { beginAccountOperation } from './accountActivity';
import { supabase } from './supabase';
import { getLocalPosts, saveLocalPost, type LocalPost } from './postOutbox';
import { PHOTO_BUCKET, preparePhoto, uploadPhoto } from './postPhotos';
import { parseExercises, postErrorMessage, validatePost } from './postValidation';
import type { WorkoutPost } from './postStorage';
import type { PostRow } from '../types/database';

export type FeedPost = WorkoutPost & {
  userId: string;
  clientPostId: string;
  authorName: string;
  username: string;
  photoUnavailable: boolean;
};
export type FeedCursor = { createdAt: string; id: string };
export type FeedPage = { posts: FeedPost[]; nextCursor: FeedCursor | null; invalidCount: number };
const PAGE_SIZE = 20;

export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Sign in to publish or read the feed.');
  return data.session.user.id;
}

async function assertOwner(userId: string) {
  if (await currentUserId() !== userId) throw new Error('Your account changed. Return to HOME and sign in to the original account to retry.');
}

async function prepareSnapshot(post: WorkoutPost, userId: string, phase: (value: string) => void): Promise<LocalPost> {
  phase('validate-post');
  validatePost(post);
  phase('auth-get-session');
  await assertOwner(userId);
  phase('prepare-photo');
  const photoUri = post.photoUri ? await preparePhoto(post.photoUri, userId, post.id) : null;
  phase('auth-check-after-photo');
  await assertOwner(userId);
  const entry: LocalPost = { userId, post: { ...post, photoUri }, status: 'pending', error: null, cloudId: null };
  phase('save-local-snapshot');
  await saveLocalPost(entry);
  return entry;
}

export async function prepareLocalPost(post: WorkoutPost, userId: string): Promise<LocalPost> {
  const release = beginAccountOperation({ name: 'prepare-post', source: 'cloudPosts.prepareLocalPost' });
  try { return await prepareSnapshot(post, userId, phase => release.setPhase?.(phase)); } finally { release(); }
}

const publishing = new Map<string, Promise<LocalPost>>();

export function publishLocalPost(entry: LocalPost, trigger = 'publishLocalPost'): Promise<LocalPost> {
  const key = `${entry.userId}/${entry.post.id}`;
  const existing = publishing.get(key);
  if (existing) return existing;
  const release = beginAccountOperation({ name: trigger === 'feed-retry' || entry.status === 'failed' ? 'retry-post' : 'upload-post', source: `cloudPosts.${trigger}` });
  const operation = publish(entry, phase => release.setPhase?.(phase)).finally(() => { publishing.delete(key); release(); });
  publishing.set(key, operation);
  return operation;
}

async function publish(entry: LocalPost, phase: (value: string) => void): Promise<LocalPost> {
  phase('validate-post');
  validatePost(entry.post);
  phase('auth-get-session');
  await assertOwner(entry.userId);
  if (entry.status === 'published' || entry.status === 'deleted') return entry;
  const markIfDeleted = async () => {
    phase('lookup-deleted-post');
    const result = await supabase.from('deleted_posts').select('post_id')
      .eq('user_id', entry.userId).eq('client_post_id', entry.post.id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return null;
    const deleted: LocalPost = { ...entry, status: 'deleted', error: null, cloudId: result.data.post_id };
    phase('save-deleted-post');
    await saveLocalPost(deleted);
    return deleted;
  };
  try {
    const deleted = await markIfDeleted();
    if (deleted) return deleted;
    // Check before reading the local photo: a prior successful insert may have lost its response.
    const lookup = () => supabase.from('posts').select('id')
      .eq('user_id', entry.userId).eq('client_post_id', entry.post.id).maybeSingle();
    phase('lookup-existing-post');
    const previous = await lookup();
    if (previous.error) throw previous.error;
    let cloudId = previous.data?.id;
    if (!cloudId) {
      phase('auth-check-before-photo');
      await assertOwner(entry.userId);
      phase('photo-upload');
      const photoPath = entry.post.photoUri ? await uploadPhoto(entry.post.photoUri, entry.userId, entry.post.id) : null;
      phase('auth-check-after-photo');
      await assertOwner(entry.userId);
      const { post } = entry;
      phase('insert-post');
      const result = await supabase.from('posts').insert({
        user_id: entry.userId, client_post_id: post.id, workout_id: post.workoutId,
        caption: post.caption, photo_path: photoPath, duration_seconds: post.durationSeconds,
        total_sets: post.totalSets, total_volume: post.totalVolume, pr_count: post.prCount,
        ...(post.trainingPartners?.length ? { training_partner_ids: post.trainingPartners.map(person => person.id) } : {}),
        exercises: post.exercises.map(exercise => ({ ...exercise })),
      }).select('id').single();
      if (result.error?.code === '23505') {
        phase('lookup-duplicate-post');
        const duplicate = await lookup();
        if (duplicate.error || !duplicate.data) throw duplicate.error ?? result.error;
        cloudId = duplicate.data.id;
      } else {
        if (result.error) throw result.error;
        cloudId = result.data.id;
      }
    }
    const published: LocalPost = { ...entry, status: 'published', error: null, cloudId };
    phase('save-published-post');
    await saveLocalPost(published);
    return published;
  } catch (error) {
    // Deletion may have committed during upload/insert; retire the retry instead of recreating it.
    try { const deleted = await markIfDeleted(); if (deleted) return deleted; } catch { /* Keep the original error and snapshot. */ }
    // Never lose the snapshot if the network or the final local status write fails.
    phase('save-failed-post');
    try { await saveLocalPost({ ...entry, status: 'failed', error: postErrorMessage(error) }); } catch { /* Original durable snapshot remains. */ }
    throw error;
  }
}

export function feedCursorFilter(cursor: FeedCursor): string {
  // Preserve Postgres timestamp precision; Date.toISOString would truncate microseconds.
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(cursor.createdAt) ||
      !/^[0-9a-f-]{36}$/i.test(cursor.id)) throw new Error('Invalid feed cursor. Refresh the feed.');
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

type JoinedPost = PostRow & { post_partners?: { user_id: string; username: string }[]; profiles: { username: string; display_name: string | null } | null };

export function toFeedPost(row: JoinedPost, photoUri: string | null): FeedPost {
  const post: FeedPost = {
    id: row.id, userId: row.user_id, clientPostId: row.client_post_id,
    workoutId: row.workout_id, createdAt: row.created_at, caption: row.caption,
    photoUri, photoUnavailable: !!row.photo_path && !photoUri,
    durationSeconds: row.duration_seconds, totalSets: row.total_sets, totalVolume: row.total_volume,
    ...(row.post_partners?.length ? { trainingPartners: row.post_partners.map(person => ({ id: person.user_id, username: person.username })) } : {}),
    prCount: row.pr_count, exercises: parseExercises(row.exercises),
    authorName: row.profiles?.display_name?.trim() || row.profiles?.username || 'LOADS ATHLETE',
    username: row.profiles?.username || '',
  };
  validatePost(post);
  return post;
}

export async function getFeedPage(cursor: FeedCursor | null = null, taggedOnly = false): Promise<FeedPage> {
  const userId = await currentUserId();
  // Tags add a second profiles relationship; select the post author explicitly.
  let query = supabase.from('following_feed').select('*, profiles!posts_user_id_fkey(username, display_name), post_partners!post_partners_post_id_fkey(user_id, username)')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE + 1);
  if (taggedOnly) query = query.contains('training_partner_ids', [userId]);
  if (cursor) query = query.or(feedCursorFilter(cursor));
  const { data, error } = await query;
  if (error) throw error;
  const rows = data.slice(0, PAGE_SIZE);
  const paths = rows.flatMap(row => row.photo_path ? [row.photo_path] : []);
  const signed = paths.length ? await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600) : null;
  const urls = new Map(signed?.data?.map(item => [item.path, item.signedUrl]) ?? []);
  await assertOwner(userId);
  const posts: FeedPost[] = [];
  let invalidCount = 0;
  for (const row of rows) {
    try { posts.push(toFeedPost(row, row.photo_path ? urls.get(row.photo_path) || null : null)); }
    catch { invalidCount++; }
  }
  const last = rows.at(-1);
  return {
    posts, invalidCount,
    nextCursor: data.length > PAGE_SIZE && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

export async function getPendingPosts(userId: string): Promise<LocalPost[]> {
  await assertOwner(userId);
  const posts = await getLocalPosts(userId);
  await assertOwner(userId);
  return posts.filter(post => post.status === 'pending' || post.status === 'failed');
}
