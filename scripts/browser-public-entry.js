// Explored anonymous index.html in actual Chrome at 375x800 and 1280x700 before writing this test.
const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
(async()=>{const f=await fixture(),base=process.env.DFDF_BASE_URL||'http://127.0.0.1:3000',ads=[],errors=[];fs.mkdirSync('test-results/public-entry',{recursive:true});
 try{
  for(const [width,height,locale]of [[360,640,'en-US'],[375,800,'ko-KR'],[1280,700,'en-US'],[844,390,'ko-KR']]){
   const ctx=await f.browser.newContext({locale,viewport:{width,height},serviceWorkers:'block'}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
   p.on('request',r=>{if(/googlesyndication\.com|doubleclick\.net|fundingchoicesmessages\.google\.com/.test(r.url()))ads.push(r.url());});
   await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));await p.route('https://fonts.gstatic.com/**',r=>r.fulfill({status:204,body:''}));
   await p.route('**/api/v1?*',async r=>{const result=await f.h.api(new URL(r.request().url()).searchParams.get('a'),r.request().postDataJSON()||{});await r.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result)});});
   await p.goto(base+'/?room=ABC123&source=app',{waitUntil:'load'});await p.locator('#v-auth').waitFor({state:'visible'});
   const initialLang=locale==='ko-KR'?'ko':'en';assert.equal(await p.locator('html').getAttribute('lang'),initialLang,'initial language follows the explicit browser locale');
   assert.equal(await p.locator('#publicIntro').count(),1,'public introduction exists before sign-in');assert.ok(await p.locator('#publicIntro').isVisible());
   await p.waitForFunction(()=>document.querySelector('#publicIntro img')?.naturalWidth>0);
   const layout=await p.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),heading=r('#publicIntro h1'),auth=r('#v-auth'),start=r('#publicStart');return {overflow:document.documentElement.scrollWidth>innerWidth,ordered:heading.bottom<auth.top,startVisible:start.top>=0&&start.bottom<=innerHeight};});
   assert.equal(layout.overflow,false);assert.equal(layout.ordered,true,'game introduction precedes account form');assert.equal(layout.startVisible,true,'entry link is on the first screen');
   assert.ok((await p.locator('#publicIntro').innerText()).includes('AI'));
   await p.screenshot({path:`test-results/public-entry/home-${width}.png`,fullPage:true});
   await p.locator('#menuBtn').click();await p.locator('#lang').click();
   await p.waitForFunction(lang=>document.documentElement.lang===lang,initialLang==='ko'?'en':'ko');
   if(initialLang==='en'){await p.locator('#menuBtn').click();await p.locator('#lang').click();await p.waitForFunction(()=>document.documentElement.lang==='en');}
   assert.equal(await p.locator('html').getAttribute('lang'),'en');assert.match(await p.locator('#publicIntro h1').innerText(),/5v5/);assert.match(await p.locator('#publicGuide').innerText(),/Korean/);
   await p.keyboard.press('Escape');await p.locator('#publicGuide').click();await p.waitForURL('**/guide.html');assert.ok(await p.getByRole('heading',{level:1}).isVisible());await p.goBack({waitUntil:'load'});
   await p.locator('#publicLogin').click();await p.waitForFunction(()=>document.activeElement?.id==='uid');
   await p.locator('#publicStart').click();await p.waitForFunction(()=>document.activeElement?.id==='doGuest');
   await p.keyboard.press('Enter');await p.locator('#v-dash').waitFor({state:'visible'});assert.equal(await p.locator('#publicIntro').isVisible(),false);
   const enter=await p.locator('#enter').getAttribute('href');assert.ok(enter.includes('room=ABC123')&&enter.includes('source=app'),'guest entry preserves invite and app source');
   await ctx.close();console.log(width+'x'+height+' public content, guide, language, keyboard guest flow and invite preserved');
  }
  const nojs=await f.browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:800},serviceWorkers:'block'}),p=await nojs.newPage();await p.goto(base+'/',{waitUntil:'load'});
  assert.ok(await p.locator('#publicIntro h1').isVisible());assert.ok((await p.locator('#publicIntro').innerText()).includes('5대5'));await p.locator('#publicGuide').click();await p.waitForURL('**/guide.html');assert.ok(await p.getByRole('heading',{level:1}).isVisible());await nojs.close();
  assert.deepEqual(ads,[]);assert.deepEqual(errors,[]);console.log('No-JS public introduction and guide available; no advertising requests or page errors');
 }finally{await f.browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
