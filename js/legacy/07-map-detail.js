
(() => {
  // Visual-only map detail: wall trims, facade pieces, clutter hugging walls,
  // floor decals, small debris and a skyline outside the play area.
  // Nothing here is a collider, so movement, paths and bullets are unchanged.
  // Everything is instanced (one draw call per piece type) and seeded per map
  // so every player in a room sees the same layout.
  const G = {
    box: new T.BoxGeometry(1, 1, 1),
    cyl: new T.CylinderGeometry(0.5, 0.5, 1, 8),
    cyl6: new T.CylinderGeometry(0.5, 0.5, 1, 6),
    taper: new T.CylinderGeometry(0.34, 0.5, 1, 8),
    sph: new T.IcosahedronGeometry(0.5, 1),
    rock: new T.IcosahedronGeometry(0.5, 0),
    cone: new T.ConeGeometry(0.5, 1, 8),
    pyr: new T.ConeGeometry(0.5, 1, 4),
    plane: new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    blob: new T.CircleGeometry(0.5, 9).rotateX(-Math.PI / 2),
  };
  const MC = {};
  const M = (key, o) => MC[key] || (MC[key] = new T.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0.05 }, o)));
  const C = (hex, rough, metal) => M("c" + hex + "_" + (rough || 0.85) + "_" + (metal || 0.05), { color: hex, roughness: rough || 0.85, metalness: metal || 0.05 });
  const E = (hex, k) => M("e" + hex + "_" + (k || 1.4), { color: 0x111111, emissive: hex, emissiveIntensity: k || 1.4, roughness: 0.6 });
  const D = (hex, op) =>
    M("d" + hex + "_" + op, { color: hex, transparent: !0, opacity: op, depthWrite: !1, polygonOffset: !0, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.95 });
  const WET = () => M("wet", { color: 0x1a1f26, roughness: 0.12, metalness: 0.6, transparent: !0, opacity: 0.42, depthWrite: !1, polygonOffset: !0, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  // seeded random so all clients agree
  let seed = 1;
  const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const rr = (a, b) => a + (b - a) * R();
  const pickR = (a) => a[Math.floor(R() * a.length)];

  const B = new Map(),
    o3 = new T.Object3D();
  o3.rotation.order = "YXZ";
  function put(geo, m, x, y, z, sx, sy, sz, ry, rx, rz) {
    const k = geo.uuid + m.uuid;
    let b = B.get(k);
    b || B.set(k, (b = { geo, m, list: [] }));
    o3.position.set(x, y, z);
    o3.rotation.set(rx || 0, ry || 0, rz || 0);
    o3.scale.set(sx, sy, sz);
    o3.updateMatrix();
    b.list.push(o3.matrix.clone());
  }
  const box = (m, x, y, z, sx, sy, sz, ry, rx, rz) => put(G.box, m, x, y, z, sx, sy, sz, ry, rx, rz);
  // thin rods read the same as boxes, and small balls don't need the smooth mesh
  const cyl = (m, x, y, z, r, h, ry, rx, rz) => put(r < 0.1 ? G.box : G.cyl, m, x, y, z, 2 * r, h, 2 * r, ry, rx, rz);
  const sph = (m, x, y, z, sx, sy, sz) => put(Math.max(sx, sy, sz) < 0.7 ? G.rock : G.sph, m, x, y, z, sx, sy, sz);
  const built = [];
  // big batches are split into a 3x3 grid over the map so the parts behind
  // the camera get frustum-culled instead of drawn every frame
  function flush() {
    const bd = MAP.bounds,
      cw = (bd.maxX - bd.minX) / 3,
      ch = (bd.maxZ - bd.minZ) / 3;
    const cell = (mm) => {
      const cx = Math.max(0, Math.min(2, Math.floor((mm.elements[12] - bd.minX) / cw))),
        cz = Math.max(0, Math.min(2, Math.floor((mm.elements[14] - bd.minZ) / ch)));
      return cz * 3 + cx;
    };
    for (const b of B.values()) {
      const split = b.list.length > 400,
        groups = split ? [...Array(9)].map(() => []) : [b.list];
      if (split) for (const mm of b.list) groups[cell(mm)].push(mm);
      for (const list of groups) {
        if (!list.length) continue;
        const im = new T.InstancedMesh(b.geo, b.m, list.length);
        list.forEach((mm, i) => im.setMatrixAt(i, mm));
        im.instanceMatrix.needsUpdate = !0;
        im.computeBoundingSphere();
        im.receiveShadow = !b.m.transparent;
        im.castShadow = !1;
        im.userData.mapDetail = 1;
        scene.add(im);
        built.push(im);
      }
    }
    B.clear();
  }

  // ── wall faces ──
  function facesOf(w) {
    const alongX = w.w >= w.d,
      L = alongX ? w.w : w.d,
      t = alongX ? w.d : w.w,
      b = MAP.bounds,
      out = [];
    for (const s of [-1, 1]) {
      const nx = alongX ? 0 : s,
        nz = alongX ? s : 0,
        cx = w.x + (nx * t) / 2,
        cz = w.z + (nz * t) / 2;
      if (cx + nx * 1.5 < b.minX || cx + nx * 1.5 > b.maxX || cz + nz * 1.5 < b.minZ || cz + nz * 1.5 > b.maxZ) continue;
      out.push({ w, cx, cz, nx, nz, L, t, h: w.h, ax: alongX ? 1 : 0, az: alongX ? 0 : 1, ry: Math.atan2(nx, nz) });
    }
    return out;
  }
  const at = (f, u, d) => [f.cx + f.ax * u + f.nx * d, f.cz + f.az * u + f.nz * d];
  // something flat or shallow stuck to a face; d0 = gap from the face
  function fbox(f, m, u, y, W, H, Dp, d0, rx) {
    const [x, z] = at(f, u, (d0 || 0) + Dp / 2);
    box(m, x, y, z, W, H, Dp, f.ry, rx || 0);
  }
  function fcyl(f, m, u, y, r, h, d0) {
    const [x, z] = at(f, u, (d0 || 0) + r);
    cyl(m, x, y, z, r, h);
  }
  // is the spot in front of the face open (not buried in another wall)?
  const openAt = (f, u, d) => {
    const [x, z] = at(f, u, d || 0.4);
    return !collideXZ(x, z, 0.1, 0.12);
  };

  // ── per-theme kits ──
  const giwaCap = (w, m, m2) => {
    // hanok wall roof: wide dark slab with a ridge
    box(m, w.x, w.h + 0.08, w.z, w.w + (w.w >= w.d ? 0.3 : 0.9), 0.14, w.d + (w.w >= w.d ? 0.9 : 0.3));
    box(m2, w.x, w.h + 0.24, w.z, w.w + 0.1, 0.18, w.d + 0.1);
  };
  const KITS = {
    glacier: {
      cap: C(0x8aa0b5, 0.4, 0.6), base: C(0x3d4b5a, 0.5, 0.6), pil: C(0x5a6e84, 0.4, 0.7), pilEvery: 6.5,
      band: [E(0x7ee9ff, 1.6), 0.07, -0.7],
      panel(f, u, s) {
        const r = R();
        if (r < 0.3) {
          fbox(f, C(0x1e2833, 0.6, 0.5), u, 1.7, 1.3, 0.85, 0.06);
          for (let i = 0; i < 4; i++) fbox(f, C(0x5d6f82, 0.4, 0.7), u, 1.4 + i * 0.2, 1.2, 0.05, 0.05, 0.06);
        } else if (r < 0.5) for (let i = 0; i < 6; i++) fbox(f, i % 2 ? C(0x1b1b1b) : C(0xf2c230, 0.6), u - 1 + i * 0.4, 0.62, 0.4, 0.3, 0.04);
        else if (r < 0.66) fbox(f, E(0x9ff0ff, 1.1), u, 2.3, 0.7, 0.42, 0.04), fbox(f, C(0x24303c), u, 2.3, 0.84, 0.56, 0.03);
        else if (r < 0.85) fcyl(f, C(0x6f8296, 0.4, 0.7), u, f.h / 2, 0.09, f.h, 0.05), fcyl(f, C(0x6f8296, 0.4, 0.7), u + 0.35, f.h / 2, 0.06, f.h, 0.05);
      },
      top(w) {
        const L = Math.max(w.w, w.d);
        for (let u = -L / 2; u < L / 2 - 0.5; u += rr(1.5, 4)) {
          const len = rr(0.8, 3), a = w.w >= w.d;
          box(C(0xf1f6fb, 0.9), w.x + (a ? u + len / 2 : 0), w.h + 0.2, w.z + (a ? 0 : u + len / 2), a ? len : w.w + 0.25, rr(0.12, 0.3), a ? w.d + 0.25 : len);
        }
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.4) for (let i = 0; i < 3; i++) cyl(C(0xcad6e2, 0.35, 0.6), x + (i - 1) * 0.42, 0.45, z, 0.18, 0.9), cyl(C(0xd9523a, 0.5), x + (i - 1) * 0.42, 0.75, z, 0.185, 0.08);
        else if (r < 0.7) box(C(0x9aa8b5, 0.5, 0.5), x, 0.3, z, 0.8, 0.6, 0.55, ry), box(C(0x2c3a48), x, 0.61, z, 0.82, 0.04, 0.57, ry);
        else sph(C(0xf1f6fb, 0.9), x, 0.1, z, rr(1, 1.8), rr(0.35, 0.6), rr(0.8, 1.2));
      },
      decals: [[D(0xcfe8f5, 0.55), 1.5, 5], [D(0x7d8d9d, 0.25), 0.4, 6]],
      debris: [C(0xe6eef6, 0.7), C(0xb9d6ea, 0.3, 0.2)],
      back(x, z) {
        if (R() < 0.75) box(pickR([C(0xdde7f0, 0.9), C(0xa9b8c7, 0.9)]), x, 0, z, rr(18, 40), rr(14, 46), rr(18, 40), rr(0, 3));
        else cyl(C(0x5f7082, 0.5, 0.6), x, 14, z, 0.35, 28), sph(E(0xff3344, 2), x, 28.4, z, 0.7, 0.7, 0.7);
      },
    },
    dunes: {
      cap: C(0xcaa36e), base: C(0x8d6a42), pil: C(0xb88d58), pilEvery: 7, pilW: 0.7,
      band: [C(0x9a7448), 0.16, 0.72],
      panel(f, u, s) {
        const r = R();
        if (r < 0.35) fbox(f, C(0x3e2b19), u, 1.5, 0.9, 1.7, 0.04), fbox(f, C(0x3e2b19), u, 2.45, 0.6, 0.25, 0.04);
        else if (r < 0.6) fbox(f, pickR([C(0xa33b2b), C(0x2c4f7c), C(0x3e7a46), C(0xc98a2a)]), u, 2.55, 2, 0.05, 1.1, 0, -0.35), fbox(f, C(0x5a4127), u - 0.95, 2.1, 0.06, 0.9, 0.06, 0.9), fbox(f, C(0x5a4127), u + 0.95, 2.1, 0.06, 0.9, 0.06, 0.9);
        else if (r < 0.75) fbox(f, E(0xffb45a, 1.6), u, 2.2, 0.22, 0.3, 0.22, 0.25), fbox(f, C(0x4a3520, 0.5, 0.6), u, 2.42, 0.3, 0.06, 0.3, 0.21);
      },
      top(w) {
        const a = w.w >= w.d, L = a ? w.w : w.d;
        for (let u = -L / 2 + 0.4; u < L / 2 - 0.3; u += 1.3) box(C(0xc49a62), w.x + (a ? u : 0), w.h + 0.3, w.z + (a ? 0 : u), a ? 0.6 : w.w + 0.1, 0.6, a ? w.d + 0.1 : 0.6);
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.45) for (let i = 0; i < 2 + Math.floor(R() * 2); i++) put(G.taper, C(0xa65a36), x + rr(-0.5, 0.5), 0.35, z + rr(-0.1, 0.1), 0.5, 0.7, 0.5, 0, Math.PI);
        else if (r < 0.7) cyl(C(0xb58c50), x, 0.28, z, 0.32, 0.56), cyl(C(0x7a5a30), x, 0.57, z, 0.33, 0.04);
        else sph(C(0xdcb57c, 0.98), x, 0.05, z, rr(1.4, 2.6), rr(0.3, 0.55), rr(1, 1.6));
      },
      decals: [[D(0xb98a52, 0.35), 2, 7], [D(0x8a6a44, 0.3), 0.6, 1.4]],
      debris: [C(0x9a7a52), C(0xc9a877)],
      back(x, z) {
        const r = R();
        if (r < 0.45) {
          const w = rr(20, 44), h = rr(12, 30), d = rr(18, 36), ry = rr(0, 3);
          box(C(0xb4763f, 0.95), x, h / 2, z, w, h, d, ry), box(C(0xc98a52, 0.95), x, h + 1, z, w * 0.9, 2, d * 0.9, ry);
        } else if (r < 0.65) put(G.pyr, C(0xd4a769, 0.95), x, 13, z, 34, 26, 34, Math.PI / 4);
        else sph(C(0xe0b77a, 0.98), x, 0, z, rr(40, 70), rr(10, 22), rr(30, 50));
      },
    },
    freighter: {
      cap: C(0x8a4a2a, 0.7, 0.4), base: C(0x2e3438, 0.6, 0.6), pil: C(0x3b4248, 0.5, 0.7), pilEvery: 6, pilW: 0.3,
      panel(f, u, s) {
        const r = R();
        if (r < 0.35) for (const k of [-0.45, 0.45]) fcyl(f, C(0x9aa3a8, 0.4, 0.8), u + k, f.h / 2, 0.035, f.h - 0.4, 0.04), fbox(f, C(0x9aa3a8, 0.4, 0.8), u + k, 1.3, 0.18, 0.06, 0.12, 0.04);
        else if (r < 0.55) fbox(f, E(0xffd08a, 1.8), u, f.h - 0.9, 0.24, 0.24, 0.16, 0.08), fbox(f, C(0x222222), u, f.h - 0.72, 0.36, 0.08, 0.3);
        else if (r < 0.72) fbox(f, C(0xe8e3d4, 0.8), u, 2.2, 1.4, 0.5, 0.03);
        else if (r < 0.85) for (let i = 0; i < 5; i++) fbox(f, i % 2 ? C(0x1b1b1b) : C(0xf2c230, 0.6), u - 0.8 + i * 0.4, 0.5, 0.4, 0.4, 0.04);
      },
      top(w) {
        const a = w.w >= w.d, L = a ? w.w : w.d;
        if (L < 4) return;
        for (let u = -L / 2 + 0.2; u <= L / 2 - 0.2; u += 1.6) cyl(C(0xc9b25a, 0.5, 0.6), w.x + (a ? u : 0), w.h + 0.55, w.z + (a ? 0 : u), 0.035, 1.1);
        box(C(0xc9b25a, 0.5, 0.6), w.x, w.h + 1.1, w.z, a ? L - 0.4 : 0.07, 0.07, a ? 0.07 : L - 0.4);
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.5) for (let i = 0; i < 1 + Math.floor(R() * 3); i++) cyl(pickR([C(0x2f5d8a, 0.5, 0.5), C(0xa8322a, 0.5, 0.5), C(0xd8a21e, 0.5, 0.5)]), x + (i - 1) * 0.62, 0.45, z, 0.29, 0.9);
        else if (r < 0.75) cyl(C(0xb99a62, 0.95), x, 0.09, z, 0.45, 0.18), cyl(C(0x8e7447, 0.95), x, 0.2, z, 0.3, 0.06);
        else cyl(C(0x2a2d31, 0.5, 0.8), x, 0.3, z, 0.22, 0.6), cyl(C(0x2a2d31, 0.5, 0.8), x, 0.62, z, 0.3, 0.06);
      },
      decals: [[D(0x6b3a1e, 0.35), 0.8, 3], [WET(), 1, 3], [D(0xf2c230, 0.75), 0.18, 6, !0]],
      debris: [C(0x5a3a26, 0.8, 0.4), C(0x777d82, 0.5, 0.7)],
      back(x, z) {
        const r = R();
        if (r < 0.55) {
          const L = rr(50, 90), ry = Math.round(R()) * Math.PI / 2;
          box(pickR([C(0x5a2a22, 0.7, 0.4), C(0x2d3a48, 0.7, 0.4), C(0x3b4a3a, 0.7, 0.4)]), x, 3, z, ry ? 14 : L, 10, ry ? L : 14, 0);
          box(C(0xd9d6cc, 0.8), x + (ry ? 0 : L * 0.35), 11, z + (ry ? L * 0.35 : 0), 10, 8, 10);
        } else {
          box(C(0xd0782a, 0.6, 0.5), x, 18, z, 2.2, 36, 2.2), box(C(0xd0782a, 0.6, 0.5), x + 9, 34, z, 22, 1.6, 1.6, rr(0, 3));
        }
      },
    },
    neon: {
      cap: C(0x1b1f2e, 0.3, 0.8), capGlow: E(0xff2d95, 1.1), base: C(0x14161f, 0.4, 0.7), pil: C(0x232739, 0.3, 0.8), pilEvery: 5.5, pilGlow: E(0x22e6ff, 1.6),
      panel(f, u, s) {
        const r = R(), col = pickR([0xff2d95, 0x22e6ff, 0xffd23d, 0x9b5cff, 0x4ade80]);
        if (r < 0.3) fbox(f, C(0x0b0c12, 0.4, 0.6), u, 3, 1.8, 0.7, 0.05), fbox(f, E(col, 2.2), u, 3, 1.5, 0.12, 0.03, 0.05), fbox(f, E(col, 2.2), u, 2.8, 1.1, 0.08, 0.03, 0.05);
        else if (r < 0.48) fbox(f, C(0x8c919c, 0.5, 0.6), u, 2.3, 0.95, 0.65, 0.45), fbox(f, C(0x2a2d35), u, 2.3, 0.55, 0.5, 0.02, 0.45);
        else if (r < 0.62) fbox(f, E(0x3b7bff, 1.3), u, 2.5, 1.7, 0.95, 0.04), fbox(f, C(0x0b0c12), u, 2.5, 1.85, 1.1, 0.03);
        else if (r < 0.78) fbox(f, C(0x0b0c12), u, 3.2, 0.5, 2.2, 0.12, 0.1), fbox(f, E(col, 2), u, 3.2, 0.34, 1.9, 0.02, 0.22);
      },
      top(w) {
        if (R() < 0.35 && w.h > 3) cyl(C(0x3a3f4d, 0.4, 0.8), w.x + rr(-1, 1), w.h + 1.6, w.z + rr(-1, 1), 0.05, 3.2), sph(E(0xff3344, 2.2), w.x, w.h + 3.25, w.z, 0.2, 0.2, 0.2);
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.35) for (let i = 0; i < 3; i++) sph(C(0x111317, 0.3, 0.2), x + rr(-0.6, 0.6), 0.22, z + rr(-0.12, 0.12), rr(0.5, 0.7), rr(0.4, 0.55), rr(0.45, 0.6));
        else if (r < 0.6) box(C(0x2b2f3d, 0.3, 0.7), x, 0.95, z, 0.95, 1.9, 0.6, ry), box(E(pickR([0x22e6ff, 0xff2d95, 0xffd23d]), 1.5), x + Math.sin(ry) * 0.31, 1.2, z + Math.cos(ry) * 0.31, 0.7, 1.1, 0.02, ry);
        else put(G.cone, C(0xff6a1a, 0.6), x, 0.35, z, 0.36, 0.7, 0.36), box(C(0xff6a1a, 0.6), x, 0.02, z, 0.45, 0.04, 0.45);
      },
      decals: [[WET(), 1.5, 5], [D(0xe8e8f0, 0.45), 0.14, 4, !0]],
      debris: [C(0x2a2d35, 0.4, 0.5), C(0x40444f, 0.4, 0.5)],
      back(x, z) {
        const w = rr(14, 28), h = rr(28, 90), d = rr(14, 28);
        box(M("win", winMat()), x, h / 2, z, w, h, d);
        sph(E(0xff3344, 2), x, h + 0.5, z, 0.8, 0.8, 0.8);
      },
    },
    garden: {
      cap: null, giwa: [C(0x3b3f45, 0.7, 0.1), C(0x2a2d31, 0.7, 0.1)], base: C(0x8c8a82, 0.95), baseH: 0.55, pil: C(0x6b4a2f, 0.8), pilEvery: 5, pilW: 0.28,
      band: [C(0x5a3c26), 0.22, -0.4],
      panel(f, u, s) {
        const r = R();
        if (r < 0.4) {
          fbox(f, C(0x5a3c26), u, 1.9, 1.2, 1, 0.05), fbox(f, E(0xf2dfb5, 0.35), u, 1.9, 1.02, 0.82, 0.02, 0.05);
          for (const k of [-0.25, 0.25]) fbox(f, C(0x5a3c26), u + k, 1.9, 0.04, 0.82, 0.03, 0.06);
          fbox(f, C(0x5a3c26), u, 1.9, 1.02, 0.04, 0.03, 0.06);
        } else if (r < 0.55) fbox(f, C(0x7d7a70, 0.95), u, 1.2, 1.4, 1.4, 0.03), fbox(f, C(0x9b978c, 0.95), u, 1.2, 1.1, 1.1, 0.02, 0.03);
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.35) for (let i = 0; i < 2 + Math.floor(R() * 3); i++) { const s = rr(0.7, 1.1); sph(C(0x4a2e1e, 0.35, 0.1), x + (i - 1.5) * 0.55, 0.32 * s, z, 0.6 * s, 0.7 * s, 0.6 * s), cyl(C(0x3a2418, 0.35), x + (i - 1.5) * 0.55, 0.64 * s, z, 0.13 * s, 0.12); }
        else if (r < 0.6) for (let i = 0; i < 6; i++) cyl(C(0x5f8a3a, 0.6), x + rr(-0.5, 0.5), 2, z + rr(-0.15, 0.15), 0.05, rr(3, 4.5));
        else if (r < 0.8) box(C(0x8f8c83, 0.95), x, 0.25, z, 0.5, 0.5, 0.5), box(C(0x8f8c83, 0.95), x, 0.7, z, 0.28, 0.4, 0.28), box(E(0xffc46b, 1.5), x, 0.95, z, 0.3, 0.2, 0.3), put(G.pyr, C(0x6f6c64, 0.95), x, 1.2, z, 0.6, 0.3, 0.6, Math.PI / 4);
        else cyl(C(0x8b5a3c), x, 0.2, z, 0.3, 0.4), sph(pickR([C(0xd9486a), C(0xf2a93b), C(0xe8e0f0)]), x, 0.5, z, 0.55, 0.35, 0.55);
      },
      decals: [[D(0x4f6b2e, 0.4), 0.8, 2.5], [D(0xc0602a, 0.55), 0.2, 0.5], [D(0x8a3a24, 0.5), 0.2, 0.5]],
      debris: [C(0x9a948a), C(0x7a756c)],
      back(x, z) {
        const r = R();
        if (r < 0.4) put(G.cone, C(0x24381f, 0.95), x, 7, z, rr(5, 8), rr(12, 18), rr(5, 8));
        else if (r < 0.7) { const w = rr(10, 18), d = rr(7, 10), ry = rr(0, 3); box(C(0xe4ddc8), x, 2.5, z, w, 5, d, ry); put(G.pyr, C(0x2f3237, 0.7), x, 6.4, z, w * 1.2, 3, d * 1.4, ry + Math.PI / 4); }
        else sph(C(0x3a4a2e, 0.95), x, 0, z, rr(50, 90), rr(18, 34), rr(40, 60));
      },
    },
    market: {
      cap: null, giwa: [C(0x2f3237, 0.7, 0.1), C(0x1f2226, 0.7, 0.1)], base: C(0x6f6c64, 0.95), baseH: 0.45, pil: C(0x3a2618, 0.8), pilEvery: 4.5, pilW: 0.26,
      band: [C(0x4a3020), 0.2, -0.4],
      panel(f, u, s) {
        const r = R();
        if (r < 0.35) fcyl(f, E(pickR([0xff5a3a, 0xff8a3a, 0xffc15a]), 1.8), u, f.h - 0.9, 0.2, 0.42, 0.25), fcyl(f, C(0x1b1b1b), u, f.h - 0.62, 0.08, 0.12, 0.37);
        else if (r < 0.6) fbox(f, C(0x6b4a2f), u, 2.6, 1.7, 0.5, 0.06), fbox(f, E(0xffd9a0, 0.6), u, 2.6, 1.3, 0.12, 0.02, 0.06);
        else if (r < 0.8) fbox(f, pickR([C(0x8c2d2a), C(0x2e5b7a), C(0x6a7a2e), C(0xc98a2a)]), u, 2.4, 2.1, 0.05, 1.2, 0, -0.4);
        else fbox(f, C(0x4d4f55, 0.6, 0.5), u, 1.2, 1.9, 2.1, 0.04);
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.45) { box(C(0x8a6a44), x, 0.25, z, 0.7, 0.5, 0.5, ry); for (let i = 0; i < 5; i++) sph(pickR([C(0xd9372a, 0.5), C(0x5caa3a, 0.5), C(0xf29b2a, 0.5)]), x + rr(-0.25, 0.25), 0.55, z + rr(-0.12, 0.12), 0.2, 0.2, 0.2); }
        else if (r < 0.7) for (let i = 0; i < 3; i++) sph(C(0xd8c9a3, 0.95), x + (i - 1) * 0.5, 0.25, z, 0.55, 0.5, 0.45);
        else for (let i = 0; i < 2; i++) sph(C(0x4a2e1e, 0.35, 0.1), x + (i - 0.5) * 0.6, 0.35, z, 0.6, 0.75, 0.6);
      },
      decals: [[D(0x2a241c, 0.3), 0.8, 2.5], [D(0xf0ede4, 0.7), 0.12, 0.3]],
      debris: [C(0x8a8478), C(0x6b4a2f)],
      back(x, z) {
        const r = R();
        if (r < 0.65) { const w = rr(10, 16), d = rr(7, 10), h = rr(4, 7), ry = Math.round(R()) * Math.PI / 2; box(C(0x6b4a2f), x, h / 2, z, w, h, d, ry); put(G.pyr, C(0x25282c, 0.7), x, h + 1.4, z, w * 1.25, 2.8, d * 1.45, ry + Math.PI / 4); box(E(0xffb46b, 0.9), x, h * 0.55, z, w * 0.6, 0.5, d + 0.05, ry); }
        else sph(C(0x1b2330, 0.95), x, 0, z, rr(60, 100), rr(20, 40), rr(40, 60));
      },
    },
    temple: {
      cap: null, giwa: [C(0x3a3d40, 0.8, 0.1), C(0x2a2c2f, 0.8, 0.1)], base: C(0x7a786f, 0.95), baseH: 0.6, pilEvery: 5, pilRound: C(0x8b2a1f, 0.6),
      band: [C(0x2f6f5e, 0.7), 0.35, -0.5], band2: [C(0x8b2a1f, 0.6), 0.06, -0.72],
      panel(f, u, s) {
        const r = R();
        if (r < 0.35) {
          fbox(f, C(0x7a3a24), u, 1.35, 1.4, 2.3, 0.05), fbox(f, C(0xe8dcc0, 0.9), u, 1.45, 1.2, 1.9, 0.02, 0.05);
          for (let i = 0; i < 4; i++) fbox(f, C(0x7a3a24), u, 0.7 + i * 0.5, 1.2, 0.04, 0.03, 0.06);
          fbox(f, C(0x7a3a24), u, 1.45, 0.04, 1.9, 0.03, 0.06);
        } else if (r < 0.5) fbox(f, C(0x5a584f, 0.95), u, 1.6, 0.9, 1.3, 0.05), fbox(f, C(0x3f3d36, 0.95), u, 1.6, 0.7, 1.1, 0.02, 0.05);
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.35) { let y = 0; for (let i = 0; i < 3 + Math.floor(R() * 3); i++) { const s = 0.5 - i * 0.07; put(G.rock, C(0x8a877c, 0.95), x, y + s * 0.3, z, s, s * 0.6, s, rr(0, 3)); y += s * 0.55; } }
        else if (r < 0.6) for (let i = 0; i < 5; i++) { const cx = x + rr(-0.4, 0.4), cz = z + rr(-0.12, 0.12), h = rr(0.15, 0.4); cyl(C(0xf0e8d6, 0.7), cx, h / 2, cz, 0.04, h); sph(E(0xffb347, 2.4), cx, h + 0.04, cz, 0.05, 0.08, 0.05); }
        else if (r < 0.8) cyl(C(0x4a3b24, 0.4, 0.7), x, 0.35, z, 0.3, 0.35), cyl(C(0x4a3b24, 0.4, 0.7), x, 0.1, z, 0.12, 0.2), sph(E(0xff7a3a, 1.2), x, 0.53, z, 0.3, 0.06, 0.3);
      },
      decals: [[D(0x4d6636, 0.45), 1, 3], [D(0xa04a22, 0.5), 0.2, 0.45], [D(0xd0a23a, 0.5), 0.2, 0.45]],
      debris: [C(0x8a877c), C(0x6c6a61)],
      back(x, z) {
        const r = R();
        if (r < 0.25) { let y = 0, s = rr(8, 11); for (let i = 0; i < 5; i++) { box(C(0x6e2a20, 0.8), x, y + 1.3, z, s * 0.7, 2.6, s * 0.7); put(G.pyr, C(0x2a2c2f, 0.8), x, y + 3, z, s * 1.4, 1.2, s * 1.4, Math.PI / 4); y += 3.3; s *= 0.84; } }
        else if (r < 0.65) put(G.cone, C(0x55655a, 0.95), x, 20, z, rr(40, 70), rr(30, 50), rr(40, 70));
        else put(G.cone, C(0x22301f, 0.95), x, 8, z, rr(5, 8), rr(14, 20), rr(5, 8));
      },
    },
    harbor: {
      cap: C(0xa9a79f, 0.9), base: C(0x6f6d68, 0.9), pil: C(0x7a4a3a, 0.9), pilEvery: 7, pilW: 0.6,
      panel(f, u, s) {
        const r = R();
        if (r < 0.28) fcyl(f, C(0x4e555c, 0.5, 0.6), u, f.h / 2, 0.08, f.h, 0.04), fbox(f, C(0x4e555c, 0.5, 0.6), u, 0.25, 0.16, 0.5, 0.35, 0.04);
        else if (r < 0.5) { fbox(f, C(0x8d9399, 0.6, 0.5), u, 1.25, 2.4, 2.5, 0.05); for (let i = 0; i < 8; i++) fbox(f, C(0x6d7379, 0.6, 0.5), u, 0.2 + i * 0.3, 2.4, 0.04, 0.03, 0.05); }
        else if (r < 0.68) { fbox(f, C(0x1c2126, 0.4, 0.3), u, 2.1, 1.1, 0.9, 0.04); for (let i = 0; i < 4; i++) fbox(f, C(0x5a5f64, 0.5, 0.7), u - 0.42 + i * 0.28, 2.1, 0.04, 0.9, 0.04, 0.04); }
        else if (r < 0.82) fbox(f, E(0xfff0c0, 1.6), u, f.h - 0.8, 0.3, 0.14, 0.2, 0.12), fbox(f, C(0x2a2d31), u, f.h - 0.68, 0.4, 0.08, 0.4);
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.3) box(C(0x9a7a4e), x, 0.55, z, 1.1, 1.1, 0.14, ry, -0.15);
        else if (r < 0.5) sph(C(0xf26a2a, 0.5), x, 0.4, z, 0.8, 0.8, 0.8), box(C(0xf0ede4), x, 0.4, z, 0.82, 0.12, 0.82);
        else if (r < 0.75) sph(C(0x2d4a38, 0.95), x, 0.12, z, rr(1.2, 1.8), 0.3, 0.7);
        else for (let i = 0; i < 2; i++) cyl(pickR([C(0x2f5d8a, 0.5, 0.5), C(0x3e6b3a, 0.5, 0.5)]), x + (i - 0.5) * 0.62, 0.45, z, 0.29, 0.9);
      },
      decals: [[WET(), 1.2, 4], [D(0x2c2a26, 0.35), 0.6, 2], [D(0xf2c230, 0.7), 0.16, 5, !0], [D(0x202428, 0.85), 0.35, 0.6]],
      debris: [C(0x7d7a73), C(0x5c4a3a)],
      back(x, z) {
        const r = R();
        if (r < 0.35) { const ry = rr(0, 3), c = C(0xd0602a, 0.6, 0.5); for (const k of [-6, 6]) box(c, x + Math.cos(ry) * k, 14, z - Math.sin(ry) * k, 1.4, 28, 1.4, ry); box(c, x, 28, z, 16, 1.6, 2.2, ry); box(c, x + Math.sin(ry) * 10, 28, z + Math.cos(ry) * 10, 2, 1.4, 26, ry); }
        else if (r < 0.8) { const w = rr(24, 40), d = rr(14, 20), h = rr(8, 13), ry = Math.round(R()) * Math.PI / 2; box(pickR([C(0x6c7a86), C(0x8a8f96), C(0x7a5a4a)]), x, h / 2, z, w, h, d, ry); box(C(0x4a5058, 0.6, 0.5), x, h + 0.4, z, w + 0.6, 0.8, d + 0.6, ry); }
        else { cyl(C(0xf0ede4), x, 10, z, 2, 20); cyl(C(0xc0302a), x, 12, z, 2.05, 3); sph(E(0xfff0a0, 2.4), x, 21, z, 1.6, 1.6, 1.6); }
      },
    },
    forge: {
      cap: C(0x2b2724, 0.6, 0.6), capGlow: E(0xff6a1a, 1.6), base: C(0x1d1a18, 0.7, 0.5), pil: C(0x3a3430, 0.5, 0.7), pilEvery: 6,
      band: [E(0xff5a10, 1.8), 0.05, 0.5],
      panel(f, u, s) {
        const r = R();
        if (r < 0.32) { const len = Math.min(s - 0.4, 4); const [x, z] = at(f, u, 0.25); cyl(C(0x5a524a, 0.5, 0.8), x, 2.5, z, 0.15, len, f.ry, 0, Math.PI / 2); cyl(C(0x5a524a, 0.5, 0.8), x, 2.1, z, 0.1, len, f.ry, 0, Math.PI / 2); }
        else if (r < 0.55) { fbox(f, C(0x151210), u, 0.55, 1.1, 0.55, 0.05); for (let i = 0; i < 4; i++) fbox(f, E(0xff5a10, 1.5), u, 0.36 + i * 0.13, 0.96, 0.05, 0.02, 0.05); }
        else if (r < 0.7) fcyl(f, C(0xe8e3d4, 0.5), u, 1.8, 0.16, 0.06, 0.02), fcyl(f, C(0x5a524a, 0.5, 0.8), u, 1.3, 0.04, 1, 0.06);
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.4) { for (let i = 0; i < 6; i++) box(C(0xc98a3a, 0.35, 0.8), x + (i % 3 - 1) * 0.28, 0.08 + (i / 3 | 0) * 0.16, z, 0.24, 0.14, 0.4, ry); }
        else if (r < 0.7) sph(C(0x1b1816, 0.9), x, 0.1, z, rr(1, 1.8), rr(0.35, 0.6), rr(0.8, 1.1)), sph(E(0xff4a10, 1.2), x, 0.15, z, 0.3, 0.2, 0.3);
        else box(C(0x3a3430, 0.5, 0.7), x, 0.5, z, 1.1, 1, 0.3, ry), box(C(0x6a625a, 0.4, 0.8), x, 0.7, z, 0.9, 0.05, 0.35, ry);
      },
      decals: [[D(0x0b0908, 0.55), 1, 3], [E(0xff4a10, 1.7), 0.05, 1.1, !0, 0.35]],
      debris: [C(0x2a2522, 0.8), C(0x4a3a30, 0.8)],
      back(x, z) {
        const r = R();
        if (r < 0.4) { const h = rr(26, 44); cyl(C(0x2b2724, 0.7, 0.4), x, h / 2, z, rr(1.6, 2.6), h); cyl(E(0xff5a10, 1.4), x, h - 2, z, 2.8, 0.8); }
        else if (r < 0.65) { put(G.cone, C(0x2a1612, 0.95), x, 16, z, rr(50, 80), 32, rr(50, 80)); sph(E(0xff3a0a, 1.4), x, 32, z, 8, 2, 8); }
        else { const w = rr(20, 36), h = rr(10, 20), d = rr(16, 24); box(C(0x221e1b, 0.7, 0.5), x, h / 2, z, w, h, d); box(E(0xff7a2a, 0.9), x, h * 0.7, z, w + 0.1, 0.6, d + 0.1); }
      },
    },
    jungle: {
      cap: null, base: C(0x5e5a4c, 0.95), pil: C(0x8a8570, 0.95), pilEvery: 6.5, pilW: 0.7,
      band: [C(0x6d6a58, 0.95), 0.25, 0.8],
      panel(f, u, s) {
        const r = R();
        if (r < 0.45) for (let i = 0; i < 2 + Math.floor(R() * 3); i++) { const len = rr(0.8, Math.min(3.2, f.h - 0.3)); fbox(f, C(0x2f4a22, 0.9), u + rr(-1, 1), f.h - len / 2, 0.08, len, 0.05); }
        else if (r < 0.62) fbox(f, C(0x4a4739, 0.95), u, 1.7, 1, 1, 0.05), fbox(f, C(0x9c977f, 0.95), u, 1.7, 0.5, 0.5, 0.02, 0.05);
        else if (r < 0.8) fbox(f, C(0x4d6a2c, 0.95), u, rr(0.5, f.h - 0.5), rr(0.8, 1.8), rr(0.5, 1.2), 0.03);
      },
      top(w) {
        const a = w.w >= w.d, L = a ? w.w : w.d;
        for (let u = -L / 2; u < L / 2 - 0.4; u += rr(0.8, 2.2)) {
          const len = rr(0.6, 2.2);
          box(C(0x4f6b2e, 0.95), w.x + (a ? u + len / 2 : 0), w.h + 0.12, w.z + (a ? 0 : u + len / 2), a ? len : w.w + 0.2, rr(0.1, 0.3), a ? w.d + 0.2 : len);
        }
      },
      clutter(x, z, ry) {
        const r = R();
        if (r < 0.45) for (let i = 0; i < 3; i++) put(G.cone, C(0x3f6a2a, 0.9), x + rr(-0.4, 0.4), 0.35, z + rr(-0.1, 0.1), rr(0.6, 0.9), rr(0.6, 0.9), rr(0.3, 0.5), rr(0, 3), rr(-0.3, 0.3));
        else if (r < 0.7) for (let i = 0; i < 3; i++) put(G.rock, C(0x7a7766, 0.95), x + rr(-0.5, 0.5), 0.15, z, rr(0.3, 0.6), rr(0.25, 0.4), rr(0.3, 0.5), rr(0, 3));
        else for (let i = 0; i < 4; i++) { const cx = x + rr(-0.4, 0.4); cyl(C(0xe8e0cc), cx, 0.08, z, 0.03, 0.16); sph(pickR([C(0xc0392b, 0.6), C(0xc9a26a, 0.7)]), cx, 0.18, z, 0.16, 0.08, 0.16); }
      },
      decals: [[D(0x6b5230, 0.45), 1, 3], [D(0x3a2e20, 0.4), 0.8, 2]],
      debris: [C(0x6b6858), C(0x4a5a30)],
      back(x, z) {
        const r = R();
        if (r < 0.6) { const h = rr(16, 30); cyl(C(0x4a3626, 0.95), x, h / 2, z, rr(0.8, 1.4), h); sph(pickR([C(0x2a4a1f, 0.95), C(0x355a26, 0.95)]), x, h, z, rr(14, 22), rr(9, 14), rr(14, 22)); }
        else box(C(0x5a6452, 0.95), x, 0, z, rr(30, 50), rr(20, 40), rr(20, 40), rr(0, 3));
      },
    },
  };

  let _win = null;
  function winMat() {
    if (_win) return _win;
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#07080d";
    g.fillRect(0, 0, 64, 256);
    let q = 99;
    for (let y = 4; y < 256; y += 8)
      for (let x = 3; x < 64; x += 8) {
        const v = ((q = (q * 16807) % 2147483647) - 1) / 2147483646;
        g.fillStyle = v < 0.5 ? "#0c0f18" : v < 0.8 ? "#ffd28a" : v < 0.92 ? "#8fd8ff" : "#ff6ab0";
        g.fillRect(x, y, 5, 4);
      }
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    tx.magFilter = T.NearestFilter;
    return (_win = { color: 0x0a0b10, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.6 });
  }

  // ── build ──
  function build(key) {
    built.forEach((m) => scene.remove(m));
    built.length = 0;
    const K = KITS[MAP.theme || key];
    if (!K || !MAP.walls) return;
    seed = 1;
    for (const ch of String(key)) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    seed = seed || 7;
    const Q = typeof GFX === "undefined" ? 1 : GFX.lamps <= 0 ? 0.45 : GFX.lamps <= 3 ? 0.7 : 1;
    const bd = MAP.bounds;
    for (const w of MAP.walls) {
      if (w.h < 0.35) continue;
      const tall = w.h >= 1.6 && !w.cover;
      // coping and plinth
      if (K.giwa && tall) giwaCap(w, K.giwa[0], K.giwa[1]);
      else if (K.cap) box(K.cap, w.x, w.h + 0.07, w.z, w.w + 0.16, 0.14, w.d + 0.16);
      K.capGlow && tall && box(K.capGlow, w.x, w.h + 0.155, w.z, w.w + 0.17, 0.03, w.d + 0.17);
      if (!tall) continue;
      const bh = K.baseH || 0.32;
      K.base && box(K.base, w.x, bh / 2, w.z, w.w + 0.14, bh, w.d + 0.14);
      K.top && K.top(w);
      if (w.window) continue;
      for (const f of facesOf(w)) {
        if (f.L < 2.5) continue;
        // pilasters split the face into bays
        const n = Math.max(1, Math.round(f.L / (K.pilEvery || 6))),
          bay = f.L / n;
        for (let i = 0; i <= n; i++) {
          const u = -f.L / 2 + i * bay;
          const uu = Math.max(-f.L / 2 + 0.3, Math.min(f.L / 2 - 0.3, u));
          if (!openAt(f, uu)) continue;
          if (K.pilRound) fcyl(f, K.pilRound, uu, f.h / 2, 0.22, f.h, 0.0);
          else if (K.pil) fbox(f, K.pil, uu, f.h / 2, K.pilW || 0.45, f.h, 0.14);
          K.pilGlow && fbox(f, K.pilGlow, uu, f.h / 2, 0.06, f.h - 0.6, 0.02, 0.14);
        }
        if (K.band) fbox(f, K.band[0], 0, K.band[2] < 0 ? f.h + K.band[2] : f.h * K.band[2], f.L, K.band[1], 0.06);
        if (K.band2) fbox(f, K.band2[0], 0, f.h + K.band2[2], f.L, K.band2[1], 0.07);
        for (let i = 0; i < n; i++) {
          const u = -f.L / 2 + (i + 0.5) * bay;
          if (R() > 0.85 * Q + 0.1 || !openAt(f, u)) continue;
          K.panel(f, u, bay);
        }
        // clutter against the face: within the player radius, so never in the way
        const cn = Math.round((f.L / 6) * Q);
        for (let i = 0; i < cn; i++) {
          const u = rr(-f.L / 2 + 1, f.L / 2 - 1);
          if (!openAt(f, u, 0.35) || R() < 0.35) continue;
          const [x, z] = at(f, u, 0.32);
          K.clutter(x, z, f.ry);
        }
      }
    }
    // floor decals and debris
    const area = (bd.maxX - bd.minX) * (bd.maxZ - bd.minZ);
    const freeFloor = (x, z) => !collideXZ(x, z, 0.02, 0.6);
    for (const [m, a, b, stripe, dens] of Q < 0.5 ? [] : K.decals || []) {
      const n = Math.round((area / (stripe ? 1600 : 700)) * Q * (dens || 1));
      for (let i = 0; i < n; i++) {
        const x = rr(bd.minX + 2, bd.maxX - 2),
          z = rr(bd.minZ + 2, bd.maxZ - 2);
        if (!freeFloor(x, z)) continue;
        if (stripe) {
          const ang = Math.round(R() * 2) * (Math.PI / 2);
          put(G.plane, m, x, 0.025, z, a, 1, b, ang);
        } else {
          const s = rr(a, b);
          put(G.blob, m, x, 0.018 + R() * 0.004, z, s * rr(0.6, 1.4), 1, s, rr(0, 3));
        }
      }
    }
    const dn = Math.round((area / 260) * Q);
    for (let i = 0; i < dn && K.debris && Q >= 0.5; i++) {
      const x = rr(bd.minX + 1, bd.maxX - 1),
        z = rr(bd.minZ + 1, bd.maxZ - 1);
      if (!freeFloor(x, z)) continue;
      const s = rr(0.08, 0.28);
      put(G.rock, pickR(K.debris), x, s * 0.25, z, s, s * 0.6, s * rr(0.7, 1.3), rr(0, 3));
    }
    // skyline outside the play area
    if (K.back) {
      const sides = [
        [bd.minX, bd.maxX, (t) => [t, bd.minZ], [0, -1]],
        [bd.minX, bd.maxX, (t) => [t, bd.maxZ], [0, 1]],
        [bd.minZ, bd.maxZ, (t) => [bd.minX, t], [-1, 0]],
        [bd.minZ, bd.maxZ, (t) => [bd.maxX, t], [1, 0]],
      ];
      for (const [a, b, P, [nx, nz]] of sides)
        for (let t = a - 30; t < b + 30; t += rr(16, 30)) {
          const [x0, z0] = P(t),
            d = rr(26, 70);
          K.back(x0 + nx * d, z0 + nz * d);
        }
    }
    flush();
    window.MAP_DETAIL = { key, meshes: built.length, instances: built.reduce((s, m) => s + m.count, 0) };
  }

  const _lm = loadMap;
  loadMap = function (key) {
    const r = _lm.apply(this, arguments);
    try {
      r !== !1 && build(key);
    } catch (e) {
      console.warn("detail", e);
    }
    return r;
  };
  try {
    CUR_MAP_KEY && build(CUR_MAP_KEY);
  } catch (e) {}
})();
