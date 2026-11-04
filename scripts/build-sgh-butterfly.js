// SGH butterfly (SGH나비칼): the knife's own shape and texture, drawn here, on the retained butterfly rig.
// The bones of assets/rgx-firefly/v1/model.json (names, parents, pivots, rotations) are kept exactly, so the retained
// animations (inspect, draw, the three cuts, the handles turning round their pins) and the sounds play unchanged. Only
// the cubes inside the blade, the two handles and their glowing parts are replaced, and texture.png is painted here.
//   node scripts/build-sgh-butterfly.js          rewrite model.json, texture.png and the manifest's fingerprints
//   node scripts/build-sgh-butterfly.js --check  fail when they are not what this script makes
"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), zlib = require("node:zlib");
const DIR = path.resolve(__dirname, "../assets/rgx-firefly/v1");
const D = require("../js/rgx-firefly-data");

// ── the palette: 8×8 cells in the lower half of the 128×128 texture (the upper half holds the two effect planes) ──
const W = 128, H = 128, CELL = 8, ROW0 = 64;
const COLORS = {
  blade: [207, 214, 222], fuller: [150, 160, 172], edge: [242, 245, 248], black: [35, 38, 44],
  handle: [31, 79, 168], handleDark: [22, 58, 125], titanium: [125, 132, 142], gold: [209, 166, 70],
  glow: [95, 240, 255], glowHot: [200, 251, 255],
};
const NAMES = Object.keys(COLORS);
const cellOf = (name) => { const i = NAMES.indexOf(name); return [(i % 16) * CELL, ROW0 + Math.floor(i / 16) * CELL]; };

// a cube [x0,y0,z0]-[x1,y1,z1] in the source's units, painted one colour (the face samples a texel inside its cell,
// varied per cube so neighbouring cubes do not read as one flat block)
let serial = 0;
function cube(a, b, color) {
  const [cx, cy] = cellOf(color), j = serial++ % 5, u = cx + 1.5 + j, v = cy + 1.5 + ((j * 3) % 5);
  const face = { uv: [u, v], uv_size: [1, 1] };
  const origin = [0, 1, 2].map((i) => +Math.min(a[i], b[i]).toFixed(4)), size = [0, 1, 2].map((i) => +Math.abs(b[i] - a[i]).toFixed(4));
  return { origin, size, uv: { north: face, east: face, south: face, west: face, up: face, down: face } };
}

// ── the blade (bone blade2): a drop point with a straight spine that falls to the tip, a belly rising to meet it,
//    a ground edge, a recessed fuller with a glowing line, a finger hole, jimping on the spine and a black ricasso
//    with gold pins where the handles turn ──
function blade() {
  const out = [], glow = [];
  const top = (z) => (z > -8.4 ? 10.05 : 10.05 - ((-8.4 - z) / 2.6) * 0.9);
  const bot = (z) => (z > -6.8 ? 8.78 : 8.78 + Math.pow((-6.8 - z) / 4.2, 1.6) * 0.37);
  const STEP = 0.26;
  for (let z1 = -3.2; z1 > -11.0 + 1e-6; z1 -= STEP) {
    const z0 = Math.max(-11.0, z1 - STEP), zm = (z0 + z1) / 2, t = top(zm), b = bot(zm);
    if (t - b < 0.08) { out.push(cube([-0.05, b - 0.02, z0], [0.05, b + 0.06, z1], "edge")); continue; }
    const e = Math.min(b + 0.22, t - 0.02);
    out.push(cube([-0.06, b, z0], [0.06, e, z1], "edge"));
    const hole = zm < -3.5 && zm > -4.3, fuller = zm < -4.5 && zm > -8.2;
    if (hole) {
      out.push(cube([-0.11, e, z0], [0.11, 9.25, z1], "blade"), cube([-0.11, 9.75, z0], [0.11, t, z1], "blade"));
    } else if (fuller) {
      out.push(cube([-0.11, e, z0], [0.11, 9.35, z1], "blade"), cube([-0.08, 9.35, z0], [0.08, 9.6, z1], "fuller"), cube([-0.11, 9.6, z0], [0.11, t, z1], "blade"));
    } else out.push(cube([-0.11, e, z0], [0.11, t, z1], "blade"));
  }
  // jimping: small teeth on the spine above the finger hole
  for (let i = 0; i < 4; i++) { const z = -3.35 - i * 0.22; out.push(cube([-0.09, 10.05, z - 0.11], [0.09, 10.12, z], "black")); }
  // the ricasso and the pins the handles turn on
  out.push(cube([-0.12, 8.8, -3.2], [0.12, 10.12, -2.25], "black"));
  for (const y of [9.957, 8.88]) out.push(cube([-0.16, y - 0.1, -2.72], [0.16, y + 0.1, -2.52], "gold"));
  out.push(cube([-0.15, 9.3, -2.82], [0.15, 9.54, -2.58], "gold"));
  glow.push(cube([-0.095, 9.44, -8.1], [0.095, 9.51, -4.6], "glow"), cube([-0.13, 9.6, -3.12], [0.13, 9.7, -2.95], "glowHot"));
  return { out, glow };
}

