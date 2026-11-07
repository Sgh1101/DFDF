// SGH butterfly (SGH나비칼): generate the model, the four colour textures, animations and synthesized sound package.
//   node scripts/build-sgh-butterfly.js          regenerate the package and its manifest
//   node scripts/build-sgh-butterfly.js --check  fail when they are not what this script makes
"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), zlib = require("node:zlib");
const DIR = path.resolve(__dirname, "../assets/rgx-firefly/v1");
const { rig, animation } = require("./sgh-butterfly-motion");
const { sounds } = require("./sgh-butterfly-audio");

// ── the palette: 8×8 cells in the lower half of the 128×128 texture (the upper half holds the two effect planes) ──
const W = 128, H = 128, CELL = 8, ROW0 = 64;
const COLORS = {
  blade: [207, 214, 222], fuller: [150, 160, 172], edge: [242, 245, 248], black: [35, 38, 44],
  handle: [31, 79, 168], handleDark: [22, 58, 125], titanium: [125, 132, 142], gold: [209, 166, 70],
  glow: [95, 240, 255], glowHot: [200, 251, 255],
};
const NAMES = Object.keys(COLORS);
// the colours: the same shape, each its own palette and glow (texture.png is the blue one, the others texture_<name>.png)
const VARIANTS = {
  "": COLORS,
  crimson: { ...COLORS, handle: [150, 24, 36], handleDark: [104, 14, 24], titanium: [80, 80, 88], gold: [214, 170, 72], glow: [255, 77, 94], glowHot: [255, 200, 205] },
  emerald: { ...COLORS, handle: [18, 120, 76], handleDark: [10, 84, 52], titanium: [150, 158, 166], gold: [200, 205, 210], glow: [125, 255, 106], glowHot: [220, 255, 210] },
  blackgold: { ...COLORS, blade: [70, 74, 82], fuller: [40, 42, 48], edge: [235, 205, 130], handle: [26, 26, 30], handleDark: [14, 14, 17], titanium: [196, 160, 72], gold: [232, 190, 90], glow: [255, 201, 77], glowHot: [255, 240, 200] },
};
const textureName = (v) => (v ? "texture_" + v + ".png" : "texture.png");
const cellOf = (name) => { const i = NAMES.indexOf(name); return [(i % 16) * CELL, ROW0 + Math.floor(i / 16) * CELL]; };

// ── painted regions: the side faces of the blade and of the handles show one continuous painted surface (the
//    blade's polish, fuller and ground edge; the handles' anodised plates), so neighbouring cubes read as one piece ──
const BLADE = { u0: 0, v0: 74, w: 128, h: 32, zTip: -11.05, zBase: -2.2, yTop: 10.14, yBot: 8.62 };
const HANDLE = { u0: 0, v0: 106, w: 128, h: 22, zA: -3.1, zB: 6.05 };
const top = (z) => (z > -8.4 ? 10.05 : 10.05 - ((-8.4 - z) / 2.6) * 0.9);
const bot = (z) => (z > -6.8 ? 8.78 : 8.78 + Math.pow((-6.8 - z) / 4.2, 1.6) * 0.37);
const FULLER = [9.35, 9.6], FULLER_Z = [-8.2, -4.5];
const bU = (z) => BLADE.u0 + ((BLADE.zBase - z) / (BLADE.zBase - BLADE.zTip)) * BLADE.w, bV = (y) => BLADE.v0 + ((BLADE.yTop - y) / (BLADE.yTop - BLADE.yBot)) * BLADE.h;
const hU = (z) => HANDLE.u0 + ((z - HANDLE.zA) / (HANDLE.zB - HANDLE.zA)) * HANDLE.w;

