// Same runner for a workstation and CI. Tests use disposable API accounts.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
const smoke=['test:startup','test:browser','test:legacy-models','test:improvements','test:mobile-preview','test:network-recovery','test:ascent-abilities'];
const all=Object.keys(pkg.scripts).filter(k=>/^(test:|audit:)/.test(k)&&/^node scripts\/browser-/.test(pkg.scripts[k]));
const only=process.argv.find(a=>a.startsWith('--only='));
const jobs=only?only.slice(7).split(','):process.argv.includes('--full')?all:smoke;
for(const name of jobs)if(!all.includes(name))throw Error('Unknown browser check: '+name);
const out=path.resolve(process.env.DFDF_AUDIT_DIR||'test-results/browser-suite');fs.mkdirSync(out,{recursive:true});
const env={...process.env,DFDF_BOOT_TIMEOUT:process.env.DFDF_BOOT_TIMEOUT||'120000'};
env.DFDF_THREE_PATH ||= path.join(path.dirname(require.resolve('three')), 'three.min.js');
env.DFDF_PEERJS_PATH ||= path.join(path.dirname(require.resolve('peerjs')), 'peerjs.min.js');
if(!env.DFDF_PEER_SERVER_MODULE)env.DFDF_PEER_SERVER_MODULE=require.resolve('peer');
let server;
async function main(){
 if(!env.DFDF_BASE_URL){env.DFDF_BASE_URL='http://127.0.0.1:3017';server=spawn(process.execPath,['scripts/dev-server.js'],{cwd:root,env:{...env,PORT:'3017'},stdio:'ignore'});
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(env.DFDF_BASE_URL)).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Test server did not start');}
 const rows=[],sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 for(const name of jobs){const dir=path.join(out,name.replaceAll(':','-'));fs.mkdirSync(dir,{recursive:true});const fd=fs.openSync(path.join(dir,'output.log'),'w'),started=Date.now();
  console.log('START',name);const child=spawn(process.execPath,[pkg.scripts[name].slice(5)],{cwd:root,env:{...env,SHOT_DIR:dir,DFDF_SCREENSHOT_DIR:dir,DFDF_UI_SHOTS:dir,DFDF_UI_OUT:path.join(dir,'audit.json')},stdio:['ignore',fd,fd]});
  const timer=setTimeout(()=>{if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});else child.kill('SIGKILL');},20*60000);
  const code=await new Promise(r=>{child.once('error',()=>r(-1));child.once('exit',r);});clearTimeout(timer);fs.closeSync(fd);
  const auditFile=path.join(dir,'audit.json');const signals=name.startsWith('audit:')?(fs.existsSync(auditFile)?JSON.parse(fs.readFileSync(auditFile)).length:-1):0;
  const row={name,sha,code,signals,seconds:Math.round((Date.now()-started)/1000),passed:code===0&&signals===0};rows.push(row);
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(rows,null,2));console.log(row.passed?'PASS':'FAIL',name,row.seconds+'s');
  if(!row.passed){console.error(fs.readFileSync(path.join(dir,'output.log'),'utf8').slice(-3500));throw Error(name+' failed');}
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server?.kill());
