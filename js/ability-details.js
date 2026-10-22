(() => {
  'use strict';
  if (!window.ABILITY_PROFILES || typeof castAbility !== 'function') return;
  const catalog=ABILITY_PROFILES.build(AGENTS);
  if(catalog.errors.length) throw new Error(catalog.errors.join('; '));
  const profiles=catalog.profiles, active=new Set(), impacts=new Set();
  let context=null;
  // Projectile collisions and delayed effects retain the cast's visual identity instead
  // of falling back to a generic ring once the synchronous cast call has returned.
  const spawn=abilSpawn;
  abilSpawn=function(ent){
    const p=context,update=ent.update;
    if(p&&update)ent.update=function(){const prev=context;context=p;try{return update.apply(this,arguments);}finally{context=prev;}};
    return spawn.apply(this,arguments);
  };
  const local=()=>myActor()||player;
  const budget=()=>ABILITY_PROFILES.budgets[SETTINGS.quality]||ABILITY_PROFILES.budgets.perf;
  const moving=()=>MOT()>0&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  function dispose(group) {
    if(!group||group.userData.detailDisposed) return;
    group.userData.detailDisposed=true;group.removeFromParent();
    const gs=new Set(),ms=new Set();
    group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});
    gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());
  }
  // Two material batches for the static tool, separate meshes only for articulated pieces.
  // This owns and frees its geometries; it never bakes or disposes the player's source rig.
  function batch(group) {
    const map=new Map();
    for(const m of group.children) if(m.isMesh&&!m.userData.articulated) {
      if(!map.has(m.material))map.set(m.material,[]);map.get(m.material).push(m);
    }
    for(const [material,meshes] of map) {
      const positions=[],normals=[];
      for(const m of meshes) {
        m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);
        positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);
        g.dispose();m.geometry.dispose();group.remove(m);
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      group.add(new T.Mesh(g,material));
    }
  }
  function tool(motif,color,key='X') {
    const g=new T.Group();g.name='ability-tool-'+motif+'-'+key;g.userData.abilityTool=motif;
    const light=new T.MeshBasicMaterial({color,transparent:true,opacity:.94,depthWrite:false}), dark=new T.MeshBasicMaterial({color:0x172334});
    const mesh=(geo,x=0,y=0,z=0,d=false,rz=0,live=false)=>{
      const m=new T.Mesh(geo,d?dark:light);m.position.set(x,y,z);m.rotation.z=rz;m.userData.articulated=live;g.add(m);return m;
    };
    const box=(x,y,z,w,h,d,shade=false,rz=0,live=false)=>mesh(new T.BoxGeometry(w,h,d),x,y,z,shade,rz,live);
    const orb=(x,y,z,r,shade=false)=>mesh(new T.IcosahedronGeometry(r,1),x,y,z,shade);
    const cone=(x,y,z,r,h,rz=0)=>mesh(new T.ConeGeometry(r,h,6),x,y,z,false,rz);
    const ring=(x,y,z,r,arc=Math.PI*2,rz=0)=>mesh(new T.TorusGeometry(r,.009,5,24,arc),x,y,z,false,rz);
    const stem=()=>box(0,-.08,0,.035,.22,.035,true);
    switch(motif) {
      case 'flame': for(let i=0;i<3;i++)cone((i-1)*.045,.04+i*.025,0,.035,.15+i*.025,(i-1)*-.2);break;
      case 'crystal': for(let i=0;i<3;i++){const m=orb((i-1)*.065,i===1?.04:0,0,.055);m.scale.set(.55,2, .65);}break;
      case 'shadow': box(0,0,0,.03,.24,.02,true);cone(0,.12,0,.045,.14);ring(0,0,0,.075,Math.PI,Math.PI/2);break;
      case 'gauntlet': box(0,0,0,.15,.13,.12,true);for(let i=0;i<4;i++)box((i-1.5)*.035,.07,-.035,.027,.045,.05);break;
      case 'lotus': orb(0,0,0,.045);for(let i=0;i<6;i++){const a=i*Math.PI/3;const m=orb(Math.cos(a)*.067,Math.sin(a)*.067,0,.035);m.scale.set(.6,1.5,.6);}break;
      case 'drone': box(0,0,0,.12,.04,.1,true);for(const x of [-1,1]){box(x*.11,0,0,.1,.016,.03);ring(x*.14,0,0,.045);}orb(0,-.035,-.05,.02);break;
      case 'bow': ring(.08,0,0,.15,Math.PI,Math.PI/2);box(0,0,0,.012,.3,.012,true);box(0,0,-.07,.014,.014,.25);break;
      case 'electrode': stem();box(-.065,.04,0,.025,.18,.025);box(.065,.04,0,.025,.18,.025);box(0,-.04,0,.15,.025,.025);cone(0,.08,0,.04,.14,.5);break;
      case 'mirror': for(let i=0;i<3;i++){const m=orb((i-1)*.08,0,0,.065);m.scale.set(.65,1.5,.12);m.rotation.z=(i-1)*-.4;}break;
      case 'hourglass': cone(0,.05,0,.075,.1,Math.PI);cone(0,-.05,0,.075,.1);box(0,.11,0,.18,.015,.07,true);box(0,-.11,0,.18,.015,.07,true);break;
      case 'bell': mesh(new T.CylinderGeometry(.04,.1,.14,12,1,true),0,0,0);ring(0,-.07,0,.1).rotation.x=Math.PI/2;orb(0,-.08,0,.022,true);break;
      case 'magnet': box(-.065,0,0,.04,.18,.05);box(.065,0,0,.04,.18,.05);box(0,-.08,0,.16,.04,.05,true);break;
      case 'whip': stem();for(let i=0;i<7;i++)orb(Math.sin(i*.7)*.045,.02+i*.035,0,.015-i*.001);break;
      case 'bee': orb(0,0,0,.075,true);for(const s of [-1,1]){const w=orb(s*.085,.04,0,.06);w.scale.set(1,.22,.7);w.userData.articulated=true;w.userData.wing=s;}box(0,0,-.05,.1,.025,.055);cone(0,-.09,0,.025,.05,Math.PI);break;
      case 'fan': stem();for(let i=0;i<5;i++)box(Math.sin((i-2)*.35)*.08,.04,0,.02,.22,.012,false,(i-2)*-.35);break;
      case 'web': ring(0,0,0,.09);for(let i=0;i<4;i++)box(0,0,0,.21,.008,.008,false,i*Math.PI/4);ring(0,0,0,.045);break;
      case 'star': for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cone(Math.sin(a)*.055,Math.cos(a)*.055,0,.028,.12,-a);}orb(0,0,0,.04,true);break;
      case 'dagger': stem();cone(0,.06,0,.045,.22);box(0,-.04,0,.15,.018,.03,true);break;
      case 'vine': for(let i=0;i<6;i++){const x=Math.sin(i*.7)*.035;box(x,i*.035-.09,0,.014,.055,.014,false,.6*Math.cos(i*.7));cone(x+.04,i*.035-.09,0,.024,.06,-1);}break;
      case 'leech': for(let i=0;i<7;i++){const m=orb(Math.sin(i*.6)*.04,i*.03-.09,0,.032);m.scale.y=.7;}ring(0,.1,0,.03);break;
      case 'lantern': box(0,0,0,.12,.15,.09,true);orb(0,0,-.05,.045);for(const s of [-1,1])box(s*.07,0,-.05,.012,.18,.012);ring(0,.13,0,.03,Math.PI);break;
      case 'mask': orb(0,0,0,.1);box(-.04,.02,-.08,.035,.015,.025,true);box(.04,.02,-.08,.035,.015,.025,true);cone(0,-.055,-.04,.04,.08,Math.PI);break;
      case 'fork': stem();for(const s of [-1,1])box(s*.05,.05,0,.018,.22,.018);box(0,-.045,0,.12,.02,.025);break;
      case 'volcano': mesh(new T.CylinderGeometry(.05,.12,.13,8),0,0,0,true);ring(0,.065,0,.055).rotation.x=Math.PI/2;for(let i=0;i<3;i++)orb((i-1)*.035,.12+Math.abs(i-1)*.035,0,.025);break;
      case 'crest': box(0,0,0,.15,.19,.035,true);cone(0,-.09,0,.095,.1,Math.PI);box(0,0,-.03,.018,.14,.02);box(0,.02,-.03,.11,.018,.02);break;
      case 'claw': for(let i=0;i<3;i++)cone((i-1)*.055,.03,0,.018,.24,(i-1)*-.15);box(0,-.08,0,.17,.04,.07,true);break;
      case 'bird': orb(0,0,0,.045,true);for(const s of [-1,1]){const w=box(s*.085,.025,0,.14,.025,.065,false,s*.25,true);w.userData.wing=s;}cone(0,0,-.065,.02,.07);break;
      case 'trident': stem();for(let i=0;i<3;i++)cone((i-1)*.065,.09+(i===1?.025:0),0,.02,.1);box(0,.015,0,.16,.025,.025);break;
      case 'brush': box(0,-.04,0,.025,.24,.025,true);cone(0,.12,0,.037,.13,Math.PI);ring(0,.055,0,.025).rotation.x=Math.PI/2;break;
      case 'crescent': ring(0,0,0,.1,Math.PI*1.4,-.7);orb(.065,.035,0,.025);break;
      case 'cloud': for(let i=0;i<3;i++)orb((i-1)*.065,i===1?.035:0,0,.065);for(let i=0;i<3;i++)box((i-1)*.06,-.095,0,.012,.055,.012);break;
      case 'hammer': stem();box(0,.07,0,.22,.1,.09,true);box(-.12,.07,0,.02,.12,.11);box(.12,.07,0,.02,.12,.11);break;
      case 'reticle': ring(0,0,0,.08);for(let i=0;i<4;i++){const a=i*Math.PI/2;box(Math.sin(a)*.1,Math.cos(a)*.1,0,.012,.07,.012,false,-a);}orb(0,0,0,.015);break;
      case 'chip': box(0,0,0,.14,.14,.035,true);box(0,0,-.02,.07,.07,.015);for(const s of [-1,1])for(let i=0;i<4;i++)box(s*.09,(i-1.5)*.035,0,.05,.012,.015);break;
      case 'vial': mesh(new T.CylinderGeometry(.035,.05,.14,10),0,0,0);box(0,.09,0,.06,.035,.06,true);orb(0,-.065,0,.05);break;
      case 'panel': for(let i=0;i<3;i++)box((i-1)*.065,0,(i%2)*.02,.06,.2,.025,i===1);box(0,.1,0,.22,.025,.04,true);break;
      case 'clock': ring(0,0,0,.1);box(0,.035,-.01,.012,.08,.012,true);box(.035,0,-.01,.075,.012,.012);for(let i=0;i<4;i++){const a=i*Math.PI/2;orb(Math.sin(a)*.085,Math.cos(a)*.085,0,.012);}break;
      case 'portal': ring(0,0,0,.095);ring(0,0,.015,.065,Math.PI*1.5);box(0,0,0,.015,.15,.015,true);break;
      case 'cylinder': mesh(new T.CylinderGeometry(.065,.065,.09,6),0,0,0,true).rotation.x=Math.PI/2;for(let i=0;i<6;i++){const a=i*Math.PI/3;orb(Math.cos(a)*.045,Math.sin(a)*.045,-.05,.014);}box(0,-.09,0,.045,.13,.035);break;
      case 'compass': ring(0,0,0,.1);cone(0,.035,0,.025,.13);cone(0,-.035,0,.025,.13,Math.PI);for(const s of [-1,1])box(s*.105,0,0,.04,.01,.01,true);break;
      case 'maskpair': for(const s of [-1,1]){orb(s*.055,0,s*.025,.075,s<0);box(s*.055,.02,-.06,.045,.014,.018,s>0);}break;
      case 'cards': for(let i=0;i<3;i++)box((i-1)*.045,Math.abs(i-1)*-.02,0,.09,.15,.008,i===0,(i-1)*-.25);box(0,.12,0,.075,.02,.025,true);break;
      default: throw new Error('Missing ability motif '+motif);
    }
    // Each key has a real different accessory/silhouette: emitter, hinge, trigger, power seal.
    if(key==='Q')box(.045,-.09,.035,.055,.025,.03,true);
    else if(key==='E')ring(0,-.06,.025,.035,Math.PI);
    else if(key==='C')box(-.055,-.07,.02,.035,.07,.025,true,-.4);
    else ring(0,0,.025,.145,Math.PI*1.65,.35);
    batch(g);
    if(!g.children.some(m=>m.material===dark))dark.dispose();
    g.traverse(o=>{o.castShadow=false;o.receiveShadow=false;});
    return g;
  }
  function animateTool(g,t,weight=1) {
    for(const m of g.children) if(m.userData.wing) m.rotation.z=m.userData.wing*(.22+Math.sin(t*32)*.45)*weight;
  }
  function line(color,count=2) {
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));
    const l=new T.Line(g,new T.LineBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false}));l.frustumCulled=false;return l;
  }
  function setLine(l,points) { const a=l.geometry.attributes.position;points.forEach((p,i)=>a.setXYZ(i,p.x,p.y,p.z));a.needsUpdate=true; }
  function lifecycle(duration,update,cleanup,owner) {
    let time=0,done=false;const round=world.round;
    const ent={update(dt){
      if(done||world.round!==round||world.phase==='end'||world.phase==='menu'||world.over||(owner&&!owner.alive))return false;
      time+=dt;return update(Math.min(time,duration),dt)!==false&&time<duration;
    },dispose(){if(done)return;done=true;cleanup&&cleanup();}};
    abilSpawn(ent);return ent;
  }
  function sound(profile,c) {
    if(profile.native) return;
    const v=local(),dist=v?Math.hypot(c.pos.x-v.pos.x,c.pos.z-v.pos.z):100;
    if(dist>55)return;
    try {
      const ctx=GAME_AUDIO.context();if(!ctx||ctx.state!=='running')return;
      const idx=ABILITY_PROFILES.rows.findIndex(r=>r[0]===profile.agent),f0=135+(idx%9)*43;
      const t=ctx.currentTime, gain=ctx.createGain(),osc=ctx.createOscillator();
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.065*(1-dist/60),t+.018);gain.gain.exponentialRampToValueAtTime(.0001,t+.23);
      osc.type=['sine','triangle','sawtooth'][Math.floor(idx/9)%3];osc.frequency.setValueAtTime(f0,t);
      osc.frequency.exponentialRampToValueAtTime(f0*(profile.base==='throw'?2.3:profile.ult?.45:1.35),t+.2);
      osc.connect(gain);gain.connect(GAME_AUDIO.output);osc.start(t);osc.stop(t+.25);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }catch(e){ /* An unopened audio context does not stop a cast. */ }
  }
  const defs={};for(const a of AGENTS)for(const d of a.abilities)defs[d.type]=d;
  let vmTool=null,vmType=null,vmSupport=null;
  const oldStyle=castStyle,oldVm=vmCast,oldPose=castVmPose,oldBody=castPose;
  castStyle=function(type,d){const p=profiles[type];return p&&!p.native?'detail:'+type:oldStyle.apply(this,arguments);};
  for(const [type,p] of Object.entries(profiles))CAST_DUR['detail:'+type]=p.duration;
  function clearVM(){dispose(vmTool);dispose(vmSupport);vmTool=vmSupport=null;vmType=null;}
  vmCast=function(style){
    const result=oldVm.apply(this,arguments),type=style&&style.startsWith('detail:')?style.slice(7):null;
    if(!VM_CAST.grp)return result;
    if(!type){clearVM();VM_CAST.orb.visible=true;return result;}
    if(vmType!==type||vmTool.parent!==VM_CAST.grp){
      clearVM();const p=profiles[type],d=defs[type],a=AGENTS.find(a=>a.id===p.agent);
      vmTool=tool(p.motif,a.color,p.key);vmTool.position.copy(VM_CAST.hand).add(new T.Vector3(0,.06,-.035));vmTool.scale.setScalar(.8);VM_CAST.grp.add(vmTool);vmType=type;
      // The supporting hand shares the parent transform with the casting hand. It cannot
      // float independently of the wrist when the gun/body bobs, rolls or moves.
      vmSupport=new T.Group();const m=new T.MeshBasicMaterial({color:0x263345}),n=new T.MeshBasicMaterial({color:0x101922}),l=new T.MeshBasicMaterial({color:a.color});
      const h=new T.Vector3(.12,-.21,-.42);vmArm(vmSupport,h,new T.Vector3(.25,-.48,-.06),m,n,l,false);VM_CAST.grp.add(vmSupport);
      vmTool.traverse(o=>{o.renderOrder=999;o.frustumCulled=false;});vmSupport.traverse(o=>{o.renderOrder=999;o.frustumCulled=false;});
      VM_CAST.big=d.ult>0;
    }
    VM_CAST.orb.visible=false;return result;
  };
  castVmPose=function(style,time){
    const profile=style&&style.startsWith('detail:')&&profiles[style.slice(7)];
    if(!profile)return oldPose.apply(this,arguments);
    const r=oldPose(profile.base,time),ph=ABILITY_PROFILES.phase(profile,time*profile.duration),w=ph.weight;
    const verbs=profile.gesture;
    // Lift the whole wrist/forearm assembly into view, rather than lifting a detached
    // prop. On a short phone the original low planting pose sat behind the skill tiles.
    r.p[1]+=.13*w;
    if(['spin','reverse','rewind','orbit','navigate','resonate'].includes(verbs))r.p[4]+=.65*Math.sin(time*Math.PI*2)*w;
    if(['bind','knot','weave','stretch','connect','exchange'].includes(verbs)){r.p[0]+=.14*Math.sin(time*Math.PI*2)*w;r.p[3]-=.25*w;}
    if(['slam','crush','bury','toll','erupt','fortify'].includes(verbs)){r.p[1]+=.1*ph.prepare-.27*ph.release+.17*ph.recover;r.p[3]+=.3*ph.release*w;}
    if(['gaze','hack','execute','point','dismiss','measure'].includes(verbs)){r.p[0]-=.035*w;r.p[2]-=.12*w;r.p[4]-=.15*w;}
    if(['open','bloom','sunrise','rain','cultivate','hatch','multiply'].includes(verbs)){r.p[1]+=.08*w;r.p[4]+=.35*w;}
    if(vmTool){
      animateTool(vmTool,time*profile.duration,moving()?1:0);
      vmTool.rotation.y=['spin','reverse','orbit','rewind'].includes(verbs)&&moving()?time*Math.PI*2:0;
      vmTool.scale.setScalar(.8*(1+.12*w));
      for(const m of vmTool.children)if(m.material.transparent)m.material.opacity=.94*(.4+.6*w);
    }
    if(vmSupport){vmSupport.visible=['sweep','aura','ult','place'].includes(profile.base);vmSupport.position.x=-r.p[0]*.7;vmSupport.rotation.z=-r.p[4]*.5;}
    // Reduced motion retains the readable hand gesture, without vibration/extra spin.
    if(!moving())r.dip*=.3;
    return r;
  };
  castPose=function(actor,model,dt){
    const profile=actor&&actor._castS&&actor._castS.startsWith('detail:')&&profiles[actor._castS.slice(7)];
    if(!profile)return oldBody.apply(this,arguments);
    const style=actor._castS;actor._castS=profile.base;
    try{oldBody.apply(this,arguments);}finally{actor._castS=style;}
    if(!(actor._castT>0))return;
    const ph=ABILITY_PROFILES.phase(profile,profile.duration-actor._castT),w=ph.weight;
    if(['aura','sweep','ult','place'].includes(profile.base)){
      model.armR.arm.rotation.x+=(model.armL.arm.rotation.x-model.armR.arm.rotation.x)*w;
      model.armR.fore.rotation.x+=(model.armL.fore.rotation.x-model.armR.fore.rotation.x)*w;
      model.armR.arm.rotation.z-=.35*w;
    }
    if(['knot','connect','weave','exchange'].includes(profile.gesture))model.chest.rotation.y+=Math.sin(ph.p*Math.PI*2)*.14*w;
    if(['slam','crush','toll'].includes(profile.gesture))model.chest.rotation.x+=.18*ph.release*w;
  };
  function castTool(c,p) {
    const v=local(),b=budget();if(p.native||!c.model||!c.model.armL)return;
    if(v&&Math.hypot(c.pos.x-v.pos.x,c.pos.z-v.pos.z)>b.range)return;
    while(active.size>=b.casts){const oldest=active.values().next().value;oldest.dispose();active.delete(oldest);}
    const motif=tool(p.motif,AGENTS.find(a=>a.id===p.agent).color,p.key),fore=c.model.armL.fore;
    motif.scale.setScalar(1.8);motif.position.set(0,-.24,-.025);fore.add(motif);
    const e=lifecycle(p.duration,(t)=>{
      animateTool(motif,t,moving()?1:0);motif.visible=c!==local();
      const k=Math.min(1,(p.duration-t)/.16);
      for(const m of motif.children)if(m.material.transparent)m.material.opacity=.94*k;
    },()=>{dispose(motif);active.delete(e);},c);active.add(e);
  }
  const originalCast=castAbility;
  castAbility=function(type,def){
    const c=player,p=profiles[type],prev=context;context=p;
    try{
      const result=originalCast.apply(this,arguments);
      if(p&&!p.native&&!CAST_REFUND&&c&&c.alive){castTool(c,p);sound(p,c);}
      return result;
    }finally{context=prev;}
  };
  let impactClock=0;const stamps=new Map();
  function impact(p,at,target,send=false){
    if(!p||p.native||!at)return;
    const v=local(),b=budget();if(v&&Math.hypot(at.x-v.pos.x,at.z-v.pos.z)>b.range)return;
    const id=p.type+':'+target,last=stamps.get(id);
    if(last!=null&&impactClock-last<.35)return;
    stamps.set(id,impactClock);if(stamps.size>256)stamps.delete(stamps.keys().next().value);
    if(send&&NET.mode==='host')sendEventAll({t:'ability-impact',ty:p.type,a:target,p:[Q.pos(at.x),Q.pos(at.y),Q.pos(at.z)]});
    while(impacts.size>=b.casts){const e=impacts.values().next().value;e.dispose();impacts.delete(e);}
    const g=tool(p.motif,AGENTS.find(a=>a.id===p.agent).color,p.key);g.scale.setScalar(2.4);g.position.set(at.x,at.y,at.z);scene.add(g);
    const e=lifecycle(.38,t=>{
      const k=t/.38;g.scale.setScalar(1.5+2*k);if(moving())g.rotation.y=k*1.6;
      for(const m of g.children){m.material.transparent=true;m.material.opacity=.65*(1-k);m.material.depthWrite=false;}
    },()=>{dispose(g);impacts.delete(e);});impacts.add(e);
  }
  const hurt=hurtFighter;
  hurtFighter=function(a){const before=a&&a.hp,r=hurt.apply(this,arguments);if(a&&a.hp<before&&context)impact(context,{x:a.pos.x,y:(a.y||0)+1,z:a.pos.z},a.id,true);return r;};
  const status=statusOn;
  statusOn=function(a,k,t){const before=a&&a[k],r=status.apply(this,arguments);if(a&&t>0&&!(before>0)&&context&&['blind','root','concuss','revealed','vuln'].includes(k))impact(context,{x:a.pos.x,y:(a.y||0)+1.8,z:a.pos.z},a.id);return r;};
  const tick=abilTick;
  abilTick=function(dt){
    impactClock+=dt;
    for(const set of [active,impacts])while(set.size>budget().casts){const e=set.values().next().value;e.dispose();set.delete(e);}
    return tick.apply(this,arguments);
  };
  const event=NET.onEvent;
  NET.onEvent=function(m){
    if(m&&m.t==='ability-impact'){
      if(profiles[m.ty]&&Array.isArray(m.p)&&m.p.length===3&&m.p.every(Number.isFinite))impact(profiles[m.ty],{x:Q.unpos(m.p[0]),y:Q.unpos(m.p[1]),z:Q.unpos(m.p[2])},m.a);
      return;
    }
    return event.apply(this,arguments);
  };
  const originalClear=abilClear;
  abilClear=function(){const r=originalClear.apply(this,arguments);for(const e of [...active,...impacts])e.dispose();active.clear();impacts.clear();stamps.clear();clearVM();if(VM_CAST.grp)VM_CAST.grp.visible=false;VM_CAST.t=0;return r;};
  window.ABILITY_DETAILS=Object.freeze({profiles,agents:catalog.agents,budget,tool,dispose,line,setLine,lifecycle,
    active:()=>active.size+impacts.size,vmType:()=>vmType,vm:()=>({tool:vmTool,support:vmSupport})});
})();
