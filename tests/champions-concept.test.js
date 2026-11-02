const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('../scripts/champions-phantom/gun');
const {bedrock,THREE}=require('../scripts/champions-phantom/model');
const {painter,PALETTES}=require('../scripts/champions-phantom/gun-paint');

test('the concept stock has a clear central opening with finite, bounded native geometry',()=>{
 const model=build().fit(6,.25),geo=model.json()['minecraft:geometry'][0];
 assert.ok(model.cubes.length<=240,'mobile geometry budget');
 assert.equal(geo.description.texture_width,512);assert.equal(geo.description.texture_height,512);
 assert.deepEqual(geo.bones.find(b=>b.name==='muzzle_pos').pivot,[41.25,0,0]);
 for(const c of model.cubes){assert.ok([...c.origin,...c.size,...(c.rotation||[])].every(Number.isFinite));assert.ok(c.size.every(n=>n>0));}
 const mat=new THREE.MeshBasicMaterial(),rig=bedrock().build(geo,mat);rig.updateMatrixWorld(true);
 try{
  const stock=rig.getObjectByName('phantom-bone-stock');
  const ray=new THREE.Raycaster(new THREE.Vector3(-14,-2,-8),new THREE.Vector3(0,0,1),0,16);
  assert.equal(ray.intersectObject(stock,true).length,0,'the central opening must not be crossed by ladder-like braces');
  assert.ok(new THREE.Raycaster(new THREE.Vector3(-22,0,-8),new THREE.Vector3(0,0,1),0,16).intersectObject(stock,true).length>0,'the rear stock column is still solid');
 }finally{rig.traverse(m=>m.geometry?.dispose());mat.dispose();}
});

test('the ivory variant keeps the concept suppressor dark for material contrast',()=>{
 const cube=build().cubes.find(c=>c.bone==='barrel'&&c.origin[0]===29&&c.material==='dark');
 assert.ok(cube);
 const pixel=painter('defender')({material:cube.material,p:[35,0,1],n:[0,0,1],u:3,v:3,w:16,h:16,cube});
 assert.ok(PALETTES.defender.dark.includes(pixel.base),'the suppressor must stay graphite rather than ivory');
});