// a cube [x0,y0,z0]-[x1,y1,z1] in the source's units. Its faces sample one texel of a colour cell (varied per cube), or,
// with map, its two side faces (east and west, the flats) show their part of a painted region.
let serial = 0;
function cube(a, b, color, map) {
  const [cx, cy] = cellOf(color), j = serial++ % 5, u = cx + 1.5 + j, v = cy + 1.5 + ((j * 3) % 5);
  const face = { uv: [u, v], uv_size: [1, 1] };
  const origin = [0, 1, 2].map((i) => +Math.min(a[i], b[i]).toFixed(4)), size = [0, 1, 2].map((i) => +Math.abs(b[i] - a[i]).toFixed(4));
  const uv = { north: face, east: face, south: face, west: face, up: face, down: face };
  if (map) {
    const [z0, z1] = [origin[2], origin[2] + size[2]], [y0, y1] = [origin[1], origin[1] + size[1]], r = (x) => +x.toFixed(3);
    let U0, U1, V0, V1;
    if (map.blade) { U0 = bU(z1); U1 = bU(z0); V0 = bV(y1); V1 = bV(y0); }
    else { const k = (y) => HANDLE.v0 + ((map.yHi - y) / (map.yHi - map.yLo)) * HANDLE.h; U0 = hU(z0); U1 = hU(z1); V0 = k(y1); V1 = k(y0); }
    // east (+x) runs its u from +z to -z, west (-x) from -z to +z (js/bedrock-rig.js): both show the same place
    const east = map.blade ? { uv: [r(U0), r(V0)], uv_size: [r(U1 - U0), r(V1 - V0)] } : { uv: [r(U1), r(V0)], uv_size: [r(U0 - U1), r(V1 - V0)] };
    const west = map.blade ? { uv: [r(U1), r(V0)], uv_size: [r(U0 - U1), r(V1 - V0)] } : { uv: [r(U0), r(V0)], uv_size: [r(U1 - U0), r(V1 - V0)] };
    uv.east = east; uv.west = west;
  }
  return { origin, size, uv };
}

// ── the blade (bone blade2): a drop point with a straight spine that falls to the tip, a belly rising to meet it,
//    a ground edge, a swedge along the top toward the tip, a recessed fuller with a glowing line, a finger hole,
//    jimping on the spine, a kicker under the tang, and a black ricasso with gold pins where the handles turn ──
function blade() {
  const out = [], glow = [], B = { blade: 1 };
  const STEP = 0.18;
  for (let z1 = -3.2; z1 > -11.0 + 1e-6; z1 -= STEP) {
    const z0 = Math.max(-11.0, z1 - STEP), zm = (z0 + z1) / 2, t = top(zm), b = bot(zm);
    if (t - b < 0.08) { out.push(cube([-0.045, b - 0.02, z0], [0.045, b + 0.07, z1], "edge", B)); continue; }
    const e = Math.min(b + 0.22, t - 0.02), sw = zm < -8.4 ? Math.min(0.14, t - e - 0.02) : 0;
    // the ground edge in two steps (thin at the cutting line, a little thicker above it)
    out.push(cube([-0.035, b, z0], [0.035, b + 0.08, z1], "edge", B), cube([-0.07, b + 0.08, z0], [0.07, e, z1], "edge", B));
    const hole = zm < -3.5 && zm > -4.3, fuller = zm < FULLER_Z[1] && zm > FULLER_Z[0], tc = t - sw;
    if (hole) out.push(cube([-0.11, e, z0], [0.11, 9.25, z1], "blade", B), cube([-0.11, 9.75, z0], [0.11, tc, z1], "blade", B));
    else if (fuller) out.push(cube([-0.11, e, z0], [0.11, FULLER[0], z1], "blade", B), cube([-0.075, FULLER[0], z0], [0.075, FULLER[1], z1], "fuller", B), cube([-0.11, FULLER[1], z0], [0.11, tc, z1], "blade", B));
    else out.push(cube([-0.11, e, z0], [0.11, tc, z1], "blade", B));
    // the swedge: a narrower bevel along the top toward the tip
    sw > 0 && out.push(cube([-0.06, tc, z0], [0.06, t, z1], "edge", B));
  }
  // a rounded finger hole: the corners of the cut filled in
  for (const [y, z] of [[9.25, -3.62], [9.25, -4.18], [9.67, -3.62], [9.67, -4.18]]) out.push(cube([-0.11, y, z - 0.06], [0.11, y + 0.08, z + 0.06], "blade", B));
  // jimping: small teeth on the spine above the finger hole
  for (let i = 0; i < 5; i++) { const z = -3.3 - i * 0.18; out.push(cube([-0.09, 10.05, z - 0.09], [0.09, 10.12, z], "black")); }
  // the ricasso, the kicker under it (it keeps the edge off the handles), and the pins the handles turn on
  out.push(cube([-0.12, 8.8, -3.2], [0.12, 10.12, -2.25], "black"), cube([-0.1, 8.62, -2.62], [0.1, 8.8, -2.3], "black"));
  for (const y of [9.957, 8.88]) out.push(cube([-0.17, y - 0.11, -2.73], [0.17, y + 0.11, -2.51], "gold"), cube([-0.19, y - 0.06, -2.68], [0.19, y + 0.06, -2.56], "titanium"));
  out.push(cube([-0.15, 9.3, -2.82], [0.15, 9.54, -2.58], "gold"));
  glow.push(cube([-0.08, 9.45, -8.1], [0.08, 9.5, -4.6], "glow"), cube([-0.13, 9.6, -3.12], [0.13, 9.7, -2.95], "glowHot"));
  return { out, glow };
}

