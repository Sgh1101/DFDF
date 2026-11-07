const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
const {PeerServer}=require(process.env.DFDF_PEER_SERVER_MODULE||'peer');
// Public map/weapon UI paths were explored before this host/client regression.
(async()=>{let signaling;await new Promise(r=>PeerServer({host:'127.0.0.1',port:9000,path:'/'},s=>{signaling=s;r();}));const f=await fixture();try{
 const h=await f.page('maphost'),g=await f.page('mapguest');
 for(const p of [h,g])await p.evaluate(async()=>{render=()=>{};titleCam=()=>{};await ensurePeerLib();peerOpts=()=>({host:'127.0.0.1',port:9000,path:'/',secure:false,config:{iceServers:[]}});});
 const code=await h.evaluate(async()=>{await createRoom();return NET.room;});await g.evaluate(code=>joinRoom(code),code);
 await h.waitForFunction(()=>room.members.size===2&&NET.conns.size===1);
 await h.evaluate(()=>{room.mode='std';requestOpt('map','ascent_trial');});
 await g.waitForFunction(()=>lobbyState?.map==='ascent_trial',null,{timeout:90000});
 // Start while either side may still be downloading. The wrappers must wait
 // before building actors, rather than silently starting on the previous map.
 await h.evaluate(()=>{hostStartMatch();});
 for(const p of [h,g])await p.waitForFunction(()=>CUR_MAP_KEY==='ascent_trial'&&!!myActor()&&ASCENT_TRIAL.active,null,{timeout:120000});
 for(const p of [h,g])assert.deepEqual(await p.evaluate(()=>({name:MAP.name,textures:ASCENT_TRIAL.textureCount,free:!collideXZ(myActor().pos.x,myActor().pos.z,myActor().y,PR)})),{name:'황혼 지구',textures:239,free:true});
 await h.evaluate(()=>{world.phase='buy';world.roundTime=999;ADMIN.freezeAI=true;for(const a of world.actors){a.credits=999999;a.invuln=999;}closeShop();});
 await g.waitForFunction(()=>world.phase==='buy');
 for(const key of ['scout','bullpup']){
  await g.evaluate(key=>sendAction({t:'buy',kind:'weapon',key}),key);
  await h.waitForFunction(key=>world.actors.some(a=>a.ctrl!=='me'&&a.ctrl!=='ai'&&a.weapons.primary===key),key);
  await g.waitForFunction(key=>myActor().weapons.primary===key,key);
  await h.evaluate(()=>{world.phase='live';world.roundTime=999;const a=world.actors.find(a=>a.ctrl!=='me'&&a.ctrl!=='ai');a.fireCd=0;a.ammo[a.weapons.primary]=30;});
  await g.waitForFunction(()=>world.phase==='live');await g.evaluate(()=>{keys.fire=true;});
  await h.waitForFunction(key=>world.actors.some(a=>a.ctrl!=='me'&&a.ctrl!=='ai'&&a.ammo[key]<=24),key,{timeout:30000});
  await g.evaluate(()=>{keys.fire=false;});assert.equal(await g.evaluate(()=>actorWeaponKey(myActor())),key);
  await h.evaluate(()=>{world.phase='buy';world.roundTime=999;});await g.waitForFunction(()=>world.phase==='buy');
 }
 for(const id of ['A','B']){
  const y=await h.evaluate(id=>{const s=MAP.sites.find(s=>s.id===id);world.phase='live';world.over=false;plantSpike(s.x,s.z,s,false);return s.y;},id);
  await g.waitForFunction(({id,y})=>world.spike.state==='planted'&&siteAt(world.spike.x,world.spike.z)?.id===id&&Math.abs(world.spike.y-y)<.01,{id,y},{timeout:30000});
  assert.ok(await g.evaluate(y=>world.spike.mesh.visible&&Math.abs(world.spike.mesh.position.y-y)<.3,y),'guest sees bomb on the same elevated site');
 }
 await h.evaluate(()=>{const a=myActor();a.pos.set(114.625,13.75,55.125);a.y=13.75;a.vel.set(0,0,0);const remote=world.actors.find(a=>isGuestBody(a));remote.__warpT=12;});
 await g.evaluate(()=>sendAction({t:'y3warp',x:11463,y:1875,z:5513}));
 await h.waitForFunction(()=>world.actors.some(a=>isGuestBody(a)&&Math.abs(a.y-18.75)<.1&&Math.abs(a.pos.x-114.625)<1),null,{timeout:30000});
 await g.waitForFunction(()=>Math.abs(myActor().y-18.75)<.1,null,{timeout:30000});
 assert.ok(await h.evaluate(()=>Math.abs(myActor().y-13.75)<.1),'guest warp uses its chosen floor independently of host floor');
 assert.deepEqual(f.errors,[]);await h.evaluate(()=>netShutdown());console.log('Public Ascent: real local WebRTC host/guest map loading, safe spawns, weapon purchases/firing and visible elevated A/B bomb synchronization passed. Memory account API, no Android/store checks.');
}finally{await f.browser.close();signaling.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
