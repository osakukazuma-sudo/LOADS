import { useProfile } from '../hooks/use-profile';
import { MyConnections } from '../components/my-connections';
import { LogoutControl } from '../components/logout-control';
import { AccountDeletionControl } from '../components/account-deletion-control';
import { useAccountOwner } from '../hooks/use-account-owner';
import { cardioTotals } from '../lib/cardio';
import { useCallback, useMemo, useState } from 'react';
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { useFocusEffect, useRouter } from 'expo-router';

import {
    getWorkouts,
} from '../lib/workoutStorage';

import type {
    WorkoutSession,
} from '../lib/workoutStorage';

export default function ProfileScreen() {
  const router = useRouter();
  const ownerId = useAccountOwner();
  const profile = useProfile(ownerId);
  const [dataError, setDataError] = useState('');
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const loadWorkouts = async () => {
        try {
          setDataError('');
          const data = await getWorkouts(ownerId);
          if (alive) setWorkouts(data);
        } catch { if (alive) { setWorkouts([]); setDataError('Could not read your saved workouts.'); } }
      };

      loadWorkouts();
      return () => { alive = false; };
    }, [ownerId])
  );

  const calculateExerciseVolume = (
    sets: {
      weight: string;
      reps: string;
      completed: boolean;
    }[]
  ) => {
    return sets
      .filter((set) => set.completed)
      .reduce((total, set) => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;

        return total + weight * reps;
      }, 0);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    }

    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }

    return volume.toLocaleString();
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes} MIN`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}H ${remainingMinutes}M`;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);

    return date
      .toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      .toUpperCase();
  };

  const workoutsThisMonth = useMemo(() => {
    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return workouts.filter((workout) => {
      const date = new Date(workout.finishedAt);

      return (
        date.getFullYear() === currentYear &&
        date.getMonth() === currentMonth
      );
    }).length;
  }, [workouts]);

  const getExercisePR = useCallback((exerciseName: string) => {
    let bestWeight = 0;
    let bestReps = 0;

    workouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        if (exercise.type === 'cardio' || exercise.name !== exerciseName) {
          return;
        }

        exercise.sets.forEach((set) => {
          if (!set.completed) {
            return;
          }

          const weight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;

          if (weight > bestWeight) {
            bestWeight = weight;
            bestReps = reps;
          } else if (
            weight === bestWeight &&
            reps > bestReps
          ) {
            bestReps = reps;
          }
        });
      });
    });

    if (bestWeight === 0) {
      return '—';
    }

    return `${bestWeight}kg`;
  }, [workouts]);

  const squatPR = useMemo(() => {
    return getExercisePR('SQUAT');
  }, [getExercisePR]);

  const benchPR = useMemo(() => {
    return getExercisePR('BENCH PRESS');
  }, [getExercisePR]);

  const deadliftPR = useMemo(() => {
    return getExercisePR('DEADLIFT');
  }, [getExercisePR]);

  const totalVolume = useMemo(() => {
    return workouts.reduce(
      (workoutTotal, workout) => {
        const workoutVolume =
          workout.exercises.reduce(
            (exerciseTotal, exercise) => {
              return (
                exerciseTotal +
                calculateExerciseVolume(
                  exercise.sets
                )
              );
            },
            0
          );

        return workoutTotal + workoutVolume;
      },
      0
    );
  }, [workouts]);

  const favoriteExercise = useMemo(() => {
    const counts: Record<string, number> = {};

    workouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        counts[exercise.name] =
          (counts[exercise.name] || 0) + 1;
      });
    });

    const entries = Object.entries(counts);

    if (entries.length === 0) {
      return '—';
    }

    entries.sort(
      (a, b) =>
        b[1] - a[1]
    );

    return entries[0][0];
  }, [workouts]);

  const recentWorkouts = useMemo(() => {
    return workouts.slice(0, 5);
  }, [workouts]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerLabel}>
            ATHLETE
          </Text>

          <Text style={styles.name}>
            {profile.name}
          </Text>

          <Text style={styles.mantra}>
            NO FLEX. JUST WORK.
          </Text>
        </View>

        {!!profile.error && <Pressable onPress={profile.reload}><Text style={{ color: '#FF9494' }}>{profile.error} TAP TO RETRY</Text></Pressable>}
        {!!dataError && <Text accessibilityRole="alert" style={{ color: '#FF9494' }}>{dataError}</Text>}
        <MyConnections />
        <View style={styles.statsCard}>
          <View style={styles.activityRow}>
            <View style={styles.activityStat}>
              <Text style={styles.activityValue}>
                {workouts.length}
              </Text>

              <Text style={styles.activityLabel}>
                WORKOUTS
              </Text>
            </View>

            <View style={styles.activityDivider} />

            <View style={styles.activityStat}>
              <Text
                style={[
                  styles.activityValue,
                  styles.accentValue,
                ]}
              >
                {workoutsThisMonth}
              </Text>

              <Text style={styles.activityLabel}>
                THIS MONTH
              </Text>
            </View>
          </View>

          <View style={styles.horizontalDivider} />

          <View style={styles.prRow}>
            <View style={styles.prStat}>
              <Text style={styles.prValue}>
                {squatPR}
              </Text>

              <Text style={styles.prLabel}>
                SQUAT
              </Text>
            </View>

            <View style={styles.prDivider} />

            <View style={styles.prStat}>
              <Text
                style={[
                  styles.prValue,
                  styles.accentValue,
                ]}
              >
                {benchPR}
              </Text>

              <Text style={styles.prLabel}>
                BENCH PR
              </Text>
            </View>

            <View style={styles.prDivider} />

            <View style={styles.prStat}>
              <Text style={styles.prValue}>
                {deadliftPR}
              </Text>

              <Text style={styles.prLabel}>
                DEADLIFT
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>
          WORK DONE
        </Text>

        <View style={styles.workCard}>
          <View style={styles.workMetric}>
            <Text style={styles.metricLabel}>
              LIFETIME VOLUME
            </Text>

            <Text style={styles.bigMetric}>
              {formatVolume(totalVolume)}
              <Text style={styles.metricUnit}>
                {' '}KG
              </Text>
            </Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.workMetric}>
            <Text style={styles.metricLabel}>
              MOST TRAINED
            </Text>

            <Text style={styles.favoriteExercise}>
              {favoriteExercise}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>
          RECENT WORK
        </Text>

        {recentWorkouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              NO WORKOUTS YET.
            </Text>

            <Text style={styles.emptyText}>
              Your completed sessions will appear here.
            </Text>
          </View>
        ) : (
          recentWorkouts.map((workout) => {
            const cardioStats = cardioTotals(workout.exercises);
            const workoutVolume =
              workout.exercises.reduce(
                (
                  total,
                  exercise
                ) =>
                  total +
                  calculateExerciseVolume(
                    exercise.sets
                  ),
                0
              );

            const totalSets =
              workout.exercises.reduce(
                (
                  total,
                  exercise
                ) =>
                  total +
                  exercise.sets.filter(
                    (set) =>
                      set.completed
                  ).length,
                0
              );

            return (
              <View
                key={workout.id}
                style={styles.recentCard}
              >
                <View style={styles.recentTop}>
                  <Text style={styles.recentDate}>
                    {formatDate(
                      workout.finishedAt
                    )}
                  </Text>

                  <Text style={styles.recentDuration}>
                    {formatDuration(
                      workout.durationSeconds
                    )}
                  </Text>
                </View>

                <Text style={styles.recentTitle}>
                  WORKOUT COMPLETE
                </Text>

                <View style={styles.recentMetrics}>
                  <Text style={styles.recentMetric}>
                    {workout.exercises.length} EXERCISES
                  </Text>

                  <Text style={styles.recentDot}>
                    ·
                  </Text>

                  <Text style={styles.recentMetric}>
                    {cardioStats.onlyCardio ? `${cardioStats.durationMinutes} MIN CARDIO` : `${totalSets} SETS`}
                  </Text>

                  <Text style={styles.recentDot}>
                    ·
                  </Text>

                  <Text style={styles.recentMetric}>
                    {cardioStats.onlyCardio ? cardioStats.distanceLabel : `${workoutVolume.toLocaleString()} KG`}
                  </Text>
                </View>

                <View style={styles.exerciseList}>
                  {workout.exercises
                    .slice(0, 3)
                    .map((exercise) => (
                      <Text
                        key={exercise.id}
                        style={styles.recentExercise}
                      >
                        {exercise.name}
                      </Text>
                    ))}

                  {workout.exercises.length > 3 && (
                    <Text style={styles.moreExercises}>
                      +
                      {workout.exercises.length - 3}{' '}
                      MORE
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.footer}>
          LOAD. LIFT. LOG.
        </Text>
        <Pressable onPress={() => router.push('/settings')}><Text style={{ color: '#D9FF43', paddingVertical: 12 }}>SETTINGS</Text></Pressable>
        <Pressable onPress={() => router.push('/tagged')}><Text style={{ color: '#D9FF43', paddingVertical: 12 }}>TAGGED WORKOUTS</Text></Pressable>
        <LogoutControl />
        <AccountDeletionControl />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 50,
  },

  header: {
    paddingBottom: 24,
  },

  headerLabel: {
    color: '#5F5F5F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 3,
  },

  name: {
    marginTop: 4,
    color: '#F5F5F2',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1,
  },

  mantra: {
    marginTop: 5,
    color: '#666',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  statsCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 12,
    overflow: 'hidden',
  },

  activityRow: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  activityStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityValue: {
    color: '#F5F5F2',
    fontSize: 30,
    fontWeight: '900',
  },

  activityLabel: {
    marginTop: 7,
    color: '#555',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  accentValue: {
    color: '#D9FF43',
  },

  activityDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#292929',
  },

  horizontalDivider: {
    height: 1,
    backgroundColor: '#252525',
    marginHorizontal: 14,
  },

  prRow: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
  },

  prStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  prValue: {
    color: '#F5F5F2',
    fontSize: 20,
    fontWeight: '900',
  },

  prLabel: {
    marginTop: 7,
    color: '#555',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  prDivider: {
    width: 1,
    height: 42,
    backgroundColor: '#292929',
  },

  sectionLabel: {
    marginTop: 28,
    marginBottom: 10,
    color: '#666',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.2,
  },

  workCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 12,
    padding: 18,
  },

  workMetric: {
    minHeight: 60,
    justifyContent: 'center',
  },

  metricLabel: {
    color: '#555',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  bigMetric: {
    marginTop: 5,
    color: '#D9FF43',
    fontSize: 32,
    fontWeight: '900',
  },

  metricUnit: {
    color: '#777',
    fontSize: 13,
    fontWeight: '900',
  },

  cardDivider: {
    height: 1,
    backgroundColor: '#232323',
    marginVertical: 16,
  },

  favoriteExercise: {
    marginTop: 6,
    color: '#F5F5F2',
    fontSize: 21,
    fontWeight: '900',
  },

  emptyCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 12,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  emptyTitle: {
    color: '#777',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },

  emptyText: {
    color: '#555',
    fontSize: 11,
    marginTop: 7,
    textAlign: 'center',
  },

  recentCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },

  recentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  recentDate: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },

  recentDuration: {
    color: '#666',
    fontSize: 9,
    fontWeight: '800',
  },

  recentTitle: {
    marginTop: 7,
    color: '#F5F5F2',
    fontSize: 17,
    fontWeight: '900',
  },

  recentMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 5,
  },

  recentMetric: {
    color: '#666',
    fontSize: 9,
    fontWeight: '800',
  },

  recentDot: {
    color: '#444',
    marginHorizontal: 6,
  },

  exerciseList: {
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },

  recentExercise: {
    color: '#AAAAAA',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 5,
  },

  moreExercises: {
    color: '#D9FF43',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
  },

  footer: {
    marginTop: 32,
    textAlign: 'center',
    color: '#3E3E3E',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 3,
  },
});
