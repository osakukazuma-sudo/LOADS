import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAccountOwner } from '../hooks/use-account-owner';
import type { Athlete } from '../lib/follows';

export const socialStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 20, gap: 16 },
  text: { color: '#eee', fontSize: 16 },
  muted: { color: '#999', fontSize: 13 },
  action: { color: '#D9FF43', paddingVertical: 14, fontWeight: '700' },
  error: { color: '#ff9494' },
  input: { color: '#eee', padding: 14, borderWidth: 1, borderColor: '#555', borderRadius: 8 },
  row: { paddingVertical: 12, gap: 5, borderBottomWidth: 1, borderColor: '#333' },
});
export function SocialLayout({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return <SafeAreaView style={socialStyles.page}><ScrollView contentContainerStyle={socialStyles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')}><Text style={socialStyles.action}>BACK</Text></Pressable>
    <Text style={socialStyles.text}>{title}</Text>{children}
  </ScrollView></SafeAreaView>;
}
export function AthleteRow({ athlete }: { athlete: Athlete }) {
  const router = useRouter(); const owner = useAccountOwner();
  return <Pressable accessibilityRole="button" style={socialStyles.row} onPress={() => athlete.id === owner ? router.push('/profile') : router.push({ pathname: '/athlete', params: { id: athlete.id } })}>
    <Text style={socialStyles.text}>{athlete.display_name?.trim() || athlete.username}</Text>
    <View><Text style={socialStyles.muted}>@{athlete.username}</Text></View>
  </Pressable>;
}
