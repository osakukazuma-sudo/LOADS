const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const owner = '11111111-1111-4111-8111-111111111111';

function harness(disk = new Map()) {
  const storage = {
    getItem: async key => disk.get(key) ?? null,
    getAllKeys: async () => [...disk.keys()],
    setItem: async (key, value) => disk.set(key, value),
    multiGet: async keys => keys.map(key => [key, disk.get(key) ?? null]),
  };
  const cache = new Map();
  function load(name) {
    const file = path.resolve('src/lib', `${name}.ts`);
    if (cache.has(file)) return cache.get(file);
    const mod = { exports: {} };
    cache.set(file, mod.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', code)(
      spec => spec.startsWith('.') ? load(spec.slice(2)) : storage, mod, mod.exports);
    return mod.exports;
  }
  return { disk, load, storage };
}
const strength = () => ({ id: 1, name: 'BENCH PRESS', note: 'legacy', sets: [
  { id: 11, weight: '100', reps: '5', completed: true },
  { id: 12, weight: '200', reps: '5', completed: false },
] });
const cardio = () => ({ id: 2, name: 'RUNNING', type: 'cardio', note: 'Easy pace', sets: [],
  cardio: { durationMinutes: '30:00', distanceKm: '5.25', speedKmh: '10.4', inclinePercent: '3', resistanceLevel: '0', paceSeconds: '2:05', floors: '0' } });
const session = exercises => ({ id: 'workout-1', startedAt: '2026-10-03T01:00:00Z', finishedAt: '2026-10-03T02:00:00Z', durationSeconds: 3600, exercises });

test('legacy strength records retain sets, volume and all PR behavior', () => {
  const h = harness(), { completedWorkoutExercises } = h.load('cardio');
  const exercises = completedWorkoutExercises([strength()]);
  assert.equal(exercises[0].sets.length, 1);
  const workout = session(exercises), { buildPostExercises } = h.load('workoutPost');
  const snapshot = buildPostExercises(workout, []);
  assert.deepEqual(snapshot[0], { id: 1, name: 'BENCH PRESS', type: 'strength', focus: 'VOLUME', bestWeight: 100,
    bestReps: 5, sets: 1, volume: 500, note: 'legacy', prTypes: ['WEIGHT PR', 'REP PR', 'VOLUME PR'] });
  const older = { ...workout, id: 'older', finishedAt: '2026-10-02T02:00:00Z' };
  assert.deepEqual(buildPostExercises(workout, [older])[0].prTypes, []);
  const prFocus = session([{ ...exercises[0], focus: 'PR' }]);
  assert.deepEqual(buildPostExercises(prFocus, [older])[0].prTypes, []);
  // An older custom exercise with a cardio name still defaults to strength.
  assert.equal(buildPostExercises(session([{ ...strength(), name: 'RUNNING' }]), [])[0].type, 'strength');
});

