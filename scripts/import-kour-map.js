// Collision boxes for the Kour.io map (assets/maps/kour/map7.json.gz) in the engine's own terms: axis-aligned boxes with a
// bottom (y0) and a top (h), written to assets/maps/kour/map7-collision.json together with the pack's manifest (hashes).
//
// The source colliders are Unity mesh colliders: open surfaces (a wall is one plane, a floor is one plane, a stair a few
// planes), not solids, plus 72 box colliders (crates). kouor collides a capsule against the triangles. The engine
// collides against boxes (js/legacy/03-engine.js, CHASH), so the triangles are rasterised onto a 0.5-unit grid:
//   * a steep triangle (more than 50 degrees from level) is a wall: each column gets the heights it covers;
//   * a gentler one is a floor: each column gets its height. The lowest floor of a column holds the ground up (a solid
//     box from the base to it); a floor above another is a slab with room under it when the gap is a body tall, and one
//     solid block when it is not (a crate top, a stair). A column with no floor at all is closed (void: no way off the map);
//   * a box collider is a solid over its columns, however it is turned.
// Equal neighbours are merged into rectangles. Units are the source's (Unity: +Y up, +Z forward), nothing reflected or
// scaled here; the game does that when it loads (js/kour-map.js).
// node scripts/import-kour-map.js
'use strict';
const fs = require('node:fs'), zlib = require('node:zlib'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'assets/maps/kour');
const gz = fs.readFileSync(path.join(DIR, 'map7.json.gz')), src = JSON.parse(zlib.gunzipSync(gz));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const Q = 0.25, STEP = 0.125;                       // column size, sampling step (source units)
const SCALE = 1.848 / 2.5;                        // metres per unit: the game's eye height over Kour's 2.5-unit camera
const CLEAR = 2.45 / SCALE;                       // room under a floor for a body to pass (units)
const SLAB = 0.3 / SCALE;                         // thickness of a slab (units)
const SLOPE = Math.cos(50 * Math.PI / 180);       // |normal.y| from which a triangle is a floor
const GAP = 0.6;                                  // floors closer than this are one
const X0 = -58, X1 = 164, Z0 = -52, Z1 = 152;     // the map's rectangle
const NX = Math.ceil((X1 - X0) / Q), NZ = Math.ceil((Z1 - Z0) / Q);
const YB = -4.5;                                  // the lowest walkable floor: y = 0 in the game

const T = { f32: Float32Array, u32: Uint32Array, u16: Uint16Array, u8: Uint8Array };
const un = (v) => { if (!v) return []; const b = Buffer.from(v.data || v.base64, 'base64'); return new T[v.type.toLowerCase()](b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const ap = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

const floors = new Map(), walls = new Map(), solids = new Map();
const cellOf = (x, z) => { const i = Math.floor((x - X0) / Q), j = Math.floor((z - Z0) / Q); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; };
const push = (m, k, v) => { let a = m.get(k); a ? a.push(v) : m.set(k, [v]); };

function sampleTri(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], L = Math.hypot(...n);
  if (L < 1e-9) return;
  const flat = Math.abs(n[1]) / L >= SLOPE, edge = Math.max(Math.hypot(...u), Math.hypot(...w), Math.hypot(w[0] - u[0], w[1] - u[1], w[2] - u[2]));
  const k = Math.max(1, Math.ceil(edge / STEP));
  for (let i = 0; i <= k; i++) for (let j = 0; j <= k - i; j++) {
    const s = i / k, t = j / k, x = a[0] + u[0] * s + w[0] * t, y = a[1] + u[1] * s + w[1] * t, z = a[2] + u[2] * s + w[2] * t, id = cellOf(x, z);
    if (id < 0) continue;
    flat ? push(floors, id, y) : push(walls, id, Math.floor(y / STEP));
  }
}
function sampleBox(c) {
  const m = c.matrix, [cx, cy, cz] = c.center, [sx, sy, sz] = c.size;
  const len = (col) => Math.hypot(m[col * 4], m[col * 4 + 1], m[col * 4 + 2]);
  const nx = Math.max(1, Math.ceil(sx * len(0) / (STEP / 2))), ny = Math.max(1, Math.ceil(sy * len(1) / (STEP / 2))), nz = Math.max(1, Math.ceil(sz * len(2) / (STEP / 2)));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) for (let k = 0; k <= nz; k++) {
    const p = ap(m, cx + (i / nx - 0.5) * sx, cy + (j / ny - 0.5) * sy, cz + (k / nz - 0.5) * sz), id = cellOf(p[0], p[2]);
    if (id < 0) continue;
    const e = solids.get(id);
    e ? (e[0] = Math.min(e[0], p[1]), e[1] = Math.max(e[1], p[1])) : solids.set(id, [p[1], p[1]]);
  }
}
let skipped = 0;
for (const c of src.colliders) {
  if (c.enabled === false || c.isTrigger === true) continue;
  if (c.type === 'box') { sampleBox(c); continue; }
  if (c.type !== 'mesh') { skipped++; continue; }
  const g = src.geometries[c.geometry], p = un(g.positions), idx = un(g.indices);
  for (let i = 0; i < idx.length; i += 3) sampleTri(...[0, 1, 2].map((q) => ap(c.matrix, p[idx[i + q] * 3], p[idx[i + q] * 3 + 1], p[idx[i + q] * 3 + 2])));
}

