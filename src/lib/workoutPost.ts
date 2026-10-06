import type { ExerciseFocus, WorkoutExercise, WorkoutSession } from './workoutStorage';
import type { PostPRType, WorkoutPostExercise } from './postStorage';
import { cardioRecord } from './cardio';

  const normalizeFocus = (
    focus?: ExerciseFocus
  ): ExerciseFocus => {
    return focus ?? 'VOLUME';
  };

  const calculateExerciseVolume = (
    exercise: WorkoutExercise
  ) => {
    if (exercise.type === 'cardio') return 0;
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
    currentWorkout: WorkoutSession,
    workoutHistory: WorkoutSession[]
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
    exercise: WorkoutExercise,
    workoutHistory: WorkoutSession[]
  ): PostPRType[] => {
    if (exercise.type === 'cardio') return [];
    const olderWorkouts =
      getOlderWorkouts(
        currentWorkout, workoutHistory
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
              oldExercise.type === 'cardio' || oldExercise.name !==
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



export function buildPostExercises(workout: WorkoutSession, workoutHistory: WorkoutSession[]): WorkoutPostExercise[] {
      return workout.exercises.map(
        (exercise) => {
          if (exercise.type === 'cardio') {
            return {
              id: exercise.id, name: exercise.name, type: 'cardio' as const,
              cardio: cardioRecord(exercise), note: exercise.note,
              // Zero strength totals keep the existing post aggregate contract.
              focus: 'VOLUME' as const, bestWeight: 0, bestReps: 0,
              sets: 0, volume: 0, prTypes: [],
            };
          }
          const topSet =
            getTopSet(
              exercise
            );

          return {
            ...(exercise.sets.some(set => set.completed && (set.targetReps || set.status)) ? { setResults: exercise.sets.filter(set => set.completed).map(set => ({ weight: set.weight, reps: set.reps, ...(set.targetReps ? { targetReps: set.targetReps } : {}), ...(set.status ? { status: set.status } : {}) })) } : {}),
            type: 'strength' as const,
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
                exercise,
                workoutHistory
              ),
          };
        }
      );
}
