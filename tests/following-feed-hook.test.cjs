const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const slots=[];let index=0,focus,cleanup,listener;let owner='A';const pages=[];
 const react={useState:initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef:initial=>{const i=index++;return slots[i]??(slots[i]={current:initial});},useCallback:fn=>fn};
 const mocks={react,'expo-router':{useFocusEffect:fn=>{focus=fn;}},'../lib/follows':{subscribeFollowChanges:fn=>{listener=fn;return()=>{listener=null;};}},'../lib/cloudPosts':{
 currentUserId:async()=>owner,getPendingPosts:async()=>[],getFeedPage:()=>pages.shift()(),publishLocalPost:async()=>{}
 },'../lib/postValidation':{postErrorMessage:e=>e.message},'../lib/supabase':{supabase:{auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}}};
 const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/hooks/use-cloud-feed.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','setInterval','clearInterval',code)(n=>mocks[n],m,m.exports,()=>0,()=>{});
 return {pages,render:()=>{index=0;return m.exports.useCloudFeed();},focus:()=>{cleanup=focus();},blur:()=>cleanup(),change:id=>listener?.(id),owner:id=>owner=id};
}
test('late Unfollow notification clears HOME, ignores obsolete response, and never restores old posts on failure',async()=>{
 const h=harness();const old={id:'B-post'};const own={id:'A-post'};
 h.pages.push(async()=>({posts:[own,old],nextCursor:null,invalidCount:0}));h.render();h.focus();await flush();assert.equal(h.render().posts.length,2);
 let resolveOld;h.pages.push(()=>new Promise(resolve=>{resolveOld=resolve;}));void h.render().refresh();await flush();assert.deepEqual(h.render().posts,[]);
 h.pages.push(async()=>({posts:[own],nextCursor:null,invalidCount:0}));h.change('A');await flush();assert.deepEqual(h.render().posts,[own]);
 resolveOld({posts:[old],nextCursor:null,invalidCount:0});await flush();assert.deepEqual(h.render().posts,[own]);
 h.pages.push(async()=>{throw Error('offline');});h.change('A');await flush();assert.deepEqual(h.render().posts,[]);assert.equal(h.render().error,'offline');
 h.blur();
});

test('leaving HOME invalidates an in-flight page and refocus replaces the old feed',async()=>{
 const h=harness();let resolveOld;
 h.pages.push(()=>new Promise(resolve=>{resolveOld=resolve;}));h.render();h.focus();await flush();h.blur();
 resolveOld({posts:[{id:'old'}],nextCursor:null,invalidCount:0});await flush();assert.deepEqual(h.render().posts,[]);
 h.pages.push(async()=>({posts:[{id:'own'}],nextCursor:null,invalidCount:0}));h.render();h.focus();await flush();assert.deepEqual(h.render().posts,[{id:'own'}]);h.blur();
});

test('RETRY FEED clears a failed request and restores own, followed and tagged posts',async()=>{
 const h=harness();
 h.pages.push(async()=>{throw Error('PGRST201');});h.render();h.focus();await flush();
 assert.equal(h.render().error,'PGRST201');assert.equal(h.render().loading,false);
 const posts=[{id:'own'},{id:'followed'},{id:'tagged'}];
 h.pages.push(async()=>({posts,nextCursor:null,invalidCount:0}));await h.render().refresh();
 assert.deepEqual(h.render().posts,posts);assert.equal(h.render().error,null);assert.equal(h.render().loading,false);h.blur();
});
