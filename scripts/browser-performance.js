const assert = require('node:assert/strict'), fs = require('node:fs');
const {fixture} = require('./browser-fixture');
// Explored the normal map picker and live Ascent HUD before authoring checks.
// Times are synchronous CPU step costs under headless SwiftShader, not GPU FPS.
(async () => {
 const f = await fixture(), results = {};
 try {
  const labels = process.env.DFDF_PERF_BASELINE_ENGINE ? ['before', 'after'] : ['after'];
  for (const label of labels) {
   const p = await f.page('mapperf' + label, {width:1280,height:720}, {}, {bootTimeout:120000,
    beforeLoad: label === 'before' ? async page => {
     await page.route('**/js/legacy/03-engine.js', route => route.fulfill({path:process.env.DFDF_PERF_BASELINE_ENGINE,contentType:'text/javascript'}));
     if(process.env.DFDF_PERF_BASELINE_HOSPITAL)await page.route('**/js/legacy/102-bots-climb-the-hospital-stairs-and-the-minimap-shows-the-floor.js', route => route.fulfill({path:process.env.DFDF_PERF_BASELINE_HOSPITAL,contentType:'text/javascript'}));
    } : undefined});
   await p.waitForFunction(() => VALORANT_PACK.status === 'ready');
   await p.locator('#go-play').click();
   if (await p.locator('#sel-pick').isVisible()) await p.locator('#sel-pick').click();
   await p.locator('#sel-maps button').filter({hasText:/^마크X발로$/}).click();
   await p.waitForFunction(() => ASCENT_TRIAL.status === 'ready');
   await p.locator('#sel-go').click({timeout:120000});
   await p.waitForFunction(() => ASCENT_TRIAL.active && !!myActor(), null, {timeout:120000});
   const result = await p.evaluate(() => {
    requestAnimationFrame = () => 0; closeShop(); world.phase = 'live'; world.roundTime = 999;
    for (const a of world.actors) { a.invuln=999; a.fireCd=999; }
    ADMIN.freezeAI=false;
    // Warm both images and initial actor rigs before measuring steady play.
    for (let i=0;i<30;i++) step(.016);
    const times=[];
    for (let i=0;i<120;i++) {world.phase='live';world.roundTime=999;const start=performance.now();step(.016);times.push(performance.now()-start);}
    times.sort((a,b)=>a-b);
    const result={colliders:COLLIDERS.length,textures:ASCENT_TRIAL.textureCount,medianMs:times[60],p95Ms:times[114],totalMs:times.reduce((a,b)=>a+b,0)};
    drawMini();drawTac(); // step() no longer draws the maps (the frame does, on a clock): warm both terrain images here
    const fill=CanvasRenderingContext2D.prototype.fillRect, counts={mini:0,terrain:0};
    CanvasRenderingContext2D.prototype.fillRect=function(){if(this.canvas===mini)counts.mini++;else if(this.canvas!==tac)counts.terrain++;return fill.apply(this,arguments);};
    try {for(let i=0;i<30;i++){drawMini();drawTac();}} finally {CanvasRenderingContext2D.prototype.fillRect=fill;}
    result.rects=counts;
    if(typeof MINIW !== 'undefined') {
     const ref=document.createElement('canvas');ref.width=mini.width;ref.height=mini.height;
     const ctx=ref.getContext('2d'),b=MAP.bounds,x=ref.width/(b.maxX-b.minX),z=ref.height/(b.maxZ-b.minZ);ctx.fillStyle='#2a3444';
     for(const c of COLLIDERS)ctx.fillRect((c.minX-b.minX)*x,(c.minZ-b.minZ)*z,(c.maxX-c.minX)*x,(c.maxZ-c.minZ)*z);
     const expected=ctx.getImageData(0,0,ref.width,ref.height).data,actual=MINIW.cv.getContext('2d').getImageData(0,0,ref.width,ref.height).data;
     result.pixelDifferences=actual.reduce((n,v,i)=>n+(v!==expected[i]),0);
     const revision=MAP_WALLS.revision,spike=world.spike,prior={state:spike.state,x:spike.x,z:spike.z};
     const snapshot=()=>new Uint8Array(mctx.getImageData(0,0,mini.width,mini.height).data);
     spike.state='dropped';spike.x=MAP.attackSpawn.x;spike.z=MAP.attackSpawn.z;drawMini();const first=snapshot();
     spike.x=MAP.defendSpawn.x;spike.z=MAP.defendSpawn.z;drawMini();const second=snapshot();Object.assign(spike,prior);
     result.liveMarkerChanged=first.some((v,i)=>v!==second[i]);result.markerRevisionStable=MAP_WALLS.revision===revision;
    }
    return result;
   });
   results[label]=result;console.log(label,JSON.stringify(result));
   fs.writeFileSync('test-results/performance.json',JSON.stringify(results,null,2));
   assert.equal(result.colliders,44380);assert.equal(result.textures,239);
   if(label==='after'){
    assert.ok(result.rects.mini<100,JSON.stringify(result));assert.equal(result.rects.terrain,0,'warm terrain stays cached');
    assert.equal(result.pixelDifferences,0,'all source wall pixels match the original draw');
    assert.ok(result.liveMarkerChanged,'dropped spike marker keeps moving');assert.ok(result.markerRevisionStable,'moving markers do not rebuild terrain');
    await p.screenshot({path:'test-results/perf-after.png'});
   }else assert.ok(result.rects.mini>30*44000);
   await p.context().close();
  }
  assert.deepEqual(f.errors,[]);fs.writeFileSync('test-results/performance.json',JSON.stringify(results,null,2));
 } finally {await f.browser.close();}
})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
