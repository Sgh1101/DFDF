// Floor plan generator for the abandoned hospital map (js/hospital-plan.js).
//
//   node scripts/gen-hospital.js            validate, then write js/hospital-plan.js
//   node scripts/gen-hospital.js --check    validate only
//
// The plan is baked: the game never runs this file, so every player gets the same
// building. One cell is 2.5 m (the bots' navigation cell) and walls sit on cell
// edges, so every 1-cell corridor or door is walkable for bots. Three levels 4 m
// apart (ground, second floor, third floor + deck). Upper floors are real: slabs you
// can walk under, stairs you climb, an atrium you can shoot down into.
"use strict";
const fs = require("node:fs"), path = require("node:path");

const C = 48, R = 40, BR = 32; // columns, rows (lot included), building rows
const CELL = 2.5, OX = -60, OZ = -40, FH = 4.0, SLAB = 0.4;
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const grid = (h, w, v) => Array.from({ length: h }, () => Array(w).fill(v));
const cx = (c) => OX + (c + 0.5) * CELL, cz = (r) => OZ + (r + 0.5) * CELL; // cell centre in metres
const ex = (c) => OX + c * CELL, ez = (r) => OZ + r * CELL; // cell edge in metres

// edge kinds: 0 open, 1 wall, 2 balustrade (waist high), 3 deck parapet, 4 fence
class Level {
  constructor(n) { this.n = n; this.f = grid(R, C, 0); this.z = grid(R, C, " "); this.V = grid(R, C + 1, 0); this.H = grid(R + 1, C, 0); this.hole = grid(R, C, 0); this.exempt = new Set(); }
  fill(c0, r0, c1, r1, zone) { for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) { this.f[r][c] = 1; this.z[r][c] = zone; } }
  box(c0, r0, c1, r1, kind = 1) { for (let c = c0; c < c1; c++) { this.H[r0][c] = kind; this.H[r1][c] = kind; } for (let r = r0; r < r1; r++) { this.V[r][c0] = kind; this.V[r][c1] = kind; } }
  room(c0, r0, c1, r1, zone) { this.fill(c0, r0, c1, r1, zone); this.box(c0, r0, c1, r1); }
  // open n cells of the wall on side N/S/W/E of cell (c, r)
  door(side, c, r, n = 1) {
    for (let i = 0; i < n; i++) {
      if (side === "N") this.H[r][c + i] = 0; else if (side === "S") this.H[r + 1][c + i] = 0;
      else if (side === "W") this.V[r + i][c] = 0; else this.V[r + i][c + 1] = 0;
    }
  }
  wallH(r, c0, c1, kind = 1) { for (let c = c0; c < c1; c++) this.H[r][c] = kind; }
  wallV(c, r0, r1, kind = 1) { for (let r = r0; r < r1; r++) this.V[r][c] = kind; }
  open(c0, r0, c1, r1) { for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) { if (c > c0) this.V[r][c] = 0; if (r > r0) this.H[r][c] = 0; } }
  holeRect(c0, r0, c1, r1, kind = 1) { for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) this.hole[r][c] = kind; }
  zoneRect(c0, r0, c1, r1, zone) { for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) this.f[r][c] && (this.z[r][c] = zone); }
}

// maze of 2x2-cell rooms. `reserve`: super cells left out (stairs); the caller walls/opens them.
function maze(L, c0, r0, c1, r1, zone, seed, opt = {}) {
  const rand = rng(seed), sw = (c1 - c0) / 2, sh = (r1 - r0) / 2, braid = opt.braid ?? 0.22, full = opt.full ?? 0.3;
  const key = (c, r) => c + "," + r, reserved = new Set((opt.reserve || []).map(([c, r]) => key(c, r)));
  const sc = (c, r) => [c0 + c * 2, r0 + r * 2];
  L.fill(c0, r0, c1, r1, zone);
  for (let r = 0; r < sh; r++) for (let c = 0; c < sw; c++) {
    const [x, y] = sc(c, r);
    if (c > 0) { L.V[y][x] = 1; L.V[y + 1][x] = 1; }
    if (r > 0) { L.H[y][x] = 1; L.H[y][x + 1] = 1; }
  }
  L.box(c0, r0, c1, r1);
  const D = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // N S W E
  const openDir = (c, r, d) => {
    const [x, y] = sc(c, r), both = rand() < full, k = rand() < 0.5 ? 0 : 1;
    for (let i = 0; i < 2; i++) { if (!both && i !== k) continue;
      if (d === 0) L.H[y][x + i] = 0; else if (d === 1) L.H[y + 2][x + i] = 0; else if (d === 2) L.V[y + i][x] = 0; else L.V[y + i][x + 2] = 0; }
  };
  const seen = new Set(); let start = null;
  for (let r = 0; r < sh && !start; r++) for (let c = 0; c < sw; c++) if (!reserved.has(key(c, r))) { start = [c, r]; break; }
  const stack = [start]; seen.add(key(...start));
  while (stack.length) {
    const [c, r] = stack[stack.length - 1], nb = [];
    D.forEach(([dc, dr], d) => { const a = c + dc, b = r + dr; a >= 0 && b >= 0 && a < sw && b < sh && !seen.has(key(a, b)) && !reserved.has(key(a, b)) && nb.push([a, b, d]); });
    if (!nb.length) { stack.pop(); continue; }
    const [a, b, d] = nb[Math.floor(rand() * nb.length)];
    openDir(c, r, d); seen.add(key(a, b)); stack.push([a, b]);
  }
  for (let r = 0; r < sh; r++) for (let c = 0; c < sw; c++) {
    if (reserved.has(key(c, r))) continue;
    for (const d of [1, 3]) { const a = c + D[d][0], b = r + D[d][1];
      if (a >= sw || b >= sh || reserved.has(key(a, b))) continue;
      const [x, y] = sc(c, r), wall = d === 1 ? L.H[y + 2][x] && L.H[y + 2][x + 1] : L.V[y][x + 2] && L.V[y + 1][x + 2];
      wall && rand() < braid && openDir(c, r, d); }
  }
  for (const [c, r] of opt.reserve || []) { const [x, y] = sc(c, r); L.box(x, y, x + 2, y + 2); }
}

