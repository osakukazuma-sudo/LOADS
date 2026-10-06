import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { cancelUnstartedDeletion, checkAccountDeletion, deletionStatusWaitSeconds, finishLocalAccountDeletion, readDeletionReceipt, retryAccountDeletion, subscribeDeletion, type DeletionReceipt, type DeletionStatus } from '../lib/accountDeletion';

export function AccountDeletionGate({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<DeletionReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [localConfirm, setLocalConfirm] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const refresh = () => { const current = ++revision; void readDeletionReceipt().then(value => {
      if (alive && current === revision) { setRecord(value); setLoading(false); }
    }).catch(() => { if (alive) { setError('Could not read deletion recovery information. Restart and retry.'); setLoading(true); } }); };
    refresh(); const unsubscribe = subscribeDeletion(refresh);
    return () => { alive = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!record?.submitted) return;
    const update = () => setWaitSeconds(deletionStatusWaitSeconds(record));
    update();
    // Use the deadline, not a decrementing counter: resume correctly after backgrounding.
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [record]);
  if (!loading && !record?.submitted) return children;
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete this step.'); }
    finally { if (record) setWaitSeconds(deletionStatusWaitSeconds(record)); setBusy(false); }
  }
  return <View style={{ flex: 1, backgroundColor: '#080808', padding: 28, justifyContent: 'center', gap: 18 }}>
    <Text style={{ color: 'white', fontSize: 22 }}>ACCOUNT DELETION</Text>
    <Text style={{ color: 'white' }}>{loading ? 'Loading recovery information…' : status?.status === 'completed' ? 'Server deletion completed. Finish clearing this account’s saved data on this device.' : status?.status === 'failed' ? 'Deletion stopped before Auth removal. Re-enter your password to retry the remaining work.' : 'Posting is stopped on this device while deletion is checked. Keep this app’s data until the result is confirmed.'}</Text>
    {status && <Text style={{ color: '#ddd' }}>{status.status}{status.failure_code ? ` — ${status.failure_code}` : ''}</Text>}
    {(status?.status === 'pending' || status?.status === 'processing') && <Text style={{ color: '#ddd' }}>
      {status.status === 'pending' ? 'Deletion is queued.' : 'Deletion is in progress on the server.'} It runs in stages and may take several minutes. The time below is until you can check again, not until deletion finishes.
    </Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#ff9494' }}>{error}</Text>}
    {record && <>
      {waitSeconds > 0 && <Text style={{ color: '#ddd' }}>Next status check in {waitSeconds}s</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || waitSeconds > 0 }} disabled={busy || waitSeconds > 0} onPress={() => {
        if (deletionStatusWaitSeconds(record) > 0) { setWaitSeconds(deletionStatusWaitSeconds(record)); return; }
        void run(async () => {
        const result = await checkAccountDeletion(record); setStatus(result); setUnavailable(result === null);
        });
      }}><Text style={{ color: busy || waitSeconds > 0 ? '#999' : '#d9ff43' }}>{busy ? 'PLEASE WAIT…' : 'CHECK STATUS'}</Text></Pressable>
      {(status?.status === 'failed' || (status?.status === 'not_started' && status.failure_code !== 'CANCELLED')) && <>
        <TextInput accessibilityLabel="Current password for deletion retry" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Current password" placeholderTextColor="#aaa" style={{ color: 'white', padding: 12, borderColor: '#777', borderWidth: 1 }} />
        <Pressable accessibilityRole="button" disabled={busy || !password} onPress={() => void run(async () => {
          const value = password; setPassword(''); await retryAccountDeletion(record, value); setStatus(null);
        })}><Text style={{ color: '#ff9494' }}>REAUTHENTICATE AND RETRY DELETION</Text></Pressable>
      </>}
      {status?.status === 'not_started' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => cancelUnstartedDeletion(record))}><Text style={{ color: 'white' }}>CANCEL UNSTARTED REQUEST — KEEP MY DATA</Text></Pressable>}
      {status?.status === 'completed' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => finishLocalAccountDeletion(record))}><Text style={{ color: '#d9ff43' }}>FINISH LOCAL CLEANUP</Text></Pressable>}
      {unavailable && <>
        <Text style={{ color: 'white' }}>The receipt expired or is unavailable. This does not confirm server deletion. You may explicitly clear only this account’s saved data on this device.</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => setLocalConfirm(true)}><Text style={{ color: '#ff9494' }}>CLEAR THIS ACCOUNT’S LOCAL DATA</Text></Pressable>
        {localConfirm && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => finishLocalAccountDeletion(record))}><Text style={{ color: '#ff9494' }}>CONFIRM PERMANENT LOCAL CLEANUP</Text></Pressable>}
      </>}
    </>}
  </View>;
}
