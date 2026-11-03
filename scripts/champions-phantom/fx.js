// Finisher FX sprites, kill-banner frames/emblems and the gun's kill-coat
// art, all drawn here from simple shapes. White sprites are tinted at runtime.
"use strict";
const { Canvas, rng, hash } = require("./png");

const clamp = (n) => Math.max(0, Math.min(1, n));
const step = (n, levels = 6) => Math.round(clamp(n) * levels) / levels; // banded, pixel-art falloff
function sprite(w, h, fn, levels = 6) {
  const c = new Canvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const out = fn((x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1, x, y);
    if (!out) continue;
    const [color, alpha] = out, a = step(alpha, levels);
    if (a > 0) c.set(x, y, color, Math.round(a * 255));
  }
  return c;
}
const white = [255, 255, 255];
const shade = (k) => [Math.round(200 + 55 * k), Math.round(200 + 55 * k), Math.round(200 + 55 * k)];

function fxTextures() {
  const out = {};
  out.white = sprite(4, 4, () => [white, 1]);
  out.glow = sprite(32, 32, (x, y) => { const r = Math.hypot(x, y); return [shade(1 - r), (1 - r) ** 1.6]; });
  out.ember = sprite(8, 8, (x, y) => { const e = Math.max(Math.abs(x), Math.abs(y)); return [white, e > 0.8 ? 0.4 : e > 0.55 ? 0.75 : 1]; }, 4); // soft-edged square
  out.diamond = sprite(8, 8, (x, y) => [white, Math.abs(x) + Math.abs(y) < 0.95 ? 1 : 0], 1);
  out.ray = sprite(16, 64, (x, y) => [shade(1 - Math.abs(x)), (1 - Math.abs(x) ** 1.4) * (1 - Math.abs(y) ** 4)]);
  out.ring = sprite(64, 64, (x, y) => { const d = Math.abs(Math.hypot(x, y) - 0.72); return [shade(1 - d * 6), 1 - d / 0.2]; });
  // Four long and four short rays around a hot core.
  out.star8 = sprite(64, 64, (x, y) => {
    const r = Math.hypot(x, y), a = Math.atan2(y, x), long = Math.abs(Math.cos(2 * a)) ** 40, short = Math.abs(Math.sin(2 * a)) ** 60;
    const v = Math.max(long * (1 - r), short * (1 - r * 1.7) * 0.8, (1 - r * 3.2));
    return [shade(v), v];
  });
  // Two broken, tapering crescents that read as a spin when rotated.
  out.swirl = sprite(64, 64, (x, y) => {
    const r = Math.hypot(x, y), a = (Math.atan2(y, x) + Math.PI * 2) % Math.PI, k = a / Math.PI;
    const band = 1 - Math.abs(r - (0.5 + 0.38 * k)) / (0.03 + 0.07 * k);
    return [shade(k), band * k * 1.3];
  });
  out.vignette = sprite(64, 64, (x, y) => [[0, 0, 0], clamp((Math.hypot(x, y) - 0.45) * 1.6)]);
  // Ribbons: a hot core fading to dark rims across the strip height.
  const ribbon = (core, rim) => sprite(64, 16, (x, y) => {
    const k = 1 - Math.abs(y), c = core.map((v, i) => Math.round(rim[i] + (v - rim[i]) * step(k, 4)));
    return [c, k > 0.08 ? 1 : 0];
  }, 1);
  out.ribbon_red = ribbon([255, 120, 64], [40, 6, 8]);
  out.ribbon_white = ribbon([255, 250, 236], [120, 96, 70]);
  // Night sky: a few large soft squares, plus-shaped bright stars and a scatter of small points; tiles 10x5 on the dome.
  const sky = new Canvas(128, 128), r = rng(2026);
  sky.rect(0, 0, 128, 128, [0, 0, 0]);
  for (let i = 0; i < 22; i++) { // big, soft squares: flat grey with a slightly dimmer rim
    const x = Math.floor(r() * 122), y = Math.floor(r() * 122), size = 3 + Math.floor(r() * 3), b = 95 + Math.floor(r() * 60);
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const edge = Math.min(dx, dy, size - 1 - dx, size - 1 - dy), k = edge === 0 ? 0.8 : 1;
      sky.set(x + dx, y + dy, [b * k, b * k, b * k + 6]);
    }
  }
  for (let i = 0; i < 44; i++) {
    const x = Math.floor(r() * 128), y = Math.floor(r() * 128), b = 150 + Math.floor(r() * 105);
    sky.set(x, y, [b, b, Math.min(255, b + 20)]);
    if (r() < 0.3) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) sky.set(x + dx, y + dy, [b * 0.55, b * 0.55, b * 0.6]);
  }
  for (let i = 0; i < 110; i++) { const b = 60 + Math.floor(r() * 90); sky.set(Math.floor(r() * 128), Math.floor(r() * 128), [b, b, b + 12]); }
  out.sky_stars = sky;
  return out;
}

