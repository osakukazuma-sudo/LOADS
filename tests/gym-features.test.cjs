const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function load(name) {
  const mod = { exports: {} }, code = ts.transpileModule(fs.readFileSync(path.resolve('src/lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require','module','exports',code)(spec => load(spec.slice(2)),mod,mod.exports); return mod.exports;
}
test('Japanese aliases, fullwidth Latin, halfwidth katakana, case and spaces search across categories', () => {
  const { searchExercises } = load('exerciseLibrary');
  for (const query of ['ベンチ','ベンチプレス','ＢＥＮＣＨ ＰＲＥＳＳ','bench press','ﾍﾞﾝﾁ']) assert.ok(searchExercises(query, 'cardio').some(e => e.name === 'BENCH PRESS'), query);
  assert.ok(searchExercises('インクライン').some(e => e.name === 'INCLINE BENCH PRESS'));
  assert.ok(searchExercises('ラットプルダウン').some(e => e.name === 'LAT PULLDOWN'));
  assert.ok(searchExercises('下半身').some(e => e.name === 'SQUAT'));
  assert.ok(searchExercises('有酸素').every(e => e.type === 'cardio'));
  assert.deepEqual(searchExercises('no_such_exercise'), []);
});
test('category entry starts empty, each category contains appropriate definitions and equipment variants stay distinct', () => {
  const { searchExercises, EXERCISE_LIBRARY, EXERCISE_CATEGORIES } = load('exerciseLibrary');
  assert.deepEqual(searchExercises(''), []);
  for (const category of EXERCISE_CATEGORIES) assert.ok(searchExercises('', category).length);
  assert.equal(searchExercises('', 'cardio').length, 5);
  assert.equal(new Set(EXERCISE_LIBRARY.map(e => e.name)).size, EXERCISE_LIBRARY.length);
  const chest = searchExercises('', 'chest');
  for (const name of ['Barbell Bench Press','Smith Machine Bench Press','Incline Barbell Bench Press','Smith Machine Incline Bench Press','Dumbbell Incline Bench Press','Paused Bench Press','Larsen Press','Close-Grip Bench Press']) assert.ok(searchExercises(name).some(e => chest.some(c => c.name === e.name)), name);
  assert.equal(searchExercises('smith bench')[0].equipment, 'smith');
  assert.equal(EXERCISE_LIBRARY.find(e => e.name === 'BENCH PRESS').equipment, 'barbell');
});
test('legacy sets stay ordinary; missed target and explicit failure persist, copy and retain actual-rep PR calculations', () => {
  const { setResult, setResultLabel } = load('setResult'), { workoutToText } = load('workoutText'), { buildPostExercises } = load('workoutPost');
  const set = { id: 11, weight: '80', reps: '6', completed: true };
  assert.equal(setResult(set), 'completed'); assert.equal(setResultLabel(set), '');
  assert.equal(setResult({ ...set, targetReps: '8' }), 'failed');
  assert.equal(setResult({ ...set, targetReps: '6' }), 'completed');
  assert.equal(setResult({ ...set, targetReps: '0' }), 'completed');
  assert.equal(setResult({ ...set, status: 'failed' }), 'failed');
  assert.equal(setResult({ ...set, status: 'stopped' }), 'stopped');
  const workout = { id: 'work', finishedAt: '2026-10-03T01:00:00Z', exercises: [{ id: 1, name: 'BENCH PRESS', note: '', sets: [{ ...set, targetReps: '8' }] }] };
  assert.equal(workoutToText(workout), 'BENCH PRESS\n80kg x 6 / target 8 · FAILED');
  assert.equal(workoutToText({exercises:[{...workout.exercises[0],sets:[{...set,reps:'0',status:'failed'}]}]}),'BENCH PRESS\n80kg x 0 / FAILED');
  const snapshot = buildPostExercises(workout, []), normal = buildPostExercises({ ...workout, exercises: [{ ...workout.exercises[0], sets: [set] }] }, []);
  assert.deepEqual(snapshot[0].prTypes, normal[0].prTypes); assert.equal(snapshot[0].volume,480);
  assert.deepEqual(snapshot[0].setResults,[{weight:'80',reps:'6',targetReps:'8'}]);
  assert.equal(load('postValidation').parseExercises(JSON.parse(JSON.stringify(snapshot)))[0].setResults[0].targetReps,'8');
});
test('post validation rejects forged/duplicate/oversized partner lists and malformed set extensions', () => {
  const { validatePost,parseExercises }=load('postValidation');
  const exercise={id:1,name:'BENCH',focus:'VOLUME',bestWeight:80,bestReps:6,sets:1,volume:480,note:'',prTypes:[]};
  const post={id:'p',workoutId:'w',createdAt:'2026-10-03T01:00:00Z',caption:'',photoUri:null,durationSeconds:1,totalSets:1,totalVolume:480,prCount:0,exercises:[exercise]};
  const partner={id:'22222222-2222-4222-8222-222222222222',username:'athlete'};
  validatePost({...post,trainingPartners:[partner]});
  assert.throws(()=>validatePost({...post,trainingPartners:[partner,partner]}),/three/);
  assert.throws(()=>validatePost({...post,trainingPartners:[{...partner,id:'forged'}]}),/three/);
  assert.throws(()=>parseExercises([{...exercise,setResults:[{weight:'80',reps:'6',targetReps:'0'}]}]),/set results/);
  assert.throws(()=>parseExercises([{...exercise,setResults:[{weight:'80',reps:'6',status:'anything'}]}]),/set results/);
});
