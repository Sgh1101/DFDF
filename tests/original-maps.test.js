const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {islandLayout,buildIsland}=require('../scripts/build-original-maps');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('the village has connected streets, two objective districts and furnished buildings with real entrances',()=>{
 const l=islandLayout(),at=(x,y,z)=>l.ids[x+l.width*(z+l.length*y)];
 assert.equal(l.layout.districts.length,4);assert.ok(l.layout.buildings.length>=9);
 assert.equal(at(48,5,70),35,'asphalt boulevard');assert.equal(at(41,5,70),44,'curb and sidewalk');
 for(const b of l.layout.buildings){const mid=b.x+Math.floor(b.w/2);for(const z of [b.z,b.z+b.d-1])for(let y=6;y<9;y++)assert.equal(at(mid,y,z),0,'open, tall doorway');assert.equal(at(b.x+1,12,b.z+1),5,'distinct upper floor/eaves');}
 // Coarse ground/raised-plaza connectivity; the browser check walks each path with the actual body.
 const free=(x,z)=>x>0&&z>0&&x<95&&z<111&&[7,8].every(y=>at(x,y,z)===0);
 for(const start of [l.layout.attackSpawn,l.layout.defendSpawn]){
  const seen=new Set([start.join(',')]),q=[start];for(let i=0;i<q.length;i++){const [x,z]=q[i];for(const [a,b] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]])if(free(a,b)&&!seen.has(a+','+b)){seen.add(a+','+b);q.push([a,b]);}}
  for(const [,x,z] of l.layout.sites)assert.ok(seen.has(x+','+z),'each team can reach each objective');
 }
});
test('original island geometry is reproducible without an imported schematic',()=>{
 const l=islandLayout();assert.deepEqual([l.width,l.length],[96,112]);
 const a=buildIsland(),b=buildIsland();assert.equal(hash(a.bin),hash(b.bin));
 assert.equal(a.meta.provenance.generator,'scripts/build-original-maps.js');assert.equal(a.meta.sourceFile,undefined);
 assert.deepEqual(a.meta.layout.attackSpawn,[48,100]);assert.equal(a.meta.layout.sites.length,2);
 assert.ok(a.meta.colliders>20&&a.meta.quads>1000);assert.ok(a.bin.length<3000000,'original layout does not inherit the old multi-MB terrain');
});
