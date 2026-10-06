const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const settle = () => new Promise(setImmediate);
const token = data => ({ type: 'ios', data });
function harness() {
  const cache = {}, listeners = new Set(), appStates = new Set(), timers = new Set(), responses = new Set();
  const state = { owner: 'A', native: token('native-1'), expoCalls: [], nativeRequests: 0, rpcCalls: [],
    rpcGate: null, expoGate: null, failure: null, rpcStarted: deferred(), listenersAdded: 0,
    listenersRemoved: 0, effect: null, deps: null, cleanup: null, notificationsHandler: null, navigated: [] };
  const emit = value => { for (const listener of [...listeners]) listener(value); };
  const mocks = {
    'react': { useEffect: (effect, deps) => { if (!state.deps || deps.some((value, i) => value !== state.deps[i])) { state.cleanup?.(); state.deps = deps; state.cleanup = effect(); } } },
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener: (_event, callback) => { appStates.add(callback); return { remove: () => appStates.delete(callback) }; } } },
    'expo-router': { router: { push: route => state.navigated.push(route) } },
    'expo-device': { isDevice: true }, 'expo-crypto': { randomUUID: () => 'installation' },
    'expo-constants': { expoConfig: { extra: { eas: { projectId: 'project' } } } },
    '@react-native-async-storage/async-storage': { getItem: async () => 'installation' },
    './cloudPosts': { currentUserId: async () => { if (!state.owner) throw Error('Sign in'); return state.owner; } },
    '../lib/notifications': { initializeCompletionSync: async () => {}, syncWorkoutCompletions: async () => {} },
    './supabase': { supabase: { rpc: async (_name, args) => {
      state.rpcCalls.push(args); state.rpcStarted.resolve();
      if (state.rpcGate) await state.rpcGate.promise;
      if (state.failure) throw state.failure;
      return { error: null };
    } } },
    'expo-notifications': {
      getPermissionsAsync: async () => ({ granted: true }), requestPermissionsAsync: async () => ({ granted: true }),
      setNotificationHandler: handler => { state.notificationsHandler = handler; },
      getLastNotificationResponse: () => null, clearLastNotificationResponseAsync: async () => {},
      addNotificationResponseReceivedListener: callback => { responses.add(callback); return { remove: () => responses.delete(callback) }; },
      addPushTokenListener: callback => { listeners.add(callback); state.listenersAdded++; return { remove: () => { listeners.delete(callback); state.listenersRemoved++; } }; },
      getExpoPushTokenAsync: async options => {
        state.expoCalls.push(options);
        if (state.expoCalls.length > 8) throw Error('recursive token acquisition');
        const native = options.devicePushToken ?? state.native;
        // Model SDK iOS: requesting a native token emits onDevicePushToken,
        // even if it is the same token. Supplying devicePushToken avoids it.
        if (!options.devicePushToken) { state.nativeRequests++; emit(native); }
        if (state.expoGate) await state.expoGate.promise;
        return { data: `ExpoPushToken[${native.data}]` };
      },
    },
  };
  function load(name) {
    if (cache[name]) return cache[name]; const m = { exports: {} }; cache[name] = m.exports;
    const file = name === 'notification-gate' ? 'src/components/notification-gate.tsx' : `src/lib/${name}.ts`;
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', 'console', code)(
      spec => mocks[spec] ?? load(spec.replace(/^\.\//, '').replace(/^\.\.\/lib\//, '')), m, m.exports,
      callback => { timers.add(callback); return callback; }, callback => timers.delete(callback), { warn() {} });
    return m.exports;
  }
  return { state, listeners, appStates, responses, timers, emit, load,
    activity: load('accountActivity'), register: load('registerPush').registerPush,
    render: (owner = state.owner) => load('notification-gate').NotificationGate({ owner }),
    unmount: () => { state.cleanup?.(); state.cleanup = null; state.deps = null; },
    resume: () => { for (const callback of [...appStates]) callback('active'); } };
}

test('listener is added once per mounted owner, ordinary renders and repeated AppState resume do not add it', async () => {
  const h = harness(); h.render(); h.render(); h.render(); await settle();
  assert.equal(h.state.listenersAdded, 1); assert.equal(h.listeners.size, 1);
  for (let i = 0; i < 10; i++) { h.resume(); await settle(); }
  assert.equal(h.state.listenersAdded, 1); assert.equal(h.listeners.size, 1);
  assert.equal(h.state.rpcCalls.length, 1); h.unmount();
});

test('cleanup removes all subscriptions; remount and StrictMode effect replay never leave duplicate listeners', async () => {
  const h = harness(); h.render(); h.unmount();
  assert.equal(h.listeners.size, 0); assert.equal(h.appStates.size, 0);
  assert.equal(h.responses.size, 0); assert.equal(h.timers.size, 0);
  h.render(); await settle(); assert.equal(h.listeners.size, 1);
  h.unmount(); h.render(); await settle(); assert.equal(h.listeners.size, 1);
  assert.equal(h.state.listenersAdded - h.state.listenersRemoved, 1);
  h.unmount(); assert.equal(h.listeners.size, 0);
});

test('iOS native token acquisition emits the listener but supplied event token breaks the self-triggering loop', async () => {
  const h = harness(); h.render(); await settle(); await settle();
  assert.equal(h.state.nativeRequests, 1);
  assert.equal(h.state.expoCalls.length, 2); // initial acquisition + supplied event, then converges
  assert.deepEqual(h.state.expoCalls[1].devicePushToken, token('native-1'));
  assert.equal(h.state.rpcCalls.length, 1);
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  h.activity.beginSignOut()(); h.unmount();
});

