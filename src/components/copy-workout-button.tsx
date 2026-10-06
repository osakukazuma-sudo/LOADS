import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { WorkoutSession } from '../lib/workoutStorage';
import { workoutToText } from '../lib/workoutText';

export function CopyWorkoutButton({ workout }: { workout: WorkoutSession }) {
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    if (busy.current) return;
    busy.current = true;
    setCopying(true);
    setMessage('');
    if (timer.current !== null) clearTimeout(timer.current);
    try {
      const text = workoutToText(workout);
      if (!text) {
        setMessage('No recorded exercises to copy.');
        return;
      }
      const copied = await Clipboard.setStringAsync(text, { inputFormat: Clipboard.StringFormat.PLAIN_TEXT });
      if (!mounted.current) return;
      if (!copied) throw new Error('Clipboard write failed.');
      setMessage('Copied to clipboard.');
      timer.current = setTimeout(() => {
        if (mounted.current) setMessage('');
        timer.current = null;
      }, 2500);
    } catch {
      if (mounted.current) setMessage('Could not copy. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setCopying(false);
    }
  };

  return <View style={styles.container}>
    <Pressable accessibilityRole="button" disabled={copying} onPress={copy}
      style={[styles.button, copying && styles.disabled]}>
      <Text style={styles.label}>{copying ? 'COPYING...' : 'COPY WORKOUT'}</Text>
    </Pressable>
    {!!message && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  button: { borderWidth: 1, borderColor: '#303030', backgroundColor: '#191919', borderRadius: 8, paddingVertical: 14, alignItems: 'center', minHeight: 44 },
  disabled: { opacity: 0.5 },
  label: { color: '#D9FF43', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  message: { color: '#F5F5F2', fontSize: 12, lineHeight: 18, marginTop: 8 },
});
