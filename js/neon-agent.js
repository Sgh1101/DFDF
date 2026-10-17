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
      A("Q", "릴레이볼트", "neon_relay", 200, 2, 0, "한 번 튕기는 전기탄. 첫 충돌과 마지막 착탄 지점에 충전 후 반경 3.5m, 3초 뇌진탕을 일으킵니다. 벽 너머의 적에게는 닿지 않습니다."),
      A("E", "고속기어", "neon_gear", 0, 1, 30, "10초간 이동 속도 +40%. 우클릭(모바일 조준)으로 6m 슬라이딩 1회. 사격하면 질주는 끝납니다. 처치 2회마다 슬라이딩이 충전됩니다."),
      A("C", "추월차선", "neon_lane", 300, 1, 0, "전방 최대 30m에 6초간 나란한 전기 장벽 두 개를 펼쳐 양옆 시야를 가립니다. 가운데 통로로 이동·사격할 수 있습니다."),
      A("X", "오버드라이브", "neon_overdrive", 0, 1, 0, "20초 동안 총 대신 손끝에서 40m 전기 빔을 발사합니다. 0.1초당 피해 18. 질주와 슬라이딩을 다시 사용할 수 있습니다.", 7),
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

  // Full-body adaptation: the mod supplies only the arms, not a whole character.
  const K = CH_KIT, { HAIR, TOP, LIMB, M, GL, L } = K;
  const design = {
    st: { w: 0.88, bulk: 0.88, skin: 0xc78c61, hair: 0x1d3c9b, eye: 0x493127, coat: 0x142c65, trim: yellow },
    base: { top: 0x142c65, sleeve: L(0xc78c61, "skin"), fore: L(0xc78c61, "skin"), hand: L(0x19304f), pants: 0x102343, boot: L(0x122446) },
    make(x) {
      HAIR.short(x, 0x1744a0);
      for (const side of [-1, 1]) {
        // Two swept electric-blue tails with yellow tips.
        x.add(x.neck, G_CONE(0.05, 0.3, 10), M(0x245be5, "hair"), side * 0.115, 0.29, 0.2, { r: [1.6, 0, side * -0.45] });
        x.add(x.neck, G_CONE(0.027, 0.12, 8), M(yellow, "hair"), side * 0.17, 0.24, 0.34, { r: [1.9, 0, side * -0.45] });
        x.add(x.neck, G_SPH(0.012, 8, 6), GL(yellow), side * 0.112, 0.18, -0.01);
      }
      TOP.belt(x, 0x172b4c, { buckle: yellow }); LIMB.tallBoots(x, 0x172b4c);
      for (const side of [-1, 1]) {
        const fore = side < 0 ? x.armL.fore : x.armR.fore;
        x.add(fore, G_TOR(0.047, 0.008, 6, 12), GL(blue), 0, -0.11, 0, { r: [Math.PI / 2, 0, 0] });
        x.add(x.chest, G_BOX(0.025, 0.26, 0.015), GL(blue, 0.7), side * 0.106, 0.18, -0.123, { r: [0, 0, side * 0.3] });
      }
      x.add(x.chest, G_BOX(0.06, 0.08, 0.015), M(yellow), 0, 0.31, -0.14, { r: [0, 0, -0.35] });
    },
  };
  CH_DESIGN[agent.id] = design; CH_STYLE[agent.id] = { ...CH_STYLE._default, ...design.st }; CH_BASE_EXTRA[agent.id] = design.base;
  CH_OUTFIT[agent.id] = (x) => {
    CH_LOOK.body(x, design); design.make(x);
    [x.hips, x.chest, x.neck, x.armL.arm, x.armL.fore, x.armR.arm, x.armR.fore, x.legL.leg, x.legL.shin, x.legR.leg, x.legR.shin].forEach(CH_LOOK.flatten);
  };
  if (window.CH_PAINTKIT) {
    const { PAINT, cap, bangs, rgb } = CH_PAINTKIT;
    PAINT[agent.id] = {
      back(c) { c.glow(blue, 0.7); c.line([c.Q(-2, 3), c.Q(-1.6, 0), c.Q(0.3, -1), c.Q(2, -2)], rgb(blue, 1.2), c.u * 0.16); c.noglow(); },
      body(c) { c.poly([c.Q(-0.9, -0.35), c.Q(0.9, -0.35), c.Q(3.3, 3.2), c.Q(-3.3, 3.2)], "#142c65"); for (const s of [-1, 1]) c.line([c.Q(s * 0.7, 0), c.Q(s * 0.5, 1), c.Q(s * 1.2, 3)], "#41cfff", c.u * 0.12); },
      hair(c) { cap(c, 0x1744a0, 0.2); bangs(c, 0x245be5, { n: 7, zig: 1, tilt: -0.18 }); for (const s of [-1, 1]) { c.poly([c.P(s * 0.8, -0.6), c.P(s * 1.3, -0.7), c.P(s * 1.6, 0.5), c.P(s * 1.05, 0.1)], "#245be5"); c.poly([c.P(s * 1.5, 0.05), c.P(s * 1.6, 0.5), c.P(s * 1.3, 0.25)], "#f7ef69"); } c.line([c.P(-0.3, -0.9), c.P(-0.5, -0.25)], "#f7ef69", c.u * 0.11); },
    };
  }

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
    data = { geo: json("geo/item/neon_arm.geo.json")["minecraft:geometry"][0], clips: json("animations/item/neon_arm.animation.json").animations, slide: json("player_animations/slide.json").animations.Slide, normal, charged, sparks: Object.fromEntries(sparks) };
    return true;
  })().catch(e => { assetError = e.message; console.warn("Neon assets", assetError); return false; });
  const oldVM = buildUltVM;
  buildUltVM = function (kind) {
    if (kind !== "neon") return oldVM.apply(this, arguments);
    const group = new T.Group(); group.name = "neon-original-arms";
    // Attach when loading finishes too, so a slow first launch never caches an empty model.
    const attach = () => {
      if (!data || group.userData.rig) return;
      const material = new T.MeshStandardMaterial({ map: data.charged, emissive: blue, emissiveMap: data.charged, emissiveIntensity: 0.35, alphaTest: 0.1, roughness: 0.8 });
      const rig = BEDROCK_RIG.build(data.geo, material); rig.scale.setScalar(0.035); rig.position.set(0, -0.45, -0.75); group.add(rig); group.userData.rig = rig;
    };
    attach(); assetsReady.then(attach);
    group.userData.anim = (dt, ult) => {
      attach(); const rig = group.userData.rig; if (!rig || !ult) return;
      const elapsed = C.ultimateDuration - ult.t;
      const name = elapsed < 1.45 ? "Neon_ULT" : ult.cd > 0.01 ? "Neon_ULT_Fire_Hold" : "Neon_ULT_On_Use";
      pose(rig, data.clips[name], name === "Neon_ULT" ? elapsed : 1);
    };
    return group;
  };
  function pose(rig, clip, time) {
    if (!clip) return;
    for (const node of rig.children) {
      const bone = clip.bones[node.name.replace("phantom-bone-", "")], b = node.userData.base;
      if (!bone || !b) continue;
      const p = NEON_DATA.sample(bone.position, time), r = NEON_DATA.sample(bone.rotation, time);
      node.position.set(...p.map((v, i) => b.p[i] + v)); node.rotation.set(...r.map(v => v * rad), "ZYX");
    }
  }
  let skillArms = null;
  const oldView = tickViewmodel;
  tickViewmodel = function (dt) {
    const result = oldView.apply(this, arguments);
    if (skillArms) skillArms.visible = false;
    const a = myActor() || player;
    if (!data || !a?.alive || a.agent?.id !== agent.id || a.ultW || !VM.current || !VM.root.visible || a.planting > 0 || a.defusing > 0) return result;
    let clip = data.clips[a.__neonClip], time = a.__neonClipT || 0;
    if (a.__neonGear > 0 && time > 0.6) {
      const moving = a.vel && Math.hypot(a.vel.x, a.vel.z) > 0.3;
      clip = data.clips[moving ? "Neon_E_Running" : "Neon_E when use but not run"];
      time = moving ? time % clip.animation_length : clip.animation_length;
    } else if (!clip || time > clip.animation_length) return result;
    if (!skillArms) {
      skillArms = buildUltVM("neon"); skillArms.name = "neon-skill-arms";
      skillArms.traverse(o => { if (o.isMesh) { o.renderOrder = 999; o.frustumCulled = false; } });
    }
    if (!skillArms.userData.rig) return result;
    VM.root.add(skillArms); skillArms.visible = true; VM.current.visible = false;
    const rig = skillArms.userData.rig;
    rig.children.forEach(b => b.children.forEach(m => { if (m.isMesh) { m.material.map = data.normal; m.material.emissiveIntensity = 0; } }));
    pose(rig, clip, time);
    return result;
  };
  const startClip = (actor, name) => { actor.__neonOwnerKey = actor.agent?.id; actor.__neonClip = name; actor.__neonClipT = 0; };
  function gear(actor) { actor.__neonGear = C.sprintDuration; actor.__neonSlideReady = true; actor.__neonKills = 0; actor.__neonAds = !!actor.ads; startClip(actor, "Neon_E Ready"); }
  function slide(actor) {
    if (!actor.alive || !actor.__neonSlideReady || !(actor.__neonGear > 0 || actor.ultW?.kind === "neon") || actor.__neonSlide > 0 || actor.onGround === false) return false;
    actor.__neonSlideReady = false; actor.__neonSlide = C.slideDuration; actor.__neonSlideYaw = actor.yaw || 0;
    actor.forceCrouch = Math.max(actor.forceCrouch || 0, C.slideDuration); return true;
  }
  function clear(actor) { if (!actor) return; actor.__neonOwnerKey = null; actor.__neonGear = actor.__neonSlide = 0; actor.__neonSlideReady = false; actor.__neonKills = 0; actor.__neonClip = null; }
  const clearOld = clearStatus;
  clearStatus = function (actor) { clear(actor); if (actor) { actor.__neonStun = 0; actor.__neonStunClient = false; } return clearOld.apply(this, arguments); };

  function lane() {
    const actor = player, yaw = actor.yaw || 0, dx = -Math.sin(yaw), dz = -Math.cos(yaw), px = -dz, pz = dx;
    startClip(actor, "Neon_C");
    for (const side of [-1, 1]) {
      const x = actor.pos.x + px * side * C.wallGap / 2, z = actor.pos.z + pz * side * C.wallGap / 2;
      let length = 0;
      while (length < C.wallLength && !collideXZ(x + dx * (length + 0.25), z + dz * (length + 0.25), (actor.y || 0) + 1.2, 0.12)) length += 0.25;
      if (!length) continue;
      const wall = new T.Mesh(new T.PlaneGeometry(length, 3), new T.MeshBasicMaterial({ color: blue, side: T.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
      wall.name = "neon-fastlane"; wall.position.set(x + dx * length / 2, (actor.y || 0) + 1.5, z + dz * length / 2); wall.rotation.y = Math.atan2(-dz, dx); scene.add(wall);
      const blockers = [];
      for (let i = 0.5; i < length; i += 1) {
        const mesh = new T.Group(); scene.add(mesh);
        const smoke = { x: x + dx * i, z: z + dz * i, y: (actor.y || 0) + 1.5, r: 0.65, life: C.wallDuration, maxLife: C.wallDuration, blocksVision: true, mesh };
        world.smokes.push(smoke); blockers.push(smoke);
      }
      let time = 0;
      abilSpawn({ update(dt) { time += dt; wall.material.opacity = 0.9 * Math.min(1, (C.wallDuration - time) / 0.5); return time < C.wallDuration; }, dispose() { scene.remove(wall); wall.geometry.dispose(); wall.material.dispose(); for (const s of blockers) { const i = world.smokes.indexOf(s); if (i >= 0) world.smokes.splice(i, 1); scene.remove(s.mesh); } } });
    }
  }
  function shock(actor, point) {
    const g = new T.Mesh(new T.RingGeometry(C.concussRadius - 0.15, C.concussRadius, 36), new T.MeshBasicMaterial({ color: yellow, side: T.DoubleSide, transparent: true, depthWrite: false }));
    g.rotation.x = -Math.PI / 2; g.position.set(point.x, Math.max(0.06, point.y - 0.2), point.z); scene.add(g);
    let time = 0;
    abilSpawn({ update(dt) {
      time += dt; g.material.opacity = 0.5 + 0.4 * Math.sin(time * 20);
      if (time < 0.7) return true;
      if (host()) for (const foe of foesOf(actor)) {
        if (Math.hypot(foe.pos.x - point.x, foe.pos.z - point.z) > C.concussRadius || Math.abs((foe.y || 0) - point.y) > 3) continue;
        if (!rayBlocked(point.x, point.y + 0.4, point.z, foe.pos.x, (foe.y || 0) + 1, foe.pos.z)) { applyConcuss(foe, C.concussDuration); foe.__neonStun = C.concussDuration; }
      }
      fxRing(point.x, point.z, C.concussRadius, blue, 0.4); return false;
    }, dispose() { scene.remove(g); g.geometry.dispose(); g.material.dispose(); } });
  }
  function relay() {
    const actor = player, yaw = actor.yaw || 0, pitch = actor.pitch || 0;
    const point = new T.Vector3(actor.pos.x, (actor.y || 0) + 1.4, actor.pos.z);
    const velocity = new T.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(C.boltSpeed);
    const orb = glowDot(blue, 0.3, 2); orb.name = "neon-relaybolt"; orb.position.copy(point); scene.add(orb); orb.visible = false;
    let time = -C.boltDelay, bounces = 0;
    startClip(actor, "Neon_Q");
    abilSpawn({ update(dt) {
      time += dt; if (time < 0) return true; orb.visible = true;
      const ticks = Math.max(1, Math.ceil(velocity.length() * dt / 0.2)), h = dt / ticks;
      for (let i = 0; i < ticks; i++) {
        velocity.y -= C.boltGravity * h;
        const next = point.clone().addScaledVector(velocity, h);
        const floor = groundAt(next.x, next.z, point.y), ground = Number.isFinite(floor) ? floor : 0;
        const wall = collideXZ(next.x, next.z, next.y, 0.08), landed = next.y <= ground + 0.1;
        if (wall || landed) {
          shock(actor, point.clone());
          if (bounces++ >= 1) return false;
          if (landed) { point.y = ground + 0.12; velocity.y = Math.max(5, Math.abs(velocity.y)); }
          else {
            const hitX = collideXZ(next.x, point.z, point.y, 0.08), hitZ = collideXZ(point.x, next.z, point.y, 0.08);
            if (hitX || !hitZ) velocity.x *= -1; if (hitZ || !hitX) velocity.z *= -1;
          }
        } else point.copy(next);
      }
      orb.position.copy(point);
      if (time >= C.boltLife) { shock(actor, point.clone()); return false; }
      return true;
    }, dispose() { scene.remove(orb); orb.material.dispose(); } });
  }
  Object.assign(CAST_EXT, { neon_lane: lane, neon_relay: relay, neon_gear() { gear(player); }, neon_overdrive() { gear(player); startUltW(player, "neon", agent.abilities[3]); startClip(player, "Neon_ULT"); } });
  const oldFire = actorFire;
  actorFire = function (actor) {
    if (actor?.__neonGear > 0 && !actor.ultW) { actor.__neonGear = 0; if (actor.__neonClip?.startsWith("Neon_E")) actor.__neonClip = null; }
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
    const { o, dir, hand } = ultwAim(actor, 0, 0), ray = ultwRay(actor, o, dir, C.ultimateRange / (window.AB_D || 1), false, false, 0.08);
    const end = o.clone().addScaledVector(dir, ray.endT);
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
        if (world.phase === "live" && actor.ads && !actor.__neonAds) slide(actor);
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
  window.NEON_AGENT = { agent, config: C, assetsReady, ready: () => !!data, error: () => assetError, slide, pose, clear };
})();