// ═════════════ the building ═════════════
const L0 = new Level(0), L1 = new Level(1), L2 = new Level(2);
const LV = [L0, L1, L2];
// stairs: [from level, bottom-left cell col, bottom cell row, ascent direction N]; 2 wide x 4 long, 8 steps of 0.5 m
const STAIRS = [
  [0, 6, 21, "N"], // S1 ground -> second floor, west ward
  [0, 40, 21, "N"], // S2 east ward
  [1, 10, 17, "N"], // S3 second -> third, west
  [1, 36, 17, "N"], // S4 east
];
const runCells = (s) => { const [, c, r] = s, out = []; for (let k = 0; k < 4; k++) for (let w = 0; w < 2; w++) out.push([c + w, r - k, k]); return out; };

// ── ground ──
L0.fill(0, BR, C, R, "x"); L0.box(0, BR, C, R, 4); // the lot, fenced
L0.fill(0, 0, C, BR, "h"); L0.box(0, 0, C, BR);
// A: operating suite (NW). back corridor row 0, rooms rows 1-6, scrub corridor rows 7-9
const suite = (x0, kind) => { // x0 = first column of the 16-wide block
  const z = kind === "A" ? "o" : "p";
  L0.room(x0, 1, x0 + 4, 7, z); L0.room(x0 + 4, 1, x0 + 12, 7, z); L0.room(x0 + 12, 1, x0 + 16, 7, z);
  L0.door("N", x0 + 7, 1, 1); L0.door("N", x0 + 1, 1, 1); L0.door("N", x0 + 14, 1, 1); // back doors
  L0.door("S", x0 + 6, 6, 2); L0.door("S", x0 + 1, 6, 2); L0.door("S", x0 + 13, 6, 2); // front doors
  L0.door("W", x0 + 4, 3, 2); L0.door("W", x0 + 12, 3, 2); // between the rooms
};
suite(0, "A"); suite(32, "B");
// ICU (defenders): back corridor row 0, side corridors cols 16-17 / 30-31, ICU rows 1-6, front hall rows 7-9
L0.room(18, 1, 30, 7, "i");
L0.door("N", 22, 1, 2); L0.door("S", 20, 6, 2); L0.door("S", 26, 6, 2); L0.door("W", 18, 3, 2); L0.door("W", 30, 3, 2);
L0.wallV(16, 0, 10); L0.wallV(32, 0, 10); // the ICU block sides
L0.door("W", 16, 0, 1); L0.door("W", 32, 0, 1); // back corridor links
L0.door("W", 16, 8, 2); L0.door("W", 32, 8, 2); // front links (scrub corridor <-> ICU hall)
L0.wallV(18, 7, 10, 0); L0.wallV(30, 7, 10, 0); // side corridors open into the front hall
// the north band meets the gallery (rows 10-11): walls with doors
L0.wallH(10, 0, C);
for (const c of [3, 10, 20, 26, 35, 42]) L0.door("N", c, 10, 2);
// gallery partitions: a 1-cell choke each
L0.wallV(16, 10, 12); L0.wallV(32, 10, 12); L0.door("W", 16, 11, 1); L0.door("W", 32, 11, 1);
// wards: west maze, east maze; the ring (connectors cols 16-17 / 30-31, corridor rows 24-25); the atrium
maze(L0, 0, 12, 16, 26, "w", 1101, { reserve: [[3, 3], [3, 4]], braid: 0.25 });
maze(L0, 32, 12, 48, 26, "w", 2202, { reserve: [[4, 3], [4, 4]], braid: 0.25 });
L0.fill(16, 12, 18, 26, "h"); L0.fill(30, 12, 32, 26, "h"); L0.fill(16, 24, 32, 26, "h");
L0.wallH(12, 16, 32); L0.door("N", 16, 12, 2); L0.door("N", 30, 12, 2); // connectors open to the gallery
L0.fill(18, 12, 30, 24, "a");
L0.wallV(18, 12, 24); L0.wallV(30, 12, 24); L0.wallH(12, 18, 30); L0.wallH(24, 18, 30);
L0.door("W", 18, 14, 2); L0.door("W", 18, 19, 2); L0.door("W", 30, 14, 2); L0.door("W", 30, 19, 2); // ring -> atrium
L0.door("N", 20, 12, 2); L0.door("N", 26, 12, 2); // gallery -> atrium
L0.door("N", 19, 24, 2); L0.door("N", 23, 24, 2); L0.door("N", 27, 24, 2); // corridor -> atrium
L0.wallV(16, 12, 26); L0.wallV(32, 12, 26); // wards <-> ring walls, then gates:
for (const r of [14, 20]) { L0.door("W", 16, r, 2); L0.door("W", 32, r, 2); }
L0.wallH(12, 0, 16); L0.wallH(12, 32, 48); for (const c of [4, 12]) L0.door("N", c, 12, 2); for (const c of [34, 42]) L0.door("N", c, 12, 2);
// south band: ER, lobby, dock
L0.room(0, 26, 16, 32, "e"); L0.room(16, 26, 32, 32, "l"); L0.room(32, 26, 48, 32, "d");
for (const c of [4, 10]) L0.door("N", c, 26, 2); for (const c of [36, 42]) L0.door("N", c, 26, 2); // wards <-> ER / dock
L0.door("N", 17, 26, 2); L0.door("N", 22, 26, 4); L0.door("N", 29, 26, 2); // corridor <-> lobby
L0.door("W", 16, 28, 2); L0.door("W", 32, 28, 2); // ER-lobby-dock
// low partitions (waist high: cover you can stand behind) split the big south rooms into bays
for (const c of [3, 13]) L0.wallV(c, 28, 32, 2); L0.wallH(29, 7, 10, 2);
for (const c of [19, 28]) L0.wallV(c, 29, 32, 2);
for (const c of [35, 44]) L0.wallV(c, 29, 32, 2); L0.wallH(29, 39, 42, 2);
// entrances to the lot
L0.door("N", 6, BR, 3); L0.door("N", 22, BR, 4); L0.door("N", 38, BR, 3);
// stairs S1, S2: the run is enclosed, its low (south) end opens (see reserveBox below)
// ── second floor ──
const stairHole = (s) => s[0] + 1; // the level whose floor has the hole
L1.fill(0, 0, C, BR, "h"); L1.box(0, 0, C, BR);
maze(L1, 0, 0, C, 10, "w", 3303, { braid: 0.3, full: 0.35 }); // the north wards
L1.fill(0, 10, C, 12, "h"); L1.wallH(10, 0, C); L1.wallH(12, 0, 16); L1.wallH(12, 32, C);
for (const c of [3, 8, 14, 20, 26, 33, 39, 44]) L1.door("N", c, 10, 2);
L1.wallV(16, 10, 12); L1.wallV(32, 10, 12); L1.door("W", 16, 11, 1); L1.door("W", 32, 11, 1);
maze(L1, 0, 12, 16, 26, "w", 4404, { reserve: [[3, 3], [3, 4], [5, 1], [5, 2]], braid: 0.25 });
maze(L1, 32, 12, 48, 26, "w", 5505, { reserve: [[4, 3], [4, 4], [2, 1], [2, 2]], braid: 0.25 });
L1.fill(16, 12, 18, 26, "h"); L1.fill(30, 12, 32, 26, "h"); L1.fill(16, 24, 32, 26, "h");
L1.wallH(12, 16, 32); L1.door("N", 16, 12, 2); L1.door("N", 30, 12, 2);
L1.fill(18, 12, 30, 24, "a"); L1.holeRect(18, 12, 30, 24); // the atrium: no floor here
L1.wallV(16, 12, 26); L1.wallV(32, 12, 26);
for (const r of [14, 20]) { L1.door("W", 16, r, 2); L1.door("W", 32, r, 2); }
for (const c of [4, 12]) L1.door("N", c, 12, 2); for (const c of [34, 42]) L1.door("N", c, 12, 2);
L1.wallH(26, 0, C);
maze(L1, 0, 26, C, 32, "w", 6606, { braid: 0.3, full: 0.35 }); // the south wards
for (const c of [4, 10, 17, 22, 28, 36, 42]) L1.door("N", c, 26, 2);
// stair holes (from the level below) and solid runs (up to the next level)
// the maze boxed each reserved super cell: open the inside, then wall the run / open the hole's rim
const reserveBox = (Lv, s, hole) => {
  const [, c, r] = s, c0 = c, r0 = r - 3, c1 = c + 2, r1 = r + 1;
  Lv.open(c0, r0, c1, r1);
  if (hole) { Lv.box(c0, r0, c1, r1, 0); Lv.holeRect(c0, r0, c1, r1, 2); } else { Lv.box(c0, r0, c1, r1, 1); Lv.door("S", c, r, 2); }
  Lv.zoneRect(c0, r0, c1, r1, "s");
};
for (const s of STAIRS) { s[0] === 0 && reserveBox(L1, s, true); s[0] === 1 && reserveBox(L1, s, false); }
for (const s of STAIRS) s[0] === 0 && reserveBox(L0, s, false);

