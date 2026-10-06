import { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import type { WorkoutSet } from '../lib/workoutStorage';
import { setResultLabel } from '../lib/setResult';
export function SetOptions({ set, onChange }: { set: WorkoutSet; onChange: (patch: Partial<WorkoutSet>) => void }) {
  const [open, setOpen] = useState(false);
  return <View><Pressable accessibilityRole="button" onPress={() => setOpen(!open)}><Text style={styles.label}>{open ? '− SET OPTIONS' : '+ SET OPTIONS'}{setResultLabel(set) ? ` · ${setResultLabel(set)}` : ''}</Text></Pressable>
    {open && <View style={styles.row}><Text style={styles.label}>TARGET REPS</Text><TextInput style={styles.input} keyboardType="number-pad" accessibilityLabel="Target reps" placeholder="Optional" placeholderTextColor="#666" value={set.targetReps ?? ''} onChangeText={value => { const target = value.replace(/[^0-9]/g, '').slice(0, 4); onChange({ targetReps: Number(target) > 0 ? target : undefined }); }} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.status === 'failed' }} onPress={() => onChange({ status: set.status === 'failed' ? undefined : 'failed' })}><Text style={styles.label}>{set.status === 'failed' ? '✓ FAILED' : 'MARK FAILED'}</Text></Pressable></View>}
  </View>;
}
const styles = StyleSheet.create({ label: { color: '#D9FF43', fontSize: 10, fontWeight: '800', paddingVertical: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }, input: { color: '#EEE', backgroundColor: '#1A1A1A', borderRadius: 6, padding: 10, width: 80 } });
