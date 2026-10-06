const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
test('profile name comes from the selected user and falls back to username', async () => {
  const calls = [];
  const query = { select: () => query, eq: (column, id) => { calls.push([column, id]); return query; }, single: async () => ({ data: { username: 'account-b', display_name: null }, error: null }) };
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/profiles.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(() => ({ supabase: { from: () => query } }), m, m.exports);
  assert.equal(m.exports.profileName(await m.exports.getProfile('user-b')), 'account-b');
  assert.deepEqual(calls, [['id', 'user-b']]);
  assert.equal(m.exports.profileName({ display_name: '  Alice  ', username: 'a' }), 'Alice');
  assert.equal(m.exports.profileName({ display_name: ' ', username: 'a' }), 'a');
});