// ── third floor ──
L2.fill(0, 0, C, BR, "t"); L2.box(0, 0, C, BR, 0);
const wingRooms = (c0, c1, seed, reserve) => { maze(L2, c0, 6, c1, 26, "w", seed, { braid: 0.35, full: 0.4, reserve }); };
wingRooms(2, 16, 7707, [[4, 4], [4, 5]]); wingRooms(32, 46, 8808, [[2, 4], [2, 5]]);
// the decks around: gates from the wing mazes
for (const [c, r] of [[3, 6], [12, 6], [3, 25], [12, 25], [33, 6], [42, 6], [35, 25], [44, 25]]) { r === 6 && L2.door("N", c, 6, 2); r === 25 && L2.door("S", c, 25, 2); }
for (const r of [8, 14, 20]) { L2.door("W", 2, r, 2); L2.door("W", 46, r + 0, 2); } // west gate col 2 edge, east col 46 edge
// the atrium shaft and the bridge across it (rows 17-18)
L2.holeRect(18, 12, 30, 24);
for (let c = 18; c < 30; c++) for (const r of [17, 18]) L2.hole[r][c] = 0;
for (let c = 18; c < 30; c++) for (const r of [17, 18]) L2.z[r][c] = "b";
L2.zoneRect(16, 12, 18, 26, "t");
for (const s of STAIRS) s[0] === 1 && reserveBox(L2, s, true);

