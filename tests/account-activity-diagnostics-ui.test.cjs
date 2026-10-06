const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function text(tree) { return tree == null || typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree.props?.children) : String(tree); }
function harness(flag = 'true', write = async () => true) {
  const env = { EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS: flag }, calls = [], contexts = new Map(), cache = new Map();
  let current, index = 0, authFailure;
  const react = {
    useState(initial) { const i = index++; if (!(i in current.slots)) current.slots[i] = initial; const owner = current; return [owner.slots[i], value => { owner.slots[i] = typeof value === 'function' ? value(owner.slots[i]) : value; }]; },
    useRef(initial) { const i = index++; return current.slots[i] ?? (current.slots[i] = { current: initial }); },
    useEffect(effect) { if (!current.mounted) current.effects.push(effect); },
  };
  const mocks = { react, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: value => value } },
    'expo-clipboard': { StringFormat: { PLAIN_TEXT: 'plainText' }, setStringAsync: async (...args) => { calls.push(args); return write(...args); } },
  };
  function load(file) {
    const absolute = path.resolve(file); if (cache.has(absolute)) return cache.get(absolute);
    const mod = { exports: {} }; cache.set(absolute, mod.exports);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    new Function('require', 'module', 'exports', 'process', 'console', code)(spec => {
      if (spec.endsWith('/accountSession')) return { logoutAccount: async () => {
        const release = activity.beginSignOut({ name: 'logout', source: 'accountSession.logoutAccount' });
        try { if (authFailure) throw authFailure; } finally { release(); }
      } };
      if (mocks[spec]) return mocks[spec];
      const base = path.resolve(path.dirname(absolute), spec);
      return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx');
    }, mod, mod.exports, { env }, { warn() {} });
    return mod.exports;
  }
  const activity = load('src/lib/accountActivity.ts');
  const { LogoutControl } = load('src/components/logout-control.tsx');
  const { AccountActivityDiagnostics } = load('src/components/account-activity-diagnostics.tsx');
  function render(fn, props = {}) {
    current = contexts.get(fn) ?? { slots: [], effects: [], mounted: false, cleanups: [] }; contexts.set(fn, current); index = 0;
    const result = fn(props);
    if (!current.mounted) { current.cleanups = current.effects.map(effect => effect()); current.mounted = true; }
    return result;
  }
  return { calls, activity, Panel: AccountActivityDiagnostics,
    logout: () => render(LogoutControl), panel: diagnostics => render(AccountActivityDiagnostics, { diagnostics }),
    unmountPanel: () => contexts.get(AccountActivityDiagnostics)?.cleanups.forEach(cleanup => cleanup?.()),
    failAuth: error => { authFailure = error; } };
}
function button(tree, label) { return nodes(tree).find(node => node.type === 'Pressable' && text(node) === label); }
async function blockedAttempt(h) {
  button(h.logout(), 'LOGOUT').props.onPress();
  await button(h.logout(), 'CONFIRM LOGOUT').props.onPress();
  return nodes(h.logout()).find(node => node.type === h.Panel)?.props.diagnostics;
}

test('Profile logout renders the rejection snapshot with all requested fields and copies exact plain JSON', async () => {
  const h = harness();
  const release = h.activity.beginAccountOperation({ name: 'workout-completion-sync', source: 'notifications.app-start' });
  release.setPhase('record-workout-completion-rpc');
  const snapshot = await blockedAttempt(h);
  assert.equal(snapshot.event, 'signout-blocked'); assert.equal(snapshot.operationCount, 1);
  const output = text(h.panel(snapshot)), operation = snapshot.activeOperations[0];
  for (const value of ['ACCOUNT ACTIVITY DIAGNOSTICS', 'Active operations: 1', 'signingOut: false',
    operation.name, `ID ${operation.id}`, operation.startedAt, `${operation.elapsedMs} ms`, operation.source, operation.phase]) assert.ok(output.includes(value), value);
  release(); // Live operation has already ended, but the rejected attempt stays fixed.
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
  await button(h.panel(snapshot), 'COPY DIAGNOSTICS').props.onPress();
  assert.deepEqual(JSON.parse(h.calls[0][0]), snapshot);
  assert.deepEqual(h.calls[0][1], { inputFormat: 'plainText' });
  assert.match(text(h.panel(snapshot)), /Diagnostics copied/);
  const copied = h.calls[0][0];
  for (const forbidden of ['token', 'email', 'userId', 'password', 'receipt', 'photoUri']) assert.equal(copied.includes(`"${forbidden}"`), false);
});

