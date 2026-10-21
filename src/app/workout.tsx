import { CustomExerciseForm } from '../components/custom-exercise-form';
import { customExerciseBlock, getCustomExercises, isCustomExercise, searchExerciseLibrary, type CustomExercise } from '../lib/customExercises';
import { numericInput, evaluatePR, exerciseVolume, topSet, setPR, sameExercise, loadLabel, setSummary, volumeAvailable } from '../lib/pr';
import { queueWorkoutCompletion } from '../lib/notifications';
import { SetOptions } from '../components/set-options';
import { setResultLabel } from '../lib/setResult';
import { useAccountOwner } from '../hooks/use-account-owner';
import { workoutFinishAlert } from '../lib/workoutFinishAlert';
import { EXERCISE_LIBRARY, EXERCISE_CATEGORIES, type ExerciseCategory } from '../lib/exerciseLibrary';
import { cardioTotals, completedWorkoutExercises, emptyCardioInput } from '../lib/cardio';
import { CardioExerciseCard } from '../components/cardio-exercise-card';
import {
  useEffect,
  useMemo,
  useRef,
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
  exerciseKey?: string;
  equipment?: string;
  muscleGroup?: string;
  id: number;
  name: string;
  focus: ExerciseFocus;
  note: string;
  sets: SetItem[];
  type?: WorkoutExercise['type'];
  cardio?: WorkoutExercise['cardio'];
  loadType?: WorkoutExercise['loadType'];
};



