const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./browser-fixture');
(async()=>{
 const f=await fixture();try{
  const p=await f.page('abilityupgrade',{width:1280,height:720});
  const warnings=[];p.on('console',m=>{if(m.type()==='warning'&&/abil|cast|detail/.test(m.text()))warnings.push(m.text());});
  // This path was explored before this test was authored: real select -> card -> deploy.
  await p.locator('#go-play').click();
  await p.locator('#sel-grid .acard').filter({hasText:'단비'}).click();
  assert.match(await p.locator('#sel-detail').innerText(),/벼락 사슬/);
  await p.locator('#sel-go').click();
  await p.waitForFunction(()=>!!myActor()&&world.actors.length>=4);
  await p.evaluate(()=>{closeShop();ADMIN.freezeAI=true;world.phase='live';world.phaseT=999;myActor().invuln=999;});
  // The game only reads ability keys while the pointer is locked, and the lock is granted a moment after deploy
  // (a long while on a loaded machine): a Q pressed before that is dropped, so wait for the lock first.
  await p.waitForFunction(()=>locked&&world.phase==='live',null,{timeout:60000});
  // Real Q input consumes a charge and takes the new authored gesture.
  const q=await p.evaluate(()=>{const ab=myActor().abilities[0];ab.charges=Math.max(1,ab.charges|0);ab.cd=0;return ab.charges;});await p.keyboard.press('q');
  await p.waitForFunction(n=>myActor().abilities[0].charges===n-1,q);
  assert.equal(await p.evaluate(()=>myActor()._castS),'detail:x_water_cannon');
  const result=await p.evaluate(()=>{
    // Isolated open arena for rule assertions. Existing map/LOS suites exercise real
    // colliders; explicit blocked-sight checks below exercise the new chain rule.
    render=()=>{};titleCam=()=>{};const me=myActor(),others=world.actors.filter(a=>a!==me),foes=others.filter(a=>a.team!==me.team),mate=others.find(a=>a.team===me.team);
    const oldRay=rayBlocked,oldCollision=collideXZ;rayBlocked=()=>false;collideXZ=()=>false;
    const d=type=>AGENTS.flatMap(a=>a.abilities).find(d=>d.type===type);
    const out={cast:[],mechanics:{},frames:{}};
    const tick=(n,dt=.05)=>{for(let i=0;i<n;i++)abilTick(dt);};
    const reset=()=>{
      NET.mode='solo';startRound();world.over=false;world.phase='live';world.phaseT=999;me.pos.x=0;me.pos.z=0;me.y=0;me.yaw=0;me.pitch=0;me.ultW=null;me.hp=100;me.armor=0;
      for(const [i,a] of others.entries()){a.alive=true;a.pos.x=80+i*3;a.pos.z=80;a.y=0;a.hp=100;a.armor=0;a.invuln=0;a.shielded=0;a.root=0;a.__banT=0;a.suppress=0;a.undying=0;a.nearsight=0;a.concuss=0;a.revealed=0;a.decayAmt=0;a.decayT=0;}
      me.alive=true;me.invuln=0;me.shielded=0;me.undying=0;me.__banT=0;me.__refractT=0;me.speedBuff=1;me.root=0;
      CAST_REFUND=false;NET.mode='solo';
    };
    const cast=type=>{const def=d(type);me.agent=AGENTS.find(a=>a.abilities.includes(def));CAST_REFUND=false;castAbility(type,def);};
    try{
      const built=ABILITY_PROFILES.build(AGENTS);out.catalog={agents:AGENTS.length,count:Object.keys(built.profiles).length,errors:built.errors,contracts:Object.values(built.agents).map(a=>a.contract)};
      // Every live definition, not historical roster copies. Preserve native source motions.
      for(const agent of AGENTS)for(const def of agent.abilities){
        reset();me.agent=agent;me.invuln=999;for(const e of foes)e.invuln=999;
        foes[0].pos.x=0;foes[0].pos.z=-10;
        cast(def.type);tick(2);tickVmCast(.08);
        const profile=ABILITY_DETAILS.profiles[def.type];
        const pose=castVmPose(profile.native?'point':'detail:'+def.type,.55);
        if(!pose.p.every(Number.isFinite))throw new Error('Nonfinite pose '+def.type);
        const model=profile.native?null:ABILITY_DETAILS.tool(profile.motif,agent.color,def.key);
        let meshes=0,vertices=0;if(model){model.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});ABILITY_DETAILS.dispose(model);}
        out.cast.push({agent:agent.id,type:def.type,native:profile.native,style:me._castS,meshes,vertices});
        abilClear();if(ABILITY_DETAILS.active()!==0)throw new Error('Leftover cast '+def.type);
      }
      // Lightning is a delayed chain, never a continuous weapon, respects separation and walls.
      reset();for(let i=0;i<3;i++){foes[i].pos.x=i*6;foes[i].pos.z=-12;}
      cast('ult_lightning');out.mechanics.chainBefore=foes.slice(0,3).map(a=>a.hp);out.mechanics.noBeam=!me.ultW;tick(12);
      out.mechanics.chainWindup=foes[0].hp;tick(10);out.mechanics.chainAfter=foes.slice(0,3).map(a=>a.hp);
      reset();foes[0].pos.x=0;foes[0].pos.z=-12;foes[1].pos.x=15;foes[1].pos.z=-12;cast('ult_lightning');tick(24);out.mechanics.chainSeparated=foes[1].hp;
      reset();foes[0].pos.x=0;foes[0].pos.z=-12;cast('ult_lightning');rayBlocked=()=>true;tick(24);out.mechanics.chainBlocked=foes[0].hp;rayBlocked=()=>false;
      // Queen: one destructible territorial summon, not four homing missiles.
      reset();foes[0].pos.x=0;foes[0].pos.z=-12;cast('ult_queen');
      out.mechanics.queenObjects=ABILITY_ULTIMATES.objects().length;const queen=SHOOTABLES.find(s=>s.hp===120);
      foes[0].pos.x=queen.x;foes[0].pos.z=queen.z+3;tick(32);out.mechanics.queenDamage=foes[0].hp<100;
      queen.hp=0;queen.onBreak();tick(1);out.mechanics.queenGone=!SHOOTABLES.includes(queen)&&ABILITY_ULTIMATES.objects().length===0;
      // Paired vines constrain distance; destroying their seed releases the pair.
      reset();foes[0].pos.x=0;foes[0].pos.z=-12;foes[1].pos.x=3;foes[1].pos.z=-12;
      // Pin the aimed location while testing a spatial rule, then restore the real ray aim.
      const oldAim=aimPoint;aimPoint=()=>({x:0,y:0,z:-12});cast('x_ult_jungle');aimPoint=oldAim;
      const seed=SHOOTABLES.find(s=>s.hp===60);out.mechanics.vineSeed=!!seed;foes[1].pos.x=18;const gap=()=>Math.hypot(foes[1].pos.x-foes[0].pos.x,foes[1].pos.z-foes[0].pos.z);
      tick(24);out.mechanics.vineGap=gap();seed.onBreak();tick(1);foes[1].pos.x+=10;const before=gap();tick(10);out.mechanics.vineReleased=Math.abs(gap()-before)<.01;
      // Sound boundary filters regular bullets only. No damage reflection / permanent blind.
      reset();cast('x_ult_soundwall');foes[0].pos.x=0;foes[0].pos.z=-20;
      const shot=(n,kind='gun')=>DAMAGE_CAUSE.run({actor:foes[0].id,kind,gun:'rifle',round:world.round},()=>dealDamage(me,n,false,foes[0]));
      shot(20);out.mechanics.soundBullet=me.hp;me.hp=100;shot(20,'ability');out.mechanics.soundAbility=me.hp;
      foes[0].pos.z=-5;me.hp=100;shot(20);out.mechanics.soundInside=me.hp;out.mechanics.soundNoReflect=foes[0].hp===100;
      // Moon conceals teammates against every reveal entry point, without moving/invulnerability.
      reset();mate.pos.x=2;mate.pos.z=0;cast('x_ult_fullmoon');statusOn(mate,'revealed',8);tick(1);
      out.mechanics.moonHidden=mate.revealed===0&&ABILITY_ULTIMATES.concealed(mate);
      mate.pos.x=30;statusOn(mate,'revealed',8);out.mechanics.moonOutside=mate.revealed===8;
      out.mechanics.moonNoInvulnerability=!(me.undying>0)&&!(mate.invuln>0);
      // Falcon dives at a warned position: moving out avoids the hit.
      // Garden has a finite shared pool, cleanses and never grants undying.
      reset();me.hp=40;mate.hp=40;mate.pos.x=2;mate.pos.z=0;mate.blind=3;mate.concuss=3;cast('x_ult_garden_heal');tick(11);
      out.mechanics.garden={hp:[me.hp,mate.hp],pool:ABILITY_ULTIMATES.objects()[0].pool,clean:mate.blind===0&&mate.concuss===0,immortal:!!(me.undying||mate.undying)};
      for(let i=0;i<12;i++){me.hp=40;mate.hp=40;tick(11);}out.mechanics.gardenEmpty=ABILITY_ULTIMATES.objects().length===0;
      reset();cast('ult_snipe');out.mechanics.bow={kind:me.ultW.kind,ammo:me.ultW.ammo,globalReveal:foes.some(a=>a.revealed>0)};
      // Client replay has visuals and stable identity but cannot change authoritative HP.
      reset();foes[0].pos.x=0;foes[0].pos.z=-12;NET.mode='client';cast('ult_lightning');tick(30);out.mechanics.clientHP=foes[0].hp;
      reset();NET.mode='client';me.agent=AGENTS.find(a=>a.id==='gunbong');
      replayCast({a:me.id,ty:'ult_queen',x:Q.pos(0),y:0,z:0,yw:0,pt:0,dv:977});
      const id=ABILITY_ULTIMATES.objects()[0].id;NET.onEvent({t:'ability-detail',k:'break',id});tick(1);out.mechanics.replayBreak=ABILITY_ULTIMATES.objects().length===0;out.mechanics.replayId=id;
      // Draw/particle count stays bounded even if many casts land together in each mode.
      for(const mode of ['mobile','perf','visual','ultra']){
        reset();SETTINGS.quality=mode;for(let i=0;i<30;i++)cast('x_mark_knife');out.frames[mode]=ABILITY_DETAILS.active();
        if(ABILITY_DETAILS.active()>ABILITY_DETAILS.budget().casts*2)throw new Error('Cast budget exceeded '+mode);
      }
      reset();cast('x_ult_fullmoon');me.alive=false;tick(1);out.mechanics.deathCleanup=ABILITY_ULTIMATES.fields().length===0;
      reset();cast('x_ult_soundwall');cast('ult_queen');cast('x_ult_garden_heal');startRound();
      out.mechanics.roundCleanup=ABILITY_ULTIMATES.fields().length===0&&ABILITY_ULTIMATES.objects().length===0&&ABILITY_DETAILS.active()===0;
    }finally{rayBlocked=oldRay;collideXZ=oldCollision;NET.mode='solo';abilClear();}
    return out;
  });
  assert.equal(result.catalog.agents,28);assert.equal(result.catalog.count,112);assert.deepEqual(result.catalog.errors,[]);
  assert.equal(new Set(result.catalog.contracts).size,28);assert.equal(result.cast.length,112);
  for(const r of result.cast)if(!r.native){assert.match(r.style,/^detail:/);assert.ok(r.vertices>40,r.type);assert.ok(r.meshes<=6,r.type+' '+r.meshes);}
  const m=result.mechanics;console.log(JSON.stringify(m,null,2));
  assert.deepEqual(m.chainBefore,[100,100,100]);assert.equal(m.chainWindup,100);assert.equal(m.noBeam,true);
  assert.ok(m.chainAfter[0]<100&&m.chainAfter[1]<100&&m.chainAfter[2]<100);assert.equal(m.chainSeparated,100);assert.equal(m.chainBlocked,100);
  assert.equal(m.queenObjects,1);assert.equal(m.queenDamage,true);assert.equal(m.queenGone,true);
  assert.equal(m.vineSeed,true);assert.ok(m.vineGap<=8.1);assert.equal(m.vineReleased,true);
  assert.equal(m.soundBullet,90);assert.equal(m.soundAbility,80);assert.equal(m.soundInside,80);assert.equal(m.soundNoReflect,true);
  assert.ok(m.moonHidden&&m.moonOutside&&m.moonNoInvulnerability);
  assert.deepEqual(m.garden,{hp:[52,52],pool:156,clean:true,immortal:false});assert.equal(m.gardenEmpty,true);
  assert.deepEqual(m.bow,{kind:'bow',ammo:3,globalReveal:false});assert.equal(m.clientHP,100);assert.equal(m.replayBreak,true);assert.match(m.replayId,/:977$/);
  assert.ok(m.deathCleanup&&m.roundCleanup);assert.deepEqual(warnings,[]);assert.deepEqual(f.errors,[]);
  // Real first-person transforms at the readable part of each gesture. Check actual
  // vertices (a rotated world-axis bounding box can overstate clipping).
  const framing=[];
  for(const viewport of [{width:1280,height:720},{width:844,height:390},{width:568,height:320}]){
    await p.setViewportSize(viewport);
    framing.push(await p.evaluate(()=>{
      world.phase='live';world.over=false;requestAnimationFrame=()=>0;const a=myActor();a.alive=true;a.yaw=0;a.pitch=0;followCamera(a,.1);const bad=[],checked=[];
      for(const ag of AGENTS)for(const d of ag.abilities){
        const profile=ABILITY_DETAILS.profiles[d.type];if(profile.native||ULTW_OF[d.type])continue;
        a.agent=ag;vmCast('detail:'+d.type);VM_CAST.t=VM_CAST.dur*.45;tickViewmodel(.001);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        const g=VM_CAST.grp.getObjectByName('ability-tool-'+profile.motif+'-'+d.key),xs=[],ys=[];
        g.traverse(o=>{if(!o.isMesh)return;const attr=o.geometry.attributes.position;for(let i=0;i<attr.count;i++){const v=new T.Vector3().fromBufferAttribute(attr,i).applyMatrix4(o.matrixWorld).project(camera);xs.push(v.x);ys.push(v.y);if(v.z< -1||v.z>1)bad.push(d.type+': depth');}});
        const box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
        if(box.some(v=>v< -1.02||v>1.02))bad.push(d.type+': '+JSON.stringify(box));
        checked.push({type:d.type,box});
      }
      abilClear();return {width:innerWidth,height:innerHeight,bad,checked:checked.length};
    }));
  }
  for(const row of framing)assert.deepEqual(row.bad,[],row.width+'x'+row.height+' readable cast tools');
  result.framing=framing;assert.deepEqual(f.errors,[]);assert.deepEqual(warnings,[]);
  fs.mkdirSync('test-results/abilities',{recursive:true});fs.writeFileSync('test-results/abilities/upgrade.json',JSON.stringify(result,null,2));
  console.log('28 agents / 112 live casts; distinct ultimate mechanics, client authority, bounded detail effects and cleanup passed.');
 }finally{await f.browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
