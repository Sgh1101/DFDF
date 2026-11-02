// Offline listening copies of the same numeric scores/voices the browser plays.
// Usage: node scripts/export-champions-score.js <output-directory>
const fs=require('node:fs'),path=require('node:path'),{build}=require('./champions-phantom/audio'),{render}=require('../js/phantom-audio');
const out=path.resolve(process.argv[2]||'test-results/visual-overhaul/audio'),rate=22050,a=build();fs.mkdirSync(out,{recursive:true});
const samples=new Map(Object.entries(a.samples.samples).map(([k,v])=>[k,render(v,rate)]));
function wav(name,events,duration){
 const data=new Float32Array(Math.ceil(rate*duration));
 for(const e of events){const src=samples.get(e.sound),start=Math.round(e.at*rate);for(let i=0,j=0;j<src.length-1&&start+i<data.length;i++,j=i*e.pitch){const n=Math.floor(j),k=j-n;data[start+i]+=(src[n]*(1-k)+src[n+1]*k)*e.volume;}}
 let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));const gain=peak>.85?.85/peak:1;
 const b=Buffer.alloc(44+data.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(data.length*2,40);
 for(let i=0;i<data.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,data[i]*gain))*32767),44+i*2);
 fs.writeFileSync(path.join(out,name+'.wav'),b);return {name,duration,events:events.length,unscaledPeak:peak,previewGain:gain};
}
const ladder=Object.values(a.kill.profiles).flatMap((p,i)=>p.events.map(e=>({...e,at:e.at+i*4})));
const rows=[wav('aurora-kills-1-to-5',ladder,20),...Object.entries(a.music.profiles).map(([name,p])=>wav('aurora-'+name,p.events,name==='inspect'?10.2:19.2))];
fs.writeFileSync(path.join(out,'scores.json'),JSON.stringify({composition:a.music.composition,note:'Offline reference mix; browser output uses game volume and its master processing.',rows},null,2)+'\n');console.log(JSON.stringify(rows));
