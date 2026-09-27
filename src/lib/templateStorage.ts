import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
    ExerciseFocus,
} from './workoutStorage';

const STORAGE_KEY = '@loads/templates';

export type WorkoutTemplateExercise = {
  name: string;
  focus: ExerciseFocus;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  createdAt: string;
  exercises: WorkoutTemplateExercise[];
};

export async function getTemplates(): Promise<WorkoutTemplate[]> {
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
      'Failed to load templates:',
      error
    );

    return [];
  }
}

export async function saveTemplate(
  template: WorkoutTemplate
) {
  try {
    const current =
      await getTemplates();

    const updated = [
      template,
      ...current,
    ];

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error(
      'Failed to save template:',
      error
    );

    throw error;
  }
}

export async function deleteTemplate(
  templateId: string
) {
  try {
    const current =
      await getTemplates();

    const updated =
      current.filter(
        (template) =>
          template.id !==
          templateId
      );

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error(
      'Failed to delete template:',
      error
    );

    throw error;
  }
}