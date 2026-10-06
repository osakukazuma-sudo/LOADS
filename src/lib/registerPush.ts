import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { currentUserId } from './cloudPosts';
import { PUSH_DEVICE_KEY } from './pushDevice';
import { getAccountActivityGeneration, prepareAccountOperation } from './accountActivity';
let deviceIdentity: Promise<string> | null = null;
function getDeviceId(): Promise<string> {
  deviceIdentity ??= (async () => {
    const saved = await AsyncStorage.getItem(PUSH_DEVICE_KEY);
    if (saved) return saved;
    const id = Crypto.randomUUID();
    await AsyncStorage.setItem(PUSH_DEVICE_KEY, id);
    return id;
  })().catch(error => { deviceIdentity = null; throw error; });
  return deviceIdentity;
}
const inFlight = new Map<string, Promise<void>>();
const tails = new Map<string, Promise<void>>();
const lastRequested = new Map<string, string>();
const completed = new Set<string>();
let cacheGeneration = -1;
let registered: { owner: string; deviceId: string; token: string; generation: number } | null = null;

export function registerPush(owner: string, requestPermission: boolean, trigger = 'registerPush', devicePushToken?: Notifications.DevicePushToken): Promise<void> {
  const generation = getAccountActivityGeneration();
  if (cacheGeneration !== generation) { cacheGeneration = generation; completed.clear(); registered = null; }
  const sessionKey = JSON.stringify([owner, generation]);
  const key = JSON.stringify([owner, generation, requestPermission, devicePushToken?.type, devicePushToken?.data]);
  const existing = inFlight.get(key);
  if (existing && lastRequested.get(sessionKey) === key) return existing;
  lastRequested.set(sessionKey, key);
  const beginRegistration = prepareAccountOperation({ name: 'push-register', source: `registerPush.${trigger}` });
  // Serialize different token updates so an older write cannot finish after a
  // newer token. Identical events share the same Promise, including preparation.
  const run = (tails.get(sessionKey) ?? Promise.resolve()).then(async () => {
    if (generation !== getAccountActivityGeneration()) throw new Error('Account changed.');
    if (Platform.OS !== 'web' && Device.isDevice && await currentUserId() !== owner) throw new Error('Account changed.');
    if (!requestPermission && completed.has(key)) return;
    const saved = await performRegistration(owner, requestPermission, generation, beginRegistration, devicePushToken);
    if (saved && generation === getAccountActivityGeneration()) { completed.clear(); completed.add(key); }
  }).finally(() => {
    if (inFlight.get(key) === run) inFlight.delete(key);
    if (tails.get(sessionKey) === tail) { tails.delete(sessionKey); lastRequested.delete(sessionKey); }
  });
  const tail = run.catch(() => {});
  inFlight.set(key, run); tails.set(sessionKey, tail);
  return run;
}

async function performRegistration(owner: string, requestPermission: boolean, generation: number,
  beginRegistration: ReturnType<typeof prepareAccountOperation>, devicePushToken?: Notifications.DevicePushToken): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    if (requestPermission) throw new Error('Push notifications require a physical iOS or Android device.');
    return false;
  }
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('workouts', { name: 'Workouts', importance: Notifications.AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) { if (requestPermission) throw new Error('Allow notifications in device Settings to enable workout notifications.'); return false; }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Push notifications are not configured.');
  // A token listener must use its supplied native token. Fetching it again here
  // triggers that listener on iOS and creates a self-sustaining registration loop.
  const token = (await Notifications.getExpoPushTokenAsync({ projectId, ...(devicePushToken ? { devicePushToken } : {}) })).data;
  const deviceId = await getDeviceId();
  // Only the account-bound write needs exclusion with logout. Acquire before
  // checking the owner so logout cannot race between that check and the RPC.
  const release = beginRegistration();
  try {
  release.setPhase?.('auth-get-session');
  if (await currentUserId() !== owner) throw new Error('Account changed.');
  if (registered?.owner === owner && registered.deviceId === deviceId && registered.token === token && registered.generation === generation) return true;
  release.setPhase?.('register-push-device-rpc');
  const result = await supabase.rpc('register_push_device', { p_device_id: deviceId, p_token: token, p_platform: Platform.OS });
  if (result.error) throw new Error('Could not register notifications. Please retry.');
  if (generation === getAccountActivityGeneration()) registered = { owner, deviceId, token, generation };
  return true;
  } finally { release(); }
}
