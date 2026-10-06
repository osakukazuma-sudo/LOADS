import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAccountOwner } from '../hooks/use-account-owner';
import type { FeedPost } from '../lib/cloudPosts';
import { deleteOwnPost } from '../lib/postDeletion';

export function DeletePostControl({ post, onDeleted }: { post: FeedPost; onDeleted: () => void }) {
  const owner = useAccountOwner();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  if (owner !== post.userId) return null;
  async function remove() {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try { await deleteOwnPost(post); onDeleted(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete post.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <View style={{ padding: 14, gap: 8 }}>
    {confirm && <Text style={{ color: '#ddd' }}>Permanently delete this shared post and photo? Your saved workout history stays on this device.</Text>}
    {error ? <Text accessibilityRole="alert" style={{ color: '#ff8a8a' }}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => confirm ? void remove() : setConfirm(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: '#ff8a8a', fontWeight: '800' }}>{busy ? 'DELETING...' : confirm ? 'DELETE PERMANENTLY' : 'DELETE POST'}</Text>
    </Pressable>
    {confirm && !busy && <Pressable accessibilityRole="button" onPress={() => { setConfirm(false); setError(''); }} style={{ minHeight: 44 }}><Text style={{ color: '#ddd' }}>CANCEL</Text></Pressable>}
  </View>;
}
