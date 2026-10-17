(() => {
  'use strict';
  const D=VALORANT_DATA,GS=GUN_SKINS,base='./assets/valorant-packs/v1/';
  const S=window.VALORANT_PACK={status:'loading',items:new Map(),files:new Map(),audioPlayed:[]};
  const status=document.createElement('div');status.id='valorant-status';status.setAttribute('role','status');status.textContent='원본 무기 리소스 불러오는 중…';
  status.style.cssText='position:fixed;bottom:6px;right:12px;z-index:10030;color:#b9e7ef;background:#101823e8;padding:5px 12px;border-radius:8px;font:12px sans-serif';document.body.append(status);
  const blobs=new Map(),buffers=new Map();let manifest,clock=0,inspect=0,attack=0,draw=0,current=null,reloadStart=0,firingActor=null;
  const canonical=D.canonical;
  // Keep legacy properties and wire indices readable, while all enumerated
  // shopping/gacha lists expose only the 17 distinct weapons.
  for(const [old,target] of Object.entries(D.aliases))if(WEAPONS[old])Object.defineProperty(WEAPONS,old,{value:WEAPONS[target],writable:true,configurable:true,enumerable:false});
  for(const [key,name] of Object.entries(D.names))Object.assign(WEAPONS[key],D.profiles[key],{name});
  const purchase=applyPurchase;
  applyPurchase=function(a,kind,key){return purchase.call(this,a,kind,kind==='weapon'?canonical(key):key);};
  function migrateActor(a){
    if(!a?.weapons)return;
    for(const slot of ['primary','secondary']){
      const key=a.weapons[slot],next=canonical(key);if(!key||key===next)continue;
      a.weapons[slot]=next;if(a.ammo?.[key]!=null)a.ammo[next]=a.ammo[key];if(a.reserve?.[key]!=null)a.reserve[next]=a.reserve[key];
    }
  }
  const weaponKey=actorWeaponKey;
  actorWeaponKey=function(a){migrateActor(a);return canonical(weaponKey.apply(this,arguments));};
  const frame=netStep;
  netStep=function(){for(const a of world.actors)migrateActor(a);return frame.apply(this,arguments);};
  const bake=bakeDeep;
  bakeDeep=function(root){let found=false;root.traverse(n=>{if(n.userData.valorantRig)found=true;});return found?root:bake.apply(this,arguments);};
  function itemFor(key,skin){return S.items.get(key==='knife'?skin?.id?.replace(/^vp_/,''):canonical(key));}
  function pose(rig,item,clip,t){
    const anim=item.animations[clip];if(!anim)return;
    if(anim.loop&&anim.animation_length)t%=anim.animation_length;else t=Math.min(t,anim.animation_length||t);
    for(const node of rig.childrenWithBones||[]){
      const name=node.userData.sourceBone,idle=item.animations.static_idle?.bones?.[name]||{},track={...idle,...anim.bones?.[name]},rest=node.userData.rest;
      if(/camera/.test(name))continue;
      const p=D.sample(track?.position,t,[0,0,0]),r=D.sample(track?.rotation,t,[0,0,0]),s=D.sample(track?.scale,t,[1,1,1]);
      node.position.fromArray(rest.p.map((v,i)=>v+p[i]));node.rotation.set(...rest.r.map((v,i)=>(v+r[i])*Math.PI/180),'ZYX');node.scale.fromArray(s);
    }
  }
  function build(item){
    const rig=BEDROCK_RIG.build(item.geo,item.material),wrapper=new T.Group();rig.userData.valorantRig=true;rig.userData.item=item.id;rig.childrenWithBones=[];
    rig.traverse(node=>{
      if(node.userData.base){node.userData.sourceBone=node.name.slice(13);node.userData.rest={p:node.position.toArray(),r:node.userData.base.r.slice()};rig.childrenWithBones.push(node);}
      if(node.isMesh){node.userData.live=true;node.material=item.material;}
    });
    // The supplied hands are kept in the source and geometry, but DFDF's
    // agent arms own hand rendering. Never hide gun-and-hand parent nodes.
    for(const node of rig.childrenWithBones)if(/^(left|right)(hand|arm)(?:_pos|_\d+|\d*)$/i.test(node.userData.sourceBone))for(const c of node.children.slice())if(c.isMesh){node.remove(c);c.geometry.dispose();}
    pose(rig,item,'static_idle',0);
    rig.rotation.y=0;rig.scale.setScalar(item.key==='knife'?.045:.027);wrapper.add(rig);
    const box=new T.Box3().setFromObject(wrapper),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
    rig.position.set(-center.x,-center.y+.03,-center.z+.25-size.z/2);
    wrapper.userData.valorantItem=item.id;wrapper.userData.valorantRig=true;wrapper.userData.sourceCubes=item.cubes;
    return wrapper;
  }
  S.build=id=>{const item=S.items.get(id)||[...S.items.values()].find(item=>item.id===id);if(!item)throw Error('원본 무기가 아직 준비되지 않았어');return build(item);};
  S.pose=pose;
  S.dress=(root,skin)=>{
    if(root.userData.valorantItem!==skin.source){const item=S.items.get(skin.source);if(!item)return root;root.traverse(n=>{if(n.geometry&&!n.geometry.userData.shared)n.geometry.dispose();});root.clear();root.add(build(item));}
    root.userData.skin=skin.id;return root;
  };
  async function bytes(name){
    if(!S.files.has(name))S.files.set(name,(async()=>{
      const file=manifest.files.find(f=>f.name===name);if(!file||name.includes('..'))throw Error('Missing source asset '+name);
      const r=await fetch(base+name);if(!r.ok)throw Error('원본 파일 로딩 실패: '+name);
      const b=await r.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
      if(b.byteLength!==file.size||sha!==file.sha256)throw Error('원본 파일 검증 실패: '+name);return b;
    })());return S.files.get(name);
  }
  async function tex(name,normal=false){
    const b=await bytes(name),url=URL.createObjectURL(new Blob([b],{type:'image/png'}));blobs.set(name,url);
    const t=await new T.TextureLoader().loadAsync(url);t.colorSpace=normal?T.NoColorSpace:T.SRGBColorSpace;t.magFilter=T.NearestFilter;t.name=name;return t;
  }
  const audioContext=()=>window.GAME_AUDIO?.context?.()||null;
  async function sound(name,volume=1){
    if(!name||!SETTINGS.sfx||document.hidden)return false;
    const ctx=audioContext();if(!ctx)return false;
    const [namespace,file]=name.split(':'),prefix=namespace==='wtyj'?'knife':'gun';
    const candidates=[`${prefix}/assets/${namespace}/tacz_sounds/${file}.ogg`,`${prefix}/assets/${namespace}/sounds/${file}.ogg`];
    const path=candidates.find(p=>manifest?.files.some(f=>f.name===p));if(!path)return false;
    if(!buffers.has(path))buffers.set(path,bytes(path).then(b=>ctx.decodeAudioData(b.slice(0))));
    const buffer=await buffers.get(path);if(ctx.state==='suspended')await ctx.resume();
    const voice=ctx.createBufferSource(),gain=ctx.createGain();voice.buffer=buffer;gain.gain.value=.5*volume;voice.connect(gain);gain.connect(window.GAME_AUDIO.output);voice.start();voice.onended=()=>{voice.disconnect();gain.disconnect();};
    S.audioPlayed.push(path);if(S.audioPlayed.length>50)S.audioPlayed.shift();return true;
  }
  S.sound=sound;
  function activeItem(key){
    const a=firingActor||window.SKIN_SHOOTER||myActor()||player,skin=a?GS.skinOf(a,key):GS.of(key);
    if(a?.ultW||CHAMPIONS_PHANTOM.isSkin(skin?.id))return null;
    return itemFor(key,skin);
  }
  const gunSound=SFX.gun;
  const fire=actorFire;
  actorFire=function(a){const previous=firingActor;firingActor=a;try{return fire.apply(this,arguments);}finally{firingActor=previous;}};
  SFX.gun=function(key,far){const item=activeItem(key);if(item&&S.status==='ready'){sound(item.sounds[far>0?'shoot_3p':'shoot']||item.sounds.shoot,1-.8*Math.min(1,far||0)).catch(()=>{});return;}return gunSound.apply(this,arguments);};
  const reloadSound=SFX.reload;
  SFX.reload=function(){const item=activeItem(curWeaponKey());if(item&&S.status==='ready'){sound(item.sounds.reload_tactical).catch(()=>{});return;}return reloadSound.apply(this,arguments);};
  const kick=viewmodelFireKick;
  viewmodelFireKick=function(){const r=kick.apply(this,arguments);attack=clock;return r;};
  const tick=tickViewmodel;
  tickViewmodel=function(dt){
    const r=tick.apply(this,arguments);clock+=dt||.016;
    if(VM.current!==current){current=VM.current;draw=clock;attack=-100;reloadStart=0;inspect=0;const item=activeItem(curWeaponKey());if(item)sound(item.sounds.draw).catch(()=>{});}
    const key=curWeaponKey(),skin=GS.of(key),item=itemFor(key,skin);if(!item||!current||player.ultW||CHAMPIONS_PHANTOM.isSkin(skin?.id))return r;
    let clip='static_idle',time=clock;
    if(player.reloading>0){if(!reloadStart)reloadStart=clock;clip=item.animations.reload_tactical?'reload_tactical':'reload_empty';time=clock-reloadStart;}
    else{reloadStart=0;if(inspect){clip='inspect';time=clock-inspect;if(time>(item.animations[clip]?.animation_length||3))inspect=0;}
      else if(clock-attack<(key==='knife'?60/WEAPONS.knife.rpm:(item.animations.shoot?.animation_length||.2))){clip=key==='knife'?'melee_1':'shoot';time=(clock-attack)*(key==='knife'?(item.animations.melee_1?.animation_length||1)/(60/WEAPONS.knife.rpm):1);}
      else if(clock-draw<(item.animations.draw?.animation_length||.5)){clip='draw';time=clock-draw;}}
    current.traverse(node=>{if(node.userData.valorantRig)pose(node,item,clip,time);});
    if(key==='knife'){
      const previous=S.clip===clip?S.clipTime:-1;
      for(const [at,event] of Object.entries(item.animations[clip]?.sound_effects||{}))if(+at>previous&&+at<=time)sound(event.effect).catch(()=>{});
      S.clip=clip;S.clipTime=time;
    }
    return r;
  };
  addEventListener('keydown',e=>{if(e.code==='KeyY'&&!e.repeat&&!e.target?.closest?.('input,textarea,[contenteditable="true"]')&&document.pointerLockElement&&world.phase!=='menu'){inspect=clock;const item=activeItem(curWeaponKey());if(item)sound(item.sounds.inspect).catch(()=>{});}});
  async function load(){
    try{
      const response=await fetch(base+'manifest.json');if(!response.ok)throw Error('무기 목록 로딩 실패');manifest=await response.json();
      await Promise.all(manifest.items.map(async spec=>{
        const [g,a,texture,normal]=await Promise.all([bytes(spec.model),bytes(spec.animation),tex(spec.texture),spec.normal?tex(spec.normal,true):null]);
        const geo=D.parse(new TextDecoder().decode(g))['minecraft:geometry'][0],animations=D.parse(new TextDecoder().decode(a)).animations;
        if(!geo?.bones||!animations)throw Error('잘못된 원본 모델');
        const material=new T.MeshStandardMaterial({map:texture,normalMap:normal,roughness:.45,metalness:.2,alphaTest:.05,side:T.DoubleSide});material.userData.kind='polymer';
        S.items.set(spec.key==='knife'?spec.id:spec.key,{...spec,geo,animations,material,cubes:geo.bones.reduce((s,b)=>s+(b.cubes?.length||0),0)});
      }));
      for(const spec of manifest.items){const key=spec.key==='knife'?spec.id:spec.key;if(spec.key==='knife')KNIVES.build['vp_'+spec.id]=()=>build(S.items.get(key));else{GUN_BUILD[spec.key]=()=>build(S.items.get(key));WEAPONS[spec.key].reload=S.items.get(key).animations.reload_tactical?.animation_length||2;}}
      S.status='ready';status.remove();window.refreshSkinAssets();
    }catch(e){S.status='error';S.error=e.message;status.textContent='원본 무기 로딩 실패 · 클릭하여 재시도';status.onclick=()=>location.reload();console.error(e);}
  }
  load();
})();
