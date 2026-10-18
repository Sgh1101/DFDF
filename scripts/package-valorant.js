// Preserve supplied data assets; no Lua, Java, shader or executable code is run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parse}=require('../js/valorant-data');
const roots=process.argv.slice(2);if(roots.length!==2)throw Error('Pass gun pack and knife pack directories');
const out=path.join(__dirname,'../assets/valorant-packs/v1'),files=[],items=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function copy(root,rel,prefix){const b=fs.readFileSync(path.join(root,rel)),name=prefix+'/'+rel.replaceAll('\\','/'),dest=path.join(out,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);files.push({name,size:b.length,sha256:hash(b)});}
function walk(root,rel,prefix){for(const e of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){const r=path.join(rel,e.name);if(e.isDirectory())walk(root,r,prefix);else if(/\.(json|png|ogg)$/.test(e.name))copy(root,r,prefix);}}
const guns={pistol:'classic',silenced:'ghost',revolver:'sheriff',rifle:'vandal',carbine:'phantom',autoshot:'judge',hmg:'odin',marksman:'outlaw',sniper:'operator'};
for(const [n,root] of roots.entries()){
 const prefix=n?'knife':'gun',ns=n?'wtyj':'valorant';walk(root,'assets',prefix);walk(root,'data',prefix);
 const dir=path.join(root,'assets',ns,'display',n?'melee':'guns');
 const entries=n?fs.readdirSync(dir).map(f=>[f.slice(0,-5),f]):Object.entries(guns).map(([key,id])=>[key,id+'_display.json']);
 for(const [key,file] of entries){
  const d=parse(fs.readFileSync(path.join(dir,file),'utf8')),resolve=(ref,type,ext)=>prefix+'/assets/'+ref.split(':')[0]+'/'+type+'/'+ref.split(':')[1]+ext;
  const id=n?key:guns[key],model=resolve(d.model,'geo_models','.json'),texture=resolve(d.texture,'textures','.png'),animation=resolve(d.animation,'animations','.animation.json');
  for(const name of [model,texture,animation])if(!files.some(f=>f.name===name))throw Error('Missing '+name);
  const normal=d.uv?.[1]?resolve(d.uv[1],'textures','.png'):null;
  items.push({id,key:n?'knife':key,model,texture,animation,display:prefix+'/assets/'+ns+'/display/'+(n?'melee':'guns')+'/'+file,sounds:d.sounds||{},normal:files.some(f=>f.name===normal)?normal:null,missingOptional:normal&&!files.some(f=>f.name===normal)?[normal]:[]});
 }
}
files.sort((a,b)=>a.name.localeCompare(b.name));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:1,sourceNames:roots.map(r=>path.basename(r)),items,files},null,2)+'\n');
console.log(JSON.stringify({items:items.map(i=>i.id),files:files.length,bytes:files.reduce((s,f)=>s+f.size,0)},null,2));
