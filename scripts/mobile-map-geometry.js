const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

function union(intervals){
 const out=[];
 for(const [a,b] of intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){
  const last=out.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else out.push([a,b]);
 }
 return out;
}
function subtract(a,b,cover){
 const out=[];let x=a;
 for(const [lo,hi] of cover){if(hi<=x)continue;if(lo>=b)break;if(lo>x)out.push([x,Math.min(b,lo)]);x=Math.max(x,hi);if(x>=b)break;}
 if(x<b)out.push([x,b]);return out;
}
// Exact planar union/difference. Only fully opaque faces may cancel another
// opaque face facing the other way. Cutout foliage/grilles and glass bypass it.
function simplifyPlane(rects){
 const events=new Map(),active=new Set(),out=[],open=new Map();
 for(const r of rects)for(const [y,add] of [[r.y,true],[r.Y,false]]){
  if(!events.has(y))events.set(y,[]);events.get(y).push([r,add]);
 }
 const ys=[...events.keys()].sort((a,b)=>a-b);
 for(let i=0;i<ys.length-1;i++){
  const y=ys[i],Y=ys[i+1];for(const [r,add] of events.get(y))add?active.add(r):active.delete(r);
  const covers=[[],[]];for(const r of active)covers[r.sign>0?1:0].push([r.x,r.X]);
  covers[0]=union(covers[0]);covers[1]=union(covers[1]);
  const rows=new Map();
  for(const r of active){
   const key=r.sign+':'+r.mat;if(!rows.has(key))rows.set(key,{sign:r.sign,mat:r.mat,spans:[]});
   rows.get(key).spans.push(...subtract(r.x,r.X,covers[r.sign>0?0:1]));
  }
  const next=new Map();
  for(const row of rows.values())for(const [x,X] of union(row.spans)){
   const key=row.sign+':'+row.mat+':'+x+':'+X,previous=open.get(key);
   if(previous&&previous.Y===y){previous.Y=Y;next.set(key,previous);}
   else{const r={x,X,y,Y,sign:row.sign,mat:row.mat};out.push(r);next.set(key,r);}
  }
  open.clear();for(const [k,r] of next)open.set(k,r);
 }
 return out;
}
function optimize(source,palette){
 const n=source.readUInt32LE(4),colliders=source.readUInt32LE(8),planes=new Map(),kept=[];
 for(let i=0;i<n;i++){
  const offset=16+i*24,q=Array.from({length:9},(_,a)=>a<3?source.readUInt16LE(offset+a*2):source.readInt16LE(offset+a*2)),tile=source.readUInt16LE(offset+21);
  const u=q.slice(3,6),v=q.slice(6,9),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(!palette.tiles[tile].opaque||cross.filter(x=>x!==0).length!==1){kept.push(source.subarray(offset,offset+24));continue;}
  const d=cross.findIndex(x=>x!==0),a=(d+1)%3,b=(d+2)%3,sign=Math.sign(cross[d]);
  const lo=q.slice(0,3).map((p,j)=>Math.min(p,p+u[j],p+v[j],p+u[j]+v[j])),hi=q.slice(0,3).map((p,j)=>Math.max(p,p+u[j],p+v[j],p+u[j]+v[j]));
  const mat=[source[offset+18],source[offset+19],source[offset+20],tile].join(',');
  // Keep the original 40 m frustum chunks; never merge across the entire map.
  for(let y=lo[b];y<hi[b];){const Y=Math.min(hi[b],(Math.floor(y/512)+1)*512);
   for(let x=lo[a];x<hi[a];){const X=Math.min(hi[a],(Math.floor(x/512)+1)*512),key=d+':'+q[d]+':'+Math.floor(x/512)+':'+Math.floor(y/512);
    if(!planes.has(key))planes.set(key,{d,plane:q[d],rects:[]});planes.get(key).rects.push({x,X,y,Y,sign,mat});x=X;
   }y=Y;
  }
 }
 for(const {d,plane,rects} of planes.values())for(const r of simplifyPlane(rects)){
  const p=[0,0,0],u=[0,0,0],v=[0,0,0],a=(d+1)%3,b=(d+2)%3;p[d]=plane;p[a]=r.x;p[b]=r.y;u[a]=r.X-r.x;v[b]=r.Y-r.y;
  const q=[...p,...(r.sign>0?u:v),...(r.sign>0?v:u)],m=r.mat.split(',').map(Number),record=Buffer.alloc(24);
  for(let j=0;j<9;j++)j<3?record.writeUInt16LE(q[j],j*2):record.writeInt16LE(q[j],j*2);
  for(let j=0;j<3;j++)record[18+j]=m[j];record.writeUInt16LE(m[3],21);kept.push(record);
 }
 const header=Buffer.from(source.subarray(0,16));header.writeUInt32LE(kept.length,4);
 return Buffer.concat([header,...kept,source.subarray(16+n*24)]);
}
if(require.main===module){
 const dir=path.resolve(__dirname,'../assets/maps/ascent'),dest=path.join(dir,'mobile');
 const source=fs.readFileSync(path.join(dir,'geometry.bin')),palette=JSON.parse(fs.readFileSync(path.join(dest,'palette.json'))),meta=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 const bin=optimize(source,palette);fs.writeFileSync(path.join(dest,'geometry.bin'),bin);
 const manifest={...meta,profile:'mobile',sourceQuads:meta.quads,quads:bin.readUInt32LE(4),textures:'palette.json',atlas:'atlas.png',atlasSha256:palette.atlasSha256,sourceGeometrySha256:hash(source),geometrySha256:hash(bin)};
 fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({quads:manifest.quads,sourceQuads:meta.quads,reduction:1-manifest.quads/meta.quads,bytes:bin.length,sourceBytes:source.length,colliders:manifest.colliders}));
}
module.exports={optimize,simplifyPlane,union,subtract};