// ── kill banner: a diamond crest that gains ornaments with every kill ──
function frame(level) {
  const c = new Canvas(128, 128), gold = [236, 190, 88], pale = [255, 237, 194], grey = [154, 111, 59];
  const diamond = (r, color, gap = 0) => {
    for (let t = 0; t < 4 * r; t++) {
      const side = Math.floor(t / r), k = t % r;
      if (gap && Math.abs(k - r / 2) < gap) continue;
      const [x, y] = [[64 - r + k, 64 - k], [64 + k, 64 - r + k], [64 + r - k, 64 + k], [64 - k, 64 + r - k]][side];
      c.set(x, y, color); c.set(x, y + 1, color); c.set(x + 1, y, color);
    }
  };
  // Interlocked scale facets echo the new receiver, around a clear central crest.
  for(const side of [-1,1])for(let i=0;i<level+1;i++){
    const x=64+side*(23+i*4),y=49+i*3;
    c.line(x,y,x+side*4,y+4,gold);c.line(x+side*4,y+4,x,y+8,gold);
    c.line(x,128-y,x+side*4,124-y,gold);
  }
  diamond(40, pale, level >= 2 ? 0 : 12);
  if (level >= 2) {
    diamond(34, grey, 9);
    for (const [x, y] of [[64, 24], [64, 104], [24, 64], [104, 64]]) c.rect(x - 2, y - 2, 4, 4, pale);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { c.set(64 + s * (8 + i), 36 - i, grey); c.set(64 + s * (8 + i), 92 + i, grey); }
  }
  if (level >= 3) for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { c.rect(64 + s * (28 + i * 2) - 1, 44 + i * 4, 2, 2, gold); c.rect(64 + s * (28 + i * 2) - 1, 80 - i * 4, 2, 2, gold); }
  if (level >= 3) for (const s of [-1, 1]) { // side wings
    for (let i = 0; i < 12; i++) { c.set(64 + s * (44 + i), 64 - i, gold); c.set(64 + s * (44 + i), 64 + i, gold); }
    c.rect(64 + s * 50 - 1, 63, 3, 3, pale);
  }
  if (level >= 4) for (const s of [-1, 1]) for (let i = 0; i < 10; i++) { c.set(64 + s * (4 + i), 20 - i, gold); c.set(64 + s * (4 + i), 108 + i, gold); }
  if (level >= 5) {
    for (let i = 0; i < 14; i++) { c.set(64, 18 - i, gold); c.set(63, 18 - i, gold); c.set(64, 110 + i, gold); c.set(63, 110 + i, gold); }
    diamond(46, gold, 20);
    for (const [x, y] of [[64, 10], [64, 118], [12, 64], [116, 64]]) c.rect(x - 2, y - 2, 4, 4, pale);
  }
  return c;
}
// A 192×48 strip: two wings around a centre gem; the finisher version adds outer chevrons.
function emblem(attacker, finisher) {
  const c = new Canvas(192, 48), hot = attacker ? [255, 74, 92] : [255, 214, 130], deep = attacker ? [170, 22, 40] : [214, 150, 60];
  const gem = (cx, cy, r, color) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.abs(x) + Math.abs(y) <= r) c.set(cx + x, cy + y, Math.abs(x) + Math.abs(y) > r - 2 ? deep : color); };
  gem(96, 24, 11, hot);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x0 = 96 + s * (20 + i * 9);
    for (let k = 0; k < 9; k++) { c.set(x0 + s * k * 0.5, 24 - k, i % 2 ? deep : hot); c.set(x0 + s * k * 0.5, 24 + k, i % 2 ? deep : hot); c.set(x0 + s * (k * 0.5 + 1), 24 - k, deep); c.set(x0 + s * (k * 0.5 + 1), 24 + k, deep); }
  }
  if (finisher) for (const s of [-1, 1]) {
    for (let k = 0; k < 14; k++) { c.set(96 + s * (62 + k * 0.6), 24 - k, hot); c.set(96 + s * (62 + k * 0.6), 24 + k, hot); }
    gem(96 + s * 84, 24, 4, hot);
    gem(96, 6, 3, hot); gem(96, 42, 3, hot);
  }
  return c;
}
function bannerTextures() {
  const out = {};
  for (let k = 1; k <= 5; k++) out["frame" + k] = frame(k);
  out.frame_fin = frame(5);
  for (const side of ["attacker", "defender"]) { out["emblem_new_" + side] = emblem(side === "attacker", false); out["emblem_fin_" + side] = emblem(side === "attacker", true); }
  return out;
}

