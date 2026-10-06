import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { legacyDataAvailable, migrateLegacyData } from '../lib/userLocalData';

export function UserDataGate({ userId, label, children }: { userId: string; label: string; children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'offer' | 'ready'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    legacyDataAvailable(userId).then(found => { if (alive) setState(found ? 'offer' : 'ready'); })
      .catch(() => { if (alive) { setError('Could not inspect saved records. You can continue without importing.'); setState('offer'); } });
    return () => { alive = false; };
  }, [userId]);
  if (state === 'ready') return children;
  return <View style={{ flex: 1, backgroundColor: '#080808', padding: 28, justifyContent: 'center', gap: 20 }}>
    <Text style={{ color: '#F5F5F2', fontSize: 22 }}>SAVED RECORDS</Text>
    {state === 'loading' ? <Text style={{ color: 'white' }}>Loading…</Text> : <>
      <Text style={{ color: 'white' }}>Import this device’s earlier workouts and templates into {label}? These records have no recorded owner. Nothing will be published.</Text>
      {!!error && <Text accessibilityRole="alert" style={{ color: '#FF9494' }}>{error}</Text>}
      <Pressable disabled={busy} onPress={async () => {
        setBusy(true); setError('');
        try { await migrateLegacyData(userId); setState('ready'); }
        catch (e) { setError(e instanceof Error ? e.message : 'Import failed. Originals have been kept.'); }
        finally { setBusy(false); }
      }}><Text style={{ color: '#D9FF43' }}>{busy ? 'IMPORTING…' : 'IMPORT TO THIS ACCOUNT'}</Text></Pressable>
      <Pressable disabled={busy} onPress={() => setState('ready')}><Text style={{ color: 'white' }}>LATER</Text></Pressable>
    </>}
  </View>;
}
