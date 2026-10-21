const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
// Explored selection and all four equipped skills against the supplied JAR's
// renderer, animation controller, PNGs and GeckoLib 1.20.1 before these checks.
(async()=>{const f=await fixture();try{
 fs.mkdirSync('test-results/neon-review',{recursive:true});const p=await f.page('neonfidelity',{width:1280,height:800},{},{bootTimeout:120000});
 const shaderErrors=[];p.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))shaderErrors.push(m.text());});
 await p.waitForFunction(()=>NEON_AGENT.ready()&&NEON_SKIN.status==='ready');
 await p.locator('#go-play').click();const card=p.locator('#sel-grid .acard').filter({has:p.locator('.acard-name',{hasText:/^네온$/})});await card.click();
 await p.waitForFunction(()=>document.querySelector('#sel-detail .det-img')?.naturalWidth>0);
 await card.locator('img').waitFor({state:'visible'});await p.waitForFunction(()=>[...document.querySelectorAll('#sel-grid .acard')].find(n=>n.textContent.includes('전광석화'))?.querySelector('img')?.naturalWidth>0);
 assert.ok(await p.evaluate(()=>agentPortrait(NEON_AGENT.agent,420,520)===document.querySelector('#sel-detail .det-img').src),'selected portrait uses the actual source skin model');
 await p.screenshot({path:'test-results/neon-review/source-selection.png'});
 // the source skin is checked as the round body (its own pictures on the parts); the cube body that replaces it is checked by test:blocky
 await p.evaluate(()=>{window.BLOCKY_OFF=true;});
 await p.evaluate(()=>{room.map='pogu';room.mode='std';});await p.locator('#sel-go').click();
 await p.waitForFunction(()=>myActor()?.agent.id==='neon_agent');
 await p.evaluate(()=>{closeShop();ADMIN.freezeAI=true;world.phase='live';world.roundTime=999;for(const a of world.actors){a.invuln=999;a.fireCd=999;}const a=myActor();a.yaw=0;a.pitch=0;followCamera(a,.1);requestAnimationFrame=()=>0;});
 await p.locator('#cv').click({force:true});await p.waitForFunction(()=>document.pointerLockElement===document.getElementById('cv'));
 const appearance=await p.evaluate(()=>{const m=myActor().model,meshes=[];m.group.traverse(n=>{if(n.isMesh&&n.userData.neonSkin)meshes.push(n);});const skin=NEON_AGENT.sourceSkin();return {count:meshes.length,allVisible:meshes.every(n=>n.visible),allSource:meshes.every(n=>n.material.map===skin),pixels:[skin.image.width,skin.image.height],gun:!!m.gun.parent,head:meshes.some(n=>n.name==='neon-source-head'),shirt:meshes.some(n=>n.name==='neon-source-body'),boots:meshes.some(n=>n.name==='neon-source-shin-1')};});
 assert.deepEqual(appearance,{count:20,allVisible:true,allSource:true,pixels:[64,64],gun:true,head:true,shirt:true,boots:true});
 await p.evaluate(()=>{
  window.neonFrame=()=>{tickViewmodel(.016);const root=myActor().ultW?VM.current:VM.root.getObjectByName('neon-skill-arms'),rig=root?.userData.rig,motion=root?.userData.neonMotion;renderer.render(scene,camera);return {visible:!!root?.visible,root:root?.position.toArray(),scale:rig?.scale.toArray(),position:rig?.position.toArray(),motion,right:rig?.getObjectByName('phantom-bone-Right Arm')?.position.toArray(),leftRotation:rig?.getObjectByName('phantom-bone-Left Arm')?.rotation.toArray().slice(0,3)};};
 });
 const checkView=frame=>{assert.deepEqual(frame.scale,[.02875,.02875,.02875]);frame.position.forEach((v,i)=>assert.ok(Math.abs(v-[-.02,-.5754,-.35][i])<1e-10));};
 await p.keyboard.press('e');let frame=await p.evaluate(()=>{myActor().__neonClipT=.3;return neonFrame();});assert.equal(frame.motion.clip,'Neon_E Ready');assert.equal(frame.motion.charged,1);checkView(frame);
 await p.screenshot({path:'test-results/neon-review/source-gear.png'});
 await p.evaluate(()=>{myActor().__neonClipT=.7;myActor().vel.set(1,0,0);});
 const run=await p.evaluate(()=>{const a=neonFrame();for(let i=0;i<8;i++)tickViewmodel(.03);const b=neonFrame();return {a,b};});assert.equal(run.a.motion.clip,'Neon_E_Running');assert.ok(run.b.motion.time>run.a.motion.time,'running progresses instead of staying on one pose');
 await p.keyboard.press('c');frame=await p.evaluate(()=>{myActor().__neonClipT=.9;myActor().vel.set(0,0,0);return neonFrame();});assert.equal(frame.motion.clip,'Neon_C','full C clip survives beyond .6s while High Gear is active');
 await p.screenshot({path:'test-results/neon-review/source-lane.png'});
 await p.keyboard.press('q');frame=await p.evaluate(()=>{myActor().__neonClipT=.55;return neonFrame();});assert.equal(frame.motion.clip,'Neon_Q');assert.ok(frame.motion.charged>0&&frame.motion.charged<1,'source Q texture fade is applied');
 await p.screenshot({path:'test-results/neon-review/source-relay.png'});
 const reset=await p.evaluate(()=>{const a=myActor();a.__neonClip='Neon_E Ready';a.__neonClipT=.2;return neonFrame();});assert.ok(reset.leftRotation.every(v=>Math.abs(v)<1e-12),'missing tracks reset; Q left-arm rotation cannot leak into E');
 await p.evaluate(()=>{myActor().ultCharge=myActor().ultMax;});await p.keyboard.press('x');
 frame=await p.evaluate(()=>{myActor().ultW.t=19.7;return neonFrame();});assert.equal(frame.motion.clip,'Neon_ULT');assert.ok(frame.motion.charged>0&&frame.motion.charged<1);checkView(frame);assert.deepEqual(frame.root,[0,0,0],'source camera transform is not offset by the generic gun pose');
 await p.screenshot({path:'test-results/neon-review/source-ultimate-cast.png'});
 const use=await p.evaluate(()=>{myActor().ultW.t=18.54;const first=neonFrame();myActor().ultW.t=18.2;const later=neonFrame();return {first,later};});
 assert.equal(use.first.motion.clip,'Neon_ULT_On_Use');assert.ok(use.first.motion.time<.1);assert.ok(use.later.motion.time>.3);assert.notDeepEqual(use.first.right,use.later.right,'source ready motion advances instead of jumping to its last frame');
 await p.mouse.down();frame=await p.evaluate(()=>{const a=myActor();a.ultW.cd=0;actorFire(a);return neonFrame();});await p.mouse.up();assert.equal(frame.motion.clip,'Neon_ULT_Fire_Hold');assert.ok(frame.motion.time<.01);
 frame=await p.evaluate(()=>{myActor().ultW.t-=.15;return neonFrame();});assert.equal(frame.motion.clip,'Neon_ULT_Fire_Recover','release plays the authored recoil recovery');
 await p.screenshot({path:'test-results/neon-review/source-ultimate-recover.png'});
 await p.evaluate(()=>{myActor().ultW.t-=.4;neonFrame();});assert.equal(await p.evaluate(()=>VM.current.userData.neonMotion.clip),'Neon_ULT_On_Use');
 await p.evaluate(()=>{endUltW(myActor());NEON_AGENT.clear(myActor());tickViewmodel(.016);});assert.ok(await p.evaluate(()=>!VM.root.getObjectByName('neon-skill-arms').visible&&VM.current.visible));
 // Exercise the requested input transition with forward held: one click slides,
 // never fires that same click, and restores the weapon after exactly 6m.
 await p.evaluate(()=>{
  abilClear();const a=myActor();a.y=0;a.yaw=0;a.pitch=0;a.weapons.primary='rifle';a.slot='primary';a.ammo.rifle=30;a.fireCd=0;
  for(const b of world.actors)if(b!==a)b.pos.set(80+b.id*3,0,80);
  let found=false;for(let x=MAP.bounds.minX+10;x<=MAP.bounds.maxX-10&&!found;x+=3)for(let z=MAP.bounds.minZ+10;z<=MAP.bounds.maxZ-10&&!found;z+=3){let clear=true;for(let d=0;d<=8;d+=.15)if(collideXZ(x,z-d,.45,.3)){clear=false;break;}if(clear){a.pos.set(x,0,z);found=true;}}
  if(!found)throw new Error('No clear sliding lane');a.onGround=true;a.vel.set(0,0,0);a.abilities[1].cd=0;a.abilities[1].charges=1;world.phase='live';
 });
 await p.keyboard.press('e');await p.keyboard.down('w');await p.mouse.down();
 const slide=await p.evaluate(()=>{
  const a=myActor(),before=a.pos.clone();a.input=gatherInput();actorFire(a);const pose=neonFrame();
  const started=a.__neonSlide>0&&a.__neonGear===0;
  for(let i=0;i<18&&a.__neonSlide>0;i++){world.phase='live';step(.05);}
  const distance=a.pos.distanceTo(before);actorFire(a);const ammo=a.ammo.rifle;const restored=neonFrame();
  return {started,pose:pose.visible,distance,ended:a.__neonSlide===0,gear:a.__neonGear,ammo,restored:!restored.visible&&VM.current.visible};
 });
 await p.keyboard.up('w');await p.mouse.up();assert.ok(slide.started);assert.ok(slide.pose);assert.ok(Math.abs(slide.distance-6)<.15,JSON.stringify(slide));assert.ok(slide.ended);assert.equal(slide.gear,0);assert.equal(slide.ammo,30);assert.ok(slide.restored);
 await p.evaluate(()=>{const a=myActor();a.input=gatherInput();world.phase='live';step(.01);});
 await p.mouse.down();await p.evaluate(()=>{const a=myActor();a.fireCd=0;actorFire(a);});await p.mouse.up();assert.equal(await p.evaluate(()=>myActor().ammo.rifle),29,'a fresh click fires normally after the slide');
 const effects=await p.evaluate(()=>{
  const a=myActor();abilClear();CAST_EXT.neon_lane();abilTick(.2);
  const preview=scene.getObjectByName('neon-lane-preview');const previewOk=preview?.children.some(m=>m.material.uniforms.textured.value);
  abilTick(.21);abilTick(.6);const walls=scene.children.filter(n=>n.name==='neon-fastlane');renderer.render(scene,camera);
  const source=walls.length>=2&&walls.every(n=>n.userData.neonSourceEffects&&n.children.some(m=>m.geometry.drawRange.count>2000));
  window.neonWalls=walls;return {preview:!!previewOk,source};
 });assert.deepEqual(effects,{preview:true,source:true});
 await p.screenshot({path:'test-results/neon-review/source-lane-world.png'});
 await p.evaluate(()=>{abilClear();myActor().pitch=-.35;followCamera(myActor(),.1);CAST_EXT.neon_relay();abilTick(.45);renderer.render(scene,camera);});
 assert.ok(await p.evaluate(()=>scene.getObjectByName('neon-relaybolt')?.children.some(n=>n.geometry.drawRange.count>10000)));
 await p.screenshot({path:'test-results/neon-review/source-bolt-world.png'});
 const charge=await p.evaluate(()=>{for(let i=0;i<30&&!scene.getObjectByName('neon-relay-charge');i++)abilTick(.01);const g=scene.getObjectByName('neon-relay-charge');abilTick(.72);renderer.render(scene,camera);return !!g?.userData.neonSourceEffects;});assert.ok(charge);
 await p.screenshot({path:'test-results/neon-review/source-shock-world.png'});
 await p.evaluate(()=>abilClear());assert.equal(await p.evaluate(()=>NEON_EFFECTS.active.size),0,'all GPU effects and world blockers are disposed');
 assert.deepEqual(shaderErrors,[]);assert.deepEqual(f.errors,[]);
 console.log('Neon fidelity: source-skin selection/body, 64px textures, native coordinate/UV/camera transform, real E/C/Q/X input, source charge fades, running, full cast duration, reset and ultimate fire/recover passed. Browser + memory API only; no Android or purchase checks.');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
