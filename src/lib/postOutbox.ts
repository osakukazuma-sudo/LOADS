import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutPost } from './postStorage';
import { validatePost } from './postValidation';
import { assertAccountLocalWritable } from './accountLocalWrites';
import { serializeLocal } from './userLocalData';

export type LocalPost = {
  userId: string;
  post: WorkoutPost;
  status: 'pending' | 'failed' | 'published' | 'deleted';
  error: string | null;
  cloudId: string | null;
};

function prefix(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid account. Sign in again.');
  return `@loads/cloud-posts/v1/${userId}/`;
}

// One key per snapshot: concurrent saves cannot overwrite another pending post.
// The legacy @loads/posts key is intentionally never read or reassigned here.
export async function saveLocalPost(entry: LocalPost): Promise<void> {
  validatePost(entry.post);
  await serializeLocal(async () => {
    await assertAccountLocalWritable(entry.userId);
    await AsyncStorage.setItem(prefix(entry.userId) + entry.post.id, JSON.stringify(entry));
  });
}

export async function getLocalPosts(userId: string): Promise<LocalPost[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix(userId)));
  const entries = await AsyncStorage.multiGet(keys);
  return entries.map(([key, json]) => {
    if (!json) throw new Error('A saved post could not be read. Please retry.');
    const entry: LocalPost = JSON.parse(json);
    if (entry.userId !== userId || !['pending', 'failed', 'published', 'deleted'].includes(entry.status) ||
        key !== prefix(userId) + entry.post?.id) throw new Error('Invalid saved post.');
    validatePost(entry.post);
    return entry;
  }).sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
}
