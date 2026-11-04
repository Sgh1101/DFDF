// Paints the Champions Phantom atlas: pixel-art face shading plus world-space
// decoration (engraved stock lines, gold panel work, glowing brush strokes).
// Each material uses a fixed palette so the kill-coat bake in
// js/phantom-gun-wave.js can recognise the coat-eligible colours exactly.
"use strict";
const { hash } = require("./png");

const GOLD = [0x5a3c10, 0x7a5418, 0x9c6e22, 0xbc8a2e, 0xd8a640, 0xf0c862];
const INNER = [0x060607, 0x0c0c0f, 0x131317, 0x1b1b21, 0x25252c, 0x303039];
// [body, trim, dark, glow] are the groups js/phantom-gun-wave.js reads (sync-wave.js);
// frame and lower are extra roles that never take the kill coat.
const PALETTES = {
  // Attack: black receiver and shroud, pale grey stock, grip, magazine face and muzzle.
  attacker: {
    body: [0x08080b, 0x0e0e12, 0x15151b, 0x1e1e26, 0x282832, 0x34343f],
    trim: GOLD,
    dark: INNER,
    glow: [0xff2e44, 0xfff1ec],
    frame: [0x4d5363, 0x656c7d, 0x7d8597, 0x959dae, 0xadb4c3, 0xc6ccd8],
    lower: [0x0b0406, 0x14070b, 0x1e0a10, 0x2a0e16, 0x38141d, 0x4a1a26],
  },
  // Defense: the same gun with the roles swapped - pale grey upper, black furniture, brown lower.
  defender: {
    body: [0x5b6271, 0x727a8b, 0x8a92a4, 0xa1a9b9, 0xb8bfcc, 0xd0d5de],
    trim: GOLD,
    dark: INNER,
    glow: [0xe0a848, 0xfff8ea],
    frame: [0x070709, 0x0d0d11, 0x141419, 0x1c1c23, 0x26262e, 0x32323b],
    lower: [0x150704, 0x210b06, 0x2f1009, 0x3e160b, 0x4e1e0f, 0x602713],
  },
};
// Engraved lines and a gold ring on the stock flanks, (x, y) in model units.
const ENGRAVE = [
  [[-21.0, -1.3], [-20.0, -1.9]],
  [[-20.3, -2.3], [-18.8, -4.2], [-20.5, -5.7]],
  [[-18.5, -1.9], [-15.3, -4.25], [-13.4, -2.2]],
  [[-11.6, -2.6], [-9.4, -2.7]],
];
const RING = [-17.3, -3.3];
// Gold lightning inside the magazine-well plate.
const BOLT = [[[5.5, -1.9], [6.6, -2.65], [5.9, -3.0], [7.0, -3.85]]];
// Brush-stroke highlights on the upper receiver and handguard: [from, to, half width].
const STROKES = [
  [[1.5, 1.2], [9.6, 1.7], 0.34], [[3.6, 0.85], [6.6, 0.95], 0.13], [[11.2, 1.25], [14.3, 1.5], 0.3],
  [[-5.9, 2.25], [-0.5, 2.5], 0.2], [[-3.4, 1.55], [-1.2, 1.4], 0.12], [[15.6, 0.6], [19.4, 0.95], 0.18],
];
// Ribbed marks near the front of the handguard.
const LADDER = [[24.1, 0.3], [24.1, 1.8]];

function segment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return [Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dy * k), k];
}
const near = (p, lines, r) => lines.some((line) => line.some((a, i) => i && segment(p, line[i - 1], a)[0] < r));
// 0 outside a stroke, 1 on its rim, 2 in its core.
function stroke(p) {
  let best = 0;
  for (const [a, b, w] of STROKES) {
    const [d, k] = segment(p, a, b), width = w * 1.25 * (1 - Math.pow(2 * k - 1, 2)) + 0.02;
    if (d < width * 0.8) return 2;
    if (d < width) best = 1;
  }
  return best;
}
const clampShade = (n) => Math.max(0, Math.min(5, n));

