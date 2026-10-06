const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const owner = '11111111-1111-4111-8111-111111111111';

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
const button = (tree, label) => nodes(tree).find(node => node.type === 'Pressable' && text(node).trim() === label);

function harness(active = null, templates = []) {
  const slots = [], dependencies = [];
  let index = 0, effectIndex = 0, effects = [];
  const alerts = [], saved = [], routes = [], writes = [];
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useMemo: fn => fn(),
    useEffect(fn, deps) { const i = effectIndex++; if (!dependencies[i] || deps.some((dep, j) => dep !== dependencies[i][j])) { effects.push(fn); dependencies[i] = deps; } },
  };
  const native = { StyleSheet: { create: value => value }, Alert: { alert: (...args) => alerts.push(args) },
    ...Object.fromEntries(['Text', 'View', 'TextInput', 'Pressable', 'ScrollView', 'SafeAreaView', 'FlatList', 'Modal'].map(name => [name, name])) };
  const mocks = {
    react, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'expo-router': { useRouter: () => ({ push: route => routes.push(route), replace: route => routes.push(route) }) },
    '../hooks/use-account-owner': { useAccountOwner: () => owner },
    '../lib/workoutFinishAlert': { workoutFinishAlert: (...args) => alerts.push(args) },
    '../lib/notifications': { queueWorkoutCompletion: async () => { throw new Error('Push offline'); } },
    '../lib/workoutStorage': { getWorkouts: async () => [], getActiveWorkout: async () => active,
      saveActiveWorkout: async (id, value) => { assert.equal(id, owner); writes.push(value); active = value; },
      saveWorkout: async (id, value) => { assert.equal(id, owner); saved.push(value); },
      clearActiveWorkout: async () => { active = null; } },
    '../lib/templateStorage': { getTemplates: async () => templates, saveTemplate: async (_id, value) => templates.push(value), deleteTemplate: async () => {} },
  };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const mod = { exports: {} }; cache.set(file, mod.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', code)(
      name => mocks[name] ?? load(path.resolve(path.dirname(file), name + (name.includes('components') ? '.tsx' : '.ts'))),
      mod, mod.exports, () => 1, () => {});
    return mod.exports;
  }
  const screen = load('src/app/workout.tsx').default;
  const cardioType = load('src/components/cardio-exercise-card.tsx').CardioExerciseCard;
  return { alerts, saved, routes, writes, cardioType, templates, active: () => active,
    render() { index = 0; effectIndex = 0; effects = []; const tree = screen(); effects.forEach(fn => fn()); return tree; } };
}
const running = { id: 2, name: 'RUNNING', type: 'cardio', note: '', sets: [], cardio: { durationMinutes: '', distanceKm: '', caloriesKcal: '' } };

test('category-first picker searches Japanese and English across categories and distinguishes equipment', async () => {
  const h = harness({ startedAt: new Date().toISOString(), exercises: [] }); h.render(); await flush();
  let tree=h.render();button(tree,'+ ADD EXERCISE').props.onPress();tree=h.render();
  assert.deepEqual(nodes(tree).find(node=>node.type==='FlatList').props.data,[]);
  button(tree,'CHEST›').props.onPress();tree=h.render();
  const list=nodes(tree).find(node=>node.type==='FlatList');assert.ok(list.props.data.some(e=>e.name==='SMITH MACHINE BENCH PRESS'));assert.equal(list.props.data.some(e=>e.name==='RUNNING'),false);
  for(const query of ['ラットプル','lat pulldown']) {nodes(tree).find(node=>node.type==='TextInput' && node.props.placeholder==='Search exercise...').props.onChangeText(query);tree=h.render();assert.ok(nodes(tree).find(node=>node.type==='FlatList').props.data.some(e=>e.name==='LAT PULLDOWN'));}
});

