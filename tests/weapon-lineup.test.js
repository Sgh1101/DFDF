const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../js/valorant-data'),{harness}=require('./api-harness');
test('18 firearms plus a knife share the server catalog; the removed pack knives are not in it',async()=>{
 const h=harness(),c=await h.api('catalog');assert.equal(c.guns.length,19);assert.equal(c.items,601);
 for(const k of Object.keys(D.aliases))assert.ok(!c.guns.includes(k));
 for(const id of D.retiredKnives){assert.equal(c.only[id],undefined);assert.equal(c.tiers[id],undefined);}
 assert.equal(c.only.champions_atk,'scout');
 for(const key of Object.keys(D.names))assert.equal(D.canonical(key),key,'supplied weapons and carbine stay active');
 for(const target of Object.values(D.aliases))assert.ok(c.guns.includes(target),'every retired weapon maps directly to an active weapon');
});
test('Phantom is the automatic rifle; recon and burst keep distinct fire modes',()=>{
 assert.equal(D.profiles.scout.auto,true);assert.equal(D.profiles.scout.burst,0);assert.equal(D.profiles.scout.mag,30);assert.equal(D.profiles.scout.rpm,660);
 assert.equal(D.profiles.carbine.auto,false);assert.equal(D.profiles.carbine.mag,15);
 assert.equal(D.profiles.bullpup.auto,true);assert.equal(D.names.bullpup,'코멧 소총');assert.equal(D.canonical('bullpup'),'bullpup');
 assert.equal(D.championsWeapon,'scout');assert.equal(D.names.scout,'팬텀','the Champions skin names the gun it is for');
});
test('consolidation preserves owned skins and equipped choices; duplicate compensation is once only',async()=>{
 const h=harness(),p=await h.api('auth',{id:'collector',pw:'password',device:'test-packs'}),u=h.user('collector');
 u.own={vector:['dragon','lava'],smg:['lava','snow'],scout:['champions_atk']};u.skins={m:{vector:'dragon',smg:'snow',scout:'champions_atk'},t:1};u.wish=['vector|dragon','smg|dragon'];const gold=u.gold;h.db.set('user:collector',JSON.stringify(u));
 const reads=await Promise.all([h.api('skins',{token:p.token}),h.api('skins',{token:p.token})]);for(const first of reads)assert.equal(first.status,200);const after=h.user('collector');
 assert.deepEqual(after.own.smg,['lava','snow','dragon']);assert.ok(!after.own.vector);assert.deepEqual(after.weaponArchive.vector,['dragon','lava']);assert.equal(after.skins.m.smg,'snow');assert.equal(after.skins.m.scout,'champions_atk');assert.ok(!after.skins.m.vector);assert.deepEqual(after.wish,['smg|dragon']);assert.equal(after.gold,gold+900);
 await h.api('skins',{token:p.token});assert.equal(h.user('collector').gold,after.gold);
});
test('restoring firearms including the new Comet returns archived skins once and preserves current equipment and compensation',async()=>{
 const h=harness(),p=await h.api('auth',{id:'oldbuyer',pw:'password',device:'oldbuyer-packs'}),u=h.user('oldbuyer');
 u.own={pistol:['lava','snow','dragon'],autoshot:['snow','gold'],rifle:['lava','gold'],scout:['champions_def'],machpist:['gold']};
 u.weaponArchive={machpist:['lava','snow'],whisper:['dragon'],shotgun:['gold'],burst:['gold'],scout:['snow'],bullpup:['lava']};
 u.skins={m:{pistol:'snow',autoshot:'snow',rifle:'lava',scout:'champions_def'},t:1};u.refunded=900;const gold=u.gold;h.db.set('user:oldbuyer',JSON.stringify(u));
 await Promise.all([h.api('skins',{token:p.token}),h.api('skins',{token:p.token})]);const next=h.user('oldbuyer');
 assert.deepEqual(next.own.machpist,['gold','lava','snow']);assert.deepEqual(next.own.whisper,['dragon']);assert.deepEqual(next.own.shotgun,['gold']);assert.deepEqual(next.own.burst,['gold']);assert.deepEqual(next.own.scout,['champions_def','snow']);
 assert.deepEqual(next.own.bullpup,['lava']);
 assert.deepEqual(next.skins.m,u.skins.m);assert.deepEqual(next.own.scout,['champions_def','snow']);assert.equal(next.gold,gold);assert.equal(next.refunded,900);
 for(const key of D.restored)assert.equal(next.weaponRestored[key],true);
 // Later deliberate removals must not be undone by replaying the archive.
 next.own.machpist=['gold'];h.db.set('user:oldbuyer',JSON.stringify(next));
 await h.api('skins',{token:p.token});assert.deepEqual(h.user('oldbuyer').own.machpist,['gold']);assert.equal(h.user('oldbuyer').gold,gold);
});

test('the guns carry our own names, and the removed pack is not loaded anywhere',()=>{
 const taken=['클래식','고스트','셰리프','밴달','저지','오딘','아웃로','오퍼레이터'];
 for(const name of Object.values(D.names))assert.ok(!taken.includes(name),name);
 assert.equal(new Set(Object.values(D.names)).size,Object.keys(D.names).length,'every name is distinct');
 assert.ok(!fs.existsSync('assets/valorant-packs'));
 for(const f of ['play.html','js/weapon-identity.js','js/weapon-shop.js','js/legacy/58-gun-skins.js'])assert.ok(!/valorant-packs|VALORANT_PACK/.test(fs.readFileSync(f,'utf8')),f);
});
test('pack knife skins leave the collection once, for the shop price of a legendary knife, and leave picks and wishes',async()=>{
 const h=harness(),p=await h.api('auth',{id:'knifer',pw:'password',device:'test-knifer'}),u=h.user('knifer');
 u.own={knife:['vp_desire_blade','karambit','vp_thunder_hammer'],rifle:['lava']};u.skins={m:{knife:'vp_desire_blade',rifle:'lava'},t:1};
 u.wish=['knife|vp_future_dagger','knife|stiletto'];const gold=u.gold,refunded=u.refunded||0;h.db.set('user:knifer',JSON.stringify(u));
 const reads=await Promise.all([h.api('skins',{token:p.token}),h.api('skins',{token:p.token})]);for(const r of reads)assert.equal(r.status,200);
 const after=h.user('knifer'),each=15000*1.5;
 assert.deepEqual(after.own.knife,['karambit']);assert.deepEqual(after.own.rifle,['lava']);
 assert.equal(after.gold,gold+2*each);assert.equal(after.refunded,refunded+2*each);
 assert.equal(after.skins.m.knife,undefined);assert.equal(after.skins.m.rifle,'lava');assert.deepEqual(after.wish,['knife|stiletto']);
 await h.api('skins',{token:p.token});assert.equal(h.user('knifer').gold,after.gold,'only once');
 const owner=await h.api('auth',{id:'owner',pw:'owner-password',device:'test-owner'});
 assert.equal((await h.api('a_user_set',{atoken:owner.atoken,id:'knifer',op:'grant',item:'knife|vp_desire_blade'})).status,400,'cannot be granted again');
});
