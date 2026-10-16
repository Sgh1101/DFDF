(() => {
  // 표적 사격 (the target range). From the practice menu: the open field, nobody
  // else on it, a minute (after eight seconds to pick a gun), and targets that pop up,
  // strafe, fly or flash past: shoot them for points. A head counts double, a run of
  // hits raises the multiplier (a miss drops it). Your best score is kept for each gun.
  // Solo only and never reported: no XP, no gold.
  if ("undefined" == typeof startGame || "undefined" == typeof hitscan || !window.GAME_MODES || !GAME_MODES.range) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const MODE = "range",
    COUNT = 7,
    SIZE = 1.3;
  const ours = () => "object" == typeof room && room && MODE === room.mode;
  const inMatch = () => !!(world.actors && world.actors.length);
  const RANGE = { prev: "std", entering: !1, live: !1, score: 0, hits: 0, heads: 0, streak: 0, best: 0, shotsSeen: 0, hitFlag: !1, targets: [], pops: [], t: 0 };

  // the kinds: points, the head's multiple, how long, how it moves
  const KINDS = {
    pop: { pts: 10, head: 2, life: [1.8, 2.8], name: L("표적", "Pop-up") },
    strafe: { pts: 15, head: 2, life: [6, 8], name: L("이동 표적", "Strafer") },
    drone: { pts: 25, head: 2, life: [7, 9], name: L("드론", "Drone") },
    gold: { pts: 50, head: 2, life: [3, 3.6], name: L("황금 표적", "Gold") },
  };
  const pickKind = () => {
    const r = Math.random();
    return r < 0.45 ? "pop" : r < 0.75 ? "strafe" : r < 0.95 ? "drone" : "gold";
  };
  const rnd2 = (a, b) => a + Math.random() * (b - a);

  // ── look ──
  let TEX = null;
  function tex() {
    if (TEX) return TEX;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d");
    const rings = ["#f4f4ef", "#e53935", "#f4f4ef", "#e53935", "#f4f4ef", "#b71c1c"];
    for (let i = 0; i < rings.length; i++) {
      g.fillStyle = rings[i];
      g.beginPath();
      g.arc(64, 64, 62 - i * 10.5, 0, Math.PI * 2);
      g.fill();
    }
    TEX = new T.CanvasTexture(cv);
    return TEX;
  }
  const basic = (o) => new T.MeshBasicMaterial(Object.assign({ side: T.DoubleSide, transparent: !0 }, o));
  function mesh(kind) {
    const g = new T.Group(),
      gold = "gold" === kind;
    if ("drone" === kind) {
      const core = new T.Mesh(new T.OctahedronGeometry(0.42, 0), new T.MeshStandardMaterial({ color: 0x2b3340, emissive: 0x00e5ff, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.6 }));
      const ring = new T.Mesh(new T.TorusGeometry(0.6, 0.04, 6, 24), basic({ color: 0x00e5ff, blending: T.AdditiveBlending }));
      ring.rotation.x = Math.PI / 2;
      g.add(core, ring);
      g.userData.spin = ring;
    } else {
      const col = gold ? 0xffd54f : 0xffffff,
        sc = gold ? 0.7 : 1;
      const body = new T.Mesh(new T.CircleGeometry(0.55, 28), basic({ map: tex(), color: col }));
      body.scale.set(sc, 1.25 * sc, 1);
      body.position.y = 0.85 * sc;
      const head = new T.Mesh(new T.CircleGeometry(0.25, 20), basic({ map: tex(), color: col }));
      head.position.y = 1.62 * sc;
      const post = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.4 * sc, 6), basic({ color: 0x555a63 }));
      post.position.y = 0.2 * sc;
      g.add(body, head, post);
      g.userData.body = body;
      if (gold) {
        const halo = new T.Mesh(new T.RingGeometry(0.62, 0.72, 28), basic({ color: 0xffe082, blending: T.AdditiveBlending, opacity: 0.8 }));
        halo.position.y = 0.85 * sc;
        halo.scale.set(sc, 1.25 * sc, 1);
        g.add(halo);
      }
    }
    g.traverse((o) => o.material && (o.material.userData.keep = !0));
    scene.add(g);
    return g;
  }
  function dispose(g) {
    scene.remove(g);
    g.traverse((o) => {
      o.geometry && o.geometry.dispose();
      o.material && o.material !== TEX && o.material.dispose();
    });
  }

  // ── placing and moving ──
  function spot(me) {
    const B = MAP.bounds;
    for (let k = 0; k < 40; k++) {
      const d = rnd2(14, 58),
        a = me.yaw + rnd2(-1.05, 1.05),
        x = me.pos.x - Math.sin(a) * d,
        z = me.pos.z - Math.cos(a) * d;
      if (x < B.minX + 4 || x > B.maxX - 4 || z < B.minZ + 4 || z > B.maxZ - 4) continue;
      if (collideXZ(x, z, 0.3, 0.6)) continue;
      // not through a wall
      if (rayBlocked(me.pos.x, me.y + 1.5, me.pos.z, x, me.y + 1.2, z)) continue;
      return { x, z };
    }
    return null;
  }
  function add(me, kind) {
    const p = spot(me);
    if (!p) return;
    const k = KINDS[kind],
      g = mesh(kind),
      y = "function" == typeof groundAt ? groundAt(p.x, p.z, 2) : 0,
      toMe = Math.atan2(me.pos.x - p.x, me.pos.z - p.z);
    const T0 = { kind, g, x: p.x, z: p.z, y, born: RANGE.t, life: rnd2(k.life[0], k.life[1]), hit: -1, toMe, tx: Math.cos(toMe), tz: -Math.sin(toMe), ph: Math.random() * 6.28, h: "drone" === kind ? rnd2(4.5, 8) : 0, off: 0, r: "gold" === kind ? 0.38 : 0.5 };
    T0.cx = T0.x;
    T0.cz = T0.z;
    g.position.set(T0.x, T0.y + T0.h, T0.z);
    g.rotation.y = "drone" === kind ? 0 : toMe;
    g.scale.setScalar(0.05 * SIZE);
    RANGE.targets.push(T0);
  }
  function stepTargets(dt, me) {
    const t = RANGE.t;
    for (let i = RANGE.targets.length - 1; i >= 0; i--) {
      const q = RANGE.targets[i],
        age = t - q.born;
      // knocked down: falls back, then goes
      if (q.hit >= 0) {
        const f = (t - q.hit) / 0.45;
        if (f >= 1) {
          dispose(q.g);
          RANGE.targets.splice(i, 1);
          continue;
        }
        q.g.rotation.x = -f * 1.4;
        q.g.traverse((o) => o.material && (o.material.opacity = 1 - f));
        continue;
      }
      if (age > q.life) {
        const f = (age - q.life) / 0.3;
        if (f >= 1) {
          dispose(q.g);
          RANGE.targets.splice(i, 1);
          continue;
        }
        q.g.scale.setScalar(SIZE * Math.max(0.05, 1 - f));
        continue;
      }
      let x = q.cx,
        z = q.cz,
        y = q.y + q.h;
      if ("strafe" === q.kind) {
        const o = Math.sin(age * 0.9 + q.ph) * 5.5;
        x = q.cx + q.tx * o;
        z = q.cz + q.tz * o;
      } else if ("gold" === q.kind) {
        const o = Math.sin(age * 2.4 + q.ph) * 8;
        x = q.cx + q.tx * o;
        z = q.cz + q.tz * o;
        y = q.y + 0.3 + 0.5 * Math.abs(Math.sin(age * 4.4));
      } else if ("drone" === q.kind) {
        const a = age * 0.7 + q.ph;
        x = q.cx + Math.cos(a) * 4;
        z = q.cz + Math.sin(a) * 4;
        y = q.y + q.h + Math.sin(age * 2) * 0.5;
        q.g.userData.spin && (q.g.userData.spin.rotation.z += dt * 4);
        q.g.rotation.y += dt * 1.5;
      }
      q.px = x;
      q.pz = z;
      q.py = y;
      q.g.position.set(x, y, z);
      const grow = Math.min(1, age / 0.25);
      q.g.scale.setScalar(SIZE * Math.max(0.05, grow));
    }
    // keep the count up while it runs
    if (RANGE.live) {
      const live = RANGE.targets.filter((q) => q.hit < 0).length;
      if (live < COUNT && t - (RANGE.lastAdd || 0) > 0.35) {
        RANGE.lastAdd = t;
        add(me, pickKind());
      }
    }
  }
  // a shot against the targets: the nearest, a head before a body
  function trace(o, d, maxT) {
    let best = null;
    const wall = "function" == typeof WALL_T ? WALL_T(o.x, o.y, o.z, d.x, d.y, d.z, maxT) : maxT;
    for (const q of RANGE.targets) {
      if (q.hit >= 0 || null == q.px) continue;
      const age = RANGE.t - q.born;
      if (age < 0.15 || age > q.life) continue;
      const sc = ("gold" === q.kind ? 0.7 : 1) * SIZE;
      let head = Infinity,
        body;
      if ("drone" === q.kind) body = raySphereT(o, d, q.px, q.py, q.pz, 0.55 * SIZE);
      else {
        head = raySphereT(o, d, q.px, q.py + 1.62 * sc, q.pz, 0.28 * sc);
        body = raySphereT(o, d, q.px, q.py + 0.85 * sc, q.pz, 0.52 * sc);
      }
      const tt = Math.min(head, body);
      if (tt < wall && tt < maxT && (!best || tt < best.t)) best = { q, t: tt, head: head <= body };
    }
    return best;
  }
  const mult = () => Math.min(3, 1 + Math.floor(RANGE.streak / 5) * 0.5);
  function pop(text, col) {
    const el = document.createElement("div");
    el.className = "rg-pop";
    el.textContent = text;
    el.style.color = col;
    el.style.left = 46 + Math.random() * 8 + "%";
    ($("hud") || document.body).appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
  function score(h, o, d) {
    const q = h.q,
      k = KINDS[q.kind],
      m = mult(),
      pts = Math.round(k.pts * (h.head ? k.head : 1) * m);
    q.hit = RANGE.t;
    RANGE.score += pts;
    RANGE.hits++;
    h.head && RANGE.heads++;
    RANGE.streak++;
    RANGE.hitFlag = !0;
    world.stats.hits++;
    try {
      hitMarker(h.head);
      SFX.hit(h.head);
      impactSpark(o.x + d.x * h.t, o.y + d.y * h.t, o.z + d.z * h.t, h.head ? 0xffd54f : 0xffffff);
    } catch (e) {}
    pop(`+${pts}${h.head ? " ★" : ""}${m > 1 ? " ×" + m : ""}`, h.head ? "#ffd54f" : q.kind === "gold" ? "#ffe082" : "#ffffff");
  }

  // ── hooks ──
  const _hs = hitscan;
  hitscan = function (e, t, o, a) {
    if (ours() && inMatch() && RANGE.live && o && !o.splash) {
      const h = trace(e, t, Math.min(+o.range || 100, 300));
      if (h) return void score(h, e, t);
    }
    return _hs.apply(this, arguments);
  };
  // no one else on the field
  if ("function" == typeof lobbyFillAI) {
    const _lf = lobbyFillAI;
    lobbyFillAI = function () {
      if (ours()) return;
      return _lf.apply(this, arguments);
    };
  }
  if ("function" == typeof lobbySetOpt) {
    const _lo = lobbySetOpt;
    lobbySetOpt = function (k, v) {
      if ("mode" === k && MODE === v) return !1;
      return _lo.apply(this, arguments);
    };
  }
  // never reported: it is practice
  const _ls = lobbyStart;
  lobbyStart = function () {
    if (ours()) window.GAME_PRACTICE = !0;
    return _ls.apply(this, arguments);
  };
  const _sg = startGame;
  startGame = function () {
    if (!RANGE.entering && ours()) room.mode = RANGE.prev || "std";
    RANGE.entering = !1;
    clearAll();
    return _sg.apply(this, arguments);
  };
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    if (ours() && inMatch()) {
      clearAll();
      RANGE.live = !1;
      RANGE.score = RANGE.hits = RANGE.heads = RANGE.streak = 0;
      RANGE.shotsSeen = 0;
      RANGE.hitFlag = !1;
      const me = myActor() || player;
      RANGE.best = best(me);
      // face the middle of the field
      const c = { x: (MAP.bounds.minX + MAP.bounds.maxX) / 2, z: (MAP.bounds.minZ + MAP.bounds.maxZ) / 2 };
      me.yaw = Math.atan2(-(c.x - me.pos.x), -(c.z - me.pos.z));
      me.input && (me.input.yaw = me.yaw);
      player.yaw = me.yaw;
      player.pitch = 0;
      // the eight seconds: a few targets to warm up on, scoring starts with the minute
      for (let i = 0; i < 4; i++) add(me, i % 2 ? "strafe" : "pop");
      setTimeout(() => ours() && inMatch() && banner(L("표적 사격 · 8초 뒤 시작 · B로 무기 고르기", "Target range · starts in 8 s · B to pick a gun"), "#ffc849"), 400);
    } else if (!ours()) clearAll();
    return r;
  };
  function clearAll() {
    for (const q of RANGE.targets) dispose(q.g);
    RANGE.targets = [];
    RANGE.live = !1;
    const h = $("range-hud");
    h && (h.hidden = !0);
  }
  const keyOf = (me) => "lgp_range:" + (("function" == typeof actorWeaponKey && me && actorWeaponKey(me)) || "gun");
  function best(me) {
    try {
      return +localStorage.getItem(keyOf(me)) || 0;
    } catch (e) {
      return 0;
    }
  }

  // ── every step ──
  let clock = 0;
  const _step = step;
  step = function (dt) {
    const r = _step.apply(this, arguments);
    try {
      const d = dt || 0.016;
      if (ours() && inMatch() && !world.over && "menu" !== world.phase) {
        RANGE.t += d;
        const me = myActor() || player;
        // scoring only while the minute runs
        RANGE.live = "live" === world.phase;
        // a shot with no hit drops the run
        const shots = (world.stats && world.stats.shots) || 0;
        if (shots > RANGE.shotsSeen) {
          RANGE.hitFlag || (RANGE.streak = 0);
          RANGE.shotsSeen = shots;
          RANGE.hitFlag = !1;
        }
        stepTargets(d, me);
        hud();
      } else if (RANGE.targets.length && !ours()) clearAll();
      else if (ours() && world.over) hud();
    } catch (e) {}
    return r;
  };
  // the room's mode goes back when the player leaves for the menu
  setInterval(() => {
    try {
      "range" === room.mode && "menu" === world.phase && !RANGE.entering && ((room.mode = RANGE.prev || "std"), clearAll());
    } catch (e) {}
  }, 500);

  // ── the HUD, and the result ──
  const css = document.createElement("style");
  css.textContent = ".rg-pop{position:absolute;top:44%;z-index:14;pointer-events:none;font:900 22px/1 var(--f-display,system-ui);text-shadow:0 2px 8px rgba(0,0,0,.8);animation:rgPop .8s ease-out forwards}@keyframes rgPop{from{opacity:1;transform:translateY(0) scale(1.25)}to{opacity:0;transform:translateY(-46px) scale(.9)}}";
  document.head.appendChild(css);
  function hud() {
    let el = $("range-hud");
    const on = ours() && inMatch() && "menu" !== world.phase && "over" !== world.phase;
    if (!on) return void (el && (el.hidden = !0));
    if (!el) {
      el = document.createElement("div");
      el.id = "range-hud";
      el.style.cssText = "position:absolute;top:86px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;padding:6px 16px;border-radius:999px;background:rgba(10,13,18,.74);border:1px solid rgba(255,200,73,.5);color:#ffe9a8;font:700 13px/1.4 var(--f-display,system-ui);letter-spacing:.05em;white-space:nowrap";
      ($("hud") || document.body).appendChild(el);
    }
    const t = Math.max(0, Math.ceil(world.roundTime || 0)),
      m = mult();
    el.hidden = !1;
    el.textContent = RANGE.live || world.over ? `${L("점수", "Score")} ${RANGE.score} · ${L("연속", "Run")} ${RANGE.streak}${m > 1 ? " ×" + m : ""} · ${t}s${RANGE.best ? " · " + L("최고", "Best") + " " + RANGE.best : ""}` : `${L("준비", "Get ready")} · ${t}s`;
  }
  const _uh = updateHUD;
  updateHUD = function () {
    const r = _uh.apply(this, arguments);
    try {
      if (ours() && inMatch() && "function" == typeof _hT && $("tb-phase")) _hT($("tb-phase"), "buy" === world.phase ? L("준비", "Ready") : L("표적 사격", "Target range"));
    } catch (e) {}
    return r;
  };
  const againOrig = $("ov-again") && $("ov-again").onclick;
  const _go = gameOver;
  gameOver = function () {
    const r = _go.apply(this, arguments);
    try {
      if (ours() && inMatch()) {
        const me = myActor() || player,
          shots = (world.stats && world.stats.shots) || 0,
          acc = shots ? Math.min(100, Math.round((100 * RANGE.hits) / shots)) : 0,
          prev = best(me),
          top = Math.max(prev, RANGE.score);
        RANGE.score > prev && (RANGE.newBest = !0);
        try {
          localStorage.setItem(keyOf(me), String(top));
        } catch (e) {}
        $("ov-head").textContent = `${RANGE.score}${L("점", " pts")}`;
        $("ov-head").style.color = RANGE.score > prev ? "#ffd54f" : "#e8edf5";
        $("ov-score").textContent = `${RANGE.score > prev && prev ? L("신기록! ", "New best! ") : ""}${L("이 총 최고", "Best with this gun")} ${top}${L("점", "")}`;
        $("ov-k").textContent = RANGE.hits;
        $("ov-d").textContent = RANGE.heads;
        $("ov-dmg").textContent = RANGE.score;
        $("ov-acc").textContent = acc + "%";
        const lbl = (id, ko, en) => {
          const s = $(id) && $(id).parentElement && $(id).parentElement.querySelector(".lbl");
          s && (s.textContent = L(ko, en));
        };
        lbl("ov-k", "명중", "Hits");
        lbl("ov-d", "헤드샷", "Headshots");
        lbl("ov-dmg", "점수", "Score");
        $("ov-again").onclick = () => ((RANGE.entering = !0), startGame(player.agent, !0));
      } else {
        ["ov-k", "ov-d", "ov-dmg", "ov-acc"].forEach((id, i) => {
          const s = $(id) && $(id).parentElement && $(id).parentElement.querySelector(".lbl");
          s && (s.textContent = [L("처치", "Kills"), L("사망", "Deaths"), L("피해량", "Damage"), L("명중률", "Accuracy")][i]);
        });
        againOrig && ($("ov-again").onclick = againOrig);
      }
    } catch (e) {}
    return r;
  };

  // ── the way in: the practice menu ──
  function enter() {
    if (!ours()) RANGE.prev = room.mode || "std";
    RANGE.entering = !0;
    room.mode = MODE;
    room.map = "field";
    const ag = ("undefined" != typeof picked && picked) || AGENTS[0];
    startGame(ag, !0);
  }
  function mount() {
    if ($("go-targets")) return;
    const b = document.createElement("button");
    b.id = "go-targets";
    b.className = "tt-item";
    b.innerHTML = `<b>${L("표적 사격", "Target range")}</b>`;
    b.onclick = enter;
    const host = document.querySelector(".home-practice > div") || ($("go-range") && $("go-range").parentElement);
    host && host.appendChild(b);
  }
  mount();
  setTimeout(mount, 1500);

  window.TARGET_RANGE = { RANGE, add, trace, score, enter, KINDS, mult };
})();
