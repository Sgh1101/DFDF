const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readSchematic, blockShape, blockColor } = require('./schematic');

// Coordinates are encoded in sixteenths of a source block. No world-edit
// offsets or tile-entity payloads are carried into the running game.
function convert(s, options = {}) {
  const {width:W,height:H,length:L,ids,data} = s;
  const index = (x,y,z) => x+W*(z+L*y);
  const at = (x,y,z) => x<0||y<0||z<0||x>=W||y>=H||z>=L ? 0 : ids[index(x,y,z)];
  const min=[W,H,L], max=[0,0,0], histogram={}, variants={};
  let nonAir=0;
  for (let y=0;y<H;y++) for (let z=0;z<L;z++) for (let x=0;x<W;x++) {
    const id=ids[index(x,y,z)]; if (!id) continue;
    nonAir++; histogram[id]=(histogram[id]||0)+1;
    for (const [a,v] of [x,y,z].entries()) { min[a]=Math.min(min[a],v); max[a]=Math.max(max[a],v); }
  }
  if (!nonAir) throw Error('Empty schematic');
  const dims=max.map((v,a)=>v-min[a]+1), [w,h,l]=dims;
  const ci=(x,y,z)=>x+w*(z+l*y), cube=new Uint32Array(w*h*l);
  const full=new Uint8Array(cube.length), quads=[], boxes=[];
  const palette=options.palette;
  const face=(id,data,n)=>{const p=palette?.palette[id+':'+(data&15)];if(palette&&!p)throw Error('Missing texture state '+id+':'+data);return p?{color:p.tints[n],tile:p.tiles[n]}:{color:blockColor(id,data),tile:0};};
  function quad(p,u,v,mat) { const color=typeof mat==='number'?mat:mat.color;quads.push([...p,...u,...v,(color>>16)&255,(color>>8)&255,color&255,mat.tile||0]); }
  function boxFaces(b,materials) {
    const [x,y,z,X,Y,Z]=b, dx=X-x,dy=Y-y,dz=Z-z;
    quad([x,y,z],[0,dy,0],[dx,0,0],materials[0]);
    quad([x,y,Z],[dx,0,0],[0,dy,0],materials[1]);
    quad([x,y,z],[0,0,dz],[0,dy,0],materials[2]);
    quad([X,y,z],[0,dy,0],[0,0,dz],materials[3]);
    quad([x,y,z],[dx,0,0],[0,0,dz],materials[4]);
    quad([x,Y,z],[0,0,dz],[dx,0,0],materials[5]);
  }
  for (let y=0;y<h;y++) for (let z=0;z<l;z++) for (let x=0;x<w;x++) {
    const sx=x+min[0],sy=y+min[1],sz=z+min[2], i=index(sx,sy,sz), id=ids[i];
    if (!id) continue;
    const shape=blockShape(id,data[i],(dx,dz)=>at(sx+dx,sy,sz+dz),sy?data[index(sx,sy-1,sz)]:0), color=blockColor(id,data[i]), materials=Array.from({length:6},(_,n)=>face(id,data[i],n));
    variants[shape.kind]=(variants[shape.kind]||0)+1;
    if (shape.kind==='cube') { cube[ci(x,y,z)]=palette?(id===166?0:(id*16+(data[i]&15)+1)):color|0x1000000; full[ci(x,y,z)]=1; continue; }
    if(palette&&[6,31,37,39,40,59,175].includes(id)){
      quad([x*16,y*16,z*16],[16,0,16],[0,16,0],materials[0]);
      quad([x*16+16,y*16,z*16],[-16,0,16],[0,16,0],materials[0]);continue;
    }
    for (const b of shape.boxes) {
      const b2=b.map((v,a)=>v+[x,y,z][a%3]*16);
      boxFaces(b2,materials);
      if (shape.solid) boxes.push(b2);
    }
  }
  // Greedy coplanar faces, split every 16 blocks for useful frustum culling.
  const strides=[1,w*l,w], get=p=>cube[p[0]+p[1]*strides[1]+p[2]*strides[2]];
  for (let d=0;d<3;d++) {
    const u=(d+1)%3,v=(d+2)%3, mask=new Int32Array(dims[u]*dims[v]);
    for (let plane=0;plane<=dims[d];plane++) {
      let n=0;
      for (let j=0;j<dims[v];j++) for (let i=0;i<dims[u];i++) {
        const p=[0,0,0];p[d]=plane;p[u]=i;p[v]=j;
        const b=plane<dims[d]?get(p):0;p[d]--;
        const a=plane>0?get(p):0;
        mask[n++]=a&&!b?a:b&&!a?-b:0;
      }
      for (let j=0;j<dims[v];j++) for (let i=0;i<dims[u];) {
        const n=j*dims[u]+i,c=mask[n]; if (!c) { i++;continue; }
        let du=1,dv=1;
        while (i+du<dims[u] && ((i+du)%16)!==0 && mask[n+du]===c) du++;
        outer: while (j+dv<dims[v] && ((j+dv)%16)!==0) {
          for (let k=0;k<du;k++) if (mask[n+dv*dims[u]+k]!==c) break outer;
          dv++;
        }
        const p=[0,0,0],U=[0,0,0],V=[0,0,0];p[d]=plane*16;p[u]=i*16;p[v]=j*16;U[u]=du*16;V[v]=dv*16;
        const key=Math.abs(c)-1,side=d===0?(c>0?3:2):d===1?(c>0?5:4):(c>0?1:0);
        quad(p,c>0?U:V,c>0?V:U,palette?face(Math.floor(key/16),key&15,side):Math.abs(c));
        for (let b=0;b<dv;b++) mask.fill(0,n+b*dims[u],n+b*dims[u]+du);
        i+=du;
      }
    }
  }
  // Disjoint greedy collision volumes. They share the same partial-block
  // shapes as the render mesh, but ignore color changes between solid cubes.
  for (let y=0;y<h;y++) for (let z=0;z<l;z++) for (let x=0;x<w;x++) {
    const i=ci(x,y,z); if (!full[i]) continue;
    let dx=1,dz=1,dy=1;
    while (x+dx<w && full[i+dx]) dx++;
    zloop: while (z+dz<l) { for(let a=0;a<dx;a++) if(!full[ci(x+a,y,z+dz)]) break zloop;dz++; }
    yloop: while (y+dy<h) { for(let b=0;b<dz;b++) for(let a=0;a<dx;a++) if(!full[ci(x+a,y+dy,z+b)]) break yloop;dy++; }
    boxes.push([x*16,y*16,z*16,(x+dx)*16,(y+dy)*16,(z+dz)*16]);
    for (let b=0;b<dy;b++) for(let c=0;c<dz;c++) full.fill(0,ci(x,y+b,z+c),ci(x,y+b,z+c)+dx);
  }
  const bin=Buffer.alloc(16+quads.length*24+boxes.length*12);
  bin.write(palette?'ASC2':'ASC1');bin.writeUInt32LE(quads.length,4);bin.writeUInt32LE(boxes.length,8);bin.writeUInt32LE(palette?2:1,12);
  let offset=16;
  for (const q of quads) {
    for(let a=0;a<9;a++) { if(a<3)bin.writeUInt16LE(q[a],offset+a*2);else bin.writeInt16LE(q[a],offset+a*2); }
    for(let a=9;a<12;a++) bin[offset+18+a-9]=q[a];
    if(palette)bin.writeUInt16LE(q[12],offset+21);
    offset+=24;
  }
  for (const b of boxes) { for(let a=0;a<6;a++) bin.writeUInt16LE(b[a],offset+a*2);offset+=12; }
  return {bin,meta:{version:palette?2:1,name:'마크X발로',sourceDimensions:[W,H,L],sourceCropMin:min,dimensions:dims,scale:1.25,nonAir,quads:quads.length,colliders:boxes.length,histogram,variants,...(palette?{textures:'vanilla-palette.json',atlas:palette.atlas,atlasSha256:palette.atlasSha256}: {})}};
}
if (require.main===module) {
  const [input,out=path.join(__dirname,'../assets/maps/ascent')]=process.argv.slice(2);
  if (!input) throw Error('Usage: node scripts/import-ascent.js <source.schematic> [output-directory]');
  const source=fs.readFileSync(input),palettePath=path.join(out,'vanilla-palette.json');
  const result=convert(readSchematic(source),{palette:fs.existsSync(palettePath)?JSON.parse(fs.readFileSync(palettePath)):null});
  result.meta.sourceFile=path.basename(input);result.meta.sourceSha256=crypto.createHash('sha256').update(source).digest('hex');
  result.meta.geometrySha256=crypto.createHash('sha256').update(result.bin).digest('hex');
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'geometry.bin'),result.bin);
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(result.meta,null,2)+'\n');
  console.log(JSON.stringify({ ...result.meta, histogram:undefined, bytes:result.bin.length },null,2));
}
module.exports={convert};
