import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getProfile, profileName } from '../lib/profiles';

export function useProfile(userId: string) {
  const [result, setResult] = useState<{ owner: string; version: number; name: string; error: string } | null>(null);
  const [version, setVersion] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    setResult(null);
    getProfile(userId).then(profile => {
      if (alive) setResult({ owner: userId, version, name: profileName(profile), error: '' });
    }).catch(() => {
      if (alive) setResult({ owner: userId, version, name: '', error: 'Could not load your profile.' });
    });
    return () => { alive = false; };
  }, [userId, version]));
  const current = result?.owner === userId && result.version === version ? result : null;
  return { name: current?.name || '—', error: current?.error || '', reload: () => setVersion(v => v + 1) };
}
