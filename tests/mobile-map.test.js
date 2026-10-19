const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {simplifyPlane,optimize}=require('../scripts/mobile-map-geometry');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),root='assets/maps/ascent/';
test('mobile planar reduction preserves exposed area, holes and normals, including partial overlaps',()=>{
 let seed=13;const random=n=>{seed=(1664525*seed+1013904223)>>>0;return seed%n;};
 for(let run=0;run<50;run++){
  const input=Array.from({length:35},()=>{const x=random(16),y=random(16);return{x,y,X:x+1+random(6),Y:y+1+random(6),sign:random(2)?1:-1,mat:String(random(3))};});
  const result=simplifyPlane(input);
  for(let y=0;y<22;y++)for(let x=0;x<22;x++)for(const sign of [-1,1]){
   const hit=(r)=>x+.5>r.x&&x+.5<r.X&&y+.5>r.y&&y+.5<r.Y;
   const before=input.filter(hit),after=result.filter(hit);
   const expected=before.some(r=>r.sign===sign)&&!before.some(r=>r.sign===-sign);
   assert.equal(after.some(r=>r.sign===sign),expected,'same visible footprint at '+[run,x,y,sign]);
   for(const r of after.filter(r=>r.sign===sign))assert.ok(before.some(b=>b.mat===r.mat&&b.sign===sign),'retain the original material');
  }
 }
});
test('separate mobile pack keeps every collision byte, source reference and transparent/cutout face',()=>{
 const source=fs.readFileSync(root+'geometry.bin'),mobile=fs.readFileSync(root+'mobile/geometry.bin'),palette=JSON.parse(fs.readFileSync(root+'mobile/palette.json')),manifest=JSON.parse(fs.readFileSync(root+'mobile/manifest.json'));
 const n=source.readUInt32LE(4),m=mobile.readUInt32LE(4);
 assert.equal(sha(source),manifest.sourceGeometrySha256);assert.equal(sha(mobile),manifest.geometrySha256);
 assert.equal(source.readUInt32LE(8),44380);assert.equal(mobile.readUInt32LE(8),44380);
 assert.deepEqual(mobile.subarray(16+m*24),source.subarray(16+n*24),'all walls, slopes, steps and navigation supports are byte-identical');
 assert.ok(m<n*.6,'at least 40% fewer terrain quads');
 const cutouts=bin=>{const list=[];for(let i=0;i<bin.readUInt32LE(4);i++){const p=16+i*24;if(!palette.tiles[bin.readUInt16LE(p+21)].opaque)list.push(bin.subarray(p,p+24).toString('hex'));}return list.sort();};
 assert.deepEqual(cutouts(mobile),cutouts(source),'never cancel glass/foliage/grilles even when they share a plane');
 assert.deepEqual(optimize(source,palette),mobile,'rebuild is deterministic');
 const original=JSON.parse(fs.readFileSync(root+'vanilla-palette.json'));
 assert.equal(palette.tiles.length,239);assert.ok(palette.width*palette.height<original.width*original.height*.5);
 for(const t of palette.tiles)assert.equal(t.size,t.opaque?8:16,'all cutout/glass pixels retain full source resolution');
 assert.equal(sha(fs.readFileSync(root+'mobile/atlas.png')),manifest.atlasSha256);
});
