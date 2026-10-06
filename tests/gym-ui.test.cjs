const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function nodes(tree){return !tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];}
function text(tree){return tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);}
function harness(file, mocks={}) {
 const slots=[];let index=0;
 const react={useState:initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useRef:initial=>{const i=index++;return slots[i]??(slots[i]={current:initial});},useEffect:()=>{}};
 const native={StyleSheet:{create:s=>s},...Object.fromEntries(['View','Text','TextInput','Pressable','Modal','ScrollView'].map(n=>[n,n]))};
 const base={react,'react/jsx-runtime':require('react/jsx-runtime'),'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'./social-layout':{socialStyles:{}}};
 function load(file){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(spec=>mocks[spec]??base[spec]??load(path.resolve(path.dirname(file),spec+'.ts')),mod,mod.exports);return mod.exports;}
 const component=Object.values(load(file))[0];return{render:props=>{index=0;return component(props);}};
}
test('set options stay collapsed for normal input and reveal optional target/failure controls only when requested',()=>{
 const h=harness('src/components/set-options.tsx');let set={id:1,weight:'80',reps:'6',completed:true};const props=()=>({set,onChange:patch=>set={...set,...patch}});
 let tree=h.render(props());assert.equal(nodes(tree).some(n=>n.type==='TextInput'),false);assert.equal(text(tree).includes('FAILED'),false);
 nodes(tree).find(n=>n.type==='Pressable').props.onPress();tree=h.render(props());
 nodes(tree).find(n=>n.type==='TextInput').props.onChangeText('8');tree=h.render(props());assert.match(text(tree),/target 8 · FAILED/);assert.equal(set.targetReps,'8');
 nodes(tree).find(n=>n.props?.accessibilityRole==='checkbox').props.onPress();assert.equal(set.status,'failed');tree=h.render(props());
 nodes(tree).find(n=>n.type==='TextInput').props.onChangeText('');tree=h.render(props());assert.match(text(tree),/FAILED/);assert.equal(set.targetReps,undefined);
 nodes(tree).find(n=>n.props?.accessibilityRole==='checkbox').props.onPress();tree=h.render(props());assert.equal(set.status,undefined);assert.equal(text(tree).includes('✓ FAILED'),false);
});
test('training partner picker uses following, enforces three selections and keeps selected usernames visible',async()=>{
 const people=[1,2,3,4].map(i=>({id:String(i),username:`athlete_${i}`,display_name:null}));let selected=[],calls=[];
 const h=harness('src/components/training-partner-picker.tsx',{'../lib/follows':{myConnections:async(...args)=>{calls.push(args);return{people,next:null};}}});
 const props=()=>({owner:'owner',selected,onChange:value=>selected=value,disabled:false});
 let tree=h.render(props());nodes(tree).find(n=>n.type==='Pressable'&&text(n)==='TAG TRAINING PARTNER').props.onPress();await flush();tree=h.render(props());assert.deepEqual(calls[0],['owner','following',null]);
 for(let i=0;i<3;i++){nodes(tree).filter(n=>n.props?.accessibilityRole==='checkbox')[i].props.onPress();tree=h.render(props());}
 assert.equal(selected.length,3);assert.equal(nodes(tree).filter(n=>n.props?.accessibilityRole==='checkbox')[3].props.disabled,true);assert.match(text(tree),/with @athlete_1, @athlete_2, @athlete_3/);
 nodes(tree).filter(n=>n.props?.accessibilityRole==='checkbox')[0].props.onPress();tree=h.render(props());assert.equal(nodes(tree).filter(n=>n.props?.accessibilityRole==='checkbox')[3].props.disabled,false);
 nodes(tree).filter(n=>n.props?.accessibilityRole==='checkbox')[3].props.onPress();assert.deepEqual(selected.map(p=>p.id),['2','3','4']);
});
