(() => {
  // 달리는 열차 — a 3 v 3 map on two freight trains running side by side at
  // dusk. Each train is five flat cars (12 m wide, 22 m long) joined by gangways, with containers and crates for cover and steps up onto some
  // containers. Between the trains a 4 m gap with a guard rail; five bridges
  // cross it, in three sets, and every 20 seconds one set folds away (a gate
  // rises) while the others are down, so the way across keeps moving. Three
  // seconds before a change the gates about to move glow and a count runs.
  // The trains don't move: the ground, the sleepers in the gap and the poles
  // and trees outside rush past, and the cars clatter. The host keeps the
  // clock and tells the guests; bots find their way again at every change.
  if ("undefined" == typeof MAPS || "undefined" == typeof MAP_LIST || "undefined" == typeof THEMES || "undefined" == typeof MOODS || MAPS.train) return;
  const $ = (id) => document.getElementById(id);
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const NAME = "달리는 열차";
  const PHASE_S = 20,
    WARN_S = 3,
    SETS = 3,
    GATE_H = 2.2,
    SPEED = 22; // how fast the world outside goes by (m/s)
  const hex = (s) => parseInt(String(s).replace("#", ""), 16);
  const M = (o) => new T.MeshStandardMaterial(o);
  const tex = (draw, w, h, rx, ry) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    "colorSpace" in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
    return t;
  };
  const B = { minX: -14, maxX: 14, minZ: -62, maxZ: 62 };
  // the deck: steel plates with rivets, worn
  const deck = tex(
    (g, W, H) => {
      g.fillStyle = "#5b5f66";
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const v = 88 + ((i * 7 + j * 5) % 5) * 4;
          g.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
          g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
          g.fillStyle = "rgba(0,0,0,.35)";
          for (const [x, y] of [[6, 6], [58, 6], [6, 58], [58, 58]]) g.fillRect(i * 64 + x - 1, j * 64 + y - 1, 3, 3);
        }
      // diamond tread
      g.strokeStyle = "rgba(255,255,255,.05)";
      for (let k = -W; k < W * 2; k += 10) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + H, H);
        g.stroke();
      }
    },
    256,
    256,
    (B.maxX - B.minX + 12) / 8,
    (B.maxZ - B.minZ + 12) / 8,
  );
  THEMES.train = {
    floor: M({ map: deck, roughness: 0.62, metalness: 0.45 }),
    wall: M({ color: 0x5b626e, roughness: 0.6, metalness: 0.55 }),
    strut: M({ color: 0x2d2f35, roughness: 0.55, metalness: 0.6 }),
    trim: M({ color: 0xffc23d, emissive: 0xff9a1a, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.3 }),
    crate: M({ color: 0x8a6a3c, roughness: 0.8, metalness: 0.05 }),
    glow: 0xffb347,
  };
  MOODS.train = {
    top: "#24305e",
    mid: "#b8556a",
    hor: "#ffb27a",
    fog: hex("#d9927a"),
    hemiSky: hex("#ffd2b0"),
    hemiGnd: hex("#5a4a52"),
    hemi: 0.85,
    exp: 1.02,
    env: 0.85,
    sun: hex("#ffb070"),
    sunInt: 1.4,
    glow: "#ffd9b8",
    tint: [1.04, 1, 0.97],
    lift: [0.012, 0.004, 0],
    sat: 1.1,
    con: 1.08,
    vig: 0.32,
    bloom: 1.1,
  };

  // ── the plan ──
  const W = [];
  const box = (x, z, w, d, h, f) => W.push(Object.assign({ x, z, w, d, h }, f || {}));
  const cover = (x, z, w, d, h, f) => box(x, z, w, d, h, Object.assign({ cover: !0 }, f || {}));
  // the edge (kept, but not drawn: low railings are drawn instead, so the world outside shows)
  box(0, -63.5, 34, 3, 6, { edge: 1 });
  box(0, 63.5, 34, 3, 6, { edge: 1 });
  box(-15.5, 0, 3, 130, 6, { edge: 1 });
  box(15.5, 0, 3, 130, 6, { edge: 1 });
  // the cars: five on each train, centred at these z, joined by 5 m doors
  const CARS = [-48, -24, 0, 24, 48];
  // where two cars meet: an end wall on each side of a 5 m door in the middle of the car
  for (const side of [-1, 1])
    for (const c of [-36, -12, 12, 36]) {
      box(side * 3.75, c, 3.5, 1.2, 3, { carEnd: 1 });
      box(side * 12.25, c, 3.5, 1.2, 3, { carEnd: 1 });
    }
  // the guard rail in the gap, broken by the five bridges (5 m wide, at the middle of each car)
  const BRIDGE_W = 5;
  {
    const cuts = CARS.map((z) => [z - BRIDGE_W / 2, z + BRIDGE_W / 2]);
    let z0 = B.minZ - 1;
    for (const [a, b] of cuts) {
      a > z0 && box(0, (z0 + a) / 2, 4, a - z0, GATE_H, { rail: 1 });
      z0 = b;
    }
    B.maxZ + 1 > z0 && box(0, (z0 + B.maxZ + 1) / 2, 4, B.maxZ + 1 - z0, GATE_H, { rail: 1 });
  }
  // containers (with steps on some), crates and low cover; the right train is the left one
  // turned round, so the two halves of the map play alike but read differently
  const steps = (x, edge, dir, n, w, top) => {
    for (let i = 0; i < n; i++) box(x, edge + dir * (0.6 + 1.2 * i), w, 1.2, top - 0.45 * (i + 1), { stair: 1 });
  };
  const both = (fn) => {
    fn(1, 1);
    fn(-1, -1);
  };
  both((sx, sz) => {
    const X = (x) => -sx * x,
      Z = (z) => sz * z;
    // the end cars: a locomotive-like cab at each end of each train
    box(X(8), Z(-58), 12, 6, 3.4, { cab: 1 });
    // containers stand against the outer side of each car; a lane of 5-6 m stays open
    // down the inner side, so every car can be crossed and fought along
    // car 1 (by the defenders' end)
    box(X(12.25), Z(-46), 3.5, 8, 2.2, { box: 1, c: 0 });
    cover(X(3.5), Z(-52), 2.4, 2.4, 1.3, { crate: 1 });
    cover(X(3.5), Z(-41), 2.4, 1.2, 1.2);
    // car 2 (the site)
    box(X(12.25), Z(-21), 3.5, 7, 2.2, { box: 1, c: 1 });
    steps(X(12.25), Z(-21) - sz * 3.5, -sz, 5, 3.4, 2.25);
    cover(X(3.5), Z(-28), 2.4, 1.2, 1.2);
    cover(X(3.5), Z(-17), 2, 2, 1.3, { crate: 1 });
    // car 3 (the middle)
    box(X(12.25), Z(3), 3.5, 9, 2.2, { box: 1, c: 2 });
    steps(X(12.25), Z(3) - sz * 4.5, -sz, 5, 3.4, 2.25);
    cover(X(3.5), Z(-5), 1.4, 3, 1.3);
    cover(X(3.5), Z(7), 2, 2, 1.3, { crate: 1 });
    // car 4
    box(X(12.25), Z(22), 3.5, 8, 2.2, { box: 1, c: 3 });
    cover(X(3.5), Z(30), 2, 2, 1.3, { crate: 1 });
    cover(X(3.5), Z(17), 2.4, 1.2, 1.2);
    // car 5 (by the attackers' end)
    cover(X(12), Z(44), 2.5, 2.5, 1.3, { crate: 1 });
    cover(X(3.5), Z(51), 2.4, 1.2, 1.2);
    box(X(12.25), Z(50), 3.5, 4, 2.2, { box: 1, c: 1 });
  });
  // the gates: one per bridge, in three sets (set 0 the middle two, set 1 the end two, set 2 the centre)
  const GATES = CARS.map((z) => ({ set: 0 === z ? 2 : Math.abs(z) === 24 ? 0 : 1, x: 0, z, w: 4, d: BRIDGE_W - 0.1, h: GATE_H }));

  const DATA = {
    key: "train",
    name: NAME,
    theme: "train",
    size: 3,
    _plus: 1,
    sky: hex("#c86c6c"),
    fog: 0.004,
    sunColor: hex("#ffb070"),
    sunInt: 1.4,
    ambient: 0.85,
    bounds: B,
    attackSpawn: { x: -8, z: 55 },
    defendSpawn: { x: 8, z: -55 },
    sites: [
      { id: "A", x: -8, z: -24, r: 7, label: "A" },
      { id: "B", x: 8, z: -24, r: 7, label: "B" },
    ],
    nodes: {
      attack: { x: -8, z: 55 }, defend: { x: 8, z: -55 },
      l5: { x: -8, z: 46 }, l4: { x: -8, z: 24 }, l3: { x: -8, z: 0 }, l2: { x: -8, z: -24 }, l1: { x: -8, z: -46 },
      r5: { x: 8, z: 46 }, r4: { x: 8, z: 24 }, r3: { x: 8, z: 0 }, r2: { x: 8, z: -24 }, r1: { x: 8, z: -46 },
      aSite: { x: -8, z: -24 }, aFront: { x: -8, z: -14 }, aBack: { x: -8, z: -32 },
      bSite: { x: 8, z: -24 }, bFront: { x: 8, z: -14 }, bBack: { x: 8, z: -32 },
      mid: { x: 0, z: 0 },
    },
    walls: W,
  };
  MAPS.train = DATA;
  (window.MAP_EXTRA = window.MAP_EXTRA || []).push({ key: "train", name: NAME });
  if (window.POGU && POGU.pool) {
    POGU.pool.includes("train") || POGU.pool.splice(Math.min(POGU.pool.length, 9), 0, "train");
    POGU.setPool();
  } else MAP_LIST.some((m) => "train" === m.key) || MAP_LIST.push({ key: "train", name: NAME });

  // ── state ──
  const S = { key: null, t: 0, p: 0, gates: [], meshes: [], mats: [], warned: -1, scroll: [], movers: [], clack: 0, instant: !1 };
  window.TRAIN_MAP = S;
  S.PHASE_S = PHASE_S;
  S.GATES = GATES;
  const on = () => "train" === CUR_MAP_KEY;
  const keep = (o) => (S.meshes.push(o), "undefined" != typeof _mapMeshes && _mapMeshes.push(o), scene.add(o), o);
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
    for (const m of mats) m.dispose && m.dispose();
    Object.assign(S, { key: null, t: 0, p: 0, gates: [], meshes: [], mats: [], warned: -1, scroll: [], movers: [] });
  }
  // one set folded away (its gate up) at a time; the other bridges are open
  const shutSet = (p) => ((p % SETS) + SETS) % SETS;
  function place(g, up, instant) {
    g.up = up;
    g.col.h = up ? g.h : 0;
    instant && (g.k = up ? 1 : 0);
    up && "function" == typeof ejectActorsFrom && g.col.h > 0 && (instant || ejectActorsFrom(g.col));
  }
  function setPhase(p, instant) {
    S.p = p;
    S.t = 0;
    S.warned = -1;
    for (const g of S.gates) place(g, g.set === shutSet(p), instant);
    try {
      CHASH.dirty = !0;
      buildGrid();
      "function" == typeof rebuildNavGrid && rebuildNavGrid();
    } catch (e) {}
  }
  S.setPhase = setPhase;
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const colFor = (w) => COLLIDERS.find((c) => c.mesh && near(c.minX, w.x - w.w / 2) && near(c.maxX, w.x + w.w / 2) && near(c.minZ, w.z - w.d / 2) && near(c.maxZ, w.z + w.d / 2) && near(c.h, w.h));
  const BOX_COL = [0xb53a2c, 0x1f5f9e, 0x2f8a4e, 0xd9a022];
  function build() {
    clear();
    S.key = "train";
    // corrugation on the containers: thin dark ribs along the long side (the walls
    // themselves were coloured before the map merged its meshes: see restyle)
    const ribMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: !0, opacity: 0.2 });
    S.mats.push(ribMat);
    for (const w of W) {
      if (!w.box) continue;
      const long = w.d > w.w,
        n = Math.floor(Math.max(w.w, w.d) / 0.6),
        g = new T.Group();
      for (let i = 1; i < n; i++) {
        const rib = new T.Mesh(new T.BoxGeometry(long ? w.w + 0.05 : 0.08, w.h * 0.9, long ? 0.08 : w.d + 0.05), ribMat);
        rib.position.set(long ? 0 : -w.w / 2 + i * 0.6, w.h / 2, long ? -w.d / 2 + i * 0.6 : 0);
        g.add(rib);
      }
      g.position.set(w.x, 0, w.z);
      g.userData.noCollide = !0;
      keep(g);
    }
    // the railings along the outside (looks only; the real edge is the hidden wall)
    const railMat = M({ color: 0xffc23d, roughness: 0.5, metalness: 0.5 });
    S.mats.push(railMat);
    for (const sx of [-1, 1]) {
      const g = new T.Group();
      for (const y of [0.55, 1.05]) {
        const r = new T.Mesh(new T.BoxGeometry(0.1, 0.08, B.maxZ - B.minZ), railMat);
        r.position.set(sx * 14.05, y, 0);
        g.add(r);
      }
      for (let z = B.minZ; z <= B.maxZ; z += 3) {
        const p = new T.Mesh(new T.BoxGeometry(0.1, 1.1, 0.1), railMat);
        p.position.set(sx * 14.05, 0.55, z);
        g.add(p);
      }
      keep(g);
    }
    // the gates
    S.mats.push(...[0, 1, 2].map(() => M({ color: 0xffb020, roughness: 0.45, metalness: 0.3, emissive: 0xff5a14, emissiveIntensity: 0 })));
    const stripe = M({ color: 0x15161a, roughness: 0.6 });
    S.mats.push(stripe);
    for (const d of GATES) {
      const col = addBox(d.x, d.z, d.w, d.d, d.h, S.mats[S.mats.length - 4 + d.set]);
      const m = col.mesh;
      for (let i = -2; i <= 2; i++) {
        const s = new T.Mesh(new T.BoxGeometry(d.w + 0.04, 0.22, 0.5), stripe);
        s.position.set(0, -d.h / 2 + 0.5 + (i + 2) * 0.35, i * 0.9);
        s.rotation.x = 0.6;
        m.add(s);
      }
      S.gates.push(Object.assign({ col, k: 1, up: !0, mesh: m }, d));
      // the bridge plate itself
      const plate = new T.Mesh(new T.BoxGeometry(4.2, 0.08, BRIDGE_W - 0.4), M({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.6 }));
      plate.position.set(0, 0.03, d.z);
      plate.userData.noCollide = !0;
      keep(plate);
    }
    setPhase(0, !0);
    for (const g of S.gates) g.mesh.position.y = g.up ? g.h / 2 : g.h / 2 - g.h * 0.98;
    world_();
  }

  // ── the world going by ──
  function world_() {
    // the track bed in the gap: sleepers and rails, scrolling
    const bed = tex(
      (g, W, H) => {
        g.fillStyle = "#3b3330";
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 400; i++) {
          g.fillStyle = `rgba(${150 + Math.random() * 60},${130 + Math.random() * 50},${110 + Math.random() * 40},.35)`;
          g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
        }
        g.fillStyle = "#4a3324";
        for (let y = 0; y < H; y += 32) g.fillRect(4, y, W - 8, 12);
        g.fillStyle = "#9da3aa";
        g.fillRect(W * 0.25 - 3, 0, 6, H);
        g.fillRect(W * 0.75 - 3, 0, 6, H);
      },
      64,
      256,
      1,
      (B.maxZ - B.minZ) / 4,
    );
    const bedMesh = new T.Mesh(new T.PlaneGeometry(4, B.maxZ - B.minZ + 12), new T.MeshStandardMaterial({ map: bed, roughness: 0.9 }));
    bedMesh.rotation.x = -Math.PI / 2;
    bedMesh.position.set(0, 0.02, 0);
    bedMesh.userData.noCollide = !0;
    keep(bedMesh);
    S.scroll.push({ t: bed, k: 1 / 4 });
    // the land outside: fields and gravel, scrolling
    const land = tex(
      (g, W, H) => {
        g.fillStyle = "#6f6a3f";
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 260; i++) {
          g.fillStyle = ["#7d7746", "#5f5a35", "#8a7c4a", "#4f5a33"][i % 4];
          g.fillRect(Math.random() * W, Math.random() * H, 6 + Math.random() * 30, 3 + Math.random() * 8);
        }
      },
      256,
      256,
      30,
      60,
    );
    for (const sx of [-1, 1]) {
      const m = new T.Mesh(new T.PlaneGeometry(240, 480), new T.MeshStandardMaterial({ map: land, roughness: 1 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(sx * (14 + 6 + 120), -0.6, 0);
      m.userData.noCollide = !0;
      keep(m);
    }
    S.scroll.push({ t: land, k: 60 / 480 });
    // poles and trees that rush by and come round again
    const poleMat = M({ color: 0x2b2420, roughness: 0.8 }),
      leaf = [M({ color: 0x3e5a2c, roughness: 0.9 }), M({ color: 0x55702f, roughness: 0.9 }), M({ color: 0x7a5a2a, roughness: 0.9 })];
    S.mats.push(poleMat, ...leaf);
    const SPAN = 300;
    for (let i = 0; i < 18; i++) {
      for (const sx of [-1, 1]) {
        const g = new T.Group();
        if (i % 3 === 0) {
          const p = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 9, 6), poleMat);
          p.position.y = 4.5;
          const arm = new T.Mesh(new T.BoxGeometry(2.2, 0.12, 0.12), poleMat);
          arm.position.set(-sx * 0.9, 8.4, 0);
          g.add(p, arm);
          g.position.set(sx * 19, 0, 0);
        } else {
          const h = 3 + ((i * 7) % 5);
          const trunk = new T.Mesh(new T.CylinderGeometry(0.18, 0.26, h, 5), poleMat);
          trunk.position.y = h / 2;
          const crown = new T.Mesh(new T.ConeGeometry(1.6 + (i % 3) * 0.5, h * 1.1, 7), leaf[i % 3]);
          crown.position.y = h + 0.6;
          g.add(trunk, crown);
          g.position.set(sx * (24 + ((i * 13) % 40)), 0, 0);
        }
        g.position.z = -SPAN / 2 + (i / 18) * SPAN + (sx > 0 ? 8 : 0);
        g.userData.noCollide = !0;
        keep(g);
        S.movers.push({ o: g, span: SPAN });
      }
    }
    // the low sun behind
    const sun = new T.Mesh(new T.CircleGeometry(30, 32), new T.MeshBasicMaterial({ color: 0xffc27a, fog: !1 }));
    sun.position.set(-120, 30, -380);
    sun.lookAt(0, 0, 0);
    sun.userData.noCollide = !0;
    keep(sun);
  }

  // ── the clock, the warning, the change (as in the shift arena) ──
  const nextIn = () => Math.max(0, PHASE_S - S.t);
  function tone(f, len, vol, type) {
    try {
      const c = GAME_AUDIO.context(),
        o = c.createOscillator(),
        g = c.createGain(),
        t0 = c.currentTime;
      o.type = type || "square";
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + len);
      o.connect(g);
      g.connect(GAME_AUDIO.output);
      o.start(t0);
      o.stop(t0 + len + 0.03);
    } catch (e) {}
  }
  const clock = () => "live" === world.phase;
  function change(next) {
    setPhase(next, !1);
    tone(160, 0.5, 0.18, "sawtooth");
    "function" == typeof banner && banner(L("다리가 바뀌었습니다", "The bridges moved"), "#ffb347");
    "host" === NET.mode && send();
  }
  function send(to) {
    if ("host" !== NET.mode) return;
    const e = { t: "train", p: S.p, n: nextIn(), i: S.instant ? 1 : 0 };
    to ? sendEventTo(to, e) : sendEventAll(e);
  }
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    if (!on() || !S.gates.length) return r;
    dt = dt || 0.016;
    if (clock()) {
      S.t += dt;
      "client" !== NET.mode && S.t >= PHASE_S && change(S.p + 1);
    }
    const left = nextIn(),
      warn = clock() && left <= WARN_S,
      next = shutSet(S.p + 1),
      gm = S.mats.slice(-4, -1);
    gm.forEach((m, i) => {
      const pulse = warn && (i === next || i === shutSet(S.p)) ? 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 120)) : 0;
      m.emissiveIntensity += (pulse - m.emissiveIntensity) * Math.min(1, 14 * dt);
    });
    if (warn) {
      const sec = Math.ceil(left);
      S.warned !== sec && ((S.warned = sec), tone(sec <= 1 ? 1180 : 760, 0.1, 0.08));
    }
    for (const g of S.gates) {
      g.k += ((g.up ? 1 : 0) - g.k) * Math.min(1, 7 * dt);
      g.mesh.position.y = g.h / 2 - g.h * 0.98 * (1 - g.k);
      g.mesh.visible = g.k > 0.02 || g.up;
    }
    // the world rushes by
    for (const s of S.scroll) s.t.offset.y = (s.t.offset.y + SPEED * dt * s.k) % 1;
    for (const m of S.movers) {
      m.o.position.z += SPEED * dt;
      m.o.position.z > m.span / 2 && (m.o.position.z -= m.span);
    }
    // the clatter of the wheels over the joints
    if ("menu" !== world.phase && "over" !== world.phase && (S.clack -= dt) <= 0) {
      S.clack = 1.05;
      tone(70, 0.08, 0.035, "triangle");
      setTimeout(() => tone(64, 0.08, 0.03, "triangle"), 140);
    }
    hud(left, warn);
    return r;
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "train" === e.t) {
      if (on() && S.gates.length) {
        const same = e.p === S.p && !e.i;
        setPhase(e.p, !!e.i);
        S.t = Math.max(0, PHASE_S - (+e.n || PHASE_S));
        same || e.i || ("function" == typeof banner && banner(L("다리가 바뀌었습니다", "The bridges moved"), "#ffb347"));
      }
      return;
    }
    return _oe.apply(this, arguments);
  };
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    if (on() && S.gates.length) {
      S.instant = !0;
      setPhase(0, !0);
      "host" === NET.mode && send();
      S.instant = !1;
    }
    return r;
  };
  const _oa = NET.onAction;
  NET.onAction = function (peer, msg) {
    const r = _oa && _oa.apply(this, arguments);
    msg && "hello" === msg.t && on() && S.gates.length && "host" === NET.mode && setTimeout(() => send(peer), 600);
    return r;
  };

  // ── the screen ──
  const css = document.createElement("style");
  css.textContent = `
#train-hud{position:fixed;top:112px;left:50%;transform:translateX(-50%);z-index:55;display:none;min-width:150px;padding:3px 14px 5px;border-radius:10px;text-align:center;font:700 12px/1.4 var(--f-display,inherit);letter-spacing:.08em;color:#fff3e0;background:rgba(30,20,24,.72);border:1px solid rgba(255,179,71,.55);pointer-events:none}
#train-hud i{display:block;height:3px;margin-top:3px;border-radius:2px;background:rgba(255,255,255,.18);overflow:hidden}
#train-hud i b{display:block;height:100%;background:#ffb347;transition:width .2s linear}
#train-hud.warn{color:#fff;border-color:#ffb347;box-shadow:0 0 18px -2px #ffb347}`;
  document.head.appendChild(css);
  let el = null;
  function hud(left, warn) {
    if (!el) {
      el = document.createElement("div");
      el.id = "train-hud";
      el.innerHTML = "<span></span><i><b></b></i>";
      document.body.appendChild(el);
    }
    const show = on() && clock();
    el.style.display = show ? "block" : "none";
    if (!show) return;
    el.classList.toggle("warn", warn);
    el.firstChild.textContent = warn ? L(`⚠ 다리 변경 ${Math.ceil(left)}`, `⚠ Bridges move in ${Math.ceil(left)}`) : L(`다리 변경까지 ${Math.ceil(left)}초`, `Bridges move in ${Math.ceil(left)}s`);
    el.querySelector("b").style.width = (100 * (1 - left / PHASE_S)).toFixed(1) + "%";
  }
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    if (!on() || !S.gates.length || "undefined" == typeof mctx) return r;
    const b = MAP.bounds,
      sx = mini.width / (b.maxX - b.minX),
      sz = mini.height / (b.maxZ - b.minZ);
    for (const g of S.gates) {
      mctx.fillStyle = g.up ? "rgba(255,90,40,.9)" : "rgba(120,220,140,.55)";
      mctx.fillRect((g.x - g.w / 2 - b.minX) * sx, (g.z - g.d / 2 - b.minZ) * sz, Math.max(2, g.w * sx), Math.max(2, g.d * sz));
    }
    return r;
  };

  // before the map merges its walls into one mesh per material: hide the edge, colour the
  // containers, the cabs and the guard rail (each colour then merges on its own)
  const STYLE = { box: BOX_COL.map((c) => M({ color: c, roughness: 0.62, metalness: 0.35 })), cab: M({ color: 0xc23b22, roughness: 0.5, metalness: 0.45 }) };
  function restyle() {
    for (const w of W) {
      const c = colFor(w);
      if (!c) continue;
      if (w.edge) c.mesh.visible = !1;
      else if (w.box) c.mesh.material = STYLE.box[w.c % STYLE.box.length];
      else if (w.cab) c.mesh.material = STYLE.cab;
      else if (w.rail) c.mesh.material = THEMES.train.strut;
    }
  }
  if ("function" == typeof mergeStatic) {
    const _ms = mergeStatic;
    mergeStatic = function () {
      try {
        "train" === CUR_MAP_KEY && restyle();
      } catch (e) {}
      return _ms.apply(this, arguments);
    };
  }
  const _lm = loadMap;
  loadMap = function (key) {
    const r = _lm.apply(this, arguments);
    try {
      "train" === key ? build() : clear();
    } catch (e) {
      console.warn("train map", e);
    }
    return r;
  };
  try {
    on() && build();
  } catch (e) {}
})();
