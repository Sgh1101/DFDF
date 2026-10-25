(() => {
  'use strict';
  const D=VALORANT_DATA,GS=GUN_SKINS,base='./assets/valorant-packs/v1/';
  const S=window.VALORANT_PACK={status:'loading',items:new Map(),files:new Map(),audioPlayed:[]};
  const status=document.createElement('div');status.id='valorant-status';status.setAttribute('role','status');status.textContent='원본 무기 리소스 불러오는 중…';
  status.style.cssText='position:fixed;bottom:6px;right:12px;z-index:10030;color:#b9e7ef;background:#101823e8;padding:5px 12px;border-radius:8px;font:12px sans-serif;pointer-events:none';document.body.append(status);
  // a notice while loading, so taps go through it to the shop's buttons under it; it takes them only to retry
  const blobs=new Map(),buffers=new Map(),handBindings=new WeakMap();let manifest,clock=0,inspect=-1,attack=0,draw=0,current=null,reloadStart=0,firingActor=null,clipRun=0;
  const canonical=D.canonical;
  const poseEuler=new T.Euler(0,0,0,'ZYX'),poseQuaternion=new T.Quaternion();
  S.bounds=root=>{
    let pack=false;root.traverse(n=>{if(n.userData.valorantRig||n.userData.sourceAttachment)pack=true;});
    if(!pack)return new T.Box3().setFromObject(root);
    root.updateWorldMatrix(true,true);const box=new T.Box3();
    root.traverseVisible(n=>{if(!n.isMesh||!n.geometry||Math.abs(n.matrixWorld.determinant())<1e-12)return;n.geometry.computeBoundingBox();box.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld));});
    return box;
  };
  // Keep legacy properties and wire indices readable, while all enumerated
  // Shopping/gacha lists expose only the distinct weapons.
  for(const [old,target] of Object.entries(D.aliases))if(WEAPONS[old])Object.defineProperty(WEAPONS,old,{value:WEAPONS[target],writable:true,configurable:true,enumerable:false});
  for(const [key,name] of Object.entries(D.names))Object.assign(WEAPONS[key],D.profiles[key],{name});
  // Append late-added active guns without changing any existing wire index.
  for(const key of Object.keys(WEAPONS))if(!WKEYS.includes(key))WKEYS.push(key);
  window.GUN_COUNT=Object.keys(WEAPONS).length;
  // The identity swap includes mechanics and optics, not just display names.
  SCOPE_FOV.carbine = 38; delete SCOPE_FOV.scout;
  const reconBase=GUN_BUILD.carbine;
  GUN_BUILD.carbine=()=>{
    const root=reconBase(),b=GunBuilder(),M=GUNMAT;
    b.barrel(M.black(),.028,.24,0,.12,-.08);
    for(const z of [-.02,-.16])b.box(M.gunmetal(),.02,.04,.03,0,.085,z);
    b.cyl(M.glass(),.024,.024,.005,14,0,.12,-.2,Math.PI/2,0,0);
    root.add(b.group);root.userData.weaponModel='recon';return root;
  };
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
    if(anim.loop===true&&anim.animation_length)t%=anim.animation_length;else t=Math.min(t,anim.animation_length||t);
    for(const node of rig.childrenWithBones||[]){
      const name=node.userData.sourceBone,idle=item.animations.static_idle?.bones?.[name]||{},track={...idle,...anim.bones?.[name]},rest=node.userData.rest;
      if(/camera/.test(name))continue;
      const p=D.sample(track?.position,t,[0,0,0]),r=D.rotation(D.sample(track?.rotation,t,[0,0,0])),s=D.sample(track?.scale,t,[1,1,1]);
      node.position.fromArray(rest.p.map((v,i)=>v+p[i]));poseEuler.set(...r.map(v=>v*Math.PI/180),'ZYX');node.quaternion.fromArray(rest.q).multiply(poseQuaternion.setFromEuler(poseEuler));node.scale.fromArray(s);
    }
  }
  function build(item){
    const rig=BEDROCK_RIG.build(item.renderGeo,item.material),wrapper=new T.Group();rig.userData.valorantRig=true;rig.userData.item=item.id;rig.childrenWithBones=[];
    rig.traverse(node=>{
      if(node.userData.base){node.userData.sourceBone=node.name.slice(13);node.userData.rest={p:node.position.toArray(),r:node.userData.base.r.slice(),q:node.quaternion.toArray()};rig.childrenWithBones.push(node);}
      if(node.isMesh){node.userData.live=true;node.material=item.material;}
    });
    // The supplied hands are kept in the source and geometry, but DFDF's
    // agent arms own hand rendering. Never hide gun-and-hand parent nodes.
    for(const node of rig.childrenWithBones)if(/^(left|right)(hand|arm)(?:_pos|_\d+|\d*)$/i.test(node.userData.sourceBone))for(const c of node.children.slice())if(c.isMesh){node.remove(c);c.geometry.dispose();}
    for(const attachment of item.attachments){
      const socket=rig.childrenWithBones.find(n=>n.userData.sourceBone===attachment.type+'_pos');
      const part=BEDROCK_RIG.build(attachment.renderGeo,attachment.material);
      part.name='valorant-attachment-'+attachment.type;part.userData.sourceAttachment=attachment.id;part.userData.sourceCubes=attachment.cubes;
      part.traverse(node=>{
        const name=node.name.slice(13);if(node.userData.base)node.userData.attachmentBone=name;
        // These source planes are used for TACZ's lens stencil/reticle pass.
        // DFDF's existing scoped view owns the aiming overlay.
        if(attachment.type==='scope'&&/^(division|ocular)(?:_\d+)?$/.test(name))node.visible=false;
        if(node.isMesh)node.userData.live=true;
      });
      socket.add(part);
    }
    pose(rig,item,'static_idle',0);
    // Hand-holding rotations can turn a thin knife edge-on in the armory.
    // Present its assembled rest orientation; equipped rigs receive the full
    // source pose on their first viewmodel tick, including these ancestors.
    if(item.key==='knife'){
      let node=rig.childrenWithBones.find(n=>/^(weapon|axe|hammer)$/.test(n.userData.sourceBone));
      for(;node&&node!==rig;node=node.parent)if(node.userData.rest){node.position.fromArray(node.userData.rest.p);node.rotation.set(...node.userData.rest.r.map(v=>v*Math.PI/180),'ZYX');}
    }
    // Supplied knives are 1.6 times their original size, in previews and in play.
    rig.rotation.y=0;rig.scale.setScalar(item.key==='knife'?.072:.027);wrapper.add(rig);
    const box=S.bounds(wrapper),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
    rig.position.set(-center.x,-center.y+.03,-center.z+.25-size.z/2);
    wrapper.userData.valorantItem=item.id;wrapper.userData.valorantRig=true;wrapper.userData.sourceCubes=item.cubes;wrapper.userData.sourceAttachmentCubes=item.attachments.reduce((n,a)=>n+a.cubes,0);
    return wrapper;
  }
  S.build=id=>{const item=S.items.get(id)||[...S.items.values()].find(item=>item.id===id);if(!item)throw Error('원본 무기가 아직 준비되지 않았어');return build(item);};
  S.pose=pose;
  const handMatrix=new T.Matrix4(),handScale=new T.Vector3(),armUp=new T.Vector3(0,1,0);
  function handTransform(root,hand,out){
    const chain=[];for(let node=hand;node&&node!==root;node=node.parent)chain.push(node);
    out.identity();
    for(const node of chain.reverse()){
      // Some packs hide TACZ's built-in arm with a zero-scale socket. Its
      // position/rotation still describe the hand; do not invert a zero matrix.
      handScale.copy(node.scale);for(const axis of ['x','y','z'])if(Math.abs(handScale[axis])<1e-8)handScale[axis]=1;
      out.multiply(handMatrix.compose(node.position,node.quaternion,handScale));
    }
    return out;
  }
  // The source hand bones are sockets for the host game's hands. Bind DFDF's
  // existing agent glove and sleeve to the animated grip rather than the
  // model's preview bounds, which can be far from the actual held handle.
  function bindHand(root,item){
    let rig;root.traverse(n=>{if(n.childrenWithBones)rig=n;});
    const hand=rig?.childrenWithBones.find(n=>n.userData.sourceBone==='righthand');
    if(!hand)return;
    pose(rig,item,'static_idle',0);
    const idleHand=handTransform(root,hand,new T.Matrix4());
    const parts=root.children.filter(n=>n.userData.armPart),sleeve=parts[0],cuff=parts[1],wrist=parts[2],fist=parts[3];
    if(!sleeve||!fist)return;
    const grip=fist.position.clone(),axis=sleeve.position.clone().sub(grip).normalize();
    const inverseIdle=idleHand.invert();
    const length=2*(sleeve.position.distanceTo(grip)-.03),elbow=grip.clone().addScaledVector(axis,length);
    const group=new T.Group();group.name='valorant-agent-hand';group.matrixAutoUpdate=false;root.add(group);
    for(const child of root.children.slice())if(![sleeve,cuff,wrist].includes(child)&&(child.userData.armPart||child===root.userData.fist||child===root.userData.fingers||child===root.userData.ringFinger))group.add(child);
    const binding={hand,group,inverseIdle,sleeve,cuff,wrist,grip,elbow,length,matrix:new T.Matrix4(),target:new T.Vector3(),position:new T.Vector3(),rotation:new T.Quaternion(),scale:new T.Vector3(),axis:new T.Vector3()};handBindings.set(root,binding);return binding;
  }
  function followHand(root,binding){
    handTransform(root,binding.hand,binding.matrix);binding.target.setFromMatrixPosition(binding.matrix);binding.matrix.multiply(binding.inverseIdle);
    binding.matrix.decompose(binding.position,binding.rotation,binding.scale);
    binding.position.copy(binding.grip).applyQuaternion(binding.rotation).negate().add(binding.target);
    binding.group.matrix.compose(binding.position,binding.rotation,binding.scale.set(1,1,1));binding.group.matrixWorldNeedsUpdate=true;
    // Keep the elbow below the view while the wrist follows the source socket.
    // Rotating the entire arm with the wrist would swing the sleeve over the camera.
    const wrist=binding.position.copy(binding.grip).applyMatrix4(binding.group.matrix),axis=binding.axis.subVectors(binding.elbow,wrist),length=Math.max(.05,axis.length());axis.normalize();
    binding.sleeve.position.copy(wrist).addScaledVector(axis,length/2+.03);
    binding.sleeve.quaternion.setFromUnitVectors(armUp,axis);binding.sleeve.scale.y=length/binding.length;
    for(const [part,offset] of [[binding.cuff,.075],[binding.wrist,.045]]){part.position.copy(wrist).addScaledVector(axis,offset);part.quaternion.copy(binding.sleeve.quaternion);}
  }
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
  const json=async name=>D.parse(new TextDecoder().decode(await bytes(name)));
  const resource=(ref,area,dir,ext)=>{const [ns,file]=ref.split(':');return `gun/${area}/${ns}/${dir}/${file}${ext}`;};
  async function attachments(spec){
    if(spec.key==='knife')return [];
    const data=await json(`gun/data/valorant/data/guns/${spec.id}_data.json`);
    return Promise.all(Object.entries(data.builtin_attachments||{}).map(async([type,id])=>{
      const index=await json(resource(id,'data','index/attachments','.json'));
      const display=await json(resource(index.display,'assets','display/attachments','.json'));
      const [geo,texture]=await Promise.all([json(resource(display.model,'assets','geo_models','.json')),tex(resource(display.texture,'assets','textures','.png'))]);
      const model=geo['minecraft:geometry'][0],material=new T.MeshStandardMaterial({map:texture,roughness:.45,metalness:.2,alphaTest:.05,side:T.DoubleSide});material.userData.kind='polymer';
      return {id,type,geo:model,renderGeo:D.renderGeometry(model),material,cubes:model.bones.reduce((n,b)=>n+(b.cubes?.length||0),0)};
    }));
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
  viewmodelFireKick=function(){const r=kick.apply(this,arguments);inspect=-1;attack=clock;clipRun++;return r;};
  S.inspect=()=>{
    const item=activeItem(curWeaponKey());if(!item?.animations.inspect)return undefined;
    if(player.ads||player.reloading>0||keys.fire)return false;
    inspect=inspect>=0?-1:clock;clipRun++;
    if(inspect>=0)sound(item.sounds.inspect).catch(()=>{});
    return true;
  };
  const tick=tickViewmodel;
  tickViewmodel=function(dt){
    const r=tick.apply(this,arguments);clock+=dt||.016;
    if(VM.current!==current){current=VM.current;draw=clock;attack=-100;reloadStart=0;inspect=-1;clipRun++;const item=activeItem(curWeaponKey());if(item)sound(item.sounds.draw).catch(()=>{});}
    const key=curWeaponKey(),skin=GS.of(key),item=itemFor(key,skin);if(!item||!current||player.ultW||CHAMPIONS_PHANTOM.isSkin(skin?.id))return r;
    const binding=key==='knife'?(handBindings.get(current)||bindHand(current,item)):null;
    if(!player.alive||!VM.root.visible||!current.visible||player.ads||player.reloading>0||keys.fire||window.ARMS?.hold?.state?.on||['menu','over','end'].includes(world.phase)||['shop','pause','armory'].some(id=>{const el=document.getElementById(id);return el&&!el.hidden;}))inspect=-1;
    if(inspect>=0&&clock-inspect>=item.animations.inspect.animation_length)inspect=-1;
    let clip='static_idle',time=clock;
    if(player.reloading>0){if(!reloadStart)reloadStart=clock;clip=item.animations.reload_tactical?'reload_tactical':'reload_empty';time=clock-reloadStart;}
    else{reloadStart=0;if(inspect>=0){clip='inspect';time=clock-inspect;}
      else if(clock-attack<(key==='knife'?60/WEAPONS.knife.rpm:(item.animations.shoot?.animation_length||.2))){clip=key==='knife'?'melee_1':'shoot';time=(clock-attack)*(key==='knife'?(item.animations.melee_1?.animation_length||1)/(60/WEAPONS.knife.rpm):1);}
      else if(clock-draw<(item.animations.draw?.animation_length||.5)){clip='draw';time=clock-draw;}}
    current.traverse(node=>{if(node.userData.valorantRig)pose(node,item,clip,time);});
    if(binding)followHand(current,binding);
    if(key==='knife'){
      const previous=S.clip===clip&&S.clipItem===item.id&&S.clipRun===clipRun&&time>=S.clipTime?S.clipTime:-1;
      for(const [at,event] of Object.entries(item.animations[clip]?.sound_effects||{}))if(+at>previous&&+at<=time){
        const ref=event.effect.includes(':')?event.effect:`wtyj:melee/${item.id}/${event.effect}`;
        sound(ref).catch(()=>{});
      }
      S.clip=clip;S.clipTime=time;S.clipItem=item.id;S.clipRun=clipRun;
    }
    return r;
  };
  async function load(){
    try{
      const response=await fetch(base+'manifest.json?v=phantom-auto2');if(!response.ok)throw Error('무기 목록 로딩 실패');manifest=await response.json();
      await Promise.all(manifest.items.map(async spec=>{
        const [g,a,texture,normal,builtin]=await Promise.all([bytes(spec.model),bytes(spec.animation),tex(spec.texture),spec.normal?tex(spec.normal,true):null,attachments(spec)]);
        const geo=D.parse(new TextDecoder().decode(g))['minecraft:geometry'][0],animations=D.parse(new TextDecoder().decode(a)).animations;
        if(!geo?.bones||!animations)throw Error('잘못된 원본 모델');
        if(builtin.some(a=>!geo.bones.some(b=>b.name===a.type+'_pos')))throw Error('원본 부착물 장착 지점 누락: '+spec.id);
        const material=new T.MeshStandardMaterial({map:texture,normalMap:normal,roughness:.45,metalness:.2,alphaTest:.05,side:T.DoubleSide});material.userData.kind='polymer';
        S.items.set(spec.key==='knife'?spec.id:spec.key,{...spec,geo,renderGeo:D.renderGeometry(geo),animations,material,attachments:builtin,cubes:geo.bones.reduce((s,b)=>s+(b.cubes?.length||0),0)});
      }));
      for(const spec of manifest.items){const key=spec.key==='knife'?spec.id:spec.key;if(spec.key==='knife')KNIVES.build['vp_'+spec.id]=()=>build(S.items.get(key));else{GUN_BUILD[spec.key]=()=>build(S.items.get(key));WEAPONS[spec.key].reload=S.items.get(key).animations.reload_tactical?.animation_length||2;}}
      S.status='ready';status.remove();window.refreshSkinAssets();
    }catch(e){S.status='error';S.error=e.message;status.textContent='원본 무기 로딩 실패 · 클릭하여 재시도';status.style.pointerEvents='auto';status.style.cursor='pointer';status.onclick=()=>location.reload();console.error(e);}
  }
  load();
})();
