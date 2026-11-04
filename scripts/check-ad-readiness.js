// A release preflight, not an ad loader or a certificate/license verifier.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),policy=require('../js/advertising-policy');
const assetPaths={
 'dusk-layout':['assets/maps/ascent/manifest.json','assets/maps/ascent/geometry.bin','assets/maps/ascent/mobile/manifest.json','assets/maps/ascent/mobile/geometry.bin'],
 'sgh-butterfly-retained':['manifest.json','model.json','animation.json','texture.png',...['draw','inspect','melee_1','melee_2','melee_3','rotate_1','rotate_2','rotate_3'].map(n=>'sounds/future_butterfly_'+n+'.ogg')].map(n=>'assets/rgx-firefly/v1/'+n)
};
function audit(root=path.resolve(__dirname,'..')){
 const reasons=[],assetErrors=[],adIntegrations=[];let config={},review=null;
 try{config=JSON.parse(fs.readFileSync(path.join(root,'ads-config.json'),'utf8'));}catch{reasons.push('config-unreadable');}
 try{review=JSON.parse(fs.readFileSync(path.join(root,'monetization-review.json'),'utf8'));}catch{reasons.push('review-unreadable');}
 reasons.push(...policy.configurationReasons(config),...policy.reviewReasons(review,config));
 for(const a of Array.isArray(review?.assets)?review.assets:[]){
  if(!Array.isArray(a?.files))continue;
  const listed=a.files.map(f=>f?.path);
  if((assetPaths[a.id]||[]).some(name=>!listed.includes(name))||new Set(listed).size!==listed.length)assetErrors.push('asset-coverage:'+a.id);
  for(const f of a.files){
   const name=f?.path;if(typeof name!=='string'){assetErrors.push('asset-path:'+a.id);continue;}
   const file=path.resolve(root,name);
   if(!file.startsWith(path.resolve(root)+path.sep)||path.isAbsolute(name)||name.includes('\\')){assetErrors.push('asset-path:'+name);continue;}
   try{const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');if(hash!==f.sha256)assetErrors.push('asset-changed:'+name);}catch{assetErrors.push('asset-missing:'+name);}
  }
 }
 // Reject accidental SDK additions while disabled or before the review is clear.
 // This scans shipped entry pages and JS; it is not a general security scanner.
 const scan=dir=>{if(!fs.existsSync(dir))return;for(const d of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,d.name);if(d.isDirectory())scan(file);else if(/\.(html|js)$/.test(d.name)&&/(?:adsbygoogle\.js|googlesyndication\.com\/pagead|doubleclick\.net\/|\badBreak\s*\()/.test(fs.readFileSync(file,'utf8')))adIntegrations.push(path.relative(root,file).replace(/\\/g,'/'));}};
 for(const d of fs.readdirSync(root,{withFileTypes:true}))if(d.isFile()&&d.name.endsWith('.html')){const file=path.join(root,d.name);if(/(?:adsbygoogle\.js|googlesyndication\.com\/pagead|doubleclick\.net\/)/.test(fs.readFileSync(file,'utf8')))adIntegrations.push(d.name);}
 scan(path.join(root,'js'));
 reasons.push(...assetErrors);
 const ready=reasons.length===0,unexpectedIntegration=adIntegrations.length>0&&!ready;
 const gateChecksPass=!assetErrors.length&&!reasons.some(r=>r.endsWith('-unreadable'))&&!unexpectedIntegration&&(config?.enabled===false||ready);
 return {ready,gateChecksPass,reasons:[...new Set(reasons)],assetErrors,adIntegrations,unexpectedIntegration};
}
if(require.main===module){
 const result=audit();console.log(JSON.stringify(result,null,2));
 if(!result.gateChecksPass||process.argv.includes('--require-ready')&&!result.ready)process.exitCode=1;
}
module.exports={audit};
