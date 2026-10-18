const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./browser-fixture');
(async()=>{
 const f=await fixture();fs.mkdirSync('test-results',{recursive:true});
 try{
  const page=await f.page('ascenttester',{width:1280,height:720},{},{path:'/play.html?ascent-trial=1',bootTimeout:120000});
  await page.waitForFunction(()=>window.ASCENT_TRIAL?.status==='ready');
  await page.getByRole('button',{name:'이 맵으로 연습 시작'}).click({timeout:120000});
  await page.waitForFunction(()=>ASCENT_TRIAL.started,{},{timeout:120000});
  await page.evaluate(()=>{ADMIN.freezeAI=true;world.phase='live';world.roundTime=999;});
  if(!await page.evaluate(()=>document.pointerLockElement===document.getElementById('cv')))await page.locator('#cv').click({force:true});
  await page.waitForFunction(()=>document.pointerLockElement===document.getElementById('cv'));
  const state=await page.evaluate(()=>({key:CUR_MAP_KEY,name:MAP.name,textures:ASCENT_TRIAL.textureCount,mesh:ASCENT_TRIAL.meshes.length,walk:ASCENT_TRIAL.walkable,components:ASCENT_TRIAL.nav.groups.slice(0,10),spawn:world.actors.map(a=>({y:a.y,free:!collideXZ(a.pos.x,a.pos.z,a.y,PR)})),routes:[MAP.defendSpawn,...MAP.sites].map(p=>findPath(MAP.attackSpawn.x,MAP.attackSpawn.z,p.x,p.z).length)}));
  assert.equal(state.name,'마크X발로');assert.equal(state.textures,239);
  console.log('map',JSON.stringify(state));assert.equal(state.key,'ascent_trial');assert.ok(state.mesh>0&&state.mesh<150);assert.ok(state.walk>1000);assert.ok(state.spawn.every(p=>p.y>0&&p.free));assert.ok(state.routes.every(n=>n>0),'all match objectives reachable');
  // Real keyboard input through gatherInput/netStep, starting in an observed
  // open street. Select a clear heading from the actual collision solver.
  const begin=await page.evaluate(()=>{
   const a=myActor();a.invuln=999;
   for(let i=0;i<32;i++){
    const yaw=i*Math.PI/16,p={x:a.pos.x,z:a.pos.z};let y=a.y;
    for(let j=0;j<30;j++)y=moveWithSlide(p,-Math.sin(yaw)*.15,-Math.cos(yaw)*.15,y,PR);
    if(Math.hypot(p.x-a.pos.x,p.z-a.pos.z)>4){a.yaw=yaw;return{x:a.pos.x,z:a.pos.z};}
   }
   throw Error('No open route at spawn');
  });
  await page.keyboard.down('w');
  await page.waitForFunction(p=>Math.hypot(player.pos.x-p.x,player.pos.z-p.z)>2,begin,{timeout:15000});
  await page.keyboard.up('w');
  const moved=await page.evaluate(p=>({distance:Math.hypot(player.pos.x-p.x,player.pos.z-p.z),grounded:player.onGround,y:player.y}),begin);
  assert.ok(moved.distance>2);console.log('keyboard',moved);
  const physics=await page.evaluate(()=>{
   const a=myActor(),m=ASCENT_TRIAL.meta,scale=m.scale,boxes=COLLIDERS.filter(c=>c.ascent),base={x:a.pos.x,z:a.pos.z,y:a.y};
   let wall=null;
   for(const c of boxes){
    if(c.h-(c.y0||0)<3||c.maxZ-c.minZ<3)continue;
    const z=(c.minZ+c.maxZ)/2,x=c.minX-PR-.2,y=groundAt(x,z,7.5);
    if(y<1||y+1.8>c.h||y<(c.y0||0)||collideXZ(x,z,y,PR))continue;
    const p={x,z};for(let i=0;i<100;i++)moveWithSlide(p,.1,0,y,PR);
    wall={blocked:p.x+PR<=c.minX+.001,ray:WALL_T(x,y+1,z,1,0,0,10),distance:c.minX-x,x,z,y};break;
   }
   if(!wall)throw Error('No accessible test wall');
   // Actual hitscan: an enemy behind that same solid wall takes no damage.
   const target=world.actors.find(q=>q.team!==a.team);target.pos.set(wall.x+wall.distance+1,wall.y,wall.z);target.y=wall.y;target.hp=100;target.invuln=0;target.alive=true;
   actorHitscan(a,new T.Vector3(wall.x,wall.y+1,wall.z),new T.Vector3(1,0,0),{range:20,dmg:50,hs:1},false);
   wall.enemyHP=target.hp;
   // Traverse an actual linked route with the same input/physics as players.
   const route=findPath(MAP.attackSpawn.x,MAP.attackSpawn.z,MAP.defendSpawn.x,MAP.defendSpawn.z);
   const start=MAP.attackSpawn;a.pos.set(start.x,start.y,start.z);a.y=start.y;a.vy=0;a.onGround=true;a.root=0;a.slow=1;a.speedBuff=1;a.ads=false;
   let reached=0,maxY=a.y,minY=a.y;
   for(const p of route){
    for(let n=0;n<80&&Math.hypot(p.x-a.pos.x,p.z-a.pos.z)>.16;n++){
     a.yaw=Math.atan2(-(p.x-a.pos.x),-(p.z-a.pos.z));a.input.mv=[0,-1];a.input.btn=0;simMove(a,.0125);maxY=Math.max(maxY,a.y);minY=Math.min(minY,a.y);
    }
    if(Math.hypot(p.x-a.pos.x,p.z-a.pos.z)>.3)break;reached++;
   }
   a.input.mv=[0,0];a.vel.set(0,0,0);
   const endDistance=Math.hypot(a.pos.x-MAP.defendSpawn.x,a.pos.z-MAP.defendSpawn.z);
   let ceiling=null;
   for(const c of boxes){
    if(!c.y0||c.maxX-c.minX<2||c.maxZ-c.minZ<2)continue;
    const x=(c.minX+c.maxX)/2,z=(c.minZ+c.maxZ)/2,y=groundAt(x,z,c.y0-2.4);
    if(y<1||c.y0-y<2.31||c.y0-y>3.5||collideXZ(x,z,y,PR))continue;
    a.pos.set(x,y,z);a.y=y;a.vy=0;a.onGround=true;a.input.mv=[0,0];a.vel.set(0,0,0);a.input.btn=BTN.JUMP;let maxHead=y+2.3;
    for(let i=0;i<100;i++){simMove(a,.01);a.input.btn=0;maxHead=Math.max(maxHead,a.y+2.3);}
    ceiling={maxHead,underside:c.y0};break;
   }
   a.pos.set(base.x,base.y,base.z);a.y=base.y;a.vy=0;a.vel.set(0,0,0);a.input.btn=0;
   return{wall,ceiling,route:{length:route.length,reached,minY,maxY,endDistance}};
  });
  console.log('physics',JSON.stringify(physics));assert.ok(physics.wall.blocked);assert.ok(Math.abs(physics.wall.ray-physics.wall.distance)<.02);assert.equal(physics.wall.enemyHP,100);assert.equal(physics.route.reached,physics.route.length);assert.ok(physics.route.maxY-physics.route.minY>=.6,'real source elevation changes');
  assert.ok(physics.ceiling&&physics.ceiling.maxHead<=physics.ceiling.underside+.001,'jumping does not pass through an imported ceiling');
  const bots=await page.evaluate(()=>{
   ADMIN.freezeAI=false;world.phase='live';world.actors.forEach(a=>{a.invuln=999;a.abilities=[];if(a.ai)a.ai.skill=null;});
   const initial=world.actors.map(a=>({x:a.pos.x,z:a.pos.z}));
   for(let i=0;i<80;i++)netStep(.05);
   const moved=world.actors.filter((a,i)=>isAI(a)&&Math.hypot(a.pos.x-initial[i].x,a.pos.z-initial[i].z)>3).length;
   return{moved,total:world.actors.filter(isAI).length};
  });
  console.log('bots',bots);assert.ok(bots.moved>=4,'multiple bots follow imported terrain paths');
  await page.evaluate(()=>{world.phase='buy';world.roundTime=999;ADMIN.freezeAI=true;const a=myActor();a.yaw=Math.PI;a.pitch=.03;followCamera(a,.1);renderer.render(scene,camera);});
  await page.screenshot({path:'test-results/ascent-play.png'});
  const cleanup=await page.evaluate(()=>{
   const old=ASCENT_TRIAL.meshes.map(m=>m.geometry);let disposed=0;old.forEach(g=>g.addEventListener('dispose',()=>disposed++));
   loadMap('pogu');return{active:ASCENT_TRIAL.active,meshes:ASCENT_TRIAL.meshes.length,imported:COLLIDERS.filter(c=>c.ascent).length,disposed,expected:old.length,floor:floor.visible,cell:GRID.cell,key:CUR_MAP_KEY};
  });
  console.log('cleanup',cleanup);assert.equal(cleanup.active,false);assert.equal(cleanup.meshes,0);assert.equal(cleanup.imported,0);assert.equal(cleanup.disposed,cleanup.expected);assert.ok(cleanup.floor);assert.equal(cleanup.cell,2.5);
  await page.close();
  // The normal entry must not load the 7.8 MB trial data or change its catalog.
  const normal=await f.page('ascentnormal',{width:960,height:600});
  assert.deepEqual(await normal.evaluate(()=>({trial:!!window.ASCENT_TRIAL,map:!!MAPS.ascent_trial,requests:performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/maps/ascent/')).length})),{trial:false,map:false,requests:0});
  assert.deepEqual(f.errors,[]);console.log('Ascent: real keyboard movement, full route physics, wall/body and hitscan collision, cleanup, normal entry isolation passed');
 }finally{await f.browser.close();}
})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
