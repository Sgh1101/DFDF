// Privacy > header Game Guide, and registration/control/cache names were explored
// in a disposable Chromium context before writing this test. No production API.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const oldWorker=`self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(new URL(e.request.url).pathname.startsWith('/assets/'))e.respondWith(caches.open('13-assets-v1').then(async c=>(await c.match(e.request))||fetch(e.request)));});`;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 let current=false,browser;const requests=new Map();
 const policy=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'))).headers.flatMap(r=>r.headers).find(h=>/^Content-Security-Policy/.test(h.key));
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');requests.set(url.pathname,(requests.get(url.pathname)||0)+1);
  res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/sw.js'){res.setHeader('Content-Type','text/javascript');return res.end(current?fs.readFileSync(path.join(root,'sw.js')):oldWorker);}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.stat(file,(err,s)=>{if(err||!s.isFile()){res.writeHead(404);return res.end();}
   const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'})[ext]||'application/octet-stream');
   if(ext==='.html')res.setHeader(policy.key,policy.value);
   fs.createReadStream(file).pipe(res);
  });
 });
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  const ctx=await browser.newContext({serviceWorkers:'allow',viewport:{width:1000,height:740}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(base+'/privacy.html',{waitUntil:'load'});await page.locator('h1').waitFor();
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(async()=>{
   const old=await caches.open('13-assets-v1');await old.put('/assets/maps/ascent/geometry.bin',new Response('obsolete imported geometry'));
   const keep=await caches.open('13-assets-v2-original-maps');await keep.put('/assets/maps/kour/manifest.json',new Response('retired map'));await keep.put('/assets/maps/ascent/manifest.json',new Response('stale manifest'));
  });
  assert.equal(await page.evaluate(async()=>(await fetch('/assets/maps/ascent/geometry.bin')).text()),'obsolete imported geometry','precondition: returning player is using the old asset cache');
  await page.evaluate(()=>{window.previousWorker=navigator.serviceWorker.controller;window.workerChanges=0;navigator.serviceWorker.addEventListener('controllerchange',()=>workerChanges++);});
  current=true;await page.evaluate(async()=>{
   const r=await navigator.serviceWorker.getRegistration();await r.update();
   const replacement=r.installing||r.waiting||r.active;
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Replacement worker did not finish activation')),15000);
    const inspect=()=>{if(replacement.state==='activated'){clearTimeout(timer);resolve();}};
    replacement.addEventListener('statechange',inspect);inspect();
   });
  });
  const keys=await page.evaluate(()=>caches.keys());console.log('post-update',JSON.stringify({keys,requests:[...requests],worker:await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {controller:!!navigator.serviceWorker.controller,active:r.active?.state,installing:r.installing?.state,waiting:r.waiting?.state,changes:workerChanges};})}));assert.ok(!keys.includes('13-assets-v1'));assert.ok(keys.includes('13-assets-v2-original-maps'));
  assert.equal(await page.evaluate(async()=>!!await(await caches.open('13-assets-v2-original-maps')).match('/assets/maps/kour/manifest.json')),false);
  async function bytes(url){return page.evaluate(async url=>{const r=await fetch(url,{cache:'no-store'}),b=await r.arrayBuffer();return{status:r.status,bytes:b.byteLength,sha:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')};},url);}
  const geometry=await bytes('/assets/maps/ascent/geometry.bin');assert.equal(geometry.sha,hash(fs.readFileSync(path.join(root,'assets/maps/ascent/geometry.bin'))));
  const manifest=await page.evaluate(async()=>(await fetch('/assets/maps/ascent/manifest.json')).json());
  assert.deepEqual(manifest,JSON.parse(fs.readFileSync(path.join(root,'assets/maps/ascent/manifest.json'),'utf8')),'manifests bypass even a poisoned asset cache');
  const image='/assets/site/maps/ascent_trial.webp?v=district-ascent-1',online=await bytes(image);assert.equal(online.status,200);
  await page.evaluate(async url=>{const deadline=performance.now()+5000,c=await caches.open('13-assets-v2-original-maps');while(!await c.match(url)){if(performance.now()>deadline)throw Error('Preview was not cached');await new Promise(r=>setTimeout(r,25));}},image);
  await ctx.setOffline(true);const cached=await bytes(image);assert.deepEqual(cached,online,'current terrain preview remains available from the real worker cache');
  await page.goto(base+'/guide.html?offline-check=1',{waitUntil:'domcontentloaded'});await page.getByText('인터넷에 연결되어 있지 않습니다.',{exact:false}).waitFor();
  fs.mkdirSync('test-results/readiness',{recursive:true});await page.screenshot({path:'test-results/readiness/service-worker-offline.png'});
  await ctx.setOffline(false);await page.getByRole('button',{name:'다시 시도',exact:true}).click();await page.locator('h1').filter({hasText:'게임 소개와 시작하기'}).waitFor();
  await page.screenshot({path:'test-results/readiness/service-worker-restored.png'});
  assert.deepEqual(errors,[]);console.log('Real worker update, legacy cache retirement, current geometry integrity, manifest freshness, offline cached image, friendly fallback and UI retry passed',JSON.stringify({keys,geometry,image:online}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
