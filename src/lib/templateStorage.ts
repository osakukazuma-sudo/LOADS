import { readLocal, updateLocal } from './userLocalData';
import type { ExerciseFocus, ExerciseType } from './workoutStorage';
export type WorkoutTemplateExercise = {
  name: string;
  type?: ExerciseType;
  focus: ExerciseFocus;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  createdAt: string;
  exercises: WorkoutTemplateExercise[];
};


export function getTemplates(userId: string): Promise<WorkoutTemplate[]> { return readLocal(userId, 'templates', []); }
export function saveTemplate(userId: string, template: WorkoutTemplate) { return updateLocal<WorkoutTemplate[]>(userId, 'templates', [], items => [template, ...items.filter(item => item.id !== template.id)]); }
export function deleteTemplate(userId: string, templateId: string) { return updateLocal<WorkoutTemplate[]>(userId, 'templates', [], items => items.filter(item => item.id !== templateId)); }
