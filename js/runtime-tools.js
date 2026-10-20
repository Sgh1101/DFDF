(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RUNTIME_TOOLS=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  // Bounded, local-only measurements. Never record names, tokens, chat or positions.
  function samples(limit=1800){
    const values=[];let total=0,long=0;
    return {add(ms){if(!Number.isFinite(ms)||ms<=0||ms>1000)return;total++;if(ms>50)long++;values.push(ms);if(values.length>limit)values.shift();},
      read(){const v=values.slice().sort((a,b)=>a-b),at=p=>v.length?v[Math.min(v.length-1,Math.floor((v.length-1)*p))]:0;return {samples:v.length,total,long,median:at(.5),p95:at(.95)};},
      reset(){values.length=0;total=long=0;}};
  }
  function scope(schedule=setTimeout,cancel=clearTimeout){
    let generation=0;const pending=new Set();
    return {reset(){generation++;for(const id of pending)cancel(id);pending.clear();},
      after(ms,fn){const g=generation;let id;id=schedule(()=>{pending.delete(id);if(g===generation)fn();},ms);pending.add(id);return id;},
      get pending(){return pending.size;}};
  }
  // Reduce optional decoration first. Separate from pixel resolution and gameplay FX.
  function budget(){let bad=0,good=0,cool=0,level=0;return {tick(ms,dt){
    if(!Number.isFinite(ms)||!Number.isFinite(dt)||dt<=0||dt>.5)return false;
    cool=Math.max(0,cool-dt);bad=ms>26?bad+dt:0;good=ms<18?good+dt:0;
    if(cool)return false;const old=level;
    if(bad>=3&&level<2){level++;bad=good=0;cool=8;}
    else if(good>=15&&level>0){level--;bad=good=0;cool=12;}
    return old!==level;},reset(){bad=good=cool=level=0;},get level(){return level;},get fraction(){return [1,.75,.5][level];}};}
  function ring(limit=80){const rows=[];return {add(kind,data={}){rows.push({at:Date.now(),kind,...data});if(rows.length>limit)rows.shift();},read(){return rows.map(r=>({...r}));}};}
  return Object.freeze({samples,scope,budget,ring});
});
