const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readSchematic,blockShape}=require('../scripts/schematic');
const {convert}=require('../scripts/import-ascent');
function fixture({w=2,h=1,l=1,blocks=[1,1],data=[0,0],add}={}) {
 const parts=[Buffer.from([10,0,9]),Buffer.from('Schematic')];
 const named=(t,k,b)=>{const n=Buffer.from(k),head=Buffer.alloc(3);head[0]=t;head.writeUInt16BE(n.length,1);parts.push(head,n,b);};
 for(const [k,v] of [['Width',w],['Height',h],['Length',l]]){const b=Buffer.alloc(2);b.writeInt16BE(v);named(2,k,b);}
 const m=Buffer.from('Alpha');named(8,'Materials',Buffer.concat([Buffer.from([0,m.length]),m]));
 for(const [k,v] of [['Blocks',blocks],['Data',data],...(add?[['AddBlocks',add]]:[])]){const b=Buffer.alloc(4);b.writeInt32BE(v.length);named(7,k,Buffer.concat([b,Buffer.from(v)]));}
 parts.push(Buffer.from([0]));return zlib.gzipSync(Buffer.concat(parts));
}
test('Alpha dimensions, x/z/y order, metadata and high block IDs survive decoding',()=>{
 const s=readSchematic(fixture({w:2,h:2,l:2,blocks:[1,2,3,4,5,6,7,8],data:[0,1,2,3,4,5,6,7],add:[0x21,0,0,0]}));
 assert.deepEqual([s.width,s.height,s.length],[2,2,2]);assert.equal(s.ids[0],257);assert.equal(s.ids[1],514);assert.equal(s.ids[2+2*2],7);assert.equal(s.data[6],6);
});
test('reject truncated or inconsistent input instead of producing a damaged map',()=>{
 assert.throws(()=>readSchematic(fixture({blocks:[1]})),/arrays/);
 assert.throws(()=>readSchematic(fixture({w:-1})),/dimensions/);
 assert.throws(()=>readSchematic(zlib.gzipSync(Buffer.from([10,0,9,65]))),/Truncated/);
 assert.throws(()=>readSchematic(fixture().subarray(0,14)));
});
test('adjacent blocks share one solid volume and no invisible interior faces',()=>{
 const result=convert(readSchematic(fixture())),v=new DataView(result.bin.buffer,result.bin.byteOffset,result.bin.byteLength);
 assert.equal(result.meta.nonAir,2);assert.equal(result.meta.quads,6);assert.equal(result.meta.colliders,1);
 const p=16+6*24;assert.deepEqual(Array.from({length:6},(_,i)=>v.getUint16(p+i*2,true)),[0,0,0,32,16,16]);
});
test('source air padding is cropped without deleting elevated occupied cells',()=>{
 const s={width:4,height:4,length:4,ids:new Uint16Array(64),data:new Uint8Array(64)};
 s.ids[2+4*(1+4*2)]=1;
 const r=convert(s);assert.deepEqual(r.meta.sourceCropMin,[2,2,1]);assert.deepEqual(r.meta.dimensions,[1,1,1]);assert.equal(r.meta.quads,6);
});
test('stairs and slabs preserve half steps, upside-down metadata and empty headroom',()=>{
 const east=blockShape(109,0),west=blockShape(109,1),up=blockShape(109,4);
 assert.deepEqual(east.boxes,[[0,0,0,16,8,16],[8,8,0,16,16,16]]);
 assert.equal(west.boxes[1][3],8);assert.deepEqual(up.boxes[0],[0,8,0,16,16,16]);
 assert.deepEqual(blockShape(44,0).boxes,[[0,0,0,16,8,16]]);assert.deepEqual(blockShape(44,8).boxes,[[0,8,0,16,16,16]]);
 assert.ok(1.25*.5<=.68,'half-block stairs fit the real engine step height');
 assert.equal(blockShape(31,0).solid,false);assert.deepEqual(blockShape(0,0).boxes,[]);
});
test('shipped map binary matches its provenance manifest and bounded record layout',()=>{
 const dir=path.join(__dirname,'../assets/maps/ascent'),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),b=fs.readFileSync(path.join(dir,'geometry.bin'));
 assert.equal(m.sourceSha256,'b987d994b5aa01e0b614b5e7d92a4b8f41f7cf6ecab1daddd5ba3fc4cf1b9c28');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../sources/maps/ascent-final2021.schematic'))).digest('hex'),m.sourceSha256);
 assert.equal(m.nonAir,244407);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),m.geometrySha256);
 assert.equal(b.length,16+m.quads*24+m.colliders*12);
 for(let p=16+m.quads*24;p<b.length;p+=12)for(let a=0;a<3;a++){
  const lo=b.readUInt16LE(p+a*2),hi=b.readUInt16LE(p+(a+3)*2);assert.ok(lo<hi&&hi<=m.dimensions[a]*16);
 }
});
