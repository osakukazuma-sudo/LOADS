import type { WorkoutExercise, WorkoutSession, WorkoutSet, PRVersion } from './workoutStorage';
import type { PostPRType } from './postStorage';

export const sameExercise = (a: WorkoutExercise, b: WorkoutExercise) =>
  a.type !== 'cardio' && b.type !== 'cardio' &&
  (a.exerciseKey || b.exerciseKey ? !!a.exerciseKey && a.exerciseKey === b.exerciseKey : a.name === b.name) && a.loadType === b.loadType;
export const volumeAvailable = (e: WorkoutExercise) => e.type !== 'cardio' && e.loadType !== 'assisted' && e.loadType !== 'bodyweight';
export function numericInput(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value < 1e15 ? value : null;
}
export function validSets(e: WorkoutExercise) {
  return e.sets.filter(s => {
    const weight = e.loadType === 'bodyweight' ? 0 : numericInput(s.weight), reps = numericInput(s.reps);
    return s.completed && weight !== null && (e.loadType === 'bodyweight' || weight > 0) && reps !== null && Number.isInteger(reps) && reps > 0;
  });
}
export function exerciseVolume(e: WorkoutExercise, version: PRVersion = 1): number {
  if (e.exerciseKey) version = 2;
  if (!volumeAvailable(e)) return 0;
  return (version === 2 ? validSets(e) : e.sets.filter(s => s.completed))
    .reduce((sum, s) => sum + (version === 2 ? numericInput(s.weight)! * numericInput(s.reps)! : (Number(s.weight) || 0) * (Number(s.reps) || 0)), 0);
}
export function topSet(e: WorkoutExercise, version: PRVersion = 1): WorkoutSet | null {
  if (e.exerciseKey) version = 2;
  const sets = version === 2 ? validSets(e) : e.sets.filter(s => s.completed);
  return sets.reduce<WorkoutSet | null>((best, set) => {
    if (!best) return set;
    const weight = version === 2 ? numericInput(set.weight) ?? 0 : Number(set.weight) || 0;
    const previous = version === 2 ? numericInput(best.weight) ?? 0 : Number(best.weight) || 0;
    return (e.loadType === 'assisted' ? weight < previous : weight > previous) || (weight === previous && (Number(set.reps) || 0) > (Number(best.reps) || 0)) ? set : best;
  }, null);
}
export type PRResult = { weightPR: boolean; repPR: boolean; volumePR: boolean; recordStatus?: 'first' | 'established'; prTypes: PostPRType[] };
export function evaluatePR(e: WorkoutExercise, history: WorkoutSession[], version: PRVersion = 1, context: 'live' | 'history' | 'post' = 'post', current?: WorkoutSession): PRResult {
  // New custom movements always use classified v2 semantics, even in an old
  // resumed workout; historical preset calculations remain unchanged.
  if (e.exerciseKey) version = 2;
  if (version === 2 && !e.exerciseKey && e.name === 'PULL UP' && !e.loadType) return { weightPR: false, repPR: false, volumePR: false, prTypes: [] };
  const older = current ? history.filter(w => w.id !== current.id && Date.parse(w.finishedAt) < Date.parse(current.finishedAt)) : history;
  const matching = older.flatMap(w => w.exercises.filter(old => version === 2 ? sameExercise(old, e) : !old.exerciseKey && old.type !== 'cardio' && old.name === e.name));
  const previous = matching.flatMap(old => version === 2 ? validSets(old) : old.sets.filter(s => s.completed));
  const sets = e.type === 'cardio' ? [] : version === 2 ? validSets(e) : e.sets.filter(s => s.completed);
  const weight = (s: WorkoutSet) => e.loadType === 'bodyweight' ? 0 : version === 2 ? numericInput(s.weight)! : Number(s.weight) || 0;
  const reps = (s: WorkoutSet) => version === 2 ? numericInput(s.reps)! : Number(s.reps) || 0;
  const historicalWeight = e.loadType === 'assisted' && version === 2 ? Math.min(...previous.map(weight)) : Math.max(0, ...previous.map(weight));
  const first = version === 2 && sets.length > 0 && previous.length === 0;
  const weightPR = e.type !== 'cardio' && e.loadType !== 'bodyweight' && !first && sets.some(s => weight(s) > 0 && (version === 2 && e.loadType === 'assisted' ? weight(s) < historicalWeight : weight(s) > historicalWeight));
  const repPR = e.type !== 'cardio' && !first && sets.some(s => {
    if ((e.loadType !== 'bodyweight' && weight(s) <= 0) || reps(s) <= 0) return false;
    const atWeight = previous.filter(old => weight(old) === weight(s));
    return (version === 1 || atWeight.length > 0) && reps(s) > Math.max(0, ...atWeight.map(reps));
  });
  const volumeHistory = context === 'live' && version === 1 ? older.flatMap(w => {
    const old = w.exercises.find(item => !item.exerciseKey && item.type !== 'cardio' && item.name === e.name && (item.focus ?? 'VOLUME') === 'VOLUME');
    return old ? [old] : [];
  }) : matching.filter(old => (old.focus ?? 'VOLUME') === 'VOLUME');
  const validVolumeHistory = version === 2 ? volumeHistory.filter(old => validSets(old).length > 0) : volumeHistory;
  const volume = exerciseVolume(e, version);
  const volumePR = e.type !== 'cardio' && volumeAvailable(e) && (e.focus ?? 'VOLUME') === 'VOLUME' && !first &&
    (version === 1 || validVolumeHistory.length > 0) && volume > 0 && volume > Math.max(0, ...validVolumeHistory.map(old => exerciseVolume(old, version)));
  const prTypes: PostPRType[] = [];
  if (weightPR) prTypes.push('WEIGHT PR');
  if (repPR) prTypes.push('REP PR');
  if (volumePR) prTypes.push('VOLUME PR');
  return { weightPR, repPR, volumePR, prTypes, ...(version === 2 && sets.length ? { recordStatus: first ? 'first' as const : 'established' as const } : {}) };
}
export function setPR(e: WorkoutExercise, set: WorkoutSet, history: WorkoutSession[], version: PRVersion): PostPRType | null {
  if (!set.completed || (Number(set.weight) <= 0 && e.loadType !== 'bodyweight') || Number(set.reps) <= 0) return null;
  return evaluatePR({ ...e, sets: [set] }, history, version, 'live').prTypes.find(p => p !== 'VOLUME PR') ?? null;
}
export function loadLabel(e: Pick<WorkoutExercise, 'name' | 'loadType'>) {
  return e.loadType ? `${e.name} (${e.loadType.toUpperCase()})` : e.name;
}
export function setSummary(e: WorkoutExercise, set: WorkoutSet | null) {
  if (!set) return '—';
  if (e.loadType === 'bodyweight') return `${set.reps} reps`;
  return `${set.weight}kg${e.loadType === 'assisted' ? ' assistance' : e.loadType === 'weighted' ? ' added' : ''} × ${set.reps}`;
}