// ── a handle (bones up / down): side plates with three windows rounded at their ends, a titanium spacer along the
//    outer edge, a rounded head with bushings and gold pin caps, a tail cap with a gold band (the down handle carries
//    the latch), "SGH" glowing on the top rail (painted), and a glowing bar seen through each window ──
function handle(yLo, yHi, pinY, outerTop, latch) {
  const out = [], glow = [], R = 0.18, M = { yLo, yHi };
  const zA = -3.1, zB = 5.85, WIN = [[-2.0, -0.15], [0.15, 2.35], [2.65, 4.9]];
  for (const s of [-1, 1]) {
    const x0 = s * 0.14, x1 = s * 0.26;
    out.push(cube([x0, yLo, -2.0], [x1, yLo + R, 4.9], "handle", M), cube([x0, yHi - R, -2.0], [x1, yHi, 4.9], "handle", M));
    for (const [p0, p1] of [[-0.15, 0.15], [2.35, 2.65]]) out.push(cube([x0, yLo + R, p0], [x1, yHi - R, p1], "handle", M));
    // the windows' ends rounded: a small step in each corner
    for (const [w0, w1] of WIN) for (const z of [w0, w1 - 0.12]) for (const y of [yLo + R, yHi - R - 0.08]) out.push(cube([x0, y, z], [x1, y + 0.08, z + 0.12], "handle", M));
    // a chamfer along the rails' outer edges (a thin darker step at the top and bottom of each plate)
    out.push(cube([s * 0.255, yHi - 0.05, -2.0], [s * 0.27, yHi - 0.01, 4.9], "handleDark"), cube([s * 0.255, yLo + 0.01, -2.0], [s * 0.27, yLo + 0.05, 4.9], "handleDark"));
    // pin caps on bushings
    out.push(cube([s * 0.27, pinY - 0.13, -2.75], [s * 0.29, pinY + 0.13, -2.49], "titanium"), cube([s * 0.29, pinY - 0.09, -2.71], [s * 0.315, pinY + 0.09, -2.53], "gold"));
  }
  // the head round the pin (stepped in at the very end, so it reads as rounded)
  out.push(cube([-0.26, yLo, -2.95], [0.26, yHi, -2.0], "handle", M), cube([-0.24, yLo + 0.1, -3.05], [0.24, yHi - 0.1, -2.95], "handle", M), cube([-0.22, yLo + 0.2, zA], [0.22, yHi - 0.2, -3.05], "handle", M));
  // the spacer along the outer edge
  const oy = outerTop ? [yHi - 0.2, yHi] : [yLo, yLo + 0.2];
  out.push(cube([-0.14, oy[0], -2.0], [0.14, oy[1], 4.9], "titanium"));
  // the tail cap, rounded the same way, and its gold band
  out.push(cube([-0.26, yLo, 4.9], [0.26, yHi, zB - 0.12], "handle", M), cube([-0.24, yLo + 0.08, zB - 0.12], [0.24, yHi - 0.08, zB], "handle", M), cube([-0.2, yLo + 0.18, zB], [0.2, yHi - 0.18, zB + 0.08], "handleDark"));
  out.push(cube([-0.265, yLo + 0.02, 5.3], [0.265, yHi - 0.02, 5.42], "gold"));
  if (latch) out.push(cube([-0.07, yHi - 0.22, zB + 0.08], [0.07, yHi - 0.04, zB + 0.24], "gold"), cube([-0.03, yHi - 0.3, zB + 0.12], [0.03, yHi - 0.22, zB + 0.2], "gold"));
  // a glowing bar through each window, and a line on the tail cap
  const ym = (yLo + yHi) / 2;
  for (const [w0, w1] of WIN) glow.push(cube([-0.2, ym - 0.03, w0 + 0.14], [0.2, ym + 0.03, w1 - 0.14], "glow"));
  glow.push(cube([-0.27, ym - 0.025, 5.0], [0.27, ym + 0.025, 5.25], "glowHot"));
  return { out, glow };
}

