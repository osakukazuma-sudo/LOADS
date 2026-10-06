import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAccountOwner } from '../hooks/use-account-owner';
import { myFollowCounts, type FollowCounts } from '../lib/follows';
import { socialStyles as s } from './social-layout';

export function MyConnections() {
  const owner = useAccountOwner(); const router = useRouter();
  const [counts, setCounts] = useState<FollowCounts | null>(null);
  const [error, setError] = useState(false); const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current; setCounts(null); setError(false);
    try { const value = await myFollowCounts(owner); if (request === generation.current) setCounts(value); }
    catch { if (request === generation.current) setError(true); }
  }, [owner]);
  useFocusEffect(useCallback(() => {
    void load(); return () => { generation.current++; };
  }, [load]));
  return <View>
    <Text style={s.muted}>YOUR CONNECTIONS · ONLY VISIBLE TO YOU</Text>
    {error && <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={s.error}>Could not load connections. Tap to retry.</Text></Pressable>}
    <View style={{ flexDirection: 'row', gap: 24 }}>
      {(['followers', 'following'] as const).map(kind => <Pressable key={kind} accessibilityRole="button" onPress={() => router.push({ pathname: '/connections', params: { kind } })}>
        <Text style={s.action}>{counts ? counts[kind] : '—'} {kind === 'followers' ? 'Followers' : 'Following'}</Text>
      </Pressable>)}
    </View>
    <Pressable accessibilityRole="button" onPress={() => router.push('/people')}><Text style={s.action}>FIND BY USERNAME</Text></Pressable>
  </View>;
}
