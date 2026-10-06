import { unregisterPushDevice } from './pushDevice';
import { supabase } from './supabase';
import { flushLocalWrites } from './userLocalData';
import { beginSignOut } from './accountActivity';

export async function logoutAccount() {
  const release = beginSignOut();
  try {
    await flushLocalWrites();
    await unregisterPushDevice();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } finally { release(); }
}
