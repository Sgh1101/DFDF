// Original DFDF layouts. No downloaded map, schematic, mesh or texture is an input.
// The island uses the existing ASC2 format; the removed desert map stays removed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {convert}=require('./import-ascent'),{optimize}=require('./mobile-map-geometry');
const LAYOUTS=require('../js/original-map-layouts');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const provenance={author:'DFDF',generator:'scripts/build-original-maps.js',revision:'neighborhood-2',externalMapInput:false};
function islandLayout(){
 const width=96,height=32,length=112,ids=new Uint16Array(width*height*length),data=new Uint8Array(ids.length);
 const put=(x,y,z,id,d=0)=>{if(x>=0&&x<width&&y>=0&&y<height&&z>=0&&z<length){const i=x+width*(z+length*y);ids[i]=id;data[i]=d;}};
 const fill=(x,X,y,Y,z,Z,id,d=0)=>{for(let a=x;a<X;a++)for(let b=y;b<Y;b++)for(let c=z;c<Z;c++)put(a,b,c,id,d);};
 // A stepped floating base, a green lip, paved avenues and a raised central plaza.
 fill(8,88,0,2,8,104,1);fill(3,93,2,4,3,109,1);fill(0,96,4,6,0,112,1);
 fill(1,95,5,6,1,111,2);fill(42,54,5,6,1,111,98);fill(4,92,5,6,23,37,98);fill(4,92,5,6,76,87,98);
 // A continuous street network with sidewalks, marked crossings and lane dashes.
 fill(40,56,5,6,2,110,44);fill(43,53,5,6,2,110,35,7);
 for(const z of [30,81]){fill(3,93,5,6,z-7,z+7,44);fill(3,93,5,6,z-4,z+4,35,7);}
 for(let z=5;z<108;z+=8)fill(47,49,5,6,z,z+3,35,4);
 for(const z of [22,36,73,87])for(let x=44;x<53;x+=2)fill(x,x+1,5,6,z,z+2,35,0);
 for(const z of [30,81])for(let x=8;x<90;x+=9)fill(x,x+3,5,6,z-1,z,35,0);
 fill(1,95,6,7,53,59,98);fill(1,95,6,7,51,53,44);fill(1,95,6,7,59,61,44);
 // A perimeter parapet: no uncovered fall-off route from the play area.
 fill(0,1,6,9,0,112,98);fill(95,96,6,9,0,112,98);fill(1,95,6,9,0,1,98);fill(1,95,6,9,111,112,98);
 const house=({x,z,w,d,tone,kind})=>{
  // Rooms have two opposing entrances and windows; low interior galleries have real headroom.
  fill(x,x+w,6,12,z,z+1,45);fill(x,x+w,6,12,z+d-1,z+d,45);fill(x,x+1,6,12,z,z+d,45);fill(x+w-1,x+w,6,12,z,z+d,45);
  const mid=x+Math.floor(w/2);fill(mid-1,mid+2,6,9,z,z+1,0);fill(mid-1,mid+2,6,9,z+d-1,z+d,0);
  fill(x,x+1,8,10,z+3,z+6,95);fill(x+w-1,x+w,8,10,z+3,z+6,95);
  // Contrasting trim/eaves and regular window bays make a readable facade.
  fill(x,x+w,12,13,z,z+d,5);
  for(let i=1;i<Math.ceil(w/2);i++)fill(x+i,x+w-i,12+i,13+i,z,z+d,35,tone);
  for(const a of [x,x+w-1])for(const b of [z,z+d-1])fill(a,a+1,6,12,b,b+1,24);
  for(const b of [z,z+d-1])for(const a of [x+2,x+w-3]){
   fill(a,a+2,8,10,b,b+1,95);fill(a,a+2,7,8,b,b+1,24);
  }
  // Rear and front paths reach the actual door, rather than a painted wall.
  fill(mid-1,mid+2,5,6,z-2,z,98);fill(mid-1,mid+2,5,6,z+d,z+d+2,98);
  if(kind!=='home'){
   for(let a=x+1;a<x+w-1;a++)fill(a,a+1,9,10,z-1,z,35,a%2?tone:0);
   fill(mid-2,mid+3,10,11,z-1,z,35,tone); // recessed storefront sign panel
   fill(x+2,x+4,6,7,z+3,z+5,5);fill(x+w-4,x+w-2,6,7,z+d-4,z+d-2,5);
  }else{
   fill(x+2,x+4,13,15,z+d-4,z+d-2,45); // chimney
   fill(x+2,x+4,6,7,z+3,z+5,5); // furnished room, outside doorway axis
  }
  fill(x+2,x+w-2,8,9,z+2,z+4,5); // overhead shelf, clearance 2.5m
 };
 for(const b of LAYOUTS.island.buildings)house(b);
 // Two sheltered sites, planters, low crates and a clock-like geometric landmark.
 for(const [x,z] of [[22,29],[74,29]]){
  fill(x-7,x+8,5,6,z-6,z+7,24);fill(x-7,x-6,6,9,z-6,z+7,24);fill(x+7,x+8,6,9,z-6,z+7,24);
  for(const [a,b] of [[x-4,z+2],[x+3,z-3]])fill(a,a+2,6,8,b,b+2,5);
 }
 for(const [x,z] of [[18,46],[74,46],[18,78],[74,78],[35,70],[59,70]]){fill(x,x+3,6,8,z,z+3,5);fill(x,x+3,8,9,z,z+3,18);}
 for(const [x,z] of [[32,54],[62,54]]){fill(x,x+2,7,16,z,z+2,98);fill(x-1,x+3,16,17,z-1,z+3,35,9);}
 // Street furniture stays on verges: lights, benches, trees and a bus shelter.
 for(const [x,z] of [[39,18],[56,42],[39,70],[56,94],[10,36],[86,87]]){
  fill(x,x+1,6,11,z,z+1,98);fill(x-1,x+2,11,12,z-1,z+2,35,4);
 }
 for(const [x,z] of [[24,18],[69,18],[24,71],[69,71]]){
  fill(x,x+4,6,7,z,z+1,44);fill(x,x+4,7,8,z+1,z+2,5);
 }
 for(const [x,z] of [[4,58],[90,58],[15,98],[80,98]]){
  fill(x,x+3,6,7,z,z+3,24);fill(x+1,x+2,7,11,z+1,z+2,17);
  fill(x-1,x+4,10,13,z-1,z+4,18);
 }
 fill(64,72,9,10,8,13,35,9);fill(64,65,6,9,8,13,95);fill(71,72,6,9,8,13,95);fill(65,71,6,7,9,10,5);
 // Small plaza mosaics give the objectives distinct identities without hiding floors.
 for(const [x,z] of [[22,29],[74,29]])for(let i=-3;i<=3;i++){
  put(x+i,5,z-4,35,x<48?14:9);put(x+i,5,z+4,35,x<48?14:9);
 }
 // A low stone bridge above the central lane with traversable half-block stairs.
 fill(31,65,10,11,55,58,98);
 for(let i=0;i<6;i++)for(let x=34;x<39;x++)for(let z=61+i;z<62+i;z++){const top=10-i/2;fill(x,x+1,7,Math.floor(top),z,z+1,98);if(top%1)put(x,Math.floor(top),z,44);}
 return {width,height,length,ids,data,layout:structuredClone(LAYOUTS.island)};
}
function buildIsland(){
 const s=islandLayout(),palette=JSON.parse(fs.readFileSync(path.join(root,'assets/maps/ascent/blocks-palette.json'))),out=convert(s,{palette});
 out.meta={...out.meta,provenance:{...provenance},layout:s.layout,geometrySha256:sha(out.bin)};return out;
}
function writePackages(){
 const dir=path.join(root,'assets/maps/ascent'),out=buildIsland();
 fs.writeFileSync(path.join(dir,'geometry.bin'),out.bin);fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(out.meta,null,2)+'\n');
 const mobileDir=path.join(dir,'mobile'),pal=JSON.parse(fs.readFileSync(path.join(mobileDir,'palette.json'))),mobile=optimize(out.bin,pal);
 const meta={...out.meta,profile:'mobile',sourceQuads:out.meta.quads,quads:mobile.readUInt32LE(4),textures:'palette.json',atlas:'atlas.png',atlasSha256:pal.atlasSha256,sourceGeometrySha256:sha(out.bin),geometrySha256:sha(mobile)};
 fs.writeFileSync(path.join(mobileDir,'geometry.bin'),mobile);fs.writeFileSync(path.join(mobileDir,'manifest.json'),JSON.stringify(meta,null,2)+'\n');
 console.log(JSON.stringify({island:{quads:out.meta.quads,colliders:out.meta.colliders,bytes:out.bin.length,mobileBytes:mobile.length}}));
}
if(require.main===module)writePackages();
module.exports={islandLayout,buildIsland,writePackages};
