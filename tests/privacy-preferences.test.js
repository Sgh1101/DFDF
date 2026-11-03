const test=require('node:test'),assert=require('node:assert/strict');
const privacy=require('../js/privacy-preferences');
function store(){let v=null;return {getItem:()=>v,setItem:(k,x)=>{v=x;},removeItem:()=>{v=null;}};}
test('missing, corrupt, future and string-valued preferences default to essential-only',()=>{
 for(const v of [null,'broken','null','[]','{"version":99,"advertising":true}','{"version":1,"advertising":"true"}']){
  assert.deepEqual(privacy.read({getItem:()=>v}),{version:1,essential:true,advertising:false,analytics:false});
 }
 assert.deepEqual(privacy.read({getItem:()=>{throw Error('denied');}}),privacy.defaults());
});
test('optional choices persist, withdrawal resets them, storage failures stay conservative',()=>{
 const s=store();assert.equal(privacy.write(s,{advertising:true,analytics:true}),true);assert.equal(privacy.read(s).advertising,true);
 assert.equal(privacy.reset(s),true);assert.deepEqual(privacy.read(s),privacy.defaults());
 assert.equal(privacy.write({setItem:()=>{throw Error('quota');}},{advertising:true}),false);
 assert.equal(privacy.read(s).cmpVerified,undefined,'a local preference never certifies a CMP');
});
