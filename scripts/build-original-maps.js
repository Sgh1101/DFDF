// Original DFDF layouts. No downloaded map, schematic, mesh or texture is an input.
// Island uses the existing ASC2 format; desert uses the existing JSON scene format.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {convert}=require('./import-ascent'),{optimize}=require('./mobile-map-geometry');
const LAYOUTS=require('../js/original-map-layouts');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const provenance={author:'DFDF',generator:'scripts/build-original-maps.js',revision:'original-1',externalMapInput:false};
function islandLayout(){
 const width=96,height=32,length=112,ids=new Uint16Array(width*height*length),data=new Uint8Array(ids.length);
 const put=(x,y,z,id,d=0)=>{if(x>=0&&x<width&&y>=0&&y<height&&z>=0&&z<length){const i=x+width*(z+length*y);ids[i]=id;data[i]=d;}};
 const fill=(x,X,y,Y,z,Z,id,d=0)=>{for(let a=x;a<X;a++)for(let b=y;b<Y;b++)for(let c=z;c<Z;c++)put(a,b,c,id,d);};
 // A stepped floating base, a green lip, paved avenues and a raised central plaza.
 fill(8,88,0,2,8,104,1);fill(3,93,2,4,3,109,1);fill(0,96,4,6,0,112,1);
 fill(1,95,5,6,1,111,2);fill(42,54,5,6,1,111,98);fill(4,92,5,6,23,37,98);fill(4,92,5,6,76,87,98);
 fill(1,95,6,7,53,59,98);fill(1,95,6,7,51,53,44);fill(1,95,6,7,59,61,44);
 // A perimeter parapet: no uncovered fall-off route from the play area.
 fill(0,1,6,9,0,112,98);fill(95,96,6,9,0,112,98);fill(1,95,6,9,0,1,98);fill(1,95,6,9,111,112,98);
 const house=(x,z,w,d,tone)=>{
  // Rooms have two opposing entrances and windows; low interior galleries have real headroom.
  fill(x,x+w,6,12,z,z+1,45);fill(x,x+w,6,12,z+d-1,z+d,45);fill(x,x+1,6,12,z,z+d,45);fill(x+w-1,x+w,6,12,z,z+d,45);
  const mid=x+Math.floor(w/2);fill(mid-1,mid+2,6,9,z,z+1,0);fill(mid-1,mid+2,6,9,z+d-1,z+d,0);
  fill(x,x+1,8,10,z+3,z+6,95);fill(x+w-1,x+w,8,10,z+3,z+6,95);
  fill(x,x+w,12,13,z,z+d,35,tone);
  for(let i=1;i<Math.ceil(w/2);i++)fill(x+i,x+w-i,12+i,13+i,z,z+d,35,tone);
  fill(x+2,x+w-2,8,9,z+2,z+4,5); // overhead shelf, clearance 2.5m
 };
 for(const [x,z,w,d,c] of [[7,12,11,12,14],[29,39,10,10,9],[78,12,11,12,14],[7,66,12,12,1],[77,66,12,12,1],[25,87,11,11,9],[60,87,11,11,9]])house(x,z,w,d,c);
 // Two sheltered sites, planters, low crates and a clock-like geometric landmark.
 for(const [x,z] of [[22,29],[74,29]]){
  fill(x-7,x+8,5,6,z-6,z+7,24);fill(x-7,x-6,6,9,z-6,z+7,24);fill(x+7,x+8,6,9,z-6,z+7,24);
  for(const [a,b] of [[x-4,z+2],[x+3,z-3]])fill(a,a+2,6,8,b,b+2,5);
 }
 for(const [x,z] of [[18,46],[74,46],[18,78],[74,78],[35,70],[59,70]]){fill(x,x+3,6,8,z,z+3,5);fill(x,x+3,8,9,z,z+3,18);}
 for(const [x,z] of [[32,54],[62,54]]){fill(x,x+2,7,16,z,z+2,98);fill(x-1,x+3,16,17,z-1,z+3,35,9);}
 // A low stone bridge above the central lane with traversable half-block stairs.
 fill(31,65,10,11,55,58,98);
 for(let i=0;i<6;i++)for(let x=34;x<39;x++)for(let z=61+i;z<62+i;z++){const top=10-i/2;fill(x,x+1,7,Math.floor(top),z,z+1,98);if(top%1)put(x,Math.floor(top),z,44);}
 return {width,height,length,ids,data,layout:structuredClone(LAYOUTS.island)};
}
function buildIsland(){
 const s=islandLayout(),palette=JSON.parse(fs.readFileSync(path.join(root,'assets/maps/ascent/blocks-palette.json'))),out=convert(s,{palette});
 out.meta={...out.meta,provenance:{...provenance},layout:s.layout,geometrySha256:sha(out.bin)};return out;
}
function desertLayout(){return structuredClone(LAYOUTS.desert);}
function cube(){
 const positions=[],normals=[],uvs=[],indices=[];
 const faces=[[[1,0,0],[.5,-.5,.5],[0,0,-1],[0,1,0]],[[-1,0,0],[-.5,-.5,-.5],[0,0,1],[0,1,0]],[[0,1,0],[-.5,.5,.5],[1,0,0],[0,0,-1]],[[0,-1,0],[-.5,-.5,-.5],[1,0,0],[0,0,1]],[[0,0,1],[-.5,-.5,.5],[1,0,0],[0,1,0]],[[0,0,-1],[.5,-.5,-.5],[-1,0,0],[0,1,0]]];
 for(const [n,p,u,v] of faces){const b=positions.length/3;for(const [a,c] of [[0,0],[1,0],[1,1],[0,1]]){positions.push(...p.map((x,j)=>x+a*u[j]+c*v[j]));normals.push(...n);uvs.push(a,c);}indices.push(b,b+1,b+2,b,b+2,b+3);}
 return {positions,normals,uvs,indices};
}
function buildDesert(){
 const nodes=[],boxes=[],materials={sand:{color:[.69,.48,.25,1]},stone:{color:[.83,.69,.48,1]},plaster:{color:[.9,.79,.61,1]},roof:{color:[.2,.48,.52,1]},wood:{color:[.4,.25,.12,1]},cloth:{color:[.76,.21,.15,1]}};
 // Reuse the project's documented CC0 surface art, never another game's map textures.
 for(const [id,file] of Object.entries({sand:'sand',stone:'stoneblock',plaster:'plaster',roof:'siding',wood:'planks'}))Object.assign(materials[id],{texture:'../../mat/'+file+'_c.webp',triplanar:true,projectionScale:.25});
 const box=(x,X,z,Z,y,Y,mat='stone',kind='w')=>{
  boxes.push([x,X,z,Z,y,Y,kind]);nodes.push({name:'dfdf-'+nodes.length,geometry:'cube',materials:[mat],worldMatrix:[X-x,0,0,0,0,Y-y,0,0,0,0,Z-z,0,(x+X)/2,(y+Y)/2,(z+Z)/2,1]});
 };
 box(-54,54,-68,68,-2,0,'sand','g');
 box(-54,-52,-68,68,0,7);box(52,54,-68,68,0,7);box(-52,52,-68,-66,0,7);box(-52,52,66,68,0,7);
 function house(x,z){
  const X=x+15,Z=z+20;box(x,x+1,z,Z,0,6,'plaster');box(X-1,X,z,Z,0,6,'plaster');
  for(const zz of [z,Z-1]){box(x+1,x+5,zz,zz+1,0,6,'stone');box(x+10,X-1,zz,zz+1,0,6,'stone');box(x+5,x+10,zz,zz+1,3.2,6,'stone');}
  box(x-1,X+1,z-1,Z+1,6,6.4,'roof','s');box(x+3,x+6,z+5,z+8,0,1.3,'wood');
 }
 for(const [x,z] of [[-46,-56],[31,-56],[-46,31],[31,31],[-23,10],[8,10]])house(x,z);
 // Offset masonry spines break long cross-map sight lines while keeping three approaches.
 for(const x of [-18,16]){box(x,x+2,-40,-16,0,3.5,'stone');box(x,x+2,34,46,0,3.5,'stone');}
 // Two galleries and a central bridge with eight half-metre steps on each side.
 box(-40,-24,-12,0,2.5,3,'roof','s');box(24,40,-12,0,2.5,3,'roof','s');box(-24,24,-9,-5,2.5,3,'roof','s');
 for(const x of [-40,36])for(let i=0;i<6;i++)box(x,x+4,i*1.5,i*1.5+1.5,0,3-i*.5,'stone','s');
 for(const [x,z] of [[-32,-30],[32,-30],[-32,24],[32,24],[-15,-38],[15,-38],[-16,44],[16,44],[-5,16],[5,29]])box(x-1.8,x+1.8,z-1.8,z+1.8,0,1.7,'wood','s');
 for(const [x,z] of [[-20,-28],[20,-28],[-8,-18],[8,-18]]){box(x-1,x+1,z-1,z+1,0,5);box(x-1.7,x+1.7,z-1.7,z+1.7,5,5.5,'cloth');}
 // Thin original masonry bands and low planters add visible depth without downloaded art.
 for(const side of [-1,1])for(let z=-56;z<=56;z+=14){const x=side*51;box(x-1,x+1,z,z+8,0,.7,'plaster','s');box(x-1.3,x+1.3,z,z+8,5.6,6,'roof');}
 const collision={provenance:{...provenance},source:{generator:provenance.generator},boxes};
 const src={provenance:{...provenance},geometries:{cube:cube()},materials,nodes,lights:[{color:[1,.91,.73],intensity:.7,matrix:[1,0,0,0,0,1,0,0,-.5,-1,.35,0,0,0,0,1]}],environment:{ambient:{sky:[.86,.9,1],ground:[.47,.36,.22],intensity:.65}}};
 collision.source.sha256=sha(JSON.stringify(src));return {src,collision,layout:desertLayout()};
}
function writePackages(){
 const dir=path.join(root,'assets/maps/ascent'),out=buildIsland();
 fs.writeFileSync(path.join(dir,'geometry.bin'),out.bin);fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(out.meta,null,2)+'\n');
 const mobileDir=path.join(dir,'mobile'),pal=JSON.parse(fs.readFileSync(path.join(mobileDir,'palette.json'))),mobile=optimize(out.bin,pal);
 const meta={...out.meta,profile:'mobile',sourceQuads:out.meta.quads,quads:mobile.readUInt32LE(4),textures:'palette.json',atlas:'atlas.png',atlasSha256:pal.atlasSha256,sourceGeometrySha256:sha(out.bin),geometrySha256:sha(mobile)};
 fs.writeFileSync(path.join(mobileDir,'geometry.bin'),mobile);fs.writeFileSync(path.join(mobileDir,'manifest.json'),JSON.stringify(meta,null,2)+'\n');
 const d=buildDesert(),dest=path.join(root,'assets/maps/desert');fs.mkdirSync(dest,{recursive:true});
 fs.writeFileSync(path.join(dest,'scene.json.gz'),zlib.gzipSync(JSON.stringify(d.src)));fs.writeFileSync(path.join(dest,'collision.json'),JSON.stringify(d.collision)+'\n');
 const files=['scene.json.gz','collision.json'].map(file=>{const b=fs.readFileSync(path.join(dest,file));return {file,bytes:b.length,sha256:sha(b)};});
 fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({version:1,name:'사막 마을',provenance:{...provenance},layout:d.layout,files},null,2)+'\n');
 console.log(JSON.stringify({island:{quads:out.meta.quads,colliders:out.meta.colliders,bytes:out.bin.length,mobileBytes:mobile.length},desert:{boxes:d.collision.boxes.length,files}}));
}
if(require.main===module)writePackages();
module.exports={islandLayout,desertLayout,buildIsland,buildDesert,writePackages};