test('bursts of the same token share one Promise, one Expo conversion and one RPC, including repeats after completion', async () => {
  const h = harness(); h.state.rpcGate = deferred();
  const runs = Array.from({ length: 40 }, () => h.register('A', false, 'push-token-change', token('one')));
  assert.ok(runs.every(run => run === runs[0])); await h.state.rpcStarted.promise;
  assert.equal(h.state.rpcCalls.length, 1); assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 1);
  assert.equal(h.register('A', false, 'push-token-change', token('one')), runs[0]);
  assert.throws(() => h.activity.beginSignOut(), /upload or deletion/);
  h.state.rpcGate.resolve(); await Promise.all(runs);
  await h.register('A', false, 'push-token-change', token('one'));
  assert.equal(h.state.rpcCalls.length, 1); assert.equal(h.state.expoCalls.length, 1);
  h.activity.beginSignOut()();
});

test('same event during Expo preparation is single-flight before any mutation lock is acquired', async () => {
  const h = harness(); h.state.expoGate = deferred();
  const run = h.register('A', false, 'push-token-change', token('one')); await settle();
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  assert.equal(h.register('A', false, 'push-token-change', token('one')), run);
  h.state.expoGate.resolve(); await run;
  assert.equal(h.state.rpcCalls.length, 1);
});

test('different token updates are serialized and even token A/B/A correctly restores the newest token', async () => {
  const h = harness(); h.state.rpcGate = deferred();
  const first = h.register('A', false, 'push-token-change', token('one')); await h.state.rpcStarted.promise;
  const second = h.register('A', false, 'push-token-change', token('two')); await settle();
  assert.equal(h.state.rpcCalls.length, 1); assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 1);
  h.state.rpcGate.resolve(); await Promise.all([first, second]);
  await h.register('A', false, 'push-token-change', token('one'));
  assert.deepEqual(h.state.rpcCalls.map(args => args.p_token), ['ExpoPushToken[one]', 'ExpoPushToken[two]', 'ExpoPushToken[one]']);
});

test('failed registration releases its lock, is not cached and can be retried', async () => {
  const h = harness(); h.state.failure = Error('offline');
  await assert.rejects(h.register('A', false, 'push-token-change', token('one')), /offline/);
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  h.state.failure = null; await h.register('A', false, 'push-token-change', token('one'));
  assert.equal(h.state.rpcCalls.length, 2);
});

test('token A/B/A while the first RPC is pending preserves event order and converges to the last A', async () => {
  const h = harness(); h.state.rpcGate = deferred();
  const first = h.register('A', false, 'push-token-change', token('one')); await h.state.rpcStarted.promise;
  const second = h.register('A', false, 'push-token-change', token('two'));
  const third = h.register('A', false, 'push-token-change', token('one'));
  assert.notEqual(third, first);
  assert.equal(h.register('A', false, 'push-token-change', token('one')), third);
  h.state.rpcGate.resolve(); await Promise.all([first, second, third]);
  assert.deepEqual(h.state.rpcCalls.map(args => args.p_token), ['ExpoPushToken[one]', 'ExpoPushToken[two]', 'ExpoPushToken[one]']);
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
});

test('logout during preparation invalidates queued and late tokens; same account login registers again', async () => {
  const h = harness(); h.state.expoGate = deferred();
  const first = h.register('A', false, 'push-token-change', token('one')); await settle();
  const queued = h.register('A', false, 'push-token-change', token('two'));
  const firstRejected = assert.rejects(first, /Account changed/), queuedRejected = assert.rejects(queued, /Account changed/);
  h.activity.beginSignOut()(); h.state.owner = null;
  h.state.expoGate.resolve(); await Promise.all([firstRejected, queuedRejected]);
  assert.equal(h.state.rpcCalls.length, 0);
  await assert.rejects(h.register('A', false, 'push-token-change', token('one')), /Sign in/);
  h.state.owner = 'A'; await h.register('A', false, 'push-token-change', token('one'));
  assert.equal(h.state.rpcCalls.length, 1);
  h.activity.beginSignOut()(); await h.register('A', false, 'push-token-change', token('one'));
  assert.equal(h.state.rpcCalls.length, 2); // session-generation scoped cache
});

test('callbacks already queued before cleanup cannot register after logout/unmount', async () => {
  const h = harness(); h.render(); await settle();
  const callback = [...h.listeners][0], resume = [...h.appStates][0];
  h.activity.beginSignOut()(); h.unmount(); h.state.owner = null;
  const before = h.state.rpcCalls.length;
  callback(token('late')); resume('active'); await settle();
  assert.equal(h.state.rpcCalls.length, before); assert.equal(h.listeners.size, 0);
});

test('notification handling, authenticated routing and registration remain enabled', async () => {
  const h = harness(); h.render(); await settle();
  assert.deepEqual(await h.state.notificationsHandler.handleNotification(), { shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true });
  const response = [...h.responses][0];
  response({ notification: { request: { content: { data: { recipientId: 'A', kind: 'partner' } } } } });
  assert.deepEqual(h.state.navigated, ['/tagged']);
  h.emit(token('rotated')); await settle(); assert.equal(h.state.rpcCalls.at(-1).p_token, 'ExpoPushToken[rotated]');
  h.unmount();
});
