const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const mod={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('supabase/functions/_shared/push.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports);
const {processPushQueue,pushMessage}=mod.exports;
const delivery={id:'delivery',token:'ExpoPushToken[test]',kind:'workout',actorId:'actor',recipientId:'follower',postId:null,actorName:'KAZUMA'};
function admin(deliveries=[delivery],receipts=[]) {
 const calls=[];return {calls,rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='claim_push_deliveries'?deliveries:name==='pending_push_receipts'?receipts:null,error:null};}};
}
test('server Push payload has a clear message and safe authenticated navigation data for workout and partner',()=>{
 assert.equal(pushMessage(delivery).body,'KAZUMA finished a workout.');
 assert.equal(pushMessage({...delivery,kind:'partner',postId:'post'}).body,'KAZUMA tagged you as a training partner.');
 assert.equal(pushMessage(delivery).data.recipientId,'follower');assert.equal(pushMessage(delivery).data.url,undefined);
});
test('successful Expo tickets are persisted once; token failures disable only that device',async()=>{
 const client=admin([delivery,{...delivery,id:'bad'}]);let count=0;
 await processPushQueue(client,async(url,opts)=>{count++;assert.ok(url.endsWith('/send'));assert.equal(opts.headers.Authorization,'Bearer secret');assert.equal(JSON.parse(opts.body).length,2);return Response.json({data:[{status:'ok',id:'ticket'},{status:'error',details:{error:'DeviceNotRegistered'}}]});},'secret');
 assert.equal(count,1);
 assert.deepEqual(client.calls.filter(c=>c[0]==='finish_push_delivery').map(c=>c[1]),[
 {p_id:'delivery',p_state:'accepted',p_ticket:'ticket',p_disable:false},{p_id:'bad',p_state:'failed',p_ticket:null,p_disable:true}]);
});
test('network loss and malformed Expo responses become uncertain, with no blind retry or workout write',async()=>{
 for(const fetcher of [async()=>{throw Error('offline');},async()=>new Response('',{status:503}),async()=>Response.json({data:[]})]) {
  const client=admin();await processPushQueue(client,fetcher);
  const result=client.calls.find(c=>c[0]==='finish_push_delivery')[1];assert.equal(result.p_state,'uncertain');
  assert.equal(client.calls.some(c=>/workout|post/.test(c[0])),false);
 }
});
test('receipts confirm delivery and invalidate unregistered devices; receipt lookup failure is safely deferred',async()=>{
 const waiting=[{id:'old',ticket:'ticket'}];
 const client=admin([],waiting);
 await processPushQueue(client,async()=>Response.json({data:{ticket:{status:'error',details:{error:'DeviceNotRegistered'}}}}));
 assert.deepEqual(client.calls.find(c=>c[0]==='finish_push_delivery')[1],{p_id:'old',p_state:'failed',p_disable:true});
 const lost=admin([],waiting);await processPushQueue(lost,async()=>{throw Error('offline');});assert.equal(lost.calls.some(c=>c[0]==='finish_push_delivery'),false);
});
test('empty queue never contacts Expo; worker RPC failure never reaches the push service',async()=>{
 const client=admin([]);await processPushQueue(client,()=>{throw Error('unexpected fetch');});
 await assert.rejects(processPushQueue({rpc:async()=>({error:Error('DB'),data:null})},()=>{throw Error('unexpected fetch');}),/DB/);
});
