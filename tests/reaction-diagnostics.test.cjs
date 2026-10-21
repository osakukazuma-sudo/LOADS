const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {diagnose}=require('../scripts/diagnose-workout-reactions.cjs');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('src/lib/workoutReactions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports);
const {reactionFailure,reactionFailureMessage,reportReactionFailure,createReactionController}=m.exports;
test('diagnostic probes only GET limit=0 and never emits keys, response bodies or sessions',async()=>{
 const key='sb_publishable_do_not_log',calls=[];
 const result=await diagnose({baseUrl:'https://example.supabase.co',key,linkedRef:'example',fetcher:async(url,options)=>{
  calls.push([url,options]);assert.equal(options.method,'GET');assert.equal(url.searchParams.get('limit'),'0');assert.ok(!url.pathname.includes('rpc'));
  return Response.json({code:url.pathname.endsWith('workout_reactions')?'PGRST205':'42501',message:'private error content',token:'private-session'},{status:404});
 }});
 assert.equal(result.environment.linkedProjectMatches,true);assert.equal(result.probes.length,5);
 assert.equal(result.probes[2].code,'PGRST205');
 const output=JSON.stringify(result);for(const secret of [key,'private error content','private-session'])assert.equal(output.includes(secret),false);
 await assert.rejects(diagnose({baseUrl:'https://example.supabase.co',key:'sb_secret_forbidden',fetcher:()=>{throw Error('must not run');}}),/public application key/);
});
test('safe failure logging keeps only code, phase and public host, without raw error data',()=>{
 const lines=[],original=console.warn;console.warn=(...args)=>lines.push(args.join(' '));
 try {reportReactionFailure('read_page',{code:'PGRST205',message:'Bearer do-not-print',details:'private-row',hint:'private-key',user_id:'private-user'});}finally{console.warn=original;}
 const line=lines.join('');assert.match(line,/PGRST205/);assert.match(line,/read_page/);
 for(const secret of ['do-not-print','private-row','private-key','private-user'])assert.equal(line.includes(secret),false);
 assert.equal(reactionFailure({code:'invalid-secret-code'}).code,null);
 for(const code of ['PGRST205','42P01','42703','PGRST204'])assert.match(reactionFailureMessage(reactionFailure({code})),/Server setup needs/);
 assert.match(reactionFailureMessage(reactionFailure({code:'42501'})),/access was denied/);
});
test('missing backend keeps controls disabled until explicit successful refresh; mutation recovery reconciles the server',async()=>{
 let missing=true,writes=0,saved=null;
 const read=async()=>{if(missing)throw{code:'PGRST205'};return saved;};
 const c=createReactionController(read,async value=>{writes++;saved=value;throw{code:'42501'};},()=>{},undefined,reactionFailure({code:'PGRST205'}));
 await c.refresh();assert.equal(c.state.ready,false);assert.equal(c.state.failure.category,'setup');await c.select('beast');assert.equal(writes,0);
 missing=false;await c.refresh();assert.equal(c.state.ready,true);assert.equal(c.state.failure,undefined);
 await c.select('beast');assert.equal(c.state.value,'beast');assert.equal(c.state.ready,true);assert.equal(c.state.failure.category,'permission');
});
