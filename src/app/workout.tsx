import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useRouter } from 'expo-router';

import {
    getWorkouts,
    saveWorkout,
} from '../lib/workoutStorage';

import type {
    WorkoutExercise,
    WorkoutSession,
} from '../lib/workoutStorage';

type SetItem = {
  id: number;
  weight: string;
  reps: string;
  completed: boolean;
};

type Exercise = {
  id: number;
  name: string;
  note: string;
  sets: SetItem[];
};

const EXERCISE_LIBRARY = [
  'BENCH PRESS',
  'INCLINE BENCH PRESS',
  'DUMBBELL BENCH PRESS',
  'INCLINE DUMBBELL PRESS',
  'CHEST PRESS',
  'PEC FLY',
  'CABLE FLY',
  'DIPS',

  'DEADLIFT',
  'LAT PULLDOWN',
  'PULL UP',
  'CHIN UP',
  'BARBELL ROW',
  'DUMBBELL ROW',
  'SEATED CABLE ROW',
  'T-BAR ROW',

  'OVERHEAD PRESS',
  'DUMBBELL SHOULDER PRESS',
  'LATERAL RAISE',
  'CABLE LATERAL RAISE',
  'REAR DELT FLY',
  'FACE PULL',

  'SQUAT',
  'FRONT SQUAT',
  'LEG PRESS',
  'HACK SQUAT',
  'ROMANIAN DEADLIFT',
  'LEG EXTENSION',
  'LEG CURL',
  'CALF RAISE',

  'BARBELL CURL',
  'DUMBBELL CURL',
  'HAMMER CURL',
  'CABLE CURL',
  'TRICEPS PUSHDOWN',
  'TRICEPS EXTENSION',
  'SKULL CRUSHER',
  'CLOSE GRIP BENCH PRESS',
];

