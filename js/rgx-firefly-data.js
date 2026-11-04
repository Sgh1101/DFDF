// Data-only utilities for the single retained RGX Firefly. No source expression is executed.
(function(root){
  'use strict';
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
      if(c===','){let j=i+1;while(j<out.length&&/\s/.test(out[j]))j++;if(out[j]==='}'||out[j]===']')continue;}
      clean+=c;
    }
    return JSON.parse(clean);
  }
  function sample(track,t,fallback){
    const val=(x,side='post')=>{if(x&&typeof x==='object'&&!Array.isArray(x))x=x[side]??x.post??x.pre??x.vector;if(typeof x==='number')return [x,x,x];return Array.isArray(x)&&x.length===3&&x.every(Number.isFinite)?x:fallback;};
    if(track==null||Array.isArray(track)||typeof track==='number')return val(track);
    const k=Object.keys(track).filter(k=>Number.isFinite(+k)).sort((a,b)=>a-b);
    if(!k.length)return fallback;if(t<+k[0])return val(track[k[0]],'pre');
    for(let i=0;i<k.length;i++)if(t===+k[i])return val(track[k[i]]);
    for(let i=1;i<k.length;i++)if(t<+k[i]){
      const a=val(track[k[i-1]]),b=val(track[k[i]],'pre'),f=(t-k[i-1])/(k[i]-k[i-1]);
      if(track[k[i-1]]?.lerp_mode==='catmullrom'||track[k[i]]?.lerp_mode==='catmullrom'){
        const p=val(track[k[Math.max(0,i-2)]]),q=val(track[k[Math.min(k.length-1,i+1)]],'pre');
        return a.map((v,j)=>.5*((2*v)+(-p[j]+b[j])*f+(2*p[j]-5*v+4*b[j]-q[j])*f*f+(-p[j]+3*v-3*b[j]+q[j])*f*f*f));
      }
      return a.map((v,j)=>v+(b[j]-v)*f);
    }
    return val(track[k.at(-1)]);
  }
  const rotation=r=>r.map((v,i)=>i===1?v:-v);
  const renderGeometry=geo=>({...geo,bones:geo.bones.map(b=>({...b,rotation:b.rotation&&rotation(b.rotation),cubes:b.cubes?.map(c=>({...c,rotation:c.rotation&&rotation(c.rotation)}))}))});
  function prepareRig(rig){
    rig.traverse(node=>{if(node.userData.base){node.userData.rgxBone=node.name.slice('phantom-bone-'.length);node.userData.rgxRest={p:node.position.toArray(),q:node.quaternion.toArray(),r:node.userData.base.r.slice()};}});
    return rig;
  }
  function pose(rig,clips,clip,time){
    const anim=clips[clip];if(!anim)return;
    if(anim.loop===true&&anim.animation_length)time%=anim.animation_length;else time=Math.min(time,anim.animation_length||time);
    rig.traverse(node=>{
      const name=node.userData.rgxBone,rest=node.userData.rgxRest;if(!name||!rest||/camera/.test(name))return;
      const track={...clips.static_idle?.bones?.[name],...anim.bones?.[name]};
      const p=sample(track.position,time,[0,0,0]),r=rotation(sample(track.rotation,time,[0,0,0])),s=sample(track.scale,time,[1,1,1]);
      const base=node.quaternion.clone().fromArray(rest.q);
      node.position.fromArray(rest.p.map((v,i)=>v+p[i]));node.rotation.set(...r.map(v=>v*Math.PI/180),'ZYX');node.quaternion.premultiply(base);node.scale.fromArray(s);
    });
  }
  const api={parse,sample,rotation,renderGeometry,prepareRig,pose};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RGX_FIREFLY_DATA=api;
})(typeof window==='object'?window:globalThis);
