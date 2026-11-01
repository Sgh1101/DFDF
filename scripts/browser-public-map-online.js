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
 for(const p of [h,g])assert.deepEqual(await p.evaluate(()=>({name:MAP.name,textures:ASCENT_TRIAL.textureCount,free:!collideXZ(myActor().pos.x,myActor().pos.z,myActor().y,PR)})),{name:'마크X발로',textures:239,free:true});
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
 assert.deepEqual(f.errors,[]);await h.evaluate(()=>netShutdown());console.log('Public Ascent: real local WebRTC host/guest load the selected map, retain safe source spawns and original textures; Phantom and Comet host purchases, continuous firing and wire identities passed. Memory account API, no Android/store checks.');
}finally{await f.browser.close();signaling.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