// ── derived edges ──
const exempt = (Lv, kind, r, c) => Lv.exempt.add(kind + r + "," + c);
// stair holes: the top end (north) of each hole stays open towards the exit cell
for (const s of STAIRS) { const Lv = LV[stairHole(s)], [, c, r] = s; exempt(Lv, "H", r - 3, c); exempt(Lv, "H", r - 3, c + 1); }
function finalize(Lv) {
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!Lv.f[r][c]) continue;
    const sides = [["H", r, c, r - 1, c], ["H", r + 1, c, r + 1, c], ["V", r, c, r, c - 1], ["V", r, c + 1, r, c + 1]];
    for (const [k, er, ec, nr, nc] of sides) {
      const E = k === "H" ? Lv.H : Lv.V, inside = nr >= 0 && nc >= 0 && nr < R && nc < C && Lv.f[nr][nc];
      if (!inside) { if (E[er][ec] === 0) E[er][ec] = Lv.n === 2 && Lv.z[r][c] === "t" ? 3 : 1; continue; }
      if (Lv.hole[r][c] !== Lv.hole[nr][nc] && E[er][ec] === 0 && !Lv.exempt.has(k + er + "," + ec)) E[er][ec] = 2;
    }
  }
}
LV.forEach(finalize);

// ═════════════ queries on the plan ═════════════
// walls are closed edges; a cell moves to a neighbour through an open (0) edge
const open4 = (Lv, c, r) => {
  const out = [];
  if (r > 0 && Lv.H[r][c] === 0) out.push([c, r - 1]);
  if (r < R - 1 && Lv.H[r + 1][c] === 0) out.push([c, r + 1]);
  if (c > 0 && Lv.V[r][c] === 0) out.push([c - 1, r]);
  if (c < C - 1 && Lv.V[r][c + 1] === 0) out.push([c + 1, r]);
  return out;
};
const walk = (Lv, c, r) => Lv.f[r][c] && !Lv.hole[r][c];

