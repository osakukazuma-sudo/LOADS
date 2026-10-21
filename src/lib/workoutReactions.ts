// Keep the Build 14 catalog for stored values and notification compatibility.
export const ALL_WORKOUT_REACTIONS = [
  { type: 'beast', emoji: '🦍', label: 'BEAST!!' },
  { type: 'yeah_buddy', emoji: '⚡', label: 'YEAH BUDDY!!' },
  { type: 'pain_zone', emoji: '☠️', label: 'WELCOME TO THE PAIN ZONE!!' },
  { type: 'light_weight', emoji: '🗣️', label: 'LIGHT WEIGHT BABY!!' },
  { type: 'no_tomorrow', emoji: '🔥', label: 'THERE IS NO TOMORROW!!' },
  { type: 'wagmi', emoji: '🔱', label: 'WAGMI BRAH!!' },
  { type: 'slay', emoji: '💅', label: 'SLAYYYYY!!' },
  { type: 'built_different', emoji: '🧬', label: 'BUILT DIFFERENT!!' },
] as const;

// Only these existing IDs are offered for new selections.
export const WORKOUT_REACTIONS = [
  ALL_WORKOUT_REACTIONS[0],
  ALL_WORKOUT_REACTIONS[1],
  ALL_WORKOUT_REACTIONS[6],
  ALL_WORKOUT_REACTIONS[3],
] as const;

export type ReactionType = typeof ALL_WORKOUT_REACTIONS[number]['type'];

export type ReactionFailure = { code: string | null; category: 'setup' | 'permission' | 'auth' | 'network' | 'unknown' };
export function reactionFailure(error: unknown): ReactionFailure {
  const candidate = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const code = typeof candidate === 'string' && /^(?:PGRST\d{3}|\d{2}[A-Z0-9]{3}|P0001)$/.test(candidate) ? candidate : null;
  const category = ['PGRST205', 'PGRST204', '42P01', '42703'].includes(code ?? '') ? 'setup'
    : code === '42501' ? 'permission'
      : ['PGRST301', 'PGRST302', 'PGRST303'].includes(code ?? '') ? 'auth'
        : error instanceof TypeError ? 'network' : 'unknown';
  return { code, category };
}
export function reactionFailureMessage(failure?: ReactionFailure) {
  if (failure?.category === 'setup') return 'Workout reactions are not available on this server yet. Server setup needs to be updated.';
  if (failure?.category === 'permission') return 'Reaction access was denied. Refresh the feed or sign in again.';
  if (failure?.category === 'auth') return 'Your session could not be verified. Sign in again to use reactions.';
  return 'Could not confirm reaction. Refresh before retrying.';
}
// Never log the original error, message, details, hint, URL query, row IDs,
// session, headers or payload. Only fixed phase, safe SQL code and public host.
export function reportReactionFailure(phase: 'read_one' | 'read_page' | 'save' | 'cancel', error: unknown) {
  let projectHost: string | null = null;
  try { projectHost = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').hostname; } catch { /* No configured host. */ }
  try { console.warn('[LOADS reactions]', JSON.stringify({ phase, ...reactionFailure(error), projectHost })); } catch { /* Diagnostics must never change the result. */ }
}

// Absolute desired state makes retry after a lost response idempotent.
export function createReactionController(
  read: () => Promise<ReactionType | null>,
  write: (value: ReactionType | null) => Promise<void>,
  changed: () => void,
  initial?: ReactionType | null,
  initialFailure?: ReactionFailure,
) {
  const state = { value: (initial ?? null) as ReactionType | null, busy: false, ready: initial !== undefined, error: false, failure: initialFailure };
  let alive = true;
  async function refresh() {
    if (state.busy || !alive) return;
    state.busy = true; changed();
    try { const value = await read(); if (alive) { state.value = value; state.ready = true; state.error = false; state.failure = undefined; } }
    catch (error) { if (alive) { state.ready = false; state.error = true; state.failure = reactionFailure(error); } }
    finally { state.busy = false; if (alive) changed(); }
  }
  async function select(type: ReactionType) {
    if (!alive || state.busy || !state.ready) return;
    const previous = state.value;
    const desired = previous === type ? null : type;
    state.busy = true; state.value = desired; state.error = false; state.failure = undefined; changed();
    try { await write(desired); }
    catch (error) {
      if (alive) {
        state.value = previous; state.error = true; state.ready = false; state.failure = reactionFailure(error);
        // A rejected HTTP response may follow a committed write. Reconcile first.
        try { const value = await read(); if (alive) { state.value = value; state.ready = true; } } catch (readError) { if (alive) state.failure = reactionFailure(readError); }
      }
    } finally { state.busy = false; if (alive) changed(); }
  }
  return { state, refresh, select, activate: () => { alive = true; }, dispose: () => { alive = false; } };
}
