const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file) {
  const mocks = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: ({ children }) => React.createElement('div', null, children),
      Text: ({ children }) => React.createElement('span', null, children), Image: 'img',
      Pressable: ({ children }) => React.createElement('button', null, children), StyleSheet: { create: value => value } },
    'expo-router': { useRouter: () => ({}) }, '../hooks/use-account-owner': { useAccountOwner: () => 'owner' },
    './delete-post-control': { DeletePostControl: () => null },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(specifier => mocks[specifier] ??
    load(path.resolve(path.dirname(file), specifier + (specifier.includes('lib/') ? '.ts' : '.tsx'))), module, module.exports);
  return module.exports;
}

test('Cardio summaries used by history, post composer and feed show units, optional values and memo without Strength UI', () => {
  const { CardioSummaryCard } = load('src/components/cardio-summary-card.tsx');
  for (const cardio of [
    { durationMinutes: 30, distanceKm: 5.25, caloriesKcal: 250 },
    { durationMinutes: 30, distanceKm: null, caloriesKcal: null },
    { durationMinutes: 30, distanceKm: 0, caloriesKcal: 0 },
  ]) {
    const html = renderToStaticMarkup(React.createElement(CardioSummaryCard, { name: 'RUNNING', cardio, memo: 'Easy pace' }));
    assert.match(html, /RUNNING/); assert.match(html, /CARDIO/); assert.match(html, /30:00/); assert.match(html, /Easy pace/);
    assert.equal(/SETS|REPS|WEIGHT PR|VOLUME|kg/.test(html), false);
    assert.equal(html.includes('km'), cardio.distanceKm !== null);
    assert.equal(html.includes('kcal'), false);
  }
});

test('Cardio-only feed replaces strength aggregates; mixed feed retains strength and cardio details', () => {
  const { FeedPostCard } = load('src/components/feed-post-card.tsx');
  const cardio = { id: 2, name: 'RUNNING', type: 'cardio', note: 'Easy pace', cardio: { durationMinutes: 30, distanceKm: 5, caloriesKcal: 250 } };
  const strength = { id: 1, name: 'BENCH PRESS', focus: 'PR', bestWeight: 100, bestReps: 5, sets: 1, volume: 500, prTypes: ['WEIGHT PR'] };
  const post = { userId: 'owner', authorName: 'Athlete', username: 'athlete', createdAt: '2026-10-03T01:00:00Z',
    durationSeconds: 1800, totalSets: 0, totalVolume: 0, prCount: 0, photoUri: null, exercises: [cardio], caption: '' };
  const html = renderToStaticMarkup(React.createElement(FeedPostCard, { post, onDeleted: () => {} }));
  assert.match(html, /30:00/); assert.match(html, /5 km/); assert.equal(html.includes('kcal'), false); assert.match(html, /Easy pace/);
  assert.equal(/SETS|VOLUME|kg|WEIGHT PR/.test(html), false);
  const mixed = renderToStaticMarkup(React.createElement(FeedPostCard, { post: { ...post, exercises: [strength, cardio], totalSets: 1, totalVolume: 500, prCount: 1 }, onDeleted: () => {} }));
  assert.match(mixed, /100kg/); assert.match(mixed, /WEIGHT PR/); assert.match(mixed, /30:00/);
});

test('cardio summary displays all actual metrics with units and preserves explicit zeros', () => {
  const { CardioSummaryCard } = load('src/components/cardio-summary-card.tsx');
  const html = renderToStaticMarkup(React.createElement(CardioSummaryCard, { name: 'TREADMILL', memo: '',
    cardio: { durationMinutes: 30, distanceKm: 5.2, speedKmh: 10.4, inclinePercent: 3, resistanceLevel: 0, paceSeconds: 125, floors: 0 } }));
  for (const value of ['30:00', '5.2 km', '10.4 km/h', 'Incline 3%', 'Level 0', '2:05 / 500m', '0 floors']) assert.ok(html.includes(value), value);
  assert.equal(/undefined|NaN|kcal/.test(html), false);
});