test('Cardio picker skips focus selection; numeric inputs and memo autosave, FINISH saves and routes the full record', async () => {
  const h = harness({ startedAt: new Date().toISOString(), exercises: [] });
  h.render(); await flush(); let tree = h.render();
  button(tree, '+ ADD EXERCISE').props.onPress(); tree = h.render();
  button(tree, 'CARDIO›').props.onPress(); tree = h.render();
  const list = nodes(tree).find(node => node.type === 'FlatList' && node.props.data?.some(item => item.name === 'RUNNING'));
  const item = list.props.data.find(item => item.name === 'RUNNING');
  list.props.renderItem({ item }).props.onPress(); tree = h.render();
  const focusModal = nodes(tree).filter(node => node.type === 'Modal')[1];
  assert.equal(focusModal.props.visible, false);
  let cardNode = nodes(tree).find(node => node.type === h.cardioType);
  let card = cardNode.type(cardNode.props);
  assert.equal(/WEIGHT|REPS|ADD SET|VOLUME|PR/.test(text(card)), false);
  assert.equal(/CALORIES|KCAL/.test(text(card)), false);
  for (const [label, value] of [['DURATION (MIN OR M:SS) · REQUIRED', '30:00'], ['DISTANCE (KM) · OPTIONAL', '5'], ['SPEED (KM/H) · OPTIONAL', '10.4'], ['INCLINE (%) · OPTIONAL', '0'], ['Cardio memo', 'Easy pace']]) {
    nodes(card).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label).props.onChangeText(value);
    tree = h.render(); cardNode = nodes(tree).find(node => node.type === h.cardioType); card = cardNode.type(cardNode.props);
  }
  assert.equal(h.writes.at(-1).exercises[0].cardio.durationMinutes, '30:00');
  button(tree, 'FINISH WORKOUT').props.onPress();
  const confirmation = h.alerts.at(-1);
  assert.equal(confirmation[0], 'FINISH WORKOUT?');
  assert.match(confirmation[1], /30 min cardio/);
  await confirmation[2].find(action => action.text === 'FINISH').onPress();
  assert.equal(h.saved.length, 1); assert.equal(h.active(), null);
  assert.deepEqual(h.saved[0].exercises[0].cardio, { durationMinutes: '30:00', distanceKm: '5', speedKmh: '10.4', inclinePercent: '0', resistanceLevel: '', paceSeconds: '', floors: '' });
  assert.equal(h.saved[0].exercises[0].note, 'Easy pace');
  assert.equal(h.routes[0].pathname, '/post');
  assert.deepEqual(JSON.parse(h.routes[0].params.workout).exercises, h.saved[0].exercises);
});

test('FINISH blocks missing Cardio duration without saving any partial mixed workout', async () => {
  const strength = { id: 1, name: 'BENCH PRESS', focus: 'VOLUME', note: '', sets: [{ id: 11, weight: '80', reps: '8', completed: true, note: '' }] };
  const h = harness({ startedAt: new Date().toISOString(), exercises: [strength, running] });
  h.render(); await flush(); const tree = h.render();
  button(tree, 'FINISH WORKOUT').props.onPress();
  assert.equal(h.alerts.at(-1)[0], 'CARDIO');
  assert.match(h.alerts.at(-1)[1], /RUNNING: Duration/);
  assert.equal(h.saved.length, 0); assert.equal(h.routes.length, 0);
  assert.equal(h.active().exercises.length, 2);
});

test('Cardio templates create empty Cardio inputs rather than strength sets', async () => {
  const h = harness(null, [{ id: 't1', name: 'CARDIO DAY', exercises: [{ name: 'CYCLING', type: 'cardio', focus: 'VOLUME' }] }]);
  h.render(); await flush(); const tree = h.render();
  const start = button(tree, 'START THIS WORKOUT');
  assert.ok(start); await start.props.onPress();
  const card = nodes(h.render()).find(node => node.type === h.cardioType);
  assert.ok(card); assert.equal(card.props.name, 'CYCLING');
  assert.deepEqual(h.active().exercises[0].sets, []);
  assert.equal(h.active().exercises[0].cardio.durationMinutes, '');
});