test('cardio-only and mixed workouts survive active/history/template restart and build valid post snapshots', async () => {
  for (const input of [[cardio()], [strength(), cardio()]]) {
    const h = harness(), workouts = h.load('workoutStorage');
    const active = { startedAt: '2026-10-03T01:00:00Z', exercises: input };
    await workouts.saveActiveWorkout(owner, active);
    const restart = harness(h.disk);
    assert.deepEqual(await restart.load('workoutStorage').getActiveWorkout(owner), active);
    const completed = restart.load('cardio').completedWorkoutExercises(active.exercises);
    const workout = session(completed);
    await restart.load('workoutStorage').saveWorkout(owner, workout);
    await restart.load('workoutStorage').clearActiveWorkout(owner);
    const template = { id: 'mixed-template', name: 'WORK', createdAt: workout.finishedAt,
      exercises: input.map(exercise => ({ name: exercise.name, type: exercise.type ?? 'strength', focus: 'VOLUME' })) };
    await restart.load('templateStorage').saveTemplate(owner, template);
    const reopened = harness(h.disk);
    const saved = (await reopened.load('workoutStorage').getWorkouts(owner))[0];
    assert.deepEqual(saved, workout);
    assert.equal(await reopened.load('workoutStorage').getActiveWorkout(owner), null);
    assert.deepEqual((await reopened.load('templateStorage').getTemplates(owner))[0], template);
    const exercises = reopened.load('workoutPost').buildPostExercises(saved, []);
    const running = exercises.find(exercise => exercise.type === 'cardio');
    assert.deepEqual(running.cardio, { durationMinutes: 30, distanceKm: 5.25, speedKmh: 10.4, inclinePercent: 3, resistanceLevel: 0, paceSeconds: 125, floors: 0 });
    assert.equal(running.note, 'Easy pace');
    assert.deepEqual(running.prTypes, []);
    assert.equal(running.sets, 0); assert.equal(running.volume, 0);
    const post = { id: 'post-1', workoutId: saved.id, createdAt: saved.finishedAt, photoUri: null, caption: '',
      durationSeconds: saved.durationSeconds, totalSets: input.length === 1 ? 0 : 1,
      totalVolume: input.length === 1 ? 0 : 500, prCount: input.length === 1 ? 0 : 3, exercises };
    reopened.load('postValidation').validatePost(post);
    assert.deepEqual(reopened.load('postValidation').parseExercises(JSON.parse(JSON.stringify(exercises))), exercises);
    await reopened.load('postOutbox').saveLocalPost({ userId: owner, post, status: 'pending', error: null, cloudId: null });
    assert.deepEqual((await harness(h.disk).load('postOutbox').getLocalPosts(owner))[0].post, post);
    assert.deepEqual(await workouts.getWorkouts('22222222-2222-4222-8222-222222222222'), []);
  }
});

test('duration required, optional blank metrics, locale decimals and invalid values are handled', () => {
  const { cardioRecord, completedWorkoutExercises, cardioTotals } = harness().load('cardio');
  assert.deepEqual(cardioRecord({ ...cardio(), cardio: { durationMinutes: '1,5', distanceKm: '', caloriesKcal: '0' } }),
    { durationMinutes: 1.5, distanceKm: null, speedKmh: null, inclinePercent: null, resistanceLevel: null, paceSeconds: null, floors: null });
  assert.equal(cardioTotals([{ ...cardio(), cardio: { durationMinutes: '1,5', distanceKm: '', caloriesKcal: '' } }]).durationMinutes, 1.5);
  assert.equal(cardioTotals([{ ...cardio(), cardio: { durationMinutes: '30', distanceKm: '', caloriesKcal: '' } }]).distanceLabel, '—');
  for (const value of ['', '-1', 'NaN', 'Infinity', '1e3', '12abc', '1000000000000000', '2:60', '-1:00']) {
    assert.throws(() => completedWorkoutExercises([{ ...cardio(), cardio: { ...cardio().cardio, durationMinutes: value } }]), /RUNNING: Duration/);
  }
  for (const field of ['distanceKm', 'speedKmh', 'inclinePercent', 'resistanceLevel', 'floors']) {
    assert.throws(() => cardioRecord({ ...cardio(), cardio: { ...cardio().cardio, [field]: '-1' } }));
  }
  assert.equal(cardioRecord({ ...cardio(), cardio: { durationMinutes: '.5', distanceKm: '0', caloriesKcal: '' } }).durationMinutes, 0.5);
  const contaminated = { ...cardio(), sets: strength().sets };
  assert.deepEqual(completedWorkoutExercises([contaminated])[0].sets, []);
  assert.deepEqual(harness().load('workoutPost').buildPostExercises(session([contaminated]), [])[0].prTypes, []);
});

test('cloud validation rejects malformed cardio, strength metrics/PRs on cardio and unknown exercise types', () => {
  const h = harness();
  const snapshot = h.load('workoutPost').buildPostExercises(session([cardio()]), [])[0];
  for (const bad of [
    { type: 'swim' }, { cardio: null }, { cardio: { ...snapshot.cardio, durationMinutes: -1 } },
    { cardio: { ...snapshot.cardio, caloriesKcal: -1 } }, { sets: 1 }, { bestWeight: 1 }, { prTypes: ['WEIGHT PR'] },
  ]) assert.throws(() => h.load('postValidation').parseExercises([{ ...snapshot, ...bad }]));
  const legacy = h.load('workoutPost').buildPostExercises(session([strength()]), [])[0];
  delete legacy.type;
  assert.deepEqual(h.load('postValidation').parseExercises([legacy]), [legacy]);
});

