const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file){const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports);return mod.exports;}
const {WORKOUT_REACTIONS,ALL_WORKOUT_REACTIONS,createReactionController}=load('src/lib/workoutReactions.ts');
test('four selectable reactions, replacement, cancellation and reload restore only the caller state',async()=>{
 let saved=null,writes=0;const read=async()=>saved,write=async v=>{writes++;saved=v;};
 const c=createReactionController(read,write,()=>{});await c.refresh();
 assert.equal(WORKOUT_REACTIONS.length,4);
 for(const r of WORKOUT_REACTIONS){await c.select(r.type);assert.equal(saved,r.type);}
 await c.select(WORKOUT_REACTIONS.at(-1).type);assert.equal(saved,null);
 await c.select('beast');c.dispose();
 const reload=createReactionController(read,write,()=>{});await reload.refresh();assert.equal(reload.state.value,'beast');
 const another=createReactionController(async()=>null,write,()=>{});await another.refresh();assert.equal(another.state.value,null);
 const before=writes;await c.select('slay');assert.equal(writes,before);
});
test('double tap cannot overlap writes; dispose/account switch ignores late result',async()=>{
 let finish,writes=0,draws=0;const c=createReactionController(async()=>null,()=>{writes++;return new Promise(resolve=>finish=resolve);},()=>draws++,null);
 const pending=c.select('beast');await c.select('slay');assert.equal(writes,1);assert.equal(c.state.value,'beast');
 c.dispose();const before=draws;finish();await pending;assert.equal(draws,before);
});
test('offline rollback, uncertain commit reconciliation, failed refresh blocks toggle until recovered',async()=>{
 let saved='beast',offline=false,commit=false;
 const c=createReactionController(async()=>{if(offline)throw Error('offline');return saved;},async value=>{if(commit)saved=value;throw Error('lost');},()=>{},saved);
 await c.select('slay');assert.equal(c.state.value,'beast');assert.equal(c.state.error,true);
 commit=true;await c.select('slay');assert.equal(c.state.value,'slay');
 offline=true;await c.select('beast');assert.equal(c.state.value,'slay');assert.equal(c.state.ready,false);
 await c.select('no_tomorrow');assert.equal(saved,'beast');
 offline=false;await c.refresh();assert.equal(c.state.value,'beast');assert.equal(c.state.error,false);
});
test('worker catalog matches UI and formats all eight notification messages',()=>{
 const push=load('supabase/functions/_shared/push.ts');assert.deepEqual(push.WORKOUT_REACTIONS,ALL_WORKOUT_REACTIONS);
 for(const r of ALL_WORKOUT_REACTIONS){
  const payload=push.pushMessage({kind:'reaction',actorName:'gym_bro',reactionType:r.type});
  assert.equal(payload.title,'gym_bro');assert.equal(payload.body,`${r.label} ${r.emoji}`);
 }
 assert.deepEqual(ALL_WORKOUT_REACTIONS.map(r=>[r.emoji,r.label]),[
  ['🦍','BEAST!!'],['⚡','YEAH BUDDY!!'],['☠️','WELCOME TO THE PAIN ZONE!!'],['🗣️','LIGHT WEIGHT BABY!!'],
  ['🔥','THERE IS NO TOMORROW!!'],['🔱','WAGMI BRAH!!'],['💅','SLAYYYYY!!'],['🧬','BUILT DIFFERENT!!'],
 ]);
});

test('selection order and existing IDs are preserved',()=>{
 assert.deepEqual(WORKOUT_REACTIONS.map(r=>r.type),['beast','yeah_buddy','slay','light_weight']);
});
test('all legacy values restore and can be replaced then cancelled',async()=>{
 for(const type of ['pain_zone','no_tomorrow','wagmi','built_different']){
  let saved=type;
  const c=createReactionController(async()=>saved,async v=>{saved=v;},()=>{});
  await c.refresh();assert.equal(c.state.value,type);
  await c.select('slay');assert.equal(saved,'slay');
  await c.select('slay');assert.equal(saved,null);
 }
});
