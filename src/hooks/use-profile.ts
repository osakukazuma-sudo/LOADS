import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getProfile, profileName } from '../lib/profiles';

export function useProfile(userId: string) {
  const [result, setResult] = useState<{ owner: string; version: number; name: string; username: string; error: string } | null>(null);
  const [version, setVersion] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    setResult(null);
    getProfile(userId).then(profile => {
      if (alive) setResult({ owner: userId, version, name: profileName(profile), username: profile.username, error: '' });
    }).catch(() => {
      if (alive) setResult({ owner: userId, version, name: '', username: '', error: 'Could not load your profile.' });
    });
    return () => { alive = false; };
  }, [userId, version]));
  const current = result?.owner === userId && result.version === version ? result : null;
  return { name: current?.name || '—', username: current?.username || '', error: current?.error || '', reload: () => setVersion(v => v + 1) };
}