// per column: the boxes [y0, y1] (units, absolute) of each kind
const cols = new Array(NX * NZ);
let voidCells = 0;
const add = (id, y0, y1, kind) => { if (y1 - y0 > 0.02) (cols[id] || (cols[id] = [])).push([y0, y1, kind]); };
for (let id = 0; id < NX * NZ; id++) {
  const fl = floors.get(id), sol = solids.get(id), wl = walls.get(id);
  if (!fl && !sol && !wl) { voidCells++; add(id, YB, YB + 55, 'void'); continue; }
  if (fl) {
    // floors of this column, close ones as one
    fl.sort((a, b) => a - b);
    const levels = []; let cl = [fl[0]];
    for (let i = 1; i < fl.length; i++) fl[i] - cl[cl.length - 1] > GAP ? (levels.push(cl[cl.length - 1]), cl = [fl[i]]) : cl.push(fl[i]);
    levels.push(cl[cl.length - 1]);
    // the lowest holds the ground up (a floor within a body's height over it is part of that solid); above, a floor with room
    // under it is a lid, and one close over a lid makes the lid thicker
    let top = levels[0], k = 1;
    while (k < levels.length && levels[k] - top < CLEAR) top = levels[k++];
    if (top - YB > 0.35) add(id, YB, top, 'floor');
    let lid = null;
    for (let prev = top; k < levels.length; k++) {
      const h = levels[k];
      if (lid && h - prev < CLEAR) lid[1] = h;
      else { lid = [h - SLAB, h, 'lid']; (cols[id] || (cols[id] = [])).push(lid); }
      prev = h;
    }
  } else if (!sol) add(id, YB, YB + 55, 'void');      // a wall with no floor: closed below it too
  if (sol) add(id, sol[0], sol[1], 'solid');
  if (wl) {
    wl.sort((a, b) => a - b);
    let b0 = wl[0], b1 = wl[0];
    for (let i = 1; i <= wl.length; i++) {
      if (i < wl.length && wl[i] - b1 <= 1) { b1 = wl[i]; continue; }
      add(id, Math.max(YB, b0 * STEP), (b1 + 1) * STEP, 'wall');
      if (i < wl.length) b0 = b1 = wl[i];
    }
  }
}

// merge equal neighbours into rectangles, one key (y0, y1, kind) at a time
const q = (v) => Math.round(v * 20) / 20;
const groups = new Map();
for (let id = 0; id < cols.length; id++) for (const [y0, y1, kind] of cols[id] || []) {
  const key = q(y0) + '|' + q(y1) + '|' + kind;
  let g = groups.get(key); if (!g) groups.set(key, g = new Set()); g.add(id);
}
// f: ground held up (a solid from the base), l: a lid (a floor with room under it, a roof), s: a solid (a box collider), w: a wall, v: void
const KIND = { floor: 'f', lid: 'l', solid: 's', wall: 'w', void: 'v' };
const boxes = [];
for (const [key, set] of groups) {
  const [y0, y1, kind] = key.split('|');
  const used = new Set();
  const ids = [...set].sort((a, b) => a - b);
  for (const id of ids) {
    if (used.has(id)) continue;
    const i0 = id % NX, j0 = (id / NX) | 0;
    let w = 1; while (i0 + w < NX && set.has(j0 * NX + i0 + w) && !used.has(j0 * NX + i0 + w)) w++;
    let d = 1;
    grow: while (j0 + d < NZ) { for (let i = 0; i < w; i++) { const k = (j0 + d) * NX + i0 + i; if (!set.has(k) || used.has(k)) break grow; } d++; }
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) used.add((j0 + j) * NX + i0 + i);
    boxes.push([X0 + i0 * Q, X0 + (i0 + w) * Q, Z0 + j0 * Q, Z0 + (j0 + d) * Q, +y0, +y1, KIND[kind]]);
  }
}
const kinds = {}; for (const b of boxes) kinds[b[6]] = (kinds[b[6]] || 0) + 1;
console.log('columns', NX, 'x', NZ, 'void', voidCells, 'skipped colliders', skipped, 'boxes', boxes.length, kinds);

const out = { version: 1, source: { file: 'map7.json.gz', sha256: sha(gz) }, units: 'Kour source units (Unity: +Y up, +Z forward)', cell: Q, base: YB, rect: [X0, Z0, X1, Z1], clear: CLEAR, slab: SLAB,
  boxes: boxes.map(([a, b, c, d, e, f, k]) => [+a.toFixed(2), +b.toFixed(2), +c.toFixed(2), +d.toFixed(2), +e.toFixed(2), +f.toFixed(2), k]) };
const json = JSON.stringify(out);
fs.writeFileSync(path.join(DIR, 'map7-collision.json'), json);
console.log('map7-collision.json', json.length, 'bytes');

// the pack's manifest: where each file comes from, and its hash (npm run check:assets verifies them)
const catalog = { id: 'map7', source: src.source, sha256: sha(gz), bytes: gz.length, renderers: src.nodes.length, colliders: src.colliders.length, geometries: Object.keys(src.geometries).length };
const files = [{ file: 'map7.json.gz', from: 'kouor dist/assets/original-maps/map7.json.gz (catalog.json entry map7)', sha256: sha(gz), bytes: gz.length }];
for (const t of [...new Set(Object.values(src.materials).map((m) => m.texture).filter(Boolean))].sort()) { const b = fs.readFileSync(path.join(DIR, t)); files.push({ file: t, from: 'kouor dist/assets/original-maps/' + t, sha256: sha(b), bytes: b.length }); }
files.push({ file: 'map7-collision.json', from: 'scripts/import-kour-map.js (made from map7.json.gz)', sha256: sha(Buffer.from(json)), bytes: Buffer.byteLength(json) });
fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify({ version: 1, name: '사막 마을', origin: 'Kour.io public client, map7 (StreamingAssets/map7?v=4.24), as converted by the kouor project', source: catalog, files }, null, 2) + '\n');
console.log('manifest.json', files.length, 'files');
