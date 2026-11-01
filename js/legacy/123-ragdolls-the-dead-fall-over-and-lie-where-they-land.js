(() => {
  // Ragdolls. A fighter who dies used to fold in a fixed animation (tickDeath) and vanish after 2.3 s, and on a guest's screen
  // simply vanish. Now the body is copied at the moment of death (the model's parts, sharing the meshes) and falls over by
  // physics: a Verlet skeleton at the joints (js/ragdoll-verlet.js) with the segment lengths of the rig, the floor and walls of
  // the map (groundTop / collideXZ, the same hash the movement uses), and a push from the shot that killed (away from the
  // killer; a harder one from a heavy gun) or from the explosion (away from its centre, up and far). It settles, freezes and
  // costs nothing after that. It is only a picture: no hit test ever sees it, and nothing is sent over the network.
  //  - every screen makes its own from the death it learns about: the host in killActor (it knows the killer and the gun), a
  //    guest when the snapshot says the body is dead, with the direction from what it heard (the kill-detail event, or the
  //    kill message's names); a push that arrives late (up to 0.4 s) is added to the body then
  //  - the Champions finisher (js/game-events.js, js/champions-phantom.js) is left exactly as it was: its victim gets no ragdoll
  //    (world.championsFinishUntil is set before the kill is made, and a guest waits a moment for it on a round-ending kill)
  //  - corpses go when the round starts again, the map changes or the match ends, 3 s after a body respawns, and the oldest
  //    goes first beyond a few at a time (fewer on a weak preset); reduced motion gets the fall at once, already lying down
  if ("undefined" == typeof killActor || "undefined" == typeof syncActorModel || "undefined" == typeof T || !window.RAGDOLL_VERLET) return;
  const RV = window.RAGDOLL_VERLET,
    NOW = () => performance.now();
  // what each preset can afford: bodies at once, link passes per step, the longest a fall may run, and every Nth frame posed
  const LOD = {
    mobile: { max: 3, iter: 2, maxTime: 1.8, every: 2 },
    perf: { max: 5, iter: 3, maxTime: 3, every: 1 },
    visual: { max: 8, iter: 5, maxTime: 5, every: 1 },
    ultra: { max: 10, iter: 6, maxTime: 6, every: 1 },
  };
  const lod = () => LOD[(typeof SETTINGS === "object" && SETTINGS && SETTINGS.quality) || "perf"] || LOD.perf;
  const reduced = () => {
    try {
      return 0 === SETTINGS.motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return !1;
    }
  };
  const S = { corpses: [], round: null, map: null, stats: { made: 0, skippedChampions: 0, stepMs: 0, stepMax: 0, posed: 0, steps: 0 }, pend: [] };
  const champions = () => (world.championsFinishUntil || 0) > NOW();

  // ── the copy: the model's parts, sharing meshes and materials (nothing here is disposed with the corpse) ──
  function copyTree(n, map) {
    if (!(n.isMesh || n.isGroup || (n.isObject3D && !n.isSprite && !n.isLight && !n.isPoints && !n.isLine))) return null;
    let c;
    if (n.isMesh) {
      c = new T.Mesh(n.geometry, n.material);
      c.castShadow = !!(window.GFX && GFX.charShadow && n.userData.cast);
    } else c = new T.Object3D();
    c.position.copy(n.position);
    c.quaternion.copy(n.quaternion);
    c.scale.copy(n.scale);
    c.visible = n.visible;
    map.set(n, c);
    for (const k of n.children) {
      const d = copyTree(k, map);
      d && c.add(d);
    }
    return c;
  }
  const v1 = new T.Vector3(),
    v2 = new T.Vector3(),
    v3 = new T.Vector3(),
    qa = new T.Quaternion(),
    qb = new T.Quaternion(),
    qc = new T.Quaternion(),
    m4 = new T.Matrix4();
  // a rotation from an up direction and a side direction (the bones of the trunk have a front, so they need both)
  function frame(out, up, side) {
    const y = v1.copy(up).normalize(),
      x = v2.copy(side).addScaledVector(y, -side.dot(y)).normalize(),
      z = v3.crossVectors(x, y);
    return out.setFromRotationMatrix(m4.makeBasis(x, y, z));
  }
  const J = RV.IDX;
  // the bones, parents first: [part of the model, its parent part, kind, from joint, to joint, side-joint pair]
  const BONES = (m) => [
    [m.hips, null, "f", "hip", "chest", ["hpL", "hpR"]],
    [m.chest, m.hips, "f", "chest", "neck", ["shL", "shR"]],
    [m.neck, m.chest, "f", "neck", "head", ["shL", "shR"]],
    [m.armL.arm, m.chest, "s", "shL", "elL"],
    [m.armL.fore, m.armL.arm, "s", "elL", "haL"],
    [m.armR.arm, m.chest, "s", "shR", "elR"],
    [m.armR.fore, m.armR.arm, "s", "elR", "haR"],
    [m.legL.leg, m.hips, "s", "hpL", "knL"],
    [m.legL.shin, m.legL.leg, "s", "knL", "ftL"],
    [m.legR.leg, m.hips, "s", "hpR", "knR"],
    [m.legR.shin, m.legR.leg, "s", "knR", "ftR"],
  ];
  const okRig = (m) => !!(m && m.hips && m.chest && m.neck && m.armL && m.armL.arm && m.armL.fore && m.armR && m.armR.arm && m.armR.fore && m.legL && m.legL.leg && m.legL.shin && m.legR && m.legR.leg && m.legR.shin);
  const pt = (b, i, out) => out.set(b.P[3 * i], b.P[3 * i + 1], b.P[3 * i + 2]);

  // ── a body: the copy in the scene, the skeleton, and how the one drives the other ──
  function capture(a) {
    const m = a.model;
    if (!a.group || !okRig(m)) return null;
    const map = new Map(),
      root = copyTree(a.group, map);
    if (!root) return null;
    root.position.copy(a.group.position);
    root.quaternion.copy(a.group.quaternion);
    root.scale.copy(a.group.scale);
    root.visible = !0;
    root.userData.ragdoll = !0;
    const bones = BONES(m).map((b) => [map.get(b[0]), b[1] ? map.get(b[1]) : null, b[2], b[3], b[4], b[5]]);
    if (bones.some((b) => !b[0] || (b[0].parent !== (b[1] || root)))) return null;
    scene.add(root);
    root.updateMatrixWorld(!0);
    const w = (n, x, y, zz) => n.localToWorld(v1.set(x, y, zz)).clone(),
      pos = (n) => n.getWorldPosition(new T.Vector3()),
      c = (k) => map.get(k),
      P = {
        hip: pos(c(m.hips)), chest: pos(c(m.chest)), neck: pos(c(m.neck)), head: w(c(m.neck), 0, 0.22, 0),
        shL: pos(c(m.armL.arm)), shR: pos(c(m.armR.arm)), elL: pos(c(m.armL.fore)), elR: pos(c(m.armR.fore)),
        haL: w(c(m.armL.fore), 0, -0.3, 0), haR: w(c(m.armR.fore), 0, -0.3, 0),
        hpL: pos(c(m.legL.leg)), hpR: pos(c(m.legR.leg)), knL: pos(c(m.legL.shin)), knR: pos(c(m.legR.shin)),
        ftL: w(c(m.legL.shin), 0, -0.37, 0), ftR: w(c(m.legR.shin), 0, -0.37, 0),
      },
      k = root.scale.x || 1;
    const points = RV.NAMES.map((n) => ({ x: P[n].x, y: P[n].y, z: P[n].z, r: RV.RADIUS[n] * k }));
    // the rest rotations: for a bone with a front, the frame it had and the turn from that frame to the part's own rotation
    // (so a part follows the skeleton's frame with whatever pose it died in); for a limb, the way it pointed
    const rest = bones.map((b, i) => {
      const o = P[b[3]], t = P[b[4]];
      const q0 = b[0].getWorldQuaternion(new T.Quaternion());
      if ("f" === b[2]) {
        const f0 = frame(new T.Quaternion(), v3.copy(t).sub(o), new T.Vector3().copy(P[b[5][1]]).sub(P[b[5][0]]));
        return { turn: f0.clone().invert().multiply(q0), parent: bones.findIndex((x) => x[0] === b[1]) };
      }
      return { dir: new T.Vector3().copy(t).sub(o).normalize(), q0, parent: bones.findIndex((x) => x[0] === b[1]) };
    });
    return { root, bones, rest, points, scale: k, map };
  }
  const wq = [],
    u1 = new T.Vector3(),
    u2 = new T.Vector3(),
    u3 = new T.Vector3(),
    u4 = new T.Vector3();
  // the copy's parts follow the skeleton: each bone is turned to its joints and put at its joint
  function pose(c) {
    const b = c.body, root = c.root, k = c.scale, bones = c.bones;
    for (let i = 0; i < bones.length; i++) {
      const [node, parent, kind, from, to, pair] = bones[i], r = c.rest[i];
      if ("f" === kind) {
        frame(qb, pt(b, J[to], u1).sub(pt(b, J[from], u2)), pt(b, J[pair[1]], u3).sub(pt(b, J[pair[0]], u4)));
        qb.multiply(r.turn);
      } else {
        const d = pt(b, J[to], u1).sub(pt(b, J[from], u2));
        if (d.lengthSq() < 1e-8) qb.copy(r.q0);
        else qb.setFromUnitVectors(r.dir, d.normalize()).multiply(r.q0);
      }
      wq[i] = (wq[i] || new T.Quaternion()).copy(qb);
      // the local position: from the parent's joint, turned into the parent's frame, in the parent's units
      const pi = r.parent,
        pw = pi < 0 ? root.quaternion : wq[pi];
      qa.copy(pw).invert();
      pt(b, J[from], u1);
      if (pi < 0) u1.sub(root.position);
      else u1.sub(pt(b, J[bones[pi][3]], u2));
      node.position.copy(u1.applyQuaternion(qa).multiplyScalar(1 / k));
      node.quaternion.copy(qa.multiply(qb));
    }
  }
  function freezeMatrices(c) {
    c.root.traverse((n) => {
      n.updateMatrix();
      n.matrixAutoUpdate = !1;
    });
  }

  // ── what pushes it ──
  const HEAVY = { 근접: 0.5, 보조: 0.9, 기관단총: 1, 소총: 1.25, 기관총: 1.3, 산탄총: 2.2, 저격총: 2.5 };
  const BLASTS = [];
  const blastOn = (a) => {
    const t = NOW();
    for (let i = BLASTS.length - 1; i >= 0; i--) {
      const q = BLASTS[i];
      if (t - q.t > 800) continue;
      const d = Math.hypot(a.pos.x - q.x, a.pos.z - q.z);
      if (d < q.r * 1.5 + 1.2) return { x: q.x, z: q.z, near: Math.max(0, 1 - d / (q.r * 1.5 + 1.2)) };
    }
    return null;
  };
  // info: { from: {x, z} where it came from, power (a gun's weight), head, blast: { x, z, near } }
  function push(c, a, info) {
    const b = c.body;
    let dx = 0, dz = 0;
    const src = (info.blast || info.from) || null;
    if (src) {
      dx = a.pos.x - src.x;
      dz = a.pos.z - src.z;
    }
    let d = Math.hypot(dx, dz);
    if (d < 0.05) {
      const r = Math.random() * Math.PI * 2;
      dx = Math.cos(r);
      dz = Math.sin(r);
      d = 1;
    }
    dx /= d;
    dz /= d;
    const upper = ["chest", "neck", "head", "shL", "shR", "elL", "elR", "haL", "haR"], mid = ["hip", "hpL", "hpR"], low = ["knL", "knR", "ftL", "ftR"];
    if (info.blast) {
      const f = 7 + 8 * info.blast.near, up = 4 + 5 * info.blast.near;
      b.kick(-1, dx * f, up, dz * f);
      // the head and the feet are thrown a little differently: it tumbles
      b.kick(J.head, dx * 2, 2, dz * 2);
      b.kick(J.ftL, -dx * 2, 1, -dz * 2);
    } else {
      const f = (src ? 3 : 0.9) * (info.power || 1);
      for (const n of upper) b.kick(J[n], dx * f, 0.35 * f, dz * f);
      for (const n of mid) b.kick(J[n], dx * f * 0.55, 0.1 * f, dz * f * 0.55);
      for (const n of low) b.kick(J[n], dx * f * 0.12, 0, dz * f * 0.12);
      info.head && b.kick(J.head, dx * f * 0.4, 0.4 * f, dz * f * 0.4);
    }
    c.dir = { x: dx, z: dz };
  }

  // ── the set of corpses ──
  function drop(c) {
    const i = S.corpses.indexOf(c);
    i >= 0 && S.corpses.splice(i, 1);
    c.root.parent && c.root.parent.remove(c.root);
    c.actor && c.actor._rag === c && delete c.actor._rag;
  }
  function clearAll() {
    for (const c of S.corpses.slice()) drop(c);
    S.pend.length = 0;
  }
  function spawn(a, info) {
    if (!a || !a.pos || !scene) return null;
    a._rag && drop(a._rag);
    const cap = capture(a);
    if (!cap) return null;
    const L = lod(),
      ground = (x, z, y) => groundTop(x, z, y + 0.3, 0, 0),
      blocked = (x, z, y, r) => !!collideXZ(x, z, y, Math.max(0.05, 0.5 * r)),
      bd = MAP && MAP.bounds ? { minX: MAP.bounds.minX + 0.3, maxX: MAP.bounds.maxX - 0.3, minZ: MAP.bounds.minZ + 0.3, maxZ: MAP.bounds.maxZ - 0.3 } : null;
    const body = RV.create(cap.points, RV.LINKS, { ground, blocked, bounds: bd, iterations: L.iter, maxTime: L.maxTime });
    const c = Object.assign(cap, { body, actor: a, born: NOW(), frames: 0, aliveAt: 0, id: a.id, late: !info.known });
    // what it was doing: the running body carries on a little
    if (a.vel) body.kick(-1, 0.7 * a.vel.x, Math.max(0, a.vy || 0) * 0.7, 0.7 * a.vel.z);
    push(c, a, info);
    S.corpses.push(c);
    a._rag = c;
    S.stats.made++;
    // beyond the cap the oldest goes first
    for (const o of RV.overflow(S.corpses, L.max)) drop(o);
    if (reduced()) {
      body.settleNow(L.maxTime);
      pose(c);
      freezeMatrices(c);
    } else pose(c);
    return c;
  }

  // ── what the game tells us ──
  // killer, gun and head from the kill-detail event (every screen gets it for a kill by an enemy), and the names in the kill
  // message (every screen gets that, and the host makes it itself)
  const KD = new Map(),
    NAMES = [];
  addEventListener("kill-confirmed", (e) => {
    const d = e && e.detail;
    if (!d || !d.victim) return;
    KD.set(d.victim, { killer: d.killer, gun: d.gun, head: !!d.head, kind: d.kind, t: NOW() });
    KD.size > 24 && KD.delete(KD.keys().next().value);
    late(d.victim);
  });
  const nameOf = (a) => (a ? a.name || (a.agent && a.agent.name) || "" : "");
  const _pk = pushKill;
  pushKill = function (k, v) {
    NAMES.push({ k, v, t: NOW() });
    NAMES.length > 12 && NAMES.shift();
    try {
      const a = (world.actors || []).find((x) => !x.alive && nameOf(x) === v && x._rag);
      a && late(a.id);
    } catch (e) {}
    return _pk.apply(this, arguments);
  };
  const byId = (id) => (world.actors || []).find((x) => x.id === id) || null;
  // where the shot came from, as far as this screen knows
  function sourceOf(victim) {
    const kd = KD.get(victim.id);
    let killer = kd ? byId(kd.killer) : null;
    if (!killer) {
      const n = NAMES.slice().reverse().find((x) => x.v === nameOf(victim) && NOW() - x.t < 2500);
      if (n) {
        const c = (world.actors || []).filter((x) => x !== victim && nameOf(x) === n.k);
        c.sort((p, q) => Math.hypot(p.pos.x - victim.pos.x, p.pos.z - victim.pos.z) - Math.hypot(q.pos.x - victim.pos.x, q.pos.z - victim.pos.z));
        killer = c.find((x) => x.team !== victim.team) || c[0] || null;
      }
    }
    const out = { known: !!killer, head: !!(kd ? kd.head : victim._lastHead) };
    if (killer && killer !== victim && killer.pos) out.from = { x: killer.pos.x, z: killer.pos.z };
    let key = kd && kd.gun;
    if (!key && killer && "function" == typeof actorWeaponKey) try { key = actorWeaponKey(killer); } catch (e) {}
    const w = key && WEAPONS[key];
    out.power = (w && HEAVY[w.cls]) || 1;
    return out;
  }
  // a push that comes after the body was made (a guest hears of the killer a moment after the snapshot)
  function late(id) {
    const c = S.corpses.find((x) => x.id === id);
    if (!c || !c.late || NOW() - c.born > 400 || c.body.frozen) return;
    c.late = !1;
    const a = byId(id);
    a && push(c, a, sourceOf(a));
  }
  // the round-ending kill of a finisher skin is slower on the page that plays it; a guest looks again after a moment
  const lastOfSide = (v) => !(world.actors || []).some((x) => x !== v && x.team === v.team && x.alive);
  function died(a, info, wait) {
    if (!a || a._rag) return;
    if (champions()) return void S.stats.skippedChampions++;
    if (wait) S.pend.push({ a, info, due: NOW() + 170 });
    else spawn(a, info);
  }

  // host (and solo): the kill is made here, so the killer, the gun and the blast are known
  const _ka = killActor;
  killActor = function (e, t) {
    const was = !!(e && e.alive);
    let cause = null;
    try {
      cause = window.DAMAGE_CAUSE && DAMAGE_CAUSE.get();
    } catch (x) {}
    const r = _ka.apply(this, arguments);
    if (was && e && !e.alive)
      try {
        const key = cause && cause.gun,
          w = (key && WEAPONS[key]) || (t && t !== e && "function" == typeof actorWeaponKey && WEAPONS[actorWeaponKey(t)]);
        const info = { known: !0, head: !!e._lastHead, power: (cause && "ability" === cause.kind ? 1 : w && HEAVY[w.cls]) || 1 };
        if (t && t !== e && t.pos) info.from = { x: t.pos.x, z: t.pos.z };
        const bl = blastOn(e);
        if (bl) info.blast = bl;
        died(e, info, !1);
      } catch (x) {
        console.warn("ragdoll", x);
      }
    return r;
  };
  // a guest: the snapshot says the body is dead
  if ("function" == typeof applySnapshot) {
    const _as = applySnapshot;
    applySnapshot = function () {
      const before = new Map((world.actors || []).map((a) => [a.id, !!a.alive]));
      const r = _as.apply(this, arguments);
      try {
        for (const a of world.actors || [])
          if (before.get(a.id) && !a.alive && !a._rag) {
            const info = sourceOf(a),
              bl = blastOn(a);
            bl && (info.blast = bl);
            died(a, info, "std" === (window.room && room.mode) && lastOfSide(a));
          }
      } catch (x) {
        console.warn("ragdoll", x);
      }
      return r;
    };
  }
  // every blast is remembered for a moment: whoever dies in one is thrown by it
  for (const name of ["explode", "explodeAt"]) {
    const f = { explode: typeof explode === "function" && explode, explodeAt: typeof explodeAt === "function" && explodeAt }[name];
    if (!f) continue;
    const wrapped = function (x, z, r) {
      BLASTS.push({ x, z, r: +r || 4, t: NOW() });
      BLASTS.length > 8 && BLASTS.shift();
      return f.apply(this, arguments);
    };
    "explode" === name ? (explode = wrapped) : (explodeAt = wrapped);
  }

  // ── the dead one's own model stays out of sight while its copy lies there ──
  const _sam = syncActorModel;
  syncActorModel = function (e) {
    if (e && !e.alive && e._rag) {
      e.group && (e.group.visible = !1);
      return;
    }
    return _sam.apply(this, arguments);
  };

  // ── every frame ──
  function tick(dt) {
    if (world.round !== S.round || CUR_MAP_KEY !== S.map || !(world.actors && world.actors.length)) {
      (S.round !== null || S.map !== null) && clearAll();
      S.round = world.round;
      S.map = CUR_MAP_KEY;
    }
    const t = NOW();
    if (S.pend.length)
      for (const p of S.pend.splice(0)) {
        if (t < p.due) S.pend.push(p);
        else if (p.a.alive || p.a._rag) continue;
        else if (champions()) S.stats.skippedChampions++;
        else spawn(p.a, p.info);
      }
    if (!S.corpses.length) return;
    const t0 = performance.now(),
      L = lod();
    for (const c of S.corpses.slice()) {
      const a = c.actor;
      // the body is back on its feet (a respawn): its corpse stays 3 s, sinks, and goes
      if (a && a.alive) {
        c.aliveAt = c.aliveAt || t;
        const k = (t - c.aliveAt) / 1000 - 3;
        if (k >= 1) { drop(c); continue; }
        if (k > 0) {
          c.root.matrixAutoUpdate = !0;
          c.root.position.y = (c.y0 === undefined ? (c.y0 = c.root.position.y) : c.y0) - 1.6 * k;
        }
      }
      if (c.body.frozen) {
        if (!c.still) { pose(c); freezeMatrices(c); c.still = !0; c.root.matrixAutoUpdate = !1; }
        continue;
      }
      const n = c.body.step(Math.min(dt, 0.05));
      S.stats.steps += n;
      if (++c.frames % L.every === 0 || c.body.frozen) { pose(c); S.stats.posed++; }
      // out of the map (a hole): gone
      if (c.body.P[1] < -40) drop(c);
    }
    const ms = performance.now() - t0;
    S.stats.stepMs = S.stats.stepMs * 0.9 + ms * 0.1;
    S.stats.stepMax = Math.max(S.stats.stepMax, ms);
  }
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      tick(dt);
    } catch (e) {
      console.warn("ragdoll tick", e);
    }
    return r;
  };
  const _ca = clearActors;
  clearActors = function () {
    clearAll();
    return _ca.apply(this, arguments);
  };
  if ("function" == typeof netShutdown) {
    const _ns = netShutdown;
    netShutdown = function () {
      clearAll();
      return _ns.apply(this, arguments);
    };
  }
  if ("function" == typeof startRound) {
    const _sr = startRound;
    startRound = function () {
      clearAll();
      return _sr.apply(this, arguments);
    };
  }
  window.RAGDOLL = {
    LOD,
    lod,
    state: S,
    corpses: () => S.corpses.slice(),
    clear: clearAll,
    // for tests and tools: make one for an actor now
    spawn: (a, info) => spawn(a, info || { known: !1 }),
    live: () => S.corpses.filter((c) => !c.body.frozen).length,
    head: (c) => ({ x: c.body.P[3 * J.head], y: c.body.P[3 * J.head + 1], z: c.body.P[3 * J.head + 2] }),
    hip: (c) => ({ x: c.body.P[3 * J.hip], y: c.body.P[3 * J.hip + 1], z: c.body.P[3 * J.hip + 2] }),
    joints: (c) => RV.NAMES.map((n) => [n, c.body.P[3 * J[n]], c.body.P[3 * J[n] + 1], c.body.P[3 * J[n] + 2]]),
    links: (c) => RV.LINKS.map((l, i) => ({ a: l[0], b: l[1], kind: l[2] || 0, rest: c.body.lengths[i], now: Math.hypot(...[0, 1, 2].map((k) => c.body.P[3 * J[l[0]] + k] - c.body.P[3 * J[l[1]] + k])) })),
  };
})();
