const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('./browser-fixture');
// Menu, diagnostics and both training entry points were explored before this test.
(async()=>{const f=await fixture();try{
 const p=await f.page('improvements',{width:852,height:393},{isMobile:true,hasTouch:true});
 const dir=process.env.SHOT_DIR||'test-results/improvements';fs.mkdirSync(dir,{recursive:true});
 await p.locator('#go-diagnostics').click();await p.locator('#game-diagnostics').waitFor({state:'visible'});
 assert.equal(await p.locator('#game-diagnostics').getAttribute('role'),'dialog');
 const d=JSON.parse(await p.locator('#diagnostic-values').innerText());assert.deepEqual(Object.keys(d.platform),['browser','mobile','viewport','pixelRatio','standalone']);
 assert.ok(!JSON.stringify(d).includes('improvements'));assert.equal(d.schema,1);
 await p.locator('#diagnostic-reset').click();await p.locator('#diagnostic-export').click();
 await p.screenshot({path:path.join(dir,'diagnostics.png')});
 await p.keyboard.press('Escape');await p.locator('#game-diagnostics').waitFor({state:'hidden'});
 assert.equal(await p.evaluate(()=>document.activeElement.id),'go-diagnostics');
 await p.locator('.home-practice summary').click();await p.locator('#go-quick-guide').click();
 assert.ok((await p.locator('#mode-guides').innerText()).includes('축소전 · 줄어드는'));
 await p.setViewportSize({width:568,height:320});
 const b=await p.locator('#guide-start').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=568&&b.y+b.height<=320);
 await p.locator('#guide-start').click();await p.locator('#training-task').waitFor({state:'visible'});
 const range=await p.evaluate(()=>{
   render=()=>{};titleCam=()=>{};ADMIN.freezeAI=true;world.phase='live';const a=myActor();step(.05);a.pos.x+=5;step(.05);
   const moved=document.querySelector('#training-task span').textContent;a.ammo[actorWeaponKey(a)]=0;actorReload(a);step(.05);
   const reload=document.querySelector('#training-task span').textContent;TARGET_RANGE.RANGE.hits+=3;step(.05);
   return {mode:room.mode,practice:GAME_PRACTICE,moved,reload,complete:document.querySelector('#training-task span').textContent};
 });
 assert.equal(range.mode,'range');assert.equal(range.practice,true);assert.match(range.moved,/장전/);assert.match(range.reload,/표적/);assert.match(range.complete,/완료/);
 await p.locator('#training-task button').click();assert.equal(await p.locator('#training-task').isVisible(),false);
 const model=await p.evaluate(()=>LEGACY_GUN_MODELS.keys.map(key=>{const g=GUN_BUILD[key]();return {key,anchors:g.userData.anchors,muzzle:GUN_SKINS.template(key,{id:'default'}).userData.muzzle};}));
 for(const m of model){assert.equal(m.anchors.right.length,3);assert.equal(m.anchors.muzzle.length,3);assert.deepEqual(m.muzzle,m.anchors.muzzle.map(n=>n*.88));}
 const before=await p.evaluate(()=>{world.phase='live';closeShop();document.getElementById('pause').hidden=true;GAME_DIAGNOSTICS.reset();for(let i=0;i<60;i++)autoQuality(.016,.016);return {r:GAME_DIAGNOSTICS.report(),pixel:renderer.getPixelRatio()};});
 assert.ok(before.r.frameMs.samples>=60);assert.ok(before.r.frameMs.p95<17);assert.equal(before.pixel,1);
 // Actual cached preview resources, after repeated open/close (warm-up excluded).
 await p.evaluate(()=>{world.phase='menu';document.getElementById('s-title').hidden=false;document.getElementById('hud').hidden=true;});
 await p.setViewportSize({width:852,height:393});const memory=[];
 for(let i=0;i<5;i++){await p.locator('#go-armory').click();await p.waitForFunction(()=>GUN_SKINS._pv()?.r&&GUN_SKINS._pv()?.obj);memory.push(await p.evaluate(()=>({...GUN_SKINS._pv().r.info.memory})));await p.locator('#ar-close').click();}
 assert.ok(memory[4].geometries<=memory[1].geometries+5,JSON.stringify(memory));assert.ok(memory[4].textures<=memory[1].textures+2,JSON.stringify(memory));
 const catalog=await f.h.api('catalog'),u=f.h.user('improvements');u.gold=5000;u.own={};for(const g of catalog.guns)u.own[g]=Object.keys(catalog.tiers).filter(s=>catalog.tiers[s]<5&&(!catalog.only[s]||catalog.only[s]===g));f.h.db.set('user:improvements',JSON.stringify(u));
 await p.evaluate(()=>GUN_SKINS.sync());await p.locator('#go-armory').click();await p.locator('#ar-tabs [data-tab="pull"]').click();
 await p.waitForFunction(()=>!document.getElementById('ar-pull1').disabled);assert.match(await p.locator('#ar-why').innerText(),/반환/);
 await p.locator('#ar-pull1').click();await p.waitForFunction(()=>document.body.textContent.includes('전액 반환'));assert.equal(f.h.user('improvements').gold,5000);
 await p.locator('#ar-close').click();
 const definitions=await p.evaluate(()=>AGENTS.map(a=>({id:a.id,name:a.name,abilities:a.abilities.map(d=>({key:d.key,type:d.type,name:d.name,desc:d.desc,ult:!!d.ult,counterplay:d.counterplay||''}))})));
 fs.writeFileSync(path.join(dir,'ability-definitions.json'),JSON.stringify(definitions,null,2));
 fs.writeFileSync(path.join(dir,'measurements.json'),JSON.stringify({range,model,memory,diagnostics:before.r},null,2));
 await p.locator('#go-mark-valo').click();await p.waitForFunction(()=>room.map==='ascent_trial');assert.equal(await p.evaluate(()=>room.map),'ascent_trial');
 assert.deepEqual(f.errors,[]);console.log('Diagnostics privacy/focus, 568x320 guide, reward-free training, six explicit anchors, bounded preview resources and direct map entry passed');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