// ── the texture ──
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function paint(COLORS) {
  COLORS = COLORS || VARIANTS[""];
  const px = new Uint8Array(W * H * 4), r = rng(1101);
  const put = (x, y, c, a) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; };
  NAMES.forEach((name) => {
    const [cx, cy] = cellOf(name), c = COLORS[name];
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const n = (r() - 0.5) * 14 - (y - CELL / 2) * 1.2;
      put(cx + x, cy + y, c.map((v) => Math.max(0, Math.min(255, Math.round(v + n)))), 255);
    }
  });
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v))), mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t), add = (c, n) => c.map((v) => clamp(v + n));
  // the blade's flats: polished steel with a faint damascus wave and brushing along the length, a bright spine and a
  // bright ground edge, the fuller darker and soft at its middle, the swedge as bright as the edge
  const rowNoise = Array.from({ length: BLADE.h }, () => (r() - 0.5) * 10);
  for (let y = 0; y < BLADE.h; y++) for (let x = 0; x < BLADE.w; x++) {
    const z = BLADE.zBase - ((x + 0.5) / BLADE.w) * (BLADE.zBase - BLADE.zTip), yy = BLADE.yTop - ((y + 0.5) / BLADE.h) * (BLADE.yTop - BLADE.yBot);
    const t = top(z), b = bot(z), n = (r() - 0.5) * 6;
    let c;
    if (yy < b + 0.08) c = add(COLORS.edge, 8 + n);
    else if (yy < b + 0.22) c = add(mix(COLORS.edge, COLORS.blade, (yy - b - 0.08) / 0.14), n);
    else if (z > FULLER_Z[0] && z < FULLER_Z[1] && yy > FULLER[0] && yy < FULLER[1]) c = add(COLORS.fuller, -18 * Math.sin(Math.PI * (yy - FULLER[0]) / (FULLER[1] - FULLER[0])) + n);
    else if (z < -8.4 && yy > t - 0.14) c = add(COLORS.edge, -6 + n);
    else {
      const wave = Math.sin(x * 0.42 + 5 * Math.sin(y * 0.31 + x * 0.04)), spine = Math.max(0, 1 - (t - yy) / 0.14);
      c = add(COLORS.blade, 12 * wave + rowNoise[y] + 22 * spine + n);
    }
    put(BLADE.u0 + x, BLADE.v0 + y, c, 255);
  }
  // the handles' plates: anodised colour, lighter toward the top with a soft highlight, fine diagonal milling, the
  // edges darker; "SGH" glowing on the top rail above the middle window
  for (let y = 0; y < HANDLE.h; y++) for (let x = 0; x < HANDLE.w; x++) {
    const t = (y + 0.5) / HANDLE.h, n = (r() - 0.5) * 6;
    let c = add(COLORS.handle.map((v) => v * (1.18 - 0.35 * t)), 26 * Math.exp(-Math.pow((t - 0.3) / 0.07, 2)) + n);
    (x + y) % 5 === 0 && (c = add(c, -12));
    (t < 0.06 || t > 0.94) && (c = add(c, -22));
    put(HANDLE.u0 + x, HANDLE.v0 + y, c, 255);
  }
  const FONT = { S: ["111", "100", "111", "001", "111"], G: ["111", "100", "101", "101", "111"], H: ["101", "101", "111", "101", "101"] };
  // (the side face seen from the player's side shows this region mirrored left to right, so the letters are drawn mirrored)
  let lx = Math.round(hU(0.55));
  for (const ch of "HGS") { FONT[ch].forEach((row, i) => [...row].forEach((on, j) => on === "1" && put(lx + 2 - j, HANDLE.v0 + i, COLORS.glow, 255))); lx += 4; }
  // the blade swoosh (effect1: x 20.75–96, y 52.5–61.75): a band brightest in the middle, fading toward both ends
  for (let y = 52; y < 62; y++) for (let x = 20; x < 97; x++) {
    const v = 1 - Math.abs((y - 57.1) / 4.8), h = Math.sin(Math.PI * Math.min(1, Math.max(0, (x - 20.75) / 75.25)));
    const a = Math.max(0, v) * h; if (a <= 0.04) continue;
    const c = COLORS.glow.map((g, k) => Math.round(g + (COLORS.glowHot[k] - g) * Math.max(0, v - 0.5) * 2));
    put(x, y, c, Math.round(255 * Math.min(1, a * 1.2)));
  }
  // the screen slash (effect2: x 70.5–123.5, y 11.25–21): a thin hot line with a soft glow round it
  for (let y = 11; y < 22; y++) for (let x = 70; x < 124; x++) {
    const d = Math.abs(y - 16.1), h = Math.sin(Math.PI * Math.min(1, Math.max(0, (x - 70.5) / 53)));
    const a = (d < 0.8 ? 1 : Math.max(0, 1 - (d - 0.8) / 4)) * h; if (a <= 0.04) continue;
    put(x, y, d < 0.8 ? COLORS.glowHot : COLORS.glow, Math.round(255 * Math.min(1, a)));
  }
  return png(px);
}
function png(rgba) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4), t = Buffer.from(type), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ── the model ──
function build() {
  serial = 0;
  const bl = blade(), up = handle(9.5, 10.36, 9.957, true, false), dn = handle(8.46, 9.32, 8.88, false, true);
  const trailFace = { uv: [21, 53], uv_size: [74, 8] };
  const trail = { origin: [.16, 9.2, -10.8], size: [0, 1.65, 7.4], uv: { east: trailFace, west: trailFace } };
  const cubes = {
    blade2: bl.out, blade_illuminated: bl.glow,
    up: up.out, bone3_illuminated: up.glow,
    down: dn.out, bone2_illuminated: dn.glow,
    trail_illuminated: [trail],
  };
  return JSON.stringify(rig(cubes)) + "\n";
}

