const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const startedAt = '2026-10-27T01:00:00.000Z';
const active = (exercises = []) => ({ prVersion: 2, startedAt, exercises });
const exercise = { id: 1, name: 'BENCH PRESS', focus: 'VOLUME', note: 'exercise memo', sets: [{ id: 2, weight: '90', reps: '5', completed: true, note: 'set memo' }] };

function harness(disk = new Map()) {
  const cache = new Map(), writes = [];
  let fail = false, pause;
  const storage = {
    getItem: async key => disk.get(key) ?? null,
    setItem: async (key, value) => {
      if (pause) { const gate = pause; pause = null; await gate; }
      if (fail) { fail = false; throw Error('disk full'); }
      writes.push(key); disk.set(key, value);
    },
  };
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const m = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path.resolve('src/lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(s => s.startsWith('.') ? load(s.slice(2)) : storage, m, m.exports);
    cache.set(name, m.exports); return m.exports;
  }
  return { disk, writes, load, api: load('workoutStorage'), data: load('userLocalData'), failNext: () => { fail = true; }, pauseNext: gate => { pause = gate; } };
}

test('discard immediately, with sets, and with memos clears only the owner active key and survives restart', async () => {
  for (const exercises of [[], [{ ...exercise, note: '', sets: exercise.sets.map(s => ({ ...s, note: '' })) }], [exercise]]) {
    const h = harness();
    for (const [key, value] of Object.entries({ workouts: [{ id: 'old', exercises: [exercise] }], templates: [{ id: 'template' }], 'custom-exercises': [{ exerciseKey: 'custom:keep' }], 'completion-sync': { pending: ['pending'] } })) {
      await h.data.updateLocal(A, key, null, () => value);
    }
    h.disk.set('@loads/post-outbox', '["unsent"]');
    h.disk.set('@loads/photos', '["existing"]');
    await h.api.saveActiveWorkout(B, active([exercise]));
    await h.api.saveActiveWorkout(A, active(exercises));
    const before = new Map(h.disk), firstWrite = h.writes.length;
    await h.api.discardActiveWorkout(A, startedAt);
    assert.equal(await h.api.getActiveWorkout(A), null);
    assert.equal(await harness(h.disk).api.getActiveWorkout(A), null);
    const key = h.data.userDataKey(A, 'active-workout');
    assert.deepEqual(h.writes.slice(firstWrite), [key]);
    for (const [k, value] of before) if (k !== key) assert.equal(h.disk.get(k), value, k);
  }
});

test('in-flight, queued and late autosaves cannot resurrect a discarded session or overwrite a fresh one', async () => {
  const h = harness();
  await h.api.saveActiveWorkout(A, active());
  let release;
  h.pauseNext(new Promise(resolve => { release = resolve; }));
  const saving = h.api.saveActiveWorkout(A, active([exercise]));
  // Let the first write enter storage before discard is requested.
  await new Promise(resolve => setImmediate(resolve));
  const queued = h.api.saveActiveWorkout(A, active([exercise]));
  const discard = h.api.discardActiveWorkout(A, startedAt);
  const late = h.api.saveActiveWorkout(A, active([exercise]));
  release();
  await Promise.all([saving, queued, discard, late]);
  assert.equal(await h.api.getActiveWorkout(A), null);
  const fresh = { ...active(), startedAt: '2026-10-27T02:00:00.000Z' };
  await h.api.saveActiveWorkout(A, fresh);
  await h.api.saveActiveWorkout(A, active([exercise]));
  assert.deepEqual(await h.api.getActiveWorkout(A), fresh);
  assert.deepEqual(await harness(h.disk).api.getActiveWorkout(A), fresh);
});

test('discard rejects a different session and storage failure preserves the active data and allows retry', async () => {
  const h = harness();
  await h.api.saveActiveWorkout(A, active([exercise]));
  await assert.rejects(h.api.discardActiveWorkout(A, 'stale-session'), /changed/);
  assert.deepEqual(await h.api.getActiveWorkout(A), active([exercise]));
  h.failNext();
  await assert.rejects(h.api.discardActiveWorkout(A, startedAt), /disk full/);
  assert.deepEqual(await harness(h.disk).api.getActiveWorkout(A), active([exercise]));
  await h.api.saveActiveWorkout(A, active());
  await h.api.discardActiveWorkout(A, startedAt);
  assert.equal(await h.api.getActiveWorkout(A), null);
});

