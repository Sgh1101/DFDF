const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
(async()=>{const f=await fixture();try{
 const p=await f.page('ascentabilities',{width:1280,height:720});
 const warnings=[];p.on('console',m=>{if(m.type()==='warning'&&/^(abil |ability |cast )/.test(m.text()))warnings.push(m.text());});
 await p.locator('#go-play').click();await p.locator('#sel-grid .acard').filter({hasText:'단비'}).click();if(await p.locator('#sel-pick').isVisible())await p.locator('#sel-pick').click();await p.locator('#sel-maps button').filter({hasText:/^마크X발로$/}).click();
 await p.waitForFunction(()=>ASCENT_TRIAL.status==='ready',null,{timeout:120000});await p.locator('#sel-go').click({timeout:120000});
 await p.waitForFunction(()=>ASCENT_TRIAL.active&&!!myActor());
 const actual=await p.evaluate(()=>{closeShop();ADMIN.freezeAI=true;world.phase='live';world.phaseT=999;const me=myActor();me.invuln=999;return{floor:me.y,ground:abilityGroundY(me.pos.x,me.pos.z),q:me.abilities[0].charges};});
 assert.ok(actual.floor>1);assert.ok(Math.abs(actual.floor-actual.ground)<.01);
 // Async terrain loading can outlast the deploy button's activation. Follow the
 // visible click-to-play path: keyboard abilities are gated on pointer capture.
 const continueButton=p.getByRole('button',{name:'계속하기',exact:true});if(await continueButton.isVisible())await continueButton.click();
 if(!await p.evaluate(()=>document.pointerLockElement===document.getElementById('cv')))await p.locator('#cv').click({force:true});
 await p.waitForFunction(()=>document.pointerLockElement===document.getElementById('cv'));
 await p.keyboard.down('q');try{await p.waitForFunction(n=>myActor().abilities[0].charges===n-1,actual.q);}finally{await p.keyboard.up('q');}
 await p.waitForFunction(()=>myActor().onGround&&Math.abs(myActor().y-groundAt(myActor().pos.x,myActor().pos.z,myActor().y))<.01);
 const result=await p.evaluate(async()=>{
  render=()=>{};titleCam=()=>{};const me=myActor(),base={x:me.pos.x,z:me.pos.z,y:me.y},enemy=world.actors.find(a=>a.team!==me.team),out={};
  const reset=()=>{window.AGENTS3?.pick(null);NET.mode='solo';startRound();closeShop();world.phase='live';world.phaseT=999;me.pos.set(base.x,base.y,base.z);me.y=base.y;me.alive=true;me.invuln=999;me.pitch=-.55;me.ultW=null;me.yaw=0;me.hp=100;CAST_REFUND=false;
   for(const [i,a]of world.actors.filter(a=>a!==me).entries()){a.pos.x=base.x+50+i*2;a.pos.z=base.z;a.y=base.y;a.alive=true;a.hp=100;a.invuln=999;}
  };
  reset();
  // Real terrain, no ray/ground/physics stubs. Every current definition can cast here.
  out.casts=[];for(const agent of AGENTS)for(const def of agent.abilities){reset();me.agent=agent;castAbility(def.type,def);for(let i=0;i<10;i++)abilTick(.05);updateZones(.05);updateProps(.05);out.casts.push(def.type);abilClear();}
  reset();const zone=makeZone(base.x,base.z,3,1.2,10,0xff3333,{dps:20});out.zone={y:zone.y,mesh:zone.mesh.position.y};
  enemy.pos.x=base.x+.5;enemy.pos.z=base.z;enemy.invuln=0;enemy.armor=0;enemy.shielded=0;enemy.undying=0;enemy.hp=100;
  enemy.y=base.y+6;updateZones(.2);out.zone.upper=enemy.hp;enemy.y=base.y;updateZones(.2);out.zone.same=enemy.hp;
  reset();let triggered=0;makeTrap(base.x,base.z,2,0xffcc00,()=>triggered++,false);const trap=world.props.find(p=>p.type==='trap');out.trap={y:trap.y,mesh:trap.mesh.position.y,ring:trap.ring.position.y};
  enemy.pos.x=base.x+.5;enemy.pos.z=base.z;enemy.y=base.y+6;updateProps(.1);out.trap.upper=triggered;enemy.y=base.y;updateProps(.1);out.trap.same=triggered;
  reset();const smoke=makeSmoke({x:base.x+8,z:base.z,y:base.y},3,5,0x8899aa);out.smoke={y:smoke.y,mesh:smoke.mesh.position.y,ground:abilityGroundY(smoke.x,smoke.z,base.y)};
  reset();const wall=addBox(base.x+1,base.z,1,1,3,new T.MeshBasicMaterial(),{temp:true,hp:100});out.wall={y:wall.y0,h:wall.h,mesh:wall.mesh.position.y};destroyCollider(wall);
  out.warp=AGENTS3.standAt(base.x,base.z);if(!out.warp)throw Error('Navigator cannot select the actual street');
  // Ground effects share the movement solver's support footprint at slab seams.
  const street=ASCENT_TRIAL.nav.main.slice(0,200).map(i=>{const p=cellCenter(i%GRID.cols,Math.floor(i/GRID.cols));return{...p,y:ASCENT_TRIAL.nav.height[i]};});
  out.groundSamples=street.map(p=>Math.abs(ASCENT_TRIAL.groundY(p.x,p.z,p.y)-groundAt(p.x,p.z,p.y)));
  reset();const def={key:'E',name:'레이저 포탑',type:'x_laser_turret',cost:0,charges:1,cd:30};const before=new Set(scene.children);castAbility(def.type,def);abilTick(.1);out.turret=scene.children.filter(m=>!before.has(m)&&m.isGroup&&m.children.some(c=>c.geometry?.type==='CylinderGeometry')).map(m=>m.position.y);
  out.qualityGround=[];
  for(const mode of GRAPHICS_SETTINGS.order){
    setQuality(mode);await ASCENT_TRIAL.graphicsReady;
    const heights=new Map();for(const i of ASCENT_TRIAL.nav.main){const y=ASCENT_TRIAL.nav.height[i],bucket=Math.round(y*2);if(!heights.has(bucket))heights.set(bucket,i);if(heights.size>=12)break;}
    for(const i of heights.values()){reset();const p=cellCenter(i%GRID.cols,Math.floor(i/GRID.cols));me.pos.x=p.x;me.pos.z=p.z;me.y=ASCENT_TRIAL.nav.height[i];
      const ground=groundAt(p.x,p.z,me.y),z=makeZone(p.x,p.z,1,1,2,0xff5500,{dps:20});
      enemy.pos.x=p.x;enemy.pos.z=p.z;enemy.y=ground+6;enemy.hp=100;enemy.invuln=0;enemy.armor=0;updateZones(.1);
      out.qualityGround.push({mode,ground,zone:z.y,mesh:z.mesh.position.y,upper:enemy.hp});
    }
  }
  reset();makeZone(base.x,base.z,3,1.2,8,0xff3333,{dps:0});makeTrap(base.x+1,base.z,2,0xffcc00,()=>{},false);camera.position.set(base.x+5,base.y+6,base.z+8);camera.lookAt(base.x,base.y,base.z);renderer.render(scene,camera);
  out.floor=base.y;return out;
 });
 assert.ok(result.qualityGround.length>=4);assert.equal(new Set(result.qualityGround.map(r=>r.mode)).size,4);for(const r of result.qualityGround){assert.equal(r.zone,r.ground);assert.equal(r.mesh,r.ground);assert.equal(r.upper,100);}
 assert.equal(result.casts.length,112);assert.equal(result.zone.y,result.floor);assert.equal(result.zone.mesh,result.floor);assert.equal(result.zone.upper,100);assert.ok(result.zone.same<100);
 assert.equal(result.trap.y,result.floor);assert.ok(Math.abs(result.trap.mesh-result.floor-.25)<.001);assert.ok(Math.abs(result.trap.ring-result.floor-.07)<.001);assert.equal(result.trap.upper,0);assert.equal(result.trap.same,1);
 assert.equal(result.smoke.y,result.smoke.ground);assert.equal(result.smoke.mesh,result.smoke.y);assert.equal(result.wall.y,result.floor);assert.equal(result.wall.h,result.floor+3);assert.equal(result.wall.mesh,result.floor+1.5);
 assert.ok(result.warp.y>0&&Math.abs(result.warp.y-result.floor)<.7);
 assert.ok(result.groundSamples.every(e=>e<.01));assert.ok(result.turret.length>0&&result.turret.every(y=>y>=result.floor-.1));
 const resume=p.getByRole('button',{name:'계속하기',exact:true});if(await resume.isVisible())await resume.click();
 fs.mkdirSync('test-results',{recursive:true});await p.screenshot({path:'test-results/ascent-ability-after.png'});
 const normal=await p.evaluate(()=>{loadMap('pogu');return{ground:abilityGroundY(10,10,30),physical:groundAt(10,10,30),active:ASCENT_TRIAL.active};});assert.equal(normal.ground,normal.physical);assert.equal(normal.active,false);
 assert.deepEqual(f.errors,[]);assert.deepEqual(warnings,[]);console.log('Ascent abilities:',JSON.stringify({...result,casts:result.casts.length,groundSamples:result.groundSamples.length}));
}finally{await f.browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
