import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { registerPush } from '../lib/registerPush';
import { notificationDestination } from '../lib/notificationDestination';
import { initializeCompletionSync, syncWorkoutCompletions } from '../lib/notifications';
if (Platform.OS !== 'web') Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
export function NotificationGate({ owner }: { owner: string }) {
  useEffect(() => {
    let alive = true;
    const refresh = (trigger: string) => { if (!alive) return; void registerPush(owner, false, trigger).catch(() => {}); void syncWorkoutCompletions(owner, trigger).catch(() => {}); };
    void initializeCompletionSync(owner).then(() => { if (alive) refresh('app-start'); }).catch(() => {});
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh('app-resume'); });
    const interval = setInterval(() => { if (alive && AppState.currentState === 'active') void syncWorkoutCompletions(owner, 'foreground-interval').catch(() => {}); }, 60000);
    if (Platform.OS === 'web') return () => { alive = false; state.remove(); clearInterval(interval); };
    const redirect = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (!alive || !data || data.recipientId !== owner) return;
      const destination = notificationDestination(owner, data);
      if (destination) router.push(destination);
      void Notifications.clearLastNotificationResponseAsync();
    };
    const response = Notifications.getLastNotificationResponse(); if (response) redirect(response);
    const listener = Notifications.addNotificationResponseReceivedListener(redirect);
    const tokens = Notifications.addPushTokenListener(token => { if (alive) void registerPush(owner, false, 'push-token-change', token).catch(() => {}); });
    return () => { alive = false; state.remove(); clearInterval(interval); listener.remove(); tokens.remove(); };
  }, [owner]);
  return null;
}