// ═════════════ props, lights, labels ═════════════
const DIM = { // [w (x), d (z), h]; collider at rot 0, swapped at rot 1
  bed: [1, 2.1, 0.9], gurney: [0.9, 2, 0.95], table: [1.1, 2.2, 1.05], cabinet: [0.7, 2, 2.1], shelf: [0.7, 4.6, 2.3], desk: [2.6, 1, 1.1],
  bench: [2.4, 0.7, 0.8], crate: [1.3, 1.3, 1.3], wheelchair: [0.7, 0.9, 0.9], mri: [2.6, 3.4, 2.4], vending: [1.1, 0.9, 1.9], ambulance: [2.4, 5.8, 2.5],
  car: [2.0, 4.3, 1.5], rubble: [2.2, 2.2, 1.0], ac: [2.2, 1.6, 1.4], tank: [2.6, 2.6, 3.0], dumpster: [1.9, 1.3, 1.4], counter: [3.6, 0.9, 1.1], pillar: [0.5, 0.5, 4.0],
};
const props = [], lights = [], labels = [], signs = [];
const BLOCK = LV.map(() => grid(R, C, 0)); // cells a prop makes unwalkable (like the bots' grid)
// rot is a quarter turn (0..3); odd turns swap the footprint. Cabinets and shelves face +x at rot 0, counters/desks/benches face +z.
const propBox = (kind, x, z, rot) => { const [w, d, h] = DIM[kind], hw = (rot & 1 ? d : w) / 2, hd = (rot & 1 ? w : d) / 2; return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, h }; };
const cellsHit = (b, pad = 0.95) => { const out = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const x = cx(c), z = cz(r); if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) out.push([c, r]); } return out; };
const reachableAll = (n, extraBlocked) => { // every walkable, unblocked cell of the level still joined?
  const Lv = LV[n], blk = BLOCK[n], ok = (c, r) => walk(Lv, c, r) && !blk[r][c] && !extraBlocked.has(c + "," + r) && !stairCells.has(n + ":" + c + "," + r);
  let start = null, total = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (ok(c, r)) { total++; start || (start = [c, r]); }
  if (!start) return true;
  const seen = new Set([start[0] + "," + start[1]]), q = [start];
  while (q.length) { const [c, r] = q.pop(); for (const [a, b] of open4(Lv, c, r)) { const k = a + "," + b; !seen.has(k) && ok(a, b) && (seen.add(k), q.push([a, b])); } }
  return seen.size === total;
};
const stairCells = new Set();
for (const s of STAIRS) for (const [c, r] of runCells(s)) { stairCells.add(s[0] + ":" + c + "," + r); stairCells.add((s[0] + 1) + ":" + c + "," + r); }
const approach = new Set(); // keep the cells before and after a stair clear
for (const s of STAIRS) { const [fr, c, r] = s; for (const w of [0, 1]) { approach.add(fr + ":" + (c + w) + "," + (r + 1)); approach.add((fr + 1) + ":" + (c + w) + "," + (r - 4)); } }
// add a prop; refuse it when it would cut the level apart or sit on a stair / door cell
const WHY = {};
function addProp(n, kind, x, z, rot = 0, tag) {
  const Lv = LV[n], b = propBox(kind, x, z, rot), tall = b.h > 0.68, no = (why) => (WHY[why] = (WHY[why] || 0) + 1, false);
  // the box must lie inside walkable cells and not straddle a wall line
  const c0 = Math.floor((b.x0 - OX) / CELL), c1 = Math.floor((b.x1 - OX - 1e-6) / CELL), r0 = Math.floor((b.z0 - OZ) / CELL), r1 = Math.floor((b.z1 - OZ - 1e-6) / CELL);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!(r >= 0 && c >= 0 && r < R && c < C && walk(Lv, c, r))) return no("outside");
    if (isDoorCell(Lv, c, r)) return no("door");
    if (c > c0 && Lv.V[r][c] === 1) return no("crosses wall");
    if (r > r0 && Lv.H[r][c] === 1) return no("crosses wall");
  }
  const cs = tall ? cellsHit(b).filter(([c, r]) => walk(Lv, c, r)) : [];
  for (const [c, r] of cs) if (stairCells.has(n + ":" + c + "," + r) || approach.has(n + ":" + c + "," + r) || isDoorCell(Lv, c, r)) return no("keeps clear");
  if (!reachableAll(n, new Set(cs.map(([c, r]) => c + "," + r)))) return no("cuts");
  for (const [c, r] of cs) BLOCK[n][r][c] = 1;
  props.push([n, kind, +x.toFixed(2), +z.toFixed(2), rot, tag || 0]);
  return true;
}
function isDoorCell(Lv, c, r) { // a cell with a door in one of its edges (an open edge in a wall line)
  const wallish = (k) => k === 1;
  const hN = Lv.H[r][c] === 0 && ((c > 0 && wallish(Lv.H[r][c - 1])) || (c < C - 1 && wallish(Lv.H[r][c + 1])));
  const hS = Lv.H[r + 1][c] === 0 && ((c > 0 && wallish(Lv.H[r + 1][c - 1])) || (c < C - 1 && wallish(Lv.H[r + 1][c + 1])));
  const vW = Lv.V[r][c] === 0 && ((r > 0 && wallish(Lv.V[r - 1][c])) || (r < R - 1 && wallish(Lv.V[r + 1][c])));
  const vE = Lv.V[r][c + 1] === 0 && ((r > 0 && wallish(Lv.V[r - 1][c + 1])) || (r < R - 1 && wallish(Lv.V[r + 1][c + 1])));
  return hN || hS || vW || vE;
}
const R1 = rng(4242);
const cellsOf = (n, zones) => { const out = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (walk(LV[n], c, r) && zones.includes(LV[n].z[r][c])) out.push([c, r]); return out; };
const shuffle = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const nearWall = (Lv, c, r) => { // which side of the cell has a wall: N S W E
  const out = []; Lv.H[r][c] === 1 && out.push("N"); Lv.H[r + 1][c] === 1 && out.push("S"); Lv.V[r][c] === 1 && out.push("W"); Lv.V[r][c + 1] === 1 && out.push("E"); return out;
};
// a prop in a corner of a cell, tucked against a wall when it has one
const FRONT_Z = new Set(["counter", "desk", "bench", "vending"]);
function tuck(n, kind, c, r, rand) {
  const Lv = LV[n], walls = nearWall(Lv, c, r), side = walls.length ? walls[Math.floor(rand() * walls.length)] : "N";
  const rot = FRONT_Z.has(kind) ? { N: 0, E: 3, S: 2, W: 1 }[side] : { W: 0, N: 3, E: 2, S: 1 }[side];
  const [w, d] = DIM[kind], hw = (rot & 1 ? d : w) / 2, hd = (rot & 1 ? w : d) / 2;
  let x = cx(c), z = cz(r);
  if (side === "N") z = ez(r) + 0.25 + hd; else if (side === "S") z = ez(r + 1) - 0.25 - hd; else if (side === "W") x = ex(c) + 0.25 + hw; else x = ex(c + 1) - 0.25 - hw;
  return addProp(n, kind, x, z, rot);
}
function scatter(n, zones, kinds, count, seed) {
  const rand = rng(seed), cs = shuffle(cellsOf(n, zones), rand);
  let made = 0;
  for (const [c, r] of cs) { if (made >= count) break; if (tuck(n, kinds[Math.floor(rand() * kinds.length)], c, r, rand)) made++; }
  return made;
}
// the hand-made places
const put = (n, kind, c, r, rot = 0, dx = 0, dz = 0) => addProp(n, kind, cx(c) + dx, cz(r) + dz, rot);
// pillars on cell corners (0.5 m: they do not block the bots' cells)
const pillar = (n, c, r) => { const x = ex(c), z = ez(r); props.push([n, "pillar", x, z, 0, 0]); };
// ── ground ──
// A: three operating tables on the plant zone, lamps over them, a scrub sink wall
for (const dc of [-2, 0, 2]) put(0, "table", 8 + dc - (dc === 0 ? 0 : 0), 3, 0, dc === 0 ? 0 : 0, 0.0);
put(0, "cabinet", 4, 1, 3, 0, -0.6); put(0, "cabinet", 11, 1, 3, 0, -0.6); put(0, "counter", 7, 6, 0, 1.25, -0.2);
for (const c of [1, 14]) { put(0, "bed", c, 2, 0, 0, 0.1); put(0, "bed", c, 5, 0, 0, -0.2); }
// B: shelf rows (the store's aisles) and crates
for (const c of [34, 36, 38, 42, 44]) put(0, "shelf", c, 3, 0, 0, 0);
put(0, "crate", 33, 8, 0, 0, 0);
// ICU: nurse island and beds
put(0, "counter", 26, 1, 0, 1.25, -0.45);
for (const c of [19, 28]) { put(0, "bed", c, 2, 0, 0, 0); put(0, "bed", c, 5, 0, 0, 0); }
// atrium: columns on the cell corners in two rows, a wrecked reception, rubble
for (const c of [20, 24, 28]) for (const r of [14, 18, 22]) pillar(0, c, r);
// ER: rows of beds
for (const c of [1, 3, 5, 9, 11, 13]) { put(0, "gurney", c, 28, 0, 0, 0); }
put(0, "wheelchair", 7, 30, 0, 0, 0); put(0, "wheelchair", 8, 30, 0, 0, 0);
// lobby: reception desk, benches, vending
put(0, "counter", 23, 28, 0, 0, 0); put(0, "counter", 24, 28, 0, 0, 0);
for (const c of [17, 19, 28, 30]) put(0, "bench", c, 30, 1, 0, 0);
put(0, "vending", 29, 27, 0, 0, 0);
// dock: ambulances and crates
put(0, "ambulance", 34, 29, 1, 0, 0); put(0, "ambulance", 45, 28, 1, 0, 0); put(0, "crate", 41, 27, 0, 0, 0); put(0, "crate", 36, 27, 0, 0, 0);
// the lot: cars, ambulances, a dumpster
for (const [k, c, r, rot] of [["car", 3, 35, 1], ["car", 12, 34, 1], ["ambulance", 15, 37, 0], ["car", 20, 36, 0], ["car", 30, 35, 1], ["ambulance", 36, 36, 1], ["car", 44, 36, 0], ["dumpster", 7, 38, 0], ["car", 27, 38, 1]]) addProp(0, k, cx(c), cz(r), rot);
// wards: beds and cabinets in some rooms, with a few wheelchairs
scatter(0, ["w"], ["bed", "bed", "cabinet", "gurney", "wheelchair", "crate"], 38, 11);
// ── second floor ──
scatter(1, ["w"], ["bed", "bed", "cabinet", "gurney", "wheelchair", "rubble", "crate"], 70, 21);
scatter(1, ["h"], ["bench", "wheelchair", "rubble", "gurney"], 14, 22);
// ── third floor ──
scatter(2, ["w"], ["bed", "cabinet", "rubble", "crate", "wheelchair"], 26, 31);
scatter(2, ["t"], ["ac", "ac", "tank", "crate", "rubble"], 22, 32);

