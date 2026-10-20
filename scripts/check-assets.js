const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');let checked=0;
for(const file of ['assets/champions-phantom/2026-0.1.0/manifest.json','assets/neon/1.0.0/manifest.json','assets/valorant-packs/v1/manifest.json']){
 const base=path.join(root,path.dirname(file)),m=JSON.parse(fs.readFileSync(path.join(root,file)));
 for(const row of m.files){const name=row.file||row.name,p=path.resolve(base,name);
  if(!p.startsWith(base+path.sep))throw Error('Asset path escapes its package: '+name);
  const data=fs.readFileSync(p),hash=crypto.createHash('sha256').update(data).digest('hex');
  if(hash!==row.sha256||data.length!==(row.bytes??row.size))throw Error('Source asset changed: '+name);checked++;
 }
}
console.log('Original source assets:',checked,'hashes and byte lengths verified');
