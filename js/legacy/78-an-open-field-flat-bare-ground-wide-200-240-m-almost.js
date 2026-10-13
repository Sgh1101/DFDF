
(() => {
  // 마른 들판 — an open field: flat bare ground, wide (200 × 240 m), almost
  // nothing on it. Low cover only (hay bales, field stones, old stone fences
  // you crouch behind), a ruined hut in the middle, a lone tree and two big
  // haystacks on the side lanes; two sites
  // with a little cover each. Long sight lines, a map for rifles and nerve.
  if ("undefined" == typeof MAPS || "undefined" == typeof MAP_LIST || "undefined" == typeof THEMES || "undefined" == typeof MOODS || MAPS.field) return;

  // ── the look: dirt instead of sand, earthen walls, a clear sky ──
  const D = THEMES.dunes;
  const tint = (m, hex) => {
    const c = m.clone();
    c.color = new T.Color(hex);
    return c;
  };
  THEMES.field = Object.assign({}, D, { floor: tint(D.floor, 0xa07a55), wall: tint(D.wall, 0xa08c70), crate: tint(D.crate, 0xc9a44a), strut: tint(D.strut, 0x6d5338), trim: tint(D.trim, 0xbfa067) });
  MOODS.field = Object.assign({}, MOODS.dunes, { top: "#3f7fc4", mid: "#a8c8e2", hor: "#eadcbc", fog: 0xd9ccb0, exp: 0.95, env: 0.85, tint: [1.03, 1, 0.95], sat: 1.05 });
  try {
    window.REALMAT && REALMAT.themes && (REALMAT.themes.field = { floor: ["sand", 5], wall: "stoneblock", crate: "planks", env: "park", sat: 0.65 });
  } catch (e) {}

  // ── the ground plan ──
  const W = [];
  const box = (x, z, w, d, h, f) => W.push(Object.assign({ x, z, w, d, h }, f || {}));
  const cover = (x, z, w, d, h, f) => box(x, z, w, d, h, Object.assign({ cover: !0 }, f || {}));
  const both = (fn, x, ...r) => (fn(x, ...r), fn(-x, ...r));
  // the field's edge: an earthen bank
  box(0, -121.5, 206, 3, 4.5);
  box(0, 121.5, 206, 3, 4.5);
  box(-101.5, 0, 3, 240, 4.5);
  box(101.5, 0, 3, 240, 4.5);
  // the attackers' half: hay and stones to move between
  both(cover, 30, 82, 2.4, 2, 1.3, { crate: 1 });
  both(cover, 12, 66, 2.4, 2, 1.3, { crate: 1 });
  both(cover, 56, 60, 2.4, 2, 1.3, { crate: 1 });
  both(cover, 40, 40, 12, 0.7, 1.1);
  both(cover, 72, 22, 3, 3, 1.6);
  both(cover, 20, 30, 2.6, 2.4, 1.4);
  both(cover, 86, 66, 3, 2.6, 1.5);
  // the middle: a ruined hut (two doorways), a lone tree, stones
  box(0, -3.2, 7, 0.6, 3.4);
  box(-2.4, 3.2, 2.2, 0.6, 3.4);
  box(2.4, 3.2, 2.2, 0.6, 3.4);
  box(-3.2, 0, 0.6, 7, 2.6);
  box(3.2, -1.6, 0.6, 3.8, 2.6);
  box(22, 14, 1, 1, 7.5, { pillar: 1 });
  both(cover, 36, 0, 3, 2.6, 1.5);
  both(cover, 76, -12, 3, 3, 1.6);
  both(cover, 18, -22, 10, 0.7, 1.1);
  both(cover, 58, 8, 2.4, 2, 1.3, { crate: 1 });
  // two big haystacks on the side lanes, the only standing cover out there
  both(cover, 62, 30, 3.4, 3.4, 2.7, { crate: 1 });
  // the defenders' half and the two sites
  both(cover, 50, -40, 10, 0.7, 1.2);
  cover(-46, -60, 2.4, 2, 1.3, { crate: 1 });
  cover(-55, -66, 2.4, 2, 1.3, { crate: 1 });
  cover(-52, -55, 3, 1.6, 1.6);
  cover(-42, -70, 6, 0.7, 1.2);
  cover(46, -56, 2.4, 2, 1.3, { crate: 1 });
  cover(55, -62, 2.4, 2, 1.3, { crate: 1 });
  cover(50, -51, 3, 1.6, 1.6);
  cover(42, -66, 6, 0.7, 1.2);
  both(cover, 20, -62, 2.6, 2.4, 1.4);
  both(cover, 25, -90, 2.4, 2, 1.3, { crate: 1 });
  cover(0, -80, 3, 2, 1.4, { crate: 1 });
  both(cover, 82, -78, 3, 3, 1.6);

  const DATA = {
    key: "field",
    name: "마른 들판",
    theme: "field",
    size: 5,
    _plus: 1,
    sky: 0x9cc6e6,
    fog: 0.0029,
    sunColor: 0xfff0cf,
    sunInt: 1.4,
    ambient: 0.8,
    bounds: { minX: -100, maxX: 100, minZ: -120, maxZ: 120 },
    attackSpawn: { x: 0, z: 108 },
    defendSpawn: { x: 0, z: -108 },
    sites: [
      { id: "A", x: -50, z: -62, r: 13, label: "A 짚더미" },
      { id: "B", x: 50, z: -58, r: 13, label: "B 돌담" },
    ],
    nodes: {
      attack: { x: 0, z: 108 }, defend: { x: 0, z: -108 },
      laneL: { x: -70, z: 20 }, laneR: { x: 70, z: 20 }, midL: { x: -20, z: 10 }, midR: { x: 20, z: 10 }, mid: { x: 0, z: 12 }, rotate: { x: 0, z: -86 },
      aSite: { x: -50, z: -62 }, aFront: { x: -55, z: -36 }, aBack: { x: -50, z: -86 }, aLink: { x: -24, z: -40 },
      bSite: { x: 50, z: -58 }, bFront: { x: 55, z: -34 }, bBack: { x: 50, z: -84 }, bLink: { x: 24, z: -40 },
    },
    walls: W,
  };
  MAPS.field = DATA;
  // into the map pool, second after 포구 (the pool lives with 포구)
  (window.MAP_EXTRA = window.MAP_EXTRA || []).push({ key: "field", name: DATA.name });
  if (window.POGU && POGU.pool) {
    POGU.pool.includes("field") || POGU.pool.splice(1, 0, "field");
    POGU.setPool();
  } else MAP_LIST.some((m) => "field" === m.key) || MAP_LIST.push({ key: "field", name: DATA.name });

  // ── what is not in the way: dry grass, pebbles, hills beyond the bank ──
  function decor() {
    const keep = (o) => (("undefined" != typeof _mapMeshes && _mapMeshes.push(o)), scene.add(o), o);
    const rnd = (() => {
      let s = 20261010;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    })();
    const B = DATA.bounds,
      busy = (x, z) => W.some((w) => Math.abs(x - w.x) < w.w / 2 + 1.2 && Math.abs(z - w.z) < w.d / 2 + 1.2);
    const dummy = new T.Object3D();
    // dry grass: tufts of thin blades leaning out, instanced
    {
      const P = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3 * Math.sin(i * 7.1),
          lean = 0.12 + 0.1 * ((i * 37) % 5) / 5,
          h = 0.32 + 0.22 * ((i * 53) % 7) / 7,
          ca = Math.cos(a),
          sa = Math.sin(a),
          w = 0.025;
        // one blade: a thin triangle from the ground, leaning outward
        P.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * lean, h, sa * lean);
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
      g.computeVertexNormals();
      const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: T.DoubleSide });
      const n = 1400,
        im = new T.InstancedMesh(g, m, n),
        col = new T.Color();
      let k = 0;
      for (let i = 0; i < n * 3 && k < n; i++) {
        // clumps: most tufts near a few hundred seeds
        const x = B.minX + 2 + rnd() * (B.maxX - B.minX - 4),
          z = B.minZ + 2 + rnd() * (B.maxZ - B.minZ - 4);
        if (busy(x, z)) continue;
        const c = 1 + Math.floor(rnd() * 3);
        for (let j = 0; j < c && k < n; j++) {
          dummy.position.set(x + (rnd() - 0.5) * 0.9, 0, z + (rnd() - 0.5) * 0.9);
          dummy.rotation.set(0, rnd() * 6.28, 0);
          const s = 0.7 + rnd() * 0.9;
          dummy.scale.set(s, s * (0.8 + rnd() * 0.6), s);
          dummy.updateMatrix();
          im.setMatrixAt(k, dummy.matrix);
          im.setColorAt(k, col.setHSL(0.11 + rnd() * 0.05, 0.3 + rnd() * 0.2, 0.5 + rnd() * 0.15));
          k++;
        }
      }
      im.count = k;
      im.instanceMatrix.needsUpdate = !0;
      im.instanceColor && (im.instanceColor.needsUpdate = !0);
      keep(im);
    }
    // pebbles
    {
      const g = new T.DodecahedronGeometry(0.18, 0),
        m = new T.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.95 }),
        n = 420,
        im = new T.InstancedMesh(g, m, n);
      for (let i = 0; i < n; i++) {
        dummy.position.set(B.minX + rnd() * (B.maxX - B.minX), 0.04, B.minZ + rnd() * (B.maxZ - B.minZ));
        dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        const s = 0.5 + rnd() * 1.6;
        dummy.scale.set(s, s * 0.55, s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = !0;
      keep(im);
    }
    // the tree's crown over its trunk
    {
      const t = W.find((w) => w.pillar),
        m = new T.MeshStandardMaterial({ color: 0x6f7a3a, roughness: 1, flatShading: !0 });
      [[0, 7.6, 0, 3.2], [1.6, 7.0, 0.8, 2.3], [-1.4, 7.2, -0.6, 2.4], [0.3, 8.8, -0.4, 2.0]].forEach(([dx, y, dz, r]) => {
        const s = new T.Mesh(new T.IcosahedronGeometry(r, 1), m);
        s.position.set(t.x + dx, y, t.z + dz);
        s.castShadow = !0;
        keep(s);
      });
    }
    // low hills past the bank, so the edge is land and not a wall in the void
    {
      const m = new T.MeshStandardMaterial({ color: 0x8f7a5a, roughness: 1, flatShading: !0 });
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2,
          rx = 185 + rnd() * 40,
          rz = 215 + rnd() * 40,
          h = new T.Mesh(new T.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m);
        h.position.set(Math.cos(a) * rx, -1, Math.sin(a) * rz);
        h.scale.set(40 + rnd() * 30, 10 + rnd() * 16, 40 + rnd() * 30);
        keep(h);
      }
    }
  }
  const _lm = loadMap;
  loadMap = function (key) {
    const r = _lm.apply(this, arguments);
    if (r !== !1 && "field" === key)
      try {
        decor();
      } catch (e) {
        console.warn("field", e);
      }
    return r;
  };
  // what's new on the title screen
  try {
    const ul = document.querySelector(".tt-news ul");
    if (ul) {
      const li = document.createElement("li");
      li.innerHTML = "en" === window.GAME_LANG ? "<b>New map: 마른 들판</b><span>An open field: flat bare ground, 200 × 240 m, low cover only</span>" : "<b>새 맵 · 마른 들판</b><span>탁 트인 맨땅 들판(200×240m). 낮은 엄폐물뿐인 넓은 맵</span>";
      ul.prepend(li);
      while (ul.children.length > 3) ul.lastElementChild.remove();
    }
  } catch (e) {}
  // the counts on the title screen were written before the last agents and maps
  try {
    const nA = AGENTS.length,
      nM = MAP_LIST.length;
    const KO = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"],
      TEN = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];
    const korN = (n) => (n < 10 ? KO[n] : TEN[Math.floor(n / 10)] + (n % 10 ? KO[n % 10] : ""));
    const NUMW = new RegExp("(" + TEN.slice(1).join("|") + ")(" + KO.slice(1).join("|") + ")?", "g");
    const swap = (sel, f) => document.querySelectorAll(sel).forEach((e) => (e.innerHTML = f(e.innerHTML)));
    swap(".title-desc", (h) => h.replace(new RegExp(NUMW.source + " 요원"), korN(nA) + " 요원"));
    swap("#go-play small", (h) => h.replace(/맵 \d+종/, `맵 ${nM}종`).replace(/maps? \d+|\d+ maps/, `${nM} maps`));
    swap(".title-foot", (h) => h.replace(/요원 \d+명/, `요원 ${nA}명`).replace(/맵 \d+종/, `맵 ${nM}종`).replace(/\d+ agents/, `${nA} agents`).replace(/\d+ maps/, `${nM} maps`));
  } catch (e) {}
  window.FIELD = { data: DATA };
})();