// lights: [level, x, z, flicker 0/1/2, colour 0 white 1 cold 2 warm 3 red]
const lightSeed = rng(777);
for (const n of [0, 1, 2]) for (const [r, row] of LV[n].f.entries()) for (const [c, v] of row.entries()) {
  if (!v || LV[n].hole[r][c] || LV[n].z[r][c] === "t" || LV[n].z[r][c] === "x" || LV[n].z[r][c] === "b") continue;
  if ((c + r * 2) % 4 === 0) { const q = lightSeed(); q < 0.6 && lights.push([n, +cx(c).toFixed(2), +cz(r).toFixed(2), q < 0.1 ? 2 : q < 0.25 ? 1 : 0, LV[n].z[r][c] === "o" ? 1 : LV[n].z[r][c] === "e" ? 3 : 0]); }
}
// signs on walls: [text, x, y, z, rotY]
const sign = (t, c, r, side, n = 0, y = 3.0) => { const x = side === "W" ? ex(c) + 0.22 : side === "E" ? ex(c + 1) - 0.22 : cx(c), z = side === "N" ? ez(r) + 0.22 : side === "S" ? ez(r + 1) - 0.22 : cz(r); signs.push([t, +x.toFixed(2), +(n * FH + y).toFixed(2), +z.toFixed(2), side === "N" ? 0 : side === "S" ? Math.PI : side === "W" ? Math.PI / 2 : -Math.PI / 2]); };
sign("A 수술실", 7, 1, "N"); sign("B 약제 창고", 40, 1, "N"); sign("중환자실", 23, 1, "N"); sign("응급실", 6, 26, "N", 0, 3.2); sign("접수 · 로비", 24, 26, "N", 0, 3.2); sign("하역장", 39, 26, "N", 0, 3.2);
sign("중앙 홀", 24, 12, "N", 0, 3.2); sign("병동 W", 1, 12, "N", 0, 3.0); sign("병동 E", 46, 12, "N", 0, 3.0);
sign("2F · 병동", 17, 24, "N", 1, 3.0); sign("3F · 옥상", 17, 24, "N", 2, 3.0);
// outside the three entrances (the sign faces the lot, +z)
for (const [t, c0, n] of [["응급실 ER", 6, 3], ["정문 · 접수", 22, 4], ["하역장", 38, 3]]) signs.push([t, +(ex(c0) + (n * CELL) / 2).toFixed(2), 3.4, +(ez(BR) + 0.28).toFixed(2), 0]);
// node points for the bots
const nodes = {
  attack: [cx(24), cz(37)], defend: [cx(24), cz(3)],
  aSite: [cx(7), cz(3)], aFront: [cx(7), cz(8)], aBack: [cx(7), cz(0)],
  bSite: [cx(40), cz(3)], bFront: [cx(40), cz(8)], bBack: [cx(40), cz(0)],
  gW: [cx(8), cz(10.5)], gC: [cx(24), cz(10.5)], gE: [cx(39), cz(10.5)],
  atrium: [cx(24), cz(18)], atN: [cx(24), cz(11.5)], atS: [cx(24), cz(24.5)],
  ringW: [cx(16.5), cz(18)], ringE: [cx(31.5), cz(18)],
  lobby: [cx(24), cz(29)], er: [cx(7), cz(29)], dock: [cx(40), cz(29)],
  wardW: [cx(9), cz(22.5)], wardE: [cx(38), cz(22.5)], lotC: [cx(24), cz(34)],
  icuF: [cx(24), cz(8.5)], scrubW: [cx(1), cz(8)], scrubE: [cx(46), cz(8)],
};

