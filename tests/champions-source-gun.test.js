const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.resolve(__dirname,'../scripts/champions-phantom/source-gun'),bundle=path.resolve(__dirname,'../assets/champions-phantom/dfdf-1');
const provenance=JSON.parse(fs.readFileSync(path.join(source,'provenance.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('the default gun preserves all original JAR geometry and texture bytes',()=>{
 for(const file of provenance.files){
  const original=fs.readFileSync(path.join(source,file.name)),packaged=fs.readFileSync(path.join(bundle,file.name));
  assert.equal(original.length,file.size,file.name+' source length');
  assert.equal(sha(original),file.sha256,file.name+' original fingerprint');
  assert.equal(sha(packaged),file.sha256,file.name+' must not be repainted, simplified or repacked');
 }
});

test('the original gun retains all 878 cubes, 33 attachment bones and authored UV and pivots',()=>{
 const geo=JSON.parse(fs.readFileSync(path.join(bundle,'geo/phantom_champions_2026.geo.json')))['minecraft:geometry'][0];
 assert.equal(geo.bones.length,33);assert.equal(geo.bones.reduce((n,b)=>n+(b.cubes?.length||0),0),878);
 assert.equal(geo.description.texture_width,512);assert.equal(geo.description.texture_height,512);
 const original=JSON.parse(fs.readFileSync(path.join(source,'geo/phantom_champions_2026.geo.json')))['minecraft:geometry'][0];
 assert.deepEqual(geo,original,'including pivots, rotations, per-face UV and empty attachment bones');
});
