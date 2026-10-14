const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function text(tree) { return tree == null || typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree.props?.children) : String(tree); }
function harness(flag = 'true') {
  const slots = [], logs = [];
  let index = 0, failure, wait, calls = 0;
  const evaluate = (file, mocks) => {
    const mod = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    new Function('require', 'module', 'exports', 'process', 'console', code)(spec => {
      assert.ok(spec in mocks, `Unexpected dependency: ${spec}`); return mocks[spec];
    }, mod, mod.exports, { env: { EXPO_PUBLIC_ACCOUNT_ACTIVITY_DIAGNOSTICS: flag } }, { warn: (...args) => logs.push(JSON.parse(args[1])) });
    return mod.exports;
  };
  const activity = evaluate('src/lib/accountActivity.ts', {});
  const { LogoutControl } = evaluate('src/components/logout-control.tsx', {
    react: { useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; } },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable' },
    '../lib/accountSession': { logoutAccount: async () => {
      calls++;
      const release = activity.beginSignOut({ name: 'logout', source: 'accountSession.logoutAccount' });
      try { if (wait) await wait; if (failure) throw failure; } finally { release(); }
    } },
  });
  return { activity, logs, render() { index = 0; return LogoutControl(); },
    fail(error) { failure = error; }, waitFor(promise) { wait = promise; }, get calls() { return calls; } };
}
function button(tree, label) { return nodes(tree).find(node => node.type === 'Pressable' && text(node) === label); }
function noDiagnostics(tree) {
  const output = text(tree);
  for (const label of ['ACCOUNT ACTIVITY DIAGNOSTICS', 'signout-blocked', 'COPY DIAGNOSTICS', 'Diagnostics copied.']) assert.equal(output.includes(label), false, label);
  assert.ok(nodes(tree).every(node => typeof node.type === 'string' || node.type === require('react').Fragment), 'Only native controls and React fragments remain mounted');
}
function confirm(h) { button(h.render(), 'LOGOUT').props.onPress(); return button(h.render(), 'CONFIRM LOGOUT'); }

test('Profile never renders diagnostics, even with the verbose flag enabled and logout blocked', async () => {
  for (const flag of ['true', 'false', undefined]) {
    const h = harness(flag); noDiagnostics(h.render());
    const release = h.activity.beginAccountOperation({ name: 'upload-post', source: 'cloudPosts.post-composer' });
    await confirm(h).props.onPress(); noDiagnostics(h.render());
    assert.match(text(h.render()), /Wait for the current upload or deletion/);
    assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 1);
    assert.equal(h.logs.at(-1).event, 'signout-blocked');
    release(); await button(h.render(), 'CONFIRM LOGOUT').props.onPress();
    assert.equal(h.activity.getAccountActivityDiagnostics().signingOut, false);
    assert.equal(text(h.render()).includes('Wait for the current upload'), false);
  }
});

test('confirmation and cancellation preserve the local-data retention message without signing out', () => {
  const h = harness(); confirm(h);
  assert.match(text(h.render()), /workouts, templates and unsent posts stay here/);
  button(h.render(), 'CANCEL').props.onPress();
  assert.ok(button(h.render(), 'LOGOUT')); assert.equal(h.calls, 0); noDiagnostics(h.render());
});

test('pending logout disables controls and releases its exclusive lock on success', async () => {
  let resolve; const h = harness(); h.waitFor(new Promise(done => { resolve = done; }));
  const pending = confirm(h).props.onPress();
  assert.equal(h.activity.getAccountActivityDiagnostics().signingOut, true);
  assert.equal(button(h.render(), 'SIGNING OUT…').props.disabled, true);
  assert.equal(button(h.render(), 'CANCEL').props.disabled, true);
  resolve(); await pending;
  assert.equal(h.activity.getAccountActivityDiagnostics().signingOut, false);
  assert.equal(button(h.render(), 'CONFIRM LOGOUT').props.disabled, false); noDiagnostics(h.render());
});

test('logout failure keeps its existing error and re-enables retry without diagnostics', async () => {
  for (const failure of [Error('network failure'), 'unknown failure']) {
    const h = harness(); h.fail(failure); await confirm(h).props.onPress();
    assert.ok(text(h.render()).includes(failure instanceof Error ? failure.message : 'Could not sign out. Please retry.'));
    assert.equal(button(h.render(), 'CONFIRM LOGOUT').props.disabled, false);
    assert.equal(h.activity.getAccountActivityDiagnostics().signingOut, false); noDiagnostics(h.render());
    h.fail(null); await button(h.render(), 'CONFIRM LOGOUT').props.onPress();
    assert.equal(nodes(h.render()).some(node => node.props?.accessibilityRole === 'alert'), false);
  }
});

test('internal blocked snapshot stays bound to its error and cannot mutate lock state', () => {
  const h = harness(); const release = h.activity.beginAccountOperation();
  let error; try { h.activity.beginSignOut(); } catch (e) { error = e; }
  const snapshot = h.activity.getSignOutBlockedDiagnostics(error); snapshot.activeOperations[0].phase = 'modified';
  assert.equal(h.activity.getSignOutBlockedDiagnostics(error).activeOperations[0].phase, 'started');
  assert.equal(h.activity.getSignOutBlockedDiagnostics(new Error(error.message)), null);
  release(); assert.equal(h.activity.getSignOutBlockedDiagnostics(error).operationCount, 1);
  assert.equal(h.activity.getAccountActivityDiagnostics().operationCount, 0);
});

test('internal snapshot identifies the exclusive holder without exposing user fields', () => {
  const h = harness(); const release = h.activity.beginSignOut({ name: 'delete-account', source: 'accountDeletion.requestAccountDeletion' });
  release.setPhase('auth-get-user');
  let error; try { h.activity.beginSignOut(); } catch (e) { error = e; }
  const snapshot = h.activity.getSignOutBlockedDiagnostics(error);
  assert.equal(snapshot.operationCount, 0); assert.equal(snapshot.exclusiveOperation.name, 'delete-account');
  assert.equal(snapshot.exclusiveOperation.phase, 'auth-get-user');
  for (const forbidden of ['token', 'email', 'userId', 'password', 'receipt', 'photoUri']) assert.equal(JSON.stringify(snapshot).includes(`"${forbidden}"`), false);
  release();
});
