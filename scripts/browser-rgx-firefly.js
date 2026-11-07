// Covers the SGH armory card, equipped mesh, wrist binding and audio output.
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
      let cubes=0,maps=true,finite=true;root.traverse(n=>{if(n.userData.rgxRig)n.traverse(m=>{if(m.isMesh){cubes+=m.geometry.attributes.position.count/36;maps&&=m.material.map?.name==='sgh-butterfly'&&m.material.color.getHex()===0xffffff;for(const v of m.geometry.attributes.position.array)finite&&=Number.isFinite(v);}});});
      return {model:KNIVES.model(),gap:grip?sourceGrip.distanceTo(grip):null,cubes,maps,finite,bound:!!root.getObjectByName('rgx-agent-hand'),clip:RGX_FIREFLY.clip,idle:root.getObjectByName('phantom-bone-up').quaternion.toArray()};
    });
    console.log('held',JSON.stringify(held));assert.equal(held.model,'rgx_butterfly');assert.ok(held.gap!==null&&held.gap<.005,'the SGH wrist socket meets the existing agent grip');assert.ok(held.bound&&held.maps&&held.finite&&held.cubes>120,'the held knife is the textured SGH butterfly: '+held.cubes+' cubes');
    const sounds=await p.evaluate(async()=>{
      const ctx=GAME_AUDIO.context(),results=[];
      for(const [name,bytes] of RGX_FIREFLY.bytes){
        if(!name.endsWith('.wav'))continue;
        const decoded=await ctx.decodeAudioData(bytes.slice(0)),samples=decoded.getChannelData(0);
        const rms=Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);
        results.push({name,rms,duration:decoded.duration});
      }
      SETTINGS.sfx=true;
      return results;
    });
    assert.equal(sounds.length,8);
    assert.ok(sounds.every(({rms,duration})=>rms>.002&&duration>.3),JSON.stringify(sounds));
    await p.keyboard.press('y');
    assert.ok(await p.evaluate(()=>SKIN_PERKS.state.insp.t>=0),'the inspect key starts the animation');
    await p.evaluate(()=>{for(let i=0;i<28;i++)tickViewmodel(.02);});
    await p.waitForFunction(()=>[...RGX_FIREFLY.voices].some(v=>Math.abs(v.buffer.duration-4.35)<.02));
    await p.evaluate(()=>{window.__rgxProofRender();});
    await p.screenshot({path:path.join(out,'held-inspect.png')});
    const motion=await p.evaluate(idlePose=>{
      const root=VM.current,handle=root.getObjectByName('phantom-bone-up'),idle=new T.Quaternion().fromArray(idlePose);
      const socket=root.getObjectByName('phantom-bone-righthand'),hand=root.getObjectByName('rgx-agent-hand'),grip=__rgxIdleGrips.get(root);
      const from=new T.Vector3(),to=new T.Vector3();
      let travel=0,finite=true,maxGripGap=0;
      for(let i=0;i<340;i++){
        tickViewmodel(.02);travel=Math.max(travel,idle.angleTo(handle.quaternion));
        maxGripGap=Math.max(maxGripGap,socket.getWorldPosition(from).distanceTo(hand.localToWorld(to.copy(grip))));
        root.traverse(n=>{if(n.userData.rgxBone)finite&&=[...n.position.toArray(),...n.quaternion.toArray()].every(Number.isFinite);});
      }
      return {travel,finite,maxGripGap,returnAngle:idle.angleTo(handle.quaternion),duration:KNIVES.inspD(KNIVES.model()),clip:RGX_FIREFLY.clip};
    },held.idle);
    console.log('motion',JSON.stringify(motion));assert.ok(motion.travel>.5&&motion.finite&&motion.returnAngle<1e-6);assert.ok(motion.maxGripGap<.005);assert.equal(motion.duration,6.5);assert.equal(motion.clip,'static_idle');
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
    assert.deepEqual(f.errors,[]);console.log('SGH preview, ownership, grip alignment, inspect key, eight decoded WAVs and inspect playback passed (desktop and mobile viewport)');
  }finally{await f.browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
