
(() => {
  // 포구, step 4 — the blockout gets dressed. Nothing here changes a collider,
  // a sightline or a timing: the same boxes get colour (by zone, darker toward
  // the ground), a surface (brick, plaster, corrugated), and the map gets
  // things that cannot be hit or stood on: four landmarks, windows, signs,
  // wall-hugging props (≤ 1.4 m), lamps, and a low evening sun.
  // Zones: A side = warm brick, rust and fish-market red; B side = corrugated
  // sheds, blue-green containers, a white-and-red pier; the middle = stone and
  // concrete; the terminal = cream and teal.
  if ("undefined" == typeof POGU || "undefined" == typeof T) return;
  const DATA = POGU.data,
    bo = DATA.bo;

  // ── the evening ──
  Object.assign(MOODS.pogu, {
    top: "#2f5a9c",
    mid: "#e8a46c",
    hor: "#ffd38f",
    fog: 0xe0a77a,
    hemiSky: 0xffd9b0,
    hemiGnd: 0x6a5b62,
    hemi: 0.72,
    exp: 0.84,
    env: 0.6,
    sun: 0xffa75e,
    sunInt: 1.5,
    glow: "#ffd2a0",
    tint: [1.06, 1, 0.93],
    lift: [0.012, 0.004, 0.016],
    sat: 1.14,
    con: 1.1,
    vig: 0.34,
    bloom: 1.05,
  });
  Object.assign(DATA, { sky: 0xe4a77a, fog: 0.0042, sunColor: 0xffb070, sunInt: 1.5, ambient: 0.95 });
  // a lower sun for this map only (longer, warmer shadows); the others keep theirs
  const SUN0 = { x: _SUN_OFF.x, y: _SUN_OFF.y, z: _SUN_OFF.z },
    SUN1 = { x: -62, y: 62, z: 50 };
  const _lm = loadMap;
  loadMap = function (key) {
    Object.assign(_SUN_OFF, "pogu" === key ? SUN1 : SUN0);
    return _lm.apply(this, arguments);
  };

  // ── small helpers ──
  let seed = 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const hash = (a, b) => {
    let h = (Math.imul(Math.round(a * 7.13), 374761393) + Math.imul(Math.round(b * 5.31), 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const col = (hex) => {
    const c = new T.Color(hex);
    return [c.r, c.g, c.b];
  };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const jitter = (c, x, z, amt) => {
    const k = 1 + (hash(x, z) - 0.5) * amt;
    return c.map((v) => v * k);
  };
  const canvas = (w, h, draw) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    return c;
  };
  const texOf = (c, rep, aniso) => {
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    rep && (t.wrapS = t.wrapT = T.RepeatWrapping);
    t.anisotropy = aniso || 2;
    return t;
  };
  const speckle = (g, w, h, n, lo, hi, a) => {
    for (let i = 0; i < n; i++) {
      const v = lo + Math.floor(Math.random() * (hi - lo));
      g.fillStyle = `rgba(${v},${v},${v},${a})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  };

  // ── surfaces (2 m a tile; colours come from the vertices) ──
  const TEX = {
    brick: texOf(
      canvas(256, 256, (g, w, h) => {
        g.fillStyle = "#a9a59d";
        g.fillRect(0, 0, w, h);
        for (let r = 0; r < 8; r++)
          for (let b = -1; b < 4; b++) {
            const v = 214 + Math.floor(Math.random() * 41),
              x = b * 64 + (r % 2 ? 32 : 0);
            g.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
            g.fillRect(x + 2, r * 32 + 2, 60, 28);
          }
        speckle(g, w, h, 900, 90, 255, 0.1);
      }),
      !0,
    ),
    plaster: texOf(
      canvas(256, 256, (g, w, h) => {
        g.fillStyle = "#ececec";
        g.fillRect(0, 0, w, h);
        speckle(g, w, h, 2600, 150, 255, 0.12);
        for (let i = 0; i < 10; i++) {
          const x = Math.random() * w,
            gr = g.createLinearGradient(0, 0, 0, h);
          gr.addColorStop(0, "rgba(60,50,40,0)");
          gr.addColorStop(1, "rgba(60,50,40,.07)");
          g.fillStyle = gr;
          g.fillRect(x, 0, 3 + Math.random() * 7, h);
        }
        g.fillStyle = "rgba(0,0,0,.08)";
        g.fillRect(0, 0, w, 3);
      }),
      !0,
    ),
    corr: texOf(
      canvas(256, 256, (g, w, h) => {
        for (let x = 0; x < w; x += 16) {
          const gr = g.createLinearGradient(x, 0, x + 16, 0);
          gr.addColorStop(0, "#f4f4f4");
          gr.addColorStop(0.5, "#fff");
          gr.addColorStop(0.55, "#e0e0e0");
          gr.addColorStop(1, "#cdcdcd");
          g.fillStyle = gr;
          g.fillRect(x, 0, 16, h);
        }
        speckle(g, w, h, 700, 120, 255, 0.1);
        g.fillStyle = "rgba(0,0,0,.1)";
        g.fillRect(0, 0, w, 2);
      }),
      !0,
    ),
    asphalt: texOf(
      canvas(256, 256, (g, w, h) => {
        g.fillStyle = "#d9d9d9";
        g.fillRect(0, 0, w, h);
        speckle(g, w, h, 5200, 120, 255, 0.16);
        g.strokeStyle = "rgba(40,40,40,.28)";
        g.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          let x = Math.random() * w,
            y = Math.random() * h;
          g.moveTo(x, y);
          for (let k = 0; k < 6; k++) g.lineTo((x += Math.random() * 40 - 20), (y += Math.random() * 40 - 20));
          g.stroke();
        }
      }),
      !0,
    ),
  };
  const MATS = {};
  const material = (g) =>
    MATS[g] ||
    (MATS[g] = new T.MeshStandardMaterial({ map: TEX[g] || TEX.plaster, vertexColors: !0, roughness: g === "corr" ? 0.78 : 0.92, metalness: 0 }));
  let FLOORM = null;
  const floorMat = () =>
    FLOORM ||
    (FLOORM = new T.MeshStandardMaterial({ map: TEX.asphalt, vertexColors: !0, roughness: 0.96, metalness: 0, polygonOffset: !0, polygonOffsetFactor: -1 }));
  // the ground outside the zones
  try {
    const f = THEMES.pogu.floor;
    f.map = TEX.asphalt;
    f.color.set(0x6b6862);
    f.needsUpdate = !0;
  } catch (e) {}

  // ── zones: the floor rectangle a point is in (smallest first), else the nearest ──
  const FL = bo.floors.map(([x0, x1, z0, z1, hex]) => ({ x0, x1, z0, z1, hex, a: (x1 - x0) * (z1 - z0) }));
  const hexAt = (x, z) => {
    let best = null,
      bd = 1e9;
    for (const f of FL) {
      const dx = Math.max(f.x0 - x, 0, x - f.x1),
        dz = Math.max(f.z0 - z, 0, z - f.z1),
        d = Math.hypot(dx, dz) + f.a * 1e-5;
      d < bd && ((bd = d), (best = f));
    }
    return best.hex;
  };
  // wall colour by zone and side
  const WALL = (hex, x) => {
    switch (hex) {
      case "#2f5f63": return "#66798b"; // customs, defenders' spawn: navy-grey
      case "#3d4b5e": return x < 0 ? "#b68a64" : "#5f8296"; // lanes behind the sites
      case "#5a6170": return "#bdb5a3"; // customs yard / middle: stone
      case "#7a3a3a": return x < 0 ? "#a85d42" : "#dfe3e5"; // A dock rust / B pier whitewash
      case "#86762e": return "#caa62c"; // gates
      case "#5c4673": return x < 0 ? "#cbd9e6" : "#8f6e4b"; // cold store / gear shed
      case "#4b525d": return x < -14 ? "#cdae82" : x > 14 ? "#86bab2" : "#a7aab0"; // lanes
      case "#3f5e46": return x < 0 ? "#c9594b" : "#7fb6d2"; // fish market / yard
      case "#7a5a3a": return "#e6e0d1"; // terminal
      default: return "#a8a8a8";
    }
  };
  const FLOOR = (hex, x) => {
    switch (hex) {
      case "#2f5f63": return "#4f6269";
      case "#3d4b5e": return "#5d6269";
      case "#5a6170": return "#8f8d86";
      case "#7a3a3a": return x < 0 ? "#745040" : "#808a93";
      case "#86762e": return "#948031";
      case "#5c4673": return "#727784";
      case "#4b525d": return x < -14 ? "#766f65" : "#5d666c";
      case "#3f5e46": return x < 0 ? "#6e5d52" : "#52625a";
      case "#7a5a3a": return "#918570";
      default: return hex;
    }
  };
  const CW = ["#c0502f", "#d68a1f", "#a0702f", "#d9b44a", "#8b5a35"],
    CC = ["#3d86c4", "#4fa58f", "#e6e0d2", "#8fa6bb", "#4f9a7a"],
    CM = ["#c0502f", "#2e6fa8", "#d9b44a", "#3f8f7b", "#d9d3c4"];
  const coverHex = (x, z) => {
    const a = x < -14 ? CW : x > 14 ? CC : CM;
    return a[Math.floor(hash(x, z) * a.length)];
  };
  // wall boxes: brick on the A side, corrugated on the B side, plaster between
  const group = (kind, b) => {
    const cx = (b[0] + b[1]) / 2;
    if ("cover" === kind) return "corr";
    if ("wall" === kind || "parapet" === kind) return cx < -14 ? "brick" : cx > 14 ? "corr" : "plaster";
    return "plaster";
  };
  // colour of one piece of one face: [r, g, b]
  const tint = () => (box, f, x, z) => {
    const kind = box[6],
      cx = (box[0] + box[1]) / 2,
      cz = (box[4] + box[5]) / 2;
    if ("cover" === kind) return jitter(col(coverHex(cx, cz)), cx, cz, 0.12);
    if ("stair" === kind) return col("#9a9ca1");
    if ("raised" === kind || "floor2" === kind) return f === 4 ? col("#9a7a56") : col("#7d6048");
    if ("pillar" === kind) return col("#d9b73a");
    if ("landmark" === kind) return cx < 0 ? col("#dcaa2e") : col("#efede5");
    let c = col(WALL(hexAt(x, z), x));
    c = jitter(c, x, z, 0.1);
    // roofs and copings read as concrete
    if (4 === f) c = mix(c, col("#8a8c90"), 0.55);
    return c;
  };
  const floorColor = (hex, cx) => FLOOR(hex, cx);

  // ── geometry collectors ──
  // axis-aligned boxes with vertex colours, merged into one mesh
  function Boxes() {
    const P = [],
      N = [],
      C = [],
      I = [];
    const q = (v, n, c) => {
      const k = P.length / 3;
      v.forEach((p) => (P.push(...p), N.push(...n), C.push(...c)));
      I.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    return {
      box(x0, x1, y0, y1, z0, z1, hex) {
        const c = col(hex),
          d = c.map((v) => v * 0.78),
          t = c.map((v) => Math.min(1, v * 1.12));
        q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], c);
        q([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], c);
        q([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], d);
        q([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], d);
        q([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], t);
      },
      mesh(mat) {
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
        g.setAttribute("normal", new T.Float32BufferAttribute(N, 3));
        g.setAttribute("color", new T.Float32BufferAttribute(C, 3));
        g.setIndex(I);
        g.computeBoundingSphere();
        return new T.Mesh(g, mat);
      },
    };
  }
  // a flat quad on a wall face: centre c (x, y, z), outward normal n (nx, nz), width w, height h
  const faceQuad = (cx, cy, cz, nx, nz, w, h) => {
    const tx = nz,
      tz = -nx;
    const p = (s, y) => [cx + tx * s, cy + y, cz + tz * s];
    return [p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2)];
  };

  // ── obstacles, for "is this spot open" ──
  const OBS = [];
  for (const [x0, x1, z0, z1, h, k] of bo.walls) OBS.push([x0, x1, z0, z1, h, k]);
  for (const [x0, x1, z0, z1, y0, h, k] of bo.slabs) OBS.push([x0, x1, z0, z1, h, k, y0]);
  const B = DATA.bounds;
  const open = (x, z, r) => {
    if (x < B.minX + 1 || x > B.maxX - 1 || z < B.minZ + 1 || z > B.maxZ - 1) return !1;
    for (const o of OBS) if (x > o[0] - r && x < o[1] + r && z > o[2] - r && z < o[3] + r) return !1;
    return !0;
  };
  // the faces of the tall buildings: {nx, nz, c (the coordinate), a, b (the extent), box}
  const FACES = [];
  for (const [x0, x1, z0, z1, h, k] of bo.walls) {
    if ("wall" !== k || h < 4) continue;
    // the outer boundary wall of the map is not dressed from outside
    FACES.push({ nx: 0, nz: 1, c: z1, a: x0, b: x1, h });
    FACES.push({ nx: 0, nz: -1, c: z0, a: x0, b: x1, h });
    FACES.push({ nx: 1, nz: 0, c: x1, a: z0, b: z1, h });
    FACES.push({ nx: -1, nz: 0, c: x0, a: z0, b: z1, h });
  }
  // the window lintel (a slab) can carry a sign, nothing else
  for (const [x0, x1, z0, z1, y0, h, k] of bo.slabs) {
    if ("wall" !== k) continue;
    FACES.push({ nx: 0, nz: 1, c: z1, a: x0, b: x1, h, slab: 1 });
    FACES.push({ nx: 0, nz: -1, c: z0, a: x0, b: x1, h, slab: 1 });
  }
  // a point on a face at distance s from its start, pushed out by d
  const onFace = (f, s, d) => (f.nx ? [f.c + f.nx * d, f.a + s] : [f.a + s, f.c + f.nz * d]);
  // faces that really face open ground (not buried in another building)
  const LIVE = FACES.filter((f) => {
    const m = (f.b - f.a) / 2,
      [x, z] = onFace(f, m, 0.8);
    return f.b - f.a >= 5 && open(x, z, 0.1);
  });

  // ── signs (one atlas, one draw call) ──
  const SIGNS = [
    ["세관", 0, -40, 6.9, "navy", 5.2, 1.3],
    ["여객 터미널", 0, 64, 5.4, "teal", 11, 2],
    ["냉동창고", -65, -22, 3.5, "navy"],
    ["그물 골목", -67, -2, 3.5, "navy"],
    ["어판장", -47, 28, 3.5, "red"],
    ["수로", -30, -34, 3.5, "navy"],
    ["운하 거리", 0, -6, 3.5, "navy"],
    ["매표소", 0, 43, 3.5, "teal"],
    ["야적장", 48, 26, 3.5, "navy"],
    ["어구창고", 64, -22, 3.5, "navy"],
    ["컨테이너 골목", 66, -10, 3.5, "navy"],
    ["조선소 도크", -60, -41, 3.5, "yellow"],
    ["등대 부두", 50, -38, 3.5, "navy"],
    ["서쪽 부두길", -45, 54, 3.5, "navy"],
    ["동쪽 부두길", 45, 54, 3.5, "navy"],
    ["셔터 통로", 18, -20, 3.5, "yellow"],
    ["A 연결", -30, -30, 3.5, "yellow"],
    ["B 연결", 34, -17, 3.5, "yellow"],
    ["수로 꺾임", -22, -4, 3.5, "navy"],
    ["어판장 골목", -26, 36, 3.5, "red"],
    ["야적장 골목", 26, 28, 3.5, "navy"],
  ];
  const SCOL = { navy: ["#1f3a52", "#f4f1e8"], teal: ["#0f5d63", "#f4fbf9"], red: ["#8e2f2a", "#fff1e8"], yellow: ["#e0b92e", "#1b1b1b"] };

  function decorate(ctx) {
    const keep = ctx.keep;
    seed = 7;
    const add = (o, shadow) => {
      o.castShadow = !!shadow;
      scene.add(keep(o));
      return o;
    };
    // ---- signs ----
    const placed = [];
    let nLights = 0,
      nWindows = 0;
    {
      const cols = 2,
        rows = Math.ceil(SIGNS.length / cols),
        cw = 512,
        ch = 128;
      const cv = canvas(cw * cols, ch * rows, (g, w, h) => {
        SIGNS.forEach((s, i) => {
          const [bg, fg] = SCOL[s[4]],
            x = (i % cols) * cw,
            y = Math.floor(i / cols) * ch;
          g.fillStyle = bg;
          g.fillRect(x, y, cw, ch);
          g.strokeStyle = fg;
          g.lineWidth = 6;
          g.strokeRect(x + 8, y + 8, cw - 16, ch - 16);
          g.fillStyle = fg;
          g.font = '800 70px "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(s[0], x + cw / 2, y + ch / 2 + 4, cw - 40);
        });
      });
      const P = [],
        U = [],
        I = [];
      SIGNS.forEach((s, i) => {
        const [text, lx, lz, cy, , sw, sh] = s;
        // the nearest building face that looks toward the label
        let best = null,
          bd = 1e9;
        for (const f of LIVE) {
          const len = f.b - f.a;
          const w = sw || Math.min(7.5, 2.2 + text.length * 0.78),
            along = f.nx ? lz : lx,
            across = f.nx ? lx : lx * 0 + lz;
          const out = f.nx ? (lx - f.c) * f.nx : (lz - f.c) * f.nz;
          if ((!sw && out < 0.5) || (sw && out < -0.1) || len < w + 1.2) continue;
          const sPos = Math.min(f.b - f.a - w / 2 - 0.6, Math.max(w / 2 + 0.6, along - f.a));
          const [px, pz] = onFace(f, sPos, 0.8);
          if (!open(px, pz, 0.1)) continue;
          const d = Math.hypot(px - lx, pz - lz);
          void across;
          d < bd && ((bd = d), (best = { f, s: sPos, w }));
        }
        if (!best || bd > (sw ? 14 : 11)) return;
        const { f, w } = best;
        const [px, pz] = onFace(f, best.s, 0.05);
        if (placed.some((p) => Math.hypot(p.x - px, p.z - pz) < 5)) return;
        const h = sh || w / 4.2,
          q = faceQuad(px, cy, pz, f.nx, f.nz, w, h),
          k = P.length / 3,
          u0 = (i % cols) / cols,
          v0 = 1 - (Math.floor(i / cols) + 1) / rows;
        q.forEach((p) => P.push(...p));
        U.push(u0, v0, u0 + 1 / cols, v0, u0 + 1 / cols, v0 + 1 / rows, u0, v0 + 1 / rows);
        I.push(k, k + 1, k + 2, k, k + 2, k + 3);
        placed.push({ x: px, z: pz, nx: f.nx, nz: f.nz, w, cy, f });
      });
      if (P.length) {
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
        g.setAttribute("uv", new T.Float32BufferAttribute(U, 2));
        g.setIndex(I);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        add(new T.Mesh(g, new T.MeshBasicMaterial({ map: texOf(cv, !1, 4), polygonOffset: !0, polygonOffsetFactor: -2, fog: !0 })));
      }
    }
    // ---- windows (instanced, flat on the walls) ----
    const glows = [];
    {
      const wt = texOf(
        canvas(64, 96, (g, w, h) => {
          g.fillStyle = "#cfd2d6";
          g.fillRect(0, 0, w, h);
          g.fillStyle = "#fff";
          g.fillRect(6, 6, w - 12, h - 12);
          g.fillStyle = "#cfd2d6";
          g.fillRect(w / 2 - 2, 6, 4, h - 12);
          g.fillRect(6, h * 0.45, w - 12, 4);
        }),
        !1,
        2,
      );
      const list = [];
      for (const f of LIVE) {
        const len = f.b - f.a;
        if (len < 6 || f.slab) continue;
        const n = Math.floor((len - 1.6) / 3.6);
        for (let i = 0; i < n; i++) {
          const s = 1.8 + ((len - 3.6) * (i + 0.5)) / n;
          const [px, pz] = onFace(f, s, 0.7);
          if (!open(px, pz, 0.15)) continue;
          if (placed.some((p) => p.f === f && Math.abs(p.x * f.nz - px * f.nz + (p.z * f.nx - pz * f.nx)) < p.w / 2 + 1.4)) continue;
          for (const y of f.h >= 7.5 ? [3.1, 6.1] : [3.1]) list.push({ f, s, y });
        }
      }
      const im = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: wt, polygonOffset: !0, polygonOffsetFactor: -2, fog: !0 }), Math.max(1, list.length));
      const m4 = new T.Matrix4(),
        q = new T.Quaternion(),
        c = new T.Color();
      const GLASS = ["#2a3d52", "#34495f", "#223245"],
        LIT = "#ffd27a";
      list.forEach((o, i) => {
        const [px, pz] = onFace(o.f, o.s, 0.04);
        q.setFromAxisAngle(new T.Vector3(0, 1, 0), Math.atan2(o.f.nx, o.f.nz));
        m4.compose(new T.Vector3(px, o.y, pz), q, new T.Vector3(1.5, 1.35, 1));
        im.setMatrixAt(i, m4);
        const r = hash(px * 3.1, pz * 1.7 + o.y);
        if (r < 0.26) {
          im.setColorAt(i, c.set(LIT));
          const [gx, gz] = onFace(o.f, o.s, 0.5);
          glows.push([gx, o.y, gz, 1.7]);
        } else im.setColorAt(i, c.set(GLASS[Math.floor(r * 10) % 3]));
      });
      im.count = list.length;
      nWindows = list.length;
      im.instanceMatrix.needsUpdate = !0;
      im.instanceColor && (im.instanceColor.needsUpdate = !0);
      im.frustumCulled = !1;
      add(im);
    }
    // ---- props: wall-hugging, no collision, ≤ 1.4 m ----
    {
      const items = [];
      const near = (x, z, r) => items.some((p) => Math.hypot(p.x - x, p.z - z) < r);
      const BAR = bo.barriers;
      for (const f of LIVE) {
        const len = f.b - f.a;
        if (len < 7 || f.slab) continue;
        for (let s = 2.5 + rnd() * 3; s < len - 2.5; s += 5 + rnd() * 5) {
          const [x, z] = onFace(f, s, 0.45);
          if (!open(x, z, 0.1) || !open(...onFace(f, s, 1.6), 0.1)) continue;
          if (BAR.some((b) => x > b[0] - 3 && x < b[1] + 3 && z > b[2] - 3 && z < b[3] + 3)) continue;
          if (near(x, z, 3)) continue;
          const hex = hexAt(x, z),
            side = x < 0 ? -1 : 1;
          const r = rnd();
          let type, sc, color;
          if ("#7a3a3a" === hex && side < 0) [type, sc, color] = r < 0.4 ? ["cyl", [0.6, 0.9, 0.6], ["#a63c2a", "#2e5f8a", "#6b4a30"][Math.floor(rnd() * 3)]] : r < 0.75 ? ["box", [0.8, 0.7, 0.8], "#a98152"] : ["cyl", [0.9, 0.3, 0.9], "#d9c9a0"];
          else if ("#7a3a3a" === hex) [type, sc, color] = r < 0.5 ? ["sph", [0.75, 0.75, 0.75], ["#d93a2b", "#f2f2f2", "#f08a1c"][Math.floor(rnd() * 3)]] : ["cyl", [0.4, 0.55, 0.4], "#caa22c"];
          else if ("#3f5e46" === hex && side < 0) [type, sc, color] = ["box", [0.75, 0.45 + rnd() * 0.3, 0.55], r < 0.5 ? "#3f7fb5" : "#e8edf0"];
          else if ("#7a5a3a" === hex || "#5a6170" === hex) [type, sc, color] = r < 0.5 ? ["box", [1.2, 0.42, 0.45], "#6a4a30"] : ["box", [0.8, 0.8, 0.5], "#3f6b49"];
          else [type, sc, color] = r < 0.35 ? ["cyl", [0.6, 0.9, 0.6], ["#3f7f9a", "#a63c2a", "#4a4f57"][Math.floor(rnd() * 3)]] : r < 0.7 ? ["box", [0.9, 0.75, 0.75], "#b08a58"] : ["box", [1.05, 0.16, 0.85], "#9a7a50"];
          items.push({ x, z, type, sc, color, rot: Math.atan2(f.nx, f.nz) + (rnd() - 0.5) * 0.3 });
        }
      }
      const kinds = { box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(0.5, 0.5, 1, 8), sph: new T.SphereGeometry(0.5, 8, 6) };
      for (const k in kinds) {
        const L = items.filter((p) => p.type === k);
        if (!L.length) continue;
        const im = new T.InstancedMesh(kinds[k], new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 }), L.length),
          m4 = new T.Matrix4(),
          qq = new T.Quaternion(),
          c = new T.Color();
        L.forEach((p, i) => {
          qq.setFromAxisAngle(new T.Vector3(0, 1, 0), p.rot);
          m4.compose(new T.Vector3(p.x, p.sc[1] / 2, p.z), qq, new T.Vector3(...p.sc));
          im.setMatrixAt(i, m4);
          im.setColorAt(i, c.set(p.color));
        });
        im.instanceMatrix.needsUpdate = !0;
        im.instanceColor && (im.instanceColor.needsUpdate = !0);
        im.frustumCulled = !1;
        im.receiveShadow = !0;
        add(im);
      }
      POGU.props = items.length;
    }
    // ---- wall lamps ----
    const lamps = [];
    {
      for (const f of LIVE) {
        const len = f.b - f.a;
        if (len < 8 || f.slab) continue;
        for (let s = 3 + rnd() * 5; s < len - 3; s += 13 + rnd() * 6) {
          const [x, z] = onFace(f, s, 0.2);
          if (!open(...onFace(f, s, 1), 0.1)) continue;
          if (lamps.some((l) => Math.hypot(l[0] - x, l[2] - z) < 12)) continue;
          if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 4)) continue;
          lamps.push([x, 4.1, z, f]);
        }
      }
      const bx = Boxes();
      for (const [x, y, z, f] of lamps) {
        // a small bracket and a lantern, on the wall
        const ox = f.nx * 0.22,
          oz = f.nz * 0.22;
        bx.box(x + ox - 0.1, x + ox + 0.1, y - 0.15, y + 0.15, z + oz - 0.1, z + oz + 0.1, "#2b2e33");
        glows.push([x + f.nx * 0.5, y, z + f.nz * 0.5, 3.2]);
      }
      lamps.length && add(bx.mesh(new T.MeshStandardMaterial({ vertexColors: !0, roughness: 0.8 })));
    }
    // ---- landmarks ----
    {
      const bx = Boxes();
      // A: the crane, a mast on the 9 m post and a jib over the dock
      const cx = -43,
        cz = -51;
      bx.box(cx - 0.45, cx + 0.45, 9, 14, cz - 0.45, cz + 0.45, "#dcaa2e");
      bx.box(cx - 0.9, cx + 0.9, 8.6, 9.2, cz - 0.9, cz + 0.9, "#c8962a");
      bx.box(cx - 21, cx + 0.45, 12.3, 12.9, cz - 0.28, cz + 0.28, "#dcaa2e");
      bx.box(cx - 21, cx + 0.45, 12.9, 13.1, cz - 0.1, cz + 0.1, "#9a6f1a");
      bx.box(cx + 0.45, cx + 4.2, 12.2, 12.8, cz - 0.3, cz + 0.3, "#dcaa2e");
      bx.box(cx + 2.2, cx + 4.2, 11.2, 12.2, cz - 0.7, cz + 0.7, "#555a62");
      bx.box(cx - 0.9, cx + 0.9, 14, 15, cz - 0.9, cz + 0.9, "#c8962a");
      bx.box(cx - 17.5, cx - 17.1, 8.6, 12.3, cz - 0.05, cz + 0.05, "#2b2e33");
      bx.box(cx - 17.8, cx - 16.8, 8.1, 8.7, cz - 0.3, cz + 0.3, "#d9442c");
      // B: the lighthouse, red bands on the white base, a gallery and a lantern
      const lx = 57,
        lz = -51;
      for (const [a, b] of [[1.6, 3.8], [6.2, 8.4]]) bx.box(lx - 3.05, lx + 3.05, a, b, lz - 3.05, lz + 3.05, "#c8352b");
      bx.box(lx - 3.6, lx + 3.6, 12, 12.35, lz - 3.6, lz + 3.6, "#3a3d44");
      for (const [x0, x1, z0, z1] of [[-3.6, 3.6, 3.4, 3.6], [-3.6, 3.6, -3.6, -3.4], [3.4, 3.6, -3.6, 3.6], [-3.6, -3.4, -3.6, 3.6]]) bx.box(lx + x0, lx + x1, 12.35, 13.2, lz + z0, lz + z1, "#c8352b");
      bx.box(lx - 1.5, lx + 1.5, 12.35, 12.8, lz - 1.5, lz + 1.5, "#efede5");
      bx.box(lx - 1.7, lx + 1.7, 14.7, 15.0, lz - 1.7, lz + 1.7, "#3a3d44");
      bx.box(lx - 1.1, lx + 1.1, 15.0, 15.5, lz - 1.1, lz + 1.1, "#c8352b");
      bx.box(lx - 0.5, lx + 0.5, 15.5, 16.1, lz - 0.5, lz + 0.5, "#c8352b");
      bx.box(lx - 0.1, lx + 0.1, 16.1, 17.1, lz - 0.1, lz + 0.1, "#2b2e33");
      // the lantern room glows
      const lan = new T.Mesh(new T.BoxGeometry(2.4, 2.1, 2.4), new T.MeshBasicMaterial({ color: 0xffe3a6, fog: !1 }));
      lan.position.set(lx, 13.5, lz);
      add(lan);
      // the terminal / clock block: a small tower cap over the middle block
      bx.box(-4.5, 4.5, 8, 9.2, 49.5, 58.5, "#cfc8b8");
      bx.box(-3.5, 3.5, 9.2, 12, 50.5, 57.5, "#e6e0d1");
      bx.box(-4, 4, 12, 12.6, 50, 58, "#3a6e72");
      bx.box(-2.4, 2.4, 12.6, 14, 51.6, 56.4, "#3a6e72");
      bx.box(-0.1, 0.1, 14, 16, 53.9, 54.1, "#2b2e33");
      // warehouse chimneys and a water tank, to break the skyline
      for (const [x, z, h] of [[-58, 44, 11], [-24, 60, 10.5], [28, 58, 11], [66, 22, 10.5], [-66, -10, 10]]) {
        const hex = hexAt(x, z);
        void hex;
        bx.box(x - 0.6, x + 0.6, 8, h, z - 0.6, z + 0.6, "#7b5a48");
        bx.box(x - 0.8, x + 0.8, h, h + 0.35, z - 0.8, z + 0.8, "#3a3d44");
      }
      // shadows from the landmarks only where the quality setting casts decor shadows
      add(bx.mesh(new T.MeshStandardMaterial({ vertexColors: !0, roughness: 0.8, metalness: 0.1 })), "undefined" != typeof GFX && !!GFX.decorShadow);
      // the crane's cables
      {
        const g = new T.BufferGeometry();
        g.setAttribute(
          "position",
          new T.Float32BufferAttribute(
            [cx, 14, cz, cx - 12, 12.9, cz, cx, 14, cz, cx - 21, 12.6, cz, cx, 14, cz, cx + 4, 12.4, cz],
            3,
          ),
        );
        add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x23262b })));
      }
      // the clock: two faces (toward the middle, and the terminal side), hands follow the real time
      {
        const cv = canvas(256, 256, () => {});
        const ctx2 = cv.getContext("2d"),
          ct = texOf(cv, !1, 4);
        const draw = () => {
          const d = new Date(),
            g = ctx2;
          g.clearRect(0, 0, 256, 256);
          g.fillStyle = "#1c3340";
          g.fillRect(0, 0, 256, 256);
          g.fillStyle = "#f6f1e3";
          g.beginPath();
          g.arc(128, 128, 112, 0, 6.2832);
          g.fill();
          g.strokeStyle = "#1c3340";
          g.lineWidth = 8;
          g.stroke();
          g.fillStyle = "#1c3340";
          for (let i = 0; i < 12; i++) {
            const a = (i * Math.PI) / 6;
            g.fillRect(128 + Math.sin(a) * 92 - 4, 128 - Math.cos(a) * 92 - 4, 8, 8);
          }
          const hand = (a, l, w) => {
            g.lineWidth = w;
            g.beginPath();
            g.moveTo(128, 128);
            g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l);
            g.stroke();
          };
          hand((((d.getHours() % 12) + d.getMinutes() / 60) * Math.PI) / 6, 58, 10);
          hand(((d.getMinutes() + d.getSeconds() / 60) * Math.PI) / 30, 84, 6);
          g.strokeStyle = "#c8352b";
          hand((d.getSeconds() * Math.PI) / 30, 90, 2);
          ct.needsUpdate = !0;
        };
        draw();
        const mk = (nz, z) => {
          const g = new T.PlaneGeometry(4.2, 4.2),
            m = new T.Mesh(g, new T.MeshBasicMaterial({ map: ct, fog: !0 }));
          m.position.set(0, 10.6, z);
          m.rotation.y = nz > 0 ? 0 : Math.PI;
          return add(m);
        };
        mk(-1, 49.45);
        mk(1, 58.55);
        POGU.clock = setInterval(() => {
          try {
            "pogu" === CUR_MAP_KEY ? draw() : clearInterval(POGU.clock);
          } catch (e) {}
        }, 1000);
      }
      // the lighthouse beam: a long soft quad that turns
      {
        const bt = texOf(
          canvas(256, 32, (g, w, h) => {
            const gr = g.createLinearGradient(0, 0, w, 0);
            gr.addColorStop(0, "rgba(255,236,190,.95)");
            gr.addColorStop(0.5, "rgba(255,226,160,.25)");
            gr.addColorStop(1, "rgba(255,220,150,0)");
            g.fillStyle = gr;
            g.fillRect(0, 0, w, h);
            const gy = g.createLinearGradient(0, 0, 0, h);
            gy.addColorStop(0, "rgba(0,0,0,1)");
            gy.addColorStop(0.5, "rgba(0,0,0,0)");
            gy.addColorStop(1, "rgba(0,0,0,1)");
            g.globalCompositeOperation = "destination-out";
            g.fillStyle = gy;
            g.fillRect(0, 0, w, h);
          }),
          !1,
        );
        const beam = new T.Mesh(
          new T.PlaneGeometry(38, 3.2),
          new T.MeshBasicMaterial({ map: bt, transparent: !0, depthWrite: !1, blending: T.AdditiveBlending, fog: !1, side: T.DoubleSide }),
        );
        beam.geometry.translate(19, 0, 0);
        beam.rotation.x = -Math.PI / 2;
        beam.position.set(lx, 13.5, lz);
        beam.rotation.order = "YXZ";
        add(beam);
        const t0 = performance.now();
        clearInterval(POGU.beam);
        POGU.beam = setInterval(() => {
          try {
            "pogu" === CUR_MAP_KEY && beam.parent ? (beam.rotation.y = ((performance.now() - t0) / 6000) * Math.PI * 2) : clearInterval(POGU.beam);
          } catch (e) {}
        }, 40);
      }
      // ---- real lights: every lit surface pays for each one, so few: three on
      // the visual presets, the lighthouse alone on the default and lighter ones,
      // none on the lightest (the glows stay on all of them) ----
      const lamps = "undefined" != typeof GFX && null != GFX.lamps ? GFX.lamps : 4,
        cap = lamps >= 6 ? 3 : lamps >= 3 ? 1 : 0;
      [
        [lx, 14.2, lz, 0xffd9a0, 12, 32],
        [cx - 16, 11.6, cz, 0xffb468, 9, 24],
        [0, 5.5, 66, 0xa6ebe2, 8, 22],
      ]
        .slice(0, cap)
        .forEach(([x, y, z, c, i, d]) => {
          const L = new T.PointLight(c, i, d, 2);
          L.position.set(x, y, z);
          add(L);
          nLights++;
        });
      glows.push([lx, 13.5, lz, 7], [cx - 20.6, 12.2, cz, 3.5], [0, 5.5, 64, 3]);
    }
    // ---- glows: one Points object for the lamps and the lit windows ----
    if (glows.length) {
      const gt = texOf(
        canvas(64, 64, (g) => {
          const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
          gr.addColorStop(0, "rgba(255,226,160,.95)");
          gr.addColorStop(0.35, "rgba(255,190,110,.35)");
          gr.addColorStop(1, "rgba(255,170,90,0)");
          g.fillStyle = gr;
          g.fillRect(0, 0, 64, 64);
        }),
        !1,
      );
      // one size per Points object: three buckets (windows, lamps, the big ones)
      for (const [lo, hi, size] of [[0, 2, 2.4], [2, 5, 5], [5, 99, 11]]) {
        const L = glows.filter((q) => q[3] >= lo && q[3] < hi);
        if (!L.length) continue;
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(L.flatMap((q) => [q[0], q[1], q[2]]), 3));
        g.computeBoundingSphere();
        const m = new T.Points(g, new T.PointsMaterial({ map: gt, size, sizeAttenuation: !0, transparent: !0, depthWrite: !1, blending: T.AdditiveBlending, fog: !0, opacity: lo ? 0.9 : 0.55 }));
        m.frustumCulled = !1;
        add(m);
      }
    }
    POGU.dressed = !0;
    POGU.decor = { lights: nLights, signs: placed.length, windows: nWindows, props: POGU.props, glows: glows.length };
  }
  window.POGU_THEME = { group, tint, material, floorColor, floorMat, decorate };
})();
