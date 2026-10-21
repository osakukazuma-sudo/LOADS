import { EXERCISE_CATEGORIES, EXERCISE_LIBRARY, normalizeExerciseSearch, searchExercises, type ExerciseCategory, type ExerciseDefinition } from './exerciseLibrary';
import { readLocal, updateLocal } from './userLocalData';
import type { LoadType, WorkoutExercise } from './workoutStorage';

export const EQUIPMENT = [
  ['barbell', 'Barbell'], ['dumbbell', 'Dumbbell'], ['smith', 'Smith Machine'],
  ['machine', 'Machine'], ['cable', 'Cable'], ['bodyweight', 'Bodyweight'], ['other', 'Other'],
] as const;
export const TRACKING_TYPES = [
  ['weight_reps', 'WEIGHT + REPS'], ['bodyweight', 'BODYWEIGHT'], ['weighted', 'WEIGHTED'], ['assisted', 'ASSISTED'],
] as const;
export type TrackingType = typeof TRACKING_TYPES[number][0];
export type CustomExercise = ExerciseDefinition & {
  exerciseKey: string; trackingType: TrackingType; createdAt: string; updatedAt: string; archivedAt: string | null;
};
export type CustomExerciseDraft = Pick<CustomExercise, 'exerciseKey' | 'name' | 'category' | 'equipment' | 'trackingType'>;
export const isCustomExercise = (item: ExerciseDefinition): item is CustomExercise => 'exerciseKey' in item;
const validKey = /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCustomExercise(draft: CustomExerciseDraft, items: CustomExercise[] = []) {
  const name = draft.name.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!name || name.length > 100) throw new Error('Enter an exercise name (1–100 characters).');
  if (!validKey.test(draft.exerciseKey)) throw new Error('Invalid exercise identifier.');
  if (!EXERCISE_CATEGORIES.includes(draft.category) || draft.category === 'cardio') throw new Error('Choose a muscle group. Cardio presets remain available in the exercise list.');
  if (!EQUIPMENT.some(([key]) => key === draft.equipment) || !TRACKING_TYPES.some(([key]) => key === draft.trackingType)) throw new Error('Choose equipment and a tracking type.');
  const normalized = normalizeExerciseSearch(name);
  if (EXERCISE_LIBRARY.some(item => [item.name, ...item.aliases].some(alias => normalizeExerciseSearch(alias) === normalized))) {
    throw new Error('A preset already uses this name. Choose it from the list or use a more specific name.');
  }
  const duplicate = items.find(item => item.exerciseKey !== draft.exerciseKey && item.category === draft.category && normalizeExerciseSearch(item.name) === normalized);
  if (duplicate) throw new Error(duplicate.archivedAt ? 'An archived exercise uses this name. Show archived exercises to restore it.' : 'This muscle group already has an exercise with this name.');
  return name;
}
function library(value: CustomExercise[]) {
  if (!Array.isArray(value) || value.some(item => !item || !validKey.test(item.exerciseKey) || typeof item.name !== 'string' || !Array.isArray(item.aliases) || !TRACKING_TYPES.some(([key]) => key === item.trackingType) || !EQUIPMENT.some(([key]) => key === item.equipment) || !EXERCISE_CATEGORIES.includes(item.category) || item.category === 'cardio')) throw new Error('Could not read the exercise library. Saved data has been kept.');
  return value;
}
export async function getCustomExercises(owner: string): Promise<CustomExercise[]> {
  return library(await readLocal<CustomExercise[]>(owner, 'custom-exercises', []));
}
export async function saveCustomExercise(owner: string, draft: CustomExerciseDraft): Promise<CustomExercise> {
  let saved!: CustomExercise;
  await updateLocal<CustomExercise[]>(owner, 'custom-exercises', [], old => {
    const items = library(old);
    const name = validateCustomExercise(draft, items);
    const previous = items.find(item => item.exerciseKey === draft.exerciseKey);
    if (previous && previous.trackingType !== draft.trackingType) throw new Error('Tracking type is fixed to protect your records. Create a new exercise for another type.');
    const now = new Date().toISOString();
    saved = { ...draft, name, type: 'strength', bodyPart: draft.category, variation: 'custom', aliases: [], createdAt: previous?.createdAt ?? now, updatedAt: now, archivedAt: previous?.archivedAt ?? null };
    return [...items.filter(item => item.exerciseKey !== draft.exerciseKey), saved];
  });
  return saved;
}
export async function archiveCustomExercise(owner: string, key: string, archived = true) {
  await updateLocal<CustomExercise[]>(owner, 'custom-exercises', [], old => {
    const items = library(old);
    if (!items.some(item => item.exerciseKey === key)) throw new Error('Exercise not found. Refresh the library.');
    return items.map(item => item.exerciseKey === key ? { ...item, archivedAt: archived ? new Date().toISOString() : null, updatedAt: new Date().toISOString() } : item);
  });
}
export function customExerciseBlock(item: CustomExercise, id = Date.now()): WorkoutExercise {
  if (item.archivedAt) throw new Error('Restore this exercise before adding it.');
  const loadType: LoadType | undefined = item.trackingType === 'weight_reps' ? undefined : item.trackingType;
  return { id, exerciseKey: item.exerciseKey, name: item.name, equipment: item.equipment, muscleGroup: item.category, type: 'strength', ...(loadType ? { loadType } : {}), focus: 'VOLUME', note: '', sets: [{ id: id + 1, weight: loadType === 'bodyweight' ? '0' : '', reps: '', completed: false, note: '' }] };
}
export function searchExerciseLibrary(query: string, category: ExerciseCategory | null, items: CustomExercise[], archived = false): ExerciseDefinition[] {
  const terms = query.normalize('NFKC').trim().split(/\s+/).map(normalizeExerciseSearch).filter(Boolean);
  const custom = items.filter(item => (!!item.archivedAt === archived) && (!category || item.category === category) && (terms.length ? terms.every(term => normalizeExerciseSearch(item.name).includes(term)) : !!category));
  return archived ? custom : [...searchExercises(query, category), ...custom];
}
