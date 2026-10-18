const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
// Explored the real select/buy screens and confirmed the broken Phantom
// showed single fire/15 rounds before authoring these interaction checks.
(async()=>{const f=await fixture();try{
 const p=await f.page('rifleidentity',{width:1280,height:800},{},{bootTimeout:120000});
 await p.waitForFunction(()=>VALORANT_PACK.status==='ready');
 const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'rifle-owner'});
 for(const skin of ['champions_atk','champions_def'])await f.h.api('a_user_set',{atoken:owner.atoken,id:'rifleidentity',op:'grant',item:'scout|'+skin});
 await p.locator('#go-play').click();await p.locator('#sel-maps button').filter({hasText:/^빙하 관측소$/}).click();await p.locator('#sel-go').click();
 await p.waitForFunction(()=>!!myActor());
 await p.evaluate(async()=>{await GUN_SKINS.sync();ADMIN.freezeAI=true;closeShop();world.phase='buy';world.roundTime=999;openShop();});
 await p.waitForFunction(()=>document.querySelectorAll('#shop-grid .buy-gun-image[src]').length===18,null,{timeout:120000});
 const previews={};
 for(const [key,name,mode] of [['scout','팬텀','자동'],['burst','점사소총','점사'],['bullpup','코멧 소총','자동']]){
  await p.locator('#shop-grid [data-key="'+key+'"]').hover();await p.waitForFunction(name=>document.getElementById('buy-name').textContent===name,name);
  assert.match(await p.locator('#buy-stats').innerText(),new RegExp(mode));
  previews[key]=await p.evaluate(key=>document.querySelector('#shop-grid [data-key="'+key+'"] img').src,key);
  const identity=await p.evaluate(()=>{const o=WEAPON_SHOP.preview().obj;let original=false,comet=false,finite=true;o.traverse(n=>{if(n.userData.valorantItem==='phantom')original=true;if(n.userData.weaponModel==='comet')comet=true;if(n.geometry)finite&&=Array.from(n.geometry.attributes.position.array).every(Number.isFinite);});return{original,comet,finite};});
  assert.ok(identity.finite);assert.equal(identity.original,key==='scout');assert.equal(identity.comet,key==='bullpup');
  await p.screenshot({path:'test-results/rifle-'+key+'.png'});
 }
 assert.equal(new Set(Object.values(previews)).size,3,'Phantom, burst and the new Comet have different rendered silhouettes');
 await p.locator('#shop-grid [data-key="bullpup"]').click({timeout:90000});assert.equal(await p.evaluate(()=>myActor().weapons.primary),'bullpup');
 await p.evaluate(()=>{closeShop();world.phase='live';requestAnimationFrame=()=>0;for(const a of world.actors){a.invuln=999;a.fireCd=999;}window.equipTest=(key,skin)=>{const a=myActor();GUN_SKINS.set(key,skin||'default');a.weapons.primary=key;a.slot='primary';a.fireCd=0;a.reloading=0;a.burstLeft=0;a._held=false;a.ammo[key]=WEAPONS[key].mag;a.reserve[key]=999;a.vel.set(0,0,0);keys.fire=false;updateViewmodel(true);tickViewmodel(.02);};});
 await p.locator('#cv').click({force:true});await p.waitForFunction(()=>locked&&document.pointerLockElement===document.getElementById('cv'));
 const results={};
 for(const [label,key,skin] of [['phantom','scout','default'],['champions-atk','scout','champions_atk'],['champions-def','scout','champions_def'],['burst','burst','default'],['comet','bullpup','default'],['recon','carbine','default']]){
  await p.evaluate(([key,skin])=>equipTest(key,skin),[key,skin]);await p.mouse.down();
  await p.waitForFunction(()=>keys.fire,null,{timeout:5000});
  results[label]=await p.evaluate(key=>{const a=myActor(),before=a.ammo[key];for(let i=0;i<55;i++){world.phase='live';netStep(.02);}tickViewmodel(.02);const model=VM.current;let source=false,champions=false,comet=false;model.traverse(n=>{if(n.userData.valorantItem==='phantom')source=true;if(n.name==='phantom-rig')champions=true;if(n.userData.weaponModel==='comet')comet=true;});return{shots:before-a.ammo[key],source,champions,comet,wire:WKEYS[packActor(a)[9]]};},key);
  await p.mouse.up();await p.evaluate(()=>{keys.fire=false;netStep(.01);});
  assert.equal(results[label].wire,key,'snapshot retains '+key);
 }
 for(const label of ['phantom','champions-atk','champions-def','comet'])assert.ok(results[label].shots>=10,JSON.stringify(results));
 assert.equal(results.burst.shots,3);assert.equal(results.recon.shots,1);assert.ok(results.phantom.source);assert.ok(results['champions-atk'].champions);assert.ok(results['champions-def'].champions);assert.ok(results.comet.comet);
 await p.evaluate(()=>equipTest('scout'));await p.mouse.down({button:'right'});assert.equal(await p.evaluate(()=>{myActor().ads=true;tickViewmodel(.02);return isScoped();}),false,'Phantom ADS does not turn into a scout scope');await p.mouse.up({button:'right'});
 await p.evaluate(()=>equipTest('carbine'));assert.ok(await p.evaluate(()=>{myActor().ads=true;return isScoped();}));
 assert.deepEqual(f.errors,[]);console.log('Rifle identities and actual held-click firing:',results);
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