// ═════════════ validate ═════════════
function validate() {
  const bad = [];
  // 1. the bots' view of the ground floor: the engine blocks a cell when anything taller than 0.68 is within 0.95 m of its centre
  const blk = BLOCK[0].map((row) => row.slice());
  for (const s of STAIRS.filter((s) => s[0] === 0)) for (const [c, r, k] of runCells(s)) k >= 1 && (blk[r][c] = 1); // steps above 0.68 m
  const okc = (c, r) => walk(L0, c, r) && !blk[r][c];
  const startC = Math.floor(nodes.attack[0] - OX) / CELL | 0, startR = Math.floor((nodes.attack[1] - OZ) / CELL);
  const seen = new Set([startC + "," + startR]), q = [[startC, startR]];
  while (q.length) { const [c, r] = q.pop(); for (const [a, b] of open4(L0, c, r)) { const k = a + "," + b; !seen.has(k) && okc(a, b) && (seen.add(k), q.push([a, b])); } }
  let total = 0, lost = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (okc(c, r)) { total++; !seen.has(c + "," + r) && lost.push([c, r]); }
  lost.length && bad.push("ground cells unreachable for bots: " + lost.length + " e.g. " + JSON.stringify(lost.slice(0, 6)));
  for (const [name, [x, z]] of Object.entries(nodes)) { const c = Math.floor((x - OX) / CELL), r = Math.floor((z - OZ) / CELL); (!okc(c, r) || !seen.has(c + "," + r)) && bad.push("node " + name + " not reachable at cell " + c + "," + r); }
  // 2. people: every walkable cell on every level is reachable, stairs link the levels
  const key = (n, c, r) => n + ":" + c + "," + r;
  const links = new Map();
  for (const s of STAIRS) { const [fr, c, r] = s; for (const w of [0, 1]) { const lo = key(fr, c + w, r + 1), hi = key(fr + 1, c + w, r - 4); (links.get(lo) || links.set(lo, []).get(lo)).push(hi); (links.get(hi) || links.set(hi, []).get(hi)).push(lo); } }
  const okp = (n, c, r) => walk(LV[n], c, r) && !BLOCK[n][r][c] && !(n === 0 && stairCells.has(key(n, c, r)) && false);
  const stairRunCell = (n, c, r) => STAIRS.some((s) => s[0] === n && runCells(s).some(([a, b]) => a === c && b === r));
  const seen3 = new Set([key(0, startC, startR)]), q3 = [[0, startC, startR]];
  while (q3.length) {
    const [n, c, r] = q3.pop();
    const nxt = open4(LV[n], c, r).map(([a, b]) => [n, a, b]).concat((links.get(key(n, c, r)) || []).map((k) => { const [m, rest] = k.split(":"), [a, b] = rest.split(","); return [+m, +a, +b]; }));
    for (const [m, a, b] of nxt) { const k = key(m, a, b); if (!seen3.has(k) && okp(m, a, b) && !(stairRunCell(m, a, b))) { seen3.add(k); q3.push([m, a, b]); } }
  }
  for (const n of [0, 1, 2]) {
    const lostN = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (okp(n, c, r) && !stairRunCell(n, c, r) && !seen3.has(key(n, c, r))) lostN.push([c, r]);
    lostN.length && bad.push("level " + n + ": " + lostN.length + " cells people cannot reach e.g. " + JSON.stringify(lostN.slice(0, 8)));
  }
  // 3. edges that are open but lead nowhere (floor next to void without a rail)
  return { bad, total, reached: seen.size };
}

