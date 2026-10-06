import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseType } from './workoutStorage';

export type CardioRecord = {
  durationMinutes: number;
  distanceKm: number | null;
  /** Legacy snapshots only. */
  caloriesKcal?: number | null;
  speedKmh?: number | null;
  inclinePercent?: number | null;
  resistanceLevel?: number | null;
  paceSeconds?: number | null; // Per 500 m.
  floors?: number | null;
};

const STORAGE_KEY = '@loads/posts';

export type PostPRType =
  | 'WEIGHT PR'
  | 'REP PR'
  | 'VOLUME PR';

export type PostExerciseFocus =
  | 'VOLUME'
  | 'PR';

export type WorkoutPostExercise = {
  id: number;
  name: string;
  type?: ExerciseType;
  cardio?: CardioRecord;
  setResults?: { weight: string; reps: string; targetReps?: string; status?: 'completed' | 'failed' | 'stopped' }[];

  focus: PostExerciseFocus;

  bestWeight: number;
  bestReps: number;

  sets: number;
  volume: number;

  note: string;

  prTypes: PostPRType[];
};

export type WorkoutPost = {
  id: string;
  workoutId: string;

  createdAt: string;

  caption: string;

  photoUri: string | null;

  durationSeconds: number;

  totalSets: number;
  totalVolume: number;

  prCount: number;

  exercises: WorkoutPostExercise[];
  trainingPartners?: { id: string; username: string }[];
};

export async function getPosts(): Promise<WorkoutPost[]> {
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
      'Failed to load posts:',
      error
    );

    return [];
  }
}

export async function savePost(
  post: WorkoutPost
) {
  try {
    const current =
      await getPosts();

    const updated = [
      post,
      ...current,
    ];

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error(
      'Failed to save post:',
      error
    );

    throw error;
  }
}

export async function deleteAllPosts() {
  await AsyncStorage.removeItem(
    STORAGE_KEY
  );
}
