import { StyleSheet, Text, View } from 'react-native';
import type { CardioRecord } from '../lib/postStorage';
import { cardioSummary } from '../lib/cardio';

export function CardioSummaryCard({ name, cardio, memo }: { name: string; cardio: CardioRecord; memo: string }) {
  return <View style={styles.card}>
    <Text style={styles.name}>{name}</Text>
    <Text style={styles.type}>CARDIO</Text>
    <Text style={styles.metrics}>{cardioSummary(cardio)}</Text>
    {!!memo.trim() && <Text style={styles.memo}>{memo}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111', borderColor: '#262626', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  name: { color: '#F5F5F2', fontSize: 16, fontWeight: '900' },
  type: { color: '#D9FF43', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  metrics: { color: '#F5F5F2', fontSize: 14, fontWeight: '700', marginTop: 14, lineHeight: 22 },
  memo: { color: '#999', fontSize: 12, lineHeight: 20, marginTop: 10 },
});
