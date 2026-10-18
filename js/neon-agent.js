(() => {
  "use strict";
  if (AGENTS.some((a) => a.id === "neon_agent")) return;
  const C = NEON_DATA.config, base = "./assets/neon/1.0.0/", blue = 0x41cfff, yellow = 0xf7ef69;
  const host = () => NET.mode !== "client", rad = Math.PI / 180;
  const A = (key, name, type, cost, charges, cd, desc, ult) => ({ key, name, type, cost, charges, cd, desc, _rs: 1, ...(ult ? { ult } : {}) });
  const agent = {
    id: "neon_agent", key: "neon_agent", name: "네온", role: "타격대", color: "#41cfff", accent: "#f7ef69",
    quote: "전광석화처럼, 앞으로!", desc: "전기 장벽과 도약하는 충격탄, 고속 질주와 슬라이딩으로 돌파하는 요원. Seafle 원본 팔·아이콘·동작을 사용합니다.",
    abilities: [
      A("Q", "릴레이볼트", "neon_relay", 200, 2, 0, "한 번 튕기는 전기탄. 각 착탄 지점에서 0.8초 충전 후 반경 5m, 2.5초 뇌진탕을 일으킵니다. 벽 너머의 적에게는 닿지 않습니다."),
      A("E", "고속기어", "neon_gear", 0, 1, 30, "10초간 이동 속도 +40%. 좌클릭(모바일 사격)으로 6m 슬라이딩 후 질주를 끝내고 무기로 돌아옵니다. 처치 2회마다 슬라이딩이 충전됩니다."),
      A("C", "추월차선", "neon_lane", 300, 1, 0, "전방 최대 25m에 높이 4m의 전기 장벽 두 개를 펼쳐 4초간 양옆 시야를 가립니다. 가운데 2.4m 통로로 이동·사격할 수 있습니다."),
      A("X", "오버드라이브", "neon_overdrive", 0, 1, 0, "20초 동안 총 대신 손끝에서 40m 전기 빔을 발사합니다. 0.1초당 피해 18. 궁극기 중에는 좌클릭으로 빔, 우클릭으로 슬라이딩을 사용합니다.", 7),
    ],
  };
  AGENTS.push(agent);
  const iconFiles = { neon_relay: "relaybolt", neon_gear: "efastgear", neon_lane: "fastlane", neon_overdrive: "overdrive" };
  const oldIcon = abIcon;
  abIcon = function (type, cls) {
    return iconFiles[type] ? `<img class="${cls || "ab-ic"}" src="${base}textures/gui/hud/icon_${iconFiles[type]}.png" alt="" style="object-fit:contain">` : oldIcon.apply(this, arguments);
  };
  // NoSound source: do not substitute invented character voice or skill recordings.
  const abilitySound = SFX.abilityCast;
  SFX.abilityCast = function (type) { if (!iconFiles[type]) return abilitySound.apply(this, arguments); };
  Object.assign(CAST_STYLE_OF, { neon_relay: "throw", neon_lane: "sweep", neon_gear: "aura" });
  ULTW.neon = { name: "오버드라이브", color: blue, glow: "#41cfff", dur: C.ultimateDuration, ammo: 0, rate: C.ultimateRate, auto: true, aiRange: C.ultimateRange };
  ULTW_OF.neon_overdrive = "neon";

  // The source skin is fitted to this skeleton in neon-appearance.js.
  CH_STYLE[agent.id] = { ...CH_STYLE._default, w: .88, bulk: .88 };
  CH_OUTFIT[agent.id] = () => {};

  let data = null, assetError = null;
  const assetsReady = (async () => {
    const response = await fetch(base + "manifest.json"); if (!response.ok) throw new Error("Neon manifest: " + response.status);
    const manifest = await response.json(), files = new Map();
    await Promise.all(manifest.files.map(async (meta) => {
      const r = await fetch(base + meta.file); if (!r.ok) throw new Error(meta.file + ": " + r.status);
      const raw = await r.arrayBuffer(), hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)), b => b.toString(16).padStart(2, "0")).join("");
      if (raw.byteLength !== meta.bytes || hash !== meta.sha256) throw new Error("Neon asset integrity: " + meta.file);
      files.set(meta.file, raw);
    }));
    const json = (name) => JSON.parse(new TextDecoder().decode(files.get(name)));
    const texture = async (name) => {
      const url = URL.createObjectURL(new Blob([files.get(name)], { type: "image/png" }));
      try {
        const tex = await new T.TextureLoader().loadAsync(url); tex.colorSpace = T.SRGBColorSpace; tex.magFilter = T.NearestFilter; return tex;
      } finally { URL.revokeObjectURL(url); }
    };
    const [normal, charged, sparks] = await Promise.all([texture("textures/item/neon_arm.png"), texture("textures/item/neon_arm_charged.png"), Promise.all(["ash", "blue", "yellow"].map(async color => [color, await Promise.all(["a", "b", "c", "d"].map(frame => texture(`textures/particle/neonspark_${color}_${frame}.png`)))]))]);
    const geo = json("geo/item/neon_arm.geo.json")["minecraft:geometry"][0];
    data = { geo, renderGeo: NEON_DATA.renderGeometry(geo), clips: json("animations/item/neon_arm.animation.json").animations, slide: json("player_animations/slide.json").animations.Slide, normal, charged, sparks: Object.fromEntries(sparks) };
    NEON_EFFECTS.sparkTextures = data.sparks.blue;
    return true;
  })().catch(e => { assetError = e.message; console.warn("Neon assets", assetError); return false; });
  const oldVM = buildUltVM;
  buildUltVM = function (kind) {
    if (kind !== "neon") return oldVM.apply(this, arguments);
    const group = new T.Group(); group.name = "neon-original-arms";
    // Attach when loading finishes too, so a slow first launch never caches an empty model.
    const attach = () => {
      if (!data || group.userData.rig) return;
      const charge = { value: 0 }, material = new T.MeshStandardMaterial({ map: data.normal, alphaTest: 0.1, roughness: 0.8 });
      material.onBeforeCompile = shader => {
        shader.uniforms.neonCharged = { value: data.charged }; shader.uniforms.neonChargedAlpha = charge;
        shader.fragmentShader = 'uniform sampler2D neonCharged;\nuniform float neonChargedAlpha;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            diffuseColor *= mix(texture2D(map, vMapUv), texture2D(neonCharged, vMapUv), neonChargedAlpha);
          #endif
        `);
      };
      material.customProgramCacheKey = () => 'neon-source-charge-v1';
      const rig = BEDROCK_RIG.build(data.renderGeo, material); rig.scale.setScalar(NEON_DATA.view.scale); rig.position.fromArray(NEON_DATA.view.position);
      rig.traverse(o => { if (o.isMesh) { o.renderOrder = 999; o.frustumCulled = false; } });
      group.add(rig); group.userData.rig = rig; group.userData.charge = charge;
    };
    attach(); assetsReady.then(attach);
    group.userData.anim = (dt, ult) => {
      attach(); const rig = group.userData.rig; if (!rig || !ult) return;
      const elapsed = C.ultimateDuration - ult.t;
      let name = "Neon_ULT", time = elapsed;
      if (elapsed >= data.clips.Neon_ULT.animation_length) {
        const age = elapsed - (ult.neonLastShot ?? -100);
        if (age >= 0 && age < C.ultimateRate) { name = "Neon_ULT_Fire_Hold"; time = age; }
        else if (age >= C.ultimateRate && age < C.ultimateRate + data.clips.Neon_ULT_Fire_Recover.animation_length) { name = "Neon_ULT_Fire_Recover"; time = age - C.ultimateRate; }
        else { name = "Neon_ULT_On_Use"; time = elapsed - data.clips.Neon_ULT.animation_length; }
      }
      showPose(group, name, time);
    };
    return group;
  };
  function pose(rig, clip, time) {
    if (!clip) return;
    if (clip.animation_length) time = clip.loop === true ? time % clip.animation_length : Math.min(time, clip.animation_length);
    rig.traverse(node => {
      const b = node.userData.base; if (!b) return;
      const bone = clip.bones?.[node.name.replace("phantom-bone-", "")] || {};
      const p = NEON_DATA.position(NEON_DATA.sample(bone.position, time)), r = NEON_DATA.rotation(NEON_DATA.sample(bone.rotation, time));
      node.position.set(...p.map((v, i) => b.p[i] + v)); node.rotation.set(...r.map((v, i) => (b.r[i] + v) * rad), "ZYX");
      node.scale.fromArray(NEON_DATA.sample(bone.scale, time, [1, 1, 1]));
    });
  }
  function showPose(group, name, time) {
    pose(group.userData.rig, data.clips[name], time);
    const charged = NEON_DATA.chargedAlpha(name, time); group.userData.charge.value = charged;
    group.userData.neonMotion = { clip: name, time, charged };
  }
  let skillArms = null;
  const oldView = tickViewmodel;
  tickViewmodel = function (dt) {
    const result = oldView.apply(this, arguments);
    if (skillArms) skillArms.visible = false;
    const a = myActor() || player;
    if (!data || !a?.alive || a.agent?.id !== agent.id || !VM.current || !VM.root.visible || a.planting > 0 || a.defusing > 0) return result;
    if (a.ultW) {
      if (a.ultW.kind === 'neon') { VM.current.position.set(0, 0, 0); VM.current.rotation.set(0, 0, 0); if (VM_CAST.grp) VM_CAST.grp.visible = false; }
      return result;
    }
    let name = a.__neonClip, clip = data.clips[name], time = a.__neonClipT || 0;
    // Finish Q/C before returning to High Gear; their source clips exceed .6s.
    if (a.__neonSlide > 0 && a.__neonExitSlide) {
      name = "Neon_E when use but not run"; clip = data.clips[name]; time = C.slideDuration - a.__neonSlide;
    } else if ((!clip || time >= clip.animation_length) && a.__neonGear > 0) {
      const moving = a.vel && Math.hypot(a.vel.x, a.vel.z) > 0.3;
      name = moving ? "Neon_E_Running" : "Neon_E when use but not run"; clip = data.clips[name];
      if (a.__neonLoopClip !== name) { a.__neonLoopClip = name; a.__neonLoopT = 0; }
      time = a.__neonLoopT = (a.__neonLoopT || 0) + (dt || 0);
    } else if (!clip || time > clip.animation_length) return result;
    if (!skillArms) {
      skillArms = buildUltVM("neon"); skillArms.name = "neon-skill-arms";
      skillArms.traverse(o => { if (o.isMesh) { o.renderOrder = 999; o.frustumCulled = false; } });
    }
    if (!skillArms.userData.rig) return result;
    VM.root.add(skillArms); skillArms.visible = true; VM.current.visible = false;
    if (VM_CAST.grp) VM_CAST.grp.visible = false;
    showPose(skillArms, name, time);
    return result;
  };
  const startClip = (actor, name) => { actor.__neonOwnerKey = actor.agent?.id; actor.__neonClip = name; actor.__neonClipT = 0; actor.__neonLoopClip = null; actor.__neonLoopT = 0; };
  function gear(actor) { actor.__neonGear = C.sprintDuration; actor.__neonSlideReady = true; actor.__neonKills = 0; actor.__neonFireLatch = false; actor.__neonAds = !!actor.ads; startClip(actor, "Neon_E Ready"); }
  function slide(actor) {
    if (!actor.alive || !actor.__neonSlideReady || !(actor.__neonGear > 0 || actor.ultW?.kind === "neon") || actor.__neonSlide > 0 || actor.onGround === false) return false;
    actor.__neonSlideReady = false; actor.__neonSlide = C.slideDuration; actor.__neonSlideYaw = actor.yaw || 0;
    if (!actor.ultW) { actor.__neonGear = 0; actor.__neonExitSlide = true; }
    actor.forceCrouch = Math.max(actor.forceCrouch || 0, C.slideDuration); return true;
  }
  function clear(actor) { if (!actor) return; actor.__neonOwnerKey = null; actor.__neonGear = actor.__neonSlide = 0; actor.__neonSlideReady = false; actor.__neonKills = 0; actor.__neonClip = null; actor.__neonFireLatch = actor.__neonExitSlide = false; }
  const clearOld = clearStatus;
  clearStatus = function (actor) { clear(actor); if (actor) { actor.__neonStun = 0; actor.__neonStunClient = false; } return clearOld.apply(this, arguments); };

  function lane() {
    const actor = player, yaw = actor.yaw || 0, dx = -Math.sin(yaw), dz = -Math.cos(yaw), px = -dz, pz = dx;
    startClip(actor, "Neon_C");
    const orb = { id: actor.id, startX: actor.pos.x, startY: actor.y || 0, startZ: actor.pos.z, dirX: dx, dirZ: dz, curX: actor.pos.x, curZ: actor.pos.z };
    const preview = NEON_EFFECTS.preview(orb); scene.add(preview.root); let age = 0;
    abilSpawn({ update(dt) {
      age += dt; const length = Math.min(C.wallLength, age * C.laneSpeed);
      orb.curX = orb.startX + dx * length; orb.curZ = orb.startZ + dz * length; preview.updateAge(age);
      if (length < C.wallLength) return true;
      finalWalls(); return false;
    }, dispose() { preview.dispose(); } });
    function finalWalls() {
    for (const side of [-1, 1]) {
      const x = orb.startX + px * side * C.wallGap / 2, z = orb.startZ + pz * side * C.wallGap / 2;
      const levels = Array.from({length: C.wallLength}, (_, i) => groundAt(x + dx * (i + .5), z + dz * (i + .5), orb.startY + 3));
      for (let begin = 0; begin < levels.length;) {
      let end = begin + 1; while (end < levels.length && Math.abs(levels[end] - levels[begin]) < .5) end++;
      const wall = { startX: x + dx * begin, startY: levels[begin], startZ: z + dz * begin, endX: x + dx * end, endY: levels[begin], endZ: z + dz * end, height: C.wallHeight };
      const fx = NEON_EFFECTS.lane(wall); scene.add(fx.root);
      const blockers = [];
      for (let i = begin + .5; i < end; i += 1) {
        const mesh = new T.Group(); scene.add(mesh);
        const smoke = { x: x + dx * i, z: z + dz * i, y: wall.startY + C.wallHeight - .65, r: .65, life: C.wallDuration, maxLife: C.wallDuration, blocksVision: true, mesh };
        world.smokes.push(smoke); blockers.push(smoke);
      }
      let time = 0;
      abilSpawn({ update(dt) { time += dt; if (time >= C.wallDuration) return false; fx.updateAge(time); return true; }, dispose() { fx.dispose(); for (const s of blockers) { const i = world.smokes.indexOf(s); if (i >= 0) world.smokes.splice(i, 1); scene.remove(s.mesh); } } });
      begin = end;
      }
    }
    }
  }
  function shock(actor, point) {
    const fx = NEON_EFFECTS.shock(point); scene.add(fx.root);
    let time = 0, hit = false;
    abilSpawn({ update(dt) {
      time += dt; if (time >= 4) return false; fx.updateAge(time);
      if (hit || time < C.concussDelay) return true; hit = true;
      if (host()) for (const foe of foesOf(actor)) {
        if (Math.hypot(foe.pos.x - point.x, foe.pos.z - point.z) > C.concussRadius || Math.abs((foe.y || 0) - point.y) > 3) continue;
        if (!rayBlocked(point.x, point.y + 0.4, point.z, foe.pos.x, (foe.y || 0) + 1, foe.pos.z)) { applyConcuss(foe, C.concussDuration); foe.__neonStun = C.concussDuration; }
      }
      return true;
    }, dispose() { fx.dispose(); } });
  }
  // Projectile ray vs solid bounds. collideXZ includes a player's 2.3m headroom
  // and would make a bolt collide with ceilings far above the actual projectile.
  function boltHit(from, to) {
    if (CHASH.dirty || !CHASH.buckets) chashBuild();
    let hit = null; const seen = new Set();
    const minX = Math.floor((Math.min(from.x, to.x) - CHASH.minX) / CHASH.cell), maxX = Math.floor((Math.max(from.x, to.x) - CHASH.minX) / CHASH.cell);
    const minZ = Math.floor((Math.min(from.z, to.z) - CHASH.minZ) / CHASH.cell), maxZ = Math.floor((Math.max(from.z, to.z) - CHASH.minZ) / CHASH.cell);
    if (to.y <= 0 && from.y >= 0) hit = { t: from.y / (from.y - to.y), axis: 'y', normal: 1 };
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      if (x < 0 || z < 0 || x >= CHASH.cols || z >= CHASH.rows) continue;
      for (const c of CHASH.buckets[z * CHASH.cols + x] || []) {
        if (seen.has(c)) continue; seen.add(c);
        const candidate = NEON_DATA.rayBox(from, to, c);
        if (candidate && (!hit || candidate.t < hit.t)) hit = candidate;
      }
    }
    if (hit) hit.point = from.clone().lerp(to, hit.t);
    return hit;
  }
  function relay() {
    const actor = player, point = new T.Vector3(), velocity = new T.Vector3(), fx = NEON_EFFECTS.bolt(); scene.add(fx.root);
    let time = -C.boltDelay, bounces = 0, launched = false, bounceAt = Infinity;
    startClip(actor, "Neon_Q");
    abilSpawn({ update(dt) {
      const before = time; time += dt; if (time < 0) return true;
      if (!launched) {
        launched = true; const yaw = actor.yaw || 0, pitch = actor.pitch || 0;
        point.set(actor.pos.x, actorEye(actor), actor.pos.z);
        velocity.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(C.boltSpeed);
      }
      const travel = before < 0 ? time : dt, ticks = Math.max(1, Math.ceil(velocity.length() * travel / .2)), h = travel / ticks;
      for (let i = 0; i < ticks; i++) {
        velocity.y -= C.boltGravity * h;
        const next = point.clone().addScaledVector(velocity, h);
        const hit = boltHit(point, next);
        if (hit) {
          point.copy(hit.point); shock(actor, point.clone());
          if (bounces++ >= 1) return false;
          bounceAt = time;
          velocity[hit.axis] *= -1; point[hit.axis] += hit.normal * .002;
        } else point.copy(next);
      }
      fx.updateBolt(point, velocity, time, actor.id);
      if (bounces && time - bounceAt >= C.boltAfterBounce) { shock(actor, point.clone()); return false; }
      if (time >= C.boltLife) return false;
      return true;
    }, dispose() { fx.dispose(); } });
  }
  Object.assign(CAST_EXT, { neon_lane: lane, neon_relay: relay, neon_gear() { gear(player); }, neon_overdrive() { gear(player); startUltW(player, "neon", agent.abilities[3]); startClip(player, "Neon_ULT"); } });
  const oldFire = actorFire;
  actorFire = function (actor) {
    if (actor?.agent?.id === agent.id && !actor.ultW) {
      if (actor.__neonGear > 0) {
        if (host()) slide(actor);
        actor.__neonFireLatch = true;
        return;
      }
      if (actor.__neonSlide > 0 || actor.__neonFireLatch) return;
    }
    return oldFire.apply(this, arguments);
  };
  const oldUltFire = ultwFire;
  function beamVisual(from, to) {
    fxBolt(...from, ...to, blue, 0.1);
    fxTracer(...from, ...to, yellow);
  }
  ultwFire = function (actor) {
    const u = actor?.ultW;
    if (u?.kind !== "neon") return oldUltFire.apply(this, arguments);
    if (!actor.alive || u.cd > 0 || u.endT > 0 || actor.suppress > 0) return;
    u.cd = C.ultimateRate; actor._shotT = world._clock || 0;
    u.neonLastShot = C.ultimateDuration - u.t;
    const { o, dir, hand } = ultwAim(actor, 0, 0), ray = ultwRay(actor, o, dir, C.ultimateRange / (window.AB_D || 1), false, false, 0.08);
    const end = o.clone().addScaledVector(dir, ray.endT);
    // Visual origin follows the authored hand; damage still uses the authoritative eye ray.
    if (actor === myActor() && VM.current?.userData.rig) {
      tickViewmodel(0); const bone = VM.current.userData.rig.getObjectByName('phantom-bone-Right Arm');
      if (bone) { VM.root.updateWorldMatrix(true, true); hand.copy(bone.localToWorld(new T.Vector3(.5, -12, 0))); }
    }
    if (host() && ray.hits.length) { const hit = ray.hits[0]; ultwHurt(actor, hit.e, C.ultimateDamage, false); }
    beamVisual(hand.toArray(), end.toArray());
    if (NET.mode === "host") sendEventAll({ t: "neon-beam", a: actor.id, from: hand.toArray(), to: end.toArray() });
  };
  const oldEvent = NET.onEvent;
  NET.onEvent = function (event) {
    if (event?.t !== "neon-beam") return oldEvent && oldEvent.apply(this, arguments);
    if (host() || ![event.from, event.to].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) return;
    const actor = actorById(event.a);
    if (actor?.ultW?.kind !== "neon" || !actor.alive) return;
    actor.ultW.cd = C.ultimateRate; actor._shotT = world._clock || 0;
    actor.ultW.neonLastShot = C.ultimateDuration - actor.ultW.t;
    beamVisual(event.from, event.to);
  };
  const oldKill = killActor;
  killActor = function (victim, killer) {
    const alive = victim && victim.alive;
    const result = oldKill.apply(this, arguments);
    if (host() && alive && !victim.alive && killer && killer !== victim && (killer.agent?.id === agent.id || killer.__neonOwnerKey)) {
      killer.__neonKills = (killer.__neonKills || 0) + 1;
      if (killer.__neonKills >= C.killsPerSlide) { killer.__neonKills = 0; killer.__neonSlideReady = true; }
    }
    return result;
  };
  const oldMove = simMove;
  simMove = function (actor, dt) {
    if (actor.__neonSlide > 0 && actor.alive) {
      const input = actor.input;
      actor.input = { ...input, mv: [0, 0], btn: input.btn & ~BTN.JUMP };
      actor.vel.x = actor.vel.z = 0;
      try { return oldMove.apply(this, arguments); } finally { actor.input = input; }
    }
    if (!(actor.__neonGear > 0) || !actor.alive) return oldMove.apply(this, arguments);
    const speed = actor.speedBuff || 1; actor.speedBuff = speed * C.sprintMultiplier;
    try { return oldMove.apply(this, arguments); } finally { actor.speedBuff = speed; }
  };
  const oldModel = syncActorModel;
  syncActorModel = function (actor) {
    const m = actor.model;
    if (m && actor.__neonPose) { m.hips.position.y = actor.__neonPose.y; m.legL.leg.rotation.copy(actor.__neonPose.l); m.legR.leg.rotation.copy(actor.__neonPose.r); actor.__neonPose = null; }
    const r = oldModel.apply(this, arguments);
    if (m && actor.alive && actor.__neonSlide > 0 && data) {
      actor.__neonPose = { y: m.hips.position.y, l: m.legL.leg.rotation.clone(), r: m.legR.leg.rotation.clone() };
      const time = C.slideDuration - actor.__neonSlide, b = data.slide.bones;
      m.hips.position.y += NEON_DATA.sample(b.body.position, time)[1] / 16;
      for (const [key, limb] of [["rightLeg", m.legR], ["leftLeg", m.legL]]) if (limb) limb.leg.rotation.set(...NEON_DATA.sample(b[key].rotation, time).map(v => v * rad));
    }
    return r;
  };
  const oldCamera = followCamera;
  followCamera = function (actor, dt) {
    const r = oldCamera.apply(this, arguments);
    if (data && actor.alive && actor.__neonSlide > 0) camera.position.y += NEON_DATA.sample(data.slide.bones.body.position, C.slideDuration - actor.__neonSlide)[1] / 16;
    return r;
  };
  const oldStep = step;
  step = function (dt) {
    const result = oldStep.apply(this, arguments);
    if (world.phase === "menu" || world.phase === "end") return result;
    for (const actor of world.actors || []) {
      if (!actor.alive) { clear(actor); continue; }
      if (actor.__neonStun > 0) actor.__neonStun = Math.max(0, actor.__neonStun - dt);
      if (!host() && actor.__neonStunClient) {
        actor.concuss = Math.max(0, (actor.concuss || 0) - dt);
        if (!actor.concuss) actor.__neonStunClient = false;
      }
      if (actor.__neonOwnerKey && actor.__neonOwnerKey !== actor.agent?.id) clear(actor);
      if (actor.agent?.id !== agent.id && !actor.__neonOwnerKey) continue;
      if (!(actor.input?.btn & BTN.FIRE)) actor.__neonFireLatch = false;
      if (!host() && actor.ultW?.kind === "neon") actor.ultW.cd = Math.max(0, actor.ultW.cd - dt);
      actor.__neonClipT = (actor.__neonClipT || 0) + dt;
      actor.__neonGear = Math.max(0, (actor.__neonGear || 0) - dt);
      if (data && SETTINGS.motion !== 0 && (actor.__neonGear > 0 || actor.ultW?.kind === "neon")) {
        actor.__neonSparkT = (actor.__neonSparkT || 0) - dt;
        if (actor.__neonSparkT <= 0) {
          actor.__neonSparkT = 0.12;
          const frames = data.sparks[actor.__neonSlide > 0 ? "ash" : actor.ultW ? "yellow" : "blue"];
          const sprite = new T.Sprite(new T.SpriteMaterial({ map: frames[0], transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
          sprite.position.set(actor.pos.x, (actor.y || 0) + 0.35, actor.pos.z); sprite.scale.setScalar(0.3);
          addFx(sprite, 0.4, (s, t) => { s.material.map = frames[Math.min(3, Math.floor(t * 4))]; s.material.opacity = 1 - t; s.position.y += 0.005; });
        }
      }
      if (host()) {
        if (world.phase === 'live' && actor.ultW?.kind === 'neon' && actor.ads && !actor.__neonAds) slide(actor);
        actor.__neonAds = !!actor.ads;
        if (actor.__neonSlide > 0) {
          const move = C.slideDistance * Math.min(dt, actor.__neonSlide) / C.slideDuration;
          const count = Math.max(1, Math.ceil(move / 0.15));
          for (let i = 0; i < count; i++) {
            const x = actor.pos.x - Math.sin(actor.__neonSlideYaw) * move / count, z = actor.pos.z - Math.cos(actor.__neonSlideYaw) * move / count;
            if (collideXZ(x, z, (actor.y || 0) + 0.45, 0.28)) { actor.__neonSlide = 0; break; }
            actor.pos.x = x; actor.pos.z = z;
          }
        }
      }
      actor.__neonSlide = Math.max(0, (actor.__neonSlide || 0) - dt);
      if (!actor.__neonSlide && actor.__neonExitSlide) {
        actor.__neonExitSlide = false; actor.__neonGear = 0; actor.__neonClip = null;
      }
    }
    return result;
  };
  // Authoritative timers also recover on reconnect, without replaying a cast or damage.
  const oldBuild = buildSnapshot, oldApply = applySnapshot;
  buildSnapshot = function () {
    const snapshot = oldBuild.apply(this, arguments);
    snapshot.neon = (world.actors || []).filter(a => a.agent?.id === agent.id || a.__neonOwnerKey).map(a => [a.id, a.__neonGear || 0, a.__neonSlide || 0, !!a.__neonSlideReady, a.ultW?.kind === "neon" ? a.ultW.t : 0]);
    snapshot.neonStun = (world.actors || []).filter(a => a.__neonStun > 0).map(a => [a.id, Math.min(a.__neonStun, a.concuss || 0)]);
    return snapshot;
  };
  applySnapshot = function (snapshot) {
    const r = oldApply.apply(this, arguments);
    for (const row of snapshot.neon || []) {
      const a = actorById(row[0]); if (!a) continue;
      a.__neonOwnerKey = a.agent?.id;
      a.__neonGear = row[1]; a.__neonSlide = row[2]; a.__neonSlideReady = row[3];
      a.__neonExitSlide = row[2] > 0 && !row[1] && !row[4];
      if (row[2] > 0) a.forceCrouch = Math.max(a.forceCrouch || 0, row[2]);
      if (row[4] > 0) { if (a.ultW?.kind !== "neon") startUltW(a, "neon", agent.abilities[3]); a.ultW.t = row[4]; }
      else if (a.ultW?.kind === "neon") endUltW(a);
    }
    for (const [id, time] of snapshot.neonStun || []) {
      const a = actorById(id); if (!a || !a.alive) continue;
      if (time > 0 && !(a.concuss > 0)) applyConcuss(a, time);
      a.__neonStun = time; a.concuss = Math.max(a.concuss || 0, time); if (time > 0) a.__neonStunClient = true;
    }
    return r;
  };
  const roster = document.getElementById("title-roster");
  if (roster) { GAME_PORTRAITS.clear(roster); roster.innerHTML = ""; renderTitleRoster(); }
  window.NEON_AGENT = { agent, config: C, assetsReady, ready: () => !!data, error: () => assetError, sourceSkin: () => data?.normal, slide, pose, clear, boltHit };
})();
