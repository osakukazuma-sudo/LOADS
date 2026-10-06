const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function harness(){
 let owner='A';const calls=[];const replies=[];let released=0;
 const client={rpc:async(...args)=>{calls.push(['rpc',...args]);return replies.shift();},from:table=>{
  const chain={};calls.push(['from',table]);
  for(const method of ['select','eq','order','limit','gt','in','insert','delete'])chain[method]=(...args)=>{calls.push([method,...args]);return chain;};
  chain.then=(resolve,reject)=>Promise.resolve(replies.shift()).then(resolve,reject);
  chain.single=chain.maybeSingle=async()=>replies.shift();return chain;
 }};
 const mocks={'./supabase':{supabase:client},'./cloudPosts':{currentUserId:async()=>owner},'./accountActivity':{beginAccountOperation:()=>()=>released++}};
 const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/lib/follows.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name=>mocks[name],mod,mod.exports);
 return {api:mod.exports,calls,replies,owner:value=>owner=value,released:()=>released};
}
test('exact username lookup normalizes @ and never uses wildcard or unfiltered discovery',async()=>{
 const h=harness();h.replies.push({data:{id:'B',username:'bench_1',display_name:'B'}});
 assert.equal((await h.api.findAthlete('A',' @Bench_1 ')).id,'B');
 assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]==='username'&&c[2]==='bench_1'));
 const count=h.calls.length;for(const input of ['', '%', 'ab', 'bench*'])await assert.rejects(h.api.findAthlete('A',input));
 assert.equal(h.calls.length,count);
});
test('follow writes are owner scoped, self follow blocked, duplicates idempotent and changes notify HOME',async()=>{
 const h=harness();const events=[];const off=h.api.subscribeFollowChanges(id=>events.push(id));
 await assert.rejects(h.api.setFollowing('A','A',true));assert.equal(h.calls.length,0);
 h.replies.push({error:null},{error:{code:'23505'}},{error:null});
 await h.api.setFollowing('A','B',true);await h.api.setFollowing('A','B',true);await h.api.setFollowing('A','B',false);
 assert.deepEqual(events,['A','A','A']);assert.equal(h.released(),3);
 assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]==='follower_id'&&c[2]==='A'));
 assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]==='following_id'&&c[2]==='B'));
 off();h.owner('B');const count=h.calls.length;await assert.rejects(h.api.setFollowing('A','C',true),/account changed/);assert.equal(h.calls.length,count);
});
test('own counts have no target argument; followers/following pages filter the current owner with cursor',async()=>{
 const h=harness();h.replies.push({data:{followers:2,following:1}});assert.equal((await h.api.myFollowCounts('A')).followers,2);
 assert.deepEqual(h.calls[0],['rpc','my_follow_counts']);
 for(const kind of ['followers','following']){
  h.calls.length=0;h.replies.push({data:[{follower_id:kind==='following'?'A':'B',following_id:kind==='following'?'B':'A'}]}, {data:[{id:'B',username:'b',display_name:null}]});
  assert.equal((await h.api.myConnections('A',kind,'cursor')).people[0].id,'B');
  assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]===(kind==='following'?'follower_id':'following_id')&&c[2]==='A'));
  assert.ok(h.calls.some(c=>c[0]==='gt'&&c[2]==='cursor'));
 }
});
test('other profile fetch requests identity and own follow state only, never relationship counts or lists',async()=>{
 const h=harness();h.replies.push({data:{id:'B',username:'b',display_name:'B'}},{data:{following_id:'B'}});
 const r=await h.api.athleteWithFollow('A','B');assert.equal(r.following,true);
 assert.deepEqual(Object.keys(r).sort(),['following','profile']);
 assert.equal(h.calls.some(c=>c[0]==='rpc'),false);
 assert.deepEqual(h.calls.filter(c=>c[0]==='eq'),[['eq','id','B'],['eq','follower_id','A'],['eq','following_id','B']]);
});
