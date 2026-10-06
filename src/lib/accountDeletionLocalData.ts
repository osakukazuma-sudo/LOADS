import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteAccountPhotos } from './postPhotoFiles';
import { serializeLocal, userDataKey } from './userLocalData';
import { preventDeletedAccountWrites } from './accountLocalWrites';

export async function clearDeletedAccountData(userId: string) {
  userDataKey(userId, 'workouts'); // Validate before constructing any deletion path.
  preventDeletedAccountWrites(userId);
  await serializeLocal(async () => {
    await deleteAccountPhotos(userId);
    const prefixes = [`@loads/local/v1/${userId}/`, `@loads/cloud-posts/v1/${userId}/`];
    const keys = (await AsyncStorage.getAllKeys()).filter(key => prefixes.some(prefix => key.startsWith(prefix)));
    if (keys.length) await AsyncStorage.multiRemove(keys);
    const raw = await AsyncStorage.getItem('@loads/local-data-migration/v1');
    if (raw && JSON.parse(raw).owner === userId) {
      await AsyncStorage.multiRemove(['@loads/workouts', '@loads/active-workout', '@loads/templates']);
      // Retain the assignment marker to avoid offering removed originals to another user.
      await AsyncStorage.setItem('@loads/local-data-migration/v1', JSON.stringify({ owner: userId, complete: true }));
    }
  });
}
