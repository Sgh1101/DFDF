(() => {
  // Two more maps.
  //  · 야간 항구 (3 v 3) — a harbor after dark: the sea on the west side, a moored
  //    boat, warehouses with lit windows, container rows, a gantry crane whose
  //    searchlight sweeps the yard, and street lamps that pool warm light on the
  //    quay while the rest lies in the moon's blue. One lamp by the A site flickers.
  //  · 옥상 도시 (5 v 5) — a city in the afternoon: sixteen buildings from 4.5 to
  //    9 m with a stair run up the side of each, parapets and vents on the roofs,
  //    two plazas for the spike sites and two ziplines (F) over the cross street.
  //    Bots keep to the streets; the roofs are for people.
  // Both are plain wall lists like the other maps (lanes 5 m and more, real
  // colliders on the edges); the look is added on top and taken down again when
  // another map is loaded.
  if ("undefined" == typeof MAPS || "undefined" == typeof MAP_LIST || "undefined" == typeof THEMES || "undefined" == typeof MOODS || MAPS.nightport) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
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
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const colFor = (w) => COLLIDERS.find((c) => c.mesh && near(c.minX, w.x - w.w / 2) && near(c.maxX, w.x + w.w / 2) && near(c.minZ, w.z - w.d / 2) && near(c.maxZ, w.z + w.d / 2) && near(c.h, w.h));
  // plans: walls are {x,z,w,d,h,flags}
  const plan = () => {
    const W = [];
    const box = (x, z, w, d, h, f) => W.push(Object.assign({ x, z, w, d, h }, f || {}));
    const cover = (x, z, w, d, h, f) => box(x, z, w, d, h, Object.assign({ cover: !0 }, f || {}));
    return { W, box, cover };
  };
  const rnd = (() => {
    let s = 20240611;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  })();

  // ═══════════ 야간 항구 ═══════════
  const HB = { minX: -46, maxX: 46, minZ: -40, maxZ: 40 };
  const H = plan();
  {
    const { box, cover } = H;
    // the edge: north, south and east are hoardings; the west edge is the quay (hidden, railings drawn)
    box(0, -41.5, 98, 3, 5, { edge: 1 });
    box(0, 41.5, 98, 3, 5, { edge: 1 });
    box(47.5, 0, 3, 86, 5, { edge: 1 });
    box(-47.5, 0, 3, 86, 5, { edge: 1, sea: 1 });
    // the warehouses by the defenders' end; the yard between them holds their spawn
    box(-24, -33, 22, 12, 6, { bld: 1, lit: 1 });
    box(24, -33, 22, 12, 6, { bld: 1, lit: 1 });
    // A: the quay by the water; B: the yard by the east fence
    box(-19, -14, 3, 9, 2.6, { box: 1, c: 0 });
    cover(-34, -9, 2.4, 2.4, 1.3, { crate: 1 });
    cover(-27, -19.5, 2.4, 1.4, 1.2, { crate: 1 });
    cover(-37, -15, 1.2, 1.2, 1.1, { bollard: 1 });
    box(20, -14, 9, 3, 2.6, { box: 1, c: 2 });
    cover(33, -9, 2.4, 2.4, 1.3, { crate: 1 });
    cover(27, -19, 1.4, 2.4, 1.2, { crate: 1 });
    cover(33, -18, 2, 2, 1.3, { crate: 1 });
    // the gantry: four legs, the beam is drawn over them
    for (const x of [-10, 10]) for (const z of [-4, 4]) box(x, z, 1.6, 1.6, 10, { leg: 1 });
    cover(0, -6, 3, 2, 1.3, { crate: 1 });
    cover(-4, 9, 2.4, 2.4, 1.3, { crate: 1 });
    // the container yard by the attackers' end
    box(-30, 26, 3, 14, 2.6, { box: 1, c: 1 });
    box(-18, 30, 3, 10, 2.6, { box: 1, c: 3 });
    box(18, 28, 3, 12, 2.6, { box: 1, c: 0 });
    box(32, 26, 3, 14, 2.6, { box: 1, c: 2 });
    cover(-8, 21, 2.4, 2.4, 1.3, { crate: 1 });
    cover(8, 23, 2.4, 1.4, 1.2, { crate: 1 });
    box(0, 15, 10, 3, 2.6, { box: 1, c: 1 });
    // the moored boat on the quay side and the dock office on the east
    box(-41, 8, 5, 14, 1.6, { boat: 1 });
    box(40, 10, 10, 10, 3.5, { bld: 1, lit: 1 });
  }
  const HARBOR = {
    key: "nightport",
    name: "야간 항구",
    theme: "nightport",
    size: 3,
    sky: hex("#0a1226"),
    fog: 0.0075,
    sunColor: hex("#8fb0ff"),
    sunInt: 0.55,
    ambient: 0.9,
    bounds: HB,
    attackSpawn: { x: 0, z: 34 },
    defendSpawn: { x: 0, z: -34 },
    sites: [
      { id: "A", x: -30, z: -14, r: 6, label: "A" },
      { id: "B", x: 28, z: -14, r: 6, label: "B" },
    ],
    nodes: {
      attack: { x: 0, z: 34 }, defend: { x: 0, z: -34 },
      aSite: { x: -30, z: -16 }, aFront: { x: -30, z: -4 }, aBack: { x: -30, z: -24 },
      bSite: { x: 28, z: -14 }, bFront: { x: 28, z: -4 }, bBack: { x: 28, z: -24 },
      l1: { x: -41, z: -30 }, l2: { x: -40, z: -2 }, l3: { x: -38, z: 22 },
      r1: { x: 41, z: -30 }, r2: { x: 41, z: -1 }, r3: { x: 41, z: 28 },
      c1: { x: 0, z: -20 }, mid: { x: 0, z: 8 }, c3: { x: 0, z: 22 },
      yardL: { x: -24, z: 22 }, yardR: { x: 24, z: 20 },
    },
    walls: H.W,
  };

  // ═══════════ 옥상 도시 ═══════════
  const RB = { minX: -62, maxX: 62, minZ: -56, maxZ: 56 };
  const R = plan();
  // x, z (centre), w, d, h; stairs: wall side, which way they climb along it
  const BLD = [
    // defenders' half
    [-14, -44, 16, 12, 7.5, "W", 1], [-43, -46, 18, 12, 5, "S", 1],
    [-17, -14, 10, 12, 9, "E", 1], [-46, -15, 12, 14, 4.5, "E", -1],
    [14, -44, 16, 12, 6, "E", 1], [43, -46, 18, 12, 7.5, "S", -1],
    [17, -14, 10, 12, 7.5, "W", 1], [46, -15, 12, 14, 9, "W", -1],
    // attackers' half
    [-15, 18, 14, 12, 6, "N", 1], [-44, 17, 12, 14, 7.5, "E", -1],
    [-27, 40, 10, 12, 4.5, "N", -1], [-49, 43, 14, 14, 6, "E", -1],
    [15, 18, 14, 12, 9, "N", -1], [44, 17, 12, 14, 4.5, "W", 1],
    [27, 40, 10, 12, 6, "N", 1], [49, 43, 14, 14, 4.5, "W", 1],
  ];
  const RISE = 0.6;
  {
    const { box, cover } = R;
    box(0, -57.5, 126, 3, 6, { edge: 1 });
    box(0, 57.5, 126, 3, 6, { edge: 1 });
    box(-63.5, 0, 3, 118, 6, { edge: 1 });
    box(63.5, 0, 3, 118, 6, { edge: 1 });
    BLD.forEach(([x, z, w, d, h, side, dir], i) => {
      box(x, z, w, d, h, { bld: 1, c: i % 4, roof: h });
      // the stair run climbs along one wall, its top step level with the roof
      const n = Math.ceil(h / RISE),
        rise = h / n;
      for (let k = 0; k < n; k++) {
        const top = rise * (k + 1);
        if ("E" === side || "W" === side) {
          const wx = x + ("E" === side ? 1 : -1) * (w / 2 + 0.9),
            last = z + dir * (d / 2 - 1.5);
          box(wx, last - dir * (n - 1 - k), 1.8, 1, top, { stair: 1 });
        } else {
          const wz = z + ("S" === side ? 1 : -1) * (d / 2 + 0.9),
            last = x + dir * (w / 2 - 1.5);
          box(last - dir * (n - 1 - k), wz, 1, 1.8, top, { stair: 1 });
        }
      }
      // parapets on the three sides without the stairs, and a vent or two on the roof
      const p = 0.4,
        ph = h + 1;
      "W" !== side && box(x - w / 2 + p / 2, z, p, d, ph, { para: 1 });
      "E" !== side && box(x + w / 2 - p / 2, z, p, d, ph, { para: 1 });
      "N" !== side && box(x, z - d / 2 + p / 2, w - 2 * p, p, ph, { para: 1 });
      "S" !== side && box(x, z + d / 2 - p / 2, w - 2 * p, p, ph, { para: 1 });
      cover(x + (w > 12 ? 2.5 : 0), z + (d > 12 ? -2.5 : 0), 2, 2, h + 1.3, { vent: 1 });
      w > 12 && cover(x - w / 4, z + d / 4, 1.6, 3, h + 1.2, { vent: 1 });
    });
    // the plazas: the two spike sites
    cover(-33, -26, 2.4, 2.4, 1.3, { crate: 1 });
    cover(-27, -34, 4.4, 1.9, 1.5, { car: 1 });
    cover(-24, -27, 1.2, 5, 1.2, { barrier: 1 });
    cover(-36, -33, 1.6, 1.6, 1.1, { planter: 1 });
    cover(33, -27, 2.4, 2.4, 1.3, { crate: 1 });
    cover(27, -33, 1.9, 4.4, 1.5, { car: 1 });
    cover(24, -26, 5, 1.2, 1.2, { barrier: 1 });
    cover(37, -33, 1.6, 1.6, 1.1, { planter: 1 });
    // the avenue and the cross street
    cover(0, -26, 4.4, 1.9, 1.5, { car: 1 });
    cover(-4, -10, 2, 2, 1.3, { crate: 1 });
    cover(3, -12, 1.9, 4.4, 1.5, { car: 1 });
    cover(0, 0, 3, 3, 1.1, { planter: 1 });
    cover(-3, 10, 4.4, 1.9, 1.5, { car: 1 });
    cover(3, 28, 1.9, 4.4, 1.5, { car: 1 });
    cover(-4, 40, 2.4, 2.4, 1.3, { crate: 1 });
    cover(-28, 1, 2, 2, 1.3, { crate: 1 });
    cover(28, -1, 2.4, 1.4, 1.2, { barrier: 1 });
    cover(-30, 28, 4.4, 1.9, 1.5, { car: 1 });
    cover(30, 30, 1.9, 4.4, 1.5, { car: 1 });
    cover(-36, 33, 2.4, 2.4, 1.3, { crate: 1 });
  }
  const ROOFTOPS = {
    key: "rooftops",
    name: "옥상 도시",
    theme: "rooftops",
    size: 5,
    sky: hex("#8fc0ee"),
    fog: 0.0028,
    sunColor: hex("#fff0d0"),
    sunInt: 1.9,
    ambient: 0.95,
    bounds: RB,
    attackSpawn: { x: 0, z: 49 },
    defendSpawn: { x: 0, z: -49 },
    sites: [
      { id: "A", x: -30, z: -30, r: 7, label: "A" },
      { id: "B", x: 30, z: -30, r: 7, label: "B" },
    ],
    nodes: {
      attack: { x: 0, z: 49 }, defend: { x: 0, z: -49 },
      aSite: { x: -30, z: -30 }, aFront: { x: -30, z: -20 }, aBack: { x: -30, z: -40 },
      bSite: { x: 30, z: -30 }, bFront: { x: 30, z: -20 }, bBack: { x: 30, z: -40 },
      av1: { x: 0, z: -38 }, av2: { x: 0, z: -18 }, mid: { x: 0, z: 6 }, av3: { x: 0, z: 26 }, av4: { x: 0, z: 40 },
      cl: { x: -30, z: 0 }, cr: { x: 30, z: 0 },
      wl1: { x: -30, z: -8 }, wr1: { x: 30, z: -8 },
      wl2: { x: -30, z: 17 }, wr2: { x: 30, z: 17 },
      wl3: { x: -37, z: 30 }, wr3: { x: 37, z: 30 },
      fl: { x: -56, z: 0 }, fr: { x: 56, z: 0 },
      fl2: { x: -58, z: 30 }, fr2: { x: 58, z: 30 },
    },
    walls: R.W,
  };

  // ═══════════ materials and moods ═══════════
  // the night quay: wet dark concrete with painted lines
  const quay = tex((g, w, h) => {
    g.fillStyle = "#2a2f38";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const v = 30 + rnd() * 28;
      g.fillStyle = `rgba(${v},${v + 4},${v + 10},.55)`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    g.strokeStyle = "rgba(0,0,0,.45)";
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.strokeStyle = "rgba(255,200,90,.16)";
    g.setLineDash([22, 18]);
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();
  }, 256, 256, (HB.maxX - HB.minX + 12) / 10, (HB.maxZ - HB.minZ + 12) / 10);
  THEMES.nightport = {
    floor: M({ map: quay, roughness: 0.55, metalness: 0.15 }),
    wall: M({ color: 0x4b5260, roughness: 0.75, metalness: 0.2 }),
    strut: M({ color: 0x2a2e36, roughness: 0.5, metalness: 0.6 }),
    trim: M({ color: 0xffd27a, emissive: 0xffa640, emissiveIntensity: 1, roughness: 0.4 }),
    crate: M({ color: 0x7a5f3a, roughness: 0.85, metalness: 0.05 }),
    glow: 0xffc069,
  };
  MOODS.nightport = {
    top: "#03060f", mid: "#0b1630", hor: "#26385e", fog: hex("#0b1424"),
    hemiSky: hex("#5875b0"), hemiGnd: hex("#141a26"), hemi: 1.3, exp: 1.35, env: 0.8,
    sun: hex("#8fb0ff"), sunInt: 0.7, glow: "#a9c4ff",
    tint: [0.96, 0.995, 1.08], lift: [0, 0.004, 0.02], sat: 1.05, con: 1.1, vig: 0.42, bloom: 1.5,
  };
  const asphalt = tex((g, w, h) => {
    g.fillStyle = "#5c5f66";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 80 + rnd() * 40;
      g.fillStyle = `rgba(${v},${v},${v + 4},.5)`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    g.strokeStyle = "rgba(0,0,0,.3)";
    g.strokeRect(0, 0, w, h);
  }, 256, 256, (RB.maxX - RB.minX + 12) / 12, (RB.maxZ - RB.minZ + 12) / 12);
  THEMES.rooftops = {
    floor: M({ map: asphalt, roughness: 0.9, metalness: 0.02 }),
    wall: M({ color: 0xb9b2a6, roughness: 0.85, metalness: 0.02 }),
    strut: M({ color: 0x5c6470, roughness: 0.6, metalness: 0.4 }),
    trim: M({ color: 0xffd27a, emissive: 0xffa640, emissiveIntensity: 0.4, roughness: 0.5 }),
    crate: M({ color: 0x9a7448, roughness: 0.85, metalness: 0.05 }),
    glow: 0xffd9a0,
  };
  MOODS.rooftops = {
    top: "#3b78c4", mid: "#8fc0ee", hor: "#fbe8c8", fog: hex("#cfe0ee"),
    hemiSky: hex("#d6e8ff"), hemiGnd: hex("#7a7466"), hemi: 1.0, exp: 1.0, env: 1.0,
    sun: hex("#fff0d0"), sunInt: 1.9, glow: "#fff2d8",
    tint: [1.03, 1.0, 0.97], lift: [0.008, 0.004, 0], sat: 1.08, con: 1.06, vig: 0.26, bloom: 0.9,
  };
  // what each kind of wall is made of (set before the map merges its meshes)
  const BOXC = [0xb53a2c, 0x1f5f9e, 0x2f8a4e, 0xd9a022];
  const BLDC = [0xc9bfae, 0xa9b4bf, 0xcfa88a, 0x9fa89a];
  const STY = {
    nightport: {
      box: BOXC.map((c) => M({ color: c, roughness: 0.62, metalness: 0.35 })),
      bld: M({ color: 0x59606e, roughness: 0.8, metalness: 0.15 }),
      leg: M({ color: 0xd2a02a, roughness: 0.5, metalness: 0.55 }),
      boat: M({ color: 0xe8e4da, roughness: 0.45, metalness: 0.2 }),
      bollard: M({ color: 0x222831, roughness: 0.5, metalness: 0.6 }),
    },
    rooftops: {
      bld: BLDC.map((c) => M({ color: c, roughness: 0.85, metalness: 0.02 })),
      stair: M({ color: 0x8c877d, roughness: 0.9 }),
      para: M({ color: 0xa39c90, roughness: 0.9 }),
      vent: M({ color: 0x7b8591, roughness: 0.6, metalness: 0.5 }),
      car: [0xb83a3a, 0x3a5fb8, 0xd9d9d9, 0x2f3238].map((c) => M({ color: c, roughness: 0.35, metalness: 0.6 })),
      barrier: M({ color: 0xd8d4cc, roughness: 0.9 }),
      planter: M({ color: 0x5a7a46, roughness: 0.95 }),
    },
  };
  let carN = 0;
  function restyle(key, W) {
    const st = STY[key];
    for (const w of W) {
      const c = colFor(w);
      if (!c) continue;
      if (w.edge) {
        w.sea && (c.mesh.visible = !1);
        continue;
      }
      for (const f of Object.keys(st)) {
        if (!w[f]) continue;
        const m = st[f];
        c.mesh.material = Array.isArray(m) ? m["car" === f ? carN++ % m.length : (w.c || 0) % m.length] : m;
        break;
      }
    }
  }

  // ═══════════ state, registration, taking it down ═══════════
  const S = { key: null, meshes: [], lights: [], mats: [], tick: [], scroll: [] };
  window.NEW_MAPS = S;
  const keep = (o) => (S.meshes.push(o), "undefined" != typeof _mapMeshes && _mapMeshes.push(o), scene.add(o), o);
  const lamp = (l) => (S.lights.push(l), scene.add(l), l);
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
    for (const l of S.lights) {
      l.target && l.target.removeFromParent();
      l.removeFromParent();
      l.dispose && l.dispose();
    }
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose && m.dispose();
    for (const m of S.mats) m.dispose && m.dispose();
    S.key = S.flick = S.search = null;
    facMat = {};
    S.meshes = [];
    S.lights = [];
    S.mats = [];
    S.tick = [];
    S.scroll = [];
  }
  const reg = (data, at) => {
    MAPS[data.key] = data;
    (window.MAP_EXTRA = window.MAP_EXTRA || []).push({ key: data.key, name: data.name });
    if (window.POGU && POGU.pool) {
      POGU.pool.includes(data.key) || POGU.pool.splice(Math.min(POGU.pool.length, at), 0, data.key);
      POGU.setPool();
    } else MAP_LIST.some((m) => m.key === data.key) || MAP_LIST.push({ key: data.key, name: data.name });
  };
  reg(HARBOR, 10);
  reg(ROOFTOPS, 11);

  // a plane with windows drawn on it, uv scaled to the facade
  const winTex = {};
  let facMat = {};
  const facade = (kind, w, h) => {
    if (!winTex[kind])
      winTex[kind] = tex((g, W, Hh) => {
        if ("lit" === kind) {
          g.fillStyle = "#000";
          g.fillRect(0, 0, W, Hh);
          for (let i = 0; i < 2; i++) {
            g.fillStyle = rnd() < 0.7 ? "#ffd58a" : "#8fb0ff";
            g.fillRect(14 + i * 64, 34, 36, 44);
          }
        } else {
          g.clearRect(0, 0, W, Hh);
          for (let i = 0; i < 2; i++) {
            g.fillStyle = "rgba(40,60,86,.88)";
            g.fillRect(14 + i * 64, 26, 36, 56);
            g.fillStyle = "rgba(255,255,255,.28)";
            g.fillRect(14 + i * 64, 26, 36, 8);
            g.fillStyle = "rgba(0,0,0,.25)";
            g.fillRect(12 + i * 64, 82, 40, 4);
          }
        }
      }, 128, 128, 1, 1);
    const geo = new T.PlaneGeometry(w, h),
      uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w / 4)), uv.getY(i) * Math.max(1, Math.round(h / 3.2)));
    const mat = (facMat[kind] =
      facMat[kind] ||
      ("lit" === kind
        ? new T.MeshBasicMaterial({ map: winTex[kind], blending: T.AdditiveBlending, transparent: !0, depthWrite: !1, fog: !0 })
        : new T.MeshBasicMaterial({ map: winTex[kind], transparent: !0, depthWrite: !1, fog: !0 })));
    return new T.Mesh(geo, mat);
  };
  const sidesOf = (x, z, w, d, h, kind, skip) => {
    const out = new T.Group();
    const put = (nx, nz, ry, ww) => {
      const f = facade(kind, ww - 0.4, Math.max(1, h - 1.6));
      f.position.set(x + nx, 0.8 + Math.max(1, h - 1.6) / 2, z + nz);
      f.rotation.y = ry;
      f.userData.noCollide = !0;
      out.add(f);
    };
    "E" !== skip && put(w / 2 + 0.04, 0, Math.PI / 2, d);
    "W" !== skip && put(-w / 2 - 0.04, 0, -Math.PI / 2, d);
    "S" !== skip && put(0, d / 2 + 0.04, 0, w);
    "N" !== skip && put(0, -d / 2 - 0.04, Math.PI, w);
    out.userData.noCollide = !0;
    return out;
  };
  const flicker = (mat) => (dt, t) => {
    mat.emissiveIntensity = 0.3 + 1.1 * (Math.sin(t * 31) * Math.sin(t * 7.3) > 0.2 ? 1 : 0.15);
  };

  // ── the harbor's look ──
  function dressHarbor() {
    // sea
    const wave = tex((g, w, h) => {
      g.fillStyle = "#0a1c30";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(${120 + rnd() * 60},${160 + rnd() * 60},255,${0.06 + rnd() * 0.1})`;
        g.fillRect(rnd() * w, rnd() * h, 10 + rnd() * 30, 1.5);
      }
    }, 256, 256, 14, 12);
    const sea = new T.Mesh(new T.PlaneGeometry(130, 110), new T.MeshStandardMaterial({ map: wave, color: 0x9ab8e0, roughness: 0.12, metalness: 0.7 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(-46 - 65, -1.4, 0);
    sea.userData.noCollide = !0;
    keep(sea);
    S.scroll.push({ t: wave, ky: 0.012, kx: 0.006 });
    // quay edge: rail and bollards
    const rail = M({ color: 0x9aa4b2, roughness: 0.4, metalness: 0.7 });
    S.mats.push(rail);
    {
      const g = new T.Group();
      for (const y of [0.5, 1.0]) {
        const r = new T.Mesh(new T.BoxGeometry(0.08, 0.07, 80), rail);
        r.position.set(-45.2, y, 0);
        g.add(r);
      }
      for (let z = -40; z <= 40; z += 4) {
        const p = new T.Mesh(new T.BoxGeometry(0.1, 1.05, 0.1), rail);
        p.position.set(-45.2, 0.52, z);
        g.add(p);
      }
      g.userData.noCollide = !0;
      keep(g);
    }
    // the moored boat: a hull, a cabin, a mast with a red lamp
    {
      const g = new T.Group(),
        hull = new T.Mesh(new T.BoxGeometry(6, 1.3, 16), M({ color: 0x1d3a5c, roughness: 0.5, metalness: 0.3 })),
        cab = new T.Mesh(new T.BoxGeometry(3, 1.7, 5), M({ color: 0xe8e4da, roughness: 0.5 })),
        mast = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 6, 6), M({ color: 0x30343c })),
        lampM = M({ color: 0xff4a3a, emissive: 0xff2010, emissiveIntensity: 1.6 }),
        red = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), lampM);
      hull.position.set(0, -0.2, 0);
      cab.position.set(0, 1.25, 2.5);
      mast.position.set(0, 3.1, -1);
      red.position.set(0, 6.2, -1);
      g.add(hull, cab, mast, red);
      g.position.set(-43.6, 0.2, 8);
      g.userData.noCollide = !0;
      keep(g);
      S.mats.push(lampM);
      S.tick.push((dt, t) => {
        g.position.y = 0.2 + Math.sin(t * 1.3) * 0.05;
        g.rotation.z = Math.sin(t * 0.9) * 0.012;
        lampM.emissiveIntensity = 1 + 0.6 * Math.sin(t * 3);
      });
    }
    // a ship out on the water
    {
      const g = new T.Group(),
        hull = new T.Mesh(new T.BoxGeometry(14, 10, 70), M({ color: 0x141a24, roughness: 0.6, metalness: 0.3 })),
        stripe = new T.Mesh(new T.BoxGeometry(14.1, 1.2, 70.1), M({ color: 0x8c1f1f, roughness: 0.6 })),
        deck = new T.Mesh(new T.BoxGeometry(10, 8, 12), M({ color: 0xd9d6cc, roughness: 0.6 })),
        win = new T.Mesh(new T.BoxGeometry(10.1, 1.3, 11), new T.MeshBasicMaterial({ color: 0xffd58a }));
      hull.position.y = 3;
      stripe.position.y = 1.2;
      deck.position.set(0, 12, 22);
      win.position.set(0, 14, 22);
      g.add(hull, stripe, deck, win);
      for (let i = 0; i < 6; i++) {
        const c = new T.Mesh(new T.BoxGeometry(5, 3, 8), M({ color: BOXC[i % 4], roughness: 0.7 }));
        c.position.set(((i % 2) - 0.5) * 5.6, 9.5, -22 + Math.floor(i / 2) * 9);
        g.add(c);
      }
      g.position.set(-88, -1.4, -10);
      g.userData.noCollide = !0;
      keep(g);
    }
    // stars and a moon
    {
      const n = 420,
        pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2,
          e = 0.12 + rnd() * 1.2,
          r = 380;
        pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
        pos[i * 3 + 1] = Math.sin(e) * r;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      const stars = new T.Points(geo, new T.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: !1, fog: !1, transparent: !0, opacity: 0.8 }));
      stars.userData.noCollide = !0;
      keep(stars);
      const moon = new T.Mesh(new T.CircleGeometry(14, 32), new T.MeshBasicMaterial({ color: 0xe9f0ff, fog: !1 }));
      moon.position.set(120, 150, -300);
      moon.lookAt(0, 0, 0);
      moon.userData.noCollide = !0;
      keep(moon);
    }
    // lit windows on the warehouses and the office
    for (const w of H.W) {
      if (!w.lit) continue;
      const g = sidesOf(w.x, w.z, w.w, w.d, w.h, "lit", "");
      keep(g);
    }
    // street lamps: pole, arm, a bright head and a faint cone of light under it
    const poleM = M({ color: 0x20252d, roughness: 0.5, metalness: 0.6 }),
      headM = M({ color: 0xfff1c9, emissive: 0xffd58a, emissiveIntensity: 2.2 }),
      coneM = new T.MeshBasicMaterial({ color: 0xffd58a, transparent: !0, opacity: 0.022, blending: T.AdditiveBlending, depthWrite: !1, side: T.DoubleSide, fog: !1 });
    S.mats.push(poleM, headM, coneM);
    const LAMPS = [[-20, -24], [20, -24], [-38, -2], [38, -2], [-8, 4], [8, 12], [-38, 24], [38, 28], [0, 38], [-12, -20], [12, -20]];
    LAMPS.forEach(([x, z], i) => {
      const g = new T.Group(),
        pole = new T.Mesh(new T.CylinderGeometry(0.11, 0.16, 6.4, 8), poleM),
        head = new T.Mesh(new T.SphereGeometry(0.34, 10, 8), i === 9 ? (S.flick = M({ color: 0xfff1c9, emissive: 0xffd58a, emissiveIntensity: 1.6 })) : headM),
        cone = new T.Mesh((() => { const c = new T.ConeGeometry(2.4, 6, 14, 1, !0); c.translate(0, -3, 0); return c; })(), coneM);
      pole.position.y = 3.2;
      head.position.y = 6.5;
      cone.position.y = 6.5;
      g.add(pole, head, cone);
      g.position.set(x, 0, z);
      g.userData.noCollide = !0;
      keep(g);
    });
    S.flick && (S.mats.push(S.flick), S.tick.push(flicker(S.flick)));
    // a few real lights where the yard is brightest
    for (const [x, z, c, k] of [[-30, -14, 0xffc77a, 2.2], [28, -14, 0xffc77a, 2.2], [0, 6, 0xffd9a0, 1.8]]) {
      const l = new T.PointLight(c, k, 30, 1.6);
      l.position.set(x, 6.3, z);
      lamp(l);
    }
    // the gantry: a beam over the legs, a cab, a red beacon and a searchlight
    {
      const g = new T.Group(),
        yel = M({ color: 0xd2a02a, roughness: 0.5, metalness: 0.55 }),
        beam = new T.Mesh(new T.BoxGeometry(23, 1.3, 11), yel),
        cab = new T.Mesh(new T.BoxGeometry(3, 2.4, 3.4), M({ color: 0x2c3340, roughness: 0.5, metalness: 0.4 })),
        beaconM = M({ color: 0xff3a30, emissive: 0xff2010, emissiveIntensity: 1.6 }),
        beacon = new T.Mesh(new T.SphereGeometry(0.3, 8, 6), beaconM);
      beam.position.set(0, 10.6, 0);
      cab.position.set(6, 12.3, 0);
      beacon.position.set(-10, 11.6, 0);
      g.add(beam, cab, beacon);
      g.userData.noCollide = !0;
      keep(g);
      S.mats.push(yel, beaconM);
      S.tick.push((dt, t) => (beaconM.emissiveIntensity = Math.sin(t * 3.2) > 0 ? 2 : 0.15));
      const sp = new T.SpotLight(0xdbeaff, 5, 80, 0.2, 0.55, 1.1);
      sp.position.set(6, 12, 0);
      sp.target.position.set(0, 0, 8);
      scene.add(sp.target);
      lamp(sp);
      const cone = new T.Mesh(
        (() => { const c = new T.ConeGeometry(3.4, 1, 16, 1, !0); c.translate(0, -0.5, 0); c.rotateX(-Math.PI / 2); return c; })(),
        new T.MeshBasicMaterial({ color: 0xcfe2ff, transparent: !0, opacity: 0.02, blending: T.AdditiveBlending, depthWrite: !1, side: T.DoubleSide, fog: !1 }),
      );
      cone.userData.noCollide = !0;
      keep(cone);
      S.search = sp;
      S.tick.push((dt, t) => {
        const a = t * 0.45;
        sp.target.position.set(Math.cos(a) * 20, 0, 8 + Math.sin(a * 1.3) * 18);
        const d = sp.position.distanceTo(sp.target.position);
        cone.position.copy(sp.position);
        cone.lookAt(sp.target.position);
        cone.scale.set(1, 1, d);
      });
    }
  }

  // ── the city's look ──
  function dressCity() {
    // far skyline, ringed round the map
    const sk = [M({ color: 0x8aa0b8, roughness: 1 }), M({ color: 0x9db0c4, roughness: 1 }), M({ color: 0x7a8fa8, roughness: 1 })];
    S.mats.push(...sk);
    for (let i = 0; i < 38; i++) {
      const a = (i / 38) * Math.PI * 2,
        r = 130 + rnd() * 40,
        h = 18 + rnd() * 46,
        b = new T.Mesh(new T.BoxGeometry(10 + rnd() * 14, h, 10 + rnd() * 14), sk[i % 3]);
      b.position.set(Math.cos(a) * r * 1.15, h / 2 - 1, Math.sin(a) * r);
      b.userData.noCollide = !0;
      keep(b);
    }
    // windows on the near buildings (the stairs side is left bare)
    BLD.forEach(([x, z, w, d, h, side]) => keep(sidesOf(x, z, w, d, h, "day", side)));
    // lane markings on the avenue and cross street
    const paint = new T.MeshBasicMaterial({ color: 0xe9e3c8, transparent: !0, opacity: 0.55, depthWrite: !1 });
    S.mats.push(paint);
    for (let z = -52; z <= 52; z += 6) {
      const m = new T.Mesh(new T.PlaneGeometry(0.25, 3), paint);
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.03, z);
      m.userData.noCollide = !0;
      keep(m);
    }
    for (let x = -60; x <= 60; x += 6) {
      const m = new T.Mesh(new T.PlaneGeometry(3, 0.25), paint);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.03, 0);
      m.userData.noCollide = !0;
      keep(m);
    }
    // trees in the plazas
    const bark = M({ color: 0x5a4632, roughness: 0.9 }),
      leaf = M({ color: 0x4f7a3a, roughness: 0.9 });
    S.mats.push(bark, leaf);
    for (const [x, z] of [[-34, -23], [34, -23], [-26, -37], [26, -37], [-8, 30], [8, -30]]) {
      const g = new T.Group(),
        t = new T.Mesh(new T.CylinderGeometry(0.2, 0.3, 3, 6), bark),
        c = new T.Mesh(new T.SphereGeometry(1.9, 10, 8), leaf);
      t.position.y = 1.5;
      c.position.y = 4.1;
      g.add(t, c);
      g.position.set(x, 0, z);
      g.userData.noCollide = !0;
      keep(g);
    }
    // the zipline anchors are drawn by the gimmick module; here only a note on the roofs' water tanks
    const tank = M({ color: 0x8a6a4a, roughness: 0.8 });
    S.mats.push(tank);
    for (const [x, z, h] of [[-17, -14, 9], [46, -15, 9], [15, 18, 9], [-14, -44, 7.5]]) {
      const g = new T.Group(),
        c = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 2.4, 12), tank),
        r = new T.Mesh(new T.ConeGeometry(1.3, 0.8, 12), tank);
      c.position.y = h + 2.2;
      r.position.y = h + 3.8;
      g.add(c, r);
      g.position.set(x + 2, 0, z + 2);
      g.userData.noCollide = !0;
      keep(g);
    }
  }

  const BUILD = { nightport: dressHarbor, rooftops: dressCity };
  const DATAS = { nightport: HARBOR, rooftops: ROOFTOPS };
  function build(key) {
    clear();
    S.key = key;
    carN = 0;
    BUILD[key]();
  }
  S.build = build;
  S.clear = clear;
  S.dataOf = DATAS;
  // zip lines over the cross street of the city
  if (window.MAP_GIMMICKS && MAP_GIMMICKS.DEF) {
    MAP_GIMMICKS.DEF.rooftops = {
      zip: [
        { a: [-34, 0], b: [34, 0], h: 8.6 },
        { a: [-24, 30], b: [24, 30], h: 8.6 },
      ],
    };
  }

  // ── taking part in the frame ──
  const on = () => !!S.key && CUR_MAP_KEY === S.key;
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    if (!on()) return r;
    dt = dt || 0.016;
    const t = performance.now() / 1e3;
    for (const s of S.scroll) {
      s.t.offset.y = (s.t.offset.y + s.ky * dt) % 1;
      s.t.offset.x = (s.t.offset.x + s.kx * dt) % 1;
    }
    for (const f of S.tick) f(dt, t);
    return r;
  };
  const _ms = mergeStatic;
  mergeStatic = function () {
    try {
      "nightport" === CUR_MAP_KEY && restyle("nightport", H.W);
      "rooftops" === CUR_MAP_KEY && restyle("rooftops", R.W);
    } catch (e) {}
    return _ms.apply(this, arguments);
  };
  const _lm = loadMap;
  loadMap = function (key) {
    const r = _lm.apply(this, arguments);
    try {
      BUILD[key] ? build(key) : clear();
    } catch (e) {
      console.warn("new maps", e);
    }
    return r;
  };
  try {
    BUILD[CUR_MAP_KEY] && build(CUR_MAP_KEY);
  } catch (e) {}
})();
