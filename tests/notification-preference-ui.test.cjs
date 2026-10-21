const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){const slots=[];let index=0,effect,cleanup,fail=false;const calls=[];
 const react={useState:initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef:initial=>{const i=index++;return slots[i]??(slots[i]={current:initial});},useEffect:fn=>effect=fn};
 const mocks={react,'react/jsx-runtime':require('react/jsx-runtime'),'react-native':{View:'View',Text:'Text',Pressable:'Pressable',Switch:'Switch'},'./social-layout':{socialStyles:{}},
 '../lib/notifications':{workoutNotificationsEnabled:async()=>true,setWorkoutNotifications:async()=>calls.push('workout-write')},
 '../lib/reactionNotifications':{reactionNotificationsEnabled:async()=>false,setReactionNotifications:async(owner,value)=>{calls.push(['reaction',owner,value]);if(fail)throw Error('offline');}},
 '../lib/registerPush':{registerPush:async(owner,explicit)=>calls.push(['permission',owner,explicit])}};
 const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/components/notification-preference-control.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>mocks[n],m,m.exports);
 return {calls,render:()=>{index=0;return m.exports.NotificationPreferenceControl({owner:'A',kind:'reaction'});},mount:()=>cleanup=effect(),unmount:()=>cleanup(),fail:()=>fail=true};
}
function nodes(tree){return !tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];}
test('reaction notification toggle loads independently, requests permission only on enable and rejects double tap',async()=>{
 const h=harness();let tree=h.render();assert.equal(nodes(tree).find(n=>n.type==='Switch').props.disabled,true);
 h.mount();await flush();tree=h.render();let control=nodes(tree).find(n=>n.type==='Switch');assert.equal(control.props.value,false);
 control.props.onValueChange(true);control.props.onValueChange(true);await flush();tree=h.render();
 assert.equal(nodes(tree).find(n=>n.type==='Switch').props.value,true);
 assert.deepEqual(h.calls,[['permission','A',true],['reaction','A',true]]);
 nodes(tree).find(n=>n.type==='Switch').props.onValueChange(false);await flush();assert.deepEqual(h.calls.at(-1),['reaction','A',false]);
 assert.equal(h.calls.filter(c=>c[0]==='permission').length,1);h.unmount();
});
test('failed preference save retains the previous value and exposes retry',async()=>{
 const h=harness();h.render();h.mount();await flush();h.fail();
 nodes(h.render()).find(n=>n.type==='Switch').props.onValueChange(true);await flush();
 const tree=h.render();assert.equal(nodes(tree).find(n=>n.type==='Switch').props.value,false);
 assert.ok(nodes(tree).some(n=>n.props?.accessibilityRole==='alert'));assert.ok(nodes(tree).some(n=>n.type==='Pressable'));
 h.unmount();
});
