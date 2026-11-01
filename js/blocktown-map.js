/* 네모 마을 (blocktown) in the game: a 5v5 map of blocks, built in code from js/blocktown-layout.js.
   · the look: every block face is a 16 × 16 pixel tile painted here on a canvas (grass, dirt, stone, planks, bricks,
     wool, hay, ore…, all drawn by this file); faces between solid blocks are dropped, faces that line up are merged
     into one quad that repeats its tile, and each corner gets a little shade from the blocks around it. The map is
     cut into 48-block chunks, so the whole map is a dozen meshes in one material (plus one for the wheat).
   · bodies and bullets: the solid blocks are merged into boxes (the engine's colliders, floors with a y0 where you
     can walk under them), so the engine's movement, steps, shots and sight lines work on it unchanged.
   · bots: a walk graph on half-block cells, with a height per level, so a cell under the bridge and the bridge over
     it are two places; every link is tried with the real body movement once, then routes are flow fields, kept for
     the last few goals.
   No file is downloaded for this map. */
(() => {
  "use strict";
  const LAY = window.BLOCKTOWN_LAYOUT;
  if (!LAY || "undefined" == typeof MAPS || "function" != typeof loadMap || "undefined" == typeof T || MAPS.blocktown) return;
  const KEY = "blocktown";
  const EN = "en" === window.GAME_LANG, tr = (ko, en) => (EN ? en : ko);
  const NAME = tr("네모 마을", "Blocktown");
  const { B, NX, NY, NZ, MAT, PLACES } = LAY;
  const hex = (s) => parseInt(String(s).replace("#", ""), 16);
  const W = (p) => LAY.toWorld(p);

  // ── the map record ──
  const nodes = {};
  for (const k in PLACES.nodes) nodes[k] = W(PLACES.nodes[k]);
  const DATA = {
    key: KEY, name: NAME, theme: KEY, size: 5,
    sky: hex("#bfe0fb"), fog: 0.0026, sunColor: hex("#fff1d6"), sunInt: 1.25, ambient: 0.95,
    bounds: { ...LAY.bounds },
    attackSpawn: W(PLACES.attackSpawn), defendSpawn: W(PLACES.defendSpawn),
    sites: PLACES.sites.map((s) => ({ id: s.id, label: s.label, r: s.r, ...W(s.at) })),
    nodes, walls: [],
  };
  MAPS[KEY] = DATA;
  "undefined" != typeof THEMES && THEMES.glacier && !THEMES[KEY] && (THEMES[KEY] = { ...THEMES.glacier });
  "undefined" != typeof MOODS && (MOODS[KEY] = {
    top: "#4f93dc", mid: "#9ccaf2", hor: "#e4f3ff", fog: hex("#cfe6f8"),
    hemiSky: hex("#ffffff"), hemiGnd: hex("#9a8a6a"), hemi: 0.95, exp: 1.0, env: 0.35,
    sun: hex("#fff1d6"), sunInt: 1.25, glow: "#fff6e6",
    tint: [1, 1, 1], lift: [0, 0, 0], sat: 1.06, con: 1.04, vig: 0.16, bloom: 0.5,
  });

  // ── the pictures: 16 × 16 pixel tiles, painted here ──
  const C = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  function paintTile(name, set, R) {
    const pick = (list) => C(list[(R() * list.length) | 0]);
    const jit = (c, a = 0.06) => mul(c, 1 + (R() - 0.5) * 2 * a);
    const noisy = (list, a) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, jit(pick(list), a)); };
    const specks = (list, n) => { for (let i = 0; i < n; i++) set((R() * 16) | 0, (R() * 16) | 0, pick(list)); };
    const DIRT = [0x8a5a35, 0x7a4d2c, 0x96663f, 0x6e4527, 0x9c6d44], GREEN = [0x5da83a, 0x67b444, 0x4f9a31, 0x74c04f, 0x58a236];
    const GREY = [0x8a8a8a, 0x7d7d7d, 0x949494, 0x858585, 0x8f8f8f], GRAVEL = [0x8b8580, 0x77726d, 0x9a948c, 0x6a6560, 0xa39a8f, 0x7f7468];
    const bricks = (rowH, brickW, mortar, list, bevel) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const row = (y / rowH) | 0, off = (row % 2) * (brickW >> 1), bx = ((x + off) / brickW) | 0;
        if (y % rowH === rowH - 1 || (x + off) % brickW === brickW - 1) set(x, y, jit(C(mortar), 0.04));
        else {
          const base = C(list[(row * 7 + bx * 3) % list.length]);
          set(x, y, jit(mul(base, bevel && y % rowH === 0 ? 1.12 : 1), 0.05));
        }
      }
    };
    const ribs = (base) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const k = y === 0 || y === 15 ? 0.7 : x % 4 === 0 ? 0.8 : x % 4 === 1 ? 1.12 : 1;
        set(x, y, jit(mul(C(base), k), 0.03));
      }
      set(13, 7, C(0x2c2c2c)); set(13, 8, C(0x2c2c2c));
    };
    const wool = (base) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, jit(mul(C(base), (x + y) % 4 === 0 ? 1.1 : (x - y + 16) % 4 === 0 ? 0.9 : 1), 0.05)); };
    const rows = (h, list, line, hi) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const row = (y / h) | 0, off = (row % 2) * 2, tile = ((x + off) / 4) | 0;
        const base = C(list[(row * 5 + tile) % list.length]);
        set(x, y, y % h === h - 1 || (x + off) % 4 === 3 && y % h === h - 2 ? jit(C(line), 0.05) : jit(mul(base, y % h === 0 ? hi : 1), 0.05));
      }
    };
    switch (name) {
      case "grass_top": noisy(GREEN, 0.05); specks([0x3f8a2a, 0x7fcb57], 14); break;
      case "grass_side": {
        noisy(DIRT, 0.05); specks([0x5a3a20, 0xa8784c], 6);
        for (let x = 0; x < 16; x++) { const d = 3 + (R() < 0.45 ? 1 : 0) + (R() < 0.2 ? 1 : 0); for (let y = 0; y < d; y++) set(x, y, jit(pick(GREEN), 0.05)); }
        break;
      }
      case "dirt": noisy(DIRT, 0.05); specks([0x5a3a20], 8); specks([0xa8784c, 0xb08a64], 4); break;
      case "stone": noisy(GREY, 0.04); for (let i = 0; i < 6; i++) { const x = (R() * 14) | 0, y = (R() * 16) | 0; set(x, y, C(0x6b6b6b)); set(x + 1, y, C(0x707070)); } break;
      case "cobble": {
        // round stones (cells around a few random points) in grey mortar, lit from the top left
        const seeds = Array.from({ length: 7 }, () => [R() * 16, R() * 16, pick([0x9a9a9a, 0x8a8a8a, 0xa6a6a6, 0x939393])]);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          let d1 = 1e9, d2 = 1e9, c = null;
          for (const [sx, sy, col] of seeds) for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) {
            const d = Math.hypot(x - sx - ox, y - sy - oy);
            d < d1 ? ((d2 = d1), (d1 = d), (c = col)) : d < d2 && (d2 = d);
          }
          set(x, y, d2 - d1 < 0.9 ? jit(C(0x666666), 0.04) : jit(mul(c, d2 - d1 < 1.8 ? 0.88 : 1), 0.05));
        }
        break;
      }
      case "planks": {
        const list = [0xa8824f, 0x9c7745, 0xb38c57, 0xa17a48];
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const b = y >> 2, seam = (b * 5 + 3) % 16;
          set(x, y, y % 4 === 3 || x === seam ? C(0x6f5230) : jit(C(list[b]), 0.05));
        }
        specks([0x8a6538], 10);
        break;
      }
      case "log_side": for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, jit(C([0x5e4224, 0x6b4b2a, 0x4f371d, 0x664729][(x * 3 + ((y / 5) | 0)) % 4]), 0.05)); break;
      case "log_top": for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); set(x, y, d >= 7 ? jit(C(0x5e4224), 0.05) : jit(C((d | 0) % 2 ? 0xb8925c : 0xa47f4c), 0.04)); } break;
      case "brick": bricks(4, 8, 0xb9b1a3, [0xa4483a, 0x96402f, 0xb0523f, 0x9c4636], false); break;
      case "stonebrick": bricks(8, 8, 0x5c5c5c, [0x8f8f8f, 0x858585, 0x999999], true); set(4, 3, C(0x666666)); set(5, 4, C(0x666666)); set(12, 11, C(0x666666)); break;
      case "window":
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const frame = x === 0 || x === 15 || y === 0 || y === 15 || x === 7 || x === 8 || y === 7 || y === 8;
          const t = y / 15;
          set(x, y, frame ? jit(C(0x6b4a2b), 0.05) : [90 - 40 * t, 134 - 50 * t, 184 - 50 * t]);
        }
        for (const [x, y] of [[2, 5], [3, 4], [4, 3], [5, 2], [10, 13], [11, 12], [12, 11], [13, 10]]) set(x, y, C(0xbcd8f0));
        break;
      case "leaves": noisy([0x3f8a2a, 0x4a9a32, 0x357a22, 0x2e6e1d], 0.06); specks([0x24581a], 18); specks([0x5fb043], 8); break;
      case "path": noisy([0xb59a64, 0xa88d58, 0xc2a771, 0xae9360], 0.04); specks([0x8c7a5a, 0xd2bc8a], 10); break;
      case "gravel": for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) { const c = jit(pick(GRAVEL), 0.06); set(x, y, c); set(x + 1, y, mul(c, 0.95)); set(x, y + 1, mul(c, 0.9)); set(x + 1, y + 1, mul(c, 0.85)); } break;
      case "wool_red": wool(0xb8342e); break;
      case "wool_blue": wool(0x3456b8); break;
      case "wool_yellow": wool(0xe0b42a); break;
      case "hay_side":
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const band = y === 3 || y === 4 || y === 11 || y === 12;
          set(x, y, band ? jit(C(0x8a4b2a), 0.06) : jit(C(x % 3 === 0 ? 0xc9a332 : x % 3 === 1 ? 0xe3c04c : 0xd8b23a), 0.06));
        }
        break;
      case "hay_top": for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) | 0; set(x, y, jit(C(d % 3 === 0 ? 0xb8932a : 0xdcb63e), 0.06)); } break;
      case "crate":
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const edge = x < 2 || x > 13 || y < 2 || y > 13, diag = Math.abs(x - (15 - y)) <= 1;
          set(x, y, edge ? jit(C(0x6e4c2a), 0.05) : diag ? jit(C(0x7d5832), 0.05) : y % 4 === 1 ? C(0x8a6538) : jit(C(0xa77d48), 0.05));
        }
        for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) set(x, y, C(0xb5b5b5));
        break;
      case "water": noisy([0x3a6fd0, 0x3566c4, 0x4278d8], 0.04); for (let i = 0; i < 7; i++) { const x = (R() * 12) | 0, y = (R() * 16) | 0; for (let k = 0; k < 4; k++) set(x + k, y, C(0x7aa6ec)); } break;
      case "roof_red": rows(4, [0xb4452f, 0xa33d29, 0xc1513a, 0xab4331], 0x6e2418, 1.15); break;
      case "roof_dark": rows(4, [0x5a3b22, 0x4d321c, 0x664429, 0x533620], 0x2c1c0e, 1.15); break;
      case "ore":
        noisy(GREY, 0.04);
        for (let k = 0; k < 3; k++) {
          const cx = 2 + ((R() * 11) | 0), cy = 2 + ((R() * 11) | 0);
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) set(cx + dx, cy + dy, C(dx + dy > 0 ? 0x2bb8a8 : 0x37d6c4));
          set(cx, cy, C(0xa8f7ee));
        }
        break;
      case "iron":
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, x === 0 || y === 0 || x === 15 || y === 15 ? C(0x8e959c) : y === 8 ? C(0xaab0b6) : jit(C(0xc5cbd1), 0.025));
        for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) set(x, y, C(0x6e757c));
        break;
      case "plaster": noisy([0xe8e1d0, 0xe1d9c6, 0xede7d8], 0.03); specks([0xcfc6b0], 6); break;
      case "wheat":
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, [0, 0, 0], 0);
        for (const x of [1, 3, 5, 8, 10, 12, 14]) {
          const top = 2 + ((R() * 5) | 0);
          for (let y = top; y < 16; y++) set(x, y, y < top + 3 ? C(0xe0c050) : y > 11 ? C(0x6f9a32) : C(0xb8b43c));
          set(x + (x < 15 ? 1 : -1), top + 1, C(0xd4b042));
        }
        break;
      case "lantern":
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const frame = x < 2 || x > 13 || y < 2 || y > 13 || x === 7 || x === 8;
          const d = Math.hypot(x - 7.5, y - 7.5) / 8;
          set(x, y, frame ? C(0x2b2b30) : [255, 236 - 50 * d, 150 - 110 * d]);
        }
        break;
      case "farmland": for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, jit(C(y % 4 < 2 ? 0x5a3a20 : 0x6e4a2a), 0.06)); break;
      case "rail": case "rail_x": {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const [u, v] = name === "rail" ? [x, y] : [y, x];
          const tie = (v % 5 === 1 || v % 5 === 2) && u > 0 && u < 15, rail = u === 3 || u === 4 || u === 11 || u === 12;
          set(x, y, rail ? C(u === 3 || u === 11 ? 0xc4cad0 : 0x8a9096) : tie ? jit(C(0x7a5530), 0.05) : jit(pick(GRAVEL), 0.05));
        }
        break;
      }
      case "container_red": ribs(0xb33a2c); break;
      case "container_blue": ribs(0x2f6aa8); break;
      case "container_yellow": ribs(0xd99a22); break;
      case "timber": for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, jit(C([0x4a3320, 0x553a24, 0x3f2b1b][(x + ((y / 6) | 0)) % 3]), 0.05)); break;
      default: noisy(GREY, 0.04);
    }
  }
  const ATLAS = { tex: null, rects: null, w: 0, h: 0 };
  function atlas() {
    if (ATLAS.tex) return ATLAS;
    const TS = 16, PAD = 2, CELL = TS + 2 * PAD, COLS = 8, n = LAY.TILES.length, rowsN = Math.ceil(n / COLS);
    const cv = document.createElement("canvas");
    cv.width = COLS * CELL;
    cv.height = rowsN * CELL;
    const g = cv.getContext("2d"), img = g.createImageData(cv.width, cv.height), rects = [];
    LAY.TILES.forEach((name, i) => {
      const px = new Uint8ClampedArray(TS * TS * 4);
      let seed = 17;
      for (const ch of name) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
      const R = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      const set = (x, y, c, a = 255) => { if (x < 0 || y < 0 || x > 15 || y > 15) return; const k = (y * TS + x) * 4; px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = a; };
      paintTile(name, set, R);
      const ox = (i % COLS) * CELL, oy = ((i / COLS) | 0) * CELL;
      // the border repeats the tile (it is drawn repeated), so the edge pixels blend with the right neighbours
      for (let y = -PAD; y < TS + PAD; y++) for (let x = -PAD; x < TS + PAD; x++) {
        const s = ((((y + TS) % TS) * TS) + ((x + TS) % TS)) * 4, d = ((oy + PAD + y) * cv.width + ox + PAD + x) * 4;
        for (let k = 0; k < 4; k++) img.data[d + k] = px[s + k];
      }
      rects.push([ox + PAD, cv.height - (oy + PAD) - TS, TS, TS]);
    });
    g.putImageData(img, 0, 0);
    const tex = new T.CanvasTexture(cv);
    "colorSpace" in tex && T.SRGBColorSpace && (tex.colorSpace = T.SRGBColorSpace);
    tex.magFilter = T.NearestFilter;
    tex.minFilter = T.LinearFilter;
    tex.generateMipmaps = !1;
    tex.userData.keep = !0;
    return Object.assign(ATLAS, { tex, rects, w: cv.width, h: cv.height, canvas: cv });
  }
  // one material for the blocks, one for the cut-out tiles (wheat): the tile of each face comes from a per-vertex
  // rectangle of the atlas and repeats once per block
  const MATS = {};
  function material(cutout) {
    const k = cutout ? "cut" : "solid";
    if (MATS[k]) return MATS[k];
    const A = atlas();
    const m = new T.MeshLambertMaterial({ vertexColors: !0, map: A.tex, alphaTest: cutout ? 0.5 : 0, side: cutout ? T.DoubleSide : T.FrontSide });
    m.customProgramCacheKey = () => `blocktown-atlas-v1:${A.w}:${A.h}:${k}`;
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = "attribute vec4 atlasRect; varying vec4 vAtlasRect;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nvAtlasRect = atlasRect;");
      sh.fragmentShader = "varying vec4 vAtlasRect;\n" + sh.fragmentShader.replace("#include <map_fragment>", `vec4 sampledDiffuseColor = texture2D(map, (vAtlasRect.xy + fract(vMapUv) * vAtlasRect.zw) / vec2(${A.w.toFixed(1)}, ${A.h.toFixed(1)})); diffuseColor *= sampledDiffuseColor;`);
    };
    m.userData.keep = !0;
    return (MATS[k] = m);
  }

  // ── the blocks into quads ──
  const CH = 48; // chunk size in blocks
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const UV_AXES = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]];
  const SHADE = [0.86, 0.86, 1, 0.66, 0.93, 0.93];
  const AO = [0.52, 0.7, 0.86, 1];
  function meshData(map) {
    const vox = map.vox, SIZE = [NX, NY, NZ];
    const get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ ? 0 : vox[(y * NZ + z) * NX + x]);
    const occ = (x, y, z) => { const m = get(x, y, z); return !!m && MAT[m].opaque; };
    const chunks = new Map();
    const bucket = (cx, cz, cut) => {
      const k = cx + "," + cz + "," + (cut ? 1 : 0);
      let b = chunks.get(k);
      b || chunks.set(k, (b = { cut, pos: [], nor: [], col: [], uv: [], rect: [], idx: [] }));
      return b;
    };
    const wx = (g) => (g - NX / 2) * B, wy = (j) => (j - 1) * B, wz = (g) => (g - NZ / 2) * B;
    const toW = (p) => [wx(p[0]), wy(p[1]), wz(p[2])];
    let quads = 0;
    // a quad: corners c[0..3] in world space (counter-clockwise from outside), uvs, a brightness per corner
    function quad(b, c, uv, n, br, tile) {
      const base = b.pos.length / 3, r = ATLAS_RECTS[tile];
      for (let i = 0; i < 4; i++) {
        b.pos.push(c[i][0], c[i][1], c[i][2]);
        b.nor.push(n[0], n[1], n[2]);
        b.col.push(br[i], br[i], br[i]);
        b.uv.push(uv[i][0], uv[i][1]);
        b.rect.push(r[0], r[1], r[2], r[3]);
      }
      // split along the brighter diagonal so the corner shade does not crease
      br[0] + br[2] < br[1] + br[3] ? b.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base) : b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      quads++;
    }
    const ATLAS_RECTS = LAY.TILES.map((_, i) => rectOf(i));
    for (let d = 0; d < 6; d++) {
      const n = DIRS[d], a = d >> 1, s = d & 1 ? -1 : 1, [ua, va] = UV_AXES[d];
      const su = SIZE[ua], sv = SIZE[va];
      const U = [0, 0, 0], V = [0, 0, 0];
      U[ua] = 1; V[va] = 1;
      const cr = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
      const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
      const mask = new Int32Array(su * sv);
      for (let sl = 0; sl < SIZE[a]; sl++) {
        mask.fill(0);
        const p = [0, 0, 0], q = [0, 0, 0];
        for (let v = 0; v < sv; v++) for (let u = 0; u < su; u++) {
          p[a] = sl; p[ua] = u; p[va] = v;
          const m = get(p[0], p[1], p[2]);
          if (!m || MAT[m].half) continue;
          if (p[1] === 0 && d !== 2 && !(a !== 1 && (p[0] + n[0] < 0 || p[0] + n[0] >= NX || p[2] + n[2] < 0 || p[2] + n[2] >= NZ))) continue;
          if (p[1] === 0 && d === 3) continue;
          q[0] = p[0] + n[0]; q[1] = p[1] + n[1]; q[2] = p[2] + n[2];
          const nb = get(q[0], q[1], q[2]);
          if (nb && (MAT[nb].opaque || (nb === m && !MAT[m].opaque))) continue;
          const M0 = MAT[m], tile = M0.tiles[d === 2 ? 0 : d === 3 ? 2 : 1];
          // the shade at each corner: the blocks touching that corner in the layer the face looks into
          const ao = [3, 3, 3, 3];
          if (!M0.cutout) {
            const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
            for (let k = 0; k < 4; k++) {
              const [cu, cv] = corners[k];
              const x1 = q[0] + U[0] * cu, y1 = q[1] + U[1] * cu, z1 = q[2] + U[2] * cu;
              const x2 = q[0] + V[0] * cv, y2 = q[1] + V[1] * cv, z2 = q[2] + V[2] * cv;
              const s1 = occ(x1, y1, z1), s2 = occ(x2, y2, z2), c = occ(x1 + V[0] * cv, y1 + V[1] * cv, z1 + V[2] * cv);
              ao[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
            }
          }
          const cut = M0.cutout ? 1 : 0;
          if (ao[0] === ao[1] && ao[1] === ao[2] && ao[2] === ao[3]) mask[v * su + u] = 1 + tile + 64 * ao[0] + 512 * cut;
          else emit(sl, u, v, 1, 1, tile, ao, cut);
        }
        // merge equal neighbours into rectangles, never across a chunk edge
        const edgeU = ua !== 1, edgeV = va !== 1;
        for (let v = 0; v < sv; v++) for (let u = 0; u < su; u++) {
          const k = mask[v * su + u];
          if (!k) continue;
          let w = 1;
          while (u + w < su && mask[v * su + u + w] === k && !(edgeU && (u + w) % CH === 0)) w++;
          let h = 1;
          grow: while (v + h < sv && !(edgeV && (v + h) % CH === 0)) {
            for (let t = 0; t < w; t++) if (mask[(v + h) * su + u + t] !== k) break grow;
            h++;
          }
          for (let y = 0; y < h; y++) for (let t = 0; t < w; t++) mask[(v + y) * su + u + t] = 0;
          const tile = (k - 1) % 64, l = ((k - 1) >> 6) & 7, cut = (k - 1) >> 9;
          emit(sl, u, v, w, h, tile, [l, l, l, l], cut);
        }
      }
      function emit(sl, u, v, w, h, tile, ao, cut) {
        const c0 = [0, 0, 0];
        c0[a] = sl + (s > 0 ? 1 : 0);
        const corner = (du, dv) => { const g = c0.slice(); g[ua] = u + du; g[va] = v + dv; return g; };
        let gs = [corner(0, 0), corner(w, 0), corner(w, h), corner(0, h)];
        let brs = ao.map((x) => AO[x] * SHADE[d]);
        if (flip) { gs = [gs[0], gs[3], gs[2], gs[1]]; brs = [brs[0], brs[3], brs[2], brs[1]]; }
        // the tile runs with the face: up the wall on the sides, along x and z on the floors
        const uvs = gs.map((g) => (a === 1 ? [g[0], g[2]] : [a === 0 ? g[2] * -s : g[0] * s, g[1]]));
        const gx = Math.min(gs[0][0], gs[2][0]), gz = Math.min(gs[0][2], gs[2][2]);
        const b = bucket(Math.min(Math.floor(gx / CH), Math.floor((NX - 1) / CH)), Math.min(Math.floor(gz / CH), Math.floor((NZ - 1) / CH)), cut);
        quad(b, gs.map(toW), uvs, n, brs, tile);
      }
    }
    // slabs: half blocks, each drawn as its own little box
    for (let y = 1; y < NY; y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      const m = get(x, y, z);
      if (!m || !MAT[m].half) continue;
      const M0 = MAT[m], y0 = wy(y), y1 = y0 + B / 2, X0 = wx(x), X1 = wx(x + 1), Z0 = wz(z), Z1 = wz(z + 1);
      const b = bucket(Math.floor(x / CH), Math.floor(z / CH), 0);
      const vb = y - 1, vt = y - 0.5;
      quad(b, [[X0, y1, Z1], [X1, y1, Z1], [X1, y1, Z0], [X0, y1, Z0]], [[x, z + 1], [x + 1, z + 1], [x + 1, z], [x, z]], [0, 1, 0], [1, 1, 1, 1], M0.tiles[0]);
      const side = (nx, nz, c, uv) => { const nb = get(x + nx, y, z + nz); if (!(nb && MAT[nb].opaque)) quad(b, c, uv, [nx, 0, nz], [SHADE[nx ? 0 : 4], SHADE[nx ? 0 : 4], SHADE[nx ? 0 : 4], SHADE[nx ? 0 : 4]], M0.tiles[1]); };
      side(1, 0, [[X1, y0, Z1], [X1, y0, Z0], [X1, y1, Z0], [X1, y1, Z1]], [[0, vb], [1, vb], [1, vt], [0, vt]]);
      side(-1, 0, [[X0, y0, Z0], [X0, y0, Z1], [X0, y1, Z1], [X0, y1, Z0]], [[0, vb], [1, vb], [1, vt], [0, vt]]);
      side(0, 1, [[X0, y0, Z1], [X1, y0, Z1], [X1, y1, Z1], [X0, y1, Z1]], [[0, vb], [1, vb], [1, vt], [0, vt]]);
      side(0, -1, [[X1, y0, Z0], [X0, y0, Z0], [X0, y1, Z0], [X1, y1, Z0]], [[0, vb], [1, vb], [1, vt], [0, vt]]);
    }
    const out = [];
    for (const b of chunks.values()) {
      if (!b.idx.length) continue;
      const nv = b.pos.length / 3;
      out.push({
        cut: b.cut, pos: new Float32Array(b.pos), nor: new Float32Array(b.nor), col: new Float32Array(b.col), uv: new Float32Array(b.uv), rect: new Uint16Array(b.rect),
        idx: nv > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx),
      });
    }
    return { chunks: out, quads };
  }
  function rectOf(i) { return atlas().rects[i]; }

  // ── the blocks into boxes for bodies and bullets ──
  function colliderData(map) {
    const vox = map.vox, used = new Uint8Array(vox.length), out = [];
    const id = (x, y, z) => (y * NZ + z) * NX + x;
    const full = (x, y, z) => { const i = id(x, y, z), m = vox[i]; return !!m && !used[i] && MAT[m].solid && !MAT[m].half; };
    const wx = (g) => (g - NX / 2) * B, wz = (g) => (g - NZ / 2) * B;
    for (let y = 1; y < NY; y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      if (!full(x, y, z)) continue;
      let x1 = x + 1;
      while (x1 < NX && full(x1, y, z)) x1++;
      let z1 = z + 1;
      zs: while (z1 < NZ) { for (let i = x; i < x1; i++) if (!full(i, y, z1)) break zs; z1++; }
      let y1 = y + 1;
      ys: while (y1 < NY) { for (let k = z; k < z1; k++) for (let i = x; i < x1; i++) if (!full(i, y1, k)) break ys; y1++; }
      for (let j = y; j < y1; j++) for (let k = z; k < z1; k++) for (let i = x; i < x1; i++) used[id(i, j, k)] = 1;
      out.push({ minX: wx(x), maxX: wx(x1), minZ: wz(z), maxZ: wz(z1), y0: (y - 1) * B, h: (y1 - 1) * B });
    }
    for (let y = 1; y < NY; y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      const m = vox[id(x, y, z)];
      m && MAT[m].half && out.push({ minX: wx(x), maxX: wx(x + 1), minZ: wz(z), maxZ: wz(z + 1), y0: (y - 1) * B, h: (y - 1) * B + B / 2 });
    }
    return out;
  }

  // ── the cached build: the same blocks every time, so the work is done once a page ──
  let CACHE = null;
  function data() {
    if (CACHE) return CACHE;
    const t0 = performance.now();
    const map = LAY.build();
    atlas();
    const mesh = meshData(map), cols = colliderData(map);
    CACHE = { map, mesh, cols, nav: null, ms: { build: Math.round(performance.now() - t0) } };
    return CACHE;
  }

  // ── the bots' walk graph ──
  const CELL = B / 2;
  function buildNav(D) {
    const t0 = performance.now(), b = MAP.bounds, cols = NX * 2, rows = NZ * 2, S = LAY.surfaces(D.map);
    const start = new Int32Array(cols * rows + 1), ys = [], cellOf = [];
    const cx0 = (c) => b.minX + ((c % cols) + 0.5) * CELL, cz0 = (c) => b.minZ + (((c / cols) | 0) + 0.5) * CELL;
    for (let c = 0; c < cols * rows; c++) {
      start[c] = ys.length;
      const x = cx0(c), z = cz0(c), list = S[((((c / cols) | 0) >> 1) * NX) + ((c % cols) >> 1)];
      // a thin probe: a cell beside the next stair step is still a place (the body steps up from it); cells a body
      // cannot really reach get no links in below and stay off the network
      // the height is what holds the body there (the engine's own ground test): beside a step up that is the step
      for (const h0 of list) {
        if (h0 > 4 || collideXZ(x, z, h0 + 0.02, 0.3)) continue;
        const h = groundAt(x, z, h0);
        ys.length > start[c] && ys[ys.length - 1] === h || (ys.push(h), cellOf.push(c));
      }
    }
    start[cols * rows] = ys.length;
    const N = ys.length, Y = Float32Array.from(ys), CEL = Int32Array.from(cellOf), edges = new Int32Array(N * 4).fill(-1);
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < N; i++) {
      const c = CEL[i], cx = c % cols, cz = (c / cols) | 0, y = Y[i], x = cx0(c), z = cz0(c);
      for (let d = 0; d < 4; d++) {
        const X = cx + D4[d][0], Z = cz + D4[d][1];
        if (X < 0 || Z < 0 || X >= cols || Z >= rows) continue;
        const c2 = Z * cols + X;
        let best = -1, bd = 1e9;
        for (let j = start[c2]; j < start[c2 + 1]; j++) {
          const dy = Y[j] - y;
          if (dy > STEP_H + 0.001 || dy < -2.6) continue;
          Math.abs(dy) < bd && ((bd = Math.abs(dy)), (best = j));
        }
        if (best < 0) continue;
        // the real body: it gets there, and at the height of that cell (or falls to it)
        const p = { x, z }, ny = moveWithSlide(p, D4[d][0] * CELL, D4[d][1] * CELL, y, PR);
        if (Math.abs(p.x - x - D4[d][0] * CELL) > 0.01 || Math.abs(p.z - z - D4[d][1] * CELL) > 0.01) continue;
        const ty = Y[best];
        if (ty > y - 0.05 ? Math.abs(ny - ty) > 0.05 : ny - y > 0.05) continue;
        edges[i * 4 + d] = best;
      }
    }
    // links backwards, for the flow fields
    const rs = new Int32Array(N + 1);
    for (let i = 0; i < N * 4; i++) edges[i] >= 0 && rs[edges[i] + 1]++;
    for (let i = 0; i < N; i++) rs[i + 1] += rs[i];
    const rl = new Int32Array(rs[N]), fill = rs.slice(0, N);
    for (let i = 0; i < N * 4; i++) edges[i] >= 0 && (rl[fill[edges[i]]++] = (i / 4) | 0);
    const nav = { cols, rows, start, Y, CEL, edges, rs, rl, N, main: null, walk: new Uint8Array(cols * rows), flows: new Map(), ms: 0 };
    for (let c = 0; c < cols * rows; c++) nav.walk[c] = start[c + 1] > start[c] ? 1 : 0;
    // the network both teams start on: what can be walked to from the attackers' spawn
    const a = MAP.attackSpawn, from = nearNode(nav, a.x, a.z, 0, null);
    const main = new Uint8Array(N);
    if (from >= 0) {
      const q = new Int32Array(N);
      let t = 0, h = 0;
      q[t++] = from; main[from] = 1;
      while (h < t) { const i = q[h++]; for (let d = 0; d < 4; d++) { const j = edges[i * 4 + d]; j >= 0 && !main[j] && ((main[j] = 1), (q[t++] = j)); } }
    }
    nav.main = main;
    nav.mainCount = main.reduce((s, v) => s + v, 0);
    nav.ms = Math.round(performance.now() - t0);
    return nav;
  }
  const centreOf = (nav, i) => { const c = nav.CEL[i], b = MAP.bounds; return { x: b.minX + ((c % nav.cols) + 0.5) * CELL, z: b.minZ + (((c / nav.cols) | 0) + 0.5) * CELL, y: nav.Y[i] }; };
  // the node nearest to (x, z) at about height y: the cell itself first, then rings around it
  function nearNode(nav, x, z, y, only) {
    const b = MAP.bounds, cx = Math.max(0, Math.min(nav.cols - 1, Math.floor((x - b.minX) / CELL))), cz = Math.max(0, Math.min(nav.rows - 1, Math.floor((z - b.minZ) / CELL)));
    let best = -1, bs = 1e18;
    for (let r = 0; r <= 24; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx += Math.abs(dz) === r ? 1 : 2 * r || 1) {
        const X = cx + dx, Z = cz + dz;
        if (X < 0 || Z < 0 || X >= nav.cols || Z >= nav.rows) continue;
        const c = Z * nav.cols + X;
        for (let j = nav.start[c]; j < nav.start[c + 1]; j++) {
          if (only && !only[j]) continue;
          const dy = nav.Y[j] - y, s = (dx * dx + dz * dz) * CELL * CELL + (dy > 0.7 ? dy * dy * 9 : dy * dy * 2);
          s < bs && ((bs = s), (best = j));
        }
      }
      if (best >= 0 && bs <= (r * CELL) * (r * CELL)) break;
    }
    return best;
  }
  // from (x, z) at height y to (X, Z) at about height Y (the ground unless given)
  function route(x, z, y, X, Z, Y = 0) {
    const nav = CACHE && CACHE.nav;
    if (!nav) return [];
    const s = nearNode(nav, x, z, y, null), g = nearNode(nav, X, Z, Y, nav.main);
    if (s < 0 || g < 0) return [];
    let next = nav.flows.get(g);
    if (!next) {
      next = new Int32Array(nav.N).fill(-1);
      next[g] = g;
      const q = new Int32Array(nav.N);
      let t = 0, h = 0;
      q[t++] = g;
      while (h < t) { const i = q[h++]; for (let k = nav.rs[i]; k < nav.rs[i + 1]; k++) { const j = nav.rl[k]; next[j] < 0 && ((next[j] = i), (q[t++] = j)); } }
      nav.flows.size >= 16 && nav.flows.delete(nav.flows.keys().next().value);
      nav.flows.set(g, next);
    }
    let i = s;
    // off the network (a hay loft, a jump the bots cannot make back): the nearest point of it first
    if (next[i] < 0) {
      i = nearNode(nav, x, z, y, nav.main);
      if (i < 0 || next[i] < 0) return [];
    }
    const path = [];
    i !== s && path.push(centreOf(nav, i));
    for (let n = 0; i !== g && n < 4000; n++) { i = next[i]; path.push(centreOf(nav, i)); }
    return path;
  }

  // ── on the map ──
  const S = (window.BLOCKTOWN = { key: KEY, active: !1, meshes: [], stats: null, data: () => CACHE, route, layout: LAY });
  const on = () => S.active && CUR_MAP_KEY === KEY;
  let prevNav = null, prevCell = null;
  function leave() {
    if (!S.active) return;
    S.active = !1;
    S.meshes.length = 0;
    try { floor.visible = !0; } catch (e) {}
    if (prevNav) { NAV.length = 0; NAV.push(...prevNav); prevNav = null; }
    prevCell != null && (GRID.cell = prevCell);
  }
  function build() {
    const t0 = performance.now(), D = data();
    S.active = !0;
    try { floor.visible = !1; } catch (e) {}
    for (const c of D.mesh.chunks) {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(c.pos, 3));
      g.setAttribute("normal", new T.BufferAttribute(c.nor, 3));
      g.setAttribute("color", new T.BufferAttribute(c.col, 3));
      g.setAttribute("uv", new T.BufferAttribute(c.uv, 2));
      g.setAttribute("atlasRect", new T.BufferAttribute(c.rect, 4));
      g.setIndex(new T.BufferAttribute(c.idx, 1));
      g.computeBoundingSphere();
      const m = new T.Mesh(g, material(c.cut));
      m.userData.noMerge = !0;
      m.userData.blocktown = !0;
      m.castShadow = !1;
      m.receiveShadow = !1;
      scene.add(m);
      "undefined" != typeof _mapMeshes && _mapMeshes.push(m);
      S.meshes.push(m);
    }
    for (const c of D.cols) {
      const o = { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, h: c.h, mesh: null, hp: 1 / 0, destructible: !1, temp: !1, blocktown: !0 };
      c.y0 > 0 && (o.y0 = c.y0);
      COLLIDERS.push(o);
    }
    CHASH.dirty = !0;
    chashBuild();
    D.nav || (D.nav = buildNav(D));
    const nav = D.nav;
    prevCell = GRID.cell;
    GRID.cell = CELL;
    GRID.minX = MAP.bounds.minX;
    GRID.minZ = MAP.bounds.minZ;
    GRID.cols = nav.cols;
    GRID.rows = nav.rows;
    GRID.walk = nav.walk;
    prevNav = NAV.slice();
    NAV.length = 0;
    NAV.push(...Object.values(MAP.nodes));
    try { renderer.compile(scene, camera); } catch (e) {}
    S.stats = {
      quads: D.mesh.quads, meshes: S.meshes.length, triangles: S.meshes.reduce((s, m) => s + m.geometry.index.count / 3, 0), colliders: D.cols.length,
      navNodes: nav.N, navMain: nav.mainCount, buildMs: D.ms.build, navMs: nav.ms, loadMs: Math.round(performance.now() - t0),
    };
    S.loads = (S.loads || 0) + 1;
  }
  const _cmg = clearMapGeometry;
  clearMapGeometry = function () { leave(); return _cmg.apply(this, arguments); };
  const _lm = loadMap;
  loadMap = function (key) {
    const r = _lm.apply(this, arguments);
    if (key === KEY && r !== !1)
      try { build(); } catch (e) { console.warn("blocktown", e); }
    return r;
  };

  // the horizon: the engine's ring of pyramids gives way to block hills, and a grass plain runs out to them (done
  // inside the sky's own step, before the map's meshes are merged)
  const _sd = skyDome;
  skyDome = function () {
    const n = scene.children.length, r = _sd.apply(this, arguments);
    if (KEY !== CUR_MAP_KEY) return r;
    for (let i = scene.children.length - 1; i >= n; i--) {
      const o = scene.children[i];
      o.isMesh && o.geometry && "ConeGeometry" === o.geometry.type && (scene.remove(o), o.geometry.dispose(), o.material.dispose && o.material.dispose());
    }
    try { horizon(); } catch (e) { console.warn("blocktown horizon", e); }
    return r;
  };
  function horizon() {
    const pos = [], col = [], R = ((s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296))(99);
    const lin = (h, k) => { const c = new T.Color(h).multiplyScalar(k); return [c.r, c.g, c.b]; };
    const box = (x0, y0, z0, x1, y1, z1, top, side) => {
      const f = [[[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side]];
      for (const [a, b2, c, d, k] of f) for (const v of [a, b2, c, a, c, d]) (pos.push(...v), col.push(...k));
    };
    for (let i = 0; i < 64; i++) {
      const ang = (i / 64) * Math.PI * 2, r = 230 + R() * 50, w = 22 + R() * 22, h = 8 + R() * 22, x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      const g = 0.8 + R() * 0.25, top = lin(0x5da83a, g), side = lin(0x7a5a3a, g * 0.9);
      for (let k = 0; k < 3; k++) { const s = w * (1 - k * 0.3), y0 = -2 + (h * k) / 3, y1 = -2 + (h * (k + 1)) / 3; box(x - s / 2, y0, z - s / 2, x + s / 2, y1, z + s / 2, top, side); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    const hills = new T.Mesh(g, mapOwnMat(new T.MeshBasicMaterial({ vertexColors: !0, fog: !0 })));
    hills.userData.noMerge = !0;
    scene.add(hills);
    const plain = new T.Mesh(new T.CircleGeometry(300, 48), mapOwnMat(new T.MeshLambertMaterial({ color: 0x5f9a3c })));
    plain.rotation.x = -Math.PI / 2;
    plain.position.y = -1.3;
    plain.userData.noMerge = !0;
    scene.add(plain);
  }
  const mapOwnMat = (m) => ((m.userData.own = !0), m);

  // ── bots and spawns on the blocks ──
  const _fp = findPath;
  findPath = function (x, z, X, Z) {
    if (!on()) return _fp.apply(this, arguments);
    return route(x, z, 0, X, Z);
  };
  const _nn = navNext;
  navNext = function (a, x, z, dt) {
    if (!on()) return _nn.apply(this, arguments);
    const n = a.ai;
    n.repathCd2 = (n.repathCd2 || 0) - dt;
    if (!n.path || n.repathCd2 <= 0 || !n.pathGoal || Math.hypot(n.pathGoal.x - x, n.pathGoal.z - z) > 3) {
      n.path = route(a.pos.x, a.pos.z, a.y || 0, x, z);
      n.pathIdx = 0;
      n.pathGoal = { x, z };
      n.repathCd2 = 1.4 + Math.random();
    }
    const P = n.path;
    // a point is passed when the body is on it, or already as near the next one as the point itself is
    while (n.pathIdx < P.length) {
      const p = P[n.pathIdx], q = P[n.pathIdx + 1];
      if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 0.35 || (q && Math.hypot(a.pos.x - q.x, a.pos.z - q.z) <= Math.hypot(p.x - q.x, p.z - q.z) + 0.05)) n.pathIdx++;
      else break;
    }
    return P[n.pathIdx] || { x, z };
  };
  // the engine's steering feels ahead for walls at the body's height, and a half step reads as a wall: the route
  // already goes round everything, so the bot faces its next point
  const _st = steerToward;
  steerToward = function (a, x, z) {
    if (!on()) return _st.apply(this, arguments);
    a.yaw = Math.atan2(-(x - a.pos.x), -(z - a.pos.z));
    return 0;
  };
  const _sp = spawnPointFor;
  spawnPointFor = function (team, index) {
    const nav = CACHE && CACHE.nav;
    if (!on() || !nav) return _sp.apply(this, arguments);
    const p = "atk" === team ? MAP.attackSpawn : MAP.defendSpawn, o = "atk" === team ? MAP.defendSpawn : MAP.attackSpawn;
    const yaw = Math.atan2(-(o.x - p.x), -(o.z - p.z)), n = "undefined" != typeof TEAM_SIZE ? TEAM_SIZE : 5, k = (index - (n - 1) / 2) * 3;
    const j = nearNode(nav, p.x + Math.cos(yaw) * k, p.z - Math.sin(yaw) * k, 0, nav.main);
    if (j < 0) return _sp.apply(this, arguments);
    const c = centreOf(nav, j);
    return { x: c.x, z: c.z, y: c.y, yaw };
  };
  // a jump under a floor (the bridge, the tunnel roof) stops at the head instead of passing into it
  const _sm = simMove;
  simMove = function (a) {
    const oldY = a.y || 0, r = _sm.apply(this, arguments);
    if (on() && a.y > oldY) {
      (!CHASH.dirty && CHASH.buckets) || chashBuild();
      const m = PR, c0 = Math.max(0, Math.floor((a.pos.x - m - CHASH.minX) / CHASH.cell)), c1 = Math.min(CHASH.cols - 1, Math.floor((a.pos.x + m - CHASH.minX) / CHASH.cell));
      const r0 = Math.max(0, Math.floor((a.pos.z - m - CHASH.minZ) / CHASH.cell)), r1 = Math.min(CHASH.rows - 1, Math.floor((a.pos.z + m - CHASH.minZ) / CHASH.cell));
      for (let rz = r0; rz <= r1; rz++) for (let cx = c0; cx <= c1; cx++) for (const c of CHASH.buckets[rz * CHASH.cols + cx] || []) {
        if (c.y0 > 0 && oldY + 2.3 <= c.y0 + 0.001 && a.y + 2.3 > c.y0 && a.pos.x + PR > c.minX && a.pos.x - PR < c.maxX && a.pos.z + PR > c.minZ && a.pos.z - PR < c.maxZ) {
          a.y = Math.max(oldY, c.y0 - 2.3);
          a.vy = Math.min(0, a.vy || 0);
        }
      }
    }
    return r;
  };

  // ── the map list: after the hospital in the pool ──
  (window.MAP_EXTRA = window.MAP_EXTRA || []).push({ key: KEY, name: NAME });
  if (window.POGU && POGU.pool) {
    if (!POGU.pool.includes(KEY)) {
      const at = POGU.pool.indexOf("hospital");
      POGU.pool.splice(at >= 0 ? at + 1 : POGU.pool.length, 0, KEY);
    }
    POGU.setPool();
  } else if ("undefined" != typeof MAP_LIST && !MAP_LIST.some((m) => m.key === KEY)) {
    MAP_LIST.push({ key: KEY, name: NAME });
    dispatchEvent(new CustomEvent("maps-changed", { detail: { count: MAP_LIST.length } }));
  }

  // ── the home screen: a tile that opens agent select on this map ──
  const menu = document.querySelector("#s-title .tt-menu");
  if (menu && !document.getElementById("go-blocktown")) {
    const st = document.createElement("style");
    st.textContent = "#go-blocktown{display:flex;align-items:center;justify-content:center;gap:10px}#go-blocktown img{object-fit:cover;border-radius:4px;flex:none;image-rendering:auto}" +
      "@media(orientation:landscape) and (max-height:480px){#s-title #go-blocktown{align-self:start;min-height:0!important;padding:8px 14px!important;font-size:13px!important}#s-title #go-blocktown img{width:48px;height:27px}}";
    document.head.append(st);
    const b = document.createElement("button");
    b.id = "go-blocktown";
    b.className = "btn";
    b.type = "button";
    b.title = tr("블록으로 지은 5대5 맵 · A/B 사이트", "A 5v5 map built of blocks · sites A and B");
    const img = document.createElement("img");
    img.src = "./assets/ui/blocktown-preview.webp";
    img.alt = "";
    img.width = 64;
    img.height = 36;
    img.loading = "lazy";
    const label = document.createElement("span");
    label.textContent = NAME + " · " + tr("새 맵", "New map");
    b.append(img, label);
    b.onclick = () => {
      try { room.map = KEY; } catch (e) {}
      const go = document.getElementById("go-play");
      go && go.click();
      try { "function" == typeof paintSelMaps && paintSelMaps(); } catch (e) {}
    };
    menu.append(b);
  }
})();
