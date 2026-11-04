'use strict';
const fs=require('node:fs'),path=require('node:path');
const {readSchematic}=require('./schematic'),{convert}=require('./import-ascent'),{optimize}=require('./mobile-map-geometry');
const {CONTRACT,layout,sha,verify,readCanonical}=require('./ascent-contract');
function build(input,dir=path.resolve(__dirname,'../assets/maps/ascent')){
 let out;
 if(input){const source=fs.readFileSync(input);if(sha(source)!==CONTRACT.sourceSha256)throw Error('Expected the provided ascent-final2021.schematic');out=convert(readSchematic(source),{palette:JSON.parse(fs.readFileSync(dir+'/blocks-palette.json'))});out.meta.sourceSha256=sha(source);}
 else out=readCanonical(dir); // No source: validate the checked-in terrain; never generate a different layout.
 verify(out.bin,out.meta);
 const meta={...out.meta,name:CONTRACT.name,nameEn:CONTRACT.nameEn,revision:CONTRACT.revision,horizontalScale:1.75,sourceFile:'ascent-final2021.schematic',geometrySha256:sha(out.bin),collisionSha256:CONTRACT.collisionSha256,layout,provenance:{generator:'scripts/build-ascent-district.js',externalMapInput:true,visuals:'DFDF authored block palette and lighting',revision:CONTRACT.revision}};
 const pal=JSON.parse(fs.readFileSync(dir+'/mobile/palette.json')),mobile=optimize(out.bin,pal),mm={...meta,profile:'mobile',sourceQuads:meta.quads,quads:mobile.readUInt32LE(4),textures:'palette.json',atlas:'atlas.png',atlasSha256:pal.atlasSha256,sourceGeometrySha256:sha(out.bin),geometrySha256:sha(mobile)};
 fs.writeFileSync(dir+'/geometry.bin',out.bin);fs.writeFileSync(dir+'/manifest.json',JSON.stringify(meta,null,2)+'\n');fs.writeFileSync(dir+'/mobile/geometry.bin',mobile);fs.writeFileSync(dir+'/mobile/manifest.json',JSON.stringify(mm,null,2)+'\n');
 return{meta,bytes:out.bin.length,mobileBytes:mobile.length};
}
if(require.main===module)console.log(JSON.stringify(build(process.argv[2])));
module.exports={build};
