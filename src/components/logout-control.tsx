import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { logoutAccount } from '../lib/accountSession';

export function LogoutControl() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <View style={{ marginTop: 24, gap: 14 }}>
    {!!error && <Text accessibilityRole="alert" style={{ color: '#FF9494' }}>{error}</Text>}
    {confirm ? <>
      <Text style={{ color: 'white' }}>Sign out of this device? Your workouts, templates and unsent posts stay here. Sign in to this account again to restore them.</Text>
      <Pressable disabled={busy} onPress={async () => {
        setBusy(true); setError('');
        try { await logoutAccount(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not sign out. Please retry.'); }
        finally { setBusy(false); }
      }}><Text style={{ color: '#D9FF43' }}>{busy ? 'SIGNING OUT…' : 'CONFIRM LOGOUT'}</Text></Pressable>
      <Pressable disabled={busy} onPress={() => setConfirm(false)}><Text style={{ color: 'white' }}>CANCEL</Text></Pressable>
    </> : <Pressable onPress={() => setConfirm(true)}><Text style={{ color: '#D9FF43' }}>LOGOUT</Text></Pressable>}
  </View>;
}
