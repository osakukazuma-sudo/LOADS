import { queueWorkoutCompletion } from '../lib/notifications';
import { SetOptions } from '../components/set-options';
import { setResultLabel } from '../lib/setResult';
import { useAccountOwner } from '../hooks/use-account-owner';
import { workoutFinishAlert } from '../lib/workoutFinishAlert';
import { EXERCISE_LIBRARY, EXERCISE_CATEGORIES, searchExercises, type ExerciseCategory } from '../lib/exerciseLibrary';
import { cardioTotals, completedWorkoutExercises, emptyCardioInput } from '../lib/cardio';
import { CardioExerciseCard } from '../components/cardio-exercise-card';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

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

import {
  useRouter,
} from 'expo-router';

import {
  clearActiveWorkout,
  getActiveWorkout,
  getWorkouts,
  saveActiveWorkout,
  saveWorkout,
} from '../lib/workoutStorage';

import {
  deleteTemplate,
  getTemplates,
  saveTemplate,
} from '../lib/templateStorage';

import type {
  ExerciseFocus,
  WorkoutExercise,
  WorkoutSession,
} from '../lib/workoutStorage';

import type {
  WorkoutTemplate,
} from '../lib/templateStorage';

type SetItem = {
  id: number;
  weight: string;
  reps: string;
  completed: boolean;
  note: string;
  targetReps?: string;
  status?: 'completed' | 'failed' | 'stopped';
};

type Exercise = {
  id: number;
  name: string;
  focus: ExerciseFocus;
  note: string;
  sets: SetItem[];
  type?: WorkoutExercise['type'];
  cardio?: WorkoutExercise['cardio'];
};



