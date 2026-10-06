import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { registerPush } from '../lib/registerPush';
import { initializeCompletionSync, syncWorkoutCompletions } from '../lib/notifications';
if (Platform.OS !== 'web') Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
export function NotificationGate({ owner }: { owner: string }) {
  useEffect(() => {
    let alive = true;
    const refresh = () => { void registerPush(owner, false).catch(() => {}); void syncWorkoutCompletions(owner).catch(() => {}); };
    void initializeCompletionSync(owner).then(() => { if (alive) refresh(); }).catch(() => {});
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    const interval = setInterval(() => { if (AppState.currentState === 'active') void syncWorkoutCompletions(owner).catch(() => {}); }, 60000);
    if (Platform.OS === 'web') return () => { alive = false; state.remove(); clearInterval(interval); };
    const redirect = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (!alive || !data || data.recipientId !== owner) return;
      if (data.kind === 'partner') router.push('/tagged');
      else if (data.kind === 'workout' && typeof data.actorId === 'string' && /^[0-9a-f-]{36}$/i.test(data.actorId)) router.push({ pathname: '/athlete', params: { id: data.actorId } });
      void Notifications.clearLastNotificationResponseAsync();
    };
    const response = Notifications.getLastNotificationResponse(); if (response) redirect(response);
    const listener = Notifications.addNotificationResponseReceivedListener(redirect);
    const tokens = Notifications.addPushTokenListener(() => { void registerPush(owner, false).catch(() => {}); });
    return () => { alive = false; state.remove(); clearInterval(interval); listener.remove(); tokens.remove(); };
  }, [owner]);
  return null;
}
