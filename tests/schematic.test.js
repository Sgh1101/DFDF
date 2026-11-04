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
 assert.equal(m.provenance.generator,'scripts/build-original-maps.js');assert.equal(m.provenance.externalMapInput,false);assert.equal(m.sourceSha256,undefined);
 // The active map is an independently generated layout; no imported schematic is shipped.
 assert.ok(!fs.existsSync(path.join(__dirname,'../sources/maps/ascent-final2021.schematic')));
 assert.ok(m.nonAir>10000);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),m.geometrySha256);
 assert.equal(b.length,16+m.quads*24+m.colliders*12);
 for(let p=16+m.quads*24;p<b.length;p+=12)for(let a=0;a<3;a++){
  const lo=b.readUInt16LE(p+a*2),hi=b.readUInt16LE(p+(a+3)*2);assert.ok(lo<hi&&hi<=m.dimensions[a]*16);
 }
});
test('하늘섬 마을 uses its own flat-colour block textures and separate block-state materials',()=>{
 const dir=path.join(__dirname,'../assets/maps/ascent'),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),p=JSON.parse(fs.readFileSync(path.join(dir,m.textures))),b=fs.readFileSync(path.join(dir,'geometry.bin'));
 assert.equal(m.name,'하늘섬 마을');assert.equal(m.version,2);assert.equal(p.tiles.length,239);
 assert.equal(p.source,'scripts/paint-block-textures.py');assert.equal(p.originalFiles,undefined);
 assert.ok(!fs.existsSync(path.join(dir,'vanilla'))&&!fs.existsSync(path.join(dir,'vanilla-atlas.png')),'no texture file from another game is shipped');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,m.atlas))).digest('hex'),m.atlasSha256);
 assert.notEqual(p.palette['1:0'].tiles[0],p.palette['1:1'].tiles[0],'stone and granite keep distinct tiles');
 const used=new Set();for(let i=0;i<m.quads;i++){const tile=b.readUInt16LE(16+i*24+21);assert.ok(tile<p.tiles.length);used.add(tile);}assert.ok(used.size>=12,'the original layout has distinct stone, wood, grass, glass and roof materials');
});

// a minimal PNG reader (8-bit RGBA, any scanline filter) so the atlases can be inspected without a dependency
function readPng(file){
 const zlib=require('node:zlib'),b=fs.readFileSync(file);let p=8,w=0,h=0;const idat=[];
 while(p<b.length){const n=b.readUInt32BE(p),t=b.toString('latin1',p+4,p+8);if(t==='IHDR'){w=b.readUInt32BE(p+8);h=b.readUInt32BE(p+12);assert.equal(b[p+16],8);assert.equal(b[p+17],6,'RGBA');}if(t==='IDAT')idat.push(b.subarray(p+8,p+8+n));p+=12+n;}
 const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*4,px=Buffer.alloc(h*stride);
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)];for(let x=0;x<stride;x++){
  const v=raw[y*(stride+1)+1+x],a=x>=4?px[y*stride+x-4]:0,u=y?px[(y-1)*stride+x]:0,c=x>=4&&y?px[(y-1)*stride+x-4]:0;
  const pa=Math.abs(u-c),pb=Math.abs(a-c),pc=Math.abs(a+u-2*c),pr=pa<=pb&&pa<=pc?a:pb<=pc?u:c;
  px[y*stride+x]=(v+(f===0?0:f===1?a:f===2?u:f===3?(a+u)>>1:pr))&255;}}
 return{w,h,px};
}
test('every block tile is one flat colour and keeps its kind (solid, cut-out, glass)',()=>{
 const dir=path.join(__dirname,'../assets/maps/ascent'),p=JSON.parse(fs.readFileSync(path.join(dir,'blocks-palette.json'))),mp=JSON.parse(fs.readFileSync(path.join(dir,'mobile/palette.json')));
 const flat=(img,x,y,size)=>{const seen=new Set();let min=255,max=0,hole=false,solid=true;
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){const k=((y+j)*img.w+x+i)*4,a=img.px[k+3];min=Math.min(min,a);max=Math.max(max,a);if(a===0)hole=true;if(a<255)solid=false;if(a>0)seen.add(img.px[k]+','+img.px[k+1]+','+img.px[k+2]);}
  return{colours:seen.size,alphas:new Set(Array.from({length:size*size},(_,n)=>img.px[((y+((n/size)|0))*img.w+x+n%size)*4+3])),hole,solid};};
 const big=readPng(path.join(dir,'blocks-atlas.png')),small=readPng(path.join(dir,'mobile/atlas.png'));
 p.tiles.forEach((t,i)=>{
  const m=mp.tiles[i],a=flat(big,(i%p.columns)*p.cell+p.padding,Math.floor(i/p.columns)*p.cell+p.padding,16),b=flat(small,m.x+m.padding,m.y+m.padding,m.size);
  for(const f of [a,b]){assert.equal(f.colours,1,t.name+' is one flat colour');
   if(m.opaque)assert.ok(f.solid,t.name+' stays fully solid');
   else if(/_stained_glass$/.test(t.name))assert.deepEqual([...f.alphas],[118],t.name+' is one translucent tint');
   else assert.ok(f.hole&&f.alphas.size===2,t.name+' keeps a cut-out silhouette');}
  assert.equal(t.transparent,/_stained_glass$/.test(t.name),t.name);
 });
});
