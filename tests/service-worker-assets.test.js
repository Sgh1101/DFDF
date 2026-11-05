const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('asset manifests use the network while immutable images continue to reuse the installed asset cache',async()=>{
  const handlers=new Map(),calls={network:[],cache:[]},origin='https://game.example';
  const context={URL,Response,location:{origin},self:{addEventListener:(name,fn)=>handlers.set(name,fn)},fetch:async req=>{calls.network.push(req.url);return new Response('latest manifest');},caches:{open:async()=>({match:async req=>{calls.cache.push(req.url);return new Response('old cached bytes');}})}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),context);
  async function get(path){let response;handlers.get('fetch')({request:{url:origin+path,method:'GET',mode:'cors'},respondWith:p=>{response=p;}});return (await response).text();}
  assert.equal(await get('/assets/champions-phantom/dfdf-1/manifest.json'),'latest manifest');
  assert.equal(await get('/assets/champions-phantom/dfdf-1/manifest.json?revision=next'),'latest manifest');
  assert.equal(await get('/assets/champions-phantom/dfdf-1/textures/item/phantom_attacker.png'),'old cached bytes');
  assert.equal(calls.network.length,2);assert.equal(calls.cache.length,1);
});

test('activation retires the entire legacy asset cache, including unversioned imported terrain',async()=>{
 const handlers=new Map(),removed=[];let pending;
 const context={URL,location:{origin:'https://game.example'},self:{addEventListener:(k,f)=>handlers.set(k,f),clients:{claim:async()=>{}}},caches:{keys:async()=>['13-v2','13-assets-v1','13-v3-original-maps','13-assets-v2-original-maps'],delete:async k=>{removed.push(k);},open:async()=>({keys:async()=>[],delete:async()=>{}})}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),context);
 handlers.get('activate')({waitUntil:p=>{pending=p;}});await pending;
 assert.deepEqual(removed.sort(),['13-assets-v1','13-v2','13-v3-original-maps']);
});

test('activation purges retired files while retaining the current island preview and Champions',async()=>{
 const handlers=new Map(),origin='https://game.example',deleted=[];
 const stale=['/assets/maps/ascent/geometry.bin?v=neighborhood-2','/assets/site/maps/ascent_trial.webp?v=neighborhood-2','/assets/maps/kour/manifest.json','/assets/site/maps/desert_town.webp','/assets/maps/ascent/geometry.bin?v=blocks2','/assets/ui/ascent-preview-v3.webp','/assets/site/maps/ascent_trial.webp?x=1','/assets/site/maps/ascent_trial.webp?v=original-1','/assets/maps/ascent/manifest.json?v=original-1','/assets/maps/ascent/geometry.bin?v=original-1'];
 const keep=['/assets/maps/ascent/manifest.json?v=district-ascent-1','/assets/site/maps/ascent_trial.webp?v=district-ascent-1','/assets/champions-phantom/dfdf-1/manifest.json'];
 const knife='/assets/rgx-firefly/v1/';
 stale.push(knife+'sounds/future_butterfly_draw.ogg?sha256=old',knife+'model.json',knife+'animation.json?sha256=d415254c87f8310ca4bcc23fea57ecd17e3bc12f3ea010a24862fc320e58bd79');
 keep.push(knife+'sounds/sgh_draw.wav?sha256=new',knife+'animation.json?sha256=new');
 const cache={keys:async()=>[...stale,...keep].map(u=>({url:origin+u})),delete:async r=>{deleted.push(r.url.slice(origin.length));return true;}};
 const context={URL,location:{origin},self:{addEventListener:(n,f)=>handlers.set(n,f),clients:{claim:async()=>{}}},caches:{keys:async()=>[],open:async()=>cache}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),context);
 let done;handlers.get('activate')({waitUntil:p=>done=p});await done;
 assert.deepEqual(deleted.sort(),stale.sort());
});
