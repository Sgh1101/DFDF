const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {islandLayout,buildIsland}=require('../scripts/build-original-maps');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('original island geometry is reproducible without an imported schematic',()=>{
 const l=islandLayout();assert.deepEqual([l.width,l.length],[96,112]);
 const a=buildIsland(),b=buildIsland();assert.equal(hash(a.bin),hash(b.bin));
 assert.equal(a.meta.provenance.generator,'scripts/build-original-maps.js');assert.equal(a.meta.sourceFile,undefined);
 assert.deepEqual(a.meta.layout.attackSpawn,[48,100]);assert.equal(a.meta.layout.sites.length,2);
 assert.ok(a.meta.colliders>20&&a.meta.quads>1000);assert.ok(a.bin.length<3000000,'original layout does not inherit the old multi-MB terrain');
});
