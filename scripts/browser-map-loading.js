const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
// The public map chip and select/back/start paths were explored in Chromium.
(async()=>{const f=await fixture();try{
 const p=await f.page('maploading',{width:960,height:600},{},{bootTimeout:120000});
 await p.evaluate(()=>{window.nativeEnsure=ASCENT_TRIAL.ensure;window.mapResumes=[];ASCENT_TRIAL.ensure=()=>new Promise(r=>mapResumes.push(r));});
 await p.locator('#go-play').click();await p.locator('#sel-maps button').filter({hasText:/^마크X발로$/}).click();await p.locator('#sel-go').click();await p.locator('#sel-back').click();
 await p.evaluate(async()=>{for(const r of mapResumes)r(true);mapResumes=[];await Promise.resolve();});
 assert.ok(await p.evaluate(()=>world.phase==='menu'&&!myActor()),'returning to the title cancels a start waiting for terrain');
 await p.locator('#go-play').click();await p.locator('#sel-maps button').filter({hasText:/^마크X발로$/}).click();await p.locator('#sel-go').click();await p.locator('#sel-maps button').filter({hasText:/^빙하 관측소$/}).click();await p.locator('#sel-go').click();
 await p.waitForFunction(()=>CUR_MAP_KEY==='glacier'&&!!myActor());
 const id=await p.evaluate(()=>myActor().id);await p.evaluate(async()=>{for(const r of mapResumes)r(true);await Promise.resolve();ASCENT_TRIAL.ensure=nativeEnsure;});
 assert.equal(await p.evaluate(()=>CUR_MAP_KEY),'glacier');assert.equal(await p.evaluate(()=>myActor().id),id);
 assert.equal(await p.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/maps/ascent/')).length),0);
 assert.deepEqual(f.errors,[]);console.log('Map loading: public chip, queued start cancellation on Back and switching maps, ordinary-game startup and no terrain downloads passed; only map readiness is deferred by this test.');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
