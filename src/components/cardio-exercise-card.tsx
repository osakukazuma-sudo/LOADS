import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CardioInput } from '../lib/workoutStorage';
import { cardioFields } from '../lib/cardio';

const fieldLabels = {
  durationMinutes: ['DURATION (MIN OR M:SS) · REQUIRED', 'e.g. 30:00'],
  distanceKm: ['DISTANCE (KM) · OPTIONAL', 'e.g. 5.2'],
  speedKmh: ['SPEED (KM/H) · OPTIONAL', 'e.g. 10.4'],
  inclinePercent: ['INCLINE (%) · OPTIONAL', 'e.g. 3.0'],
  resistanceLevel: ['LEVEL / RESISTANCE · OPTIONAL', 'e.g. 8'],
  paceSeconds: ['PACE (M:SS / 500M) · OPTIONAL', 'e.g. 2:05'],
  floors: ['FLOORS · OPTIONAL', 'e.g. 40'],
} as const;

export function CardioExerciseCard({ name, index, cardio, memo, onChange, onMemo, onRemove, onMove, canMoveUp, canMoveDown }: {
  name: string; index: number; cardio: CardioInput; memo: string;
  onChange: (value: CardioInput) => void; onMemo: (value: string) => void;
  onRemove: () => void; onMove: (direction: 'up' | 'down') => void;
  canMoveUp: boolean; canMoveDown: boolean;
}) {
  return <View style={styles.card}>
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>EXERCISE {index + 1}</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.badge}>CARDIO</Text>
      </View>
      <View style={styles.actions}>
        {(['up', 'down'] as const).map(direction => <Pressable key={direction}
          accessibilityLabel={`Move ${name} ${direction}`} accessibilityRole="button"
          disabled={direction === 'up' ? !canMoveUp : !canMoveDown}
          onPress={() => onMove(direction)} style={styles.button}>
          <Text style={[styles.actionText, !(direction === 'up' ? canMoveUp : canMoveDown) && { color: '#444' }]}>{direction === 'up' ? '↑' : '↓'}</Text>
        </Pressable>)}
        <Pressable accessibilityLabel={`Remove ${name}`} accessibilityRole="button" onPress={onRemove} style={styles.button}>
          <Text style={styles.actionText}>×</Text>
        </Pressable>
      </View>
    </View>
    {cardioFields(name).map(field => {
      const [label, placeholder] = fieldLabels[field];
      return <View key={field} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} value={cardio[field] ?? ''} keyboardType={field === 'durationMinutes' || field === 'paceSeconds' ? 'numbers-and-punctuation' : 'decimal-pad'}
        onChangeText={value => {
          const { caloriesKcal: _legacyCalories, ...input } = cardio;
          onChange({ ...input, [field]: value });
        }} placeholder={placeholder}
        placeholderTextColor="#555" maxLength={16} style={styles.input} />
    </View>; })}
    <View style={styles.field}>
      <Text style={styles.label}>MEMO · OPTIONAL</Text>
      <TextInput accessibilityLabel="Cardio memo" value={memo} onChangeText={onMemo} multiline
        maxLength={10000} placeholder="How did it feel?" placeholderTextColor="#555" style={[styles.input, styles.memo]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#121212', borderColor: '#242424', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { color: '#F5F5F2', fontSize: 22, fontWeight: '900', marginTop: 5 },
  label: { color: '#888', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  badge: { color: '#D9FF43', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 4 },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#191919', borderRadius: 6 },
  actionText: { color: '#AAA', fontSize: 18, fontWeight: '900' },
  field: { marginTop: 16 },
  input: { backgroundColor: '#191919', borderColor: '#303030', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, color: '#F5F5F2', fontSize: 15 },
  memo: { minHeight: 70, textAlignVertical: 'top' },
});
