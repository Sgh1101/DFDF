const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
// Authored after exploring real kill and last-kill screens at 844x390.
(async()=>{
 const f=await fixture(),dir='test-results/phantom-kill-wave';fs.mkdirSync(dir,{recursive:true});
 try{
  for(const [name,width,height,touch] of [['phone',844,390,true],['small',568,320,true],['desktop',1280,800,false]]){
   const p=await f.page('wave'+name,{width,height},touch?{hasTouch:true,isMobile:true}:{}),shaderErrors=[];
   p.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|VALIDATE_STATUS|shader error/i.test(m.text()))shaderErrors.push(m.text());});
   await p.waitForFunction(()=>CHAMPIONS_PHANTOM.loaded());
   const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'wave-owner'});
   for(const skin of ['champions_atk','champions_def'])await f.h.api('a_user_set',{atoken:owner.atoken,id:'wave'+name,op:'grant',item:'scout|'+skin});
   await p.evaluate(()=>GUN_SKINS.sync());
   await p.clock.install({time:new Date('2030-01-01T00:00:00Z')});await p.clock.pauseAt(new Date('2030-01-01T00:00:10Z'));
   await p.locator('#go-armory').click();await p.locator('#ar-tabs [data-tab="champions"]').click();
   for(const skin of ['champions_atk','champions_def']){
    await p.locator('[data-phantom-skin="'+skin+'"]').click();await p.locator('[data-phantom-demo="kill"]').click();await p.clock.fastForward(300);
    const pixels=await p.evaluate(()=>{
     render();const pv=GUN_SKINS._pv(),rig=pv.obj.getObjectByName('phantom-rig');let mat;rig.traverse(o=>{if(o.isMesh)mat=o.material;});
     const gl=pv.r.getContext(),size=pv.r.getDrawingBufferSize(new T.Vector2());
     const capture=()=>{pv.r.render(pv.sc,pv.cam);const bytes=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
     const withWave=capture(),wave=rig.userData.killWave;CHAMPIONS_PHANTOM.stop();const without=capture();let changed=0;for(let i=0;i<without.length;i+=4)if(Math.abs(without[i]-withWave[i])+Math.abs(without[i+1]-withWave[i+1])+Math.abs(without[i+2]-withWave[i+2])>25)changed++;
     return {changed,wave,gl:gl.getError()};
    });
    assert.ok(pixels.changed>30,name+' '+skin+' source coat changes actual rendered pixels: '+JSON.stringify(pixels));assert.equal(pixels.gl,0);assert.ok(pixels.wave.current>0&&pixels.wave.current<1);
    await p.screenshot({path:dir+'/'+name+'-'+skin+'-preview-wave.png'});await p.locator('#phantom-stop').click();
   }
   await p.evaluate(()=>GUN_SKINS.close());
   for(const skin of ['champions_atk','champions_def']){
    const setup=async(last,kind='gun')=>p.evaluate(({skin,last,kind})=>{
     titleCam=()=>{};room.mode='std';room.map='field';room.rounds=13;startGame(AGENTS[0],false);closeShop();ADMIN.freezeAI=true;world.phase='live';
     const me=myActor(),foes=world.actors.filter(a=>a.team!==me.team),v=foes[0];for(const a of world.actors){a.fireCd=999;if(last&&a.team!==me.team)a.alive=a===v;}
     me.weapons.primary='scout';me.slot='primary';GUN_SKINS.set('scout',skin);followCamera(me,.016);tickViewmodel(.016);
     const d=new T.Vector3();camera.getWorldDirection(d);v.pos.set(me.pos.x+d.x*12,0,me.pos.z+d.z*12);v.y=me.y;v.hp=1;v.armor=v.invuln=v.shielded=0;
     DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(me,'scout',kind,world.round,skin),()=>dealDamage(v,999,false,me));if(last)checkRoundEnd();
     window.__waveRender=window.__waveRender||render;render=()=>{};return{round:world.round,me:me.id};
    },{skin,last,kind});
    await p.evaluate(()=>{if(window.__waveRender)render=__waveRender;});const ordinary=await setup(false);await p.clock.fastForward(500);
    const normal=await p.evaluate(()=>{followCamera(myActor(),.016);tickViewmodel(.016);__waveRender();const fire=VM.current.getObjectByName('champions-source-gun-flames');return{wave:CHAMPIONS_PHANTOM.waveState(myActor().id),flame:!!fire?.visible,active:FINISHERS.active.size};});
    assert.equal(normal.active,0);assert.equal(normal.flame,true);assert.equal(normal.wave.hold,.6);await p.screenshot({path:dir+'/'+name+'-'+skin+'-normal-kill.png'});
    await p.clock.fastForward(8600);assert.equal(await p.evaluate(()=>CHAMPIONS_PHANTOM.waveState(myActor().id).hold),0);
    await p.evaluate(()=>{render=__waveRender;});await setup(false,'ability');assert.equal(await p.evaluate(()=>CHAMPIONS_PHANTOM.waveState(myActor().id).hold),0,'ability kill never starts gun coat');
    const peer=await p.evaluate(skin=>{
     const me=myActor(),bot=world.actors.find(a=>a.team===me.team&&a!==me),victim=world.actors.find(a=>a.team!==me.team&&a.alive);
     bot.weapons.primary='scout';bot.slot='primary';bot._botSk={scout:skin};bot.pos.set(me.pos.x+1,0,me.pos.z-3);bot.y=me.y;bot.model.gun.userData.tp='';camera.updateMatrixWorld();updateFrustum();syncActorModel(bot);
     victim.hp=1;victim.armor=victim.invuln=victim.shielded=0;DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(bot,'scout','gun',world.round,skin),()=>dealDamage(victim,999,false,bot));__waveRender();
     const rig=bot.model.gun.getObjectByName('phantom-rig');let coat;rig?.traverse(o=>{if(o.isMesh)coat=o.material.userData.phantomWaveUniform?.z;});return{coat,mine:CHAMPIONS_PHANTOM.waveState(me.id).hold};
    },skin);
    assert.equal(peer.coat,.6,'third-person cached weapon clones receive their own wearer coat');assert.equal(peer.mine,0,'another wearer never coats my gun');
    await p.evaluate(()=>{render=__waveRender;});const final=await setup(true);await p.clock.fastForward(3500);
    const framed=await p.evaluate(()=>{
     followCamera(myActor(),.016);tickViewmodel(.016);updateFx(0);__waveRender();const g=[...FINISHERS.active][0],fig=g.getObjectByName('champions-original-finisher');
     const b=new T.Box3().setFromObject(fig),points=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push(new T.Vector3(x,y,z).project(camera).toArray());
     const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new T.Vector2()),capture=()=>{__waveRender();const a=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
     const visible=capture();VM.root.visible=false;const hidden=capture();VM.root.visible=true;__waveRender();let gunPixels=0;for(let i=0;i<visible.length;i+=4)if(Math.abs(visible[i]-hidden[i])+Math.abs(visible[i+1]-hidden[i+1])+Math.abs(visible[i+2]-hidden[i+2])>25)gunPixels++;
     return {framed:points.every(p=>Math.abs(p[0])<.96&&Math.abs(p[1])<.96&&Math.abs(p[2])<1),gunPixels,height:b.getSize(new T.Vector3()).y,min:fig.userData.playerHeight*5,stars:g.userData.starOpacity,sky:!!scene.getObjectByName('champions-original-star-dome')?.visible,hourglass:!!fig.getObjectByName('champions-original-hourglass'),statues:fig.getObjectByName('champions-original-trophy-stage').children.filter(o=>o.name.startsWith('champions-gold-')).length,body:document.body.classList.contains('champions-finishing'),gl:gl.getError()};
    });
    assert.equal(framed.framed,true,name+' full original figures stay in the real play camera '+JSON.stringify(framed));assert.ok(framed.height>=framed.min);assert.equal(framed.stars,1);assert.equal(framed.sky,true);assert.equal(framed.hourglass,true);assert.equal(framed.statues,2);assert.equal(framed.body,true);assert.equal(framed.gl,0);
    assert.ok(framed.gunPixels>30,name+' black sky must not cover the held gun or hands: '+JSON.stringify(framed));
    await p.screenshot({path:dir+'/'+name+'-'+skin+'-last-kill.png'});
    if(name==='desktop'&&skin==='champions_def')for(const quality of ['perf','visual','ultra','mobile']){
     const error=await p.evaluate(q=>{setQuality(q);followCamera(myActor(),.016);tickViewmodel(.016);updateFx(0);__waveRender();return renderer.getContext().getError();},quality);assert.equal(error,0,quality+' renders the original finisher and kill coat');
    }
    await p.clock.fastForward(4501);const after=await p.evaluate(()=>({round:world.round,phase:world.phase,active:FINISHERS.active.size,sky:!!scene.getObjectByName('champions-original-star-dome'),body:document.body.classList.contains('champions-finishing')}));
    assert.equal(after.round,final.round+1);assert.equal(after.phase,'buy');assert.equal(after.active,0);assert.equal(after.sky,false);assert.equal(after.body,false);
   }
   assert.deepEqual(shaderErrors,[]);console.log(name,'both source kill coats change real GPU pixels; normal/ability/last kills, full camera framing, star dome, hourglass, two statues and 8s cleanup passed');await p.context().close();
  }
  assert.deepEqual(f.errors,[]);
 }finally{await f.browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