const screen = fs.readFileSync('src/app/workout.tsx', 'utf8');
function screenAction(name, scope) {
  const source = ts.createSourceFile('workout.tsx', screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) initializer = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(initializer, name);
  const js = ts.transpileModule(`const action = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), js + '\nreturn action;')(...Object.values(scope));
}
function screenHarness(h) {
  const state = { exercises: [exercise], seconds: 90, startedAt, workoutStarted: true, expandedSetNotes: { 2: true } };
  const alerts = [], notifications = [], posts = [];
  const scope = {
    ownerId: A, startedAt, seconds: 90, prVersion: 2, exercises: [exercise],
    endingWorkout: { current: null }, activeSession: { current: startedAt },
    discardActiveWorkout: h.api.discardActiveWorkout, saveActiveWorkout: h.api.saveActiveWorkout, saveWorkout: h.api.saveWorkout, clearActiveWorkout: h.api.clearActiveWorkout,
    workoutFinishAlert: (...args) => alerts.push(args),
    completedWorkoutExercises: h.load('cardio').completedWorkoutExercises,
    numericInput: h.load('pr').numericInput, cardioTotals: h.load('cardio').cardioTotals,
    formatTime: () => '01:30', router: { push: value => posts.push(value) },
    queueWorkoutCompletion: async (...args) => notifications.push(args),
  };
  for (const key of ['PRVersion', 'WorkoutEnding', 'WorkoutStarted', 'StartedAt', 'Seconds', 'Exercises', 'ExpandedSetNotes', 'ExerciseModalVisible', 'FocusModalVisible', 'SaveTemplateModalVisible', 'CustomEditor', 'PendingExerciseName', 'PendingLoadType', 'EditingExerciseId', 'SearchText', 'ExerciseCategory', 'WorkoutHistory']) {
    scope['set' + key] = value => { const prop = key[0].toLowerCase() + key.slice(1); state[prop] = typeof value === 'function' ? value(state[prop] ?? []) : value; };
  }
  return { scope, state, alerts, notifications, posts, discard: screenAction('discardWorkout', scope), finish: screenAction('finishWorkout', scope) };
}

test('successful screen discard resets the session only after storage commits, blocks duplicate actions and never finishes', async () => {
  const h = harness(); await h.api.saveActiveWorkout(A, active([exercise]));
  const ui = screenHarness(h);
  let release; h.pauseNext(new Promise(resolve => { release = resolve; }));
  const pending = ui.discard();
  assert.equal(ui.state.workoutStarted, true);
  assert.equal(ui.state.workoutEnding, true);
  await ui.discard(); ui.finish();
  assert.equal(ui.alerts.length, 0);
  release(); await pending;
  assert.equal(ui.state.workoutStarted, false);
  assert.equal(ui.state.startedAt, null);
  assert.equal(ui.state.seconds, 0);
  assert.deepEqual(ui.state.exercises, []);
  assert.deepEqual(ui.state.expandedSetNotes, {});
  assert.equal(ui.scope.activeSession.current, null);
  assert.deepEqual(await h.api.getWorkouts(A), []);
  assert.deepEqual(ui.notifications, []); assert.deepEqual(ui.posts, []);
  await ui.discard(); ui.finish();
  assert.equal(ui.alerts.length, 0);
  await screenAction('startWorkout', ui.scope)();
  assert.equal(ui.state.workoutStarted, true);
  assert.equal(ui.state.seconds, 0);
  assert.notEqual(ui.state.startedAt, startedAt);
  assert.equal((await h.api.getActiveWorkout(A)).startedAt, ui.state.startedAt);
});

test('screen discard failure retains inputs and timer; normal FINISH still saves, notifies and opens post', async () => {
  const h = harness(); await h.api.saveActiveWorkout(A, active([exercise]));
  const ui = screenHarness(h); h.failNext(); await ui.discard();
  assert.equal(ui.state.seconds, 90); assert.equal(ui.state.workoutStarted, true);
  assert.deepEqual(ui.state.exercises, [exercise]);
  assert.equal(ui.state.workoutEnding, false);
  assert.equal(ui.alerts.pop()[0], 'COULD NOT DISCARD WORKOUT');
  ui.finish(); const confirmation = ui.alerts.pop();
  assert.equal(confirmation[0], 'FINISH WORKOUT?');
  await confirmation[2].find(b => b.text === 'FINISH').onPress();
  assert.equal((await h.api.getWorkouts(A)).length, 1);
  assert.equal(await h.api.getActiveWorkout(A), null);
  assert.equal(ui.notifications.length, 1); assert.equal(ui.posts[0].pathname, '/post');
  assert.equal(ui.state.workoutStarted, false);
});

test('FINISH in progress blocks discard and a stale FINISH confirmation cannot save a discarded session', async () => {
  const h = harness(); await h.api.saveActiveWorkout(A, active([exercise]));
  const ui = screenHarness(h);
  ui.finish();
  const finish = ui.alerts.pop()[2].find(b => b.text === 'FINISH').onPress;
  let release; h.pauseNext(new Promise(resolve => { release = resolve; }));
  const pending = finish();
  assert.equal(ui.scope.endingWorkout.current, 'finish');
  await ui.discard();
  release(); await pending;
  assert.equal((await h.api.getWorkouts(A)).length, 1);

  const other = harness(); await other.api.saveActiveWorkout(A, active([exercise]));
  const stale = screenHarness(other); stale.finish();
  const oldFinish = stale.alerts.pop()[2].find(b => b.text === 'FINISH').onPress;
  await stale.discard(); await oldFinish();
  assert.deepEqual(await other.api.getWorkouts(A), []);
  assert.deepEqual(stale.notifications, []); assert.deepEqual(stale.posts, []);
});

function menuHarness(os) {
  const sheets = [], alerts = []; let discards = 0;
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/components/workout-menu.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(s => s === 'react' ? { useState: () => [false, () => {}] } : s === 'react/jsx-runtime' ? { jsx, jsxs: jsx, Fragment: 'Fragment' } : s === 'react-native' ? {
    ActionSheetIOS: { showActionSheetWithOptions: (...args) => sheets.push(args) }, Platform: { OS: os }, StyleSheet: { create: x => x },
    Pressable: 'Pressable', Modal: 'Modal', Text: 'Text', View: 'View',
  } : { workoutFinishAlert: (...args) => alerts.push(args) }, module, module.exports);
  const tree = module.exports.WorkoutMenu({ disabled: false, onDiscard: async () => { discards++; } });
  return { tree, sheets, alerts, discards: () => discards };
}

test('iOS menu marks DISCARD red/destructive; cancelling menu or KEEP WORKING never executes discard', () => {
  const h = menuHarness('ios');
  h.tree.props.children[0].props.onPress();
  const [options, choose] = h.sheets[0];
  assert.equal(options.options[options.destructiveButtonIndex], 'DISCARD WORKOUT');
  choose(options.cancelButtonIndex); assert.equal(h.alerts.length, 0);
  choose(0);
  const [title, message, buttons] = h.alerts[0];
  assert.equal(title, 'DISCARD WORKOUT?');
  assert.equal(message, 'このワークアウトの記録を破棄します。\nこの操作は取り消せません。');
  assert.equal(buttons[0].text, 'KEEP WORKING'); assert.equal(buttons[0].style, 'cancel');
  buttons[0].onPress?.(); assert.equal(h.discards(), 0);
  assert.equal(buttons[1].style, 'destructive'); buttons[1].onPress();
  assert.equal(h.discards(), 1);
  assert.ok(screen.indexOf('<WorkoutMenu ') > screen.indexOf('if (\n    !workoutStarted'));
});

test('Android/web fallback exposes a red discard action and the same second confirmation', () => {
  for (const os of ['android', 'web']) {
    const h = menuHarness(os);
    const modal = h.tree.props.children[1];
    const action = modal.props.children.props.children.props.children[0];
    assert.equal(action.props.children.props.children, 'DISCARD WORKOUT');
    assert.equal(action.props.children.props.style.color, '#D99B9B');
    action.props.onPress();
    assert.equal(h.alerts[0][0], 'DISCARD WORKOUT?');
    assert.equal(h.discards(), 0);
    h.alerts[0][2][1].onPress(); assert.equal(h.discards(), 1);
  }
});
