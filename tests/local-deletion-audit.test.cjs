const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const script=fs.readFileSync('docs/verification/audit-browser-local-deletion.js','utf8');
function audit(entries) {
 const localStorage={...entries};
 Object.defineProperty(localStorage,'getItem',{value:key=>entries[key]??null});
 let output;
 const result=vm.runInNewContext(script,{localStorage,location:{origin:'http://localhost:8081'},prompt:()=>A,console:{log:s=>{output=s;}}});
 assert.deepEqual({...localStorage},entries);
 return {result:JSON.parse(JSON.stringify(result)),output};
}
test('read-only audit confirms removed keys and counts preserved other-owner data without exposing contents',()=>{
 const {result,output}=audit({[`@loads/local/v1/${B}/workouts`]:JSON.stringify([{note:'private-content'}]),[`@loads/local/v1/${B}/templates`]:'[]','sb-auth-token':'secret-token'});
 assert.equal(result.deletedOwner.allOwnedKeysRemaining,0);
 assert.equal(result.deletedOwner.receiptOrStatusKeysRemaining,0);
 assert.equal(result.deletedOwner.appSavedWebPhotosAbsent,true);
 assert.equal(result.otherAccounts[0].workouts,1);
 assert.equal(output.includes('private-content'),false);assert.equal(output.includes('secret-token'),false);
});
test('read-only audit flags leftover template, outbox photo, receipt and assigned legacy data',()=>{
 const {result,output}=audit({[`@loads/local/v1/${A}/templates`]:'[]',
 [`@loads/cloud-posts/v1/${A}/p`]:JSON.stringify({photo:'data:image/jpeg;base64,private-photo'}),
 '@loads/account-deletion/v1':JSON.stringify({userId:A,receipt:'secret-receipt'}),
 '@loads/local-data-migration/v1':JSON.stringify({owner:A,complete:true}), '@loads/workouts':'[]'});
 assert.equal(result.deletedOwner.templateKeyPresent,true);
 assert.equal(result.deletedOwner.outboxKeysRemaining,1);
 assert.equal(result.deletedOwner.receiptOrStatusKeysRemaining,1);
 assert.equal(result.deletedOwner.assignedLegacyKeysRemaining,1);
 assert.equal(result.deletedOwner.appSavedWebPhotosAbsent,false);
 assert.equal(output.includes('private-photo'),false);assert.equal(output.includes('secret-receipt'),false);
});
