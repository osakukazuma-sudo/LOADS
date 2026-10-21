import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getVisiblePost, type FeedPost } from '../lib/cloudPosts';
import { subscribeFollowChanges } from '../lib/follows';

export function useVisiblePost(owner: string, id: string) {
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const active = useRef(false);
  const load = useCallback(async () => {
    if (!active.current) return;
    const request = ++generation.current;
    const valid = () => active.current && generation.current === request;
    setPost(null); setLoading(true); setError('');
    try { const value = await getVisiblePost(owner, id); if (valid()) setPost(value); }
    catch { if (valid()) setError('Could not load this workout. It may no longer be available.'); }
    finally { if (valid()) setLoading(false); }
  }, [owner, id]);
  useFocusEffect(useCallback(() => {
    active.current = true; void load();
    const follows = subscribeFollowChanges(changedOwner => { if (changedOwner === owner) void load(); });
    const state = AppState.addEventListener('change', value => {
      if (value === 'active') void load();
      else { generation.current++; setPost(null); }
    });
    return () => { active.current = false; generation.current++; follows(); state.remove(); };
  }, [owner, load]));
  return { post, loading, error, refresh: load };
}