test('FINISH preserves the strength-only flow and saves completed strength plus cardio in mixed sessions', async () => {
  const strength = { id: 1, name: 'BENCH PRESS', focus: 'PR', note: 'Heavy day', sets: [
    { id: 11, weight: '100', reps: '5', completed: true, note: 'Good rep' },
    { id: 12, weight: '110', reps: '5', completed: false, note: '' },
  ] };
  for (const exercises of [[strength], [strength, { ...running, cardio: { durationMinutes: '20', distanceKm: '', caloriesKcal: '' } }]]) {
    const h = harness({ startedAt: new Date().toISOString(), exercises });
    h.render(); await flush(); const tree = h.render();
    assert.equal(nodes(tree).filter(node => node.type === h.cardioType).length, exercises.length - 1);
    assert.match(text(tree), /WEIGHT PR|ALL-TIME PR/);
    button(tree, 'FINISH WORKOUT').props.onPress();
    const confirmation = h.alerts.at(-1);
    assert.equal(confirmation[0], 'FINISH WORKOUT?');
    await confirmation[2].find(action => action.text === 'FINISH').onPress();
    assert.equal(h.saved[0].exercises.length, exercises.length);
    assert.equal(h.saved[0].exercises[0].focus, 'PR');
    assert.deepEqual(h.saved[0].exercises[0].sets, [strength.sets[0]]);
    assert.equal(h.saved[0].exercises[0].note, 'Heavy day');
    assert.equal(h.routes[0].pathname, '/post');
  }
});

test('legacy strength templates still start with one blank set and their original focus', async () => {
  const h = harness(null, [{ id: 'old-t1', name: 'HEAVY DAY', exercises: [{ name: 'BENCH PRESS', focus: 'PR' }] }]);
  h.render(); await flush();
  await button(h.render(), 'START THIS WORKOUT').props.onPress();
  const exercise = h.active().exercises[0];
  assert.equal(exercise.type, 'strength'); assert.equal(exercise.focus, 'PR');
  assert.equal(exercise.sets.length, 1); assert.equal(exercise.sets[0].completed, false);
  assert.equal(exercise.sets[0].weight, ''); assert.equal(exercise.cardio, undefined);
});

test('existing cardio card shows machine-specific fields, including treadmill and incline walk aliases', () => {
  const h = harness();
  for (const [name, fields] of [
    ['RUNNING', ['durationMinutes', 'distanceKm', 'speedKmh', 'inclinePercent']],
    ['TREADMILL', ['durationMinutes', 'distanceKm', 'speedKmh', 'inclinePercent']],
    ['WALKING', ['durationMinutes', 'distanceKm', 'speedKmh', 'inclinePercent']],
    ['INCLINE WALK', ['durationMinutes', 'distanceKm', 'speedKmh', 'inclinePercent']],
    ['CYCLING', ['durationMinutes', 'distanceKm', 'speedKmh', 'resistanceLevel']],
    ['BIKE', ['durationMinutes', 'distanceKm', 'speedKmh', 'resistanceLevel']],
    ['STAIR CLIMBER', ['durationMinutes', 'resistanceLevel', 'floors']],
    ['ROWING', ['durationMinutes', 'distanceKm', 'paceSeconds']],
  ]) {
    const changes = [];
    const card = h.cardioType({ name, index: 0, cardio: running.cardio, memo: '', onChange: value => changes.push(value),
      onMemo: () => {}, onRemove: () => {}, onMove: () => {}, canMoveUp: false, canMoveDown: false });
    const inputs = nodes(card).filter(node => node.type === 'TextInput' && node.props.accessibilityLabel !== 'Cardio memo');
    assert.equal(inputs.length, fields.length, name);
    assert.equal(/CALORIES|KCAL/.test(text(card)), false);
    inputs.forEach((input, index) => {
      assert.equal(input.props.value, '');
      input.props.onChangeText(index === 0 ? '30:00' : fields[index] === 'paceSeconds' ? '2:05' : '0');
      assert.equal(changes.at(-1)[fields[index]], index === 0 ? '30:00' : fields[index] === 'paceSeconds' ? '2:05' : '0');
      assert.equal('caloriesKcal' in changes.at(-1), false);
    });
  }
});
