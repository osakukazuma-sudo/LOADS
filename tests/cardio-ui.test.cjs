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

function harness(active = null, templates = [], history = [], customLibrary = []) {
  const slots = [], dependencies = [];
  let index = 0, effectIndex = 0, effects = [];
  const alerts = [], saved = [], routes = [], writes = [];
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useMemo: fn => fn(),
    useRef(initial) { const i=index++; return slots[i]??(slots[i]={current:initial}); },
    useEffect(fn, deps) { const i = effectIndex++; if (!dependencies[i] || deps.some((dep, j) => dep !== dependencies[i][j])) { effects.push(fn); dependencies[i] = deps; } },
  };
  const native = { StyleSheet: { create: value => value }, Alert: { alert: (...args) => alerts.push(args) },
    ...Object.fromEntries(['Text', 'View', 'TextInput', 'Pressable', 'ScrollView', 'SafeAreaView', 'FlatList', 'Modal'].map(name => [name, name])) };
  const mocks = {
    '../components/custom-exercise-form': { CustomExerciseForm: 'CustomExerciseForm' },
    '../lib/customExercises': { getCustomExercises: async () => customLibrary, isCustomExercise: item => !!item.exerciseKey, customExerciseBlock: (...args) => load('src/lib/customExercises.ts').customExerciseBlock(...args), searchExerciseLibrary: (...args) => load('src/lib/customExercises.ts').searchExerciseLibrary(...args) },
    '@react-native-async-storage/async-storage': {},
    react, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'expo-router': { useRouter: () => ({ push: route => routes.push(route), replace: route => routes.push(route) }) },
    '../hooks/use-account-owner': { useAccountOwner: () => owner },
    '../lib/workoutFinishAlert': { workoutFinishAlert: (...args) => alerts.push(args) },
    '../lib/notifications': { queueWorkoutCompletion: async () => { throw new Error('Push offline'); } },
    '../lib/workoutStorage': { getWorkouts: async () => history, getActiveWorkout: async () => active,
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

test('training goal descriptions preserve both strength mode selections and saved focus', async () => {
  for (const focus of ['VOLUME', 'PR']) {
    const h = harness({ startedAt: new Date().toISOString(), exercises: [] });
    h.render(); await flush(); let tree = h.render();
    button(tree, '+ ADD EXERCISE').props.onPress(); tree = h.render();
    button(tree, 'CHEST›').props.onPress(); tree = h.render();
    const list = nodes(tree).find(node => node.type === 'FlatList');
    list.props.renderItem({ item: list.props.data.find(item => item.name === 'BENCH PRESS') }).props.onPress();
    tree = h.render();
    const modal = nodes(tree).find(node => node.type === 'Modal' && node.props.visible && /Choose your training goal/.test(text(node)));
    assert.ok(modal);
    assert.match(text(modal), /Build your training volume with regular working sets\./);
    assert.match(text(modal), /Challenge your personal best weight\./);
    const option = nodes(modal).find(node => node.type === 'Pressable' && text(node).startsWith(focus));
    option.props.onPress(); h.render(); await flush();
    assert.equal(h.active().exercises[0].focus, focus);
    assert.equal(h.active().exercises[0].name, 'BENCH PRESS');
  }
});

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


test('new starts use v2 while resumed old workouts keep v1 and old PR badges', async () => {
 const e = {id:1,name:'BENCH PRESS',focus:'VOLUME',note:'',sets:[{id:11,weight:'80',reps:'8',completed:true,note:''}]};
 for(const version of [undefined,2]) {
  const h=harness({startedAt:new Date().toISOString(),exercises:[e],...(version ? {prVersion:version}: {})});
  h.render();await flush();const tree=h.render();
  assert.equal(/WEIGHT PR/.test(text(tree)), version!==2);
  assert.equal(/FIRST RECORD/.test(text(tree)),version===2);
  button(tree,'FINISH WORKOUT').props.onPress();await h.alerts.at(-1)[2].find(a=>a.text==='FINISH').onPress();
  assert.equal(h.saved[0].prVersion,version??1);
 }
 const h=harness();h.render();await flush();await button(h.render(),'START WORKOUT').props.onPress();
 assert.equal(h.active().prVersion,2);
});

test('classified templates start v2, bodyweight records actual reps and preserves classification through finish', async () => {
 const h=harness(null,[{id:'t',name:'PULL DAY',exercises:[{name:'PULL UP',type:'strength',focus:'VOLUME',loadType:'bodyweight'}]}]);
 h.render();await flush();await button(h.render(),'START THIS WORKOUT').props.onPress();let tree=h.render();
 assert.equal(h.active().prVersion,2);assert.equal(h.active().exercises[0].loadType,'bodyweight');assert.equal(h.active().exercises[0].sets[0].weight,'0');
 assert.ok(nodes(tree).find(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Weight (kg)'&&n.props.editable===false));
 const inputs=nodes(tree).filter(n=>n.type==='TextInput'&&n.props.keyboardType==='number-pad');inputs[0].props.onChangeText('8');
 tree=h.render();button(tree,'✓').props.onPress();tree=h.render();assert.match(text(tree),/FIRST RECORD/);assert.doesNotMatch(text(tree),/WEIGHT PR|REP PR|VOLUME PR/);
 button(tree,'FINISH WORKOUT').props.onPress();await h.alerts.at(-1)[2].find(a=>a.text==='FINISH').onPress();
 assert.equal(h.saved[0].exercises[0].sets[0].weight,'0');assert.equal(h.saved[0].exercises[0].sets[0].reps,'8');assert.equal(h.saved[0].exercises[0].loadType,'bodyweight');
});

test('PULL UP picker requires explicit classification and assistance PR follows minimum weight regardless of reps', async () => {
 const old={id:'old',finishedAt:'2026-10-13T01:00:00Z',exercises:[{id:1,name:'PULL UP',loadType:'assisted',note:'',focus:'VOLUME',sets:[{id:11,weight:'40',reps:'8',completed:true}]}]};
 const e={id:2,name:'PULL UP',loadType:'assisted',focus:'VOLUME',note:'',sets:[{id:21,weight:'30',reps:'1',completed:true,note:''}]};
 const h=harness({startedAt:new Date().toISOString(),prVersion:2,exercises:[e]},[],[old]);h.render();await flush();let tree=h.render();
 assert.match(text(tree),/WEIGHT PR/);assert.doesNotMatch(text(tree),/REP PR|VOLUME PR/);assert.match(text(tree),/EXCLUDED/);
 assert.ok(nodes(tree).find(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Assistance (kg)'));
 button(tree,'+ ADD EXERCISE').props.onPress();tree=h.render();button(tree,'BACK›').props.onPress();tree=h.render();
 const list=nodes(tree).find(n=>n.type==='FlatList');list.props.renderItem({item:list.props.data.find(e=>e.name==='PULL UP')}).props.onPress();tree=h.render();
 const goal=nodes(tree).find(n=>n.type==='Pressable'&&text(n).startsWith('VOLUMEBuild'));goal.props.onPress();assert.equal(h.alerts.at(-1)[0],'PULL UP TYPE');
 tree=h.render();const radio=nodes(tree).find(n=>n.props.accessibilityRole==='radio'&&text(n).includes('WEIGHTED'));radio.props.onPress();tree=h.render();nodes(tree).find(n=>n.type==='Pressable'&&text(n).startsWith('VOLUMEBuild')).props.onPress();h.render();await flush();assert.equal(h.active().exercises[1].loadType,'weighted');
});


test('legacy unclassified zero-weight PULL UP keeps its empty all-time weight PR display', async () => {
 const e={id:1,name:'PULL UP',focus:'PR',note:'',sets:[{id:11,weight:'0',reps:'8',completed:true,note:''}]};
 const old={id:'old',finishedAt:'2026-10-13T01:00:00Z',exercises:[e]};
 const h=harness({startedAt:new Date().toISOString(),exercises:[e]},[],[old]);h.render();await flush();assert.match(text(h.render()),/ALL-TIME PR—/);
});


test('unclassified templates require explicit choice before input; existing unclassified values are never erased', async () => {
 const h=harness(null,[{id:'old-pull',name:'PULL DAY',exercises:[{name:'PULL UP',focus:'VOLUME'}]}]);
 h.render();await flush();await button(h.render(),'START THIS WORKOUT').props.onPress();let tree=h.render();
 assert.ok(nodes(tree).filter(n=>n.type==='TextInput'&&['decimal-pad','number-pad'].includes(n.props.keyboardType)).every(n=>n.props.editable===false));
 button(tree,'BODYWEIGHT').props.onPress();h.render();await flush();assert.equal(h.active().exercises[0].loadType,'bodyweight');
 const e={id:1,name:'PULL UP',focus:'VOLUME',note:'',sets:[{id:11,weight:'40',reps:'8',completed:true,note:''}]};
 const loaded=harness({prVersion:2,startedAt:new Date().toISOString(),exercises:[e]});loaded.render();await flush();tree=loaded.render();
 button(tree,'ASSISTED').props.onPress();loaded.render();await flush();assert.equal(loaded.alerts.at(-1)[0],'KEEP EXISTING SETS');assert.equal(loaded.active().exercises[0].loadType,undefined);assert.equal(loaded.active().exercises[0].sets[0].weight,'40');assert.equal(loaded.active().exercises[0].sets[0].reps,'8');
});

const customItem=(category='chest',trackingType='weight_reps')=>({exerciseKey:'custom:00000000-0000-4000-8000-000000000001',name:'MY MOVEMENT',category,bodyPart:category,type:'strength',equipment:'other',trackingType,variation:'custom',aliases:[],archivedAt:null});
test('CREATE footer contains only its button and archive access remains available beside the category',async()=>{
 const item={...customItem(),archivedAt:'2026-10-15T00:00:00Z'},h=harness({prVersion:2,startedAt:'2026-10-15T00:00:00Z',exercises:[]},[],[],[item]);
 h.render();await flush();let tree=h.render();button(tree,'+ ADD EXERCISE').props.onPress();tree=h.render();button(tree,'CHEST›').props.onPress();tree=h.render();
 const create=button(tree,'+ CREATE EXERCISE');assert.ok(create);
 const footer=nodes(tree).find(n=>n.type==='View'&&(n.props.children===create||(Array.isArray(n.props.children)&&n.props.children.includes(create))));assert.equal(text(footer),'+ CREATE EXERCISE');
 nodes(tree).find(n=>n.props.accessibilityLabel==='Show archived exercises').props.onPress();tree=h.render();
 const list=nodes(tree).find(n=>n.type==='FlatList');assert.equal(list.props.data[0].exerciseKey,item.exerciseKey);
 const row=list.props.renderItem({item:list.props.data[0]});nodes(row).find(n=>n.props.accessibilityLabel===`Edit ${item.name}`).props.onPress();tree=h.render();
 assert.equal(nodes(tree).find(n=>n.type==='CustomExerciseForm').props.existing.archivedAt,item.archivedAt);
});
test('each muscle group opens CREATE with the search/group seed, cancellation returns, and saving automatically adds all tracking modes',async()=>{
 for(const category of ['chest','back','legs','shoulders','arms']){
  const h=harness({prVersion:2,startedAt:'2026-10-15T00:00:00Z',exercises:[]});h.render();await flush();let tree=h.render();
  button(tree,'+ ADD EXERCISE').props.onPress();tree=h.render();button(tree,category.toUpperCase()+'›').props.onPress();tree=h.render();
  nodes(tree).find(n=>n.type==='TextInput'&&n.props.placeholder==='Search exercise...').props.onChangeText('my movement');tree=h.render();
  button(tree,'+ CREATE EXERCISE').props.onPress();tree=h.render();let form=nodes(tree).find(n=>n.type==='CustomExerciseForm');assert.equal(form.props.category,category);assert.equal(form.props.query,'my movement');
  form.props.onCancel();tree=h.render();assert.equal(nodes(tree).some(n=>n.type==='CustomExerciseForm'),false);assert.equal(nodes(tree).find(n=>n.type==='TextInput'&&n.props.placeholder==='Search exercise...').props.value,'my movement');
  button(tree,'+ CREATE EXERCISE').props.onPress();tree=h.render();form=nodes(tree).find(n=>n.type==='CustomExerciseForm');await form.props.onSaved(customItem(category));h.render();await flush();
  assert.equal(h.active().exercises[0].exerciseKey,customItem().exerciseKey);assert.equal(h.active().exercises[0].muscleGroup,category);
 }
 for(const trackingType of ['weight_reps','bodyweight','weighted','assisted']){
  const item=customItem('back',trackingType),h=harness({prVersion:2,startedAt:'2026-10-15T00:00:00Z',exercises:[]},[],[],[item]);h.render();await flush();let tree=h.render();
  button(tree,'+ ADD EXERCISE').props.onPress();tree=h.render();button(tree,'BACK›').props.onPress();tree=h.render();const list=nodes(tree).find(n=>n.type==='FlatList');
  const row=list.props.renderItem({item:list.props.data.find(e=>e.exerciseKey)});nodes(row).find(n=>n.type==='Pressable').props.onPress();await flush();h.render();await flush();
  const added=h.active().exercises[0];assert.equal(added.loadType,trackingType==='weight_reps'?undefined:trackingType);assert.equal(added.sets[0].weight,trackingType==='bodyweight'?'0':'');
 }
});
test('custom IDs survive previous-session copy, template save/reuse and finish after a rename',async()=>{
 const item=customItem('back','assisted'),old={...item,id:1,name:'OLD NAME',note:'keep',focus:'VOLUME',loadType:'assisted',sets:[{id:2,weight:'40',reps:'8',completed:true,note:'old note',targetReps:'10'}]};
 const active={prVersion:2,startedAt:'2026-10-15T00:00:00Z',exercises:[{...old,id:3,name:item.name,sets:[{id:4,weight:'',reps:'',completed:false,note:''}]}]};
 const h=harness(active,[],[{id:'old',finishedAt:'2026-10-14T00:00:00Z',exercises:[old]}],[item]);h.render();await flush();let tree=h.render();
 assert.match(text(tree),/40kg assistance/);
 button(tree,'SAVE AS TEMPLATE').props.onPress();tree=h.render();nodes(tree).find(n=>n.type==='TextInput'&&n.props.placeholder==='e.g. PUSH A').props.onChangeText('custom day');tree=h.render();
 const save=nodes(tree).find(n=>n.type==='Pressable'&&text(n).trim()==='SAVE TEMPLATE');assert.ok(save);await save.props.onPress();await flush();
 assert.equal(h.templates[0].exercises[0].exerciseKey,item.exerciseKey);assert.equal(h.templates[0].exercises[0].loadType,'assisted');
 const restart=harness(null,h.templates);restart.render();await flush();await button(restart.render(),'START THIS WORKOUT').props.onPress();restart.render();assert.equal(restart.active().exercises[0].exerciseKey,item.exerciseKey);
 tree=h.render();button(tree,'COPY LAST').props.onPress();tree=h.render();await flush();assert.equal(h.active().exercises[0].sets[0].weight,'40');assert.equal(h.active().exercises[0].sets[0].targetReps,'10');
 button(tree,'✓').props.onPress();tree=h.render();button(tree,'FINISH WORKOUT').props.onPress();await h.alerts.at(-1)[2].find(a=>a.text==='FINISH').onPress();
 assert.equal(h.saved[0].exercises[0].exerciseKey,item.exerciseKey);assert.equal(h.saved[0].exercises[0].name,item.name);assert.equal(JSON.parse(h.routes[0].params.workout).exercises[0].exerciseKey,item.exerciseKey);

});
