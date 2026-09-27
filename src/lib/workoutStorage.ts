import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@loads/workouts';
const ACTIVE_WORKOUT_KEY = '@loads/active-workout';

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
};

export type WorkoutExercise = {
  id: number;
  name: string;

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

export async function getWorkouts(): Promise<WorkoutSession[]> {
  try {
    const json =
      await AsyncStorage.getItem(
        STORAGE_KEY
      );

    if (!json) {
      return [];
    }

    return JSON.parse(json);
  } catch (error) {
    console.error(
      'Failed to load workouts:',
      error
    );

    return [];
  }
}

export async function saveWorkout(
  workout: WorkoutSession
) {
  try {
    const current =
      await getWorkouts();

    const updated = [
      workout,
      ...current,
    ];

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error(
      'Failed to save workout:',
      error
    );

    throw error;
  }
}

export async function getActiveWorkout(): Promise<ActiveWorkout | null> {
  try {
    const json =
      await AsyncStorage.getItem(
        ACTIVE_WORKOUT_KEY
      );

    if (!json) {
      return null;
    }

    return JSON.parse(json);
  } catch (error) {
    console.error(
      'Failed to load active workout:',
      error
    );

    return null;
  }
}

export async function saveActiveWorkout(
  workout: ActiveWorkout
) {
  try {
    await AsyncStorage.setItem(
      ACTIVE_WORKOUT_KEY,
      JSON.stringify(workout)
    );
  } catch (error) {
    console.error(
      'Failed to save active workout:',
      error
    );

    throw error;
  }
}

export async function clearActiveWorkout() {
  try {
    await AsyncStorage.removeItem(
      ACTIVE_WORKOUT_KEY
    );
  } catch (error) {
    console.error(
      'Failed to clear active workout:',
      error
    );

    throw error;
  }
}

export async function deleteAllWorkouts() {
  await AsyncStorage.removeItem(
    STORAGE_KEY
  );
}