export default function WorkoutScreen() {
  const ownerId = useAccountOwner();
  const router =
    useRouter();

  const [
    workoutStarted,
    setWorkoutStarted,
  ] = useState(false);

  const [
    startedAt,
    setStartedAt,
  ] = useState<string | null>(
    null
  );

  const [
    seconds,
    setSeconds,
  ] = useState(0);

  const [
    exercises,
    setExercises,
  ] = useState<Exercise[]>([]);

  const [
    workoutHistory,
    setWorkoutHistory,
  ] = useState<WorkoutSession[]>([]);

  const [
    templates,
    setTemplates,
  ] = useState<WorkoutTemplate[]>([]);

  const [
    isHydrated,
    setIsHydrated,
  ] = useState(false);

  const [
    exerciseModalVisible,
    setExerciseModalVisible,
  ] = useState(false);

  const [
    focusModalVisible,
    setFocusModalVisible,
  ] = useState(false);

  const [
    templateModalVisible,
    setTemplateModalVisible,
  ] = useState(false);

  const [
    saveTemplateModalVisible,
    setSaveTemplateModalVisible,
  ] = useState(false);

  const [
    templateName,
    setTemplateName,
  ] = useState('');

  const [
    searchText,
    setSearchText,
  ] = useState('');

  const [
    pendingExerciseName,
    setPendingExerciseName,
  ] = useState<string | null>(
    null
  );

  const [
    editingExerciseId,
    setEditingExerciseId,
  ] = useState<number | null>(
    null
  );

  const [
    expandedSetNotes,
    setExpandedSetNotes,
  ] = useState<
    Record<number, boolean>
  >({});

  const normalizeFocus = (
    focus?: ExerciseFocus
  ): ExerciseFocus => {
    return focus ?? 'VOLUME';
  };

  useEffect(() => {
    const initialize =
      async () => {
        try {
          const [
            history,
            activeWorkout,
            storedTemplates,
          ] = await Promise.all([
            getWorkouts(ownerId),
            getActiveWorkout(ownerId),
            getTemplates(ownerId),
          ]);

          setWorkoutHistory(
            history
          );

          setTemplates(
            storedTemplates
          );

          if (
            activeWorkout
          ) {
            setStartedAt(
              activeWorkout.startedAt
            );

            const normalized =
              activeWorkout.exercises.map(
                (
                  exercise
                ): Exercise => ({
                  ...exercise,

                  focus:
                    normalizeFocus(
                      exercise.focus
                    ),

                  sets:
                    exercise.sets.map(
                      (set) => ({
                        ...set,

                        note:
                          set.note ??
                          '',
                      })
                    ),
                })
              );

            setExercises(
              normalized
            );

            const notesToExpand:
              Record<
                number,
                boolean
              > = {};

            normalized.forEach(
              (exercise) => {
                exercise.sets.forEach(
                  (set) => {
                    if (
                      set.note
                        .trim()
                        .length >
                      0
                    ) {
                      notesToExpand[
                        set.id
                      ] = true;
                    }
                  }
                );
              }
            );

            setExpandedSetNotes(
              notesToExpand
            );

            setWorkoutStarted(
              true
            );

            const elapsed =
              Math.max(
                0,
                Math.floor(
                  (
                    Date.now() -
                    new Date(
                      activeWorkout.startedAt
                    ).getTime()
                  ) /
                    1000
                )
              );

            setSeconds(
              elapsed
            );
          }
        } catch (error) {
          console.error(
            'Failed to initialize workout:',
            error
          );
        } finally {
          setIsHydrated(
            true
          );
        }
      };

    initialize();
  }, [ownerId]);

  useEffect(() => {
    if (
      !workoutStarted ||
      !startedAt
    ) {
      return;
    }

    const updateTimer =
      () => {
        const elapsed =
          Math.max(
            0,
            Math.floor(
              (
                Date.now() -
                new Date(
                  startedAt
                ).getTime()
              ) /
                1000
            )
          );

        setSeconds(
          elapsed
        );
      };

    updateTimer();

    const timer =
      setInterval(
        updateTimer,
        1000
      );

    return () =>
      clearInterval(
        timer
      );
  }, [
    workoutStarted,
    startedAt,
  ]);

  useEffect(() => {
    if (
      !isHydrated ||
      !workoutStarted ||
      !startedAt
    ) {
      return;
    }

    saveActiveWorkout(ownerId, {
      startedAt,
      exercises,
    }).catch(
      (error) => {
        console.error(
          'Auto save failed:',
          error
        );
      }
    );
  }, [
    ownerId,
    isHydrated,
    workoutStarted,
    startedAt,
    exercises,
  ]);

  const [exerciseCategory, setExerciseCategory] = useState<ExerciseCategory | null>(null);
  const filteredExercises = useMemo(() => searchExercises(searchText, exerciseCategory), [searchText, exerciseCategory]);
  const formatTime = (
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

    const secs =
      totalSeconds %
      60;

    if (hours > 0) {
      return `${String(
        hours
      ).padStart(
        2,
        '0'
      )}:${String(
        minutes
      ).padStart(
        2,
        '0'
      )}:${String(
        secs
      ).padStart(
        2,
        '0'
      )}`;
    }

    return `${String(
      minutes
    ).padStart(
      2,
      '0'
    )}:${String(
      secs
    ).padStart(
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

  const getLastExercise = (
    exerciseName: string,
    focus: ExerciseFocus
  ): WorkoutExercise | null => {
    for (
      const workout
      of workoutHistory
    ) {
      const exercise =
        workout.exercises.find(
          (item) =>
            item.type !== 'cardio' && item.name ===
              exerciseName &&
            normalizeFocus(
              item.focus
            ) ===
              focus
        );

      if (exercise) {
        return exercise;
      }
    }

    return null;
  };

  const getLastCompletedSets = (
    exerciseName: string,
    focus: ExerciseFocus
  ) => {
    const exercise =
      getLastExercise(
        exerciseName,
        focus
      );

    if (!exercise) {
      return [];
    }

    return exercise.sets.filter(
      (set) =>
        set.completed
    );
  };

  const getLastVolume = (
    exerciseName: string,
    focus: ExerciseFocus
  ) => {
    const exercise =
      getLastExercise(
        exerciseName,
        focus
      );

    if (!exercise) {
      return 0;
    }

    return calculateVolume(
      exercise.sets
    );
  };

  const getLastTopSet = (
    exerciseName: string,
    focus: ExerciseFocus
  ) => {
    const sets =
      getLastCompletedSets(
        exerciseName,
        focus
      );

    if (
      sets.length === 0
    ) {
      return null;
    }

    return sets.reduce(
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

  const copyLastSession = (
    exerciseId: number,
    exerciseName: string,
    focus: ExerciseFocus
  ) => {
    const lastSets =
      getLastCompletedSets(
        exerciseName,
        focus
      );

    if (
      lastSets.length ===
      0
    ) {
      Alert.alert(
        'NO PREVIOUS SESSION',
        `No previous ${focus} session was found for this exercise.`
      );

      return;
    }

    setExercises(
      (prev) =>
        prev.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            return {
              ...exercise,

              sets:
                lastSets.map(
                  (
                    set,
                    index
                  ) => ({
                    id:
                      Date.now() +
                      index,

                    weight:
                      set.weight,

                    reps:
                      set.reps,

                    completed:
                      false,

                    note: '',
                  })
                ),
            };
          }
        )
    );
  };

  const getHistoricalMaxWeight =
    (
      exerciseName: string
    ) => {
      let bestWeight =
        0;

      workoutHistory.forEach(
        (workout) => {
          workout.exercises.forEach(
            (exercise) => {
              if (
                exercise.type === 'cardio' || exercise.name !==
                exerciseName
              ) {
                return;
              }

              exercise.sets.forEach(
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

                  if (
                    weight >
                    bestWeight
                  ) {
                    bestWeight =
                      weight;
                  }
                }
              );
            }
          );
        }
      );

      return bestWeight;
    };

  const getHistoricalMaxRepsAtWeight =
    (
      exerciseName: string,
      weight: number
    ) => {
      let bestReps =
        0;

      workoutHistory.forEach(
        (workout) => {
          workout.exercises.forEach(
            (exercise) => {
              if (
                exercise.type === 'cardio' || exercise.name !==
                exerciseName
              ) {
                return;
              }

              exercise.sets.forEach(
                (set) => {
                  if (
                    !set.completed
                  ) {
                    return;
                  }

                  const setWeight =
                    Number(
                      set.weight
                    ) || 0;

                  const reps =
                    Number(
                      set.reps
                    ) || 0;

                  if (
                    setWeight ===
                      weight &&
                    reps >
                      bestReps
                  ) {
                    bestReps =
                      reps;
                  }
                }
              );
            }
          );
        }
      );

      return bestReps;
    };

  const getPR = (
    exerciseName: string
  ) => {
    const bestWeight =
      getHistoricalMaxWeight(
        exerciseName
      );

    if (
      bestWeight === 0
    ) {
      return '—';
    }

    let bestReps =
      0;

    workoutHistory.forEach(
      (workout) => {
        workout.exercises.forEach(
          (exercise) => {
            if (
              exercise.type === 'cardio' || exercise.name !==
              exerciseName
            ) {
              return;
            }

            exercise.sets.forEach(
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
                  weight ===
                    bestWeight &&
                  reps >
                    bestReps
                ) {
                  bestReps =
                    reps;
                }
              }
            );
          }
        );
      }
    );

    return `${bestWeight}kg × ${bestReps}`;
  };

  const getVolumePR = (
    exerciseName: string
  ) => {
    let bestVolume =
      0;

    workoutHistory.forEach(
      (workout) => {
        const exercise =
          workout.exercises.find(
            (item) =>
              item.type !== 'cardio' && item.name ===
                exerciseName &&
              normalizeFocus(
                item.focus
              ) ===
                'VOLUME'
          );

        if (!exercise) {
          return;
        }

        const volume =
          calculateVolume(
            exercise.sets
          );

        if (
          volume >
          bestVolume
        ) {
          bestVolume =
            volume;
        }
      }
    );

    return bestVolume;
  };

  const getCurrentTopSet = (
    exercise: Exercise
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

  const hasWeightPR = (
    exercise: Exercise
  ) => {
    if (exercise.type === 'cardio') return false;
    const historicalMax =
      getHistoricalMaxWeight(
        exercise.name
      );

    const currentMax =
      Math.max(
        0,
        ...exercise.sets
          .filter(
            (set) =>
              set.completed
          )
          .map(
            (set) =>
              Number(
                set.weight
              ) || 0
          )
      );

    return (
      currentMax > 0 &&
      currentMax >
        historicalMax
    );
  };

  const hasRepPR = (
    exercise: Exercise
  ) => {
    if (exercise.type === 'cardio') return false;
    return exercise.sets
      .filter(
        (set) =>
          set.completed
      )
      .some(
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
            getHistoricalMaxRepsAtWeight(
              exercise.name,
              weight
            );

          return (
            reps >
            previousBest
          );
        }
      );
  };

  const hasVolumePR = (
    exercise: Exercise
  ) => {
    if (exercise.type === 'cardio') return false;
    if (
      exercise.focus !==
      'VOLUME'
    ) {
      return false;
    }

    const currentVolume =
      calculateVolume(
        exercise.sets
      );

    const historicalBest =
      getVolumePR(
        exercise.name
      );

    return (
      currentVolume >
        0 &&
      currentVolume >
        historicalBest
    );
  };

  const getSetPRType = (
    exerciseName: string,
    set: SetItem
  ) => {
    if (
      !set.completed
    ) {
      return null;
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
      weight <= 0 ||
      reps <= 0
    ) {
      return null;
    }

    const historicalMaxWeight =
      getHistoricalMaxWeight(
        exerciseName
      );

    if (
      weight >
      historicalMaxWeight
    ) {
      return 'WEIGHT PR';
    }

    const historicalMaxReps =
      getHistoricalMaxRepsAtWeight(
        exerciseName,
        weight
      );

    if (
      reps >
      historicalMaxReps
    ) {
      return 'REP PR';
    }

    return null;
  };

  const getVolumeDifference = (
    exercise: Exercise
  ) => {
    return (
      calculateVolume(
        exercise.sets
      ) -
      getLastVolume(
        exercise.name,
        exercise.focus
      )
    );
  };

  const getVolumePercentage = (
    exercise: Exercise
  ) => {
    const currentVolume =
      calculateVolume(
        exercise.sets
      );

    const lastVolume =
      getLastVolume(
        exercise.name,
        exercise.focus
      );

    if (
      lastVolume === 0
    ) {
      return null;
    }

    return (
      (
        (
          currentVolume -
          lastVolume
        ) /
        lastVolume
      ) *
      100
    );
  };

  const startWorkout =
    async () => {
      const now =
        new Date()
          .toISOString();

      setStartedAt(
        now
      );

      setSeconds(0);

      setExercises([]);

      setExpandedSetNotes(
        {}
      );

      setWorkoutStarted(
        true
      );

      await saveActiveWorkout(ownerId, {
        startedAt:
          now,

        exercises: [],
      });
    };

  const startFromTemplate =
    async (
      template: WorkoutTemplate
    ) => {
      const now =
        new Date()
          .toISOString();

      const base =
        Date.now();

      const templateExercises:
        Exercise[] =
        template.exercises.map(
          (
            item,
            index
          ) => {
            const exerciseId =
              base +
              index * 100;

            if (item.type === 'cardio') return {
              id: exerciseId, name: item.name, type: 'cardio', focus: 'VOLUME',
              note: '', sets: [], cardio: emptyCardioInput(),
            };

            return {
              id:
                exerciseId,

              name:
                item.name,
              type: 'strength',

              focus:
                item.focus,

              note: '',

              sets: [
                {
                  id:
                    exerciseId +
                    1,

                  weight: '',
                  reps: '',

                  completed:
                    false,

                  note: '',
                },
              ],
            };
          }
        );

      setStartedAt(
        now
      );

      setSeconds(0);

      setExercises(
        templateExercises
      );

      setExpandedSetNotes(
        {}
      );

      setTemplateModalVisible(
        false
      );

      setWorkoutStarted(
        true
      );

      await saveActiveWorkout(ownerId, {
        startedAt:
          now,

        exercises:
          templateExercises,
      });
    };

  const handleSaveTemplate =
    async () => {
      const name =
        templateName
          .trim()
          .toUpperCase();

      if (!name) {
        Alert.alert(
          'TEMPLATE NAME',
          'Enter a template name.'
        );

        return;
      }

      if (
        exercises.length ===
        0
      ) {
        Alert.alert(
          'NO EXERCISES',
          'Add at least one exercise first.'
        );

        return;
      }

      const template:
        WorkoutTemplate =
        {
          id:
            `${Date.now()}`,

          name,

          createdAt:
            new Date()
              .toISOString(),

          exercises:
            exercises.map(
              (exercise) => ({
                name:
                  exercise.name,
                type: exercise.type ?? 'strength',

                focus:
                  exercise.focus,
              })
            ),
        };

      try {
        await saveTemplate(ownerId, template
        );

        setTemplates(
          (prev) => [
            template,
            ...prev,
          ]
        );

        setTemplateName('');

        setSaveTemplateModalVisible(
          false
        );

        Alert.alert(
          'TEMPLATE SAVED',
          `${name} is ready.`
        );
      } catch {
        Alert.alert(
          'ERROR',
          'Could not save template.'
        );
      }
    };

  const handleDeleteTemplate = (
    template: WorkoutTemplate
  ) => {
    Alert.alert(
      'DELETE TEMPLATE?',
      template.name,
      [
        {
          text:
            'CANCEL',

          style:
            'cancel',
        },

        {
          text:
            'DELETE',

          style:
            'destructive',

          onPress:
            async () => {
              try {
                await deleteTemplate(ownerId, template.id
                );

                setTemplates(
                  (prev) =>
                    prev.filter(
                      (item) =>
                        item.id !==
                        template.id
                    )
                );
              } catch {
                Alert.alert(
                  'ERROR',
                  'Could not delete template.'
                );
              }
            },
        },
      ]
    );
  };

  const chooseExercise = (
    name: string
  ) => {
    if (EXERCISE_LIBRARY.find(item => item.name === name)?.type === 'cardio') {
      setExercises(prev => [...prev, {
        id: Date.now(), name, type: 'cardio', focus: 'VOLUME',
        note: '', sets: [], cardio: emptyCardioInput(),
      }]);
      setExerciseModalVisible(false);
      setSearchText('');
      return;
    }
    setPendingExerciseName(
      name
    );

    setEditingExerciseId(
      null
    );

    setExerciseModalVisible(
      false
    );

    setFocusModalVisible(
      true
    );
  };

  const addCustomExercise =
    () => {
      const name =
        searchText
          .trim()
          .toUpperCase();

      if (!name) {
        return;
      }

      chooseExercise(
        name
      );
    };

  const openFocusEditor = (
    exercise: Exercise
  ) => {
    setPendingExerciseName(
      exercise.name
    );

    setEditingExerciseId(
      exercise.id
    );

    setFocusModalVisible(
      true
    );
  };

  const confirmExerciseFocus = (
    focus: ExerciseFocus
  ) => {
    if (
      !pendingExerciseName
    ) {
      return;
    }

    if (
      editingExerciseId !==
      null
    ) {
      setExercises(
        (prev) =>
          prev.map(
            (exercise) =>
              exercise.id ===
              editingExerciseId
                ? {
                    ...exercise,
                    focus,
                  }
                : exercise
          )
      );

      setFocusModalVisible(
        false
      );

      setPendingExerciseName(
        null
      );

      setEditingExerciseId(
        null
      );

      return;
    }

    const now =
      Date.now();

    const newExercise:
      Exercise =
      {
        id: now,

        name:
          pendingExerciseName,
        type: 'strength',

        focus,

        note: '',

        sets: [
          {
            id:
              now + 1,

            weight: '',
            reps: '',

            completed:
              false,

            note: '',
          },
        ],
      };

    setExercises(
      (prev) => [
        ...prev,
        newExercise,
      ]
    );

    setFocusModalVisible(
      false
    );

    setPendingExerciseName(
      null
    );

    setEditingExerciseId(
      null
    );

    setSearchText('');
  };

  const cancelFocusSelection =
    () => {
      setFocusModalVisible(
        false
      );

      setPendingExerciseName(
        null
      );

      setEditingExerciseId(
        null
      );
    };

  const removeExercise = (
    exerciseId: number
  ) => {
    setExercises(
      (prev) =>
        prev.filter(
          (exercise) =>
            exercise.id !==
            exerciseId
        )
    );
  };

  const moveExercise = (
    exerciseId: number,
    direction:
      | 'up'
      | 'down'
  ) => {
    setExercises(
      (prev) => {
        const currentIndex =
          prev.findIndex(
            (exercise) =>
              exercise.id ===
              exerciseId
          );

        if (
          currentIndex ===
          -1
        ) {
          return prev;
        }

        const targetIndex =
          direction ===
          'up'
            ? currentIndex -
              1
            : currentIndex +
              1;

        if (
          targetIndex <
            0 ||
          targetIndex >=
            prev.length
        ) {
          return prev;
        }

        const next = [
          ...prev,
        ];

        const temp =
          next[
            currentIndex
          ];

        next[
          currentIndex
        ] =
          next[
            targetIndex
          ];

        next[
          targetIndex
        ] =
          temp;

        return next;
      }
    );
  };

  const addSet = (
    exerciseId: number
  ) => {
    setExercises(
      (prev) =>
        prev.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            const lastSet =
              exercise.sets[
                exercise.sets.length -
                  1
              ];

            return {
              ...exercise,

              sets: [
                ...exercise.sets,

                {
                  id:
                    Date.now(),

                  weight:
                    lastSet
                      ?.weight ??
                    '',

                  reps:
                    lastSet
                      ?.reps ??
                    '',

                  completed:
                    false,

                  note: '',
                },
              ],
            };
          }
        )
    );
  };

  const deleteSet = (
    exerciseId: number,
    setId: number
  ) => {
    const exercise =
      exercises.find(
        (item) =>
          item.id ===
          exerciseId
      );

    if (!exercise) {
      return;
    }

    if (
      exercise.sets.length <=
      1
    ) {
      Alert.alert(
        'KEEP ONE SET',
        'An exercise must have at least one set.'
      );

      return;
    }

    const setIndex =
      exercise.sets.findIndex(
        (set) =>
          set.id ===
          setId
      );

    Alert.alert(
      'DELETE SET?',
      `Set ${
        setIndex + 1
      } will be removed.`,
      [
        {
          text:
            'CANCEL',

          style:
            'cancel',
        },

        {
          text:
            'DELETE',

          style:
            'destructive',

          onPress: () => {
            setExercises(
              (prev) =>
                prev.map(
                  (
                    item
                  ) => {
                    if (
                      item.id !==
                      exerciseId
                    ) {
                      return item;
                    }

                    return {
                      ...item,

                      sets:
                        item.sets.filter(
                          (set) =>
                            set.id !==
                            setId
                        ),
                    };
                  }
                )
            );

            setExpandedSetNotes(
              (prev) => {
                const next = {
                  ...prev,
                };

                delete next[
                  setId
                ];

                return next;
              }
            );
          },
        },
      ]
    );
  };

  const updateSet = (
    exerciseId: number,
    setId: number,
    field:
      | 'weight'
      | 'reps',
    value: string
  ) => {
    setExercises(
      (prev) =>
        prev.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            return {
              ...exercise,

              sets:
                exercise.sets.map(
                  (set) =>
                    set.id ===
                    setId
                      ? {
                          ...set,

                          [field]:
                            value,
                        }
                      : set
                ),
            };
          }
        )
    );
  };

  const updateSetNote = (
    exerciseId: number,
    setId: number,
    value: string
  ) => {
    setExercises(
      (prev) =>
        prev.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise;
            }

            return {
              ...exercise,

              sets:
                exercise.sets.map(
                  (set) =>
                    set.id ===
                    setId
                      ? {
                          ...set,

                          note:
                            value,
                        }
                      : set
                ),
            };
          }
        )
    );
  };

  const toggleSetNote = (
    setId: number
  ) => {
    setExpandedSetNotes(
      (prev) => ({
        ...prev,

        [setId]:
          !prev[setId],
      })
    );
  };

  const toggleSetComplete =
    (
      exerciseId: number,
      setId: number
    ) => {
      setExercises(
        (prev) =>
          prev.map(
            (exercise) => {
              if (
                exercise.id !==
                exerciseId
              ) {
                return exercise;
              }

              return {
                ...exercise,

                sets:
                  exercise.sets.map(
                    (set) =>
                      set.id ===
                      setId
                        ? {
                            ...set,

                            completed:
                              !set.completed,
                          }
                        : set
                  ),
              };
            }
          )
      );
    };

  const finishWorkout =
    () => {
      let completedExercises: WorkoutExercise[];
      try { completedExercises = completedWorkoutExercises(exercises); }
      catch (error) {
        workoutFinishAlert('CARDIO', (error as Error).message);
        return;
      }

      if (
        completedExercises.length ===
        0
      ) {
        workoutFinishAlert(
          'NO COMPLETED EXERCISES',
          'Complete at least one strength set or enter a cardio duration first.'
        );

        return;
      }

      const completedSets =
        completedExercises.reduce(
          (
            total,
            exercise
          ) =>
            total +
            exercise.sets
              .length,
          0
        );

      const cardioStats = cardioTotals(completedExercises);
      const finishSummary = [
        `${completedExercises.length} exercises`,
        !cardioStats.onlyCardio ? `${completedSets} sets` : null,
        completedExercises.some(item => item.type === 'cardio') ? `${cardioStats.durationMinutes} min cardio` : null,
        `Time: ${formatTime(seconds)}`,
      ].filter(Boolean).join('\n');

      workoutFinishAlert(
        'FINISH WORKOUT?',
        finishSummary,
        [
          {
            text:
              'CANCEL',

            style:
              'cancel',
          },

          {
            text:
              'FINISH',

            onPress:
              async () => {
                const now =
                  new Date();

                const sessionStartedAt =
                  startedAt ??
                  new Date(
                    now.getTime() -
                      seconds *
                        1000
                  ).toISOString();

                const workout:
                  WorkoutSession =
                  {
                    id:
                      `${Date.now()}`,

                    startedAt:
                      sessionStartedAt,

                    finishedAt:
                      now.toISOString(),

                    durationSeconds:
                      Math.max(
                        0,

                        Math.floor(
                          (
                            now.getTime() -
                            new Date(
                              sessionStartedAt
                            ).getTime()
                          ) /
                            1000
                        )
                      ),

                    exercises:
                      completedExercises,
                  };

                try {
                  await saveWorkout(ownerId, workout
                  );

                  void queueWorkoutCompletion(ownerId, workout).catch(() => {});
                  await clearActiveWorkout(ownerId);

                  setWorkoutHistory(
                    (prev) => [
                      workout,
                      ...prev,
                    ]
                  );

                  setWorkoutStarted(
                    false
                  );

                  setStartedAt(
                    null
                  );

                  setSeconds(
                    0
                  );

                  setExercises(
                    []
                  );

                  setExpandedSetNotes(
                    {}
                  );

                  router.push({
                    pathname:
                      '/post',

                    params: {
                      workout:
                        JSON.stringify(
                          workout
                        ),
                    },
                  });
                } catch {
                  workoutFinishAlert(
                    'ERROR',
                    'Could not save workout.'
                  );
                }
              },
          },
        ]
      );
    };

  if (
    !isHydrated
  ) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.loadingScreen
          }
        >
          <Text
            style={
              styles.loadingText
            }
          >
            LOADS
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (
    !workoutStarted
  ) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.startScreen
          }
        >
          <Text
            style={
              styles.startLabel
            }
          >
            LOADS
          </Text>

          <Text
            style={
              styles.startTitle
            }
          >
            READY{'\n'}TO LOAD?
          </Text>

          <Text
            style={
              styles.startDescription
            }
          >
            Track the work.
            {'\n'}
            Beat the last session.
          </Text>

          <Pressable
            style={
              styles.startWorkoutButton
            }
            onPress={
              startWorkout
            }
          >
            <Text
              style={
                styles.startWorkoutText
              }
            >
              START WORKOUT
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.templateStartButton
            }
            onPress={() =>
              setTemplateModalVisible(
                true
              )
            }
          >
            <Text
              style={
                styles.templateStartText
              }
            >
              START FROM TEMPLATE
            </Text>
          </Pressable>

          <Text
            style={
              styles.templateHint
            }
          >
            {templates.length}{' '}
            {templates.length ===
            1
              ? 'TEMPLATE'
              : 'TEMPLATES'}{' '}
            SAVED
          </Text>
        </View>

        <Modal
          visible={
            templateModalVisible
          }
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() =>
            setTemplateModalVisible(
              false
            )
          }
        >
          <SafeAreaView
            style={
              styles.modalContainer
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalLabel
                  }
                >
                  LOAD ROUTINE
                </Text>

                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  TEMPLATES
                </Text>
              </View>

              <Pressable
                style={
                  styles.modalClose
                }
                onPress={() =>
                  setTemplateModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.modalCloseText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={
                styles.templateList
              }
              showsVerticalScrollIndicator={
                false
              }
            >
              {templates.length ===
              0 ? (
                <View
                  style={
                    styles.templateEmpty
                  }
                >
                  <Text
                    style={
                      styles.templateEmptyTitle
                    }
                  >
                    NO TEMPLATES YET.
                  </Text>

                  <Text
                    style={
                      styles.templateEmptyText
                    }
                  >
                    Start a workout,
                    add your exercises,
                    then save the
                    routine as a
                    template.
                  </Text>
                </View>
              ) : (
                templates.map(
                  (
                    template
                  ) => (
                    <View
                      key={
                        template.id
                      }
                      style={
                        styles.templateCard
                      }
                    >
                      <View
                        style={
                          styles.templateCardHeader
                        }
                      >
                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={
                              styles.templateCardLabel
                            }
                          >
                            TEMPLATE
                          </Text>

                          <Text
                            style={
                              styles.templateCardName
                            }
                          >
                            {
                              template.name
                            }
                          </Text>
                        </View>

                        <Pressable
                          onPress={() =>
                            handleDeleteTemplate(
                              template
                            )
                          }
                          style={
                            styles.templateDelete
                          }
                        >
                          <Text
                            style={
                              styles.templateDeleteText
                            }
                          >
                            DELETE
                          </Text>
                        </Pressable>
                      </View>

                      <View
                        style={
                          styles.templateExercises
                        }
                      >
                        {template.exercises.map(
                          (
                            exercise,
                            index
                          ) => (
                            <View
                              key={`${template.id}-${exercise.name}-${index}`}
                              style={
                                styles.templateExerciseRow
                              }
                            >
                              <Text
                                style={
                                  styles.templateExerciseNumber
                                }
                              >
                                {index +
                                  1}
                              </Text>

                              <Text
                                style={
                                  styles.templateExerciseName
                                }
                              >
                                {
                                  exercise.name
                                }
                              </Text>

                              <View
                                style={[
                                  styles.templateFocus,

                                  exercise.focus ===
                                  'PR'
                                    ? styles.templateFocusPR
                                    : styles.templateFocusVolume,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.templateFocusText,

                                    exercise.focus ===
                                      'PR' &&
                                      styles.templateFocusTextDark,
                                  ]}
                                >
                                  {exercise.type === 'cardio' ? 'CARDIO' : exercise.focus}
                                </Text>
                              </View>
                            </View>
                          )
                        )}
                      </View>

                      <Pressable
                        style={
                          styles.templateUseButton
                        }
                        onPress={() =>
                          startFromTemplate(
                            template
                          )
                        }
                      >
                        <Text
                          style={
                            styles.templateUseText
                          }
                        >
                          START THIS
                          WORKOUT
                        </Text>
                      </Pressable>
                    </View>
                  )
                )
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
              styles.smallLabel
            }
          >
            CURRENT SESSION
          </Text>

          <Text
            style={
              styles.title
            }
          >
            WORKOUT
          </Text>
        </View>

        <Text
          style={
            styles.timer
          }
        >
          {formatTime(
            seconds
          )}
        </Text>
      </View>

      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {exercises.length ===
          0 && (
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
              NO EXERCISES YET.
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Add a movement and
              choose today&apos;s focus.
            </Text>
          </View>
        )}

        {exercises.map(
          (
            exercise,
            exerciseIndex
          ) => {
            if (exercise.type === 'cardio') return <CardioExerciseCard
              key={exercise.id} name={exercise.name} index={exerciseIndex}
              cardio={exercise.cardio ?? emptyCardioInput()} memo={exercise.note}
              onChange={cardio => setExercises(prev => prev.map(item => item.id === exercise.id ? { ...item, cardio } : item))}
              onMemo={note => setExercises(prev => prev.map(item => item.id === exercise.id ? { ...item, note } : item))}
              onRemove={() => removeExercise(exercise.id)}
              onMove={direction => moveExercise(exercise.id, direction)}
              canMoveUp={exerciseIndex > 0} canMoveDown={exerciseIndex < exercises.length - 1}
            />;
            const lastSets =
              getLastCompletedSets(
                exercise.name,
                exercise.focus
              );

            const currentVolume =
              calculateVolume(
                exercise.sets
              );

            const lastVolume =
              getLastVolume(
                exercise.name,
                exercise.focus
              );

            const lastTopSet =
              getLastTopSet(
                exercise.name,
                exercise.focus
              );

            const currentTopSet =
              getCurrentTopSet(
                exercise
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
              hasWeightPR(
                exercise
              );

            const repPR =
              hasRepPR(
                exercise
              );

            const volumePR =
              hasVolumePR(
                exercise
              );

            const canMoveUp =
              exerciseIndex >
              0;

            const canMoveDown =
              exerciseIndex <
              exercises.length -
                1;

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
                      {exerciseIndex +
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

                    <Pressable
                      onPress={() =>
                        openFocusEditor(
                          exercise
                        )
                      }
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
                          styles.focusBadgeText,

                          exercise.focus ===
                            'PR' &&
                            styles.focusBadgeTextDark,
                        ]}
                      >
                        {
                          exercise.focus
                        }{' '}
                        · CHANGE
                      </Text>
                    </Pressable>
                  </View>

                  <View
                    style={
                      styles.exerciseActions
                    }
                  >
                    <Pressable
                      onPress={() =>
                        moveExercise(
                          exercise.id,
                          'up'
                        )
                      }
                      disabled={
                        !canMoveUp
                      }
                      style={[
                        styles.moveButton,

                        !canMoveUp &&
                          styles.moveButtonDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.moveButtonText,

                          !canMoveUp &&
                            styles.moveButtonTextDisabled,
                        ]}
                      >
                        ↑
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        moveExercise(
                          exercise.id,
                          'down'
                        )
                      }
                      disabled={
                        !canMoveDown
                      }
                      style={[
                        styles.moveButton,

                        !canMoveDown &&
                          styles.moveButtonDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.moveButtonText,

                          !canMoveDown &&
                            styles.moveButtonTextDisabled,
                        ]}
                      >
                        ↓
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        removeExercise(
                          exercise.id
                        )
                      }
                      style={
                        styles.removeExerciseButton
                      }
                    >
                      <Text
                        style={
                          styles.removeExerciseText
                        }
                      >
                        ×
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View
                  style={
                    styles.prOverview
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.overviewLabel
                      }
                    >
                      ALL-TIME PR
                    </Text>

                    <Text
                      style={
                        styles.overviewValue
                      }
                    >
                      {getPR(
                        exercise.name
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.overviewRight
                    }
                  >
                    <Text
                      style={
                        styles.overviewLabel
                      }
                    >
                      CURRENT FOCUS
                    </Text>

                    <Text
                      style={
                        styles.overviewValue
                      }
                    >
                      {
                        exercise.focus
                      }
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.lastSessionCard
                  }
                >
                  <View
                    style={
                      styles.lastSessionHeader
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.lastSessionLabel
                        }
                      >
                        LAST{' '}
                        {
                          exercise.focus
                        }{' '}
                        SESSION
                      </Text>

                      <Text
                        style={
                          styles.lastSessionSub
                        }
                      >
                        SAME FOCUS ONLY
                      </Text>
                    </View>

                    {lastSets.length >
                      0 && (
                      <Pressable
                        style={
                          styles.copyButton
                        }
                        onPress={() =>
                          copyLastSession(
                            exercise.id,
                            exercise.name,
                            exercise.focus
                          )
                        }
                      >
                        <Text
                          style={
                            styles.copyButtonText
                          }
                        >
                          COPY LAST
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {lastSets.length ===
                  0 ? (
                    <Text
                      style={
                        styles.noLastSession
                      }
                    >
                      NO PREVIOUS{' '}
                      {
                        exercise.focus
                      }{' '}
                      SESSION
                    </Text>
                  ) : (
                    <View
                      style={
                        styles.lastSetsList
                      }
                    >
                      {lastSets.map(
                        (
                          set,
                          index
                        ) => (
                          <View
                            key={`${exercise.name}-${exercise.focus}-${index}`}
                            style={
                              styles.lastSetRow
                            }
                          >
                            <Text
                              style={
                                styles.lastSetNumber
                              }
                            >
                              {index +
                                1}
                            </Text>

                            <View
                              style={{
                                flex: 1,
                              }}
                            >
                              <Text
                                style={
                                  styles.lastSetValue
                                }
                              >
                                {
                                  set.weight
                                }
                                kg ×{' '}
                                {
                                  set.reps
                                }
                                {setResultLabel(set) ? ` / ${setResultLabel(set)}` : ''}
                              </Text>

                              {!!set.note &&
                                set.note
                                  .trim()
                                  .length >
                                  0 && (
                                  <Text
                                    style={
                                      styles.lastSetNote
                                    }
                                  >
                                    {
                                      set.note
                                    }
                                  </Text>
                                )}
                            </View>
                          </View>
                        )
                      )}
                    </View>
                  )}
                </View>

                {exercise.focus ===
                'VOLUME' ? (
                  <View
                    style={
                      styles.volumeContainer
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.volumeLabel
                        }
                      >
                        CURRENT VOLUME
                      </Text>

                      <Text
                        style={
                          styles.volumeValue
                        }
                      >
                        {currentVolume.toLocaleString()}
                        kg
                      </Text>
                    </View>

                    <View
                      style={
                        styles.volumeRight
                      }
                    >
                      {lastVolume >
                      0 ? (
                        <>
                          <Text
                            style={
                              volumeDiff >=
                              0
                                ? styles.volumePositive
                                : styles.volumeNegative
                            }
                          >
                            {volumeDiff >=
                            0
                              ? '+'
                              : ''}
                            {volumeDiff.toLocaleString()}
                            kg
                          </Text>

                          {volumePercent !==
                            null && (
                            <Text
                              style={
                                styles.volumePercent
                              }
                            >
                              {volumePercent >=
                              0
                                ? '+'
                                : ''}
                              {volumePercent.toFixed(
                                1
                              )}
                              %
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text
                          style={
                            styles.firstRecord
                          }
                        >
                          FIRST VOLUME
                          SESSION
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View
                    style={
                      styles.prFocusCard
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.volumeLabel
                        }
                      >
                        CURRENT TOP SET
                      </Text>

                      <Text
                        style={
                          styles.volumeValue
                        }
                      >
                        {currentTopSet
                          ? `${currentTopSet.weight}kg × ${currentTopSet.reps}`
                          : '—'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.prFocusRight
                      }
                    >
                      <Text
                        style={
                          styles.volumeLabel
                        }
                      >
                        LAST PR SESSION
                      </Text>

                      <Text
                        style={
                          styles.prFocusPrevious
                        }
                      >
                        {lastTopSet
                          ? `${lastTopSet.weight}kg × ${lastTopSet.reps}`
                          : '—'}
                      </Text>
                    </View>
                  </View>
                )}

                {(weightPR ||
                  repPR ||
                  volumePR) && (
                  <View
                    style={
                      styles.prContainer
                    }
                  >
                    {weightPR && (
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

                    {repPR && (
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

                    {volumePR && (
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
                    styles.tableHeader
                  }
                >
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
                  (
                    set,
                    setIndex
                  ) => {
                    const setPRType =
                      getSetPRType(
                        exercise.name,
                        set
                      );

                    const noteOpen =
                      expandedSetNotes[
                        set.id
                      ] ||
                      set.note
                        .trim()
                        .length >
                        0;

                    const canDelete =
                      exercise.sets
                        .length >
                      1;

                    return (
                      <View
                        key={
                          set.id
                        }
                        style={[
                          styles.setBlock,

                          setPRType &&
                            styles.setBlockPR,
                        ]}
                      >
                        <View
                          style={
                            styles.setRow
                          }
                        >
                          <View
                            style={
                              styles.setColumn
                            }
                          >
                            <Text
                              style={
                                styles.setNumber
                              }
                            >
                              {setIndex +
                                1}
                            </Text>

                            {setPRType && (
                              <View
                                style={
                                  styles.setPRBadge
                                }
                              >
                                <Text
                                  style={
                                    styles.setPRBadgeText
                                  }
                                >
                                  PR
                                </Text>
                              </View>
                            )}
                          </View>

                          <View
                            style={
                              styles.inputColumn
                            }
                          >
                            <TextInput
                              value={
                                set.weight
                              }
                              onChangeText={(
                                value
                              ) =>
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

                          <View
                            style={
                              styles.inputColumn
                            }
                          >
                            <TextInput
                              value={
                                set.reps
                              }
                              onChangeText={(
                                value
                              ) =>
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

                          <View
                            style={
                              styles.doneColumn
                            }
                          >
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

                        <View
                          style={
                            styles.setMetaRow
                          }
                        >
                          <Pressable
                            onPress={() =>
                              toggleSetNote(
                                set.id
                              )
                            }
                            style={
                              styles.setNoteToggle
                            }
                          >
                            <Text
                              style={[
                                styles.setNoteToggleText,

                                noteOpen &&
                                  styles.setNoteToggleTextActive,
                              ]}
                            >
                              {noteOpen
                                ? '− NOTE'
                                : '+ NOTE'}
                            </Text>
                          </Pressable>

                          <View
                            style={
                              styles.setMetaActions
                            }
                          >
                            {set.note
                              .trim()
                              .length >
                              0 && (
                              <Text
                                style={
                                  styles.noteSavedLabel
                                }
                              >
                                NOTE SAVED
                              </Text>
                            )}

                            <Pressable
                              onPress={() =>
                                deleteSet(
                                  exercise.id,
                                  set.id
                                )
                              }
                              disabled={
                                !canDelete
                              }
                              style={
                                styles.deleteSetButton
                              }
                            >
                              <Text
                                style={[
                                  styles.deleteSetText,

                                  !canDelete &&
                                    styles.deleteSetTextDisabled,
                                ]}
                              >
                                DELETE SET
                              </Text>
                            </Pressable>
                          </View>
                        </View>

                        <SetOptions set={set} onChange={patch => setExercises(items => items.map(item => item.id === exercise.id ? { ...item, sets: item.sets.map(row => row.id === set.id ? { ...row, ...patch } : row) } : item))} />
                        {noteOpen && (
                          <TextInput
                            value={
                              set.note
                            }
                            onChangeText={(
                              value
                            ) =>
                              updateSetNote(
                                exercise.id,
                                set.id,
                                value
                              )
                            }
                            placeholder="Set note..."
                            placeholderTextColor="#4D4D4D"
                            multiline
                            maxLength={
                              180
                            }
                            style={
                              styles.setNoteInput
                            }
                          />
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
                  style={
                    styles.addSetButton
                  }
                >
                  <Text
                    style={
                      styles.addSetText
                    }
                  >
                    + ADD SET
                  </Text>
                </Pressable>

                <TextInput
                  value={
                    exercise.note
                  }
                  onChangeText={(
                    value
                  ) => {
                    setExercises(
                      (prev) =>
                        prev.map(
                          (
                            item
                          ) =>
                            item.id ===
                            exercise.id
                              ? {
                                  ...item,

                                  note:
                                    value,
                                }
                              : item
                        )
                    );
                  }}
                  placeholder="Exercise note..."
                  placeholderTextColor="#555"
                  multiline
                  style={
                    styles.exerciseNoteInput
                  }
                />
              </View>
            );
          }
        )}

        <Pressable
          onPress={() => {
            setSearchText('');
            setExerciseCategory(null);

            setExerciseModalVisible(
              true
            );
          }}
          style={
            styles.addExerciseButton
          }
        >
          <Text
            style={
              styles.addExerciseText
            }
          >
            + ADD EXERCISE
          </Text>
        </Pressable>

        {exercises.length >
          0 && (
          <Pressable
            onPress={() => {
              setTemplateName('');

              setSaveTemplateModalVisible(
                true
              );
            }}
            style={
              styles.saveTemplateButton
            }
          >
            <Text
              style={
                styles.saveTemplateText
              }
            >
              SAVE AS TEMPLATE
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={
            finishWorkout
          }
          style={
            styles.finishButton
          }
        >
          <Text
            style={
              styles.finishButtonText
            }
          >
            FINISH WORKOUT
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={
          exerciseModalVisible
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setExerciseModalVisible(
            false
          )
        }
      >
        <SafeAreaView
          style={
            styles.modalContainer
          }
        >
          <View
            style={
              styles.modalHeader
            }
          >
            <View>
              <Text
                style={
                  styles.modalLabel
                }
              >
                LOAD MOVEMENT
              </Text>

              <Text
                style={
                  styles.modalTitle
                }
              >
                ADD EXERCISE
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setExerciseModalVisible(
                  false
                )
              }
              style={
                styles.modalClose
              }
            >
              <Text
                style={
                  styles.modalCloseText
                }
              >
                ×
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.searchContainer
            }
          >
            <TextInput
              autoFocus
              value={
                searchText
              }
              onChangeText={
                setSearchText
              }
              placeholder="Search exercise..."
              placeholderTextColor="#666"
              style={
                styles.searchInput
              }
            />
          </View>

          {!searchText.trim() && <View style={{ paddingHorizontal: 24, gap: 12 }}>
            {exerciseCategory ? <Pressable onPress={() => setExerciseCategory(null)}><Text style={styles.exerciseOptionText}>‹ CATEGORIES · {exerciseCategory.toUpperCase()}</Text></Pressable> : EXERCISE_CATEGORIES.map(category => <Pressable key={category} style={styles.exerciseOption} onPress={() => setExerciseCategory(category)}><Text style={styles.exerciseOptionText}>{category.toUpperCase()}</Text><Text style={styles.exerciseOptionPlus}>›</Text></Pressable>)}
          </View>}
          <FlatList
            data={
              filteredExercises
            }
            keyExtractor={(
              item
            ) => item.name}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              styles.exerciseList
            }
            renderItem={({
              item,
            }) => (
              <Pressable
                style={
                  styles.exerciseOption
                }
                onPress={() =>
                  chooseExercise(
                    item.name
                  )
                }
              >
                <Text
                  style={
                    styles.exerciseOptionText
                  }
                >
                  {item.name}{item.type === 'cardio' ? ' · CARDIO' : ''}
                </Text>

                <Text
                  style={
                    styles.exerciseOptionPlus
                  }
                >
                  +
                </Text>
              </Pressable>
            )}
          />

          {searchText
            .trim()
            .length >
            0 &&
            !EXERCISE_LIBRARY.some(item => item.name === searchText.trim().toUpperCase()) && (
              <View
                style={
                  styles.customArea
                }
              >
                <Pressable
                  style={
                    styles.customExerciseButton
                  }
                  onPress={
                    addCustomExercise
                  }
                >
                  <Text
                    style={
                      styles.customExerciseText
                    }
                  >
                    + ADD &quot;
                    {searchText
                      .trim()
                      .toUpperCase()}
                    &quot;
                  </Text>
                </Pressable>
              </View>
            )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={
          focusModalVisible
        }
        transparent
        animationType="fade"
        onRequestClose={
          cancelFocusSelection
        }
      >
        <View
          style={
            styles.focusOverlay
          }
        >
          <View
            style={
              styles.focusModal
            }
          >
            <Text
              style={
                styles.focusModalLabel
              }
            >
              {editingExerciseId !==
              null
                ? 'CHANGE FOCUS'
                : "TODAY'S FOCUS"}
            </Text>

            <Text
              style={
                styles.focusExerciseName
              }
            >
              {
                pendingExerciseName
              }
            </Text>

            <Text
              style={
                styles.focusDescription
              }
            >
              {editingExerciseId !==
              null
                ? 'Switch how this exercise is compared.'
                : 'What are you trying to push today?'}
            </Text>

            <Pressable
              style={
                styles.focusOption
              }
              onPress={() =>
                confirmExerciseFocus(
                  'VOLUME'
                )
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.focusOptionTitle
                  }
                >
                  VOLUME
                </Text>

                <Text
                  style={
                    styles.focusOptionDescription
                  }
                >
                  Compare total work
                  with your last volume
                  session.
                </Text>
              </View>

              <Text
                style={
                  styles.focusArrow
                }
              >
                →
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.focusOption
              }
              onPress={() =>
                confirmExerciseFocus(
                  'PR'
                )
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.focusOptionTitle
                  }
                >
                  PR
                </Text>

                <Text
                  style={
                    styles.focusOptionDescription
                  }
                >
                  Chase heavy sets and
                  compare with your last
                  PR session.
                </Text>
              </View>

              <Text
                style={
                  styles.focusArrow
                }
              >
                →
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.focusCancel
              }
              onPress={
                cancelFocusSelection
              }
            >
              <Text
                style={
                  styles.focusCancelText
                }
              >
                CANCEL
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={
          saveTemplateModalVisible
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSaveTemplateModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.focusOverlay
          }
        >
          <View
            style={
              styles.saveTemplateModal
            }
          >
            <Text
              style={
                styles.focusModalLabel
              }
            >
              SAVE ROUTINE
            </Text>

            <Text
              style={
                styles.saveTemplateTitle
              }
            >
              TEMPLATE NAME
            </Text>

            <Text
              style={
                styles.saveTemplateDescription
              }
            >
              Exercises and focus
              will be saved.
              Weight and reps will
              not.
            </Text>

            <TextInput
              autoFocus
              value={
                templateName
              }
              onChangeText={
                setTemplateName
              }
              placeholder="e.g. PUSH A"
              placeholderTextColor="#555"
              maxLength={30}
              style={
                styles.templateNameInput
              }
            />

            <View
              style={
                styles.saveTemplateActions
              }
            >
              <Pressable
                style={
                  styles.saveTemplateCancel
                }
                onPress={() =>
                  setSaveTemplateModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.saveTemplateCancelText
                  }
                >
                  CANCEL
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.saveTemplateConfirm
                }
                onPress={
                  handleSaveTemplate
                }
              >
                <Text
                  style={
                    styles.saveTemplateConfirmText
                  }
                >
                  SAVE TEMPLATE
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

    loadingScreen: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color:
        '#D9FF43',
      fontSize: 24,
      fontWeight:
        '900',
      letterSpacing: 4,
    },

    startScreen: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent:
        'center',
    },

    startLabel: {
      color: '#666',
      fontSize: 12,
      fontWeight:
        '900',
      letterSpacing: 3,
    },

    startTitle: {
      marginTop: 16,
      color:
        '#F5F5F2',
      fontSize: 64,
      lineHeight: 62,
      fontWeight:
        '900',
      letterSpacing: -2,
    },

    startDescription: {
      marginTop: 26,
      color: '#888',
      fontSize: 17,
      lineHeight: 27,
      fontWeight:
        '600',
    },

    startWorkoutButton: {
      marginTop: 42,
      backgroundColor:
        '#D9FF43',
      borderRadius: 8,
      paddingVertical: 20,
      alignItems:
        'center',
    },

    startWorkoutText: {
      color:
        '#080808',
      fontSize: 15,
      fontWeight:
        '900',
      letterSpacing: 2,
    },

    templateStartButton: {
      marginTop: 10,
      borderWidth: 1,
      borderColor:
        '#343434',
      borderRadius: 8,
      paddingVertical: 18,
      alignItems:
        'center',
    },

    templateStartText: {
      color:
        '#D9FF43',
      fontSize: 12,
      fontWeight:
        '900',
      letterSpacing: 1.5,
    },

    templateHint: {
      marginTop: 10,
      color: '#404040',
      fontSize: 8,
      fontWeight:
        '900',
      textAlign:
        'center',
      letterSpacing: 1.2,
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 18,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-end',
      borderBottomWidth: 1,
      borderBottomColor:
        '#1D1D1D',
    },

    smallLabel: {
      color: '#666',
      fontSize: 10,
      fontWeight:
        '800',
      letterSpacing: 2,
    },

    title: {
      marginTop: 4,
      color:
        '#F5F5F2',
      fontSize: 34,
      fontWeight:
        '900',
    },

    timer: {
      color:
        '#D9FF43',
      fontSize: 22,
      fontWeight:
        '900',
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
      alignItems:
        'center',
    },

    emptyTitle: {
      color: '#777',
      fontWeight:
        '900',
    },

    emptyDescription: {
      color: '#555',
      marginTop: 8,
    },

    exerciseCard: {
      backgroundColor:
        '#121212',
      borderWidth: 1,
      borderColor:
        '#242424',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },

    exerciseHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
    },

    exerciseActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      marginLeft: 10,
    },

    moveButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor:
        '#191919',
      borderWidth: 1,
      borderColor:
        '#303030',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    moveButtonDisabled: {
      borderColor:
        '#1E1E1E',
      backgroundColor:
        '#101010',
    },

    moveButtonText: {
      color:
        '#D9FF43',
      fontSize: 17,
      fontWeight:
        '900',
    },

    moveButtonTextDisabled: {
      color: '#303030',
    },

    exerciseNumber: {
      color: '#666',
      fontSize: 9,
      fontWeight:
        '800',
      letterSpacing: 2,
    },

    exerciseName: {
      color:
        '#F5F5F2',
      fontSize: 22,
      fontWeight:
        '900',
      marginTop: 5,
    },

    focusBadge: {
      alignSelf:
        'flex-start',
      marginTop: 8,
      borderRadius: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },

    focusBadgeVolume: {
      backgroundColor:
        '#202617',
      borderWidth: 1,
      borderColor:
        '#35411D',
    },

    focusBadgePR: {
      backgroundColor:
        '#D9FF43',
    },

    focusBadgeText: {
      color:
        '#D9FF43',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 1.1,
    },

    focusBadgeTextDark: {
      color:
        '#080808',
    },

    removeExerciseButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor:
        '#1E1E1E',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    removeExerciseText: {
      color: '#777',
      fontSize: 22,
    },

    prOverview: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      marginTop: 18,
      marginBottom: 12,
    },

    overviewRight: {
      alignItems:
        'flex-end',
    },

    overviewLabel: {
      color: '#555',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 1.4,
    },

    overviewValue: {
      marginTop: 4,
      color: '#AAA',
      fontSize: 13,
      fontWeight:
        '900',
    },

    lastSessionCard: {
      backgroundColor:
        '#0D0D0D',
      borderWidth: 1,
      borderColor:
        '#252525',
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
    },

    lastSessionHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    lastSessionLabel: {
      color:
        '#F5F5F2',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1.2,
    },

    lastSessionSub: {
      color: '#555',
      fontSize: 8,
      fontWeight:
        '800',
      letterSpacing: 1,
      marginTop: 3,
    },

    copyButton: {
      backgroundColor:
        '#1A1A1A',
      borderWidth: 1,
      borderColor:
        '#333',
      borderRadius: 7,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },

    copyButtonText: {
      color:
        '#D9FF43',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 1,
    },

    noLastSession: {
      color: '#555',
      fontSize: 10,
      fontWeight:
        '800',
      marginTop: 16,
    },

    lastSetsList: {
      marginTop: 14,
    },

    lastSetRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      marginBottom: 9,
    },

    lastSetNumber: {
      width: 26,
      color: '#555',
      fontSize: 10,
      fontWeight:
        '900',
      marginTop: 2,
    },

    lastSetValue: {
      color: '#AAA',
      fontSize: 13,
      fontWeight:
        '800',
    },

    lastSetNote: {
      color: '#5F5F5F',
      fontSize: 9,
      lineHeight: 14,
      marginTop: 3,
    },

    volumeContainer: {
      backgroundColor:
        '#0D0D0D',
      borderWidth: 1,
      borderColor:
        '#222',
      borderRadius: 9,
      padding: 14,
      marginBottom: 12,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
    },

    volumeLabel: {
      color: '#666',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 1.5,
    },

    volumeValue: {
      color:
        '#F5F5F2',
      fontSize: 22,
      fontWeight:
        '900',
      marginTop: 4,
    },

    volumeRight: {
      alignItems:
        'flex-end',
      justifyContent:
        'center',
    },

    volumePositive: {
      color:
        '#D9FF43',
      fontWeight:
        '900',
    },

    volumeNegative: {
      color: '#888',
      fontWeight:
        '900',
    },

    volumePercent: {
      color: '#777',
      marginTop: 3,
      fontSize: 11,
      fontWeight:
        '700',
    },

    firstRecord: {
      color: '#666',
      fontSize: 9,
      fontWeight:
        '900',
    },

    prFocusCard: {
      backgroundColor:
        '#0D0D0D',
      borderWidth: 1,
      borderColor:
        '#33391C',
      borderRadius: 9,
      padding: 14,
      marginBottom: 12,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
    },

    prFocusRight: {
      alignItems:
        'flex-end',
    },

    prFocusPrevious: {
      color: '#AAA',
      fontSize: 14,
      fontWeight:
        '900',
      marginTop: 6,
    },

    prContainer: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 7,
      marginBottom: 14,
    },

    prBadge: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },

    prBadgeText: {
      color:
        '#080808',
      fontSize: 9,
      fontWeight:
        '900',
    },

    tableHeader: {
      flexDirection:
        'row',
      paddingBottom: 8,
    },

    tableHeaderText: {
      color: '#555',
      fontSize: 9,
      fontWeight:
        '900',
      textAlign:
        'center',
    },

    setBlock: {
      marginBottom: 12,
      borderRadius: 8,
    },

    setBlockPR: {
      backgroundColor:
        '#101307',
    },

    setRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    setColumn: {
      width: 44,
      alignItems:
        'center',
    },

    inputColumn: {
      flex: 1,
      marginHorizontal: 4,
    },

    doneColumn: {
      width: 58,
      alignItems:
        'center',
    },

    setNumber: {
      color: '#777',
      fontSize: 15,
      fontWeight:
        '900',
    },

    setPRBadge: {
      marginTop: 4,
      backgroundColor:
        '#D9FF43',
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },

    setPRBadgeText: {
      color:
        '#080808',
      fontSize: 7,
      fontWeight:
        '900',
    },

    numberInput: {
      backgroundColor:
        '#1B1B1B',
      borderWidth: 1,
      borderColor:
        '#292929',
      borderRadius: 8,
      color:
        '#F5F5F2',
      textAlign:
        'center',
      fontSize: 18,
      fontWeight:
        '800',
      paddingVertical: 10,
    },

    completedInput: {
      borderColor:
        '#3A4815',
      color:
        '#D9FF43',
    },

    completeButton: {
      width: 42,
      height: 42,
      borderRadius: 8,
      backgroundColor:
        '#1A1A1A',
      borderWidth: 1,
      borderColor:
        '#2A2A2A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    completeButtonActive: {
      backgroundColor:
        '#D9FF43',
    },

    completeButtonText: {
      color: '#555',
      fontSize: 18,
      fontWeight:
        '900',
    },

    completeButtonTextActive: {
      color:
        '#080808',
    },

    setMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginLeft: 52,
      marginRight: 5,
      marginTop: 6,
    },

    setMetaActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
    },

    setNoteToggle: {
      paddingVertical: 5,
      paddingRight: 12,
    },

    setNoteToggleText: {
      color: '#505050',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 1.2,
    },

    setNoteToggleTextActive: {
      color: '#8A8A8A',
    },

    noteSavedLabel: {
      color: '#3F4B20',
      fontSize: 7,
      fontWeight:
        '900',
      letterSpacing: 1,
    },

    deleteSetButton: {
      paddingVertical: 5,
      paddingHorizontal: 3,
    },

    deleteSetText: {
      color: '#884D4D',
      fontSize: 7,
      fontWeight:
        '900',
      letterSpacing: 0.9,
    },

    deleteSetTextDisabled: {
      color: '#303030',
    },

    setNoteInput: {
      marginLeft: 52,
      marginRight: 5,
      marginTop: 4,
      minHeight: 46,
      backgroundColor:
        '#0D0D0D',
      borderWidth: 1,
      borderColor:
        '#242424',
      borderRadius: 7,
      color: '#C7C7C7',
      paddingHorizontal: 11,
      paddingVertical: 9,
      fontSize: 11,
      lineHeight: 16,
    },

    addSetButton: {
      marginTop: 8,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor:
        '#2A2A2A',
      borderRadius: 8,
      alignItems:
        'center',
    },

    addSetText: {
      color: '#AAA',
      fontWeight:
        '900',
    },

    exerciseNoteInput: {
      marginTop: 12,
      minHeight: 54,
      backgroundColor:
        '#0D0D0D',
      borderWidth: 1,
      borderColor:
        '#222',
      borderRadius: 8,
      color: '#DDD',
      padding: 12,
    },

    addExerciseButton: {
      borderWidth: 1,
      borderColor:
        '#343434',
      borderStyle:
        'dashed',
      borderRadius: 10,
      paddingVertical: 18,
      alignItems:
        'center',
      marginBottom: 10,
    },

    addExerciseText: {
      color: '#AAA',
      fontWeight:
        '900',
    },

    saveTemplateButton: {
      borderWidth: 1,
      borderColor:
        '#35411D',
      backgroundColor:
        '#111409',
      borderRadius: 8,
      paddingVertical: 15,
      alignItems:
        'center',
      marginBottom: 10,
    },

    saveTemplateText: {
      color:
        '#D9FF43',
      fontSize: 10,
      fontWeight:
        '900',
      letterSpacing: 1.4,
    },

    finishButton: {
      backgroundColor:
        '#D9FF43',
      paddingVertical: 18,
      borderRadius: 8,
      alignItems:
        'center',
    },

    finishButtonText: {
      color:
        '#080808',
      fontWeight:
        '900',
    },

    modalContainer: {
      flex: 1,
      backgroundColor:
        '#0A0A0A',
    },

    modalHeader: {
      padding: 20,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    modalLabel: {
      color: '#666',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 1.4,
    },

    modalTitle: {
      color:
        '#F5F5F2',
      fontSize: 30,
      fontWeight:
        '900',
    },

    modalClose: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#1B1B1B',
      alignItems:
        'center',
      justifyContent:
        'center',
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
      backgroundColor:
        '#171717',
      borderWidth: 1,
      borderColor:
        '#292929',
      borderRadius: 10,
      color:
        '#F5F5F2',
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
      borderBottomColor:
        '#1D1D1D',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    exerciseOptionText: {
      color:
        '#EDEDEA',
      fontSize: 15,
      fontWeight:
        '800',
    },

    exerciseOptionPlus: {
      color:
        '#D9FF43',
      fontSize: 22,
    },

    customArea: {
      position:
        'absolute',
      left: 20,
      right: 20,
      bottom: 24,
    },

    customExerciseButton: {
      backgroundColor:
        '#D9FF43',
      paddingVertical: 17,
      borderRadius: 8,
      alignItems:
        'center',
    },

    customExerciseText: {
      color:
        '#080808',
      fontWeight:
        '900',
    },

    focusOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.82)',
      justifyContent:
        'center',
      paddingHorizontal: 22,
    },

    focusModal: {
      backgroundColor:
        '#111111',
      borderWidth: 1,
      borderColor:
        '#282828',
      borderRadius: 16,
      padding: 20,
    },

    focusModalLabel: {
      color: '#666',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 2,
    },

    focusExerciseName: {
      marginTop: 5,
      color:
        '#F5F5F2',
      fontSize: 27,
      fontWeight:
        '900',
    },

    focusDescription: {
      marginTop: 8,
      marginBottom: 20,
      color: '#777',
      fontSize: 12,
    },

    focusOption: {
      backgroundColor:
        '#171717',
      borderWidth: 1,
      borderColor:
        '#292929',
      borderRadius: 11,
      minHeight: 88,
      marginBottom: 10,
      padding: 15,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    focusOptionTitle: {
      color:
        '#D9FF43',
      fontSize: 16,
      fontWeight:
        '900',
      letterSpacing: 1.2,
    },

    focusOptionDescription: {
      marginTop: 5,
      color: '#777',
      fontSize: 10,
      lineHeight: 15,
      maxWidth: 240,
    },

    focusArrow: {
      color:
        '#D9FF43',
      fontSize: 24,
    },

    focusCancel: {
      marginTop: 5,
      paddingVertical: 12,
      alignItems:
        'center',
    },

    focusCancelText: {
      color: '#555',
      fontSize: 10,
      fontWeight:
        '900',
      letterSpacing: 1.4,
    },

    templateList: {
      padding: 18,
      paddingBottom: 50,
    },

    templateEmpty: {
      paddingVertical: 110,
      alignItems:
        'center',
      paddingHorizontal: 30,
    },

    templateEmptyTitle: {
      color: '#777',
      fontSize: 15,
      fontWeight:
        '900',
    },

    templateEmptyText: {
      marginTop: 10,
      color: '#555',
      textAlign:
        'center',
      fontSize: 11,
      lineHeight: 19,
    },

    templateCard: {
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#272727',
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
    },

    templateCardHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
    },

    templateCardLabel: {
      color: '#555',
      fontSize: 8,
      fontWeight:
        '900',
      letterSpacing: 1.5,
    },

    templateCardName: {
      color:
        '#F5F5F2',
      fontSize: 22,
      fontWeight:
        '900',
      marginTop: 3,
    },

    templateDelete: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    templateDeleteText: {
      color: '#555',
      fontSize: 8,
      fontWeight:
        '900',
    },

    templateExercises: {
      marginTop: 16,
    },

    templateExerciseRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      minHeight: 38,
      borderBottomWidth: 1,
      borderBottomColor:
        '#1E1E1E',
    },

    templateExerciseNumber: {
      width: 28,
      color: '#444',
      fontSize: 9,
      fontWeight:
        '900',
    },

    templateExerciseName: {
      flex: 1,
      color: '#AAA',
      fontSize: 11,
      fontWeight:
        '800',
    },

    templateFocus: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 4,
    },

    templateFocusVolume: {
      backgroundColor:
        '#202617',
    },

    templateFocusPR: {
      backgroundColor:
        '#D9FF43',
    },

    templateFocusText: {
      color:
        '#D9FF43',
      fontSize: 7,
      fontWeight:
        '900',
    },

    templateFocusTextDark: {
      color:
        '#080808',
    },

    templateUseButton: {
      backgroundColor:
        '#D9FF43',
      borderRadius: 7,
      paddingVertical: 14,
      alignItems:
        'center',
      marginTop: 16,
    },

    templateUseText: {
      color:
        '#080808',
      fontSize: 10,
      fontWeight:
        '900',
      letterSpacing: 1.3,
    },

    saveTemplateModal: {
      backgroundColor:
        '#111',
      borderWidth: 1,
      borderColor:
        '#292929',
      borderRadius: 15,
      padding: 20,
    },

    saveTemplateTitle: {
      color:
        '#F5F5F2',
      fontSize: 24,
      fontWeight:
        '900',
      marginTop: 5,
    },

    saveTemplateDescription: {
      color: '#666',
      fontSize: 10,
      lineHeight: 16,
      marginTop: 7,
    },

    templateNameInput: {
      marginTop: 18,
      backgroundColor:
        '#191919',
      borderWidth: 1,
      borderColor:
        '#303030',
      borderRadius: 8,
      color:
        '#F5F5F2',
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      fontWeight:
        '800',
    },

    saveTemplateActions: {
      flexDirection:
        'row',
      gap: 8,
      marginTop: 14,
    },

    saveTemplateCancel: {
      flex: 1,
      borderWidth: 1,
      borderColor:
        '#303030',
      borderRadius: 8,
      paddingVertical: 14,
      alignItems:
        'center',
    },

    saveTemplateCancelText: {
      color: '#666',
      fontSize: 9,
      fontWeight:
        '900',
    },

    saveTemplateConfirm: {
      flex: 2,
      backgroundColor:
        '#D9FF43',
      borderRadius: 8,
      paddingVertical: 14,
      alignItems:
        'center',
    },

    saveTemplateConfirmText: {
      color:
        '#080808',
      fontSize: 9,
      fontWeight:
        '900',
      letterSpacing: 1,
    },
  });
