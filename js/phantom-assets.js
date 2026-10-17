// Data-only JAR reader. Java classes, nested JARs and shaders are never loaded.
(function (root) {
  "use strict";
  const PREFIX = "assets/champions_phantom/", MAX = 48 * 1024 * 1024;
  const required = ["geo/phantom_champions_2026.geo.json", "animations/phantom_champions_2026.animation.json", "textures/item/phantom_attacker.png", "textures/item/phantom_defender.png"];
  function crc32(bytes) {
    let crc = -1;
    for (const b of bytes) { crc ^= b; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ -1) >>> 0;
  }
  function entries(buffer) {
    if (buffer.byteLength > MAX) throw Error("JAR 파일은 48MB 이하여야 합니다.");
    const v = new DataView(buffer), bytes = new Uint8Array(buffer);
    let end = bytes.length - 22;
    for (; end >= Math.max(0, bytes.length - 65557); end--) if (v.getUint32(end, true) === 0x06054b50 && end + 22 + v.getUint16(end + 20, true) === bytes.length) break;
    if (end < 0 || end < bytes.length - 65557) throw Error("올바른 JAR/ZIP 파일이 아닙니다.");
    const count = v.getUint16(end + 10, true), start = v.getUint32(end + 16, true), result = [];
    if (v.getUint16(end + 4, true) || v.getUint16(end + 6, true) || count > 4096) throw Error("지원하지 않는 ZIP 형식입니다.");
    let offset = start, total = 0;
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || v.getUint32(offset, true) !== 0x02014b50) throw Error("손상된 ZIP 목록입니다.");
      const method = v.getUint16(offset + 10, true), size = v.getUint32(offset + 24, true), packed = v.getUint32(offset + 20, true);
      const len = v.getUint16(offset + 28, true), extra = v.getUint16(offset + 30, true), comment = v.getUint16(offset + 32, true);
      const next = offset + 46 + len + extra + comment;
      if (next > end) throw Error("손상된 ZIP 항목입니다.");
      const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + len));
      if (name.startsWith(PREFIX) && /^(geo\/|animations\/|textures\/)/.test(name.slice(PREFIX.length)) && /\.(png|json)$/.test(name)) {
        if (name.includes("..") || name.includes("\\") || result.some((e) => e.name === name.slice(PREFIX.length))) throw Error("잘못된 자산 경로입니다.");
        total += size;
        if (size > 8 * 1024 * 1024 || total > MAX || (v.getUint16(offset + 8, true) & 1) || ![0, 8].includes(method)) throw Error("지원하지 않는 자산 압축입니다.");
        const local = v.getUint32(offset + 42, true);
        if (local + 30 > start || v.getUint32(local, true) !== 0x04034b50) throw Error("손상된 ZIP 데이터입니다.");
        const data = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
        if (data + packed > start) throw Error("자산 크기가 올바르지 않습니다.");
        result.push({ name: name.slice(PREFIX.length), method, size, crc: v.getUint32(offset + 16, true), bytes: bytes.slice(data, data + packed) });
      }
      offset = next;
    }
    if (!required.every((name) => result.some((e) => e.name === name))) throw Error("챔피언스 팬텀 모델과 공격·수비 텍스처를 찾을 수 없습니다.");
    return result;
  }
  async function inflate(bytes, max) {
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const chunks = []; let size = 0;
    try {
      for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > max) throw Error("압축 해제 크기가 올바르지 않습니다."); chunks.push(item.value); }
    } finally { await reader.cancel(); }
    const out = new Uint8Array(size); let at = 0; for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; } return out;
  }
  async function read(buffer, decompress = inflate) {
    const out = Object.create(null);
    for (const entry of entries(buffer)) {
      const bytes = entry.method === 8 ? await decompress(entry.bytes, entry.size) : entry.bytes;
      if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) throw Error("손상된 자산: " + entry.name);
      out[entry.name] = bytes;
    }
    validate(out); return out;
  }
  async function bundled(fetcher = fetch, base = "./assets/champions-phantom/2026-0.1.0/") {
    const response = await fetcher(base + "manifest.json");
    if (!response.ok) throw Error("원본 리소스 목록을 불러오지 못했습니다.");
    const manifest = await response.json(), files = manifest.files;
    if (!Array.isArray(files) || !files.length || files.length > 128) throw Error("원본 리소스 목록이 올바르지 않습니다.");
    const names = new Set(); let total = 0;
    for (const file of files) {
      if (typeof file.name !== "string" || !/^(geo|animations|textures)\/[a-zA-Z0-9_./-]+\.(png|json)$/.test(file.name) || file.name.includes("..") || names.has(file.name) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 8 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error("원본 리소스 항목이 올바르지 않습니다.");
      names.add(file.name); total += file.size;
    }
    if (total > MAX) throw Error("원본 리소스가 너무 큽니다.");
    const out = Object.create(null);
    await Promise.all(files.map(async (file) => {
      const result = await fetcher(base + file.name);
      if (!result.ok) throw Error("원본 리소스를 불러오지 못했습니다: " + file.name);
      const bytes = new Uint8Array(await result.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)), (n) => n.toString(16).padStart(2, "0")).join("");
      if (bytes.length !== file.size || sha256 !== file.sha256) throw Error("원본 리소스가 손상되었습니다: " + file.name);
      out[file.name] = bytes;
    }));
    validate(out); return out;
  }
  const json = (assets, name) => JSON.parse(new TextDecoder().decode(assets[name]));
  function validate(assets) {
    if (!required.every((key) => assets[key] instanceof Uint8Array)) throw Error("필수 자산이 없습니다.");
    const geo = json(assets, required[0])["minecraft:geometry"]?.[0], clips = json(assets, required[1]).animations;
    if (!geo || !Array.isArray(geo.bones) || !geo.bones.length || geo.bones.length > 256 || !clips || typeof clips !== "object") throw Error("지원하지 않는 모델입니다.");
    if (![geo.description?.texture_width, geo.description?.texture_height].every((n) => Number.isFinite(n) && n > 0 && n <= 4096)) throw Error("잘못된 모델 텍스처 크기입니다.");
    let cubes = 0; const names = new Set(geo.bones.map((b) => b.name));
    if (names.size !== geo.bones.length) throw Error("중복된 모델 뼈대입니다.");
    const vec = (a) => Array.isArray(a) && a.length === 3 && a.every((n) => Number.isFinite(n) && Math.abs(n) < 10000);
    for (const bone of geo.bones) {
      if (!vec(bone.pivot || [0, 0, 0]) || (bone.rotation && !vec(bone.rotation))) throw Error("잘못된 모델 좌표입니다.");
      const visited = new Set([bone.name]); let parent = bone.parent;
      while (parent) { if (!names.has(parent) || visited.has(parent)) throw Error("잘못된 모델 계층입니다."); visited.add(parent); parent = geo.bones.find((b) => b.name === parent).parent; }
      for (const cube of bone.cubes || []) {
        if (!vec(cube.origin) || !vec(cube.size) || cube.size.some((n) => n < 0) || (cube.rotation && !vec(cube.rotation)) || (cube.pivot && !vec(cube.pivot))) throw Error("잘못된 모델 상자입니다.");
        if (++cubes > 12000) throw Error("모델이 너무 큽니다.");
      }
    }
    if (!cubes) throw Error("비어 있는 모델입니다.");
    return { geo, clips };
  }
  // Numeric GeckoLib tracks only. Molang/expression strings are deliberately not executed.
  function sample(track, time, fallback) {
    const value = (x) => {
      x = x && !Array.isArray(x) && typeof x === "object" ? (x.post || x.pre || x.vector) : x;
      return Array.isArray(x) && x.length === 3 && x.every((n) => Number.isFinite(n) && Math.abs(n) < 10000) ? x : fallback;
    };
    if (Array.isArray(track) || !track) return value(track);
    const keys = Object.keys(track).filter((k) => Number.isFinite(+k)).sort((a, b) => +a - +b);
    if (!keys.length) return fallback;
    if (time <= +keys[0]) return value(track[keys[0]]);
    for (let i = 1; i < keys.length; i++) if (time <= +keys[i]) {
      const a = value(track[keys[i - 1]]), b = value(track[keys[i]]), f = (time - +keys[i - 1]) / (+keys[i] - +keys[i - 1]);
      return a.map((n, j) => n + (b[j] - n) * f);
    }
    return value(track[keys[keys.length - 1]]);
  }
  const api = { entries, read, bundled, validate, json, sample, crc32, required };
  if (typeof module === "object" && module.exports) module.exports = api; else root.PHANTOM_ASSETS = api;
})(typeof window === "object" ? window : globalThis);
