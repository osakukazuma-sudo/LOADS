import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@loads/posts';

export type WorkoutPostExercise = {
  id: number;
  name: string;
  bestWeight: number;
  bestReps: number;
  sets: number;
  volume: number;
  note: string;
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

  exercises: WorkoutPostExercise[];
};

export async function getPosts(): Promise<WorkoutPost[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);

    if (!json) {
      return [];
    }

    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to load posts:', error);
    return [];
  }
}

export async function savePost(post: WorkoutPost) {
  try {
    const current = await getPosts();

    const updated = [
      post,
      ...current,
    ];

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error('Failed to save post:', error);
    throw error;
  }
}

export async function deleteAllPosts() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}