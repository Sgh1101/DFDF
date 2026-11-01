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
    body: [0x1a060c, 0x2a0a14, 0x3c1020, 0x52182c, 0x6c2238, 0x8a2e48],
    trim: [0x6a4012, 0x8e5e1c, 0xb47e2a, 0xd49e3c, 0xecbe58, 0xfcdc88],
    dark: [0x0e0e12, 0x17171c, 0x202027, 0x2c2c35, 0x3a3a46, 0x4a4a58],
    glow: [0xff3650, 0xff8c9c],
    shell: [0x4a4e5a, 0x646976, 0x7f8491, 0x989eab, 0xb1b7c3, 0xc9ced8],
  },
  defender: {
    body: [0x77736c, 0x95918a, 0xb1ada5, 0xc8c4bb, 0xddd9cf, 0xf0ece3],
    trim: [0x6a4012, 0x8e5e1c, 0xb47e2a, 0xd49e3c, 0xecbe58, 0xfcdc88],
    dark: [0x0e0e12, 0x17171c, 0x202027, 0x2c2c35, 0x3a3a46, 0x4a4a58],
    glow: [0xfff2b8, 0xffd772],
    shell: [0x26282f, 0x353841, 0x474b56, 0x5b606c, 0x707682, 0x858b98],
    deck: "body", accent: [0x1e0e06, 0x2e1608, 0x40200c, 0x542a10, 0x6a3614, 0x80421a],
  },
};
// Gold crest veins on the side panels, as polylines in (x, y) model units.
const VEINS = [
  [[-6.9, 1.95], [9.5, 1.95], [14.2, 1.95]],                       // thin gold top edge of the crimson body
  [[9.6, -4.2], [12.0, -3.2], [14.2, -2.3]],                       // lower diagonal of the front wedge
  [[2.6, -3.9], [2.6, -1.7], [8.9, -1.7], [8.9, -3.9]],            // panel outline above the magazine well
  [[-6.8, -3.6], [-4.6, -1.6], [-6.8, 0.2]],
  [[-6.2, 0.9], [-3.6, -0.7], [-0.6, 0.8]],
  [[0.4, -4.0], [0.4, -2.2], [2.2, -2.2]],
  [[9.8, 0.7], [11.4, -0.7], [13.8, 0.7]],
  [[14.8, -1.5], [18.0, -0.2], [21.0, -1.3], [24.8, 0.2]],         // handguard zig-zag
  [[15.0, 1.3], [22.6, 1.3]],
  [[15.4, -2.1], [20.4, -2.1]],
  [[27.2, -0.6], [30.0, 0.5], [33.0, -0.5], [35.2, 0.5]],          // barrel marking
];
// Glowing seams cut through the upper receiver.
const SEAMS = [[[-5.6, 1.3], [-0.6, 1.3]], [[1.0, 1.0], [3.4, 1.5]], [[5.6, 1.3], [12.4, 1.3]], [[16.2, 0.4], [22.4, 0.4]]];
// Engraved facets on the silver stock.
const FACETS = [[[-21.2, -5.0], [-17.6, -1.2], [-13.6, -4.4]], [[-13.6, -4.4], [-9.4, -2.2]]];

function segment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dy * k);
}
const near = (p, lines, r) => lines.some((line) => line.some((a, i) => i && segment(p, line[i - 1], a) < r));
const clampShade = (n) => Math.max(0, Math.min(5, n));

function painter(side) {
  const pal = PALETTES[side];
  return ({ material: baseMaterial, p, n, u, v, w, h, cube }) => {
    // the defense gun keeps a pale handguard and barrel; the attack gun keeps them black
    const material = side === "defender" && baseMaterial === "dark" && (cube.bone === "handguard" || cube.bone === "barrel") ? "body" : baseMaterial;
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
    const veinable = material === "body" || (material === "dark" && (cube.bone === "handguard" || cube.bone === "barrel"));
    if (veinable && flank) {
      if (near([x, y], VEINS, 0.3)) { group = "trim"; shade = 4 + (grain > 0.6 ? 1 : 0); }
      else if (near([x, y], VEINS, 0.5)) { if (pal.accent) group = "accent"; else shade = Math.min(shade, 2); }
      if (pal.accent && group === "body" && y < -1.6 && y > -4.3 && x > -6 && x < 9.4) group = "accent"; // brown recess under the ivory shell
      if (near([x, y], SEAMS, 0.24)) { group = "glow"; glow = true; }
    }
    if (material === "shell" && flank) {
      if (near([x, y], FACETS, 0.3)) shade = 1;
      if (v === 0 && cube.bone === "stock" && cube.size[0] > 6) shade = 5;
    }
    // thin gold edging along a cube's flank edges, and a pale highlight on tops
    if (cube.edge && flank && ((v === 0 && cube.edge !== "bottom") || (v === h - 1 && cube.edge !== "top"))) { group = "trim"; shade = 4; glow = false; }
    if (cube.hi && up) { group = pal.deck || "shell"; shade = pal.deck ? 5 : 4; glow = false; }
    if (material === "trim" && (up || v === 0)) shade = Math.max(shade, 4);
    if (material === "dark" && group === "dark") shade = Math.min(shade, 4);
    const colors = pal[group];
    if (group === "glow") {
      const color = colors[grain > 0.5 || up ? 1 : 0];
      return { base: color, mask: color };
    }
    return { base: colors[clampShade(shade)], mask: glow ? colors[0] : null };
  };
}
module.exports = { PALETTES, painter };
