import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { estimatedOneRepMax, formatEstimatedOneRepMax, isBig3Exercise } from '../lib/estimatedOneRepMax';
import type { WorkoutExercise, WorkoutSet } from '../lib/workoutStorage';

export function EstimatedOneRepMax({ exercise, set }: { exercise: WorkoutExercise; set: WorkoutSet }) {
  if (!isBig3Exercise(exercise)) return null;
  const estimate = estimatedOneRepMax(set.weight, set.reps);
  if (estimate === null) return null;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="推定1RMの説明"
        style={styles.labelButton}
        onPress={() => Alert.alert('e1RM', '推定1RMは重量と回数から計算した参考値です。実際の最大挙上重量とは異なる場合があります。PR判定には反映されません。')}
      >
        <Text style={styles.label}>e1RM</Text>
      </Pressable>
      <Text style={styles.value}>{formatEstimatedOneRepMax(estimate)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, marginRight: 5, gap: 8 },
  labelButton: { paddingVertical: 6, paddingHorizontal: 4 },
  label: { color: '#999999', fontSize: 11, fontWeight: '800' },
  value: { color: '#C7C7C7', fontSize: 12, fontWeight: '800', flexShrink: 1 },
});
