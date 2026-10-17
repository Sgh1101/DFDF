const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const D=require('../js/valorant-data'),{harness}=require('./api-harness');
test('supplied gun and knife assets preserve original bytes and all model cubes',()=>{
 const base=path.join(__dirname,'../assets/valorant-packs/v1'),m=JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));
 assert.equal(m.items.length,15);assert.equal(m.items.filter(i=>i.key==='knife').length,6);
 for(const f of m.files){assert.ok(!/\.(lua|class|jar)$/.test(f.name));const b=fs.readFileSync(path.join(base,f.name));assert.equal(b.length,f.size);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256);}
 const cubes={classic:324,ghost:466,sheriff:1172,vandal:503,phantom:502,judge:362,odin:1387,outlaw:445,operator:682,desire_blade:208,eternal_axe:186,eternal_karambit:92,future_butterfly:180,future_dagger:198,thunder_hammer:339};
 for(const i of m.items){const g=D.parse(fs.readFileSync(path.join(base,i.model),'utf8'))['minecraft:geometry'][0];assert.equal(g.bones.reduce((s,b)=>s+(b.cubes?.length||0),0),cubes[i.id]);assert.ok(D.parse(fs.readFileSync(path.join(base,i.animation),'utf8')).animations);}
 for(const i of m.items.filter(i=>i.key!=='knife')){const data=D.parse(fs.readFileSync(path.join(base,'gun/data/valorant/data/guns/'+i.id+'_data.json'),'utf8'));assert.equal(D.profiles[i.key].mag,data.ammo_amount);assert.equal(D.profiles[i.key].rpm,data.rpm);}
 assert.deepEqual(m.items.find(i=>i.id==='classic').missingOptional,['gun/assets/valorant/textures/gun/uv/classic_n.png']);
});
test('JSON data comments and numeric source animation tracks stay data',()=>{
 assert.deepEqual(D.parse('{"text":"https://example.test",/*x*/"n":2,//note\n}'),{text:'https://example.test',n:2});
 assert.deepEqual(D.parse('{"literal":",}","array":[1,2,],}'),{literal:',}',array:[1,2]});
 assert.deepEqual(D.sample(0,1,[1,1,1]),[0,0,0]);assert.deepEqual(D.sample({'0':[0,0,0],'1':[2,4,6]},.5,[0,0,0]),[1,2,3]);
 assert.deepEqual(D.sample('globalThis.bad = true',.1,[0,0,0]),[0,0,0]);assert.equal(globalThis.bad,undefined);
});
test('13 distinct weapons and six new knife-only skins share the server catalog',async()=>{
 const h=harness(),c=await h.api('catalog');assert.equal(c.guns.length,13);assert.equal(c.items,421);
 for(const k of Object.keys(D.aliases))assert.ok(!c.guns.includes(k));
 for(const s of D.knives){assert.equal(c.only[s.id],'knife');assert.equal(c.tiers[s.id],4);}
 assert.equal(c.only.champions_atk,'carbine');
 for(const key of Object.keys(D.names))assert.equal(D.canonical(key),key,'supplied weapons and carbine stay active');
 for(const target of Object.values(D.aliases))assert.ok(c.guns.includes(target),'every retired weapon maps directly to an active weapon');
});
test('consolidation preserves owned skins and equipped choices; duplicate compensation is once only',async()=>{
 const h=harness(),p=await h.api('auth',{id:'collector',pw:'password',device:'test-packs'}),u=h.user('collector');
 u.own={vector:['dragon','lava'],smg:['lava','snow'],carbine:['champions_atk']};u.skins={m:{vector:'dragon',smg:'snow',carbine:'champions_atk'},t:1};u.wish=['vector|dragon','smg|dragon'];const gold=u.gold;h.db.set('user:collector',JSON.stringify(u));
 const reads=await Promise.all([h.api('skins',{token:p.token}),h.api('skins',{token:p.token})]);for(const first of reads)assert.equal(first.status,200);const after=h.user('collector');
 assert.deepEqual(after.own.smg,['lava','snow','dragon']);assert.ok(!after.own.vector);assert.deepEqual(after.weaponArchive.vector,['dragon','lava']);assert.equal(after.skins.m.smg,'snow');assert.equal(after.skins.m.carbine,'champions_atk');assert.ok(!after.skins.m.vector);assert.deepEqual(after.wish,['smg|dragon']);assert.equal(after.gold,gold+900);
 await h.api('skins',{token:p.token});assert.equal(h.user('collector').gold,after.gold);
});
test('further consolidation keeps supplied-gun skins and carbine selections, with once-only compensation',async()=>{
 const h=harness(),p=await h.api('auth',{id:'oldbuyer',pw:'password',device:'oldbuyer-packs'}),u=h.user('oldbuyer');
 u.own={pistol:['lava'],machpist:['lava','snow'],stinger:['dragon'],shotgun:['gold'],autoshot:['snow'],burst:['gold'],rifle:['lava'],carbine:['champions_def']};
 u.skins={m:{machpist:'snow',shotgun:'gold',autoshot:'snow',burst:'gold',rifle:'lava',carbine:'champions_def'},t:1};const gold=u.gold;h.db.set('user:oldbuyer',JSON.stringify(u));
 await h.api('skins',{token:p.token});const next=h.user('oldbuyer');
 assert.deepEqual(next.own.pistol,['lava','snow','dragon']);assert.deepEqual(next.own.autoshot,['snow','gold']);assert.deepEqual(next.own.rifle,['lava','gold']);
 assert.equal(next.skins.m.autoshot,'snow');assert.equal(next.skins.m.rifle,'lava');assert.equal(next.skins.m.carbine,'champions_def');assert.equal(next.skins.m.pistol,'snow');
 assert.equal(next.gold,gold+900);for(const key of ['machpist','stinger','shotgun','burst'])assert.ok(!next.own[key]&&next.weaponArchive[key]);
 await h.api('skins',{token:p.token});assert.equal(h.user('oldbuyer').gold,next.gold);
});
