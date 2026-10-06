import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { SocialLayout, socialStyles as s } from '../components/social-layout';
import { useAccountOwner } from '../hooks/use-account-owner';
import { setWorkoutNotifications, workoutNotificationsEnabled } from '../lib/notifications';
import { registerPush } from '../lib/registerPush';
export default function SettingsScreen() {
  const owner = useAccountOwner(); const [enabled, setEnabled] = useState(false); const [busy, setBusy] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let alive = true; workoutNotificationsEnabled(owner).then(value => { if (alive) setEnabled(value); }).catch(() => { if (alive) setError('Could not load notification settings.'); }).finally(() => { if (alive) setBusy(false); }); return () => { alive = false; }; }, [owner]);
  async function change(value: boolean) {
    if (busy) return; setBusy(true); setError('');
    try { if (value) await registerPush(owner, true); await setWorkoutNotifications(owner, value); setEnabled(value); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  }
  return <SocialLayout title="SETTINGS"><View style={s.row}><Text style={s.text}>Workout notifications: {enabled ? 'ON' : 'OFF'}</Text><Switch accessibilityLabel="Workout notifications" disabled={busy || !!error} value={enabled} onValueChange={value => void change(value)} trackColor={{ true: '#D9FF43' }} /></View>
    <Text style={s.muted}>Get notified when people you follow finish a workout. Training partner tags can also notify you when device notifications are allowed.</Text>
    {!!error && <><Text style={s.error}>{error}</Text><Pressable onPress={() => { setError(''); void workoutNotificationsEnabled(owner).then(setEnabled).catch(() => setError('Could not load settings.')); }}><Text style={s.action}>RETRY</Text></Pressable></>}
  </SocialLayout>;
}
