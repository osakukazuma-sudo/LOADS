import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLinkingURL } from 'expo-linking';
import { completeAuthRedirect } from '../../lib/authRedirect';

export default function AuthCallback() {
  const url = useLinkingURL();
  return <CallbackResult key={url ?? 'missing'} url={url} />;
}

function CallbackResult({ url }: { url: string | null }) {
  const router = useRouter();
  const [error, setError] = useState(url ? '' : 'No confirmation link received. Please use LOGIN.');
  useEffect(() => {
    let alive = true;
    if (!url) return;
    void completeAuthRedirect(url).then(() => {
      if (alive) router.replace('/');
    }).catch((reason: unknown) => {
      if (alive) setError(reason instanceof Error ? reason.message : 'Could not confirm sign-in. Please use LOGIN.');
    });
    return () => { alive = false; };
  }, [url, router]);
  return <View style={{ flex: 1, backgroundColor: '#080808', justifyContent: 'center', padding: 28, gap: 24 }}>
    <Text style={{ color: 'white', fontSize: 24 }}>EMAIL CONFIRMATION</Text>
    <Text accessibilityRole={error ? 'alert' : undefined} style={{ color: 'white' }}>
      {error || 'Completing sign-in…'}
    </Text>
    {!!error && <Pressable accessibilityRole="button" onPress={() => router.replace('/login')}>
      <Text style={{ color: '#D9FF43' }}>LOGIN / HOME</Text>
    </Pressable>}
  </View>;
}
