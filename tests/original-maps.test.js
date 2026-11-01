const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {islandLayout,desertLayout,buildIsland,buildDesert}=require('../scripts/build-original-maps');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('original island geometry is reproducible without an imported schematic',()=>{
 const l=islandLayout();assert.deepEqual([l.width,l.length],[96,112]);
 const a=buildIsland(),b=buildIsland();assert.equal(hash(a.bin),hash(b.bin));
 assert.equal(a.meta.provenance.generator,'scripts/build-original-maps.js');assert.equal(a.meta.sourceFile,undefined);
 assert.deepEqual(a.meta.layout.attackSpawn,[48,100]);assert.equal(a.meta.layout.sites.length,2);
 assert.ok(a.meta.colliders>20&&a.meta.quads>1000);assert.ok(a.bin.length<3000000,'original layout does not inherit the old multi-MB terrain');
});
test('desert layout and rendered collision boxes share original coordinates and finite bounds',()=>{
 const a=buildDesert(),b=buildDesert(),l=desertLayout();
 assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(a.src.provenance.generator,'scripts/build-original-maps.js');
 assert.ok(a.collision.boxes.length>40);assert.equal(a.src.nodes.length,a.collision.boxes.length);
 for(const [x,X,z,Z,y,Y] of a.collision.boxes){assert.ok([x,X,z,Z,y,Y].every(Number.isFinite));assert.ok(x<X&&z<Z&&y<Y);}
 for(const team of Object.values(l.spawns))for(const [x,z,y] of team)assert.ok(!a.collision.boxes.some(([x0,x1,z0,z1,y0,y1])=>x>x0-.8&&x<x1+.8&&z>z0-.8&&z<z1+.8&&y+2.3>y0&&y<y1));
 assert.ok(!JSON.stringify(a.src).includes('kour.io'));assert.equal(Object.keys(a.src.materials).length,6);
 assert.equal(a.src.lights[0].matrix.length,16,'renderer requires a directional light matrix');
 const g=a.src.geometries.cube;
 for(let i=0;i<g.indices.length;i+=3){const ids=g.indices.slice(i,i+3),p=ids.map(n=>g.positions.slice(n*3,n*3+3)),u=p[1].map((v,j)=>v-p[0][j]),v=p[2].map((v,j)=>v-p[0][j]),n=g.normals.slice(ids[0]*3,ids[0]*3+3),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(cross.reduce((s,x,j)=>s+x*n[j],0)>0,'front faces agree with normals');}
});
