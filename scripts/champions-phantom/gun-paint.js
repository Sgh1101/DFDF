// Paints the Champions Phantom atlas: pixel-art shading plus world-space
// decoration (gold crest veins, glowing seams, engraved panels). Each
// material uses a fixed six-shade palette so the kill-coat bake in
// js/phantom-gun-wave.js can recognise the coat-eligible colours exactly.
"use strict";
const { hash } = require("./png");

// [body, trim, dark, glow] — the same groups js/phantom-gun-wave.js reads.
const PALETTES = {
  // Attack: dark crimson body, silver furniture. Defense: ivory body, graphite furniture.
  attacker: {
    body: [0x0e0408, 0x18070c, 0x240a12, 0x330e19, 0x481523, 0x641e30],
    trim: [0x6a4012, 0x8e5e1c, 0xb47e2a, 0xd49e3c, 0xecbe58, 0xfcdc88],
    dark: [0x0b0b0e, 0x131317, 0x1b1b21, 0x24242c, 0x30303a, 0x3e3e4a],
    glow: [0xff3650, 0xff8c9c],
    shell: [0x5a5e68, 0x7a7f8a, 0x999eaa, 0xb6bbc6, 0xd0d4dc, 0xe8eaf0],
  },
  defender: {
    body: [0x77736c, 0x95918a, 0xb1ada5, 0xc8c4bb, 0xddd9cf, 0xf0ece3],
    trim: [0x6a4012, 0x8e5e1c, 0xb47e2a, 0xd49e3c, 0xecbe58, 0xfcdc88],
    dark: [0x0b0b0e, 0x131317, 0x1b1b21, 0x24242c, 0x30303a, 0x3e3e4a],
    glow: [0xfff2b8, 0xffd772],
    shell: [0x0d0d10, 0x16161a, 0x1f1f25, 0x292930, 0x35353d, 0x43434d],
    deck: "body", accent: [0x1e0e06, 0x2e1608, 0x40200c, 0x542a10, 0x6a3614, 0x80421a],
  },
};
// Gold crest veins on the side panels, as polylines in (x, y) model units.
const VEINS = [
  [[-7.2, -3.4], [-4.6, -0.6], [-1.6, 1.4], [2.2, 2.2]],
  [[-5.6, -3.4], [-2.4, -0.4], [0.6, 0.8]],
  [[0.6, 0.8], [3.4, -1.6], [6.6, -2.2], [9.8, -0.6], [13.8, 1.8]],
  [[2.4, -3.2], [6.2, -3.3], [8.6, -4.9]],
  [[14.6, -2.2], [18.4, -1.2], [21.6, 0.6], [24.2, 1.2], [26.2, 2.4]],
  [[18.4, -1.2], [19.2, 1.8]], [[21.6, 0.6], [22.2, 2.4]],
  [[29.6, -1.2], [32.4, 1.0]], [[30.6, -1.4], [33.6, 1.2]], [[34.8, -1.4], [36.2, 0]],
  [[-19.4, -1.9], [-16.2, 0.1], [-12.4, -1.5]],
];
// Glowing seams cut through the upper receiver.
const SEAMS = [[[-5.5, 1.9], [-1.2, 1.9]], [[0.8, 1.2], [3, -0.4]], [[9.6, 1.9], [13.6, 1.9]]];
// Engraved facets on the silver stock and magazine.
const FACETS = [[[-20.4, -5.4], [-17.2, -1.2], [-14.6, -4.2]], [[-14.6, -4.2], [-11.2, -1.6]], [[-20.4, 0.9], [-12, 1.6]]];

function segment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dy * k);
}
const near = (p, lines, r) => lines.some((line) => line.some((a, i) => i && segment(p, line[i - 1], a) < r));
const clampShade = (n) => Math.max(0, Math.min(5, n));

function painter(side) {
  const pal = PALETTES[side];
  return ({ material, p, n, u, v, w, h, cube }) => {
    const [x, y, z] = p, up = n[1] > 0.7, down = n[1] < -0.7, flank = Math.abs(n[2]) > 0.7, end = Math.abs(n[0]) > 0.7;
    // Face light: tops bright, flanks middle, ends and undersides dark.
    let shade = up ? 4 : flank ? 3 : end ? 2 : 1;
    if ((flank || end) && v === 0) shade++;
    if ((flank || end) && v === h - 1) shade--;
    if (up && (u === 0 || u === w - 1)) shade--;
    const grain = hash(Math.round(x * 4), Math.round(y * 4), Math.round(z * 4), material.length);
    if (grain < 0.05) shade--; else if (grain > 0.97) shade++;
    let group = material === "glow" ? "glow" : material, glow = material === "glow";
    if (material === "body" && up && cube.size[2] >= 2.4) group = pal.deck || "shell"; // pale deck on wide tops
    if (material === "body" && flank) {
      if (near([x, y], VEINS, 0.26)) { group = "trim"; shade = 4 + (grain > 0.6 ? 1 : 0); }
      else if (near([x, y], VEINS, 0.62)) { if (pal.accent) group = "accent"; else shade = Math.min(shade, 2); }
      if (near([x, y], SEAMS, 0.3)) { group = "glow"; glow = true; }
    }
    if (material === "shell" && flank) {
      if (near([x, y], FACETS, 0.3)) shade = 1;
      if (v === 0 && cube.bone === "stock" && cube.size[0] > 6) { group = "trim"; shade = 4; }
    }
    if (material === "trim" && (up || v === 0)) shade = Math.max(shade, 4);
    if (material === "dark") shade = Math.min(shade, 3);
    const colors = pal[group];
    if (group === "glow") {
      const color = colors[grain > 0.5 || up ? 1 : 0];
      return { base: color, mask: color };
    }
    return { base: colors[clampShade(shade)], mask: glow ? colors[0] : null };
  };
}
module.exports = { PALETTES, painter };
