const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('./browser-fixture');
// The armory, rendered thumbnails and buy screen were explored before these
// checks. All accounts and purchases here use the in-memory API fixture.
(async()=>{const f=await fixture();try{
  const p=await f.page('legacyguns',{width:1440,height:900},{},{bootTimeout:120000});
  await p.waitForFunction(()=>VALORANT_PACK.status==='ready',null,{timeout:120000});
  await p.waitForFunction(()=>CHAMPIONS_PHANTOM.loaded(),null,{timeout:120000});
  const report=await p.evaluate(()=>{
    titleCam=()=>{};render=()=>{};room.map='glacier';room.mode='std';startGame(AGENTS[0],false);closeShop();world.phase='live';ADMIN.freezeAI=true;
    const keys=LEGACY_GUN_MODELS.keys,rows=[];
    for(const key of keys){
      const raw=GUN_BUILD[key](),size=new T.Box3().setFromObject(raw).getSize(new T.Vector3());let meshes=0,finite=true;
      raw.traverse(n=>{if(n.isMesh){meshes++;finite&&=Array.from(n.geometry.attributes.position.array).every(Number.isFinite);}});
      player.weapons[['machpist','pocketshot'].includes(key)?'secondary':'primary']=key;player.slot=['machpist','pocketshot'].includes(key)?'secondary':'primary';player.ammo[key]=0;player.reloading=0;
      updateViewmodel(true);tickViewmodel(.016);const vm=VM.current,rl=vm.userData.rl;
      const actions=(rl.actions||[]).map(a=>({kind:a.kind,max:0,back:0}));
      let magDistance=0,magChildCount=rl.mag?.children.length||0,localMag=null;
      if(rl.mag)localMag=JSON.stringify(rl.mag.children.map(n=>[n.position.toArray(),n.quaternion.toArray()]));
      player.reserve[key]=999;actorReload(player);
      const duration=player.reloading;tickViewmodel(.016);
      for(let i=1;i<100;i++){
        player.reloading=duration*(1-i/100);tickViewmodel(.016);
        for(let j=0;j<actions.length;j++){const a=rl.actions[j];actions[j].max=Math.max(actions[j].max,Math.abs(a.node.rotation.x-a.rotation.x)+a.node.position.distanceTo(a.position));}
        if(rl.mag&&rl.mag0)magDistance=Math.max(magDistance,rl.mag.position.distanceTo(rl.mag0));
      }
      // Cancellation must restore the barrel/pump as well as the hands.
      player.reloading=0;tickViewmodel(.016);
      for(let j=0;j<actions.length;j++){const a=rl.actions[j];actions[j].back=Math.abs(a.node.rotation.x-a.rotation.x)+a.node.position.distanceTo(a.position);}
      let baked=0;vm.traverse(n=>{if(n.isMesh)baked++;});
      rows.push({key,active:curWeaponKey(),style:rl.style,visible:VM.root.visible,size:size.toArray(),meshes,baked,finite,magDistance,magChildCount,magRigid:!rl.mag||localMag===JSON.stringify(rl.mag.children.map(n=>[n.position.toArray(),n.quaternion.toArray()])),actions,thumb:GUN_SKINS.thumb(key,'default').length,thirdPerson:!!GUN_SKINS.template(key,GUN_SKINS.list[0])});
    }
    const protectedModels={};for(const key of ['pistol','silenced','revolver','rifle','scout','autoshot','hmg','marksman','sniper']){
      const model=GUN_BUILD[key]();let source=false;model.traverse(n=>{if(n.userData.valorantRig)source=true;});protectedModels[key]=source;
    }
    protectedModels.carbine=GUN_BUILD.carbine().userData.weaponModel==='recon';protectedModels.bullpup=GUN_BUILD.bullpup().userData.weaponModel==='comet';
    const champion=GUN_SKINS.template('scout',GUN_SKINS.list.find(s=>s.id==='champions_atk'));
    return{rows,protectedModels,champion:!!champion.getObjectByName('phantom-rig'),count:Object.keys(WEAPONS).length};
  });
  console.log(JSON.stringify(report));
  assert.equal(report.count,19);assert.equal(report.rows.length,6);assert.ok(report.champion);
  for(const [key,value]of Object.entries(report.protectedModels))assert.ok(value,key+' retains its original builder');
  const limits={machpist:[.3,.5],smg:[.6,.8],whisper:[.75,.95],shotgun:[.85,1.1],pocketshot:[.35,.55],burst:[.85,1.1]};
  for(const r of report.rows){
    assert.ok(r.finite,r.key+' geometry');assert.ok(r.size[0]<.13&&r.size[1]<.45,r.key+' proportions');assert.ok(r.size[2]>limits[r.key][0]&&r.size[2]<limits[r.key][1],r.key+' length');
    assert.ok(r.meshes<=65,r.key+' bounded source meshes');assert.ok(r.thumb>1000&&r.thirdPerson,r.key+' thumbnail and world template');assert.ok(r.magRigid,r.key+' magazine decorations move together');
    if(['machpist','smg','whisper','burst'].includes(r.key)){assert.ok(r.magDistance>.05,r.key+' real magazine moves');assert.ok(r.magChildCount>=2,r.key+' complete magazine assembly');}
    for(const action of r.actions){assert.ok(action.max>.04,r.key+' '+action.kind+' moves');assert.ok(action.back<1e-7,r.key+' '+action.kind+' resets');}
  }
  assert.deepEqual(report.rows.find(r=>r.key==='pocketshot').actions.map(a=>a.kind),['break']);assert.deepEqual(report.rows.find(r=>r.key==='shotgun').actions.map(a=>a.kind),['pump']);
  await p.evaluate(()=>{GUN_SKINS.open('smg');GUN_SKINS.preview('smg','default');});
  await p.waitForFunction(()=>GUN_SKINS.isOpen());
  const dir=process.env.DFDF_SCREENSHOT_DIR||'test-results';fs.mkdirSync(dir,{recursive:true});
  await p.screenshot({path:path.join(dir,'legacy-armory-desktop.png')});
  await p.setViewportSize({width:844,height:390});await p.screenshot({path:path.join(dir,'legacy-armory-mobile.png')});
  fs.writeFileSync(path.join(dir,'legacy-models.json'),JSON.stringify(report,null,2));assert.deepEqual(f.errors,[]);console.log(JSON.stringify(report));
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
