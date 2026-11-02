const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('../js/game-rules');
const snapshot=()=>({ph:'live',rt:999,sa:1,sd:2,rd:3,sk:[0,0,0,0,0],a:[[1,0,0,0,0,0,100,50,1,0,12,3]],ak:[],fx:[]});
test('host numeric events cannot introduce markup, prototype keys or nonfinite HUD values',()=>{
 const weapons={pistol:{}};assert.equal(rules.validHostEvent({t:'am',id:1,k:'pistol',n:12,r:24,rl:0},weapons),true);
 for(const bad of ['<img src=x onerror=alert(1)>',NaN,Infinity,-1,1e15])for(const key of ['n','r'])assert.equal(rules.validHostEvent({t:'am',id:1,k:'pistol',n:12,r:24,[key]:bad},weapons),false);
 for(const k of ['__proto__','constructor','missing'])assert.equal(rules.validHostEvent({t:'am',k,n:12,r:24},weapons),false);
 assert.equal(rules.validHostEvent({t:'ability-state',i:0,charges:1,cd:.25,ult:3},weapons),true);
 assert.equal(rules.validHostEvent({t:'ability-state',i:0,charges:1,cd:0,ult:'<svg/onload=alert(1)>'},weapons),false);
});
test('snapshots reject hostile score/round and actor values before any partial state update',()=>{
 assert.equal(rules.validSnapshot(snapshot()),true);
 for(const key of ['sa','sd','rd','rt']){const s=snapshot();s[key]='<img src=x>';assert.equal(rules.validSnapshot(s),false);}
 for(const i of [6,7,10,11]){const s=snapshot();s.a[0][i]='<svg/onload=alert(1)>';assert.equal(rules.validSnapshot(s),false);}
 const old=snapshot();old.a[0].pop();assert.equal(rules.validSnapshot(old),true,'older actors without ult charge remain compatible');
 const huge=snapshot();huge.a=Array(129).fill(huge.a[0]);assert.equal(rules.validSnapshot(huge),false);
});
