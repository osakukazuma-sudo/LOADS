const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function harness({unauthorized=false,wrongPassword=false,statusOnly=false,rateLimited=false}={}) {
 const calls=[];
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:rateLimited?{retry_after:5}:statusOnly?{status:'failed',completed_at:null,failure_code:'PHOTO_CLEANUP_FAILED'}:null};},auth:{admin:{signOut:async()=>({})}}};
 const runtime={adminClient:()=>admin,authenticatedUser:async()=>{if(unauthorized)throw Error('UNAUTHORIZED');return {user:{id:'owner',email:'owner@example.test'},token:'jwt'};},headers:{},json:(b,s=200)=>Response.json(b,{status:s})};
 const verifier={auth:{signInWithPassword:async()=>({data:{user:{id:wrongPassword?'other':'owner'},session:{}},error:null}),signOut:async()=>({})}};
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(`supabase/functions/${statusOnly?'account-deletion-status':'delete-account'}/index.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','Deno',code)(name=>name.includes('runtime')?runtime:name.includes('account-receipt')?{receiptHash:async()=> 'hashed-only'}:{createClient:()=>verifier},m,m.exports,{serve:()=>{},env:{get:()=> 'unused'}});
 return {calls,handle:statusOnly?m.exports.handleAccountStatus:m.exports.handleAccountDeletion};
}
const req=body=>new Request('https://example.test',{method:'POST',body:JSON.stringify(body)});
test('receipt-only status invokes no mutation even for failed jobs',async()=>{const h=harness({statusOnly:true});const r=await h.handle(req({receipt:'a'.repeat(64),action:'retry'}));assert.equal(r.status,200);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'account_deletion_status');assert.equal(h.calls[0].args.receipt_hash,'hashed-only');assert.deepEqual(Object.keys(await r.json()).sort(),['completed_at','failure_code','status']);});
test('account request rejects missing Auth and wrong identity before accepting',async()=>{for(const opts of [{unauthorized:true},{wrongPassword:true}]){const h=harness(opts);const r=await h.handle(req({action:'request',password:'test',receipt:'a'.repeat(64),userId:'victim'}));assert.equal(r.status,401);assert.equal(h.calls.length,0);}});
test('account request derives actor from verified Auth and hashes receipt',async()=>{const h=harness();const r=await h.handle(req({action:'request',password:'test',receipt:'a'.repeat(64),userId:'victim'}));assert.equal(r.status,200);assert.deepEqual(h.calls,[{name:'accept_account_deletion',args:{actor:'owner',receipt_hash:'hashed-only'}}]);});

test('status rate limit returns 429 and browser-readable Retry-After',async()=>{const h=harness({statusOnly:true,rateLimited:true});const r=await h.handle(req({receipt:'a'.repeat(64)}));assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'5');assert.equal(r.headers.get('Access-Control-Expose-Headers'),'Retry-After');assert.deepEqual(await r.json(),{error:'RATE_LIMITED'});assert.deepEqual(h.calls.map(c=>c.name),['account_deletion_status']);});
