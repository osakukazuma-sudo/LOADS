const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
function render(file,initialData){
 const react={...React,useState:initial=>React.useState(initial===null?initialData:initial)};
 const mocks={react,'react/jsx-runtime':require('react/jsx-runtime'),'react-native':{Text:'span',View:'div',Pressable:({children})=>React.createElement('button',null,children)},
 'expo-router':{useFocusEffect:()=>{},useRouter:()=>({}),useLocalSearchParams:()=>({id:'22222222-2222-4222-8222-222222222222'})},
 '../hooks/use-account-owner':{useAccountOwner:()=> '11111111-1111-4111-8111-111111111111'},'../lib/follows':{},
 '../components/social-layout':{SocialLayout:({children})=>React.createElement('main',null,children),socialStyles:{}},'./social-layout':{socialStyles:{}}};
 const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(name=>mocks[name],mod,mod.exports);
 return renderToStaticMarkup(React.createElement(mod.exports.default??mod.exports.MyConnections));
}
test('other profile renders identity and Follow state without counts/list links',()=>{
 for(const following of [false,true]){
 const html=render('src/app/athlete.tsx',{profile:{username:'athlete_b',display_name:'Athlete B'},following});
 assert.ok(html.includes('Athlete B'));assert.ok(html.includes('@athlete_b'));
 assert.ok(html.includes(following?'FOLLOWING · UNFOLLOW':'FOLLOW'));
 assert.equal(/Followers|YOUR CONNECTIONS|YOUR FOLLOWERS|FIND BY USERNAME/.test(html),false);
 }
});
test('own profile connections component renders own counts and lookup entry',()=>{
 const html=render('src/components/my-connections.tsx',{followers:7,following:3});
 assert.match(html,/7 Followers/);assert.match(html,/3 Following/);assert.match(html,/ONLY VISIBLE TO YOU/);assert.match(html,/FIND BY USERNAME/);
});
