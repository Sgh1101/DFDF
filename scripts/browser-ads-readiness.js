// Explored privacy.html#choices in the actual browser before adding these checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
(async()=>{const f=await fixture(),base=process.env.DFDF_BASE_URL||'http://127.0.0.1:3000',ads=[];fs.mkdirSync('test-results/readiness',{recursive:true});try{
 for(const width of [375,1280]){
  const ctx=await f.browser.newContext({viewport:{width,height:800},serviceWorkers:'block'}),p=await ctx.newPage();
  p.on('request',r=>{if(/googlesyndication\.com|doubleclick\.net|fundingchoicesmessages\.google\.com/.test(r.url()))ads.push(r.url());});
  p.on('pageerror',e=>f.errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await p.route('https://fonts.gstatic.com/**',r=>r.fulfill({status:204,body:''}));
  for(const name of ['terms','credits','privacy']){
   await p.goto(base+'/'+name+'.html',{waitUntil:'load'});assert.ok(await p.getByRole('heading',{level:1}).isVisible());
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);
   for(const href of ['./terms.html','./credits.html','./privacy.html#choices'])assert.equal(await p.locator('.sf-links a[href="'+href+'"]').count(),1);
  }
  await p.getByRole('link',{name:'개인정보 설정과 선택 철회',exact:true}).click();
  assert.equal(await p.locator('#privacyAdvertising').isChecked(),false);assert.equal(await p.locator('#privacyAnalytics').isChecked(),false);
  await p.locator('#privacyAdvertising').check();await p.getByRole('button',{name:'선택 저장',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('#privacyChoiceStatus').textContent.includes('저장했습니다'));
  await p.reload({waitUntil:'load'});assert.equal(await p.locator('#privacyAdvertising').isChecked(),true);assert.equal(await p.locator('#privacyAnalytics').isChecked(),false);
  await p.getByRole('button',{name:'선택 철회 · 필수만 사용',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#privacyChoiceStatus').textContent.includes('철회했습니다'));
  await p.reload({waitUntil:'load'});assert.equal(await p.locator('#privacyAdvertising').isChecked(),false);assert.equal(await p.locator('#privacyAnalytics').isChecked(),false);
  await p.locator('#choices').scrollIntoViewIfNeeded();await p.screenshot({path:'test-results/readiness/privacy-'+width+'.png'});
  await ctx.close();
 }
 assert.deepEqual(ads,[],'optional preference never starts an advertising request');assert.deepEqual(f.errors,[]);
 console.log('Privacy choices: default-off, persist, withdraw, global links, no overflow at 375/1280 and no ad requests passed');
}finally{await f.browser.close();}})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
