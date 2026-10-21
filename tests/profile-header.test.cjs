const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in mocks)) throw Error(`Unexpected import: ${name}`);
    return mocks[name];
  }, mod, mod.exports);
  return mod.exports;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
test('PROFILE renders account username between unchanged name and mantra, with long-name truncation', () => {
  let profile = { name: 'KAZUMA', username: 'kazuma_training', error: '' };
  const { default: Screen } = load('src/app/profile.tsx', {
    react: { ...React, useCallback: f => f, useMemo: f => f(), useState: initial => [initial, () => {}] },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { ...Object.fromEntries(['Pressable', 'SafeAreaView', 'ScrollView', 'Text', 'View'].map(n => [n, n])), StyleSheet: { create: v => v } },
    'expo-router': { useFocusEffect: () => {}, useRouter: () => ({}) },
    '../hooks/use-profile': { useProfile: owner => { assert.equal(owner, 'account-a'); return profile; } },
    '../hooks/use-account-owner': { useAccountOwner: () => 'account-a' },
    '../components/my-connections': { MyConnections: 'MyConnections' },
    '../components/logout-control': { LogoutControl: 'LogoutControl' },
    '../components/account-deletion-control': { AccountDeletionControl: 'AccountDeletionControl' },
    '../lib/pr': {}, '../lib/cardio': {}, '../lib/workoutStorage': {},
  });
  for (const username of ['kazuma_training', 'a'.repeat(128)]) {
    profile = { ...profile, username };
    const header = nodes(Screen()).find(n => n.type === 'View');
    const lines = nodes(header).filter(n => n.type === 'Text');
    assert.deepEqual(lines.map(text), ['ATHLETE', 'KAZUMA', `@${username}`, 'NO FLEX. JUST WORK.']);
    assert.equal(lines[1].props.style.fontSize, 42);
    assert.equal(lines[1].props.style.fontWeight, '900');
    assert.equal(lines[2].props.style.fontSize, 13);
    assert.equal(lines[2].props.style.color, '#999999');
    assert.equal(lines[2].props.style.textAlign, 'left');
    assert.equal(lines[2].props.numberOfLines, 1);
    assert.equal(lines[2].props.ellipsizeMode, 'tail');
  }
  profile = { ...profile, username: '' };
  assert.ok(!text(Screen()).includes('@'));
});
test('profile hook exposes fetched username and hides prior account values during switch or failure', async () => {
  const slots = []; let index = 0, callback, cleanup;
  let response = { username: 'account_a', display_name: 'A' };
  const { useProfile } = load('src/hooks/use-profile.ts', {
    react: {
      useState: initial => { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
      useCallback: fn => fn,
    },
    'expo-router': { useFocusEffect: fn => { callback = fn; } },
    '../lib/profiles': { getProfile: async () => { if (response instanceof Error) throw response; return response; }, profileName: p => p.display_name || p.username },
  });
  const render = owner => { index = 0; return useProfile(owner); };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  assert.equal(render('a').username, ''); cleanup = callback(); await flush();
  assert.equal(render('a').username, 'account_a');
  cleanup(); response = { username: 'account_b', display_name: 'B' };
  assert.equal(render('b').username, ''); cleanup = callback(); await flush();
  assert.equal(render('b').username, 'account_b');
  cleanup(); response = Error('offline'); render('b').reload();
  assert.equal(render('b').username, ''); cleanup = callback(); await flush();
  assert.equal(render('b').username, ''); assert.match(render('b').error, /Could not load/); cleanup();
});
