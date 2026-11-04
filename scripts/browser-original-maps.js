// New layouts were explored first with fixture + real rendering. Geometry/navigation
// assertions replace the retired external-map-specific triangle/texture constants.
const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
(async()=>{const f=await fixture(),results=[];fs.mkdirSync('test-results/original-maps',{recursive:true});try{
 const p=await f.page('originalmaptest',{width:1280,height:720},{},{quality:'perf',bootTimeout:120000});
 assert.deepEqual(await p.evaluate(()=>({desert:!!MAPS.desert_town,loader:!!window.KOUR_MAP,event:!!document.getElementById('sel-event')})),{desert:false,loader:false,event:false},'Claude removal remains in effect');
 assert.equal(await p.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\/assets\/maps\/(ascent|desert|kour)\//.test(r.name)).length),0,'ordinary entry does not load either map');
 await p.locator('#go-play').click();if(await p.locator('#sel-pick').isVisible())await p.locator('#sel-pick').click();
 await p.locator('#sel-maps button').filter({hasText:/^황혼 지구$/}).click();await p.waitForFunction(()=>ASCENT_TRIAL.status==='ready');await p.locator('#sel-go').click({timeout:120000});
 await p.waitForFunction(()=>ASCENT_TRIAL.active&&!!myActor());
 for(const [key,global] of [['ascent_trial','ASCENT_TRIAL']]){
  await p.evaluate(async({key,global})=>{await window[global].ensure();room.map=key;room.mode='std';await startGame(AGENTS[0],true);closeShop();ADMIN.freezeAI=true;world.phase='live';world.roundTime=999;},{key,global});
  await p.waitForFunction(({key,global})=>CUR_MAP_KEY===key&&window[global].nav&&Number.isFinite(myActor()?.y),{key,global},{timeout:120000});
  const data=await p.evaluate(({key,global})=>{
   const s=window[global],a=myActor(),start={x:a.pos.x,z:a.pos.z,y:a.y};
   const spawns=world.actors.map(x=>({finite:[x.pos.x,x.pos.z,x.y].every(Number.isFinite),free:!collideXZ(x.pos.x,x.pos.z,x.y+.02,PR)}));
   const routes=[];
   for(const from of [MAP.attackSpawn,MAP.defendSpawn])for(const goal of MAP.sites){
    const path=findPath(from.x,from.z,goal.x,goal.z,from.y);a.pos.set(from.x,from.y,from.z);a.y=from.y;a.vy=0;a.onGround=true;a.root=0;a.slow=1;a.speedBuff=1;a.ads=false;a.vel.set(0,0,0);
    let reached=0;
    for(const target of path){for(let n=0;n<80&&Math.hypot(target.x-a.pos.x,target.z-a.pos.z)>.16;n++){a.yaw=Math.atan2(-(target.x-a.pos.x),-(target.z-a.pos.z));a.input.mv=[0,-1];a.input.btn=0;simMove(a,.0125);}if(Math.hypot(target.x-a.pos.x,target.z-a.pos.z)>.3)break;reached++;}
    routes.push({length:path.length,reached,endDistance:Math.hypot(a.pos.x-goal.x,a.pos.z-goal.z),endY:a.y,goalY:goal.y||0,lastY:path.at(-1)?.y});
   }
   let wall=null;
   for(const c of COLLIDERS){if(c.h-(c.y0||0)<3||c.maxZ-c.minZ<3)continue;const z=(c.minZ+c.maxZ)/2,x=c.minX-PR-.2,y=groundAt(x,z,key==='ascent_trial'?7.5:0);if(x<MAP.bounds.minX+PR||x>MAP.bounds.maxX-PR||z<MAP.bounds.minZ+PR||z>MAP.bounds.maxZ-PR||y+1.8>c.h||y<(c.y0||0)||collideXZ(x,z,y+.02,PR))continue;
    const q={x,z};for(let i=0;i<100;i++)moveWithSlide(q,.1,0,y,PR);const ray=WALL_T(x,y+1,z,1,0,0,10),distance=c.minX-x;
    const enemy=world.actors.find(b=>b.team!==a.team);enemy.pos.set(c.minX+1,y,z);enemy.y=y;enemy.alive=true;enemy.hp=100;enemy.invuln=0;
    actorHitscan(a,new T.Vector3(x,y+1,z),new T.Vector3(1,0,0),{range:20,dmg:50,hs:1},false);
    wall={blocked:q.x+PR<=c.minX+.001,ray,distance,enemyHP:enemy.hp};break;
   }
   a.pos.set(start.x,start.y,start.z);a.y=start.y;a.input.mv=[0,0];a.input.btn=0;a.vel.set(0,0,0);
   const anchors=[MAP.attackSpawn,MAP.defendSpawn,...MAP.sites,...Object.values(MAP.nodes)];
   return {key,spawns,routes,wall,stats:s.renderStats,walk:GRID.walk.reduce((a,b)=>a+b,0),sites:MAP.sites,adjust:s.nav.anchorAdjustments,dimensions:[MAP.bounds.maxX-MAP.bounds.minX,MAP.bounds.maxZ-MAP.bounds.minZ],anchors,stacked:Array.from(s.nav.start).some((v,i,a)=>i&&v-a[i-1]>1)};
  },{key,global});
  console.log(JSON.stringify(data));results.push(data);fs.writeFileSync('test-results/original-maps/results.json',JSON.stringify(results,null,2));
  assert.ok(data.spawns.every(s=>s.finite&&s.free),key+' safe starts');assert.ok(data.walk>1000);assert.deepEqual(data.dimensions,[360.5,390.25]);assert.ok(data.adjust.every(d=>d<.01),'source anchors stay in their actual district');assert.ok(data.stacked,'bridge and ground are separate nodes');assert.deepEqual(data.sites.map(s=>s.y),[13.75,5]);
  for(const r of data.routes){assert.ok(r.length>0);assert.equal(r.reached,r.length,'body traverses each complete route');assert.ok(r.endDistance<1.5);assert.ok(Math.abs(r.endY-r.goalY)<.15,'route arrives on the objective floor');}
  assert.ok(data.wall?.blocked);assert.ok(Math.abs(data.wall.ray-data.wall.distance)<.05);assert.equal(data.wall.enemyHP,100,'wall blocks bullets');
  const refs=await p.evaluate(({global})=>{const s=window[global];window.originalRefs={actor:myActor(),nav:s.nav,colliders:COLLIDERS.slice()};return {loads:s.loads};},{global});
  await p.evaluate(async()=>{for(const q of ['perf','mobile']){setQuality(q);if(ASCENT_TRIAL.active)await ASCENT_TRIAL.graphicsReady;}});
  assert.ok(await p.evaluate(({global,loads})=>{const s=window[global];return s.loads===loads&&s.nav===originalRefs.nav&&myActor()===originalRefs.actor&&COLLIDERS.length===originalRefs.colliders.length&&COLLIDERS.every((c,i)=>c===originalRefs.colliders[i]);},{global,loads:refs.loads}),'graphics switch keeps gameplay objects');
  await p.screenshot({path:'test-results/original-maps/'+key+'.png'});
 }
 const cleanup=await p.evaluate(()=>{loadMap('glacier');return {ascent:ASCENT_TRIAL.active,meshes:ASCENT_TRIAL.meshes.length,boxes:COLLIDERS.filter(c=>c.ascent||c.kour).length,floor:floor.visible};});
 assert.deepEqual(cleanup,{ascent:false,meshes:0,boxes:0,floor:true});assert.deepEqual(f.errors,[]);
 console.log('Original island: lazy loading, both-team objective physics, bullet/body walls, graphics stability and cleanup passed');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
