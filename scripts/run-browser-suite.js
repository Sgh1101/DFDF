// Same runner for a workstation and CI. Tests use disposable API accounts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
const smoke=['test:startup','test:browser','test:legacy-models','test:improvements','test:mobile-preview','test:network-recovery','test:ascent-abilities','test:ability-floors'];
const all=Object.keys(pkg.scripts).filter(k=>/^(test:|audit:)/.test(k)&&/^node scripts\/browser-/.test(pkg.scripts[k]));
const only=process.argv.find(a=>a.startsWith('--only='));
const picked=only?only.slice(7).split(','):process.argv.includes('--full')?all:smoke;
for(const name of picked)if(!all.includes(name))throw Error('Unknown browser check: '+name);
// --shard=I/N runs every Nth check of the list from the I-th (1-based): CI spreads a run over N machines this way
const shard=/^--shard=(\d+)\/(\d+)$/.exec(process.argv.find(a=>a.startsWith('--shard='))||'');
if(shard&&!(+shard[1]>=1&&+shard[1]<=+shard[2]))throw Error('Bad --shard: '+shard[0]);
const jobs=shard?picked.filter((_,i)=>i%+shard[2]===+shard[1]-1):picked;
const out=path.resolve(process.env.DFDF_AUDIT_DIR||'test-results/browser-suite');fs.mkdirSync(out,{recursive:true});
const env={...process.env,DFDF_BOOT_TIMEOUT:process.env.DFDF_BOOT_TIMEOUT||'120000'};
env.DFDF_THREE_PATH ||= path.join(path.dirname(require.resolve('three')), 'three.min.js');
env.DFDF_PEERJS_PATH ||= path.join(path.dirname(require.resolve('peerjs')), 'peerjs.min.js');
if(!env.DFDF_PEER_SERVER_MODULE)env.DFDF_PEER_SERVER_MODULE=require.resolve('peer');
// --keep-going runs every check and fails at the end; --retries=N runs a failed check again up to N times (a pass on
// a retry is reported as flaky, not hidden)
const keepGoing=process.argv.includes('--keep-going'),retries=Math.max(0,+(process.argv.find(a=>a.startsWith('--retries='))||'').slice(10)||0);
// On GitHub the job log and the artifact live on blob storage; an annotation is shown on the run and the pull
// request and can be read through the checks API, so a failure also says which check and its last lines there
const annotate=(level,title,text)=>{if(process.env.GITHUB_ACTIONS)console.log('::'+level+' title='+title.replace(/[%\r\n:,]/g,' ')+'::'+String(text).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A'));};
const tailOf=name=>fs.readFileSync(path.join(out,name.replaceAll(':','-'),'output.log'),'utf8').slice(-3500);
let server;
function gameHash(){const hash=crypto.createHash('sha256');function add(file){hash.update(path.relative(root,file).replaceAll('\\','/')+'\0');hash.update(fs.readFileSync(file));}function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);e.isDirectory()?walk(p):add(p);}}for(const name of ['js','css','api'])walk(path.join(root,name));for(const name of ['play.html','index.html','admin.html','sw.js','vercel.json','package.json','package-lock.json'])add(path.join(root,name));return hash.digest('hex');}
const testHash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,pkg.scripts[name].slice(5)))).update(fs.readFileSync(path.join(root,'tests/api-harness.js'))).update(fs.readFileSync(path.join(root,'scripts/browser-fixture.js'))).digest('hex');
async function main(){
 if(!env.DFDF_BASE_URL){env.DFDF_BASE_URL='http://127.0.0.1:3017';server=spawn(process.execPath,['scripts/dev-server.js'],{cwd:root,env:{...env,PORT:'3017'},stdio:'ignore'});
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(env.DFDF_BASE_URL)).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Test server did not start');}
 const report=path.join(out,'summary.json'),resume=process.argv.includes('--resume'),reuse=process.argv.includes('--reuse-passed');
 const rows=resume&&fs.existsSync(report)?JSON.parse(fs.readFileSync(report)):[],hash=gameHash();
 fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({resume,reusePassedAcrossSource:reuse,gameTreeSha256:hash,started:new Date().toISOString()},null,2));
 const failed=[];
 for(const name of jobs){const old=rows.find(r=>r.name===name),testSha256=testHash(name);
  if(resume&&old?.passed&&(reuse||old.gameTreeSha256===hash&&old.testSha256===testSha256)){if(old.gameTreeSha256!==hash||old.testSha256!==testSha256)old.reusedAcrossSource=true;continue;}
  // a pass on a retry also says how the first try ended, so a flaky check's cause can be read from the run
  let row,attempt=0,first='';
  for(;;attempt++){row=await runOne(name,rows.find(r=>r.name===name),testSha256);if(row.passed||attempt>=retries)break;first||=tailOf(name);console.log('RETRY',name);}
  if(row.passed&&attempt>0){row.flaky=attempt;fs.writeFileSync(report,JSON.stringify(rows,null,2));annotate('warning',name+' flaky','failed '+attempt+'x, then passed on a retry. The first try ended:\n'+first.slice(-2500));}
  if(!row.passed){const tail=tailOf(name);console.error(tail);annotate('error',name+' failed',tail.slice(-3000));if(!keepGoing)throw Error(name+' failed');failed.push(name);}
 }
 // how long each check took here (its last try), readable through the checks API, to balance the shards by
 annotate('notice','durations',jobs.map(n=>{const r=rows.find(x=>x.name===n);return r?n+' '+r.seconds+'s'+(r.flaky?' (retried)':r.passed?'':' (failed)'):'';}).filter(Boolean).join('\n'));
 if(failed.length)throw Error(failed.length+' browser check(s) failed: '+failed.join(', '));
 async function runOne(name,old,testSha256){
  const dir=path.join(out,name.replaceAll(':','-'));fs.mkdirSync(dir,{recursive:true});const log=path.join(dir,'output.log');if(old&&fs.existsSync(log))fs.copyFileSync(log,path.join(dir,'output.previous-'+Date.now()+'.log'));
  const fd=fs.openSync(log,'w'),started=Date.now(),sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  console.log('START',name);const child=spawn(process.execPath,[pkg.scripts[name].slice(5)],{cwd:root,env:{...env,SHOT_DIR:dir,DFDF_SCREENSHOT_DIR:dir,DFDF_UI_SHOTS:dir,DFDF_UI_OUT:path.join(dir,'audit.json')},stdio:['ignore',fd,fd]});
  const timer=setTimeout(()=>{if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});else child.kill('SIGKILL');},20*60000);
  const code=await new Promise(r=>{child.once('error',()=>r(-1));child.once('exit',r);});clearTimeout(timer);fs.closeSync(fd);
  const auditFile=path.join(dir,'audit.json');const signals=name.startsWith('audit:')?(fs.existsSync(auditFile)?JSON.parse(fs.readFileSync(auditFile)).length:-1):0;
  const sourceChanged=gameHash()!==hash||testHash(name)!==testSha256;
  const row={name,sha,gameTreeSha256:hash,testSha256,code,signals,sourceChanged,seconds:Math.round((Date.now()-started)/1000),passed:code===0&&signals===0&&!sourceChanged};
  if(old){row.previousAttempts=[...(old.previousAttempts||[]),{sha:old.sha,code:old.code,passed:old.passed,seconds:old.seconds}];rows[rows.indexOf(old)]=row;}else rows.push(row);
  fs.writeFileSync(report,JSON.stringify(rows,null,2));console.log(row.passed?'PASS':'FAIL',name,row.seconds+'s');
  return row;
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server?.kill());
