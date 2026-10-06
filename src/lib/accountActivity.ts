let operations = 0;
let signingOut = false;
let generation = 0;
type OperationName = 'unspecified' | 'prepare-post' | 'upload-post' | 'retry-post' | 'delete-post' | 'push-register' | 'workout-completion-sync' | 'follow-write' | 'logout' | 'delete-account';
export type OperationDetails = { name: OperationName; source: string };
type OperationRecord = OperationDetails & {
  id: number; mode: 'operation' | 'exclusive'; startedAt: string; startedAtMs: number;
  phase: string; phaseStartedAt: string; endCalled: boolean; endedAt: string | null;
};
type Release = (() => void) & { setPhase: (phase: string) => void };
let nextId = 0;
const active = new Map<number, OperationRecord>();
let exclusive: OperationRecord | null = null;
const recent: OperationRecord[] = [];
const defaultDetails: OperationDetails = { name: 'unspecified', source: 'unspecified' };
// Read-only session boundary for background registration deduplication.
export function getAccountActivityGeneration() { return generation; }
export type SignOutBlockedDiagnostics = ReturnType<typeof getAccountActivityDiagnostics> & { event: 'signout-blocked' };
// Associate the immutable rejection snapshot with this specific error, so a
// later network failure cannot accidentally display an earlier blocked attempt.
const blockedSnapshots = new WeakMap<Error, SignOutBlockedDiagnostics>();
export function getSignOutBlockedDiagnostics(error: unknown): SignOutBlockedDiagnostics | null {
  if (process.env.EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS !== 'true' || !(error instanceof Error)) return null;
  const snapshot = blockedSnapshots.get(error);
  return snapshot ? JSON.parse(JSON.stringify(snapshot)) as SignOutBlockedDiagnostics : null;
}

function record(details: OperationDetails, mode: OperationRecord['mode']): OperationRecord {
  const now = Date.now();
  return { ...details, id: ++nextId, mode, startedAtMs: now, startedAt: new Date(now).toISOString(),
    phase: 'started', phaseStartedAt: new Date(now).toISOString(), endCalled: false, endedAt: null };
}
// Explicit source/phase labels only: never include account IDs, tokens, payloads,
// error messages or stacks in these records. Copies prevent diagnostic consumers
// from modifying the actual lock state.
export function getAccountActivityDiagnostics() {
  const now = Date.now();
  const copy = (item: OperationRecord) => ({ ...item, elapsedMs: Math.max(0, now - item.startedAtMs) });
  return { diagnosticVersion: 'account-activity-v1', capturedAt: new Date(now).toISOString(),
    operationCount: operations, trackedOperationCount: active.size, signingOut,
    activeOperations: [...active.values()].map(copy), exclusiveOperation: exclusive ? copy(exclusive) : null,
    recentEndedOperations: recent.map(item => ({ ...item })) };
}
function log(event: string, item?: OperationRecord) {
  // Rejections are logged in release/TestFlight too. Verbose start/phase/end
  // logging is opt-in when bundling a diagnostic build.
  if (event !== 'signout-blocked' && process.env.EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS !== 'true') return;
  try {
    console.warn('[LOADS accountActivity]', JSON.stringify({ event,
      ...(item ? { operation: { ...item } } : {}), ...getAccountActivityDiagnostics() }));
  } catch { /* Logging must never prevent finally from releasing a lock. */ }
}
function releaseFor(item: OperationRecord, finish: () => void): Release {
  const release = (() => {
    if (item.endCalled) return;
    item.endCalled = true; item.endedAt = new Date().toISOString();
    finish();
    recent.push({ ...item });
    if (recent.length > 40) recent.shift();
    log('end', item);
  }) as Release;
  release.setPhase = phase => {
    if (item.endCalled) return;
    item.phase = phase; item.phaseStartedAt = new Date().toISOString();
    log('phase', item);
  };
  return release;
}
// Native permission/token acquisition can wait indefinitely. It must not hold
// the mutation lock, but its eventual result must not survive a sign-out.
export function prepareAccountOperation(details: OperationDetails = defaultDetails) {
  const started = generation;
  return () => {
    if (started !== generation) throw new Error('Account changed.');
    return beginAccountOperation(details);
  };
}
export function beginAccountOperation(details: OperationDetails = defaultDetails): Release {
  if (signingOut) throw new Error('Sign out is in progress.');
  operations++;
  const item = record(details, 'operation');
  active.set(item.id, item);
  log('begin', item);
  return releaseFor(item, () => { active.delete(item.id); operations--; });
}
export function beginSignOut(details: OperationDetails = { name: 'logout', source: 'beginSignOut' }): Release {
  if (operations || signingOut) {
    const error = new Error('Wait for the current upload or deletion to finish before signing out.');
    if (process.env.EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS === 'true') {
      blockedSnapshots.set(error, { event: 'signout-blocked', ...getAccountActivityDiagnostics() });
    }
    log('signout-blocked');
    throw error;
  }
  signingOut = true;
  generation++;
  const item = record(details, 'exclusive');
  exclusive = item;
  log('begin', item);
  return releaseFor(item, () => { signingOut = false; exclusive = null; });
}
