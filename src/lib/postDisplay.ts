import type { WorkoutPostExercise, PostPRType } from './postStorage';

type SetValues = Pick<WorkoutPostExercise, 'loadType'>;
export function postSetSummary(exercise: SetValues, weight: string | number, reps: string | number) {
  if (exercise.loadType === 'bodyweight') return `${reps} reps · BODYWEIGHT`;
  if (exercise.loadType === 'assisted') return `${weight}kg assistance × ${reps}`;
  if (exercise.loadType === 'weighted') return `${weight}kg added × ${reps}`;
  return `${weight}kg × ${reps}`;
}

export function postBestSummary(exercise: WorkoutPostExercise) {
  if (exercise.loadType === 'bodyweight') return exercise.bestReps > 0 ? postSetSummary(exercise, 0, exercise.bestReps) : '—';
  return exercise.bestWeight > 0 ? postSetSummary(exercise, exercise.bestWeight, exercise.bestReps) : '—';
}

export function postVolumeSummary(exercise: WorkoutPostExercise) {
  if (exercise.loadType === 'assisted' || exercise.loadType === 'bodyweight') return 'VOLUME EXCLUDED';
  return `${exercise.volume.toLocaleString()}kg${exercise.loadType === 'weighted' ? ' ADDED-WEIGHT VOLUME' : ''}`;
}

export function postPRLabel(exercise: WorkoutPostExercise, pr: PostPRType) {
  if (exercise.loadType === 'assisted') return pr === 'WEIGHT PR' ? 'WEIGHT PR · LESS ASSISTANCE' : 'REP PR · SAME ASSISTANCE';
  if (exercise.loadType === 'bodyweight') return 'REP PR · BODYWEIGHT';
  if (exercise.loadType === 'weighted') return `${pr} · ${pr === 'REP PR' ? 'SAME ADDED WEIGHT' : 'ADDED WEIGHT'}`;
  return pr;
}

export function postVolumeNote(exercises: WorkoutPostExercise[]) {
  const excluded = exercises.some(exercise => exercise.loadType === 'assisted' || exercise.loadType === 'bodyweight');
  const added = exercises.some(exercise => exercise.loadType === 'weighted');
  return [excluded ? 'Volume excludes assisted and bodyweight sets.' : '', added ? 'Weighted pull-up volume uses added weight only; bodyweight is not included.' : ''].filter(Boolean).join(' ');
}
