import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { SignOutBlockedDiagnostics } from '../lib/accountActivity';

export function AccountActivityDiagnostics({ diagnostics }: { diagnostics: SignOutBlockedDiagnostics | null }) {
  const [message, setMessage] = useState('');
  const [copying, setCopying] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  if (process.env.EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS !== 'true') return null;

  const copy = async () => {
    if (!diagnostics || busy.current) return;
    busy.current = true; setCopying(true); setMessage('');
    try {
      const copied = await Clipboard.setStringAsync(JSON.stringify(diagnostics, null, 2), { inputFormat: Clipboard.StringFormat.PLAIN_TEXT });
      if (!copied) throw new Error('Clipboard write failed.');
      if (mounted.current) setMessage('Diagnostics copied.');
    } catch {
      if (mounted.current) setMessage('Could not copy. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setCopying(false);
    }
  };
  return <View style={styles.panel}>
    <Text style={styles.title}>ACCOUNT ACTIVITY DIAGNOSTICS</Text>
    {diagnostics ? <>
      <Text style={styles.text}>signout-blocked · {diagnostics.diagnosticVersion}</Text>
      <Text style={styles.text}>Captured (UTC): {diagnostics.capturedAt}</Text>
      <Text style={styles.text}>Active operations: {diagnostics.operationCount} · Tracked: {diagnostics.trackedOperationCount}</Text>
      <Text style={styles.text}>signingOut: {String(diagnostics.signingOut)} · Holder: {diagnostics.exclusiveOperation?.name ?? 'none'}</Text>
      <Text style={styles.text}>Snapshot at rejection. Elapsed time is fixed at capture.</Text>
      {[...diagnostics.activeOperations, ...(diagnostics.exclusiveOperation ? [diagnostics.exclusiveOperation] : [])].map(operation => <View key={operation.id} style={styles.operation}>
        <Text style={styles.text}>{operation.name} · ID {operation.id} · {operation.mode}</Text>
        <Text style={styles.text}>Started (UTC): {operation.startedAt}</Text>
        <Text style={styles.text}>Elapsed: {operation.elapsedMs} ms</Text>
        <Text style={styles.text}>Source: {operation.source}</Text>
        <Text style={styles.text}>Phase: {operation.phase}</Text>
        <Text style={styles.text}>Phase started (UTC): {operation.phaseStartedAt}</Text>
        <Text style={styles.text}>End called: {String(operation.endCalled)}</Text>
      </View>)}
      <Pressable accessibilityRole="button" accessibilityLabel="COPY DIAGNOSTICS" disabled={copying} onPress={copy} style={styles.button}>
        <Text style={styles.title}>{copying ? 'COPYING…' : 'COPY DIAGNOSTICS'}</Text>
      </Pressable>
      {!!message && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
    </> : <Text style={styles.text}>Run CONFIRM LOGOUT to capture a blocked attempt.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { marginTop: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: '#595959', borderRadius: 8, backgroundColor: '#191919' },
  operation: { gap: 4, paddingVertical: 10, borderTopWidth: 1, borderColor: '#595959' },
  title: { color: '#D9FF43', fontSize: 12, fontWeight: '800' },
  text: { color: '#F5F5F2', fontSize: 12, lineHeight: 18 },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D9FF43', borderRadius: 6, marginTop: 6 },
});