export default function WorkoutScreen() {
  const ownerId = useAccountOwner();
  const [customLibrary, setCustomLibrary] = useState<CustomExercise[]>([]);
  const [customLibraryError, setCustomLibraryError] = useState('');
  const [libraryReload, setLibraryReload] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [customEditor, setCustomEditor] = useState<{ category: ExerciseCategory; query: string; existing?: CustomExercise } | null>(null);
  const customAddBusy = useRef(false);
  const customEditorBusy = useRef(false);
  useEffect(() => {
    let alive = true;
    void getCustomExercises(ownerId).then(items => { if (alive) { setCustomLibrary(items); setCustomLibraryError(''); } })
      .catch(() => { if (alive) setCustomLibraryError('Could not load your exercise library. Retry before creating an exercise.'); });
    return () => { alive = false; };
  }, [ownerId, libraryReload]);

  const [prVersion, setPRVersion] = useState<1 | 2>(1);
  const [pendingLoadType, setPendingLoadType] = useState<WorkoutExercise['loadType']>(undefined);
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
            setPRVersion(activeWorkout.prVersion ?? 1);
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
      prVersion,
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
    prVersion,
    exercises,
  ]);

  const [exerciseCategory, setExerciseCategory] = useState<ExerciseCategory | null>(null);
  const filteredExercises = useMemo(() => searchExerciseLibrary(searchText, exerciseCategory, customLibrary, showArchived), [searchText, exerciseCategory, customLibrary, showArchived]);
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

  const getLastExercise = (name: string, focus: ExerciseFocus, loadType?: WorkoutExercise['loadType'], exerciseKey?: string): WorkoutExercise | null => {
    const current = { id: 0, name, loadType, exerciseKey, sets: [], note: '' } as WorkoutExercise;
    for (const workout of workoutHistory) {
      const exercise = workout.exercises.find(item => sameExercise(item, current) && (item.focus ?? 'VOLUME') === focus);
      if (exercise) return exercise;
    }
    return null;
  };
  const getLastCompletedSets = (name: string, focus: ExerciseFocus, loadType?: WorkoutExercise['loadType'], exerciseKey?: string) => getLastExercise(name, focus, loadType, exerciseKey)?.sets.filter(s => s.completed) ?? [];
  const getLastVolume = (name: string, focus: ExerciseFocus, loadType?: WorkoutExercise['loadType'], exerciseKey?: string) => {
    const old = getLastExercise(name, focus, loadType, exerciseKey); return old ? exerciseVolume(old, prVersion) : 0;
  };
  const getLastTopSet = (name: string, focus: ExerciseFocus, loadType?: WorkoutExercise['loadType'], exerciseKey?: string) => {
    const old = getLastExercise(name, focus, loadType, exerciseKey); return old ? topSet(old, prVersion) : null;
  };
  const copyLastSets = (exerciseId: number) => {
    const exercise = exercises.find(e => e.id === exerciseId); if (!exercise) return;
    const sets = getLastCompletedSets(exercise.name, exercise.focus, exercise.loadType, exercise.exerciseKey);
    if (!sets.length) { Alert.alert('NO PREVIOUS SESSION', 'No previous sets for this exercise and classification.'); return; }
    setExercises(items => items.map(e => e.id === exerciseId ? { ...e, sets: sets.map((set, index) => ({ ...set, id: Date.now() + index, completed: false, note: '' })) } : e));
  };
  const getPR = (exercise: Exercise) => {
    const previous = workoutHistory.flatMap(w => w.exercises.filter(e => sameExercise(e, exercise)));
    const sets = previous.flatMap(e => e.sets);
    if (prVersion === 1 && !exercise.exerciseKey && !sets.some(set => set.completed && Number(set.weight) > 0)) return '—';
    return setSummary(exercise, topSet({ ...exercise, sets }, prVersion));
  };
  const classifyEmptyExercise = (exercise: Exercise, loadType: NonNullable<WorkoutExercise['loadType']>) => {
    if (exercise.sets.some(set => set.weight.trim() || set.reps.trim() || set.completed)) {
      Alert.alert('KEEP EXISTING SETS', 'Add a new classified PULL UP block. Existing values are kept.');
      return;
    }
    setExercises(items => items.map(item => item.id === exercise.id ? { ...item, loadType, sets: item.sets.map(set => ({ ...set, weight: loadType === 'bodyweight' ? '0' : '' })) } : item));
  };
  const getCurrentTopSet = (exercise: Exercise) => topSet(exercise, prVersion);
  const getSetPRType = (exercise: Exercise, set: SetItem) => setPR(exercise, set, workoutHistory, prVersion);
  const getVolumeDifference = (exercise: Exercise) => exerciseVolume(exercise, prVersion) - getLastVolume(exercise.name, exercise.focus, exercise.loadType, exercise.exerciseKey);
  const getVolumePercentage = (exercise: Exercise) => {
    const last = getLastVolume(exercise.name, exercise.focus, exercise.loadType, exercise.exerciseKey);
    return last ? getVolumeDifference(exercise) / last * 100 : null;
  };

  const startWorkout = async () => {
      setPRVersion(2);
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
        prVersion: 2,
        startedAt:
          now,

        exercises: [],
      });
    };

  const startFromTemplate =
    async (
      template: WorkoutTemplate
    ) => {
      setPRVersion(2);
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
              loadType: item.loadType,
              exerciseKey: item.exerciseKey, equipment: item.equipment, muscleGroup: item.muscleGroup,

              focus:
                item.focus,

              note: '',

              sets: [
                {
                  id:
                    exerciseId +
                    1,

                  weight: item.loadType === 'bodyweight' ? '0' : '',
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
        prVersion: 2,
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
                loadType: exercise.loadType,
                exerciseKey: exercise.exerciseKey, equipment: exercise.equipment, muscleGroup: exercise.muscleGroup,
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
    setPendingLoadType(undefined);
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

  const addCustomExercise = () => {
    if (!exerciseCategory) return;
    setCustomEditor({ category: exerciseCategory, query: searchText.trim() });
  };
  const addSavedCustomExercise = async (item: CustomExercise) => {
    if (customAddBusy.current) return;
    if (!startedAt) throw new Error('Start a workout before adding an exercise.');
    customAddBusy.current = true;
    try {
      const block = customExerciseBlock(item, Math.max(Date.now(), ...exercises.map(exercise => exercise.id + 100)));
      const next = [...exercises, { ...block, focus: block.focus ?? 'VOLUME', sets: block.sets.map(set => ({ ...set, note: set.note ?? '' })) }];
      await saveActiveWorkout(ownerId, { prVersion, startedAt, exercises: next });
      setExercises(next);
      setCustomEditor(null); setExerciseModalVisible(false); setSearchText('');
    } finally { customAddBusy.current = false; }
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

    if (pendingExerciseName === 'PULL UP' && prVersion === 2 && editingExerciseId === null && !pendingLoadType) { Alert.alert('PULL UP TYPE', 'Choose ASSISTED, BODYWEIGHT or WEIGHTED.'); return; }
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
        ...(pendingExerciseName === 'PULL UP' && pendingLoadType ? { loadType: pendingLoadType } : {}),

        focus,

        note: '',

        sets: [
          {
            id:
              now + 1,

            weight: pendingLoadType === 'bodyweight' ? '0' : '',
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

                  weight: exercise.loadType === 'bodyweight' ? '0' : lastSet?.weight ?? '',

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
      try { completedExercises = completedWorkoutExercises(exercises);
        if (prVersion === 2 && completedExercises.some(e => !e.exerciseKey && e.name === 'PULL UP' && !e.loadType)) throw new Error('Choose a PULL UP classification before finishing.');
        if (completedExercises.some(e => (prVersion === 2 || !!e.exerciseKey) && e.type !== 'cardio' && e.sets.some(set => { const weight = e.loadType === 'bodyweight' ? 0 : numericInput(set.weight), reps = numericInput(set.reps); return weight === null || (e.loadType !== 'bodyweight' && weight <= 0) || reps === null || !Number.isInteger(reps); }))) throw new Error('Enter valid weight and actual reps for each completed set.'); }
      catch (error) {
        workoutFinishAlert(exercises.some(e => e.type === 'cardio' && (error as Error).message.startsWith(`${e.name}:`)) ? 'CARDIO' : 'CHECK WORKOUT', (error as Error).message);
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
                    prVersion,
                    id: `${Date.now()}`,
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

                    exercises: completedExercises.map(e => e.loadType === 'bodyweight' ? { ...e, sets: e.sets.map(set => ({ ...set, weight: '0' })) } : e),
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
                              key={`${template.id}-${loadLabel(exercise)}-${index}`}
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
                                {loadLabel(exercise)}
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
              key={exercise.id} name={loadLabel(exercise)} index={exerciseIndex}
              cardio={exercise.cardio ?? emptyCardioInput()} memo={exercise.note}
              onChange={cardio => setExercises(prev => prev.map(item => item.id === exercise.id ? { ...item, cardio } : item))}
              onMemo={note => setExercises(prev => prev.map(item => item.id === exercise.id ? { ...item, note } : item))}
              onRemove={() => removeExercise(exercise.id)}
              onMove={direction => moveExercise(exercise.id, direction)}
              canMoveUp={exerciseIndex > 0} canMoveDown={exerciseIndex < exercises.length - 1}
            />;
            const lastSets =
              getLastCompletedSets(exercise.name, exercise.focus, exercise.loadType, exercise.exerciseKey);

            const currentVolume =
              exerciseVolume(exercise, prVersion);

            const lastVolume =
              getLastVolume(exercise.name, exercise.focus, exercise.loadType, exercise.exerciseKey);

            const lastTopSet =
              getLastTopSet(exercise.name, exercise.focus, exercise.loadType, exercise.exerciseKey);

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

            const prStatus = evaluatePR(exercise, workoutHistory, prVersion, 'live');
            const { weightPR, repPR, volumePR } = prStatus;

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
                      {loadLabel(exercise)}
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
                      {getPR(exercise)}
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
                          copyLastSets(exercise.id)
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
                            key={`${loadLabel(exercise)}-${exercise.focus}-${index}`}
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
                                {setSummary(exercise, set)}
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
                        {volumeAvailable(exercise) ? `${currentVolume.toLocaleString()}kg${exercise.loadType === 'weighted' ? ' ADDED' : ''}` : '— (EXCLUDED)'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.volumeRight
                      }
                    >
                      {!volumeAvailable(exercise) ? <Text style={styles.firstRecord}>VOLUME NOT CALCULATED</Text> : lastVolume > 0 ? (
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
                        {setSummary(exercise, currentTopSet)}
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
                        {setSummary(exercise, lastTopSet)}
                      </Text>
                    </View>
                  </View>
                )}

                {prStatus.recordStatus === 'first' && <Text style={styles.recordBadge}>FIRST RECORD</Text>}
                {!exercise.exerciseKey && exercise.name === 'PULL UP' && prVersion === 2 && !exercise.loadType && <View style={{ gap: 8 }}><Text style={styles.firstRecord}>CHOOSE PULL UP TYPE BEFORE RECORDING</Text>{(['assisted', 'bodyweight', 'weighted'] as const).map(loadType => <Pressable key={loadType} onPress={() => classifyEmptyExercise(exercise, loadType)}><Text style={styles.copyButtonText}>{loadType.toUpperCase()}</Text></Pressable>)}</View>}
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
                  >{exercise.loadType === 'assisted' ? 'ASSIST kg' : exercise.loadType === 'weighted' ? 'ADDED kg' : exercise.loadType === 'bodyweight' ? 'BODYWEIGHT' : 'KG'}</Text>

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
                      getSetPRType(exercise, set);

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
                              editable={exercise.loadType !== 'bodyweight' && !(!exercise.exerciseKey && exercise.name === 'PULL UP' && prVersion === 2 && !exercise.loadType)}
                              accessibilityLabel={exercise.loadType === 'assisted' ? 'Assistance (kg)' : exercise.loadType === 'weighted' ? 'Added weight (kg)' : 'Weight (kg)'}
                              value={exercise.loadType === 'bodyweight' ? '0' : set.weight}
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
                              placeholderTextColor="#999999"
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
                              editable={!(!exercise.exerciseKey && exercise.name === 'PULL UP' && prVersion === 2 && !exercise.loadType)}
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
                              disabled={!exercise.exerciseKey && exercise.name === 'PULL UP' && prVersion === 2 && !exercise.loadType}
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
                            placeholderTextColor="#999999"
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
            setExerciseCategory(null); setCustomEditor(null); setShowArchived(false);

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
        onRequestClose={() => { if (!customEditorBusy.current) { if (customEditor) setCustomEditor(null); else setExerciseModalVisible(false); } }}
      >
        <SafeAreaView
          style={
            styles.modalContainer
          }
        >
          {customEditor ? <CustomExerciseForm
            key={customEditor.existing?.exerciseKey ?? 'create'} owner={ownerId} {...customEditor}
            onBusyChange={value => { customEditorBusy.current = value; }}
            onCancel={() => setCustomEditor(null)}
            onArchived={async () => { setCustomLibrary(await getCustomExercises(ownerId)); setCustomEditor(null); }}
            onSaved={async item => {
              setCustomLibrary(items => [...items.filter(old => old.exerciseKey !== item.exerciseKey), item]);
              if (customEditor.existing) setCustomEditor(null);
              else await addSavedCustomExercise(item);
            }}
          /> : <>
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

          {(!searchText.trim() || !!exerciseCategory) && <View style={{ paddingHorizontal: 24, gap: 12 }}>
            {exerciseCategory ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}><Pressable onPress={() => setExerciseCategory(null)}><Text style={styles.exerciseOptionText}>‹ CATEGORIES · {exerciseCategory.toUpperCase()}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={showArchived ? 'Show active exercises' : 'Show archived exercises'} onPress={() => setShowArchived(value => !value)}><Text style={styles.copyButtonText}>{showArchived ? 'ACTIVE' : 'ARCHIVED'}</Text></Pressable></View> : EXERCISE_CATEGORIES.map(category => <Pressable key={category} style={styles.exerciseOption} onPress={() => setExerciseCategory(category)}><Text style={styles.exerciseOptionText}>{category.toUpperCase()}</Text><Text style={styles.exerciseOptionPlus}>›</Text></Pressable>)}
          </View>}
          {!!customLibraryError && <View style={styles.customArea}><Text style={styles.exerciseOptionText}>{customLibraryError}</Text><Pressable accessibilityRole="button" onPress={() => setLibraryReload(value => value + 1)}><Text style={styles.customExerciseText}>RETRY LIBRARY</Text></Pressable></View>}
          {!!exerciseCategory && !!searchText.trim() && !filteredExercises.length && <View style={styles.customArea}><Text style={styles.exerciseOptionText}>No exercises found.</Text><Pressable accessibilityRole="button" disabled={!!customLibraryError} onPress={addCustomExercise}><Text style={styles.customExerciseText}>+ CREATE EXERCISE</Text></Pressable></View>}
          <FlatList
            data={
              filteredExercises
            }
            keyExtractor={(
              item
            ) => isCustomExercise(item) ? item.exerciseKey : item.name}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              styles.exerciseList
            }
            renderItem={({ item }) => isCustomExercise(item) ? <View style={styles.exerciseOption}>
              <Pressable accessibilityRole="button" style={{ flex: 1 }} disabled={!!item.archivedAt} onPress={() => void addSavedCustomExercise(item).catch(error => Alert.alert('COULD NOT ADD EXERCISE', error instanceof Error ? error.message : 'Please retry.'))}>
                <Text style={styles.exerciseOptionText}>{item.name}{item.archivedAt ? ' · ARCHIVED' : ' · CUSTOM'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={() => setCustomEditor({ category: item.category, query: item.name, existing: item })}><Text style={styles.customExerciseText}>EDIT</Text></Pressable>
            </View> : <Pressable accessibilityRole="button" style={styles.exerciseOption} onPress={() => chooseExercise(item.name)}><Text style={styles.exerciseOptionText}>{item.name}{item.type === 'cardio' ? ' · CARDIO' : ''}</Text><Text style={styles.exerciseOptionPlus}>+</Text></Pressable>}

          />

          {!!exerciseCategory && <View style={styles.customArea}>
            <Pressable accessibilityRole="button" disabled={!!customLibraryError} style={styles.customExerciseButton} onPress={addCustomExercise}><Text style={styles.customExerciseText}>+ CREATE EXERCISE</Text></Pressable>
          </View>}
          </>}
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
                ? 'Choose your training goal for this exercise.'
                : 'Choose your training goal for today.'}
            </Text>

            {pendingExerciseName === 'PULL UP' && prVersion === 2 && editingExerciseId === null && <View style={{ gap: 8, marginBottom: 12 }}>
              {(['assisted', 'bodyweight', 'weighted'] as const).map(loadType => <Pressable key={loadType} accessibilityRole="radio" accessibilityState={{ checked: pendingLoadType === loadType }} onPress={() => setPendingLoadType(loadType)}><Text style={styles.copyButtonText}>{pendingLoadType === loadType ? '● ' : '○ '}{loadType.toUpperCase()}</Text></Pressable>)}
            </View>}
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
                  Build your training volume
                  with regular working sets.
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
                  Challenge your personal
                  best weight.
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

const styles = StyleSheet.create({
    recordBadge: { color: '#999999', fontSize: 11, borderWidth: 1, borderColor: '#666', padding: 8, alignSelf: 'flex-start', marginVertical: 8 },
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
      color: '#999999',
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
      color: '#999999',
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontWeight:
        '900',
    },

    emptyDescription: {
      color: '#999999',
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
      color: '#999999',
      fontSize: 11,
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
      fontSize: 11,
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
      color: '#999999',
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1,
    },

    noLastSession: {
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
      lineHeight: 16,
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontWeight:
        '900',
    },

    volumePercent: {
      color: '#999999',
      marginTop: 3,
      fontSize: 11,
      fontWeight:
        '700',
    },

    firstRecord: {
      color: '#999999',
      fontSize: 11,
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
      fontSize: 11,
      fontWeight:
        '900',
    },

    tableHeader: {
      flexDirection:
        'row',
      paddingBottom: 8,
    },

    tableHeaderText: {
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
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
      fontSize: 11,
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
      color: '#999999',
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
      flexWrap: 'wrap',
      gap: 6,
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
      flexWrap: 'wrap',
      flexShrink: 1,
      alignItems:
        'center',
      gap: 10,
    },

    setNoteToggle: {
      paddingVertical: 5,
      paddingRight: 12,
    },

    setNoteToggleText: {
      color: '#999999',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1.2,
    },

    setNoteToggleTextActive: {
      color: '#C7C7C7',
    },

    noteSavedLabel: {
      color: '#B9C98D',
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1,
    },

    deleteSetButton: {
      paddingVertical: 5,
      paddingHorizontal: 3,
    },

    deleteSetText: {
      color: '#D99B9B',
      fontSize: 11,
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
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
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
      color: '#999999',
      fontSize: 13,
      lineHeight: 19,
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 15,
      fontWeight:
        '900',
    },

    templateEmptyText: {
      marginTop: 10,
      color: '#999999',
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      fontSize: 11,
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
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      color: '#999999',
      fontSize: 11,
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
      fontSize: 11,
      fontWeight:
        '900',
      letterSpacing: 1,
    },
  });
