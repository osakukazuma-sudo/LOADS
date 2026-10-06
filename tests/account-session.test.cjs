const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function harness() {
  const calls = [];
  let failure;
  let storageFailure;
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const m = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync('src/lib/' + name + '.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(spec => {
      if (spec === './supabase') return { supabase: { auth: { signOut: async opts => { calls.push(opts); return { error: failure }; } } } };
      if (spec === './userLocalData') return { flushLocalWrites: async () => { calls.push('flush'); if (storageFailure) throw storageFailure; } };
      if (spec === './pushDevice') return { unregisterPushDevice: async () => { calls.push('disconnect-push'); } };
      return load(spec.slice(2));
    }, m, m.exports);
    return cache[name] = m.exports;
  }
  return { calls, activity: load('accountActivity'), session: load('accountSession'), fail: () => { failure = Error('network'); }, failStorage: () => { storageFailure = Error('disk'); } };
}
test('logout flushes disk first, affects only local auth and never deletes account data', async () => {
  const h = harness();
  await h.session.logoutAccount();
  assert.deepEqual(h.calls, ['flush', 'disconnect-push', { scope: 'local' }]);
});
test('upload/deletion blocks logout and failed signout releases the operation lock', async () => {
  const h = harness(); const release = h.activity.beginAccountOperation();
  await assert.rejects(h.session.logoutAccount(), /upload or deletion/);
  assert.deepEqual(h.calls, []); release();
  h.fail(); await assert.rejects(h.session.logoutAccount(), /network/);
  h.activity.beginAccountOperation()();
});
test('failed local save prevents signout', async () => {
  const h = harness(); h.failStorage();
  await assert.rejects(h.session.logoutAccount(), /disk/);
  assert.deepEqual(h.calls, ['flush']);
});