function packageFiles() {
  const files = {
    "model.json": Buffer.from(build()),
    "animation.json": Buffer.from(JSON.stringify(animation()) + "\n"),
  };
  // the four colours: the same shape, each its own texture (texture.png is the blue one)
  for (const v of Object.keys(VARIANTS)) files[textureName(v)] = paint(VARIANTS[v]);
  for (const [name, pcm] of Object.entries(sounds())) files["sounds/sgh_" + name + ".wav"] = pcm;
  const manifest = {
    version: 2,
    sourceItem: "sgh_butterfly",
    sourceLabel: "SGH나비칼",
    sourcePack: "DFDF",
    design: "SGH Butterfly geometry, joint rig, keyframes, texture, and synthesized sound generated in this repository.",
    files: Object.entries(files).map(([name, bytes]) => ({
      name, size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    })),
  };
  return { ...files, "manifest.json": Buffer.from(JSON.stringify(manifest, null, 2) + "\n") };
}

if (require.main === module) {
  const files = Object.entries(packageFiles());
  if (process.argv.includes("--check")) {
    const stale = files.filter(([name, bytes]) => !fs.readFileSync(path.join(DIR, name)).equals(bytes));
    if (stale.length) { console.error("SGH butterfly is out of date: " + stale.map((s) => s[0]).join(", ") + " — run node scripts/build-sgh-butterfly.js"); process.exit(1); }
    console.log("SGH butterfly: model, animations, texture and audio are up to date");
  } else {
    fs.mkdirSync(path.join(DIR, "sounds"), { recursive: true });
    for (const [name, bytes] of files) fs.writeFileSync(path.join(DIR, name), bytes);
    console.log("SGH butterfly: wrote " + files.length + " generated files");
  }
}
module.exports = { build, paint, COLORS, VARIANTS, textureName, packageFiles };