export default function WorkoutScreen() {
  const router = useRouter();

  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [workoutHistory, setWorkoutHistory] =
    useState<WorkoutSession[]>([]);

  useEffect(() => {
    if (!workoutStarted) return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [workoutStarted]);

  useEffect(() => {
    const loadHistory = async () => {
      const data = await getWorkouts();
      setWorkoutHistory(data);
    };

    loadHistory();
  }, [workoutStarted]);

  const filteredExercises = useMemo(() => {
    const query = searchText.trim().toUpperCase();

    if (!query) {
      return EXERCISE_LIBRARY;
    }

    return EXERCISE_LIBRARY.filter((exercise) =>
      exercise.includes(query)
    );
  }, [searchText]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
        2,
        '0'
      )}:${String(secs).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(
      2,
      '0'
    )}`;
  };

  const calculateVolume = (
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

  // --------------------------------------------------
  // LAST SESSION
  // --------------------------------------------------

  const getLastExercise = (
    exerciseName: string
  ): WorkoutExercise | null => {
    for (const workout of workoutHistory) {
      const exercise = workout.exercises.find(
        (item) => item.name === exerciseName
      );

      if (exercise) {
        return exercise;
      }
    }

    return null;
  };

  const getLastCompletedSets = (exerciseName: string) => {
    const exercise = getLastExercise(exerciseName);

    if (!exercise) {
      return [];
    }

    return exercise.sets.filter(
      (set) => set.completed
    );
  };

  const getLastVolume = (exerciseName: string) => {
    const exercise = getLastExercise(exerciseName);

    if (!exercise) {
      return 0;
    }

    return calculateVolume(exercise.sets);
  };

  const copyLastSession = (
    exerciseId: number,
    exerciseName: string
  ) => {
    const lastSets =
      getLastCompletedSets(exerciseName);

    if (lastSets.length === 0) {
      Alert.alert(
        'NO PREVIOUS SESSION',
        'No previous sets were found for this exercise.'
      );

      return;
    }

    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: lastSets.map((set, index) => ({
            id: Date.now() + index,
            weight: set.weight,
            reps: set.reps,
            completed: false,
          })),
        };
      })
    );
  };

  const getPreviousSetAtIndex = (
    exerciseName: string,
    setIndex: number
  ) => {
    const lastSets =
      getLastCompletedSets(exerciseName);

    return lastSets[setIndex] ?? null;
  };

  // --------------------------------------------------
  // PR
  // --------------------------------------------------

  const getHistoricalMaxWeight = (exerciseName: string) => {
    let bestWeight = 0;

    workoutHistory.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        if (exercise.name !== exerciseName) {
          return;
        }

        exercise.sets.forEach((set) => {
          if (!set.completed) {
            return;
          }

          const weight = Number(set.weight) || 0;

          if (weight > bestWeight) {
            bestWeight = weight;
          }
        });
      });
    });

    return bestWeight;
  };

  const getHistoricalMaxRepsAtWeight = (
    exerciseName: string,
    weight: number
  ) => {
    let bestReps = 0;

    workoutHistory.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        if (exercise.name !== exerciseName) {
          return;
        }

        exercise.sets.forEach((set) => {
          if (!set.completed) {
            return;
          }

          const setWeight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;

          if (
            setWeight === weight &&
            reps > bestReps
          ) {
            bestReps = reps;
          }
        });
      });
    });

    return bestReps;
  };

  const getPR = (exerciseName: string) => {
    const bestWeight =
      getHistoricalMaxWeight(exerciseName);

    if (bestWeight === 0) {
      return '—';
    }

    let bestReps = 0;

    workoutHistory.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        if (exercise.name !== exerciseName) {
          return;
        }

        exercise.sets.forEach((set) => {
          if (!set.completed) {
            return;
          }

          const weight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;

          if (
            weight === bestWeight &&
            reps > bestReps
          ) {
            bestReps = reps;
          }
        });
      });
    });

    return `${bestWeight}kg × ${bestReps}`;
  };

  const getVolumePR = (exerciseName: string) => {
    let bestVolume = 0;

    workoutHistory.forEach((workout) => {
      const exercise = workout.exercises.find(
        (item) => item.name === exerciseName
      );

      if (!exercise) {
        return;
      }

      const volume =
        calculateVolume(exercise.sets);

      if (volume > bestVolume) {
        bestVolume = volume;
      }
    });

    return bestVolume;
  };

  const hasWeightPR = (exercise: Exercise) => {
    const historicalMax =
      getHistoricalMaxWeight(exercise.name);

    const currentMax = Math.max(
      0,
      ...exercise.sets
        .filter((set) => set.completed)
        .map((set) => Number(set.weight) || 0)
    );

    return (
      currentMax > 0 &&
      currentMax > historicalMax
    );
  };

  const hasRepPR = (exercise: Exercise) => {
    return exercise.sets
      .filter((set) => set.completed)
      .some((set) => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;

        if (weight <= 0 || reps <= 0) {
          return false;
        }

        const previousBest =
          getHistoricalMaxRepsAtWeight(
            exercise.name,
            weight
          );

        return reps > previousBest;
      });
  };

  const hasVolumePR = (exercise: Exercise) => {
    const currentVolume =
      calculateVolume(exercise.sets);

    const historicalBest =
      getVolumePR(exercise.name);

    return (
      currentVolume > 0 &&
      currentVolume > historicalBest
    );
  };

  const getSetPRType = (
    exerciseName: string,
    set: SetItem
  ) => {
    if (!set.completed) {
      return null;
    }

    const weight = Number(set.weight) || 0;
    const reps = Number(set.reps) || 0;

    if (weight <= 0 || reps <= 0) {
      return null;
    }

    const historicalMaxWeight =
      getHistoricalMaxWeight(exerciseName);

    if (weight > historicalMaxWeight) {
      return 'WEIGHT PR';
    }

    const historicalMaxReps =
      getHistoricalMaxRepsAtWeight(
        exerciseName,
        weight
      );

    if (reps > historicalMaxReps) {
      return 'REP PR';
    }

    return null;
  };

  // --------------------------------------------------
  // VOLUME COMPARISON
  // --------------------------------------------------

  const getVolumeDifference = (exercise: Exercise) => {
    const currentVolume =
      calculateVolume(exercise.sets);

    const lastVolume =
      getLastVolume(exercise.name);

    return currentVolume - lastVolume;
  };

  const getVolumePercentage = (exercise: Exercise) => {
    const currentVolume =
      calculateVolume(exercise.sets);

    const lastVolume =
      getLastVolume(exercise.name);

    if (lastVolume === 0) {
      return null;
    }

    return (
      ((currentVolume - lastVolume) / lastVolume) *
      100
    );
  };

  // --------------------------------------------------
  // WORKOUT ACTIONS
  // --------------------------------------------------

  const startWorkout = () => {
    setWorkoutStarted(true);
    setSeconds(0);
    setExercises([]);
  };

  const openExerciseModal = () => {
    setSearchText('');
    setExerciseModalVisible(true);
  };

  const selectExercise = (name: string) => {
    const newExercise: Exercise = {
      id: Date.now(),
      name,
      note: '',
      sets: [
        {
          id: Date.now() + 1,
          weight: '',
          reps: '',
          completed: false,
        },
      ],
    };

    setExercises((prev) => [
      ...prev,
      newExercise,
    ]);

    setExerciseModalVisible(false);
    setSearchText('');
  };

  const addCustomExercise = () => {
    const name =
      searchText.trim().toUpperCase();

    if (!name) {
      return;
    }

    selectExercise(name);
  };

  const removeExercise = (exerciseId: number) => {
    setExercises((prev) =>
      prev.filter(
        (exercise) =>
          exercise.id !== exerciseId
      )
    );
  };

  const addSet = (exerciseId: number) => {
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const lastSet =
          exercise.sets[
            exercise.sets.length - 1
          ];

        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              id: Date.now(),
              weight:
                lastSet?.weight ?? '',
              reps:
                lastSet?.reps ?? '',
              completed: false,
            },
          ],
        };
      })
    );
  };

  const updateSet = (
    exerciseId: number,
    setId: number,
    field: 'weight' | 'reps',
    value: string
  ) => {
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map(
            (set) =>
              set.id === setId
                ? {
                    ...set,
                    [field]: value,
                  }
                : set
          ),
        };
      })
    );
  };

  const toggleSetComplete = (
    exerciseId: number,
    setId: number
  ) => {
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map(
            (set) =>
              set.id === setId
                ? {
                    ...set,
                    completed:
                      !set.completed,
                  }
                : set
          ),
        };
      })
    );
  };

  const finishWorkout = () => {
    if (exercises.length === 0) {
      Alert.alert(
        'NO EXERCISES',
        'Add at least one exercise first.'
      );

      return;
    }

    const completedExercises =
      exercises
        .map((exercise) => ({
          ...exercise,
          sets: exercise.sets.filter(
            (set) => set.completed
          ),
        }))
        .filter(
          (exercise) =>
            exercise.sets.length > 0
        );

    if (completedExercises.length === 0) {
      Alert.alert(
        'NO COMPLETED SETS',
        'Complete at least one set first.'
      );

      return;
    }

    const completedSets =
      completedExercises.reduce(
        (sum, exercise) =>
          sum + exercise.sets.length,
        0
      );

    Alert.alert(
      'FINISH WORKOUT?',
      `${completedExercises.length} exercises\n${completedSets} sets\nTime: ${formatTime(
        seconds
      )}`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'FINISH',
          onPress: async () => {
            const now = new Date();

            const workout: WorkoutSession = {
              id: `${Date.now()}`,
              startedAt: new Date(
                now.getTime() -
                  seconds * 1000
              ).toISOString(),
              finishedAt:
                now.toISOString(),
              durationSeconds: seconds,
              exercises:
                completedExercises,
            };

            try {
              await saveWorkout(workout);

              const updatedHistory =
                await getWorkouts();

              setWorkoutHistory(
                updatedHistory
              );

              setWorkoutStarted(false);
              setSeconds(0);
              setExercises([]);

              router.push({
                pathname: '/post',
                params: {
                  workout:
                    JSON.stringify(workout),
                },
              });
            } catch {
              Alert.alert(
                'ERROR',
                'Could not save workout.'
              );
            }
          },
        },
      ]
    );
  };

  // --------------------------------------------------
  // START SCREEN
  // --------------------------------------------------

  if (!workoutStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.startScreen}>
          <Text style={styles.startLabel}>
            LOADS
          </Text>

          <Text style={styles.startTitle}>
            READY{'\n'}TO LOAD?
          </Text>

          <Text style={styles.startDescription}>
            Track the work.{'\n'}
            Beat the last session.
          </Text>

          <Pressable
            style={styles.startWorkoutButton}
            onPress={startWorkout}
          >
            <Text style={styles.startWorkoutText}>
              START WORKOUT
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------
  // WORKOUT SCREEN
  // --------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.smallLabel}>
            CURRENT SESSION
          </Text>

          <Text style={styles.title}>
            WORKOUT
          </Text>
        </View>

        <Text style={styles.timer}>
          {formatTime(seconds)}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {exercises.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              NO EXERCISES YET.
            </Text>

            <Text style={styles.emptyDescription}>
              Add your first movement to start logging.
            </Text>
          </View>
        )}

        {exercises.map(
          (
            exercise,
            exerciseIndex
          ) => {
            const currentVolume =
              calculateVolume(
                exercise.sets
              );

            const lastVolume =
              getLastVolume(
                exercise.name
              );

            const lastSets =
              getLastCompletedSets(
                exercise.name
              );

            const volumeDiff =
              getVolumeDifference(
                exercise
              );

            const volumePercent =
              getVolumePercentage(
                exercise
              );

            const weightPR =
              hasWeightPR(exercise);

            const repPR =
              hasRepPR(exercise);

            const volumePR =
              hasVolumePR(exercise);

            return (
              <View
                key={exercise.id}
                style={styles.exerciseCard}
              >
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseTitleArea}>
                    <Text style={styles.exerciseNumber}>
                      EXERCISE {exerciseIndex + 1}
                    </Text>

                    <Text style={styles.exerciseName}>
                      {exercise.name}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      removeExercise(
                        exercise.id
                      )
                    }
                    style={styles.removeExerciseButton}
                  >
                    <Text style={styles.removeExerciseText}>
                      ×
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.prOverview}>
                  <View>
                    <Text style={styles.overviewLabel}>
                      ALL-TIME PR
                    </Text>

                    <Text style={styles.overviewValue}>
                      {getPR(
                        exercise.name
                      )}
                    </Text>
                  </View>

                  <View style={styles.overviewRight}>
                    <Text style={styles.overviewLabel}>
                      LAST VOLUME
                    </Text>

                    <Text style={styles.overviewValue}>
                      {lastVolume > 0
                        ? `${lastVolume.toLocaleString()}kg`
                        : '—'}
                    </Text>
                  </View>
                </View>

                {/* LAST SESSION */}

                <View style={styles.lastSessionCard}>
                  <View style={styles.lastSessionHeader}>
                    <View>
                      <Text style={styles.lastSessionLabel}>
                        LAST SESSION
                      </Text>

                      <Text style={styles.lastSessionSub}>
                        PREVIOUS SETS
                      </Text>
                    </View>

                    {lastSets.length > 0 && (
                      <Pressable
                        style={styles.copyButton}
                        onPress={() =>
                          copyLastSession(
                            exercise.id,
                            exercise.name
                          )
                        }
                      >
                        <Text style={styles.copyButtonText}>
                          COPY LAST
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {lastSets.length === 0 ? (
                    <Text style={styles.noLastSession}>
                      NO PREVIOUS SESSION
                    </Text>
                  ) : (
                    <View style={styles.lastSetsList}>
                      {lastSets.map(
                        (set, index) => (
                          <View
                            key={`${exercise.name}-last-${index}`}
                            style={styles.lastSetRow}
                          >
                            <Text style={styles.lastSetNumber}>
                              {index + 1}
                            </Text>

                            <Text style={styles.lastSetValue}>
                              {set.weight}kg × {set.reps}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  )}
                </View>

                {/* CURRENT VOLUME */}

                <View style={styles.volumeContainer}>
                  <View>
                    <Text style={styles.volumeLabel}>
                      CURRENT VOLUME
                    </Text>

                    <Text style={styles.volumeValue}>
                      {currentVolume.toLocaleString()}kg
                    </Text>
                  </View>

                  <View style={styles.volumeRight}>
                    {lastVolume > 0 ? (
                      <>
                        <Text
                          style={
                            volumeDiff >= 0
                              ? styles.volumePositive
                              : styles.volumeNegative
                          }
                        >
                          {volumeDiff >= 0
                            ? '+'
                            : ''}
                          {volumeDiff.toLocaleString()}
                          kg
                        </Text>

                        {volumePercent !== null && (
                          <Text style={styles.volumePercent}>
                            {volumePercent >= 0
                              ? '+'
                              : ''}
                            {volumePercent.toFixed(1)}
                            %
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.firstRecord}>
                        FIRST RECORD
                      </Text>
                    )}
                  </View>
                </View>

                {(weightPR ||
                  repPR ||
                  volumePR) && (
                  <View style={styles.prContainer}>
                    {weightPR && (
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>
                          WEIGHT PR
                        </Text>
                      </View>
                    )}

                    {repPR && (
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>
                          REP PR
                        </Text>
                      </View>
                    )}

                    {volumePR && (
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>
                          VOLUME PR
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.tableHeader}>
                  <Text
                    style={[
                      styles.tableHeaderText,
                      styles.setColumn,
                    ]}
                  >
                    SET
                  </Text>

                  <Text
                    style={[
                      styles.tableHeaderText,
                      styles.inputColumn,
                    ]}
                  >
                    KG
                  </Text>

                  <Text
                    style={[
                      styles.tableHeaderText,
                      styles.inputColumn,
                    ]}
                  >
                    REPS
                  </Text>

                  <Text
                    style={[
                      styles.tableHeaderText,
                      styles.doneColumn,
                    ]}
                  >
                    DONE
                  </Text>
                </View>

                {exercise.sets.map(
                  (set, setIndex) => {
                    const setPRType =
                      getSetPRType(
                        exercise.name,
                        set
                      );

                    const previousSet =
                      getPreviousSetAtIndex(
                        exercise.name,
                        setIndex
                      );

                    return (
                      <View
                        key={set.id}
                        style={[
                          styles.setBlock,
                          setPRType &&
                            styles.setBlockPR,
                        ]}
                      >
                        <View style={styles.setRow}>
                          <View style={styles.setColumn}>
                            <Text style={styles.setNumber}>
                              {setIndex + 1}
                            </Text>

                            {setPRType && (
                              <View style={styles.setPRBadge}>
                                <Text style={styles.setPRBadgeText}>
                                  PR
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.inputColumn}>
                            <TextInput
                              value={set.weight}
                              onChangeText={(value) =>
                                updateSet(
                                  exercise.id,
                                  set.id,
                                  'weight',
                                  value.replace(
                                    /[^0-9.]/g,
                                    ''
                                  )
                                )
                              }
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor="#555"
                              style={[
                                styles.numberInput,
                                set.completed &&
                                  styles.completedInput,
                              ]}
                            />
                          </View>

                          <View style={styles.inputColumn}>
                            <TextInput
                              value={set.reps}
                              onChangeText={(value) =>
                                updateSet(
                                  exercise.id,
                                  set.id,
                                  'reps',
                                  value.replace(
                                    /[^0-9]/g,
                                    ''
                                  )
                                )
                              }
                              keyboardType="number-pad"
                              placeholder="0"
                              placeholderTextColor="#555"
                              style={[
                                styles.numberInput,
                                set.completed &&
                                  styles.completedInput,
                              ]}
                            />
                          </View>

                          <View style={styles.doneColumn}>
                            <Pressable
                              onPress={() =>
                                toggleSetComplete(
                                  exercise.id,
                                  set.id
                                )
                              }
                              style={[
                                styles.completeButton,
                                set.completed &&
                                  styles.completeButtonActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.completeButtonText,
                                  set.completed &&
                                    styles.completeButtonTextActive,
                                ]}
                              >
                                ✓
                              </Text>
                            </Pressable>
                          </View>
                        </View>

                        {previousSet && (
                          <View style={styles.previousSetLine}>
                            <Text style={styles.previousSetLabel}>
                              LAST
                            </Text>

                            <Text style={styles.previousSetValue}>
                              {previousSet.weight}kg ×{' '}
                              {previousSet.reps}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  }
                )}

                <Pressable
                  onPress={() =>
                    addSet(
                      exercise.id
                    )
                  }
                  style={styles.addSetButton}
                >
                  <Text style={styles.addSetText}>
                    + ADD SET
                  </Text>
                </Pressable>

                <TextInput
                  value={exercise.note}
                  onChangeText={(value) => {
                    setExercises(
                      (prev) =>
                        prev.map(
                          (item) =>
                            item.id ===
                            exercise.id
                              ? {
                                  ...item,
                                  note: value,
                                }
                              : item
                        )
                    );
                  }}
                  placeholder="Session note..."
                  placeholderTextColor="#555"
                  multiline
                  style={styles.noteInput}
                />
              </View>
            );
          }
        )}

        <Pressable
          onPress={openExerciseModal}
          style={styles.addExerciseButton}
        >
          <Text style={styles.addExerciseText}>
            + ADD EXERCISE
          </Text>
        </Pressable>

        <Pressable
          onPress={finishWorkout}
          style={styles.finishButton}
        >
          <Text style={styles.finishButtonText}>
            FINISH WORKOUT
          </Text>
        </Pressable>
      </ScrollView>

      {/* EXERCISE MODAL */}

      <Modal
        visible={exerciseModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setExerciseModalVisible(false)
        }
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalLabel}>
                LOAD MOVEMENT
              </Text>

              <Text style={styles.modalTitle}>
                ADD EXERCISE
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setExerciseModalVisible(
                  false
                )
              }
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>
                ×
              </Text>
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              autoFocus
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search exercise..."
              placeholderTextColor="#666"
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.exerciseList}
            renderItem={({ item }) => (
              <Pressable
                style={styles.exerciseOption}
                onPress={() =>
                  selectExercise(
                    item
                  )
                }
              >
                <Text style={styles.exerciseOptionText}>
                  {item}
                </Text>

                <Text style={styles.exerciseOptionPlus}>
                  +
                </Text>
              </Pressable>
            )}
          />

          {searchText.trim().length > 0 &&
            !EXERCISE_LIBRARY.includes(
              searchText
                .trim()
                .toUpperCase()
            ) && (
              <View style={styles.customArea}>
                <Pressable
                  style={styles.customExerciseButton}
                  onPress={addCustomExercise}
                >
                  <Text style={styles.customExerciseText}>
                    + ADD "
                    {searchText
                      .trim()
                      .toUpperCase()}
                    "
                  </Text>
                </Pressable>
              </View>
            )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  startScreen: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },

  startLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
  },

  startTitle: {
    marginTop: 16,
    color: '#F5F5F2',
    fontSize: 64,
    lineHeight: 62,
    fontWeight: '900',
    letterSpacing: -2,
  },

  startDescription: {
    marginTop: 26,
    color: '#888',
    fontSize: 17,
    lineHeight: 27,
    fontWeight: '600',
  },

  startWorkoutButton: {
    marginTop: 42,
    backgroundColor: '#D9FF43',
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
  },

  startWorkoutText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D1D',
  },

  smallLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },

  title: {
    marginTop: 4,
    color: '#F5F5F2',
    fontSize: 34,
    fontWeight: '900',
  },

  timer: {
    color: '#D9FF43',
    fontSize: 22,
    fontWeight: '900',
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  emptyState: {
    paddingVertical: 70,
    alignItems: 'center',
  },

  emptyTitle: {
    color: '#777',
    fontWeight: '900',
  },

  emptyDescription: {
    color: '#555',
    marginTop: 8,
  },

  exerciseCard: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  exerciseTitleArea: {
    flex: 1,
  },

  exerciseNumber: {
    color: '#666',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },

  exerciseName: {
    color: '#F5F5F2',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 5,
  },

  removeExerciseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeExerciseText: {
    color: '#777',
    fontSize: 24,
  },

  prOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 12,
  },

  overviewRight: {
    alignItems: 'flex-end',
  },

  overviewLabel: {
    color: '#555',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  overviewValue: {
    marginTop: 4,
    color: '#AAA',
    fontSize: 13,
    fontWeight: '900',
  },

  lastSessionCard: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#252525',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },

  lastSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  lastSessionLabel: {
    color: '#F5F5F2',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  lastSessionSub: {
    color: '#555',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 3,
  },

  copyButton: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  copyButtonText: {
    color: '#D9FF43',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  noLastSession: {
    color: '#555',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 16,
  },

  lastSetsList: {
    marginTop: 14,
  },

  lastSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },

  lastSetNumber: {
    width: 26,
    color: '#555',
    fontSize: 10,
    fontWeight: '900',
  },

  lastSetValue: {
    color: '#AAAAAA',
    fontSize: 13,
    fontWeight: '800',
  },

  volumeContainer: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 9,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  volumeLabel: {
    color: '#666',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
  },

  volumeValue: {
    color: '#F5F5F2',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },

  volumeRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  volumePositive: {
    color: '#D9FF43',
    fontWeight: '900',
  },

  volumeNegative: {
    color: '#888',
    fontWeight: '900',
  },

  volumePercent: {
    color: '#777',
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
  },

  firstRecord: {
    color: '#666',
    fontSize: 10,
    fontWeight: '900',
  },

  prContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },

  prBadge: {
    backgroundColor: '#D9FF43',
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  prBadgeText: {
    color: '#080808',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
  },

  tableHeaderText: {
    color: '#555',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },

  setBlock: {
    marginBottom: 9,
    borderRadius: 8,
  },

  setBlockPR: {
    backgroundColor: '#101307',
  },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  setColumn: {
    width: 44,
    alignItems: 'center',
  },

  inputColumn: {
    flex: 1,
    marginHorizontal: 4,
  },

  doneColumn: {
    width: 58,
    alignItems: 'center',
  },

  setNumber: {
    color: '#777',
    fontSize: 15,
    fontWeight: '900',
  },

  setPRBadge: {
    marginTop: 4,
    backgroundColor: '#D9FF43',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },

  setPRBadgeText: {
    color: '#080808',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  numberInput: {
    backgroundColor: '#1B1B1B',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 8,
    color: '#F5F5F2',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    paddingVertical: 10,
  },

  completedInput: {
    borderColor: '#3A4815',
    color: '#D9FF43',
  },

  completeButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  completeButtonActive: {
    backgroundColor: '#D9FF43',
  },

  completeButtonText: {
    color: '#555',
    fontSize: 18,
    fontWeight: '900',
  },

  completeButtonTextActive: {
    color: '#080808',
  },

  previousSetLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 52,
    marginTop: 5,
  },

  previousSetLabel: {
    color: '#444',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginRight: 7,
  },

  previousSetValue: {
    color: '#626262',
    fontSize: 10,
    fontWeight: '800',
  },

  addSetButton: {
    marginTop: 8,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    alignItems: 'center',
  },

  addSetText: {
    color: '#AAA',
    fontWeight: '900',
  },

  noteInput: {
    marginTop: 12,
    minHeight: 54,
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    color: '#DDD',
    padding: 12,
  },

  addExerciseButton: {
    borderWidth: 1,
    borderColor: '#343434',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },

  addExerciseText: {
    color: '#AAA',
    fontWeight: '900',
  },

  finishButton: {
    backgroundColor: '#D9FF43',
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
  },

  finishButtonText: {
    color: '#080808',
    fontWeight: '900',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },

  modalHeader: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  modalLabel: {
    color: '#666',
    fontSize: 9,
    fontWeight: '900',
  },

  modalTitle: {
    color: '#F5F5F2',
    fontSize: 30,
    fontWeight: '900',
  },

  modalClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1B1B1B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalCloseText: {
    color: '#AAA',
    fontSize: 27,
  },

  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  searchInput: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 10,
    color: '#F5F5F2',
    fontSize: 16,
    padding: 14,
  },

  exerciseList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  exerciseOption: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D1D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  exerciseOptionText: {
    color: '#EDEDEA',
    fontSize: 15,
    fontWeight: '800',
  },

  exerciseOptionPlus: {
    color: '#D9FF43',
    fontSize: 22,
  },

  customArea: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
  },

  customExerciseButton: {
    backgroundColor: '#D9FF43',
    paddingVertical: 17,
    borderRadius: 8,
    alignItems: 'center',
  },

  customExerciseText: {
    color: '#080808',
    fontWeight: '900',
  },
});