/* 네모 마을 (blocktown): the layout, written as code.
   Every block of the map is placed by the functions below from a short list of rectangles: nothing is read from a file
   and nothing is copied from another game or map. This file is plain data and a voxel builder (no Three.js, no DOM), so
   the same code runs in the game (js/blocktown-map.js draws it) and in node (tests/blocktown.test.js checks it).

   The grid is NX × NZ columns of B-metre blocks and NY layers. Layer 0 is the ground (its top is y = 0); layer L
   (L ≥ 1) fills y ∈ [(L-1)·B, L·B]. A half block (a slab) fills the lower half of its layer.

   The plan, north (−z) at the top, the defenders' castle in the north, the attackers' village in the south:
     · B 농장 (west): a farmyard with a barn you can walk through, a wheat field and hay bales.
     · A 채석장 (east): a quarry yard with an ore heap, crates and a minecart, and a raised stone ledge on its west
       side reached from the rail bridge.
     · 중앙 화물역 (middle): a rail yard with shipping containers and a raised rail bridge running north–south over
       it; you can walk on the bridge or under it. A plank walkway leaves the bridge for the A ledge.
     · lanes: the orchard (B main), the mine tunnel (A main), the depot alley (middle ↔ A main), the barn link
       (middle ↔ B), two castle roads for the defenders, the village streets for the attackers. */