// ═════════════ the SVG preview ═════════════
const ZC = { x: "#8c9096", h: "#d9d5c8", w: "#cfe2d2", o: "#a9d5e2", i: "#b8c4d9", p: "#e6d8a8", a: "#ece1c5", l: "#f1e6cf", e: "#f0c9c6", d: "#b9bbbf", s: "#7da4d9", t: "#c8cdd3", b: "#9fd0a0" };
function svg(n, S = 14) {
  const Lv = LV[n], W = C * S, Hh = R * S, o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}"><rect width="${W}" height="${Hh}" fill="#222"/>`];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (Lv.f[r][c]) o.push(`<rect x="${c * S}" y="${r * S}" width="${S}" height="${S}" fill="${Lv.hole[r][c] ? "#101820" : ZC[Lv.z[r][c]] || "#fff"}"/>`);
  const line = (x1, y1, x2, y2, k) => o.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${k === 1 ? "#111" : k === 2 ? "#d33" : k === 3 ? "#a60" : "#06c"}" stroke-width="${k === 1 ? 3 : 2}"${k === 2 ? ' stroke-dasharray="4 2"' : ""}/>`);
  for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) Lv.H[r][c] && line(c * S, r * S, (c + 1) * S, r * S, Lv.H[r][c]);
  for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) Lv.V[r][c] && line(c * S, r * S, c * S, (r + 1) * S, Lv.V[r][c]);
  for (const s of STAIRS) if (s[0] === n || s[0] + 1 === n) { const [, c, r] = s; o.push(`<rect x="${c * S}" y="${(r - 3) * S}" width="${2 * S}" height="${4 * S}" fill="none" stroke="${s[0] === n ? "#06f" : "#f60"}" stroke-width="2" stroke-dasharray="3 2"/><text x="${c * S + 3}" y="${(r - 2) * S}" font-size="10" fill="#fff">${s[0] === n ? "↑" : "↓"}</text>`); }
  for (const p of props) if (p[0] === n) { const b = propBox(p[1], p[2], p[3], p[4]); o.push(`<rect x="${(b.x0 - OX) / CELL * S}" y="${(b.z0 - OZ) / CELL * S}" width="${(b.x1 - b.x0) / CELL * S}" height="${(b.z1 - b.z0) / CELL * S}" fill="#a52" opacity=".85"/>`); }
  for (const [k, [x, z]] of Object.entries(nodes)) if (n === 0) o.push(`<circle cx="${(x - OX) / CELL * S}" cy="${(z - OZ) / CELL * S}" r="3" fill="#f0f"/>`);
  o.push("</svg>"); return o.join("\n");
}

// ═════════════ output ═════════════
const rows = (E) => E.map((row) => row.join(""));
function plan() {
  return {
    cell: CELL, origin: [OX, OZ], cols: C, rows: R, buildingRows: BR, floorH: FH, slab: SLAB,
    levels: LV.map((Lv) => ({ f: Lv.f.map((row, r) => row.map((v, c) => (v ? (Lv.hole[r][c] ? (Lv.hole[r][c] === 2 ? "9" : "0") : Lv.z[r][c]) : " ")).join("")), V: rows(Lv.V), H: rows(Lv.H) })),
    stairs: STAIRS, props, lights, signs, nodes: Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, [+v[0].toFixed(2), +v[1].toFixed(2)]])),
    sites: [{ id: "A", x: cx(7), z: cz(3), r: 7 }, { id: "B", x: cx(40), z: cz(3), r: 7 }],
    attackSpawn: [0, cz(37)], defendSpawn: [0, cz(3)],
  };
}
if (require.main === module) {
  const v = validate();
  console.log("refused", JSON.stringify(WHY));
  console.log("props", props.length, "lights", lights.length, "bot cells", v.total, "reached", v.reached);
  v.bad.length ? (console.log("PROBLEMS:\n - " + v.bad.join("\n - ")), process.exitCode = 1) : console.log("plan ok");
  const dir = process.env.PREVIEW_DIR;
  if (dir) { fs.mkdirSync(dir, { recursive: true }); [0, 1, 2].forEach((n) => fs.writeFileSync(path.join(dir, "level" + n + ".svg"), svg(n))); }
  if (!process.argv.includes("--check") && !v.bad.length) {
    const p = plan(), json = JSON.stringify(p).replace(/\],\[/g, "],\n[");
    fs.writeFileSync(path.join(__dirname, "..", "js", "hospital-plan.js"), "// generated by scripts/gen-hospital.js: do not edit by hand\n(function (root) {\n  const PLAN = " + json + ";\n  root.HOSPITAL_PLAN = PLAN;\n  if (\"undefined\" != typeof module && module.exports) module.exports = PLAN;\n})(\"undefined\" != typeof window ? window : globalThis);\n");
    console.log("wrote js/hospital-plan.js");
  }
}
module.exports = { plan, validate, LV, STAIRS, props };
