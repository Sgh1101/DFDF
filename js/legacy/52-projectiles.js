
(() => {
  // Grenades and an RPG, and a shop where every gun shows without scrolling.
  // 수류탄: equipment, ₩300, up to two. G (or 💣 on touch) takes one out and
  //   the other hand pulls the pin and spins the ring on a finger; left click
  //   (the fire button on touch) throws it, G again puts it away. It arcs,
  //   bounces off walls and floors and bursts 1.6 s after leaving the hand.
  // RPG: a heavy weapon (its own 중화기 group), one rocket then a reload. The
  //   rocket flies straight and bursts on the first thing it meets.
  // The host owns both: it flies them, decides where they burst and deals the
  // damage. Guests are told when one leaves a hand and where it burst, and fly
  // their own copy in between.
  if ("undefined" == typeof WEAPONS || "undefined" == typeof NET || "undefined" == typeof SHOP_COLS) return;
  const $ = (id) => document.getElementById(id);
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const isClient = () => "client" === NET.mode;
  const me = () => ("function" == typeof myActor && myActor()) || null;
  const NADE = { cost: 300, carry: 2, speed: 19, fuse: 1.6, r: 7, hi: 100, lo: 15, col: 0x9ccc65 };
  const ROCKET = { speed: 42, life: 2.6, r: 6, hi: 150, lo: 25, col: 0xff7043 };

  // ── the gun ──
  WEAPONS.rpg = WEAPONS.rpg || { name: "RPG", cls: "중화기", cost: 4800, dmg: ROCKET.hi, rpm: 40, mag: 1, spread: 0, range: 110, auto: !1, hs: 1, reload: 3, launcher: !0 };
  window.GUN_COUNT = Object.keys(WEAPONS).length;
  try {
    const M = GUNMAT;
    GUN_BUILD.rpg = () => {
      const b = GunBuilder();
      b.barrel(M.olive(), 0.05, 0.95, 0, 0.04, -0.2); // launch tube
      b.barrel(M.black(), 0.058, 0.08, 0, 0.04, 0.28); // rear flare
      b.barrel(M.black(), 0.056, 0.05, 0, 0.04, -0.66); // muzzle ring
      // the rocket in the tube: drawn on its own so a reload can take it out and put a new one in
      const wh = b.cyl(M.olive(), 0.03, 0.065, 0.16, 12, 0, 0.04, -0.74, -Math.PI / 2, 0, 0), // warhead
        nose = b.cone(M.olive(), 0.03, 0.12, 12, 0, 0.04, -0.88, -Math.PI / 2); // nose
      for (const m of [wh, nose]) m && m.isMesh && ((m.userData.live = !0), (m.userData.isRocket = !0));
      b.grip(M.black(), 0.035, 0.11, 0.05, 0, -0.06, 0.02);
      b.grip(M.black(), 0.035, 0.1, 0.05, 0, -0.06, -0.3);
      b.box(M.black(), 0.03, 0.05, 0.08, 0.06, 0.09, -0.08); // sight
      b.box(M.glass(), 0.02, 0.03, 0.005, 0.06, 0.11, -0.04);
      return b.group;
    };
  } catch (e) {}

  // ── the shop: one column a class, every card on screen ──
  const ci = SHOP_COLS.findIndex((c) => c.cls && c.cls.includes("기관단총") && c.cls.includes("산탄총"));
  ci >= 0 && SHOP_COLS.splice(ci, 1, { title: L("기관단총", "SMGs"), cls: ["기관단총"] }, { title: L("산탄총", "Shotguns"), cls: ["산탄총"] });
  const lc = SHOP_COLS.find((c) => c.cls && c.cls.includes("저격총"));
  lc && !lc.cls.includes("중화기") && (lc.cls.push("중화기"), (lc.title = L("기관총 · 저격총 · 중화기", "MGs · Snipers · Heavy")));

  // ── grenades in hand ──
  const tellCount = (a) => {
    if (!a || isClient()) return;
    a.ctrl && "me" !== a.ctrl && "ai" !== a.ctrl && "dead" !== a.ctrl && sendEventTo(a.ctrl, { t: "nades", n: a.nades | 0 });
    a === me() && paint();
  };
  const _ap = applyPurchase;
  applyPurchase = function (e, kind) {
    if ("nade" !== kind) return _ap.apply(this, arguments);
    if (!e || (e.nades | 0) >= NADE.carry) return;
    if (!(e.credits >= 999999)) {
      if (e.credits < NADE.cost) return;
      e.credits -= NADE.cost;
    }
    e.nades = (e.nades | 0) + 1;
    tellCount(e);
  };
  const _ka = killActor;
  killActor = function (a) {
    const had = a && a.nades;
    const r = _ka.apply(this, arguments);
    had && ((a.nades = 0), tellCount(a));
    return r;
  };
  // a fresh match starts with none
  for (const f of ["startGame", "hostStartMatch", "clientBeginMatch"]) {
    if ("function" != typeof window[f]) continue;
    const o = window[f];
    window[f] = function () {
      const r = o.apply(this, arguments);
      try {
        (world.actors || []).forEach((a) => (a.nades = 0));
        paint();
      } catch (e) {}
      return r;
    };
  }

  // ── flying things (every screen) ──
  const FLY = new Map();
  let nextId = 1;
  const eyeOf = (a) => ({ x: a.pos.x, y: actorEye(a) - 0.2, z: a.pos.z });
  const aimDir = (a) => {
    const y = a.yaw || 0,
      p = a.pitch || 0;
    return { x: -Math.sin(y) * Math.cos(p), y: Math.sin(p), z: -Math.cos(y) * Math.cos(p) };
  };
  const puff = (x, y, z, col, s, t) => {
    try {
      const d = glowDot(col, s, 1.4);
      d.position.set(x, y, z);
      addFx(d, t, (e, k) => {
        e.material.opacity = 0.7 * (1 - k);
        e.scale.setScalar(s * (1 + 1.5 * k));
      });
    } catch (e) {}
  };
  function meshNade() {
    const g = new T.Group();
    const body = new T.Mesh(new T.SphereGeometry(0.09, 12, 9), new T.MeshStandardMaterial({ color: 0x4e5b31, roughness: 0.7, metalness: 0.3 }));
    body.scale.y = 1.25;
    g.add(body);
    const cap = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.05, 8), new T.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.7, roughness: 0.4 }));
    cap.position.y = 0.12;
    g.add(cap);
    try {
      g.add(glowDot(NADE.col, 0.35, 1.6));
    } catch (e) {}
    return g;
  }
  function meshRocket() {
    const g = new T.Group();
    const olive = new T.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.6, metalness: 0.3 });
    const body = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.5, 10), olive);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const nose = new T.Mesh(new T.ConeGeometry(0.07, 0.24, 10), olive);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -0.37;
    g.add(nose);
    for (let i = 0; i < 4; i++) {
      const f = new T.Mesh(new T.BoxGeometry(0.005, 0.12, 0.12), olive);
      f.rotation.z = (i * Math.PI) / 2;
      f.position.z = 0.24;
      g.add(f);
    }
    try {
      const fl = glowDot(0xffb74d, 0.7, 2.4);
      fl.position.z = 0.32;
      g.add(fl);
    } catch (e) {}
    return g;
  }
  const casterOf = (id) => (world.actors || []).find((a) => a.id === id) || null;
  // the blast: damage on the host only (dealDamage does nothing on a guest)
  function burst(kind, x, y, z, cid, cause) {
    const k = "nade" === kind ? NADE : ROCKET,
      c = casterOf(cid);
    const go = () => explode(x, z, k.r, k.hi, k.lo, k.col);
    try {
      if (c && (!cause || cause.round === world.round)) DAMAGE_CAUSE.run(cause, () => withCaster(c, go));
    } catch (e) {
      console.warn("burst", e);
    }
    try {
      SFX.boom();
    } catch (e) {}
    try {
      screenShake("nade" === kind ? 0.35 : 0.5);
    } catch (e) {}
  }
  function launch(kind, id, cid, x, y, z, vx, vy, vz, cause) {
    const nade = "nade" === kind,
      mesh = nade ? meshNade() : meshRocket(),
      p = new T.Vector3(x, y, z),
      v = new T.Vector3(vx, vy, vz),
      c = casterOf(cid),
      team = c && (c._baseTeam || c.team);
    mesh.position.copy(p);
    nade || mesh.lookAt(p.x - vx, p.y - vy, p.z - vz);
    scene.add(mesh);
    let t = 0,
      trail = 0,
      done = !1;
    const o = { kind, mesh, cause, end: () => (done = !0) };
    FLY.set(id, o);
    const boom = () => {
      if (done) return;
      done = !0;
      burst(kind, p.x, p.y, p.z, cid, cause);
      isClient() || sendEventAll({ t: "armx", id, k: kind, a: cid, cause, x: p.x, y: p.y, z: p.z });
    };
    abilSpawn({
      update(dt) {
        if (done || cause && cause.round !== world.round) return !1;
        t += dt;
        const host = !isClient();
        const n = Math.max(1, Math.ceil((v.length() * dt) / 0.25));
        for (let i = 0; i < n && !done; i++) {
          const h = dt / n;
          if (nade) {
            v.y -= 17 * h;
            const nx = p.x + v.x * h,
              nz = p.z + v.z * h,
              ny = p.y + v.y * h;
            const hitX = collideXZ(nx, p.z, p.y, 0.1),
              hitZ = collideXZ(p.x, nz, p.y, 0.1);
            hitX ? (v.x *= -0.45) : (p.x = nx);
            hitZ ? (v.z *= -0.45) : (p.z = nz);
            if (ny <= 0.1) (p.y = 0.1), (v.y = Math.abs(v.y) * 0.35), (v.x *= 0.7), (v.z *= 0.7);
            else if (collideXZ(p.x, p.z, ny, 0.1)) (v.y = v.y < 0 ? Math.abs(v.y) * 0.3 : -Math.abs(v.y) * 0.3), (v.x *= 0.7), (v.z *= 0.7);
            else p.y = ny;
          } else {
            p.addScaledVector(v, h);
            if (host) {
              let hit = p.y <= 0.1 || collideXZ(p.x, p.z, p.y, 0.08);
              if (!hit)
                for (const a of world.actors || [])
                  if (a.alive && a.id !== cid && (a._baseTeam || a.team) !== team && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 0.75 && p.y > (a.y || 0) - 0.1 && p.y < (a.y || 0) + 2.2 * (window.BODY_K || 1)) {
                    hit = !0;
                    break;
                  }
              if (hit) return boom(), !1;
            }
          }
        }
        mesh.position.copy(p);
        nade && ((mesh.rotation.x += 9 * dt), (mesh.rotation.z += 5 * dt));
        trail -= dt;
        trail <= 0 && ((trail = nade ? 0.06 : 0.02), puff(p.x, p.y, p.z, nade ? 0xb0bec5 : 0x9e9e9e, nade ? 0.18 : 0.42, nade ? 0.35 : 0.8));
        // the host ends it; a guest's copy waits for the host's word, then gives up
        if (host && t >= (nade ? NADE.fuse : ROCKET.life)) return boom(), !1;
        if (!host && t >= (nade ? NADE.fuse : ROCKET.life) + 1.5) return !1;
        return !0;
      },
      dispose() {
        scene.remove(mesh);
        mesh.traverse((e) => {
          e.geometry && !e.geometry.userData.shared && e.geometry.dispose();
          e.material && e.material.dispose && e.material.dispose();
        });
        FLY.delete(id);
      },
    });
    try {
      const previous = window.SKIN_SHOOTER, previousShot = window.SKIN_SHOT;
      window.SKIN_SHOOTER = c; window.SKIN_SHOT = cause;
      try { nade ? SFX.drop() : SFX.gun("rpg", c && me() && c !== me() ? Math.min(1, Math.hypot(c.pos.x - me().pos.x, c.pos.z - me().pos.z) / 60) : 0); }
      finally { window.SKIN_SHOOTER = previous; window.SKIN_SHOT = previousShot; }
    } catch (e) {}
    // seen from outside, the thrower's arm comes over from the release on
    if (nade && c && "undefined" != typeof CAST_DUR)
      try {
        c._castS = "throw";
        c._castD = CAST_DUR.throw;
        c._castT = 0.55 * CAST_DUR.throw;
      } catch (e) {}
  }
  // host: something leaves a hand
  function hostLaunch(kind, a) {
    const e = eyeOf(a),
      d = aimDir(a),
      id = nextId++;
    let v, s;
    if ("nade" === kind) {
      const sp = NADE.speed;
      v = { x: d.x * sp, y: (d.y + 0.18) * sp, z: d.z * sp };
      s = { x: e.x + d.x * 0.5, y: e.y, z: e.z + d.z * 0.5 };
    } else {
      v = { x: d.x * ROCKET.speed, y: d.y * ROCKET.speed, z: d.z * ROCKET.speed };
      s = { x: e.x + d.x * 0.7, y: e.y - 0.05, z: e.z + d.z * 0.7 };
    }
    const gun = kind === "rocket" ? "rpg" : "nade";
    const skin = window.GUN_SKINS && GUN_SKINS.skinOf(a, gun);
    const cause = DAMAGE_CAUSE.capture(a, gun, kind === "rocket" ? "gun" : "grenade", world.round, skin && skin.id);
    launch(kind, id, a.id, s.x, s.y, s.z, v.x, v.y, v.z, cause);
    "host" === NET.mode && sendEventAll({ t: "arm", k: kind, id, a: a.id, cause, x: s.x, y: s.y, z: s.z, vx: v.x, vy: v.y, vz: v.z });
  }
  function throwNade(a) {
    if (!a || !a.alive || (a.nades | 0) <= 0 || "live" !== world.phase) return;
    a.nades--;
    tellCount(a);
    hostLaunch("nade", a);
  }
  window.ARMS = { throwNade, hostLaunch, NADE, ROCKET, fly: FLY };

  // ── the RPG fires a rocket instead of a bullet ──
  const _af = actorFire;
  actorFire = function (e) {
    if (HOLD.on && e && "me" === e.ctrl) return;
    if (!e || e.ultW || "rpg" !== actorWeaponKey(e)) return _af.apply(this, arguments);
    if (!e.alive || e.reloading > 0 || e.fireCd > 0 || "end" === world.phase) return;
    if (e.suppress > 0) return _af.apply(this, arguments); // the base game says why it can't
    if ((e.ammo.rpg | 0) <= 0) return void ("me" === e.ctrl ? startReload() : actorReload(e));
    e.ammo.rpg--;
    e.fireCd = 60 / WEAPONS.rpg.rpm;
    e._shotT = world._clock || 0;
    e.recoil = Math.min((e.recoil || 0) + 1, 1.2);
    if ("me" === e.ctrl) {
      world.stats.shots++;
      e.pitch = (e.pitch || 0) + 0.05;
      try {
        viewmodelFireKick();
      } catch (x) {}
    }
    isClient() || hostLaunch("rocket", e);
    // one rocket: the reload starts at once
    if (ADMIN.infAmmo && "me" === e.ctrl) e.ammo.rpg = 1;
    else if ("me" === e.ctrl) withCaster(e, () => startReload());
    else actorReload(e);
  };

  // the RPG has no magazine to drop when it is reloaded (the drop effect skips
  // guns that fire pellets, so it is one while the reload starts)
  const noMag = (f, keyOf) =>
    function () {
      const w = "rpg" === keyOf.apply(this, arguments) && WEAPONS.rpg;
      if (!w || w.pellets > 1) return f.apply(this, arguments);
      w.pellets = 2;
      try {
        return f.apply(this, arguments);
      } finally {
        delete w.pellets;
      }
    };
  startReload = noMag(startReload, () => curWeaponKey());
  actorReload = noMag(actorReload, (a) => a && actorWeaponKey(a));

  // ── the network ──
  const _oa = NET.onAction;
  NET.onAction = function (peer, m) {
    if (m && "nade" === m.t) {
      const a = world.actors.find((o) => o.ctrl === peer);
      a && throwNade(a);
      return;
    }
    return _oa.apply(this, arguments);
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "arm" === e.t) return void (FLY.has(e.id) || launch(e.k, e.id, e.a, e.x, e.y, e.z, e.vx, e.vy, e.vz, e.cause));
    if (e && "armx" === e.t) {
      const o = FLY.get(e.id);
      o ? (o.end(), burst(o.kind, e.x, e.y, e.z, e.a, o.cause)) : burst(e.k || "rocket", e.x, e.y, e.z, e.a, e.cause);
      return;
    }
    if (e && "nades" === e.t) {
      const m = me();
      m && (m.nades = e.n | 0);
      paint();
      const sh = $("shop");
      sh && !sh.hidden && renderShop();
      return;
    }
    return _oe.apply(this, arguments);
  };

  // ── a grenade in hand ──
  // G (or 💣) takes it out: it comes up in the right hand, the left hand hooks
  // a finger in the ring and pulls the pin, then keeps the ring spinning on
  // that finger. Left click (or the fire button) throws; G again, a weapon
  // key, an ability or the round ending puts it away unthrown.
  const inMatch = () => world.phase && "menu" !== world.phase && "over" !== world.phase;
  const bannerMsg = (t, c) => {
    try {
      banner(t, c || "#ffd166");
    } catch (e) {}
  };
  const PULL = 0.56, // out of the pocket, pin pulled, ring on the finger
    THROW = 0.46, // the throw, from wind-up to follow-through
    REL = 0.17; // ...and the moment it leaves the hand
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const ez = (x) => (x < 0 ? 0 : x > 1 ? 1 : x),
    seg = (k, a, b) => ez((k - a) / (b - a)),
    sm = (x) => x * x * (3 - 2 * x),
    out3 = (x) => 1 - (1 - x) * (1 - x) * (1 - x),
    bump = (k, at, w) => {
      const d = (k - at) / w;
      return d < 0 || d > 1 ? 0 : Math.sin(d * Math.PI) * (1 - d);
    };
  const snd = (k) => {
    try {
      window.VM_SND && window.VM_SND[k]();
    } catch (e) {}
  };
  // where the hands rest (camera space)
  const HR = V3(0.2, -0.215, -0.5),
    RR = new T.Euler(0.12, -0.32, 0.08),
    HL = V3(-0.165, -0.21, -0.52),
    LR = new T.Euler(0.05, 0.32, -0.12);
  const RING_R = 0.0165, // the ring (drawn a little big so it reads on screen)
    RING_IN = RING_R - 0.003;
  const RING_ON = { p: V3(-0.046, 0.05, 0.006), r: new T.Euler(0, 0.3, 0) }, // hanging off the fuze
    RING_TIP = V3(0, -RING_IN, 0); // on the finger: the finger through the ring
  const TIP_DIR = V3(0, 0.4536, -0.8912),
    TIPQ = new T.Quaternion().setFromUnitVectors(V3(0, 0, 1), TIP_DIR),
    ZAX = V3(0, 0, 1),
    IDQ = new T.Quaternion();
  let NV = null;
  function nadeVM() {
    const aid = (player && player.agent && player.agent.id) || "";
    if (NV && NV.aid === aid) return NV;
    if (NV) {
      VM.root.remove(NV.g);
      NV.g.traverse((m) => m.isMesh && m.geometry && m.geometry.dispose());
    }
    const ag = (player && player.agent) || null,
      col = new T.Color(ag && ag.color ? ag.color : "#8aa0b8");
    const mat = (hex, o) => {
      const k = "vm|" + hex;
      CH_MAT.has(k) || CH_MAT.set(k, new T.MeshStandardMaterial(Object.assign({ color: hex }, o)));
      return CH_MAT.get(k);
    };
    const sleeve = mat("#" + col.clone().lerp(new T.Color(0x2b3039), 0.66).getHexString(), { roughness: 0.9, metalness: 0 }),
      glove = mat("#262a31", { roughness: 0.5, metalness: 0.1 }),
      trim = chGlow("#" + col.getHexString(), 0.7);
    const olive = new T.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 0.72, metalness: 0.2 }),
      groove = new T.MeshStandardMaterial({ color: 0x3a4427, roughness: 0.8, metalness: 0.15 }),
      steel = new T.MeshStandardMaterial({ color: 0xb4bac0, roughness: 0.3, metalness: 0.85 });
    const g = new T.Group(),
      rg = new T.Group(),
      lg = new T.Group(),
      ng = new T.Group(),
      ring = new T.Group(),
      tip = new T.Group();
    vmArm(rg, V3(0, 0, 0), V3(0.13, -0.3, 0.4), sleeve, glove, trim, !1);
    vmArm(lg, V3(0, 0, 0), V3(-0.16, -0.3, 0.38), sleeve, glove, trim, !0);
    // the grenade: an egg with two grooves, the fuze on top, the spoon down the palm side
    const body = new T.Mesh(new T.SphereGeometry(0.034, 18, 14), olive);
    body.scale.set(1, 1.2, 1);
    ng.add(body);
    for (const y of [-0.013, 0.013]) {
      const b = new T.Mesh(new T.TorusGeometry(0.0322, 0.0021, 6, 24), groove);
      b.rotation.x = Math.PI / 2;
      b.position.y = y;
      ng.add(b);
    }
    const fuze = new T.Mesh(new T.CylinderGeometry(0.011, 0.013, 0.026, 12), steel);
    fuze.position.y = 0.047;
    const cap = new T.Mesh(new T.CylinderGeometry(0.008, 0.011, 0.008, 12), steel);
    cap.position.y = 0.063;
    const spoon = new T.Mesh(new T.BoxGeometry(0.012, 0.072, 0.004), steel);
    spoon.position.set(0.027, 0.027, 0.004);
    spoon.rotation.z = -0.36;
    ng.add(fuze, cap, spoon);
    ng.position.set(-0.006, 0.056, -0.036);
    ng.scale.setScalar(1.12);
    rg.add(ng);
    // the ring, and the pin that goes through the fuze
    const torus = new T.Mesh(new T.TorusGeometry(RING_R, 0.003, 6, 22), steel);
    const pin = new T.Mesh(new T.CylinderGeometry(0.0017, 0.0017, 0.03, 6), steel);
    pin.rotation.z = Math.PI / 2;
    pin.position.x = RING_R + 0.015;
    ring.add(torus, pin);
    tip.position.set(-0.02, 0.0434, -0.0463); // the left index fingertip
    tip.quaternion.copy(TIPQ);
    lg.add(tip);
    g.add(rg, lg);
    g.traverse((m) => {
      if (!m.isMesh) return;
      m.renderOrder = 999;
      m.frustumCulled = !1;
      m.castShadow = m.receiveShadow = !1;
    });
    g.visible = !1;
    VM.root.add(g);
    NV = { g, rg, lg, ng, ring, tip, aid };
    return NV;
  }
  const HOLD = { on: !1, ph: "", t: 0, tt: 0, want: !1, gone: !1, hooked: !1, spin: 0, cues: {}, hook: null, rp0: null, rq0: null, lFrom: null };
  window.NADE_HOLD = HOLD;
  const cue = (k, ok, f) => ok && !HOLD.cues[k] && ((HOLD.cues[k] = 1), f());
  function quickThrow(m) {
    isClient() ? sendAction({ t: "nade" }) : throwNade(m);
  }
  function startHold() {
    const m = me();
    if (!m || !m.alive || !inMatch() || (m.nades | 0) <= 0 || m.ultW) return;
    if ("live" !== world.phase) return void bannerMsg(L("수류탄은 교전이 시작된 뒤에 던질 수 있습니다", "Grenades can be thrown once the round is live"));
    let n;
    try {
      n = nadeVM();
    } catch (e) {
      console.warn("grenade hands", e);
      return void quickThrow(m);
    }
    Object.assign(HOLD, { on: !0, ph: "pull", t: 0, tt: 0, want: !1, gone: !1, hooked: !1, spin: 0, cues: {}, hook: null });
    keys.fire = !1;
    keys.ads = !1;
    player.ads = !1;
    n.ng.add(n.ring);
    n.ring.position.copy(RING_ON.p);
    n.ring.rotation.copy(RING_ON.r);
    n.tip.quaternion.copy(TIPQ);
    n.ng.visible = !0;
    n.g.visible = !0;
    tickHold(0);
    paint();
    if (IS_TOUCH && !HOLD.told) (HOLD.told = !0), bannerMsg(L("핀을 뽑았습니다 · 사격 버튼으로 던지기, 💣 다시 누르면 취소", "Pin pulled · fire button throws, 💣 again cancels"), "#c5e1a5");
  }
  function endHold() {
    if (!HOLD.on) return;
    HOLD.on = !1;
    HOLD.ph = "";
    NV && (NV.g.visible = !1);
    VM.swapT = 0.28; // the gun comes back up
    VM.current && (VM.current.visible = !0);
    paint();
  }
  function wantRelease() {
    if (!HOLD.on || "throw" === HOLD.ph) return;
    HOLD.want = !0;
    "idle" === HOLD.ph && beginThrow();
  }
  function beginThrow() {
    HOLD.ph = "throw";
    HOLD.tt = 0;
    HOLD.lFrom = NV.lg.position.clone();
  }
  function toggleHold() {
    HOLD.on ? "throw" !== HOLD.ph && endHold() : startHold();
  }
  function tickHold(dt) {
    if (!HOLD.on || !NV) return;
    const m = me();
    const castOn = "undefined" != typeof VM_CAST && VM_CAST.t > 0;
    if (!m || !m.alive || !player.alive || "live" !== world.phase || castOn || player.ultW || (player.planting || 0) > 0 || (player.defusing || 0) > 0) return endHold();
    if (!HOLD.gone && (m.nades | 0) <= 0) return endHold();
    keys.fire = !1;
    keys.ads = !1;
    keys.r = !1; // no reload of the gun that is put away
    player.ads = !1;
    VM.current && (VM.current.visible = !1);
    const n = NV;
    HOLD.t += dt;
    const t = HOLD.t;
    if ("pull" === HOLD.ph && t >= PULL) (HOLD.ph = "idle"), HOLD.want && beginThrow();
    // the right hand, with the grenade
    const rp = HR.clone();
    let rx = RR.x,
      rz = RR.z;
    if ("throw" !== HOLD.ph) {
      const up = out3(seg(t, 0, 0.2));
      rp.y -= 0.3 * (1 - up);
      rp.z += 0.06 * (1 - up);
      const j = bump(t, 0.35, 0.12); // the pin lets go
      rp.x += 0.008 * j;
      rz -= 0.07 * j;
      rp.y += 0.003 * Math.sin(2.1 * t);
      rx += 0.02 * Math.sin(1.6 * t);
    } else {
      HOLD.tt += dt;
      const k = HOLD.tt;
      // keyframes: [time, offset from rest, pitch, roll]; the forearm stays upright
      // on the wind-up so it never swings back past the camera
      const KF = [
        [0, V3(0, 0, 0), 0, 0],
        [0.13, V3(0.09, 0.09, 0.05), 0.45, -0.35],
        [0.21, V3(-0.05, 0.04, -0.24), -0.15, 0],
        [THROW, V3(-0.09, -0.34, -0.06), 0.7, 0.05],
      ];
      let i = 1;
      while (i < KF.length - 1 && k > KF[i][0]) i++;
      const A = KF[i - 1],
        B = KF[i],
        s = (2 === i ? out3 : sm)(seg(k, A[0], B[0]));
      rp.copy(HR).add(A[1].clone().lerp(B[1], s));
      rx = RR.x + A[2] + (B[2] - A[2]) * s;
      rz = RR.z + A[3] + (B[3] - A[3]) * s;
      if (k >= REL && !HOLD.gone) {
        HOLD.gone = !0;
        n.ng.visible = !1;
        snd("spoon");
        m.alive && (m.nades | 0) > 0 && quickThrow(m);
      }
      if (k >= THROW) return endHold();
    }
    n.rg.position.copy(rp);
    n.rg.rotation.set(rx, RR.y, rz);
    // the left hand: to the ring, pull, then spin it
    const lp = HL.clone();
    if ("throw" === HOLD.ph) lp.copy(HOLD.lFrom).lerp(HL.clone().add(V3(-0.03, -0.34, 0.06)), sm(seg(HOLD.tt, 0, 0.26)));
    else if (t < 0.33) {
      n.g.updateMatrixWorld(!0);
      const ringAt = n.g.worldToLocal(n.ring.getWorldPosition(V3(0, 0, 0))).add(V3(-RING_IN, 0, 0)); // the inside edge nearest the hand
      const hook = ringAt.sub(n.tip.position.clone().applyEuler(LR));
      const pre = hook.clone().add(V3(-0.05, -0.05, 0.04)),
        from = HL.clone().add(V3(0.02, -0.32, 0.06));
      t < 0.2 ? lp.copy(from).lerp(pre, out3(seg(t, 0, 0.2))) : lp.copy(pre).lerp(hook, sm(seg(t, 0.2, 0.33)));
      HOLD.hook = hook;
    } else if (t < PULL) {
      const hook = HOLD.hook || lp.clone();
      const pulled = hook.clone().add(V3(-0.12, -0.015, 0.03));
      t < 0.45 ? lp.copy(hook).lerp(pulled, out3(seg(t, 0.33, 0.45))) : lp.copy(pulled).lerp(HL, sm(seg(t, 0.45, PULL)));
    } else {
      lp.x += 0.003 * Math.sin(1.7 * t);
      lp.y += 0.004 * Math.sin(2.3 * t + 1);
    }
    n.lg.position.copy(lp);
    n.lg.rotation.copy(LR);
    // the pin comes out with the finger
    if (!HOLD.hooked && t >= 0.33 && "throw" !== HOLD.ph) {
      HOLD.hooked = !0;
      n.g.updateMatrixWorld(!0);
      n.tip.quaternion.copy(TIPQ);
      n.tip.updateMatrixWorld(!0);
      n.tip.attach(n.ring);
      HOLD.rp0 = n.ring.position.clone();
      HOLD.rq0 = n.ring.quaternion.clone();
    }
    cue("pin", t >= 0.35, () => snd("pin"));
    if (HOLD.hooked) {
      const b = sm(seg(t, 0.33, 0.52));
      n.ring.position.copy(HOLD.rp0).lerp(RING_TIP, b);
      n.ring.quaternion.copy(HOLD.rq0).slerp(IDQ, b);
      // a lazy twirl: speeds up once the pin is out, never quite steady
      HOLD.spin += dt * (1.5 + 6 * sm(seg(t, 0.42, 0.8))) * (1 + 0.25 * Math.sin(2.7 * t));
      n.tip.quaternion.copy(TIPQ).multiply(new T.Quaternion().setFromAxisAngle(ZAX, HOLD.spin));
    }
  }
  window.ARMS.hold = { start: startHold, release: wantRelease, cancel: endHold, toggle: toggleHold, state: HOLD };
  // the gun stays down while a grenade is out
  const _tv = tickViewmodel;
  tickViewmodel = function (dt) {
    const r = _tv.apply(this, arguments);
    try {
      tickHold(dt || 0);
    } catch (e) {
      console.warn("grenade hold", e);
      endHold();
    }
    return r;
  };
  if ("function" == typeof fire) {
    const _fi = fire;
    fire = function () {
      if (HOLD.on) return;
      return _fi.apply(this, arguments);
    };
  }
  const _ss = switchSlot;
  switchSlot = function () {
    HOLD.on && "throw" !== HOLD.ph && endHold();
    return _ss.apply(this, arguments);
  };
  const _sr = startReload;
  startReload = function () {
    if (HOLD.on) return;
    return _sr.apply(this, arguments);
  };
  // left click throws (it never reaches the gun); right click does nothing
  addEventListener(
    "mousedown",
    (e) => {
      // only clicks on the game view (menus and buttons work as usual)
      if (!HOLD.on || !(locked || (IS_TOUCH && e.target === canvas))) return;
      if (0 !== e.button && 2 !== e.button) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      0 === e.button && wantRelease();
    },
    !0
  );
  addEventListener(
    "touchstart",
    (e) => {
      if (!HOLD.on) return;
      const t = e.target;
      if (!t || !t.closest || !t.closest("#tb-fire")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      wantRelease();
    },
    { capture: !0, passive: !1 }
  );
  addEventListener("keydown", (e) => {
    if ("KeyG" !== e.code || e.repeat) return;
    const t = e.target;
    if (t && ("INPUT" === t.tagName || "TEXTAREA" === t.tagName)) return;
    for (const id of ["shop", "pause"]) {
      const s = $(id);
      if (s && !s.hidden) return;
    }
    toggleHold();
  });

  // ── HUD: how many grenades, and the touch button ──
  const chip = document.createElement("div");
  chip.id = "nade-hud";
  chip.hidden = !0;
  ($("hud") || document.body).appendChild(chip);
  const tb = document.createElement("button");
  tb.className = "tab tab-nade";
  tb.id = "tb-nade";
  tb.hidden = !0;
  tb.setAttribute("aria-label", L("수류탄", "Grenade"));
  const tab = $("tabil");
  tab && tab.appendChild(tb);
  tb.addEventListener("touchstart", (e) => (e.preventDefault(), toggleHold()), { passive: !1 });
  tb.addEventListener("click", toggleHold);
  function paint() {
    const m = me(),
      n = (m && m.alive && m.nades) | 0;
    const h = HOLD.on;
    chip.hidden = (!n && !h) || !inMatch();
    chip.classList.toggle("hold", h);
    chip.innerHTML = h
      ? `<b>${L("좌클릭", "Click")}</b><span>💣 ${L("던지기", "Throw")}</span><em>G ${L("취소", "cancel")}</em>`
      : `<b>G</b><span>💣 ${L("수류탄", "Grenade")}</span><em>×${n}</em>`;
    tb.hidden = (!n && !h) || !inMatch();
    tb.classList.toggle("hold", h);
    tb.innerHTML = `<em class="nd-ic">💣</em><i>${h ? "✕" : n}</i>`;
    // the ability buttons each have their own spot; sit just left of Q, same size
    if (!tb.hidden) {
      const q = document.querySelector('#tabil .tab[data-a="0"]'),
        r = q && q.getBoundingClientRect();
      if (r && r.width > 0) {
        const set = (k, v) => tb.style.setProperty(k, v, "important");
        set("position", "fixed");
        set("width", r.width + "px");
        set("height", r.height + "px");
        set("left", Math.max(4, r.left - r.width - Math.max(6, r.width * 0.14)) + "px");
        set("top", r.top + "px");
        set("right", "auto");
        set("bottom", "auto");
      }
    }
  }
  const _uh = updateHUD;
  updateHUD = function () {
    const r = _uh.apply(this, arguments);
    try {
      paint();
    } catch (e) {}
    return r;
  };

  // ── the shop card ──
  const _rs = renderShop;
  renderShop = function () {
    const r = _rs.apply(this, arguments);
    try {
      const m = me() || player,
        free = m.credits >= 999999,
        n = m.nades | 0;
      const col = document.querySelector("#shop-grid .shop-col");
      if (!col) return r;
      const b = document.createElement("button");
      b.className = "sitem sitem-nade";
      b.disabled = n >= NADE.carry || !(free || m.credits >= NADE.cost);
      b.innerHTML = `<b>💣 ${L("수류탄", "Grenade")}</b><span>${free ? L("무료", "Free") : "₩ " + NADE.cost}</span><em>${L("G 핀 뽑기 · 좌클릭 던지기", "G pulls the pin · click throws")} · ${L("보유", "Have")} ${n}/${NADE.carry}</em>`;
      b.onclick = () => {
        isClient() ? sendAction({ t: "buy", kind: "nade" }) : applyPurchase(m, "nade");
        renderShop();
        updateHUD();
      };
      const items = col.querySelectorAll(".sitem");
      const after = items[1] || items[0];
      after ? after.after(b) : col.appendChild(b);
    } catch (e) {
      console.warn("shop nade", e);
    }
    return r;
  };

  const st = document.createElement("style");
  st.textContent = `
@media (min-width:1000px){#shop .shop-grid{grid-template-columns:repeat(6,minmax(0,1fr))!important}}
@media (min-width:1000px) and (max-height:900px){#shop .shop-col{gap:5px!important}#shop .sitem{padding:6px 9px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto;column-gap:6px;align-items:baseline}#shop .sitem em{grid-column:1/-1}#shop .sitem b{font-size:12.5px}#shop .sitem span{font-size:11px}#shop .sitem em{font-size:10px}#shop .shop-sec{margin-bottom:2px}}
#shop .shop-grid{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.32) transparent}
#shop .shop-grid::-webkit-scrollbar{width:8px}#shop .shop-grid::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3);border-radius:4px}
#nade-hud{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 132px);transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:4px 11px 4px 5px;border-radius:999px;border:1px solid rgba(156,204,101,.55);background:rgba(10,14,10,.62);color:#dfe9d0;font-size:12px;font-weight:700;pointer-events:none;z-index:6}
#nade-hud b{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;background:rgba(156,204,101,.25);color:#c5e1a5;font-size:11px}
#nade-hud em{font-style:normal;color:#c5e1a5}
#nade-hud[hidden],#tb-nade[hidden]{display:none!important}
body.touching #nade-hud{display:none}
#tb-nade{border-color:rgba(156,204,101,.7)!important;background:rgba(156,204,101,.2)!important}
#tb-nade .nd-ic{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:calc(22px*var(--mbs,1));line-height:1;pointer-events:none}
#nade-hud.hold{border-color:rgba(255,209,102,.8);background:rgba(40,30,8,.7)}
#nade-hud.hold b{width:auto;padding:0 6px;background:rgba(255,209,102,.28);color:#ffe2a0}
#nade-hud.hold em{color:#ffe2a0;font-weight:600}
#tb-nade.hold{border-color:rgba(255,209,102,.95)!important;background:rgba(255,209,102,.3)!important;animation:ndHold 1s ease-in-out infinite}
@keyframes ndHold{50%{box-shadow:0 0 0 5px rgba(255,209,102,.25)}}`;
  document.head.appendChild(st);
})();
