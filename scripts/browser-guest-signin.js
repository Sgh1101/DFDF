const assert=require('node:assert/strict'),{fixture}=require('./browser-fixture');
// The home guest dashboard and combined auth form were explored before this test.
(async()=>{const f=await fixture();let release=()=>{};try{
 f.h.config.game.promoNotice=false;
 const guest=await f.h.api('guest',{device:'guest-home-auth'}),context=await f.browser.newContext({viewport:{width:1280,height:700},serviceWorkers:'block'}),p=await context.newPage();
 p.setDefaultTimeout(15000);p.on('pageerror',e=>f.errors.push(e.message));
 const held=new Promise(resolve=>{release=resolve;});
 await p.route('**/api/v1?*',async route=>{const action=new URL(route.request().url()).searchParams.get('a');if(action==='auth')await held;const result=await f.h.api(action,route.request().postDataJSON()||{});await route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result)});});
 await p.route('https://fonts.googleapis.com/**',route=>route.abort());await p.route('https://fonts.gstatic.com/**',route=>route.abort());
 await p.addInitScript(s=>{localStorage.setItem('lgp_session',JSON.stringify(s));sessionStorage.setItem('lgp_gate',s.token);localStorage.setItem('lgp_lang','en');},guest);
 await p.goto((process.env.DFDF_BASE_URL||'http://127.0.0.1:3000')+'/');await p.waitForFunction(()=>!document.getElementById('v-dash').hidden);
 await p.locator('#guestSignIn').click();await p.locator('#uid').fill('homeuitest');await p.locator('#upw').fill('browser-home-password');
 const request=p.waitForRequest(r=>new URL(r.url()).searchParams.get('a')==='auth');await p.locator('#doAuth').click();await request;
 assert.equal(await p.locator('#authBack').isDisabled(),true,'Back cannot leave a pending account switch');
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lgp_session')).token),guest.token,'pending request keeps the guest session');
 release();await p.waitForFunction(()=>!document.getElementById('v-dash').hidden&&document.getElementById('meName').textContent.includes('homeuitest'));
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lgp_session')).user.id),'homeuitest','home registration completes');
 await p.locator('#menuBtn').click();await p.locator('#logout').click();
 assert.equal(await p.locator('#authBack').isVisible(),false,'signed-out form cannot return to an absent guest');
 assert.deepEqual(f.errors,[]);console.log('PASS home guest registration, pending-response navigation guard, logout');
}finally{release();await f.browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
