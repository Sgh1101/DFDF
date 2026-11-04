const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('../scripts/champions-phantom/gun'),{bedrock,THREE}=require('../scripts/champions-phantom/model');
test('the redesigned rifle has solid stock volume, a broad receiver, curved magazine and round open suppressor',()=>{
  const m=build(),stock=m.cubes.filter(c=>c.bone==='stock'),receiver=m.cubes.filter(c=>c.bone==='receiver');
  assert.ok(stock.some(c=>c.size[0]>8&&c.size[1]>3&&c.size[2]>3),'closed stock rather than a wire frame');
  assert.ok(receiver.some(c=>c.size[0]>15&&c.size[1]>3&&c.size[2]>=4),'receiver has real lateral thickness');
  assert.ok(m.cubes.filter(c=>c.dfdf_mesh?.type==='bevel').length>=20);
  assert.ok(m.cubes.some(c=>c.bone==='barrel'&&c.dfdf_mesh?.type==='tube'),'real muzzle bore');
  const geo=m.fit(6,.25).json()['minecraft:geometry'][0],baseline=require('./fixtures/champions-motion-bones.json');
  assert.deepEqual(geo.bones.map(({cubes,...b})=>b),baseline,'motion bones match the pre-redesign record');
  const material=new THREE.MeshBasicMaterial(),rig=bedrock().build(geo,material);let vertices=0;
  try{rig.traverse(n=>{if(n.geometry){vertices+=n.geometry.attributes.position.count;assert.ok([...n.geometry.attributes.position.array].every(Number.isFinite));}});assert.ok(vertices>5000&&vertices<=15000,`${vertices} vertices`);assert.ok(m.cubes.length<=240);}finally{rig.traverse(n=>n.geometry?.dispose());material.dispose();}
});
test('our atlas painter supplies separate physical response for gold and rubber',()=>{
  const painter=require('../scripts/champions-phantom/gun-paint').painter('attacker');
  const base={p:[0,0,0],n:[0,0,1],u:2,v:2,w:8,h:8,cube:{size:[4,4,4]}};
  const gold=painter({...base,material:'trim'}),rubber=painter({...base,material:'dark',cube:{...base.cube,finish:'rubber'}});
  assert.equal(typeof gold.surface,'number');assert.equal(typeof rubber.surface,'number');
  assert.ok((gold.surface&255)>(rubber.surface&255)+100,'gold is metallic; rubber is not');
  assert.ok(((rubber.surface>>8)&255)>((gold.surface>>8)&255)+70,'rubber is rougher');
});
test('every interior solid UV sample remains opaque in both base and physical maps',()=>{
  const {paint}=require('../scripts/champions-phantom/model'),painter=require('../scripts/champions-phantom/gun-paint').painter,m=build().fit(6,.25),mat=new THREE.MeshBasicMaterial(),rig=bedrock().build(m.json()['minecraft:geometry'][0],mat);
  try{for(const side of ['attacker','defender']){
    const layers=paint(m,'bedrock',painter(side),['base','surface']);let missing=0,samples=0;
    rig.traverse(n=>{const uv=n.geometry?.attributes.uv;if(!uv)return;for(let i=0;i<uv.count;i+=3)for(let x=1;x<=8;x++)for(let y=1;y<=8-x;y++){
      const q=x/9,s=y/9,k=1-q-s,u=k*uv.getX(i)+q*uv.getX(i+1)+s*uv.getX(i+2),v=k*uv.getY(i)+q*uv.getY(i+1)+s*uv.getY(i+2),px=Math.min(511,Math.floor(u*512)),py=Math.min(511,Math.floor((1-v)*512));samples++;
      if(Object.values(layers).some(c=>!c.data[(py*512+px)*4+3]))missing++;
    }});assert.equal(missing,0,`${side}: ${missing}/${samples} valid interior samples hit unpainted pixels`);
  }}finally{rig.traverse(n=>n.geometry?.dispose());mat.dispose();}
});
