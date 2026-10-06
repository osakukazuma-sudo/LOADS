import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { logoutAccount } from '../lib/accountSession';
import { getSignOutBlockedDiagnostics, type SignOutBlockedDiagnostics } from '../lib/accountActivity';
import { AccountActivityDiagnostics } from './account-activity-diagnostics';

export function LogoutControl() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<SignOutBlockedDiagnostics | null>(null);
  return <View style={{ marginTop: 24, gap: 14 }}>
    {!!error && <Text accessibilityRole="alert" style={{ color: '#FF9494' }}>{error}</Text>}
    {confirm ? <>
      <Text style={{ color: 'white' }}>Sign out of this device? Your workouts, templates and unsent posts stay here. Sign in to this account again to restore them.</Text>
      <Pressable disabled={busy} onPress={async () => {
        setBusy(true); setError(''); setDiagnostics(null);
        try { await logoutAccount(); }
        catch (e) {
          setError(e instanceof Error ? e.message : 'Could not sign out. Please retry.');
          if (process.env.EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS === 'true') setDiagnostics(getSignOutBlockedDiagnostics(e));
        }
        finally { setBusy(false); }
      }}><Text style={{ color: '#D9FF43' }}>{busy ? 'SIGNING OUT…' : 'CONFIRM LOGOUT'}</Text></Pressable>
      <Pressable disabled={busy} onPress={() => setConfirm(false)}><Text style={{ color: 'white' }}>CANCEL</Text></Pressable>
    </> : <Pressable onPress={() => setConfirm(true)}><Text style={{ color: '#D9FF43' }}>LOGOUT</Text></Pressable>}
    {process.env.EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS === 'true' && <AccountActivityDiagnostics key={diagnostics?.capturedAt ?? 'empty'} diagnostics={diagnostics} />}
  </View>;
}
