const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function harness(){let now=0;const disk=new Map();const events=[];let lost=false,storageFailure=false,status='processing',cleanFailure=false;
 const user={id:'11111111-1111-4111-8111-111111111111',email:'a@example.test'};
 const storage={getItem:async k=>disk.get(k)??null,setItem:async(k,v)=>{if(storageFailure)throw Error('disk full');disk.set(k,v);events.push('saved');},removeItem:async k=>disk.delete(k)};
 const client={auth:{getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{user}}}),signOut:async()=>{events.push('signout');return {};}},functions:{invoke:async(_name,{body})=>{events.push(body.action);if(body.action==='prepare')return {data:{receipt:'a'.repeat(64)}};assert.equal(JSON.parse(disk.get('@loads/account-deletion/v1')).submitted,true);if(lost)throw Error('response lost');return {data:{accepted:true}};}}};
 const mocks={'@react-native-async-storage/async-storage':storage,'@supabase/supabase-js':{},'./supabase':{supabase:client},'./accountActivity':{beginSignOut:()=>()=>events.push('released')},'./userLocalData':{flushLocalWrites:async()=>{}},'./accountDeletionLocalData':{clearDeletedAccountData:async()=>{if(cleanFailure)throw Error('cleanup failed');events.push('cleaned');}}};
 const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/lib/accountDeletion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports','fetch','Date',code)(n=>mocks[n],m,m.exports,async()=>{events.push('fetch');return status==='network'?Promise.reject(Error('offline')):status==='limited'?new Response('',{status:429,headers:{'Retry-After':'45'}}):status==='expired'?new Response('',{status:404}):Response.json({status,completed_at:null,failure_code:null});},{now:()=>now});
 return {advance:ms=>{now+=ms;},api:m.exports,disk,events,lose:()=>{lost=true;},failDisk:()=>{storageFailure=true;},status:v=>{status=v;},failCleanup:()=>{cleanFailure=true;}};
}
test('receipt is persisted before request; lost response keeps recovery and never clears data',async()=>{const h=harness();h.lose();await assert.rejects(h.api.requestAccountDeletion('not-stored'));const record=await h.api.readDeletionReceipt();assert.equal(record.submitted,true);assert.equal(JSON.stringify([...h.disk]).includes('not-stored'),false);assert.equal(h.events.includes('cleaned'),false);assert.ok(h.events.indexOf('saved')<h.events.indexOf('request'));});
test('receipt storage failure prevents destructive request',async()=>{const h=harness();h.failDisk();await assert.rejects(h.api.requestAccountDeletion('password'));assert.equal(h.events.includes('request'),false);});
test('status/network/expiry never implicitly clean local data; failed cleanup retains receipt',async()=>{const h=harness();await h.api.requestAccountDeletion('password');const r=await h.api.readDeletionReceipt();h.status('network');await assert.rejects(h.api.checkAccountDeletion(r));h.advance(5000);h.status('expired');assert.equal(await h.api.checkAccountDeletion(r),null);assert.equal(h.events.includes('cleaned'),false);h.failCleanup();await assert.rejects(h.api.finishLocalAccountDeletion(r));assert.ok(await h.api.readDeletionReceipt());});

test('status checks back off 5/10/20/30 seconds and respect Retry-After',async()=>{const h=harness();const r={receipt:'a'.repeat(64)};for(const seconds of [5,10,20,30,30]){await h.api.checkAccountDeletion(r);const count=h.events.length;await assert.rejects(h.api.checkAccountDeletion(r),/Check again/);assert.equal(h.events.length,count);h.advance(seconds*1000);}h.status('limited');await assert.rejects(h.api.checkAccountDeletion(r),/Too many/);h.advance(30000);await assert.rejects(h.api.checkAccountDeletion(r),/15 seconds/);h.advance(15000);h.status('completed');assert.equal((await h.api.checkAccountDeletion(r)).status,'completed');});

test('countdown uses deadline and clears receipt-scoped memory after local cleanup',async()=>{
 const h=harness();await h.api.requestAccountDeletion('password');const r=await h.api.readDeletionReceipt();
 await h.api.checkAccountDeletion(r);assert.equal(h.api.deletionStatusWaitSeconds(r),5);
 h.advance(1100);assert.equal(h.api.deletionStatusWaitSeconds(r),4);
 h.advance(60000);assert.equal(h.api.deletionStatusWaitSeconds(r),0);
 h.status('completed');await h.api.checkAccountDeletion(r);assert.equal(h.api.deletionStatusWaitSeconds(r),5);
 await h.api.finishLocalAccountDeletion(r);assert.equal(await h.api.readDeletionReceipt(),null);
 assert.equal(h.api.deletionStatusWaitSeconds(r),0);
});
