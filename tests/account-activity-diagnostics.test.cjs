const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(verbose = false) {
  const logs = [], cache = {};
  const state = { owner: 'owner', token: deferred(), rpc: deferred(), history: [], baseline: null,
    readWorkouts: null, readStarted: deferred(), tokenStarted: deferred(), rpcStarted: deferred(),
    effect: null, resume: null, interval: null, tokenChanged: null, logThrows: false };
  const client = { rpc: async () => { state.rpcStarted.resolve(); return state.rpc.promise; } };
  const mocks = {
    './supabase': { supabase: client }, './cloudPosts': { currentUserId: async () => state.owner },
    './workoutStorage': { getWorkouts: async () => { state.readStarted.resolve(); return state.readWorkouts ? state.readWorkouts.promise : state.history; } },
    './userLocalData': { readLocal: async (_owner, _collection, fallback) => state.baseline ?? fallback,
      updateLocal: async (_owner, _collection, fallback, update) => { state.baseline = update(state.baseline ?? fallback); } },
    '@react-native-async-storage/async-storage': { getItem: async () => 'installation' },
    'expo-crypto': {}, 'expo-device': { isDevice: true },
    'expo-constants': { expoConfig: { extra: { eas: { projectId: 'project' } } } },
    'expo-notifications': { getPermissionsAsync: async () => ({ granted: true }),
      getExpoPushTokenAsync: async options => { state.tokenStarted.resolve(); return options.devicePushToken ? { data: `token-${options.devicePushToken.data}` } : state.token.promise; },
      setNotificationHandler: () => {}, getLastNotificationResponse: () => null,
      addNotificationResponseReceivedListener: () => ({ remove() {} }),
      addPushTokenListener: callback => { state.tokenChanged = callback; return { remove() {} }; } },
    'react': { useEffect: effect => { state.effect = effect; } },
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active',
      addEventListener: (_event, callback) => { state.resume = callback; return { remove() {} }; } } },
    'expo-router': { router: {} },
  };
  function load(name) {
    if (cache[name]) return cache[name];
    const m = { exports: {} }; cache[name] = m.exports;
    const file = name === 'notification-gate' ? 'src/components/notification-gate.tsx' : `src/lib/${name}.ts`;
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', 'console', 'process', 'setInterval', 'clearInterval', code)(
      spec => mocks[spec] ?? load(spec.replace(/^\.\//, '').replace(/^\.\.\/lib\//, '')),
      m, m.exports, { warn: (...args) => { if (state.logThrows) throw Error('logger unavailable'); logs.push(JSON.parse(args[1])); } },
      { env: { EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS: String(verbose) } },
      callback => { state.interval = callback; return 1; }, () => {});
    return m.exports;
  }
  return { load, state, logs, activity: load('accountActivity') };
}

test('operation records match begin/end by ID, timestamps and source; release is idempotent', () => {
  const h = harness(true);
  const end = h.activity.beginAccountOperation({ name: 'upload-post', source: 'cloudPosts.post-composer' });
  end.setPhase('photo-upload');
  const active = h.activity.getAccountActivityDiagnostics();
  assert.equal(active.operationCount, 1); assert.equal(active.trackedOperationCount, 1);
  const item = active.activeOperations[0];
  assert.equal(item.name, 'upload-post'); assert.equal(item.source, 'cloudPosts.post-composer');
  assert.equal(item.phase, 'photo-upload'); assert.equal(item.endCalled, false);
  assert.ok(Number.isFinite(Date.parse(item.startedAt)));
  assert.ok(Number.isFinite(Date.parse(item.phaseStartedAt)));
  item.phase = 'mutated'; // snapshots cannot change live state
  end(); end(); end.setPhase('too-late');
  const done = h.activity.getAccountActivityDiagnostics();
  assert.equal(done.operationCount, 0); assert.equal(done.activeOperations.length, 0);
  assert.equal(done.recentEndedOperations.length, 1);
  assert.equal(done.recentEndedOperations[0].id, item.id);
  assert.equal(done.recentEndedOperations[0].endCalled, true);
  assert.equal(done.recentEndedOperations[0].phase, 'photo-upload');
  assert.ok(done.recentEndedOperations[0].endedAt);
  assert.deepEqual(h.logs.map(item => item.event), ['begin', 'phase', 'end']);
});

test('release from finally after exception or early return leaves no operation', async () => {
  const h = harness();
  async function run(fail) {
    const end = h.activity.beginAccountOperation({ name: 'prepare-post', source: 'test.finally' });
    try { if (fail) throw Error('failed'); return 'early'; } finally { end(); }
  }
  await assert.rejects(run(true), /failed/);
  assert.equal(await run(false), 'early');
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  assert.equal(h.activity.getAccountActivityDiagnostics().recentEndedOperations.length, 2);
  h.activity.beginSignOut()();
});

