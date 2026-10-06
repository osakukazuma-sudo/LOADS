const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
// Execute component callbacks with deterministic hook state; device rendering is a manual check.
function harness(file,{kind='following'}={}){
 const slots=[];let index=0,focus,following=false;const routes=[],writes=[],searches=[],lists=[];
 const person={id:B,username:'athlete_b',display_name:'Athlete B'};
 const react={useState:initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef:initial=>{const i=index++;return slots[i]??(slots[i]={current:initial});},useCallback:f=>f,useEffect:()=>{}};
 const router={push:v=>routes.push(v),replace:v=>routes.push(v),canGoBack:()=>false};
 const mocks={react,'react/jsx-runtime':require('react/jsx-runtime'),
 'react-native':{Text:'Text',View:'View',Pressable:'Pressable',TextInput:'TextInput',ScrollView:'ScrollView',StyleSheet:{create:v=>v}},
 'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
 'expo-router':{useRouter:()=>router,useFocusEffect:f=>{focus=f;},useLocalSearchParams:()=>({id:B,kind,ownerId:B})},
 '../hooks/use-account-owner':{useAccountOwner:()=>A},
 '../lib/follows':{
  findAthlete:async(owner,value)=>{searches.push([owner,value]);return person;},
  athleteWithFollow:async()=>({profile:person,following}),
  setFollowing:async(owner,target,value)=>{writes.push([owner,target,value]);following=value;},
  myFollowCounts:async()=>({followers:2,following:1}),
  myConnections:async(owner,direction)=>{lists.push([owner,direction]);return {people:[person],next:null};},
 }};
 const load=path=>{const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(n=>mocks[n],m,m.exports);return m.exports;};
 const layout=load('src/components/social-layout.tsx');mocks['../components/social-layout']=layout;mocks['./social-layout']=layout;
 const mod=load(file),root=mod.default??mod.MyConnections;
 return {routes,writes,searches,lists,focus:()=>focus(),render:()=>{index=0;const tree=root();return typeof tree.type==='function'&&tree.type!==layout.SocialLayout?tree.type(tree.props):tree;},rowType:layout.AthleteRow};
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];}
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(Array.isArray(tree))return tree.map(text).join('');if(typeof tree!=='object')return String(tree);return text(tree.props?.children);}
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Pressable'&&text(n)===label);
test('search result opens the matching athlete profile without a discovery listing',async()=>{
 const h=harness('src/app/people.tsx');let tree=h.render();assert.equal(nodes(tree).some(n=>n.type===h.rowType),false);
 nodes(tree).find(n=>n.type==='TextInput').props.onChangeText('athlete_b');tree=h.render();await button(tree,'SEARCH').props.onPress();tree=h.render();
 const row=nodes(tree).find(n=>n.type===h.rowType);row.type(row.props).props.onPress();
 assert.deepEqual(h.searches,[[A,'athlete_b']]);assert.deepEqual(h.routes,[{pathname:'/athlete',params:{id:B}}]);
});
test('Follow and Unfollow update the loaded profile button and remain free of counts/list links',async()=>{
 const h=harness('src/app/athlete.tsx');h.render();const cleanup=h.focus();await flush();
 let tree=h.render();await button(tree,'FOLLOW').props.onPress();tree=h.render();assert.ok(button(tree,'FOLLOWING · UNFOLLOW'));
 await button(tree,'FOLLOWING · UNFOLLOW').props.onPress();tree=h.render();assert.ok(button(tree,'FOLLOW'));
 assert.deepEqual(h.writes,[[A,B,true],[A,B,false]]);assert.equal(/Followers|YOUR CONNECTIONS/.test(text(tree)),false);cleanup();
});
test('own profile opens each own list and list screens ignore another owner supplied in params',async()=>{
 const h=harness('src/components/my-connections.tsx');h.render();const cleanup=h.focus();await flush();const tree=h.render();
 button(tree,'2 Followers').props.onPress();button(tree,'1 Following').props.onPress();
 assert.deepEqual(h.routes,[{pathname:'/connections',params:{kind:'followers'}},{pathname:'/connections',params:{kind:'following'}}]);cleanup();
 for(const kind of ['followers','following']){const list=harness('src/app/connections.tsx',{kind});list.render();const off=list.focus();await flush();assert.deepEqual(list.lists,[[A,kind]]);assert.ok(nodes(list.render()).some(n=>n.type===list.rowType));off();}
});
