import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { currentUserId } from './cloudPosts';
import { PUSH_DEVICE_KEY } from './pushDevice';
import { beginAccountOperation } from './accountActivity';
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
export async function registerPush(owner: string, requestPermission: boolean) {
  if (Platform.OS === 'web' || !Device.isDevice) {
    if (requestPermission) throw new Error('Push notifications require a physical iOS or Android device.');
    return;
  }
  const release = beginAccountOperation();
  try {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('workouts', { name: 'Workouts', importance: Notifications.AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) { if (requestPermission) throw new Error('Allow notifications in device Settings to enable workout notifications.'); return; }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Push notifications are not configured.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const deviceId = await getDeviceId();
  if (await currentUserId() !== owner) throw new Error('Account changed.');
  const result = await supabase.rpc('register_push_device', { p_device_id: deviceId, p_token: token, p_platform: Platform.OS });
  if (result.error) throw new Error('Could not register notifications. Please retry.');
  } finally { release(); }
}
