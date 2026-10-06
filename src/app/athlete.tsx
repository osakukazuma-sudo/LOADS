import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useAccountOwner } from '../hooks/use-account-owner';
import { athleteWithFollow, setFollowing } from '../lib/follows';
import { SocialLayout, socialStyles as s } from '../components/social-layout';

export default function AthleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const owner = useAccountOwner();
  return <AthleteProfile key={`${owner}/${id}`} owner={owner} target={typeof id === 'string' ? id : ''} />;
}
function AthleteProfile({ owner, target }: { owner: string; target: string }) {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof athleteWithFollow>> | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const generation = useRef(0); const saving = useRef(false);
  const load = useCallback(async () => {
    const request = ++generation.current; setData(null); setError('');
    if (target === owner) { router.replace('/profile'); return; }
    if (!/^[a-f0-9-]{36}$/i.test(target)) { setError('Profile unavailable.'); return; }
    try { const value = await athleteWithFollow(owner, target); if (request === generation.current) setData(value); }
    catch { if (request === generation.current) setError('Could not load this profile.'); }
  }, [owner, target, router]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  return <SocialLayout title="ATHLETE">
    {data && <>
      <Text style={s.text}>{data.profile.display_name?.trim() || data.profile.username}</Text>
      <Text style={s.muted}>@{data.profile.username}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={async () => {
        if (saving.current) return;
        saving.current = true; const request = generation.current;
        setBusy(true); setError('');
        try { await setFollowing(owner, target, !data.following); if (request === generation.current) await load(); }
        catch { if (request === generation.current) setError('Could not update follow. Check your connection and refresh before retrying.'); }
        finally { saving.current = false; setBusy(false); }
      }}><Text style={s.action}>{busy ? 'SAVING…' : data.following ? 'FOLLOWING · UNFOLLOW' : 'FOLLOW'}</Text></Pressable>
    </>}
    {!data && !error && <Text style={s.muted}>LOADING…</Text>}
    {!!error && <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => void load()}><Text style={s.action}>REFRESH PROFILE</Text></Pressable></>}
  </SocialLayout>;
}
