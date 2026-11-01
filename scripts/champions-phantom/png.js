// Minimal deterministic RGBA PNG encoder and pixel canvas for the Champions
// Phantom asset generator. No third-party image data is read or embedded.
"use strict";
const zlib = require("node:zlib");

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length), name = Buffer.from(type, "latin1");
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc(Buffer.concat([name, data])), 8 + data.length);
  return out;
}
function encode(canvas) {
  const { w, h, data } = canvas, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0); header.writeUInt32BE(h, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.data = new Uint8Array(w * h * 4); }
  set(x, y, color, alpha = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = Array.isArray(color) ? color : hex(color), i = (y * this.w + x) * 4;
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = alpha;
  }
  // Additive-style "over" blend, used by the soft FX sprites.
  blend(x, y, color, alpha) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || alpha <= 0) return;
    const [r, g, b] = Array.isArray(color) ? color : hex(color), i = (y * this.w + x) * 4, a = Math.min(1, alpha), d = this.data;
    const old = d[i + 3] / 255, out = a + old * (1 - a);
    for (const [k, v] of [[0, r], [1, g], [2, b]]) d[i + k] = Math.round(out ? (v * a + d[i + k] * old * (1 - a)) / out : 0);
    d[i + 3] = Math.round(out * 255);
  }
  get(x, y) { const i = (y * this.w + x) * 4; return [...this.data.subarray(i, i + 4)]; }
  rect(x, y, w, h, color, alpha = 255) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color, alpha); }
  line(x0, y0, x1, y1, color, alpha = 255) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), color, alpha);
  }
}
// Small seeded generator (mulberry32) so every build produces the same bytes.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Integer hash noise in [0,1), stable for a lattice point.
function hash(...n) {
  let h = 2166136261;
  for (const v of n) { h ^= Math.floor(v * 4096) | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
module.exports = { encode, Canvas, rng, hash, hex, crc };
