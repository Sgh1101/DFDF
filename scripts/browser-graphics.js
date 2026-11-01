const assert=require('node:assert/strict'),fs=require('node:fs'),C=require('../js/graphics-settings'),{fixture}=require('./browser-fixture');
// Explored Home > Settings > Graphics, the tab buttons and live preset row first.
(async()=>{const f=await fixture();fs.mkdirSync('test-results',{recursive:true});try{
 const results={};let ascent=null;
 if(process.env.DFDF_GRAPHICS_PHONE_ONLY!=='1'){
 const p=await f.page('graphicsdesktop',{width:960,height:640},{deviceScaleFactor:1.5},{bootTimeout:120000,quality:false});
 p.setDefaultTimeout(90000);
 assert.equal(await p.evaluate(()=>SETTINGS.quality),'perf','new desktop starts with performance');
 await p.locator('#go-set').click();await p.locator('#pause .pz-tabs [data-tab="gfx"]').click();
 assert.deepEqual(await p.locator('#st-quality button').allTextContents(),['휴대폰','성능','비주얼','최고']);
 for(const mode of ['ultra','mobile','visual','perf']){
  await p.locator('#st-quality [data-quality="'+mode+'"]').click();
  const result=await p.evaluate(()=>{
   render();
   return {quality:SETTINGS.quality,gfx:{...GFX},ratio:renderer.getPixelRatio(),shadow:renderer.shadowMap.enabled,canvasAA:renderer.getContext().getContextAttributes().antialias,
    post:POST.ok?{w:POST.rt.width,h:POST.rt.height,samples:POST.rt.samples}:null,active:document.querySelectorAll('#st-quality [aria-pressed="true"]').length,saved:JSON.parse(localStorage.getItem('lgp_set')).quality};
  });
  assert.equal(result.quality,mode);assert.equal(result.saved,mode);assert.equal(result.active,1);
  for(const field of Object.keys(C.presets[mode]))assert.equal(result.gfx[field],C.presets[mode][field],mode+' resets '+field);
  assert.equal(result.ratio,Math.min(1.5,C.presets[mode].pixel));assert.equal(result.shadow,C.presets[mode].shadow);assert.equal(result.canvasAA,false);
  if(C.presets[mode].post){assert.ok(result.post.w>4);assert.equal(result.post.samples,C.presets[mode].msaa);}else if(result.post)assert.equal(result.post.w,4);
  results[mode]=result;
  console.log('checked graphics mode',mode);
 }
 await p.screenshot({path:'test-results/graphics-desktop.png'});
 await p.locator('#pz-reset').click();assert.equal(await p.evaluate(()=>GFX.pixel),C.presets.perf.pixel,'reset applies the runtime budget too');
 await p.locator('#st-quality [data-quality="visual"]').click();
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!document.documentElement.dataset.gameLoading);
 assert.equal(await p.evaluate(()=>SETTINGS.quality),'visual');assert.equal(await p.evaluate(()=>GFX.msaa),2,'stored mode applies before play');
 await p.locator('#go-set').click();await p.locator('#pause .pz-tabs [data-tab="gfx"]').click();await p.locator('#st-quality [data-quality="mobile"]').click();await p.locator('#pz-close').click();
 await p.locator('#go-play').click();await p.locator('#sel-maps button').filter({hasText:/^마크X발로$/}).click();
 await p.waitForFunction(()=>ASCENT_TRIAL.status==='ready');await p.locator('#sel-go').click({timeout:120000});await p.waitForFunction(()=>ASCENT_TRIAL.active&&!!myActor(),null,{timeout:120000});
 await p.evaluate(()=>{closeShop();ADMIN.freezeAI=true;world.phase='live';world.roundTime=999;togglePause(true);window.gfxBefore={loads:ASCENT_TRIAL.loads,pos:myActor().pos.toArray(),hp:myActor().hp};window.gfxColliders=COLLIDERS.slice();window.gfxNav=ASCENT_TRIAL.nav;});
 await p.locator('#pause .pz-tabs [data-tab="gfx"]').click();
 for(const mode of ['perf','mobile']){await p.locator('#st-quality [data-quality="'+mode+'"]').click();await p.waitForFunction(()=>ASCENT_TRIAL.graphicsStatus==='ready');}
 ascent=await p.evaluate(()=>({before:gfxBefore,after:{loads:ASCENT_TRIAL.loads,pos:myActor().pos.toArray(),hp:myActor().hp},sameCollision:gfxColliders.every((c,i)=>COLLIDERS[i]===c),sameNav:gfxNav===ASCENT_TRIAL.nav,profile:ASCENT_TRIAL.renderStats.profile,textures:ASCENT_TRIAL.textureCount,colliders:COLLIDERS.length}));
 assert.deepEqual(ascent.after,ascent.before,'changing rendering does not reload gameplay or move the player');assert.ok(ascent.sameCollision&&ascent.sameNav);assert.equal(ascent.profile,'mobile');assert.equal(ascent.textures,239);assert.equal(ascent.colliders,44380);
 await p.context().close();
 }
 const phone=await f.page('graphicsphone',{width:393,height:852},{isMobile:true,hasTouch:true,deviceScaleFactor:3,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'},{quality:false,bootTimeout:120000,beforeLoad:async page=>{
  await page.addInitScript(()=>{if(!sessionStorage.getItem('graphics_old_seed')){localStorage.setItem('lgp_set',JSON.stringify({quality:'auto',sens:1.7,sfx:false}));sessionStorage.setItem('graphics_old_seed','1');}});
 }});
 phone.setDefaultTimeout(90000);
 assert.deepEqual(await phone.evaluate(()=>({mode:SETTINGS.quality,sens:SETTINGS.sens,sfx:SETTINGS.sfx,ratio:renderer.getPixelRatio()})),{mode:'mobile',sens:1.7,sfx:false,ratio:1});
 assert.equal(await phone.evaluate(()=>LANDSCAPE.shown()),true,'portrait phone follows the existing rotation screen');
 await phone.screenshot({path:'test-results/graphics-phone-rotate.png'});
 await phone.setViewportSize({width:852,height:393});await phone.waitForFunction(()=>!LANDSCAPE.shown());
 await phone.locator('#go-set').click();await phone.locator('#pause .pz-tabs [data-tab="gfx"]').click();
 assert.deepEqual(await phone.locator('#st-quality button').allTextContents(),['휴대폰','성능','비주얼','최고']);
 const bounds=await phone.locator('#st-quality button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,right:r.right,width:r.width,height:r.height};}));
 assert.ok(bounds.every(r=>r.x>=0&&r.right<=852&&r.width>40&&r.height>=20),JSON.stringify(bounds));
 await phone.locator('#st-quality [data-quality="visual"]').click();assert.equal(await phone.evaluate(()=>GFX.msaa),0,'mobile hardware safeguard keeps post MSAA off');
 await phone.locator('#st-quality [data-quality="mobile"]').click();await phone.screenshot({path:'test-results/graphics-phone-landscape.png'});
 await phone.reload({waitUntil:'domcontentloaded'});await phone.waitForFunction(()=>!document.documentElement.dataset.gameLoading);assert.equal(await phone.evaluate(()=>SETTINGS.quality),'mobile');
 assert.deepEqual(f.errors,[]);console.log('Four modes, high/low reset, persistence and phone layout:',JSON.stringify({results,ascent,phone:bounds}));
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
