import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../lib/exerciseLibrary';
import { archiveCustomExercise, EQUIPMENT, saveCustomExercise, TRACKING_TYPES, type CustomExercise, type TrackingType } from '../lib/customExercises';
import { beginAccountOperation } from '../lib/accountActivity';

export function CustomExerciseForm({ owner, category, query, existing, onCancel, onSaved, onArchived, onBusyChange }: {
  owner: string; category: ExerciseCategory; query: string; existing?: CustomExercise;
  onBusyChange?: (value: boolean) => void;
  onCancel: () => void; onSaved: (item: CustomExercise) => Promise<void>; onArchived: () => Promise<void>;
}) {
  const [key] = useState(() => existing?.exerciseKey ?? `custom:${randomUUID()}`);
  const [name, setName] = useState(existing?.name ?? query);
  const [group, setGroup] = useState(existing?.category ?? category);
  const [equipment, setEquipment] = useState(existing?.equipment ?? 'other');
  const [tracking, setTracking] = useState<TrackingType>(existing?.trackingType ?? 'weight_reps');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function run(archive = false) {
    if (lock.current) return;
    lock.current = true; onBusyChange?.(true); setBusy(true); setError('');
    let release: (() => void) | undefined;
    try {
      release = beginAccountOperation({ name: 'custom-exercise-write', source: 'CustomExerciseForm.save' });
      if (archive && existing) {
        await archiveCustomExercise(owner, key, !existing.archivedAt);
        if (alive.current) await onArchived();
      } else {
        const saved = await saveCustomExercise(owner, { exerciseKey: key, name, category: group, equipment, trackingType: tracking });
        if (alive.current) await onSaved(saved);
      }
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : 'Could not save exercise. Please retry.');
    } finally { release?.(); lock.current = false; onBusyChange?.(false); if (alive.current) setBusy(false); }
  }
  return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.eyebrow}>YOUR MOVEMENT LIBRARY</Text>
    <Text style={s.title}>{existing ? 'EDIT EXERCISE' : 'CREATE EXERCISE'}</Text>
    <Text style={s.label}>EXERCISE NAME</Text>
    <TextInput accessibilityLabel="Exercise name" style={s.input} value={name} onChangeText={setName} editable={!busy} maxLength={100} placeholder="EXERCISE NAME" placeholderTextColor="#777" />
    <Text style={s.label}>MUSCLE GROUP</Text>
    <View style={s.choices}>{EXERCISE_CATEGORIES.filter(item => item !== 'cardio').map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: group === item }} disabled={busy} style={[s.choice, group === item && s.selected]} onPress={() => setGroup(item)}><Text style={s.text}>{item.toUpperCase()}</Text></Pressable>)}</View>
    {group === 'cardio' && <Text style={s.muted}>Choose a muscle group for strength tracking. Cardio exercises remain in the existing list.</Text>}
    <Text style={s.label}>EQUIPMENT</Text>
    <View style={s.choices}>{EQUIPMENT.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: equipment === value }} disabled={busy} style={[s.choice, equipment === value && s.selected]} onPress={() => setEquipment(value)}><Text style={s.text}>{label}</Text></Pressable>)}</View>
    <Text style={s.label}>TRACKING TYPE</Text>
    {TRACKING_TYPES.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: tracking === value }} disabled={busy || !!existing} style={[s.choice, tracking === value && s.selected]} onPress={() => setTracking(value)}><Text style={s.text}>{label}</Text></Pressable>)}
    <Text style={s.muted}>{tracking === 'bodyweight' ? 'Reps only. Bodyweight is excluded from kg volume.' : tracking === 'weighted' ? 'Record added weight (kg) and reps.' : tracking === 'assisted' ? 'Record assistance (kg) and reps. Less assistance is stronger; excluded from kg volume.' : 'Record weight (kg) and reps.'}</Text>
    {existing && <Text style={s.muted}>Tracking type stays fixed to protect your records. Past workouts keep their original names and data.</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={busy || group === 'cardio'} style={s.save} onPress={() => void run()}><Text style={s.saveText}>{busy ? 'SAVING…' : existing ? 'SAVE CHANGES' : 'SAVE & ADD TO WORKOUT'}</Text></Pressable>
    {existing && <Pressable accessibilityRole="button" disabled={busy} style={s.choice} onPress={() => void run(true)}><Text style={s.text}>{existing.archivedAt ? 'RESTORE EXERCISE' : 'ARCHIVE EXERCISE'}</Text></Pressable>}
    <Pressable accessibilityRole="button" disabled={busy} style={s.choice} onPress={onCancel}><Text style={s.text}>CANCEL</Text></Pressable>
  </ScrollView>;
}
const s = StyleSheet.create({
  content: { padding: 24, gap: 12 }, eyebrow: { color: '#999', fontSize: 11, letterSpacing: 1 }, title: { color: '#F5F5F2', fontSize: 26, fontWeight: '900' },
  label: { color: '#999', fontSize: 12, fontWeight: '800', marginTop: 8 }, text: { color: '#EEE', fontSize: 13, fontWeight: '700' }, muted: { color: '#999', fontSize: 12, lineHeight: 18 },
  input: { color: '#EEE', borderWidth: 1, borderColor: '#555', borderRadius: 8, padding: 14 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#444', borderRadius: 8, padding: 14, minHeight: 48, justifyContent: 'center' }, selected: { borderColor: '#D9FF43', backgroundColor: '#31390E' },
  save: { backgroundColor: '#D9FF43', padding: 16, borderRadius: 8, alignItems: 'center' }, saveText: { color: '#080808', fontWeight: '900' }, error: { color: '#ff9494', lineHeight: 19 },
});
