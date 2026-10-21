const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function harness(){let owner='a',visible=true,denyDelete=false,authPause=null;
 const activityModule={exports:{}};
 new Function('module','exports',ts.transpileModule(fs.readFileSync('src/lib/accountActivity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(activityModule,activityModule.exports);
 const activity=activityModule.exports;
 Object.defineProperty(activity,'active',{get:()=>activity.getAccountActivityDiagnostics().operationCount});const records=new Map(),queries=[];const supabase={auth:{getSession:async()=>{if(authPause)await authPause;return {data:{session:owner?{user:{id:owner}}:null},error:null};}},from:table=>{
 const filters={};let op='read',payload;const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},in:(_k,ids)=>{filters.ids=ids;return q;},upsert:p=>{op='write';payload=p;return q;},delete:()=>{op='delete';return q;},maybeSingle:async()=>({data:table==='posts'?(visible?{id:filters.id}:null):records.get(filters.user_id+'/'+filters.post_id)??null,error:null}),then:resolve=>{
 queries.push([table,op,filters,payload]);if(op==='write')records.set(payload.user_id+'/'+payload.post_id,payload);
 const deleted=op==='delete'&&!denyDelete&&visible&&records.has(filters.user_id+'/'+filters.post_id);
 if(deleted)records.delete(filters.user_id+'/'+filters.post_id);
 return Promise.resolve({data:op==='delete'?(deleted?[{post_id:filters.post_id}]:[]):op==='read'?[...records.values()].filter(r=>r.user_id===filters.user_id&&filters.ids.includes(r.post_id)):null,error:null}).then(resolve);
 }};return q;}};
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/reactionApi.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>name.includes('accountActivity')?activity:name.includes('workoutReactions')?{reportReactionFailure:()=>{}}:{supabase},mod,mod.exports);
 return {api:mod.exports,queries,activity,switch:v=>owner=v,visible:v=>visible=v,denyDelete:v=>denyDelete=v,pause:()=>{let release;authPause=new Promise(resolve=>release=resolve);return ()=>{authPause=null;release();};}};}
test('absolute writes are retry-safe, page restoration is batched and scoped to account, logout prevents mutation',async()=>{
 const h=harness();await h.api.writeReaction('a','p','beast');await h.api.writeReaction('a','p','beast');
 assert.equal(await h.api.readReaction('a','p'),'beast');assert.deepEqual([...(await h.api.readPageReactions('a',['p','q']))],[['p','beast']]);
 assert.equal(h.queries.filter(q=>q[1]==='read').length,1);
 h.switch('b');assert.equal(await h.api.readReaction('b','p'),null);assert.equal((await h.api.readPageReactions('b',['p'])).size,0);
 await assert.rejects(h.api.writeReaction('a','p','slay'),/Account changed/);
 h.switch(null);await assert.rejects(h.api.writeReaction('a','p',null),/Account changed/);
 h.switch('a');await h.api.writeReaction('a','p',null);assert.equal(await h.api.readReaction('a','p'),null);
});

test('zero-row cancellation after unfollow/deletion or account freeze cannot report success',async()=>{
 const h=harness();await h.api.writeReaction('a','p','beast');
 h.visible(false);await assert.rejects(h.api.writeReaction('a','p',null),/Post unavailable/);assert.equal(h.activity.active,0);
 h.visible(true);h.denyDelete(true);await assert.rejects(h.api.writeReaction('a','p',null),/not allowed/);assert.equal(h.activity.active,0);
 h.denyDelete(false);await h.api.writeReaction('a','p',null);
 await h.api.writeReaction('a','p',null); // already absent, still visible: safe idempotent retry
 assert.equal(h.activity.active,0);
});

test('real account activity lock prevents logout during a reaction write and rejects writes during logout',async()=>{
 const h=harness(),resume=h.pause();const saving=h.api.writeReaction('a','p','beast');
 assert.equal(h.activity.active,1);
 assert.throws(()=>h.activity.beginSignOut(),/current upload or deletion/);
 resume();await saving;assert.equal(h.activity.active,0);
 const release=h.activity.beginSignOut();
 const before=h.queries.length;await assert.rejects(h.api.writeReaction('a','p',null),/Sign out is in progress/);
 assert.equal(h.queries.length,before);release();
});

test('Build 14 legacy IDs survive single and batched reads and replacement/cancellation',async()=>{
 const h=harness();
 for(const type of ['pain_zone','no_tomorrow','wagmi','built_different']){
  await h.api.writeReaction('a','p',type);
  assert.equal(await h.api.readReaction('a','p'),type);
  assert.equal((await h.api.readPageReactions('a',['p'])).get('p'),type);
  await h.api.writeReaction('a','p','slay');
  assert.equal(await h.api.readReaction('a','p'),'slay');
  await h.api.writeReaction('a','p',null);
  assert.equal(await h.api.readReaction('a','p'),null);
 }
});
