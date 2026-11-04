// Authored after exploring the actual RGX armory card, equipped mesh and original hand sockets.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('./browser-fixture');
(async()=>{
  const f=await fixture(),out=process.env.SHOT_DIR||'test-results/skin-correction/rgx';fs.mkdirSync(out,{recursive:true});
  try{
    const p=await f.page('rgxcheck',{width:1280,height:720});
    await p.waitForFunction(()=>RGX_FIREFLY.state!=='loading');assert.equal(await p.evaluate(()=>RGX_FIREFLY.state),'ready');
    const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'rgx-check-owner'});
    await f.h.api('a_user_set',{atoken:owner.atoken,id:'rgxcheck',op:'grant',item:'knife|butterfly'});await p.evaluate(()=>GUN_SKINS.sync());
    await p.evaluate(()=>{window.__rgxProofRender=render;render=()=>{};titleCam=()=>{};GUN_SKINS.open('knife','gun');});
    await p.locator('[data-s="butterfly"]').click();
    await p.waitForFunction(()=>GUN_SKINS._pv()?.obj?.getObjectByName('phantom-bone-up'));
    assert.equal(await p.evaluate(()=>GUN_SKINS.of('knife').id),'butterfly');
    for(const [label,w,h]of[['desktop',1280,720],['phone',844,390]]){
      await p.setViewportSize({width:w,height:h});
      await p.waitForFunction(()=>{const P=GUN_SKINS._pv(),cv=document.getElementById('ar-cv');return cv.width===Math.round(cv.clientWidth*P.r.getPixelRatio())&&Math.abs(P.d-P.dist)<.02;});
      const visible=await p.evaluate(()=>{const r=$('ar-cv').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});
      assert.ok(visible.x>=-1&&visible.y>=-1&&visible.right<=w+1&&visible.bottom<=h+1&&visible.w>100&&visible.h>70,JSON.stringify(visible));
      await p.screenshot({path:path.join(out,label+'-armory.png')});
    }
    await p.setViewportSize({width:1280,height:720});
    await p.evaluate(()=>{
      window.__rgxIdleGrips=new WeakMap();const original=vmWithHands;
      vmWithHands=function(){const root=original.apply(this,arguments),parts=root?.children.filter(n=>n.userData.armPart);if(parts?.[3])__rgxIdleGrips.set(root,parts[3].position.clone());return root;};
      GUN_SKINS.close();room.mode='std';room.map='glacier';startGame(AGENTS[0],false);closeShop();ADMIN.freezeAI=true;world.phase='live';world.roundTime=999;
      GUN_SKINS.set('knife','butterfly');player.slot=Object.keys(player.weapons).find(s=>player.weapons[s]==='knife');updateViewmodel(true);followCamera(myActor(),.016);
      for(let i=0;i<160;i++)tickViewmodel(.02);
    });
    const held=await p.evaluate(()=>{
      const root=VM.current,hand=root.getObjectByName('phantom-bone-righthand'),grip=__rgxIdleGrips.get(root);root.updateWorldMatrix(true,true);
      const sourceGrip=root.worldToLocal(hand.getWorldPosition(new T.Vector3()));
      let cubes=0,maps=true,finite=true;root.traverse(n=>{if(n.userData.rgxRig)n.traverse(m=>{if(m.isMesh){cubes+=m.geometry.attributes.position.count/36;maps&&=m.material.map?.name==='rgx-firefly-original'&&m.material.color.getHex()===0xffffff;for(const v of m.geometry.attributes.position.array)finite&&=Number.isFinite(v);}});});
      return {model:KNIVES.model(),gap:grip?sourceGrip.distanceTo(grip):null,cubes,maps,finite,bound:!!root.getObjectByName('rgx-agent-hand'),clip:RGX_FIREFLY.clip};
    });
    console.log('held',JSON.stringify(held));assert.equal(held.model,'rgx_butterfly');assert.ok(held.gap!==null&&held.gap<.005,'the idle source socket must meet the existing agent grip');assert.ok(held.bound&&held.maps&&held.finite&&held.cubes>150);
    const motion=await p.evaluate(()=>{
      const root=VM.current,handle=root.getObjectByName('phantom-bone-up'),idle=handle.quaternion.clone();let travel=0,finite=true;
      SKIN_PERKS.state.insp.t=0;for(let i=0;i<340;i++){tickViewmodel(.02);travel=Math.max(travel,idle.angleTo(handle.quaternion));root.traverse(n=>{if(n.userData.rgxBone)finite&&=[...n.position.toArray(),...n.quaternion.toArray()].every(Number.isFinite);});}
      SKIN_PERKS.state.insp.t=-1;tickViewmodel(.02);
      return {travel,finite,returnAngle:idle.angleTo(handle.quaternion),duration:KNIVES.inspD(KNIVES.model()),clip:RGX_FIREFLY.clip};
    });
    console.log('motion',JSON.stringify(motion));assert.ok(motion.travel>.5&&motion.finite&&motion.returnAngle<1e-6);assert.equal(motion.duration,6.5);assert.equal(motion.clip,'static_idle');
    const replay=await p.evaluate(()=>{
      const root=VM.current,knifeSlot=player.slot,otherSlot=Object.keys(player.weapons).find(s=>player.weapons[s]!=='knife');
      if(!otherSlot)throw Error('A second weapon is required to verify cached re-equipment');
      player.slot=otherSlot;updateViewmodel(true);tickViewmodel(.02);
      player.slot=knifeSlot;updateViewmodel(true);tickViewmodel(.02);
      const cached=VM.current===root,draw=RGX_FIREFLY.clip;for(let i=0;i<110;i++)tickViewmodel(.02);
      for(let i=0;i<3;i++)viewmodelFireKick();for(let i=0;i<135;i++)tickViewmodel(.02);
      const third=RGX_FIREFLY.clip;for(let i=0;i<20;i++)tickViewmodel(.02);
      return {cached,draw,third,rest:RGX_FIREFLY.clip};
    });
    console.log('re-equipment and attack',JSON.stringify(replay));assert.ok(replay.cached);assert.equal(replay.draw,'draw');assert.equal(replay.third,'melee_3');assert.equal(replay.rest,'static_idle');
    await p.evaluate(()=>{followCamera(myActor(),.016);window.__rgxProofRender();});await p.screenshot({path:path.join(out,'held.png')});
    assert.deepEqual(f.errors,[]);console.log('RGX source preview, ownership, grip alignment, original inspect and exact rest pose passed (desktop and mobile viewport)');
  }finally{await f.browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
