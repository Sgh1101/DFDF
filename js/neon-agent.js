(() => {
  "use strict";
  // 네온 (Neon): a striker made of speed and current. Everything here is this game's own: the look, the portrait, the
  // first-person arms and their motions, the icons, the bolt, charge, lane and spark effects, the slide pose. Only what
  // the four abilities do (and their numbers) follows the reference the owner supplied.
  if (AGENTS.some((a) => a.id === "neon_agent")) return;
  // what the abilities do: sprint, slide, lane walls, the bouncing bolt and its charges, the ultimate beam
  const C = Object.freeze({
    sprintMultiplier: 1.4, sprintDuration: 10, slideDistance: 6, slideDuration: 0.8333, killsPerSlide: 2,
    wallLength: 25, wallHeight: 4, wallDuration: 4, wallGap: 2.4, laneSpeed: 62.5,
    boltSpeed: 38, boltGravity: 4.8, boltLife: 2.25, boltAfterBounce: 0.75, boltDelay: 0.35,
    concussDelay: 0.8, concussRadius: 5, concussDuration: 2.5,
    ultimateDuration: 20, ultimateRange: 40, ultimateDamage: 18, ultimateRate: 0.1,
  });
  const CYAN = 0x41cfff, YELLOW = 0xf7ef69, NAVY = 0x1d2b4f;
  const host = () => NET.mode !== "client";
  const A = (key, name, type, cost, charges, cd, desc, ult) => ({ key, name, type, cost, charges, cd, desc, _rs: 1, ...(ult ? { ult } : {}) });
  const agent = {
    id: "neon_agent", key: "neon_agent", name: "네온", role: "타격대", color: "#41cfff", accent: "#f7ef69",
    quote: "멈추면 지는 거야.",
    desc: "몸에 전류를 두른 배달원 출신 돌격수. 튕기는 전격탄으로 길을 열고, 전류 통로를 깔고, 질주와 미끄러지기로 누구보다 먼저 닿는다.",
    abilities: [
      A("Q", "되튐 전격", "neon_relay", 200, 2, 0, "한 번 튕기는 전기탄. 닿는 곳마다 0.8초 뒤 반경 5m에 전기가 터져 2.5초 뇌진탕. 벽 너머의 적에게는 닿지 않는다."),
      A("E", "질주 회로", "neon_gear", 0, 1, 30, "10초간 이동 속도 +40%. 좌클릭(모바일 사격)으로 6m 미끄러지며 질주를 끝내고 무기로 돌아온다. 처치 2회마다 미끄러지기가 다시 찬다."),
      A("C", "전류 통로", "neon_lane", 300, 1, 0, "앞으로 최대 25m, 높이 4m 전류 벽 두 개를 깔아 4초간 양옆 시야를 막는다. 가운데 2.4m 통로로 지나가며 쏠 수 있다."),
      A("X", "과충전", "neon_overdrive", 0, 1, 0, "20초 동안 총 대신 손끝에서 40m 전기 빔을 쏜다. 0.1초마다 피해 18. 궁극기 중 좌클릭은 빔, 우클릭은 미끄러지기.", 7),
    ],
  };
  AGENTS.push(agent);

  // ── icons: our own line drawings in the game's icon style ──
  Object.assign(AB_ICON_PATH, {
    neonRelay: "M13 2 6 12h5l-1.5 6L17 8.5h-5L15 2zM3 21q3-4 6 0",
    neonGear: "M3 6l6 6-6 6M10 6l6 6-6 6M17 8l3 4-3 4",
    neonLane: "M4 3v18M20 3v18M12 20V7M8.5 10.5 12 7l3.5 3.5",
    neonOverdrive: "M3 13h4l2-5 3 10 2.5-7 1.5 2H21M19 10l2 3-2 3",
  });
  Object.assign(AB_ICON_OF, { neon_relay: "neonRelay", neon_gear: "neonGear", neon_lane: "neonLane", neon_overdrive: "neonOverdrive" });
  Object.assign(CAST_STYLE_OF, { neon_relay: "throw", neon_lane: "sweep", neon_gear: "aura" });
  ULTW.neon = { name: "과충전", color: CYAN, glow: "#41cfff", dur: C.ultimateDuration, ammo: 0, rate: C.ultimateRate, auto: true, aiRange: C.ultimateRange };
  ULTW_OF.neon_overdrive = "neon";

  // ── the look: a courier in a navy track jacket with current in its seams, a silver bob with a cyan streak, a visor,
  // gloves with glowing knuckles, yellow knee pads and runners ──
  const K = window.CH_KIT, PK = window.CH_PAINTKIT;
  if (K && window.CH_DESIGN && "undefined" != typeof CH_OUTFIT) {
    const { HAIR, HEAD, TOP, LIMB, M, GL, L } = K;
    const SILVER = 0xdfe9f5, DARK = 0x22252e;
    const D = {
      st: { w: 0.88, bulk: 0.88, skin: 0xe7c09b, hair: SILVER, eye: 0x2f6f9a, coat: NAVY, trim: CYAN },
      base: { top: NAVY, sleeve: L(NAVY), fore: L(NAVY), hand: L(DARK, "leather"), pants: DARK, boot: L(0xf2f2ee, "rubber") },
      make(x) {
        HAIR.bob(x, SILVER);
        // a cyan streak over one eye
        x.add(x.neck, G_BOX(0.03, 0.12, 0.02), GL(CYAN, 1.1), -0.07, 0.25, -0.128, { r: [0.2, 0, 0.35] });
        HEAD.arVisor(x, CYAN);
        TOP.jacket(x, NAVY, { cropped: !0, shirt: YELLOW, collar: CYAN });
        // current in the seams: glowing lines down the jacket and along each sleeve
        [-1, 1].forEach((s) => x.add(x.chest, G_BOX(0.012, 0.24, 0.01), GL(CYAN, 1.6), s * 0.14, 0.24, -0.128, { r: [0, 0, s * -0.08] }));
        [x.armL, x.armR].forEach((Ar) => x.add(Ar.arm, G_BOX(0.014, 0.22, 0.012), GL(CYAN, 1.5), 0, -0.13, -0.058));
        LIMB.gauntlets(x, DARK, { kind: "leather", glow: CYAN });
        LIMB.kneePads(x, YELLOW);
        TOP.belt(x, DARK, { buckle: YELLOW, h: 0.05 });
        // a small battery on the back, lit
        x.add(x.chest, G_BOX(0.16, 0.2, 0.07), M(DARK, "metal"), 0, 0.22, 0.16);
        x.add(x.chest, G_BOX(0.12, 0.03, 0.074), GL(YELLOW, 1.4), 0, 0.27, 0.162);
      },
    };
    window.CH_DESIGN.neon_agent = D;
    CH_STYLE.neon_agent = Object.assign({}, CH_STYLE._default || {}, D.st);
    CH_BASE_EXTRA.neon_agent = { ...D.base };
    CH_OUTFIT.neon_agent = function (x) {
      CH_LOOK.body(x, D);
      D.make(x);
      [x.hips, x.chest, x.neck, x.armL.arm, x.armL.fore, x.armR.arm, x.armR.fore, x.legL.leg, x.legL.shin, x.legR.leg, x.legR.shin].forEach(CH_LOOK.flatten);
    };
  }
  if (PK) {
    const { PAINT, rgb, cap, bangs, jacket, collar } = PK;
    PAINT.neon_agent = {
      back(C) {
        // two bolts of current behind the shoulders
        C.glow(CYAN, 0.9);
        for (const s of [-1, 1]) C.line([C.Q(s * 2.6, -2.6), C.Q(s * 1.7, -1.4), C.Q(s * 2.4, -1.1), C.Q(s * 1.5, 0.2)], rgb(CYAN, 1.3), 0.14 * C.u);
        C.noglow();
      },
      body(C) {
        C.poly([C.Q(-0.95, -0.35), C.Q(0.95, -0.35), C.Q(3.3, 3.2), C.Q(-3.3, 3.2)], rgb(NAVY, 1.05));
        jacket(C, { shirt: YELLOW, lapel: 0x14203d, trim: CYAN, glow: !0 });
      },
      collar(C) { collar(C, CYAN, 0.42); },
      hair(C) {
        cap(C, 0xdfe9f5, 0.3);
        bangs(C, 0xdfe9f5, { n: 7, lo: -0.28, hi: -0.46, tilt: 0.25 });
        C.glow(CYAN, 0.6);
        C.line([C.P(-0.55, -0.85), C.P(-0.35, -0.3)], rgb(CYAN, 1.3), 0.12 * C.u);
        C.noglow();
      },
      head(C) {
        // the visor across the eyes
        C.glow(CYAN, 0.7);
        C.rr(...C.P(-0.86, -0.12), 1.72 * C.u, 0.3 * C.u, 0.14 * C.u, rgb(CYAN, 1.15));
        C.noglow();
      },
    };
  }

  // ── first-person arms: navy sleeves, dark gloves, current along the forearm and at the knuckles. Each arm rises from
  // below the bottom of the screen to a hand about half a metre in front of the eye ──
  const ARM_BASE = { y: -0.39, z: -0.17, x: 0.25, rx: 0.5, ry: 0.25 };
  function buildArms(name) {
    const group = new T.Group(); group.name = name; group.userData.neonArms = true;
    const sleeve = new T.MeshStandardMaterial({ color: NAVY, roughness: 0.7 }), glove = new T.MeshStandardMaterial({ color: 0x22252e, roughness: 0.55, metalness: 0.15 });
    const glow = new T.MeshBasicMaterial({ color: CYAN, toneMapped: false }), knuck = new T.MeshBasicMaterial({ color: CYAN, toneMapped: false }), hot = new T.MeshBasicMaterial({ color: YELLOW, transparent: true, opacity: 0, toneMapped: false, blending: T.AdditiveBlending, depthWrite: false });
    const mesh = (geo, mat, p, parent) => { const m = new T.Mesh(geo, mat); m.position.set(...p); m.renderOrder = 999; m.frustumCulled = false; parent.add(m); return m; };
    const arms = {};
    for (const s of [-1, 1]) {
      const root = new T.Group();
      const fore = new T.Group(); root.add(fore);
      mesh(new T.BoxGeometry(0.078, 0.078, 0.32), sleeve, [0, 0, -0.14], fore);
      // two thin seams of current along the top of the sleeve and a lit cuff
      for (const o of [-0.022, 0.022]) mesh(new T.BoxGeometry(0.006, 0.004, 0.22), glow, [o, 0.04, -0.16], fore);
      mesh(new T.CylinderGeometry(0.043, 0.043, 0.008, 12).rotateX(Math.PI / 2), glow, [0, 0, -0.3], fore);
      const hand = new T.Group(); hand.position.set(0, 0, -0.345); fore.add(hand);
      mesh(new T.BoxGeometry(0.072, 0.045, 0.075), glove, [0, 0, 0], hand);
      for (let i = 0; i < 4; i++) {
        mesh(new T.BoxGeometry(0.014, 0.017, 0.052), glove, [(i - 1.5) * 0.0175, 0.004, -0.062], hand);
        mesh(new T.SphereGeometry(0.0045, 6, 4), knuck, [(i - 1.5) * 0.0175, 0.023, -0.032], hand);
      }
      mesh(new T.BoxGeometry(0.017, 0.018, 0.045), glove, [s * -0.038, -0.004, -0.024], hand).rotation.y = s * 0.5;
      const tip = new T.Object3D(); tip.name = s > 0 ? "neon-hand-r-tip" : "neon-hand-l-tip"; tip.position.set(0, 0, -0.1); hand.add(tip);
      const flare = mesh(new T.SphereGeometry(0.018, 10, 8), hot, [0, 0, -0.095], hand);
      group.add(root);
      arms[s > 0 ? "r" : "l"] = { root, fore, hand, flare, s };
    }
    group.userData.arms = arms; group.userData.glow = knuck; group.userData.hot = hot;
    poseArms(group, "ult", 0, false, -1);
    return group;
  }
  const ease = (t) => t * t * (3 - 2 * t), clamp01 = (t) => Math.max(0, Math.min(1, t));
  // a pose for each moment: what the arms do on a throw, a sweep, while sprinting or standing ready, and in the ultimate
  // (offsets from the resting arm: dx dy dz in metres, rx ry in radians)
  function poseArms(group, clip, time, moving, shotAge) {
    const { l, r } = group.userData.arms;
    const set = (a, dx, dy, dz, rx, ry) => {
      a.root.position.set(a.s * ARM_BASE.x + dx, ARM_BASE.y + dy, ARM_BASE.z + dz);
      a.fore.rotation.set(ARM_BASE.rx + rx, a.s * ARM_BASE.ry + ry, 0);
    };
    let charge = 0;
    if (clip === "relay") {
      // wind back, then snap forward and open the hand
      const back = time < 0.25 ? ease(time / 0.25) : 1 - ease(clamp01((time - 0.25) / 0.18));
      set(r, 0.02, 0.05 * back, 0.1 * back, 0.35 * back, -0.15 * back);
      set(l, -0.03, -0.08, 0.04, -0.15, 0);
      charge = time < 0.35 ? 1 : clamp01(1 - (time - 0.35) / 0.25);
    } else if (clip === "lane") {
      // both hands together in front, then swept apart as the walls go out
      const k = ease(clamp01(time / 0.45));
      set(r, -0.08 + 0.1 * k, 0.03, -0.03, 0.05, 0.2 - 0.5 * k);
      set(l, 0.08 - 0.1 * k, 0.03, -0.03, 0.05, -0.2 + 0.5 * k);
      charge = 1 - clamp01((time - 0.4) / 0.3);
    } else if (clip === "run" || clip === "ready") {
      // sprinting: arms pumping; standing in the sprint: fists up, bouncing
      const w = clip === "run" && moving ? Math.sin(time * 11) : 0.15 * Math.sin(time * 5);
      set(r, 0, -0.03 + 0.04 * w, 0.06 * w, 0.25 * w, 0);
      set(l, 0, -0.03 - 0.04 * w, -0.06 * w, -0.25 * w, 0);
      charge = 0.35 + 0.15 * Math.sin(time * 8);
    } else {
      // the ultimate: the right hand out in front, the left braced lower; a shot pushes the right hand and lights it
      const kick = shotAge >= 0 && shotAge < 0.1 ? 1 - shotAge / 0.1 : 0;
      set(r, -0.05, 0.02, -0.03 + 0.03 * kick, 0.08 - 0.08 * kick, 0.1);
      set(l, 0.01, -0.07, 0.03, -0.1, 0);
      charge = 0.5 + 0.5 * kick;
    }
    // the knuckles turn yellow and a spark shows at the fingertips only at the peak: a throw, a sweep, a shot
    const peak = clamp01((charge - 0.8) / 0.2);
    group.userData.hot.opacity = 0.7 * peak;
    group.userData.glow.color.setHex(charge > 0.85 ? YELLOW : CYAN);
    r.flare.scale.setScalar(0.5 + peak); l.flare.visible = false;
    group.userData.neonMotion = { clip, time, charged: charge };
  }

  // NoSound reference: our own cast sounds play as for every other agent.
  CH_STYLE[agent.id] = CH_STYLE[agent.id] || { ...CH_STYLE._default, w: 0.88, bulk: 0.88 };

  const oldVM = buildUltVM;
  buildUltVM = function (kind) {
    if (kind !== "neon") return oldVM.apply(this, arguments);
    const group = buildArms("neon-arms");
    group.userData.anim = (dt, ult) => {
      if (!ult) return;
      const elapsed = C.ultimateDuration - ult.t, shotAge = elapsed - (ult.neonLastShot ?? -100);
      poseArms(group, "ult", elapsed, false, shotAge);
    };
    return group;
  };
  let skillArms = null;
  const oldView = tickViewmodel;
  tickViewmodel = function (dt) {
    const result = oldView.apply(this, arguments);
    if (skillArms) skillArms.visible = false;
    const a = myActor() || player;
    if (!a?.alive || a.agent?.id !== agent.id || !VM.current || !VM.root.visible || a.planting > 0 || a.defusing > 0) return result;
    if (a.ultW) {
      if (a.ultW.kind === "neon") { VM.current.position.set(0, 0, 0); VM.current.rotation.set(0, 0, 0); if (VM_CAST.grp) VM_CAST.grp.visible = false; }
      return result;
    }
    const moving = a.vel && Math.hypot(a.vel.x, a.vel.z) > 0.3;
    let clip = a.__neonClip, time = a.__neonClipT || 0;
    const shortClip = (clip === "relay" || clip === "lane") && time < 0.65;
    if (!shortClip) {
      if (!(a.__neonGear > 0) && !(a.__neonSlide > 0)) return result;
      clip = moving ? "run" : "ready"; time = a.__neonLoopT = (a.__neonLoopT || 0) + (dt || 0);
    }
    if (!skillArms) skillArms = buildArms("neon-skill-arms");
    VM.root.add(skillArms); skillArms.visible = true; VM.current.visible = false;
    if (VM_CAST.grp) VM_CAST.grp.visible = false;
    poseArms(skillArms, clip, time, moving, -1);
    return result;
  };
  const startClip = (actor, name) => { actor.__neonOwnerKey = actor.agent?.id; actor.__neonClip = name; actor.__neonClipT = 0; actor.__neonLoopT = 0; };
  function gear(actor) { actor.__neonGear = C.sprintDuration; actor.__neonSlideReady = true; actor.__neonKills = 0; actor.__neonFireLatch = false; actor.__neonAds = !!actor.ads; startClip(actor, "ready"); }
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
    startClip(actor, "lane");
    const orb = { id: actor.id, startX: actor.pos.x, startY: actor.y || 0, startZ: actor.pos.z, dirX: dx, dirZ: dz, curX: actor.pos.x, curZ: actor.pos.z };
    const preview = NEON_EFFECTS.preview(orb, C.wallGap); scene.add(preview.root); let age = 0;
    abilSpawn({ update(dt) {
      age += dt; const length = Math.min(C.wallLength, age * C.laneSpeed);
      orb.curX = orb.startX + dx * length; orb.curZ = orb.startZ + dz * length; preview.updateAge(age);
      if (length < C.wallLength) return true;
      finalWalls(); return false;
    }, dispose() { preview.dispose(); } });
    function finalWalls() {
      for (const side of [-1, 1]) {
        const x = orb.startX + px * side * C.wallGap / 2, z = orb.startZ + pz * side * C.wallGap / 2;
        const levels = Array.from({ length: C.wallLength }, (_, i) => groundAt(x + dx * (i + 0.5), z + dz * (i + 0.5), orb.startY + 3));
        // the wall follows the ground in pieces of one level each
        for (let begin = 0; begin < levels.length;) {
          let end = begin + 1; while (end < levels.length && Math.abs(levels[end] - levels[begin]) < 0.5) end++;
          const wall = { startX: x + dx * begin, startY: levels[begin], startZ: z + dz * begin, endX: x + dx * end, endY: levels[begin], endZ: z + dz * end, height: C.wallHeight };
          const fx = NEON_EFFECTS.lane(wall, 0, C.wallDuration); scene.add(fx.root);
          const blockers = [];
          for (let i = begin + 0.5; i < end; i += 1) {
            const mesh = new T.Group(); scene.add(mesh);
            const smoke = { x: x + dx * i, z: z + dz * i, y: wall.startY + C.wallHeight - 0.65, r: 0.65, life: C.wallDuration, maxLife: C.wallDuration, blocksVision: true, mesh };
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
    const fx = NEON_EFFECTS.shock(point, C.concussRadius, C.concussDelay); scene.add(fx.root);
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
  // a segment against a box: where it first enters, on which axis, from which side
  function rayBox(from, to, box) {
    let near = -Infinity, far = Infinity, axis = "y", normal = 1;
    for (const [key, lo, hi] of [["x", box.minX, box.maxX], ["y", box.y0 || 0, box.h], ["z", box.minZ, box.maxZ]]) {
      const d = to[key] - from[key];
      if (Math.abs(d) < 1e-9) { if (from[key] < lo || from[key] > hi) return null; continue; }
      const enter = (lo - from[key]) / d, exit = (hi - from[key]) / d, t = Math.min(enter, exit);
      if (t > near) { near = t; axis = key; normal = d > 0 ? -1 : 1; }
      far = Math.min(far, Math.max(enter, exit));
    }
    return near <= far && far >= 0 && near >= -1e-6 && near <= 1 ? { t: Math.max(0, near), axis, normal } : null;
  }
  // The bolt against solid boxes. collideXZ includes a player's 2.3m headroom and would make a bolt collide with
  // ceilings far above the actual projectile.
  function boltHit(from, to) {
    if (CHASH.dirty || !CHASH.buckets) chashBuild();
    let hit = null; const seen = new Set();
    const minX = Math.floor((Math.min(from.x, to.x) - CHASH.minX) / CHASH.cell), maxX = Math.floor((Math.max(from.x, to.x) - CHASH.minX) / CHASH.cell);
    const minZ = Math.floor((Math.min(from.z, to.z) - CHASH.minZ) / CHASH.cell), maxZ = Math.floor((Math.max(from.z, to.z) - CHASH.minZ) / CHASH.cell);
    if (to.y <= 0 && from.y >= 0) hit = { t: from.y / (from.y - to.y), axis: "y", normal: 1 };
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      if (x < 0 || z < 0 || x >= CHASH.cols || z >= CHASH.rows) continue;
      for (const c of CHASH.buckets[z * CHASH.cols + x] || []) {
        if (seen.has(c)) continue; seen.add(c);
        const candidate = rayBox(from, to, c);
        if (candidate && (!hit || candidate.t < hit.t)) hit = candidate;
      }
    }
    if (hit) hit.point = from.clone().lerp(to, hit.t);
    return hit;
  }
  function relay() {
    const actor = player, point = new T.Vector3(), velocity = new T.Vector3(), fx = NEON_EFFECTS.bolt(); scene.add(fx.root);
    let time = -C.boltDelay, bounces = 0, launched = false, bounceAt = Infinity;
    startClip(actor, "relay");
    abilSpawn({ update(dt) {
      const before = time; time += dt; if (time < 0) return true;
      if (!launched) {
        launched = true; const yaw = actor.yaw || 0, pitch = actor.pitch || 0;
        point.set(actor.pos.x, actorEye(actor), actor.pos.z);
        velocity.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(C.boltSpeed);
      }
      const travel = before < 0 ? time : dt, ticks = Math.max(1, Math.ceil(velocity.length() * travel / 0.2)), h = travel / ticks;
      for (let i = 0; i < ticks; i++) {
        velocity.y -= C.boltGravity * h;
        const next = point.clone().addScaledVector(velocity, h);
        const hit = boltHit(point, next);
        if (hit) {
          point.copy(hit.point); shock(actor, point.clone());
          if (bounces++ >= 1) return false;
          bounceAt = time;
          velocity[hit.axis] *= -1; point[hit.axis] += hit.normal * 0.002;
        } else point.copy(next);
      }
      fx.updateBolt(point, velocity, time, actor.id);
      if (bounces && time - bounceAt >= C.boltAfterBounce) { shock(actor, point.clone()); return false; }
      if (time >= C.boltLife) return false;
      return true;
    }, dispose() { fx.dispose(); } });
  }
  Object.assign(CAST_EXT, { neon_lane: lane, neon_relay: relay, neon_gear() { gear(player); }, neon_overdrive() { gear(player); startUltW(player, "neon", agent.abilities[3]); startClip(player, "ult"); } });
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
    fxBolt(...from, ...to, CYAN, 0.1);
    fxTracer(...from, ...to, YELLOW);
  }
  ultwFire = function (actor) {
    const u = actor?.ultW;
    if (u?.kind !== "neon") return oldUltFire.apply(this, arguments);
    if (!actor.alive || u.cd > 0 || u.endT > 0 || actor.suppress > 0) return;
    u.cd = C.ultimateRate; actor._shotT = world._clock || 0;
    u.neonLastShot = C.ultimateDuration - u.t;
    const { o, dir, hand } = ultwAim(actor, 0, 0), ray = ultwRay(actor, o, dir, C.ultimateRange / (window.AB_D || 1), false, false, 0.08);
    const end = o.clone().addScaledVector(dir, ray.endT);
    // the beam leaves from the right fingertips on screen; the damage still uses the authoritative eye ray
    if (actor === myActor() && VM.current?.userData.neonArms) {
      tickViewmodel(0); const tip = VM.current.getObjectByName("neon-hand-r-tip");
      if (tip) { VM.root.updateWorldMatrix(true, true); tip.getWorldPosition(hand); }
    }
    if (host() && ray.hits.length) { const hit = ray.hits[0]; ultwHurt(actor, hit.e, C.ultimateDamage, false); }
    beamVisual(hand.toArray(), end.toArray());
    if (NET.mode === "host") sendEventAll({ t: "neon-beam", a: actor.id, from: hand.toArray(), to: end.toArray() });
  };
  const oldEvent = NET.onEvent;
  NET.onEvent = function (event) {
    if (event?.t !== "neon-beam") return oldEvent && oldEvent.apply(this, arguments);
    if (host() || ![event.from, event.to].every((v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) return;
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
  // the slide: low on the hips, the lead leg out straight, the other folded under, the camera dropped with it
  const slideDepth = (actor) => { const t = clamp01((C.slideDuration - actor.__neonSlide) / C.slideDuration); return Math.min(1, t / 0.15) * Math.min(1, (1 - t) / 0.2); };
  const oldModel = syncActorModel;
  syncActorModel = function (actor) {
    const m = actor.model;
    if (m && actor.__neonPose) { m.hips.position.y = actor.__neonPose.y; m.legL.leg.rotation.copy(actor.__neonPose.l); m.legR.leg.rotation.copy(actor.__neonPose.r); actor.__neonPose = null; }
    const r = oldModel.apply(this, arguments);
    if (m && actor.alive && actor.__neonSlide > 0) {
      actor.__neonPose = { y: m.hips.position.y, l: m.legL.leg.rotation.clone(), r: m.legR.leg.rotation.clone() };
      const k = slideDepth(actor);
      m.hips.position.y -= 0.42 * k;
      m.legR.leg.rotation.set(-1.35 * k, 0, 0.08 * k);
      m.legL.leg.rotation.set(0.35 * k, 0, -0.25 * k);
    }
    return r;
  };
  const oldCamera = followCamera;
  followCamera = function (actor, dt) {
    const r = oldCamera.apply(this, arguments);
    if (actor.alive && actor.__neonSlide > 0) camera.position.y -= 0.55 * slideDepth(actor);
    return r;
  };
  // the sparks off the feet: 24 sprites, each with a material of its own to fade, reused oldest first
  const SPARKS = fxPool(24, () => new T.Sprite(new T.SpriteMaterial({ map: NEON_EFFECTS.sparkTexture(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })));
  const sparkColor = (actor) => (actor.__neonSlide > 0 ? 0xb8c4d6 : actor.ultW ? YELLOW : CYAN);
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
      // sparks off the feet while the current runs
      if (SETTINGS.motion !== 0 && (actor.__neonGear > 0 || actor.ultW?.kind === "neon")) {
        actor.__neonSparkT = (actor.__neonSparkT || 0) - dt;
        if (actor.__neonSparkT <= 0) {
          actor.__neonSparkT = 0.12;
          const s = SPARKS.get();
          s.material.color.set(sparkColor(actor)); s.material.opacity = 1;
          s.position.set(actor.pos.x + (Math.random() - 0.5) * 0.3, (actor.y || 0) + 0.2 + Math.random() * 0.3, actor.pos.z + (Math.random() - 0.5) * 0.3); s.scale.setScalar(0.32);
          s.material.rotation = Math.random() * Math.PI;
          addFx(s, 0.4, (o, t) => { o.material.opacity = 1 - t; o.scale.setScalar(0.32 * (1 - 0.6 * t)); o.position.y += 0.005; });
        }
      }
      if (host()) {
        if (world.phase === "live" && actor.ultW?.kind === "neon" && actor.ads && !actor.__neonAds) slide(actor);
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
    snapshot.neon = (world.actors || []).filter((a) => a.agent?.id === agent.id || a.__neonOwnerKey).map((a) => [a.id, a.__neonGear || 0, a.__neonSlide || 0, !!a.__neonSlideReady, a.ultW?.kind === "neon" ? a.ultW.t : 0]);
    snapshot.neonStun = (world.actors || []).filter((a) => a.__neonStun > 0).map((a) => [a.id, Math.min(a.__neonStun, a.concuss || 0)]);
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
  window.NEON_AGENT = { agent, config: C, ready: () => true, slide, poseArms, buildArms, clear, boltHit, rayBox };
})();
