const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
// Explored actual landscape phone Home > Graphics and Select > map dropdown >
// Deploy. On phones selecting a map closes that dropdown automatically.
(async()=>{const f=await fixture();fs.mkdirSync('test-results/mobile-map',{recursive:true});try{
 const requests=[];
 const p=await f.page('mobileterrain',{width:852,height:393},{isMobile:true,hasTouch:true,deviceScaleFactor:3},{quality:false,bootTimeout:120000,beforeLoad:async page=>page.on('request',r=>requests.push(r.url()))});
 p.setDefaultTimeout(120000);
 assert.equal(await p.evaluate(()=>SETTINGS.quality),'mobile');
 await p.locator('#go-play').click();await p.locator('#sel-pick').click();await p.locator('#sel-maps button').filter({hasText:/^마크X발로$/}).click();
 await p.waitForFunction(()=>ASCENT_TRIAL.status==='ready');await p.locator('#sel-go').click();
 await p.waitForFunction(()=>ASCENT_TRIAL.active&&!!myActor()&&ASCENT_TRIAL.graphicsStatus==='ready');
 await p.evaluate(()=>{closeShop();ADMIN.freezeAI=true;world.phase='live';world.roundTime=999;for(const a of world.actors)a.invuln=999;
  window.mobileRefs={nav:ASCENT_TRIAL.nav,colliders:COLLIDERS.slice(),hash:CHASH.buckets,walk:GRID.walk,actor:myActor(),pos:myActor().pos.toArray(),loads:ASCENT_TRIAL.loads};
 });
 if(await p.locator('#pause').isVisible())await p.locator('#pz-resume').click();
 // Measure a fixed pose without simulation/camera shake changing the scene.
 await p.evaluate(()=>{window.nativeRender=render;render=()=>{};step=()=>{};shake=0;followCamera(myActor(),.016);});
 async function capture(name){
  const value=await p.evaluate(()=>{
   nativeRender();const g=ASCENT_TRIAL.renderStats;
   return{...g,ratio:renderer.getPixelRatio(),width:cv.width,height:cv.height,viewport:[innerWidth,innerHeight],triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,
    sameCollision:COLLIDERS.length===mobileRefs.colliders.length&&COLLIDERS.every((c,i)=>c===mobileRefs.colliders[i]),sameHash:CHASH.buckets===mobileRefs.hash,sameNav:ASCENT_TRIAL.nav===mobileRefs.nav&&GRID.walk===mobileRefs.walk,sameActor:myActor()===mobileRefs.actor,loads:ASCENT_TRIAL.loads,ground:groundAt(player.pos.x,player.pos.z,player.y)};
  });
  await p.screenshot({path:'test-results/mobile-map/'+name+'.png'});return value;
 }
 const first=await capture('mobile');assert.equal(first.profile,'mobile');assert.equal(first.width,852);assert.equal(first.height,393);assert.equal(first.ratio,1);assert.equal(first.quads,166330);
 assert.ok(requests.some(x=>x.includes('/mobile/geometry.bin')));
 assert.ok(!requests.some(x=>/\/ascent\/geometry.bin/.test(x)),'a phone never downloads the heavy original mesh before choosing another mode');
 async function settings(){if(!await p.locator('#pause').isVisible())await p.locator('#tb-menu').tap();await p.locator('#pause [data-tab="gfx"]').click();}
 async function mode(key){await settings();await p.locator('#st-quality [data-quality="'+key+'"]').click();await p.waitForFunction(()=>ASCENT_TRIAL.graphicsStatus==='ready');await p.locator('#pz-resume').click();}
 await mode('perf');const original=await capture('original');assert.equal(original.profile,'original');assert.equal(original.quads,302566);
 assert.ok(first.triangles<original.triangles*.75,'same camera submits substantially fewer triangles');
 assert.ok(first.meshes<original.meshes*.6,'batch the mobile map into fewer spatial draws');
 assert.ok(first.calls<original.calls,'total scene draw calls fall as well as triangle counts');
 assert.ok(first.geometryBytes<original.geometryBytes*.6,'mobile terrain GPU buffers use at least 40% less memory');
 assert.ok(first.atlasWidth*first.atlasHeight<original.atlasWidth*original.atlasHeight*.5);
 await mode('mobile');const back=await capture('mobile-restored');assert.equal(back.quads,first.quads);assert.equal(back.triangles,first.triangles);
 for(const state of [first,original,back]){assert.ok(state.sameCollision&&state.sameHash&&state.sameNav&&state.sameActor);assert.equal(state.loads,first.loads);assert.ok(state.ground>0);}
 console.log('render comparison',JSON.stringify({first,original,back}));
 assert.ok(back.geometries<=first.geometries+3,'retired map buffers are released: '+JSON.stringify({first:first.geometries,back:back.geometries}));
 // Cold original fetch race: use a second context so it cannot hit the asset cache.
 await p.context().close();
 let fail=true,release,requested;
 const requestedPromise=new Promise(r=>requested=r),gate=new Promise(r=>release=r);
 const race=await f.page('mobilerace',{width:960,height:600},{},{bootTimeout:120000,beforeLoad:async page=>{
  await page.route('**/assets/maps/ascent/geometry.bin?*',async route=>{requested();await gate;if(fail)await route.fulfill({status:503,body:'retry'});else await route.continue();});
 }});
 await race.locator('#go-play').click();await race.locator('#sel-maps button').filter({hasText:/^마크X발로$/}).click();await race.waitForFunction(()=>ASCENT_TRIAL.status==='ready');await race.locator('#sel-go').click();await race.waitForFunction(()=>ASCENT_TRIAL.active&&!!myActor());
 await race.evaluate(()=>{closeShop();ADMIN.freezeAI=true;togglePause(true);render=()=>{};});await race.locator('#pause [data-tab="gfx"]').click();
 await race.locator('#st-quality [data-quality="perf"]').click();await requestedPromise;
 await race.locator('#st-quality [data-quality="mobile"]').click();release();
 await race.waitForFunction(()=>ASCENT_TRIAL.graphicsStatus==='ready'&&ASCENT_TRIAL.renderStats.profile==='mobile');
 await race.locator('#st-quality [data-quality="perf"]').click();await race.waitForFunction(()=>ASCENT_TRIAL.graphicsStatus==='error');
 assert.equal(await race.evaluate(()=>ASCENT_TRIAL.renderStats.profile),'mobile','failed optional detail pack leaves playable terrain intact');
 fail=false;await race.locator('#st-quality [data-quality="perf"]').click();await race.waitForFunction(()=>ASCENT_TRIAL.graphicsStatus==='ready'&&ASCENT_TRIAL.renderStats.profile==='original');
 await race.locator('#st-quality [data-quality="mobile"]').click();await race.waitForFunction(()=>ASCENT_TRIAL.graphicsStatus==='ready');
 const leaks=await race.evaluate(()=>{const before=renderer.info.memory.geometries;loadMap('glacier');return{before,active:ASCENT_TRIAL.active,meshes:ASCENT_TRIAL.meshes.length,remaining:COLLIDERS.filter(c=>c.ascent).length,floor:floor.visible};});
 assert.equal(leaks.active,false);assert.equal(leaks.meshes,0);assert.equal(leaks.remaining,0);assert.equal(leaks.floor,true);
 assert.deepEqual(f.errors,[]);fs.writeFileSync('test-results/mobile-map/results.json',JSON.stringify({first,original,back,leaks},null,2));console.log('Clear phone rendering, lightweight pack, live switches, unchanged gameplay, retry/race and map exit:',JSON.stringify({first,original,back,leaks}));
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
