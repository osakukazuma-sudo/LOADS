const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('src/lib/workoutText.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const results = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/lib/setResult.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(results, results.exports);
const cardioModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/lib/cardio.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(cardioModule, cardioModule.exports);
new Function('require', 'module', 'exports', code)(name => name === './cardio' ? cardioModule.exports : results.exports, moduleUnderTest, moduleUnderTest.exports);
const { workoutToText } = moduleUnderTest.exports;
const set = (weight, reps, completed = true) => ({ id: 99, weight, reps, completed });
const strength = (name, sets, type = 'strength') => ({ id: 1, name, type, note: '', sets });
const cardio = (input = {}, note = '') => ({ id: 2, name: 'Running', type: 'cardio', sets: [], note,
  cardio: { durationMinutes: '20', distanceKm: '', caloriesKcal: '', ...input } });
const format = exercises => workoutToText({ exercises });

test('Strength only preserves multiple exercise/set order and fractional weights', () => {
  assert.equal(format([
    strength('High Bar Squat', [set('20', '6'), set('60', '4'), set('80', '4'), set('92.5', '4'), set('90', '4'), set('90', '4')]),
    strength('RDL', [set('12.5', '8'), set('15', '8'), set('15', '8')]),
    strength('Overhead Extension', [set('60', '10'), set('70', '9'), set('40', '16')]),
  ]), 'High Bar Squat\n20kg x 6\n60kg x 4\n80kg x 4\n92.5kg x 4\n90kg x 4\n90kg x 4\n\nRDL\n12.5kg x 8\n15kg x 8\n15kg x 8\n\nOverhead Extension\n60kg x 10\n70kg x 9\n40kg x 16');
});

test('Cardio only formats required duration, optional distance and memo without legacy calories', () => {
  assert.equal(format([cardio({ distanceKm: '3.2', caloriesKcal: '245' }, 'Easy pace')]),
    'Running\nDuration: 20 min\nDistance: 3.2 km\nMemo: Easy pace');
});

test('mixed Strength/Cardio sessions keep original interleaved order', () => {
  assert.equal(format([
    strength('Squat', [set('80', '4')]), cardio(), strength('RDL', [set('15', '8')]),
    { ...cardio({ durationMinutes: '10' }), name: 'Walking' },
  ]), 'Squat\n80kg x 4\n\nRunning\nDuration: 20 min\n\nRDL\n15kg x 8\n\nWalking\nDuration: 10 min');
});

test('blank optional Cardio fields are omitted; explicit zeros and multiline memo are preserved', () => {
  assert.equal(format([cardio({}, '  ')]), 'Running\nDuration: 20 min');
  assert.equal(format([cardio({ distanceKm: '0', caloriesKcal: '0' }, 'Easy\nRecovery')]),
    'Running\nDuration: 20 min\nDistance: 0 km\nMemo: Easy\nRecovery');
  assert.equal(format([cardio({ durationMinutes: '', distanceKm: undefined, caloriesKcal: undefined })]), 'Running\nDuration: —');
});

test('legacy Strength without type is never classified from its exercise name', () => {
  const legacy = strength('Running', [set('50', '10')]); delete legacy.type;
  assert.equal(format([legacy]), 'Running\n50kg x 10');
});

test('uncompleted and blank sets are omitted without inventing weight/reps', () => {
  assert.equal(format([strength('Pull Up', [set('', '8'), set('20', ''), set('0', '6'), set('', ''), set('90', '4', false)])]),
    'Pull Up\n8 reps\n20kg\n0kg x 6');
  assert.equal(format([strength('Empty', [set('', '')])]), '');
  assert.equal(format([]), '');
});

test('locale decimals and invalid numeric values do not produce NaN, negative stats or invented zero', () => {
  assert.equal(format([cardio({ durationMinutes: ' 1,5 ', distanceKm: '.5', caloriesKcal: 'Infinity' })]),
    'Running\nDuration: 1.5 min\nDistance: 0.5 km');
  assert.equal(format([strength('Squat', [set('NaN', '3'), set('-20', '0'), set('1e3', 'abc')])]), 'Squat\n3 reps');
});

test('formatting is pure and includes no IDs, focus, PR calculations or database metadata', () => {
  const workout = { id: 'private-workout-id', ownerId: 'private-owner', exercises: [
    { ...strength('Squat', [set('80', '4')]), focus: 'PR', database: 'profiles' }, cardio(),
  ] };
  const before = JSON.stringify(workout);
  const output = workoutToText(workout);
  assert.equal(JSON.stringify(workout), before);
  assert.equal(/private|profiles|focus|PR|"|\{|\}/.test(output), false);
});

test('copy text includes speed, incline, resistance, rowing pace and floors', () => {
  assert.equal(format([cardio({ durationMinutes: '30:00', speedKmh: '10.4', inclinePercent: '3', resistanceLevel: '0', paceSeconds: '2:05', floors: '0' })]),
    'Running\nDuration: 30 min\nSpeed: 10.4 km/h\nIncline: 3%\nLevel: 0\nPace: 2:05 / 500m\nFloors: 0');
});
