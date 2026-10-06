import { supabase } from './supabase';
import { currentUserId } from './cloudPosts';
import { beginAccountOperation } from './accountActivity';

export type Athlete = { id: string; username: string; display_name: string | null };
export type ConnectionKind = 'followers' | 'following';
export type FollowCounts = { followers: number; following: number };
export const CONNECTION_PAGE_SIZE = 30;
const connectionListeners = new Set<(owner: string) => void>();
export function subscribeFollowChanges(listener: (owner: string) => void) {
  connectionListeners.add(listener);
  return () => { connectionListeners.delete(listener); };
}

async function checkOwner(owner: string) {
  if (await currentUserId() !== owner) throw new Error('Your account changed. Open this screen again.');
}
export function exactUsername(input: string) {
  const username = input.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error('Enter the complete username (3–30 letters, numbers or underscores).');
  return username;
}
export async function findAthlete(owner: string, input: string): Promise<Athlete | null> {
  const username = exactUsername(input);
  await checkOwner(owner);
  const result = await supabase.from('profiles').select('id,username,display_name').eq('username', username).maybeSingle();
  if (result.error) throw result.error;
  await checkOwner(owner);
  return result.data;
}
export async function athleteWithFollow(owner: string, target: string) {
  await checkOwner(owner);
  const [profile, relation] = await Promise.all([
    supabase.from('profiles').select('id,username,display_name').eq('id', target).single(),
    supabase.from('follows').select('following_id').eq('follower_id', owner).eq('following_id', target).maybeSingle(),
  ]);
  if (profile.error || relation.error) throw profile.error ?? relation.error;
  await checkOwner(owner);
  return { profile: profile.data, following: !!relation.data };
}
export async function setFollowing(owner: string, target: string, following: boolean) {
  if (owner === target) throw new Error('You cannot follow yourself.');
  const release = beginAccountOperation();
  try {
    await checkOwner(owner);
    const result = following
      ? await supabase.from('follows').insert({ follower_id: owner, following_id: target })
      : await supabase.from('follows').delete().eq('follower_id', owner).eq('following_id', target);
    // A repeated Follow request has the same final state, without an UPDATE grant.
    if (result.error && !(following && result.error.code === '23505')) throw result.error;
    await checkOwner(owner);
    connectionListeners.forEach(listener => listener(owner));
  } finally { release(); }
}
export async function myFollowCounts(owner: string): Promise<FollowCounts> {
  await checkOwner(owner);
  const { data, error } = await supabase.rpc('my_follow_counts');
  if (error) throw error;
  await checkOwner(owner);
  const result = data as FollowCounts | null;
  if (!result || !Number.isSafeInteger(result.followers) || !Number.isSafeInteger(result.following)) throw new Error('Could not read connections.');
  return result;
}
export async function myConnections(owner: string, kind: ConnectionKind, after: string | null = null) {
  await checkOwner(owner);
  const own = kind === 'following' ? 'follower_id' : 'following_id';
  const other = kind === 'following' ? 'following_id' : 'follower_id';
  let query = supabase.from('follows').select('follower_id,following_id').eq(own, owner)
    .order(other).limit(CONNECTION_PAGE_SIZE + 1);
  if (after) query = query.gt(other, after);
  const edges = await query;
  if (edges.error) throw edges.error;
  const ids = edges.data.slice(0, CONNECTION_PAGE_SIZE).map(row => row[other]);
  const profiles = ids.length ? await supabase.from('profiles').select('id,username,display_name').in('id', ids) : { data: [], error: null };
  if (profiles.error) throw profiles.error;
  await checkOwner(owner);
  const byId = new Map(profiles.data!.map(row => [row.id, row]));
  return { people: ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []), next: edges.data.length > CONNECTION_PAGE_SIZE ? ids.at(-1)! : null };
}
