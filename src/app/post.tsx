import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import * as ImagePicker from 'expo-image-picker';

import {
  getWorkouts,
} from '../lib/workoutStorage';

import {
  savePost,
} from '../lib/postStorage';

import type {
  ExerciseFocus,
  WorkoutExercise,
  WorkoutSession,
} from '../lib/workoutStorage';

import type {
  PostPRType,
  WorkoutPost,
  WorkoutPostExercise,
} from '../lib/postStorage';

export default function PostScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      workout?: string;
    }>();

  const [
    workout,
    setWorkout,
  ] =
    useState<WorkoutSession | null>(
      null
    );

  const [
    workoutHistory,
    setWorkoutHistory,
  ] =
    useState<WorkoutSession[]>([]);

  const [
    photoUri,
    setPhotoUri,
  ] =
    useState<string | null>(
      null
    );

  const [
    caption,
    setCaption,
  ] = useState('');

  const [
    posting,
    setPosting,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  // --------------------------------
  // LOAD
  // --------------------------------

  useEffect(() => {
    const initialize =
      async () => {
        try {
          if (
            typeof params.workout !==
            'string'
          ) {
            return;
          }

          const parsed:
            WorkoutSession =
            JSON.parse(
              params.workout
            );

          setWorkout(parsed);

          const history =
            await getWorkouts();

          setWorkoutHistory(
            history
          );
        } catch (error) {
          console.error(
            'Failed to load post workout:',
            error
          );
        } finally {
          setLoading(false);
        }
      };

    initialize();
  }, [params.workout]);

  // --------------------------------
  // HELPERS
  // --------------------------------

  const normalizeFocus = (
    focus?: ExerciseFocus
  ): ExerciseFocus => {
    return focus ?? 'VOLUME';
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
            weight * reps
          );
        },
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

  // --------------------------------
  // ONLY WORKOUTS BEFORE THIS ONE
  // --------------------------------

  const getOlderWorkouts = (
    currentWorkout: WorkoutSession
  ) => {
    const currentTime =
      new Date(
        currentWorkout.finishedAt
      ).getTime();

    return workoutHistory.filter(
      (item) =>
        item.id !==
          currentWorkout.id &&
        new Date(
          item.finishedAt
        ).getTime() <
          currentTime
    );
  };

  // --------------------------------
  // PR DETECTION
  // --------------------------------

  const getPRTypes = (
    currentWorkout: WorkoutSession,
    exercise: WorkoutExercise
  ): PostPRType[] => {
    const olderWorkouts =
      getOlderWorkouts(
        currentWorkout
      );

    let historicalMaxWeight =
      0;

    let historicalVolume =
      0;

    const historicalRepsByWeight =
      new Map<
        number,
        number
      >();

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

                if (
                  weight >
                  historicalMaxWeight
                ) {
                  historicalMaxWeight =
                    weight;
                }

                const previousReps =
                  historicalRepsByWeight.get(
                    weight
                  ) ?? 0;

                if (
                  reps >
                  previousReps
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
              const oldVolume =
                calculateExerciseVolume(
                  oldExercise
                );

              if (
                oldVolume >
                historicalVolume
              ) {
                historicalVolume =
                  oldVolume;
              }
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
      currentMaxWeight > 0 &&
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
      currentVolume > 0 &&
      currentVolume >
        historicalVolume;

    const result:
      PostPRType[] = [];

    if (weightPR) {
      result.push(
        'WEIGHT PR'
      );
    }

    if (repPR) {
      result.push(
        'REP PR'
      );
    }

    if (volumePR) {
      result.push(
        'VOLUME PR'
      );
    }

    return result;
  };

  // --------------------------------
  // POST EXERCISES
  // --------------------------------

  const postExercises =
    useMemo<
      WorkoutPostExercise[]
    >(() => {
      if (!workout) {
        return [];
      }

      return workout.exercises.map(
        (exercise) => {
          const topSet =
            getTopSet(
              exercise
            );

          return {
            id:
              exercise.id,

            name:
              exercise.name,

            focus:
              normalizeFocus(
                exercise.focus
              ),

            bestWeight:
              topSet
                ? Number(
                    topSet.weight
                  ) || 0
                : 0,

            bestReps:
              topSet
                ? Number(
                    topSet.reps
                  ) || 0
                : 0,

            sets:
              exercise.sets.filter(
                (set) =>
                  set.completed
              ).length,

            volume:
              calculateExerciseVolume(
                exercise
              ),

            note:
              exercise.note,

            prTypes:
              getPRTypes(
                workout,
                exercise
              ),
          };
        }
      );
    }, [
      workout,
      workoutHistory,
    ]);

  const totalSets =
    useMemo(() => {
      return postExercises.reduce(
        (
          total,
          exercise
        ) =>
          total +
          exercise.sets,
        0
      );
    }, [postExercises]);

  const totalVolume =
    useMemo(() => {
      return postExercises.reduce(
        (
          total,
          exercise
        ) =>
          total +
          exercise.volume,
        0
      );
    }, [postExercises]);

  const prCount =
    useMemo(() => {
      return postExercises.reduce(
        (
          total,
          exercise
        ) =>
          total +
          exercise.prTypes
            .length,
        0
      );
    }, [postExercises]);

  // --------------------------------
  // CAMERA
  // --------------------------------

  const takePhoto =
    async () => {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'CAMERA PERMISSION',
          'Camera access is required to take a photo.'
        );

        return;
      }

      const result =
        await ImagePicker.launchCameraAsync(
          {
            allowsEditing:
              true,

            aspect:
              [4, 5],

            quality:
              0.85,
          }
        );

      if (
        !result.canceled
      ) {
        setPhotoUri(
          result.assets[0]
            .uri
        );
      }
    };

  const choosePhoto =
    async () => {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'PHOTO PERMISSION',
          'Photo library access is required.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes:
              ['images'],

            allowsEditing:
              true,

            aspect:
              [4, 5],

            quality:
              0.85,
          }
        );

      if (
        !result.canceled
      ) {
        setPhotoUri(
          result.assets[0]
            .uri
        );
      }
    };

  // --------------------------------
  // POST
  // --------------------------------

  const handlePost =
    async () => {
      if (
        !workout ||
        posting
      ) {
        return;
      }

      try {
        setPosting(true);

        const post:
          WorkoutPost =
          {
            id:
              `${Date.now()}`,

            workoutId:
              workout.id,

            createdAt:
              new Date()
                .toISOString(),

            caption:
              caption.trim(),

            photoUri,

            durationSeconds:
              workout.durationSeconds,

            totalSets,

            totalVolume,

            prCount,

            exercises:
              postExercises,
          };

        await savePost(
          post
        );

        router.replace('/');
      } catch (error) {
        console.error(
          'Failed to post workout:',
          error
        );

        Alert.alert(
          'ERROR',
          'Could not create post.'
        );
      } finally {
        setPosting(false);
      }
    };

  const skipPost = () => {
    router.replace('/');
  };

  // --------------------------------
  // STATES
  // --------------------------------

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
              styles.centerText
            }
          >
            LOADS
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
              styles.centerText
            }
          >
            WORKOUT NOT FOUND
          </Text>

          <Pressable
            onPress={
              skipPost
            }
            style={
              styles.returnButton
            }
          >
            <Text
              style={
                styles.returnButtonText
              }
            >
              RETURN HOME
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
        <View>
          <Text
            style={
              styles.headerLabel
            }
          >
            WORK COMPLETE
          </Text>

          <Text
            style={
              styles.title
            }
          >
            POST WORKOUT
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {prCount > 0 && (
          <View
            style={
              styles.prHero
            }
          >
            <Text
              style={
                styles.prHeroLabel
              }
            >
              SESSION RESULT
            </Text>

            <Text
              style={
                styles.prHeroNumber
              }
            >
              {prCount}
            </Text>

            <Text
              style={
                styles.prHeroText
              }
            >
              {prCount === 1
                ? 'PR TODAY'
                : 'PRS TODAY'}
            </Text>
          </View>
        )}

        <View
          style={
            styles.photoSection
          }
        >
          {photoUri ? (
            <>
              <Image
                source={{
                  uri:
                    photoUri,
                }}
                style={
                  styles.photo
                }
              />

              <View
                style={
                  styles.photoActions
                }
              >
                <Pressable
                  style={
                    styles.secondaryButton
                  }
                  onPress={
                    choosePhoto
                  }
                >
                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    CHANGE
                  </Text>
                </Pressable>

                <Pressable
                  style={
                    styles.secondaryButton
                  }
                  onPress={() =>
                    setPhotoUri(
                      null
                    )
                  }
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    REMOVE
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View
              style={
                styles.photoEmpty
              }
            >
              <Text
                style={
                  styles.photoEmptyLabel
                }
              >
                ADD TRAINING PHOTO
              </Text>

              <Text
                style={
                  styles.photoEmptyText
                }
              >
                Optional. The work
                still counts without
                it.
              </Text>

              <View
                style={
                  styles.photoButtonRow
                }
              >
                <Pressable
                  style={
                    styles.photoButton
                  }
                  onPress={
                    takePhoto
                  }
                >
                  <Text
                    style={
                      styles.photoButtonText
                    }
                  >
                    TAKE PHOTO
                  </Text>
                </Pressable>

                <Pressable
                  style={
                    styles.photoButton
                  }
                  onPress={
                    choosePhoto
                  }
                >
                  <Text
                    style={
                      styles.photoButtonText
                    }
                  >
                    LIBRARY
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
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
              {formatTime(
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

        <Text
          style={
            styles.sectionLabel
          }
        >
          WORK
        </Text>

        {postExercises.map(
          (exercise) => (
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
                <View>
                  <Text
                    style={
                      styles.exerciseName
                    }
                  >
                    {
                      exercise.name
                    }
                  </Text>

                  <Text
                    style={
                      styles.exerciseFocus
                    }
                  >
                    {
                      exercise.focus
                    }
                  </Text>
                </View>

                <Text
                  style={
                    styles.exerciseBest
                  }
                >
                  {exercise.bestWeight >
                  0
                    ? `${exercise.bestWeight}kg × ${exercise.bestReps}`
                    : '—'}
                </Text>
              </View>

              <View
                style={
                  styles.exerciseMeta
                }
              >
                <Text
                  style={
                    styles.exerciseMetaText
                  }
                >
                  {exercise.sets}{' '}
                  SETS
                </Text>

                <Text
                  style={
                    styles.exerciseMetaText
                  }
                >
                  {exercise.volume.toLocaleString()}
                  kg VOLUME
                </Text>
              </View>

              {exercise.prTypes
                .length >
                0 && (
                <View
                  style={
                    styles.prRow
                  }
                >
                  {exercise.prTypes.map(
                    (
                      pr
                    ) => (
                      <View
                        key={
                          pr
                        }
                        style={
                          styles.prBadge
                        }
                      >
                        <Text
                          style={
                            styles.prBadgeText
                          }
                        >
                          {pr}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              )}
            </View>
          )
        )}

        <Text
          style={[
            styles.sectionLabel,
            {
              marginTop: 10,
            },
          ]}
        >
          CAPTION
        </Text>

        <TextInput
          value={
            caption
          }
          onChangeText={
            setCaption
          }
          placeholder="Say something about the work..."
          placeholderTextColor="#555"
          multiline
          maxLength={300}
          style={
            styles.captionInput
          }
        />

        <Text
          style={
            styles.captionCount
          }
        >
          {caption.length}/300
        </Text>

        <Pressable
          onPress={
            handlePost
          }
          disabled={
            posting
          }
          style={[
            styles.postButton,

            posting &&
              styles.disabledButton,
          ]}
        >
          <Text
            style={
              styles.postButtonText
            }
          >
            {posting
              ? 'POSTING...'
              : 'POST WORKOUT'}
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.skipButton
          }
          onPress={
            skipPost
          }
        >
          <Text
            style={
              styles.skipButtonText
            }
          >
            SAVE WITHOUT POSTING
          </Text>
        </Pressable>
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

    centerText: {
      color: '#777',
      fontWeight:
        '900',
      letterSpacing: 2,
    },

    returnButton: {
      marginTop: 20,
      borderWidth: 1,
      borderColor:
        '#333',
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 8,
    },

    returnButtonText: {
      color:
        '#D9FF43',
      fontWeight:
        '900',
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1D1D1D',
    },

    headerLabel: {
      color:
        '#D9FF43',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 2,
    },

    title: {
      color:
        '#F5F5F2',
      fontSize: 32,
      fontWeight:
        '900',
      marginTop: 4,
    },

    content: {
      padding: 16,
      paddingBottom: 50,
    },

    prHero: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 12,
      padding: 18,
      marginBottom: 14,
    },

    prHeroLabel: {
      color:
        '#31390E',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 1.5,
    },

    prHeroNumber: {
      color:
        '#080808',
      fontSize: 42,
      fontWeight:
        '900',
      marginTop: 2,
    },

    prHeroText: {
      color:
        '#080808',
      fontSize: 14,
      fontWeight:
        '900',
      letterSpacing: 1.5,
    },

    photoSection: {
      marginBottom: 14,
    },

    photo: {
      width: '100%',
      aspectRatio: 4 / 5,
      borderRadius: 12,
      backgroundColor:
        '#111',
    },

    photoActions: {
      flexDirection:
        'row',
      gap: 8,
      marginTop: 9,
    },

    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor:
        '#2D2D2D',
      borderRadius: 7,
      paddingVertical: 11,
      alignItems:
        'center',
    },

    secondaryButtonText: {
      color: '#AAA',
      fontSize: 9,
      fontWeight:
        '900',
    },

    removeText: {
      color: '#777',
      fontSize: 9,
      fontWeight:
        '900',
    },

    photoEmpty: {
      backgroundColor:
        '#111111',
      borderWidth: 1,
      borderStyle:
        'dashed',
      borderColor:
        '#333',
      borderRadius: 12,
      padding: 24,
      alignItems:
        'center',
    },

    photoEmptyLabel: {
      color:
        '#F5F5F2',
      fontWeight:
        '900',
      letterSpacing: 1,
    },

    photoEmptyText: {
      color: '#666',
      fontSize: 11,
      textAlign:
        'center',
      lineHeight: 17,
      marginTop: 6,
    },

    photoButtonRow: {
      flexDirection:
        'row',
      gap: 8,
      width: '100%',
      marginTop: 18,
    },

    photoButton: {
      flex: 1,
      backgroundColor:
        '#1B1B1B',
      borderWidth: 1,
      borderColor:
        '#2C2C2C',
      borderRadius: 8,
      paddingVertical: 13,
      alignItems:
        'center',
    },

    photoButtonText: {
      color:
        '#D9FF43',
      fontSize: 9,
      fontWeight:
        '900',
    },

    summaryCard: {
      flexDirection:
        'row',
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#242424',
      borderRadius: 10,
      paddingVertical: 16,
      marginBottom: 22,
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
      letterSpacing: 1.2,
    },

    summaryValue: {
      color:
        '#F5F5F2',
      fontSize: 13,
      fontWeight:
        '900',
      marginTop: 5,
    },

    sectionLabel: {
      color: '#555',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 2,
      marginBottom: 9,
    },

    exerciseCard: {
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#242424',
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    },

    exerciseHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
    },

    exerciseName: {
      color:
        '#F5F5F2',
      fontSize: 16,
      fontWeight:
        '900',
    },

    exerciseFocus: {
      color: '#626262',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 1.2,
      marginTop: 4,
    },

    exerciseBest: {
      color:
        '#D9FF43',
      fontSize: 13,
      fontWeight:
        '900',
    },

    exerciseMeta: {
      flexDirection:
        'row',
      gap: 14,
      marginTop: 11,
    },

    exerciseMetaText: {
      color: '#666',
      fontSize: 9,
      fontWeight:
        '800',
    },

    prRow: {
      flexDirection:
        'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 11,
    },

    prBadge: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },

    prBadgeText: {
      color:
        '#080808',
      fontSize: 8,
      fontWeight:
        '900',
    },

    captionInput: {
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#292929',
      borderRadius: 10,
      minHeight: 110,
      color: '#DDD',
      padding: 14,
      textAlignVertical:
        'top',
      fontSize: 14,
    },

    captionCount: {
      textAlign:
        'right',
      color: '#555',
      fontSize: 9,
      marginTop: 5,
    },

    postButton: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 8,
      paddingVertical: 18,
      alignItems:
        'center',
      marginTop: 18,
    },

    disabledButton: {
      opacity: 0.5,
    },

    postButtonText: {
      color:
        '#080808',
      fontWeight:
        '900',
      letterSpacing: 1.3,
    },

    skipButton: {
      alignItems:
        'center',
      paddingVertical: 18,
    },

    skipButtonText: {
      color: '#555',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 1.1,
    },
  });