test('exercise catalog expands strength exercises and supplies five cardio category entries', () => {
  const { EXERCISE_LIBRARY } = harness().load('exerciseLibrary');
  assert.equal(EXERCISE_LIBRARY.filter(exercise => exercise.type === 'strength').length, 42);
  const items = EXERCISE_LIBRARY.filter(exercise => exercise.type === 'cardio');
  assert.deepEqual(items.map(exercise => exercise.name), ['RUNNING', 'WALKING', 'CYCLING', 'STAIR CLIMBER', 'ROWING']);
  assert.ok(items.every(exercise => exercise.category === 'cardio'));
});

test('each quantitative metric distinguishes zero from blank and rejects negative values; pace is strict m:ss', () => {
  const { cardioRecord, cardioTotals } = harness().load('cardio');
  const input = { durationMinutes: '0', distanceKm: '', speedKmh: '', inclinePercent: '', resistanceLevel: '', paceSeconds: '', floors: '' };
  assert.equal(cardioRecord({ ...cardio(), cardio: input }).durationMinutes, 0);
  for (const field of ['distanceKm', 'speedKmh', 'inclinePercent', 'resistanceLevel', 'floors']) {
    assert.equal(cardioRecord({ ...cardio(), cardio: input })[field], null);
    assert.equal(cardioRecord({ ...cardio(), cardio: { ...input, [field]: '0' } })[field], 0);
    for (const value of ['-1', 'NaN', 'Infinity', '1e3', '12abc'])
      assert.throws(() => cardioRecord({ ...cardio(), cardio: { ...input, [field]: value } }));
  }
  for (const value of ['2:60', '2:5', '2.05', '-2:05', '2:05:00', 'abc'])
    assert.throws(() => cardioRecord({ ...cardio(), cardio: { ...input, paceSeconds: value } }), /Pace/);
  assert.equal(cardioRecord({ ...cardio(), cardio: { ...input, paceSeconds: '0:00' } }).paceSeconds, 0);
  assert.equal(cardioRecord({ ...cardio(), cardio: { ...input, paceSeconds: '2:05' } }).paceSeconds, 125);
  assert.equal(cardioTotals([cardio()]).durationMinutes, 30);
});

test('old calories remain readable but new saves and snapshots omit them without mutating legacy records', async () => {
  const h = harness();
  const legacy = { ...cardio(), cardio: { durationMinutes: '30', distanceKm: '', caloriesKcal: '250' } };
  const workout = session([legacy]);
  h.disk.set(h.load('userLocalData').userDataKey(owner, 'workouts'), JSON.stringify([workout]));
  const reopened = harness(h.disk);
  const saved = (await reopened.load('workoutStorage').getWorkouts(owner))[0];
  assert.equal(saved.exercises[0].cardio.caloriesKcal, '250');
  const snapshot = reopened.load('workoutPost').buildPostExercises(saved, [])[0];
  assert.equal('caloriesKcal' in snapshot.cardio, false);
  reopened.load('postValidation').parseExercises([{ ...snapshot, cardio: { durationMinutes: 30, distanceKm: null, caloriesKcal: 250 } }]);
  assert.equal(reopened.load('cardio').cardioSummary(snapshot.cardio).includes('kcal'), false);
  await reopened.load('workoutStorage').saveActiveWorkout(owner, { startedAt: workout.startedAt, exercises: [legacy] });
  await reopened.load('workoutStorage').saveWorkout(owner, workout);
  assert.equal('caloriesKcal' in (await harness(h.disk).load('workoutStorage').getActiveWorkout(owner)).exercises[0].cardio, false);
  assert.equal('caloriesKcal' in (await harness(h.disk).load('workoutStorage').getWorkouts(owner))[0].exercises[0].cardio, false);
  assert.equal(legacy.cardio.caloriesKcal, '250');
});
