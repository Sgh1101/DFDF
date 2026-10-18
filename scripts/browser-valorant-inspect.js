const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
// Explored actual Y input and the Inspect button with all six equipped skins.
// Advance the real viewmodel clock deterministically between input events.
(async()=>{const f=await fixture();try{
 const id='knifeinspect';await f.h.api('auth',{id,pw:'password',device:'browser-test-'+id});
 const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'knifeinspect-owner'});
 for(const name of ['desire_blade','eternal_axe','eternal_karambit','future_butterfly','future_dagger','thunder_hammer'])await f.h.api('a_user_set',{atoken:owner.atoken,id,op:'grant',item:'knife|vp_'+name});
 const p=await f.page(id,{width:1280,height:720},{},{bootTimeout:120000});
 await p.waitForFunction(()=>VALORANT_PACK.status==='ready',null,{timeout:120000});
 await p.evaluate(()=>{room.map='pogu';startGame(AGENTS[0],true);closeShop();ADMIN.freezeAI=true;world.phase='buy';world.roundTime=999;const a=myActor();a.weapons.secondary='knife';a.slot='secondary';a.yaw=0;a.pitch=0;followCamera(a,.1);window.requestAnimationFrame=()=>0;});
 await p.locator('#cv').click({force:true});await p.waitForFunction(()=>document.pointerLockElement===document.getElementById('cv'));
 const skins=await p.evaluate(()=>VALORANT_DATA.knives.map(s=>s.id));
 const stats=await p.evaluate(()=>JSON.stringify(WEAPONS.knife));
 await p.evaluate(()=>{
  window.inspectStep=seconds=>{for(let left=seconds;left>1e-9;left-=.01)tickViewmodel(Math.min(.01,left));};
  window.inspectState=()=>{VM.current.updateWorldMatrix(true,true);const bones=[];let sourceHand;VM.current.traverse(n=>{if(n.userData.sourceBone)bones.push([n.userData.sourceBone,...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]);if(n.userData.sourceBone==='righthand')sourceHand=n;});const group=VM.current.getObjectByName('valorant-agent-hand'),glove=group.children.find(n=>n.geometry?.type==='SphereGeometry'&&n.geometry.parameters.radius===.043);return {clip:VALORANT_PACK.clip,time:VALORANT_PACK.clipTime,legacy:SKIN_PERKS.state.insp.t,bones,hand:group.matrix.toArray(),gripError:sourceHand.getWorldPosition(new T.Vector3()).distanceTo(glove.getWorldPosition(new T.Vector3()))};};
 });
 for(const skin of skins){
  const equip=await p.evaluate(skin=>{GUN_SKINS.set('knife',skin);updateViewmodel(true);inspectStep(8);let scale;VM.current.traverse(n=>{if(n.childrenWithBones)scale=n.scale.toArray();});return {duration:VALORANT_PACK.items.get(skin.slice(3)).animations.inspect.animation_length,scale};},skin),duration=equip.duration;
  assert.deepEqual(equip.scale,[.072,.072,.072],skin+' is uniformly 1.6 times the original .045 scale');
  const idle=await p.evaluate(()=>inspectState());assert.equal(idle.clip,'static_idle');
  await p.keyboard.press('y');
  const sample=await p.evaluate(()=>{inspectStep(.83);renderer.render(scene,camera);return inspectState();});
  assert.equal(sample.clip,'inspect',skin+' real Y starts the supplied inspect');assert.equal(sample.legacy,-1,'no second procedural inspect');
  assert.notDeepEqual(sample.bones,idle.bones,skin+' source bones animate');assert.notDeepEqual(sample.hand,idle.hand,skin+' agent glove follows the source hand');
  assert.ok(sample.gripError<1e-6,skin+' glove stays on the actual animated source grip: '+sample.gripError);
  await p.screenshot({path:'test-results/inspect-'+skin+'.png'});
  for(const [step,frame] of [[.97,'1.8'],[1.2,'3.0']]){
   const gripError=await p.evaluate(step=>{inspectStep(step);renderer.render(scene,camera);return inspectState().gripError;},step);
   assert.ok(gripError<1e-6,skin+' keeps contact with the source grip at '+frame+'s');
   await p.screenshot({path:'test-results/inspect-'+skin+'-'+frame+'.png'});
  }
  const tail=await p.evaluate(duration=>{inspectStep(duration-3.05);return inspectState();},duration);
  assert.equal(tail.clip,'inspect',skin+' uses its full source duration of '+duration+'s');assert.ok(tail.time>duration-.08);
  const ended=await p.evaluate(()=>{inspectStep(.1);return inspectState();});
  assert.equal(ended.clip,'static_idle');assert.deepEqual(ended.bones,idle.bones,skin+' all source bones return to idle');
  ended.hand.forEach((v,i)=>assert.ok(Math.abs(v-idle.hand[i])<1e-8,skin+' glove returns to its idle fit'));
  await p.waitForFunction(skin=>{const item=VALORANT_PACK.items.get(skin.slice(3));return Object.values(item.animations.inspect.sound_effects||{}).every(({effect})=>VALORANT_PACK.audioPlayed.some(path=>path.endsWith('/'+(effect.includes(':')?effect.split(':')[1]:'melee/'+item.id+'/'+effect)+'.ogg')));},skin,{timeout:20000});
  await p.keyboard.down('y');await p.evaluate(()=>inspectStep(.2));await p.keyboard.down('y');await p.keyboard.up('y');
  assert.equal(await p.evaluate(()=>{inspectStep(.01);return VALORANT_PACK.clip;}),'inspect','held Y does not cancel or restart');
  await p.keyboard.press('y');assert.equal(await p.evaluate(()=>{inspectStep(.01);return VALORANT_PACK.clip;}),'static_idle','second Y cancels');
  await p.locator('#tb-inspect').dispatchEvent('click');
  assert.equal(await p.evaluate(()=>{inspectStep(.1);return VALORANT_PACK.clip;}),'inspect','Inspect button uses the same source animation');
  await p.mouse.down();
  const attack=await p.evaluate(()=>{world.phase='live';myActor().fireCd=0;actorFire(myActor());inspectStep(.02);return {clip:VALORANT_PACK.clip,fire:keys.fire};});
  await p.mouse.up();assert.ok(attack.fire);assert.equal(attack.clip,'melee_1','real attack cancels inspect immediately');
  await p.evaluate(()=>{world.phase='buy';inspectStep(1);});
  console.log(skin+': source inspect '+duration+'s, animated hand, end/rest, Y toggle, button and attack cancellation passed');
 }
 // Overlay, death and weapon changes cannot leave a source inspect running.
 for(const state of ['ads','reload','death','pause','shop']){
  await p.keyboard.press('y');
  const clip=await p.evaluate(state=>{if(state==='ads')player.ads=true;if(state==='reload')player.reloading=1;if(state==='death')player.alive=false;if(state==='pause'||state==='shop')document.getElementById(state).hidden=false;inspectStep(.01);const clip=VALORANT_PACK.clip;player.ads=false;player.reloading=0;player.alive=true;document.getElementById('pause').hidden=true;document.getElementById('shop').hidden=true;inspectStep(1);return clip;},state);
  assert.notEqual(clip,'inspect',state+' cancels source inspect');
 }
 await p.keyboard.press('y');
 await p.evaluate(()=>{myActor().weapons.primary='carbine';myActor().slot='primary';updateViewmodel(true);inspectStep(1);myActor().slot='secondary';updateViewmodel(true);inspectStep(3);});
 assert.equal(await p.evaluate(()=>VALORANT_PACK.clip),'static_idle','switching back does not resume the old inspect');
 assert.equal(await p.evaluate(()=>JSON.stringify(WEAPONS.knife)),stats,'cosmetic motion preserves combat stats');assert.deepEqual(f.errors,[]);
 console.log('Six imported knives: actual in-game Y input and DOM Inspect-button route passed in Chromium. Memory API grants; no Android or purchase checks.');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
