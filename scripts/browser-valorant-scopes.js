const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('./browser-fixture');
// Explored the supplied models, armory preview and buy-phase shop in Chromium.
// These checks cover the omitted built-in attachments at their source sockets.
(async()=>{const f=await fixture();try{
 const p=await f.page('scopebuyer',{width:1280,height:800},{},{bootTimeout:120000});
 await p.waitForFunction(()=>VALORANT_PACK.status==='ready',null,{timeout:120000});
 const base=path.join(__dirname,'../assets/valorant-packs/v1/gun/assets/valorant/textures/attachment/uv');
 const models=[{key:'marksman',id:'outlaw',name:'아웃로',cubes:127},{key:'sniper',id:'operator',name:'오퍼레이터',cubes:273}];
 await p.evaluate(()=>{window.__scopeInfo=where=>{
  const root=where==='armory'?GUN_SKINS._pv().obj:where==='shop'?WEAPON_SHOP.preview().obj:VM.current;
  const scope=root.getObjectByName('valorant-attachment-scope');if(!scope)return null;
  const hidden=[];let vertices=0,texture;
  scope.traverse(n=>{if(n.isMesh){vertices+=n.geometry.attributes.position.count;texture=n.material.map;}if(n.userData.attachmentBone&&!n.visible)hidden.push(n.userData.attachmentBone);});
  const box=VALORANT_PACK.bounds(scope);scope.visible=false;const body=VALORANT_PACK.bounds(root);scope.visible=true;
  return {id:scope.userData.sourceAttachment,cubes:scope.userData.sourceCubes,vertices,socket:scope.parent.userData.sourceBone,position:scope.position.toArray(),texture:[texture.image.width,texture.image.height],hidden,scopeTop:box.max.y,bodyTop:body.max.y,above:box.max.y>body.max.y+.02};
 };});
 const check=async(where,spec)=>{
  const m=await p.evaluate(where=>__scopeInfo(where),where),png=fs.readFileSync(path.join(base,'scope_'+spec.id+'_default.png'));
  assert.ok(m,where+' has the original scope');assert.equal(m.id,'valorant:scope_'+spec.id+'_default');assert.equal(m.socket,'scope_pos');assert.deepEqual(m.position,[0,0,0]);assert.equal(m.cubes,spec.cubes);assert.equal(m.vertices,spec.cubes*36);assert.deepEqual(m.texture,[png.readUInt32BE(16),png.readUInt32BE(20)]);assert.ok(m.above,where+' scope sits above the receiver: '+JSON.stringify(m));assert.ok(m.hidden.includes('division')&&m.hidden.includes('ocular'),'lens stencil and floating reticle planes stay out of the physical gun view');
 };
 for(const spec of models){
  await p.evaluate(key=>GUN_SKINS.open(key,'gun'),spec.key);
  await p.waitForFunction(()=>!!GUN_SKINS._pv()?.obj?.getObjectByName('valorant-attachment-scope'));
  await p.waitForFunction(()=>__scopeInfo('armory')?.above);
  await p.locator('#ar-cv').screenshot({path:'test-results/scope-'+spec.id+'-preview.png'});await check('armory',spec);
 }
 await p.evaluate(()=>{GUN_SKINS.close();room.map='pogu';startGame(AGENTS[0],true);closeShop();ADMIN.freezeAI=true;world.phase='buy';world.roundTime=999;myActor().credits=10000;});
 const before=await p.evaluate(()=>JSON.stringify([WEAPONS.marksman,WEAPONS.sniper]));
 for(const spec of models){
  await p.evaluate(()=>openShop());const card=p.locator('#shop-grid [data-key="'+spec.key+'"]');await card.hover();
  await p.waitForFunction(key=>document.getElementById('buy-preview').dataset.weapon===key,spec.key);
  assert.equal(await p.locator('#buy-name').innerText(),spec.name);await check('shop',spec);
  await p.screenshot({path:'test-results/scope-'+spec.id+'-shop.png'});await card.click();await p.locator('#shop-close').click();
  assert.equal(await p.evaluate(()=>myActor().weapons.primary),spec.key);
  await p.evaluate(()=>{const a=myActor();a.yaw=0;a.pitch=0;followCamera(a,.1);for(let i=0;i<180;i++)tickViewmodel(1/60);renderer.render(scene,camera);});
  await check('hand',spec);await p.screenshot({path:'test-results/scope-'+spec.id+'-equipped.png'});
  const reload=await p.evaluate(key=>{const obj=VALORANT_PACK.build(key);let rig;obj.traverse(n=>{if(n.childrenWithBones)rig=n;});const scope=obj.getObjectByName('valorant-attachment-scope'),socket=scope.parent;VALORANT_PACK.pose(rig,VALORANT_PACK.items.get(key),'reload_tactical',.8);obj.updateMatrixWorld(true);const a=scope.getWorldPosition(new T.Vector3()),b=socket.getWorldPosition(new T.Vector3());const result=scope.parent===socket&&a.distanceTo(b)<1e-9;obj.traverse(n=>n.geometry?.dispose());return result;},spec.key);assert.ok(reload,'scope stays attached during source reload animation');
  await p.locator('#cv').click({force:true});await p.waitForFunction(()=>document.pointerLockElement===document.getElementById('cv'));
  await p.mouse.down({button:'right'});await p.waitForFunction(()=>player.ads&&document.getElementById('scope').classList.contains('on'));
  await p.mouse.up({button:'right'});await p.waitForFunction(()=>!player.ads&&!document.getElementById('scope').classList.contains('on'));
 }
 assert.equal(await p.evaluate(()=>JSON.stringify([WEAPONS.marksman,WEAPONS.sniper])),before,'restoring physical scopes does not change damage, zoom or weapon stats');assert.deepEqual(f.errors,[]);
 console.log('Scopes: both original models/textures, 400 source cubes, native mount, armory/shop/equipped views, source reload attachment and real right-click ADS passed. Match purchases used the in-memory fixture; no store payment.');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1)});
