const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const text = tree => tree == null || typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
function render(workout, history) {
  let index = 0; const state = [workout, history, false];
  const mocks = {
    react: { useState: () => [state[index++], () => {}], useEffect: () => {} },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { ...Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'SafeAreaView'].map(name => [name, name])), StyleSheet: { create: value => value } },
    'expo-router': { useRouter: () => ({}), useLocalSearchParams: () => ({ id: workout.id }) },
    '../hooks/use-account-owner': { useAccountOwner: () => 'owner' },
    '../components/copy-workout-button': { CopyWorkoutButton: () => null },
    '../components/cardio-summary-card': { CardioSummaryCard: () => null },
    '../lib/workoutStorage': {},
  };
  function load(file) {
    const m = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', code)(spec => mocks[spec] ?? load(path.resolve(path.dirname(file), spec + '.ts')), m, m.exports);
    return m.exports;
  }
  return text(load('src/app/history-detail.tsx').default());
}
const e = (weight, reps, extra = {}) => ({ id: 1, name: 'BENCH PRESS', focus: 'VOLUME', note: '', sets: [{ id: 11, weight: String(weight), reps: String(reps), completed: true }], ...extra });
const w = (exercise, extra = {}) => ({ id: 'w', startedAt: '2026-10-14T00:00:00Z', finishedAt: '2026-10-14T01:00:00Z', durationSeconds: 60, exercises: [exercise], ...extra });
test('old history retains three first-entry PR badges while new first records show independent state', () => {
  const old = w(e(80, 8)), before = JSON.stringify(old);
  assert.match(render(old, [old]), /WEIGHT PR/); assert.match(render(old, [old]), /REP PR/); assert.match(render(old, [old]), /VOLUME PR/);
  assert.equal(JSON.stringify(old), before);
  const newer = w(e(80, 8), { prVersion: 2 });
  const output = render(newer, [newer]); assert.match(output, /FIRST RECORD/); assert.doesNotMatch(output, /WEIGHT PR|REP PR|VOLUME PR/);
});
test('assisted history labels assistance and excluded volume; a lower assistance at one rep is WEIGHT PR', () => {
  const old = w(e(40, 8, { name: 'PULL UP', loadType: 'assisted' }), { id: 'old', finishedAt: '2026-10-13T01:00:00Z' });
  const current = w(e(30, 1, { name: 'PULL UP', loadType: 'assisted' }), { prVersion: 2 });
  const output = render(current, [old, current]);
  assert.match(output, /PULL UP \(ASSISTED\)/); assert.match(output, /30kg assistance × 1/); assert.match(output, /WEIGHT PR/);
  assert.match(output, /EXCLUDED/); assert.doesNotMatch(output, /REP PR|VOLUME PR/);
});
test('unclassified legacy PULL UP does not become a classified bodyweight baseline', () => {
  const old = w(e(0, 12, { name: 'PULL UP' }), { id: 'old', finishedAt: '2026-10-13T01:00:00Z' });
  const current = w(e(0, 8, { name: 'PULL UP', loadType: 'bodyweight' }), { prVersion: 2 });
  const output = render(current, [old, current]);
  assert.match(output, /PULL UP \(BODYWEIGHT\)/); assert.match(output, /8 reps/); assert.match(output, /FIRST RECORD/);
  assert.doesNotMatch(output, /WEIGHT PR|REP PR|VOLUME PR/); assert.equal(old.exercises[0].loadType, undefined);
});
