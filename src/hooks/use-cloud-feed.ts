import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { currentUserId, getFeedPage, getPendingPosts, publishLocalPost, type FeedCursor, type FeedPost } from '../lib/cloudPosts';
import type { LocalPost } from '../lib/postOutbox';
import { postErrorMessage } from '../lib/postValidation';
import { supabase } from '../lib/supabase';
import { subscribeFollowChanges } from '../lib/follows';

export function useCloudFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [pending, setPending] = useState<LocalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const generation = useRef(0);
  const active = useRef(false);
  const busy = useRef(false);
  const retryBusy = useRef(false);
  const owner = useRef<string | null>(null);

  const load = useCallback(async (after: FeedCursor | null = null) => {
    if (!active.current || (after && busy.current)) return;
    const request = ++generation.current;
    const valid = () => active.current && request === generation.current;
    busy.current = true;
    if (after) setLoadingMore(true);
    else { setLoading(true); setLoadingMore(false); setPosts([]); setCursor(null); }
    setError(null);
    try {
      const userId = await currentUserId();
      if (!valid()) return;
      if (owner.current !== userId) { setPosts([]); setPending([]); setCursor(null); }
      owner.current = userId;
      // Pending snapshots remain accessible even if the cloud request fails.
      if (!after) {
        try {
          const local = await getPendingPosts(userId);
          if (valid()) setPending(local);
        } catch (localError) {
          if (valid()) setError(postErrorMessage(localError));
        }
      }
      const page = await getFeedPage(after);
      if (!valid()) return;
      setPosts(previous => after
        ? [...previous, ...page.posts.filter(post => !previous.some(existing => existing.id === post.id))]
        : page.posts);
      setCursor(page.nextCursor);
      setNotice(page.invalidCount ? 'Some posts could not be displayed.' : null);
    } catch (loadError) {
      if (valid()) setError(postErrorMessage(loadError));
    } finally {
      if (valid()) { busy.current = false; setLoading(false); setLoadingMore(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void load();
    // A mutation can finish after navigating back to HOME. Refresh that result too.
    const unsubscribeFollows = subscribeFollowChanges(changedOwner => {
      if (active.current && owner.current === changedOwner) void load();
    });
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? null;
      if (owner.current === nextOwner) return;
      owner.current = nextOwner;
      generation.current++;
      setPosts([]); setPending([]); setCursor(null); setError(null); setNotice(null);
      busy.current = false;
      // Defer client calls until the Supabase auth callback has released its lock.
      clearTimeout(refreshTimer);
      if (nextOwner) refreshTimer = setTimeout(() => { void load(); }, 0);
      else setLoading(false);
    });
    const timer = setInterval(() => { void load(); }, 50 * 60 * 1000);
    return () => {
      active.current = false;
      generation.current++;
      busy.current = false;
      clearTimeout(refreshTimer);
      clearInterval(timer);
      subscription.unsubscribe();
      unsubscribeFollows();
    };
  }, [load]));

  const retry = useCallback(async (entry: LocalPost) => {
    if (retryBusy.current || entry.userId !== owner.current) return;
    retryBusy.current = true;
    setRetrying(entry.post.id);
    try {
      await publishLocalPost(entry, 'feed-retry');
      if (active.current && owner.current === entry.userId) await load();
    } catch (publishError) {
      if (active.current && owner.current === entry.userId) {
        setError(postErrorMessage(publishError));
        setPending(previous => previous.map(item => item.post.id === entry.post.id
          ? { ...item, status: 'failed', error: postErrorMessage(publishError) } : item));
      }
    } finally {
      retryBusy.current = false;
      setRetrying(null);
    }
  }, [load]);

  return { posts, pending, loading, loadingMore, error, notice, retrying, retry,
    refresh: () => load(), loadMore: () => cursor ? load(cursor) : Promise.resolve(), hasMore: !!cursor };
}
