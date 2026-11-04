'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const CONTRACT=Object.freeze({revision:'district-ascent-1',name:'황혼 지구',nameEn:'Dusk District',sourceSha256:'b987d994b5aa01e0b614b5e7d92a4b8f41f7cf6ecab1daddd5ba3fc4cf1b9c28',geometrySha256:'5a1bce1adbc90ea3af5a76b16024ad65b2b431499792b375cb7313c883c41cd8',collisionSha256:'14e8962fe308a33c86a46e4e19bc2cf0b4c2bf0d2555e020b3d1c483065fadf7',dimensions:[206,115,223],crop:[55,12,16],scale:1.25});
// Source block coordinates, checked against the supplied 2021 build and Riot's overhead reference.
const layout={attackSpawn:[175,55,7.5],defendSpawn:[155,185,11.25],sites:[['A',95,145,13.75],['B',225,148,5]],nodes:{atk:[175,55,7.5],def:[155,185,11.25],mid:[160,120,10],A:[95,145,13.75],B:[225,148,5]}};
function verify(bin,meta){
 if(sha(bin)!==CONTRACT.geometrySha256||meta.sourceSha256!==CONTRACT.sourceSha256||sha(bin.subarray(16+bin.readUInt32LE(4)*24))!==CONTRACT.collisionSha256)throw Error('Canonical Ascent terrain mismatch; provide the original schematic, never substitute a generated town');
 if(JSON.stringify(meta.dimensions)!==JSON.stringify(CONTRACT.dimensions)||JSON.stringify(meta.sourceCropMin)!==JSON.stringify(CONTRACT.crop)||meta.scale!==CONTRACT.scale)throw Error('Canonical Ascent dimensions mismatch');
 return true;
}
function readCanonical(dir){const bin=fs.readFileSync(dir+'/geometry.bin'),meta=JSON.parse(fs.readFileSync(dir+'/manifest.json'));verify(bin,meta);return{bin,meta};}
module.exports={CONTRACT,layout,sha,verify,readCanonical};
