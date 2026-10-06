const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function harness(verified=true,failure=false) {
 let handler,sends=0;const admin={rpc:async(_name,args)=>({data:args.candidate==='worker-secret'&&verified,error:null})};
 const mocks={runtime:{adminClient:()=>admin,json:(body,status=200)=>Response.json(body,{status})},push:{processPushQueue:async()=>{sends++;if(failure)throw Error('private details');return{attempted:1};}}};
 const mod={exports:{}};
 new Function('require','module','exports','Deno',ts.transpileModule(fs.readFileSync('supabase/functions/push-worker/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>name.includes('runtime')?mocks.runtime:mocks.push,mod,mod.exports,{serve:fn=>handler=fn,env:{get:()=>undefined}});
 return {send:headers=>handler(new Request('https://example.test',{method:'POST',headers})),handler,sends:()=>sends};
}
test('push worker rejects missing/forged credentials before any send and only accepts POST',async()=>{
 const h=harness();for(const headers of [{},{'x-cleanup-secret':'wrong'}])assert.equal((await h.send(headers)).status,401);
 assert.equal((await h.handler(new Request('https://example.test'))).status,405);assert.equal(h.sends(),0);
 assert.equal((await h.send({'x-cleanup-secret':'worker-secret'})).status,200);assert.equal(h.sends(),1);
});
test('worker failures stay independent of FINISH and sanitize server details',async()=>{
 const h=harness(true,true),response=await h.send({'x-cleanup-secret':'worker-secret'});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'PUSH_PROCESSING_FAILED'});
});
