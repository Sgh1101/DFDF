const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),THREE=require('three');
const filename='../js/solid-geometry';
const S=fs.existsSync(require('node:path').join(__dirname,filename+'.js'))?require(filename):null;
const uv=Object.fromEntries(['east','west','up','down','south','north'].map((n,i)=>[n,{uv:[i*16,0],uv_size:[16,16]}]));
function build(type,size=[10,4,4],extra={}){assert.ok(S,'own solid geometry must exist');return S.build(THREE,{size,uv,dfdf_mesh:{type,radius:.4,segments:16,...extra}},{texture_width:128,texture_height:32});}
test('bevels create real slanted surfaces within the unchanged attachment bounds',()=>{
  const g=build('bevel');try{g.computeBoundingBox();assert.deepEqual(g.boundingBox.min.toArray(),[-5,-2,-2]);assert.deepEqual(g.boundingBox.max.toArray(),[5,2,2]);
    const n=g.attributes.normal,p=g.attributes.position,u=g.attributes.uv;let bevels=0;
    for(let i=0;i<n.count;i++){assert.ok([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),u.getX(i),u.getY(i)].every(Number.isFinite));assert.ok(u.getX(i)>=0&&u.getX(i)<=1&&u.getY(i)>=0&&u.getY(i)<=1);if([n.getX(i),n.getY(i),n.getZ(i)].filter(v=>Math.abs(v)>.1).length>1)bevels++;}
    assert.ok(bevels>36);assert.equal(g.attributes.dfdfFace.count,p.count);
  }finally{g.dispose();}
});
test('a suppressor has a genuine open bore instead of a painted-on black circle',()=>{
  const g=build('tube',[8,4,4],{bore:.55});try{const p=g.attributes.position,n=g.attributes.normal;let rings=0;
    for(let i=0;i<p.count;i++)if(n.getX(i)>.99){rings++;assert.ok(Math.hypot(p.getY(i),p.getZ(i))>=1.09,'no front-face vertex closes the bore');}
    assert.ok(rings>=48);assert.ok([...n.array].every(Number.isFinite));
  }finally{g.dispose();}
});
test('thin bevels clamp safely and malformed solid types fail explicitly',()=>{
  const g=build('bevel',[.02,3,2],{radius:20});try{assert.ok([...g.attributes.position.array].every(Number.isFinite));}finally{g.dispose();}
  assert.throws(()=>build('surprise'),/solid|shape|type/i);
  assert.throws(()=>build('cylinder',[4,2,2],{segments:'bad'}),/segments/i);
});
test('all solid triangles have outward winding and normalized nonzero normals',()=>{
  for(const type of ['bevel','tube','cylinder']){const g=build(type),p=g.attributes.position,n=g.attributes.normal;try{
    for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2),normal=new THREE.Vector3().fromBufferAttribute(n,i);assert.ok(Math.abs(normal.length()-1)<1e-6);assert.ok(b.sub(a).cross(c.sub(a)).dot(normal)>0);}
  }finally{g.dispose();}}
});
test('the retained source RGX positions, normals and UVs are byte-identical to the pre-change renderer',()=>{
  const D=require('../js/rgx-firefly-data'),{bedrock}=require('../scripts/champions-phantom/model'),crypto=require('node:crypto');
  const geo=D.renderGeometry(D.parse(fs.readFileSync('assets/rgx-firefly/v1/model.json','utf8'))['minecraft:geometry'][0]),mat=new THREE.MeshBasicMaterial(),rig=bedrock().build(geo,mat),hash=crypto.createHash('sha256');
  try{rig.traverse(n=>{if(n.geometry){hash.update(n.name);for(const k of ['position','normal','uv']){const a=n.geometry.attributes[k].array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}}});assert.equal(hash.digest('hex'),'1487cdda6b04319c8cad66263e7d025917d21047f04ca722a46d3028d2dbf1f9');}
  finally{rig.traverse(n=>n.geometry?.dispose());mat.dispose();}
});
