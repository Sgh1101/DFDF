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

  // ── the looks: every map has its own kinds of building, each a different shape and roof ──
  // o.arcade: the ground floor open on the front behind pillars; o.upper: full | setback (a terrace on the front) |
  // cant (the upper floor leans out over the front); o.roof: flat | hip | gable | pagoda | saw; o.win: punched | ribbon |
  // slit | lattice; o.ex: porch lanterns balcony sign chimney antenna tank buttress pilasters crane
  const STY = {
    pagoda: { roof: "pagoda", win: "lattice", ex: ["porch", "lanterns"], acc: 0xa8322a, rf: 0x3f4a3c, lamp: 0xffd9a0 },
    pavilion: { arcade: !0, upper: "setback", roof: "hip", win: "punched", ex: ["lanterns"], acc: 0xa8322a, rf: 0x3f4a3c, lamp: 0xffd9a0 },
    hall: { roof: "gable", win: "ribbon", ex: ["porch", "pilasters"], acc: 0x8e2f27, rf: 0x39403a, lamp: 0xffd9a0 },
    shop: { roof: "gable", win: "punched", ex: ["balcony", "sign"], acc: 0x7a4a2a, rf: 0x35353c, lamp: 0xffc766 },
    row: { roof: "hip", win: "lattice", ex: ["porch", "sign"], acc: 0x6a3f24, rf: 0x35353c, lamp: 0xffc766 },
    bazaar: { arcade: !0, roof: "gable", win: "punched", ex: ["balcony", "lanterns"], acc: 0x8a5a30, rf: 0x3a3a40, lamp: 0xffc766 },
    lab: { upper: "cant", roof: "flat", win: "ribbon", ex: ["antenna", "pilasters"], acc: 0x79b9d8, rf: 0x9fb4c4, lamp: 0xcff3ff },
    dome: { upper: "setback", roof: "flat", win: "slit", ex: ["tank", "buttress"], acc: 0x79b9d8, rf: 0x9fb4c4, lamp: 0xcff3ff },
    station: { roof: "saw", win: "ribbon", ex: ["pilasters", "antenna"], acc: 0x5b9fc0, rf: 0x8fa6b8, lamp: 0xcff3ff },
    tower: { upper: "cant", roof: "flat", win: "ribbon", ex: ["antenna", "sign"], acc: 0xff3fc8, rf: 0x2a1f46, lamp: 0xff6ad8 },
    arcology: { arcade: !0, upper: "setback", roof: "flat", win: "ribbon", ex: ["sign", "antenna"], acc: 0x35e8ff, rf: 0x241a40, lamp: 0x7ff3ff },
    club: { roof: "flat", win: "slit", ex: ["sign", "lanterns"], acc: 0xb04cff, rf: 0x241a40, lamp: 0xc77dff },
    fort: { roof: "flat", win: "slit", ex: ["buttress", "chimney"], acc: 0xc9893f, rf: 0xb98a52, lamp: 0xffe2a8 },
    terrace: { upper: "setback", roof: "flat", win: "punched", ex: ["tank", "pilasters"], acc: 0xc9893f, rf: 0xb98a52, lamp: 0xffe2a8 },
    minaret: { upper: "cant", roof: "flat", win: "lattice", ex: ["buttress", "lanterns"], acc: 0xb87c3a, rf: 0xb98a52, lamp: 0xffe2a8 },
    stilt: { arcade: !0, roof: "hip", win: "lattice", ex: ["lanterns"], acc: 0x2f6a3a, rf: 0x4a5a2a, lamp: 0xd6ff9a },
    lodge: { roof: "gable", win: "punched", ex: ["porch", "balcony"], acc: 0x5a4a2a, rf: 0x3f5a2a, lamp: 0xd6ff9a },
    jshrine: { roof: "pagoda", win: "lattice", ex: ["lanterns", "porch"], acc: 0x2f6a3a, rf: 0x3f5a2a, lamp: 0xd6ff9a },
    warehouse: { roof: "gable", win: "ribbon", ex: ["crane", "pilasters"], acc: 0xd0762a, rf: 0x4a5560, lamp: 0xffd08a },
    customs: { roof: "flat", win: "punched", ex: ["porch", "sign"], acc: 0xd0762a, rf: 0x4a5560, lamp: 0xffd08a },
    cannery: { roof: "saw", win: "slit", ex: ["chimney", "pilasters"], acc: 0xb85a22, rf: 0x4a5560, lamp: 0xffd08a },
    bunker: { roof: "flat", win: "slit", ex: ["buttress"], acc: 0x44d0ff, rf: 0x3a4658, lamp: 0xbff3ff },
    bunkerb: { upper: "cant", roof: "flat", win: "ribbon", ex: ["antenna"], acc: 0x44d0ff, rf: 0x3a4658, lamp: 0xbff3ff },
    cab: { roof: "flat", win: "ribbon", ex: ["antenna", "pilasters"], acc: 0xc23b22, rf: 0x40454e, lamp: 0xffe0a0 },
    office: { upper: "setback", roof: "flat", win: "ribbon", ex: ["sign", "porch"], acc: 0x2f6e8a, rf: 0x3a4a58, lamp: 0xaee8ff },
    depot: { roof: "saw", win: "slit", ex: ["crane", "pilasters"], acc: 0x2f6e8a, rf: 0x3a4a58, lamp: 0xaee8ff },
    penthouse: { upper: "setback", roof: "flat", win: "ribbon", ex: ["tank", "antenna"], acc: 0xe8e0d0, rf: 0x55606c, lamp: 0xfff0c8 },
    loft: { roof: "gable", win: "lattice", ex: ["balcony", "chimney"], acc: 0xd0c0a8, rf: 0x55606c, lamp: 0xfff0c8 },
    shrine: { roof: "pagoda", win: "lattice", ex: ["porch", "lanterns"], acc: 0x9c3a2a, rf: 0x3a3f46, lamp: 0xffd9a0 },
    belltower: { upper: "setback", roof: "hip", win: "punched", ex: ["lanterns"], acc: 0x9c3a2a, rf: 0x3a3f46, lamp: 0xffd9a0 },
    foundry: { roof: "saw", win: "slit", ex: ["chimney", "buttress"], acc: 0xcc5a1e, rf: 0x4a3f3a, lamp: 0xffb060 },
    smithy: { roof: "flat", win: "punched", ex: ["chimney", "porch", "pilasters"], acc: 0xb04a18, rf: 0x4a3f3a, lamp: 0xffb060 },
    tavern: { roof: "gable", win: "punched", ex: ["balcony", "sign"], acc: 0xb06a2a, rf: 0x4a3a30, lamp: 0xffc766 },
    stall: { roof: "hip", win: "lattice", ex: ["porch", "sign", "lanterns"], acc: 0xa05a24, rf: 0x4a3a30, lamp: 0xffc766 },
    cargo: { roof: "flat", win: "ribbon", ex: ["crane", "buttress"], acc: 0x4a8aa8, rf: 0x5a6672, lamp: 0xd6f3ff },
    bridge: { upper: "cant", roof: "flat", win: "ribbon", ex: ["antenna", "pilasters"], acc: 0xc24a2a, rf: 0x5a6672, lamp: 0xd6f3ff },
  };
  // which kind goes up where (by the building's place in its map's plan)
  const MAP_STY = {
    garden: ["pagoda", "pavilion", "hall"], market: ["shop", "row", "bazaar"], glacier: ["lab", "dome", "station"], neon: ["tower", "arcology", "club"],
    dunes: ["fort", "terrace", "minaret"], jungle: ["stilt", "lodge", "jshrine"], pogu: ["warehouse", "customs", "cannery"], shift: ["bunker", "bunkerb"],
    train: ["cab", "bridge"], nightport: ["office", "depot"], rooftops: ["penthouse", "loft", "penthouse"], s02: ["shrine", "belltower"],
    s03: ["foundry", "smithy"], s04: ["stilt", "jshrine"], s05: ["tavern", "stall"], s06: ["cargo", "bridge"],
  };
  const TOWER_STY = {
    garden: "lookout", market: "lookout", glacier: "mast", neon: "mast", dunes: "dome", jungle: "lookout", pogu: "crane", shift: "mast", nightport: "crane",
    rooftops: "mast", s02: "lookout", s03: "crane", s04: "lookout", s05: "dome", s06: "crane",
  };
  const TOWER_COL = {
    lookout: { acc: 0x8a5a30, lamp: 0xffd9a0 }, mast: { acc: 0x79b9d8, lamp: 0xcff3ff }, crane: { acc: 0xd0762a, lamp: 0xffd08a }, dome: { acc: 0xc9893f, lamp: 0xffe2a8 },
  };

  // ── what a building is made of: boxes in its own frame (u along the long side, v across, y up) ──
  // [u0, u1, v0, v1, y0, y1, kind, visual-only?]; kinds: wall trim slab stair lamp acc roof
  function house(L, S, name) {
    const o = STY[name] || STY.hall,
      B = [];
    const box = (u0, u1, v0, v1, y0, y1, kind, nc) => u1 - u0 > 0.01 && v1 - v0 > 0.01 && y1 - y0 > 0.01 && B.push([u0, u1, v0, v1, y0, y1, kind, !!nc]);
    const ex = (k) => (o.ex || []).includes(k);
    // window sets: [centre, width, sill, head] on a wall of length len, heights above the floor
    const holes = (len, shape) =>
      "ribbon" === shape ? [[len * 0.28, len * 0.34, 0.9, 2.3], [len * 0.72, len * 0.34, 0.9, 2.3]]
        : "slit" === shape ? [0.12, 0.26, 0.4, 0.6, 0.74, 0.88].map((f) => [len * f, 0.5, 1.15, 2.0])
          : "lattice" === shape ? [0.14, 0.32, 0.5, 0.68, 0.86].map((f) => [len * f, 1.0, 1.0, 2.3])
            : [0.22, 0.5, 0.78].map((f) => [len * f, 1.7, 1.0, 2.2]);
    const shift = (hs, y) => hs.map(([c, w, a, b]) => [c, w, y + a, y + b]);
    const alongU = (v0, v1, y0, y1, hl, kind) => {
      let cur = 0;
      for (const [c, w, sill, head] of hl.slice().sort((a, b) => a[0] - b[0])) {
        const a = c - w / 2,
          z = c + w / 2;
        box(cur, a, v0, v1, y0, y1, kind);
        sill > y0 && box(a, z, v0, v1, y0, sill, kind);
        head < y1 && box(a, z, v0, v1, head, y1, "trim");
        cur = z;
      }
      box(cur, L, v0, v1, y0, y1, kind);
    };
    const alongV = (u0, u1, y0, y1, hl, kind) => {
      let cur = 0;
      for (const [c, w, sill, head] of hl.slice().sort((a, b) => a[0] - b[0])) {
        const a = c - w / 2,
          z = c + w / 2;
        box(u0, u1, cur, a, y0, y1, kind);
        sill > y0 && box(u0, u1, a, z, y0, sill, kind);
        head < y1 && box(u0, u1, a, z, head, y1, "trim");
        cur = z;
      }
      box(u0, u1, cur, S, y0, y1, kind);
    };
    // the ground floor: the front (v = S) with two doors, or open behind pillars; the stair-side wall with windows
    if (o.arcade) {
      box(0, L, S - TW, S, 2.6, H1, "acc"); // a beam over the open front
      const n = Math.max(3, Math.round(L / 3.4));
      for (let i = 0; i <= n; i++) {
        const u = Math.min(L - 0.5, Math.max(0, (i / n) * L - 0.25));
        box(u, u + 0.5, S - 0.6, S - 0.1, 0, 2.6, "acc");
      }
    } else alongU(S - TW, S, 0, H1, [[3.6, DOOR, 0, 2.5], [L - 3.6, DOOR, 0, 2.5]], "wall");
    alongU(0, TW, 0, H1, holes(L, o.win === "slit" ? "punched" : o.win), "wall");
    alongV(0, TW, 0, H1, [[S * 0.5, DOOR, 0, 2.5]], "wall");
    alongV(L - TW, L, 0, H1, [[S * 0.5, 1.6, 1.0, 2.3]], "wall");
    // the upper floor's outline: full, a terrace on the front (setback), or leaning out over it (cant)
    const sb = "setback" === o.upper ? Math.max(0, Math.min(2.6, S - 6.0)) : 0,
      cn = "cant" === o.upper ? 1.0 : 0,
      uS = S - sb + cn; // where the upper front wall stands
    const sU0 = 1.9, // room to walk up to the stair's foot
      sU1 = sU0 + 7 * TREAD,
      sV0 = TW + 0.1,
      sV1 = sV0 + 2.2;
    // the floor above, the stair's well left open (the floor over the stair's foot stops a body-width short)
    box(0, L, 0, TW, H1, F2, "slab");
    box(0, L, sV1 + 0.2, S, H1, F2, "slab");
    cn > 0 && box(0, L, S, S + cn, H1, F2, "slab");
    box(0, sU0 - 1.0, TW, sV1 + 0.2, H1, F2, "slab");
    box(sU1 + 0.1, L, TW, sV1 + 0.2, H1, F2, "slab");
    for (let i = 0; i < 7; i++) box(sU0 + i * TREAD, sU0 + (i + 1) * TREAD + (i === 6 ? 0.2 : 0), sV0, sV1, 0, STEP * (i + 1), "stair");
    // the upper walls
    const TU = 0.4,
      up = shift(holes(L, o.win), F2);
    const door = sb > 0 || ex("balcony"); // a door out onto the terrace or balcony
    const frontHoles = door ? up.filter((h) => Math.abs(h[0] - L * 0.5) > 1.6).concat([[L * 0.5, DOOR, F2, F2 + 2.5]]) : up;
    alongU(uS - TU, uS, F2, RF, frontHoles, "wall");
    alongU(0, TU, F2, RF, up, "wall");
    // the end walls, over the upper floor's depth
    const endV = (u0, u1) => {
      let cur = 0;
      const a = uS * 0.5 - 0.85,
        z = uS * 0.5 + 0.85;
      box(u0, u1, 0, a, F2, RF, "wall");
      box(u0, u1, a, z, F2, F2 + 1.0, "wall");
      box(u0, u1, a, z, F2 + 2.2, RF, "trim");
      box(u0, u1, z, uS, F2, RF, "wall");
      return cur;
    };
    endV(0, TU);
    endV(L - TU, L);
    // a terrace or balcony: a rail round the open part of the floor
    if (sb > 0) {
      box(0, L, S - 0.2, S, F2, F2 + 1.1, "acc");
      box(0, 0.2, S - sb, S - 0.2, F2, F2 + 1.1, "acc");
      box(L - 0.2, L, S - sb, S - 0.2, F2, F2 + 1.1, "acc");
    } else if (ex("balcony") && !cn) {
      box(3.0, L - 3.0, S, S + 1.1, H1, F2, "slab");
      box(3.0, L - 3.0, S + 0.9, S + 1.1, F2, F2 + 1.1, "acc");
      box(3.0, 3.2, S, S + 0.9, F2, F2 + 1.1, "acc");
      box(L - 3.2, L - 3.0, S, S + 0.9, F2, F2 + 1.1, "acc");
    }
    // the roof over the upper floor
    const ru0 = 0,
      ru1 = L,
      rv0 = 0,
      rv1 = uS;
    box(ru0, ru1, rv0, rv1, RF, RF + FL, "slab");
    const lay = (i, du, dv, h, kind) => box(ru0 + du * i, ru1 - du * i, rv0 + dv * i, rv1 - dv * i, RF + FL + h * (i - 1), RF + FL + h * i, kind || "roof", !0);
    if ("hip" === o.roof) {
      box(ru0 - 0.9, ru1 + 0.9, rv0 - 0.9, rv1 + 0.9, RF - 0.12, RF + FL + 0.05, "roof", !0);
      for (let i = 1; i <= 3; i++) lay(i, 1.2, 1.2, 0.5);
    } else if ("gable" === o.roof) {
      box(ru0 - 0.2, ru1 + 0.2, rv0 - 0.8, rv1 + 0.8, RF - 0.12, RF + FL + 0.05, "roof", !0);
      for (let i = 1; i <= 4; i++) lay(i, 0, 1.05, 0.5);
    } else if ("pagoda" === o.roof) {
      box(ru0 - 1.1, ru1 + 1.1, rv0 - 1.1, rv1 + 1.1, RF - 0.12, RF + FL + 0.35, "roof", !0);
      const w = (ru1 - ru0) * 0.46,
        d = (rv1 - rv0) * 0.55,
        cu = (ru0 + ru1) / 2,
        cv = (rv0 + rv1) / 2;
      box(cu - w / 2, cu + w / 2, cv - d / 2, cv + d / 2, RF + FL + 0.35, RF + FL + 2.7, "wall", !0);
      box(cu - w / 2 - 0.9, cu + w / 2 + 0.9, cv - d / 2 - 0.9, cv + d / 2 + 0.9, RF + FL + 2.7, RF + FL + 3.1, "roof", !0);
      box(cu - w / 2 + 0.4, cu + w / 2 - 0.4, cv - d / 2 + 0.4, cv + d / 2 - 0.4, RF + FL + 3.1, RF + FL + 3.6, "roof", !0);
      box(cu - 0.15, cu + 0.15, cv - 0.15, cv + 0.15, RF + FL + 3.6, RF + FL + 5.2, "acc", !0);
    } else if ("saw" === o.roof) {
      const n = 4,
        seg = (ru1 - ru0) / n;
      for (let i = 0; i < n; i++) {
        box(ru0 + i * seg, ru0 + i * seg + 0.35, rv0 + 0.6, rv1 - 0.6, RF + FL, RF + FL + 1.7, "roof", !0);
        box(ru0 + i * seg + 0.35, ru0 + i * seg + 0.9, rv0 + 0.6, rv1 - 0.6, RF + FL, RF + FL + 1.2, "lamp", !0);
      }
    } else {
      box(ru0, ru1, rv0, 0.3, RF + FL, RF + FL + 0.6, "trim", !0);
      box(ru0, ru1, rv1 - 0.3, rv1, RF + FL, RF + FL + 0.6, "trim", !0);
      box(ru0, 0.3, 0.3, rv1 - 0.3, RF + FL, RF + FL + 0.6, "trim", !0);
      box(ru1 - 0.3, ru1, 0.3, rv1 - 0.3, RF + FL, RF + FL + 0.6, "trim", !0);
    }
    // the extras
    if (ex("porch") && !o.arcade) {
      box(3.6 - 1.7, 3.6 + 1.7, S, S + 2.0, 2.9, 3.15, "roof", !0);
      box(3.6 - 1.55, 3.6 - 1.2, S + 1.6, S + 1.95, 0, 2.9, "acc");
      box(3.6 + 1.2, 3.6 + 1.55, S + 1.6, S + 1.95, 0, 2.9, "acc");
    }
    if (ex("lanterns")) for (const u of [0.8, L - 0.8, L * 0.5]) box(u - 0.17, u + 0.17, S + 0.05, S + 0.4, 2.3, 2.9, "lamp", !0);
    if (ex("sign")) box(3.6 - 1.4, 3.6 + 1.4, S + 0.02, S + 0.18, 2.62, 3.12, "lamp", !0);
    if (ex("chimney")) box(L - 2.2, L - 1.2, 1.2, 2.2, RF + FL, RF + FL + 3.4, "wall", !0);
    if (ex("antenna")) {
      box(L * 0.3 - 0.12, L * 0.3 + 0.12, uS * 0.5 - 0.12, uS * 0.5 + 0.12, RF + FL, RF + FL + 6.5, "trim", !0);
      box(L * 0.3 - 0.6, L * 0.3 + 0.6, uS * 0.5 - 0.1, uS * 0.5 + 0.1, RF + FL + 4.6, RF + FL + 5.0, "lamp", !0);
    }
    if (ex("tank")) {
      for (const [u, v] of [[L * 0.6 - 0.8, 1.2], [L * 0.6 + 0.8, 1.2], [L * 0.6 - 0.8, 2.6], [L * 0.6 + 0.8, 2.6]]) box(u - 0.1, u + 0.1, v - 0.1, v + 0.1, RF + FL, RF + FL + 1.2, "trim", !0);
      box(L * 0.6 - 1.2, L * 0.6 + 1.2, 0.8, 3.0, RF + FL + 1.2, RF + FL + 3.0, "acc", !0);
    }
    if (ex("buttress")) for (const [u, v] of [[-0.8, -0.8], [L, -0.8], [-0.8, S], [L, S]]) box(u, u + 0.8, v, v + 0.8, 0, H1, "acc");
    if (ex("pilasters")) for (let u = 1.6; u < L - 1; u += 3.2) box(u, u + 0.4, S, S + 0.3, 0, RF, "acc", !0);
    if (ex("crane")) {
      box(L - 0.9, L - 0.3, S - 0.9, S - 0.3, RF + FL, RF + FL + 3.6, "acc", !0);
      box(L - 0.8, L - 0.4, S - 0.8, S + 5.2, RF + FL + 3.1, RF + FL + 3.5, "acc", !0);
      box(L - 0.7, L - 0.5, S + 5.0, S + 5.1, RF + FL + 1.7, RF + FL + 3.1, "lamp", !0);
    }
    // a ceiling lamp inside each floor
    box(L * 0.5 - 0.5, L * 0.5 + 0.5, S * 0.5 - 0.3, S * 0.5 + 0.3, H1 - 0.15, H1, "lamp", !0);
    box(L * 0.5 - 0.5, L * 0.5 + 0.5, uS * 0.5 - 0.3, uS * 0.5 + 0.3, RF - 0.15, RF, "lamp", !0);
    return B;
  }
  // a watchtower: u along the stair then the deck, v across. Deck 3.4 m up on four posts, a stair of six steps
  function tower(name) {
    const B = [],
      box = (u0, u1, v0, v1, y0, y1, kind, nc) => B.push([u0, u1, v0, v1, y0, y1, kind, !!nc]);
    const DK = 3.4,
      n = 6,
      tread = 0.8,
      u0 = 5.0;
    for (let i = 0; i < n; i++) box(0.1 + i * tread, 0.1 + (i + 1) * tread + (i === n - 1 ? 0.1 : 0), 1.2, 3.2, 0, (DK / n) * (i + 1), "stair");
    box(u0, 9.4, 0, 4.4, DK - FL, DK, "slab");
    for (const [u, v] of [[u0 + 0.1, 0.1], [9.4 - 0.6, 0.1], [u0 + 0.1, 3.8], [9.4 - 0.6, 3.8]]) box(u, u + 0.5, v, v + 0.5, 0, DK - FL, "acc");
    box(u0, 9.4, 0, 0.25, DK, DK + 1.1, "wall");
    box(u0, 9.4, 4.15, 4.4, DK, DK + 1.1, "wall");
    box(9.15, 9.4, 0.25, 4.15, DK, DK + 1.1, "wall");
    if ("lookout" === name) {
      box(u0 + 1.2, 9.4 - 0.2, 0.3, 4.1, DK + 3.0, DK + 3.25, "roof", !0);
      for (const [u, v] of [[9.0, 0.3], [9.0, 3.9], [u0 + 1.2, 0.3], [u0 + 1.2, 3.9]]) box(u, u + 0.2, v, v + 0.2, DK + 1.1, DK + 3.0, "acc", !0);
      box(u0 + 1.8, 9.0, 1.4, 3.0, DK + 2.8, DK + 3.0, "lamp", !0);
    } else if ("mast" === name) {
      box(8.2, 8.5, 2.0, 2.3, DK, DK + 7.5, "trim", !0);
      box(7.7, 9.0, 2.05, 2.25, DK + 5.2, DK + 5.6, "lamp", !0);
      box(u0 + 0.4, u0 + 1.4, 0.5, 1.4, DK, DK + 1.0, "acc", !0);
    } else if ("crane" === name) {
      box(9.0, 9.3, 0.4, 0.7, DK, DK + 4.6, "acc", !0);
      box(u0 - 1.5, 9.3, 0.45, 0.65, DK + 4.2, DK + 4.6, "acc", !0);
      box(u0 - 1.4, u0 - 1.2, 0.5, 0.6, DK + 2.2, DK + 4.2, "lamp", !0);
    } else if ("dome" === name) {
      box(u0 + 0.6, 9.4 - 0.6, 0.6, 3.8, DK + 3.0, DK + 3.3, "roof", !0);
      box(u0 + 1.2, 9.4 - 1.2, 1.2, 3.2, DK + 3.3, DK + 3.7, "roof", !0);
      box(u0 + 1.8, 9.4 - 1.8, 1.8, 2.6, DK + 3.7, DK + 4.0, "roof", !0);
      box(7.0 - 0.1, 7.2, 2.1, 2.3, DK + 4.0, DK + 5.4, "acc", !0);
      for (const [u, v] of [[u0 + 0.6, 0.6], [9.4 - 0.9, 0.6], [u0 + 0.6, 3.5], [9.4 - 0.9, 3.5]]) box(u, u + 0.3, v, v + 0.3, DK + 1.1, DK + 3.0, "acc", !0);
    }
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
  // a plain colour for the accent and roof of a style (cached), and a glow for its lamps
  const COLM = new Map();
  const colMat = (c, glow) => {
    const id = (glow ? "g" : "m") + c;
    return COLM.get(id) || (COLM.set(id, glow ? new T.MeshBasicMaterial({ color: c }) : new T.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.2 })), COLM.get(id));
  };
  const matOf = (kind, st) => {
    const th = TH();
    return "wall" === kind ? th.wall : "trim" === kind ? th.strut || th.wall : "slab" === kind ? th.trim || th.wall : "stair" === kind ? th.crate || th.wall : "acc" === kind ? colMat(st.acc) : "roof" === kind ? colMat(new T.Color(st.rf).lerp(new T.Color(0xffffff), 0.32).getHex()) : colMat(st.lamp, !0);
  };

  const THEMED = ["wall", "trim", "slab", "stair"];
  const FRAMES = new Map(); // key → boxes in the frame, built once per look and size
  const frameOf = (kind, name, L, S) => {
    const id = kind + "|" + name + "|" + L + "x" + S;
    return FRAMES.get(id) || (FRAMES.set(id, "tower" === kind ? tower(name) : house(L, S, name)), FRAMES.get(id));
  };
  const styleOf = (key, kind, i) => {
    if ("tower" === kind) {
      const t = TOWER_STY[key] || "lookout";
      return { name: t, st: Object.assign({}, STY.hall, TOWER_COL[t], { rf: 0x3a3f46 }) };
    }
    const list = MAP_STY[key] || ["hall"],
      name = list[i % list.length];
    return { name, st: STY[name] };
  };
  const BUILT = { key: null, count: 0, boxes: 0 };

  function build(key) {
    const plan = PLAN[key],
      m = MAPS[key];
    if (!plan || !m) return 0;
    const byKind = {},
      cols = [],
      pseudo = [];
    const place = (kind, cx, cz, L, S, rot, flip, idx) => {
      const { name, st } = styleOf(key, kind, idx);
      for (const b of frameOf(kind, name, L, S)) {
        const w = toWorld(b, cx, cz, L, S, rot, flip),
          k = THEMED.includes(b[6]) ? b[6] : b[6] + "|" + name; // the map's own materials merge across looks; a look's colours stay its own
        (byKind[k] || (byKind[k] = { kind: b[6], st, list: [] })).list.push(w);
        if (b[7] || "lamp" === b[6]) continue;
        cols.push({ minX: r2(w[0]), maxX: r2(w[1]), minZ: r2(w[4]), maxZ: r2(w[5]), y0: w[2] > 0.05 ? r2(w[2]) : 0, h: r2(w[3]), kind: k });
      }
      // the whole house as one wall for what looks for a building (cover)
      pseudo.push({ x: cx, z: cz, w: rot ? S : L, d: rot ? L : S, h: "tower" === kind ? 3.4 : RF + FL, two: 1, floors: "tower" === kind ? 1 : 2, style: name });
    };
    plan.b.forEach(([x, z, L, S, rot, flip], i) => place("house", x, z, L, S, rot, flip, i));
    plan.t.forEach(([x, z, rot], i) => place("tower", x, z, 9.4, 4.4, rot, 0, i));
    const meshes = {};
    for (const k in byKind) {
      const { kind: bk, st, list } = byKind[k];
      const mesh = new T.Mesh(merged(list), matOf(bk, st));
      mesh.castShadow = "wall" === bk || "slab" === bk;
      mesh.receiveShadow = "lamp" !== bk;
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
  window.BUILDINGS = { plan: PLAN, build, built: BUILT, H1, F2, RF, house, tower, toWorld, styles: STY, mapStyles: MAP_STY, towerStyles: TOWER_STY };
})();
