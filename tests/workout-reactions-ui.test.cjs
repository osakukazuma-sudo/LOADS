const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,react=React,api){const mod={exports:{}};const mocks={react,'@/global.css':{},'react/jsx-runtime':require('react/jsx-runtime'),
 'react-native':{Platform:{select:v=>v.default},View:'div',Text:({children})=>React.createElement('span',null,children),ScrollView:({children})=>React.createElement('div',null,children),Modal:({visible,children})=>visible?React.createElement('div',null,children):null,
 Pressable:({children,accessibilityLabel,accessibilityState,disabled})=>React.createElement('button',{'aria-label':accessibilityLabel,'aria-pressed':accessibilityState?.selected,disabled},children),StyleSheet:{create:x=>x}},
 '../lib/reactionApi':api??{readReaction:()=>{throw Error('unexpected render fetch');},writeReaction:()=>{throw Error('unexpected render mutation');}}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>mocks[name]??load(path.resolve(path.dirname(file),name+'.ts'),react),mod,mod.exports);return mod.exports;}
test('four direct choices show emoji and full text in order without overflow menu',()=>{
 const {WorkoutReactions}=load('src/components/workout-reactions.tsx');
 const html=renderToStaticMarkup(React.createElement(WorkoutReactions,{owner:'owner',postId:'post',initial:'slay'}));
 const buttons=[...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(m=>m[1].replace(/<[^>]+>/g,''));
 assert.deepEqual(buttons,['🦍 BEAST!!','⚡ YEAH BUDDY!!','💅 SLAYYYYY!!','🗣️ LIGHT WEIGHT BABY!!']);
 assert.doesNotMatch(html,/•••|All workout reactions|count|comment|reply|LOADING/);
 assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
 assert.equal((html.match(/<span>💅 SLAYYYYY!!<\/span>/g)||[]).length,1);
});
test('failed batch restoration keeps the log usable and offers refresh with disabled reaction buttons',()=>{
 const {WorkoutReactions}=load('src/components/workout-reactions.tsx');
 const html=renderToStaticMarkup(React.createElement(WorkoutReactions,{owner:'owner',postId:'post'}));
 assert.match(html,/REFRESH REACTION/);assert.match(html,/disabled/);
});

test('legacy selection is accepted without a duplicate label or fifth choice',()=>{
 const {WorkoutReactions}=load('src/components/workout-reactions.tsx');
 for(const [initial,label] of [['pain_zone','☠️ WELCOME TO THE PAIN ZONE!!'],['no_tomorrow','🔥 THERE IS NO TOMORROW!!'],['wagmi','🔱 WAGMI BRAH!!'],['built_different','🧬 BUILT DIFFERENT!!']]){
  const html=renderToStaticMarkup(React.createElement(WorkoutReactions,{owner:'owner',postId:'post',initial}));
  assert.ok(!html.includes(label));assert.equal((html.match(/<button/g)||[]).length,4);
  assert.doesNotMatch(html,/aria-pressed="true"/);
 }
});

test('missing backend displays setup guidance rather than an endless connection retry',()=>{
 const {WorkoutReactions}=load('src/components/workout-reactions.tsx');
 const html=renderToStaticMarkup(React.createElement(WorkoutReactions,{owner:'owner',postId:'post',initialFailure:{code:'PGRST205',category:'setup'}}));
 assert.match(html,/Server setup needs to be updated/);assert.doesNotMatch(html,/Could not confirm reaction/);assert.match(html,/disabled/);
});

test('choices use a bounded horizontal scroller with natural widths and preserved touch targets',()=>{
 const react={useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useReducer:()=>[0,()=>{}],useEffect:()=>{}};
 const {WorkoutReactions}=load('src/components/workout-reactions.tsx',react);
 const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
 const tree=WorkoutReactions({owner:'owner',postId:'post',initial:'slay'});
 const row=nodes(tree).find(n=>n.props?.horizontal);
 assert.ok(row);assert.equal(row.props.style.width,'100%');assert.equal(row.props.style.flexGrow,0);
 assert.equal(row.props.contentContainerStyle.flexWrap,'nowrap');
 assert.equal(row.props.showsHorizontalScrollIndicator,false);
 assert.equal(row.props.directionalLockEnabled,true);assert.equal(row.props.nestedScrollEnabled,true);
 assert.equal(row.props.alwaysBounceVertical,false);
 const buttons=nodes(row).filter(n=>n.props?.accessibilityRole==='button');
 assert.equal(buttons.length,4);
 for(const button of buttons){
  const style=button.props.style[0];
  assert.equal(style.flexShrink,0);assert.equal(style.width,undefined);assert.equal(style.flex,undefined);
  assert.equal(style.minHeight,32);assert.ok(style.minWidth>=48);
  assert.ok(style.minHeight+button.props.hitSlop.top+button.props.hitSlop.bottom>=48);
  assert.ok(row.props.contentContainerStyle.paddingVertical>=button.props.hitSlop.top);
  assert.ok(style.borderRadius>=style.minHeight/2);
  assert.equal(style.backgroundColor,'#212225');
  assert.equal(button.props.children.props.style[0].fontSize,12);
  assert.equal(button.props.children.props.style[0].fontWeight,'600');
  assert.equal(button.props.children.props.numberOfLines,1);
 }
 assert.deepEqual(buttons.map(n=>n.props.accessibilityState.selected),[false,false,true,false]);
});

test('highlight follows successful sends, replacement, cancellation, failure reconciliation and reload',async()=>{
 const slots=[];let index=0,saved=null,finish,writes=0,fail=false,commit=false,offline=false;
 const react={useState:initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],()=>{}];},useReducer:()=>[0,()=>{}],useEffect:()=>{}};
 const api={readReaction:async()=>{if(offline)throw Error('offline');return saved;},writeReaction:async(_owner,_post,value)=>{
  writes++;await new Promise(resolve=>{finish=resolve;});
  if(!fail||commit)saved=value;
  if(fail)throw Error('lost response');
 }};
 const {WorkoutReactions}=load('src/components/workout-reactions.tsx',react,api);
 const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
 const render=()=>{index=0;return WorkoutReactions({owner:'owner',postId:'post',initial:saved});};
 const buttons=tree=>nodes(tree).filter(n=>n.props?.accessibilityState);
 const highlighted=tree=>buttons(tree).filter(n=>n.props.accessibilityState.selected);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const assertHighlight=(tree,label)=>{
  const selected=highlighted(tree);assert.equal(selected.length,label?1:0);
  if(label){assert.equal(selected[0].props.accessibilityLabel,label);assert.equal(selected[0].props.style[1].borderColor,'#D9FF43');assert.equal(selected[0].props.style[1].backgroundColor,undefined);assert.equal(selected[0].props.style[0].backgroundColor,'#212225');assert.equal(selected[0].props.children.props.style[1].color,'#D9FF43');}
  for(const b of buttons(tree).filter(n=>!n.props.accessibilityState.selected)){
   assert.equal(b.props.style[1],false);assert.equal(b.props.style[0].borderColor,'#444');assert.equal(b.props.children.props.style[0].color,'#B0B4BA');
  }
 };
 let tree=render();assertHighlight(tree,null);
 buttons(tree)[0].props.onPress();tree=render();assert.ok(buttons(tree).every(b=>b.props.disabled&&b.props.accessibilityState.busy));
 const scroller=nodes(tree).find(n=>n.props?.horizontal);assert.notEqual(scroller.props.scrollEnabled,false);
 buttons(tree)[2].props.onPress();assert.equal(writes,1);finish();await flush();assertHighlight(render(),'🦍 BEAST!!');
 tree=render();buttons(tree)[2].props.onPress();finish();await flush();assertHighlight(render(),'💅 SLAYYYYY!!');
 tree=render();buttons(tree)[2].props.onPress();finish();await flush();assertHighlight(render(),null);assert.equal(saved,null);
 tree=render();buttons(tree)[0].props.onPress();finish();await flush();
 fail=true;tree=render();buttons(tree)[2].props.onPress();finish();await flush();assertHighlight(render(),'🦍 BEAST!!');
 commit=true;tree=render();buttons(tree)[2].props.onPress();finish();await flush();assertHighlight(render(),'💅 SLAYYYYY!!');assert.equal(saved,'slay');
 offline=true;tree=render();buttons(tree)[0].props.onPress();finish();await flush();tree=render();assertHighlight(tree,null);assert.ok(buttons(tree).every(b=>b.props.disabled));
 // A remounted Feed/detail card receives its selection from the saved page read.
 slots.length=0;offline=false;assertHighlight(render(),'🦍 BEAST!!');
});