test('rejection always logs every concurrent active lock in release mode without changing the guard', () => {
  const h = harness(false);
  const upload = h.activity.beginAccountOperation({ name: 'upload-post', source: 'cloudPosts.post-composer' });
  const deletion = h.activity.beginAccountOperation({ name: 'delete-post', source: 'postDeletion.deleteOwnPost' });
  upload.setPhase('photo-upload'); deletion.setPhase('delete-post-function');
  assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  const log = h.logs[0];
  assert.equal(log.diagnosticVersion, 'account-activity-v1'); assert.equal(log.event, 'signout-blocked');
  assert.equal(log.operationCount, 2); assert.equal(log.trackedOperationCount, 2);
  assert.deepEqual(log.activeOperations.map(item => item.name), ['upload-post', 'delete-post']);
  assert.ok(log.activeOperations.every(item => !item.endCalled && item.startedAt && item.elapsedMs >= 0));
  upload(); assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  assert.equal(h.logs.at(-1).operationCount, 1);
  assert.equal(h.logs.at(-1).recentEndedOperations[0].endCalled, true);
  deletion(); h.activity.beginSignOut()();
});

test('exclusive account deletion is visible even with zero operations; stale release cannot unlock a later logout', () => {
  const h = harness();
  const deletion = h.activity.beginSignOut({ name: 'delete-account', source: 'accountDeletion.requestAccountDeletion' });
  deletion.setPhase('auth-get-user');
  assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  assert.equal(h.logs[0].operationCount, 0); assert.equal(h.logs[0].signingOut, true);
  assert.equal(h.logs[0].exclusiveOperation.name, 'delete-account');
  assert.equal(h.logs[0].exclusiveOperation.phase, 'auth-get-user');
  deletion(); const logout = h.activity.beginSignOut(); deletion();
  assert.equal(h.activity.getAccountActivityDiagnostics().signingOut, true);
  logout();
});

test('completion sync with no work or failed RPC releases its real lock and records final phase', async () => {
  const h = harness(); const api = h.load('notifications');
  await api.syncWorkoutCompletions('owner', 'app-start');
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  h.state.history = [{ id: 'workout', finishedAt: '2099-01-01', durationSeconds: 60 }];
  const run = api.syncWorkoutCompletions('owner', 'app-resume');
  assert.equal(api.syncWorkoutCompletions('owner', 'foreground-interval'), run);
  await h.state.rpcStarted.promise;
  assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  assert.equal(h.logs.at(-1).activeOperations[0].source, 'notifications.app-resume');
  assert.equal(h.logs.at(-1).activeOperations[0].phase, 'record-workout-completion-rpc');
  h.state.rpc.reject(Error('offline')); await assert.rejects(run, /offline/);
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  h.activity.beginSignOut()();
});

test('Push token wait holds no lock; subsequent RPC wait is identifiable and releases on early owner mismatch', async () => {
  const h = harness();
  const run = h.load('registerPush').registerPush('owner', false, 'app-start');
  await h.state.tokenStarted.promise;
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  h.state.token.resolve({ data: 'secret-push-token' }); await h.state.rpcStarted.promise;
  assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  const item = h.logs.at(-1).activeOperations[0];
  assert.equal(item.name, 'push-register'); assert.equal(item.source, 'registerPush.app-start');
  assert.equal(item.phase, 'register-push-device-rpc');
  assert.equal(JSON.stringify(h.logs).includes('secret-push-token'), false);
  h.state.rpc.resolve({ error: null }); await run;
  h.state.owner = 'other';
  await assert.rejects(h.load('registerPush').registerPush('owner', false), /Account changed/);
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
});

test('actual startup/resume/interval/token callbacks identify locks; unmount does not release unfinished work', async () => {
  const h = harness(); h.state.readWorkouts = deferred();
  h.load('notification-gate').NotificationGate({ owner: 'owner' });
  const cleanup = h.state.effect();
  await h.state.readStarted.promise;
  assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  assert.equal(h.logs.at(-1).activeOperations[0].source, 'notifications.app-start');
  assert.equal(h.logs.at(-1).activeOperations[0].phase, 'read-workouts');
  cleanup(); assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 1);
  h.state.readWorkouts.resolve([]); await new Promise(setImmediate);
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  // Finish pending native preparations as well; these never held mutation locks.
  h.state.token.resolve({ data: 'token' }); h.state.rpc.resolve({ error: null });
  await new Promise(setImmediate);
  const cleanupRemounted = h.state.effect(); await new Promise(setImmediate);
  for (const [callback, source] of [[() => h.state.resume('active'), 'notifications.app-resume'],
    [() => h.state.interval(), 'notifications.foreground-interval']]) {
    h.state.readWorkouts = deferred(); callback(); await new Promise(setImmediate);
    assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
    assert.ok(h.logs.at(-1).activeOperations.some(item => item.source === source));
    h.state.readWorkouts.resolve([]); await new Promise(setImmediate);
  }
  h.state.rpc = deferred(); h.state.tokenChanged({ type: 'ios', data: 'changed-native-token' }); await new Promise(setImmediate);
  assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  assert.equal(h.logs.at(-1).activeOperations[0].source, 'registerPush.push-token-change');
  h.state.rpc.resolve({ error: null }); await new Promise(setImmediate);
  cleanupRemounted();
  h.activity.beginSignOut()();
});

test('ended diagnostic history is bounded and diagnostic logging failure cannot strand locks', () => {
  const h = harness(true);
  for (let i = 0; i < 50; i++) h.activity.beginAccountOperation()();
  assert.equal(h.activity.getAccountActivityDiagnostics().recentEndedOperations.length, 40);
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  h.state.logThrows = true;
  const release = h.activity.beginAccountOperation();
  release.setPhase('waiting');
  assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  release();
  h.activity.beginSignOut()();
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
});
