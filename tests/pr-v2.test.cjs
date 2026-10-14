const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function loader() {
  const cache = new Map();
  const storage = { getItem: async () => null, setItem: async () => {} };
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const m = { exports: {} }; cache.set(name, m.exports);
    const code = ts.transpileModule(fs.readFileSync(path.resolve('src/lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(spec => spec.startsWith('.') ? load(spec.slice(2)) : storage, m, m.exports);
    return m.exports;
  }
  return load;
}
const load = loader(), { evaluatePR, exerciseVolume, topSet, setPR } = load('pr');
const set = (weight, reps, extra = {}) => ({ id: 1, weight: String(weight), reps: String(reps), completed: true, ...extra });
const exercise = (sets, extra = {}) => ({ id: 1, name: 'BENCH PRESS', focus: 'VOLUME', note: '', sets, ...extra });
const workout = (e, extra = {}) => ({ id: 'current', startedAt: '2026-10-14T00:00:00Z', finishedAt: '2026-10-14T01:00:00Z', durationSeconds: 60, exercises: [e], prVersion: 2, ...extra });
const history = e => [workout(e, { id: 'older', finishedAt: '2026-10-13T01:00:00Z', prVersion: undefined })];
test('version 1 keeps first-record badges; version 2 establishes a separate baseline', () => {
  const e = exercise([set(80, 8)]);
  assert.deepEqual(evaluatePR(e, [], 1).prTypes, ['WEIGHT PR', 'REP PR', 'VOLUME PR']);
  assert.deepEqual(evaluatePR(e, [], 2).prTypes, []);
  assert.equal(evaluatePR(e, [], 2).recordStatus, 'first');
  assert.equal(evaluatePR(exercise([set(80, 8, { completed: false })]), [], 2).recordStatus, undefined);
});
test('ordinary updates compare valid old data and never award REP PR at a new weight', () => {
  const old = history(exercise([set(80, 8)]));
  assert.deepEqual(evaluatePR(exercise([set(80, 9)]), old, 2).prTypes, ['REP PR', 'VOLUME PR']);
  assert.deepEqual(evaluatePR(exercise([set(90, 1)]), old, 2).prTypes, ['WEIGHT PR']);
  assert.deepEqual(evaluatePR(exercise([set(70, 20)]), old, 2).prTypes, ['VOLUME PR']);
  assert.deepEqual(evaluatePR(exercise([set(80, 8)]), old, 2).prTypes, []);
});
test('zero reps never establish v2 records or award PR; failed and stopped retain positive actual reps', () => {
  const old = history(exercise([set(80, 8)]));
  assert.deepEqual(evaluatePR(exercise([set(200, 0)]), old, 2).prTypes, []);
  assert.equal(evaluatePR(exercise([set(80, 0)]), [], 2).recordStatus, undefined);
  for (const status of ['failed', 'stopped']) {
    const e = exercise([set(80, 9, { status, targetReps: '10' })]);
    assert.equal(evaluatePR(e, old, 2).repPR, true);
    assert.equal(exerciseVolume(e, 2), 720);
  }
  const zeroHistory = history(exercise([set(200, 0)]));
  assert.equal(evaluatePR(exercise([set(80, 1)]), zeroHistory, 2).recordStatus, 'first');
});
test('volume compares only established VOLUME blocks; PR-only history does not award first VOLUME', () => {
  const e = exercise([set(80, 9)]);
  assert.equal(evaluatePR(e, history(exercise([set(80, 8)], { focus: 'PR' })), 2).volumePR, false);
  assert.equal(evaluatePR(e, history(exercise([set(80, 8)], { focus: 'PR' })), 2).recordStatus, 'established');
  assert.equal(evaluatePR({ ...e, focus: 'PR' }, history(exercise([set(80, 8)])), 2).volumePR, false);
});
test('assistance minimum is a weight record even with fewer reps; new assistance is not a rep record', () => {
  const assisted = sets => exercise(sets, { name: 'PULL UP', loadType: 'assisted' });
  const old = history(assisted([set(40, 8)]));
  assert.deepEqual(evaluatePR(assisted([set(30, 1)]), old, 2).prTypes, ['WEIGHT PR']);
  assert.deepEqual(evaluatePR(assisted([set(40, 9)]), old, 2).prTypes, ['REP PR']);
  assert.deepEqual(evaluatePR(assisted([set(50, 8)]), old, 2).prTypes, []);
  assert.deepEqual(evaluatePR(assisted([set(20, 0)]), old, 2).prTypes, []);
  assert.equal(evaluatePR(assisted([set(30, 1)]), [], 2).recordStatus, 'first');
  assert.equal(exerciseVolume(assisted([set(30, 10)]), 2), 0);
  assert.equal(topSet(assisted([set(40, 8), set(30, 1)]), 2).weight, '30');
});
test('bodyweight uses reps; weighted uses added weight; unknown and other classifications never mix', () => {
  const pull = (type, weight, reps) => exercise([set(weight, reps)], { name: 'PULL UP', ...(type ? { loadType: type } : {}) });
  const e = pull('bodyweight', 0, 9);
  assert.deepEqual(evaluatePR(e, history(pull('bodyweight', 0, 8)), 2).prTypes, ['REP PR']);
  assert.equal(exerciseVolume(e, 2), 0);
  for (const type of [undefined, 'assisted', 'weighted']) assert.equal(evaluatePR(e, history(pull(type, 40, 8)), 2).recordStatus, 'first');
  const weighted = pull('weighted', 20, 2);
  assert.deepEqual(evaluatePR(weighted, history(pull('weighted', 10, 2)), 2).prTypes, ['WEIGHT PR', 'VOLUME PR']);
  assert.equal(exerciseVolume(weighted, 2), 40);
  assert.equal(evaluatePR(pull(undefined, 0, 8), [], 2).recordStatus, undefined);
});
test('same time/current/future sessions are excluded and callers agree for version 2', () => {
  const e = exercise([set(80, 9)]), session = workout(e);
  const older = history(exercise([set(80, 8)]));
  const data = [...older, session, workout(exercise([set(200, 20)]), { id: 'equal' }), workout(exercise([set(200, 20)]), { id: 'future', finishedAt: '2026-10-15T01:00:00Z' })];
  for (const context of ['live', 'history', 'post']) assert.deepEqual(evaluatePR(e, data, 2, context, session).prTypes, ['REP PR', 'VOLUME PR']);
  assert.equal(setPR(e, e.sets[0], older, 2), 'REP PR');
});
test('legacy live duplicate-block behavior remains distinct while v2 checks every block', () => {
  const small = exercise([set(80, 1)]), big = exercise([set(80, 10)], { id: 2 });
  const old = [workout(small, { exercises: [small, big], id: 'old' })], e = exercise([set(80, 5)]);
  assert.equal(evaluatePR(e, old, 1, 'live').volumePR, true);
  assert.equal(evaluatePR(e, old, 1, 'history').volumePR, false);
  assert.equal(evaluatePR(e, old, 2, 'live').volumePR, false);
});
test('invalid numeric values do not produce v2 records; decimal comma is normalized without mutation', () => {
  for (const weight of ['', '-1', 'NaN', 'Infinity']) assert.equal(evaluatePR(exercise([set(weight, 8)]), [], 2).recordStatus, undefined);
  const e = exercise([set('80,5', 2)]), original = JSON.stringify(e);
  assert.equal(exerciseVolume(e, 2), 161);
  assert.equal(JSON.stringify(e), original);
});
test('new ordinary snapshots carry FIRST RECORD without badges, old repost snapshots retain legacy badges', () => {
  const { buildPostExercises } = load('workoutPost'), e = exercise([set(80, 8)]);
  const newer = buildPostExercises(workout(e), []);
  assert.equal(newer[0].recordStatus, 'first'); assert.deepEqual(newer[0].prTypes, []);
  const legacy = buildPostExercises(workout(e, { prVersion: undefined }), []);
  assert.equal(legacy[0].recordStatus, undefined); assert.equal(legacy[0].prTypes.length, 3);
  assert.deepEqual(load('postValidation').parseExercises(newer), newer);
});
test('classified publishing is stopped by validation, including direct/outbox callers; old snapshot is immutable', () => {
  const e = exercise([set(30, 1)], { name: 'PULL UP', loadType: 'assisted' });
  const snapshot = load('workoutPost').buildPostExercises(workout(e), []);
  const post = { id: 'post', workoutId: 'w', createdAt: '2026-10-14T01:00:00Z', caption: '', photoUri: null, durationSeconds: 60, totalSets: 1, totalVolume: 0, prCount: 0, exercises: snapshot };
  assert.throws(() => load('postValidation').assertPostSendAllowed(post), /paused/);
  const old = { ...post, exercises: load('workoutPost').buildPostExercises(workout(exercise([set(80, 8)]), { prVersion: undefined }), []) };
  const before = JSON.stringify(old); load('postValidation').validatePost(old); assert.equal(JSON.stringify(old), before);
});
test('copy clearly distinguishes assistance/bodyweight/added weight and leaves unclassified legacy output intact', () => {
  const format = load('workoutText').workoutToText;
  for (const [loadType, expected] of [['assisted', '30kg assistance x 8'], ['bodyweight', '8 reps'], ['weighted', '30kg added x 8']]) {
    assert.equal(format({ exercises: [exercise([set(30, 8)], { name: 'PULL UP', loadType })] }), `PULL UP (${loadType.toUpperCase()})\n${expected}`);
  }
  assert.equal(format({ exercises: [exercise([set(30, 8)], { name: 'PULL UP' })] }), 'PULL UP\n30kg x 8');
});
