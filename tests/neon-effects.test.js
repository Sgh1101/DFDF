const test=require('node:test'),assert=require('node:assert/strict'),fx=require('../js/neon-fx-source'),{config:c}=require('../js/neon-data');
const wall={startX:1.2,startY:0,startZ:0,endX:1.2,endY:0,endZ:-25,height:4};
const vertices=b=>b.flatMap(b=>b.vertices);
function valid(batches){assert.ok(batches.length);for(const b of batches){assert.equal(b.vertices.length%4,0);for(const v of b.vertices){assert.equal(v.length,9);assert.ok(v.every(Number.isFinite));assert.ok(v[6]>=0&&v[6]<=1.001);}}}
test('source C wall grows, moves, sweeps away, and retains opaque multi-color layers',()=>{
 const young=fx.lane(wall,.02),full=fx.lane(wall,1),later=fx.lane(wall,2),end=fx.lane(wall,3.99);
 for(const b of [young,full,later,end])valid(b);
 assert.ok(full.some(b=>b.opaque));assert.ok(full.some(b=>!b.opaque));assert.notDeepEqual(full,later);
 const top=b=>Math.max(...vertices(b).map(v=>v[1]));assert.ok(top(full)>3);assert.ok(top(young)<top(full));assert.ok(vertices(end).reduce((s,v)=>s+v[6],0)<vertices(full).reduce((s,v)=>s+v[6],0));
 assert.deepEqual(fx.lane(wall,1),full,'a future frame cannot mutate or randomize an earlier frame');
 assert.ok(new Set(vertices(full).map(v=>v.slice(3,6).join(','))).size>50);
 assert.equal(c.wallLength,25);assert.equal(c.wallHeight,4);assert.equal(c.wallGap,2.4);assert.equal(c.wallDuration,4);
});
test('source Q has nested head spheres, a broad 2.4m tail and separate charge/flash/recovery/cracks',()=>{
 const b={id:7,x:0,y:2,z:0,vx:0,vy:0,vz:-38};const bolt=fx.bolt(b,1,{x:0,y:2,z:10});valid(bolt);
 const vs=vertices(bolt);assert.ok(Math.max(...vs.map(v=>v[2]))>=2.39);assert.ok(Math.max(...vs.map(v=>Math.abs(v[0])))>.4);
 const frames=[.05,.3,.72,.86,1.5,3.9].map(age=>fx.shock({x:0,y:0,z:0},age));for(const frame of frames)valid(frame);
 assert.ok(vertices(frames[2]).length>vertices(frames[1]).length);assert.ok(vertices(frames[4]).length<vertices(frames[2]).length);
 assert.ok(vertices(fx.shock({x:0,y:0,z:0},4)).every(v=>v[6]===0));
 assert.equal(c.boltSpeed,38);assert.equal(c.boltGravity,4.8);assert.equal(c.concussRadius,5);assert.equal(c.concussDelay,.8);assert.equal(c.concussDuration,2.5);
});
test('C preview keeps source spark UVs and Q receives collider stripes through the world adapter',()=>{
 const orb={id:1,startX:0,startY:0,startZ:0,curX:0,curZ:-12,dirX:0,dirZ:-1};const b=fx.preview(orb,.2);valid(b);
 assert.ok(b.every(b=>b.additive));assert.ok(b.some(b=>b.texture!=null&&b.vertices.some(v=>v[7]===1&&v[8]===1)));
 let called=0;fx.shock({x:1,y:0,z:2},.3,(x,y,z,r,a,base)=>{called++;assert.equal(x,1);assert.equal(z,2);assert.equal(r,3.5);assert.equal(a,1);assert.equal(base,3.5);return [];});assert.equal(called,1);
});
test('Q point rays pass below raised ceilings and reflect from the actual face',()=>{
 const {rayBox}=require('../js/neon-data'),box={minX:1,maxX:2,minZ:1,maxZ:2,y0:3,h:4};
 assert.equal(rayBox({x:0,y:1.8,z:1.5},{x:3,y:1.8,z:1.5},box),null,'a player-sized headroom check must not collide with this ceiling');
 assert.deepEqual(rayBox({x:0,y:3.5,z:1.5},{x:3,y:3.5,z:1.5},box),{t:1/3,axis:'x',normal:-1});
 assert.deepEqual(rayBox({x:1.5,y:2,z:1.5},{x:1.5,y:4,z:1.5},box),{t:.5,axis:'y',normal:-1});
 assert.deepEqual(rayBox({x:1.5,y:5,z:1.5},{x:1.5,y:3,z:1.5},box),{t:.5,axis:'y',normal:1});
 assert.equal(rayBox({x:1.5,y:4.002,z:1.5},{x:1.5,y:4.1,z:1.5},box),null,'the reflected projectile leaves the surface without a false second impact');
});
