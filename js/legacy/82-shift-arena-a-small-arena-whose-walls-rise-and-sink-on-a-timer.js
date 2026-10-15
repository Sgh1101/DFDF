(() => {
  // 시프트 아레나 — a small 3 v 3 arena (90 × 110 m) in blue and white with
  // orange light. The middle is a raised core with stairs; around it stand
  // blocks, low cover, two towers and two site decks. Three sets of tall
  // barriers rise and sink on a timer: every 22 seconds one set drops flat and
  // the other two stand, so the safe places and the ways across change. Three
  // seconds before a change the barriers about to move glow orange and a count
  // runs on the screen. The host keeps the clock and tells the guests; a late
  // joiner is told where the arena stands. Bots find their way again at every
  // change (the walk grid is rebuilt). Only the walls move: nothing else about
  // a fight changes.
  if ("undefined" == typeof MAPS || "undefined" == typeof MAP_LIST || "undefined" == typeof THEMES || "undefined" == typeof MOODS || MAPS.shift) return;
  const $ = (id) => document.getElementById(id);
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const NAME = "시프트 아레나";
  const PHASE_S = 22, // seconds between changes
    WARN_S = 3.5, // the warning before a change
    SETS = 3, // sets of barriers; phase p lays set p % 3 flat
    BAR_H = 4.4;
  const hex = (s) => parseInt(String(s).replace("#", ""), 16);

  // ── the look: pale blue floor with orange guide lines, teal walls, a clear blue sky ──
  const M = (o) => new T.MeshStandardMaterial(o);
  function floorTex(bw, bd) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#c4d8ea";
    g.fillRect(0, 0, 256, 256);
    // four 2 m tiles to a texture (8 m), each a touch different
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const v = 196 + ((i * 5 + j * 3) % 4) * 3;
        g.fillStyle = `rgb(${v - 4},${v + 12},${v + 26})`;
        g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      }
    g.strokeStyle = "#9db6cc";
    g.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      g.beginPath();
      g.moveTo(k * 64, 0);
      g.lineTo(k * 64, 256);
      g.moveTo(0, k * 64);
      g.lineTo(256, k * 64);
      g.stroke();
    }
    // the orange guide line along two edges of the 8 m square
    g.strokeStyle = "#ff8a2a";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 2);
    g.lineTo(256, 2);
    g.moveTo(2, 0);
    g.lineTo(2, 256);
    g.stroke();
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set((bw + 12) / 8, (bd + 12) / 8);
    t.anisotropy = 4;
    "colorSpace" in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
    return t;
  }
  function wallTex() {
    // a teal that is a little lighter at the top of each face
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "#27a3bd");
    gr.addColorStop(1, "#16788f");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    "colorSpace" in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
    return t;
  }
  const B = { minX: -45, maxX: 45, minZ: -55, maxZ: 55 };
  THEMES.shift = {
    floor: M({ map: floorTex(B.maxX - B.minX, B.maxZ - B.minZ), roughness: 0.55, metalness: 0.12 }),
    wall: M({ map: wallTex(), roughness: 0.48, metalness: 0.35 }),
    strut: M({ color: 0x3a4658, roughness: 0.5, metalness: 0.6 }),
    trim: M({ color: 0xff8a2a, emissive: 0xff7a1a, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.3 }),
    crate: M({ color: 0x2c3647, roughness: 0.55, metalness: 0.45 }),
    glow: 0xff9a3a,
  };
  MOODS.shift = {
    top: "#1c46c8",
    mid: "#3d8be0",
    hor: "#c4e6f8",
    fog: hex("#bddaee"),
    hemiSky: hex("#d4e8ff"),
    hemiGnd: hex("#7aa3bd"),
    hemi: 0.9,
    exp: 1.04,
    env: 0.95,
    sun: hex("#fff1d8"),
    sunInt: 1.55,
    glow: "#d6ecff",
    tint: [1, 1.01, 1.03],
    lift: [0, 0.005, 0.014],
    sat: 1.12,
    con: 1.08,
    vig: 0.3,
    bloom: 1.05,
  };

  // ── the plan ──
  const W = [];
  const box = (x, z, w, d, h, f) => W.push(Object.assign({ x, z, w, d, h }, f || {}));
  const cover = (x, z, w, d, h, f) => box(x, z, w, d, h, Object.assign({ cover: !0 }, f || {}));
  // in all four quarters
  const quad = (fn, x, z, ...r) => {
    for (const sx of [1, -1]) for (const sz of [1, -1]) fn(sx * x, sz * z, ...r);
  };
  // steps up to a deck: n steps of 0.45 m from the deck's edge outward, along z or x
  const stepsZ = (x, edge, dir, n, w, top) => {
    for (let i = 0; i < n; i++) box(x, edge + dir * (0.6 + 1.2 * i), w, 1.2, top - 0.45 * (i + 1), { stair: 1 });
  };
  const stepsX = (z, edge, dir, n, d, top) => {
    for (let i = 0; i < n; i++) box(edge + dir * (0.6 + 1.2 * i), z, 1.2, d, top - 0.45 * (i + 1), { stair: 1 });
  };
  // the edge of the arena
  box(0, -56.5, 96, 3, 6);
  box(0, 56.5, 96, 3, 6);
  box(-46.5, 0, 3, 116, 6);
  box(46.5, 0, 3, 116, 6);
  // the core: a raised deck in the middle, stairs north and south, low cover on top
  box(0, 0, 16, 16, 1.8, { deck: 1 });
  for (const dir of [1, -1]) stepsZ(0, dir * 8, dir, 3, 6, 1.8);
  cover(-5, 0, 1, 6, 1.1);
  cover(5, 0, 1, 6, 1.1);
  // four pillars beside the core, tall blocks on the lanes, low cover between
  quad(box, 11.5, 11.5, 3, 3, 3.6);
  quad(box, 24, 20, 6, 6, 3.4);
  quad(cover, 33, 4, 3, 1.4, 1.2);
  quad(cover, 14, 31, 6, 1.2, 1.3);
  quad(cover, 38, 31, 2, 6, 1.3);
  quad(cover, 20, 40, 3, 2, 1.4, { crate: 1 });
  // a tower on each side with steps from the middle
  for (const sx of [1, -1]) {
    box(sx * 40, 0, 6, 12, 1.8, { deck: 1 });
    stepsX(0, sx * 37, -sx, 3, 5, 1.8);
    cover(sx * 42, 3.5, 2, 1, 1.1);
    cover(sx * 42, -3.5, 2, 1, 1.1);
  }
  // the site decks (A and B for the defenders; the attackers' side has the same decks)
  quad(box, 24, 34, 9, 9, 0.9, { deck: 1, dais: 1 });
  quad(cover, 30, 38.5, 2.4, 2, 1.3, { crate: 1 });
  quad(cover, 19, 39, 3, 1.4, 1.5);
  quad(cover, 24, 28.6, 5, 1, 0.45, { stair: 1 });
  // a little cover where each team starts
  for (const sz of [1, -1]) {
    cover(0, sz * 45, 8, 1.4, 1.3);
    cover(-11, sz * 49, 3, 2, 1.3, { crate: 1 });
    cover(11, sz * 49, 3, 2, 1.3, { crate: 1 });
  }
  // the barriers that rise and sink: three sets (set number in `set`)
  const SHIFT = [];
  const bar = (set, x, z, w, d) => SHIFT.push({ set, x, z, w, d, h: BAR_H });
  bar(0, -32, 13, 18, 1.4);
  bar(0, -32, -13, 18, 1.4);
  bar(0, -19.6, 0, 1.4, 11);
  bar(1, 32, 13, 18, 1.4);
  bar(1, 32, -13, 18, 1.4);
  bar(1, 19.6, 0, 1.4, 11);
  bar(2, 0, 25, 18, 1.4);
  bar(2, 0, -25, 18, 1.4);

  const DATA = {
    key: "shift",
    name: NAME,
    theme: "shift",
    size: 3,
    _plus: 1,
    sky: hex("#7fb4e8"),
    fog: 0.0026,
    sunColor: hex("#fff1d8"),
    sunInt: 1.55,
    ambient: 0.9,
    bounds: B,
    attackSpawn: { x: 0, z: 51 },
    defendSpawn: { x: 0, z: -51 },
    sites: [
      { id: "A", x: -24, z: -34, r: 8, label: "A" },
      { id: "B", x: 24, z: -34, r: 8, label: "B" },
    ],
    nodes: {
      attack: { x: 0, z: 51 }, defend: { x: 0, z: -51 },
      laneL: { x: -34, z: 28 }, laneR: { x: 34, z: 28 }, midL: { x: -14, z: 18 }, midR: { x: 14, z: 18 }, mid: { x: 0, z: 17 }, rotate: { x: 0, z: -40 },
      aSite: { x: -24, z: -34 }, aFront: { x: -24, z: -26 }, aBack: { x: -24, z: -43 }, aLink: { x: -12, z: -34 },
      bSite: { x: 24, z: -34 }, bFront: { x: 24, z: -26 }, bBack: { x: 24, z: -43 }, bLink: { x: 12, z: -34 },
    },
    walls: W,
  };
  MAPS.shift = DATA;
  (window.MAP_EXTRA = window.MAP_EXTRA || []).push({ key: "shift", name: NAME });
  if (window.POGU && POGU.pool) {
    POGU.pool.includes("shift") || POGU.pool.splice(Math.min(POGU.pool.length, 8), 0, "shift");
    POGU.setPool();
  } else MAP_LIST.some((m) => "shift" === m.key) || MAP_LIST.push({ key: "shift", name: NAME });

  // ── the barriers ──
  const S = { key: null, t: 0, p: 0, walls: [], meshes: [], mats: [], warned: -1, hudT: 0, sync: 0 };
  window.SHIFT_ARENA = S;
  S.PHASE_S = PHASE_S;
  S.SETS = SETS;
  const on = () => "shift" === CUR_MAP_KEY;
  const keep = (o) => ((S.meshes.push(o), "undefined" != typeof _mapMeshes && _mapMeshes.push(o)), scene.add(o), o);
  function clear() {
    const geos = new Set(),
      mats = new Set();
    for (const o of S.meshes) {
      o.traverse((n) => {
        n.geometry && geos.add(n.geometry);
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) m && mats.add(m);
      });
      if ("undefined" != typeof _mapMeshes) {
        const i = _mapMeshes.indexOf(o);
        i >= 0 && _mapMeshes.splice(i, 1);
      }
      o.removeFromParent();
    }
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    Object.assign(S, { key: null, t: 0, p: 0, walls: [], meshes: [], mats: [], warned: -1, sphere: null });
  }
  const downSet = (p) => ((p % SETS) + SETS) % SETS;
  function place(w, up, instant) {
    w.up = up;
    w.col.h = up ? w.h : 0;
    instant && (w.k = up ? 1 : 0);
    up && "function" == typeof ejectActorsFrom && w.col.h > 0 && (instant || ejectActorsFrom(w.col));
  }
  function setPhase(p, instant) {
    S.p = p;
    S.t = 0;
    S.warned = -1;
    for (const w of S.walls) place(w, w.set !== downSet(p), instant);
    try {
      CHASH.dirty = !0;
      buildGrid();
      "function" == typeof rebuildNavGrid && rebuildNavGrid();
    } catch (e) {}
  }
  S.setPhase = setPhase;
  function build() {
    clear();
    S.key = "shift";
    S.mats = [0, 1, 2].map(() => M({ color: 0x1c97b0, roughness: 0.42, metalness: 0.4, emissive: 0xff7a1a, emissiveIntensity: 0 }));
    const stripe = M({ color: 0xff8a2a, emissive: 0xff7a1a, emissiveIntensity: 1.8 });
    S.mats.push(stripe);
    for (const d of SHIFT) {
      const col = addBox(d.x, d.z, d.w, d.d, d.h, S.mats[d.set]);
      const m = col.mesh;
      S.meshes.push(m);
      // an orange band near the top
      const band = new T.Mesh(new T.BoxGeometry(d.w + 0.04, 0.22, d.d + 0.04), stripe);
      band.position.y = d.h / 2 - 0.5;
      m.add(band);
      const w = Object.assign({ col, k: 1, up: !0, mesh: m }, d);
      S.walls.push(w);
    }
    setPhase(0, !0);
    for (const w of S.walls) w.mesh.position.y = w.up ? w.h / 2 : w.h / 2 - w.h * 0.98;
    decor();
  }

  // ── the look beyond the walls: a lattice sphere in the sky, tall blocks on the horizon ──
  function decor() {
    const rnd = (() => {
      let s = 20261015;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    })();
    // the sphere: orange lattice with a faint body
    {
      const g = new T.Group();
      const lines = new T.LineSegments(new T.WireframeGeometry(new T.IcosahedronGeometry(1, 3)), new T.LineBasicMaterial({ color: 0xff8a2a, transparent: !0, opacity: 0.95, fog: !1 }));
      const body = new T.Mesh(new T.IcosahedronGeometry(0.985, 3), new T.MeshBasicMaterial({ color: 0xff5a14, transparent: !0, opacity: 0.2, fog: !1, depthWrite: !1 }));
      g.add(body, lines);
      g.scale.setScalar(78);
      g.position.set(-70, 82, -250);
      g.userData.noCollide = !0;
      g.userData.spin = !0;
      S.sphere = g;
      keep(g);
    }
    // blocks standing past the walls, like the far structures of the arena
    {
      const mats = [M({ color: 0x1f7f97, roughness: 0.6, metalness: 0.3, fog: !0 }), M({ color: 0x3c4a5e, roughness: 0.6, metalness: 0.4 }), M({ color: 0xaecbe0, roughness: 0.7, metalness: 0.1 })];
      const ring = new T.Group();
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + rnd() * 0.15,
          r = 85 + rnd() * 55,
          w = 10 + rnd() * 22,
          h = 14 + rnd() * 40,
          m = new T.Mesh(new T.BoxGeometry(w, h, 10 + rnd() * 22), mats[Math.floor(rnd() * 3)]);
        m.position.set(Math.cos(a) * r * 1.05, h / 2 - 2, Math.sin(a) * r * 1.2);
        m.rotation.y = rnd() * 1.2;
        ring.add(m);
        // an orange light bar on the biggest ones
        if (h > 30) {
          const bar = new T.Mesh(new T.BoxGeometry(w * 0.9, 0.8, 0.6), new T.MeshBasicMaterial({ color: 0xff8a2a, fog: !1 }));
          bar.position.set(0, h * 0.2, (m.geometry.parameters.depth || 12) / 2 + 0.05);
          m.add(bar);
        }
      }
      keep(ring);
    }
    // orange strips along the top of the tall static blocks
    {
      const pos = [];
      for (const w of W) {
        if (w.cover || w.stair || w.deck || w.h < 3) continue;
        const y = w.h - 0.35,
          hx = w.w / 2 + 0.02,
          hz = w.d / 2 + 0.02;
        for (const [ax, az, bx, bz] of [[-hx, -hz, hx, -hz], [-hx, hz, hx, hz], [-hx, -hz, -hx, hz], [hx, -hz, hx, hz]]) pos.push(w.x + ax, y, w.z + az, w.x + bx, y, w.z + bz);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0xffa040 }));
      lines.userData.noCollide = !0;
      keep(lines);
    }
  }

  // ── the clock, the warning, the change ──
  function nextIn() {
    return Math.max(0, PHASE_S - S.t);
  }
  function tone(f, len, vol) {
    try {
      const c = GAME_AUDIO.context(),
        o = c.createOscillator(),
        g = c.createGain(),
        t0 = c.currentTime;
      o.type = "square";
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + len);
      o.connect(g);
      g.connect(GAME_AUDIO.output);
      o.start(t0);
      o.stop(t0 + len + 0.03);
    } catch (e) {}
  }
  function rumble() {
    try {
      const c = GAME_AUDIO.context(),
        o = c.createOscillator(),
        g = c.createGain(),
        t0 = c.currentTime;
      o.type = "sawtooth";
      o.frequency.setValueAtTime(70, t0);
      o.frequency.exponentialRampToValueAtTime(34, t0 + 0.9);
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + 0.95);
      o.connect(g);
      g.connect(GAME_AUDIO.output);
      o.start(t0);
      o.stop(t0 + 1);
    } catch (e) {}
  }
  const clock = () => "live" === world.phase;
  function change(next) {
    setPhase(next, !1);
    rumble();
    "function" == typeof banner && banner(L("구조가 바뀌었습니다", "The arena shifted"), "#ff9f43");
    "host" === NET.mode && send();
  }
  function send(to) {
    if ("host" !== NET.mode) return;
    const e = { t: "shift", p: S.p, n: nextIn(), i: S.instant ? 1 : 0 };
    to ? sendEventTo(to, e) : sendEventAll(e);
  }
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    if (!on() || !S.walls.length) return r;
    if (clock()) {
      S.t += dt;
      // the host decides; a guest waits for its word (and shows the count meanwhile)
      "client" !== NET.mode && S.t >= PHASE_S && change(S.p + 1);
    }
    const left = nextIn(),
      warn = clock() && left <= WARN_S;
    // the barriers about to move glow orange and pulse
    const next = downSet(S.p + 1);
    S.mats.slice(0, 3).forEach((m, i) => {
      const pulse = warn && (i === next || i === downSet(S.p)) ? 0.35 + 0.65 * Math.abs(Math.sin(performance.now() / 120)) : 0;
      m.emissiveIntensity += (pulse - m.emissiveIntensity) * Math.min(1, 14 * dt);
    });
    if (warn) {
      const sec = Math.ceil(left);
      if (S.warned !== sec) {
        S.warned = sec;
        tone(sec <= 1 ? 1320 : 880, 0.1, 0.1);
      }
    }
    for (const w of S.walls) {
      w.k += ((w.up ? 1 : 0) - w.k) * Math.min(1, 7 * dt);
      w.mesh.position.y = w.h / 2 - w.h * 0.98 * (1 - w.k);
      w.mesh.visible = w.k > 0.02 || w.up;
    }
    S.sphere && (S.sphere.rotation.y += 0.02 * dt);
    hud(left, warn);
    return r;
  };
  // a guest takes the host's word
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "shift" === e.t) {
      if (on() && S.walls.length) {
        const same = e.p === S.p && !e.i;
        setPhase(e.p, !!e.i);
        S.t = Math.max(0, PHASE_S - (+e.n || PHASE_S));
        same || !e.i && (rumble(), "function" == typeof banner && banner(L("구조가 바뀌었습니다", "The arena shifted"), "#ff9f43"));
      }
      return;
    }
    return _oe.apply(this, arguments);
  };
  // a round starts: the arena goes back to its first shape
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    if (on() && S.walls.length) {
      S.instant = !0;
      setPhase(0, !0);
      "host" === NET.mode && send();
      S.instant = !1;
    }
    return r;
  };
  // a joiner learns the shape
  const _oa = NET.onAction;
  NET.onAction = function (peer, msg) {
    const r = _oa && _oa.apply(this, arguments);
    msg && "hello" === msg.t && on() && S.walls.length && "host" === NET.mode && setTimeout(() => send(peer), 600);
    return r;
  };

  // ── the screen: a count, and the barriers on the map ──
  const css = document.createElement("style");
  css.textContent = `
#shift-hud{position:fixed;top:112px;left:50%;transform:translateX(-50%);z-index:55;display:none;min-width:150px;padding:3px 14px 5px;border-radius:10px;text-align:center;font:700 12px/1.4 var(--f-display,inherit);letter-spacing:.08em;color:#fff3e0;background:rgba(20,28,40,.72);border:1px solid rgba(255,138,42,.55);pointer-events:none}
#shift-hud i{display:block;height:3px;margin-top:3px;border-radius:2px;background:rgba(255,255,255,.18);overflow:hidden}
#shift-hud i b{display:block;height:100%;background:#ff8a2a;transition:width .2s linear}
#shift-hud.warn{color:#fff;border-color:#ff8a2a;box-shadow:0 0 18px -2px #ff8a2a;animation:shiftPulse .5s ease-in-out infinite alternate}
@keyframes shiftPulse{to{background:rgba(120,50,6,.82)}}`;
  document.head.appendChild(css);
  let el = null;
  function hud(left, warn) {
    if (!el) {
      el = document.createElement("div");
      el.id = "shift-hud";
      el.innerHTML = '<span></span><i><b></b></i>';
      document.body.appendChild(el);
    }
    const show = on() && clock();
    el.style.display = show ? "block" : "none";
    if (!show) return;
    el.classList.toggle("warn", warn);
    el.firstChild.textContent = warn ? L(`⚠ 구조 변경 ${Math.ceil(left)}`, `⚠ Shift in ${Math.ceil(left)}`) : L(`구조 변경까지 ${Math.ceil(left)}초`, `Next shift ${Math.ceil(left)}s`);
    el.querySelector("b").style.width = (100 * (1 - left / PHASE_S)).toFixed(1) + "%";
  }
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    if (!on() || !S.walls.length || "undefined" == typeof mctx) return r;
    const b = MAP.bounds,
      sx = mini.width / (b.maxX - b.minX),
      sz = mini.height / (b.maxZ - b.minZ);
    for (const w of S.walls) {
      mctx.fillStyle = w.up ? "rgba(255,138,42,.85)" : "rgba(255,138,42,.18)";
      mctx.fillRect((w.x - w.w / 2 - b.minX) * sx, (w.z - w.d / 2 - b.minZ) * sz, Math.max(2, w.w * sx), Math.max(2, w.d * sz));
    }
    return r;
  };

  // ── into the map load ──
  const _lm = loadMap;
  loadMap = function (key) {
    const r = _lm.apply(this, arguments);
    try {
      "shift" === key ? build() : clear();
    } catch (e) {
      console.warn("shift arena", e);
    }
    return r;
  };
  try {
    on() && build();
  } catch (e) {}
})();
