import { numericInput } from './pr';
import type { WorkoutExercise } from './workoutStorage';

// Presets use canonical names as identity; custom movements have their own key.
const BIG3_PRESETS = new Set(['BENCH PRESS', 'SQUAT', 'DEADLIFT']);

export function isBig3Exercise(exercise: Pick<WorkoutExercise, 'name' | 'exerciseKey' | 'type' | 'loadType'>): boolean {
  return !exercise.exerciseKey && exercise.type !== 'cardio' && !exercise.loadType && BIG3_PRESETS.has(exercise.name);
}

/** Display-only Epley estimate. Never used to evaluate or store records. */
export function estimatedOneRepMax(weightInput: string, repsInput: string): number | null {
  const weight = numericInput(weightInput);
  const reps = numericInput(repsInput);
  if (weight === null || weight <= 0 || reps === null || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function formatEstimatedOneRepMax(value: number): string {
  return `${Number(value.toFixed(1))}kg`;
}
