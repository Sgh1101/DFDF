(function(root){
  'use strict';
  const aliases={handcan:'revolver',stinger:'pistol',vector:'smg',pdw:'smg',burstsmg:'smg',ripper:'smg',slugger:'shotgun',doublebarrel:'pocketshot',battle:'rifle',bullpup:'carbine',lmg:'hmg',minigun:'hmg',antimat:'sniper'};
  const restored=['machpist','whisper','burst','shotgun','scout'];
  const names={pistol:'클래식',silenced:'고스트',revolver:'셰리프',rifle:'밴달',carbine:'팬텀',autoshot:'저지',hmg:'오딘',marksman:'아웃로',sniper:'오퍼레이터'};
  const profiles={pistol:{mag:12,rpm:405,auto:false,reload:2.25},silenced:{mag:13,rpm:405,auto:false,reload:1.5},revolver:{mag:6,rpm:240,auto:false,reload:2.25},rifle:{mag:25,rpm:585,auto:true,reload:2.3333},carbine:{mag:30,rpm:660,auto:true,reload:2.5},autoshot:{mag:8,rpm:270,auto:true,reload:2.5},hmg:{mag:100,rpm:720,auto:true,reload:5},marksman:{mag:2,rpm:230,auto:false,reload:2.25},sniper:{mag:5,rpm:36,auto:false,reload:4.25}};
  const knives=[['desire_blade','욕망의 검'],['eternal_axe','영원의 도끼'],['eternal_karambit','영원의 카람빗'],['future_butterfly','미래 나비칼'],['future_dagger','미래 단검'],['thunder_hammer','천둥 망치']].map(([id,name])=>({id:'vp_'+id,source:id,ko:name,en:id.replaceAll('_',' '),rar:4,only:'knife',model:'vp_'+id,pack:true,body:[0xffffff,.4,.3],metal:[0xffffff,.3,.6],dark:[0x333333,.6,.2],glow:0x9ae9ff}));
  // JSON with comments is data. Never eval source expressions or Lua.
  function parse(text){
    let out='',quote=false,escape=false;
    for(let i=0;i<text.length;i++){
      const c=text[i],n=text[i+1];
      if(quote){out+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}
      if(c==='"'){quote=true;out+=c;}else if(c==='/'&&n==='/'){while(i<text.length&&text[i]!=='\n')i++;out+='\n';}
      else if(c==='/'&&n==='*'){i+=2;while(i<text.length&&!(text[i]==='*'&&text[i+1]==='/'))i++;if(i===text.length)throw Error('Unclosed JSON comment');i++;out+=' ';}else out+=c;
    }
    let clean='';quote=false;escape=false;
    for(let i=0;i<out.length;i++){
      const c=out[i];if(quote){clean+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}
      if(c==='"')quote=true;
      if(c===','){let j=i+1;while(/\s/.test(out[j]||'')&&j<out.length)j++;if(out[j]==='}'||out[j]===']')continue;}
      clean+=c;
    }
    return JSON.parse(clean);
  }
  function sample(track,t,fallback){
    const val=x=>{if(x&&typeof x==='object'&&!Array.isArray(x))x=x.post??x.pre??x.vector;if(typeof x==='number')return [x,x,x];return Array.isArray(x)&&x.length===3&&x.every(Number.isFinite)?x:fallback;};
    if(track==null||Array.isArray(track)||typeof track==='number')return val(track);
    const k=Object.keys(track).filter(k=>Number.isFinite(+k)).sort((a,b)=>a-b);if(!k.length)return fallback;if(t<=+k[0])return val(track[k[0]]);
    for(let i=1;i<k.length;i++)if(t<=+k[i]){
      const a=val(track[k[i-1]]),b=val(track[k[i]]),f=(t-k[i-1])/(k[i]-k[i-1]);
      if(track[k[i-1]]?.lerp_mode==='catmullrom'||track[k[i]]?.lerp_mode==='catmullrom'){
        const p=val(track[k[Math.max(0,i-2)]]),q=val(track[k[Math.min(k.length-1,i+1)]]);
        return a.map((v,j)=>.5*((2*v)+(-p[j]+b[j])*f+(2*p[j]-5*v+4*b[j]-q[j])*f*f+(-p[j]+3*v-3*b[j]+q[j])*f*f*f));
      }
      return a.map((v,j)=>v+(b[j]-v)*f);
    }
    return val(track[k.at(-1)]);
  }
  // TACZ applies positive source rotations in a Y-down frame. Conjugate
  // those rotations into Three's Y-up frame, without changing source data.
  function rotation(r){return r.map((v,i)=>i===1?v:-v);}
  function renderGeometry(geo){return {...geo,bones:geo.bones.map(b=>({...b,rotation:b.rotation&&rotation(b.rotation),cubes:b.cubes?.map(c=>({...c,rotation:c.rotation&&rotation(c.rotation)}))}))};}
  const api={aliases,restored,names,profiles,knives,parse,sample,rotation,renderGeometry,canonical:key=>aliases[key]||key};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VALORANT_DATA=api;
})(typeof window==='object'?window:globalThis);
