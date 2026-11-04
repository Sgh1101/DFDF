const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {CONTRACT,layout,verify,readCanonical}=require('../scripts/ascent-contract');
test('district retains supplied terrain, collisions, stairs and larger dimensions',()=>{
 const {bin,meta}=readCanonical('assets/maps/ascent');assert.ok(verify(bin,meta));assert.deepEqual(meta.dimensions,CONTRACT.dimensions);assert.deepEqual(meta.sourceCropMin,CONTRACT.crop);assert.equal(meta.colliders,44380);assert.equal(meta.quads,302566);assert.deepEqual(meta.layout,layout);assert.equal(meta.name,'황혼 지구');assert.equal(meta.horizontalScale,1.75);assert.equal(meta.dimensions[0]*meta.horizontalScale,360.5);assert.equal(meta.dimensions[2]*meta.horizontalScale,390.25);assert.equal(meta.scale*.5,.625,'original half-block stair rise is preserved');
});
test('old regeneration cannot silently replace Ascent with an unrelated town',()=>{
 assert.match(fs.readFileSync('scripts/build-original-maps.js','utf8'),/build-ascent-district/);const {bin,meta}=readCanonical('assets/maps/ascent');const damaged=Buffer.from(bin);damaged[20]^=1;assert.throws(()=>verify(damaged,meta),/Canonical/);assert.throws(()=>verify(bin,{...meta,sourceSha256:'unrelated'}),/Canonical/);
});
