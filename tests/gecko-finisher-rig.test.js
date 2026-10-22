const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../js/gecko-finisher-rig');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const texture={texture_width:64,texture_height:32};
const uv=Object.fromEntries(['west','east','north','south','up','down'].map(f=>[f,{uv:[8,4],uv_size:[6,10]}]));
test('finisher uses the bundled GeckoLib coordinate convention, including cube rotations',()=>{
  assert.deepEqual(G.pivot([70.4,105.6,9.6]),[-70.4,105.6,9.6]);
  const r=G.rotation([90,90,90]);close(r[0],-Math.PI/2);close(r[1],-Math.PI/2);close(r[2],Math.PI/2);
  // 90-degree source X rotation is clockwise at runtime, not the old counterclockwise bend.
  const v=G.rotate([0,1,0],G.rotation([90,0,0]));v.forEach((n,i)=>close(n,[0,0,-1][i]));
  const b={pivot:[0,0,0],cubes:[{origin:[2,3,4],size:[1,2,3],pivot:[2,3,4],rotation:[90,0,0],uv}]};
  const p=G.data(b,texture).positions;
  const bounds=[0,1,2].map(i=>{const a=p.filter((n,j)=>j%3===i);return [Math.min(...a),Math.max(...a)];});
  assert.deepEqual(bounds[0],[-3,-2]);bounds[1].forEach((n,i)=>close(n,[3,6][i]));bounds[2].forEach((n,i)=>close(n,[2,4][i]));
});
test('source west/east quads keep their actual UV orientation and outward normals',()=>{
  const d=G.data({pivot:[0,0,0],cubes:[{origin:[2,3,4],size:[1,2,3],uv}]},texture);
  assert.deepEqual(d.positions.slice(0,9),[-3,5,7,-3,5,4,-3,3,4]);
  assert.deepEqual(d.normals.slice(0,9),[-1,0,0,-1,0,0,-1,0,0]);
  assert.deepEqual(d.uv.slice(0,6),[14/64,1-4/32,8/64,1-4/32,8/64,1-14/32]);
  assert.equal(d.positions.length,36*3);assert.equal(d.uv.length,36*2);
});
test('all original finisher faces survive, including fractional sizes and signed UV extents',()=>{
  for(const [name,count] of [['dragon_low',214],['serpent_cream',259],['serpent_red',256]]){
    const g=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/champions-phantom/2026-0.1.0/geo/finisher/'+name+'.geo.json')))['minecraft:geometry'][0];
    let vertices=0;
    for(const bone of g.bones){const d=G.data(bone,g.description);vertices+=d.positions.length/3;
      for(const n of [...d.positions,...d.normals,...d.uv])assert.ok(Number.isFinite(n));
    }
    assert.equal(vertices,count*36);
  }
});
test('empty or absent faces never sample an unrelated texture tile',()=>{
  const d=G.data({pivot:[0,0,0],cubes:[{origin:[0,0,0],size:[1,1,1],uv:{west:uv.west}}]},texture);
  assert.equal(d.positions.length,6*3);assert.equal(d.uv.length,6*2);
});
