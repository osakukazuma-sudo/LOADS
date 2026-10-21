const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const A='11111111-1111-4111-8111-111111111111';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const text=tree=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Pressable'&&text(n)===label);
function harness(extra={}){
 const slots=[],effects=[],disk=new Map(),saved=[];let index=0,cancelled=0,failWrite=false,failAdd=false,active=0;
 const storage={getItem:async k=>disk.get(k)??null,setItem:async(k,v)=>{if(failWrite)throw Error('disk full');disk.set(k,v);}};
 const react={useState:initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef:initial=>{const i=index++;return slots[i]??(slots[i]={current:initial});},useEffect:fn=>effects.push(fn)};
 const mocks={react,'react/jsx-runtime':require('react/jsx-runtime'),'react-native':{View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',TextInput:'TextInput',StyleSheet:{create:s=>s}},'expo-crypto':{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},'@react-native-async-storage/async-storage':storage};
 const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports);
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>mocks[n]??(n.endsWith('accountActivity')?{beginAccountOperation:()=>{active++;return()=>active--;}}:load(path.resolve(path.dirname(file),n+'.ts'))),m,m.exports);return m.exports;}
 const component=load('src/components/custom-exercise-form.tsx').CustomExerciseForm;
 const props={owner:A,category:'back',query:' my move ',onCancel:()=>cancelled++,onArchived:async()=>{},onSaved:async item=>{if(failAdd)throw Error('active save failed');saved.push(item);},...extra};
 return{disk,saved,render:()=>{index=0;return component(props);},cancelled:()=>cancelled,active:()=>active,failWrite:v=>failWrite=v,failAdd:v=>failAdd=v,library:()=>load('src/lib/customExercises.ts').getCustomExercises(A)};
}
test('form seeds name/group, preserves seven equipment choices and creates all four tracking types',async()=>{
 for(const tracking of ['WEIGHT + REPS','BODYWEIGHT','WEIGHTED','ASSISTED']){
  const h=harness();let tree=h.render();assert.equal(nodes(tree).find(n=>n.type==='TextInput').props.value,' my move ');
  assert.equal(nodes(tree).find(n=>n.props.accessibilityRole==='radio'&&text(n)==='BACK').props.accessibilityState.checked,true);
  for(const equipment of ['Barbell','Dumbbell','Smith Machine','Machine','Cable','Bodyweight','Other'])assert.ok(button(tree,equipment));
  button(tree,tracking).props.onPress();tree=h.render();const save=button(tree,'SAVE & ADD TO WORKOUT');save.props.onPress();save.props.onPress();await flush();
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].name,'MY MOVE');assert.equal((await h.library()).length,1);assert.equal(h.active(),0);
 }
 const h=harness();button(h.render(),'CANCEL').props.onPress();assert.equal(h.cancelled(),1);assert.deepEqual(await h.library(),[]);
});
test('validation and disk errors keep form open, and retry after active-save failure reuses one stable exercise',async()=>{
 const h=harness();let tree=h.render();nodes(tree).find(n=>n.type==='TextInput').props.onChangeText('   ');button(h.render(),'SAVE & ADD TO WORKOUT').props.onPress();await flush();assert.equal(h.saved.length,0);assert.match(text(h.render()),/exercise name/);
 nodes(h.render()).find(n=>n.type==='TextInput').props.onChangeText('new move');h.failWrite(true);button(h.render(),'SAVE & ADD TO WORKOUT').props.onPress();await flush();assert.match(text(h.render()),/disk full/);assert.equal(h.active(),0);
 h.failWrite(false);h.failAdd(true);button(h.render(),'SAVE & ADD TO WORKOUT').props.onPress();await flush();assert.match(text(h.render()),/active save failed/);assert.equal((await h.library()).length,1);
 h.failAdd(false);button(h.render(),'SAVE & ADD TO WORKOUT').props.onPress();await flush();assert.equal(h.saved.length,1);assert.equal((await h.library()).length,1);
});
