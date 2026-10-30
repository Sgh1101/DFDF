(() => {
  // 점령전 (conquest). Team deathmatch with a hill: a ring on the ground in the middle
  // of the map. Stand in it alone (or with more of yours than theirs) and it turns your
  // colour; hold it and your side scores a point a second, first to 120 (or the more
  // points at the end). The hill moves every 90 s: a warning, then a new ring. Kills do
  // not score here, only the hill; the weapons, pickups and 3 s respawns are the team
  // deathmatch's. The host keeps the hill and tells each guest.
  if ("undefined" == typeof killActor || "undefined" == typeof step || !window.GAME_MODES || !GAME_MODES.hill) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const MODE = "hill",
    TARGET = 120,
    R = 7,
    MOVE = 90,
    WARN = 6;
  const ours = () => "object" == typeof room && room && MODE === room.mode;
  const inMatch = () => !!(world.actors && world.actors.length);
  const isHost = () => "undefined" == typeof NET || "client" !== NET.mode;
  const COL = { atk: 0xff6b4a, def: 0x38b6f8, none: 0xffffff };

  // ── the hills: the open points nearest the middle between the two spawns, apart from each other ──
  function spots() {
    const mid = { x: (MAP.attackSpawn.x + MAP.defendSpawn.x) / 2, z: (MAP.attackSpawn.z + MAP.defendSpawn.z) / 2 },
      far = Math.hypot(MAP.attackSpawn.x - MAP.defendSpawn.x, MAP.attackSpawn.z - MAP.defendSpawn.z) / 2;
    const pts = Object.values(MAP.nodes || {})
      .map((p) => ({ x: p.x, z: p.z }))
      .filter((p) => !collideXZ(p.x, p.z, 0.3, PR + 0.3))
      .map((p) => Object.assign(p, { d: Math.hypot(p.x - mid.x, p.z - mid.z) }))
      .filter((p) => p.d < far * 0.7 + 8)
      .sort((a, b) => a.d - b.d);
    const out = [];
    for (const p of pts) if (out.length < 3 && out.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > 18)) out.push(p);
    out.length || out.push({ x: mid.x, z: mid.z });
    return out.map((p) => ({ x: p.x, z: p.z, y: "function" == typeof groundAt ? groundAt(p.x, p.z, 2) : 0 }));
  }
  const Z = { at: [], i: 0, x: 0, z: 0, y: 0, p: 0, owner: "none", acc: { atk: 0, def: 0 }, age: 0, next: null, ring: null, sent: 0, who: "none", live: !1 };
  const goto = (i) => {
    Z.i = i % Z.at.length;
    const s = Z.at[Z.i];
    Z.x = s.x;
    Z.z = s.z;
    Z.y = s.y;
    Z.p = 0;
    Z.owner = "none";
    Z.age = 0;
    Z.next = null;
    place();
  };
  function reset() {
    Z.at = spots();
    Z.acc = { atk: 0, def: 0 };
    Z.live = !1;
    goto(0);
    world.scoreAtk = 0;
    world.scoreDef = 0;
  }

  // ── the ring and its column ──
  let G = null,
    NX = null;
  const mk = (col, op, add) => new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: op, depthWrite: !1, side: T.DoubleSide, blending: add ? T.AdditiveBlending : T.NormalBlending });
  function build() {
    if (G) return;
    G = new T.Group();
    const floor = new T.Mesh(new T.CircleGeometry(R, 48), mk(0xffffff, 0.18));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.06;
    const edge = new T.Mesh(new T.RingGeometry(R - 0.35, R, 64), mk(0xffffff, 0.9, !0));
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.08;
    const wall = new T.Mesh(new T.CylinderGeometry(R, R, 3.2, 48, 1, !0), mk(0xffffff, 0.12, !0));
    wall.position.y = 1.6;
    const fill = new T.Mesh(new T.CircleGeometry(R - 0.4, 48), mk(0xffffff, 0.0));
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.07;
    G.add(floor, fill, edge, wall);
    G.userData = { floor, fill, edge, wall };
    G.traverse((o) => o.material && (o.material.userData.keep = !0));
    scene.add(G);
    NX = new T.Mesh(new T.RingGeometry(R - 0.3, R, 48), mk(0xffd54f, 0.0, !0));
    NX.rotation.x = -Math.PI / 2;
    NX.material.userData.keep = !0;
    scene.add(NX);
  }
  function place() {
    if (!G) return;
    G.position.set(Z.x, Z.y, Z.z);
  }
  function drop() {
    for (const o of [G, NX]) {
      if (!o) continue;
      scene.remove(o);
      o.traverse((m) => {
        m.geometry && m.geometry.dispose();
        m.material && m.material.dispose();
      });
    }
    G = NX = null;
  }
  function paint(t) {
    if (!ours() || !inMatch() || "menu" === world.phase) return void (G && (G.visible = !1), NX && (NX.visible = !1));
    build();
    G.visible = !0;
    place();
    const tint = Z.owner !== "none" ? COL[Z.owner] : Z.p > 0 ? COL.atk : Z.p < 0 ? COL.def : COL.none,
      k = Math.abs(Z.p) / 100,
      u = G.userData,
      base = new T.Color(0xffffff).lerp(new T.Color(tint), Math.min(1, 0.25 + 0.75 * k));
    u.edge.material.color.copy(base);
    u.wall.material.color.copy(base);
    u.floor.material.color.copy(base);
    u.fill.material.color.copy(base);
    u.fill.material.opacity = 0.35 * k;
    u.fill.scale.setScalar(Math.max(0.05, k));
    u.wall.material.opacity = 0.1 + 0.06 * Math.sin(t * 3) + (Z.who === "both" ? 0.1 : 0);
    u.edge.material.opacity = 0.75 + 0.2 * Math.sin(t * 5);
    // where it goes next, in the last seconds
    if (Z.next && NX) {
      NX.visible = !0;
      NX.position.set(Z.next.x, Z.next.y + 0.09, Z.next.z);
      NX.material.opacity = 0.35 + 0.35 * Math.sin(t * 8);
    } else NX && (NX.visible = !1);
  }

  // ── the hill's rules (host) ──
  const inside = (a) => a.alive && Math.hypot(a.pos.x - Z.x, a.pos.z - Z.z) <= R && Math.abs((a.y || 0) - Z.y) < 3.5;
  function tick(dt) {
    if ("live" !== world.phase) return;
    Z.live = !0;
    let na = 0,
      nd = 0;
    for (const a of world.actors) inside(a) && ("atk" === a.team ? na++ : nd++);
    Z.who = na && nd ? "both" : na ? "atk" : nd ? "def" : "none";
    if (Z.who === "atk" || Z.who === "def") {
      const n = Math.min(3, Z.who === "atk" ? na : nd);
      Z.p = Math.max(-100, Math.min(100, Z.p + (Z.who === "atk" ? 1 : -1) * 22 * (0.6 + 0.4 * n) * dt));
    }
    const was = Z.owner;
    Z.owner = Z.p >= 100 ? "atk" : Z.p <= -100 ? "def" : was !== "none" && Math.abs(Z.p) > 40 ? was : "none";
    if (Z.owner !== was) {
      const msg = Z.owner === "none" ? L("점령 지점이 풀렸습니다", "The hill is free") : L(Z.owner === "atk" ? "공격팀이 점령했습니다" : "수비팀이 점령했습니다", Z.owner === "atk" ? "Attackers hold the hill" : "Defenders hold the hill");
      banner(msg, "#" + COL[Z.owner === "none" ? "none" : Z.owner].toString(16).padStart(6, "0"));
      "host" === NET.mode && sendEventAll({ t: "round", msg, color: "#" + COL[Z.owner === "none" ? "none" : Z.owner].toString(16).padStart(6, "0") });
    }
    if (Z.owner !== "none") {
      Z.acc[Z.owner] += dt;
      world.scoreAtk = Math.floor(Z.acc.atk);
      world.scoreDef = Math.floor(Z.acc.def);
      if ((world.scoreAtk >= TARGET || world.scoreDef >= TARGET) && !world.over) finish();
    }
    // the hill moves
    Z.age += dt;
    if (Z.at.length > 1) {
      const nxt = Z.at[(Z.i + 1) % Z.at.length];
      if (!Z.next && Z.age >= MOVE - WARN) {
        Z.next = nxt;
        const msg = L(`${WARN}초 뒤 점령 지점이 옮겨 갑니다`, `The hill moves in ${WARN} s`);
        banner(msg, "#ffd54f");
        "host" === NET.mode && sendEventAll({ t: "round", msg, color: "#ffd54f" });
      }
      if (Z.age >= MOVE) goto(Z.i + 1);
    }
  }
  function finish() {
    if (world.over) return;
    world.over = !0;
    world.phase = "end";
    banner(L("경기 종료", "Match over"), "#ffc849");
    "host" === NET.mode && sendEventAll({ t: "round", msg: L("경기 종료", "Match over"), color: "#ffc849" });
    scheduleMatchFinish();
  }

  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    if (ours() && inMatch()) {
      if (isHost()) {
        try {
          reset();
          send(!0);
          setTimeout(() => ours() && inMatch() && banner(L(`점령전 · 지점을 차지하세요 · ${TARGET}점 먼저`, `Conquest · hold the hill · ${TARGET} first`), "#ffc849"), 500);
        } catch (e) {
          console.warn("conquest", e);
        }
      }
    } else drop();
    return r;
  };
  // kills do not score here
  const _ka = killActor;
  killActor = function () {
    if (!ours() || !inMatch() || !isHost()) return _ka.apply(this, arguments);
    const a = world.scoreAtk,
      d = world.scoreDef;
    try {
      return _ka.apply(this, arguments);
    } finally {
      world.scoreAtk = a;
      world.scoreDef = d;
    }
  };

  // bots go to the hill
  if ("function" == typeof aiGoal) {
    const _ag = aiGoal;
    aiGoal = function (e) {
      if (!ours() || !inMatch()) return _ag.apply(this, arguments);
      const ai = e.ai || (e.ai = freshAIState());
      if (!ai._hill || ai._hill.n !== Z.i || Math.hypot(ai._hill.x - e.pos.x, ai._hill.z - e.pos.z) < 1.5) {
        const a = Math.random() * 6.28,
          r = Math.random() * R * 0.7;
        ai._hill = { n: Z.i, x: Z.x + Math.cos(a) * r, z: Z.z + Math.sin(a) * r };
      }
      return ai._hill;
    };
  }

  // tell the guests: where, how far, who holds it
  function send(force) {
    if ("host" !== NET.mode) return;
    const now = performance.now();
    if (!force && now - Z.sent < 250) return;
    Z.sent = now;
    try {
      sendStateMsg({ t: "hill", i: Z.i, x: Math.round(Z.x * 10), z: Math.round(Z.z * 10), y: Math.round(Z.y * 10), p: Math.round(Z.p), o: Z.owner, w: Z.who, a: Math.round(Z.age), n: Z.next ? 1 : 0, s: Z.at.map((s) => [Math.round(s.x * 10), Math.round(s.z * 10), Math.round(s.y * 10)]) });
    } catch (e) {}
  }
  const _oe = NET.onEvent;
  NET.onEvent = function (m) {
    if (m && "hill" === m.t) {
      try {
        if (m.s && m.s.length) Z.at = m.s.map(([x, z, y]) => ({ x: x / 10, z: z / 10, y: y / 10 }));
        Z.i = m.i;
        Z.x = m.x / 10;
        Z.z = m.z / 10;
        Z.y = m.y / 10;
        Z.p = m.p;
        Z.owner = m.o;
        Z.who = m.w;
        Z.age = m.a;
        Z.next = m.n && Z.at.length ? Z.at[(Z.i + 1) % Z.at.length] : null;
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
        }
        paint(clock);
        hud();
      } else {
        G && paint(clock);
        hud();
      }
    } catch (e) {}
    return r;
  };
  const _go = gameOver;
  gameOver = function () {
    if (ours()) {
      // a draw on the hill: the higher count wins; equal is a draw
      world.scoreAtk = Math.floor(Z.acc.atk) || world.scoreAtk;
      world.scoreDef = Math.floor(Z.acc.def) || world.scoreDef;
    }
    return _go.apply(this, arguments);
  };

  // ── the bar under the score, and the minimap ──
  function hud() {
    let el = $("hill-hud");
    const on = ours() && inMatch() && "menu" !== world.phase && "over" !== world.phase;
    if (!on) return void (el && (el.hidden = !0));
    if (!el) {
      el = document.createElement("div");
      el.id = "hill-hud";
      el.style.cssText = "position:absolute;top:86px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:5px;font:700 12px/1.4 var(--f-display,system-ui);letter-spacing:.05em;color:#fff;white-space:nowrap";
      el.innerHTML = `<div id="hh-t" style="padding:4px 14px;border-radius:999px;background:rgba(10,13,18,.72);border:1px solid rgba(255,255,255,.3)"></div><div style="position:relative;width:200px;height:8px;border-radius:99px;background:rgba(10,13,18,.72);border:1px solid rgba(255,255,255,.25);overflow:hidden"><i id="hh-a" style="position:absolute;right:50%;top:0;bottom:0;background:#38b6f8;width:0"></i><i id="hh-d" style="position:absolute;left:50%;top:0;bottom:0;background:#ff6b4a;width:0"></i><b style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:#fff;opacity:.6"></b></div>`;
      ($("hud") || document.body).appendChild(el);
    }
    const me = ("function" == typeof myActor && myActor()) || player,
      mine = me && me.team,
      side = Z.owner === "none" ? L("중립", "Neutral") : (Z.owner === mine ? L("우리 팀 점령", "Ours") : L("적 점령", "Theirs")),
      left = Z.at.length > 1 ? Math.max(0, Math.ceil(MOVE - Z.age)) : 0;
    el.hidden = !1;
    $("hh-t").textContent = `${L("점령 지점", "Hill")} · ${side}${Z.who === "both" ? " · " + L("교전 중", "contested") : ""}${left ? ` · ${L("이동까지", "moves in")} ${left}s` : ""}`;
    // my side's progress to the right, theirs to the left (the bar's colours are the sides', atk red)
    const k = Z.p / 100,
      atk = "atk" === mine;
    const mineK = atk ? k : -k;
    $("hh-d").style.width = Math.max(0, mineK) * 50 + "%";
    $("hh-a").style.width = Math.max(0, -mineK) * 50 + "%";
    $("hh-d").style.background = atk ? "#ff6b4a" : "#38b6f8";
    $("hh-a").style.background = atk ? "#38b6f8" : "#ff6b4a";
  }
  const _uh = updateHUD;
  updateHUD = function () {
    const r = _uh.apply(this, arguments);
    try {
      if (ours() && inMatch() && "function" == typeof _hT && $("tb-phase")) _hT($("tb-phase"), "buy" === world.phase ? L("준비", "Ready") : `${L("점령전", "Conquest")} · ${TARGET}`);
    } catch (e) {}
    return r;
  };
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    try {
      if (ours() && inMatch() && "undefined" != typeof mctx) {
        const b = MAP.bounds,
          w = mini.width,
          h = mini.height,
          X = (x) => ((x - b.minX) * w) / (b.maxX - b.minX),
          Y = (z) => ((z - b.minZ) * h) / (b.maxZ - b.minZ),
          rad = (R * w) / (b.maxX - b.minX);
        const tint = Z.owner !== "none" ? COL[Z.owner] : Z.p > 0 ? COL.atk : Z.p < 0 ? COL.def : COL.none;
        mctx.strokeStyle = "#" + tint.toString(16).padStart(6, "0");
        mctx.lineWidth = 2;
        mctx.beginPath();
        mctx.arc(X(Z.x), Y(Z.z), Math.max(4, rad), 0, 7);
        mctx.stroke();
        mctx.fillStyle = "#" + tint.toString(16).padStart(6, "0") + "55";
        mctx.fill();
        if (Z.next) {
          mctx.strokeStyle = "#ffd54f";
          mctx.setLineDash([3, 3]);
          mctx.beginPath();
          mctx.arc(X(Z.next.x), Y(Z.next.z), Math.max(4, rad), 0, 7);
          mctx.stroke();
          mctx.setLineDash([]);
        }
      }
    } catch (e) {}
    return r;
  };

  window.CONQUEST = { Z, reset, tick, R, TARGET, MOVE, spots, goto, inside };
})();
