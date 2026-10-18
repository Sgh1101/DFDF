const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('./browser-fixture');
(async()=>{const f=await fixture();try{
 const page=await f.page('packtester',{width:1280,height:720},{},{bootTimeout:120000});
 await page.waitForFunction(()=>VALORANT_PACK.status==='ready',{},{timeout:120000});
 const models=await page.evaluate(()=>{
  return [...VALORANT_PACK.items.values()].map(item=>{
   const model=VALORANT_PACK.build(item.key==='knife'?item.id:item.key);model.updateMatrixWorld(true);
   let rig;model.traverse(n=>{if(n.childrenWithBones)rig=n;});
   const assembled=VALORANT_PACK.bounds(model).getSize(new T.Vector3()).toArray();
   const rest=rig.childrenWithBones.map(n=>[...n.position.toArray(),...n.rotation.toArray().slice(0,3)]);
   const clip=item.key==='knife'?'inspect':'reload_tactical';VALORANT_PACK.pose(rig,item,clip,.8);
   const moving=rig.childrenWithBones.some((n,i)=>[...n.position.toArray(),...n.rotation.toArray().slice(0,3)].some((v,j)=>Math.abs(v-rest[i][j])>.01));
   const muzzle=rig.childrenWithBones.find(n=>/^(muzzle_default|muzzle_pos|muzzle_flash)$/.test(n.userData.sourceBone)),p=new T.Vector3();if(muzzle)muzzle.getWorldPosition(p);
   model.traverse(n=>n.geometry?.dispose());
   return{id:item.id,key:item.key,cubes:item.cubes,assembled,moving,muzzleZ:muzzle?p.z:null,width:item.material.map.image.width,height:item.material.map.image.height,expected:[item.geo.description.texture_width,item.geo.description.texture_height]};
  });
 });
 const root=path.join(__dirname,'../assets/valorant-packs/v1'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
 assert.equal(models.length,15);for(const m of models){const png=fs.readFileSync(path.join(root,manifest.items.find(i=>i.id===m.id).texture));assert.ok(m.moving,m.id+' source animation moves');assert.deepEqual([m.width,m.height],[png.readUInt32BE(16),png.readUInt32BE(20)],m.id+' full source PNG resolution');if(m.key!=='knife')assert.ok(m.muzzleZ<0,m.id+' points forward');}
 console.log('original models',JSON.stringify(models));
 const karambit=models.find(m=>m.id==='eternal_karambit');assert.ok(karambit.assembled[0]<.08&&karambit.assembled[1]>.64&&karambit.assembled[1]<.8&&karambit.assembled[2]<.56,'the enlarged karambit ring, grip and blade stay assembled rather than exploding beyond their source silhouette');
 const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'pack-owner'});
 const skins=await page.evaluate(()=>VALORANT_DATA.knives.map(s=>({id:s.id,name:s.ko})));
 for(const s of skins)assert.equal((await f.h.api('a_user_set',{atoken:owner.atoken,id:'packtester',op:'grant',item:'knife|'+s.id})).status,200);
 await f.h.api('a_user_set',{atoken:owner.atoken,id:'packtester',op:'grant',item:'scout|champions_atk'});
 await page.evaluate(async()=>{await GUN_SKINS.sync();room.map='pogu';startGame(AGENTS[0],true);closeShop();ADMIN.freezeAI=true;world.phase='buy';world.roundTime=999;openShop();});
 assert.equal(await page.evaluate(()=>GUN_SKINS.guns().length),19);
 const shop=await page.locator('#shop-grid').innerText();for(const name of ['밴달','팬텀','클래식','오퍼레이터','아웃로','오딘'])assert.ok(shop.includes(name));
 assert.ok(!shop.includes('속사 SMG')&&!shop.includes('핸드캐논')&&!shop.includes('전투소총'));
 await page.locator('#shop-grid .sitem').filter({has:page.locator('b',{hasText:/^밴달$/})}).click();
 assert.equal(await page.evaluate(()=>myActor().weapons.primary),'rifle');
 await page.evaluate(()=>{closeShop();GUN_SKINS.open('knife');});
 const knifeStats=await page.evaluate(()=>JSON.stringify(WEAPONS.knife));
 for(const s of skins){
  await page.getByText(s.name,{exact:true}).click();
  await page.waitForFunction(id=>GUN_SKINS.of('knife').id===id,s.id);
  assert.ok(await page.evaluate(id=>{let found=false;GUN_SKINS._pv().obj.traverse(n=>{if(n.userData.valorantItem===id.replace(/^vp_/,''))found=true;});return found;},s.id),'preview contains original '+s.id);
  if(s.id==='vp_eternal_karambit')await page.screenshot({path:'test-results/karambit-fixed.png'});
 }
 await page.getByText('미래 나비칼',{exact:true}).click();
 await page.screenshot({path:'test-results/valorant-knife-preview.png'});
 await page.evaluate(()=>{GUN_SKINS.close();const a=myActor();a.weapons.secondary='knife';a.slot='secondary';updateViewmodel(true);for(let i=0;i<180;i++)tickViewmodel(1/60);});
 const settle=async()=>{
  await page.evaluate(()=>{const a=myActor();a.yaw=0;a.pitch=0;a.vel.set(0,0,0);followCamera(a,.1);for(let i=0;i<180;i++)tickViewmodel(1/60);updateHUD();renderer.render(scene,camera);});
  if(!await page.evaluate(()=>document.pointerLockElement===document.getElementById('cv')))await page.locator('#cv').click({force:true});
  await page.waitForFunction(()=>document.pointerLockElement===document.getElementById('cv'));
 };
 await settle();
 assert.equal(await page.evaluate(()=>JSON.stringify(WEAPONS.knife)),knifeStats,'knife skins do not change combat stats');
 assert.ok(await page.evaluate(()=>{let n=0;VM.current.traverse(o=>{if(o.userData.valorantItem==='future_butterfly')n++;});return n>0;}));
 const motion=await page.evaluate(()=>{
  const nodes=[];VM.current.traverse(n=>{if(n.userData.sourceBone)nodes.push(n);});const before=nodes.map(n=>n.rotation.toArray().slice(0,3));
  viewmodelFireKick();for(let i=0;i<10;i++)tickViewmodel(.02);
  return nodes.some((n,i)=>n.rotation.toArray().slice(0,3).some((v,j)=>Math.abs(v-before[i][j])>.01));
 });assert.ok(motion,'equipped butterfly uses source attack motion');
 await settle();
 await page.screenshot({path:'test-results/valorant-knife-equipped.png'});
 await page.evaluate(()=>{GUN_SKINS.set('rifle','default');const a=myActor();a.weapons.primary='rifle';a.slot='primary';a.ammo.rifle=25;a.reserve.rifle=999;a.fireCd=0;a.reloading=0;a.alive=true;world.phase='live';updateViewmodel(true);actorFire(a);});
 await page.waitForFunction(()=>VALORANT_PACK.audioPlayed.some(n=>n.endsWith('/vandal/vandal_shoot.ogg')),{},{timeout:20000});
 assert.equal(await page.evaluate(()=>myActor().ammo.rifle),24);
 await page.evaluate(()=>{world.phase='buy';world.roundTime=999;});
 await settle();
 await page.screenshot({path:'test-results/valorant-gun-equipped.png'});
 const champions=await page.evaluate(()=>{GUN_SKINS.set('scout','champions_atk');const a=myActor();a.weapons.primary='scout';a.slot='primary';updateViewmodel(true);return!!VM.current.getObjectByName('phantom-rig');});assert.ok(champions,'existing Champions scout still uses the original special model');
 assert.deepEqual(f.errors,[]);console.log('Valorant: 9 guns, 6 knife skins, source textures and motion, real equip/purchase UI, unchanged knife damage, original shot audio, Champions compatibility passed. Purchases used an in-memory fixture.');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
