
(() => {
  // Thirty-six agents, every ability its own. The 14 first agents keep their
  // kits (백호's second smoke became a smoke arrow, so no type repeats); 22
  // more were kept for their themes and given whole new kits written here.
  // Every new ability goes through CAST_EXT, so a cast is sent once, played
  // on every screen, and only the host deals damage.
  if ("undefined" == typeof AGENTS || "undefined" == typeof CAST_EXT) return;

  // ── helpers ──
  const RA = () => window.AB_R || 1,
    DA = () => window.AB_D || 1,
    SMK = () => window.AB_SM || 1;
  const isHost = () => "undefined" == typeof NET || "client" !== NET.mode;
  const aimAt = (d) => aimPoint(d / DA()); // final reach in metres
  const fwdOf = (c) => ({ x: -Math.sin(c.yaw || 0), z: -Math.cos(c.yaw || 0) });
  const mates = (c) => actorList().filter((a) => a && a.alive && a.team === c.team);
  const dist2D = (a, x, z) => Math.hypot(a.pos.x - x, a.pos.z - z);
  const within = (list, x, z, r) => list.filter((a) => dist2D(a, x, z) <= r);
  const hurt = (a, dmg, c) => a && a.alive && hurtFighter(a, dmg, !1, c);
  const heal = (a, n) => isHost() && a && a.alive && (a.hp = Math.min(100, (a.hp || 0) + n));
  const slowA = (a, s, t) => ((a.slow = Math.min(a.slow || 1, s)), (a.slowT = Math.max(a.slowT || 0, t)));
  const st = (a, k, t) => statusOn(a, k, t);
  const losOK = (c, a) => !rayBlocked(c.pos.x, (c.y || 0) + 1.5, c.pos.z, a.pos.x, (a.y || 0) + 1.2, a.pos.z);
  const fall = (dmg, min, d, r) => Math.max(min, dmg * (1 - (0.6 * d) / r));
  // free length along a direction before a wall
  const clearLen = (x, z, dx, dz, len, y) => {
    let t = 0;
    while (t < len && !collideXZ(x + dx * (t + 0.4), z + dz * (t + 0.4), (y || 0) + 0.8, 0.15)) t += 0.4;
    return Math.min(t, len);
  };
  // enemies near a segment, nearest first
  const onLine = (list, x0, z0, dx, dz, len, w) =>
    list
      .map((a) => {
        const px = a.pos.x - x0,
          pz = a.pos.z - z0;
        return { a, t: px * dx + pz * dz, off: Math.abs(px * dz - pz * dx) };
      })
      .filter((o) => o.t >= -0.5 && o.t <= len && o.off <= w)
      .sort((p, q) => p.t - q.t)
      .map((o) => o.a);
  const inCone = (list, x, z, dx, dz, r, half) =>
    list.filter((a) => {
      const px = a.pos.x - x,
        pz = a.pos.z - z,
        d = Math.hypot(px, pz);
      return d <= r && (d < 0.6 || (px * dx + pz * dz) / d >= Math.cos(half));
    });
  const nearest = (list, x, z, r) => {
    let best = null,
      bd = r;
    for (const a of list) {
      const d = dist2D(a, x, z);
      d < bd && ((bd = d), (best = a));
    }
    return best;
  };
  // move a body smoothly (walls respected), on every screen
  const shove = (a, dx, dz, dist, time) => {
    const L = Math.hypot(dx, dz) || 1,
      ux = dx / L,
      uz = dz / L,
      T0 = time || 0.25;
    let t = 0;
    abilSpawn({
      update(dt) {
        const s = Math.min(dt, T0 - t);
        t += dt;
        s > 0 && a.alive && moveWithSlide(a.pos, (ux * dist * s) / T0, (uz * dist * s) / T0, a.y || 0, 0.4);
        return t < T0;
      },
    });
  };
  const shoveFrom = (a, x, z, dist, time) => shove(a, a.pos.x - x || 0.01, a.pos.z - z, dist, time);
  // an immediate dash along a direction, stopping at walls
  const dashTo = (c, dx, dz, len) => {
    const sx = c.pos.x,
      sz = c.pos.z,
      n = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 1; i <= n; i++) {
      const x = sx + (dx * len * i) / n,
        z = sz + (dz * len * i) / n;
      if (collideXZ(x, z, c.y || 0, 0.4)) break;
      c.pos.x = x;
      c.pos.z = z;
    }
    c.vel && c.vel.set(0, 0, 0);
  };
  // a timed thing in the world; upd(t, dt) returning false ends it
  const live = (life, upd, dispose, end) => {
    let t = 0,
      fin = !1;
    return abilSpawn({
      update(dt) {
        t += dt;
        const r = upd ? upd(Math.min(t, life), dt) : void 0;
        if (r === !1) return !1;
        if (t < life) return !0;
        if (!fin && end) {
          fin = !0;
          try {
            end();
          } catch (e) {
            console.warn("ability", e);
          }
        }
        return !1;
      },
      dispose,
    });
  };
  // repeat a host check every `step` seconds inside a timed thing
  const every = (step) => {
    let acc = 0;
    return (dt) => ((acc += dt), acc >= step ? ((acc -= step), !0) : !1);
  };

  // ── looks ──
  const mat = (col, op, add) => new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: null == op ? 0.8 : op, depthWrite: !1, side: T.DoubleSide, blending: add ? T.AdditiveBlending : T.NormalBlending });
  const drop = (m) => {
    if (!m) return;
    scene.remove(m);
    m.traverse((o) => {
      o.geometry && !(o.geometry.userData && o.geometry.userData.shared) && o.geometry.dispose();
      o.material && (Array.isArray(o.material) ? o.material.forEach((x) => x.dispose()) : o.material.dispose());
    });
  };
  const disc = (x, z, r, col, op, reference) => {
    const m = new T.Mesh(new T.CircleGeometry(r, 48), mat(col, null == op ? 0.22 : op));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, abilityGroundY(x, z, reference) + 0.05, z);
    scene.add(m);
    return m;
  };
  const ring = (x, z, r, col, op, w, reference) => {
    const m = new T.Mesh(new T.RingGeometry(Math.max(0.01, r - (w || 0.3)), r, 64), mat(col, null == op ? 0.7 : op, !0));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, abilityGroundY(x, z, reference) + 0.07, z);
    scene.add(m);
    return m;
  };
  const groundPosition = (m, x, y, z) => m.position.set(x, abilityGroundY(x, z) + y, z);
  const dot = (col, size, x, y, z) => {
    const g = glowDot(col, size);
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  };
  function burst(x, z, r, col, y, absolute = false) {
    y = (absolute ? 0 : abilityGroundY(x, z)) + (y == null ? 1 : y);
    const s = new T.Mesh(new T.SphereGeometry(0.35 * r, 18, 12), mat(col, 0.85, !0));
    s.position.set(x, y, z);
    addFx(s, 0.45, (m, t) => {
      m.scale.setScalar(1 + 1.6 * t);
      m.material.opacity = 0.85 * (1 - t) * (1 - t);
    });
    fxRing(x, z, r, col, 0.55);
    const n = Math.max(4, Math.round(12 * Math.max(0.3, MOT())));
    for (let i = 0; i < n; i++) {
      const g = glowDot(col, 0.28 + 0.3 * Math.random());
      g.position.set(x, y, z);
      const a = Math.random() * 6.28,
        sp = 3 + 6 * Math.random(),
        vx = Math.cos(a) * sp,
        vz = Math.sin(a) * sp;
      let vy = 3 + 4 * Math.random();
      addFx(g, 0.5, (m, t, d) => {
        const dt = d || 0.016;
        m.position.x += vx * dt;
        m.position.z += vz * dt;
        m.position.y += vy * dt;
        vy -= 14 * dt;
        m.material.opacity = 1 - t;
      });
    }
    viewerShake(x, z, 0.22);
  }
  const beamMesh = (col, w, op) => {
    const m = new T.Mesh(new T.CylinderGeometry(w, w, 1, 10, 1, !0), mat(col, null == op ? 0.75 : op, !0));
    scene.add(m);
    return m;
  };
  const placeBeam = (m, x1, y1, z1, x2, y2, z2) => {
    const dx = x2 - x1,
      dy = y2 - y1,
      dz = z2 - z1,
      L = Math.hypot(dx, dy, dz) || 0.01;
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.scale.set(1, L, 1);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / L, dy / L, dz / L));
  };
  const tracer = (x1, y1, z1, x2, y2, z2, col, w, life) => {
    const m = beamMesh(col, w || 0.05, 0.9);
    placeBeam(m, x1, y1, z1, x2, y2, z2);
    scene.remove(m);
    addFx(m, life || 0.25, (o, t) => (o.material.opacity = 0.9 * (1 - t)));
  };
  const eye = (c) => ({ x: c.pos.x, y: (c.y || 0) + 1.45, z: c.pos.z });
  // a hit-scan line: the first enemy in it, or where it stops
  function scan(c, len, w, yawOff) {
    const yaw = (c.yaw || 0) + (yawOff || 0),
      dx = -Math.sin(yaw),
      dz = -Math.cos(yaw),
      e = eye(c),
      L = clearLen(e.x, e.z, dx, dz, len, c.y);
    const hit = onLine(foesOf(c), e.x, e.z, dx, dz, L, w).find((a) => losOK(c, a));
    const end = hit ? { x: hit.pos.x, z: hit.pos.z, y: (hit.y || 0) + 1.1 } : { x: e.x + dx * L, z: e.z + dz * L, y: e.y - 0.2 };
    return { hit, end, e, dx, dz, L };
  }
  function ghostOf(c, op) {
    const f = buildFighter(teamHex(c), c.agent);
    f.group.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      if ("undefined" != typeof CH_VC && m.material === CH_VC) return void (m.material = chVCGhost());
      m.material = m.material.clone();
      m.material.transparent = !0;
      m.material.opacity = null == op ? 0.55 : op;
    });
    scene.add(f.group);
    return f;
  }
  const ghostDrop = (f) => {
    try {
      scene.remove(f.group);
      chDispose(f.group);
    } catch (e) {}
  };
  // temporary solid boxes (axis-aligned, like the ice wall)
  function solid(x, z, w, d, h, col, life, hp) {
    const box = addBox(x, z, w, d, h, new T.MeshStandardMaterial({ color: col, transparent: !0, opacity: 0.86, roughness: 0.6, metalness: 0.35, emissive: col, emissiveIntensity: 0.12 }), { hp: hp || 500, temp: !0 });
    live(life, null, () => COLLIDERS.includes(box) && destroyCollider(box));
    return box;
  }
  // timed speed-ups and "ignore slows" that clean up after themselves
  const SPD = new Map(),
    IMM = new Map();
  const nowS = () => performance.now() / 1000;
  function speedUp(a, m, dur) {
    const now = nowS(),
      o = SPD.get(a);
    if (o) return void ((o.m = Math.max(o.m, m)), (o.until = Math.max(o.until, now + dur)));
    SPD.set(a, { m, until: now + dur, base: a.speedBuff || 1 });
  }
  const immune = (a, dur) => IMM.set(a, Math.max(IMM.get(a) || 0, nowS() + dur));
  const tags = []; // floating marks over heads
  function headMark(a, col, life, size) {
    const g = glowDot(col, size || 0.55, 2.2);
    scene.add(g);
    live(life, () => {
      if (!a.alive) return !1;
      g.position.set(a.pos.x, (a.y || 0) + 2.45, a.pos.z);
    }, () => scene.remove(g));
  }

  // ── the new abilities ──
  const H = {};

  // 바람 — wind
  H.x_gale_slash = (d, f) => {
    const c = player,
      x = c.pos.x,
      z = c.pos.z;
    for (let i = 0; i < 3; i++) later(0.04 * i, () => fxArc(x, z, c.yaw, 15, 0xb3e5fc));
    for (let i = -3; i <= 3; i++) {
      const a = c.yaw + i * 0.17;
      fxBolt(x, 1.3, z, x - Math.sin(a) * 15, 1.1, z - Math.cos(a) * 15, 0xe1f5fe, 0.22);
    }
    later(0.1, () => {
      for (const e of inCone(foesOf(c), x, z, f.x, f.z, 15, 0.62)) {
        if (!losOK(c, e)) continue;
        hurt(e, 25, c);
        shoveFrom(e, x, z, 6, 0.3);
        burst(e.pos.x, e.pos.z, 1.2, 0xe1f5fe, 1.2);
      }
    });
  };
  const glide = (c, dur, cap) =>
    live(dur, (t) => {
      if (!c.alive) return !1;
      t > 0.3 && (c.vy || 0) < -cap && (c.vy = -cap);
      if (Math.random() < 0.5) {
        const g = dot(0xe1f5fe, 0.25, c.pos.x + (Math.random() - 0.5), (c.y || 0) + 0.4, c.pos.z + (Math.random() - 0.5));
        scene.remove(g);
        addFx(g, 0.5, (m, k) => ((m.position.y -= 0.02), (m.material.opacity = 1 - k)));
      }
    });
  H.x_updraft = (d, f) => {
    const c = player;
    c.vy = 15;
    c.onGround = !1;
    c._airT = 0;
    shove(c, f.x, f.z, 5, 0.45);
    fxRing(c.pos.x, c.pos.z, 4, 0xb3e5fc, 0.6);
    fxColumn(c.pos.x, c.pos.z, 0xe1f5fe, 9, 0.7);
    glide(c, 3.4, 2.4);
  };
  H.x_headwind = (d, f) => {
    const c = player,
      p = aimAt(18),
      px = -f.z,
      pz = f.x,
      HALF = 7;
    const wall = new T.Mesh(new T.BoxGeometry(HALF * 2, 4, 0.25), mat(0xb3e5fc, 0.18, !0));
    wall.position.set(p.x, abilityGroundY(p.x, p.z, p.y) + 2, p.z);
    wall.rotation.y = c.yaw;
    scene.add(wall);
    const hit = new Map();
    live(6, (t) => {
      wall.material.opacity = 0.14 + 0.08 * Math.sin(t * 9);
      if (Math.random() < 0.7) {
        const k = (Math.random() * 2 - 1) * HALF,
          g = dot(0xe1f5fe, 0.3, p.x + px * k, abilityGroundY(p.x, p.z, p.y) + 0.5 + Math.random() * 3, p.z + pz * k);
        scene.remove(g);
        const s = Math.random() < 0.5 ? 1 : -1;
        addFx(g, 0.6, (m, q, dd) => ((m.position.x += f.x * s * 6 * (dd || 0.016)), (m.position.z += f.z * s * 6 * (dd || 0.016)), (m.material.opacity = 1 - q)));
      }
      for (const e of foesOf(c)) {
        const rx = e.pos.x - p.x,
          rz = e.pos.z - p.z,
          along = rx * px + rz * pz,
          side = rx * f.x + rz * f.z;
        if (Math.abs(along) > HALF || Math.abs(side) > 1.6) continue;
        slowA(e, 0.6, 1.5);
        const last = hit.get(e) || -9;
        if (t - last > 0.5) (hit.set(e, t), shove(e, f.x * (side >= 0 ? 1 : -1), f.z * (side >= 0 ? 1 : -1), 3, 0.25));
      }
    }, () => drop(wall));
  };
  H.x_ult_storm_eye = (d) => {
    const c = player;
    const funnel = new T.Mesh(new T.CylinderGeometry(12, 4, 9, 40, 1, !0), mat(0xb3e5fc, 0.12, !0));
    scene.add(funnel);
    const tick = every(0.25);
    c.vy = Math.max(c.vy || 0, 6);
    c.onGround = !1;
    glide(c, 8, 1.6);
    live(8, (t, dt) => {
      if (!c.alive) return !1;
      funnel.position.set(c.pos.x, (c.y || 0) + 4.5, c.pos.z);
      funnel.rotation.y += 3 * dt;
      const hitNow = tick(dt);
      for (const e of within(foesOf(c), c.pos.x, c.pos.z, 12)) {
        moveWithSlide(e.pos, ((e.pos.x - c.pos.x) / (dist2D(e, c.pos.x, c.pos.z) || 1)) * 5 * dt, ((e.pos.z - c.pos.z) / (dist2D(e, c.pos.x, c.pos.z) || 1)) * 5 * dt, e.y || 0, 0.4);
        hitNow && hurt(e, 2, c);
      }
    }, () => drop(funnel));
    fxRing(c.pos.x, c.pos.z, 12, 0xe1f5fe, 0.8);
  };

  // 거미 — spider
  function lastProp() {
    return world.props[world.props.length - 1];
  }
  function webDecal(r, col) {
    const g = new T.Group();
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push(0, 0.02, 0, Math.cos(a) * r, 0.02, Math.sin(a) * r);
    }
    for (let k = 1; k <= 3; k++)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2,
          b = ((i + 1) / 8) * Math.PI * 2,
          rr = (r * k) / 3;
        pts.push(Math.cos(a) * rr, 0.02, Math.sin(a) * rr, Math.cos(b) * rr, 0.02, Math.sin(b) * rr);
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    g.add(new T.LineSegments(geo, new T.LineBasicMaterial({ color: col, transparent: !0, opacity: 0.55 })));
    return g;
  }
  H.x_web_trap = () => {
    const c = player,
      p = aimAt(20);
    makeTrap(p.x, p.z, 3.2, 0xe0e0e0, (t) => {
      st(t, "root", 2.5);
      st(t, "revealed", 5);
      burst(t.pos.x, t.pos.z, 2, 0xf5f5f5, 0.4);
      const w = webDecal(1.6, 0xffffff);
      w.position.set(t.pos.x, abilityGroundY(t.pos.x, t.pos.z, t.y) + 0.06, t.pos.z);
      scene.add(w);
      live(2.5, null, () => drop(w));
      tellTeam(c, "거미줄에 걸림", "#e0e0e0");
    }, undefined, p.y);
    const pr = lastProp();
    if (pr && pr.ring) {
      const w = webDecal(3.2, 0xeeeeee);
      w.rotation.x = Math.PI / 2;
      pr.ring.add(w);
    }
  };
  H.x_silk_pull = () => {
    const c = player,
      s = scan(c, 30, 1.0);
    tracer(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, 0xf5f5f5, 0.03, 0.4);
    if (!s.hit) return;
    const e = s.hit;
    shove(e, c.pos.x - e.pos.x, c.pos.z - e.pos.z, Math.min(7, Math.max(0, dist2D(e, c.pos.x, c.pos.z) - 1.5)), 0.3);
    slowA(e, 0.6, 2);
    burst(e.pos.x, e.pos.z, 1, 0xffffff, 1.2);
  };
  H.x_cocoon = () => {
    const c = player;
    c.invuln = Math.max(c.invuln || 0, 2);
    c.root = Math.max(c.root || 0, 2);
    heal(c, 40);
    const egg = new T.Mesh(new T.SphereGeometry(1, 18, 14), mat(0xf5f5f5, 0.55));
    egg.scale.set(0.8, 1.25, 0.8);
    const w = webDecal(1.1, 0xbdbdbd);
    egg.add(w);
    scene.add(egg);
    live(2, (t) => void egg.position.set(c.pos.x, (c.y || 0) + 1.1, c.pos.z), () => drop(egg), () => burst(c.pos.x, c.pos.z, 2, 0xffffff));
  };
  H.x_ult_nest = () => {
    const c = player,
      p = aimAt(30),
      R = 16;
    const g = webDecal(R, 0xe0e0e0);
    g.position.set(p.x, abilityGroundY(p.x, p.z, p.y) + 0.06, p.z);
    scene.add(g);
    const base = disc(p.x, p.z, R, 0x424242, 0.18, p.y);
    const inside = new Map();
    live(12, (t, dt) => {
      for (const e of foesOf(c)) {
        if (dist2D(e, p.x, p.z) > R) {
          inside.delete(e);
          continue;
        }
        slowA(e, 0.5, 0.3);
        st(e, "revealed", 0.6);
        const s = (inside.get(e) || 0) + dt;
        if (s >= 3) {
          st(e, "root", 2);
          burst(e.pos.x, e.pos.z, 1.5, 0xffffff, 1);
          inside.set(e, -2);
        } else inside.set(e, s);
      }
    }, () => (drop(g), drop(base)));
    burst(p.x, p.z, 4, 0xe0e0e0, 0.5);
  };

  // 별빛 — stars
  H.x_meteor = () => {
    const c = player,
      p = aimAt(35);
    const w = ring(p.x, p.z, 6, 0xb39ddb, 0.8, 0.35, p.y),
      fill = disc(p.x, p.z, 6, 0x7e57c2, 0.12, p.y);
    const rock = new T.Mesh(new T.IcosahedronGeometry(0.9, 0), mat(0xffcc80, 0.95, !0));
    scene.add(rock);
    live(1.2, (t) => {
      const k = t / 1.2;
      rock.position.set(p.x + 14 * (1 - k), abilityGroundY(p.x, p.z, p.y) + 1 + 32 * (1 - k), p.z - 10 * (1 - k));
      rock.rotation.x += 0.3;
      w.material.opacity = 0.5 + 0.4 * Math.sin(t * 20);
    }, () => (drop(w), drop(fill), drop(rock)), () => {
      burst(p.x, p.z, 6, 0xb39ddb);
      shardErupt(p.x, p.z, 5, 0x9575cd, 12);
      for (const e of within(foesOf(c), p.x, p.z, 6)) (hurt(e, fall(60, 24, dist2D(e, p.x, p.z), 6), c), applyConcuss(e, 2));
    });
  };
  H.x_levitate = () => {
    const c = player,
      p = aimAt(25);
    fxColumn(p.x, p.z, 0xb39ddb, 8, 1.2);
    ring(p.x, p.z, 6, 0xb39ddb, 0.6, undefined, p.y);
    const lifted = within(foesOf(c), p.x, p.z, 6);
    const r0 = ring(p.x, p.z, 6, 0xd1c4e9, 0.5, undefined, p.y);
    lifted.forEach((e) => (st(e, "root", 1.5), st(e, "revealed", 3)));
    live(1.5, (t) => {
      for (const e of lifted) {
        if (!e.alive) continue;
        e.onGround = !1;
        e.vy = (e.y || 0) < 2.2 ? 5 : 0.3;
        if (Math.random() < 0.3) {
          const g = dot(0xd1c4e9, 0.3, e.pos.x, (e.y || 0) + 0.2, e.pos.z);
          scene.remove(g);
          addFx(g, 0.4, (m, k) => (m.material.opacity = 1 - k));
        }
      }
    }, () => {
      drop(r0);
      lifted.forEach((e) => (e.vy = -3));
    });
  };
  H.x_antigrav = () => {
    const c = player;
    for (const a of within(mates(c), c.pos.x, c.pos.z, 7)) {
      a.vy = 13;
      a.onGround = !1;
      a._airT = 0;
      fxColumn(a.pos.x, a.pos.z, 0xd1c4e9, 6, 0.6);
    }
    fxRing(c.pos.x, c.pos.z, 7, 0xb39ddb, 0.6);
  };
  H.x_ult_blackhole = () => {
    const c = player,
      p = aimAt(35);
    const core = new T.Mesh(new T.SphereGeometry(1.6, 24, 16), new T.MeshBasicMaterial({ color: 0x050008 }));
    core.position.set(p.x, abilityGroundY(p.x, p.z, p.y) + 2.2, p.z);
    const disk = new T.Mesh(new T.RingGeometry(2, 5.5, 64), mat(0x9575cd, 0.6, !0));
    disk.rotation.x = -Math.PI / 2.4;
    core.add(disk);
    scene.add(core);
    const r20 = ring(p.x, p.z, 20, 0x7e57c2, 0.25, 0.4, p.y);
    const tick = every(0.25);
    live(5, (t, dt) => {
      disk.rotation.z += 4 * dt;
      core.scale.setScalar(1 + 0.08 * Math.sin(t * 12));
      const hitNow = tick(dt);
      for (const e of within(foesOf(c), p.x, p.z, 20)) {
        const d = dist2D(e, p.x, p.z) || 0.01,
          sp = 2 + 6 * (1 - d / 20);
        d > 0.8 && moveWithSlide(e.pos, ((p.x - e.pos.x) / d) * sp * dt, ((p.z - e.pos.z) / d) * sp * dt, e.y || 0, 0.4);
        slowA(e, 0.5, 0.3);
        hitNow && d < 6 && hurt(e, 2.5, c);
      }
      if (Math.random() < 0.6) {
        const a = Math.random() * 6.28,
          g = dot(0xb39ddb, 0.35, p.x + Math.cos(a) * 12, abilityGroundY(p.x, p.z, p.y) + 0.6 + Math.random() * 3, p.z + Math.sin(a) * 12);
        scene.remove(g);
        addFx(g, 0.8, (m, k) => ((m.position.x += (p.x - m.position.x) * 0.08), (m.position.z += (p.z - m.position.z) * 0.08), (m.material.opacity = 1 - k)));
      }
    }, () => (drop(core), drop(r20)), () => {
      burst(p.x, p.z, 8, 0x9575cd, 2);
      for (const e of within(foesOf(c), p.x, p.z, 8)) hurt(e, 40, c);
    });
  };

  // 칼날 — blades
  function bladeMesh(col, s) {
    const g = new T.Group();
    for (let i = 0; i < 2; i++) {
      const b = new T.Mesh(new T.BoxGeometry(1.4 * (s || 1), 0.04, 0.18 * (s || 1)), mat(col, 0.95, !0));
      b.rotation.y = (i * Math.PI) / 2;
      g.add(b);
    }
    g.add(glowDot(col, 0.6 * (s || 1)));
    scene.add(g);
    return g;
  }
  H.x_boomerang = (d, f) => {
    const c = player,
      e0 = eye(c),
      L = clearLen(e0.x, e0.z, f.x, f.z, 25, c.y);
    const b = bladeMesh(0xff8fc0);
    const pos = { x: e0.x, z: e0.z },
      hitOut = new Set(),
      hitBack = new Set();
    let back = !1;
    live(3.2, (t, dt) => {
      if (!back) {
        pos.x += f.x * 32 * dt;
        pos.z += f.z * 32 * dt;
        if (Math.hypot(pos.x - e0.x, pos.z - e0.z) >= L) back = !0;
      } else {
        const dx = c.pos.x - pos.x,
          dz = c.pos.z - pos.z,
          D = Math.hypot(dx, dz);
        if (D < 1.2) return !1;
        pos.x += (dx / D) * 36 * dt;
        pos.z += (dz / D) * 36 * dt;
      }
      b.position.set(pos.x, e0.y - 0.3, pos.z);
      b.rotation.y += 22 * dt;
      const set = back ? hitBack : hitOut;
      for (const e of within(foesOf(c), pos.x, pos.z, 1.4)) if (!set.has(e)) (set.add(e), hurt(e, 35, c), burst(e.pos.x, e.pos.z, 0.8, 0xff8fc0, 1.2));
    }, () => drop(b));
  };
  H.x_shadow_cut = (d, f) => {
    const c = player;
    const cands = inCone(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 22, 1.05).filter((a) => losOK(c, a));
    const tgt = nearest(cands, c.pos.x, c.pos.z, 23);
    if (!tgt) return void fxShatter(c.pos.x, c.pos.z, 0xff8fc0);
    const tf = fwdOf(tgt),
      ox = c.pos.x,
      oz = c.pos.z;
    let nx = tgt.pos.x - tf.x * 1.4,
      nz = tgt.pos.z - tf.z * 1.4;
    if (collideXZ(nx, nz, tgt.y || 0, 0.4)) (nx = tgt.pos.x + tf.z * 1.4), (nz = tgt.pos.z - tf.x * 1.4);
    if (collideXZ(nx, nz, tgt.y || 0, 0.4)) (nx = tgt.pos.x - (tgt.pos.x - ox) / (dist2D(tgt, ox, oz) || 1) * 1.4), (nz = tgt.pos.z - (tgt.pos.z - oz) / (dist2D(tgt, ox, oz) || 1) * 1.4);
    fxBolt(ox, 1.2, oz, nx, 1.2, nz, 0xff8fc0, 0.3);
    fxShatter(ox, oz, 0xff8fc0);
    c.pos.x = nx;
    c.pos.z = nz;
    c.vel && c.vel.set(0, 0, 0);
    c.yaw = Math.atan2(-(tgt.pos.x - nx), -(tgt.pos.z - nz));
    c.invuln = Math.max(c.invuln || 0, 0.3);
    fxArc(nx, nz, c.yaw, 3, 0xff8fc0);
    hurt(tgt, 40, c);
    burst(tgt.pos.x, tgt.pos.z, 1.2, 0xff8fc0, 1.3);
  };
  H.x_mark_knife = () => {
    const c = player,
      s = scan(c, 40, 0.7);
    tracer(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, 0xff5252, 0.04, 0.3);
    if (!s.hit) return;
    st(s.hit, "vuln", 5);
    st(s.hit, "revealed", 5);
    headMark(s.hit, 0xff1744, 5, 0.5);
    tellTeam(c, "표식 — 받는 피해 1.5배", "#ff8fc0");
  };
  H.x_ult_thousand = () => {
    const c = player,
      blades = [];
    for (let i = 0; i < 8; i++) blades.push(bladeMesh(0xff8fc0, 0.55));
    let cd = 0.3;
    live(8, (t, dt) => {
      if (!c.alive) return !1;
      blades.forEach((b, i) => {
        const a = t * 2.4 + (i / 8) * Math.PI * 2;
        b.position.set(c.pos.x + Math.cos(a) * 1.4, (c.y || 0) + 1.3 + 0.15 * Math.sin(t * 5 + i), c.pos.z + Math.sin(a) * 1.4);
        b.rotation.y += 10 * dt;
      });
      if ((cd -= dt) > 0 || !blades.length) return;
      const f = fwdOf(c),
        tg = nearest(inCone(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 30, 0.9).filter((a) => losOK(c, a)), c.pos.x, c.pos.z, 31);
      if (!tg) return;
      cd = 0.5;
      const b = blades.pop();
      tracer(b.position.x, b.position.y, b.position.z, tg.pos.x, (tg.y || 0) + 1.2, tg.pos.z, 0xff8fc0, 0.06, 0.25);
      drop(b);
      hurt(tg, 45, c);
      burst(tg.pos.x, tg.pos.z, 1, 0xff8fc0, 1.2);
    }, () => blades.forEach(drop));
  };

  // 덩굴 — vines
  H.x_thorn_field = (d, f) => {
    const c = player,
      sx = c.pos.x + f.x * 2,
      sz = c.pos.z + f.z * 2,
      L = clearLen(sx, sz, f.x, f.z, 20, c.y);
    const g = new T.Group();
    const strip = new T.Mesh(new T.PlaneGeometry(3.2, L), mat(0x2e7d32, 0.3));
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = -c.yaw;
    groundPosition(strip, sx + (f.x * L) / 2, 0.05, sz + (f.z * L) / 2);
    g.add(strip);
    for (let k = 0.6; k < L; k += 1.1)
      for (const side of [-1, 1]) {
        const th = new T.Mesh(new T.ConeGeometry(0.16, 0.9 + Math.random() * 0.6, 5), new T.MeshStandardMaterial({ color: 0x33691e, roughness: 0.8 }));
        groundPosition(th, sx + f.x * k - f.z * side * (0.4 + Math.random() * 0.9), 0.35, sz + f.z * k + f.x * side * (0.4 + Math.random() * 0.9));
        th.rotation.z = (Math.random() - 0.5) * 0.6;
        g.add(th);
      }
    scene.add(g);
    const tick = every(0.25);
    live(8, (t, dt) => {
      const h = tick(dt);
      for (const e of onLine(foesOf(c), sx, sz, f.x, f.z, L, 1.6)) (slowA(e, 0.5, 0.3), h && hurt(e, 2, c));
    }, () => drop(g));
  };
  H.x_vine_snare = () => {
    const c = player,
      p = aimAt(25);
    const w = ring(p.x, p.z, 5, 0x66bb6a, 0.8, undefined, p.y);
    later(0.6, () => {
      drop(w);
      shardErupt(p.x, p.z, 5, 0x43a047, 14);
      for (const e of within(foesOf(c), p.x, p.z, 5)) (st(e, "root", 2), burst(e.pos.x, e.pos.z, 1, 0x66bb6a, 0.6));
    });
  };
  function particleCloud(x, z, r, col, life, rate) {
    return live(life, () => {
      if (Math.random() > rate) return;
      const a = Math.random() * 6.28,
        rr = Math.sqrt(Math.random()) * r,
        g = dot(col, 0.25 + Math.random() * 0.25, x + Math.cos(a) * rr, abilityGroundY(x, z) + 0.3 + Math.random() * 2.2, z + Math.sin(a) * rr);
      scene.remove(g);
      addFx(g, 1.2, (m, k) => ((m.position.y += 0.01), (m.material.opacity = Math.sin(k * Math.PI))));
    });
  }
  H.x_pollen = () => {
    const c = player,
      p = aimAt(20),
      base = disc(p.x, p.z, 7, 0xfff176, 0.12, p.y);
    particleCloud(p.x, p.z, 7, 0xfff59d, 6, 0.9);
    live(6, () => {
      for (const e of within(foesOf(c), p.x, p.z, 7)) applyConcuss(e, 0.6);
    }, () => drop(base));
  };
  H.x_ult_jungle = () => {
    const c = player,
      p = aimAt(30),
      R = 16;
    const g = new T.Group();
    g.add(disc(0, 0, R, 0x1b5e20, 0.3));
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * 6.28,
        rr = Math.sqrt(Math.random()) * R,
        h = 0.8 + Math.random() * 2.4;
      const s = new T.Mesh(new T.ConeGeometry(0.25 + Math.random() * 0.3, h, 5), new T.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0x2e7d32 : 0x558b2f, roughness: 0.85 }));
      s.position.set(Math.cos(a) * rr, h / 2, Math.sin(a) * rr);
      g.add(s);
    }
    g.position.set(p.x, abilityGroundY(p.x, p.z, p.y), p.z);
    scene.add(g);
    const tick = every(0.5);
    live(10, (t, dt) => {
      const h = tick(dt);
      for (const e of within(foesOf(c), p.x, p.z, R)) (slowA(e, 0.4, 0.3), st(e, "nearsight", 0.6));
      if (h) for (const a of within(mates(c), p.x, p.z, R)) heal(a, 3);
    }, () => drop(g));
    shardErupt(p.x, p.z, R, 0x43a047, 20);
  };

  // 늪지 — swamp
  H.x_toxic_cloud = () => {
    const c = player,
      p = aimAt(30),
      s = makeSmoke(p, 7 / SMK(), 14, 0x7cb342);
    const tick = every(0.25);
    live(14, (t, dt) => {
      const h = tick(dt),
        x = s ? s.x : p.x,
        z = s ? s.z : p.z;
      if (h) for (const e of within(foesOf(c), x, z, 7)) hurt(e, 1.5, c);
    });
  };
  H.x_mire = () => {
    const c = player,
      p = aimAt(25),
      base = disc(p.x, p.z, 8, 0x4e342e, 0.45, p.y),
      edge = ring(p.x, p.z, 8, 0x8d6e63, 0.5, undefined, p.y);
    const tick = every(1);
    live(6, (t, dt) => {
      const h = tick(dt);
      for (const e of within(foesOf(c), p.x, p.z, 8)) (slowA(e, 0.4, 0.3), h && isHost() && applyDecay(e, 4, 6));
      if (Math.random() < 0.25) {
        const a = Math.random() * 6.28,
          rr = Math.random() * 7,
          b = dot(0x9ccc65, 0.3, p.x + Math.cos(a) * rr, abilityGroundY(p.x, p.z, p.y) + 0.1, p.z + Math.sin(a) * rr);
        scene.remove(b);
        addFx(b, 0.6, (m, k) => ((m.position.y = abilityGroundY(m.position.x, m.position.z) + 0.1 + 0.4 * k), (m.material.opacity = 1 - k)));
      }
    }, () => (drop(base), drop(edge)));
  };
  H.x_leech = () => {
    const c = player,
      s = scan(c, 35, 0.8);
    tracer(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, 0x8bc34a, 0.05, 0.3);
    if (!s.hit) return;
    const e = s.hit,
      link = beamMesh(0xb71c1c, 0.03, 0.6),
      tick = every(0.5);
    live(3, (t, dt) => {
      if (!e.alive || !c.alive) return !1;
      placeBeam(link, c.pos.x, (c.y || 0) + 1.2, c.pos.z, e.pos.x, (e.y || 0) + 1.1, e.pos.z);
      if (tick(dt)) (hurt(e, 5, c), heal(c, 5));
    }, () => drop(link));
    headMark(e, 0x689f38, 3, 0.45);
  };
  H.x_ult_plague = (d, f) => {
    const c = player;
    for (let i = 0; i < 3; i++) later(0.1 * i, () => fxArc(c.pos.x, c.pos.z, c.yaw, 40, 0x9ccc65));
    later(0.3, () => {
      const first = inCone(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 40, 0.79),
        seen = new Set(first);
      for (const e of first) {
        isHost() && applyDecay(e, 30, 8);
        st(e, "vuln", 6);
        headMark(e, 0x76ff03, 6, 0.5);
      }
      for (const e of first)
        for (const o of within(foesOf(c), e.pos.x, e.pos.z, 6))
          if (!seen.has(o)) {
            seen.add(o);
            isHost() && applyDecay(o, 15, 6);
            st(o, "vuln", 3);
            fxBolt(e.pos.x, 1.2, e.pos.z, o.pos.x, 1.2, o.pos.z, 0x76ff03, 0.4);
          }
      tellTeam(c, seen.size ? `역병 — ${seen.size}명 감염` : "역병 — 아무도 없음", "#9ccc65");
    });
  };

  // 등불 — lantern
  function lanternMesh(col, s) {
    const g = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 1.6 * s, 8), new T.MeshStandardMaterial({ color: 0x4e342e }));
    pole.position.y = 0.8 * s;
    const lamp = new T.Mesh(new T.CylinderGeometry(0.28 * s, 0.22 * s, 0.5 * s, 8), mat(col, 0.85, !0));
    lamp.position.y = 1.75 * s;
    const glow = glowDot(col, 2.2 * s, 2);
    glow.position.y = 1.75 * s;
    g.add(pole, lamp, glow);
    scene.add(g);
    return g;
  }
  H.x_lantern_heal = (d, f) => {
    const c = player,
      x = c.pos.x + f.x * 0.8,
      z = c.pos.z + f.z * 0.8,
      L = lanternMesh(0xffcc80, 1);
    L.position.set(x, abilityGroundY(x, z), z);
    const r7 = ring(x, z, 7, 0xffcc80, 0.35),
      r14 = ring(x, z, 14, 0xffe0b2, 0.12);
    const tick = every(0.5);
    live(20, (t, dt) => {
      L.children[2].material.opacity = 0.75 + 0.2 * Math.sin(t * 4);
      if (tick(dt)) for (const a of within(mates(c), x, z, 7)) heal(a, 3);
      for (const e of within(foesOf(c), x, z, 14)) st(e, "revealed", 0.6);
    }, () => (drop(L), drop(r7), drop(r14)));
  };
  H.x_glare = (d, f) => {
    const c = player,
      cone = new T.Mesh(new T.ConeGeometry(9, 25, 24, 1, !0), mat(0xfff8e1, 0.35, !0));
    cone.position.set(c.pos.x + f.x * 12.5, (c.y || 0) + 1.4, c.pos.z + f.z * 12.5);
    cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(-f.x, 0, -f.z));
    scene.add(cone);
    addFx(cone, 0.35, (m, t) => (m.material.opacity = 0.35 * (1 - t)));
    for (const e of inCone(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 25, 0.36)) if (losOK(c, e)) (st(e, "blind", 1.8), "me" === e.ctrl && bannerMe("눈부심", "#fff59d"));
  };
  H.x_firefly = (d, f) => {
    const c = player,
      tg = nearest(foesOf(c), c.pos.x, c.pos.z, 40),
      g = dot(0xdcedc8, 0.7, c.pos.x, (c.y || 0) + 1.6, c.pos.z);
    const pos = { x: c.pos.x, y: (c.y || 0) + 1.6, z: c.pos.z };
    let reached = !1;
    live(tg ? 9.5 : 2, (t, dt) => {
      g.material.opacity = 0.7 + 0.3 * Math.sin(t * 9);
      if (!tg) return void ((pos.x += f.x * 6 * dt), (pos.z += f.z * 6 * dt), g.position.set(pos.x, pos.y, pos.z));
      if (!tg.alive) return !1;
      const tx = tg.pos.x,
        tz = tg.pos.z,
        ty = (tg.y || 0) + 2.2,
        D = Math.hypot(tx - pos.x, tz - pos.z);
      if (!reached && D > 0.8) {
        const sp = Math.min(D, 14 * dt);
        pos.x += ((tx - pos.x) / D) * sp;
        pos.z += ((tz - pos.z) / D) * sp;
        pos.y += (ty - pos.y) * 0.1;
      } else ((reached = !0), (pos.x = tx + Math.cos(t * 3) * 0.6), (pos.z = tz + Math.sin(t * 3) * 0.6), (pos.y = ty));
      g.position.set(pos.x, pos.y, pos.z);
      reached && st(tg, "revealed", 0.6);
      if (reached && t > 9.4) return !1;
    }, () => scene.remove(g));
  };
  H.x_ult_dawn = () => {
    const c = player,
      sun = dot(0xffe082, 2, c.pos.x, (c.y || 0) + 2, c.pos.z);
    live(1.5, (t) => {
      sun.position.y = (c.y || 0) + 2 + t * 10;
      sun.scale.setScalar(2 + t * 8);
    }, () => scene.remove(sun), () => {
      "function" == typeof fxFlash && fxFlash(0xfff8e1, 10, 40, c.pos.x, 12, c.pos.z, 0.6, 3);
      burst(c.pos.x, c.pos.z, 30, 0xffe082, 4);
      for (const e of within(foesOf(c), c.pos.x, c.pos.z, 30)) (st(e, "blind", 3), st(e, "revealed", 6));
      for (const a of within(mates(c), c.pos.x, c.pos.z, 30)) heal(a, 40);
      tellTeam(c, "여명 — 아군 회복", "#ffe082");
    });
  };

  // 환영 — illusion
  H.x_clones = (d, f) => {
    const c = player,
      clones = [-0.22, 0.22].map((off) => {
        const g = ghostOf(c, 0.5),
          a = (c.yaw || 0) + off;
        return { g, p: new T.Vector3(c.pos.x, 0, c.pos.z), dx: -Math.sin(a), dz: -Math.cos(a), yaw: a, ph: 0, done: !1 };
      });
    const pop = (o) => {
      if (o.done) return;
      o.done = !0;
      burst(o.p.x, o.p.z, 7, 0xce93d8, 1.2);
      fxShatter(o.p.x, o.p.z, 0xe1bee7);
      for (const e of within(foesOf(c), o.p.x, o.p.z, 7)) (st(e, "blind", 1.5), st(e, "revealed", 4));
      ghostDrop(o.g);
    };
    live(3, (t, dt) => {
      for (const o of clones) {
        if (o.done) continue;
        moveWithSlide(o.p, o.dx * 5 * dt, o.dz * 5 * dt, 0, 0.45);
        o.g.group.position.set(o.p.x, abilityGroundY(o.p.x, o.p.z), o.p.z);
        o.g.group.rotation.y = o.yaw;
        o.ph += 9 * dt;
        try {
          animateFake(o.g, o.ph);
        } catch (e) {}
      }
    }, () => clones.forEach((o) => o.done || ((o.done = !0), ghostDrop(o.g))), () => clones.forEach(pop));
  };
  H.x_swap = (d, f) => {
    const c = player,
      cands = inCone(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 35, 0.14).filter((a) => losOK(c, a)),
      tg = nearest(cands, c.pos.x, c.pos.z, 36);
    if (!tg) return void fxShatter(c.pos.x + f.x * 3, c.pos.z + f.z * 3, 0xce93d8);
    const a = { x: c.pos.x, z: c.pos.z, y: c.y || 0 },
      b = { x: tg.pos.x, z: tg.pos.z, y: tg.y || 0 };
    fxBolt(a.x, 1.2, a.z, b.x, 1.2, b.z, 0xce93d8, 0.35);
    burst(a.x, a.z, 1.6, 0xce93d8);
    burst(b.x, b.z, 1.6, 0xce93d8);
    c.pos.x = b.x;
    c.pos.z = b.z;
    c.y = b.y;
    tg.pos.x = a.x;
    tg.pos.z = a.z;
    tg.y = a.y;
    c.vel && c.vel.set(0, 0, 0);
    tg.vel && tg.vel.set(0, 0, 0);
    c.invuln = Math.max(c.invuln || 0, 0.25);
    "me" === tg.ctrl && bannerMe("자리가 바뀌었다", "#ce93d8");
  };
  H.x_mirage_trap = () => {
    const c = player,
      p = aimAt(18);
    makeTrap(p.x, p.z, 3.2, 0xba68c8, (t) => {
      for (const e of within(foesOf(c), t.pos.x, t.pos.z, 4)) (slowA(e, 0.4, 3), st(e, "blind", 1.2));
      burst(t.pos.x, t.pos.z, 4, 0xce93d8, 1);
      fxShatter(t.pos.x, t.pos.z, 0xe1bee7);
    }, undefined, p.y);
  };
  H.x_ult_legion = () => {
    const c = player,
      p = aimAt(25),
      ph = [];
    for (let i = 0; i < 5; i++) {
      const a = (c.yaw || 0) + (i / 5) * Math.PI * 2,
        x = p.x + Math.sin(a) * 4,
        z = p.z + Math.cos(a) * 4;
      if (collideXZ(x, z, abilityGroundY(x, z), 0.45)) continue;
      const g = ghostOf(c, 0.45);
      g.group.position.set(x, abilityGroundY(x, z), z);
      ph.push({ g, x, z, cd: 0.4 + i * 0.24 });
      burst(x, z, 1.4, 0xce93d8, 1);
    }
    live(6, (t, dt) => {
      for (const o of ph) {
        if ((o.cd -= dt) > 0) continue;
        o.cd = 1.2;
        const cand = within(foesOf(c), o.x, o.z, 25).filter((e) => !rayBlocked(o.x, abilityGroundY(o.x, o.z) + 1.5, o.z, e.pos.x, (e.y || 0) + 1.2, e.pos.z)),
          e = nearest(cand, o.x, o.z, 26);
        if (!e) continue;
        o.g.group.rotation.y = Math.atan2(-(e.pos.x - o.x), -(e.pos.z - o.z));
        tracer(o.x, 1.4, o.z, e.pos.x, (e.y || 0) + 1.2, e.pos.z, 0xe1bee7, 0.04, 0.2);
        hurt(e, 12, c);
        st(e, "revealed", 2);
      }
    }, () => ph.forEach((o) => (fxShatter(o.x, o.z, 0xe1bee7), ghostDrop(o.g))));
  };

  // 울림 — sound
  H.x_tuning_fork = () => {
    const c = player;
    throwProjectile(0x80deea, 22, (x, y, z) => {
      const g = new T.Group();
      for (const s of [-1, 1]) {
        const prong = new T.Mesh(new T.BoxGeometry(0.08, 0.9, 0.08), mat(0xb2ebf2, 0.95, !0));
        prong.position.set(s * 0.14, 0.75, 0);
        g.add(prong);
      }
      const stem = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.5, 6), mat(0x80deea, 0.95));
      stem.position.y = 0.25;
      g.add(stem);
      g.position.set(x, abilityGroundY(x, z), z);
      scene.add(g);
      const pulse = every(0.4);
      live(4, (t, dt) => {
        g.rotation.y += 6 * dt;
        pulse(dt) && fxRing(x, z, 8, 0x80deea, 0.4);
        for (const e of within(foesOf(c), x, z, 8)) (applyConcuss(e, 0.6), st(e, "revealed", 0.6));
      }, () => drop(g));
    });
  };
  H.x_echolocate = () => {
    const c = player,
      x = c.pos.x,
      z = c.pos.z,
      seen = new Set(),
      r = ring(x, z, 1, 0x80deea, 0.8, 0.12);
    live(1.5, (t) => {
      const R = (t / 1.5) * 50;
      r.scale.setScalar(R);
      r.material.opacity = 0.8 * (1 - t / 1.5);
      for (const e of foesOf(c)) if (!seen.has(e) && dist2D(e, x, z) <= R) (seen.add(e), st(e, "revealed", 3), fxColumn(e.pos.x, e.pos.z, 0x80deea, 5, 0.8));
    }, () => drop(r), () => tellTeam(c, seen.size ? `반향 — ${seen.size}명` : "반향 — 없음", "#80deea"));
  };
  H.x_shriek_mine = () => {
    const c = player,
      p = aimAt(18);
    makeTrap(p.x, p.z, 3.2, 0x4dd0e1, (t) => {
      for (const e of within(foesOf(c), t.pos.x, t.pos.z, 6)) (st(e, "nearsight", 3), st(e, "revealed", 4));
      for (let i = 0; i < 3; i++) later(0.12 * i, () => fxRing(t.pos.x, t.pos.z, 6, 0x80deea, 0.5));
      tellTeam(c, "비명 지뢰 작동", "#80deea");
    }, undefined, p.y);
  };
  H.x_ult_soundwall = () => {
    const c = player,
      wall = new T.Mesh(new T.CylinderGeometry(15, 15, 3, 64, 1, !0), mat(0x80deea, 0.14, !0));
    scene.add(wall);
    const pulse = every(0.6);
    live(10, (t, dt) => {
      if (!c.alive) return !1;
      wall.position.set(c.pos.x, abilityGroundY(c.pos.x, c.pos.z) + 1.5, c.pos.z);
      wall.material.opacity = 0.1 + 0.06 * Math.sin(t * 8);
      pulse(dt) && fxRing(c.pos.x, c.pos.z, 15, 0x80deea, 0.5);
      for (const e of within(foesOf(c), c.pos.x, c.pos.z, 15)) (applyConcuss(e, 0.6), st(e, "nearsight", 0.6), st(e, "revealed", 0.6));
    }, () => drop(wall));
  };

  // 화산 — volcano
  H.x_lava_bomb = (d, f) => {
    const c = player,
      e0 = eye(c),
      L = clearLen(c.pos.x, c.pos.z, f.x, f.z, 22, c.y),
      stops = [10, 16, 20].map((k) => Math.min(k, L)).filter((v, i, a) => i === 0 || v > a[i - 1] + 0.5);
    const rock = new T.Mesh(new T.DodecahedronGeometry(0.4, 0), mat(0xff7043, 0.95, !0));
    rock.add(glowDot(0xff5722, 1.4));
    scene.add(rock);
    const seg = [];
    let prev = { x: e0.x, z: e0.z, y: e0.y - 0.3 },
      t0 = 0;
    stops.forEach((s, i) => {
      const to = { x: c.pos.x + f.x * s, z: c.pos.z + f.z * s, y: abilityGroundY(c.pos.x + f.x * s, c.pos.z + f.z * s, c.y) + .4 },
        dur = [0.45, 0.35, 0.3][i] || 0.3;
      seg.push({ from: prev, to, t0, t1: t0 + dur, h: [3.5, 2.2, 1.4][i] || 1.2, dmg: [30, 30, 20][i] || 20 });
      prev = to;
      t0 += dur;
    });
    let k = 0;
    live(t0 + 0.05, (t) => {
      while (k < seg.length && t >= seg[k].t1) {
        const s = seg[k++];
        burst(s.to.x, s.to.z, 5, 0xff7043, 0.8);
        for (const e of within(foesOf(c), s.to.x, s.to.z, 5)) hurt(e, fall(s.dmg, 10, dist2D(e, s.to.x, s.to.z), 5), c);
      }
      const s = seg[Math.min(k, seg.length - 1)];
      if (!s) return !1;
      const q = Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0)));
      rock.position.set(s.from.x + (s.to.x - s.from.x) * q, s.from.y + (s.to.y - s.from.y) * q + Math.sin(q * Math.PI) * s.h, s.from.z + (s.to.z - s.from.z) * q);
      rock.rotation.x += 0.4;
    }, () => drop(rock));
  };
  H.x_eruption_leap = (d, f) => {
    const c = player;
    burst(c.pos.x, c.pos.z, 3, 0xff7043, 0.3);
    shardErupt(c.pos.x, c.pos.z, 2.5, 0xff5722, 8);
    c.vy = 14;
    c.onGround = !1;
    c._airT = 0;
    shove(c, f.x, f.z, 12, 0.7);
    let landed = !1;
    live(2.6, (t) => {
      if (landed || t < 0.35) return;
      if (c.onGround || ((c.y || 0) <= 0.05 && (c.vy || 0) <= 0) || t > 2.5) {
        landed = !0;
        burst(c.pos.x, c.pos.z, 4, 0xff7043, 0.6);
        for (const e of within(foesOf(c), c.pos.x, c.pos.z, 4)) hurt(e, 30, c);
        return !1;
      }
    });
  };
  H.x_magma_shield = () => {
    const c = player;
    c.shielded = Math.max(c.shielded || 0, 5);
    const shell = new T.Mesh(new T.SphereGeometry(1.25, 20, 14), mat(0xff7043, 0.22, !0));
    scene.add(shell);
    const tick = every(0.25);
    live(5, (t, dt) => {
      if (!c.alive) return !1;
      shell.position.set(c.pos.x, (c.y || 0) + 1.1, c.pos.z);
      shell.material.opacity = 0.18 + 0.08 * Math.sin(t * 10);
      if (tick(dt)) for (const e of within(foesOf(c), c.pos.x, c.pos.z, 4)) hurt(e, 2.5, c);
    }, () => drop(shell));
  };
  H.x_ult_volcano = () => {
    const c = player,
      p = aimAt(30),
      warn = disc(p.x, p.z, 14, 0xff3d00, 0.12, p.y),
      edge = ring(p.x, p.z, 14, 0xff6e40, 0.7, undefined, p.y);
    const spots = [{ x: p.x, z: p.z }];
    for (let i = 0; i < 5; i++) {
      const a = (c.yaw || 0) + (i / 5) * Math.PI * 2 + 0.4;
      spots.push({ x: p.x + Math.sin(a) * 8, z: p.z + Math.cos(a) * 8 });
    }
    const times = [1, 1.5, 2.1, 2.7, 3.3, 4];
    let k = 0;
    live(4.3, (t) => {
      edge.material.opacity = 0.4 + 0.3 * Math.sin(t * 14);
      while (k < times.length && t >= times[k]) {
        const s = spots[k++];
        fxColumn(s.x, s.z, 0xff5722, 14, 0.5);
        burst(s.x, s.z, 4.5, 0xff7043, 0.8);
        shardErupt(s.x, s.z, 3, 0xff3d00, 8);
        for (const e of within(foesOf(c), s.x, s.z, 4.5)) hurt(e, fall(45, 15, dist2D(e, s.x, s.z), 4.5), c);
        withCaster(c, () => makeZone(s.x, s.z, 3.5 / RA(), 0.4, 3, 0xff5722, { dps: 10, name: "용암" }));
      }
    }, () => (drop(warn), drop(edge)));
  };

  // 수호 — guardian
  H.x_aegis = () => {
    const c = player,
      x = c.pos.x,
      z = c.pos.z,
      dome = new T.Mesh(new T.SphereGeometry(6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffe082, 0.16, !0));
    dome.position.set(x, abilityGroundY(x, z), z);
    scene.add(dome);
    const e = ring(x, z, 6, 0xffd54f, 0.6);
    live(6, (t) => {
      dome.material.opacity = 0.12 + 0.05 * Math.sin(t * 6);
      for (const a of within(mates(c), x, z, 6)) a.shielded = Math.max(a.shielded || 0, 0.3);
    }, () => (drop(dome), drop(e)));
  };
  H.x_guard_link = () => {
    const c = player,
      tg = nearest(mates(c).filter((a) => a !== c), c.pos.x, c.pos.z, 25) || c,
      line = beamMesh(0xffd54f, 0.04, 0.7),
      tick = every(1);
    tg.__guardT = Math.max(tg.__guardT || 0, 8);
    headMark(tg, 0xffd54f, 8, 0.45);
    live(8, (t, dt) => {
      if (!tg.alive) return !1;
      tg !== c ? placeBeam(line, c.pos.x, (c.y || 0) + 1.3, c.pos.z, tg.pos.x, (tg.y || 0) + 1.3, tg.pos.z) : (line.visible = !1);
      tick(dt) && heal(tg, 5);
    }, () => drop(line));
    tellTeam(c, tg === c ? "수호 연결 — 나에게" : "수호 연결 — " + (tg.name || "아군"), "#ffd54f");
  };
  H.x_rally_cry = () => {
    const c = player;
    for (const a of within(mates(c), c.pos.x, c.pos.z, 12)) {
      isHost() && (a.armor = Math.min(50, (a.armor || 0) + 30));
      a.slow = 1;
      a.slowT = 0;
      for (const k of ["root", "blind", "concuss", "nearsight", "silenced", "vuln", "forceCrouch", "suppress"]) a[k] = 0;
      fxColumn(a.pos.x, a.pos.z, 0xffd54f, 4, 0.6);
    }
    for (let i = 0; i < 3; i++) later(0.1 * i, () => fxRing(c.pos.x, c.pos.z, 12, 0xffd54f, 0.5));
  };
  H.x_ult_citadel = () => {
    const c = player,
      x = c.pos.x,
      z = c.pos.z,
      S = 5,
      Lw = 7,
      col = 0xbcaaa4;
    solid(x, z - S, Lw, 0.8, 3.2, col, 10, 600);
    solid(x, z + S, Lw, 0.8, 3.2, col, 10, 600);
    solid(x - S, z, 0.8, Lw, 3.2, col, 10, 600);
    solid(x + S, z, 0.8, Lw, 3.2, col, 10, 600);
    shardErupt(x, z, S + 1, 0xd7ccc8, 16);
    const tick = every(0.5);
    live(10, (t, dt) => {
      if (tick(dt)) for (const a of mates(c)) Math.abs(a.pos.x - x) < S && Math.abs(a.pos.z - z) < S && heal(a, 4);
    });
  };

  // 혈랑 — wolf
  H.x_rend = (d, f) => {
    const c = player,
      first = onLine(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 10.5, 1.2).find((a) => losOK(c, a));
    const len = first ? Math.max(0, dist2D(first, c.pos.x, c.pos.z) - 1.2) : 10,
      ox = c.pos.x,
      oz = c.pos.z;
    dashTo(c, f.x, f.z, len);
    fxBolt(ox, 1, oz, c.pos.x, 1, c.pos.z, 0xff2a3d, 0.25);
    c.invuln = Math.max(c.invuln || 0, 0.25);
    for (let i = 0; i < 3; i++) later(0.08 * i, () => fxArc(c.pos.x, c.pos.z, c.yaw + (i - 1) * 0.3, 3.5, 0xff1744));
    for (const e of within(foesOf(c), c.pos.x, c.pos.z, 3.5)) (hurt(e, 35, c), isHost() && applyDecay(e, 10, 5), burst(e.pos.x, e.pos.z, 1, 0xff1744, 1.2));
  };
  H.x_howl = () => {
    const c = player;
    for (let i = 0; i < 3; i++) later(0.14 * i, () => fxRing(c.pos.x, c.pos.z, 15, 0xff5252, 0.6));
    viewerShake(c.pos.x, c.pos.z, 0.3);
    for (const e of within(foesOf(c), c.pos.x, c.pos.z, 15)) (st(e, "forceCrouch", 2), st(e, "revealed", 4));
  };
  function aura(c, col, life, size) {
    return live(life, () => {
      if (!c.alive) return !1;
      if (Math.random() < 0.6) {
        const g = dot(col, size || 0.3, c.pos.x + (Math.random() - 0.5) * 0.9, (c.y || 0) + 0.3 + Math.random() * 1.6, c.pos.z + (Math.random() - 0.5) * 0.9);
        scene.remove(g);
        addFx(g, 0.5, (m, k) => ((m.position.y += 0.02), (m.material.opacity = 1 - k)));
      }
    });
  }
  H.x_feral = () => {
    const c = player;
    speedUp(c, 1.35, 6);
    immune(c, 6);
    aura(c, 0xff5252, 6);
  };
  H.x_ult_bloodmoon = () => {
    const c = player,
      moon = dot(0xff1744, 4, c.pos.x, (c.y || 0) + 14, c.pos.z);
    speedUp(c, 1.4, 10);
    st(c, "lifesteal", 10);
    aura(c, 0xb71c1c, 10, 0.35);
    live(10, () => {
      if (!c.alive) return !1;
      moon.position.set(c.pos.x, (c.y || 0) + 14, c.pos.z);
      for (const e of foesOf(c)) e.hp < 50 && dist2D(e, c.pos.x, c.pos.z) < 50 && st(e, "revealed", 0.6);
    }, () => scene.remove(moon));
  };

  // 송골 — falcon
  function birdMesh(col) {
    const g = new T.Group();
    const body = new T.Mesh(new T.ConeGeometry(0.18, 0.8, 6), new T.MeshStandardMaterial({ color: col, roughness: 0.7 }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.PlaneGeometry(0.9, 0.3), new T.MeshStandardMaterial({ color: col, side: T.DoubleSide, roughness: 0.7 }));
      w.position.set(s * 0.5, 0, 0);
      w.userData.side = s;
      g.add(w);
    }
    scene.add(g);
    return g;
  }
  const flap = (g, t) => g.children.forEach((w) => w.userData.side && (w.rotation.z = w.userData.side * Math.sin(t * 16) * 0.6));
  H.x_feather_volley = () => {
    const c = player;
    for (const off of [-0.1, 0, 0.1]) {
      const s = scan(c, 40, 0.8, off);
      tracer(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, 0xd7ccc8, 0.035, 0.3);
      if (s.hit) (hurt(s.hit, 18, c), st(s.hit, "revealed", 4), burst(s.hit.pos.x, s.hit.pos.z, 0.6, 0xefebe9, 1.3));
    }
  };
  H.x_hawk_eye = (d, f) => {
    const c = player,
      b = birdMesh(0x8d6e63),
      x0 = c.pos.x,
      z0 = c.pos.z,
      L = clearLen(x0, z0, f.x, f.z, 45, 4),
      seen = new Set();
    let s = 0;
    b.rotation.y = c.yaw;
    live(L / 22 + 0.1, (t, dt) => {
      s = Math.min(L, s + 22 * dt);
      const x = x0 + f.x * s,
        z = z0 + f.z * s;
      b.position.set(x, abilityGroundY(x, z) + 5, z);
      flap(b, t);
      for (const e of within(foesOf(c), x, z, 10)) if (!seen.has(e)) (seen.add(e), st(e, "revealed", 4), fxColumn(e.pos.x, e.pos.z, 0xbcaaa4, 6, 0.8));
    }, () => drop(b), () => tellTeam(c, seen.size ? `매의 눈 — ${seen.size}명` : "매의 눈 — 없음", "#d7ccc8"));
  };
  H.x_feather_smoke = () => {
    const c = player;
    makeSmokeAt(c.pos.x, c.pos.z, 5 / SMK(), 10, 0xd7ccc8);
    speedUp(c, 1.3, 3);
    burst(c.pos.x, c.pos.z, 3, 0xefebe9, 1);
  };
  H.x_ult_skyhunter = () => {
    const c = player,
      b = birdMesh(0x6d4c41);
    let cd = 1.2;
    live(10, (t, dt) => {
      if (!c.alive) return !1;
      const a = t * 1.3;
      b.position.set(c.pos.x + Math.cos(a) * 6, (c.y || 0) + 12, c.pos.z + Math.sin(a) * 6);
      b.rotation.y = -a;
      flap(b, t);
      const near = within(foesOf(c), c.pos.x, c.pos.z, 35);
      near.forEach((e) => st(e, "revealed", 0.6));
      if ((cd -= dt) <= 0) {
        cd = 2;
        const e = nearest(near, c.pos.x, c.pos.z, 36);
        if (e) (fxBolt(b.position.x, b.position.y, b.position.z, e.pos.x, (e.y || 0) + 1.4, e.pos.z, 0xd7ccc8, 0.3), hurt(e, 25, c), burst(e.pos.x, e.pos.z, 1.2, 0xd7ccc8, 1.3));
      }
    }, () => drop(b));
  };

  // 해랑 — tide
  H.x_water_cannon = (d, f) => {
    const c = player,
      s = scan(c, 25, 1.0),
      jet = beamMesh(0x4fc3f7, 0.22, 0.6);
    placeBeam(jet, s.e.x, s.e.y - 0.25, s.e.z, s.end.x, s.end.y, s.end.z);
    live(0.35, (t) => (jet.material.opacity = 0.6 * (1 - t / 0.35)), () => drop(jet));
    burst(s.end.x, s.end.z, 1.4, 0x81d4fa, s.end.y, true);
    if (!s.hit) return;
    shove(s.hit, f.x, f.z, 10, 0.35);
    hurt(s.hit, 15, c);
    st(s.hit, "nearsight", 1);
  };
  H.x_ebb = (d, f) => {
    const c = player,
      home = { x: c.pos.x, z: c.pos.z },
      mark = ring(home.x, home.z, 1.2, 0x4fc3f7, 0.8),
      round = world.round;
    dashTo(c, f.x, f.z, 10);
    fxBolt(home.x, 0.6, home.z, c.pos.x, 0.6, c.pos.z, 0x4fc3f7, 0.35);
    burst(c.pos.x, c.pos.z, 1.5, 0x81d4fa, 0.4);
    live(4, (t) => {
      mark.material.opacity = 0.4 + 0.4 * Math.sin(t * 6);
      if (!c.alive || world.round !== round) return !1;
    }, () => drop(mark), () => {
      if (!c.alive || world.round !== round || collideXZ(home.x, home.z, abilityGroundY(home.x, home.z), 0.4)) return;
      burst(c.pos.x, c.pos.z, 1.5, 0x81d4fa, 0.6);
      c.pos.x = home.x;
      c.pos.z = home.z;
      c.vel && c.vel.set(0, 0, 0);
      burst(home.x, home.z, 1.5, 0x4fc3f7, 0.6);
      "me" === c.ctrl && bannerMe("썰물 — 귀환", "#4fc3f7");
    });
  };
  H.x_mist = () => {
    const c = player,
      p = aimAt(25),
      s = makeSmoke(p, 6 / SMK(), 12, 0xb3e5fc),
      tick = every(0.5);
    live(12, (t, dt) => {
      if (tick(dt)) for (const a of within(mates(c), s ? s.x : p.x, s ? s.z : p.z, 6)) heal(a, 2.5);
    });
  };
  H.x_ult_tsunami = (d, f) => {
    const c = player,
      ox = c.pos.x + f.x * 3,
      oz = c.pos.z + f.z * 3,
      px = -f.z,
      pz = f.x;
    const wave = new T.Mesh(new T.BoxGeometry(20, 5, 2.2), mat(0x29b6f6, 0.45));
    wave.rotation.y = c.yaw;
    scene.add(wave);
    const hit = new Set();
    let s = 0;
    live(2.5, (t, dt) => {
      const ds = 16 * dt;
      s += ds;
      groundPosition(wave, ox + f.x * s, 2.5 - 1.5 * (t / 2.5), oz + f.z * s);
      wave.scale.y = 1 - 0.5 * (t / 2.5);
      for (const e of foesOf(c)) {
        const rx = e.pos.x - ox,
          rz = e.pos.z - oz,
          along = rx * f.x + rz * f.z,
          lat = Math.abs(rx * px + rz * pz);
        if (lat > 10) continue;
        if (!hit.has(e) && along <= s + 1 && along >= s - 2) (hit.add(e), hurt(e, 25, c), slowA(e, 0.5, 4), burst(e.pos.x, e.pos.z, 1.2, 0x81d4fa, 1));
        if (hit.has(e) && e.alive) moveWithSlide(e.pos, f.x * ds, f.z * ds, e.y || 0, 0.4);
      }
      if (Math.random() < 0.8) {
        const k = (Math.random() * 2 - 1) * 10,
          g = dot(0xe1f5fe, 0.4, ox + f.x * s + px * k, (c.y || 0) + 4 * (1 - t / 2.5) + 0.5, oz + f.z * s + pz * k);
        scene.remove(g);
        addFx(g, 0.5, (m, q) => (m.material.opacity = 1 - q));
      }
    }, () => drop(wave));
  };

  // 묵향 — ink
  H.x_ink_smoke = () => {
    const c = player,
      p = aimAt(30),
      s = makeSmoke(p, 7 / SMK(), 14, 0x263238);
    live(14, () => {
      for (const e of within(foesOf(c), s ? s.x : p.x, s ? s.z : p.z, 7)) st(e, "revealed", 0.6);
    });
  };
  H.x_seal_trap = () => {
    const c = player,
      p = aimAt(18);
    makeTrap(p.x, p.z, 3, 0xd50000, (t) => {
      for (const e of within(foesOf(c), t.pos.x, t.pos.z, 5)) (st(e, "silenced", 5), st(e, "revealed", 5));
      const stamp = new T.Mesh(new T.PlaneGeometry(3.2, 3.2), mat(0xd50000, 0.7));
      stamp.rotation.x = -Math.PI / 2;
      stamp.position.set(t.pos.x, abilityGroundY(t.pos.x, t.pos.z, t.y) + 0.06, t.pos.z);
      scene.add(stamp);
      live(2, (k) => (stamp.material.opacity = 0.7 * (1 - k / 2)), () => drop(stamp));
      burst(t.pos.x, t.pos.z, 5, 0xff5252, 0.6);
      tellTeam(c, "낙관 — 능력 봉인", "#ff5252");
    }, undefined, p.y);
  };
  // a thrown blob that lands exactly where it was aimed
  function lob(c, p, dur, h, col, size, land) {
    const sx = c.pos.x,
      sz = c.pos.z,
      sy = (c.y || 0) + 1.4,
      m = new T.Mesh(new T.SphereGeometry(size, 10, 8), mat(col, 0.95));
    scene.add(m);
    live(dur, (t) => {
      const k = t / dur;
      m.position.set(sx + (p.x - sx) * k, sy + (abilityGroundY(p.x, p.z, p.y) + 0.2 - sy) * k + Math.sin(k * Math.PI) * h, sz + (p.z - sz) * k);
    }, () => drop(m), land);
  }
  H.x_ink_splash = () => {
    const c = player,
      p = aimAt(30);
    lob(c, p, 0.45, 2.5, 0x212121, 0.3, () => {
      const splat = disc(p.x, p.z, 5, 0x101010, 0.55, p.y);
      live(6, (t) => void (splat.material.opacity = 0.55 * (1 - t / 6)), () => drop(splat));
      burst(p.x, p.z, 5, 0x37474f, 0.6);
      for (const e of within(foesOf(c), p.x, p.z, 5)) (st(e, "nearsight", 3), slowA(e, 0.6, 2));
    });
  };
  H.x_ult_inkworld = () => {
    const c = player,
      wave = ring(c.pos.x, c.pos.z, 1, 0x212121, 0.8, 0.2);
    live(0.8, (t) => (wave.scale.setScalar(1 + t * 44), (wave.material.opacity = 0.8 * (1 - t / 0.8))), () => drop(wave));
    for (const e of within(foesOf(c), c.pos.x, c.pos.z, 35)) {
      st(e, "nearsight", 6);
      withCaster(c, () => makeSmokeAt(e.pos.x, e.pos.z, 3 / SMK(), 8, 0x263238));
    }
  };

  // 영월 — moon
  H.x_moon_cage = () => {
    const c = player,
      p = aimAt(25),
      R = 5,
      caged = within(foesOf(c), p.x, p.z, R),
      g = new T.Group();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2,
        bar = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 4, 6), mat(0xe8eaf6, 0.8, !0));
      bar.position.set(Math.cos(a) * R, 2, Math.sin(a) * R);
      g.add(bar);
    }
    g.position.set(p.x, abilityGroundY(p.x, p.z, p.y), p.z);
    scene.add(g);
    const e0 = ring(p.x, p.z, R, 0xc5cae9, 0.7, undefined, p.y);
    live(4, (t, dt) => {
      g.rotation.y += 0.4 * dt;
      for (const e of caged) {
        if (!e.alive) continue;
        slowA(e, 0.6, 0.3);
        const d = dist2D(e, p.x, p.z);
        if (d > R - 0.6) {
          const k = (R - 0.6) / (d || 1);
          e.pos.x = p.x + (e.pos.x - p.x) * k;
          e.pos.z = p.z + (e.pos.z - p.z) * k;
        }
      }
    }, () => (drop(g), drop(e0)));
  };
  H.x_moon_shadow = (d, f) => {
    const c = player,
      q = aimAt(35),
      L = clearLen(c.pos.x, c.pos.z, f.x, f.z, Math.hypot(q.x - c.pos.x, q.z - c.pos.z), c.y),
      tx = c.pos.x + f.x * Math.max(0, L - 0.7),
      tz = c.pos.z + f.z * Math.max(0, L - 0.7),
      sx = c.pos.x,
      sz = c.pos.z;
    const sh = disc(sx, sz, 0.9, 0x1a237e, 0.75),
      round = world.round;
    live(1.5, (t) => {
      const k = Math.min(1, t / 1.2);
      groundPosition(sh, sx + (tx - sx) * k, 0.06, sz + (tz - sz) * k);
      if (!c.alive || world.round !== round) return !1;
    }, () => drop(sh), () => {
      if (!c.alive || world.round !== round) return;
      burst(c.pos.x, c.pos.z, 1.4, 0xc5cae9, 1);
      c.pos.x = tx;
      c.pos.z = tz;
      c.vel && c.vel.set(0, 0, 0);
      burst(tx, tz, 1.8, 0xe8eaf6, 1);
    });
  };
  H.x_eclipse = () => {
    const c = player,
      p = aimAt(28),
      s = makeSmoke(p, 6 / SMK(), 12, 0x311b92);
    live(12, () => {
      for (const e of within(foesOf(c), s ? s.x : p.x, s ? s.z : p.z, 6)) st(e, "nearsight", 0.6);
    });
  };
  H.x_ult_fullmoon = () => {
    const c = player,
      moon = dot(0xe8eaf6, 5, c.pos.x, (c.y || 0) + 16, c.pos.z),
      halo = disc(c.pos.x, c.pos.z, 30, 0xc5cae9, 0.08);
    live(8, () => {
      if (!c.alive) return !1;
      moon.position.set(c.pos.x, (c.y || 0) + 16, c.pos.z);
      groundPosition(halo, c.pos.x, 0.05, c.pos.z);
      for (const e of within(foesOf(c), c.pos.x, c.pos.z, 30)) (st(e, "revealed", 0.6), slowA(e, 0.7, 0.3));
      for (const a of within(mates(c), c.pos.x, c.pos.z, 30)) speedUp(a, 1.2, 0.4);
    }, () => (scene.remove(moon), drop(halo)));
  };

  // 단비 — rain
  function rainCloud(r, col) {
    const g = new T.Group();
    for (let i = 0; i < 7; i++) {
      const s = glowDot(col, r * (0.5 + Math.random() * 0.4), 0.9);
      s.position.set((Math.random() - 0.5) * r * 1.4, Math.random() * 0.6, (Math.random() - 0.5) * r * 1.4);
      g.add(s);
    }
    const pts = [];
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * r * 2,
        z = (Math.random() - 0.5) * r * 2,
        y = -Math.random() * 5;
      pts.push(x, y, z, x, y - 0.6, z);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    const rain = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0xb3e5fc, transparent: !0, opacity: 0.6 }));
    g.add(rain);
    g.userData.rain = rain;
    scene.add(g);
    return g;
  }
  H.x_rain_heal = () => {
    const c = player,
      cl = rainCloud(3, 0x90a4ae),
      tick = every(0.5);
    live(8, (t, dt) => {
      if (!c.alive) return !1;
      cl.position.set(c.pos.x, (c.y || 0) + 6, c.pos.z);
      cl.userData.rain.position.y = -((t * 9) % 1.5);
      if (tick(dt)) for (const a of within(mates(c), c.pos.x, c.pos.z, 6)) heal(a, 4);
    }, () => drop(cl));
  };
  H.x_hail = () => {
    const c = player,
      p = aimAt(25),
      base = disc(p.x, p.z, 8, 0xb3e5fc, 0.15, p.y),
      tick = every(0.5);
    live(3, (t, dt) => {
      if (Math.random() < 0.9) {
        const a = Math.random() * 6.28,
          rr = Math.sqrt(Math.random()) * 8,
          x = p.x + Math.cos(a) * rr,
          z = p.z + Math.sin(a) * rr,
          h = new T.Mesh(new T.IcosahedronGeometry(0.12, 0), mat(0xffffff, 0.95));
        h.position.set(x, abilityGroundY(x, z) + 12, z);
        addFx(h, 0.45, (m, k) => (m.position.y = abilityGroundY(m.position.x, m.position.z) + 12 * (1 - k)));
      }
      if (tick(dt)) for (const e of within(foesOf(c), p.x, p.z, 8)) (hurt(e, 8, c), slowA(e, 0.6, 1));
    }, () => drop(base));
  };
  H.x_rainbow = (d, f) => {
    const c = player,
      sx = c.pos.x,
      sz = c.pos.z,
      L = clearLen(sx, sz, f.x, f.z, 20, c.y),
      g = new T.Group(),
      cols = [0xef5350, 0xffa726, 0xffee58, 0x66bb6a, 0x42a5f5, 0x7e57c2];
    cols.forEach((col, i) => {
      const s = new T.Mesh(new T.PlaneGeometry(0.45, L), mat(col, 0.45, !0));
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = -c.yaw;
      groundPosition(s, sx + (f.x * L) / 2 + -f.z * (i - 2.5) * 0.45, 0.06, sz + (f.z * L) / 2 + f.x * (i - 2.5) * 0.45);
      g.add(s);
    });
    scene.add(g);
    live(6, () => {
      for (const a of onLine(mates(c), sx, sz, f.x, f.z, L, 2)) speedUp(a, 1.4, 0.4);
    }, () => drop(g));
  };
  H.x_ult_monsoon = () => {
    const c = player,
      p = aimAt(30),
      R = 18,
      cl = rainCloud(9, 0x37474f),
      base = disc(p.x, p.z, R, 0x263238, 0.18, p.y);
    cl.position.set(p.x, abilityGroundY(p.x, p.z, p.y) + 14, p.z);
    let cd = 0.4,
      k = 0;
    const tick = every(0.5);
    live(8, (t, dt) => {
      cl.userData.rain.position.y = -((t * 9) % 1.5);
      if (tick(dt)) for (const a of within(mates(c), p.x, p.z, R)) heal(a, 3);
      if ((cd -= dt) > 0) return;
      cd = 1;
      const list = within(foesOf(c), p.x, p.z, R).sort((a, b) => String(a.id).localeCompare(String(b.id)));
      if (!list.length) return;
      const e = list[k++ % list.length];
      fxBolt(e.pos.x, 14, e.pos.z, e.pos.x, 0.2, e.pos.z, 0xe1f5fe, 0.35);
      burst(e.pos.x, e.pos.z, 1.5, 0xb3e5fc, 0.4);
      hurt(e, 20, c);
      applyConcuss(e, 1);
    }, () => (drop(cl), drop(base)));
  };

  // 철혈 — juggernaut
  H.x_ground_slam = (d, f) => {
    const c = player;
    viewerShake(c.pos.x, c.pos.z, 0.45);
    for (let k = 2; k <= 12; k += 2.5) for (const s of [-1, 0, 1]) shardErupt(c.pos.x + f.x * k - f.z * s * k * 0.45, c.pos.z + f.z * k + f.x * s * k * 0.45, 1.1, 0x8d6e63, 3);
    for (const e of inCone(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 12, 0.7)) (hurt(e, 30, c), st(e, "forceCrouch", 2));
  };
  H.x_juggernaut = () => {
    const c = player,
      bumped = new Map();
    speedUp(c, 1.25, 5);
    immune(c, 5);
    aura(c, 0xff7043, 5, 0.32);
    live(5, (t) => {
      if (!c.alive) return !1;
      for (const e of within(foesOf(c), c.pos.x, c.pos.z, 1.7)) {
        if (t - (bumped.get(e) || -9) < 0.8) continue;
        bumped.set(e, t);
        shoveFrom(e, c.pos.x, c.pos.z, 5, 0.3);
        burst(e.pos.x, e.pos.z, 1, 0xffab91, 1);
      }
    });
  };
  H.x_rage = () => {
    const c = player;
    isHost() && (c.hp = Math.max(1, c.hp - 20));
    c.__rageT = 6;
    aura(c, 0xd50000, 6, 0.36);
    "me" === c.ctrl && bannerMe("격노 — 피해 +30%", "#ff5252");
  };
  H.x_ult_doom = () => {
    const c = player,
      q = aimAt(25),
      sx = c.pos.x,
      sz = c.pos.z,
      dx = q.x - sx,
      dz = q.z - sz,
      D = Math.hypot(dx, dz) || 1,
      L = clearLen(sx, sz, dx / D, dz / D, D, c.y),
      warn = ring(sx + (dx / D) * L, sz + (dz / D) * L, 7, 0xff3d00, 0.8);
    c.vy = 13;
    c.onGround = !1;
    c._airT = 0;
    shove(c, dx / D, dz / D, L, 0.8);
    let landed = !1;
    live(2.4, (t) => {
      if (landed || t < 0.45) return;
      if (c.onGround || ((c.y || 0) <= 0.05 && (c.vy || 0) <= 0) || t > 2.3) {
        landed = !0;
        drop(warn);
        const x = c.pos.x,
          z = c.pos.z;
        burst(x, z, 7, 0xff5722, 0.5);
        shardErupt(x, z, 7, 0x6d4c41, 18);
        viewerShake(x, z, 0.6);
        for (const e of within(foesOf(c), x, z, 7)) (hurt(e, fall(70, 30, dist2D(e, x, z), 7), c), applyConcuss(e, 3));
        withCaster(c, () => makeZone(x, z, 6 / RA(), 0.3, 4, 0x5d4037, { slow: 0.5, name: "구덩이" }));
        return !1;
      }
    }, () => !landed && drop(warn));
  };

  // 추적 — tracker
  H.x_tracker_dart = () => {
    const c = player,
      s = scan(c, 45, 0.6);
    tracer(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, 0xffab40, 0.03, 0.3);
    if (s.hit) return void (st(s.hit, "revealed", 10), headMark(s.hit, 0xffab40, 10, 0.4), tellTeam(c, "추적 다트 명중", "#ffab40"));
    const x = s.end.x - s.dx * 0.3,
      z = s.end.z - s.dz * 0.3,
      blip = dot(0xffab40, 0.5, x, abilityGroundY(x, z) + 1.2, z),
      r15 = ring(x, z, 15, 0xffab40, 0.15);
    live(15, (t) => {
      blip.material.opacity = 0.5 + 0.5 * Math.sin(t * 8);
      for (const e of within(foesOf(c), x, z, 15)) st(e, "revealed", 0.6);
    }, () => (scene.remove(blip), drop(r15)));
  };
  function houndMesh(col) {
    const g = new T.Group(),
      m = new T.MeshStandardMaterial({ color: col, roughness: 0.75, emissive: col, emissiveIntensity: 0.15 });
    const body = new T.Mesh(new T.BoxGeometry(0.35, 0.35, 0.9), m);
    body.position.y = 0.55;
    const head = new T.Mesh(new T.BoxGeometry(0.3, 0.3, 0.35), m);
    head.position.set(0, 0.8, -0.55);
    g.add(body, head);
    for (const [x, z] of [[-0.12, -0.3], [0.12, -0.3], [-0.12, 0.3], [0.12, 0.3]]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.08, 0.4, 0.08), m);
      leg.position.set(x, 0.2, z);
      leg.userData.leg = 1;
      g.add(leg);
    }
    scene.add(g);
    return g;
  }
  H.x_hound = (d, f) => {
    const c = player,
      tg = nearest(foesOf(c), c.pos.x, c.pos.z, 40),
      h = houndMesh(0x8d6e63),
      p = new T.Vector3(c.pos.x + f.x, c.y || 0, c.pos.z + f.z);
    let done = !1;
    live(tg ? 5 : 1.2, (t, dt) => {
      const tx = tg ? tg.pos.x : c.pos.x + f.x * 8,
        tz = tg ? tg.pos.z : c.pos.z + f.z * 8,
        D = Math.hypot(tx - p.x, tz - p.z);
      if (tg && !tg.alive) return !1;
      if (D > 1.4) moveWithSlide(p, ((tx - p.x) / D) * Math.min(D, 12 * dt), ((tz - p.z) / D) * Math.min(D, 12 * dt), abilityGroundY(p.x, p.z, p.y), 0.3);
      h.position.set(p.x, abilityGroundY(p.x, p.z, p.y), p.z);
      h.rotation.y = Math.atan2(-(tx - p.x), -(tz - p.z));
      h.children.forEach((l, i) => l.userData.leg && (l.rotation.x = Math.sin(t * 22 + i * 1.6) * 0.7));
      if (tg && D <= 1.5) {
        done = !0;
        hurt(tg, 20, c);
        slowA(tg, 0.5, 3);
        st(tg, "revealed", 4);
        burst(tg.pos.x, tg.pos.z, 1, 0xffab40, 1);
        return !1;
      }
    }, () => drop(h));
  };
  H.x_flare = () => {
    const c = player,
      p = aimAt(30),
      fl = dot(0xff6e40, 1.4, p.x, abilityGroundY(p.x, p.z, p.y) + 0.5, p.z),
      r20 = ring(p.x, p.z, 20, 0xff9e80, 0.18, undefined, p.y);
    live(6.5, (t) => {
      fl.position.y = abilityGroundY(p.x, p.z, p.y) + Math.min(8, 0.5 + t * 15);
      fl.material.opacity = 0.75 + 0.25 * Math.sin(t * 23);
      if (t > 0.5) for (const e of within(foesOf(c), p.x, p.z, 20)) st(e, "revealed", 0.6);
    }, () => (scene.remove(fl), drop(r20)));
  };
  H.x_ult_execution = (d, f) => {
    const c = player,
      tg = nearest(inCone(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 50, 0.8), c.pos.x, c.pos.z, 51);
    if (!tg) return void tellTeam(c, "처형 표식 — 대상 없음", "#ff6e40");
    tg.__execT = 10;
    tg.__execBy = c;
    st(tg, "revealed", 10);
    headMark(tg, 0xff1744, 10, 0.75);
    fxColumn(tg.pos.x, tg.pos.z, 0xff1744, 8, 1);
    tellTeam(c, "처형 표식 — 체력 30 아래면 즉시 처치", "#ff6e40");
    "me" === tg.ctrl && bannerMe("처형 표식이 붙었다", "#ff1744");
    execCheck(tg);
  };

  // 회로 — tech
  H.x_hack = (d, f) => {
    const c = player,
      cands = inCone(foesOf(c), c.pos.x, c.pos.z, f.x, f.z, 40, 0.14).filter((a) => losOK(c, a)),
      tg = nearest(cands, c.pos.x, c.pos.z, 41);
    const e = eye(c);
    if (!tg) return void fxBolt(e.x, e.y, e.z, e.x + f.x * 20, e.y, e.z + f.z * 20, 0x69f0ae, 0.25);
    for (let i = 0; i < 3; i++) fxBolt(e.x, e.y, e.z, tg.pos.x, (tg.y || 0) + 1.3, tg.pos.z, 0x69f0ae, 0.35);
    st(tg, "silenced", 5);
    st(tg, "revealed", 5);
    headMark(tg, 0x69f0ae, 5, 0.5);
    "me" === tg.ctrl && bannerMe("해킹당함 — 능력 봉인", "#69f0ae");
  };
  H.x_laser_turret = () => {
    const c = player,
      p = aimAt(15),
      g = new T.Group(),
      base = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 0.6, 10), new T.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.4 })),
      head = new T.Mesh(new T.BoxGeometry(0.3, 0.25, 0.5), mat(0x69f0ae, 0.9, !0));
    base.position.y = 0.3;
    head.position.y = 0.75;
    g.add(base, head);
    g.position.set(p.x, abilityGroundY(p.x, p.z, p.y), p.z);
    scene.add(g);
    const beam = beamMesh(0xff1744, 0.05, 0.85),
      last = new Map();
    live(8, (t) => {
      const a = t * Math.PI,
        dx = Math.sin(a),
        dz = Math.cos(a),
        L = clearLen(p.x, p.z, dx, dz, 10, abilityGroundY(p.x, p.z, p.y));
      head.rotation.y = a;
      placeBeam(beam, p.x, g.position.y + 0.75, p.z, p.x + dx * L, g.position.y + 0.75, p.z + dz * L);
      for (const e of onLine(foesOf(c), p.x, p.z, dx, dz, L, 0.9)) {
        if (t - (last.get(e) || -9) < 0.6) continue;
        last.set(e, t);
        hurt(e, 15, c);
        st(e, "revealed", 2);
        burst(e.pos.x, e.pos.z, 0.6, 0xff1744, 1);
      }
    }, () => (drop(g), drop(beam)));
  };
  H.x_holo_wall = (d, f) => {
    const c = player,
      p = aimAt(20),
      px = -f.z,
      pz = f.x,
      HALF = 7;
    const panel = new T.Mesh(new T.PlaneGeometry(HALF * 2, 3.6), mat(0x18ffff, 0.32, !0));
    panel.position.set(p.x, abilityGroundY(p.x, p.z, p.y) + 1.8, p.z);
    panel.rotation.y = c.yaw;
    scene.add(panel);
    const parts = [];
    for (let k = -HALF + 0.8; k <= HALF - 0.8; k += 1.6) {
      const o = { x: p.x + px * k, z: p.z + pz * k, r: 1.15, y: abilityGroundY(p.x, p.z, p.y), life: 15, maxLife: 15, mesh: new T.Group(), blocksVision: !0 };
      scene.add(o.mesh);
      world.smokes.push(o);
      parts.push(o);
    }
    live(15, (t) => {
      panel.material.opacity = 0.26 + 0.08 * Math.sin(t * 30) * Math.sin(t * 3);
    }, () => drop(panel));
  };
  function droneMesh(col) {
    const g = new T.Group(),
      core = new T.Mesh(new T.OctahedronGeometry(0.3), mat(col, 0.95, !0));
    g.add(core, glowDot(col, 0.9));
    for (let i = 0; i < 4; i++) {
      const r = new T.Mesh(new T.TorusGeometry(0.16, 0.02, 4, 12), mat(0xb0bec5, 0.8));
      r.rotation.x = Math.PI / 2;
      r.position.set(Math.cos((i * Math.PI) / 2) * 0.45, 0, Math.sin((i * Math.PI) / 2) * 0.45);
      g.add(r);
    }
    scene.add(g);
    return g;
  }
  H.x_ult_drones = (d, f) => {
    const c = player,
      targets = within(foesOf(c), c.pos.x, c.pos.z, 50).sort((a, b) => dist2D(a, c.pos.x, c.pos.z) - dist2D(b, c.pos.x, c.pos.z));
    for (let i = 0; i < 4; i++) {
      const tg = targets.length ? targets[i % targets.length] : null,
        m = droneMesh(0x69f0ae),
        a = (c.yaw || 0) + (i - 1.5) * 0.5,
        p = { x: c.pos.x - Math.sin(a) * 1.5, y: (c.y || 0) + 2.4, z: c.pos.z - Math.cos(a) * 1.5 };
      let boom = !1;
      const pop = () => {
        if (boom) return;
        boom = !0;
        burst(p.x, p.z, 3, 0x69f0ae, p.y, true);
        for (const e of within(foesOf(c), p.x, p.z, 3)) (hurt(e, 40, c), st(e, "revealed", 5));
      };
      live(tg ? 8 : 2, (t, dt) => {
        m.rotation.y += 8 * dt;
        if (tg && tg.alive) {
          const dx = tg.pos.x - p.x,
            dz = tg.pos.z - p.z,
            dy = (tg.y || 0) + 1.2 - p.y,
            D = Math.hypot(dx, dz, dy) || 1,
            s = Math.min(D, 10 * dt);
          p.x += (dx / D) * s;
          p.z += (dz / D) * s;
          p.y += (dy / D) * s;
          if (Math.hypot(dx, dz) < 1.5) return void (pop(), (m.visible = !1));
          if (collideXZ(p.x, p.z, p.y, 0.2) && t > 0.3) return void (pop(), (m.visible = !1));
        } else ((p.x += f.x * 9 * dt), (p.z += f.z * 9 * dt));
        m.position.set(p.x, p.y, p.z);
        if (boom) return !1;
      }, () => drop(m), pop);
    }
  };

  // 약초 — herbs
  H.x_potion_heal = () => {
    const c = player,
      hurtList = within(mates(c), c.pos.x, c.pos.z, 30).filter((a) => a.hp < 100).sort((a, b) => a.hp - b.hp),
      tg = hurtList[0] || c,
      flask = new T.Mesh(new T.SphereGeometry(0.18, 10, 8), mat(0x76ff03, 0.95, !0)),
      sx = c.pos.x,
      sz = c.pos.z;
    scene.add(flask);
    live(0.5, (t) => {
      const k = t / 0.5;
      groundPosition(flask, sx + (tg.pos.x - sx) * k, 1.4 + Math.sin(k * Math.PI) * 2.5, sz + (tg.pos.z - sz) * k);
    }, () => drop(flask), () => {
      if (!tg.alive) return;
      heal(tg, 40);
      burst(tg.pos.x, tg.pos.z, 1.6, 0x76ff03, 1);
      const tick = every(1);
      live(3, (t, dt) => tick(dt) && heal(tg, 5));
    });
  };
  H.x_sleep_powder = () => {
    const c = player,
      p = aimAt(20);
    particleCloud(p.x, p.z, 5, 0xce93d8, 1.4, 0.95);
    const w = ring(p.x, p.z, 5, 0xba68c8, 0.6, undefined, p.y);
    later(0.8, () => {
      drop(w);
      for (const e of within(foesOf(c), p.x, p.z, 5)) {
        st(e, "root", 3);
        e.__sleepT = 3;
        headMark(e, 0xb39ddb, 3, 0.4);
        "me" === e.ctrl && bannerMe("잠듦 — 맞으면 깬다", "#ce93d8");
      }
    });
  };
  H.x_herb_heal = (d, f) => {
    const c = player,
      x = c.pos.x + f.x * 0.6,
      z = c.pos.z + f.z * 0.6,
      bag = new T.Mesh(new T.SphereGeometry(0.28, 10, 8), new T.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9, emissive: 0x33691e, emissiveIntensity: 0.3 })),
      leaf = glowDot(0x9ccc65, 0.9);
    bag.position.set(x, abilityGroundY(x, z) + 0.3, z);
    leaf.position.set(x, abilityGroundY(x, z) + 0.7, z);
    scene.add(bag);
    scene.add(leaf);
    const r3 = ring(x, z, 3, 0x9ccc65, 0.35);
    live(20, (t) => {
      bag.position.y = abilityGroundY(x, z) + 0.3 + 0.08 * Math.sin(t * 3);
      const a = within(mates(c), x, z, 3).filter((m) => m.hp < 100).sort((p, q) => p.hp - q.hp)[0];
      if (a) return void (heal(a, 50), burst(a.pos.x, a.pos.z, 1.5, 0x9ccc65, 1), !1);
    }, () => (drop(bag), scene.remove(leaf), drop(r3)));
  };
  H.x_ult_garden_heal = () => {
    const c = player,
      x = c.pos.x,
      z = c.pos.z,
      R = 12,
      g = new T.Group();
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28,
        rr = Math.sqrt(Math.random()) * R,
        fl = new T.Mesh(new T.SphereGeometry(0.16, 6, 5), mat([0xf48fb1, 0xfff59d, 0xce93d8, 0x80deea][i % 4], 0.95, !0));
      fl.position.set(Math.cos(a) * rr, 0.25 + Math.random() * 0.2, Math.sin(a) * rr);
      g.add(fl);
    }
    g.position.set(x, abilityGroundY(x, z), z);
    scene.add(g);
    const base = disc(x, z, R, 0x66bb6a, 0.16),
      tick = every(0.5);
    live(12, (t, dt) => {
      const h = tick(dt);
      for (const a of within(mates(c), x, z, R)) (st(a, "undying", 0.6), h && heal(a, 5));
      for (const e of within(foesOf(c), x, z, R)) slowA(e, 0.7, 0.3);
    }, () => (drop(g), drop(base)));
    burst(x, z, 4, 0x9ccc65, 0.6);
  };

  // 철벽 — fortress
  H.x_mortar = () => {
    const c = player,
      p = aimAt(60),
      sx = c.pos.x,
      sz = c.pos.z,
      shell = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), mat(0x546e7a, 0.95)),
      warn = ring(p.x, p.z, 6, 0xff7043, 0.7, undefined, p.y);
    shell.add(glowDot(0xffab40, 0.6));
    scene.add(shell);
    live(1.6, (t) => {
      const k = t / 1.6;
      groundPosition(shell, sx + (p.x - sx) * k, 1.5 + Math.sin(k * Math.PI) * 20, sz + (p.z - sz) * k);
      warn.material.opacity = 0.4 + 0.35 * Math.sin(t * 16);
    }, () => (drop(shell), drop(warn)), () => {
      burst(p.x, p.z, 6, 0xffab40, 0.8);
      shardErupt(p.x, p.z, 4, 0x78909c, 10);
      for (const e of within(foesOf(c), p.x, p.z, 6)) (hurt(e, fall(45, 20, dist2D(e, p.x, p.z), 6), c), slowA(e, 0.6, 2));
    });
  };
  H.x_minefield_mine = () => {
    const c = player,
      p = aimAt(20),
      spots = [{ x: p.x, z: p.z }];
    for (let i = 0; i < 4; i++) {
      const a = (c.yaw || 0) + Math.PI / 4 + (i * Math.PI) / 2;
      spots.push({ x: p.x + Math.sin(a) * 3, z: p.z + Math.cos(a) * 3 });
    }
    for (const s of spots) {
      if (collideXZ(s.x, s.z, abilityGroundY(s.x, s.z), 0.3)) continue;
      makeTrap(s.x, s.z, 2, 0xffab40, (t) => {
        burst(t.pos.x, t.pos.z, 2.5, 0xffab40, 0.6);
        hurt(t, 25, c);
        slowA(t, 0.5, 2);
      });
    }
  };
  H.x_wire_trap = (d, f) => {
    const c = player,
      p = aimAt(18),
      px = -f.z,
      pz = f.x,
      HALF = 5,
      g = new T.Group(),
      pts = [];
    for (const k of [-HALF, -HALF / 3, HALF / 3, HALF]) {
      const post = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.3, 6), new T.MeshStandardMaterial({ color: 0x455a64, metalness: 0.6 }));
      post.position.set(px * k, 0.65, pz * k);
      g.add(post);
    }
    for (const h of [0.3, 0.7, 1.1]) for (let k = -HALF; k < HALF; k += 0.5) pts.push(px * k, h + 0.05 * Math.sin(k * 7), pz * k, px * (k + 0.5), h + 0.05 * Math.sin((k + 0.5) * 7), pz * (k + 0.5));
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    g.add(new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0xb0bec5 })));
    g.position.set(p.x, abilityGroundY(p.x, p.z, p.y), p.z);
    scene.add(g);
    const tick = every(0.25);
    live(20, (t, dt) => {
      const h = tick(dt);
      for (const e of foesOf(c)) {
        const rx = e.pos.x - p.x,
          rz = e.pos.z - p.z;
        if (Math.abs(rx * px + rz * pz) > HALF || Math.abs(rx * f.x + rz * f.z) > 1) continue;
        slowA(e, 0.3, 0.4);
        h && hurt(e, 2.5, c);
      }
    }, () => drop(g));
  };
  H.x_ult_ironcurtain = (d, f) => {
    const c = player,
      q = aimAt(14),
      back = Math.hypot(q.x - c.pos.x, q.z - c.pos.z) > 4 ? 2 : 0,
      p = { x: q.x - f.x * back, z: q.z - f.z * back },
      alongX = Math.abs(f.x) > Math.abs(f.z),
      w = alongX ? 1 : 30,
      dd = alongX ? 30 : 1;
    solid(p.x, p.z, w, dd, 4.5, 0x607d8b, 12, 1500);
    shardErupt(p.x, p.z, 8, 0x90a4ae, 18);
    viewerShake(p.x, p.z, 0.4);
    live(12, () => {
      for (const e of within(foesOf(c), p.x, p.z, 30)) (e.pos.x - p.x) * f.x + (e.pos.z - p.z) * f.z > 0.6 && st(e, "revealed", 0.6);
    });
  };

  // 백호 — the second smoke becomes a smoke arrow
  H.x_smoke_arrow = () => {
    const c = player,
      s = scan(c, 60, 0.5),
      x = s.hit ? s.hit.pos.x : s.end.x,
      z = s.hit ? s.hit.pos.z : s.end.z;
    tracer(s.e.x, s.e.y - 0.2, s.e.z, x, 1, z, 0xcfd8dc, 0.03, 0.35);
    withCaster(c, () => makeSmokeAt(x, z, 4.5 / SMK(), 18, 0x90a4ae));
    for (const e of within(foesOf(c), x, z, 8)) st(e, "revealed", 3);
  };

  // ── timers, damage rules ──
  function execCheck(e) {
    if (!isHost() || !e || !e.alive || !(e.__execT > 0) || !(e.hp < 30)) return;
    e.__execT = 0;
    const by = e.__execBy;
    try {
      fxColumn(e.pos.x, e.pos.z, 0xff1744, 10, 1);
      killActor(e, by || null);
    } catch (er) {}
  }
  const _dd = dealDamage;
  dealDamage = function (e, dmg, head, src) {
    if (e && e.__guardT > 0) dmg *= 0.5;
    if (src && src.__rageT > 0 && src !== e) dmg *= 1.3;
    const r = _dd.call(this, e, dmg, head, src);
    if (e && e.__sleepT > 0 && dmg > 0) ((e.__sleepT = 0), (e.root = 0));
    e && e.__execT > 0 && execCheck(e);
    return r;
  };
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      const d = dt || 0.016;
      for (const a of world.actors || []) for (const k of ["__rageT", "__guardT", "__sleepT", "__execT"]) a[k] > 0 && (a[k] = Math.max(0, a[k] - d));
      const now = nowS();
      for (const [a, o] of SPD) now >= o.until || !a.alive ? ((a.speedBuff = o.base), SPD.delete(a)) : (a.speedBuff = Math.max(o.base, o.m));
      for (const [a, u] of IMM) now >= u ? IMM.delete(a) : ((a.slow = 1), (a.slowT = 0), (a.root = 0));
    } catch (e) {}
    return r;
  };
  const _sr = startRound;
  startRound = function () {
    for (const [a, o] of SPD) a.speedBuff = o.base;
    SPD.clear();
    IMM.clear();
    for (const a of world.actors || []) for (const k of ["__rageT", "__guardT", "__sleepT", "__execT"]) a[k] = 0;
    return _sr.apply(this, arguments);
  };

  // ── the roster ──
  const ORIG = ["hwaryeong", "seorin", "muyeong", "gangcheol", "yeonhwa", "noeun", "baekho", "noeha", "gyeongyeon", "heuksa", "myeongjong", "jacheol", "hongyeol", "gunbong"];
  const A = (key, name, type, cost, charges, cd, desc, ult) => Object.assign({ key, name, cost, charges, cd, type, desc, _rs: 1 }, ult ? { ult } : {});
  const KITS = {
    baram: ["타격대", "바람을 타고 날아다니며 적을 날려 버리는 공중 돌격형.", "바람은 막을 수 없다.", [
      A("Q", "돌풍 베기", "x_gale_slash", 200, 2, 0, "앞쪽 15m 부채꼴로 바람 칼날을 날린다. 맞은 적은 25 피해를 입고 6m 밀려난다."),
      A("E", "상승 기류", "x_updraft", 0, 1, 22, "하늘 높이 뛰어오른 뒤 3초 동안 천천히 활공한다."),
      A("C", "역풍", "x_headwind", 150, 1, 0, "조준한 곳에 14m 바람의 장막을 6초간 펼친다. 닿은 적은 뒤로 밀려나고 40% 둔화."),
      A("X", "폭풍의 눈", "x_ult_storm_eye", 0, 1, 0, "궁극기 — 8초 동안 폭풍의 눈이 된다. 12m 안 적을 계속 밖으로 밀어내며 초당 8 피해, 나는 천천히 떨어진다.", 7),
    ]],
    geomi: ["감시자", "거미줄로 길목을 묶고 걸린 적을 끌어오는 매복형.", "걸리면 끝이다.", [
      A("Q", "거미줄 덫", "x_web_trap", 200, 2, 0, "밟은 적을 2.5초간 묶고 5초간 위치를 드러내는 거미줄 덫. 45초 유지."),
      A("E", "실 끌어당기기", "x_silk_pull", 0, 1, 25, "앞으로 거미줄을 쏜다(30m). 처음 맞은 적을 7m 끌어오고 2초간 40% 둔화."),
      A("C", "고치", "x_cocoon", 150, 1, 0, "2초간 고치 속에 숨는다. 그동안 무적이지만 움직일 수 없고, 체력 40 회복."),
      A("X", "거미굴", "x_ult_nest", 0, 1, 0, "궁극기 — 조준한 곳 반경 16m를 12초간 거미줄로 덮는다. 안의 적은 50% 둔화되고 위치가 드러나며, 3초 넘게 머물면 2초간 묶인다.", 7),
    ]],
    byeolbit: ["척후대", "하늘의 별을 끌어내려 적을 띄우고 빨아들이는 우주형.", "별이 떨어지면 소원 따윈 없다.", [
      A("Q", "유성 낙하", "x_meteor", 200, 1, 0, "1.2초 뒤 조준한 곳에 유성이 떨어진다. 반경 6m 최대 60 피해, 2초 뇌진탕."),
      A("E", "부양", "x_levitate", 0, 1, 30, "조준한 곳 반경 6m 적을 1.5초간 공중에 띄워 묶고 3초간 위치를 드러낸다."),
      A("C", "반중력", "x_antigrav", 150, 2, 0, "나와 7m 안 아군을 높이 뛰어오르게 한다. 높은 곳에 올라갈 때."),
      A("X", "블랙홀", "x_ult_blackhole", 0, 1, 0, "궁극기 — 조준한 곳에 5초간 블랙홀. 20m 안 적을 중심으로 빨아들이고(6m 안은 초당 10 피해), 사라질 때 8m 안 40 피해.", 8),
    ]],
    kallal: ["타격대", "칼날을 던지고 그림자처럼 등 뒤를 베는 암살형.", "보이면 이미 늦었다.", [
      A("Q", "부메랑 칼날", "x_boomerang", 200, 2, 0, "25m 날아갔다 돌아오는 칼날. 가는 길과 오는 길에 닿은 적마다 35 피해."),
      A("E", "그림자 일섬", "x_shadow_cut", 0, 1, 28, "앞쪽 22m 안 가장 가까운 적의 등 뒤로 순간이동해 베어 40 피해."),
      A("C", "표식 단검", "x_mark_knife", 150, 2, 0, "단검이 박힌 적은 5초간 취약(받는 피해 1.5배)해지고 위치가 드러난다."),
      A("X", "천검", "x_ult_thousand", 0, 1, 0, "궁극기 — 8초 동안 칼날 8자루가 주위를 돈다. 앞쪽 30m 안에 적이 보이면 하나씩 자동으로 날아가 45 피해.", 7),
    ]],
    deonggul: ["전략가", "가시와 덩굴로 땅을 뒤덮어 발을 묶는 정원사.", "뿌리는 놓아주지 않는다.", [
      A("Q", "가시밭길", "x_thorn_field", 200, 1, 0, "내 앞으로 20m 가시밭길을 8초간 깐다. 밟은 적은 50% 둔화, 초당 8 피해."),
      A("E", "휘감는 덩굴", "x_vine_snare", 0, 1, 30, "조준한 곳 반경 5m에서 0.6초 뒤 덩굴이 솟아 안의 적을 모두 2초간 묶는다."),
      A("C", "꽃가루", "x_pollen", 150, 2, 0, "조준한 곳에 6초간 꽃가루를 뿌린다. 안의 적은 재채기로 조준이 흔들린다(뇌진탕)."),
      A("X", "밀림", "x_ult_jungle", 0, 1, 0, "궁극기 — 조준한 곳 반경 16m를 10초간 밀림으로 바꾼다. 적은 60% 둔화되고 시야가 좁아지며(근시), 아군은 초당 6 회복.", 7),
    ]],
    neupji: ["전략가", "독과 늪으로 적을 천천히 말려 죽이는 독술사.", "천천히, 아주 천천히.", [
      A("Q", "독안개", "x_toxic_cloud", 200, 2, 0, "시야를 가리는 독 연막(14초). 안에 있는 적은 초당 6 피해."),
      A("E", "늪", "x_mire", 0, 1, 28, "조준한 곳 반경 8m를 6초간 늪으로 만든다. 적은 60% 둔화되고 초당 4씩 부패(체력 일시 감소)."),
      A("C", "거머리", "x_leech", 150, 1, 0, "거머리를 쏜다(35m). 붙은 적은 3초간 30 피해를 입고, 빨아들인 만큼 내 체력이 찬다."),
      A("X", "역병", "x_ult_plague", 0, 1, 0, "궁극기 — 앞쪽 40m 부채꼴의 적을 감염시킨다. 30 부패와 6초 취약, 감염된 적 6m 안의 적에게도 번진다.", 7),
    ]],
    deungbul: ["감시자", "빛으로 아군을 지키고 어둠 속의 적을 드러내는 수호자.", "등불이 꺼지지 않는 한.", [
      A("Q", "등불", "x_lantern_heal", 200, 1, 0, "발밑에 등불을 놓는다(20초). 7m 안 아군은 초당 6 회복, 14m 안 적은 위치가 드러난다."),
      A("E", "눈부신 빛", "x_glare", 0, 1, 26, "앞쪽 25m 좁은 부채꼴로 강한 빛을 쏜다. 맞은 적은 1.8초 실명."),
      A("C", "반딧불", "x_firefly", 150, 2, 0, "반딧불이 40m 안 가장 가까운 적에게 날아가 8초간 따라다니며 위치를 드러낸다."),
      A("X", "여명", "x_ult_dawn", 0, 1, 0, "궁극기 — 1.5초 뒤 해가 뜬다. 30m 안 적은 3초 실명에 6초간 위치 노출, 아군은 체력 40 회복.", 7),
    ]],
    hwanyeong: ["척후대", "분신과 자리바꿈으로 적의 눈을 속이는 환술사.", "어느 쪽이 진짜일까?", [
      A("Q", "분신", "x_clones", 200, 1, 0, "분신 둘이 앞으로 달려가다 3초 뒤 터진다. 7m 안 적은 1.5초 실명, 4초간 위치 노출."),
      A("E", "자리바꿈", "x_swap", 0, 1, 32, "조준한 적(35m)과 자리를 맞바꾼다."),
      A("C", "신기루 덫", "x_mirage_trap", 150, 2, 0, "밟으면 터지는 신기루. 걸린 적은 3초간 60% 둔화, 1.2초 실명."),
      A("X", "환영 군단", "x_ult_legion", 0, 1, 0, "궁극기 — 조준한 곳에 환영 다섯을 부른다. 6초 동안 각자 25m 안 가장 가까운 적을 쏜다(12 피해, 위치 노출).", 7),
    ]],
    ullim: ["척후대", "소리로 보고 소리로 흔드는 음파 정찰병.", "들린다, 네 심장 소리가.", [
      A("Q", "소리굽쇠", "x_tuning_fork", 200, 1, 0, "소리굽쇠를 던져 박는다. 4초 동안 8m 안 적은 뇌진탕에 위치가 드러난다."),
      A("E", "반향", "x_echolocate", 0, 1, 25, "50m까지 퍼지는 음파. 닿은 적은 벽 너머라도 3초간 위치 노출."),
      A("C", "비명 지뢰", "x_shriek_mine", 150, 2, 0, "밟으면 비명을 지르는 지뢰. 6m 안 적은 3초 근시, 4초간 위치 노출."),
      A("X", "음벽", "x_ult_soundwall", 0, 1, 0, "궁극기 — 10초 동안 나를 둘러싼 15m 음파 장막. 안의 적은 계속 뇌진탕·근시에 위치가 드러난다.", 7),
    ]],
    hwasan: ["타격대", "용암을 튀기고 땅을 터뜨리며 뛰어드는 폭발형.", "땅이 끓는다.", [
      A("Q", "튕기는 용암", "x_lava_bomb", 200, 2, 0, "땅을 세 번 튀며 터지는 용암 덩어리. 터질 때마다 반경 5m 최대 30 피해."),
      A("E", "분화 도약", "x_eruption_leap", 0, 1, 26, "발밑이 터지며 앞으로 12m 뛰어오른다. 떨어진 곳 4m 안 적에게 30 피해."),
      A("C", "용암 갑옷", "x_magma_shield", 150, 1, 0, "5초간 용암 방패를 두른다. 받는 피해 60% 감소, 4m 안 적은 초당 10 피해."),
      A("X", "대분화", "x_ult_volcano", 0, 1, 0, "궁극기 — 조준한 곳 반경 14m에 1초 뒤부터 용암이 여섯 번 쏟아진다. 한 번에 4.5m 최대 45 피해, 녹은 땅이 남는다.", 8),
    ]],
    suho: ["감시자", "결계와 성채로 아군을 지키는 방패.", "내 뒤에 서.", [
      A("Q", "수호 결계", "x_aegis", 200, 1, 0, "발밑에 6m 결계를 친다(6초). 안에 있는 아군은 받는 피해 60% 감소."),
      A("E", "수호 연결", "x_guard_link", 0, 1, 30, "가장 가까운 아군과 8초간 연결한다. 그 아군은 받는 피해 50% 감소, 초당 5 회복."),
      A("C", "함성", "x_rally_cry", 150, 1, 0, "12m 안 아군의 둔화·실명·뇌진탕 같은 나쁜 효과를 지우고 방어구 +30."),
      A("X", "성채", "x_ult_citadel", 0, 1, 0, "궁극기 — 나를 둘러싼 네 면의 방벽을 10초간 세운다(모서리는 열림). 안의 아군은 초당 8 회복.", 7),
    ]],
    hyeollang: ["타격대", "피 냄새를 쫓아 달려드는 야수.", "피 냄새가 난다.", [
      A("Q", "할퀴기", "x_rend", 200, 2, 0, "10m 앞으로 돌진하며 할퀸다. 끝에서 3.5m 안 적은 35 피해와 출혈(체력 10 부패)."),
      A("E", "포효", "x_howl", 0, 1, 28, "15m 안 적을 겁먹게 해 2초간 강제로 앉히고 4초간 위치를 드러낸다."),
      A("C", "야성", "x_feral", 150, 1, 0, "6초간 이동 속도 35% 증가, 둔화와 묶기에 걸리지 않는다."),
      A("X", "핏빛 달", "x_ult_bloodmoon", 0, 1, 0, "궁극기 — 10초간 늑대가 된다. 이동 속도 40% 증가, 준 피해의 45%를 회복, 체력이 절반 아래인 적은 위치가 보인다.", 7),
    ]],
    songgol: ["척후대", "매와 함께 하늘에서 전장을 내려다보는 사냥꾼.", "하늘에서 다 보인다.", [
      A("Q", "깃털 화살", "x_feather_volley", 200, 2, 0, "깃털 화살 세 발을 부채꼴로 쏜다(40m). 한 발마다 18 피해, 4초간 위치 노출."),
      A("E", "매의 눈", "x_hawk_eye", 0, 1, 24, "매가 앞으로 45m 날아가며 지나간 길 10m 안 적의 위치를 4초간 드러낸다."),
      A("C", "깃털 연막", "x_feather_smoke", 150, 2, 0, "내 자리에 깃털 연막을 터뜨리고 3초간 이동 속도 30% 증가."),
      A("X", "하늘의 사냥꾼", "x_ult_skyhunter", 0, 1, 0, "궁극기 — 10초 동안 매가 하늘을 돈다. 35m 안 적은 모두 위치가 드러나고, 2초마다 가장 가까운 적에게 내리꽂혀 25 피해.", 7),
    ]],
    haerang: ["전략가", "물결과 해일로 전장을 쓸어버리는 물의 술사.", "물은 길을 찾는다.", [
      A("Q", "물대포", "x_water_cannon", 200, 2, 0, "25m 물줄기. 처음 맞은 적을 10m 밀어내고 15 피해, 1초 근시."),
      A("E", "썰물", "x_ebb", 0, 1, 24, "앞으로 10m 미끄러져 돌진하고, 4초 뒤 처음 자리로 귀환한다."),
      A("C", "물안개", "x_mist", 150, 2, 0, "시야를 가리는 물안개 연막(12초). 안에 있는 아군은 초당 5 회복."),
      A("X", "해일", "x_ult_tsunami", 0, 1, 0, "궁극기 — 폭 20m 해일이 앞으로 40m 밀려간다. 휩쓸린 적은 끝까지 떠밀리고 25 피해, 4초간 50% 둔화.", 8),
    ]],
    mukhyang: ["전략가", "먹물로 시야와 능력을 지워버리는 서예가.", "한 획이면 충분하다.", [
      A("Q", "먹물 연막", "x_ink_smoke", 200, 2, 0, "시야를 가리는 먹물 연막(14초). 안에 들어온 적은 먹이 묻어 위치가 드러난다."),
      A("E", "낙관", "x_seal_trap", 0, 1, 30, "밟으면 찍히는 낙관. 5m 안 적은 5초간 능력이 봉인되고 위치가 드러난다."),
      A("C", "먹 튀기기", "x_ink_splash", 150, 2, 0, "먹물 덩어리를 던진다. 터진 곳 5m 안 적은 3초 근시, 2초간 40% 둔화."),
      A("X", "수묵화", "x_ult_inkworld", 0, 1, 0, "궁극기 — 35m 안 모든 적의 시야를 먹으로 덮는다. 6초 근시, 각자 발밑에 작은 먹물 연막.", 7),
    ]],
    yeongwol: ["전략가", "달빛으로 가두고 그림자로 건너뛰는 달의 무녀.", "달은 모든 것을 비춘다.", [
      A("Q", "월광 감옥", "x_moon_cage", 200, 1, 0, "조준한 곳 반경 5m에 달빛 감옥(4초). 갇힌 적은 밖으로 못 나가고 40% 둔화."),
      A("E", "달그림자", "x_moon_shadow", 0, 1, 26, "그림자를 조준한 곳(35m)으로 보내고 1.5초 뒤 그 자리로 순간이동한다."),
      A("C", "월식", "x_eclipse", 150, 2, 0, "시야를 가리는 어둠 연막(12초). 안의 적은 시야가 좁아진다(근시)."),
      A("X", "보름달", "x_ult_fullmoon", 0, 1, 0, "궁극기 — 8초 동안 30m 안 적은 위치가 드러나고 30% 둔화, 아군은 이동 속도 20% 증가.", 7),
    ]],
    danbi: ["전략가", "비를 내려 아군을 살리고 폭풍으로 적을 치는 기상술사.", "비가 그치면 끝난다.", [
      A("Q", "단비", "x_rain_heal", 200, 1, 0, "8초 동안 나를 따라오는 비구름. 6m 안 아군은 초당 8 회복."),
      A("E", "우박", "x_hail", 0, 1, 26, "조준한 곳 반경 8m에 3초간 우박. 0.5초마다 8 피해, 40% 둔화."),
      A("C", "무지개 다리", "x_rainbow", 150, 1, 0, "나부터 20m 앞까지 무지개 길(6초). 위에 선 아군은 이동 속도 40% 증가."),
      A("X", "장마", "x_ult_monsoon", 0, 1, 0, "궁극기 — 조준한 곳 반경 18m에 8초간 폭풍우. 1초마다 안의 적에게 벼락(20 피해, 1초 뇌진탕), 아군은 초당 6 회복.", 8),
    ]],
    cheolhyeol: ["타격대", "멈추지 않고 밀고 들어가 땅을 내려찍는 거구.", "막아 봐라.", [
      A("Q", "지진 강타", "x_ground_slam", 200, 2, 0, "땅을 내려찍어 앞쪽 12m 부채꼴 적에게 30 피해, 2초간 강제로 앉힌다."),
      A("E", "폭주", "x_juggernaut", 0, 1, 28, "5초간 이동 속도 25% 증가, 둔화·묶기 무시. 부딪힌 적은 튕겨 나간다."),
      A("C", "격노", "x_rage", 150, 1, 0, "체력 20을 바치고 6초간 내가 주는 모든 공격이 30% 강해진다."),
      A("X", "파멸의 일격", "x_ult_doom", 0, 1, 0, "궁극기 — 조준한 곳(25m)으로 뛰어올라 내리찍는다. 반경 7m 최대 70 피해, 3초 뇌진탕, 4초간 둔화되는 구덩이.", 8),
    ]],
    chujeok: ["척후대", "흔적을 쫓고 사냥개를 풀어 끝까지 몰아붙이는 추적자.", "도망쳐도 소용없다.", [
      A("Q", "추적 다트", "x_tracker_dart", 200, 2, 0, "다트가 꽂힌 적은 10초간 위치가 드러난다. 벽에 꽂히면 15초 동안 15m 감지기가 된다."),
      A("E", "사냥개", "x_hound", 0, 1, 26, "사냥개가 40m 안 가장 가까운 적에게 달려가 물어뜯는다. 20 피해, 3초 50% 둔화, 4초 위치 노출."),
      A("C", "조명탄", "x_flare", 150, 1, 0, "조준한 곳 위로 조명탄을 띄운다(6초). 20m 안 적은 계속 위치가 드러난다."),
      A("X", "처형 표식", "x_ult_execution", 0, 1, 0, "궁극기 — 앞쪽 50m 안 가장 가까운 적에게 10초 표식. 위치가 드러나고, 체력이 30 아래로 떨어지면 그 자리에서 쓰러진다.", 7),
    ]],
    hoero: ["감시자", "해킹과 레이저, 드론으로 전장을 통제하는 기술자.", "시스템 장악 완료.", [
      A("Q", "해킹", "x_hack", 200, 1, 0, "조준한 적(40m)을 해킹한다. 5초간 능력 봉인, 위치가 드러난다."),
      A("E", "레이저 포탑", "x_laser_turret", 0, 1, 30, "조준한 곳에 회전 레이저 포탑(8초). 10m 레이저에 닿은 적은 15 피해, 위치 노출."),
      A("C", "홀로그램 벽", "x_holo_wall", 150, 2, 0, "조준한 곳에 시야를 가리는 14m 홀로그램 벽(15초). 총알은 그대로 지나간다."),
      A("X", "자폭 드론", "x_ult_drones", 0, 1, 0, "궁극기 — 드론 넷이 50m 안 적을 하나씩 쫓아가 터진다. 반경 3m 40 피해, 5초간 위치 노출.", 7),
    ]],
    yakcho: ["감시자", "약과 독을 다루며 아군을 살리는 약사.", "쓴 약이 몸에 좋다.", [
      A("Q", "치유 물약", "x_potion_heal", 200, 2, 0, "30m 안 가장 다친 아군(나 포함)에게 물약이 날아간다. 즉시 40, 3초간 15 더 회복."),
      A("E", "수면 가루", "x_sleep_powder", 0, 1, 30, "조준한 곳 반경 5m에 수면 가루. 0.8초 뒤 안의 적은 3초간 잠들어 묶인다(맞으면 깸)."),
      A("C", "약초 주머니", "x_herb_heal", 150, 1, 0, "발밑에 약초 주머니(20초). 다친 아군이 3m 안에 오면 주워서 50 회복."),
      A("X", "생명의 정원", "x_ult_garden_heal", 0, 1, 0, "궁극기 — 내 자리에 반경 12m 정원(12초). 안의 아군은 쓰러지지 않고 초당 10 회복, 적은 30% 둔화.", 8),
    ]],
    cheolbyeok: ["감시자", "박격포와 지뢰, 철조망으로 진지를 짓는 공병.", "여기는 못 지나간다.", [
      A("Q", "박격포", "x_mortar", 200, 2, 0, "조준한 곳(60m)에 포탄을 쏜다. 1.6초 뒤 반경 6m 최대 45 피해, 2초간 40% 둔화."),
      A("E", "지뢰밭", "x_minefield_mine", 0, 1, 32, "조준한 곳에 지뢰 다섯 개를 흩뿌린다. 밟으면 25 피해, 2초 50% 둔화."),
      A("C", "철조망", "x_wire_trap", 150, 2, 0, "조준한 곳에 10m 철조망(20초). 걸린 적은 70% 둔화, 초당 10 피해."),
      A("X", "철의 장막", "x_ult_ironcurtain", 0, 1, 0, "궁극기 — 조준한 곳에 30m 강철 방벽을 12초간 세운다. 방벽 너머 30m 안 적은 위치가 드러난다.", 8),
    ]],
  };
  // what each new ability must visibly do in the ability test (scratch tests read def.expect)
  const EXPECT = {
    x_gale_slash: "dmg", x_updraft: "move", x_headwind: "slow", x_ult_storm_eye: "dmg",
    x_web_trap: "root reveal", x_silk_pull: "slow", x_cocoon: "", x_ult_nest: "slow reveal",
    x_meteor: "dmg concuss", x_levitate: "root reveal", x_antigrav: "move", x_ult_blackhole: "dmg",
    x_boomerang: "dmg", x_shadow_cut: "move dmg", x_mark_knife: "vuln reveal", x_ult_thousand: "dmg",
    x_thorn_field: "slow dmg", x_vine_snare: "root", x_pollen: "concuss", x_ult_jungle: "slow near",
    x_toxic_cloud: "smoke dmg", x_mire: "slow decay", x_leech: "dmg", x_ult_plague: "decay vuln",
    x_lantern_heal: "reveal", x_glare: "blind", x_firefly: "reveal", x_ult_dawn: "blind reveal",
    x_clones: "blind reveal", x_swap: "move", x_mirage_trap: "slow blind", x_ult_legion: "dmg reveal",
    x_tuning_fork: "concuss reveal", x_echolocate: "reveal", x_shriek_mine: "near reveal", x_ult_soundwall: "concuss near reveal",
    x_lava_bomb: "dmg", x_eruption_leap: "move", x_magma_shield: "shield", x_ult_volcano: "dmg",
    x_aegis: "", x_guard_link: "", x_rally_cry: "", x_ult_citadel: "wall",
    x_rend: "move dmg decay", x_howl: "crouch reveal", x_feral: "", x_ult_bloodmoon: "life",
    x_feather_volley: "dmg reveal", x_hawk_eye: "reveal", x_feather_smoke: "smoke", x_ult_skyhunter: "reveal dmg",
    x_water_cannon: "dmg near", x_ebb: "move", x_mist: "smoke", x_ult_tsunami: "dmg slow",
    x_ink_smoke: "smoke reveal", x_seal_trap: "silence reveal", x_ink_splash: "near slow", x_ult_inkworld: "near smoke",
    x_moon_cage: "slow", x_moon_shadow: "move", x_eclipse: "smoke near", x_ult_fullmoon: "reveal slow",
    x_rain_heal: "", x_hail: "dmg slow", x_rainbow: "", x_ult_monsoon: "dmg concuss",
    x_ground_slam: "dmg crouch", x_juggernaut: "", x_rage: "", x_ult_doom: "move dmg concuss slow",
    x_tracker_dart: "reveal", x_hound: "dmg slow reveal", x_flare: "reveal", x_ult_execution: "reveal",
    x_hack: "silence reveal", x_laser_turret: "dmg reveal", x_holo_wall: "smoke", x_ult_drones: "dmg reveal",
    x_potion_heal: "", x_sleep_powder: "root", x_herb_heal: "", x_ult_garden_heal: "slow",
    x_mortar: "dmg slow", x_minefield_mine: "dmg slow", x_wire_trap: "slow dmg", x_ult_ironcurtain: "wall reveal",
    x_smoke_arrow: "smoke reveal",
  };
  // icons, cast motions and sounds
  Object.assign(AB_ICON_PATH, {
    wind: "M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8",
    web: "M12 2v20M2 12h20M5 5l14 14M19 5L5 19M12 7.5a4.5 4.5 0 1 0 .01 0M12 3.5a8.5 8.5 0 1 0 .01 0",
    star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    blade: "M4 20L15 9l5-5-1.2 5.2L8 20zM11 13l-4-4",
    leaf: "M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8",
    skull: "M12 3a7 7 0 0 0-7 7c0 2.5 1.3 4 3 5v3h8v-3c1.7-1 3-2.5 3-5a7 7 0 0 0-7-7zM9 11h.01M15 11h.01M10 18v3M14 18v3",
    lamp: "M9 3h6M12 3v2M8 7h8l-1 9H9zM12 9v5M9 20h6M10 16v4M14 16v4",
    mask: "M3 7c3-2 15-2 18 0v4c0 5-4 8-9 9-5-1-9-4-9-9zM8 11h2M14 11h2M9 15c2 1.5 4 1.5 6 0",
    sound: "M3 9v6M7 6v12M11 3v18M15 7v10M19 10v4",
    paw: "M12 13c-3 0-5 3-5 5s2 3 5 3 5-1 5-3-2-5-5-5zM5 9.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M15.8 9.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M8.4 5.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M12.4 5.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0",
    feather: "M20 4C11 4 6 9 6 18l-2 2M6 18c6 0 11-3 12-9M10 14l6-6",
    drop: "M12 3c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z",
    brush: "M14 4l6 6-8 8-6-6zM6 12l-3 7 7-3",
    moon: "M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z",
    chip: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
    potion: "M10 3h4M10 3v5L5 17a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3M7.5 14h9",
    rain: "M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.5 7.5 3.5 3.5 0 0 0 7 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3",
    target: "M12 3a9 9 0 1 0 .01 0M12 8a4 4 0 1 0 .01 0M12 1v4M12 19v4M1 12h4M19 12h4",
    shell: "M5 19l9-9M14 10l2-6 4 4-6 2M3 21l2-2",
  });
  const LOOK = {
    x_gale_slash: ["wind", "sweep", "rift_wave"], x_updraft: ["wind", "dash", "bolt_jump"], x_headwind: ["wind", "sweep", "sand_wall"], x_ult_storm_eye: ["wind", "ult", "ult_tomb"],
    x_web_trap: ["web", "place", "hive_trap"], x_silk_pull: ["web", "point", "mag_net"], x_cocoon: ["web", "aura", "ripple_dome"], x_ult_nest: ["web", "ult", "ult_queen"],
    x_meteor: ["star", "throw", "nade"], x_levitate: ["star", "point", "mag_anchor"], x_antigrav: ["star", "aura", "bolt_jump"], x_ult_blackhole: ["star", "ult", "ult_polarity"],
    x_boomerang: ["blade", "throw", "rift_wave"], x_shadow_cut: ["blade", "dash", "blink"], x_mark_knife: ["blade", "point", "pierce"], x_ult_thousand: ["blade", "ult", "ult_mirror"],
    x_thorn_field: ["leaf", "sweep", "sand_wall"], x_vine_snare: ["leaf", "place", "quicksand"], x_pollen: ["leaf", "throw", "smoke"], x_ult_jungle: ["leaf", "ult", "ult_tomb"],
    x_toxic_cloud: ["skull", "throw", "smoke"], x_mire: ["skull", "place", "quicksand"], x_leech: ["skull", "point", "blood_drain"], x_ult_plague: ["skull", "ult", "ult_emp"],
    x_lantern_heal: ["lamp", "place", "heal"], x_glare: ["burst", "point", "flash"], x_firefly: ["lamp", "throw", "drone"], x_ult_dawn: ["burst", "ult", "ult_bell"],
    x_clones: ["mask", "throw", "decoy"], x_swap: ["mask", "point", "blink"], x_mirage_trap: ["mask", "place", "mine"], x_ult_legion: ["mask", "ult", "ult_mirror"],
    x_tuning_fork: ["sound", "throw", "static_orb"], x_echolocate: ["sound", "aura", "mirror_pulse"], x_shriek_mine: ["sound", "place", "sound_sensor"], x_ult_soundwall: ["sound", "ult", "ult_bell"],
    x_lava_bomb: ["flame", "throw", "proj_fire"], x_eruption_leap: ["flame", "dash", "bolt_jump"], x_magma_shield: ["shield", "aura", "shield"], x_ult_volcano: ["flame", "ult", "ult_fire"],
    x_aegis: ["shield", "aura", "ripple_dome"], x_guard_link: ["shield", "point", "heal"], x_rally_cry: ["crown", "aura", "ult_bell"], x_ult_citadel: ["wall", "ult", "sand_wall"],
    x_rend: ["paw", "dash", "charge"], x_howl: ["paw", "aura", "ult_bell"], x_feral: ["paw", "aura", "blood_drain"], x_ult_bloodmoon: ["moon", "ult", "ult_undying"],
    x_feather_volley: ["feather", "point", "pierce"], x_hawk_eye: ["eye", "throw", "recon_dart"], x_feather_smoke: ["feather", "aura", "smoke"], x_ult_skyhunter: ["feather", "ult", "ult_recon"],
    x_water_cannon: ["drop", "point", "pierce"], x_ebb: ["drop", "dash", "dash"], x_mist: ["drop", "throw", "smoke"], x_ult_tsunami: ["drop", "ult", "ult_tomb"],
    x_ink_smoke: ["brush", "throw", "smoke"], x_seal_trap: ["brush", "place", "tripwire"], x_ink_splash: ["brush", "throw", "nade"], x_ult_inkworld: ["brush", "ult", "ult_emp"],
    x_moon_cage: ["moon", "place", "mag_net"], x_moon_shadow: ["moon", "dash", "blink"], x_eclipse: ["moon", "throw", "smoke"], x_ult_fullmoon: ["moon", "ult", "ult_recon"],
    x_rain_heal: ["rain", "aura", "heal"], x_hail: ["rain", "throw", "smoke_ice"], x_rainbow: ["rain", "sweep", "dash"], x_ult_monsoon: ["rain", "ult", "ult_lightning"],
    x_ground_slam: ["impact", "sweep", "ult_smash"], x_juggernaut: ["impact", "aura", "charge"], x_rage: ["heart", "aura", "blood_drain"], x_ult_doom: ["impact", "ult", "ult_smash"],
    x_tracker_dart: ["target", "point", "recon_dart"], x_hound: ["paw", "throw", "hunt_bee"], x_flare: ["burst", "throw", "flash"], x_ult_execution: ["target", "ult", "ult_snipe"],
    x_hack: ["chip", "point", "emp"], x_laser_turret: ["chip", "place", "mag_turret"], x_holo_wall: ["chip", "sweep", "sand_wall"], x_ult_drones: ["chip", "ult", "scout_swarm"],
    x_potion_heal: ["potion", "throw", "heal"], x_sleep_powder: ["potion", "throw", "smoke"], x_herb_heal: ["leaf", "place", "heal"], x_ult_garden_heal: ["leaf", "ult", "ult_res"],
    x_mortar: ["shell", "throw", "nade"], x_minefield_mine: ["trap", "place", "mine"], x_wire_trap: ["trap", "place", "tripwire"], x_ult_ironcurtain: ["wall", "ult", "sand_wall"],
    x_smoke_arrow: ["cloud", "point", "pierce"],
  };
  for (const t in H) {
    CAST_EXT[t] = H[t];
    const l = LOOK[t];
    if (!l) continue;
    AB_ICON_OF[t] = l[0];
    "ult" !== l[1] && (CAST_STYLE_OF[t] = l[1]);
    "undefined" != typeof ABIL_SFX && ABIL_SFX[l[2]] && (ABIL_SFX[t] = ABIL_SFX[l[2]]);
  }

  // the roster: the first fourteen, then the twenty-two with new kits
  const byId = new Map(AGENTS.map((a) => [a.id, a]));
  const keep = [];
  for (const id of ORIG) byId.get(id) && keep.push(byId.get(id));
  for (const id in KITS) {
    const a = byId.get(id);
    if (!a) continue;
    const [role, desc, quote, abilities] = KITS[id];
    a.role = role;
    a.desc = desc;
    a.quote = quote;
    a.abilities = abilities;
    keep.push(a);
  }
  const bk = byId.get("baekho");
  if (bk) {
    const i = bk.abilities.findIndex((d) => "smoke" === d.type);
    i >= 0 && (bk.abilities[i] = A("C", "연막 화살", "x_smoke_arrow", 150, 2, 0, "멀리(60m) 날아가 꽂히는 연막 화살. 꽂힌 곳에 18초 연막, 8m 안 적은 3초간 위치 노출."));
  }
  for (const a of keep) for (const d of a.abilities) EXPECT[d.type] != null && (d.expect = EXPECT[d.type] ? EXPECT[d.type].split(" ") : []);
  if (keep.length >= 30) {
    AGENTS.length = 0;
    keep.forEach((a) => AGENTS.push(a));
    // the title strip and the picker were drawn for sixty: draw them again
    try {
      const tr = document.getElementById("title-roster");
      tr && "function" == typeof renderTitleRoster && ((tr.innerHTML = ""), renderTitleRoster());
      "function" == typeof renderSelect && renderSelect();
    } catch (e) {}
  }
  window.AGENTS36 = { kits: Object.keys(KITS), types: Object.keys(H) };
})();
