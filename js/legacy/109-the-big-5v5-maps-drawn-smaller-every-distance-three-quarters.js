// The big 5v5 maps, smaller. On glacier, neon, dunes, garden, market and jungle every distance across the
// ground is three quarters of what it was (heights stay), so a walk from spawn to a site, a rotation and a
// long sightline are a quarter shorter. The layout keeps its shape: walls, platforms, stairs, crates, nodes,
// sites, spawns and the bounds all shrink by the same factor, so a door or a lane stays in proportion. The
// pieces later modules put on these maps follow: the platforms added in 51 live in the map's walls, the
// switch doors and teleporters of 06 and the houses and towers of 99 are moved with the same factor (a house
// keeps its size, only its place moves), and the hand-placed structures and props of the themes are built
// with their coordinates scaled. The detail of 07 is worked out from the walls, so it follows by itself.
// window.MAP_SHRINK (set before the game loads) changes the factor; 1 turns this off.
(() => {
  if ("undefined" == typeof MAPS || "function" != typeof loadMap || "function" != typeof addBox) return;
  const K = Math.min(1, Math.max(0.5, +(window.MAP_SHRINK || 0.75)));
  if (K >= 1) return;
  const KEYS = ["glacier", "neon", "dunes", "garden", "market", "jungle"].filter((k) => MAPS[k] && Array.isArray(MAPS[k].walls));

  const pt = (p) => {
    if (!p) return;
    "number" == typeof p.x && (p.x *= K);
    "number" == typeof p.z && (p.z *= K);
    "number" == typeof p._ox && (p._ox *= K);
    "number" == typeof p._oz && (p._oz *= K);
  };
  const pair = (a) => Array.isArray(a) && ((a[0] *= K), (a[1] *= K));

  // ── the map's own data (walls already carry the platforms 51 added and the house shells 99 added) ──
  function shrinkData(m) {
    if (m._shrunk) return;
    m._shrunk = K;
    for (const w of m.walls) (w.x *= K), (w.z *= K), (w.w *= K), (w.d *= K);
    for (const id in m.nodes) pt(m.nodes[id]);
    for (const s of m.sites || []) pt(s), s.r && (s.r = Math.max(8, s.r * K));
    pt(m.attackSpawn), pt(m.defendSpawn);
    const b = m.bounds;
    b && ((b.minX *= K), (b.maxX *= K), (b.minZ *= K), (b.maxZ *= K));
  }
  // ── gimmicks (06) and buildings (99): their plans are shared objects, moved in place ──
  function shrinkExtras(k) {
    const g = window.MAP_GIMMICKS && MAP_GIMMICKS.DEF && MAP_GIMMICKS.DEF[k];
    if (g && !g._shrunk) {
      g._shrunk = K;
      for (const d of g.door || []) (d.x *= K), (d.z *= K), (d.w *= K), (d.d *= K), (d.sw || []).forEach(pair);
      for (const t of g.tp || []) pair(t.a), pair(t.b);
      for (const z of g.zip || []) pair(z.a), pair(z.b);
    }
    const p = window.BUILDINGS && BUILDINGS.plan && BUILDINGS.plan[k];
    if (p && !p._shrunk) {
      p._shrunk = K;
      for (const h of p.b || []) pair(h);
      for (const t of p.t || []) pair(t);
      for (const r of p.c || []) (r[0] *= K), (r[1] *= K), (r[2] *= K), (r[3] *= K);
    }
  }
  for (const k of KEYS) shrinkData(MAPS[k]), shrinkExtras(k);

  // ── hand-placed structures and theme props: built from literal coordinates, so they are scaled as they are made ──
  const CTX = { on: !1, boxes: new Set() };
  const _ab = addBox;
  addBox = function (x, z, w, d, h, mat, s) {
    if (CTX.on && !(s && s.temp)) {
      const r = _ab.call(this, x * K, z * K, w * K, d * K, h, mat, s);
      r && r.mesh && CTX.boxes.add(r.mesh);
      return r;
    }
    return _ab.apply(this, arguments);
  };
  const active = () => KEYS.includes("undefined" != typeof CUR_MAP_KEY ? CUR_MAP_KEY : "");
  const kids = () => {
    const out = new Set(scene.children);
    "undefined" != typeof DECOR && DECOR.children.forEach((c) => out.add(c));
    return out;
  };
  function scaled(fn) {
    return function () {
      if (CTX.on || !active()) return fn.apply(this, arguments);
      const before = kids();
      CTX.on = !0;
      CTX.boxes.clear();
      try {
        return fn.apply(this, arguments);
      } finally {
        CTX.on = !1;
        // a prop keeps its size; only where it stands moves
        for (const c of kids()) if (!before.has(c) && !CTX.boxes.has(c) && !(c.userData && c.userData.actor)) (c.position.x *= K), (c.position.z *= K);
        CTX.boxes.clear();
      }
    };
  }
  for (const name of ["buildStructures", "dressGlacier", "dressDunes", "dressNeon", "dressGarden", "dressMarket", "dressJungle"])
    "function" == typeof window[name] && (window[name] = scaled(window[name]));

  // the bots' walking grid shrinks with the map, so a lane that was wide enough for them still is. It is set
  // once the old map is cleared: clearing a map that set its own cell (the 마크X발로 import) puts that map's
  // previous cell back, which must not win over this one.
  const CELL = GRID.cell;
  const _bmg = buildMapGeometry;
  buildMapGeometry = function () {
    const r = _bmg.apply(this, arguments);
    GRID.cell = active() ? CELL * K : CELL;
    return r;
  };

  window.MAP_SHRINK_INFO = { k: K, maps: KEYS.slice(), cell: CELL };
  // the map on the title screen was built at the old size
  try {
    "undefined" != typeof world && "menu" === world.phase && active() && loadMap(CUR_MAP_KEY);
  } catch (e) {}
})();
