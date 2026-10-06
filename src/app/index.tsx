import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FeedPostCard } from '../components/feed-post-card';
import { useCloudFeed } from '../hooks/use-cloud-feed';

export default function HomeScreen() {
  const router = useRouter();
  const feed = useCloudFeed();
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View><Text style={styles.logo}>LOADS</Text><Text style={styles.tagline}>NO FLEX. JUST WORK.</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Start workout" style={styles.add} onPress={() => router.push('/workout')}>
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>
      <FlatList
        data={feed.posts}
        keyExtractor={post => post.id}
        renderItem={({ item }) => <FeedPostCard post={item} onDeleted={feed.refresh} />}
        contentContainerStyle={styles.content}
        refreshing={feed.loading}
        onRefresh={feed.refresh}
        initialNumToRender={4}
        windowSize={7}
        ListHeaderComponent={<View>
          <Text style={styles.muted}>YOUR WORK + FOLLOWING</Text>
          <Pressable accessibilityRole="button" onPress={feed.refresh} disabled={feed.loading} style={styles.refresh}>
            <Text style={styles.action}>{feed.loading ? 'REFRESHING...' : 'REFRESH FEED'}</Text>
          </Pressable>
          {feed.error && <View style={styles.message}>
            <Text accessibilityRole="alert" style={styles.messageText}>{feed.error}</Text>
            <Pressable accessibilityRole="button" onPress={feed.refresh}><Text style={styles.action}>RETRY FEED</Text></Pressable>
          </View>}
          {feed.notice && <Text style={styles.muted}>{feed.notice}</Text>}
          {feed.pending.map(entry => <View key={entry.post.id} style={styles.message}>
            <Text style={styles.label}>{entry.status === 'failed' ? 'POST NOT SENT' : 'SAVED — NOT YET PUBLISHED'}</Text>
            <Text style={styles.messageText}>{entry.post.caption || 'Workout'} · {entry.post.totalSets} sets</Text>
            {entry.error && <Text style={styles.muted}>{entry.error}</Text>}
            <Pressable accessibilityRole="button" disabled={!!feed.retrying} onPress={() => feed.retry(entry)}>
              <Text style={styles.action}>{feed.retrying === entry.post.id ? 'SENDING...' : 'RETRY POST'}</Text>
            </Pressable>
          </View>)}
        </View>}
        ListEmptyComponent={!feed.loading && !feed.error ? <View style={styles.empty}>
          <Text style={styles.logo}>NO WORK POSTED.</Text>
          <Text style={styles.muted}>Finish a workout and put the work on the board.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/workout')}><Text style={styles.action}>START WORKOUT</Text></Pressable>
        </View> : null}
        ListFooterComponent={feed.hasMore ? <Pressable accessibilityRole="button" disabled={feed.loadingMore || feed.loading} onPress={feed.loadMore} style={styles.refresh}>
          <Text style={styles.action}>{feed.loadingMore ? 'LOADING...' : 'LOAD MORE'}</Text>
        </Pressable> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: '#F5F5F2', fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  tagline: { color: '#777', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  add: { backgroundColor: '#D9FF43', width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#080808', fontSize: 30, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  refresh: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  message: { backgroundColor: '#161912', borderWidth: 1, borderColor: '#465027', borderRadius: 10, padding: 14, marginBottom: 14, gap: 8 },
  messageText: { color: '#EEE', fontSize: 13, lineHeight: 20 },
  label: { color: '#D9FF43', fontSize: 11, fontWeight: '900' },
  action: { color: '#D9FF43', fontSize: 12, fontWeight: '900', paddingVertical: 12 },
  muted: { color: '#999', fontSize: 12, lineHeight: 18, marginVertical: 6 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
});
