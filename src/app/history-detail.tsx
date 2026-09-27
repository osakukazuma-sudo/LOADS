import {
    useEffect,
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
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
  
  import {
    getWorkouts,
} from '../lib/workoutStorage';
  
  import type {
    ExerciseFocus,
    WorkoutExercise,
    WorkoutSession,
} from '../lib/workoutStorage';
  
  type ExercisePRStatus = {
    weightPR: boolean;
    repPR: boolean;
    volumePR: boolean;
  };
  
  export default function HistoryDetailScreen() {
    const router =
      useRouter();
  
    const params =
      useLocalSearchParams<{
        id?: string;
      }>();
  
    const [
      workout,
      setWorkout,
    ] =
      useState<WorkoutSession | null>(
        null
      );
  
    const [
      allWorkouts,
      setAllWorkouts,
    ] =
      useState<WorkoutSession[]>([]);
  
    const [
      loading,
      setLoading,
    ] = useState(true);
  
    const normalizeFocus = (
      focus?: ExerciseFocus
    ): ExerciseFocus => {
      return focus ?? 'VOLUME';
    };
  
    useEffect(() => {
      const load =
        async () => {
          try {
            const data =
              await getWorkouts();
  
            setAllWorkouts(
              data
            );
  
            const found =
              data.find(
                (item) =>
                  item.id ===
                  params.id
              ) ?? null;
  
            setWorkout(
              found
            );
          } catch (error) {
            console.error(
              'Failed to load workout detail:',
              error
            );
          } finally {
            setLoading(
              false
            );
          }
        };
  
      load();
    }, [params.id]);
  
    const formatDate = (
      dateString: string
    ) => {
      const date =
        new Date(
          dateString
        );
  
      return date.toLocaleDateString(
        'en-US',
        {
          weekday:
            'long',
  
          month:
            'long',
  
          day:
            'numeric',
  
          year:
            'numeric',
        }
      );
    };
  
    const formatTimeOfDay = (
      dateString: string
    ) => {
      return new Date(
        dateString
      ).toLocaleTimeString(
        'en-US',
        {
          hour:
            'numeric',
  
          minute:
            '2-digit',
        }
      );
    };
  
    const formatDuration = (
      totalSeconds: number
    ) => {
      const hours =
        Math.floor(
          totalSeconds /
            3600
        );
  
      const minutes =
        Math.floor(
          (
            totalSeconds %
            3600
          ) /
            60
        );
  
      const seconds =
        totalSeconds %
        60;
  
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
  
    const calculateExerciseVolume = (
      exercise: WorkoutExercise
    ) => {
      return exercise.sets
        .filter(
          (set) =>
            set.completed
        )
        .reduce(
          (
            total,
            set
          ) => {
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
              weight *
                reps
            );
          },
          0
        );
    };
  
    const calculateWorkoutVolume = (
      session: WorkoutSession
    ) => {
      return session.exercises.reduce(
        (
          total,
          exercise
        ) =>
          total +
          calculateExerciseVolume(
            exercise
          ),
        0
      );
    };
  
    const getTotalSets = (
      session: WorkoutSession
    ) => {
      return session.exercises.reduce(
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
  
    const getTopSet = (
      exercise: WorkoutExercise
    ) => {
      const completed =
        exercise.sets.filter(
          (set) =>
            set.completed
        );
  
      if (
        completed.length ===
        0
      ) {
        return null;
      }
  
      return completed.reduce(
        (
          best,
          set
        ) => {
          const weight =
            Number(
              set.weight
            ) || 0;
  
          const bestWeight =
            Number(
              best.weight
            ) || 0;
  
          const reps =
            Number(
              set.reps
            ) || 0;
  
          const bestReps =
            Number(
              best.reps
            ) || 0;
  
          if (
            weight >
            bestWeight
          ) {
            return set;
          }
  
          if (
            weight ===
              bestWeight &&
            reps >
              bestReps
          ) {
            return set;
          }
  
          return best;
        }
      );
    };
  
    const getOlderWorkouts = (
      session: WorkoutSession
    ) => {
      const currentTime =
        new Date(
          session.finishedAt
        ).getTime();
  
      return allWorkouts.filter(
        (item) =>
          new Date(
            item.finishedAt
          ).getTime() <
          currentTime
      );
    };
  
    const getExercisePRStatus = (
      session: WorkoutSession,
      exercise: WorkoutExercise
    ): ExercisePRStatus => {
      const olderWorkouts =
        getOlderWorkouts(
          session
        );
  
      let historicalMaxWeight =
        0;
  
      const historicalRepsByWeight =
        new Map<
          number,
          number
        >();
  
      let historicalVolume =
        0;
  
      olderWorkouts.forEach(
        (oldWorkout) => {
          oldWorkout.exercises.forEach(
            (
              oldExercise
            ) => {
              if (
                oldExercise.name !==
                exercise.name
              ) {
                return;
              }
  
              oldExercise.sets.forEach(
                (set) => {
                  if (
                    !set.completed
                  ) {
                    return;
                  }
  
                  const weight =
                    Number(
                      set.weight
                    ) || 0;
  
                  const reps =
                    Number(
                      set.reps
                    ) || 0;
  
                  historicalMaxWeight =
                    Math.max(
                      historicalMaxWeight,
                      weight
                    );
  
                  const oldReps =
                    historicalRepsByWeight.get(
                      weight
                    ) ?? 0;
  
                  if (
                    reps >
                    oldReps
                  ) {
                    historicalRepsByWeight.set(
                      weight,
                      reps
                    );
                  }
                }
              );
  
              if (
                normalizeFocus(
                  oldExercise.focus
                ) ===
                'VOLUME'
              ) {
                historicalVolume =
                  Math.max(
                    historicalVolume,
                    calculateExerciseVolume(
                      oldExercise
                    )
                  );
              }
            }
          );
        }
      );
  
      const completedSets =
        exercise.sets.filter(
          (set) =>
            set.completed
        );
  
      const currentMaxWeight =
        Math.max(
          0,
          ...completedSets.map(
            (set) =>
              Number(
                set.weight
              ) || 0
          )
        );
  
      const weightPR =
        currentMaxWeight >
        historicalMaxWeight;
  
      const repPR =
        completedSets.some(
          (set) => {
            const weight =
              Number(
                set.weight
              ) || 0;
  
            const reps =
              Number(
                set.reps
              ) || 0;
  
            if (
              weight <= 0 ||
              reps <= 0
            ) {
              return false;
            }
  
            const previousBest =
              historicalRepsByWeight.get(
                weight
              ) ?? 0;
  
            return (
              reps >
              previousBest
            );
          }
        );
  
      const currentVolume =
        calculateExerciseVolume(
          exercise
        );
  
      const volumePR =
        normalizeFocus(
          exercise.focus
        ) ===
          'VOLUME' &&
        currentVolume >
          historicalVolume;
  
      return {
        weightPR,
        repPR,
        volumePR,
      };
    };
  
    if (loading) {
      return (
        <SafeAreaView
          style={
            styles.container
          }
        >
          <View
            style={
              styles.centerState
            }
          >
            <Text
              style={
                styles.stateText
              }
            >
              LOADING...
            </Text>
          </View>
        </SafeAreaView>
      );
    }
  
    if (!workout) {
      return (
        <SafeAreaView
          style={
            styles.container
          }
        >
          <View
            style={
              styles.centerState
            }
          >
            <Text
              style={
                styles.stateText
              }
            >
              WORKOUT NOT FOUND
            </Text>
  
            <Pressable
              style={
                styles.backStateButton
              }
              onPress={() =>
                router.back()
              }
            >
              <Text
                style={
                  styles.backStateText
                }
              >
                GO BACK
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
  
    const totalSets =
      getTotalSets(
        workout
      );
  
    const totalVolume =
      calculateWorkoutVolume(
        workout
      );
  
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ←
            </Text>
          </Pressable>
  
          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.headerLabel
              }
            >
              WORKOUT DETAIL
            </Text>
  
            <Text
              style={
                styles.headerTitle
              }
            >
              SESSION
            </Text>
          </View>
        </View>
  
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.content
          }
        >
          <View
            style={
              styles.dateSection
            }
          >
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
                styles.timeRange
              }
            >
              {formatTimeOfDay(
                workout.startedAt
              )}{' '}
              →{' '}
              {formatTimeOfDay(
                workout.finishedAt
              )}
            </Text>
          </View>
  
          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={
                styles.summaryItem
              }
            >
              <Text
                style={
                  styles.summaryLabel
                }
              >
                TIME
              </Text>
  
              <Text
                style={
                  styles.summaryValue
                }
              >
                {formatDuration(
                  workout.durationSeconds
                )}
              </Text>
            </View>
  
            <View
              style={
                styles.summaryDivider
              }
            />
  
            <View
              style={
                styles.summaryItem
              }
            >
              <Text
                style={
                  styles.summaryLabel
                }
              >
                SETS
              </Text>
  
              <Text
                style={
                  styles.summaryValue
                }
              >
                {totalSets}
              </Text>
            </View>
  
            <View
              style={
                styles.summaryDivider
              }
            />
  
            <View
              style={
                styles.summaryItem
              }
            >
              <Text
                style={
                  styles.summaryLabel
                }
              >
                VOLUME
              </Text>
  
              <Text
                style={
                  styles.summaryValue
                }
              >
                {totalVolume.toLocaleString()}
                kg
              </Text>
            </View>
          </View>
  
          <View
            style={
              styles.sectionHeader
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              EXERCISES
            </Text>
  
            <Text
              style={
                styles.sectionCount
              }
            >
              {
                workout
                  .exercises
                  .length
              }
            </Text>
          </View>
  
          {workout.exercises.map(
            (
              exercise,
              index
            ) => {
              const focus =
                normalizeFocus(
                  exercise.focus
                );
  
              const volume =
                calculateExerciseVolume(
                  exercise
                );
  
              const topSet =
                getTopSet(
                  exercise
                );
  
              const prStatus =
                getExercisePRStatus(
                  workout,
                  exercise
                );
  
              const hasPR =
                prStatus.weightPR ||
                prStatus.repPR ||
                prStatus.volumePR;
  
              const completedSets =
                exercise.sets.filter(
                  (set) =>
                    set.completed
                );
  
              return (
                <View
                  key={
                    exercise.id
                  }
                  style={
                    styles.exerciseCard
                  }
                >
                  <View
                    style={
                      styles.exerciseHeader
                    }
                  >
                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          styles.exerciseNumber
                        }
                      >
                        EXERCISE{' '}
                        {index +
                          1}
                      </Text>
  
                      <Text
                        style={
                          styles.exerciseName
                        }
                      >
                        {
                          exercise.name
                        }
                      </Text>
                    </View>
  
                    <View
                      style={[
                        styles.focusBadge,
  
                        focus ===
                        'PR'
                          ? styles.focusBadgePR
                          : styles.focusBadgeVolume,
                      ]}
                    >
                      <Text
                        style={[
                          styles.focusText,
  
                          focus ===
                            'PR' &&
                            styles.focusTextDark,
                        ]}
                      >
                        {focus}
                      </Text>
                    </View>
                  </View>
  
                  {hasPR && (
                    <View
                      style={
                        styles.prRow
                      }
                    >
                      {prStatus.weightPR && (
                        <View
                          style={
                            styles.prBadge
                          }
                        >
                          <Text
                            style={
                              styles.prBadgeText
                            }
                          >
                            WEIGHT PR
                          </Text>
                        </View>
                      )}
  
                      {prStatus.repPR && (
                        <View
                          style={
                            styles.prBadge
                          }
                        >
                          <Text
                            style={
                              styles.prBadgeText
                            }
                          >
                            REP PR
                          </Text>
                        </View>
                      )}
  
                      {prStatus.volumePR && (
                        <View
                          style={
                            styles.prBadge
                          }
                        >
                          <Text
                            style={
                              styles.prBadgeText
                            }
                          >
                            VOLUME PR
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
  
                  <View
                    style={
                      styles.exerciseStats
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.exerciseStatLabel
                        }
                      >
                        TOP SET
                      </Text>
  
                      <Text
                        style={
                          styles.exerciseStatValue
                        }
                      >
                        {topSet
                          ? `${topSet.weight}kg × ${topSet.reps}`
                          : '—'}
                      </Text>
                    </View>
  
                    <View
                      style={
                        styles.exerciseStatRight
                      }
                    >
                      <Text
                        style={
                          styles.exerciseStatLabel
                        }
                      >
                        VOLUME
                      </Text>
  
                      <Text
                        style={
                          styles.exerciseStatValue
                        }
                      >
                        {volume.toLocaleString()}
                        kg
                      </Text>
                    </View>
                  </View>
  
                  <View
                    style={
                      styles.setHeader
                    }
                  >
                    <Text
                      style={[
                        styles.setHeaderText,
                        styles.setNumberColumn,
                      ]}
                    >
                      SET
                    </Text>
  
                    <Text
                      style={[
                        styles.setHeaderText,
                        styles.setValueColumn,
                      ]}
                    >
                      KG
                    </Text>
  
                    <Text
                      style={[
                        styles.setHeaderText,
                        styles.setValueColumn,
                      ]}
                    >
                      REPS
                    </Text>
                  </View>
  
                  {completedSets.map(
                    (
                      set,
                      setIndex
                    ) => {
                      const setNote =
                        set.note ??
                        '';
  
                      return (
                        <View
                          key={
                            set.id
                          }
                          style={
                            styles.setBlock
                          }
                        >
                          <View
                            style={
                              styles.setRow
                            }
                          >
                            <Text
                              style={[
                                styles.setNumber,
                                styles.setNumberColumn,
                              ]}
                            >
                              {setIndex +
                                1}
                            </Text>
  
                            <Text
                              style={[
                                styles.setValue,
                                styles.setValueColumn,
                              ]}
                            >
                              {
                                set.weight
                              }
                            </Text>
  
                            <Text
                              style={[
                                styles.setValue,
                                styles.setValueColumn,
                              ]}
                            >
                              {
                                set.reps
                              }
                            </Text>
                          </View>
  
                          {setNote
                            .trim()
                            .length >
                            0 && (
                            <View
                              style={
                                styles.setNote
                              }
                            >
                              <Text
                                style={
                                  styles.setNoteLabel
                                }
                              >
                                SET NOTE
                              </Text>
  
                              <Text
                                style={
                                  styles.setNoteText
                                }
                              >
                                {
                                  setNote
                                }
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    }
                  )}
  
                  {exercise.note
                    .trim()
                    .length >
                    0 && (
                    <View
                      style={
                        styles.exerciseNoteCard
                      }
                    >
                      <Text
                        style={
                          styles.noteLabel
                        }
                      >
                        EXERCISE NOTE
                      </Text>
  
                      <Text
                        style={
                          styles.noteText
                        }
                      >
                        {
                          exercise.note
                        }
                      </Text>
                    </View>
                  )}
                </View>
              );
            }
          )}
  
          <View
            style={
              styles.endMark
            }
          >
            <Text
              style={
                styles.endMarkText
              }
            >
              WORK COMPLETE.
            </Text>
  
            <Text
              style={
                styles.endSub
              }
            >
              NO FLEX. JUST WORK.
            </Text>
          </View>
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
  
      centerState: {
        flex: 1,
        alignItems:
          'center',
        justifyContent:
          'center',
      },
  
      stateText: {
        color: '#666',
        fontWeight:
          '900',
        letterSpacing: 1.5,
      },
  
      backStateButton: {
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 7,
      },
  
      backStateText: {
        color:
          '#D9FF43',
        fontWeight:
          '900',
      },
  
      header: {
        flexDirection:
          'row',
        alignItems:
          'center',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor:
          '#1C1C1C',
      },
  
      backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor:
          '#171717',
        alignItems:
          'center',
        justifyContent:
          'center',
        marginRight: 14,
      },
  
      backButtonText: {
        color: '#DDD',
        fontSize: 21,
        fontWeight:
          '800',
      },
  
      headerLabel: {
        color: '#555',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 2,
      },
  
      headerTitle: {
        color:
          '#F5F5F2',
        fontSize: 26,
        fontWeight:
          '900',
        marginTop: 2,
      },
  
      content: {
        padding: 16,
        paddingBottom: 50,
      },
  
      dateSection: {
        paddingVertical: 12,
      },
  
      date: {
        color:
          '#F5F5F2',
        fontSize: 23,
        lineHeight: 29,
        fontWeight:
          '900',
      },
  
      timeRange: {
        color: '#666',
        marginTop: 6,
        fontSize: 11,
        fontWeight:
          '700',
      },
  
      summaryCard: {
        flexDirection:
          'row',
        backgroundColor:
          '#111111',
        borderWidth: 1,
        borderColor:
          '#252525',
        borderRadius: 12,
        marginTop: 10,
        marginBottom: 26,
        paddingVertical: 17,
      },
  
      summaryItem: {
        flex: 1,
        alignItems:
          'center',
      },
  
      summaryDivider: {
        width: 1,
        backgroundColor:
          '#252525',
      },
  
      summaryLabel: {
        color: '#555',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 1.4,
      },
  
      summaryValue: {
        color:
          '#F5F5F2',
        fontSize: 14,
        fontWeight:
          '900',
        marginTop: 6,
      },
  
      sectionHeader: {
        flexDirection:
          'row',
        justifyContent:
          'space-between',
        alignItems:
          'center',
        marginBottom: 11,
      },
  
      sectionLabel: {
        color: '#666',
        fontSize: 9,
        fontWeight:
          '900',
        letterSpacing: 2,
      },
  
      sectionCount: {
        color:
          '#D9FF43',
        fontSize: 12,
        fontWeight:
          '900',
      },
  
      exerciseCard: {
        backgroundColor:
          '#111111',
        borderWidth: 1,
        borderColor:
          '#252525',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
      },
  
      exerciseHeader: {
        flexDirection:
          'row',
        justifyContent:
          'space-between',
        alignItems:
          'flex-start',
      },
  
      exerciseNumber: {
        color: '#555',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 1.5,
      },
  
      exerciseName: {
        color:
          '#F5F5F2',
        fontSize: 20,
        fontWeight:
          '900',
        marginTop: 4,
      },
  
      focusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 5,
      },
  
      focusBadgeVolume: {
        backgroundColor:
          '#202617',
        borderWidth: 1,
        borderColor:
          '#34401E',
      },
  
      focusBadgePR: {
        backgroundColor:
          '#D9FF43',
      },
  
      focusText: {
        color:
          '#D9FF43',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 1,
      },
  
      focusTextDark: {
        color:
          '#080808',
      },
  
      prRow: {
        flexDirection:
          'row',
        flexWrap:
          'wrap',
        gap: 6,
        marginTop: 13,
      },
  
      prBadge: {
        backgroundColor:
          '#D9FF43',
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 4,
      },
  
      prBadgeText: {
        color:
          '#080808',
        fontSize: 8,
        fontWeight:
          '900',
      },
  
      exerciseStats: {
        flexDirection:
          'row',
        justifyContent:
          'space-between',
        backgroundColor:
          '#0C0C0C',
        borderRadius: 8,
        padding: 12,
        marginTop: 14,
        marginBottom: 16,
      },
  
      exerciseStatRight: {
        alignItems:
          'flex-end',
      },
  
      exerciseStatLabel: {
        color: '#555',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 1.2,
      },
  
      exerciseStatValue: {
        color: '#BBB',
        fontSize: 13,
        fontWeight:
          '900',
        marginTop: 4,
      },
  
      setHeader: {
        flexDirection:
          'row',
        paddingBottom: 7,
        borderBottomWidth: 1,
        borderBottomColor:
          '#222',
      },
  
      setHeaderText: {
        color: '#555',
        fontSize: 8,
        fontWeight:
          '900',
        textAlign:
          'center',
      },
  
      setNumberColumn: {
        width: 50,
        textAlign:
          'center',
      },
  
      setValueColumn: {
        flex: 1,
        textAlign:
          'center',
      },
  
      setBlock: {
        borderBottomWidth: 1,
        borderBottomColor:
          '#1B1B1B',
      },
  
      setRow: {
        flexDirection:
          'row',
        paddingVertical: 11,
      },
  
      setNumber: {
        color: '#666',
        fontSize: 12,
        fontWeight:
          '900',
      },
  
      setValue: {
        color: '#DDD',
        fontSize: 14,
        fontWeight:
          '900',
      },
  
      setNote: {
        marginLeft: 50,
        marginRight: 8,
        marginBottom: 11,
        backgroundColor:
          '#0B0B0B',
        borderLeftWidth: 2,
        borderLeftColor:
          '#3A4815',
        paddingHorizontal: 10,
        paddingVertical: 8,
      },
  
      setNoteLabel: {
        color: '#505A31',
        fontSize: 7,
        fontWeight:
          '900',
        letterSpacing: 1.2,
      },
  
      setNoteText: {
        color: '#898989',
        fontSize: 11,
        lineHeight: 17,
        marginTop: 4,
      },
  
      exerciseNoteCard: {
        marginTop: 15,
        backgroundColor:
          '#0C0C0C',
        borderLeftWidth: 2,
        borderLeftColor:
          '#D9FF43',
        padding: 12,
      },
  
      noteLabel: {
        color: '#555',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 1.3,
      },
  
      noteText: {
        color: '#AAA',
        fontSize: 12,
        lineHeight: 19,
        marginTop: 6,
      },
  
      endMark: {
        alignItems:
          'center',
        paddingVertical: 40,
      },
  
      endMarkText: {
        color: '#666',
        fontSize: 11,
        fontWeight:
          '900',
        letterSpacing: 2,
      },
  
      endSub: {
        color: '#333',
        fontSize: 8,
        fontWeight:
          '900',
        letterSpacing: 1.8,
        marginTop: 6,
      },
    });