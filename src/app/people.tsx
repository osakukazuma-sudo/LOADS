import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { useAccountOwner } from '../hooks/use-account-owner';
import { findAthlete, type Athlete } from '../lib/follows';
import { AthleteRow, SocialLayout, socialStyles as s } from '../components/social-layout';

export default function PeopleScreen() {
  const owner = useAccountOwner();
  return <Search key={owner} owner={owner} />;
}
function Search({ owner }: { owner: string }) {
  const [input, setInput] = useState(''); const [person, setPerson] = useState<Athlete | null>(null);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  return <SocialLayout title="FIND BY USERNAME">
    <Text style={s.muted}>Enter the exact username of someone you know. Following is optional; your workout log works on its own.</Text>
    <TextInput accessibilityLabel="Exact username" style={s.input} placeholder="username" placeholderTextColor="#999" autoCapitalize="none" autoCorrect={false} value={input} onChangeText={value => {
      generation.current++; setInput(value); setPerson(null); setMessage(''); setBusy(false);
    }} />
    <Pressable accessibilityRole="button" disabled={busy || !input.trim()} onPress={async () => {
      const request = ++generation.current; setBusy(true); setMessage(''); setPerson(null);
      try { const result = await findAthlete(owner, input); if (generation.current === request) { setPerson(result); if (!result) setMessage('No matching username.'); } }
      catch { if (generation.current === request) setMessage('Could not search. Check the complete username and your connection.'); }
      finally { if (generation.current === request) setBusy(false); }
    }}><Text style={s.action}>{busy ? 'SEARCHING…' : 'SEARCH'}</Text></Pressable>
    {!!message && <Text style={s.muted}>{message}</Text>}
    {person && <AthleteRow athlete={person} />}
  </SocialLayout>;
}
