const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./api-harness');
test('simultaneous first room claims have exactly one owner and the loser cannot consume commands',async()=>{
 const h=harness(),a=await h.api('auth',{id:'claimera',pw:'password',device:'claimer-a-device'}),b=await h.api('auth',{id:'claimerb',pw:'password',device:'claimer-b-device'});
 const out=await Promise.all([a,b].map(s=>h.api('room_up',{token:s.token,code:'CLAIM1',name:'race',ch:'s1'})));
 assert.deepEqual(out.map(x=>x.status).sort(),[200,409]);
 const winner=out.findIndex(x=>x.status===200),sessions=[a,b];
 assert.equal((await h.api('room_up',{token:sessions[1-winner].token,code:'CLAIM1'})).status,409);
 assert.equal((await h.api('room_up',{token:sessions[winner].token,code:'CLAIM1'})).status,200);
});
