const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const key=i=>`custom:00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
function harness(disk=new Map()){
 let fail='',photos=[];const storage={getItem:async k=>disk.get(k)??null,setItem:async(k,v)=>{if(fail===k){fail='';throw Error('disk full');}disk.set(k,v);},getAllKeys:async()=>[...disk.keys()],multiRemove:async keys=>keys.forEach(k=>disk.delete(k))};
 const cache=new Map();function load(name){if(cache.has(name))return cache.get(name);const m={exports:{}};cache.set(name,m.exports);
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.resolve('src/lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='./postPhotoFiles'?{deleteAccountPhotos:async id=>photos.push(id)}:n.startsWith('.')?load(n.slice(2)):storage,m,m.exports);return m.exports;}
 return{disk,load,photos,api:load('customExercises'),data:load('userLocalData'),fail:k=>fail=k};
}
const draft=(i,extra={})=>({exerciseKey:key(i),name:`CUSTOM MOVEMENT ${i}`,category:'chest',equipment:'barbell',trackingType:'weight_reps',...extra});
test('library persists all tracking/equipment/muscle choices, normalizes names and isolates accounts across restart',async()=>{
 const h=harness();let i=1;
 for(const category of ['chest','back','legs','shoulders','arms'])for(const trackingType of ['weight_reps','bodyweight','weighted','assisted']){
  const item=await h.api.saveCustomExercise(A,draft(i++,{category,trackingType,name:`  My   Movement ${i}  `}));
  assert.equal(item.name,`MY MOVEMENT ${i}`);assert.equal(item.category,category);assert.equal(item.trackingType,trackingType);
 }
 for(const [equipment]of h.api.EQUIPMENT)await h.api.saveCustomExercise(A,draft(i++,{equipment}));
 assert.equal((await h.api.getCustomExercises(B)).length,0);
 const restored=harness(h.disk);assert.equal((await restored.api.getCustomExercises(A)).length,27);
 for(const category of ['chest','back','legs','shoulders','arms'])assert.ok(h.api.searchExerciseLibrary('',category,await restored.api.getCustomExercises(A)).some(e=>e.exerciseKey));
 assert.equal(h.api.searchExerciseLibrary('ＭＹ　ＭＯＶＥＭＥＮＴ','back',await restored.api.getCustomExercises(A)).filter(e=>e.exerciseKey).length,4);
});
test('empty, canonical duplicates, preset names and aliases are rejected; distinct groups have independent IDs',async()=>{
 const h=harness();for(const name of ['','   ','\u3000'])await assert.rejects(h.api.saveCustomExercise(A,draft(1,{name})),/exercise name/);
 await h.api.saveCustomExercise(A,draft(1,{name:'  MY   PRESS  '}));
 for(const name of ['my press','ＭＹ　ＰＲＥＳＳ','my_press','my-press'])await assert.rejects(h.api.saveCustomExercise(A,draft(2,{name})),/already has/);
 for(const name of ['bench press','ＢＥＮＣＨ　ＰＲＥＳＳ','Barbell Bench Press'])await assert.rejects(h.api.saveCustomExercise(A,draft(2,{name})),/preset/);
 await h.api.saveCustomExercise(A,draft(2,{name:'my press',category:'back'}));
 await assert.rejects(h.api.saveCustomExercise(A,draft(3,{category:'cardio'})),/muscle group/);
 const parallel=await Promise.allSettled([h.api.saveCustomExercise(A,draft(4,{name:'parallel'})),h.api.saveCustomExercise(A,draft(5,{name:'PARALLEL'}))]);
 assert.equal(parallel.filter(r=>r.status==='fulfilled').length,1);
});
test('four tracking modes use stable identity, preserve renamed previous records and award only meaningful PRs',async()=>{
 const h=harness(),{evaluatePR,sameExercise,exerciseVolume}=h.load('pr');
 for(const [i,trackingType]of ['weight_reps','bodyweight','weighted','assisted'].entries()){
  const item=await h.api.saveCustomExercise(A,draft(i+1,{trackingType}));
  const old=h.api.customExerciseBlock(item,1);old.sets=[{id:2,weight:trackingType==='bodyweight'?'0':'40',reps:'8',completed:true,note:'old set',targetReps:'10'}];old.note='old exercise';
  const saved=await h.api.saveCustomExercise(A,{...item,name:`RENAMED ${i}`,equipment:'cable',category:'arms'});
  const current=h.api.customExerciseBlock(saved,3);current.sets=[{id:4,weight:trackingType==='bodyweight'?'0':trackingType==='assisted'?'30':'50',reps:'9',completed:true,note:'new'}];
  assert.equal(sameExercise(old,current),true);assert.equal(sameExercise(old,{...old,exerciseKey:key(99)}),false);assert.equal(sameExercise(old,{...old,exerciseKey:undefined}),false);
  const history=[{id:'old',finishedAt:'2026-10-14T00:00:00Z',exercises:[old]}];
  const result=evaluatePR(current,history,1); // even in a resumed v1 workout
  assert.equal(result.weightPR,trackingType!=='bodyweight');assert.equal(result.repPR,trackingType==='bodyweight');
  assert.equal(exerciseVolume(current,1),trackingType==='assisted'||trackingType==='bodyweight'?0:450);
  assert.equal(old.name,item.name);assert.equal(old.note,'old exercise');assert.equal(old.sets[0].note,'old set');
  await assert.rejects(h.api.saveCustomExercise(A,{...saved,trackingType:trackingType==='weighted'?'bodyweight':'weighted'}),/Tracking type is fixed/);
 }
});
test('history, active workout, templates and post/feed snapshots survive archive with original names and notes',async()=>{
 const h=harness(),w=h.load('workoutStorage'),t=h.load('templateStorage');
 const original=await h.api.saveCustomExercise(A,draft(1));const block=h.api.customExerciseBlock(original,1);
 block.sets=[{id:2,weight:'40',reps:'8',completed:true,note:'keep set',targetReps:'10',status:'stopped'}];block.note='keep exercise';
 const session={id:'work',startedAt:'2026-10-15T00:00:00Z',finishedAt:'2026-10-15T01:00:00Z',durationSeconds:3600,prVersion:2,exercises:[block]};
 await w.saveWorkout(A,session);await w.saveActiveWorkout(A,session);await t.saveTemplate(A,{id:'template',exercises:[{...block,sets:undefined}]});
 const encoded=JSON.stringify(await w.getWorkouts(A));
 await h.api.saveCustomExercise(A,{...original,name:'RENAMED'});await h.api.archiveCustomExercise(A,original.exerciseKey);
 assert.equal(h.api.searchExerciseLibrary('',original.category,await h.api.getCustomExercises(A)).some(e=>e.exerciseKey),false);
 assert.equal(JSON.stringify(await w.getWorkouts(A)),encoded);
 const restarted=harness(h.disk);const active=await restarted.load('workoutStorage').getActiveWorkout(A);assert.equal(active.exercises[0].exerciseKey,original.exerciseKey);assert.equal(active.exercises[0].sets[0].note,'keep set');
 const template=(await restarted.load('templateStorage').getTemplates(A))[0];assert.equal(template.exercises[0].exerciseKey,original.exerciseKey);
 const snapshot=h.load('workoutPost').buildPostExercises(session,[]);assert.equal(snapshot[0].exerciseKey,original.exerciseKey);assert.equal(snapshot[0].name,original.name);assert.equal(snapshot[0].setResults[0].targetReps,'10');
 assert.deepEqual(h.load('postValidation').parseExercises(snapshot),snapshot);
 const post={id:'post',workoutId:'work',createdAt:session.finishedAt,caption:'',photoUri:null,durationSeconds:3600,totalSets:1,totalVolume:320,prCount:0,exercises:snapshot};
 assert.doesNotThrow(()=>h.load('postValidation').assertPostSendAllowed(post));
 await h.api.archiveCustomExercise(A,original.exerciseKey,false);assert.equal((await h.api.getCustomExercises(A))[0].archivedAt,null);
});
test('classified custom snapshots render safely while the existing outbound compatibility gate remains intact',async()=>{
 const h=harness(),{buildPostExercises}=h.load('workoutPost'),{parseExercises,assertPostSendAllowed}=h.load('postValidation');
 for(const [i,trackingType]of ['bodyweight','weighted','assisted'].entries()){
  const item=await h.api.saveCustomExercise(A,draft(i+1,{trackingType}));const block=h.api.customExerciseBlock(item,1);
  block.sets=[{id:2,weight:trackingType==='bodyweight'?'0':'20',reps:'8',completed:true}];
  const exercises=buildPostExercises({id:'w',finishedAt:'2026-10-15T00:00:00Z',exercises:[block]},[]);assert.doesNotThrow(()=>parseExercises(exercises));
  assert.match(h.load('postDisplay').postBestSummary(exercises[0]),trackingType==='bodyweight'?/reps/:trackingType==='assisted'?/assistance/:/added/);
  assert.throws(()=>assertPostSendAllowed({id:'p',workoutId:'w',createdAt:'2026-10-15T00:00:00Z',caption:'',photoUri:null,durationSeconds:60,totalSets:1,totalVolume:exercises[0].volume,prCount:0,exercises}),/posting is paused/);
 }
});
test('write failures keep originals, retry is idempotent and account deletion clears only its own library',async()=>{
 const h=harness();await h.api.saveCustomExercise(A,draft(1));await h.api.saveCustomExercise(B,draft(1));
 const original=h.disk.get(h.data.userDataKey(A,'custom-exercises'));
 h.fail(h.data.userDataKey(A,'custom-exercises'));await assert.rejects(h.api.saveCustomExercise(A,draft(2)),/disk full/);
 assert.equal(h.disk.get(h.data.userDataKey(A,'custom-exercises')),original);
 await h.api.saveCustomExercise(A,draft(2));await h.api.saveCustomExercise(A,draft(2));assert.equal((await h.api.getCustomExercises(A)).length,2);
 await h.load('accountDeletionLocalData').clearDeletedAccountData(A);assert.deepEqual(await h.api.getCustomExercises(A),[]);assert.equal((await h.api.getCustomExercises(B)).length,1);
 await assert.rejects(h.api.saveCustomExercise(A,draft(3)),/removed/);
});
