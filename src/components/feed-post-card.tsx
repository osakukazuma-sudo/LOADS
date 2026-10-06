import { setResultLabel } from '../lib/setResult';
import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountOwner } from '../hooks/use-account-owner';
import type { FeedPost } from '../lib/cloudPosts';
import { DeletePostControl } from './delete-post-control';
import { CardioSummaryCard } from './cardio-summary-card';
import { cardioTotals } from '../lib/cardio';

export const FeedPostCard = memo(function FeedPostCard({ post, onDeleted }: { post: FeedPost; onDeleted: () => void }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const router = useRouter(); const owner = useAccountOwner();
  const hours = Math.floor(post.durationSeconds / 3600);
  const minutes = Math.floor((post.durationSeconds % 3600) / 60);
  const time = hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  const date = new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const cardioStats = cardioTotals(post.exercises);
  const stats = cardioStats.onlyCardio ?
    [['TIME', time], ['CARDIO', `${cardioStats.durationMinutes} min`], ['DISTANCE', cardioStats.distanceLabel]] :
    [['TIME', time], ['SETS', String(post.totalSets)], ['VOLUME', `${post.totalVolume.toLocaleString()}kg`]];
  return (
    <View style={styles.card}>
      <DeletePostControl post={post} onDeleted={onDeleted} />
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{Array.from(post.authorName)[0]?.toUpperCase()}</Text></View>
        <Pressable accessibilityRole="button" style={styles.author} onPress={() => post.userId === owner ? router.push('/profile') : router.push({ pathname: '/athlete', params: { id: post.userId } })}>
          <Text style={styles.name}>{post.authorName}</Text>
          <Text style={styles.meta}>{post.username ? `@${post.username} · ` : ''}{date}</Text>
        </Pressable>
        {post.prCount > 0 && <View style={styles.prCount}>
          <Text style={styles.prNumber}>{post.prCount}</Text>
          <Text style={styles.prLabel}>{post.prCount === 1 ? 'PR' : 'PRS'}</Text>
        </View>}
      </View>
      {post.photoUri && failedUri !== post.photoUri ? <Image
        source={{ uri: post.photoUri }} style={styles.photo}
        accessibilityLabel={`Workout photo by ${post.authorName}`}
        onError={() => setFailedUri(post.photoUri)}
      /> : <View style={styles.noPhoto}>
        <Text style={styles.meta}>{post.photoUnavailable || post.photoUri ? 'PHOTO UNAVAILABLE — REFRESH TO RETRY' : 'WORK LOG'}</Text>
      </View>}
      <View style={styles.body}>
        <View style={styles.stats}>
          {stats.map(([label, value]) =>
            <View key={label} style={styles.stat}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>
          )}
        </View>
        {post.exercises.map(exercise => exercise.type === 'cardio' && exercise.cardio ?
          <CardioSummaryCard key={exercise.id} name={exercise.name} cardio={exercise.cardio} memo={exercise.note} /> :
          <View key={exercise.id} style={styles.exercise}>
          <View style={styles.exerciseHeader}>
            <View style={styles.author}><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.label}>{exercise.focus}</Text></View>
            <Text style={styles.best}>{exercise.bestWeight > 0 ? `${exercise.bestWeight}kg × ${exercise.bestReps}` : '—'}</Text>
          </View>
          <Text style={styles.meta}>{exercise.sets} SETS · {exercise.volume.toLocaleString()}kg</Text>
          {exercise.setResults?.filter(set => setResultLabel(set)).map((set, index) => <Text key={index} style={styles.meta}>{set.weight}kg x {set.reps} / {setResultLabel(set)}</Text>)}
          {exercise.prTypes.length > 0 && <View style={styles.badges}>{exercise.prTypes.map(pr =>
            <View key={pr} style={styles.badge}><Text style={styles.badgeText}>{pr}</Text></View>
          )}</View>}
        </View>)}
        {!!post.trainingPartners?.length && <Text style={styles.meta}>with {post.trainingPartners.map(person => `@${person.username}`).join(', ')}</Text>}
        {!!post.caption.trim() && <Text style={styles.caption}>{post.caption}</Text>}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: '#111', borderWidth: 1, borderColor: '#242424', borderRadius: 12, marginBottom: 18, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 11 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D9FF43', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#080808', fontSize: 16, fontWeight: '900' },
  author: { flex: 1 },
  name: { color: '#F5F5F2', fontSize: 13, fontWeight: '900' },
  meta: { color: '#999', fontSize: 10, lineHeight: 16, marginTop: 4 },
  prCount: { backgroundColor: '#D9FF43', borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  prNumber: { color: '#080808', fontSize: 20, fontWeight: '900' },
  prLabel: { color: '#31390E', fontSize: 8, fontWeight: '900' },
  photo: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#1A1A1A' },
  noPhoto: { padding: 24, alignItems: 'center', backgroundColor: '#151515' },
  body: { padding: 14 },
  stats: { flexDirection: 'row', paddingBottom: 16, marginBottom: 4, borderBottomWidth: 1, borderColor: '#262626' },
  stat: { flex: 1, alignItems: 'center', gap: 5 },
  label: { color: '#888', fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  value: { color: '#F5F5F2', fontSize: 13, fontWeight: '900' },
  exercise: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#242424' },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  exerciseName: { color: '#EEE', fontSize: 13, fontWeight: '900' },
  best: { color: '#D9FF43', fontSize: 12, fontWeight: '900' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { backgroundColor: '#D9FF43', paddingVertical: 4, paddingHorizontal: 7, borderRadius: 4 },
  badgeText: { color: '#080808', fontSize: 8, fontWeight: '900' },
  caption: { color: '#DDD', lineHeight: 20, fontSize: 13, marginTop: 14 },
});
