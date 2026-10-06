const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(os, confirmResult) {
  const calls = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/workoutFinishAlert.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', 'window', code)(
    () => ({ Platform: { OS: os }, Alert: { alert: (...args) => calls.push(args) } }),
    module, module.exports,
    { confirm: () => confirmResult, alert: text => calls.push(text) },
  );
  return { show: module.exports.workoutFinishAlert, calls };
}

test('web finish cancellation never runs the save action; confirmation runs it once', () => {
  let saves = 0;
  const actions = [{ text: 'CANCEL', style: 'cancel' }, { text: 'FINISH', onPress: () => saves++ }];
  load('web', false).show('FINISH WORKOUT?', '1 set', actions);
  assert.equal(saves, 0);
  load('web', true).show('FINISH WORKOUT?', '1 set', actions);
  assert.equal(saves, 1);
});

test('web validation and save errors are visible', () => {
  const h = load('web');
  h.show('NO COMPLETED SETS', 'Complete at least one set first.');
  h.show('ERROR', 'Could not save workout.');
  assert.deepEqual(h.calls, ['NO COMPLETED SETS\n\nComplete at least one set first.', 'ERROR\n\nCould not save workout.']);
});

test('iOS delegates unchanged actions and options to the native alert', () => {
  const h = load('ios');
  const actions = [{ text: 'CANCEL', style: 'cancel' }, { text: 'FINISH', onPress: () => {} }];
  const options = { cancelable: false };
  h.show('FINISH WORKOUT?', '1 set', actions, options);
  assert.deepEqual(h.calls, [['FINISH WORKOUT?', '1 set', actions, options]]);
  assert.equal(h.calls[0][2], actions);
});
