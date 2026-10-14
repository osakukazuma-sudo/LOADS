import type { WorkoutSession } from './workoutStorage';
import type { WorkoutPostExercise } from './postStorage';
import { cardioRecord } from './cardio';
import { evaluatePR, exerciseVolume, topSet, numericInput } from './pr';

export function buildPostExercises(workout: WorkoutSession, history: WorkoutSession[]): WorkoutPostExercise[] {
  const version = workout.prVersion ?? 1;
  return workout.exercises.map(exercise => {
    if (exercise.type === 'cardio') return {
      id: exercise.id, name: exercise.name, type: 'cardio', cardio: cardioRecord(exercise), note: exercise.note,
      focus: 'VOLUME', bestWeight: 0, bestReps: 0, sets: 0, volume: 0, prTypes: [],
    };
    const best = topSet(exercise, version);
    const result = evaluatePR(exercise, history, version, 'post', workout);
    return {
      ...(exercise.sets.some(set => set.completed && (set.targetReps || set.status)) ? { setResults: exercise.sets.filter(set => set.completed).map(set => ({ weight: set.weight, reps: set.reps, ...(set.targetReps ? { targetReps: set.targetReps } : {}), ...(set.status ? { status: set.status } : {}) })) } : {}),
      type: 'strength', id: exercise.id, name: exercise.name, focus: exercise.focus ?? 'VOLUME',
      ...(exercise.loadType ? { loadType: exercise.loadType } : {}),
      ...(version === 2 ? { prVersion: 2 as const } : {}),
      ...(result.recordStatus ? { recordStatus: result.recordStatus } : {}),
      bestWeight: best ? (version === 2 ? numericInput(best.weight) ?? 0 : Number(best.weight) || 0) : 0,
      bestReps: best ? Number(best.reps) || 0 : 0,
      sets: exercise.sets.filter(set => set.completed).length,
      volume: exerciseVolume(exercise, version), note: exercise.note, prTypes: result.prTypes,
    };
  });
}