test('debug UI and snapshot access are absent unless the build flag is exactly true', async () => {
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    const h = harness(flag === undefined ? '' : flag);
    const release = h.activity.beginAccountOperation({ name: 'upload-post', source: 'cloudPosts.post-composer' });
    assert.equal(await blockedAttempt(h), undefined);
    assert.equal(h.panel(null), null); assert.equal(h.calls.length, 0);
    let error; try { h.activity.beginSignOut(); } catch (e) { error = e; }
    assert.equal(h.activity.getSignOutBlockedDiagnostics(error), null);
    assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 1);
    release();
  }
});

test('snapshot is bound to one blocked error, is immutable to callers and never reused for auth failures', async () => {
  const h = harness(); const release = h.activity.beginAccountOperation();
  let error; try { h.activity.beginSignOut(); } catch (e) { error = e; }
  const first = h.activity.getSignOutBlockedDiagnostics(error);
  first.activeOperations[0].phase = 'modified';
  assert.equal(h.activity.getSignOutBlockedDiagnostics(error).activeOperations[0].phase, 'started');
  assert.equal(h.activity.getSignOutBlockedDiagnostics(new Error(error.message)), null);
  const snapshot = await blockedAttempt(h); assert.ok(snapshot);
  release(); h.failAuth(Error('network failure'));
  await button(h.logout(), 'CONFIRM LOGOUT').props.onPress();
  const diagnostics = nodes(h.logout()).find(node => node.type === h.Panel).props.diagnostics;
  assert.equal(diagnostics, null); assert.match(text(h.panel(diagnostics)), /Run CONFIRM LOGOUT/);
  assert.equal(button(h.panel(diagnostics), 'COPY DIAGNOSTICS'), undefined);
});

test('signingOut exclusive holder is visible with zero active operations', async () => {
  const h = harness();
  const release = h.activity.beginSignOut({ name: 'delete-account', source: 'accountDeletion.requestAccountDeletion' });
  release.setPhase('auth-get-user');
  const snapshot = await blockedAttempt(h), output = text(h.panel(snapshot));
  assert.equal(snapshot.operationCount, 0);
  for (const value of ['signingOut: true', 'Holder: delete-account', 'accountDeletion.requestAccountDeletion', 'auth-get-user']) assert.ok(output.includes(value));
  await button(h.panel(snapshot), 'COPY DIAGNOSTICS').props.onPress();
  assert.equal(JSON.parse(h.calls[0][0]).exclusiveOperation.id, snapshot.exclusiveOperation.id);
  assert.equal(h.activity.getAccountActivityDiagnostics().signingOut, true);
  release();
});

test('clipboard false/rejection shows a fixed error without exception details and permits retry', async () => {
  for (const write of [async () => false, async () => { throw Error('secret token email userId'); }]) {
    const h = harness('true', write); const release = h.activity.beginAccountOperation();
    const snapshot = await blockedAttempt(h);
    await button(h.panel(snapshot), 'COPY DIAGNOSTICS').props.onPress();
    const output = text(h.panel(snapshot));
    assert.match(output, /Could not copy/); assert.equal(output.includes('secret'), false);
    assert.equal(button(h.panel(snapshot), 'COPY DIAGNOSTICS').props.disabled, false);
    await button(h.panel(snapshot), 'COPY DIAGNOSTICS').props.onPress(); assert.equal(h.calls.length, 2);
    release();
  }
});

test('copy waits for clipboard completion, prevents duplicate writes and ignores completion after unmount', async () => {
  let resolve; const h = harness('true', () => new Promise(done => { resolve = done; }));
  const release = h.activity.beginAccountOperation(); const snapshot = await blockedAttempt(h);
  const copy = button(h.panel(snapshot), 'COPY DIAGNOSTICS'); const pending = copy.props.onPress();
  await copy.props.onPress(); assert.equal(h.calls.length, 1);
  assert.equal(nodes(h.panel(snapshot)).find(node => node.props?.accessibilityLabel === 'COPY DIAGNOSTICS').props.disabled, true);
  assert.equal(text(h.panel(snapshot)).includes('Diagnostics copied.'), false);
  h.unmountPanel(); resolve(true); await pending;
  assert.equal(text(h.panel(snapshot)).includes('Diagnostics copied.'), false);
  release();
});
