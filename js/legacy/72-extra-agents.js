
(() => {
  // Three more agents (39 in all), each with four abilities that work in a way
  // no other ability does: time that is wound back or replayed, doors through
  // space, being hidden or put out of the world, bullets that bounce, a price
  // on a head and a duel nobody else may join. Every cast goes through
  // CAST_EXT like the others: sent once, played on every screen, and only the
  // host deals damage or changes health.
  if ("undefined" == typeof AGENTS || "undefined" == typeof CAST_EXT || !window.AGENTS36) return;
  if (AGENTS.some((a) => "chochim" === a.id)) return;
  // (and 나침, the fortieth: a map for an ultimate)

  // ── helpers (the same ones the thirty-six use) ──
  const DA = () => window.AB_D || 1;
  const isHost = () => "undefined" == typeof NET || "client" !== NET.mode;
  const aimAt = (d) => aimPoint(d / DA());
  const mates = (c) => actorList().filter((a) => a && a.alive && a.team === c.team);
  const dist2D = (a, x, z) => Math.hypot(a.pos.x - x, a.pos.z - z);
  const hurt = (a, dmg, c) => a && a.alive && hurtFighter(a, dmg, !1, c);
  const losOK = (c, a) => !rayBlocked(c.pos.x, (c.y || 0) + 1.5, c.pos.z, a.pos.x, (a.y || 0) + 1.2, a.pos.z);
  const clearLen = (x, z, dx, dz, len, y) => {
    let t = 0;
    while (t < len && !collideXZ(x + dx * (t + 0.4), z + dz * (t + 0.4), (y || 0) + 0.8, 0.15)) t += 0.4;
    return Math.min(t, len);
  };
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
  const eye = (c) => ({ x: c.pos.x, y: (c.y || 0) + 1.45, z: c.pos.z });
  function scan(c, len, w) {
    const yaw = c.yaw || 0,
      dx = -Math.sin(yaw),
      dz = -Math.cos(yaw),
      e = eye(c),
      L = clearLen(e.x, e.z, dx, dz, len, c.y);
    const hit = onLine(foesOf(c), e.x, e.z, dx, dz, L, w).find((a) => losOK(c, a));
    const end = hit ? { x: hit.pos.x, z: hit.pos.z, y: (hit.y || 0) + 1.1 } : { x: e.x + dx * L, z: e.z + dz * L, y: e.y - 0.2 };
    return { hit, end, e, dx, dz, L };
  }
  // the enemy a targeted ability goes to: the one in the line, or the nearest
  // one seen inside a narrow cone around it
  function pick(c, len) {
    const s = scan(c, len, 0.8);
    if (s.hit) return s;
    let best = null,
      bd = 9;
    for (const a of foesOf(c)) {
      const px = a.pos.x - s.e.x,
        pz = a.pos.z - s.e.z,
        d = Math.hypot(px, pz);
      if (d > len || d < 0.5) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (px * s.dx + pz * s.dz) / d)));
      ang < 0.22 && ang < bd && losOK(c, a) && ((bd = ang), (best = a));
    }
    best && ((s.hit = best), (s.end = { x: best.pos.x, z: best.pos.z, y: (best.y || 0) + 1.1 }));
    return s;
  }
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
  // true every `step` seconds inside a timed thing
  const every = (step) => {
    let acc = 0;
    return (dt) => ((acc += dt), acc >= step ? ((acc -= step), !0) : !1);
  };
  const mat = (col, op, add) => new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: null == op ? 0.8 : op, depthWrite: !1, side: T.DoubleSide, blending: add ? T.AdditiveBlending : T.NormalBlending });
  const drop = (m) => {
    if (!m) return;
    scene.remove(m);
    m.traverse((o) => {
      o.geometry && !(o.geometry.userData && o.geometry.userData.shared) && o.geometry.dispose();
      o.material && (Array.isArray(o.material) ? o.material.forEach((x) => x.dispose()) : o.material.dispose());
    });
  };
  const ring = (x, z, r, col, op, w, y) => {
    const m = new T.Mesh(new T.RingGeometry(Math.max(0.01, r - (w || 0.3)), r, 64), mat(col, null == op ? 0.7 : op, !0));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, null == y ? abilityGroundY(x, z) + 0.07 : y, z);
    scene.add(m);
    return m;
  };
  const dot = (col, size, x, y, z) => {
    const g = glowDot(col, size);
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  };
  function sparks(x, y, z, col, n, sp) {
    n = Math.max(3, Math.round((n || 10) * Math.max(0.3, MOT())));
    for (let i = 0; i < n; i++) {
      const g = glowDot(col, 0.22 + 0.25 * Math.random());
      g.position.set(x, y, z);
      const a = Math.random() * 6.28,
        s = (sp || 5) * (0.5 + Math.random()),
        vx = Math.cos(a) * s,
        vz = Math.sin(a) * s;
      let vy = 2 + 4 * Math.random();
      addFx(g, 0.5, (m, t, d) => {
        const dt = d || 0.016;
        m.position.x += vx * dt;
        m.position.z += vz * dt;
        m.position.y += vy * dt;
        vy -= 12 * dt;
        m.material.opacity = 1 - t;
      });
    }
  }
  const beam = (x1, y1, z1, x2, y2, z2, col, w, life) => {
    const dx = x2 - x1,
      dy = y2 - y1,
      dz = z2 - z1,
      L = Math.hypot(dx, dy, dz) || 0.01;
    const m = new T.Mesh(new T.CylinderGeometry(w || 0.05, w || 0.05, 1, 8, 1, !0), mat(col, 0.9, !0));
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.scale.set(1, L, 1);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / L, dy / L, dz / L));
    addFx(m, life || 0.3, (o, t) => (o.material.opacity = 0.9 * (1 - t)));
  };
  // something that hangs over a head for a while, on every screen
  function overHead(a, obj, life, y, spin) {
    scene.add(obj);
    live(life, (t, dt) => {
      if (!a.alive) return !1;
      obj.position.set(a.pos.x, (a.y || 0) + (y || 2.55), a.pos.z);
      spin && (obj.rotation.y += spin * dt);
    }, () => drop(obj));
  }
  const viewer = () => ("function" == typeof myActor && myActor()) || null;
  const send = (o) => {
    try {
      "host" === NET.mode && sendEventAll(Object.assign({ t: "y3" }, o));
    } catch (e) {}
  };

  // ── shared state: a clock, where everyone was, and the rules below ──
  let CLK = 0,
    GUARD = !1; // damage the rules below deal themselves is not fed back into them
  const HIST = new Map(); // actor → [{t, x, y, z, hp, ar}] over the last four seconds
  const ECHO = new Map(); // team → { until, c }
  const ECHOQ = []; // { at, e, dmg, src }
  const DUELS = []; // { a, b, x, z, r, until }
  let histAcc = 0;
  function record(dt) {
    histAcc += dt;
    if (histAcc < 0.1) return;
    histAcc = 0;
    for (const a of world.actors || []) {
      if (!a || !a.pos) continue;
      let h = HIST.get(a);
      h || HIST.set(a, (h = []));
      if (!a.alive) {
        h.length = 0;
        continue;
      }
      h.push({ t: CLK, x: a.pos.x, y: a.y || 0, z: a.pos.z, hp: a.hp, ar: a.armor || 0 });
      while (h.length && h[0].t < CLK - 4) h.shift();
    }
  }
  // where (and how) an actor was `ago` seconds back: the latest sample at or
  // before then, or the oldest there is
  function histAt(a, ago) {
    const h = HIST.get(a);
    if (!h || !h.length) return null;
    const want = CLK - ago;
    let best = h[0];
    for (const s of h) {
      if (s.t <= want) best = s;
      else break;
    }
    return best;
  }

  // a clock face lying on the ground or standing up
  function clockMesh(r, col, glow) {
    const g = new T.Group();
    g.add(new T.Mesh(new T.RingGeometry(r * 0.9, r, 64), mat(col, 0.85, !0)));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        tk = new T.Mesh(new T.PlaneGeometry(r * (i % 3 ? 0.04 : 0.07), r * (i % 3 ? 0.12 : 0.2)), mat(col, 0.9, !0));
      tk.position.set(Math.sin(a) * r * 0.76, Math.cos(a) * r * 0.76, 0);
      tk.rotation.z = -a;
      g.add(tk);
    }
    const hand = (len, w) => {
      const p = new T.Group(),
        m = new T.Mesh(new T.PlaneGeometry(w, len), mat(glow || col, 0.95, !0));
      m.position.y = len / 2;
      p.add(m);
      g.add(p);
      return p;
    };
    g.userData.hr = hand(r * 0.45, r * 0.07);
    g.userData.mn = hand(r * 0.68, r * 0.045);
    g.add(new T.Mesh(new T.CircleGeometry(r * 0.9, 48), mat(col, 0.08, !0)));
    return g;
  }
  const tickClock = (g, t, k) => {
    g.userData.mn.rotation.z = -t * (k || 6);
    g.userData.hr.rotation.z = -t * (k || 6) / 12;
  };

  const H = {};
  const GOLD = 0xe0b04a,
    CYAN = 0x80deea,
    VIO = 0x8e5cff,
    VIO2 = 0xb388ff,
    ORG = 0xe8743b,
    AMB = 0xffc107;

  // ── 초침 — time ──
  // a clock hand shot: the enemy it marks takes again, when the mark runs out,
  // part of what it took meanwhile
  H.y_time_brand = () => {
    const c = player,
      s = pick(c, 40);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, GOLD, 0.04, 0.3);
    if (!s.hit) return sparks(s.end.x, s.end.y, s.end.z, GOLD, 6, 3);
    const e = s.hit;
    e.__brandT = 3;
    e.__brandAcc = 0;
    const cm = clockMesh(0.55, GOLD, CYAN);
    let tt = 0;
    live(3, (t, dt) => {
      tt += dt;
      tickClock(cm, tt, 2.1);
      cm.lookAt && camera && cm.lookAt(camera.position);
    });
    overHead(e, cm, 3, 2.7);
    sparks(e.pos.x, (e.y || 0) + 1.3, e.pos.z, GOLD, 8, 3);
    later(3, () => {
      const acc = e.__brandAcc || 0;
      e.__brandT = 0;
      e.__brandAcc = 0;
      if (!e.alive) return;
      fxRing(e.pos.x, e.pos.z, 3, GOLD, 0.5);
      fxColumn(e.pos.x, e.pos.z, GOLD, 5, 0.6);
      sparks(e.pos.x, (e.y || 0) + 1.2, e.pos.z, CYAN, 14, 5);
      if (isHost()) {
        GUARD = !0;
        try {
          hurt(e, 20 + 0.6 * acc, c);
        } finally {
          GUARD = !1;
        }
      }
    });
  };
  // my health and armour as they were three seconds ago
  H.y_rewind = () => {
    const c = player,
      past = histAt(c, 3);
    const cm = clockMesh(1.6, GOLD, CYAN);
    cm.rotation.x = -Math.PI / 2;
    cm.position.set(c.pos.x, (c.y || 0) + 0.08, c.pos.z);
    scene.add(cm);
    live(0.9, (t) => {
      tickClock(cm, -t * 8, 6);
      cm.position.set(c.pos.x, (c.y || 0) + 0.08, c.pos.z);
      cm.scale.setScalar(1 + 0.4 * t);
      cm.traverse((o) => o.material && (o.material.opacity = Math.min(o.material.opacity, 0.9 * (1 - t / 0.9))));
    }, () => drop(cm));
    if (past) {
      // a gold trail along the way I came
      const h = (HIST.get(c) || []).filter((p) => p.t >= CLK - 3);
      for (let i = 0; i < h.length; i += 3) later(0.02 * (h.length - i) / 3, () => sparks(h[i].x, h[i].y + 1, h[i].z, GOLD, 2, 1));
    }
    fxColumn(c.pos.x, c.pos.z, CYAN, 4, 0.7);
    if (isHost() && past && c.alive) {
      c.hp = Math.max(c.hp, Math.min(100, past.hp));
      c.armor = Math.max(c.armor || 0, past.ar || 0);
    }
    tellTeam(c, "되감기", "#e0b04a");
  };
  // a round that sends the enemy back to where it stood three seconds ago
  H.y_backstep = () => {
    const c = player,
      s = pick(c, 35);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, CYAN, 0.035, 0.3);
    if (!s.hit) return sparks(s.end.x, s.end.y, s.end.z, CYAN, 6, 3);
    const e = s.hit,
      past = histAt(e, 3);
    if (!past) return;
    if (Math.hypot(past.x - e.pos.x, past.z - e.pos.z) < 0.4) return void fxRing(e.pos.x, e.pos.z, 1.5, CYAN, 0.4);
    if (collideXZ(past.x, past.z, past.y, 0.4)) return;
    const from = { x: e.pos.x, y: e.y || 0, z: e.pos.z };
    // the path it walked, played backwards
    const h = (HIST.get(e) || []).filter((p) => p.t >= past.t);
    h.forEach((p, i) => later(0.015 * (h.length - i), () => sparks(p.x, p.y + 1, p.z, CYAN, 1, 0.8)));
    e.pos.x = past.x;
    e.pos.z = past.z;
    e.y = past.y;
    e.vel && e.vel.set(0, 0, 0);
    e.vy = 0;
    beam(from.x, from.y + 1, from.z, past.x, past.y + 1, past.z, CYAN, 0.06, 0.6);
    fxRing(from.x, from.z, 2, CYAN, 0.45);
    fxColumn(past.x, past.z, CYAN, 4, 0.7);
    const v = viewer();
    v === e && bannerMe("역행 — 3초 전 자리로", "#80deea");
    "function" == typeof viewerShake && viewerShake(past.x, past.z, 0.2);
  };
  // for eight seconds what my team deals near me lands again a second later
  H.y_ult_echo = () => {
    const c = player;
    ECHO.set(c.team, { until: CLK + 8, c });
    const cm = clockMesh(6, GOLD, CYAN);
    cm.rotation.x = -Math.PI / 2;
    scene.add(cm);
    const edge = ring(c.pos.x, c.pos.z, 35, GOLD, 0.18, 0.5);
    live(8, (t) => {
      if (!c.alive) return !1;
      tickClock(cm, t, 3);
      cm.position.set(c.pos.x, (c.y || 0) + 0.1, c.pos.z);
      edge.position.set(c.pos.x, (c.y || 0) + 0.07, c.pos.z);
      edge.material.opacity = 0.12 + 0.06 * Math.sin(t * 6);
    }, () => (drop(cm), drop(edge)));
    fxColumn(c.pos.x, c.pos.z, GOLD, 12, 1.2);
    tellTeam(c, "메아리 시간 — 8초간 준 피해가 한 번 더", "#e0b04a");
  };

  // ── 관문 — doors through space ──
  function doorMesh(col) {
    const g = new T.Group();
    const rim = new T.Mesh(new T.TorusGeometry(1.1, 0.07, 8, 40), mat(col, 0.95, !0));
    rim.scale.set(1, 1.45, 1);
    const film = new T.Mesh(new T.CircleGeometry(1.05, 40), mat(col, 0.28, !0));
    film.scale.set(1, 1.45, 1);
    const core = new T.Mesh(new T.CircleGeometry(0.6, 32), mat(0x0a0614, 0.7));
    core.scale.set(1, 1.45, 1);
    core.position.z = 0.01;
    g.add(rim, film, core);
    g.userData.film = film;
    g.userData.rim = rim;
    return g;
  }
  // where an aimed door goes: as far as the aim reaches anywhere in the map,
  // on a floor you can stand on (walked back toward me until there is one)
  function doorSpot(c) {
    const p = aimPoint(450),
      B = MAP.bounds,
      x0 = Math.max(B.minX + 1.5, Math.min(B.maxX - 1.5, p.x)),
      z0 = Math.max(B.minZ + 1.5, Math.min(B.maxZ - 1.5, p.z)),
      dx = c.pos.x - x0,
      dz = c.pos.z - z0,
      L = Math.hypot(dx, dz) || 1;
    for (let t = 0; t <= L; t += 0.5) {
      const x = x0 + (dx / L) * t,
        z = z0 + (dz / L) * t,
        gy = groundAt(x, z, (p.y || 0) + 0.3);
      if (gy <= 4.6 && !collideXZ(x, z, gy, 0.45)) return { x, y: gy, z };
    }
    return { x: c.pos.x, y: c.y || 0, z: c.pos.z };
  }
  // 차원문: the first press sets one door where I aim (no limit in the map) and
  // gives the charge back; the second sets the other and opens the pair. One
  // of my team goes through once, then both close.
  const PEND = new Map(); // caster → the first door, waiting for its pair
  function door(at, yaw, col, op) {
    const m = doorMesh(col);
    m.position.set(at.x, at.y + 1.6, at.z);
    m.rotation.y = yaw;
    op != null && m.traverse((o) => o.material && (o.material.opacity *= op));
    scene.add(m);
    const g = ring(at.x, at.z, 1.3, col, 0.5, 0.2, at.y + 0.06);
    return { m, g, drop: () => (drop(m), drop(g)) };
  }
  H.y_portal = () => {
    const c = player,
      s = doorSpot(c),
      yaw = (c.yaw || 0) + Math.PI,
      P = PEND.get(c);
    if (!P || P.until <= CLK) {
      P && P.close();
      const D = door(s, yaw, VIO, 0.6),
        rec = { at: s, yaw, D, until: CLK + 40, used: !1 };
      rec.close = () => (rec.used || D.drop(), (rec.used = !0));
      PEND.set(c, rec);
      live(40, (t) => {
        if (PEND.get(c) !== rec) return !1;
        D.m.userData.rim.rotation.z = t * 0.8;
      }, () => PEND.get(c) === rec && (PEND.delete(c), rec.close()));
      fxColumn(s.x, s.z, VIO, 4, 0.6);
      try {
        CAST_REFUND = !0;
      } catch (e) {}
      c === viewer() && bannerMe("차원문 하나 — 한 번 더 누르면 두 번째 문", "#b388ff");
      return;
    }
    // the second door: the pair opens
    PEND.delete(c);
    P.used = !0;
    const A = P.at,
      Bp = s,
      dA = P.D,
      dB = door(Bp, yaw, VIO2);
    dA.m.traverse((o) => o.material && (o.material.opacity = Math.min(1, o.material.opacity / 0.6)));
    const team = c.team;
    let done = !1;
    const gone = () => {
      done = !0;
      for (const p of [A, Bp]) (fxRing(p.x, p.z, 2.4, VIO2, 0.5), sparks(p.x, p.y + 1.5, p.z, VIO2, 12, 4));
    };
    live(25, (t) => {
      if (done) return !1;
      [dA, dB].forEach((D, i) => {
        D.m.userData.rim.rotation.z = t * (i ? -1.5 : 1.5);
        D.m.userData.film.material.opacity = 0.22 + 0.1 * Math.sin(t * 5 + i);
      });
      for (const a of actorList()) {
        if (!a || !a.alive || a.team !== team || (a.__portT || 0) > CLK) continue;
        for (const [Pp, Q, qyaw] of [
          [A, Bp, yaw],
          [Bp, A, P.yaw],
        ]) {
          if (dist2D(a, Pp.x, Pp.z) > 1.1 || Math.abs((a.y || 0) - Pp.y) > 1.6) continue;
          // out a step in front of the other door (the side it was set from)
          const fx = -Math.sin(qyaw),
            fz = -Math.cos(qyaw),
            ox = Q.x + fx * 1.5,
            oz = Q.z + fz * 1.5,
            ok = !collideXZ(ox, oz, Q.y, 0.4);
          a.pos.x = ok ? ox : Q.x;
          a.pos.z = ok ? oz : Q.z;
          a.y = Q.y;
          a.vy = 0;
          a.__portT = CLK + 1.2;
          try {
            a === viewer() && SFX.abilityCast && SFX.abilityCast("blink");
          } catch (e) {}
          gone();
          return !1;
        }
      }
    }, () => (dA.drop(), dB.drop()));
    fxColumn(Bp.x, Bp.z, VIO2, 6, 0.8);
    tellTeam(c, "차원문 열림 — 한 번 지나가면 닫힙니다", "#b388ff");
  };
  // hidden from enemies more than four metres away; a shot gives it away
  H.y_phase_cloak = () => {
    const c = player;
    c.__cloakT = 5;
    c.__cloakShot = c._shotT || 0;
    c.revealed = 0;
    sparks(c.pos.x, (c.y || 0) + 1.2, c.pos.z, VIO2, 14, 3);
    fxColumn(c.pos.x, c.pos.z, VIO, 3.5, 0.5);
  };
  // half of what hits me goes back to whoever shot
  H.y_refract = () => {
    const c = player;
    c.__reflT = 4;
    const g = new T.Mesh(new T.IcosahedronGeometry(1.25, 1), new T.MeshBasicMaterial({ color: VIO2, wireframe: !0, transparent: !0, opacity: 0.55, depthWrite: !1, blending: T.AdditiveBlending }));
    g.scale.set(1, 1.35, 1);
    scene.add(g);
    live(4, (t, dt) => {
      if (!c.alive || !(c.__reflT > 0)) return !1;
      g.position.set(c.pos.x, (c.y || 0) + 1.1, c.pos.z);
      g.rotation.y += 1.2 * dt;
      g.rotation.x = 0.2 * Math.sin(t * 3);
      g.material.opacity = 0.35 + 0.2 * Math.sin(t * 9);
    }, () => drop(g));
    sparks(c.pos.x, (c.y || 0) + 1.2, c.pos.z, VIO, 10, 3);
  };
  // the enemy leaves the world for four seconds: unseen, still, harmless, unharmed
  H.y_ult_banish = () => {
    const c = player,
      s = pick(c, 40);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, VIO, 0.06, 0.4);
    if (!s.hit) return sparks(s.end.x, s.end.y, s.end.z, VIO, 10, 4);
    const e = s.hit,
      x = e.pos.x,
      z = e.pos.z,
      y = e.y || 0;
    e.__banT = 4;
    e.__banX = x;
    e.__banZ = z;
    e.__banY = y;
    statusOn(e, "root", 4);
    statusOn(e, "silenced", 4);
    e.revealed = 0;
    // the tear it went through stays open
    const tear = new T.Group(),
      outer = new T.Mesh(new T.CircleGeometry(1, 40), mat(VIO, 0.55, !0)),
      inner = new T.Mesh(new T.CircleGeometry(0.75, 40), mat(0x07030f, 0.85));
    inner.position.z = 0.01;
    tear.add(outer, inner);
    tear.scale.set(0.7, 1.6, 1);
    tear.position.set(x, y + 1.3, z);
    scene.add(tear);
    live(4, (t, dt) => {
      camera && tear.lookAt(camera.position.x, y + 1.3, camera.position.z);
      outer.material.opacity = 0.4 + 0.2 * Math.sin(t * 8);
      tear.scale.x = 0.7 + 0.08 * Math.sin(t * 5);
      Math.random() < 0.4 && sparks(x, y + 1.3, z, VIO2, 1, 2);
    }, () => drop(tear), () => {
      e.__banT = 0;
      fxColumn(x, z, VIO2, 6, 0.8);
      sparks(x, y + 1.2, z, VIO2, 16, 5);
    });
    fxColumn(x, z, VIO, 8, 0.9);
    "function" == typeof viewerShake && viewerShake(x, z, 0.3);
    tellTeam(c, "차원 추방", "#8e5cff");
  };

  // ── 황야 — the gunslinger ──
  // eight seconds of bullets that bounce on to a second enemy
  H.y_ricochet = () => {
    const c = player;
    c.__ricoT = 8;
    const g = new T.Mesh(new T.TorusGeometry(0.7, 0.03, 6, 32), mat(AMB, 0.8, !0));
    g.rotation.x = Math.PI / 2;
    scene.add(g);
    live(8, (t) => {
      if (!c.alive || !(c.__ricoT > 0)) return !1;
      g.position.set(c.pos.x, (c.y || 0) + 1.05 + 0.15 * Math.sin(t * 4), c.pos.z);
      g.rotation.z = t * 3;
      g.material.opacity = 0.5 + 0.25 * Math.sin(t * 7);
    }, () => drop(g));
    sparks(c.pos.x, (c.y || 0) + 1.3, c.pos.z, AMB, 10, 3);
  };
  // a full magazine now, and faster hands for five seconds
  H.y_quickdraw = () => {
    const c = player;
    c.__rapidT = 5;
    try {
      const k = actorWeaponKey(c),
        w = WEAPONS[k];
      if (w && w.mag && "knife" !== k && c.ammo) {
        c.ammo[k] = w.mag;
        c.reloading = 0;
      }
    } catch (e) {}
    sparks(c.pos.x, (c.y || 0) + 1.2, c.pos.z, ORG, 12, 4);
    fxRing(c.pos.x, c.pos.z, 2.2, ORG, 0.35);
  };
  // a price on one head: whoever of my team takes it pays the whole team
  H.y_bounty = () => {
    const c = player,
      s = pick(c, 50);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, AMB, 0.03, 0.3);
    if (!s.hit) {
      try {
        CAST_REFUND = !0;
      } catch (e) {}
      return sparks(s.end.x, s.end.y, s.end.z, AMB, 6, 3);
    }
    const e = s.hit;
    e.__bountyT = 12;
    e.__bountyTeam = c.team;
    // a wanted star over the head, turning
    const g = new T.Group(),
      sh = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2,
        r = i % 2 ? 0.2 : 0.45;
      i ? sh.lineTo(Math.sin(a) * r, Math.cos(a) * r) : sh.moveTo(Math.sin(a) * r, Math.cos(a) * r);
    }
    g.add(new T.Mesh(new T.ShapeGeometry(sh), mat(AMB, 0.95, !0)));
    const rr = new T.Mesh(new T.RingGeometry(0.52, 0.6, 32), mat(ORG, 0.9, !0));
    g.add(rr);
    overHead(e, g, 12, 2.85, 2.4);
    sparks(e.pos.x, (e.y || 0) + 2.2, e.pos.z, AMB, 8, 2);
    tellTeam(c, "현상금 — 처치하면 팀 전원 궁극기", "#ffc107");
  };
  // a ring only the two of us are in
  H.y_ult_duel = () => {
    const c = player,
      s = pick(c, 40);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, ORG, 0.05, 0.35);
    if (!s.hit) return sparks(s.end.x, s.end.y, s.end.z, ORG, 8, 3);
    const e = s.hit,
      x = (c.pos.x + e.pos.x) / 2,
      z = (c.pos.z + e.pos.z) / 2,
      r = Math.min(13, Math.max(7, Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z) / 2 + 3));
    for (const D of DUELS) if (D.a === e || D.b === e || D.a === c || D.b === c) D.until = 0;
    const D = { a: c, b: e, x, z, r, until: CLK + 8 };
    const groundY = abilityGroundY(x, z, c.y);
    DUELS.push(D);
    const wall = new T.Mesh(new T.CylinderGeometry(r, r, 3.2, 64, 1, !0), mat(ORG, 0.22)),
      edge = new T.Mesh(new T.RingGeometry(r - 0.45, r, 72), mat(0xff5a1f, 0.9));
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, groundY + 0.08, z);
    scene.add(edge);
    wall.position.set(x, groundY + 1.6, z);
    scene.add(wall);
    const posts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      posts.push(dot(0xff7a2f, 1.1, x + Math.cos(a) * r, groundY + 0.5, z + Math.sin(a) * r));
    }
    live(8, (t) => {
      if (!(D.until > CLK)) return !1;
      wall.material.opacity = 0.18 + 0.07 * Math.sin(t * 5);
      posts.forEach((p, i) => (p.position.y = groundY + 0.5 + 0.25 * Math.sin(t * 4 + i)));
    }, () => {
      drop(wall);
      drop(edge);
      posts.forEach((p) => scene.remove(p));
    });
    fxColumn(c.pos.x, c.pos.z, ORG, 6, 0.8);
    fxColumn(e.pos.x, e.pos.z, ORG, 6, 0.8);
    const v = viewer();
    v && (v === c || v === e) && bannerMe("결투! 둘 중 하나만 나간다", "#e8743b");
  };

  // ── 나침 — the navigator ──
  const PRINTS = { n: 0 };
  const TEAL = 0x2ec4b6,
    MINT = 0xa7fff3;
  // a survey stake: the paths enemies walked near it in the last six seconds
  // show as glowing footprints, to my team only (where they went, not where they are)
  H.y_footprints = () => {
    const c = player,
      p = aimAt(30),
      team = c.team,
      mine = () => {
        const v = viewer();
        return !!v && v.team === team;
      };
    const stake = new T.Group();
    stake.add(new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.2, 6), mat(0xe8e2cf, 0.95)));
    const flag = new T.Mesh(new T.PlaneGeometry(0.4, 0.26), mat(TEAL, 0.9, !0));
    flag.position.set(0.2, 0.45, 0);
    stake.add(flag);
    stake.position.set(p.x, (p.y || 0) + 0.6, p.z);
    scene.add(stake);
    const edge = ring(p.x, p.z, 22, TEAL, mine() ? 0.25 : 0, 0.3, (p.y || 0) + 0.07);
    const seen = new Set(),
      tick = every(0.25);
    const print = (x, y, z, yaw, k) => {
      PRINTS.n++;
      if (!mine()) return;
      const m = new T.Mesh(new T.CircleGeometry(0.16, 10), mat(0xff5a6e, 0.85, !0));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -yaw;
      m.scale.set(0.7, 1.25, 1);
      m.position.set(x + Math.cos(yaw) * 0.14 * k, y + 0.05, z - Math.sin(yaw) * 0.14 * k);
      addFx(m, 6, (o, t) => (o.material.opacity = 0.85 * (1 - t)));
    };
    live(8, (t, dt) => {
      flag.rotation.y += 2 * dt;
      if (!tick(dt)) return;
      for (const e of foesOf(c)) {
        const h = HIST.get(e) || [];
        for (let i = 1; i < h.length; i += 2) {
          const s0 = h[i - 1],
            s1 = h[i];
          if (s1.t < CLK - 6 || Math.hypot(s1.x - p.x, s1.z - p.z) > 22 || Math.hypot(s1.x - s0.x, s1.z - s0.z) < 0.3) continue;
          const key = e.id + ":" + s1.t.toFixed(2);
          if (seen.has(key)) continue;
          seen.add(key);
          print(s1.x, s1.y, s1.z, Math.atan2(s1.x - s0.x, s1.z - s0.z), (i >> 1) % 2 ? 1 : -1);
        }
      }
    }, () => (drop(stake), drop(edge)));
    fxColumn(p.x, p.z, TEAL, 4, 0.6);
  };
  // a needle in the middle of the screen pointing at the nearest enemy
  let needle = null;
  H.y_compass = () => {
    const c = player;
    c.__compT = 7;
    sparks(c.pos.x, (c.y || 0) + 1.4, c.pos.z, TEAL, 8, 2);
  };
  function drawNeedle() {
    const v = viewer(),
      on = !!(v && v.alive && v.__compT > 0 && "menu" !== world.phase);
    if (!on) return void (needle && (needle.style.display = "none"));
    if (!needle) {
      needle = document.createElement("div");
      needle.id = "y3-needle";
      needle.innerHTML = `<svg viewBox="-60 -60 120 120"><circle r="46" fill="none" stroke="#2ec4b6" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 6"/><g class="nd"><path d="M0 -52 L7 -38 L-7 -38Z" fill="#a7fff3"/></g></svg><b></b>`;
      needle.style.cssText = "position:fixed;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;pointer-events:none;z-index:6;filter:drop-shadow(0 0 6px #2ec4b6)";
      needle.querySelector("b").style.cssText = "position:absolute;left:0;right:0;top:100%;text-align:center;font:700 11px var(--f-display,system-ui);color:#a7fff3;letter-spacing:.06em";
      document.body.appendChild(needle);
    }
    let best = null,
      bd = 1e9;
    for (const e of foesOf(v)) {
      if (e.__banT > 0) continue;
      const d = Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z);
      d < bd && ((bd = d), (best = e));
    }
    if (!best) return void (needle.style.display = "none");
    // the angle on screen: 0 straight ahead, clockwise to the right
    const ang = Math.atan2(best.pos.x - v.pos.x, best.pos.z - v.pos.z),
      look = Math.atan2(-Math.sin(v.yaw || 0), -Math.cos(v.yaw || 0)),
      rel = look - ang;
    needle.querySelector(".nd").setAttribute("transform", `rotate(${((rel * 180) / Math.PI).toFixed(1)})`);
    needle.querySelector("b").textContent = bd < 15 ? "가까움" : bd < 40 ? "중간" : "멀리";
    needle.style.display = "block";
  }
  // eight seconds of shots that hurt more the farther they go
  H.y_rangefinder = () => {
    const c = player;
    c.__rangeT = 8;
    const g = new T.Mesh(new T.RingGeometry(0.42, 0.5, 4), mat(TEAL, 0.85, !0));
    scene.add(g);
    live(8, (t) => {
      if (!c.alive || !(c.__rangeT > 0)) return !1;
      g.position.set(c.pos.x, (c.y || 0) + 2.45, c.pos.z);
      camera && g.lookAt(camera.position);
      g.rotation.z = t * 2;
    }, () => drop(g));
    fxRing(c.pos.x, c.pos.z, 2.5, TEAL, 0.4);
  };
  const rangeMul = (src, e) => {
    const d = Math.hypot(e.pos.x - src.pos.x, e.pos.z - src.pos.z);
    return 1 + 0.4 * Math.max(0, Math.min(1, (d - 10) / 30));
  };

  // ── the ultimate: a map; where I touch it, I am ──
  // A spot I can stand on: the floor there, or the raised floor or heaven at
  // that spot, or the nearest free floor around it.
  function standAt(x, z) {
    if (window.ASCENT_TRIAL?.active) return ASCENT_TRIAL.standAt(x, z);
    const B = MAP.bounds;
    const ok = (x, z, y) => x > B.minX + 1 && x < B.maxX - 1 && z > B.minZ + 1 && z < B.maxZ - 1 && !collideXZ(x, z, y, 0.45);
    for (let r = 0; r <= 8; r += 0.75)
      for (let k = 0, n = r ? Math.ceil(r * 5) : 1; k < n; k++) {
        const a = (k / n) * Math.PI * 2,
          px = x + Math.cos(a) * r,
          pz = z + Math.sin(a) * r,
          g0 = groundAt(px, pz, 0);
        if (ok(px, pz, g0)) return { x: px, y: g0, z: pz };
        const g1 = groundAt(px, pz, 4.6);
        if (g1 > g0 && g1 <= 4.6 && ok(px, pz, g1)) return { x: px, y: g1, z: pz };
      }
    return null;
  }
  function warpTo(a, at) {
    const x0 = a.pos.x,
      z0 = a.pos.z,
      y0 = a.y || 0;
    a.pos.x = at.x;
    a.pos.z = at.z;
    a.y = at.y;
    a.vel && a.vel.set(0, 0, 0);
    a.vy = 0;
    a.__warpT = 0;
    warpFx(x0, y0, z0, at.x, at.y, at.z);
  }
  function warpFx(x0, y0, z0, x, y, z) {
    try {
      fxColumn(x0, z0, TEAL, 8, 0.8);
      sparks(x0, y0 + 1.2, z0, MINT, 10, 3);
      fxColumn(x, z, TEAL, 10, 1);
      fxRing(x, z, 3, MINT, 0.6);
      sparks(x, y + 1.2, z, MINT, 16, 5);
      "function" == typeof viewerShake && viewerShake(x, z, 0.2);
    } catch (e) {}
  }
  const WP = { el: null, cv: null, until: 0, timer: null, me: null };
  function pickerOpen(c) {
    if (!WP.el) {
      const d = document.createElement("div");
      d.id = "y3-warp";
      d.innerHTML = `<div class="wp-card"><div class="wp-head"><b>좌표 이동</b><span class="wp-t"></span><button class="wp-x" type="button">취소</button></div><canvas></canvas><div class="wp-tip">갈 곳을 누르세요 · 맵 안이면 어디든</div></div>`;
      const st = document.createElement("style");
      st.textContent = `#y3-warp{position:fixed;inset:0;z-index:85;display:none;place-items:center;background:rgba(4,8,12,.6);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}#y3-warp.on{display:grid}#y3-warp .wp-card{padding:10px 12px 12px;border-radius:16px;border:1px solid #2ec4b688;background:#0c1418ee;box-shadow:0 30px 80px -20px #000;color:#e8f6f4}#y3-warp .wp-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;font:700 14px var(--f-display,system-ui);letter-spacing:.06em}#y3-warp .wp-t{flex:1;color:#a7fff3;font-size:12px}#y3-warp .wp-x{height:32px;padding:0 14px;border-radius:9px;border:1px solid #2a3a40;background:rgba(255,255,255,.05);color:#e8f6f4;font-weight:700;cursor:pointer}#y3-warp canvas{display:block;border-radius:10px;cursor:crosshair;touch-action:none}#y3-warp .wp-tip{margin-top:6px;font-size:11px;color:#8fb7b2;text-align:center}`;
      document.head.appendChild(st);
      document.body.appendChild(d);
      WP.el = d;
      WP.cv = d.querySelector("canvas");
      d.querySelector(".wp-x").onclick = () => pickerDone(null);
      const pick = (ev) => {
        ev.preventDefault();
        const r = WP.cv.getBoundingClientRect(),
          pt = ev.touches ? ev.touches[0] || ev.changedTouches[0] : ev,
          w = WP.view;
        if (!w) return;
        const x = w.x0 + ((pt.clientX - r.left) / r.width) * w.w,
          z = w.z0 + ((pt.clientY - r.top) / r.height) * w.h,
          at = standAt(x, z);
        if (!at) return void (d.querySelector(".wp-tip").textContent = "갈 수 없는 곳입니다 · 다른 곳을 누르세요");
        pickerDone(at);
      };
      WP.cv.addEventListener("mousedown", pick);
      WP.cv.addEventListener("touchstart", pick, { passive: !1 });
    }
    WP.me = c;
    WP.until = performance.now() + 1e4;
    WP.el.querySelector(".wp-tip").textContent = "갈 곳을 누르세요 · 맵 안이면 어디든";
    try {
      document.exitPointerLock && document.exitPointerLock();
    } catch (e) {}
    drawPicker();
    WP.el.classList.add("on");
    clearInterval(WP.timer);
    WP.timer = setInterval(() => {
      const left = WP.until - performance.now();
      WP.el.querySelector(".wp-t").textContent = Math.max(0, Math.ceil(left / 1e3)) + "초";
      drawPicker();
      (left <= 0 || !WP.me || !WP.me.alive || "menu" === world.phase || "over" === world.phase) && pickerDone(null);
    }, 200);
  }
  function drawPicker() {
    const B = MAP.bounds,
      W0 = B.maxX - B.minX,
      H0 = B.maxZ - B.minZ,
      maxW = Math.min(innerWidth - 60, 900),
      maxH = Math.min(innerHeight - 110, 760),
      k = Math.min(maxW / W0, maxH / H0),
      cw = Math.round(W0 * k),
      ch = Math.round(H0 * k),
      cv = WP.cv;
    cv.width !== cw && (cv.width = cw);
    cv.height !== ch && (cv.height = ch);
    WP.view = { x0: B.minX, z0: B.minZ, w: W0, h: H0 };
    const g = cv.getContext("2d"),
      X = (x) => (x - B.minX) * k,
      Z = (z) => (z - B.minZ) * k;
    g.fillStyle = "#16252a";
    g.fillRect(0, 0, cw, ch);
    // grid every 10 m
    g.strokeStyle = "rgba(46,196,182,.08)";
    g.lineWidth = 1;
    for (let x = Math.ceil(B.minX / 10) * 10; x < B.maxX; x += 10) (g.beginPath(), g.moveTo(X(x), 0), g.lineTo(X(x), ch), g.stroke());
    for (let z = Math.ceil(B.minZ / 10) * 10; z < B.maxZ; z += 10) (g.beginPath(), g.moveTo(0, Z(z)), g.lineTo(cw, Z(z)), g.stroke());
    // what stands: dark if tall, lighter if low or a floor up high
    for (const c of COLLIDERS) {
      if (c.temp) continue;
      g.fillStyle = c.y0 > 0 ? "rgba(122,108,196,.55)" : c.h > 3.2 ? "#3a4650" : c.h > 1 ? "#55646e" : "#405058";
      g.fillRect(X(c.minX), Z(c.minZ), Math.max(1, (c.maxX - c.minX) * k), Math.max(1, (c.maxZ - c.minZ) * k));
    }
    for (const s of MAP.sites || []) {
      g.strokeStyle = "#ff6b7a";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(X(s.x), Z(s.z), (s.r || 8) * k, 0, 7);
      g.stroke();
      g.fillStyle = "#ff8a96";
      g.font = `700 ${Math.max(12, 3.2 * k)}px system-ui`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(s.id, X(s.x), Z(s.z));
    }
    const me = WP.me;
    for (const a of actorList()) {
      if (!a || !a.alive || !me || a.team !== me.team) continue;
      g.fillStyle = a === me ? "#ffd166" : "#5ec8ff";
      g.beginPath();
      g.arc(X(a.pos.x), Z(a.pos.z), a === me ? 6 : 4, 0, 7);
      g.fill();
    }
  }
  function pickerDone(at) {
    clearInterval(WP.timer);
    WP.el && WP.el.classList.remove("on");
    const me = WP.me;
    WP.me = null;
    if (!me) return;
    try {
      "undefined" != typeof IS_TOUCH && !IS_TOUCH && "function" == typeof tryLock && "menu" !== world.phase && tryLock();
    } catch (e) {}
    if (!at) {
      // not used: the ultimate comes back
      if ("client" === NET.mode) sendAction({ t: "y3warp", cancel: 1 });
      else me.ultCharge = me.ultMax || 7;
      me.__warpT = 0;
      return void bannerMe("좌표 이동 취소 — 궁극기를 돌려받았습니다", "#8fb7b2");
    }
    const from = [me.pos.x, me.y || 0, me.pos.z];
    warpTo(me, at);
    if ("client" === NET.mode) sendAction({ t: "y3warp", x: Math.round(at.x * 100), y: Math.round(at.y * 100), z: Math.round(at.z * 100) });
    else send({ k: "wp", a: me.id, p: from.concat([at.x, at.y, at.z]).map((v) => Math.round(v * 10)) });
  }
  H.y_ult_warp = () => {
    const c = player;
    c.__warpT = 12;
    fxColumn(c.pos.x, c.pos.z, TEAL, 6, 1.2);
    sparks(c.pos.x, (c.y || 0) + 1.3, c.pos.z, MINT, 10, 3);
    if (c === viewer()) return void pickerOpen(c);
    // a bot picks a spot near where it is headed
    if (isHost() && "function" == typeof isAI && isAI(c)) {
      let goal = null;
      try {
        goal = "function" == typeof aiGoal ? aiGoal(c) : null;
      } catch (e) {}
      goal = goal || { x: c.pos.x, z: c.pos.z };
      later(1, () => {
        if (!c.alive || !(c.__warpT > 0)) return;
        const at = standAt(goal.x + (Math.random() - 0.5) * 10, goal.z + (Math.random() - 0.5) * 10);
        if (!at) return;
        const from = [c.pos.x, c.y || 0, c.pos.z];
        warpTo(c, at);
        send({ k: "wp", a: c.id, p: from.concat([at.x, at.y, at.z]).map((v) => Math.round(v * 10)) });
      });
    }
  };

  // ── 거미줄 이동 — the spider's E: shoot a web, get pulled to it ──
  // The web flies to where I aim (up to 48 m); if it holds on something I am
  // pulled there fast and can cut loose with a jump (a swing off); landing
  // beside a wall, I stay hanging on it for a few seconds.
  const ZIP_SPEED = 58,
    ZIP_RANGE = 48;
  H.y_webzip = () => {
    const c = player,
      a = aimPoint(ZIP_RANGE);
    const e0 = eye(c);
    if (!a || !a.hit) {
      // nothing to hold on to: the web falls short, the charge comes back
      const L = ZIP_RANGE * 0.5,
        yaw = c.yaw || 0,
        pit = c.pitch || 0;
      beam(e0.x, e0.y - 0.2, e0.z, e0.x - Math.sin(yaw) * Math.cos(pit) * L, e0.y - 0.2 + Math.sin(pit) * L, e0.z - Math.cos(yaw) * Math.cos(pit) * L, WEB, 0.03, 0.4);
      try {
        CAST_REFUND = !0;
      } catch (e) {}
      c === viewer() && bannerMe("닿을 곳이 없습니다", "#cfd8dc");
      return;
    }
    const gy = groundAt(a.x, a.z, (a.y || 0) + 0.3),
      ty = Math.max(gy, (a.y || 0) - 1.0);
    const Z = { x: a.x, y: ty, z: a.z, ay: a.y || 0, t: 1.6, t0: 1.6, done: !1 };
    c.__zip = Z;
    c.__hangY = null;
    sparks(a.x, a.y || 0, a.z, WEB, 10, 3);
    fxRing(a.x, a.z, 1.4, WEB, 0.35);
    const web = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1, 6, 1, !0), mat(WEB, 0.9, !0));
    scene.add(web);
    const up = new T.Vector3(0, 1, 0),
      v = new T.Vector3();
    live(1.8, (t) => {
      if (Z.done && t > 0.25) return !1;
      const x1 = c.pos.x,
        y1 = (c.y || 0) + 1.45,
        z1 = c.pos.z,
        dx = a.x - x1,
        dy = (a.y || 0) - y1,
        dz = a.z - z1,
        L = Math.hypot(dx, dy, dz) || 0.01;
      web.position.set((x1 + a.x) / 2, (y1 + (a.y || 0)) / 2, (z1 + a.z) / 2);
      web.scale.set(1, L, 1);
      web.quaternion.setFromUnitVectors(up, v.set(dx / L, dy / L, dz / L));
      web.material.opacity = Z.done ? 0.9 * Math.max(0, 1 - (t - 0.0) / 0.4) : 0.9;
    }, () => drop(web));
  };
  // end of a pull: hang on a wall if I landed against one, else drop
  function zipEnd(a, jump) {
    const Z = a.__zip;
    a.__zip = null;
    Z && (Z.done = !0);
    if (!Z) return;
    const floor = groundAt(a.pos.x, a.pos.z, a.y || 0);
    if (jump) {
      a.vy = 5;
      a.onGround = !1;
    } else if ((a.y || 0) > floor + 0.5) {
      a.__climbT = Math.max(a.__climbT || 0, 4);
      a.__hangY = a.y || 0;
    }
    try {
      sparks(a.pos.x, (a.y || 0) + 1.2, a.pos.z, WEB, 6, 2);
    } catch (e) {}
  }

  // ── 거미 — the spider's Q becomes wall-crawling ──
  // For ten seconds walls are floors: walk into one and you climb it, stop and
  // you hang there, move sideways and you crawl along it, reach the top and you
  // stand on it; jump to let go.
  const WEB = 0xf5f5f5;
  H.y_wallcrawl = () => {
    const c = player;
    c.__climbT = 10;
    c.__hangY = null;
    sparks(c.pos.x, (c.y || 0) + 1.2, c.pos.z, WEB, 12, 3);
    fxRing(c.pos.x, c.pos.z, 2.2, 0xb0bec5, 0.4);
    c === viewer() && bannerMe("거미 타기 — 벽으로 걸어가면 올라갑니다 (10초)", "#cfd8dc");
  };
  // the wall at a point at this height: its top, or 0 if nothing stands there
  function wallTop(x, z, y) {
    let top = 0;
    for (const w of COLLIDERS) {
      if (x < w.minX - 0.05 || x > w.maxX + 0.05 || z < w.minZ - 0.05 || z > w.maxZ + 0.05) continue;
      if (w.y0 && y + 2.3 <= w.y0) continue; // a floor overhead
      if (w.h > y + 0.05 && w.h > top) top = w.h;
    }
    return top;
  }
  // a body stops this far from a wall (its radius), so feel a little beyond it
  const probeR = () => ("undefined" != typeof PR ? PR : 0.8) + 0.4;
  const _sim = simMove;
  simMove = function (a, dt) {
    if (a && a.__zip) {
      const Z = a.__zip,
        d0 = dt || 0.016;
      if (!a.alive) return void zipEnd(a, !1);
      Z.t -= d0;
      const dx = Z.x - a.pos.x,
        dy = Z.y - (a.y || 0),
        dz = Z.z - a.pos.z,
        d = Math.hypot(dx, dy, dz),
        jump = !!(a.input && a.input.btn & BTN.JUMP) && Z.t0 - Z.t > 0.25;
      if (d < 0.8 || Z.t <= 0 || jump) return void zipEnd(a, jump);
      const k = Math.min(d, ZIP_SPEED * d0) / d,
        nx = a.pos.x + dx * k,
        nz = a.pos.z + dz * k,
        ny = (a.y || 0) + dy * k;
      // a wall in the way: the pull ends here
      if (collideXZ(nx, nz, ny, 0.4)) return void zipEnd(a, !1);
      a.pos.x = nx;
      a.pos.z = nz;
      a.y = ny;
      a.vy = 0;
      a.onGround = !1;
      a.vel && a.vel.set(0, 0, 0);
      return;
    }
    if (!a || !(a.__climbT > 0) || !a.alive) return _sim.apply(this, arguments);
    const inp = a.input || { mv: [0, 0], btn: 0 },
      n = inp.mv[0] || 0,
      r = inp.mv[1] || 0,
      L = Math.hypot(n, r);
    // where the stick points, in the world (as simMove reads it)
    let wx = 0,
      wz = 0;
    if (L > 0) {
      const t = -Math.sin(a.yaw),
        o = -Math.cos(a.yaw),
        q = Math.cos(a.yaw),
        l = -Math.sin(a.yaw),
        cc = -r / L,
        d = n / L;
      wx = t * cc + q * d;
      wz = o * cc + l * d;
    }
    const jump = !!(inp.btn & BTN.JUMP);
    const res = _sim.apply(this, arguments);
    try {
      const y = a.y || 0,
        dtt = dt || 0.016;
      // let go: a jump away from the wall
      if (jump && null != a.__hangY) {
        // push off: away from the wall I am on, a small hop
        const P = probeR();
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2,
            cx = Math.cos(ang),
            cz = Math.sin(ang);
          if (wallTop(a.pos.x + cx * P, a.pos.z + cz * P, a.__hangY - 0.05) > a.__hangY) {
            const bx = a.pos.x - cx * 0.9,
              bz = a.pos.z - cz * 0.9;
            collideXZ(bx, bz, a.__hangY, 0.4) || ((a.pos.x = bx), (a.pos.z = bz));
            break;
          }
        }
        a.__hangY = null;
        a.__climbOff = 0.5; // a moment before it can grab a wall again
        a.vy = 2;
        return res;
      }
      if (a.__climbOff > 0) return void (a.__climbOff -= dt || 0.016), res;
      // a wall where I am heading: climb it
      const PROBE = probeR(),
        ahead = L > 0 ? wallTop(a.pos.x + wx * PROBE, a.pos.z + wz * PROBE, y) : 0;
      if (ahead > y + 0.05 && ahead - y > STEP_H * 0.9) {
        const ny = Math.min(ahead, (null != a.__hangY ? a.__hangY : y) + 5.5 * dtt);
        a.y = ny;
        a.vy = 0;
        a.onGround = !1;
        a.__hangY = ny;
        // over the top: onto it
        if (ny >= ahead - 0.02) {
          const fx = a.pos.x + wx * (PROBE + 0.3),
            fz = a.pos.z + wz * (PROBE + 0.3);
          if (!collideXZ(fx, fz, ahead, 0.3)) {
            a.pos.x = fx;
            a.pos.z = fz;
            a.y = ahead;
            a.onGround = !0;
            a.__hangY = null;
          }
        }
        Math.random() < 0.15 && sparks(a.pos.x + wx * 0.4, a.y + 1.6, a.pos.z + wz * 0.4, WEB, 1, 1);
        return res;
      }
      // still against a wall (any side): hang where I am, crawling along it
      if (null != a.__hangY) {
        let touch = !1;
        const PROBE = probeR();
        for (let k = 0; k < 8 && !touch; k++) {
          const ang = (k / 8) * Math.PI * 2;
          wallTop(a.pos.x + Math.cos(ang) * PROBE, a.pos.z + Math.sin(ang) * PROBE, a.__hangY - 0.05) > a.__hangY && (touch = !0);
        }
        const floor = groundAt(a.pos.x, a.pos.z, a.__hangY);
        if (touch && a.__hangY > floor + 0.05) {
          a.y = a.__hangY;
          a.vy = 0;
          a.onGround = !1;
        } else a.__hangY = null;
      }
    } catch (e) {}
    return res;
  };

  // ── the rules behind them ──
  const _dd = dealDamage;
  dealDamage = function (e, dmg, head, src) {
    if (!e) return _dd.apply(this, arguments);
    // put out of the world: nothing reaches it, nothing comes from it
    if (e.__banT > 0 || (src && src.__banT > 0)) return;
    // the duel: only the two of them, and the challenger hits harder
    for (const D of DUELS) {
      if (!(D.until > CLK)) continue;
      const inE = e === D.a || e === D.b,
        inS = !!src && (src === D.a || src === D.b);
      if (src && src !== e && inE !== inS) return;
      src === D.a && e === D.b && (dmg *= 1.25);
    }
    // the rangefinder: farther, harder
    src && src.__rangeT > 0 && src !== e && src.team !== e.team && src.pos && (dmg *= rangeMul(src, e));
    const before = e.hp;
    const r = _dd.call(this, e, dmg, head, src);
    if (GUARD || !isHost() || !(dmg > 0)) return r;
    const foe = src && src !== e && src.team && e.team && src.team !== e.team;
    GUARD = !0;
    try {
      // a time mark counts what it takes
      e.__brandT > 0 && (e.__brandAcc = (e.__brandAcc || 0) + Math.max(0, before - e.hp));
      // the mirror skin: half goes back
      if (foe && e.__reflT > 0 && src.alive) {
        _dd.call(this, src, 0.5 * dmg, !1, e);
        send({ k: "rf", p: [e.pos.x, (e.y || 0) + 1.2, e.pos.z, src.pos.x, (src.y || 0) + 1.2, src.pos.z].map((v) => Math.round(v * 10)) });
        fxLine(e.pos.x, (e.y || 0) + 1.2, e.pos.z, src.pos.x, (src.y || 0) + 1.2, src.pos.z, VIO2);
      }
      // a bouncing bullet: on to the nearest other enemy it can see
      if (foe && src.__ricoT > 0 && (src.__ricoCd || 0) <= CLK) {
        let n = null,
          nd = 9;
        for (const a of foesOf(src)) {
          if (a === e) continue;
          const d = Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z);
          d < nd && !rayBlocked(e.pos.x, (e.y || 0) + 1.2, e.pos.z, a.pos.x, (a.y || 0) + 1.2, a.pos.z) && ((nd = d), (n = a));
        }
        if (n) {
          src.__ricoCd = CLK + 0.12;
          _dd.call(this, n, 0.5 * dmg, !1, src);
          const p = [e.pos.x, (e.y || 0) + 1.2, e.pos.z, n.pos.x, (n.y || 0) + 1.2, n.pos.z];
          send({ k: "rc", p: p.map((v) => Math.round(v * 10)) });
          fxLine(...p, AMB);
        }
      }
      // the echo of the time ultimate
      const E = foe && ECHO.get(src.team);
      if (E && E.until > CLK && E.c.alive && dist2D(e, E.c.pos.x, E.c.pos.z) <= 35) ECHOQ.push({ at: CLK + 1, e, dmg: Math.min(40, 0.5 * dmg), src });
    } finally {
      GUARD = !1;
    }
    return r;
  };
  function fxLine(x1, y1, z1, x2, y2, z2, col) {
    try {
      beam(x1, y1, z1, x2, y2, z2, col, 0.035, 0.25);
      sparks(x2, y2, z2, col, 4, 2);
    } catch (e) {}
  }
  function echoFx(x, y, z) {
    try {
      const cm = clockMesh(0.7, GOLD, CYAN);
      cm.position.set(x, y + 1.3, z);
      camera && cm.lookAt(camera.position);
      addFx(cm, 0.5, (m, t) => (m.scale.setScalar(1 + t), m.traverse((o) => o.material && (o.material.opacity = 0.8 * (1 - t)))));
      sparks(x, y + 1.2, z, GOLD, 5, 2);
    } catch (e) {}
  }

  // no firing from outside the world
  const _af = actorFire;
  actorFire = function (e) {
    if (e && e.__banT > 0) return;
    return _af.apply(this, arguments);
  };
  // bots do not pick out what they cannot see
  const _pt = aiPickTarget;
  aiPickTarget = function (e) {
    const hid = [];
    try {
      for (const a of world.actors || [])
        if (a.alive && a.team !== e.team && (a.__banT > 0 || (a.__cloakT > 0 && Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) > 4))) {
          a.alive = !1;
          hid.push(a);
        }
      return _pt.apply(this, arguments);
    } finally {
      hid.forEach((a) => (a.alive = !0));
    }
  };
  // the body is not drawn while hidden from this screen's player, or banished
  const _sm = syncActorModel;
  syncActorModel = function (e) {
    const r = _sm.apply(this, arguments);
    try {
      if (e && e.group && e.alive) {
        if (e.__banT > 0) e.group.visible = !1;
        else if (e.__cloakT > 0) {
          const v = viewer();
          v && v !== e && v.team !== e.team && Math.hypot(v.pos.x - e.pos.x, v.pos.z - e.pos.z) > 4 && (e.group.visible = !1);
        }
      }
    } catch (x) {}
    return r;
  };
  // a price paid
  const _ka = killActor;
  killActor = function (e, by) {
    const paid = e && e.__bountyT > 0 && by && by.team && by.team === e.__bountyTeam;
    const r = _ka.apply(this, arguments);
    if (paid && isHost()) {
      e.__bountyT = 0;
      for (const a of mates(by)) a.ultCharge = Math.min(a.ultMax || 7, (a.ultCharge || 0) + 1);
      by.alive && (by.hp = Math.min(100, by.hp + 30));
      send({ k: "bo", team: by.team, x: Math.round(e.pos.x * 10), z: Math.round(e.pos.z * 10) });
      paidFx(by.team, e.pos.x, e.pos.z);
    }
    for (const D of DUELS)
      if (D.until > CLK && (e === D.a || e === D.b)) {
        D.until = 0;
        const w = e === D.a ? D.b : D.a;
        isHost() && w.alive && (w.hp = Math.min(100, w.hp + 50));
      }
    return r;
  };
  function paidFx(team, x, z) {
    fxColumn(x, z, AMB, 8, 1);
    sparks(x, 1.5, z, AMB, 16, 5);
    const v = viewer();
    v && v.team === team && bannerMe("현상금 획득 — 팀 전원 궁극기 +1", "#ffc107");
  }
  // the host: a guest's pick on the map (only while its ultimate is waiting for one)
  const _oa3 = NET.onAction;
  NET.onAction = function (peer, m) {
    if (m && "y3warp" === m.t) {
      try {
        const a = (world.actors || []).find((x) => x.ctrl === peer);
        if (!a || !a.alive || !(a.__warpT > 0)) return;
        if (m.cancel) return void ((a.__warpT = 0), (a.ultCharge = a.ultMax || 7));
        const at = standAt(m.x / 100, m.z / 100);
        if (!at) return;
        const from = [a.pos.x, a.y || 0, a.pos.z];
        warpTo(a, at);
        send({ k: "wp", a: a.id, p: from.concat([at.x, at.y, at.z]).map((v) => Math.round(v * 10)) });
      } catch (e) {}
      return;
    }
    // a guest's first door: its charge comes back on its own screen (below)
    return _oa3 && _oa3.apply(this, arguments);
  };
  // a guest's first door gives its charge back at once (the host casts it)
  if ("function" == typeof sendAction) {
    const _sa3 = sendAction;
    sendAction = function (m) {
      const r = _sa3.apply(this, arguments);
      try {
        if (m && "abil" === m.t && "client" === NET.mode) {
          const me = viewer(),
            ab = player && player.abilities && player.abilities[m.i | 0];
          if (me && ab && ab.def && "y_portal" === ab.def.type) {
            const P = PEND.get(me);
            (!P || P.until <= CLK) && ((ab.charges = (ab.charges || 0) + 1), (ab.cd = 0));
          }
        }
      } catch (e) {}
      return r;
    };
  }
  // what the host tells the others
  const _oe = NET.onEvent;
  NET.onEvent = function (m) {
    if (m && "y3" === m.t) {
      try {
        const p = (m.p || []).map((v) => v / 10);
        if ("rf" === m.k) fxLine(...p, VIO2);
        else if ("rc" === m.k) fxLine(...p, AMB);
        else if ("ec" === m.k) echoFx(...p);
        else if ("bo" === m.k) paidFx(m.team, m.x / 10, m.z / 10);
        else if ("wp" === m.k) {
          const a = "function" == typeof actorById ? actorById(m.a) : null;
          warpFx(...p);
          // my own body moved by the host (a bot never is mine; a guest moved itself already)
          a && a === viewer() && a.__warpT > 0 && (a.__warpT = 0);
        }
        else if ("uc" === m.k) {
          const a = "function" == typeof actorById ? actorById(m.a) : null;
          a && (a.__cloakT = 0);
        }
      } catch (e) {}
      return;
    }
    return _oe && _oe.apply(this, arguments);
  };

  // the cloak and the banishment, seen from inside
  let veil = null;
  function drawVeil() {
    const v = viewer(),
      ban = v && v.__banT > 0,
      clk = v && v.__cloakT > 0;
    if (!ban && !clk) return void (veil && "none" !== veil.style.display && (veil.style.display = "none"));
    if (!veil) {
      veil = document.createElement("div");
      veil.id = "y3-veil";
      veil.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:30;display:none;align-items:flex-start;justify-content:center;padding-top:16vh;font:700 15px/1.2 var(--f-display,system-ui);letter-spacing:.06em;color:#e9ddff;text-shadow:0 0 12px #8e5cff";
      document.body.appendChild(veil);
    }
    veil.style.display = "flex";
    veil.style.boxShadow = ban ? "inset 0 0 22vmin 6vmin rgba(40,10,90,.85)" : "inset 0 0 16vmin 2vmin rgba(142,92,255,.45)";
    veil.style.background = ban ? "rgba(20,6,40,.35)" : "transparent";
    veil.textContent = ban ? `차원 밖으로 추방됨 · ${Math.ceil(v.__banT)}` : `위상 은신 · ${Math.ceil(v.__cloakT)}`;
  }

  // timers, history, the echo queue, the duel ring and the doors' push
  const KEYS = ["__brandT", "__cloakT", "__reflT", "__banT", "__ricoT", "__rapidT", "__bountyT", "__compT", "__rangeT", "__warpT", "__climbT"];
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      const d = dt || 0.016;
      CLK += d;
      record(d);
      for (const a of world.actors || []) {
        for (const k of KEYS) a[k] > 0 && (a[k] = Math.max(0, a[k] - d));
        if (a.__cloakT > 0) {
          a.revealed = 0;
          // the shot that gives it away (decided on the host)
          if (isHost() && (a._shotT || 0) > (a.__cloakShot || 0) + 1e-6) {
            a.__cloakT = 0;
            send({ k: "uc", a: a.id });
            sparks(a.pos.x, (a.y || 0) + 1.2, a.pos.z, VIO2, 8, 3);
          }
        }
        if (a.__banT > 0) {
          a.revealed = 0;
          null != a.__banX && ((a.pos.x = a.__banX), (a.pos.z = a.__banZ), (a.y = a.__banY));
          a.vel && a.vel.set(0, 0, 0);
          a.vy = 0;
        }
        a.__climbT > 0 || null == a.__hangY || (a.__hangY = null);
        if (a.__rapidT > 0) {
          a.fireCd > 0 && (a.fireCd -= 0.6 * d);
          a.reloading > 2 * d && (a.reloading = Math.max(2 * d, a.reloading - d));
        }
      }
      // echoes come due
      for (let i = ECHOQ.length - 1; i >= 0; i--) {
        const q = ECHOQ[i];
        if (q.at > CLK) continue;
        ECHOQ.splice(i, 1);
        if (!isHost() || !q.e.alive) continue;
        GUARD = !0;
        try {
          dealDamage(q.e, q.dmg, !1, q.src);
        } finally {
          GUARD = !1;
        }
        const p = [q.e.pos.x, q.e.y || 0, q.e.pos.z];
        echoFx(...p);
        send({ k: "ec", p: p.map((v) => Math.round(v * 10)) });
      }
      // the duel ring: the two stay in, everyone else stays out
      for (let i = DUELS.length - 1; i >= 0; i--) {
        const D = DUELS[i];
        if (!(D.until > CLK) || !D.a.alive || !D.b.alive) {
          DUELS.splice(i, 1);
          continue;
        }
        for (const a of world.actors || []) {
          if (!a.alive) continue;
          const dx = a.pos.x - D.x,
            dz = a.pos.z - D.z,
            dd = Math.hypot(dx, dz) || 0.01,
            inside = a === D.a || a === D.b;
          if (inside && dd > D.r - 0.6) {
            const k = (D.r - 0.6) / dd;
            moveWithSlide(a.pos, D.x + dx * k - a.pos.x, D.z + dz * k - a.pos.z, a.y || 0, 0.4);
          } else if (!inside && dd < D.r + 0.6) {
            const k = (D.r + 0.8) / dd;
            moveWithSlide(a.pos, D.x + dx * k - a.pos.x, D.z + dz * k - a.pos.z, a.y || 0, 0.4);
          }
        }
      }
      for (const [t, E] of ECHO) E.until > CLK || ECHO.delete(t);
      drawVeil();
      drawNeedle();
    } catch (e) {}
    return r;
  };
  const _sr = startRound;
  startRound = function () {
    HIST.clear();
    ECHO.clear();
    ECHOQ.length = 0;
    DUELS.length = 0;
    for (const a of world.actors || []) for (const k of KEYS) a[k] = 0;
    return _sr.apply(this, arguments);
  };

  // ── icons, motions, sounds ──
  Object.assign(AB_ICON_PATH, {
    clock: "M12 3a9 9 0 1 0 .01 0M12 7v5l3.5 2",
    rewind: "M11 7l-6 5 6 5zM20 7l-6 5 6 5z",
    hourglass: "M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9",
    portal: "M12 3c4 0 6 4 6 9s-2 9-6 9-6-4-6-9 2-9 6-9zM12 7c2 0 3 2.2 3 5s-1 5-3 5-3-2.2-3-5 1-5 3-5z",
    eyeoff: "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 .01 0M4 4l16 16",
    prism: "M12 3l8 15H4zM12 3v15M3 9l6 3M21 9l-6 3",
    rift: "M12 2c-2 5 2 6 0 10s2 5 0 10M7 6L4 8M17 6l3 2M7 18l-3-2M17 18l3-2",
    ricochet: "M3 18l7-10 4 6 7-10M17 4h4v4",
    revolver: "M3 9h13l2-2h3v4h-4l-1 2h-3l-1 4H8l1-4H3z",
    badge: "M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 15.4 6.8 18.1l1-5.8L3.5 8.2l5.9-.9z",
    duel: "M4 4l9 9M20 4l-9 9M7 14l-3 3 3 3 3-3M17 14l3 3-3 3-3-3",
    steps: "M8 3c2 0 3 2 3 4s-1 4-3 4-3-2-3-4 1-4 3-4zM16 12c2 0 3 2 3 4s-1 4-3 4-3-2-3-4 1-4 3-4zM7 13h2M15 22h2",
    compass: "M12 3a9 9 0 1 0 .01 0M15.5 8.5l-2 5-5 2 2-5z",
    range: "M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 .01 0M12 11v2",
    map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14",
    climb: "M12 2v20M4 6l8 4 8-4M4 18l8-4 8 4M12 10a2 2 0 1 0 .01 0",
  });
  const LOOK = {
    y_time_brand: ["clock", "point", "pierce"], y_rewind: ["rewind", "aura", "heal"], y_backstep: ["hourglass", "point", "blink"], y_ult_echo: ["clock", "ult", "ult_bell"],
    y_portal: ["portal", "place", "mag_anchor"], y_phase_cloak: ["eyeoff", "aura", "blink"], y_refract: ["prism", "aura", "ripple_dome"], y_ult_banish: ["rift", "ult", "ult_mirror"],
    y_ricochet: ["ricochet", "aura", "pierce"], y_quickdraw: ["revolver", "aura", "charge"], y_bounty: ["badge", "point", "recon_dart"], y_ult_duel: ["duel", "ult", "ult_snipe"],
    y_footprints: ["steps", "throw", "recon_dart"], y_compass: ["compass", "aura", "mirror_pulse"], y_rangefinder: ["range", "aura", "pierce"], y_ult_warp: ["map", "ult", "blink"],
    y_wallcrawl: ["climb", "aura", "bolt_jump"], y_webzip: ["web", "point", "mag_net"],
  };
  for (const t in H) {
    CAST_EXT[t] = H[t];
    const l = LOOK[t];
    AB_ICON_OF[t] = l[0];
    "ult" !== l[1] && (CAST_STYLE_OF[t] = l[1]);
    "undefined" != typeof ABIL_SFX && ABIL_SFX[l[2]] && (ABIL_SFX[t] = ABIL_SFX[l[2]]);
  }

  // ── the three ──
  const A = (key, name, type, cost, charges, cd, desc, ult) => Object.assign({ key, name, cost, charges, cd, type, desc, _rs: 1 }, ult ? { ult } : {});
  const NEW = [
    {
      id: "chochim", name: "초침", role: "전략가", color: "#e0b04a", quote: "시간은 내 편이다.",
      desc: "시간을 되감고, 미뤄 둔 피해를 다시 터뜨리는 시계공.",
      abilities: [
        A("Q", "시간 낙인", "y_time_brand", 200, 2, 0, "시곗바늘을 쏜다(40m). 맞은 적에게 3초 낙인 — 낙인이 끝날 때 그동안 받은 피해의 60%와 20 피해가 한 번 더 들어간다."),
        A("E", "되감기", "y_rewind", 0, 1, 26, "내 체력과 방어구를 3초 전으로 되돌린다(지금이 더 높으면 그대로)."),
        A("C", "역행탄", "y_backstep", 150, 2, 0, "시간을 거꾸로 돌리는 탄(35m). 맞은 적은 3초 전에 서 있던 자리로 되돌아간다."),
        A("X", "메아리 시간", "y_ult_echo", 0, 1, 0, "궁극기 — 8초 동안 내 35m 안에서 우리 팀이 적에게 준 피해가 1초 뒤 절반만큼 한 번 더 들어간다.", 7),
      ],
    },
    {
      id: "gwanmun", name: "관문", role: "척후대", color: "#8e5cff", quote: "문은 어디에나 열린다.",
      desc: "차원문으로 길을 내고, 모습을 감추고, 적을 세상 밖으로 밀어내는 차원 여행자.",
      abilities: [
        A("Q", "차원문", "y_portal", 200, 1, 0, "누를 때마다 조준한 곳에 문을 하나씩 놓는다(맵 안이면 거리 제한 없음). 두 번째 문을 놓으면 열리고, 우리 팀 한 명이 한 번 지나가면 둘 다 닫힌다(1회용, 25초). 첫 문만 놓은 채면 40초 뒤 사라지고 충전은 그대로."),
        A("E", "위상 은신", "y_phase_cloak", 0, 1, 30, "5초간 모습을 감춘다. 4m 밖의 적에게는 보이지 않고 위치 노출도 막는다. 총을 쏘면 풀린다."),
        A("C", "굴절막", "y_refract", 150, 1, 0, "4초간 공간을 비트는 막을 두른다. 받은 피해의 절반이 쏜 적에게 그대로 되돌아간다."),
        A("X", "차원 추방", "y_ult_banish", 0, 1, 0, "궁극기 — 조준한 적(40m)을 4초간 차원 밖으로 추방한다. 그동안 보이지 않고, 움직이지도 쏘지도 못하며, 맞지도 않는다.", 7),
      ],
    },
    {
      id: "hwangya", name: "황야", role: "타격대", color: "#e8743b", quote: "먼저 뽑는 쪽이 산다.",
      desc: "튕기는 총알과 빠른 손, 현상금과 결투로 싸우는 총잡이.",
      abilities: [
        A("Q", "도탄", "y_ricochet", 200, 1, 0, "8초간 내 공격이 튕긴다. 적에게 맞으면 9m 안의 다른 적에게 절반 피해로 한 번 더 튄다."),
        A("E", "속사", "y_quickdraw", 0, 1, 24, "탄창을 즉시 가득 채우고 5초간 연사 속도 60% 증가, 재장전은 두 배 빠르게."),
        A("C", "현상금", "y_bounty", 150, 2, 0, "조준한 적(50m)에게 12초 현상금을 건다. 그 적을 우리 팀이 쓰러뜨리면 팀 전원 궁극기 1칸, 처치한 사람 체력 +30."),
        A("X", "결투", "y_ult_duel", 0, 1, 0, "궁극기 — 조준한 적(40m)과 8초 결투. 둘은 원 밖으로 못 나가고 다른 누구도 들어오거나 끼어들 수 없다. 내가 주는 피해 25% 증가, 이기면 체력 +50.", 8),
      ],
    },
    {
      id: "nachim", name: "나침", role: "척후대", color: "#2ec4b6", quote: "지도에 있는 곳이면 어디든.",
      desc: "지나간 발자국을 읽고, 바늘로 적을 짚고, 지도 한 장으로 어디든 가는 길잡이.",
      abilities: [
        A("Q", "발자국 지도", "y_footprints", 200, 2, 0, "측량 말뚝을 던진다(30m). 8초 동안 그 주변 22m에 적이 최근 6초간 지나간 발자국이 우리 팀에게 보인다(지금 위치가 아니라 지나간 길)."),
        A("E", "나침반", "y_compass", 0, 1, 24, "7초 동안 화면 가운데 나침반 바늘이 가장 가까운 적 쪽을 가리킨다(방향과 대략적인 거리만)."),
        A("C", "측거", "y_rangefinder", 150, 1, 0, "8초 동안 멀리 있는 적일수록 더 아프게 쏜다. 10m까지는 그대로, 40m 이상이면 피해 +40%."),
        A("X", "좌표 이동", "y_ult_warp", 0, 1, 0, "궁극기 — 지도가 열린다. 누른 곳으로 바로 순간이동(맵 안이면 거리 제한 없이 어디든). 10초 안에 고르지 않거나 취소하면 궁극기를 돌려받는다.", 7),
      ],
    },
  ];
  // what each must visibly do in the ability tests
  const EXPECT = {
    y_time_brand: "dmg", y_rewind: "life", y_backstep: "move", y_ult_echo: "dmg",
    y_portal: "move", y_phase_cloak: "hide", y_refract: "dmg", y_ult_banish: "hide root",
    y_ricochet: "dmg", y_quickdraw: "ammo", y_bounty: "ult", y_ult_duel: "move",
    y_footprints: "trail", y_compass: "hud", y_rangefinder: "dmg", y_ult_warp: "move", y_wallcrawl: "move", y_webzip: "move",
  };
  // 거미: the web trap gives way to wall-crawling
  try {
    const gm = AGENTS.find((a) => "geomi" === a.id);
    if (gm) {
      const i = gm.abilities.findIndex((d) => "Q" === d.key);
      const q = A("Q", "거미 타기", "y_wallcrawl", 200, 1, 0, "10초 동안 거미처럼 벽에 붙는다. 벽으로 걸어가면 타고 올라가고, 멈추면 매달리고, 옆으로 가면 벽을 따라 기고, 꼭대기에 닿으면 위에 올라선다. 점프하면 벽에서 떨어진다.");
      q.expect = ["move"];
      i >= 0 ? (gm.abilities[i] = q) : gm.abilities.unshift(q);
      // and the silk pull (which dragged an enemy to me) becomes a web that drags me
      const j = gm.abilities.findIndex((d) => "E" === d.key);
      const e = A("E", "거미줄 이동", "y_webzip", 0, 1, 20, "조준한 곳(48m)에 거미줄을 쏴서 그쪽으로 빠르게 끌려간다. 가는 도중 점프하면 줄을 끊고 튕겨 나가고, 벽 옆에 닿으면 4초간 벽에 매달린다. 닿을 곳이 없으면 충전이 돌아온다.");
      e.expect = ["move"];
      j >= 0 ? (gm.abilities[j] = e) : gm.abilities.splice(1, 0, e);
    }
  } catch (e) {}
  for (const a of NEW) {
    a.key = a.id;
    a.accent = "#" + new T.Color(a.color).lerp(new T.Color(0xffffff), 0.55).getHexString();
    for (const d of a.abilities) d.expect = EXPECT[d.type].split(" ");
    AGENTS.push(a);
  }

  // ── their looks: the same outfit kit and portrait painter as the others ──
  const K = window.CH_KIT,
    PK = window.CH_PAINTKIT;
  if (K && window.CH_DESIGN && "undefined" != typeof CH_OUTFIT) {
    const { HAIR, HEAD, TOP, LIMB, PERCH, LINES, M, GL, L, sub } = K;
    const PI = Math.PI;
    const DESIGN = {
      chochim: {
        st: { w: 0.94, bulk: 0.92, skin: 0xe9c9a8, hair: 0xd9dde3, eye: 0xb8860b, coat: 0x3b2c55, trim: 0xe0b04a },
        base: { top: 0xf1e6cf, sleeve: L(0x3b2c55), fore: L(0x3b2c55), hand: L(0x2a2230, "leather"), pants: 0x2b2236, boot: L(0x3e2723, "leather") },
        band: { y: 0.47, z: 0.16 },
        make(x) {
          HAIR.bob(x, 0xd9dde3);
          HEAD.circlet(x, 0xe0b04a, { gem: 0x80deea });
          TOP.jacket(x, 0x3b2c55, { lapel: 0x2a1f3d, shirt: 0xf1e6cf, trim: 0xe0b04a, collar: 0x3b2c55 });
          TOP.tails(x, 0x3b2c55, { lining: 0xe0b04a });
          TOP.belt(x, 0x3e2723, { buckle: 0xe0b04a });
          LIMB.bracers(x, 0xe0b04a, { kind: "metal" });
          LIMB.tallBoots(x, 0x3e2723);
          // a clock on the back, the hands at ten to two
          const g = sub(x.chest, [0, 0.24, 0.2]);
          x.add(g, G_CYL(0.2, 0.2, 0.03, 28), M(0xf4ecd8, "paint"), 0, 0, 0, { r: [PI / 2, 0, 0], sh: 1 });
          x.add(g, G_TOR(0.2, 0.016, 6, 32), M(0xe0b04a, "metal"), 0, 0, 0);
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * PI * 2;
            x.add(g, G_BOX(0.012, i % 3 ? 0.025 : 0.04, 0.006), GL(0xe0b04a, 1.3), Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0.02, { r: [0, 0, -a] });
          }
          x.add(g, G_BOX(0.014, 0.12, 0.008), M(0x2a2230, "paint"), -0.035, 0.035, 0.024, { r: [0, 0, 0.9] });
          x.add(g, G_BOX(0.012, 0.15, 0.008), M(0x2a2230, "paint"), 0.05, 0.045, 0.026, { r: [0, 0, -0.9] });
          x.add(g, G_SPH(0.022, 8, 6), GL(0x80deea, 2), 0, 0, 0.03);
          PERCH.orb(x, { glow: 0x80deea });
        },
      },
      gwanmun: {
        face: "eyes",
        band: { z: 0.262, sx: 0.55 },
        st: { w: 0.95, bulk: 0.93, skin: 0xd8b49a, hair: 0xeeeeff, eye: 0xb388ff, coat: 0x241a3d, trim: 0x8e5cff },
        base: { top: 0x1c1530, sleeve: L(0x241a3d), fore: L(0x2e2250), hand: L(0x17121f, "leather"), pants: 0x1c1530, boot: L(0x2a2140, "leather") },
        make(x) {
          HAIR.short(x, 0xeeeeff, { zig: 1 });
          HEAD.hood(x, 0x2e2250, { point: 1 });
          HEAD.halfMask(x, 0x17121f, { glow: 0x8e5cff, line: 0xb388ff });
          TOP.poncho(x, 0x241a3d, { hem: 0x8e5cff });
          LINES.circuit(x, 0x8e5cff);
          TOP.belt(x, 0x17121f, { buckle: 0xb388ff });
          LIMB.wraps(x, 0x2e2250, { legs: !0 });
          // a door on the back: two glowing rings
          x.add(x.chest, G_TOR(0.26, 0.014, 6, 40), GL(0x8e5cff, 1.8), 0, 0.32, 0.25, { s: [0.8, 1.15, 1] });
          x.add(x.chest, G_TOR(0.18, 0.007, 4, 36), GL(0xb388ff, 1.4), 0, 0.32, 0.255, { s: [0.8, 1.15, 1] });
          PERCH.shards(x, { glow: 0xb388ff });
        },
      },
      hwangya: {
        st: { w: 1.02, bulk: 1.0, skin: 0xc68e64, hair: 0x4e342e, eye: 0x5d4037, coat: 0x8d5a33, trim: 0xe8743b },
        base: { top: 0xd7c3a0, sleeve: L(0xd7c3a0), fore: L(0xd7c3a0), hand: L(0x5d4037, "leather"), pants: 0x42566a, boot: L(0x5d4037, "leather") },
        make(x) {
          HAIR.ponytail(x, 0x4e342e, { tie: 0xc62828 });
          HAIR.beard(x, 0x4e342e);
          HEAD.ranger(x, 0x8d5a33, { band: 0x3e2723 });
          TOP.vest(x, 0x6d4c41, { kind: "leather", edge: 0xe8743b });
          TOP.scarf(x, 0xc62828, { tails: !0 });
          TOP.bandolier(x, 0x5d4037, { tip: 0xffc107 });
          TOP.belt(x, 0x3e2723, { buckle: 0xffc107, h: 0.07 });
          TOP.tails(x, 0x8d5a33, { lining: 0x6d4c41 });
          // the holster on the right hip, a grip showing
          x.add(x.hips, G_BOX(0.05, 0.16, 0.08), M(0x5d4037, "leather"), 0.19, -0.06, 0);
          x.add(x.hips, G_BOX(0.03, 0.07, 0.045), M(0x2b1d17, "leather"), 0.19, 0.045, 0.01, { r: [0.3, 0, 0] });
          LIMB.tallBoots(x, 0x5d4037);
        },
      },
      nachim: {
        st: { w: 0.95, bulk: 0.93, skin: 0xe2b896, hair: 0x2b2420, eye: 0x1f8f86, coat: 0x1d3b47, trim: 0x2ec4b6 },
        base: { top: 0xe9e1cc, sleeve: L(0x1d3b47), fore: L(0x1d3b47), hand: L(0x4e342e, "leather"), pants: 0x3b3a33, boot: L(0x4e342e, "leather") },
        band: { z: 0.215 },
        make(x) {
          HAIR.ponytail(x, 0x2b2420, { tie: 0x2ec4b6 });
          HEAD.arVisor(x, 0x2ec4b6);
          TOP.jacket(x, 0x1d3b47, { lapel: 0x16303a, shirt: 0xe9e1cc, trim: 0xc9a227, collar: 0x1d3b47 });
          TOP.sash(x, 0x2ec4b6);
          LIMB.bracers(x, 0x6d4c41, { kind: "leather" });
          LIMB.tallBoots(x, 0x4e342e);
          // a map case across the back, a brass compass on the chest
          const g = sub(x.chest, [0, 0.22, 0.19], [0, 0, 0.9]);
          x.add(g, G_CYL(0.06, 0.06, 0.62, 12), M(0x6d4c41, "leather"), 0, 0, 0, { sh: 1 });
          x.add(g, G_CYL(0.064, 0.064, 0.05, 12), M(0xc9a227, "metal"), 0, 0.3, 0);
          x.add(g, G_CYL(0.064, 0.064, 0.05, 12), M(0xc9a227, "metal"), 0, -0.3, 0);
          x.add(x.chest, G_CYL(0.05, 0.05, 0.015, 18), M(0xc9a227, "metal"), 0.08, 0.27, -0.15, { r: [PI / 2, 0, 0] });
          x.add(x.chest, G_BOX(0.008, 0.07, 0.004), GL(0x2ec4b6, 2), 0.08, 0.27, -0.16, { r: [0, 0, 0.6] });
        },
      },
    };
    for (const id in DESIGN) {
      const ag = AGENTS.find((a) => a.id === id),
        D = DESIGN[id];
      if (!ag) continue;
      window.CH_DESIGN[id] = D;
      CH_STYLE[id] = Object.assign({}, CH_STYLE._default || {}, D.st);
      const B = D.base;
      CH_BASE_EXTRA[id] = { top: B.top, sleeve: B.sleeve, fore: B.fore, hand: B.hand, pants: B.pants, boot: B.boot };
      CH_OUTFIT[id] = function (x) {
        CH_LOOK.body(x, D);
        D.make(x, K.HX(ag.color));
        [x.hips, x.chest, x.neck, x.armL.arm, x.armL.fore, x.armR.arm, x.armR.fore, x.legL.leg, x.legL.shin, x.legR.leg, x.legR.shin].forEach(CH_LOOK.flatten);
      };
    }
  }
  if (PK) {
    const { PAINT, rgb, cap, bangs, locks, hoodRing, lowerMask, jacket, collar, glowDot } = PK;
    PAINT.chochim = {
      back(C) {
        // the clock behind the head
        const [x, y] = C.P(0, -0.35),
          u = C.u,
          R = 2.25 * u;
        C.glow(0xe0b04a, 0.6);
        C.ell(x, y, R, R, rgb(0xf4ecd8, 0.9));
        C.noglow();
        C.ring(x, y, R, R, rgb(0xe0b04a, 1.1), 0.16 * u);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2,
            r0 = R * (i % 3 ? 0.84 : 0.78);
          C.line([[x + Math.sin(a) * r0, y - Math.cos(a) * r0], [x + Math.sin(a) * R * 0.92, y - Math.cos(a) * R * 0.92]], rgb(0x3b2c55), (i % 3 ? 0.05 : 0.1) * u);
        }
        C.line([[x, y], [x - 1.3 * u, y - 1.1 * u]], rgb(0x2a2230), 0.12 * u);
        C.line([[x, y], [x + 1.75 * u, y - 1.25 * u]], rgb(0x2a2230), 0.08 * u);
      },
      body(C) {
        jacket(C, { shirt: 0xf1e6cf, lapel: 0x2a1f3d, trim: 0xe0b04a, glow: !0 });
      },
      collar(C) {
        collar(C, 0x3b2c55, 0.5);
      },
      hair(C) {
        cap(C, 0xd9dde3, 0.45);
        locks(C, 0xd9dde3, 0.55);
        bangs(C, 0xd9dde3, { n: 9, lo: -0.38, hi: -0.46 });
      },
      head(C) {
        const u = C.u;
        C.line([C.P(-0.92, -0.62), C.P(0, -0.84), C.P(0.92, -0.62)], rgb(0xe0b04a, 1.1), 0.08 * u);
        glowDot(C, ...C.P(0, -0.82), 0.1 * u, 0x80deea, 0.7);
        // a monocle on the right eye, its chain to the collar
        C.ring(C.cx + 0.34 * u, C.ey, 0.24 * u, 0.24 * u, rgb(0xe0b04a, 1.15), 0.06 * u);
        C.line([[C.cx + 0.56 * u, C.ey + 0.1 * u], C.P(0.85, 0.9), C.Q(0.9, 0.1)], rgb(0xe0b04a, 0.9), 0.03 * u);
      },
    };
    PAINT.gwanmun = {
      face: { mouth: !1, nose: !1 },
      back(C) {
        const [x, y] = C.P(0, -0.2),
          u = C.u;
        C.glow(0x8e5cff, 1.2);
        C.ring(x, y, 1.95 * u, 2.6 * u, rgb(0x8e5cff, 1.2), 0.16 * u);
        C.ring(x, y, 1.6 * u, 2.2 * u, rgb(0xb388ff, 1.2), 0.06 * u);
        C.noglow();
      },
      body(C, Lp) {
        const u = C.u;
        // the poncho over the shoulders, a glowing hem and circuit lines
        C.poly([C.Q(-0.9, -0.3), C.Q(0.9, -0.3), C.Q(3.4, 3.2), C.Q(-3.4, 3.2)], rgb(0x241a3d, 1.05));
        C.glow(0x8e5cff, 0.6);
        C.line([C.Q(-3.0, 2.6), C.Q(3.0, 2.6)], rgb(0x8e5cff, 1.2), 0.08 * u);
        C.line([C.Q(-0.6, 0.4), C.Q(-0.6, 1.3), C.Q(-1.3, 1.9)], rgb(0x8e5cff, 1.2), 0.05 * u);
        C.line([C.Q(0.7, 0.3), C.Q(0.7, 1.0), C.Q(1.5, 1.6), C.Q(1.5, 2.2)], rgb(0x8e5cff, 1.2), 0.05 * u);
        C.noglow();
      },
      hair(C) {
        bangs(C, 0xeeeeff, { n: 7, lo: -0.4, hi: -0.55, zig: 1 });
      },
      head(C) {
        const u = C.u;
        hoodRing(C, 0x2e2250);
        lowerMask(C, 0x17121f, 0.22);
        C.glow(0x8e5cff, 0.7);
        C.line([C.P(0.15, 0.3), C.P(0.55, 0.22)], rgb(0x8e5cff, 1.3), 0.06 * u);
        C.noglow();
      },
    };
    PAINT.hwangya = {
      body(C) {
        const u = C.u;
        jacket(C, { shirt: 0xd7c3a0, lapel: 0x6d4c41 });
        // a bandolier across the chest
        C.line([C.Q(-1.9, 0.2), C.Q(1.6, 3.4)], rgb(0x5d4037), 0.36 * u, "butt");
        for (let i = 0; i < 7; i++) {
          const t = 0.08 + i * 0.12,
            [x, y] = C.Q(-1.9 + 3.5 * t, 0.2 + 3.2 * t);
          C.rr(x - 0.06 * u, y - 0.2 * u, 0.12 * u, 0.3 * u, 0.04 * u, rgb(0xffc107, 0.9));
        }
      },
      collar(C) {
        // the red bandana knotted at the throat
        C.poly([C.Q(-1.0, -0.6), C.Q(1.0, -0.6), C.Q(0, 0.7)], rgb(0xc62828));
        C.ell(...C.Q(0, -0.55), 0.3 * C.u, 0.2 * C.u, rgb(0xb71c1c));
      },
      hair(C) {
        locks(C, 0x4e342e, 0.75);
        C.ell(...C.P(0, 0.72), 0.62 * C.u, 0.34 * C.u, rgb(0x4e342e, 0.85));
      },
      head(C) {
        const { r, u } = C;
        // the wide hat
        C.ell(...C.P(0, -0.62), 1.75 * u, 0.32 * u, rgb(0x8d5a33, 0.85));
        r.fillStyle = rgb(0x8d5a33);
        r.beginPath();
        r.moveTo(...C.P(-0.86, -0.62));
        r.bezierCurveTo(...C.P(-0.95, -1.75), ...C.P(-0.2, -1.5), ...C.P(0, -1.6));
        r.bezierCurveTo(...C.P(0.2, -1.5), ...C.P(0.95, -1.75), ...C.P(0.86, -0.62));
        r.closePath();
        r.fill();
        C.rr(...C.P(-0.88, -0.86), 1.76 * u, 0.2 * u, 0.06 * u, rgb(0x3e2723));
      },
    };
    PAINT.nachim = {
      back(C) {
        const u = C.u;
        // the map case over the shoulder
        C.line([C.Q(2.1, 1.4), C.Q(-1.2, -2.2)], rgb(0x6d4c41), 0.42 * u, "butt");
        [C.Q(1.9, 1.15), C.Q(-1.0, -1.95)].forEach(([x, y]) => C.ell(x, y, 0.26 * u, 0.26 * u, rgb(0xc9a227, 1.1)));
      },
      body(C) {
        const u = C.u;
        jacket(C, { shirt: 0xe9e1cc, lapel: 0x16303a, trim: 0xc9a227 });
        C.line([C.Q(-2.2, 0.4), C.Q(2.0, 3.0)], rgb(0x2ec4b6, 0.9), 0.3 * u, "butt");
        // the compass on the chest
        const [x, y] = C.Q(0.9, 1.2);
        C.ell(x, y, 0.36 * u, 0.36 * u, rgb(0xc9a227, 1.1));
        C.ell(x, y, 0.27 * u, 0.27 * u, "#f3ead2");
        C.glow(0x2ec4b6, 0.5);
        C.poly([[x, y - 0.24 * u], [x + 0.06 * u, y], [x, y + 0.24 * u], [x - 0.06 * u, y]], rgb(0x2ec4b6, 1.1));
        C.noglow();
      },
      collar(C) {
        collar(C, 0x1d3b47, 0.5);
      },
      hair(C) {
        cap(C, 0x2b2420, 0.2);
        bangs(C, 0x2b2420, { n: 8, lo: -0.42, hi: -0.5, tilt: 0.25 });
        locks(C, 0x2b2420, 0.2, [1]);
      },
      head(C) {
        const u = C.u;
        // a visor of light across the eyes
        C.glow(0x2ec4b6, 0.8);
        C.rr(C.cx - 0.9 * u, C.ey - 0.17 * u, 1.8 * u, 0.32 * u, 0.12 * u, "rgba(46,196,182,.38)");
        C.line([[C.cx - 0.9 * u, C.ey - 0.17 * u], [C.cx + 0.9 * u, C.ey - 0.17 * u]], rgb(0xa7fff3), 0.04 * u);
        C.noglow();
      },
    };
  }

  // the roster strip and the picker: draw them again for 39
  try {
    const tr = document.getElementById("title-roster");
    tr && "function" == typeof renderTitleRoster && ((tr.innerHTML = ""), renderTitleRoster());
    "function" == typeof renderSelect && renderSelect();
  } catch (e) {}
  try {
    const ul = document.querySelector(".tt-news ul"),
      en = "en" === window.GAME_LANG;
    if (ul) {
      const li = document.createElement("li");
      li.innerHTML = en
        ? "<b>Four new agents</b><span>초침 winds time back, 관문 opens doors and banishes, 황야 duels, 나침 goes anywhere on the map. Sixteen abilities like no other</span>"
        : "<b>새 요원 4명</b><span>시간을 되감는 초침, 차원문과 추방의 관문, 결투하는 총잡이 황야, 지도로 어디든 가는 나침. 다른 요원과 겹치지 않는 능력 16개</span>";
      ul.prepend(li);
      while (ul.children.length > 3) ul.lastElementChild.remove();
    }
  } catch (e) {}
  window.AGENTS3 = { zipEnd, ids: NEW.map((a) => a.id), types: Object.keys(H), hist: histAt, duels: DUELS, echo: ECHO, pend: PEND, prints: PRINTS, pick: pickerDone, standAt, needle: drawNeedle };
})();
