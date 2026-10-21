const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./api-harness');
test('isolated account/receipt restore preserves coins, ownership migration and reward idempotence',async()=>{
 const h=harness(),s=await h.api('auth',{id:'restorecase',pw:'password',device:'restore-device'}),u=h.user('restorecase');
 u.championCoins=699;u.own={carbine:['champions_def']};u.skins={m:{carbine:'champions_def'},t:1};h.db.set('user:restorecase',JSON.stringify(u));
 const mt=await h.api('match_start',{token:s.token});h.advance(61000);const body={token:s.token,mt:mt.ticket,win:true,kills:2},first=await h.api('progress',body);
 const restored=harness({now:h.now()});for(const [k,v]of h.db)restored.db.set(k,structuredClone(v));
 const replay=await restored.api('progress',body);assert.deepEqual(replay,first);
 const me=await restored.api('me',{token:s.token});assert.equal(me.status,200);const saved=restored.user('restorecase');
 assert.equal(saved.championCoins,700);assert.equal(saved.matches,1);assert.deepEqual(saved.own.scout,['champions_def']);assert.equal(saved.skins.m.scout,'champions_def');
});
