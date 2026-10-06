const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const owner='11111111-1111-4111-8111-111111111111';
function harness(disk=new Map(),history=[]) {
 const state={owner,error:null},calls=[];
 function restart() {
  const mod={exports:{}};
  const mocks={ './supabase':{supabase:{rpc:async(name,args)=>{calls.push([name,args]);return{data:'event',error:state.error};},from:()=>{const builder={select:()=>builder,eq:()=>builder,maybeSingle:async()=>({data:{workout_enabled:state.enabled??false},error:state.error}),upsert:async value=>{calls.push(['preferences',value]);state.enabled=value.workout_enabled;return{error:state.error};}};return builder;}}},
    './accountActivity':{beginAccountOperation:()=>()=>{}},'./cloudPosts':{currentUserId:async()=>state.owner},'./workoutStorage':{getWorkouts:async()=>history},
    './userLocalData':{readLocal:async(id,key,fallback)=>disk.has(id+'/'+key)?structuredClone(disk.get(id+'/'+key)):fallback,updateLocal:async(id,key,fallback,fn)=>disk.set(id+'/'+key,structuredClone(fn(disk.get(id+'/'+key)??fallback)))} };
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/notifications.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>mocks[name],mod,mod.exports);return mod.exports;
 }
 return{state,calls,disk,history,restart,api:restart()};
}
test('completion sync never notifies historical workouts; new finishes survive offline failure and restart, with dedup and account checks',async()=>{
 const h=harness(new Map(),[{id:'old',finishedAt:'2020-01-01T00:00:00Z',durationSeconds:60}]);await h.api.initializeCompletionSync(owner);
 h.history.push({id:'new',finishedAt:new Date(Date.now()+100).toISOString(),durationSeconds:60});h.state.error=Error('offline');
 await assert.rejects(h.api.syncWorkoutCompletions(owner),/offline/);assert.equal(h.disk.get(owner+'/completion-sync').acknowledged.length,0);assert.equal(h.history.length,2);
 h.state.error=null;const restarted=h.restart();await Promise.all([restarted.syncWorkoutCompletions(owner),restarted.syncWorkoutCompletions(owner)]);
 assert.equal(h.calls.filter(c=>c[0]==='record_workout_completion').length,2);assert.deepEqual(h.disk.get(owner+'/completion-sync').acknowledged,['new']);
 await restarted.syncWorkoutCompletions(owner);assert.equal(h.calls.length,2);
 h.history.push({id:'other',finishedAt:new Date(Date.now()+200).toISOString(),durationSeconds:60});h.state.owner='22222222-2222-4222-8222-222222222222';await assert.rejects(restarted.syncWorkoutCompletions(owner),/Account changed/);assert.equal(h.calls.length,2);
});
test('workout notification preference defaults OFF, saves ON/OFF for the authenticated owner and exposes failure',async()=>{
 const h=harness();assert.equal(await h.api.workoutNotificationsEnabled(owner),false);
 await h.api.setWorkoutNotifications(owner,true);assert.equal(await h.api.workoutNotificationsEnabled(owner),true);
 await h.api.setWorkoutNotifications(owner,false);assert.equal(await h.api.workoutNotificationsEnabled(owner),false);
 h.state.error=Error('offline');await assert.rejects(h.api.setWorkoutNotifications(owner,true),/offline/);
 h.state.owner='other';await assert.rejects(h.api.setWorkoutNotifications(owner,true),/Account changed/);
});
test('an explicitly queued finish before the first sync baseline is not lost',async()=>{
 const workout={id:'just-finished',finishedAt:new Date(Date.now()-100).toISOString(),durationSeconds:60};const h=harness(new Map(),[workout]);
 await h.api.queueWorkoutCompletion(owner,workout);assert.equal(h.calls[0][1].p_workout_id,'just-finished');
 assert.deepEqual(h.disk.get(owner+'/completion-sync').pending,[]);
 await h.restart().syncWorkoutCompletions(owner);assert.equal(h.calls.length,1);
});
