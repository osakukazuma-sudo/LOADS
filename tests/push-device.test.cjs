const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function harness(os='ios',granted=false) {
 const disk=new Map(),calls=[];const state={granted,owner:'owner',error:null,physical:true,requests:0};
 const storage={getItem:async key=>disk.get(key)??null,setItem:async(key,value)=>disk.set(key,value)};
 const mocks={'react-native':{Platform:{OS:os}},'expo-device':{get isDevice(){return state.physical;}},'expo-crypto':{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},'expo-constants':{expoConfig:{extra:{eas:{projectId:'project'}}}},'@react-native-async-storage/async-storage':storage,
  'expo-notifications':{AndroidImportance:{DEFAULT:3},setNotificationChannelAsync:async()=>calls.push('channel'),getPermissionsAsync:async()=>({granted:state.granted}),requestPermissionsAsync:async()=>{state.requests++;return{granted:state.granted};},getExpoPushTokenAsync:async opts=>{calls.push(['token',opts]);return{data:'ExpoPushToken[test]'};}},
  './supabase':{supabase:{rpc:async(name,args)=>{calls.push([name,args]);return{error:state.error};},from:table=>({delete:()=>({eq:async(key,value)=>{calls.push(['delete',table,key,value]);return{error:state.error};}})})}},'./cloudPosts':{currentUserId:async()=>state.owner}};
 const cache={};function load(name){if(cache[name])return cache[name];const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(spec=>mocks[spec]??load(spec.slice(2)),m,m.exports);return cache[name]=m.exports;}
 return {state,calls,disk,register:load('registerPush').registerPush,disconnect:load('pushDevice').unregisterPushDevice};
}
test('notification permission is never requested by passive refresh; explicit permission denial is clear',async()=>{
 const h=harness();await h.register('owner',false);assert.equal(h.state.requests,0);assert.equal(h.calls.length,0);
 await assert.rejects(h.register('owner',true),/Allow notifications/);assert.equal(h.state.requests,1);assert.equal(h.calls.length,0);
});
test('iOS device registration uses project ID and stable installation ID across concurrent refreshes; account mismatch cannot write',async()=>{
 const h=harness('ios',true);await Promise.all([h.register('owner',false),h.register('owner',false)]);
 const rows=h.calls.filter(c=>Array.isArray(c)&&c[0]==='register_push_device');assert.equal(rows.length,1);assert.equal(rows[0][1].p_device_id,'11111111-1111-4111-8111-111111111111');assert.equal(rows[0][1].p_platform,'ios');
 assert.deepEqual(h.calls.find(c=>c[0]==='token')[1],{projectId:'project'});
 h.state.owner='another';await assert.rejects(h.register('owner',false),/Account changed/);assert.equal(h.calls.filter(c=>c[0]==='register_push_device').length,1);
});
test('Android creates a notification channel first; browser/simulator cannot claim remote push support',async()=>{
 const android=harness('android',true);await android.register('owner',true);assert.equal(android.calls[0],'channel');
 const web=harness('web',true);await web.register('owner',false);assert.equal(web.calls.length,0);await assert.rejects(web.register('owner',true),/physical/);
 const sim=harness('ios',true);sim.state.physical=false;await assert.rejects(sim.register('owner',true),/physical/);
});
test('logout revokes only the current device; failed revocation is surfaced so prior-account pushes cannot be left behind silently',async()=>{
 const h=harness('ios',true);await h.disconnect();assert.equal(h.calls.length,0);await h.register('owner',false);await h.disconnect();
 assert.deepEqual(h.calls.at(-1),['delete','push_devices','device_id','11111111-1111-4111-8111-111111111111']);
 h.state.error=Error('network');await assert.rejects(h.disconnect(),/disconnect push notifications/);
});
