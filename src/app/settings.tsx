import { Text } from 'react-native';
import { SocialLayout, socialStyles as s } from '../components/social-layout';
import { NotificationPreferenceControl } from '../components/notification-preference-control';
import { useAccountOwner } from '../hooks/use-account-owner';

export default function SettingsScreen() {
  const owner = useAccountOwner();
  return <SocialLayout title="SETTINGS">
    <NotificationPreferenceControl key={`${owner}/workout`} owner={owner} kind="workout" />
    <Text style={s.muted}>Get notified when people you follow finish a workout. Training partner tags can also notify you when device notifications are allowed.</Text>
    <NotificationPreferenceControl key={`${owner}/reaction`} owner={owner} kind="reaction" />
    <Text style={s.muted}>Receive workout reactions from your training friends. This setting does not affect sending or saving reactions.</Text>
  </SocialLayout>;
}
