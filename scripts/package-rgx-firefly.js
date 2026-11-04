// Import only the RGX butterfly data and sounds explicitly retained by the user.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=process.argv[2];if(!source)throw Error('Pass the provided Knife Pack directory');
const out=path.resolve(__dirname,'../assets/rgx-firefly/v1'),files=[];
function copy(from,name){
  const bytes=fs.readFileSync(path.join(source,'assets/wtyj',from)),dest=path.join(out,name);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
  files.push({name,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
copy('geo_models/melee/future_butterfly_geo.json','model.json');
copy('animations/melee/future_butterfly.animation.json','animation.json');
copy('textures/melee/future_butterfly_uv.png','texture.png');
const soundDir=path.join(source,'assets/wtyj/tacz_sounds/melee/future_butterfly');
for(const name of fs.readdirSync(soundDir).sort())if(/^future_butterfly_[a-z_0-9]+\.ogg$/.test(name))copy('tacz_sounds/melee/future_butterfly/'+name,'sounds/'+name);
files.sort((a,b)=>a.name.localeCompare(b.name));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:1,sourceItem:'future_butterfly',sourceLabel:'RGX 11z Firefly',sourcePack:'Provided Valorant Knife Pack-0.1.0',files},null,2)+'\n');
console.log('RGX Firefly:',files.length,'selected data/image/sound files,',files.reduce((n,f)=>n+f.size,0),'bytes');