function painter(side) {
  const pal = PALETTES[side], attacker = side === "attacker";
  return ({ material, p, n, u, v, w, h, cube }) => {
    const [x, y, z] = p, up = n[1] > 0.7, flank = Math.abs(n[2]) > 0.7, end = Math.abs(n[0]) > 0.7;
    // Face light: tops bright, flanks middle, ends and undersides dark.
    let shade = up ? 4 : flank ? 3 : end ? 2 : 1;
    if ((flank || end) && v === 0) shade++;
    if ((flank || end) && v === h - 1) shade--;
    if (up && (u === 0 || u === w - 1)) shade--;
    const grain = hash(Math.round(x * 4), Math.round(y * 4), Math.round(z * 4), material.length);
    if (material === "trim") { if (grain < 0.05) shade--; else if (grain > 0.97) shade++; }
    let group = material, glow = material === "glow";
    const bigFlank = flank && Math.abs(z) > 0.85;
    if (material === "frame" && bigFlank && cube.bone === "stock") {
      if (near([x, y], ENGRAVE, 0.09)) shade = attacker ? 0 : 4;
      const ring = Math.hypot(x - RING[0], y - RING[1]);
      if (ring > 0.17 && ring < 0.34) { group = "trim"; shade = 3; }
    }
    if (material === "lower" && flank) {
      // faint diagonal glints across the dark lower receiver
      const k = ((x - y * 0.8) % 5.5 + 5.5) % 5.5;
      if (k < 0.35) shade += 1;
      if (cube.panel) {
        const edge = Math.min(x - 3.0, 9.1 - x, y + 4.1, -1.6 - y);
        if (edge < 0.28 || near([x, y], BOLT, 0.2)) { group = "trim"; shade = 4; }
      }
    }
    // the handguard's lower triangle, under the gold sweep, takes the lower-receiver colour
    if (material === "body" && bigFlank && cube.bone === "handguard" && x < 21.6 && y < 1.75 - (x - 15.0) * 0.645) group = "lower";
    // and so does the rear of the upper receiver, under a line that dips toward the magazine well
    if (material === "body" && bigFlank && cube.bone === "receiver" && x < 2.4 && y < 1.4 - Math.max(0, x) * 0.5) group = "lower";
    if (material === "body" && bigFlank && (cube.bone === "receiver" || cube.bone === "handguard")) {
      const s = stroke([x, y]);
      if (s === 2) { group = "glow"; glow = true; }
      else if (s === 1) { group = "glow"; glow = true; }
      if (s) shade = s;
      if (near([x, y], [LADDER], 0.16) || (x > 23.9 && x < 24.6 && Math.abs(y % 0.5) < 0.12 && y > 0.3 && y < 1.8)) { group = "trim"; shade = 3; glow = false; }
    }
    // an arrow-head on the shroud, pointing back, with a dark core; the rest of the plate matches the shroud
    if (cube.wedge && flank) {
      const t = (x - 30.8) / 2.8, half = 0.75 * t, mid = -0.17;
      if (Math.abs(y - mid) > half) { group = "body"; shade = 3; }
      else if (Math.abs(y - mid) < half * 0.4 && t > 0.45) { group = "lower"; shade = 3; }
      else { group = "trim"; shade = 4; }
    }
    // gold rims along the top edges of the main blocks (seen from above)
    if (cube.rim && up && cube.size[2] > 1.6 && (Math.abs(z) > cube.size[2] / 2 - 0.32)) { group = "trim"; shade = 4; glow = false; }
    if (cube.hi && up) shade = 4;
    if (material === "trim" && (up || v === 0)) shade = Math.max(shade, 4);
    if (material === "dark") shade = Math.min(shade, 4);
    const colors = pal[group];
    if (group === "glow") {
      const color = colors[shade === 2 ? 1 : 0];
      return { base: color, mask: color };
    }
    return { base: colors[clampShade(shade)], mask: glow ? colors[0] : null };
  };
}
module.exports = { PALETTES, painter };
