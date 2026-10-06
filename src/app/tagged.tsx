import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { SocialLayout, socialStyles as s } from '../components/social-layout';
import { FeedPostCard } from '../components/feed-post-card';
import { getFeedPage, type FeedCursor, type FeedPost } from '../lib/cloudPosts';
export default function TaggedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]); const [next, setNext] = useState<FeedCursor | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const generation = useRef(0); const lock = useRef(false);
  const load = useCallback(async (cursor: FeedCursor | null = null) => {
    if (lock.current) return; lock.current = true; setBusy(true); const request = ++generation.current; setError('');
    try { const page = await getFeedPage(cursor, true); if (request === generation.current) { setPosts(old => cursor ? [...old, ...page.posts.filter(p => !old.some(o => o.id === p.id))] : page.posts); setNext(page.nextCursor); } }
    catch { if (request === generation.current) setError('Could not load tagged workouts.'); }
    finally { lock.current = false; if (request === generation.current) setBusy(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; lock.current = false; }; }, [load]));
  return <SocialLayout title="TAGGED WORKOUTS">{posts.map(post => <FeedPostCard key={post.id} post={post} onDeleted={() => void load()} />)}{busy && <Text style={s.muted}>LOADING…</Text>}{!busy && !error && !posts.length && <Text style={s.muted}>No tagged workouts yet.</Text>}{!!error && <Text style={s.error}>{error}</Text>}<Pressable disabled={busy} onPress={() => void load()}><Text style={s.action}>REFRESH</Text></Pressable>{next && <Pressable disabled={busy} onPress={() => void load(next)}><Text style={s.action}>LOAD MORE</Text></Pressable>}</SocialLayout>;
}
