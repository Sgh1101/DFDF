(() => {
  // Two-storey buildings and watchtowers on every map except the open field and the three duels. Each building is
  // a real house: walls with doors and windows, a floor you walk under, a stair inside up to the upper floor, upper
  // windows to shoot from, a roof. Each map has two or three of them and a watchtower: a deck 3.4 m up reached by an
  // outside stair, with a low wall round it. They were placed offline against the colliders the game really builds
  // (clear ground, off every spawn, site and waypoint, no lane cut off), so a map keeps the same ways through it.
  // The pieces are plain boxes merged into four meshes a map (wall, trim, floor, stair), pushed into COLLIDERS with a
  // bottom (y0) for floors you walk under, like the 포구 map's upper floors.
  if ("undefined" == typeof MAPS || "undefined" == typeof loadMap || "undefined" == typeof COLLIDERS || "undefined" == typeof T) return;
  // map → { b: [[x, z, long side, short side, 0 | 1 (1 = long side runs along z), 1 = mirrored across]], t: [[x, z, rot]], c: [[x0, x1, z0, z1]] (what stood there is cleared) }
  const PLAN = {"pogu":{"b":[[-2,-32,11,9,1],[49,10,11,9,0],[-47,34,11,9,0]],"t":[[6,42,0]]},"garden":{"b":[[79,-22,14,11,0],[-86,-31,14,11,1],[-32,-85,14,11,1]],"t":[[24,-8,0]]},"market":{"b":[[42,-33,14,11,0],[-42,-33,14,11,0],[-12,24,14,11,0]],"t":[[-1,-46,1]]},"glacier":{"b":[[24,-51,14,11,1],[75,-3,14,11,0],[-36,-27,14,11,1]],"t":[[-79,-1,0]]},"neon":{"b":[[-120,-15,14,11,1],[9,-108,14,11,1],[105,-66,14,11,1]],"t":[[35,-28,0]]},"dunes":{"b":[[-21,-85,14,11,0],[-54,-1,14,11,0],[54,-13,14,11,1]],"t":[[-55,73,1]]},"jungle":{"b":[[-52,-14,14,11,0],[20,-71,14,11,1],[-16,70,14,11,0]],"t":[[64,-9,1]]},"shift":{"b":[[-21,-1,11,9,0],[-3,32,9,7.5,0]],"t":[[2,-17,1]]},"train":{"b":[[-8,-58,9.6,5.8,0,0],[8,58,9.6,5.8,0,1]],"t":[],"c":[[-14,-2,-61,-55],[2,14,55,61]]},"nightport":{"b":[[-19,8,11,9,1],[17,8,9,7.5,1]],"t":[[-14,-17,1]]},"rooftops":{"b":[[16,1,12,9.5,0],[-14,31,11,9,0],[-53,-32,11,9,1]],"t":[[15,-30,0]]},"s02":{"b":[[42,-24,11,9,0],[33,6,9,7.5,0]],"t":[[-10,-7,0]]},"s03":{"b":[[19,46,11,9,1],[-35,37,9.5,8,0]],"t":[[12,-21,1]]},"s04":{"b":[[-6,-11,11,9,1],[18,49,11,9,1]],"t":[[-10,-33,1]]},"s05":{"b":[[-10,3,11,9,1],[50,30,9.5,8,1]],"t":[[52,-16,1]]},"s06":{"b":[[1,-16,9,7.5,0],[46,17,9.5,8,0]],"t":[[-21,10,0]]}};
  const H1 = 3.2, // the ground floor's inner height
    FL = 0.3, // the floor slab
    H2 = 3.2, // the upper floor's inner height
    TW = 0.5, // wall thickness
    DOOR = 2.6,
    STEP = 0.5,
    TREAD = 0.8;
  const F2 = H1 + FL, // top of the upper floor
    RF = F2 + H2; // the roof's underside
  const r2 = (v) => Math.round(v * 100) / 100;

  // ── what a building is made of: boxes in its own frame (u along the long side, v across, y up) ──
  function house(L, S) {
    const B = []; // [u0, u1, v0, v1, y0, y1, kind]
    const box = (u0, u1, v0, v1, y0, y1, kind) => u1 - u0 > 0.01 && v1 - v0 > 0.01 && y1 - y0 > 0.01 && B.push([u0, u1, v0, v1, y0, y1, kind]);
    // a wall run along u at v0..v1 with openings: [centre, width, sill, head] (sill 0 = a doorway)
    const alongU = (v0, v1, y0, y1, holes, kind) => {
      let cur = 0;
      for (const [c, w, sill, head] of holes.slice().sort((a, b) => a[0] - b[0])) {
        const a = c - w / 2,
          z = c + w / 2;
        box(cur, a, v0, v1, y0, y1, kind);
        sill > y0 && box(a, z, v0, v1, y0, sill, kind);
        head < y1 && box(a, z, v0, v1, head, y1, "trim");
        cur = z;
      }
      box(cur, L, v0, v1, y0, y1, kind);
    };
    const alongV = (u0, u1, y0, y1, holes, kind) => {
      let cur = 0;
      for (const [c, w, sill, head] of holes.slice().sort((a, b) => a[0] - b[0])) {
        const a = c - w / 2,
          z = c + w / 2;
        box(u0, u1, cur, a, y0, y1, kind);
        sill > y0 && box(u0, u1, a, z, y0, sill, kind);
        head < y1 && box(u0, u1, a, z, head, y1, "trim");
        cur = z;
      }
      box(u0, u1, cur, S, y0, y1, kind);
    };
    // the ground floor: far long wall (v = S) with two doors, the stair-side wall (v = 0) with windows, short walls with a door and a window
    alongU(S - TW, S, 0, H1, [[3.6, DOOR, 0, 2.5], [L - 3.6, DOOR, 0, 2.5]], "wall");
    alongU(0, TW, 0, H1, [[L * 0.62, 1.6, 1.0, 2.3], [L - 2.2, 1.6, 1.0, 2.3]], "wall");
    alongV(0, TW, 0, H1, [[S * 0.5, DOOR, 0, 2.5]], "wall");
    alongV(L - TW, L, 0, H1, [[S * 0.5, 1.6, 1.0, 2.3]], "wall");
    // the floor above, with the stair's well left open
    const sU0 = 1.9, // room to walk up to its foot
      sU1 = sU0 + 7 * TREAD, // the stair runs along the stair-side wall
      sV0 = TW + 0.1,
      sV1 = sV0 + 2.2;
    box(0, L, 0, TW, H1, F2, "slab");
    box(0, L, sV1 + 0.2, S, H1, F2, "slab");
    // (the floor over the foot of the stair stops a body-width short, so a walker climbing never meets its edge)
    box(0, sU0 - 1.0, TW, sV1 + 0.2, H1, F2, "slab");
    box(sU1 + 0.1, L, TW, sV1 + 0.2, H1, F2, "slab");
    // the stair: seven steps of half a metre, the last level with the floor
    for (let i = 0; i < 7; i++) box(sU0 + i * TREAD, sU0 + (i + 1) * TREAD + (i === 6 ? 0.2 : 0), sV0, sV1, 0, STEP * (i + 1), "stair");
    // the upper walls: windows to shoot from, a pillar between each
    const TU = 0.4;
    alongU(S - TU, S, F2, RF, [[L * 0.22, 1.7, F2 + 1.0, F2 + 2.2], [L * 0.5, 1.7, F2 + 1.0, F2 + 2.2], [L * 0.78, 1.7, F2 + 1.0, F2 + 2.2]], "wall");
    alongU(0, TU, F2, RF, [[L * 0.22, 1.7, F2 + 1.0, F2 + 2.2], [L * 0.5, 1.7, F2 + 1.0, F2 + 2.2], [L * 0.78, 1.7, F2 + 1.0, F2 + 2.2]], "wall");
    alongV(0, TU, F2, RF, [[S * 0.5, 1.7, F2 + 1.0, F2 + 2.2]], "wall");
    alongV(L - TU, L, F2, RF, [[S * 0.5, 1.7, F2 + 1.0, F2 + 2.2]], "wall");
    // the roof, with a rim; a trim band where floors meet the walls
    box(0, L, 0, S, RF, RF + FL, "slab");
    box(0, L, 0, 0.3, RF + FL, RF + FL + 0.6, "trim");
    box(0, L, S - 0.3, S, RF + FL, RF + FL + 0.6, "trim");
    box(0, 0.3, 0.3, S - 0.3, RF + FL, RF + FL + 0.6, "trim");
    box(L - 0.3, L, 0.3, S - 0.3, RF + FL, RF + FL + 0.6, "trim");
    // a roof unit and a ceiling lamp, so it is not a blank box
    box(L * 0.55, L * 0.55 + 2.2, S * 0.3, S * 0.3 + 1.6, RF + FL + 0.6, RF + FL + 1.6, "trim");
    box(L * 0.5 - 0.5, L * 0.5 + 0.5, S * 0.5 - 0.3, S * 0.5 + 0.3, H1 - 0.15, H1, "lamp");
    box(L * 0.5 - 0.5, L * 0.5 + 0.5, S * 0.5 - 0.3, S * 0.5 + 0.3, RF - 0.15, RF, "lamp");
    return B;
  }
  // a watchtower: u along the stair then the deck, v across. Deck 3.4 m up on four posts, a stair of six steps
  function tower() {
    const B = [],
      box = (u0, u1, v0, v1, y0, y1, kind) => B.push([u0, u1, v0, v1, y0, y1, kind]);
    const DK = 3.4,
      n = 6,
      tread = 0.8;
    for (let i = 0; i < n; i++) box(0.1 + i * tread, 0.1 + (i + 1) * tread + (i === n - 1 ? 0.1 : 0), 1.2, 3.2, 0, (DK / n) * (i + 1), "stair");
    const u0 = 5.0;
    box(u0, 9.4, 0, 4.4, DK - FL, DK, "slab");
    for (const [u, v] of [[u0 + 0.1, 0.1], [9.4 - 0.6, 0.1], [u0 + 0.1, 3.8], [9.4 - 0.6, 3.8]]) box(u, u + 0.5, v, v + 0.5, 0, DK - FL, "trim");
    // a low wall round the deck, open where the stair arrives
    box(u0, 9.4, 0, 0.25, DK, DK + 1.1, "wall");
    box(u0, 9.4, 4.15, 4.4, DK, DK + 1.1, "wall");
    box(9.15, 9.4, 0.25, 4.15, DK, DK + 1.1, "wall");
    // a roof on two posts so it reads as a lookout
    box(u0 + 1.2, 9.4 - 0.2, 0.3, 4.1, DK + 3.0, DK + 3.25, "slab");
    box(9.0, 9.2, 0.3, 0.5, DK + 1.1, DK + 3.0, "trim");
    box(9.0, 9.2, 3.9, 4.1, DK + 1.1, DK + 3.0, "trim");
    box(u0 + 1.2, u0 + 1.4, 0.3, 0.5, DK + 1.1, DK + 3.0, "trim");
    box(u0 + 1.2, u0 + 1.4, 3.9, 4.1, DK + 1.1, DK + 3.0, "trim");
    box(u0 + 1.8, 9.0, 1.4, 3.0, DK + 2.8, DK + 3.0, "lamp");
    return B;
  }

  // a box in the building's frame → a world box [x0, x1, y0, y1, z0, z1]
  function toWorld(b, cx, cz, L, S, rot, flip) {
    let [u0, u1, v0, v1, y0, y1] = b;
    flip && ([v0, v1] = [S - v1, S - v0]);
    return rot ? [cx - S / 2 + v0, cx - S / 2 + v1, y0, y1, cz - L / 2 + u0, cz - L / 2 + u1] : [cx - L / 2 + u0, cx - L / 2 + u1, y0, y1, cz - S / 2 + v0, cz - S / 2 + v1];
  }

  // ── merging boxes into one mesh: world-metre uvs, no hidden bottom faces on the ground ──
  function merged(list) {
    const P = [],
      N = [],
      U = [],
      I = [];
    const quad = (v, n, uv) => {
      const k = P.length / 3;
      v.forEach((p) => P.push(...p));
      for (let i = 0; i < 4; i++) N.push(...n);
      uv.forEach((q) => U.push(q[0] / 3, q[1] / 3));
      I.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    for (const [x0, x1, y0, y1, z0, z1] of list) {
      quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[x1, y0], [x0, y0], [x0, y1], [x1, y1]]);
      quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[z1, y0], [z0, y0], [z0, y1], [z1, y1]]);
      quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]]);
      quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]);
      y0 > 0 && quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(N, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    g.computeBoundingSphere();
    return g;
  }
  let LAMP = null;
  const lampMat = () => LAMP || (LAMP = new T.MeshBasicMaterial({ color: 0xfff1c8 }));
  const matOf = (kind) => {
    const th = TH();
    return "wall" === kind ? th.wall : "trim" === kind ? th.strut || th.wall : "slab" === kind ? th.trim || th.wall : "stair" === kind ? th.crate || th.wall : lampMat();
  };

  const FRAMES = new Map(); // key → boxes in the frame, built once per size
  const frameOf = (kind, L, S) => {
    const id = kind + L + "x" + S;
    return FRAMES.get(id) || (FRAMES.set(id, "tower" === kind ? tower() : house(L, S)), FRAMES.get(id));
  };
  const BUILT = { key: null, count: 0, boxes: 0 };

  function build(key) {
    const plan = PLAN[key],
      m = MAPS[key];
    if (!plan || !m) return 0;
    const byKind = {},
      cols = [],
      pseudo = [];
    const place = (kind, cx, cz, L, S, rot, flip) => {
      for (const b of frameOf(kind, L, S)) {
        const w = toWorld(b, cx, cz, L, S, rot, flip);
        (byKind[b[6]] || (byKind[b[6]] = [])).push(w);
        if ("lamp" === b[6]) continue;
        cols.push({ minX: r2(w[0]), maxX: r2(w[1]), minZ: r2(w[4]), maxZ: r2(w[5]), y0: w[2] > 0.05 ? r2(w[2]) : 0, h: r2(w[3]), kind: b[6] });
      }
      // the whole house as one wall for what looks for a building (the cheat code's hunt, cover)
      pseudo.push({ x: cx, z: cz, w: rot ? S : L, d: rot ? L : S, h: "tower" === kind ? 3.4 : RF + FL, two: 1, floors: "tower" === kind ? 1 : 2 });
    };
    for (const [x, z, L, S, rot, flip] of plan.b) place("house", x, z, L, S, rot, flip);
    for (const [x, z, rot] of plan.t) place("tower", x, z, 9.4, 4.4, rot);
    const meshes = {};
    for (const k in byKind) {
      const mesh = new T.Mesh(merged(byKind[k]), matOf(k));
      mesh.castShadow = "wall" === k || "slab" === k;
      mesh.receiveShadow = "lamp" !== k;
      mesh.userData.noCollide = !0;
      scene.add(mesh);
      "function" == typeof _mapMeshes.push && _mapMeshes.push(mesh);
      meshes[k] = mesh;
    }
    for (const c of cols) COLLIDERS.push(Object.assign(c, { mesh: meshes[c.kind], hp: 1 / 0, destructible: !1, temp: !1 }));
    m.walls.push(...pseudo);
    CHASH.dirty = !0;
    chashBuild();
    try {
      relocateBlockedNodes(m);
      buildGrid();
      "function" == typeof rebuildNavGrid && rebuildNavGrid();
    } catch (e) {
      console.warn("buildings grid", e);
    }
    BUILT.key = key;
    BUILT.count = plan.b.length + plan.t.length;
    BUILT.boxes = cols.length;
    return plan.b.length + plan.t.length;
  }
  // the map's dressing is scattered at random on every load (trees, crates, planks): what lies on a building's ground is taken
  // away before the dressing is merged, with its colliders, so a house never stands in a wooden deck or a hedge
  const rectsOf = (key, pad) => {
    const plan = PLAN[key];
    return plan ? plan.b.map(([x, z, L, S, rot]) => [x - (rot ? S : L) / 2 - pad, x + (rot ? S : L) / 2 + pad, z - (rot ? L : S) / 2 - pad, z + (rot ? L : S) / 2 + pad]).concat(plan.t.map(([x, z, rot]) => [x - (rot ? 4.4 : 9.4) / 2 - pad, x + (rot ? 4.4 : 9.4) / 2 + pad, z - (rot ? 9.4 : 4.4) / 2 - pad, z + (rot ? 9.4 : 4.4) / 2 + pad])) : [];
  };
  const inAny = (rs, x0, x1, z0, z1) => rs.some((r) => x1 > r[0] && x0 < r[1] && z1 > r[2] && z0 < r[3]);
  const cullDecor = (key) => {
    const rs = rectsOf(key, 1.6);
    if (!rs.length || "undefined" == typeof DECOR) return 0;
    DECOR.updateMatrixWorld(!0);
    const box = new T.Box3(),
      gone = [];
    DECOR.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      box.setFromObject(o);
      if (box.isEmpty() || box.min.y > 6) return;
      // a ground-level thing whose own footprint touches a building's ground (huge ground sheets are left alone)
      if (box.max.x - box.min.x > 40 || box.max.z - box.min.z > 40) return;
      inAny(rs, box.min.x, box.max.x, box.min.z, box.max.z) && gone.push(o);
    });
    for (const o of gone) {
      o.parent && o.parent.remove(o);
      o.geometry.dispose();
    }
    let n = gone.length;
    for (let i = COLLIDERS.length - 1; i >= 0; i--) {
      const c = COLLIDERS[i];
      if (c.decor && inAny(rs, c.minX, c.maxX, c.minZ, c.maxZ)) {
        COLLIDERS.splice(i, 1);
        n++;
      }
    }
    CHASH.dirty = !0;
    return n;
  };
  if ("function" == typeof mergeDecor) {
    const _md = mergeDecor;
    mergeDecor = function () {
      try {
        PLAN[CUR_MAP_KEY] && (BUILT.culled = cullDecor(CUR_MAP_KEY));
      } catch (e) {
        console.warn("buildings cull", e);
      }
      return _md.apply(this, arguments);
    };
  }
  const _lm = loadMap;
  loadMap = function (key) {
    // the pseudo-walls of the last build must not be built again as plain boxes; low cover that stands where a house goes is cleared
    for (const k in PLAN) {
      if (!MAPS[k] || !Array.isArray(MAPS[k].walls)) continue;
      const rs = rectsOf(k, 0.4),
        cl = PLAN[k].c || [];
      MAPS[k].walls = MAPS[k].walls.filter((w) => !w.two && !cl.some((r) => w.x > r[0] && w.x < r[1] && w.z > r[2] && w.z < r[3]) && !(w.h < 1.6 && !w.window && !w.deck && !w.stair && !w.parapet && inAny(rs, w.x - w.w / 2, w.x + w.w / 2, w.z - w.d / 2, w.z + w.d / 2)));
    }
    const r = _lm.apply(this, arguments);
    if (r !== !1 && PLAN[key])
      try {
        build(key);
      } catch (e) {
        console.warn("buildings", e);
      }
    return r;
  };
  // the map on screen was built before this ran
  try {
    "undefined" != typeof world && "menu" === world.phase && CUR_MAP_KEY && PLAN[CUR_MAP_KEY] && loadMap(CUR_MAP_KEY);
  } catch (e) {}
  window.BUILDINGS = { plan: PLAN, build, built: BUILT, H1, F2, RF, house, tower, toWorld };
})();
