import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useAccountOwner } from '../hooks/use-account-owner';
import { myConnections, type Athlete, type ConnectionKind } from '../lib/follows';
import { AthleteRow, SocialLayout, socialStyles as s } from '../components/social-layout';

export default function ConnectionsScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>(); const owner = useAccountOwner();
  const direction = kind === 'followers' ? 'followers' : 'following';
  return <Connections key={`${owner}/${direction}`} owner={owner} kind={direction} />;
}
function Connections({ owner, kind }: { owner: string; kind: ConnectionKind }) {
  const [people, setPeople] = useState<Athlete[]>([]); const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const generation = useRef(0); const loading = useRef(false);
  const load = useCallback(async (after: string | null = null) => {
    if (loading.current) return;
    loading.current = true; const request = ++generation.current; setBusy(true); setError('');
    if (!after) { setPeople([]); setNext(null); }
    try { const page = await myConnections(owner, kind, after); if (generation.current === request) {
      setPeople(previous => after ? [...previous, ...page.people.filter(p => !previous.some(old => old.id === p.id))] : page.people); setNext(page.next);
    } } catch { if (generation.current === request) setError('Could not load your connections.'); }
    finally { if (generation.current === request) { loading.current = false; setBusy(false); } }
  }, [owner, kind]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; loading.current = false; }; }, [load]));
  return <SocialLayout title={kind === 'followers' ? 'YOUR FOLLOWERS' : 'YOUR FOLLOWING'}>
    <Text style={s.muted}>Only you can see this list.</Text>
    {people.map(person => <AthleteRow key={person.id} athlete={person} />)}
    {!busy && !error && !people.length && <Text style={s.muted}>No connections yet.</Text>}
    {busy && <Text style={s.muted}>LOADING…</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void load()}><Text style={s.action}>REFRESH</Text></Pressable>
    {next && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void load(next)}><Text style={s.action}>LOAD MORE</Text></Pressable>}
  </SocialLayout>;
}
