const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){const slots=[],reads=[];let index=0,focus,cleanup,follow,app;
 const react={useState:initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef:initial=>{const i=index++;return slots[i]??(slots[i]={current:initial});},useCallback:fn=>fn};
 const mocks={react,'expo-router':{useFocusEffect:fn=>focus=fn},'react-native':{AppState:{addEventListener:(_n,fn)=>{app=fn;return{remove:()=>app=null};}}},
 '../lib/cloudPosts':{getVisiblePost:()=>reads.shift()()},'../lib/follows':{subscribeFollowChanges:fn=>{follow=fn;return()=>follow=null;}}};
 const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/hooks/use-visible-post.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>mocks[n],m,m.exports);
 return {reads,render:()=>{index=0;return m.exports.useVisiblePost('A','post');},focus:()=>cleanup=focus(),blur:()=>cleanup(),follow:()=>follow('A'),app:v=>app(v)};
}
test('post detail clears stale content and rechecks access on focus, follow changes, foreground and retry',async()=>{
 const h=harness();h.reads.push(async()=>({id:'post'}));h.render();h.focus();await flush();assert.equal(h.render().post.id,'post');
 let stale;h.reads.push(()=>new Promise(resolve=>stale=resolve));void h.render().refresh();assert.equal(h.render().post,null);
 h.reads.push(async()=>null);h.follow();await flush();stale({id:'old'});await flush();assert.equal(h.render().post,null);assert.equal(h.render().loading,false);
 h.app('background');assert.equal(h.render().post,null);
 h.reads.push(async()=>{throw Error('offline');});h.app('active');await flush();assert.match(h.render().error,/Could not load/);
 h.reads.push(async()=>({id:'allowed'}));await h.render().refresh();assert.equal(h.render().post.id,'allowed');
 let late;h.reads.push(()=>new Promise(resolve=>late=resolve));void h.render().refresh();h.blur();late({id:'leak'});await flush();assert.equal(h.render().post,null);
});
