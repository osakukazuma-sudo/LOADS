import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { SocialLayout, socialStyles as s } from '../components/social-layout';
import { FeedPostCard } from '../components/feed-post-card';
import { useAccountOwner } from '../hooks/use-account-owner';
import { useVisiblePost } from '../hooks/use-visible-post';

export default function WorkoutPostScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const owner = useAccountOwner();
  const postId = typeof id === 'string' ? id : '';
  return <WorkoutPost key={`${owner}/${postId}`} owner={owner} id={postId} />;
}
function WorkoutPost({ owner, id }: { owner: string; id: string }) {
  const { post, loading, error, refresh } = useVisiblePost(owner, id);
  return <SocialLayout title="WORKOUT">
    {post && <FeedPostCard post={post} onDeleted={() => void refresh()} />}
    {loading && <Text style={s.muted}>LOADING…</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!loading && !error && !post && <Text style={s.muted}>This workout is no longer available.</Text>}
    <Pressable accessibilityRole="button" disabled={loading} onPress={() => void refresh()}><Text style={s.action}>REFRESH</Text></Pressable>
  </SocialLayout>;
}
