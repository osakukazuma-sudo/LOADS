import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { requestAccountDeletion } from '../lib/accountDeletion';

export function AccountDeletionControl() {
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  if (process.env.EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED !== 'true') return null;
  return <View style={{ padding: 20, gap: 14 }}>
    <Pressable accessibilityRole="button" onPress={() => setConfirm(true)}><Text style={{ color: '#ff9494' }}>DELETE ACCOUNT</Text></Pressable>
    {confirm && <>
      <Text style={{ color: 'white' }}>Permanently delete your cloud photos, posts, profile and account, then your saved data on this device. This cannot be undone. Other accounts and your original photo library are kept. Processing may take several minutes.</Text>
      <TextInput accessibilityLabel="Current password" secureTextEntry autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} placeholder="Current password" placeholderTextColor="#aaa" style={{ color: 'white', borderWidth: 1, borderColor: '#777', padding: 12 }} />
      {!!error && <Text accessibilityRole="alert" style={{ color: '#ff9494' }}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={busy || !password} onPress={async () => {
        if (running.current) return;
        running.current = true; setBusy(true); setError('');
        const value = password; setPassword('');
        try { await requestAccountDeletion(value); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not request deletion.'); }
        finally { running.current = false; setBusy(false); }
      }}><Text style={{ color: '#ff9494' }}>{busy ? 'VERIFYING…' : 'PERMANENTLY DELETE MY ACCOUNT'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setConfirm(false); setPassword(''); setError(''); }}><Text style={{ color: 'white' }}>CANCEL</Text></Pressable>
    </>}
  </View>;
}
