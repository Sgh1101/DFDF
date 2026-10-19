const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('asset manifests use the network while immutable images continue to reuse the installed asset cache',async()=>{
  const handlers=new Map(),calls={network:[],cache:[]},origin='https://game.example';
  const context={URL,Response,location:{origin},self:{addEventListener:(name,fn)=>handlers.set(name,fn)},fetch:async req=>{calls.network.push(req.url);return new Response('latest manifest');},caches:{open:async()=>({match:async req=>{calls.cache.push(req.url);return new Response('old cached bytes');}})}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),context);
  async function get(path){let response;handlers.get('fetch')({request:{url:origin+path,method:'GET',mode:'cors'},respondWith:p=>{response=p;}});return (await response).text();}
  assert.equal(await get('/assets/champions-phantom/2026-0.1.0/manifest.json'),'latest manifest');
  assert.equal(await get('/assets/champions-phantom/2026-0.1.0/manifest.json?revision=next'),'latest manifest');
  assert.equal(await get('/assets/champions-phantom/2026-0.1.0/textures/item/phantom_attacker.png'),'old cached bytes');
  assert.equal(calls.network.length,2);assert.equal(calls.cache.length,1);
});
