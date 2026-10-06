import type { WorkoutPost, WorkoutPostExercise } from './postStorage';
import { cardioOptionalFields } from './cardio';

const prTypes = new Set(['WEIGHT PR', 'REP PR', 'VOLUME PR']);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e15;
const integer = (value: unknown): value is number => number(value) && Number.isInteger(value) && value <= 2147483647;

export function parseExercises(value: unknown): WorkoutPostExercise[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error('Invalid exercise snapshot.');
  const ids = new Set<number>();
  return value.map((item: unknown) => {
    if (!record(item) || typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || ids.has(item.id) ||
        typeof item.name !== 'string' || item.name.length > 200 ||
        (item.focus !== 'PR' && item.focus !== 'VOLUME') ||
        !number(item.bestWeight) || !integer(item.bestReps) || !integer(item.sets) || !number(item.volume) ||
        typeof item.note !== 'string' || item.note.length > 10000 ||
        !Array.isArray(item.prTypes) || item.prTypes.length > 3 ||
        !item.prTypes.every((pr: unknown) => typeof pr === 'string' && prTypes.has(pr))) {
      throw new Error('Invalid exercise snapshot.');
    }
    if (item.type !== undefined && item.type !== 'strength' && item.type !== 'cardio') {
      throw new Error('Invalid exercise type.');
    }
    if (item.type === 'cardio') {
      if (!record(item.cardio) || !number(item.cardio.durationMinutes) ||
          [...cardioOptionalFields, 'caloriesKcal'].some(field => {
            const value = (item.cardio as Record<string, unknown>)[field];
            return value != null && (!number(value) || (field === 'paceSeconds' && !Number.isInteger(value)));
          }) ||
          item.sets !== 0 || item.volume !== 0 || item.bestWeight !== 0 || item.bestReps !== 0 || item.prTypes.length !== 0) {
        throw new Error('Invalid cardio snapshot.');
      }
    } else if (item.cardio !== undefined) {
      throw new Error('Invalid strength snapshot.');
    }
    ids.add(item.id);
    if (item.setResults !== undefined && (!Array.isArray(item.setResults) || item.setResults.length > 500 || item.setResults.some(set =>
      !record(set) || typeof set.weight !== 'string' || set.weight.length > 32 || typeof set.reps !== 'string' || set.reps.length > 32 ||
      (set.targetReps !== undefined && (typeof set.targetReps !== 'string' || !/^\d{1,4}$/.test(set.targetReps) || Number(set.targetReps) <= 0)) ||
      (set.status !== undefined && !['completed','failed','stopped'].includes(String(set.status)))
    ))) throw new Error('Invalid set results.');
    return item as WorkoutPostExercise;
  });
}

export function validatePost(value: unknown): asserts value is WorkoutPost {
  if (!record(value) || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id) ||
      typeof value.workoutId !== 'string' || value.workoutId.length < 1 || value.workoutId.length > 100 ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.caption !== 'string' || Array.from(value.caption).length > 300 ||
      (value.photoUri !== null && typeof value.photoUri !== 'string') ||
      !integer(value.durationSeconds) || !integer(value.totalSets) || !number(value.totalVolume) || !integer(value.prCount)) {
    throw new Error('This workout cannot be published. Check its values and try again.');
  }
  parseExercises(value.exercises);
  if (value.trainingPartners !== undefined && (!Array.isArray(value.trainingPartners) || value.trainingPartners.length > 3 ||
      new Set(value.trainingPartners.map(partner => record(partner) ? partner.id : null)).size !== value.trainingPartners.length ||
      value.trainingPartners.some(partner => !record(partner) || typeof partner.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(partner.id) || typeof partner.username !== 'string' || !/^[A-Za-z0-9_]{1,30}$/.test(partner.username)))) {
    throw new Error('Choose up to three different training partners.');
  }
}

export function postErrorMessage(error: unknown): string {
  if (record(error) && error.code === 'P0001' && typeof error.message === 'string' && /INVALID_PARTNER|INVALID_PARTNERS/.test(error.message)) return 'A training partner is no longer available. Your saved post is kept. Follow them again before retrying.';
  if (record(error) && error.code === '42501') return 'Posting is not permitted. Sign in again and retry.';
  if (record(error) && (error.code === '42P01' || error.code === 'PGRST205')) return 'The cloud feed is not set up yet. Your saved post can be retried later.';
  if (error instanceof Error) return error.message;
  return 'Could not reach the cloud. Your saved post can be retried.';
}