// ── gun kill-coat art (read by js/phantom-gun-wave.js) ──
// side: 512×140 over x -22.75..41.25 and y 5..-12.5 (8 texels per unit);
// top: 512×32 over z 2..-2. Red = coat strength, green = dissolve order, blue = wisps.
function gunArt() {
  const side = new Canvas(512, 140), top = new Canvas(512, 32);
  const noise = (x, y, s) => { // smooth value noise
    const xi = Math.floor(x / s), yi = Math.floor(y / s), fx = x / s - xi, fy = y / s - yi, sm = (t) => t * t * (3 - 2 * t);
    const v = (a, b) => hash(a, b, s);
    return (v(xi, yi) * (1 - sm(fx)) + v(xi + 1, yi) * sm(fx)) * (1 - sm(fy)) + (v(xi, yi + 1) * (1 - sm(fx)) + v(xi + 1, yi + 1) * sm(fx)) * sm(fy);
  };
  for (const [c, h] of [[side, 140], [top, 32]]) for (let y = 0; y < h; y++) for (let x = 0; x < 512; x++) {
    const f = x / 8 - 22.75, height = c === side ? 5 - y / 8 : 0;
    const green = Math.round(step(noise(x, y, 9) * 0.7 + noise(x, y, 4) * 0.3, 7) * 255);
    // Flame tongues licking up the upper receiver (f -9.6..13).
    const tongue = Math.sin(f * 1.3) * 0.5 + Math.sin(f * 0.47 + 1) * 0.6 + Math.sin(f * 3.1 + 2) * 0.35, crest = 2.6 + tongue;
    let red = 0;
    if (f > -9.6 && f < 13 && (c === top || (height > 1.25 && height < crest))) red = height > crest - 0.8 || c === top && noise(x, y, 5) > 0.6 ? 255 : noise(x, y, 6) > 0.45 ? 128 : 40;
    const blue = c === side && Math.abs(Math.sin(f * 0.9 + height * 1.7)) > 0.97 && f > -14 && f < 16 ? 200 : 0;
    c.set(x, y, [red, green, blue]);
  }
  return { side, top };
}
// Four 8×24 flame frames side by side (32×24), tinted per side.
function lick(attacker) {
  const c = new Canvas(32, 24), r = rng(attacker ? 11 : 12);
  const ramp = attacker ? [[120, 16, 16], [210, 40, 30], [255, 96, 60], [255, 190, 150]] : [[150, 90, 30], [220, 160, 60], [255, 214, 120], [255, 246, 214]];
  for (let f = 0; f < 4; f++) for (let y = 0; y < 24; y++) {
    const k = 1 - y / 23, width = 3.6 * (1 - k * 0.85) * (0.8 + 0.25 * Math.sin(f * 1.6 + y * 0.6)), sway = Math.sin(f * 1.57 + y * 0.35) * 0.9 * k;
    for (let x = 0; x < 8; x++) {
      const d = Math.abs(x + 0.5 - 4 - sway) / width;
      if (d > 1 || r() < 0.04 * k) continue;
      const level = Math.min(3, Math.floor((1 - d) * 2.2 + (1 - k) * 1.6));
      c.set(f * 8 + x, y, ramp[level], 255);
    }
  }
  return c;
}
module.exports = { fxTextures, bannerTextures, gunArt, lick };
