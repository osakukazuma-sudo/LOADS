import { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { socialStyles as s } from './social-layout';
import { setWorkoutNotifications, workoutNotificationsEnabled } from '../lib/notifications';
import { reactionNotificationsEnabled, setReactionNotifications } from '../lib/reactionNotifications';
import { registerPush } from '../lib/registerPush';

const preferences = {
  workout: { label: 'Workout notifications', read: workoutNotificationsEnabled, write: setWorkoutNotifications },
  reaction: { label: 'Workout reaction notifications', read: reactionNotificationsEnabled, write: setReactionNotifications },
};
export function NotificationPreferenceControl({ owner, kind }: { owner: string; kind: keyof typeof preferences }) {
  const preference = preferences[kind];
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const alive = useRef(false);
  const saving = useRef(false);
  useEffect(() => {
    let current = true; alive.current = true;
    void preference.read(owner).then(value => { if (current) setEnabled(value); })
      .catch(() => { if (current) setError('Could not load notification settings.'); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; alive.current = false; };
  }, [owner, preference, reload]);
  async function change(value: boolean) {
    if (busy || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      if (value) await registerPush(owner, true);
      await preference.write(owner, value);
      if (alive.current) setEnabled(value);
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : 'Could not save settings.');
    } finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  return <View style={s.row}>
    <Text style={s.text}>{preference.label}: {enabled ? 'ON' : 'OFF'}</Text>
    <Switch accessibilityLabel={preference.label} disabled={busy || !!error} value={enabled}
      onValueChange={value => void change(value)} trackColor={{ true: '#D9FF43' }} />
    {!!error && <>
      <Text accessibilityRole="alert" style={s.error}>{error}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setError(''); setBusy(true); setReload(value => value + 1); }}>
        <Text style={s.action}>RETRY</Text>
      </Pressable>
    </>}
  </View>;
}
