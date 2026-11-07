const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const alerts = [];
const jsx = (type, props) => ({ type, props });
const native = { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x }, Alert: { alert: (...args) => alerts.push(args) } };
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(spec => {
    if (spec === 'react-native') return native;
    if (spec === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    const base = path.resolve(path.dirname(file), spec);
    return load(base + (fs.existsSync(base + '.ts') ? '.ts' : '.tsx'));
  }, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { estimatedOneRepMax: estimate, formatEstimatedOneRepMax: format, isBig3Exercise } = load('src/lib/estimatedOneRepMax.ts');
const { EXERCISE_LIBRARY } = load('src/lib/exerciseLibrary.ts');
const { EstimatedOneRepMax: render } = load('src/components/estimated-one-rep-max.tsx');
const exercise = { id: 1, name: 'BENCH PRESS', note: '', sets: [] };
const set = { id: 2, weight: '90', reps: '5', completed: false };

test('Epley examples, boundaries and unrounded decimal input', () => {
  for (const [w, r, expected] of [['100', '1', '100kg'], ['90', '5', '105kg'], ['80', '8', '101.3kg'], ['60', '10', '80kg'], ['82.54', '5', '96.3kg'], ['82.54', '1', '82.5kg']]) {
    assert.equal(format(estimate(w, r)), expected);
  }
  assert.equal(estimate('82.54', '1'), 82.54);
  assert.equal(estimate('82.54', '5'), 82.54 * (1 + 5 / 30));
});

test('invalid, fractional reps and out of range inputs never produce a display', () => {
  for (const w of ['', ' ', '0', '-1', 'NaN', 'Infinity', '1e309', '1.2.3', '100kg', '1000000000000000']) assert.equal(estimate(w, '5'), null, w);
  for (const r of ['', ' ', '0', '-1', '1.5', '10.1', '11', '12', 'NaN', 'Infinity', '5x']) assert.equal(estimate('60', r), null, r);
});

test('exact preset identity excludes every other master entry and all custom movements', () => {
  const names = ['BENCH PRESS', 'SQUAT', 'DEADLIFT'];
  assert.deepEqual(EXERCISE_LIBRARY.filter(isBig3Exercise).map(e => e.name).sort(), names.sort());
  for (const name of names) {
    assert.equal(isBig3Exercise({ name }), true);
    assert.equal(isBig3Exercise({ name, exerciseKey: 'custom:example' }), false);
    assert.equal(isBig3Exercise({ name, type: 'cardio' }), false);
    assert.equal(isBig3Exercise({ name, loadType: 'assisted' }), false);
  }
  for (const name of ['bench press', 'BENCH PRESS EXTRA', 'INCLINE BENCH PRESS', 'SMITH MACHINE BENCH PRESS', 'FRONT SQUAT', 'ROMANIAN DEADLIFT']) assert.equal(isBig3Exercise({ name }), false);
});

test('each render follows its own input, survives DONE and leaves data and PR evaluation unchanged', () => {
  const { evaluatePR } = load('src/lib/pr.ts');
  const props = { exercise, set };
  const before = JSON.stringify(props);
  const prBefore = evaluatePR({ ...exercise, sets: [set] }, [], 2);
  const value = s => render({ exercise, set: s }).props.children[1].props.children;
  assert.equal(value(set), '105kg');
  assert.equal(value({ ...set, weight: '80', reps: '8' }), '101.3kg');
  assert.equal(value({ ...set, completed: true }), '105kg');
  assert.equal(value(set), '105kg');
  assert.equal(render({ exercise, set: { ...set, reps: '11' } }), null);
  assert.equal(render({ exercise: { ...exercise, name: 'FRONT SQUAT' }, set }), null);
  assert.equal(JSON.stringify(props), before);
  assert.deepEqual(evaluatePR({ ...exercise, sets: [set] }, [], 2), prBefore);
});

test('label opens requested explanation and integration stays below inputs before existing actions', () => {
  render({ exercise, set }).props.children[0].props.onPress();
  assert.deepEqual(alerts.pop(), ['e1RM', '推定1RMは重量と回数から計算した参考値です。実際の最大挙上重量とは異なる場合があります。PR判定には反映されません。']);
  const source = fs.readFileSync('src/app/workout.tsx', 'utf8');
  assert.match(source, /<EstimatedOneRepMax exercise=\{exercise\} set=\{set\} \/>\s*<View\s*style=\{\s*styles.setMetaRow/);
});
