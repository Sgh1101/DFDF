const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
// The diagnostics/update and reconnect screen were inspected before this check.
(async()=>{const f=await fixture();try{
 const p=await f.page('pwaupdate',{width:852,height:393},{serviceWorkers:'allow'});
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 // Old shell cache is removed on activation without touching player settings.
 await p.evaluate(async()=>{localStorage.setItem('dfdf-pwa-test-setting','kept');await caches.open('13-v1');const registration=await navigator.serviceWorker.getRegistration();await navigator.serviceWorker.register('/sw.js?qa=update');});
 await p.waitForFunction(async()=>!(await caches.keys()).includes('13-v1'));const cached=await p.evaluate(()=>caches.keys());assert.ok(cached.includes('13-v2'));
 await p.context().setOffline(true);await p.goto((process.env.DFDF_BASE_URL||'http://127.0.0.1:3000')+'/',{waitUntil:'domcontentloaded'});
 assert.match(await p.locator('body').innerText(),/인터넷에 연결되어 있지 않습니다/);assert.equal(await p.getByRole('button',{name:'다시 시도'}).isVisible(),true);
 await p.context().setOffline(false);await p.getByRole('button',{name:'다시 시도'}).click();await p.waitForFunction(()=>!document.body.textContent.includes('인터넷에 연결되어 있지 않습니다'));
 assert.equal(await p.evaluate(()=>localStorage.getItem('dfdf-pwa-test-setting')),'kept');
 console.log('Browser service worker control, offline retry and settings persistence passed; installed Android/iOS not simulated');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
