import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
export const PUSH_DEVICE_KEY = '@loads/push-device/v1';
export async function unregisterPushDevice() {
  const deviceId = await AsyncStorage.getItem(PUSH_DEVICE_KEY);
  if (!deviceId) return;
  const result = await supabase.from('push_devices').delete().eq('device_id', deviceId);
  if (result.error) throw new Error('Could not disconnect push notifications. Connect to the internet and retry signing out.');
}
