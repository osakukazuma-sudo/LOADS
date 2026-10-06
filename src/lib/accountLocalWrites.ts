import AsyncStorage from '@react-native-async-storage/async-storage';

const removed = new Set<string>();
export function preventDeletedAccountWrites(userId: string) { removed.add(userId); }
export async function assertAccountLocalWritable(userId: string) {
  if (removed.has(userId)) throw new Error('This account’s local data has been removed.');
  const raw = await AsyncStorage.getItem('@loads/account-deletion/v1');
  if (raw) {
    const pending = JSON.parse(raw);
    if (pending.userId === userId && pending.submitted) throw new Error('Account deletion is pending.');
  }
}