// ── a handle (bones up / down): side plates with three windows, a titanium spacer along the outer edge, a rounded
//    head round the pin with gold pin caps, a tail cap with a gold band (the down handle carries the latch), and a
//    glowing bar seen through each window ──
function handle(yLo, yHi, pinY, outerTop, latch) {
  const out = [], glow = [], R = 0.18;
  const zA = -3.1, zB = 5.85;
  for (const s of [-1, 1]) {
    const x0 = s * 0.14, x1 = s * 0.26;
    out.push(cube([x0, yLo, -2.0], [x1, yLo + R, 4.9], "handle"), cube([x0, yHi - R, -2.0], [x1, yHi, 4.9], "handle"));
    for (const [p0, p1] of [[-0.15, 0.15], [2.35, 2.65]]) out.push(cube([x0, yLo + R, p0], [x1, yHi - R, p1], "handleDark"));
    // pin caps
    out.push(cube([s * 0.26, pinY - 0.11, -2.73], [s * 0.3, pinY + 0.11, -2.51], "gold"));
  }
  // the head round the pin (a step in at the very end reads as a rounded end)
  out.push(cube([-0.26, yLo, -2.95], [0.26, yHi, -2.0], "handle"), cube([-0.24, yLo + 0.12, zA], [0.24, yHi - 0.12, -2.95], "handle"));
  // the spacer along the outer edge
  const oy = outerTop ? [yHi - 0.2, yHi] : [yLo, yLo + 0.2];
  out.push(cube([-0.14, oy[0], -2.0], [0.14, oy[1], 4.9], "titanium"));
  // the tail cap and its gold band
  out.push(cube([-0.26, yLo, 4.9], [0.26, yHi, zB - 0.12], "handle"), cube([-0.22, yLo + 0.08, zB - 0.12], [0.22, yHi - 0.08, zB], "handleDark"));
  out.push(cube([-0.265, yLo + 0.02, 5.3], [0.265, yHi - 0.02, 5.42], "gold"));
  if (latch) out.push(cube([-0.07, yHi - 0.22, zB], [0.07, yHi - 0.04, zB + 0.2], "gold"));
  // a glowing bar through each window, and a line on the tail cap
  const ym = (yLo + yHi) / 2;
  for (const [w0, w1] of [[-2.0, -0.15], [0.15, 2.35], [2.65, 4.9]]) glow.push(cube([-0.2, ym - 0.03, w0 + 0.12], [0.2, ym + 0.03, w1 - 0.12], "glow"));
  glow.push(cube([-0.27, ym - 0.025, 5.0], [0.27, ym + 0.025, 5.25], "glowHot"));
  return { out, glow };
}

// ── the texture ──
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function paint() {
  const px = new Uint8Array(W * H * 4), r = rng(1101);
  const put = (x, y, c, a) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; };
  NAMES.forEach((name) => {
    const [cx, cy] = cellOf(name), c = COLORS[name];
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const n = (r() - 0.5) * 14 - (y - CELL / 2) * 1.2;
      put(cx + x, cy + y, c.map((v) => Math.max(0, Math.min(255, Math.round(v + n)))), 255);
    }
  });
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

// ── the model: the source bones, the new cubes ──
function build() {
  serial = 0;
  const src = D.parse(fs.readFileSync(path.join(DIR, "model.json"), "utf8")), geo = src["minecraft:geometry"][0];
  const bl = blade(), up = handle(9.5, 10.36, 9.957, true, false), dn = handle(8.46, 9.32, 8.88, false, true);
  const cubes = { blade2: bl.out, blade_illuminated: bl.glow, up: up.out, bone3_illuminated: up.glow, down: dn.out, bone2_illuminated: dn.glow };
  for (const b of geo.bones) if (cubes[b.name]) b.cubes = cubes[b.name];
  geo.description.identifier = "geometry.sgh_butterfly";
  return JSON.stringify(src) + "\n";
}

if (require.main === module) {
  // the model is built from the bones of what is there; a second run gives the same bytes
  const model = Buffer.from(build()), texture = paint();
  const mPath = path.join(DIR, "manifest.json"), manifest = JSON.parse(fs.readFileSync(mPath, "utf8"));
  const want = { "model.json": model, "texture.png": texture };
  if (process.argv.includes("--check")) {
    const stale = Object.entries(want).filter(([n, b]) => !fs.readFileSync(path.join(DIR, n)).equals(b) || manifest.files.find((f) => f.name === n).sha256 !== crypto.createHash("sha256").update(b).digest("hex"));
    if (stale.length) { console.error("SGH butterfly is out of date: " + stale.map((s) => s[0]).join(", ") + " — run node scripts/build-sgh-butterfly.js"); process.exit(1); }
    console.log("SGH butterfly: model.json and texture.png are up to date");
  } else {
    for (const [n, b] of Object.entries(want)) { fs.writeFileSync(path.join(DIR, n), b); const f = manifest.files.find((x) => x.name === n); f.size = b.length; f.sha256 = crypto.createHash("sha256").update(b).digest("hex"); }
    manifest.sourceLabel = "SGH나비칼";
    manifest.design = "SGH butterfly: model geometry and texture drawn by scripts/build-sgh-butterfly.js; the retained rig bones, animations and sounds are unchanged";
    fs.writeFileSync(mPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log("SGH butterfly: wrote model.json (" + model.length + " bytes) and texture.png (" + texture.length + " bytes)");
  }
}
module.exports = { build, paint, COLORS };
