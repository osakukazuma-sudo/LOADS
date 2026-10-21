const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const text=tree=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
function render(workout,history=[]){
 let index=0;const state=[[],workout,history,null,'',false,false];
 const mocks={react:{useState:initial=>[index<state.length?state[index++]:(index++,typeof initial==='function'?initial():initial),()=>{}],useRef:initial=>({current:initial}),useMemo:fn=>fn(),useCallback:fn=>fn,useEffect:()=>{}},
 'react/jsx-runtime':require('react/jsx-runtime'),'react-native':{...Object.fromEntries(['View','Text','Pressable','ScrollView','SafeAreaView','TextInput','Image'].map(n=>[n,n])),StyleSheet:{create:s=>s}},
 'expo-router':{useLocalSearchParams:()=>({workout:JSON.stringify(workout)}),useRouter:()=>({}),useFocusEffect:()=>{}},'expo-image-picker':{},
 '../hooks/use-account-owner':{useAccountOwner:()=> 'owner'},'../lib/cloudPosts':{},'../lib/workoutStorage':{},
 '../components/training-partner-picker':{TrainingPartnerPicker:'TrainingPartnerPicker'},'../components/cardio-summary-card':{CardioSummaryCard:'CardioSummaryCard'}};
 function load(file){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>mocks[n]??load(path.resolve(path.dirname(file),n+'.ts')),m,m.exports);return m.exports;}
 const page=load('src/app/post.tsx').default();return text(page.type(page.props));
}
const workout=prVersion=>({id:'w',prVersion,startedAt:'2026-10-15T00:00:00Z',finishedAt:'2026-10-15T01:00:00Z',durationSeconds:60,exercises:[{id:1,name:'BENCH PRESS',focus:'VOLUME',note:'',sets:[{id:2,weight:'80',reps:'8',completed:true}]}]});
test('POST WORKOUT hides first-record text while preserving snapshot state and existing PR badges',()=>{
 const first=workout(2),before=JSON.stringify(first),html=render(first);
 assert.match(html,/BENCH PRESS/);assert.doesNotMatch(html,/FIRST RECORD|WEIGHT PR|REP PR|VOLUME PR/);assert.equal(JSON.stringify(first),before);
 const legacy=render(workout(1));for(const badge of ['WEIGHT PR','REP PR','VOLUME PR'])assert.match(legacy,new RegExp(badge));assert.doesNotMatch(legacy,/FIRST RECORD/);
});
