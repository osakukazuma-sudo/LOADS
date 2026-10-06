import { readLocal, updateLocal } from './userLocalData';
export type ExerciseType = 'strength' | 'cardio';
export type CardioInput = {
  durationMinutes: string;
  distanceKm: string;
  /** Legacy input only; never recorded by the new UI. */
  caloriesKcal?: string;
  speedKmh?: string;
  inclinePercent?: string;
  resistanceLevel?: string;
  paceSeconds?: string; // Input as m:ss per 500 m.
  floors?: string;
};
export type ExerciseFocus =
  | 'VOLUME'
  | 'PR';

export type WorkoutSet = {
  id: number;
  weight: string;
  reps: string;
  completed: boolean;

  // 古い保存データとの互換性のため optional
  note?: string;
  targetReps?: string;
  status?: 'completed' | 'failed' | 'stopped';
};

export type WorkoutExercise = {
  id: number;
  name: string;
  // Missing type in legacy records always means strength.
  type?: ExerciseType;
  cardio?: CardioInput;

  // 古い保存データとの互換性
  focus?: ExerciseFocus;

  note: string;
  sets: WorkoutSet[];
};

export type WorkoutSession = {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  exercises: WorkoutExercise[];
};

export type ActiveWorkout = {
  startedAt: string;
  exercises: WorkoutExercise[];
};


export function getWorkouts(userId: string): Promise<WorkoutSession[]> { return readLocal(userId, 'workouts', []); }
function withoutLegacyCalories<T extends ActiveWorkout>(workout: T): T {
  if (!Array.isArray(workout.exercises)) return workout;
  return { ...workout, exercises: workout.exercises.map(exercise => {
    if (exercise.type !== 'cardio' || !exercise.cardio) return exercise;
    const { caloriesKcal: _legacyCalories, ...cardio } = exercise.cardio;
    return { ...exercise, cardio };
  }) };
}
export function saveWorkout(userId: string, workout: WorkoutSession) { return updateLocal<WorkoutSession[]>(userId, 'workouts', [], items => [withoutLegacyCalories(workout), ...items.filter(item => item.id !== workout.id)]); }
export function getActiveWorkout(userId: string): Promise<ActiveWorkout | null> { return readLocal(userId, 'active-workout', null); }
export function saveActiveWorkout(userId: string, workout: ActiveWorkout) { return updateLocal<ActiveWorkout | null>(userId, 'active-workout', null, () => withoutLegacyCalories(workout)); }
export function clearActiveWorkout(userId: string) { return updateLocal(userId, 'active-workout', null, () => null); }
export function deleteAllWorkouts(userId: string) { return updateLocal<WorkoutSession[]>(userId, 'workouts', [], () => []); }
