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


test('new first-record feed snapshots display an independent state without a PR count badge', () => {
 const {FeedPostCard}=load('src/components/feed-post-card.tsx');
 const post={id:'p',userId:'owner',authorName:'Athlete',username:'a',createdAt:'2026-10-14T01:00:00Z',durationSeconds:60,totalSets:1,totalVolume:640,prCount:0,photoUri:null,caption:'',exercises:[{id:1,name:'BENCH PRESS',type:'strength',focus:'VOLUME',bestWeight:80,bestReps:8,sets:1,volume:640,note:'',prTypes:[],prVersion:2,recordStatus:'first'}]};
 const html=renderToStaticMarkup(React.createElement(FeedPostCard,{post,onDeleted:()=>{}}));assert.match(html,/FIRST RECORD/);assert.doesNotMatch(html,/WEIGHT PR|REP PR|VOLUME PR/);
 const legacy=renderToStaticMarkup(React.createElement(FeedPostCard,{post:{...post,prCount:3,exercises:[{...post.exercises[0],prVersion:undefined,recordStatus:undefined,prTypes:['WEIGHT PR','REP PR','VOLUME PR']}]},onDeleted:()=>{}}));
 assert.doesNotMatch(legacy,/FIRST RECORD/);assert.match(legacy,/WEIGHT PR/);assert.match(legacy,/REP PR/);assert.match(legacy,/VOLUME PR/);
});


test('classified feed labels assistance, added weight and bodyweight without treating zero as load', () => {
 const {FeedPostCard}=load('src/components/feed-post-card.tsx');
 const render=e=>renderToStaticMarkup(React.createElement(FeedPostCard,{post:{id:'p',userId:'owner',authorName:'Athlete',username:'a',createdAt:'2026-10-14T01:00:00Z',durationSeconds:60,totalSets:e.sets,totalVolume:e.volume,prCount:e.prTypes.length,photoUri:null,caption:'',exercises:[e]},onDeleted:()=>{}}));
 const base={id:1,name:'PULL UP',type:'strength',focus:'VOLUME',prVersion:2,recordStatus:'established',note:'',sets:1,volume:0};
 const assisted=render({...base,loadType:'assisted',bestWeight:30,bestReps:1,prTypes:['WEIGHT PR'],setResults:[{weight:'30',reps:'1',status:'stopped'}]});
 assert.match(assisted,/ASSISTED/);assert.match(assisted,/30kg assistance × 1/);assert.match(assisted,/WEIGHT PR · LESS ASSISTANCE/);assert.match(assisted,/VOLUME EXCLUDED/);assert.doesNotMatch(assisted,/30kg × 1|(?:^|[>\s])0kg/);
 const body=render({...base,loadType:'bodyweight',bestWeight:0,bestReps:8,prTypes:['REP PR'],setResults:[{weight:'0',reps:'8',targetReps:'10',status:'failed'}]});
 assert.match(body,/8 reps · BODYWEIGHT/);assert.match(body,/REP PR · BODYWEIGHT/);assert.match(body,/FAILED/);assert.doesNotMatch(body,/0kg|0kg x 8/);
 const weighted=render({...base,loadType:'weighted',bestWeight:10,bestReps:8,volume:80,prTypes:['WEIGHT PR','REP PR','VOLUME PR']});
 assert.match(weighted,/10kg added × 8/);assert.match(weighted,/ADDED-WEIGHT VOLUME/);assert.match(weighted,/bodyweight is not included/);assert.match(weighted,/REP PR · SAME ADDED WEIGHT/);
});

test('mixed feed explains excluded volume while retaining ordinary snapshots and aggregate values', () => {
 const {FeedPostCard}=load('src/components/feed-post-card.tsx');
 const exercises=[{id:1,name:'BENCH PRESS',focus:'PR',bestWeight:80,bestReps:8,sets:1,volume:640,prTypes:['WEIGHT PR']},{id:2,name:'PULL UP',loadType:'bodyweight',prVersion:2,recordStatus:'first',focus:'VOLUME',bestWeight:0,bestReps:8,sets:1,volume:0,prTypes:[]}];
 const post={id:'p',userId:'owner',authorName:'Athlete',username:'a',createdAt:'2026-10-14T01:00:00Z',durationSeconds:60,totalSets:2,totalVolume:640,prCount:1,photoUri:null,caption:'',exercises};const before=JSON.stringify(post);
 const html=renderToStaticMarkup(React.createElement(FeedPostCard,{post,onDeleted:()=>{}}));
 assert.match(html,/640kg/);assert.match(html,/Volume excludes assisted and bodyweight sets/);assert.match(html,/80kg × 8/);assert.match(html,/FIRST RECORD/);assert.equal(JSON.stringify(post),before);
});
