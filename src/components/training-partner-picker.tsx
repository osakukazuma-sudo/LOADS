import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { myConnections, type Athlete } from '../lib/follows';
import { socialStyles as s } from './social-layout';
export type TrainingPartner = { id: string; username: string };
export function TrainingPartnerPicker({ owner, selected, onChange, disabled }: { owner: string; selected: TrainingPartner[]; onChange: (people: TrainingPartner[]) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false); const [people, setPeople] = useState<Athlete[]>([]); const [next, setNext] = useState<string | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const generation = useRef(0); const lock = useRef(false);
  useEffect(() => () => { generation.current++; }, [owner]);
  async function load(after: string | null = null) {
    if (lock.current) return; lock.current = true; const request = ++generation.current; setBusy(true); setError('');
    try { const page = await myConnections(owner, 'following', after); if (request === generation.current) { setPeople(previous => after ? [...previous, ...page.people.filter(person => !previous.some(p => p.id === person.id))] : page.people); setNext(page.next); } }
    catch { if (request === generation.current) setError('Could not load following.'); }
    finally { lock.current = false; if (request === generation.current) setBusy(false); }
  }
  return <View style={{ marginVertical: 14 }}><Pressable disabled={disabled} onPress={() => { setOpen(true); void load(); }}><Text style={s.action}>TAG TRAINING PARTNER</Text></Pressable>
    {!!selected.length && <Text style={s.muted}>with {selected.map(p => `@${p.username}`).join(', ')}</Text>}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><SafeAreaView style={s.page}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Pressable onPress={() => setOpen(false)}><Text style={s.action}>DONE · {selected.length}/3</Text></Pressable><Text style={s.muted}>Choose people you trained with from your following.</Text>
      {people.map(person => { const checked = selected.some(p => p.id === person.id); return <Pressable key={person.id} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: disabled || (!checked && selected.length >= 3) }} disabled={disabled || (!checked && selected.length >= 3)} style={s.row} onPress={() => onChange(checked ? selected.filter(p => p.id !== person.id) : [...selected, { id: person.id, username: person.username }])}><Text style={s.text}>{checked ? '✓ ' : ''}@{person.username}</Text></Pressable>; })}
      {busy && <Text style={s.muted}>LOADING…</Text>}{!!error && <><Text style={s.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={s.action}>RETRY</Text></Pressable></>}
      {!busy && !error && !people.length && <Text style={s.muted}>Follow someone to tag a training partner.</Text>}
      {next && <Pressable disabled={busy} onPress={() => void load(next)}><Text style={s.action}>LOAD MORE</Text></Pressable>}
    </ScrollView></SafeAreaView></Modal></View>;
}
