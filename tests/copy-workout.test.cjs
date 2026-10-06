const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const workout = { id: 'workout-1', startedAt: '2026-10-03T01:00:00Z', finishedAt: '2026-10-03T02:00:00Z', durationSeconds: 3600,
  exercises: [{ id: 1, name: 'Running', type: 'cardio', sets: [], note: 'Easy pace',
    cardio: { durationMinutes: '20', distanceKm: '3.2', caloriesKcal: '' } }] };

function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function text(tree) { return tree == null || typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree.props?.children) : String(tree); }

function harness(write = async () => true) {
  const slots = [], timers = new Map(), calls = []; let index = 0, cleanup, didMount = false, timerId = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = index++; return slots[i] ?? (slots[i] = { current: initial }); },
    useEffect(fn) { if (!didMount) { didMount = true; cleanup = fn(); } },
  };
  const mocks = {
    react, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: value => value } },
    'expo-clipboard': { StringFormat: { PLAIN_TEXT: 'plainText' }, setStringAsync: async (...args) => { calls.push(args); return write(...args); } },
  };
  function load(file) {
    const mod = { exports: {} }; const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', code)(
      spec => mocks[spec] ?? load(path.resolve(path.dirname(file), spec + '.ts')), mod, mod.exports,
      (fn, delay) => { assert.equal(delay, 2500); timers.set(++timerId, fn); return timerId; }, id => timers.delete(id));
    return mod.exports;
  }
  const { CopyWorkoutButton } = load('src/components/copy-workout-button.tsx');
  return { calls, timers, unmount: () => cleanup(), render(value = workout) { index = 0; return CopyWorkoutButton({ workout: value }); } };
}

test('COPY WORKOUT writes exact plain text and shows brief success only after the write', async () => {
  let resolve; const h = harness(() => new Promise(done => { resolve = done; }));
  const tree = h.render(), button = nodes(tree).find(node => node.type === 'Pressable');
  const pending = button.props.onPress();
  assert.equal(nodes(h.render()).find(node => node.type === 'Pressable').props.disabled, true);
  assert.equal(text(h.render()).includes('Copied to clipboard.'), false);
  await button.props.onPress(); assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0], ['Running\nDuration: 20 min\nDistance: 3.2 km\nMemo: Easy pace', { inputFormat: 'plainText' }]);
  resolve(true); await pending;
  assert.match(text(h.render()), /Copied to clipboard\./);
  h.timers.values().next().value();
  assert.equal(text(h.render()).includes('Copied to clipboard.'), false);
  h.unmount();
});

test('rejected and false Clipboard writes report failure, allow retry and never report success', async () => {
  for (const write of [async () => false, async () => { throw new Error('Permission denied'); }]) {
    const h = harness(write);
    await nodes(h.render()).find(node => node.type === 'Pressable').props.onPress();
    assert.match(text(h.render()), /Could not copy\. Please try again\./);
    assert.equal(nodes(h.render()).find(node => node.type === 'Pressable').props.disabled, false);
    assert.equal(h.timers.size, 0);
    await nodes(h.render()).find(node => node.type === 'Pressable').props.onPress(); assert.equal(h.calls.length, 2);
    h.unmount();
  }
});

test('empty workouts do not overwrite the clipboard; unmount clears feedback timers', async () => {
  const h = harness();
  await nodes(h.render({ ...workout, exercises: [] })).find(node => node.type === 'Pressable').props.onPress();
  assert.equal(h.calls.length, 0); assert.match(text(h.render()), /No recorded exercises/);
  await nodes(h.render()).find(node => node.type === 'Pressable').props.onPress();
  assert.equal(h.timers.size, 1); h.unmount(); assert.equal(h.timers.size, 0);
});

test('a Clipboard write finishing after navigation does not show feedback or create a timer', async () => {
  let resolve; const h = harness(() => new Promise(done => { resolve = done; }));
  const pending = nodes(h.render()).find(node => node.type === 'Pressable').props.onPress();
  h.unmount(); resolve(true); await pending; assert.equal(h.timers.size, 0);
});

test('history detail offers COPY for the loaded workout and hides it while loading or missing', () => {
  function CopyMarker() {}
  for (const [loaded, loading] of [[workout, false], [workout, true], [null, false]]) {
    let index = 0; const state = [loaded, loaded ? [loaded] : [], loading];
    const mocks = {
      react: { useState: () => [state[index++], () => {}], useEffect: () => {} },
      'react/jsx-runtime': require('react/jsx-runtime'),
      'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', SafeAreaView: 'SafeAreaView', StyleSheet: { create: value => value } },
      'expo-router': { useRouter: () => ({}), useLocalSearchParams: () => ({ id: workout.id }) },
      '../hooks/use-account-owner': { useAccountOwner: () => 'owner' },
      '../components/copy-workout-button': { CopyWorkoutButton: CopyMarker },
      '../components/cardio-summary-card': { CardioSummaryCard: () => null },
      '../lib/workoutStorage': {},
    };
    function load(file) {
      const mod = { exports: {} };
      const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText;
      new Function('require', 'module', 'exports', code)(spec => mocks[spec] ??
        load(path.resolve(path.dirname(file), spec + '.ts')), mod, mod.exports);
      return mod.exports;
    }
    const tree = load('src/app/history-detail.tsx').default();
    const copy = nodes(tree).find(node => node.type === CopyMarker);
    if (loaded && !loading) { assert.ok(copy); assert.equal(copy.props.workout, workout); assert.equal(copy.key, workout.id); }
    else assert.equal(copy, undefined);
  }
});
