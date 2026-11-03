const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
const expected=require('../assets/champions-phantom/dfdf-1/geo/phantom_champions_2026.geo.json')['minecraft:geometry'][0].bones.reduce((n,b)=>n+(b.cubes?.length||0),0)*36;
(async()=>{const f=await fixture();try{
  const p=await f.page('champsdefault',{width:1100,height:720});
  await p.waitForFunction(()=>CHAMPIONS_PHANTOM.loaded());
  assert.equal(await p.locator('#phantom-file').count(),0,'the normal skin page must not import a reference JAR');
  await p.evaluate(async()=>{
    const assets=await PHANTOM_ASSETS.bundled(),name='geo/phantom_champions_2026.geo.json',geo=JSON.parse(new TextDecoder().decode(assets[name]));
    geo['minecraft:geometry'][0].bones.find(b=>b.cubes?.length).cubes.pop();assets[name]=new TextEncoder().encode(JSON.stringify(geo));
    await new Promise((resolve,reject)=>{const req=indexedDB.open('dfdf-phantom',1);req.onupgradeneeded=()=>req.result.createObjectStore('assets');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(assets,'local');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  });
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.GAME_BOOT&&!document.documentElement.dataset.gameLoading&&CHAMPIONS_PHANTOM.loaded());
  const vertices=await p.evaluate(()=>{render=()=>{};titleCam=()=>{};const skin=GUN_SKINS.list.find(s=>s.id==='champions_atk'),root=GUN_SKINS.buildFor('scout',skin);GUN_SKINS.apply(root,skin);let n=0;root.getObjectByName('phantom-rig').traverse(m=>{if(m.isMesh)n+=m.geometry.attributes.position.count;});return n;});
  assert.equal(vertices,expected,'a saved old model must not override our shipped design');
  await p.waitForFunction(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('dfdf-phantom',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('assets'),read=tx.objectStore('assets').get('local');tx.oncomplete=()=>{db.close();resolve(read.result===undefined);};};}));
  assert.deepEqual(f.errors,[]);console.log('Champions always loads the custom design, retires the old local JAR cache and exposes no import control');
}finally{await f.browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
