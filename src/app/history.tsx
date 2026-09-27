import {
  useCallback,
  useState,
} from 'react';

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import {
  getWorkouts,
} from '../lib/workoutStorage';

import type {
  WorkoutSession,
} from '../lib/workoutStorage';

export default function HistoryScreen() {
  const router =
    useRouter();

  const [
    workouts,
    setWorkouts,
  ] = useState<WorkoutSession[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          setLoading(true);

          const data =
            await getWorkouts();

          setWorkouts(data);
        } catch (error) {
          console.error(
            'Failed to load history:',
            error
          );
        } finally {
          setLoading(false);
        }
      };

      load();
    }, [])
  );

  const formatDate = (
    dateString: string
  ) => {
    const date =
      new Date(dateString);

    return date.toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    );
  };

  const formatDay = (
    dateString: string
  ) => {
    const date =
      new Date(dateString);

    return date
      .toLocaleDateString(
        'en-US',
        {
          weekday: 'short',
        }
      )
      .toUpperCase();
  };

  const formatTime = (
    totalSeconds: number
  ) => {
    const hours =
      Math.floor(
        totalSeconds / 3600
      );

    const minutes =
      Math.floor(
        (
          totalSeconds %
          3600
        ) / 60
      );

    const seconds =
      totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(
        minutes
      ).padStart(
        2,
        '0'
      )}:${String(
        seconds
      ).padStart(
        2,
        '0'
      )}`;
    }

    return `${minutes}:${String(
      seconds
    ).padStart(
      2,
      '0'
    )}`;
  };

  const calculateVolume = (
    workout: WorkoutSession
  ) => {
    return workout.exercises.reduce(
      (
        workoutTotal,
        exercise
      ) => {
        const exerciseVolume =
          exercise.sets.reduce(
            (
              total,
              set
            ) => {
              if (
                !set.completed
              ) {
                return total;
              }

              const weight =
                Number(
                  set.weight
                ) || 0;

              const reps =
                Number(
                  set.reps
                ) || 0;

              return (
                total +
                weight * reps
              );
            },
            0
          );

        return (
          workoutTotal +
          exerciseVolume
        );
      },
      0
    );
  };

  const getTotalSets = (
    workout: WorkoutSession
  ) => {
    return workout.exercises.reduce(
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
  };

  const openWorkout = (
    workout: WorkoutSession
  ) => {
    router.push({
      pathname:
        '/history-detail',

      params: {
        id: workout.id,
      },
    });
  };

  return (
    <SafeAreaView
      style={styles.container}
    >
      <View
        style={styles.header}
      >
        <Text
          style={styles.headerLabel}
        >
          TRAINING LOG
        </Text>

        <Text
          style={styles.title}
        >
          HISTORY
        </Text>

        <Text
          style={
            styles.headerDescription
          }
        >
          Every session.
          Every rep.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {loading ? (
          <View
            style={
              styles.emptyState
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              LOADING...
            </Text>
          </View>
        ) : workouts.length ===
          0 ? (
          <View
            style={
              styles.emptyState
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              NO WORK YET.
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Finish a workout and
              it will show up here.
            </Text>
          </View>
        ) : (
          workouts.map(
            (
              workout,
              index
            ) => {
              const totalSets =
                getTotalSets(
                  workout
                );

              const totalVolume =
                calculateVolume(
                  workout
                );

              return (
                <Pressable
                  key={
                    workout.id
                  }
                  onPress={() =>
                    openWorkout(
                      workout
                    )
                  }
                  style={({ pressed }) => [
                    styles.workoutCard,

                    pressed &&
                      styles.workoutCardPressed,
                  ]}
                >
                  <View
                    style={
                      styles.cardTop
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.workoutNumber
                        }
                      >
                        SESSION{' '}
                        {workouts.length -
                          index}
                      </Text>

                      <Text
                        style={
                          styles.date
                        }
                      >
                        {formatDate(
                          workout.finishedAt
                        )}
                      </Text>

                      <Text
                        style={
                          styles.day
                        }
                      >
                        {formatDay(
                          workout.finishedAt
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.arrow
                      }
                    >
                      →
                    </Text>
                  </View>

                  <View
                    style={
                      styles.statsRow
                    }
                  >
                    <View
                      style={
                        styles.stat
                      }
                    >
                      <Text
                        style={
                          styles.statLabel
                        }
                      >
                        TIME
                      </Text>

                      <Text
                        style={
                          styles.statValue
                        }
                      >
                        {formatTime(
                          workout.durationSeconds
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.stat
                      }
                    >
                      <Text
                        style={
                          styles.statLabel
                        }
                      >
                        SETS
                      </Text>

                      <Text
                        style={
                          styles.statValue
                        }
                      >
                        {totalSets}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.stat
                      }
                    >
                      <Text
                        style={
                          styles.statLabel
                        }
                      >
                        VOLUME
                      </Text>

                      <Text
                        style={
                          styles.statValue
                        }
                      >
                        {totalVolume.toLocaleString()}
                        kg
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.exerciseList
                    }
                  >
                    {workout.exercises
                      .slice(
                        0,
                        4
                      )
                      .map(
                        (
                          exercise
                        ) => (
                          <View
                            key={
                              exercise.id
                            }
                            style={
                              styles.exercisePreview
                            }
                          >
                            <Text
                              style={
                                styles.exerciseName
                              }
                            >
                              {
                                exercise.name
                              }
                            </Text>

                            <View
                              style={[
                                styles.focusBadge,

                                exercise.focus ===
                                'PR'
                                  ? styles.focusBadgePR
                                  : styles.focusBadgeVolume,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.focusText,

                                  exercise.focus ===
                                    'PR' &&
                                    styles.focusTextDark,
                                ]}
                              >
                                {exercise.focus ??
                                  'VOLUME'}
                              </Text>
                            </View>
                          </View>
                        )
                      )}

                    {workout
                      .exercises
                      .length >
                      4 && (
                      <Text
                        style={
                          styles.moreExercises
                        }
                      >
                        +
                        {workout
                          .exercises
                          .length -
                          4}{' '}
                        MORE
                      </Text>
                    )}
                  </View>

                  <Text
                    style={
                      styles.tapText
                    }
                  >
                    TAP TO VIEW
                    SESSION
                  </Text>
                </Pressable>
              );
            }
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#080808',
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1B1B1B',
    },

    headerLabel: {
      color: '#666',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 2.5,
    },

    title: {
      color: '#F5F5F2',
      fontSize: 36,
      fontWeight: '900',
      marginTop: 4,
    },

    headerDescription: {
      color: '#666',
      fontSize: 12,
      marginTop: 5,
    },

    content: {
      padding: 16,
      paddingBottom: 40,
    },

    emptyState: {
      paddingVertical: 100,
      alignItems: 'center',
    },

    emptyTitle: {
      color: '#777',
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    emptyText: {
      color: '#555',
      marginTop: 10,
      textAlign: 'center',
      lineHeight: 20,
    },

    workoutCard: {
      backgroundColor:
        '#111111',
      borderWidth: 1,
      borderColor:
        '#252525',
      borderRadius: 14,
      padding: 17,
      marginBottom: 14,
    },

    workoutCardPressed: {
      opacity: 0.72,
    },

    cardTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
    },

    workoutNumber: {
      color: '#555',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.7,
    },

    date: {
      color: '#F5F5F2',
      fontSize: 22,
      fontWeight: '900',
      marginTop: 4,
    },

    day: {
      color: '#D9FF43',
      fontSize: 9,
      fontWeight: '900',
      marginTop: 4,
      letterSpacing: 1.4,
    },

    arrow: {
      color: '#555',
      fontSize: 24,
      fontWeight: '500',
    },

    statsRow: {
      flexDirection: 'row',
      marginTop: 20,
      backgroundColor:
        '#0C0C0C',
      borderRadius: 9,
      paddingVertical: 12,
    },

    stat: {
      flex: 1,
      alignItems: 'center',
    },

    statLabel: {
      color: '#555',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.3,
    },

    statValue: {
      color: '#DDD',
      fontSize: 13,
      fontWeight: '900',
      marginTop: 5,
    },

    exerciseList: {
      marginTop: 16,
    },

    exercisePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1D1D1D',
    },

    exerciseName: {
      color: '#AAA',
      fontSize: 12,
      fontWeight: '800',
    },

    focusBadge: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 4,
    },

    focusBadgeVolume: {
      backgroundColor:
        '#202617',
    },

    focusBadgePR: {
      backgroundColor:
        '#D9FF43',
    },

    focusText: {
      color: '#D9FF43',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1,
    },

    focusTextDark: {
      color: '#080808',
    },

    moreExercises: {
      color: '#555',
      fontSize: 9,
      fontWeight: '900',
      marginTop: 10,
    },

    tapText: {
      color: '#444',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.5,
      marginTop: 14,
      textAlign: 'right',
    },
  });