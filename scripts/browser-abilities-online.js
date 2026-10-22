const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
const {PeerServer}=require(process.env.DFDF_PEER_SERVER_MODULE||'peer');
(async()=>{
 let server;await new Promise(r=>PeerServer({host:'127.0.0.1',port:9011,path:'/'},s=>{server=s;r();}));
 const f=await fixture();try{
  const host=await f.page('abilityhost'),guest=await f.page('abilityguest');
  for(const p of [host,guest])await p.evaluate(async()=>{
   render=()=>{};titleCam=()=>{};await ensurePeerLib();peerOpts=()=>({host:'127.0.0.1',port:9011,path:'/',secure:false,config:{iceServers:[]}});
   window.abilityEvents=[];const fn=NET.onEvent;NET.onEvent=function(m){abilityEvents.push(structuredClone(m));return fn.apply(this,arguments);};
  });
  const code=await host.evaluate(async()=>{await createRoom();return NET.room;});await guest.evaluate(code=>joinRoom(code),code);
  await host.waitForFunction(()=>NET.conns.size===1&&room.members.size===2);
  await host.evaluate(()=>{
   const id=[...NET.conns.keys()][0],m=room.members.get(id),team=m.team==='atk'?'def':'atk';
   for(let i=0;i<TEAM_SIZE&&!lobbyMove(id,team,i);i++);
   for(const [k,m]of room.members)m.agentKey=k===id?'danbi':'gunbong';room.mode='std';room.map='glacier';hostStartMatch();
  });
  await guest.waitForFunction(()=>NET.mode==='client'&&myActor()?.agent.id==='danbi',null,{timeout:90000});
  const ids=await host.evaluate(()=>{
   closeShop();ADMIN.freezeAI=true;world.phase='live';world.roundTime=999;const a=myActor(),b=world.actors.find(a=>!['me','ai','dead'].includes(a.ctrl));
   for(const c of world.actors){c.fireCd=999;c.invuln=999;c.armor=0;c.input.mv=[0,0];if(c!==a&&c!==b){c.pos.x=100+c.id*3;c.pos.z=100;}}
   a.ultCharge=a.ultMax;return {host:a.id,guest:b.id};
  });
  await guest.waitForFunction(()=>world.phase==='live');await guest.evaluate(()=>closeShop());
  await host.evaluate(()=>useAbility(3));
  await guest.waitForFunction(()=>ABILITY_ULTIMATES.objects().some(o=>o.id.includes(':queen:')));
  const serverId=await host.evaluate(()=>ABILITY_ULTIMATES.objects().find(o=>o.id.includes(':queen:')).id);
  assert.equal(await guest.evaluate(()=>ABILITY_ULTIMATES.objects().find(o=>o.id.includes(':queen:')).id),serverId);
  const dv=await guest.evaluate(()=>abilityEvents.find(m=>m.t==='cast'&&m.ty==='ult_queen').dv);assert.ok(Number.isInteger(dv)&&dv>0);
  // Actual shootable ray/hp/break path on the authority, then reliable removal on guest.
  assert.equal(await host.evaluate(gid=>{
   const s=SHOOTABLES.find(s=>s.hp===120),g=actorById(gid),origin=new T.Vector3(s.x,s.y,s.z+3),dir=new T.Vector3(0,0,-1);
   return shootableHit(origin,dir,6,g,80)&&shootableHit(origin,dir,6,g,80);
  },ids.guest),true);
  await guest.waitForFunction(()=>abilityEvents.some(m=>m.t==='ability-detail'&&m.k==='break')&&ABILITY_ULTIMATES.objects().length===0);
  const facing=await host.evaluate(gid=>{
   const a=myActor(),g=actorById(gid);let found=false;
   for(let k=0;k<48;k++){const yaw=k*Math.PI/24,x=a.pos.x-Math.sin(yaw)*12,z=a.pos.z-Math.cos(yaw)*12;
    if(!rayBlocked(a.pos.x,a.y+1.4,a.pos.z,x,a.y+1.2,z)&&!collideXZ(x,z,a.y,.4)){g.pos.x=x;g.pos.z=z;g.y=a.y;found=true;break;}}
   if(!found)throw new Error('No open firing lane');
   a.hp=100;a.armor=0;a.invuln=0;g.invuln=999;g.ultCharge=g.ultMax;
   return {yaw:Math.atan2(-(a.pos.x-g.pos.x),-(a.pos.z-g.pos.z)),x:g.pos.x,z:g.pos.z};
  },ids.guest);
  await guest.waitForFunction(p=>Math.hypot(myActor().pos.x-p.x,myActor().pos.z-p.z)<1&&myActor().ultCharge===myActor().ultMax,facing);
  await guest.evaluate(p=>{const a=myActor();a.yaw=p.yaw;a.pitch=0;keys.fire=false;keys.ads=false;},facing);
  await host.waitForFunction(p=>{const g=world.actors.find(a=>!['me','ai','dead'].includes(a.ctrl));return Math.abs(Math.sin(g.yaw-p.yaw))<.05;},facing);
  await guest.evaluate(()=>useAbility(3));
  await host.waitForFunction(()=>myActor().hp<=40,null,{timeout:20000});
  await guest.waitForFunction(id=>actorById(id).hp<=40&&abilityEvents.some(m=>m.t==='ability-impact'&&m.ty==='ult_lightning'),ids.host,{timeout:20000});
  await guest.waitForFunction(()=>abilityEvents.some(m=>m.t==='ability-detail'&&m.k==='concuss'));
  const proof=await guest.evaluate(id=>({hp:actorById(id).hp,charge:myActor().ultCharge,casts:abilityEvents.filter(m=>m.t==='cast'&&m.ty==='ult_lightning').length,beam:!!myActor().ultW,ids:abilityEvents.filter(m=>m.t==='cast'&&m.ty==='ult_lightning').map(m=>m.dv)}),ids.host);
  assert.equal(proof.hp,40);assert.equal(proof.charge,0);assert.equal(proof.casts,1);assert.equal(proof.beam,false);assert.ok(proof.ids.every(Number.isInteger));
  await host.evaluate(()=>netShutdown());assert.deepEqual(f.errors,[]);
  console.log('Real local WebRTC: guest authoritative chain damage/charge once; unique cast identity; queen shot destruction and ability impact replay.',JSON.stringify(proof));
 }finally{await f.browser.close();server.close();}
})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
