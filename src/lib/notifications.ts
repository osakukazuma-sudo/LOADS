import { supabase } from './supabase';
import { currentUserId } from './cloudPosts';
import { getWorkouts, type WorkoutSession } from './workoutStorage';
import { readLocal, updateLocal } from './userLocalData';
import { beginAccountOperation } from './accountActivity';

export async function workoutNotificationsEnabled(owner: string) {
  if (await currentUserId() !== owner) throw new Error('Account changed.');
  const result = await supabase.from('notification_preferences').select('workout_enabled').eq('user_id', owner).maybeSingle();
  if (result.error) throw result.error;
  return result.data?.workout_enabled ?? false;
}
export async function setWorkoutNotifications(owner: string, enabled: boolean) {
  if (await currentUserId() !== owner) throw new Error('Account changed.');
  const result = await supabase.from('notification_preferences').upsert({ user_id: owner, workout_enabled: enabled });
  if (result.error) throw result.error;
}

// Each device remembers a baseline: older histories must never suddenly send pushes.
type CompletionState = { baseline: string; acknowledged: string[]; pending?: string[] };
export async function initializeCompletionSync(owner: string) {
  const state = await readLocal<CompletionState | null>(owner, 'completion-sync', null);
  if (!state) await updateLocal<CompletionState | null>(owner, 'completion-sync', null, old => old ?? { baseline: new Date().toISOString(), acknowledged: [] });
}
const syncing = new Map<string, Promise<void>>();
export async function queueWorkoutCompletion(owner: string, workout: WorkoutSession) {
  await updateLocal<CompletionState | null>(owner, 'completion-sync', null, old => ({
    baseline: old?.baseline ?? new Date().toISOString(), acknowledged: old?.acknowledged ?? [],
    pending: [...new Set([...(old?.pending ?? []), workout.id])],
  }));
  await syncWorkoutCompletions(owner, 'workout-finish');
}
export function syncWorkoutCompletions(owner: string, trigger = 'syncWorkoutCompletions'): Promise<void> {
  const existing = syncing.get(owner); if (existing) return existing;
  const run = (async () => {
    const release = beginAccountOperation({ name: 'workout-completion-sync', source: `notifications.${trigger}` });
    try {
    release.setPhase?.('initialize-completion-sync');
    await initializeCompletionSync(owner);
    release.setPhase?.('read-completion-state');
    const state = (await readLocal<CompletionState | null>(owner, 'completion-sync', null))!;
    release.setPhase?.('read-workouts');
    const workouts = await getWorkouts(owner);
    for (const workout of workouts.filter(w => (w.finishedAt >= state.baseline || state.pending?.includes(w.id)) && !state.acknowledged.includes(w.id))) {
      await recordCompletion(owner, workout, phase => release.setPhase?.(phase));
      release.setPhase?.('save-completion-acknowledgement');
      await updateLocal<CompletionState | null>(owner, 'completion-sync', null, old => old ? { ...old, pending: old.pending?.filter(id => id !== workout.id), acknowledged: [...new Set([...old.acknowledged, workout.id])] } : state);
    }
    } finally { release(); }
  })().finally(() => syncing.delete(owner));
  syncing.set(owner, run); return run;
}
async function recordCompletion(owner: string, workout: WorkoutSession, phase: (value: string) => void) {
  phase('auth-get-session');
  if (await currentUserId() !== owner) throw new Error('Account changed.');
  phase('record-workout-completion-rpc');
  const result = await supabase.rpc('record_workout_completion', { p_workout_id: workout.id, p_finished_at: workout.finishedAt, p_duration_seconds: workout.durationSeconds });
  if (result.error) throw result.error;
  // Server queue is durable. Its scheduled worker is independent of this client.
}
