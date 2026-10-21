const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>mocks[n],m,m.exports);return m.exports;}
const {notificationDestination}=load('src/lib/notificationDestination.ts');
const post='11111111-1111-4111-8111-111111111111';
test('notification routing validates recipient and post ID and never accepts URLs or embedded post content',()=>{
 const data={kind:'reaction',postId:post,recipientId:'owner',url:'https://untrusted',caption:'fake'};
 assert.deepEqual(notificationDestination('owner',data),{pathname:'/workout-post',params:{id:post}});
 for(const invalid of [null,[],{...data,recipientId:'other'},{...data,postId:'../../post'},{...data,postId:'x'.repeat(36)},{...data,kind:'unknown'}])assert.equal(notificationDestination('owner',invalid),null);
 assert.equal(notificationDestination('',data),null);
 assert.equal(notificationDestination('owner',{kind:'partner',recipientId:'owner'}),'/tagged');
 assert.deepEqual(notificationDestination('owner',{kind:'workout',recipientId:'owner',actorId:post}),{pathname:'/athlete',params:{id:post}});
});
function harness(){
 const state={owner:'A',row:null,error:null,active:0,payloads:[]};
 const activity={beginAccountOperation:()=>{state.active++;return()=>state.active--;}};
 const supabase={auth:{getSession:async()=>({data:{session:state.owner?{user:{id:state.owner}}:null},error:null})},from:()=>{
 const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:state.row,error:state.error}),upsert:async payload=>{
 state.payloads.push(payload);if(!state.error)state.row={...state.row,...payload};return {error:state.error};}};return q;}};
 return {state,api:load('src/lib/reactionNotifications.ts',{'./supabase':{supabase},'./accountActivity':activity})};
}
test('reaction preference defaults OFF and updates independently from workout/partner settings',async()=>{
 const {api,state}=harness();assert.equal(await api.reactionNotificationsEnabled('A'),false);
 state.row={user_id:'A',workout_enabled:false,partner_enabled:true};
 await api.setReactionNotifications('A',true);assert.equal(await api.reactionNotificationsEnabled('A'),true);
 assert.equal(state.row.workout_enabled,false);assert.equal(state.row.partner_enabled,true);
 assert.deepEqual(state.payloads,[{user_id:'A',reaction_enabled:true}]);
 await api.setReactionNotifications('A',false);assert.equal(await api.reactionNotificationsEnabled('A'),false);assert.equal(state.active,0);
 state.error=Error('offline');await assert.rejects(api.setReactionNotifications('A',true),/offline/);assert.equal(state.active,0);assert.equal(state.row.reaction_enabled,false);
 state.error=null;state.owner='B';await assert.rejects(api.setReactionNotifications('A',true),/Account changed/);
 state.owner=null;await assert.rejects(api.reactionNotificationsEnabled('A'),/Account changed/);
});