(function (root) {
  "use strict";
  const B = 1.25, NX = 168, NY = 14, NZ = 136;

  // ── pictures: 16 × 16 pixel tiles painted in code by js/blocktown-map.js ──
  const TILES = ["grass_top", "grass_side", "dirt", "stone", "cobble", "planks", "log_side", "log_top", "brick", "stonebrick", "window", "leaves", "path", "gravel",
    "wool_red", "wool_blue", "wool_yellow", "hay_side", "hay_top", "crate", "water", "roof_red", "roof_dark", "ore", "iron", "plaster", "wheat", "lantern",
    "farmland", "rail", "rail_x", "container_red", "container_blue", "container_yellow", "timber"];
  const T = Object.fromEntries(TILES.map((n, i) => [n, i]));

  // ── materials: tiles [top, side, bottom] and how the block behaves ──
  //  solid: stops bodies and bullets · opaque: hides the face of the block beside it · cutout: has see-through pixels
  //  water: drawn see-through · half: a slab (lower half of its layer)
  const MAT = [null];
  const M = {};
  const mat = (name, top, side, bottom, f = {}) => { M[name] = MAT.length; MAT.push({ name, tiles: [T[top], T[side || top], T[bottom || top]], solid: f.solid !== false, opaque: f.opaque !== false, cutout: !!f.cutout, water: !!f.water, half: !!f.half }); };
  mat("grass", "grass_top", "grass_side", "dirt");
  mat("dirt", "dirt");
  mat("stone", "stone");
  mat("cobble", "cobble");
  mat("planks", "planks");
  mat("log", "log_top", "log_side", "log_top");
  mat("brick", "brick");
  mat("stonebrick", "stonebrick");
  mat("window", "plaster", "window", "plaster");
  mat("leaves", "leaves", "leaves", "leaves", { opaque: false, cutout: true });
  mat("path", "path", "dirt", "dirt");
  mat("gravel", "gravel");
  mat("wool_red", "wool_red");
  mat("wool_blue", "wool_blue");
  mat("wool_yellow", "wool_yellow");
  mat("hay", "hay_top", "hay_side", "hay_top");
  mat("crate", "crate");
  mat("water", "water", "water", "water", { solid: false, opaque: false, water: true });
  mat("roof_red", "roof_red");
  mat("roof_dark", "roof_dark");
  mat("ore", "ore");
  mat("iron", "iron");
  mat("plaster", "plaster");
  mat("wheat", "wheat", "wheat", "farmland", { solid: false, opaque: false, cutout: true });
  mat("lantern", "lantern");
  mat("farmland", "farmland", "dirt", "dirt");
  mat("rail", "rail", "gravel", "gravel");
  mat("rail_x", "rail_x", "gravel", "gravel");
  mat("container_red", "iron", "container_red", "iron");
  mat("container_blue", "iron", "container_blue", "iron");
  mat("container_yellow", "iron", "container_yellow", "iron");
  mat("timber", "planks", "timber", "planks");
  mat("pool", "water", "stonebrick", "stonebrick");
  mat("slab_cobble", "cobble", "cobble", "cobble", { opaque: false, half: true });
  mat("slab_planks", "planks", "planks", "planks", { opaque: false, half: true });
  mat("slab_stonebrick", "stonebrick", "stonebrick", "stonebrick", { opaque: false, half: true });
  const MASS = 255; // the hills and houses between the lanes, painted by region at the end

  // ── a small, fixed random stream: the same map every time ──
  const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const hash = (x, z, k) => { let h = Math.imul(x * 374761393 + z * 668265263 + k * 2147483647, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function build() {
    const vox = new Uint8Array(NX * NY * NZ);
    const I = (x, y, z) => (y * NZ + z) * NX + x;
    const inside = (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < NX && z < NZ && y < NY;
    const get = (x, y, z) => (inside(x, y, z) ? vox[I(x, y, z)] : 0);
    const put = (x, y, z, m) => inside(x, y, z) && (vox[I(x, y, z)] = m);
    // a box of blocks: x ∈ [x0, x1), z ∈ [z0, z1), layers y ∈ [y0, y1)
    const box = (x0, z0, x1, z1, y0, y1, m) => { for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) put(x, y, z, m); };
    const carve = (x0, z0, x1, z1, floor) => { box(x0, z0, x1, z1, 1, NY, 0); box(x0, z0, x1, z1, 0, 1, M[floor]); };
    // stairs of half steps (0.625 m, under the 0.68 m a body steps up) rising toward `dir`, one block per step
    const stairs = (x0, z0, x1, z1, dir, full, slab) => {
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
        const k = dir === "N" ? z1 - z : dir === "S" ? z - z0 + 1 : dir === "E" ? x - x0 + 1 : x1 - x;
        const n = k >> 1;
        for (let y = 1; y <= n; y++) put(x, y, z, M[full]);
        k & 1 && put(x, n + 1, z, M[slab]);
      }
    };
    const tree = (x, z, base, h) => {
      for (let y = base; y < base + h; y++) put(x, y, z, M.log);
      const top = base + h;
      for (let y = top - 2; y <= top; y++) {
        const r = y === top ? 1 : 2;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          get(x + dx, y, z + dz) || put(x + dx, y, z + dz, M.leaves);
        }
      }
    };

    // the land: hills and houses everywhere, 5 blocks high (6 at the rim) — then the streets are cut out of it
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      put(x, 0, z, M.grass);
      const rim = x < 2 || z < 2 || x >= NX - 2 || z >= NZ - 2;
      for (let y = 1; y <= (rim ? 6 : 5); y++) put(x, y, z, MASS);
    }

    // ── the streets and yards (ground level) ──
    carve(64, 6, 104, 22, "cobble"); //    castle yard: the defenders start here
    carve(30, 10, 64, 19, "path"); //      castle road west
    carve(104, 10, 138, 19, "path"); //    castle road east
    carve(22, 10, 34, 32, "path"); //      farm gate road (B from the castle)
    carve(134, 10, 146, 32, "gravel"); //  quarry gate road (A from the castle)
    carve(76, 22, 92, 46, "path"); //      north rail cut (middle from the castle)
    carve(12, 32, 48, 64, "grass"); //     B farmyard
    carve(120, 32, 156, 62, "gravel"); //  A quarry yard
    carve(60, 46, 108, 84, "cobble"); //   middle: the rail yard
    carve(48, 48, 60, 56, "path"); //      barn link (middle ↔ B)
    carve(140, 62, 152, 100, "gravel"); // mine tunnel (A from the village)
    carve(16, 64, 28, 100, "grass"); //    orchard (B from the village)
    carve(16, 100, 66, 110, "path"); //    village street west
    carve(102, 94, 152, 102, "path"); //   village street east
    carve(102, 94, 110, 112, "path"); //   east lane into the square
    carve(64, 104, 104, 130, "cobble"); // village square: the attackers start here
    carve(76, 84, 92, 104, "path"); //     south rail cut (square ↔ middle)
    carve(108, 74, 140, 82, "cobble"); //  depot alley (middle ↔ mine tunnel)

    // ── the castle ──
    box(58, 1, 64, 7, 1, 9, M.stonebrick); // towers at the yard's corners
    box(104, 1, 110, 7, 1, 9, M.stonebrick);
    for (const tx of [58, 104]) for (let x = tx; x < tx + 6; x++) for (let z = 1; z < 7; z++) (x === tx || x === tx + 5 || z === 1 || z === 6) && (x + z) % 2 === 0 && put(x, 9, z, M.stonebrick);
    for (const gx of [58, 108]) { // gates across the castle roads: a 5-block door under an arch
      box(gx, 10, gx + 2, 12, 1, 6, M.stonebrick);
      box(gx, 17, gx + 2, 19, 1, 6, M.stonebrick);
      box(gx, 12, gx + 2, 17, 4, 6, M.stonebrick);
      put(gx, 3, 11, M.lantern); put(gx + 1, 3, 17, M.lantern);
    }
    box(94, 14, 98, 18, 1, 2, M.cobble); // the well
    box(95, 15, 97, 17, 1, 2, 0);
    box(95, 15, 97, 17, 0, 1, M.pool);
    box(72, 16, 75, 19, 1, 2, M.crate); box(73, 17, 75, 19, 2, 3, M.crate);
    for (const bx of [70, 77, 91, 98]) box(bx, 5, bx + 2, 6, 2, 5, M.wool_blue); // banners on the keep wall
    for (const lx of [67, 80, 88, 101]) put(lx, 3, 5, M.lantern);

    // ── B: the farm ──
    box(16, 36, 28, 46, 1, 5, M.planks); // the barn: plank walls, timber corners, three doors, a hay loft
    box(17, 37, 27, 45, 1, 5, 0);
    box(16, 36, 28, 46, 0, 1, M.path);
    for (const [x, z] of [[16, 36], [27, 36], [16, 45], [27, 45]]) box(x, z, x + 1, z + 1, 1, 5, M.log);
    box(27, 39, 28, 43, 1, 4, 0); //  east door
    box(19, 45, 23, 46, 1, 4, 0); //  south door
    box(21, 36, 25, 37, 1, 4, 0); //  north door
    for (let k = 0; k < 6; k++) box(15, 35 + k, 29, 47 - k, 5 + k, 6 + k, M.roof_dark);
    box(17, 37, 20, 45, 1, 3, M.hay); // the loft: two bales high, one bale to climb on
    box(20, 41, 21, 43, 1, 2, M.hay);
    box(32, 50, 46, 62, 0, 1, M.farmland); // the wheat field, a path across it
    box(32, 50, 46, 62, 1, 2, M.wheat);
    box(32, 55, 46, 57, 1, 2, 0); box(32, 55, 46, 57, 0, 1, M.path);
    box(31, 50, 32, 55, 1, 2, M.log); // a fence end
    box(34, 38, 36, 40, 1, 2, M.hay); // bales
    box(40, 40, 43, 42, 1, 3, M.hay);
    box(41, 40, 43, 42, 3, 4, M.hay);
    box(29, 58, 31, 60, 1, 2, M.hay);
    box(44, 34, 47, 36, 1, 2, M.crate);
    box(3, 40, 8, 45, 1, 11, M.plaster); // the windmill on the west hill
    box(3, 40, 8, 45, 11, 12, M.roof_red);
    box(8, 42, 9, 43, 4, 13, M.timber);
    box(8, 36, 9, 49, 8, 9, M.timber);
    box(8, 42, 9, 43, 8, 9, M.log);
    put(28, 3, 38, M.lantern); put(47, 3, 49, M.lantern);
    for (const [x, z] of [[19, 72], [25, 80], [19, 88], [24, 95]]) tree(x, z, 1, 3); // the orchard
    box(22, 84, 24, 86, 1, 2, M.hay);
    box(16, 76, 18, 78, 1, 2, M.crate);

    // ── A: the quarry ──
    box(120, 36, 128, 58, 1, 4, M.stonebrick); // the west ledge, three blocks up
    box(127, 36, 128, 44, 4, 5, M.stonebrick); // its low wall
    box(127, 50, 128, 58, 4, 5, M.stonebrick);
    stairs(128, 44, 134, 50, "W", "stonebrick", "slab_stonebrick"); // steps down into the yard
    box(148, 32, 156, 40, 1, 5, M.brick); // the drill house
    box(148, 32, 156, 40, 5, 6, M.roof_dark);
    for (const x of [149, 152, 155]) put(x, 3, 40, M.window);
    box(138, 42, 142, 46, 1, 3, M.ore); // the ore heap
    box(139, 43, 141, 45, 3, 4, M.ore);
    box(146, 50, 148, 52, 1, 3, M.crate);
    box(148, 50, 150, 52, 1, 2, M.crate);
    box(144, 36, 146, 38, 1, 3, M.cobble);
    box(150, 56, 153, 58, 1, 2, M.crate);
    for (let z = 32; z < 62; z++) put(136, 0, z, M.rail); // rails through the yard and down the tunnel
    for (let z = 62; z < 100; z++) put(146, 0, z, M.rail);
    box(135, 54, 138, 56, 1, 2, M.iron); // a minecart on the rails
    put(130, 3, 33, M.lantern); put(155, 3, 45, M.lantern);

    // ── the middle: the rail yard and the bridge ──
    box(80, 48, 88, 82, 3, 4, M.planks); // the bridge deck, three blocks up: walk on it or under it
    box(80, 48, 81, 82, 4, 5, M.iron); //  its rails
    box(87, 52, 88, 82, 4, 5, M.iron);
    for (const z of [58, 66, 74]) for (const x of [80, 87]) box(x, z, x + 1, z + 1, 1, 3, M.stonebrick);
    stairs(80, 42, 88, 48, "S", "cobble", "slab_cobble"); // up from the north cut
    stairs(80, 82, 88, 88, "N", "cobble", "slab_cobble"); // up from the south cut
    box(88, 47, 108, 52, 3, 4, M.planks); // the walkway to the A ledge
    box(88, 47, 108, 48, 4, 5, M.iron);
    box(88, 51, 108, 52, 4, 5, M.iron);
    for (const x of [96, 104]) for (const z of [47, 51]) box(x, z, x + 1, z + 1, 1, 3, M.stonebrick);
    box(108, 47, 120, 52, 4, NY, 0); // ...cut through the quarry hill
    box(108, 47, 120, 52, 3, 4, M.planks);
    box(60, 46, 68, 53, 1, 5, M.brick); // the station house
    box(60, 46, 68, 53, 5, 6, M.roof_red);
    for (const x of [61, 63, 65]) put(x, 3, 53, M.window);
    box(70, 58, 77, 61, 1, 3, M.container_red); // shipping containers
    box(64, 68, 67, 75, 1, 3, M.container_yellow);
    box(90, 70, 97, 73, 1, 3, M.container_blue);
    box(91, 70, 96, 73, 3, 4, M.container_red);
    box(98, 58, 100, 60, 1, 3, M.crate);
    box(100, 58, 101, 60, 1, 2, M.crate);
    box(72, 76, 74, 78, 1, 2, M.crate);
    box(100, 78, 103, 80, 1, 2, M.crate);
    for (let x = 60; x < 108; x++) put(x, 0, 64, M.rail_x);
    box(122, 74, 124, 77, 1, 3, M.crate); // the depot alley
    box(130, 79, 132, 82, 1, 2, M.crate);
    box(140, 70, 152, 90, 4, 6, M.stone); // the mine tunnel's roof
    for (const z of [72, 84]) box(140, z, 141, z + 1, 1, 4, M.timber);
    for (const z of [72, 78, 84]) { box(151, z, 152, z + 1, 1, 4, M.timber); put(151, 3, z + 1, M.lantern); }
    box(148, 92, 151, 95, 1, 2, M.crate);
    put(59, 3, 52, M.lantern); put(108, 3, 72, M.lantern);

    // ── the village ──
    box(80, 114, 88, 120, 1, 2, M.stonebrick); // the fountain
    box(81, 115, 87, 119, 1, 2, 0);
    box(81, 115, 87, 119, 0, 1, M.pool);
    box(83, 116, 85, 118, 1, 3, M.stonebrick);
    box(83, 116, 85, 118, 3, 4, M.lantern);
    for (const bx of [68, 74, 94, 100]) box(bx, 130, bx + 2, 131, 2, 5, M.wool_red); // banners on the south houses
    box(66, 106, 69, 108, 1, 2, M.crate);
    box(98, 124, 101, 127, 1, 2, M.hay);
    box(40, 104, 42, 106, 1, 2, M.crate); box(124, 96, 126, 98, 1, 2, M.crate);
    for (const [x, z] of [[63, 106], [104, 106], [75, 103], [92, 103]]) put(x, 3, z, M.lantern);

    // ── paint the land by region ──
    const STYLE = (x, z) => (x >= 48 && x < 120 && z >= 90 ? "house" : x >= 50 && x < 118 && z < 32 ? "castle" : x >= 52 && x < 116 && z < 90 ? "works" : x >= 110 && z >= 20 && z < 112 ? "quarry" : "hill");
    const top = new Int16Array(NX * NZ).fill(-1);
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) for (let y = NY - 1; y >= 1; y--) if (get(x, y, z) === MASS) { top[z * NX + x] = y; break; }
    // how far each column of land is from a street (0 at the edge), for roofs and trees
    const dist = new Int16Array(NX * NZ).fill(-1), q = [];
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      if (top[z * NX + x] < 0) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const X = x + dx, Z = z + dz; return X >= 0 && Z >= 0 && X < NX && Z < NZ && get(X, 1, Z) !== MASS; });
      edge && ((dist[z * NX + x] = 0), q.push(z * NX + x));
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % NX, z = (i / NX) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Z = z + dz, j = Z * NX + X;
        if (X >= 0 && Z >= 0 && X < NX && Z < NZ && top[j] >= 0 && dist[j] < 0) ((dist[j] = dist[i] + 1), q.push(j));
      }
    }
    const R = rng(1357);
    const faces = (x, y, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const m = get(x + dx, y, z + dz); return !m || (m !== MASS && !MAT[m].opaque); });
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      const t = top[z * NX + x];
      if (t < 0) continue;
      const st = STYLE(x, z), d = dist[z * NX + x];
      const wall = ["plaster", "planks", "brick"][Math.floor(hash(x >> 3, z >> 3, 7) * 3)];
      for (let y = 1; y <= t; y++) {
        if (get(x, y, z) !== MASS) continue;
        const open = faces(x, y, z);
        let m;
        if (st === "hill") m = y === t ? "grass" : y >= t - 1 ? "dirt" : "stone";
        else if (st === "quarry") m = y === t ? (hash(x, z, 3) < 0.55 ? "grass" : "stone") : hash(x, y * 31 + z, 5) < 0.05 ? "ore" : y === t - 1 && hash(x, z, 4) < 0.5 ? "dirt" : "stone";
        else if (st === "castle") m = y === 1 ? "cobble" : "stonebrick";
        else if (st === "works") m = y === t ? "roof_dark" : open && y === 3 && (x + z) % 4 === 1 ? "window" : y === 1 ? "stonebrick" : "brick";
        else m = y === t ? (d === 0 ? "timber" : "roof_red") : y === 1 ? "cobble" : open && (y === 3 || y === 2) && (x * 7 + z * 3) % 5 === 1 ? "window" : (x + z) % 9 === 0 && open ? "timber" : wall;
        put(x, y, z, M[m]);
      }
      // roofs step up over the houses; the castle wall gets battlements; the hills get trees
      if (st === "house") for (let k = 1; k <= 3; k++) d >= 2 * k - 1 && put(x, t + k, z, M.roof_red);
      if (st === "castle" && d === 0 && (x + z) % 2 === 0) put(x, t + 1, z, M.stonebrick);
      if ((st === "hill" || st === "quarry") && d >= 2 && x > 3 && z > 3 && x < NX - 4 && z < NZ - 4 && R() < (st === "hill" ? 0.045 : 0.012)) tree(x, z, t + 1, 3 + ((R() * 2) | 0));
    }
    return { vox, I, get };
  }

  // ── places, in blocks (the map record turns them into metres) ──
  const PLACES = {
    attackSpawn: [84, 125], defendSpawn: [84, 10],
    sites: [{ id: "A", at: [142, 50], r: 10, label: "A 채석장" }, { id: "B", at: [36, 47], r: 10, label: "B 농장" }],
    // ground-level points along every lane: the bots' map and the respawn modes' spawn points
    nodes: {
      attack: [84, 125], square: [84, 110], streetW: [46, 105], orchard: [22, 82], orchardN: [22, 68],
      streetE: [128, 98], tunnelS: [146, 96], tunnel: [146, 80], tunnelN: [146, 66], depot: [126, 79],
      cutS: [84, 94], yardW: [70, 66], yardE: [100, 64], underBridge: [84, 64], cutN: [84, 32], barnLink: [54, 52],
      B: [36, 47], barn: [22, 41], field: [40, 56], bGate: [28, 22], A: [142, 50], aYard: [136, 38], aGate: [140, 22],
      roadW: [46, 14], roadE: [122, 14], castle: [84, 16], defend: [84, 10],
    },
  };
  // the centre of block (x, z) in metres
  const toWorld = ([x, z]) => ({ x: (x + 0.5 - NX / 2) * B, z: (z + 0.5 - NZ / 2) * B });

  // ── where a body can stand: the top of a solid block with two free layers over it ──
  // returns, per column, the heights (metres) a fighter can stand at
  function surfaces(map) {
    const { get } = map, out = new Array(NX * NZ);
    const free = (x, y, z) => { const m = get(x, y, z); return !m || !MAT[m].solid; };
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      const list = [];
      for (let y = 0; y < NY - 2; y++) {
        const m = get(x, y, z);
        if (y > 0 && (!m || !MAT[m].solid)) continue;
        if (!free(x, y + 1, z) || !free(x, y + 2, z)) continue;
        list.push(y * B - (y > 0 && MAT[m].half ? B / 2 : 0));
      }
      out[z * NX + x] = list;
    }
    return out;
  }
  // a coarse walk graph on whole blocks (the game builds a finer one with the real body): a block is walkable when a
  // body fits there (not pinched between two walls), and neighbours link when the step up is at most 0.68 m
  function walkGraph(map) {
    const S = surfaces(map), nodes = [], at = new Map();
    const STEP = 0.68, DROP = 2.6;
    const key = (x, z, h) => z * NX + x + ":" + h.toFixed(3);
    const blocked = (x, z, h) => { const s = S[z * NX + x]; return !s || !s.some((v) => Math.abs(v - h) <= STEP); };
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) for (const h of S[z * NX + x]) {
      if (x === 0 || z === 0 || x === NX - 1 || z === NZ - 1) continue;
      if ((blocked(x - 1, z, h) && blocked(x + 1, z, h)) || (blocked(x, z - 1, h) && blocked(x, z + 1, h))) continue;
      at.set(key(x, z, h), nodes.length);
      nodes.push({ x, z, h });
    }
    const edges = nodes.map(() => []);
    nodes.forEach((n, i) => {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = n.x + dx, Z = n.z + dz, s = S[Z * NX + X] || [];
        let best = -1, bd = 1e9;
        for (const h of s) {
          const j = at.get(key(X, Z, h));
          if (j === undefined || h - n.h > STEP || n.h - h > DROP) continue;
          Math.abs(h - n.h) < bd && ((bd = Math.abs(h - n.h)), (best = j));
        }
        best >= 0 && edges[i].push(best);
      }
    });
    const nodeAt = (x, z, h = 0) => { const s = S[z * NX + x] || []; let best = -1, bd = 1e9; for (const v of s) { const j = at.get(key(x, z, v)); j !== undefined && Math.abs(v - h) < bd && ((bd = Math.abs(v - h)), (best = j)); } return best; };
    const reach = (from) => { const seen = new Uint8Array(nodes.length), q = [from]; seen[from] = 1; for (let k = 0; k < q.length; k++) for (const j of edges[q[k]]) seen[j] || ((seen[j] = 1), q.push(j)); return seen; };
    return { nodes, edges, nodeAt, reach, surfaces: S };
  }

  const API = { B, NX, NY, NZ, TILES, MAT, M, PLACES, build, surfaces, walkGraph, toWorld, bounds: { minX: (-NX / 2) * B, maxX: (NX / 2) * B, minZ: (-NZ / 2) * B, maxZ: (NZ / 2) * B } };
  if (typeof module === "object" && module.exports) module.exports = API;
  else root.BLOCKTOWN_LAYOUT = API;
})(typeof window !== "undefined" ? window : globalThis);
