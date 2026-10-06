const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(file,mocks={}) {const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(n=>mocks[n],m,m.exports);return m.exports;}
const worker=load('supabase/functions/_shared/account-cleanup.ts');
function harness(phase){const moves=[];let photoError=false,authExists=true,removeCount=0,deleteCount=0,throwDelete=false,paths=[];
 const admin={rpc:async(name,args)=>{
  if(name==='claim_account_deletion')return {data:{user_id:'a',lease_id:'lease',phase}};
  if(name==='account_photo_paths')return photoError?{error:Error('storage offline')}:{data:paths.map(path=>({path}))};
  if(name==='advance_account_deletion'){moves.push(args);return {};}
  throw Error(name);
 },storage:{from:()=>({remove:async()=>{removeCount++;return {};}})},auth:{admin:{getUserById:async()=>authExists?{data:{user:{id:'a'}},error:null}:{data:{user:null},error:{code:'user_not_found'}},deleteUser:async()=>{deleteCount++;authExists=false;if(throwDelete)throw Error('response lost');return {};}}}};
 return {admin,moves,failPhotos:()=>{photoError=true;},latePhoto:()=>{paths=['a/late.jpg'];},lostAuth:()=>{throwDelete=true;},absent:()=>{authExists=false;},deletes:()=>deleteCount,removes:()=>removeCount};}
test('pre-cleanup failure fails without deleting Auth',async()=>{const h=harness('photos');h.failPhotos();await worker.processAccountDeletion(h.admin);assert.equal(h.moves[0].next_phase,'failed');assert.equal(h.deletes(),0);});
test('lost Auth response stays processing and absence proceeds only to final cleanup',async()=>{const h=harness('verify_auth');h.lostAuth();await worker.processAccountDeletion(h.admin);assert.equal(h.moves[0].next_phase,'verify_auth');const next=harness('verify_auth');next.absent();await worker.processAccountDeletion(next.admin);assert.equal(next.moves[0].next_phase,'final_storage_cleanup');});
test('final Storage failures and residual files never mark failed or completed',async()=>{const h=harness('final_storage_cleanup');h.failPhotos();await worker.processAccountDeletion(h.admin);assert.equal(h.moves[0].next_phase,'final_storage_cleanup');const late=harness('final_storage_cleanup');late.latePhoto();await worker.processAccountDeletion(late.admin);assert.equal(late.removes(),1);assert.equal(late.moves[0].next_phase,'final_storage_cleanup');});
test('empty final scan requests DB-guarded completion',async()=>{const h=harness('final_storage_cleanup');await worker.processAccountDeletion(h.admin);assert.equal(h.moves[0].next_phase,'completed');});
test('pending/removed account blocks late local writes without blocking another owner',async()=>{
 const guards=load('src/lib/accountLocalWrites.ts',{'@react-native-async-storage/async-storage':{getItem:async()=>JSON.stringify({userId:'a',submitted:true})}});
 await assert.rejects(guards.assertAccountLocalWritable('a'),/pending/);
 await guards.assertAccountLocalWritable('b');
 guards.preventDeletedAccountWrites('b');await assert.rejects(guards.assertAccountLocalWritable('b'),/removed/);
});
test('local cleanup is repeatable and preserves other owners and unassigned records',async()=>{
 const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
 const disk=new Map([[`@loads/local/v1/${A}/workouts`,'a'],[`@loads/cloud-posts/v1/${A}/p`,'photo'],[`@loads/local/v1/${B}/workouts`,'b'],['@loads/workouts','legacy']]);let fail=true;
 const api=load('src/lib/accountDeletionLocalData.ts',{'./accountLocalWrites':{preventDeletedAccountWrites:()=>{}},'@react-native-async-storage/async-storage':{getAllKeys:async()=>[...disk.keys()],getItem:async k=>disk.get(k)??null,multiRemove:async keys=>keys.forEach(k=>disk.delete(k))},'./postPhotoFiles':{deleteAccountPhotos:async()=>{if(fail)throw Error('disk unavailable');}},'./userLocalData':{userDataKey:()=>{},serializeLocal:async f=>f()}});
 await assert.rejects(api.clearDeletedAccountData(A));assert.ok(disk.has(`@loads/cloud-posts/v1/${A}/p`));fail=false;
 await api.clearDeletedAccountData(A);await api.clearDeletedAccountData(A);
 assert.equal(disk.get(`@loads/local/v1/${B}/workouts`),'b');assert.equal(disk.get('@loads/workouts'),'legacy');assert.equal(disk.size,2);
});
