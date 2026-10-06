import type { WorkoutSet } from './workoutStorage';
export function setResult(set: Pick<WorkoutSet, 'reps' | 'targetReps' | 'status'>) {
  if (set.status === 'failed' || set.status === 'stopped') return set.status;
  const target = Number(set.targetReps), actual = Number(set.reps);
  return set.reps.trim() && Number.isInteger(target) && target > 0 && Number.isFinite(actual) && actual < target ? 'failed' : 'completed';
}
export function setResultLabel(set: Pick<WorkoutSet, 'reps' | 'targetReps' | 'status'>) {
  const target = Number(set.targetReps);
  return [Number.isInteger(target) && target > 0 ? `target ${target}` : '', setResult(set) === 'completed' ? '' : setResult(set).toUpperCase()].filter(Boolean).join(' · ');
}
