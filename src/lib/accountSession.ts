import { unregisterPushDevice } from './pushDevice';
import { supabase } from './supabase';
import { flushLocalWrites } from './userLocalData';
import { beginSignOut } from './accountActivity';

export async function logoutAccount() {
  const release = beginSignOut({ name: 'logout', source: 'accountSession.logoutAccount' });
  try {
    release.setPhase?.('flush-local-writes');
    await flushLocalWrites();
    release.setPhase?.('unregister-push-device');
    await unregisterPushDevice();
    release.setPhase?.('auth-signout');
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } finally { release(); }
}
