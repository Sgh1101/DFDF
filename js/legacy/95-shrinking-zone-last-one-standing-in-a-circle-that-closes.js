(() => {
  // 축소전 (shrinking zone). Free for all, one life. A safe circle covers the whole map; outside it
  // you take damage, more every stage. Every 20 s or so the circle closes on a new, smaller one (shown
  // in white beforehand) until it is a few steps wide. The last one standing wins; whoever is out
  // watches the rest. Guns and pickups are the deathmatch's, abilities are off. The host runs the
  // circle and the damage and tells the guests.
  if ("undefined" == typeof killActor || "undefined" == typeof step || !window.GAME_MODES || !GAME_MODES.zone) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const MODE = "zone",
    WAIT = 22,
    SHRINK = 18,
    FACT = [1, 0.6, 0.36, 0.2, 0],
    MINR = 7,
    DMG = [2, 4, 7, 11, 15]; // hp per second outside, by stage
  const ours = () => "object" == typeof room && room && MODE === room.mode;
  const inMatch = () => !!(world.actors && world.actors.length);
  const isHost = () => "undefined" == typeof NET || "client" !== NET.mode;
  const Z = { stage: 0, state: "wait", t: 0, from: { x: 0, z: 0, r: 100 }, to: { x: 0, z: 0, r: 60 }, x: 0, z: 0, r: 100, sent: 0, places: {}, alive: 0 };

  // ── the circles ──
  function plan() {
    const b = MAP.bounds,
      cx = (b.minX + b.maxX) / 2,
      cz = (b.minZ + b.maxZ) / 2,
      r0 = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 4;
    return { cx, cz, r0 };
  }
  const radiusOf = (stage, r0) => (stage >= FACT.length - 1 ? MINR : Math.max(MINR, r0 * FACT[stage]));
  // the next circle: a walkable point inside the current one, far enough in to fit
  function nextCircle(from, stage) {
    const { r0 } = plan(),
      r = radiusOf(stage, r0);
    const room_ = Math.max(0, from.r - r);
    const pts = Object.values(MAP.nodes || {})
      .map((p) => ({ x: p.x, z: p.z }))
      .concat((MAP.sites || []).map((s) => ({ x: s.x, z: s.z })))
      .filter((p) => !collideXZ(p.x, p.z, 0.3, PR + 0.3) && Math.hypot(p.x - from.x, p.z - from.z) <= room_ * 0.92);
    const c = pts.length ? pts[Math.floor(Math.random() * pts.length)] : { x: from.x, z: from.z };
    return { x: c.x, z: c.z, r };
  }
  function reset() {
    const { cx, cz, r0 } = plan();
    Z.stage = 0;
    Z.state = "wait";
    Z.t = 0;
    Z.from = { x: cx, z: cz, r: r0 };
    Z.to = nextCircle(Z.from, 1);
    Z.places = {};
    Z.alive = world.actors.length;
    cur();
  }
  function cur() {
    if (Z.state === "wait") {
      Z.x = Z.from.x;
      Z.z = Z.from.z;
      Z.r = Z.from.r;
    } else {
      const k = Math.min(1, Z.t / SHRINK),
        e = k * k * (3 - 2 * k);
      Z.x = Z.from.x + (Z.to.x - Z.from.x) * e;
      Z.z = Z.from.z + (Z.to.z - Z.from.z) * e;
      Z.r = Z.from.r + (Z.to.r - Z.from.r) * e;
    }
  }
  const outside = (a) => Math.hypot(a.pos.x - Z.x, a.pos.z - Z.z) > Z.r;
  const dps = () => DMG[Math.min(Z.stage, DMG.length - 1)];

  // ── the rules (host) ──
  const aliveOf = () => world.actors.filter((a) => a.alive);
  function tick(dt) {
    if ("live" !== world.phase || world.over) return;
    Z.t += dt;
    if (Z.state === "wait" && Z.t >= WAIT) {
      Z.state = "shrink";
      Z.t = 0;
      const msg = L("구역이 줄어듭니다", "The zone is closing");
      banner(msg, "#38d6f8");
      "host" === NET.mode && sendEventAll({ t: "round", msg, color: "#38d6f8" });
    } else if (Z.state === "shrink" && Z.t >= SHRINK) {
      Z.stage++;
      Z.from = { x: Z.to.x, z: Z.to.z, r: Z.to.r };
      Z.state = "wait";
      Z.t = 0;
      Z.to = Z.stage >= FACT.length - 1 ? { x: Z.from.x, z: Z.from.z, r: MINR } : nextCircle(Z.from, Z.stage + 1);
      const msg = L(`구역 ${Z.stage + 1}단계 — 밖은 초당 ${dps()} 피해`, `Stage ${Z.stage + 1} — ${dps()}/s outside`);
      banner(msg, "#ffd54f");
      "host" === NET.mode && sendEventAll({ t: "round", msg, color: "#ffd54f" });
    }
    cur();
    for (const a of world.actors) {
      if (!a.alive || !outside(a)) continue;
      // the zone ignores armour
      const ar = a.armor;
      a.armor = 0;
      try {
        dealDamage(a, dps() * dt, !1, null);
      } finally {
        a.alive && (a.armor = ar);
      }
    }
    Z.alive = aliveOf().length;
    if (Z.alive <= 1) finish();
  }
  function finish() {
    if (world.over) return;
    // whoever is left, by health
    const left = aliveOf().sort((a, b) => b.hp + b.armor - (a.hp + a.armor));
    left.forEach((a, i) => (Z.places[a.id] = i + 1));
    world.over = !0;
    world.phase = "end";
    const msg = left.length ? L(`${left[0].name || "생존자"} 승리`, `${left[0].name || "Last one"} wins`) : L("경기 종료", "Match over");
    banner(msg, "#ffc849");
    "host" === NET.mode && sendEventAll({ t: "round", msg, color: "#ffc849" });
    send(!0);
    setTimeout(() => gameOver(), 2600);
  }

  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    if (ours() && inMatch()) {
      for (const a of world.actors) a._zoneOut = !1;
      if (isHost()) {
        try {
          reset();
          send(!0);
          setTimeout(() => ours() && inMatch() && banner(L("축소전 · 마지막 한 명이 이깁니다", "Shrinking zone · last one standing"), "#ffc849"), 500);
        } catch (e) {
          console.warn("zone", e);
        }
      }
    } else drop();
    return r;
  };
  // out is out: no respawn, and the place is the number of players there were
  const _ka = killActor;
  killActor = function (e) {
    if (!ours() || !inMatch() || !isHost() || world.over) return _ka.apply(this, arguments);
    const n = aliveOf().length,
      was = e && e.alive;
    const r = _ka.apply(this, arguments);
    if (was) {
      e._respawnT = 0;
      Z.places[e.id] = n;
      Z.alive = aliveOf().length;
      if (Z.alive <= 1) setTimeout(() => ours() && !world.over && finish(), 400);
    }
    return r;
  };
  // the ones out watch whoever is left
  if ("function" == typeof livingAllies) {
    const _la = livingAllies;
    livingAllies = function () {
      return ours() && inMatch() ? world.actors.filter((a) => a.alive && a !== player) : _la.apply(this, arguments);
    };
  }
  const placeOf = (a) => {
    if (Z.places[a.id]) return Z.places[a.id];
    const live = world.actors.filter((o) => o.alive).sort((p, q) => q.hp + q.armor - (p.hp + p.armor));
    const i = live.indexOf(a);
    return i < 0 ? world.actors.length : i + 1;
  };

  // bots stay inside, and move to the next circle once it is shown
  if ("function" == typeof aiGoal) {
    const _ag = aiGoal;
    aiGoal = function (e) {
      if (!ours() || !inMatch()) return _ag.apply(this, arguments);
      const ai = e.ai || (e.ai = freshAIState());
      const c = Z.state === "shrink" || Z.t > WAIT - 8 ? Z.to : { x: Z.x, z: Z.z, r: Z.r };
      const g = ai._zg;
      if (!g || g.k !== Z.stage + Z.state || Math.hypot(g.x - e.pos.x, g.z - e.pos.z) < 2 || performance.now() - g.at > 5000) {
        const a = Math.random() * 6.28,
          r = Math.random() * Math.max(2, c.r * 0.6);
        ai._zg = { k: Z.stage + Z.state, x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, at: performance.now() };
      }
      return ai._zg;
    };
  }

  // ── the screen: the wall of the zone, the next circle, a red edge outside, a bar, the minimap ──
  let G = null;
  const mk = (col, op, add) => new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: op, depthWrite: !1, side: T.DoubleSide, blending: add ? T.AdditiveBlending : T.NormalBlending });
  function build() {
    if (G) return;
    G = new T.Group();
    const wall = new T.Mesh(new T.CylinderGeometry(1, 1, 50, 96, 1, !0), mk(0x38d6f8, 0.13, !0)),
      ring = new T.Mesh(new T.RingGeometry(0.985, 1, 128), mk(0x7fe9ff, 0.9, !0)),
      nx = new T.Mesh(new T.RingGeometry(0.985, 1, 128), mk(0xffffff, 0.75, !0));
    wall.position.y = 25;
    ring.rotation.x = nx.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    nx.position.y = 0.12;
    G.add(wall, ring, nx);
    G.userData = { wall, ring, nx };
    G.traverse((o) => o.material && (o.material.userData.keep = !0));
    scene.add(G);
  }
  function drop() {
    if (!G) return;
    scene.remove(G);
    G.traverse((m) => {
      m.geometry && m.geometry.dispose();
      m.material && m.material.dispose();
    });
    G = null;
  }
  function paint(t) {
    if (!ours() || !inMatch() || "menu" === world.phase) return void (G && (G.visible = !1));
    build();
    G.visible = !0;
    const u = G.userData;
    u.wall.position.set(Z.x, 25, Z.z);
    u.wall.scale.set(Z.r, 1, Z.r);
    u.ring.position.set(Z.x, 0.1, Z.z);
    u.ring.scale.set(Z.r, Z.r, 1);
    u.wall.material.opacity = 0.07 + 0.03 * Math.sin(t * 2.4) + (Z.state === "shrink" ? 0.05 : 0);
    const showNext = Z.stage < FACT.length - 1 && !(Z.state === "wait" && Z.to.r === Z.from.r && Z.to.x === Z.from.x);
    u.nx.visible = showNext;
    u.nx.position.set(Z.to.x, 0.12, Z.to.z);
    u.nx.scale.set(Z.to.r, Z.to.r, 1);
    u.nx.material.opacity = 0.45 + 0.3 * Math.sin(t * 6);
  }
  function hud(t) {
    let el = $("zone-hud");
    const on = ours() && inMatch() && "menu" !== world.phase && "over" !== world.phase;
    let v = $("zone-vig");
    if (!on) return void (el && (el.hidden = !0), v && (v.style.opacity = 0));
    if (!el) {
      el = document.createElement("div");
      el.id = "zone-hud";
      el.style.cssText = "position:absolute;top:86px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:5px;font:700 12px/1.4 var(--f-display,system-ui);letter-spacing:.05em;color:#fff;white-space:nowrap";
      el.innerHTML = `<div id="zh-t" style="padding:4px 14px;border-radius:999px;background:rgba(10,13,18,.72);border:1px solid rgba(56,214,248,.7)"></div><div id="zh-w" style="padding:3px 12px;border-radius:999px;background:rgba(255,59,78,.25);border:1px solid rgba(255,59,78,.7);color:#ffd0d4" hidden></div>`;
      ($("hud") || document.body).appendChild(el);
    }
    if (!v) {
      v = document.createElement("div");
      v.id = "zone-vig";
      v.style.cssText = "position:fixed;inset:0;z-index:9;pointer-events:none;opacity:0;transition:opacity .25s;box-shadow:inset 0 0 160px 40px rgba(255,40,60,.55)";
      document.body.appendChild(v);
    }
    const me = ("function" == typeof myActor && myActor()) || player;
    el.hidden = !1;
    const left = Z.state === "wait" ? Math.max(0, Math.ceil(WAIT - Z.t)) : Math.max(0, Math.ceil(SHRINK - Z.t));
    const last = Z.stage >= FACT.length - 1 && Z.state === "wait";
    $("zh-t").textContent = `${L("생존", "Alive")} ${Z.alive || aliveOf().length} · ${last ? L("마지막 구역", "Final circle") : Z.state === "wait" ? `${L("축소까지", "Closes in")} ${left}s` : `${L("축소 중", "Closing")} ${left}s`}`;
    const out = !!(me && me.alive && outside(me)),
      w = $("zh-w");
    w.hidden = !out;
    w.textContent = L(`구역 밖 — 초당 ${dps()} 피해`, `Outside the zone — ${dps()}/s`);
    v.style.opacity = out ? 0.5 + 0.35 * Math.sin(t * 7) : 0;
  }
  const _uh = updateHUD;
  updateHUD = function () {
    const r = _uh.apply(this, arguments);
    try {
      if (ours() && inMatch() && "function" == typeof _hT && $("tb-phase")) _hT($("tb-phase"), "buy" === world.phase ? L("준비", "Ready") : `${L("축소전", "Zone")} · ${L("생존", "alive")} ${Z.alive || aliveOf().length}`);
    } catch (e) {}
    return r;
  };
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    try {
      if (ours() && inMatch() && "undefined" != typeof mctx) {
        const b = MAP.bounds,
          X = (x) => ((x - b.minX) * mini.width) / (b.maxX - b.minX),
          Y = (z) => ((z - b.minZ) * mini.height) / (b.maxZ - b.minZ),
          S = mini.width / (b.maxX - b.minX);
        mctx.lineWidth = 2;
        mctx.strokeStyle = "#7fe9ff";
        mctx.beginPath();
        mctx.arc(X(Z.x), Y(Z.z), Math.max(3, Z.r * S), 0, 7);
        mctx.stroke();
        mctx.strokeStyle = "#ffffff";
        mctx.setLineDash([3, 3]);
        mctx.beginPath();
        mctx.arc(X(Z.to.x), Y(Z.to.z), Math.max(3, Z.to.r * S), 0, 7);
        mctx.stroke();
        mctx.setLineDash([]);
      }
    } catch (e) {}
    return r;
  };

  // ── tell the guests ──
  function send(force) {
    if ("host" !== NET.mode) return;
    const now = performance.now();
    if (!force && now - Z.sent < 250) return;
    Z.sent = now;
    const q = (n) => Math.round(n * 10);
    try {
      sendEventAll({ t: "zone", s: Z.stage, m: "wait" === Z.state ? 0 : 1, c: Math.round(Z.t * 10), f: [q(Z.from.x), q(Z.from.z), q(Z.from.r)], o: [q(Z.to.x), q(Z.to.z), q(Z.to.r)], n: Z.alive, p: Object.entries(Z.places).map(([id, v]) => [+id, v]) });
    } catch (e) {}
  }
  const _oe = NET.onEvent;
  NET.onEvent = function (m) {
    if (m && "zone" === m.t) {
      try {
        Z.stage = m.s;
        Z.state = m.m ? "shrink" : "wait";
        Z.t = m.c / 10;
        Z.from = { x: m.f[0] / 10, z: m.f[1] / 10, r: m.f[2] / 10 };
        Z.to = { x: m.o[0] / 10, z: m.o[1] / 10, r: m.o[2] / 10 };
        Z.alive = m.n;
        Z.places = {};
        for (const [id, v] of m.p || []) Z.places[id] = v;
        cur();
      } catch (e) {}
      return;
    }
    return _oe && _oe.apply(this, arguments);
  };

  // ── every step ──
  let clock = 0;
  const _step = step;
  step = function (dt) {
    const r = _step.apply(this, arguments);
    try {
      const d = dt || 0.016;
      clock += d;
      if (ours() && inMatch()) {
        if (isHost() && !world.over) {
          tick(d);
          send();
        } else if (!world.over) {
          // a guest keeps the clock between messages
          Z.t += d;
          Z.t = Math.min(Z.t, Z.state === "wait" ? WAIT : SHRINK);
          cur();
        }
        // I am out: say so once, and watch someone
        const me = "function" == typeof myActor ? myActor() : null;
        if (me && !me.alive && !me._zoneOut && "live" === world.phase) {
          me._zoneOut = !0;
          banner(L(`탈락 · ${placeOf(me)}위`, `Out · place ${placeOf(me)}`), "#ff3b4e");
          try {
            const sp = $("spectate");
            sp && sp.classList.add("on");
            nextSpectate(1);
          } catch (e) {}
        }
        paint(clock);
        hud(clock);
      } else {
        G && paint(clock);
        hud(clock);
      }
    } catch (e) {}
    return r;
  };
  // the result: by place
  const _go = gameOver;
  gameOver = function () {
    const r = _go.apply(this, arguments);
    try {
      if (ours() && inMatch()) {
        const me = ("function" == typeof myActor && myActor()) || player,
          rank = placeOf(me),
          n = world.actors.length;
        const head = $("ov-head");
        head.textContent = rank === 1 ? L("마지막 생존자", "Last one standing") : L(`${rank}위`, `${rank}${rank === 2 ? "nd" : rank === 3 ? "rd" : "th"}`);
        head.style.color = rank === 1 ? "#4ade80" : "#ff3b4e";
        $("ov-score").textContent = L(`${n}명 중 ${rank}위 · ${me.kills || 0}킬`, `${rank} of ${n} · ${me.kills || 0} kills`);
      }
    } catch (e) {}
    return r;
  };

  window.SHRINK_ZONE = { Z, reset, tick, cur, outside, dps, nextCircle, placeOf, WAIT, SHRINK, FACT, DMG };
})();
