import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '../types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const isStaticRender = Platform.OS === 'web' && typeof window === 'undefined';

if (!url || !key) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY before starting LOADS.');
}
if (key.startsWith('sb_secret_')) {
  throw new Error('LOADS requires a public Supabase key, never a secret key.');
}

export const supabase = createClient<Database>(
  url,
  key,
  {
    auth: {
      storage: isStaticRender ? undefined : AsyncStorage,
      autoRefreshToken: !isStaticRender,
      persistSession: !isStaticRender,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  }
);
