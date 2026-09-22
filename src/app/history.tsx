import { useCallback, useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';

import type { WorkoutSession } from '../lib/workoutStorage';
import { getWorkouts } from '../lib/workoutStorage';

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);

  const loadWorkouts = async () => {
    const data = await getWorkouts();
    setWorkouts(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [])
  );

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes} min`;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);

    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>YOUR WORK</Text>
        <Text style={styles.title}>HISTORY</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {workouts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>NO SESSIONS YET.</Text>

            <Text style={styles.emptyText}>
              Finished workouts will appear here.
            </Text>
          </View>
        ) : (
          workouts.map((workout) => (
            <View key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View>
                  <Text style={styles.date}>
                    {formatDate(workout.finishedAt)}
                  </Text>

                  <Text style={styles.exerciseCount}>
                    {workout.exercises.length} EXERCISES
                  </Text>
                </View>

                <Text style={styles.duration}>
                  {formatDuration(workout.durationSeconds)}
                </Text>
              </View>

              <View style={styles.divider} />

              {workout.exercises.map((exercise) => {
                const completedSets = exercise.sets.filter(
                  (set) => set.completed
                );

                return (
                  <View key={exercise.id} style={styles.exercise}>
                    <Text style={styles.exerciseName}>
                      {exercise.name}
                    </Text>

                    {completedSets.map((set, index) => (
                      <Text key={set.id} style={styles.setText}>
                        {index + 1}　{set.weight || '0'}kg ×{' '}
                        {set.reps || '0'}
                      </Text>
                    ))}

                    {exercise.note ? (
                      <Text style={styles.note}>
                        {exercise.note}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
  },

  label: {
    color: '#666',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
  },

  title: {
    marginTop: 5,
    color: '#F5F5F2',
    fontSize: 38,
    fontWeight: '900',
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  empty: {
    marginTop: 30,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 12,
    padding: 24,
  },

  emptyTitle: {
    color: '#DDD',
    fontWeight: '900',
    letterSpacing: 1,
  },

  emptyText: {
    marginTop: 8,
    color: '#666',
  },

  workoutCard: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
  },

  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  date: {
    color: '#F5F5F2',
    fontSize: 20,
    fontWeight: '900',
  },

  exerciseCount: {
    marginTop: 4,
    color: '#666',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  duration: {
    color: '#D9FF43',
    fontSize: 15,
    fontWeight: '900',
  },

  divider: {
    height: 1,
    backgroundColor: '#242424',
    marginVertical: 16,
  },

  exercise: {
    marginBottom: 18,
  },

  exerciseName: {
    color: '#EDEDEA',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },

  setText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 22,
  },

  note: {
    color: '#666',
    fontSize: 12,
    marginTop: 7,
  },
});