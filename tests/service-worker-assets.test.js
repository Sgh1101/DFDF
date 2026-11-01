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

test('activating drops the removed map files from the asset cache and keeps the ones the game still uses',async()=>{
  const handlers=new Map(),origin='https://game.example',deleted=[];
  const urls=['/assets/maps/kour/manifest.json','/assets/maps/kour/map7.json.gz','/assets/maps/kour/textures/a.png','/assets/site/maps/desert_town.webp','/assets/valorant-packs/x.glb',
    '/assets/maps/ascent/manifest.json','/assets/maps/ascent/terrain.bin','/assets/site/maps/ascent_trial.webp?x=1','/assets/site/maps/dunes.webp','/assets/champions-phantom/dfdf-1/manifest.json'];
  const cache={keys:async()=>urls.map(u=>({url:origin+u})),delete:async r=>{deleted.push(new URL(r.url).pathname);return true;}};
  const context={URL,Response,location:{origin},self:{addEventListener:(name,fn)=>handlers.set(name,fn),clients:{claim:async()=>{}}},caches:{keys:async()=>['13-v2','13-assets-v1'],open:async()=>cache,delete:async()=>true}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),context);
  let done;handlers.get('activate')({waitUntil:p=>{done=p;}});await done;
  assert.deepEqual(deleted.sort(),['/assets/maps/kour/manifest.json','/assets/maps/kour/map7.json.gz','/assets/maps/kour/textures/a.png','/assets/site/maps/desert_town.webp','/assets/valorant-packs/x.glb'].sort());
});
