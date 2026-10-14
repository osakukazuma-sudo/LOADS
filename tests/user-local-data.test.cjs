const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
function harness(disk = new Map()) {
  let fail = '';
  const storage = {
    getItem: async key => disk.get(key) ?? null,
    setItem: async (key, value) => { if (key === fail) { fail = ''; throw Error('disk full'); } disk.set(key, value); },
    multiGet: async keys => keys.map(key => [key, disk.get(key) ?? null]),
  };
  const cache = new Map();
  function load(name) {
    const file = path.resolve('src/lib', name + '.ts');
    if (cache.has(file)) return cache.get(file);
    const m = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(specifier => specifier.startsWith('.') ? load(specifier.slice(2)) : storage, m, m.exports);
    cache.set(file, m.exports); return m.exports;
  }
  return { disk, data: load('userLocalData'), workouts: load('workoutStorage'), templates: load('templateStorage'), failNext: key => { fail = key; } };
}
test('A/B/A isolation and restart preserve history, active workout and templates', async () => {
  const h = harness();
  await h.workouts.saveWorkout(A, { id: 'a', exercises: [] });
  await h.workouts.saveActiveWorkout(A, { startedAt: 'now', exercises: [] });
  await h.templates.saveTemplate(A, { id: 'template-a' });
  assert.deepEqual(await h.workouts.getWorkouts(B), []);
  assert.equal(await h.workouts.getActiveWorkout(B), null);
  assert.deepEqual(await h.templates.getTemplates(B), []);
  await h.workouts.saveWorkout(B, { id: 'b' });
  const reopened = harness(h.disk);
  assert.equal((await reopened.workouts.getWorkouts(A))[0].id, 'a');
  assert.equal((await reopened.templates.getTemplates(A))[0].id, 'template-a');
  assert.equal((await reopened.workouts.getActiveWorkout(A)).startedAt, 'now');
  await assert.rejects(h.workouts.getWorkouts(''), /Sign in/);
});
test('old ownerless records are never automatically assigned; migration is recoverable and single-owner', async () => {
  const h = harness(new Map([['@loads/workouts', JSON.stringify([{ id: 'old' }])], ['@loads/templates', JSON.stringify([{ id: 't' }])], ['@loads/posts', '[{"id":"unowned"}]']]));
  assert.deepEqual(await h.workouts.getWorkouts(A), []);
  assert.equal(await h.data.legacyDataAvailable(A), true);
  h.failNext(h.data.userDataKey(A, 'templates'));
  await assert.rejects(h.data.migrateLegacyData(A), /disk full/);
  const reopened = harness(h.disk);
  assert.equal(await reopened.data.legacyDataAvailable(B), false);
  await assert.rejects(reopened.data.migrateLegacyData(B), /another account/);
  await reopened.data.migrateLegacyData(A);
  await reopened.data.migrateLegacyData(A);
  assert.equal((await reopened.workouts.getWorkouts(A)).length, 1);
  assert.equal((await reopened.templates.getTemplates(A)).length, 1);
  assert.equal(h.disk.get('@loads/posts'), '[{"id":"unowned"}]');
  assert.equal(await reopened.data.legacyDataAvailable(A), false);
});
test('concurrent local writes do not lose records and write failures block a flush', async () => {
  const h = harness();
  await Promise.all([h.workouts.saveWorkout(A, { id: 'one' }), h.workouts.saveWorkout(A, { id: 'two' })]);
  assert.equal((await h.workouts.getWorkouts(A)).length, 2);
  h.failNext(h.data.userDataKey(A, 'active-workout'));
  await assert.rejects(h.workouts.saveActiveWorkout(A, {}));
  await assert.rejects(h.data.flushLocalWrites(), /disk full/);
});


test('PR version and load classification survive local restart without rewriting legacy history or templates', async () => {
 const h=harness();const old={id:'old',exercises:[{id:1,name:'PULL UP',sets:[{weight:'40',reps:'8',completed:true}]}]};
 await h.workouts.saveWorkout(A,old);const original=JSON.stringify((await h.workouts.getWorkouts(A))[0]);
 const e={id:2,name:'PULL UP',loadType:'assisted',sets:[{weight:'30',reps:'1',completed:true,status:'stopped'}]};
 await h.workouts.saveWorkout(A,{id:'new',prVersion:2,exercises:[e]});await h.workouts.saveActiveWorkout(A,{startedAt:'now',prVersion:2,exercises:[e]});
 await h.templates.saveTemplate(A,{id:'new-template',exercises:[{name:'PULL UP',loadType:'assisted',focus:'VOLUME'}]});
 const resumed=harness(h.disk);const workouts=await resumed.workouts.getWorkouts(A);
 assert.equal(JSON.stringify(workouts.find(w=>w.id==='old')),original);assert.equal(workouts[0].prVersion,2);assert.equal(workouts[0].exercises[0].loadType,'assisted');
 assert.equal((await resumed.workouts.getActiveWorkout(A)).prVersion,2);assert.equal((await resumed.templates.getTemplates(A))[0].exercises[0].loadType,'assisted');
 assert.deepEqual(await resumed.workouts.getWorkouts(B),[]);
});
