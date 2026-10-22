// Test-only RESP client: refuses remote endpoints and never reads production credentials.
const net=require('node:net');
if(require.main===module){
 const port=Number(process.env.DFDF_REDIS_TEST_PORT);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Set a localhost test Redis port');
 const cmd=JSON.parse(process.argv[2]),s=net.connect(port,'127.0.0.1');let data=Buffer.alloc(0);
 function parse(offset=0){let end=data.indexOf('\r\n',offset);if(end<0)return;const t=String.fromCharCode(data[offset]),v=data.toString('utf8',offset+1,end);let next=end+2;
  if(t==='+')return [v,next];if(t===':')return [+v,next];if(t==='-')throw Error(v);
  if(t==='$'){const len=+v;if(len<0)return [null,next];if(data.length<next+len+2)return;return [data.toString('utf8',next,next+len),next+len+2];}
  if(t==='*'){if(+v<0)return [null,next];const out=[];for(let i=0;i<+v;i++){const r=parse(next);if(!r)return;out.push(r[0]);next=r[1];}return [out,next];}throw Error('Invalid RESP');
 }
 s.setTimeout(5000,()=>s.destroy(Error('Redis test timeout')));s.on('connect',()=>s.write('*'+cmd.length+'\r\n'+cmd.map(v=>{const b=Buffer.from(String(v));return '$'+b.length+'\r\n'+b+'\r\n';}).join('')));
 s.on('data',b=>{data=Buffer.concat([data,b]);try{const r=parse();if(r){process.stdout.write(JSON.stringify(r[0]));s.end();}}catch(e){s.destroy(e);}});s.on('error',e=>{console.error(e.message);process.exitCode=1;});
}
