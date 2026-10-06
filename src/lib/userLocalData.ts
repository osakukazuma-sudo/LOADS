import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertAccountLocalWritable } from './accountLocalWrites';

export type LocalCollection = 'workouts' | 'active-workout' | 'templates' | 'completion-sync';
const migrationKey = '@loads/local-data-migration/v1';
let queue: Promise<unknown> = Promise.resolve();
let lastWriteError: unknown = null;

export function userDataKey(userId: string, collection: LocalCollection) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Sign in to access your saved data.');
  return `@loads/local/v1/${userId}/${collection}`;
}

export function serializeLocal<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch(error => { lastWriteError = error; });
  return result;
}

export async function flushLocalWrites() {
  await queue;
  if (lastWriteError) { const error = lastWriteError; lastWriteError = null; throw error; }
}

export async function readLocal<T>(userId: string, collection: LocalCollection, fallback: T): Promise<T> {
  await queue;
  const json = await AsyncStorage.getItem(userDataKey(userId, collection));
  return json === null ? fallback : JSON.parse(json) as T;
}

export function updateLocal<T>(userId: string, collection: LocalCollection, fallback: T, update: (value: T) => T) {
  const key = userDataKey(userId, collection);
  return serializeLocal(async () => {
    await assertAccountLocalWritable(userId);
    const json = await AsyncStorage.getItem(key);
    await AsyncStorage.setItem(key, JSON.stringify(update(json === null ? fallback : JSON.parse(json))));
  });
}

export async function legacyDataAvailable(userId: string) {
  userDataKey(userId, 'workouts');
  const raw = await AsyncStorage.getItem(migrationKey);
  const record = raw ? JSON.parse(raw) : null;
  if (record) return record.owner === userId && !record.complete;
  const values = await AsyncStorage.multiGet(['@loads/workouts', '@loads/active-workout', '@loads/templates']);
  return values.some(([, value]) => value !== null && value !== '[]' && value !== 'null');
}

export function migrateLegacyData(userId: string) {
  userDataKey(userId, 'workouts');
  return serializeLocal(async () => {
    await assertAccountLocalWritable(userId);
    const raw = await AsyncStorage.getItem(migrationKey);
    const record = raw ? JSON.parse(raw) : null;
    if (record?.owner && record.owner !== userId) throw new Error('These records were already assigned to another account.');
    if (record?.complete) return;
    // Reserve before copying: interruption cannot let another account claim the same data.
    await AsyncStorage.setItem(migrationKey, JSON.stringify({ owner: userId, complete: false }));
    for (const collection of ['workouts', 'templates', 'active-workout'] as const) {
      const source = await AsyncStorage.getItem(`@loads/${collection}`);
      if (source === null) continue;
      const key = userDataKey(userId, collection);
      const target = await AsyncStorage.getItem(key);
      const old = JSON.parse(source);
      let next = target ? JSON.parse(target) : null;
      if (collection === 'active-workout') next ??= old;
      else {
        if (!Array.isArray(old) || (next !== null && !Array.isArray(next))) throw new Error('Saved records are invalid. Originals have been kept.');
        const merged = new Map<string, unknown>();
        for (const item of [...old, ...(next ?? [])]) {
          if (!item || typeof item.id !== 'string') throw new Error('Invalid saved record. Originals have been kept.');
          merged.set(item.id, item);
        }
        next = [...merged.values()];
      }
      const encoded = JSON.stringify(next);
      await AsyncStorage.setItem(key, encoded);
      if (await AsyncStorage.getItem(key) !== encoded) throw new Error('Could not verify copied records. Retry import.');
    }
    await AsyncStorage.setItem(migrationKey, JSON.stringify({ owner: userId, complete: true }));
    // Keep legacy originals as a recovery copy; application readers never use them.
  });
}
