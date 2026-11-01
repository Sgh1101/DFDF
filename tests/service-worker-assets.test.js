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
 assert.deepEqual(removed.sort(),['13-assets-v1','13-v2']);
});
