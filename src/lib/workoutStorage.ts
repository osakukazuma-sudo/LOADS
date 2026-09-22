import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@loads/workouts';

export type WorkoutSet = {
  id: number;
  weight: string;
  reps: string;
  completed: boolean;
};

export type WorkoutExercise = {
  id: number;
  name: string;
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

export async function getWorkouts(): Promise<WorkoutSession[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);

    if (!json) {
      return [];
    }

    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to load workouts:', error);
    return [];
  }
}

export async function saveWorkout(workout: WorkoutSession) {
  try {
    const current = await getWorkouts();

    const updated = [workout, ...current];

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error('Failed to save workout:', error);
    throw error;
  }
}

export async function deleteAllWorkouts() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}