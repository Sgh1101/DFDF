
(() => {
  // A look for every agent. Twenty-two of the thirty-six shared one body (a
  // round torso, box hips, no hair) told apart only by colour and one small
  // piece. Each now gets a whole outfit drawn from what it does: hair or
  // headwear, top, legs, something on the back and one signature piece you can
  // pick out at a distance (the wind duelist's long scarf, the spider's legs,
  // the falcon on the hunter's shoulder...). The body under the clothes is
  // shaped too: one smooth head with a jaw, eyes with whites and a nose, a
  // chest that narrows to the waist, round hips, joints, boots and gloves.
  // Everything is added inside the outfit hook, before the body is baked, so a
  // character is still one mesh per body part.
  if ("function" != typeof buildFighter || "undefined" == typeof CH_OUTFIT || "function" != typeof chMat || !window.AGENTS) return;
  const PI = Math.PI;
  const HX = (c) => ("string" == typeof c ? parseInt(c.replace("#", ""), 16) : c);
  // k < 1 darkens, k > 1 mixes toward white
  const tone = (c, k) => {
    const o = new T.Color(HX(c));
    return (k >= 1 ? o.lerp(new T.Color(0xffffff), Math.min(1, k - 1)) : o.multiplyScalar(k)).getHex();
  };
  const mixc = (a, b, t) => new T.Color(HX(a)).lerp(new T.Color(HX(b)), t).getHex();
  const M = (c, k) => chMat(HX(c), k || "cloth");
  const GL = (c, i) => chGlow(HX(c), i || 1.4);
  const UP = new T.Vector3(0, 1, 0);

  // ── shapes the shared set lacks (cached the same way) ──
  // a surface seen from both sides: the shape plus a copy turned inside out,
  // pulled in by k (open shapes like hoods, sleeves and skirts otherwise vanish
  // when you look into them)
  const shell = (key, make, k) =>
    chGeo("lk_" + key, () => {
      const g0 = make(),
        g = g0.index ? g0.toNonIndexed() : g0;
      const P = g.attributes.position.array,
        N = g.attributes.normal.array,
        n = P.length;
      const pos = new Float32Array(2 * n),
        nor = new Float32Array(2 * n);
      pos.set(P);
      nor.set(N);
      for (let i = 0; i < n; i += 9)
        for (let j = 0; j < 3; j++) {
          const s = i + [0, 2, 1][j] * 3,
            d = n + i + j * 3;
          for (let a = 0; a < 3; a++) {
            pos[d + a] = P[s + a] * k[a];
            nor[d + a] = -N[s + a];
          }
        }
      const o = new T.BufferGeometry();
      o.setAttribute("position", new T.BufferAttribute(pos, 3));
      o.setAttribute("normal", new T.BufferAttribute(nor, 3));
      o.computeBoundingSphere();
      return o;
    });
  // open cylinder or cone (gap: an opening at the front, in radians)
  const gOC = (rt, rb, h, seg, gap) =>
    shell(`oc${rt},${rb},${h},${seg},${gap || 0}`, () => new T.CylinderGeometry(rt, rb, h, seg || 16, 1, !0, gap ? PI + gap / 2 : 0, gap ? 2 * PI - gap : 2 * PI), [0.93, 1, 0.93]);
  const gArc = (R, r, arc, ts) => chGeo(`lk_arc${R},${r},${arc},${ts}`, () => new T.TorusGeometry(R, r, 6, ts || 20, arc));
  // part of a sphere (masks, plates)
  const gSeg = (r, ps, pl, ts, tl) => shell(`seg${r},${ps},${pl},${ts},${tl}`, () => new T.SphereGeometry(r, 16, 10, ps, pl, ts, tl), [0.93, 0.93, 0.93]);
  // pull every other point of the last row of a grid halfway back: a pointed edge
  const zig = (g, cols, rows) => {
    const p = g.attributes.position,
      row = cols + 1;
    for (let ix = 1; ix < cols; ix += 2) {
      const i = rows * row + ix,
        j = (rows - 1) * row + ix;
      p.setXYZ(i, (p.getX(i) + p.getX(j)) / 2, (p.getY(i) + p.getY(j)) / 2, (p.getZ(i) + p.getZ(j)) / 2);
    }
    g.computeVertexNormals();
    return g;
  };
  // a hood open at the face
  const gHood = () => shell("hood", () => new T.SphereGeometry(0.5, 18, 12, 1.5 * PI + 0.85, 2 * PI - 1.7, 0, 0.76 * PI), [0.93, 0.93, 0.93]);
  // bangs over the forehead (w: how far round, z: pointed ends)
  const gBang = (w, z) =>
    shell(`bang${w},${z}`, () => {
      const g = new T.SphereGeometry(0.5, 14, 4, 1.5 * PI - w / 2, w, 0.1 * PI, 0.27 * PI);
      return z ? zig(g, 14, 4) : g;
    }, [0.9, 0.9, 0.9]);
  // hair that hangs as a curtain round the back (arc: how far round)
  const gCurtain = (rt, rb, h, arc) =>
    shell(`cur${rt},${rb},${h},${arc}`, () => zig(new T.CylinderGeometry(rt, rb, h, 18, 2, !0, -arc / 2, arc), 18, 2), [0.9, 1, 0.9]);
  // one smooth head: a jaw that narrows to the chin, the back of the skull
  // tucked in over the nape, a flatter face. Same size as the old ball.
  // round: no flatter face or fuller skull, so headgear made for the old ball still fits
  const gHead = (round) =>
    chGeo("lk_head" + (round ? "r" : ""), () => {
      const g = new T.SphereGeometry(1, 24, 18),
        p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        if (y < 0) {
          const t = -y;
          x *= 1 - 0.2 * t * t;
          z *= z > 0 ? 1 - 0.38 * Math.pow(t, 1.4) : 1 - 0.03 * t;
        } else if (z > 0 && !round) z *= 1 + 0.06 * y;
        // the face flattens; above the brow it fades back to round
        const f = round ? 0 : y < 0.3 ? 1 : y > 0.7 ? 0 : 1 - (y - 0.3) / 0.4;
        if (z < 0 && f) z = -Math.pow(-z, 1 - 0.38 * f);
        // the old ball had fewer sides: its flats sit inside the true sphere, so the
        // round head is a touch smaller to stay under hair and hats made for it
        const k = round ? 0.975 : 1;
        p.setXYZ(i, x * 0.1086 * k, y * 0.1274 * k, z * 0.118 * k);
      }
      g.computeVertexNormals();
      // the seam and the poles: one normal per point
      const nr = g.attributes.normal,
        key = (i) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`,
        same = new Map();
      for (let i = 0; i < p.count; i++) {
        const k = key(i);
        same.has(k) ? same.get(k).push(i) : same.set(k, [i]);
      }
      for (const L of same.values()) {
        if (L.length < 2) continue;
        let a = 0,
          b = 0,
          c = 0;
        L.forEach((i) => ((a += nr.getX(i)), (b += nr.getY(i)), (c += nr.getZ(i))));
        const l = Math.hypot(a, b, c) || 1;
        L.forEach((i) => nr.setXYZ(i, a / l, b / l, c / l));
      }
      return g;
    });
  // a piece from a to b: geo(L) is built along y with length L
  const bar = (add, parent, a, b, geo, mat, o) => {
    const A = new T.Vector3(a[0], a[1], a[2]),
      B = new T.Vector3(b[0], b[1], b[2]),
      d = B.clone().sub(A);
    const m = add(parent, geo(+d.length().toFixed(3)), mat, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, o || null);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    return m;
  };
  const rod = (add, parent, a, b, r, mat, sh) => bar(add, parent, a, b, (L) => G_CYL(r, r, L, 8), mat, sh ? { sh: 1 } : null);
  // a frame to build a prop in; flatten() puts its pieces back on the body part
  // so the bake still merges them into that part's one mesh
  const sub = (parent, p, r) => {
    const g = new T.Group();
    g.userData.lkSub = 1;
    g.position.set(p[0], p[1], p[2]);
    r && g.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0);
    parent.add(g);
    return g;
  };
  const flatten = (G) => {
    for (const g of G.children.slice()) {
      if (!g.userData.lkSub) continue;
      g.updateMatrix();
      for (const m of g.children.slice()) {
        m.updateMatrix();
        m.matrix.premultiply(g.matrix);
        m.matrix.decompose(m.position, m.quaternion, m.scale);
        G.add(m);
      }
      G.remove(g);
    }
  };

  // ── the body under the clothes ──
  function body(x, D) {
    const { add, S, O, hips, chest, neck, legL, legR, armL, armR } = x,
      w = S.w || 1,
      b = S.bulk || 1;
    const drop = (g, f) => g.children.filter((c) => c.isMesh && f(c)).forEach((c) => g.remove(c));
    // the round torso (capsule + ball + shoulder bar) and the box pelvis go
    drop(chest, (c) => c.material === O.top && c.position.y > 0.05 && c.position.y < 0.4);
    drop(hips, (c) => c.material === O.pants && "BoxGeometry" === c.geometry.type);
    // ribcage narrowing to the waist, rounded chest and shoulders, a waist into the hips
    add(chest, G_CYL(0.19 * w, 0.148 * w, 0.3, 16), O.top, 0, 0.19, 0, { s: [1, 1, 0.66], sh: 1 });
    add(chest, G_SPH(0.5, 16, 10), O.top, 0, 0.335, 0, { s: [0.41 * w, 0.17, 0.26], sh: 1 });
    add(chest, G_CYL(0.148 * w, 0.158 * w, 0.2, 16), O.top, 0, -0.02, 0, { s: [1, 1, 0.7] });
    // the slope from the neck to the shoulders
    add(chest, G_SPH(0.5, 14, 8), O.top, 0, 0.41, 0.015, { s: [0.33 * w, 0.12, 0.21] });
    neck.position.y -= 0.015;
    add(hips, G_SPH(0.5, 14, 9), O.pants, 0, -0.015, 0, { s: [0.35 * w, 0.24, 0.25], sh: 1 });
    face(x, D.face || "full");
    const dk = M(0x1d2026, "rubber");
    for (const L of [legL, legR]) {
      add(L.leg, G_SPH(0.086 * b, 10, 8), O.pants, 0, -0.02, 0);
      add(L.shin, G_SPH(0.07 * b, 10, 8), O.pants, 0, 0.005, 0);
      if (!D.noBoots) {
        add(L.shin, G_SPH(0.5, 10, 8), O.boot, 0, -0.372, -0.13, { s: [0.122, 0.085, 0.13] });
        add(L.shin, G_CYL(0.078, 0.082, 0.05, 10), D.cuff ? M(D.cuff, "leather") : dk, 0, -0.245, 0);
      }
    }
    for (const A of [armL, armR]) {
      add(A.fore, G_SPH(0.058 * b, 10, 8), O.sleeve, 0, 0, 0);
      if (!D.bareHands) {
        add(A.fore, G_BOX(0.072, 0.056, 0.042), O.hand, 0, -0.312, -0.014, { r: [0.35, 0, 0] });
        add(A.fore, G_CYL(0.057 * b, 0.057 * b, 0.03, 10), dk, 0, -0.19, 0);
      }
    }
  }

  // the old ball head, jaw ball, box nose and dot eyes give way to one head and a face
  const OLD_HEAD = () => [G_SPH(0.118, 14, 12), G_SPH(0.09), G_BOX(0.022, 0.045, 0.03), G_SPH(0.026, 6, 5), G_SPH(0.017, 7, 6), G_BOX(0.046, 0.012, 0.015), G_BOX(0.042, 0.008, 0.01), G_CYL(0.058, 0.066, 0.12, 9)];
  // what: "full", "eyes" (a mask covers nose and mouth), "mouth" (goggles cover
  // the eyes) or "none" (the head is covered); keep: old pieces to leave
  function face(x, what, round, keep) {
    const { add, S, O, neck } = x;
    const old = new Set(OLD_HEAD());
    keep && keep.forEach((g) => old.delete(g));
    neck.children.filter((c) => c.isMesh && old.has(c.geometry)).forEach((c) => neck.remove(c));
    const sk = O.skin,
      sk2 = M(tone(S.skin, 0.84), "skin");
    add(neck, gHead(round), sk, 0, 0.22, -0.005, { sh: 1 });
    add(neck, G_CYL(0.06, 0.07, 0.17, 12), sk, 0, 0.035, 0.005);
    [-1, 1].forEach((s) => add(neck, G_SPH(0.5, 8, 6), sk2, s * 0.104, 0.214, 0.006, { s: [0.026, 0.056, 0.04] }));
    if (what === "none") return;
    if (what !== "mouth") eyes(x);
    if (what === "eyes") return;
    add(neck, G_SPH(0.5, 10, 8), sk, 0, 0.201, -0.121, { s: [0.026, 0.05, 0.033], r: [0.35, 0, 0] });
    add(neck, G_BOX(0.05, 0.009, 0.012), M(mixc(S.skin, 0x5e1c1c, 0.55), "skin"), 0, 0.153, -0.113);
  }
  function eyes({ add, S, neck }) {
    // eyes sit on the curve of the face: each turns out by 0.31 rad
    const Wm = M(0xf4f1ec, "skin"),
      Im = M(S.eye, "glass"),
      Pm = M(0x0d0b0a, "paint"),
      Lm = M(0x1a1412, "paint"),
      Bm = M(tone(S.hair, 0.85), "hair");
    [-1, 1].forEach((s) => {
      const r = [0, -s * 0.31, 0];
      add(neck, G_SPH(0.5, 12, 8), Wm, s * 0.042, 0.236, -0.1205, { s: [0.05, 0.03, 0.016], r });
      add(neck, G_SPH(0.5, 10, 8), Im, s * 0.0438, 0.236, -0.1262, { s: [0.026, 0.026, 0.008], r });
      add(neck, G_SPH(0.5, 8, 6), Pm, s * 0.0446, 0.236, -0.129, { s: [0.011, 0.011, 0.005], r });
      add(neck, G_SPH(0.0032, 5, 4), GL(0xffffff, 0.7), s * 0.0446 - 0.004, 0.2415, -0.1325);
      add(neck, G_BOX(0.054, 0.007, 0.012), Lm, s * 0.0425, 0.2515, -0.124, { r: [0.2, -s * 0.31, -s * 0.06] });
      add(neck, G_BOX(0.052, 0.012, 0.014), Bm, s * 0.044, 0.268, -0.118, { r: [0.25, -s * 0.31, -s * 0.12] });
    });
  }

  // ── hair ──
  const HAIR = {
    // close cap over the top and back of the head
    cap({ add, neck }, c) {
      add(neck, G_HSPH(0.5, 0.56), M(c, "hair"), 0, 0.232, 0.01, { s: [0.234, 0.276, 0.262], r: [0.42, 0, 0] });
    },
    // bangs that follow the forehead (zig: pointed, tilt: swept to one side)
    bang({ add, neck }, c, o) {
      o = o || {};
      add(neck, gBang(o.w || 1.9, o.zig ? 1 : 0), M(c, "hair"), o.x || 0, 0.222, -0.004, { s: [0.244, 0.284, 0.268], r: [0, 0, o.tilt || 0] });
    },
    // hair down round the back of the head (len below the crown)
    back({ add, neck }, c, o) {
      o = o || {};
      const L = o.len || 0.26;
      add(neck, gCurtain(0.124, o.flare || 0.15, L, o.arc || 3.9), M(c, "hair"), 0, 0.27 - L / 2, 0.004, { s: [1, 1, 1.02], sh: 1 });
    },
    // a fall down the back of the body
    fall({ add, chest }, c, o) {
      o = o || {};
      const L = o.len || 0.5;
      add(chest, gCurtain(0.13, o.flare || 0.15, L, 2.2), M(c, "hair"), 0, 0.5 - L / 2, o.z || 0.06, { s: [1, 1, 0.9], sh: 1 });
    },
    short(x, c, o) {
      HAIR.cap(x, c);
      HAIR.bang(x, c, o);
    },
    long(x, c, o) {
      HAIR.cap(x, c);
      HAIR.bang(x, c, o);
      HAIR.back(x, c, { len: 0.3 });
    },
    // to the waist
    longer(x, c, o) {
      HAIR.long(x, c, o);
      HAIR.fall(x, c, { len: 0.52, z: o && o.over ? 0.115 : 0.06, flare: o && o.over ? 0.17 : 0.15 });
    },
    ponytail(x, c, o) {
      HAIR.short(x, c, o);
      const m = M(c, "hair");
      x.add(x.neck, G_TOR(0.028, 0.011, 6, 12), M((o && o.tie) || 0x2b2f36, "leather"), 0, 0.295, 0.128, { r: [1.0, 0, 0] });
      x.add(x.neck, G_SPH(0.04, 10, 8), m, 0, 0.29, 0.14);
      bar(x.add, x.neck, [0, 0.29, 0.15], [0, 0.02, 0.22], (L) => G_CONE(0.04, L, 8), m, { sh: 1 });
    },
    bun(x, c) {
      HAIR.short(x, c);
      x.add(x.neck, G_SPH(0.055, 10, 8), M(c, "hair"), 0, 0.3, 0.12);
    },
    topknot(x, c) {
      HAIR.cap(x, c);
      x.add(x.neck, G_CYL(0.03, 0.036, 0.07, 10), M(c, "hair"), 0, 0.375, 0.0);
      x.add(x.neck, G_CYL(0.005, 0.005, 0.12, 6), M(0xd4af37, "metal"), 0, 0.38, 0, { r: [0, 0, PI / 2] });
    },
    // swept back as if in a wind
    spiky(x, c) {
      HAIR.cap(x, c);
      const m = M(c, "hair");
      for (let k = -3; k <= 3; k++) {
        const a = k * 0.33,
          f = Math.abs(k);
        const p0 = [Math.sin(a) * 0.075, 0.322 - f * 0.014, -0.045 + f * 0.012];
        bar(x.add, x.neck, p0, [p0[0] + Math.sin(a) * 0.075, p0[1] + 0.05 - f * 0.008, p0[2] + 0.17 - f * 0.012], (L) => G_CONE(0.038, L, 5), m);
      }
      for (let k = -2; k <= 2; k++) {
        const a = k * 0.45;
        const p0 = [Math.sin(a) * 0.09, 0.25, 0.07];
        bar(x.add, x.neck, p0, [p0[0] + Math.sin(a) * 0.05, p0[1] - 0.02, p0[2] + 0.14], (L) => G_CONE(0.034, L, 5), m);
      }
      HAIR.bang(x, c, { w: 1.5, zig: 1, tilt: 0.12 });
    },
    mohawk(x, c, o) {
      const { add, neck } = x;
      add(neck, G_HSPH(0.5, 0.5), M(tone(c, 0.6), "hair"), 0, 0.235, 0.012, { s: [0.226, 0.262, 0.248], r: [0.4, 0, 0] });
      const m = o && o.glow ? GL(o.glow, 1.6) : M(c, "hair");
      for (let i = 0; i < 7; i++) {
        const a = -0.55 + i * 0.4,
          p0 = [0, 0.232 + Math.cos(a) * 0.128, 0.01 + Math.sin(a) * 0.122],
          L = 0.13 - Math.abs(i - 2) * 0.014;
        bar(add, neck, p0, [0, p0[1] + Math.cos(a + 0.35) * L, p0[2] + Math.sin(a + 0.35) * L], (q) => G_CONE(0.03, q, 5), i % 2 ? M(c, "hair") : m);
      }
    },
    mane(x, c) {
      HAIR.cap(x, c);
      HAIR.bang(x, c, { zig: 1 });
      HAIR.back(x, c, { len: 0.32, flare: 0.17 });
      const m = M(c, "hair");
      for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * 2.6,
          p0 = [Math.sin(a) * 0.11, 0.2 - Math.abs(a) * 0.02, 0.03 + Math.cos(a) * 0.08];
        bar(x.add, x.neck, p0, [p0[0] + Math.sin(a) * 0.09, p0[1] - 0.17, p0[2] + Math.cos(a) * 0.1], (L) => G_CONE(0.045, L, 5), m);
      }
    },
    bob(x, c) {
      HAIR.cap(x, c);
      HAIR.back(x, c, { len: 0.15, flare: 0.14, arc: 4.3 });
      HAIR.bang(x, c, { w: 2.1 });
    },
    buzz({ add, neck }, c) {
      add(neck, G_HSPH(0.5, 0.52), M(c, "hair"), 0, 0.232, 0.008, { s: [0.224, 0.262, 0.246], r: [0.38, 0, 0] });
    },
    braid(x, c) {
      HAIR.short(x, c, { w: 1.7 });
      const m = M(c, "hair");
      for (let i = 0; i < 4; i++) x.add(x.neck, G_SPH(0.034, 8, 6), m, 0.085 + i * 0.006, 0.18 - i * 0.055, 0.02 - i * 0.025);
      for (let i = 0; i < 4; i++) x.add(x.chest, G_SPH(0.03, 8, 6), m, 0.1, 0.42 - i * 0.05, -0.1 - i * 0.012);
      x.add(x.chest, G_CYL(0.022, 0.034, 0.05, 8), M(0x81c784), 0.1, 0.2, -0.15);
    },
    // along the jaw and over the lip; the mouth stays clear
    beard({ add, neck }, c) {
      const m = M(c, "hair");
      add(neck, G_SPH(0.5, 12, 8), m, 0, 0.118, -0.082, { s: [0.12, 0.095, 0.09] });
      [-1, 1].forEach((s) => add(neck, G_SPH(0.5, 10, 8), m, s * 0.074, 0.15, -0.045, { s: [0.05, 0.12, 0.1], r: [0, 0, s * 0.25] }));
      add(neck, G_SPH(0.5, 10, 6), m, 0, 0.17, -0.117, { s: [0.085, 0.022, 0.03] });
    },
  };

  // ── on the head ──
  const HEAD = {
    goggles({ add, neck }, c) {
      const f = M(0x2a2d33, "rubber");
      add(neck, G_TOR(0.122, 0.011, 4, 22), f, 0, 0.31, 0.006, { r: [PI / 2 - 0.16, 0, 0], s: [0.94, 1, 1] });
      [-1, 1].forEach((s) => {
        add(neck, G_CYL(0.036, 0.036, 0.03, 14), f, s * 0.048, 0.322, -0.1, { r: [PI / 2 - 0.55, 0, 0] });
        add(neck, G_CYL(0.028, 0.028, 0.034, 14), GL(c, 1.25), s * 0.048, 0.322, -0.1, { r: [PI / 2 - 0.55, 0, 0] });
      });
    },
    // a hood open at the face, falling into a cowl round the neck
    hood({ add, neck, chest }, c, o) {
      const m = M(c, (o && o.kind) || "cloth");
      add(neck, gHood(), m, 0, 0.236, 0.012, { s: [0.29, 0.33, 0.31], sh: 1 });
      add(chest, gOC(0.096, 0.19, 0.17, 18), m, 0, 0.44, 0.012, { s: [1, 1, 0.86], sh: 1 });
      o && o.point && bar(add, neck, [0, 0.33, 0.12], [0, 0.4, 0.27], (L) => G_CONE(0.07, L, 7), m, { sh: 1 });
    },
    // lower-face mask
    mask({ add, neck }, c) {
      add(neck, gSeg(0.125, PI, PI, PI * 0.5, PI * 0.3), M(c), 0, 0.22, 0.0, { s: [0.98, 1.08, 1.1] });
    },
    helmetOpen({ add, neck }, c, o) {
      const m = M(c, "metal");
      add(neck, G_HSPH(0.5, 0.56), m, 0, 0.228, 0.008, { s: [0.252, 0.3, 0.27], r: [0.22, 0, 0], sh: 1 });
      [-1, 1].forEach((s) => add(neck, G_BOX(0.022, 0.1, 0.08), m, s * 0.112, 0.19, -0.04));
      add(neck, G_BOX(0.02, 0.045, 0.2), m, 0, 0.36, 0.02);
      o && o.crest && add(neck, G_BOX(0.026, 0.09, 0.24), M(o.crest), 0, 0.4, 0.04, { sh: 1 });
    },
    greatHelm({ add, neck }, c, o) {
      const m = M(c, "metal");
      add(neck, G_CYL(0.138, 0.13, 0.25, 16), m, 0, 0.215, 0, { sh: 1 });
      add(neck, G_HSPH(0.138, 0.5), m, 0, 0.34, 0);
      add(neck, G_BOX(0.16, 0.02, 0.02), GL(o.eye, 1.2), 0, 0.245, -0.134);
      add(neck, G_BOX(0.014, 0.2, 0.02), m, 0, 0.2, -0.14);
      if (o.trim) add(neck, G_TOR(0.135, 0.008, 4, 24), M(o.trim, "paint"), 0, 0.1, 0, { r: [PI / 2, 0, 0] });
      if (o.horns)
        [-1, 1].forEach((s) => {
          add(neck, G_CONE(0.045, 0.16, 7), M(o.horns, "paint"), s * 0.17, 0.33, 0, { r: [0, 0, -s * 1.2] });
          add(neck, G_CONE(0.03, 0.14, 7), M(o.horns, "paint"), s * 0.24, 0.42, 0, { r: [0, 0, -s * 0.25] });
        });
    },
    hardhat({ add, neck }, c, o) {
      const m = M(c, "paint");
      add(neck, G_HSPH(0.5, 0.5), m, 0, 0.27, 0.0, { s: [0.262, 0.24, 0.292], sh: 1 });
      add(neck, G_CYL(0.15, 0.15, 0.012, 20), m, 0, 0.272, -0.02, { s: [1, 1, 1.18] });
      add(neck, G_BOX(0.03, 0.03, 0.26), m, 0, 0.385, 0);
      if (o && o.goggles) {
        add(neck, G_BOX(0.17, 0.035, 0.03), M(0x2a2d33, "rubber"), 0, 0.31, -0.118, { r: [-0.4, 0, 0] });
        [-1, 1].forEach((s) => add(neck, G_CYL(0.028, 0.028, 0.02, 12), GL(o.goggles, 1), s * 0.045, 0.312, -0.132, { r: [PI / 2 - 0.4, 0, 0] }));
      }
    },
    gat({ add, neck }, c) {
      const m = M(c, "hair");
      add(neck, G_CYL(0.26, 0.26, 0.006, 30), m, 0, 0.332, 0.0, { sh: 1 });
      add(neck, G_CYL(0.066, 0.08, 0.15, 18), m, 0, 0.41, 0.0, { sh: 1 });
      add(neck, G_CYL(0.081, 0.081, 0.02, 18), M(0x3a2a20, "leather"), 0, 0.345, 0);
      // bead string under the chin
      for (let i = 0; i < 9; i++) {
        const a = PI * (0.15 + 0.7 * (i / 8));
        add(neck, G_SPH(0.009, 6, 4), M(0xd9b77a, "paint"), Math.cos(a) * 0.11, 0.33 - Math.sin(a) * 0.22, -0.06);
      }
    },
    satgat({ add, neck }, c, o) {
      add(neck, G_CONE(0.28, 0.15, 26), M(c, "leather"), 0, 0.385, 0, { sh: 1 });
      add(neck, G_TOR(0.27, 0.008, 4, 28), M(tone(c, 0.7), "leather"), 0, 0.312, 0, { r: [PI / 2, 0, 0] });
      // rain on strings round the brim
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2,
          L = 0.07 + (i % 3) * 0.03;
        add(neck, G_BOX(0.004, L, 0.004), M(0xcfe8ff, "glass"), Math.cos(a) * 0.255, 0.31 - L / 2, Math.sin(a) * 0.255);
        add(neck, G_SPH(0.011, 6, 5), GL(o.drop, 1.2), Math.cos(a) * 0.255, 0.31 - L, Math.sin(a) * 0.255);
      }
    },
    ranger({ add, neck }, c, o) {
      const m = M(c, "leather");
      add(neck, G_CYL(0.215, 0.215, 0.012, 24), m, 0, 0.318, 0.0, { s: [1, 1, 1.08], sh: 1 });
      add(neck, G_CYL(0.092, 0.112, 0.12, 16), m, 0, 0.378, 0.005, { s: [1, 1, 1.12], sh: 1 });
      add(neck, G_CYL(0.114, 0.114, 0.022, 16), M(o.band, "leather"), 0, 0.33, 0.005, { s: [1, 1, 1.12] });
      add(neck, G_BOX(0.05, 0.02, 0.17), M(tone(c, 0.8), "leather"), 0, 0.44, 0.005);
    },
    headphones({ add, neck }, c, o) {
      const m = M(0x22262b, "rubber");
      add(neck, gArc(0.13, 0.013, PI), m, 0, 0.225, 0.0);
      [-1, 1].forEach((s) => {
        add(neck, G_CYL(0.054, 0.054, 0.05, 16), m, s * 0.124, 0.215, 0, { r: [0, 0, PI / 2] });
        add(neck, G_TOR(0.038, 0.008, 4, 18), GL(c, 1.7), s * 0.15, 0.215, 0, { r: [0, PI / 2, 0] });
      });
      if (o && o.mic) {
        rod(add, neck, [-0.13, 0.19, -0.03], [-0.05, 0.15, -0.125], 0.006, m);
        add(neck, G_SPH(0.016, 8, 6), m, -0.045, 0.15, -0.128);
      }
    },
    arVisor({ add, neck }, c) {
      const f = M(0x1d2026, "rubber");
      add(neck, G_TOR(0.122, 0.01, 4, 22), f, 0, 0.255, 0.004, { r: [PI / 2, 0, 0], s: [0.95, 1, 1.06] });
      add(neck, G_BOX(0.12, 0.042, 0.012), GL(c, 0.75), 0.035, 0.243, -0.135, { r: [0, -0.25, 0] });
      add(neck, G_CYL(0.022, 0.022, 0.03, 10), f, 0.115, 0.22, 0, { r: [0, 0, PI / 2] });
    },
    halfMask({ add, neck }, c, o) {
      add(neck, gSeg(0.13, PI, PI * 0.5, PI * 0.22, PI * 0.6), M(c, "paint"), 0, 0.22, 0, { s: [1.0, 1.08, 1.1] });
      add(neck, G_BOX(0.05, 0.012, 0.012), GL(o.glow, 2), 0.045, 0.237, -0.142, { r: [0, -0.35, 0.12] });
      add(neck, G_BOX(0.005, 0.07, 0.006), M(o.line || 0x7b1fa2, "paint"), 0.062, 0.18, -0.136, { r: [0, -0.4, 0] });
    },
    circlet({ add, neck }, c, o) {
      add(neck, G_TOR(0.118, 0.006, 4, 26), M(c, "metal"), 0, 0.285, 0.004, { r: [PI / 2 - 0.2, 0, 0] });
      add(neck, G_SPH(0.016, 8, 6), GL(o.gem, 2.2), 0, 0.27, -0.12);
      for (let i = 0; i < 4; i++) add(neck, G_BOX(0.005, 0.05, 0.005), GL(o.gem, 2), 0, 0.27, -0.122, { r: [0, 0, (i * PI) / 4] });
    },
    crescent({ add, neck }, c) {
      add(neck, gArc(0.08, 0.013, PI * 1.3), GL(c, 1.8), 0, 0.4, 0.02, { r: [0, 0, PI * 0.85] });
      add(neck, G_TOR(0.118, 0.007, 4, 26), M(0xd4af37, "metal"), 0, 0.29, 0.004, { r: [PI / 2 - 0.15, 0, 0] });
    },
    // a wolf's head worn as a hood: brow and muzzle over the forehead, ears, fangs
    wolfHood(x, c, o) {
      HEAD.hood(x, c, { kind: "fur" });
      const { add, neck } = x,
        f = M(c, "fur");
      add(neck, G_SPH(0.5, 12, 9), f, 0, 0.33, -0.1, { s: [0.17, 0.075, 0.17], r: [0.25, 0, 0], sh: 1 });
      add(neck, G_SPH(0.5, 10, 8), M(tone(c, 0.45), "fur"), 0, 0.318, -0.182, { s: [0.05, 0.035, 0.04] });
      [-1, 1].forEach((s) => {
        add(neck, G_CONE(0.05, 0.13, 4), f, s * 0.085, 0.4, 0.03, { r: [0.2, 0, -s * 0.3] });
        add(neck, G_CONE(0.026, 0.08, 4), M(o.inner), s * 0.085, 0.39, 0.012, { r: [0.2, 0, -s * 0.3] });
        add(neck, G_CONE(0.011, 0.045, 5), M(0xf3ead8, "paint"), s * 0.04, 0.282, -0.16, { r: [PI, 0, 0] });
        add(neck, G_SPH(0.011, 6, 5), GL(o.eye || 0xff1744, 2), s * 0.045, 0.352, -0.165);
      });
    },
    wreath({ add, neck }, c, o) {
      add(neck, G_TOR(0.122, 0.011, 4, 22), M(o.vine, "cloth"), 0, 0.3, 0.005, { r: [PI / 2 - 0.15, 0, 0] });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * PI * 2;
        add(neck, G_SPH(0.5, 8, 6), M(c, "cloth"), Math.cos(a) * 0.124, 0.3 + Math.sin(a) * 0.02, Math.sin(a) * 0.124, { s: [0.06, 0.014, 0.034], r: [0.3, -a, 0.5] });
      }
    },
    scarfHead({ add, neck }, c) {
      add(neck, G_HSPH(0.5, 0.54), M(c), 0, 0.235, 0.012, { s: [0.246, 0.276, 0.266], r: [0.32, 0, 0] });
      add(neck, G_SPH(0.032, 8, 6), M(c), 0, 0.25, 0.135);
      [-0.3, 0.25].forEach((r) => add(neck, G_BOX(0.04, 0.12, 0.012), M(c), r * 0.08, 0.18, 0.15, { r: [0.3, 0, r] }));
    },
    aviator({ add, neck }, c, o) {
      const m = M(c, "leather");
      add(neck, G_HSPH(0.5, 0.6), m, 0, 0.228, 0.01, { s: [0.246, 0.282, 0.268], r: [0.28, 0, 0], sh: 1 });
      [-1, 1].forEach((s) => add(neck, G_BOX(0.022, 0.1, 0.07), m, s * 0.112, 0.17, 0.0));
      o.feather && add(neck, G_BOX(0.012, 0.16, 0.04), M(o.feather), 0.11, 0.32, 0.06, { r: [-0.3, 0, -0.5] });
    },
    // the spider's mask: a tight hood, a brow band with six red eyes, a jaw plate
    spider(x, c, o) {
      HEAD.hood(x, c, { kind: "leather" });
      const { add, neck } = x,
        p = M(tone(c, 0.7), "leather");
      add(neck, gSeg(0.125, 1.5 * PI - 0.9, 1.8, PI * 0.28, PI * 0.14), p, 0, 0.22, 0.0, { s: [1.0, 1.1, 1.12] });
      add(neck, gSeg(0.125, PI, PI, PI * 0.52, PI * 0.28), p, 0, 0.22, 0.0, { s: [1.0, 1.1, 1.12] });
      [[-0.058, 0.288], [-0.022, 0.3], [0.022, 0.3], [0.058, 0.288], [-0.036, 0.27], [0.036, 0.27]].forEach(([px, py], i) =>
        add(neck, G_SPH(i < 4 ? 0.008 : 0.011, 8, 6), GL(o.eye, 1.1), px, py, -0.128 + Math.abs(px) * 0.2),
      );
    },
    // respirator with two filters, round green eyes
    gasMask({ add, neck }, c, o) {
      const m = M(c, "rubber");
      add(neck, gSeg(0.124, PI, PI, PI * 0.3, PI * 0.5), m, 0, 0.22, 0.004, { s: [1.02, 1.08, 1.14] });
      [-1, 1].forEach((s) => {
        add(neck, G_CYL(0.03, 0.03, 0.02, 12), GL(o.eye, 1.6), s * 0.045, 0.245, -0.134, { r: [PI / 2, 0, 0] });
        add(neck, G_CYL(0.034, 0.03, 0.05, 12), M(0x5a5f48, "metal"), s * 0.07, 0.15, -0.125, { r: [PI / 2 + 0.6, 0, s * 0.5] });
      });
      add(neck, G_CYL(0.03, 0.036, 0.05, 12), m, 0, 0.165, -0.14, { r: [PI / 2, 0, 0] });
    },
  };

  // ── tops, coats and things on the torso ──
  const TOP = {
    // a jacket over the torso, open at the front over a shirt
    jacket({ add, chest, S }, c, o) {
      const w = S.w || 1,
        m = M(c, o.kind || "cloth");
      add(chest, G_CYL(0.2 * w, 0.158 * w, o.cropped ? 0.24 : 0.36, 16), m, 0, o.cropped ? 0.26 : 0.16, 0, { s: [1, 1, 0.7], sh: 1 });
      add(chest, G_SPH(0.5, 16, 10), m, 0, 0.335, 0, { s: [0.43 * w, 0.18, 0.285] });
      if (o.shirt) add(chest, G_BOX(0.075 * w, o.cropped ? 0.24 : 0.32, 0.01), M(o.shirt), 0, o.cropped ? 0.27 : 0.17, -0.139);
      [-1, 1].forEach((s) => add(chest, G_BOX(0.045, 0.19, 0.012), M(o.lapel || tone(c, 0.75), o.kind || "cloth"), s * 0.055, 0.29, -0.142, { r: [0, 0, s * 0.3] }));
      if (o.collar) add(chest, G_CYL(0.09, 0.1, 0.07, 14), M(o.collar, o.kind || "cloth"), 0, 0.435, 0.0);
      if (o.trim) {
        const t = o.glowTrim ? GL(o.trim, 1.3) : M(o.trim);
        [-1, 1].forEach((s) => add(chest, G_BOX(0.012, o.cropped ? 0.24 : 0.34, 0.012), t, s * 0.042 * w, o.cropped ? 0.26 : 0.16, -0.143));
      }
    },
    // a skirt or coat tails from the waist (o.len: down to the knee ~0.55, the ankle ~0.85)
    skirt({ add, hips, S }, c, o) {
      const w = S.w || 1,
        L = o.len || 0.55;
      add(hips, gOC(0.172 * w, (0.2 + L * 0.12) * w, L, 18, o.open || 0), M(c, o.kind || "cloth"), 0, 0.05 - L / 2, 0, { s: [1, 1, 0.82], sh: 1 });
      if (o.split) add(hips, G_BOX(0.03, L * 0.92, 0.01), M(o.split), 0, 0.05 - L * 0.54, -(0.18 + L * 0.06) * w * 0.82);
      if (o.hem) add(hips, gOC(0.2 * w + L * 0.12 * w + 0.004, (0.205 + L * 0.12) * w + 0.004, 0.03, 18), M(o.hem), 0, 0.05 - L + 0.015, 0, { s: [1, 1, 0.82] });
    },
    belt({ add, hips, S }, c, o) {
      const w = S.w || 1;
      add(hips, G_CYL(0.175 * w, 0.178 * w, (o && o.h) || 0.055, 18), M(c, (o && o.kind) || "leather"), 0, 0.075, 0, { s: [1, 1, 0.78] });
      o && o.buckle && add(hips, G_BOX(0.05, 0.04, 0.012), M(o.buckle, "metal"), 0, 0.075, -0.142);
    },
    sash({ add, hips, S }, c) {
      const w = S.w || 1;
      add(hips, G_CYL(0.178 * w, 0.18 * w, 0.09, 18), M(c), 0, 0.09, 0, { s: [1, 1, 0.8] });
      add(hips, G_BOX(0.05, 0.22, 0.012), M(c), 0.06, -0.04, -0.152, { r: [0, 0, 0.1] });
      add(hips, G_BOX(0.05, 0.18, 0.012), M(c), 0.1, -0.03, -0.146, { r: [0, 0, -0.15] });
    },
    collarV({ add, chest }, c) {
      [-1, 1].forEach((s) => add(chest, G_BOX(0.05, 0.26, 0.012), M(c), s * 0.05, 0.3, -0.142, { r: [0, 0, s * 0.42] }));
    },
    cape({ add, chest, S }, c, o) {
      const w = S.w || 1,
        L = o.len || 0.8;
      add(chest, G_CYL(0.2 * w, 0.215 * w, 0.06, 16), M(o.mantle || c), 0, 0.39, 0.0, { s: [1, 1, 0.75] });
      add(chest, G_BOX(0.42 * w, L, 0.018), M(c), 0, 0.4 - L / 2, 0.165, { r: [0.07, 0, 0], sh: 1 });
      o.inner && add(chest, G_BOX(0.4 * w, L - 0.02, 0.004), M(o.inner), 0, 0.4 - L / 2, 0.154, { r: [0.07, 0, 0] });
      if (o.stars)
        for (let i = 0; i < 14; i++) {
          const v = ((i * 23) % 17) / 17,
            y = 0.33 - v * (L - 0.12);
          add(chest, G_SPH(i % 4 ? 0.007 : 0.012, 6, 5), GL(o.stars, 2), (((i * 37) % 13) / 13 - 0.5) * 0.36 * w, y, 0.176 + (y - (0.4 - L / 2)) * 0.07);
        }
    },
    scarf({ add, chest }, c, o) {
      const m = M(c);
      add(chest, G_TOR(0.1, 0.038, 8, 18), m, 0, 0.43, 0.0, { r: [PI / 2, 0, 0], sh: 1 });
      // two tails streaming back in the wind
      if (o && o.tails)
        [
          [0.04, 0.72, 0.5, 0.09],
          [-0.035, 0.56, 0.62, -0.06],
        ].forEach(([px, len, dn, side]) => {
          const a = [px, 0.42, 0.13],
            b = [px + side, 0.42 - Math.sin(dn) * len, 0.13 + Math.cos(dn) * len];
          bar(add, chest, a, b, (L) => G_BOX(0.075, L, 0.014), m, { sh: 1 });
          o.edge && bar(add, chest, [a[0], a[1], a[2] + 0.004], [b[0], b[1], b[2] + 0.004], (L) => G_BOX(0.08, L, 0.006), GL(o.edge, 1.1));
        });
    },
    ruff({ add, chest }, c) {
      const m = M(c, "fur");
      add(chest, G_TOR(0.16, 0.06, 8, 20), m, 0, 0.405, 0.01, { r: [PI / 2, 0, 0], sh: 1 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        add(chest, G_SPH(0.05, 8, 6), m, Math.cos(a) * 0.19, 0.42 + Math.sin(a * 3) * 0.015, Math.sin(a) * 0.15);
      }
    },
    // a vest round the torso (open: an opening at the front), straps over the shoulders
    vest({ add, chest, S }, c, o) {
      const w = S.w || 1,
        m = M(c, o.kind || "cloth");
      add(chest, gOC(0.218 * w, 0.175 * w, 0.34, 18, o.open || 0), m, 0, 0.19, 0, { s: [1, 1, 0.74], sh: 1 });
      [-1, 1].forEach((s) => add(chest, G_BOX(0.075, 0.035, 0.27), m, s * 0.105 * w, 0.405, 0.005, { r: [0, 0, s * 0.25] }));
      if (o.stripes) [0.13, 0.27].forEach((y) => add(chest, gOC(0.214 * w - (0.36 - y) * 0.12 * w + 0.006, 0.214 * w - (0.36 - y) * 0.12 * w + 0.004, 0.026, 18), GL(o.stripes, 0.9), 0, y, 0, { s: [1, 1, 0.74] }));
      if (o.pouches) [-1, 0, 1].forEach((s) => add(chest, G_BOX(0.07, 0.07, 0.045), M(o.pouches, "leather"), s * 0.085 * w, 0.1, -0.15));
      if (o.edge) [-1, 1].forEach((s) => add(chest, G_BOX(0.014, 0.34, 0.014), M(o.edge, "fur"), s * 0.07 * w, 0.19, -0.142));
    },
    plate({ add, chest, S }, c, o) {
      const w = S.w || 1,
        m = M(c, "metal");
      add(chest, G_SPH(0.5, 16, 12), m, 0, 0.22, -0.01, { s: [0.44 * w, 0.42, 0.31], sh: 1 });
      [0.02, -0.05].forEach((y, i) => add(chest, G_CYL(0.16 * w - i * 0.005, 0.16 * w, 0.06, 16), m, 0, y, 0, { s: [1, 1, 0.76] }));
      add(chest, G_CYL(0.085, 0.1, 0.07, 14), m, 0, 0.43, 0);
      if (o.emblem) add(chest, G_CYL(0.04, 0.04, 0.01, 6), GL(o.emblem, 1.6), 0, 0.25, -0.165, { r: [PI / 2, 0, 0] });
      if (o.trim) add(chest, G_BOX(0.012, 0.3, 0.012), M(o.trim, "paint"), 0, 0.2, -0.163);
    },
    pauldrons({ add, chest, S }, c, o) {
      const w = S.w || 1,
        k = (o && o.size) || 1,
        m = M(c, (o && o.kind) || "metal");
      [-1, 1].forEach((s) => {
        if (o && o.only && o.only !== s) return;
        add(chest, G_HSPH(0.5, 0.5), m, s * 0.25 * w, 0.37, 0, { s: [0.2 * k, 0.15 * k, 0.2 * k], r: [0, 0, -s * 0.35], sh: 1 });
        if (o && o.layers) add(chest, G_HSPH(0.5, 0.5), m, s * 0.28 * w, 0.31, 0, { s: [0.2 * k, 0.12 * k, 0.21 * k], r: [0, 0, -s * 0.5] });
        if (o && o.trim) add(chest, G_TOR(0.098 * k, 0.008, 4, 18), M(o.trim, "paint"), s * 0.25 * w, 0.37, 0, { r: [PI / 2, -s * 0.35, 0] });
        if (o && o.spikes) [-0.045, 0.045].forEach((z, i) => bar(add, chest, [s * 0.27 * w, 0.41, z], [s * (0.31 + i * 0.02) * w, 0.5 - i * 0.02, z * 1.6], (L) => G_CONE(0.026, L, 5), M(o.spikes, "rubber")));
      });
    },
    // a poncho from the shoulders to the waist, the arms out through it
    poncho({ add, chest, S }, c, o) {
      const w = S.w || 1,
        m = M(c, (o && o.kind) || "cloth");
      add(chest, gOC(0.13 * w, 0.33 * w, 0.42, 22), m, 0, 0.22, 0, { s: [1, 1, 0.84], sh: 1 });
      add(chest, G_SPH(0.5, 12, 8), m, 0, 0.4, 0.13, { s: [0.2, 0.11, 0.13] });
      o && o.hem && add(chest, G_TOR(0.33 * w, 0.01, 4, 26), M(o.hem), 0, 0.01, 0, { r: [PI / 2, 0, 0], s: [1, 0.84, 1] });
      o && o.stripe && add(chest, gOC(0.287 * w + 0.004, 0.307 * w + 0.004, 0.05, 22), M(o.stripe), 0, 0.075, 0, { s: [1, 1, 0.84] });
    },
    apron({ add, chest, hips, S }, c, o) {
      const w = S.w || 1,
        m = M(c);
      add(chest, G_BOX(0.24 * w, 0.24, 0.012), m, 0, 0.19, -0.137);
      add(hips, G_BOX(0.3 * w, 0.52, 0.012), m, 0, -0.2, -0.15, { r: [0.05, 0, 0] });
      [-1, 1].forEach((s) => add(chest, G_BOX(0.02, 0.15, 0.01), m, s * 0.1 * w, 0.37, -0.12, { r: [0.2, 0, 0] }));
      o && o.pocket && add(hips, G_BOX(0.2 * w, 0.1, 0.014), M(o.pocket), 0, -0.13, -0.16, { r: [0.05, 0, 0] });
    },
    bandolier({ add, chest, S }, c, o) {
      const w = S.w || 1;
      add(chest, G_BOX(0.05, 0.56, 0.02), M(c, "leather"), 0, 0.2, -0.146, { r: [0, 0, 0.72] });
      for (let i = 0; i < 6; i++) {
        const t = (i / 5 - 0.5) * 0.44;
        add(chest, G_CYL(0.009, 0.009, 0.06, 6), M(0x9aa1ab, "metal"), t * Math.sin(0.72) * w, 0.2 + t * Math.cos(0.72), -0.16, { r: [0, 0, 0.72] });
        add(chest, G_SPH(0.011, 6, 5), GL(o.tip, 1.4), t * Math.sin(0.72) * w + 0.022, 0.2 + t * Math.cos(0.72) + 0.022, -0.16);
      }
    },
    tails({ add, hips }, c, o) {
      [-1, 1].forEach((s) => {
        add(hips, G_BOX(0.12, 0.5, 0.016), M(c), s * 0.07, -0.2, 0.15, { r: [-0.12, 0, s * 0.05], sh: 1 });
        o && o.lining && add(hips, G_BOX(0.11, 0.48, 0.004), M(o.lining), s * 0.07, -0.2, 0.14, { r: [-0.12, 0, s * 0.05] });
      });
    },
    // a short cape round the shoulders with a second layer and crests at the hem
    shawl({ add, chest, S }, c, o) {
      const w = S.w || 1;
      add(chest, gOC(0.12 * w, 0.27 * w, 0.27, 22), M(c), 0, 0.305, 0, { s: [1, 1, 0.84], sh: 1 });
      add(chest, gOC(0.27 * w + 0.003, 0.3 * w, 0.07, 22), M(o.second), 0, 0.14, 0, { s: [1, 1, 0.84] });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2 + 0.3;
        add(chest, gArc(0.03, 0.007, PI * 1.2, 8), M(o.crest), Math.cos(a) * 0.305 * w, 0.105, Math.sin(a) * 0.256 * w, { r: [0, -a + PI / 2, 0] });
      }
    },
    // wide sleeves that hang below the forearm
    wideSleeves({ add, armL, armR }, c, o) {
      const m = M(c);
      [armL, armR].forEach((A) => {
        add(A.fore, gOC(0.068, 0.088, 0.24, 14), m, 0, -0.13, 0, { sh: 1 });
        add(A.fore, G_SPH(0.5, 12, 9), m, 0, -0.16, 0.07, { s: [0.13, 0.27, 0.2], sh: 1 });
        o && o.cuff && add(A.fore, G_TOR(0.088, 0.008, 4, 16), M(o.cuff), 0, -0.25, 0, { r: [PI / 2, 0, 0] });
      });
    },
  };

  // ── arms and legs ──
  const LIMB = {
    bracers({ add, armL, armR }, c, o) {
      [armL, armR].forEach((A) => add(A.fore, G_CYL(0.06, 0.066, 0.12, 12), M(c, (o && o.kind) || "leather"), 0, -0.14, 0));
    },
    gauntlets({ add, armL, armR }, c, o) {
      const m = M(c, (o && o.kind) || "metal");
      [armL, armR].forEach((A) => {
        add(A.fore, G_CYL(0.07, 0.082, 0.16, 12), m, 0, -0.14, 0, { sh: 1 });
        add(A.fore, G_BOX(0.1, 0.11, 0.075), m, 0, -0.262, -0.008, { sh: 1 });
        o && o.glow && add(A.fore, G_BOX(0.104, 0.012, 0.08), GL(o.glow, 1.8), 0, -0.24, -0.008);
      });
    },
    claws({ add, armL, armR }, c) {
      [armL, armR].forEach((A) => [-1, 0, 1].forEach((s) => add(A.fore, G_BOX(0.008, 0.11, 0.012), GL(c, 1.8), s * 0.022, -0.34, -0.05, { r: [-0.5, 0, 0] })));
    },
    wraps({ add, armL, armR, legL, legR }, c, o) {
      const m = M(c);
      if (!o || o.arms) [armL, armR].forEach((A) => [0.08, 0.12, 0.16].forEach((y) => add(A.fore, G_CYL(0.058, 0.058, 0.02, 10), m, 0, -y, 0)));
      if (!o || o.legs) [legL, legR].forEach((L) => [0.06, 0.11, 0.16, 0.21].forEach((y) => add(L.shin, G_CYL(0.07, 0.07, 0.022, 10), m, 0, -y, 0)));
    },
    tallBoots({ add, legL, legR }, c) {
      [legL, legR].forEach((L) => add(L.shin, G_CYL(0.076, 0.07, 0.28, 12), M(c, "leather"), 0, -0.2, 0, { sh: 1 }));
    },
    greaves({ add, legL, legR }, c) {
      const m = M(c, "metal");
      [legL, legR].forEach((L) => {
        add(L.shin, G_BOX(0.1, 0.26, 0.05), m, 0, -0.16, -0.06, { sh: 1 });
        add(L.shin, G_SPH(0.065, 10, 8), m, 0, 0.0, -0.05);
      });
    },
    kneePads({ add, legL, legR }, c) {
      [legL, legR].forEach((L) => add(L.shin, G_SPH(0.5, 10, 8), M(c, "rubber"), 0, -0.015, -0.062, { s: [0.12, 0.135, 0.07] }));
    },
    cargo({ add, legL, legR }, c) {
      [legL, legR].forEach((L, i) => add(L.leg, G_BOX(0.035, 0.1, 0.09), M(c), (i ? 1 : -1) * 0.085, -0.22, 0));
    },
    wideLegs({ add, legL, legR }, c) {
      [legL, legR].forEach((L) => {
        add(L.leg, G_CYL(0.098, 0.12, 0.34, 12), M(c), 0, -0.2, 0, { sh: 1 });
        add(L.shin, G_CYL(0.122, 0.105, 0.24, 12), M(c), 0, -0.1, 0);
      });
    },
  };

  // ── on the back, on a shoulder ──
  const BACK = {
    swords({ add, chest }, o) {
      [-1, 1].forEach((s) => {
        const g = sub(chest, [0, 0.2, 0.175], [0, 0, s * 0.62]);
        add(g, G_BOX(0.03, 0.62, 0.008), M(o.blade, "metal"), 0, -0.06, 0);
        add(g, G_CYL(0.016, 0.016, 0.16, 8), M(o.grip, "leather"), 0, 0.33, 0);
        add(g, G_BOX(0.08, 0.014, 0.03), M(o.guard, "metal"), 0, 0.25, 0);
        add(g, G_SPH(0.02, 8, 6), M(o.guard, "metal"), 0, 0.415, 0);
        add(g, G_BOX(0.036, 0.5, 0.02), M(o.sheath, "leather"), 0, -0.02, 0.012);
      });
      o.glow && add(chest, G_SPH(0.012, 6, 5), GL(o.glow, 2), 0, 0.2, 0.2);
    },
    shield({ add, chest }, o) {
      const g = sub(chest, [0, 0.16, 0.2]);
      add(g, G_CYL(0.25, 0.25, 0.035, 24), M(o.face, "metal"), 0, 0, 0, { r: [PI / 2, 0, 0], sh: 1 });
      add(g, G_TOR(0.25, 0.018, 6, 28), M(o.rim, "metal"), 0, 0, 0);
      add(g, G_SPH(0.05, 10, 8), M(o.rim, "metal"), 0, 0, 0.02);
      add(g, G_TOR(0.15, 0.01, 4, 24), GL(o.glow, 1.2), 0, 0, 0.02);
    },
    lantern({ add, chest }, o) {
      rod(add, chest, [-0.2, 0.0, 0.17], [0.32, 0.72, 0.17], 0.013, M(o.pole, "leather"), !0);
      rod(add, chest, [0.32, 0.72, 0.17], [0.4, 0.66, 0.17], 0.01, M(o.pole, "leather"));
      add(chest, G_BOX(0.004, 0.09, 0.004), M(0x3a2a20), 0.4, 0.615, 0.17);
      add(chest, G_CYL(0.075, 0.075, 0.16, 14), GL(o.glow, 1.6), 0.4, 0.5, 0.17, { sh: 1 });
      [0.085, -0.085].forEach((y) => add(chest, G_CYL(0.06, 0.08, 0.025, 14), M(o.cap, "leather"), 0.4, 0.5 + y, 0.17));
      add(chest, G_BOX(0.014, 0.1, 0.004), M(o.cap), 0.4, 0.38, 0.17);
    },
    brush({ add, chest }, o) {
      rod(add, chest, [-0.26, -0.1, 0.18], [0.3, 0.75, 0.18], 0.022, M(o.handle, "leather"), !0);
      const g = sub(chest, [-0.29, -0.15, 0.18]);
      g.quaternion.setFromUnitVectors(UP, new T.Vector3(0.56, 0.85, 0).normalize());
      add(g, G_CONE(0.05, 0.2, 10), M(o.ink, "hair"), 0, -0.09, 0, { r: [PI, 0, 0] });
      add(g, G_CYL(0.034, 0.03, 0.05, 10), M(o.band, "paint"), 0, 0.03, 0);
    },
    basket({ add, chest }, o) {
      const m = M(o.wicker, "leather");
      add(chest, G_CYL(0.15, 0.12, 0.36, 12), m, 0, 0.2, 0.25, { s: [1, 1, 0.7], sh: 1 });
      for (let i = 0; i < 4; i++) add(chest, G_TOR(0.14 - i * 0.008, 0.008, 4, 16), M(tone(o.wicker, 0.7), "leather"), 0, 0.06 + i * 0.09, 0.25, { r: [PI / 2, 0, 0], s: [1, 0.7, 1] });
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        add(chest, G_CONE(0.03, 0.16, 5), M(i % 3 ? o.herb : o.flower), Math.cos(a) * 0.07, 0.43, 0.25 + Math.sin(a) * 0.04, { r: [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.4] });
      }
      [-1, 1].forEach((s) => add(chest, G_BOX(0.03, 0.4, 0.012), M(0x5d4037, "leather"), s * 0.11, 0.2, -0.138));
    },
    spiderLegs({ add, chest }, o) {
      const m = M(o.leg, "metal");
      [
        [-1, 0.34, 0.5],
        [1, 0.34, 0.5],
        [-1, 0.24, -0.15],
        [1, 0.24, -0.15],
      ].forEach(([s, y, f]) => {
        const p0 = [s * 0.08, y, 0.14],
          p1 = [s * 0.36, y + 0.26 + f * 0.1, 0.22 + f * 0.05],
          p2 = [s * 0.5, y - 0.2 + f * 0.25, 0.18 - f * 0.12];
        rod(add, chest, p0, p1, 0.016, m, !0);
        rod(add, chest, p1, p2, 0.012, m, !0);
        add(chest, G_SPH(0.024, 8, 6), GL(o.joint, 1.8), ...p1);
        add(chest, G_CONE(0.012, 0.05, 6), m, p2[0], p2[1] - 0.02, p2[2], { r: [PI, 0, 0] });
      });
      add(chest, G_SPH(0.5, 12, 9), m, 0, 0.3, 0.16, { s: [0.16, 0.12, 0.08] });
    },
    tank({ add, chest }, o) {
      add(chest, G_CYL(0.075, 0.075, 0.32, 14), M(o.body, "metal"), 0, 0.2, 0.2, { sh: 1 });
      add(chest, G_CYL(0.077, 0.077, 0.07, 14), GL(o.glow, 1.4), 0, 0.2, 0.2);
      add(chest, G_HSPH(0.075, 0.5), M(o.body, "metal"), 0, 0.36, 0.2);
      rod(add, chest, [0.05, 0.35, 0.2], [0.12, 0.44, -0.02], 0.016, M(0x2a2d22, "rubber"));
    },
    mortar({ add, chest }, o) {
      const g = sub(chest, [0.12, 0.3, 0.21], [0.2, 0, -0.32]);
      add(g, G_CYL(0.055, 0.062, 0.66, 16), M(o.tube, "metal"), 0, 0.08, 0, { sh: 1 });
      add(g, G_TOR(0.06, 0.012, 6, 16), M(tone(o.tube, 0.6), "metal"), 0, 0.4, 0, { r: [PI / 2, 0, 0] });
      add(g, G_CYL(0.11, 0.11, 0.02, 16), M(tone(o.tube, 0.7), "metal"), 0, -0.26, 0);
      add(chest, G_BOX(0.2, 0.16, 0.12), M(o.crate, "paint"), -0.08, 0.08, 0.22, { sh: 1 });
      add(chest, G_BOX(0.205, 0.02, 0.125), GL(o.stripe, 0.8), -0.08, 0.12, 0.22);
    },
    speaker({ add, chest }, o) {
      add(chest, G_BOX(0.26, 0.3, 0.1), M(o.body, "rubber"), 0, 0.2, 0.19, { sh: 1 });
      [0.28, 0.13].forEach((y, i) => {
        add(chest, G_CYL(i ? 0.06 : 0.045, i ? 0.06 : 0.045, 0.012, 18), M(0x111417, "rubber"), 0, y, 0.24, { r: [PI / 2, 0, 0] });
        add(chest, G_TOR(i ? 0.06 : 0.045, 0.007, 4, 20), GL(o.glow, 1.6), 0, y, 0.245);
      });
      rod(add, chest, [0.1, 0.35, 0.2], [0.14, 0.62, 0.22], 0.006, M(0x222222, "metal"));
      add(chest, G_SPH(0.014, 6, 5), GL(o.glow, 2), 0.14, 0.62, 0.22);
    },
    quiver({ add, chest }, o) {
      const g = sub(chest, [-0.07, 0.22, 0.18], [0, 0, 0.35]);
      add(g, G_CYL(0.05, 0.044, 0.42, 12), M(o.body, "leather"), 0, 0, 0, { sh: 1 });
      for (let i = 0; i < 4; i++) {
        add(g, G_CYL(0.005, 0.005, 0.16, 5), M(0x6d4c41, "leather"), (i - 1.5) * 0.018, 0.27, (i % 2) * 0.012);
        add(g, G_BOX(0.002, 0.05, 0.022), M(o.feather), (i - 1.5) * 0.018, 0.33, (i % 2) * 0.012);
      }
    },
    moon({ add, chest }, o) {
      add(chest, gArc(0.24, 0.03, PI * 1.25, 30), GL(o.glow, 1.4), 0, 0.5, 0.23, { r: [0, 0, PI * 0.85] });
      add(chest, G_TOR(0.3, 0.006, 4, 36), GL(o.glow, 0.9), 0, 0.5, 0.235);
    },
    backpack({ add, chest }, o) {
      add(chest, G_BOX(0.26, 0.3, 0.12), M(o.body, "cloth"), 0, 0.18, 0.19, { sh: 1 });
      add(chest, G_BOX(0.26, 0.08, 0.13), M(tone(o.body, 0.75), "cloth"), 0, 0.31, 0.19);
      o.glow && add(chest, G_BOX(0.2, 0.02, 0.005), GL(o.glow, 1.4), 0, 0.12, 0.252);
      o.antenna && rod(add, chest, [0.09, 0.33, 0.2], [0.13, 0.66, 0.24], 0.006, M(0x222222, "metal"));
      o.antenna && add(chest, G_SPH(0.013, 6, 5), GL(o.glow, 2), 0.13, 0.66, 0.24);
    },
  };
  const PERCH = {
    falcon({ add, chest }, o) {
      const g = sub(chest, [-0.27, 0.47, 0.03], [0, 0.25, 0]),
        m = M(o.body, "fur");
      add(g, G_SPH(0.5, 10, 8), m, 0, 0.05, 0, { s: [0.08, 0.11, 0.12] });
      add(g, G_SPH(0.5, 10, 8), M(o.chest, "fur"), 0, 0.045, -0.035, { s: [0.06, 0.08, 0.06] });
      add(g, G_SPH(0.04, 10, 8), m, 0, 0.13, -0.03);
      add(g, G_CONE(0.013, 0.035, 6), M(0xffc107, "paint"), 0, 0.125, -0.075, { r: [-PI / 2, 0, 0] });
      [-1, 1].forEach((s) => {
        add(g, G_SPH(0.007, 6, 5), M(0x111111, "glass"), s * 0.022, 0.14, -0.06);
        add(g, G_BOX(0.018, 0.09, 0.13), M(o.wing, "fur"), s * 0.045, 0.06, 0.01, { r: [0.25, 0, s * 0.15] });
      });
      add(g, G_BOX(0.05, 0.012, 0.1), M(o.wing, "fur"), 0, -0.01, 0.09, { r: [-0.5, 0, 0] });
    },
    drone({ add, chest }, o) {
      const g = sub(chest, [0.28, 0.48, 0.02]);
      add(g, G_BOX(0.08, 0.026, 0.08), M(o.body, "paint"), 0, 0, 0);
      add(g, G_SPH(0.016, 8, 6), GL(o.glow, 2), 0, 0, -0.045);
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].forEach(([a, b]) => {
        add(g, G_CYL(0.03, 0.03, 0.004, 12), M(0x2a2d33, "rubber"), a * 0.055, 0.012, b * 0.055);
        add(g, G_SPH(0.006, 6, 4), GL(o.glow, 2), a * 0.055, 0.017, b * 0.055);
      });
    },
    shards({ add, chest }, o) {
      [
        [-0.34, 0.5, -0.02, 0.4],
        [-0.38, 0.38, 0.04, -0.3],
        [-0.3, 0.6, 0.06, 0.9],
      ].forEach(([px, py, pz, r]) => add(chest, G_BOX(0.05, 0.08, 0.005), GL(o.glow, 1.5), px, py, pz, { r: [r, r * 0.7, r * 0.4] }));
    },
    orb({ add, chest }, o) {
      add(chest, G_SPH(0.035, 10, 8), GL(o.glow, 2.2), -0.33, 0.52, -0.06);
      add(chest, G_TOR(0.055, 0.004, 4, 20), GL(o.glow, 1.4), -0.33, 0.52, -0.06, { r: [1.1, 0.4, 0] });
    },
  };
  // glowing lines laid on the clothes
  const LINES = {
    // on the round breastplate: each line sits on its surface
    cracks({ add, chest, armL, armR, S }, c) {
      const g = GL(c, 2),
        w = S.w || 1,
        onPlate = (px, py) => -0.01 - 0.155 * Math.sqrt(Math.max(0, 1 - (px / (0.22 * w)) ** 2 - ((py - 0.22) / 0.21) ** 2)) - 0.004;
      [
        [0.05, 0.27, 0.6, 0.11],
        [-0.07, 0.21, -0.4, 0.1],
        [0.09, 0.14, 0.9, 0.08],
        [-0.03, 0.08, 0.2, 0.07],
        [0.0, 0.33, 1.3, 0.06],
      ].forEach(([px, py, r, L]) => add(chest, G_BOX(0.009, L, 0.008), g, px, py, onPlate(px, py), { r: [0, 0, r] }));
      [armL, armR].forEach((A) => add(A.fore, G_BOX(0.006, 0.08, 0.006), g, 0.03, -0.14, -0.072, { r: [0, 0, 0.3] }));
    },
    circuit({ add, chest, armL, armR, legL, legR }, c) {
      const g = GL(c, 1.7);
      [
        [0.06, 0.2, 0.012, 0.18],
        [0.06, 0.29, 0.08, 0.012],
        [-0.07, 0.12, 0.012, 0.16],
        [-0.03, 0.04, 0.09, 0.012],
      ].forEach(([px, py, sx, sy]) => add(chest, G_BOX(sx, sy, 0.006), g, px, py, -0.146));
      [0.1, 0.22].forEach((y) => add(chest, G_BOX(0.2, 0.01, 0.006), g, 0, y, 0.135));
      [armL, armR].forEach((A) => add(A.fore, G_BOX(0.008, 0.14, 0.006), g, 0, -0.12, -0.056));
      [legL, legR].forEach((L) => add(L.leg, G_BOX(0.008, 0.2, 0.006), g, 0.05, -0.2, -0.07));
    },
    web({ add, chest }, c) {
      const m = M(c, "metal");
      for (let i = 0; i < 6; i++) add(chest, G_BOX(0.004, 0.13, 0.004), m, Math.cos((i * PI) / 3) * 0.05, 0.22 + Math.sin((i * PI) / 3) * 0.05, -0.132, { r: [0, 0, (i * PI) / 3 + PI / 2] });
      add(chest, G_TOR(0.05, 0.003, 3, 6), m, 0, 0.22, -0.132);
      add(chest, G_TOR(0.09, 0.003, 3, 6), m, 0, 0.22, -0.128);
    },
    vines({ add, chest, armR }, c, o) {
      const v = M(c),
        lf = M(o.leaf);
      for (let i = 0; i < 5; i++) add(armR.arm, gArc(0.075, 0.012, PI * 1.3, 10), v, 0, -0.06 - i * 0.045, 0, { r: [PI / 2 + 0.3, 0, i * 1.3] });
      for (let i = 0; i < 4; i++) add(armR.fore, gArc(0.064, 0.011, PI * 1.3, 10), v, 0, -0.05 - i * 0.05, 0, { r: [PI / 2 + 0.3, 0, i * 1.4] });
      rod(add, chest, [-0.17, 0.0, -0.152], [0.18, 0.38, -0.152], 0.016, v);
      for (let i = 0; i < 5; i++) add(chest, G_SPH(0.5, 8, 6), lf, -0.12 + i * 0.07, 0.06 + i * 0.075, -0.164, { s: [0.06, 0.014, 0.035], r: [1.2, 0, i % 2 ? 0.6 : -0.6] });
      add(chest, G_SPH(0.5, 10, 8), lf, -0.27, 0.38, 0, { s: [0.2, 0.05, 0.16], r: [0, 0, 0.5], sh: 1 });
    },
    vials({ add, hips, S }, o) {
      const w = S.w || 1;
      for (let i = 0; i < 5; i++) {
        const a = PI * (0.62 + i * 0.19);
        add(hips, G_CYL(0.016, 0.016, 0.07, 8), GL(o.glows[i % o.glows.length], 1.2), Math.cos(a) * 0.18 * w, 0.03, Math.sin(a) * 0.15);
      }
    },
  };

  // ── the twenty-two looks ──
  // st: CH_STYLE (build, skin, hair, eyes, coat/trim for the portrait)
  // base: clothes under everything (top, sleeve, fore, hand, pants, boot; null = bare skin)
  // face: "eyes" or "none" when a mask or helmet covers the rest
  // band: where the team stripe on the back goes when something hangs over it
  const L = (c, k) => [HX(c), k || "cloth"];
  const DESIGN = {
    baram: {
      st: { w: 0.96, bulk: 0.94, skin: 0xf1d3b5, hair: 0xe6f2f6, eye: 0x1a9fb8, coat: 0x1f6f7a, trim: 0x4dd0e1 },
      base: { top: 0x263238, sleeve: L(0x2a8f9c), fore: null, hand: L(0x22282e, "leather"), pants: 0x37474f, boot: L(0xd7dde2, "rubber") },
      make(x, c) {
        HAIR.spiky(x, 0xe6f2f6);
        HEAD.goggles(x, c);
        TOP.jacket(x, 0x2a8f9c, { cropped: !0, shirt: 0x263238, trim: c, glowTrim: !0, collar: 0x23727c });
        TOP.scarf(x, 0x26c6da, { tails: !0, edge: 0x84ffff });
        TOP.belt(x, 0x1f2428, { buckle: 0xb0bec5 });
        LIMB.wraps(x, 0xeceff1, { legs: !0 });
        LIMB.bracers(x, 0x2a8f9c, { kind: "cloth" });
      },
    },
    geomi: {
      face: "eyes",
      st: { w: 1.0, bulk: 1.0, skin: 0xc8a083, hair: 0x1a1210, eye: 0x7a1010, coat: 0x2b1f1b, trim: 0xff3d3d },
      base: { top: 0x2b1f1b, sleeve: L(0x2b1f1b, "leather"), fore: L(0x3a2a24, "leather"), hand: L(0x1a1412, "leather"), pants: 0x241a17, boot: L(0x1a1412, "leather") },
      make(x, c) {
        HEAD.spider(x, 0x3a2a24, { eye: 0xff3d3d });
        LINES.web(x, 0xb0bec5);
        TOP.belt(x, 0x3a2a24, { buckle: 0x9e9e9e });
        BACK.spiderLegs(x, { leg: 0x3a3a40, joint: 0xff3d3d });
        LIMB.bracers(x, 0x4e342e);
        LIMB.kneePads(x, 0x2a2a2e);
      },
    },
    byeolbit: {
      band: { z: 0.215 },
      st: { w: 0.94, bulk: 0.9, skin: 0xf3dccb, hair: 0xdfe3f5, eye: 0x7986cb, coat: 0x1a1f3d, trim: 0x9fa8ff },
      base: { top: 0x1a1f3d, sleeve: L(0x232a52), fore: L(0x232a52), hand: L(0xe8eaf6, "leather"), pants: 0x1a1f3d, boot: L(0xe8eaf6, "leather") },
      make(x, c) {
        HAIR.long(x, 0xdfe3f5, { w: 1.7 });
        HEAD.circlet(x, 0xc5cae9, { gem: 0xb3bcff });
        TOP.cape(x, 0x141833, { inner: 0x7986cb, stars: 0xc5cbff, len: 0.86, mantle: 0x2a3366 });
        TOP.jacket(x, 0x232a52, { collar: 0x2a3366, trim: 0x9fa8ff, glowTrim: !0 });
        TOP.belt(x, 0x2a3366, { buckle: 0xc5cae9 });
        PERCH.orb(x, { glow: 0xc5cbff });
      },
    },
    kallal: {
      face: "eyes",
      st: { w: 0.92, bulk: 0.9, skin: 0xe0bfa0, hair: 0x15151a, eye: 0x78909c, coat: 0x18191d, trim: 0xcfd8dc },
      base: { top: 0x18191d, sleeve: null, fore: L(0x2b2f36), hand: L(0x18191d, "leather"), pants: 0x2b2f36, boot: L(0x15161a, "cloth") },
      make(x, c) {
        HAIR.ponytail(x, 0x15151a, { w: 1.6, zig: 1, tie: 0xcfd8dc });
        HEAD.mask(x, 0x2b2f36);
        x.add(x.neck, G_TOR(0.124, 0.007, 4, 24), M(0xcfd8dc, "metal"), 0, 0.3, 0.004, { r: [PI / 2 - 0.2, 0, 0] });
        TOP.collarV(x, 0x2b2f36);
        TOP.sash(x, 0x37474f);
        TOP.pauldrons(x, 0xcfd8dc, { only: -1, size: 0.9 });
        LIMB.wideLegs(x, 0x2b2f36);
        LIMB.wraps(x, 0xb0bec5, { legs: !0 });
        LIMB.wraps(x, 0x3c4148, { arms: !0 });
        BACK.swords(x, { blade: 0xdfe6ea, grip: 0x1b1d22, guard: 0xb0bec5, sheath: 0x22252b, glow: c });
      },
    },
    deonggul: {
      st: { w: 1.04, bulk: 1.02, skin: 0xd6a77a, hair: 0x5b3d24, eye: 0x6b8e23, coat: 0x5d4a36, trim: 0x8bc34a },
      base: { top: 0x6b8e4e, sleeve: L(0x5d4a36), fore: L(0x5d4a36), hand: L(0x4e3b2a, "leather"), pants: 0x6d6448, boot: L(0x3e2c1e, "leather") },
      make(x, c) {
        HAIR.short(x, 0x5b3d24, { zig: 1 });
        HEAD.wreath(x, 0x7cb342, { vine: 0x33691e });
        TOP.jacket(x, 0x5d4a36, { shirt: 0x6b8e4e, collar: 0x4e3b2a });
        TOP.belt(x, 0x3e2c1e, { buckle: 0xa1887f });
        LINES.vines(x, 0x33691e, { leaf: 0x7cb342 });
        LIMB.kneePads(x, 0x4e3b2a);
        LIMB.cargo(x, 0x5f573e);
      },
    },
    neupji: {
      face: "none",
      st: { w: 1.0, bulk: 1.0, skin: 0xb59a7a, hair: 0x2b2b20, eye: 0xb2ff59, coat: 0x2e3a24, trim: 0x8bc34a },
      base: { top: 0x2e3a24, sleeve: L(0x2e3a24), fore: L(0x3a4630), hand: L(0x23281c, "rubber"), pants: 0x2a2d22, boot: L(0x3d4a3a, "rubber") },
      make(x, c) {
        HEAD.hood(x, 0x3a4a2c, { point: !0 });
        HEAD.gasMask(x, 0x2a2d26, { eye: 0xb2ff59 });
        TOP.jacket(x, 0x34402a, { collar: 0x2a3322 });
        TOP.skirt(x, 0x34402a, { len: 0.62, split: 0x23281c, hem: 0x23281c });
        TOP.belt(x, 0x23281c);
        LINES.vials(x, { glows: [0xb2ff59, 0x76ff03, 0xc6ff00] });
        BACK.tank(x, { body: 0x5a6048, glow: 0x9ccc65 });
        LIMB.tallBoots(x, 0x3d4a3a);
      },
    },
    deungbul: {
      st: { w: 0.98, bulk: 0.96, skin: 0xf0cfa8, hair: 0x4a2c1a, eye: 0x8d5524, coat: 0xefe3cf, trim: 0xffb74d },
      base: { top: 0xefe3cf, sleeve: L(0xefe3cf), fore: L(0xefe3cf), hand: L(0x5d4037, "leather"), pants: 0x4e342e, boot: L(0x3e2723, "leather") },
      make(x, c) {
        HAIR.bob(x, 0x4a2c1a);
        x.add(x.neck, G_CYL(0.006, 0.006, 0.09, 6), M(0xd4af37, "metal"), 0.09, 0.31, -0.02, { r: [0.3, 0, 0.9] });
        x.add(x.neck, G_SPH(0.016, 8, 6), GL(0xffb74d, 1.8), 0.125, 0.33, -0.03);
        TOP.jacket(x, 0xefe3cf, { collar: 0xffb74d, trim: 0xffb74d });
        TOP.skirt(x, 0xefe3cf, { len: 0.7, hem: 0xffb74d });
        // the coat ribbon (goreum)
        x.add(x.chest, G_BOX(0.03, 0.2, 0.01), M(0xff8f00), 0.03, 0.2, -0.15, { r: [0, 0, 0.2] });
        x.add(x.chest, G_SPH(0.022, 8, 6), M(0xff8f00), 0.02, 0.29, -0.15);
        TOP.belt(x, 0x6d4c41);
        BACK.lantern(x, { pole: 0x5d4037, glow: 0xffb74d, cap: 0x3e2723 });
      },
    },
    hwanyeong: {
      st: { w: 0.94, bulk: 0.9, skin: 0xf5ddd0, hair: 0xb388d6, eye: 0x9c4dcc, coat: 0x3b2350, trim: 0xce93d8 },
      base: { top: 0x3b2350, sleeve: L(0x3b2350), fore: L(0x3b2350), hand: L(0xf5f5f5, "leather"), pants: 0x1f1a24, boot: L(0x141016, "leather") },
      make(x, c) {
        HAIR.long(x, 0xb388d6, { w: 2.0, tilt: -0.28, x: -0.012 });
        HEAD.halfMask(x, 0xf3f0f5, { glow: 0xe040fb, line: 0x7b1fa2 });
        TOP.jacket(x, 0x3b2350, { shirt: 0xf3f0f5, collar: 0x2a1838, trim: 0xce93d8, glowTrim: !0 });
        TOP.tails(x, 0x3b2350, { lining: 0xce93d8 });
        TOP.belt(x, 0x1f1a24, { buckle: 0xce93d8 });
        PERCH.shards(x, { glow: 0xe1bee7 });
      },
    },
    ullim: {
      st: { w: 0.98, bulk: 0.96, skin: 0xd9b08c, hair: 0x1d2b2a, eye: 0x26a69a, coat: 0x263238, trim: 0x4db6ac },
      base: { top: 0x263238, sleeve: L(0x2f4a48), fore: L(0x2f4a48), hand: L(0x1c2124, "rubber"), pants: 0x1c2124, boot: L(0x1c2124, "rubber") },
      make(x, c) {
        HAIR.short(x, 0x1d2b2a, { w: 1.9, tilt: 0.25, zig: 1 });
        x.add(x.neck, gBang(0.5, 1), M(0x4db6ac, "hair"), -0.004, 0.223, -0.006, { s: [0.25, 0.29, 0.274], r: [0, 0.35, 0.25] });
        HEAD.headphones(x, c, { mic: !0 });
        TOP.jacket(x, 0x2f4a48, { collar: 0x263238, shirt: 0x1c2124, kind: "cloth" });
        [-1, 1].forEach((s) => {
          x.add(x.chest, G_CYL(0.035, 0.035, 0.01, 16), M(0x111417, "rubber"), s * 0.09, 0.27, -0.142, { r: [PI / 2, 0, 0] });
          x.add(x.chest, G_TOR(0.035, 0.006, 4, 18), GL(c, 1.5), s * 0.09, 0.27, -0.146);
        });
        TOP.belt(x, 0x1c2124);
        LIMB.cargo(x, 0x263238);
        BACK.speaker(x, { body: 0x222a2e, glow: c });
      },
    },
    hwasan: {
      st: { w: 1.12, bulk: 1.12, skin: 0x8d5a3b, hair: 0x1a0f0a, eye: 0xd84315, coat: 0x3b2f2b, trim: 0xff6e40 },
      base: { top: 0x3b2f2b, sleeve: null, fore: L(0x3b2f2b, "leather"), hand: L(0x3b2f2b, "leather"), pants: 0x332a27, boot: L(0x241c19, "leather") },
      make(x, c) {
        HAIR.mohawk(x, 0x1a0f0a, { glow: 0xff7043 });
        TOP.plate(x, 0x5a4a44, {});
        TOP.pauldrons(x, 0x4a3c37, { kind: "rubber", size: 1.15, spikes: 0x3a2e2a });
        LINES.cracks(x, 0xff6e40);
        LIMB.gauntlets(x, 0x4a3c37, { kind: "rubber", glow: 0xff6e40 });
        TOP.belt(x, 0x241c19, { h: 0.08, buckle: 0xff6e40 });
        LIMB.greaves(x, 0x4a3c37);
      },
    },
    suho: {
      band: { z: 0.232 },
      st: { w: 1.1, bulk: 1.08, skin: 0xe6b98f, hair: 0x3e2a1b, eye: 0x2e7d32, coat: 0x2e6b32, trim: 0x81c784 },
      base: { top: 0x2e6b32, sleeve: L(0x8a929b, "metal"), fore: L(0x9ea7b0, "metal"), hand: L(0x8a929b, "metal"), pants: 0x3a3f44, boot: L(0x8a929b, "metal") },
      make(x, c) {
        HEAD.helmetOpen(x, 0xb0bec5, { crest: 0x2e7d32 });
        TOP.plate(x, 0xb0bec5, { emblem: 0x69f0ae, trim: 0x2e7d32 });
        x.add(x.chest, G_BOX(0.18, 0.34, 0.012), M(0x2e6b32), 0, 0.12, -0.172);
        x.add(x.hips, G_BOX(0.2, 0.36, 0.012), M(0x2e6b32), 0, -0.14, -0.15);
        TOP.pauldrons(x, 0xb0bec5, { trim: 0x2e7d32, size: 1.1 });
        TOP.belt(x, 0x4e342e, { buckle: 0xd4af37 });
        LIMB.greaves(x, 0xb0bec5);
        BACK.shield(x, { face: 0x2e6b32, rim: 0xb0bec5, glow: 0x69f0ae });
      },
    },
    hyeollang: {
      band: { y: 0.3, z: 0.178 },
      st: { w: 1.04, bulk: 1.02, skin: 0xd6b096, hair: 0xcfd2d6, eye: 0xb71c1c, coat: 0x1b1215, trim: 0xff1744 },
      base: { top: 0x2a1a1e, sleeve: null, fore: L(0xe8dccb), hand: L(0x1b1215, "leather"), pants: 0x2a1218, boot: L(0x120c0e, "leather") },
      make(x, c) {
        HAIR.mane(x, 0xcfd2d6);
        HEAD.wolfHood(x, 0x5f6168, { inner: 0x880e4f, eye: 0xff1744 });
        TOP.vest(x, 0x1b1215, { kind: "leather", open: 0.7, edge: 0x6d6f75 });
        TOP.ruff(x, 0x6d6f75);
        // war paint on the bare arms
        [x.armL, x.armR].forEach((A) => [0.1, 0.14].forEach((y) => x.add(A.arm, G_CYL(0.064, 0.064, 0.014, 10), M(0xb71c1c, "paint"), 0, -y, 0)));
        LIMB.claws(x, 0xff1744);
        TOP.belt(x, 0x3a1a20);
        LIMB.wraps(x, 0x4a2a30, { legs: !0 });
      },
    },
    songgol: {
      st: { w: 0.98, bulk: 0.96, skin: 0xe3bc96, hair: 0x5a3d2b, eye: 0x6d4c41, coat: 0x6b4a36, trim: 0xd7ccc8 },
      base: { top: 0x8d7a5c, sleeve: L(0x6b4a36, "leather"), fore: L(0x6b4a36, "leather"), hand: L(0x4e342e, "leather"), pants: 0x4a4a32, boot: L(0x4e342e, "leather") },
      make(x, c) {
        HAIR.cap(x, 0x5a3d2b);
        HEAD.aviator(x, 0x6b4a36, { feather: 0xefebe9 });
        TOP.jacket(x, 0x6b4a36, { kind: "leather", shirt: 0x8d7a5c, collar: 0xd7ccc8 });
        // feather mantle over the shoulders
        for (let i = 0; i < 11; i++) {
          const a = PI * (0.02 + (i / 10) * 0.96);
          x.add(x.chest, G_BOX(0.055, 0.15, 0.012), M(i % 2 ? 0xd7ccc8 : 0x8d6e63, "fur"), -Math.cos(a) * 0.235, 0.375, Math.sin(a) * 0.13 - 0.02, { r: [0.35, -a + PI / 2, 0] });
        }
        x.add(x.armL.fore, G_CYL(0.072, 0.082, 0.2, 12), M(0x8d6e63, "leather"), 0, -0.2, 0);
        TOP.belt(x, 0x3e2723, { buckle: 0xbcaaa4 });
        LIMB.tallBoots(x, 0x4e342e);
        BACK.quiver(x, { body: 0x5d4037, feather: 0xefebe9 });
        PERCH.falcon(x, { body: 0x6d4c41, chest: 0xd7ccc8, wing: 0x5d4037 });
      },
    },
    haerang: {
      band: { z: 0.262, sx: 0.55 },
      st: { w: 0.95, bulk: 0.92, skin: 0xe8c5a8, hair: 0x1565c0, eye: 0x0288d1, coat: 0x0d2a4a, trim: 0x29b6f6 },
      base: { top: 0x0d2a4a, sleeve: L(0x0d2a4a), fore: L(0x4fc3f7), hand: L(0x0d2a4a, "rubber"), pants: 0x0d2a4a, boot: L(0xe3f2fd, "rubber") },
      make(x, c) {
        HAIR.longer(x, 0x1565c0, { zig: 1, over: 1 });
        x.add(x.neck, G_SPH(0.5, 10, 8), M(0xfff8e1, "paint"), 0.105, 0.3, 0.02, { s: [0.04, 0.05, 0.02], r: [0, 0.4, 0.3] });
        TOP.shawl(x, 0x1976d2, { second: 0xe3f2fd, crest: 0xb3e5fc });
        [0.12, 0.2].forEach((y) => x.add(x.chest, G_BOX(0.3, 0.012, 0.006), M(0xb3e5fc), 0, y, -0.133, { r: [0, 0, y * 2 - 0.3] }));
        TOP.belt(x, 0xe3f2fd, { buckle: 0x29b6f6 });
        [x.armL, x.armR].forEach((A) => x.add(A.fore, G_BOX(0.006, 0.12, 0.06), GL(0x4fc3f7, 1.2), 0, -0.14, 0.05, { r: [0.2, 0, 0] }));
        [x.legL, x.legR].forEach((L) => x.add(L.shin, G_BOX(0.006, 0.18, 0.05), M(0x4fc3f7), 0.07, -0.12, 0.02));
      },
    },
    mukhyang: {
      st: { w: 0.95, bulk: 0.92, skin: 0xeed2b3, hair: 0x0d0d0d, eye: 0x3e2723, coat: 0xece6d8, trim: 0x1b1b1b },
      base: { top: 0xece6d8, sleeve: L(0xece6d8), fore: L(0xece6d8), hand: null, pants: 0xe0dace, boot: L(0x1b1b1b, "leather") },
      bareHands: !0,
      make(x, c) {
        HAIR.topknot(x, 0x0d0d0d);
        HEAD.gat(x, 0x141414);
        TOP.collarV(x, 0x1b1b1b);
        TOP.skirt(x, 0xece6d8, { len: 0.86, hem: 0x1b1b1b });
        TOP.wideSleeves(x, 0xece6d8, { cuff: 0x1b1b1b });
        TOP.sash(x, 0x1b1b1b);
        // ink splashes on the robe
        [
          [0.08, 0.1, 0.05],
          [-0.1, 0.24, 0.035],
          [0.12, 0.3, 0.025],
        ].forEach(([px, py, r]) => x.add(x.chest, G_CYL(r, r, 0.006, 10), M(0x1b1b1b, "paint"), px, py, -0.135, { r: [PI / 2, 0, 0] }));
        BACK.brush(x, { handle: 0x5d4037, ink: 0x101010, band: 0xd4af37 });
      },
    },
    yeongwol: {
      band: { z: 0.2, sx: 0.55 },
      st: { w: 0.92, bulk: 0.88, skin: 0xf6e3d5, hair: 0x120b18, eye: 0x7e57c2, coat: 0x4a148c, trim: 0xd1c4e9 },
      base: { top: 0x4a148c, sleeve: L(0x4a148c), fore: L(0x4a148c), hand: null, pants: 0x4a148c, boot: L(0xf3eef8, "leather") },
      bareHands: !0,
      make(x, c) {
        HAIR.longer(x, 0x120b18, { w: 2.0 });
        HEAD.crescent(x, 0xd1c4e9);
        TOP.collarV(x, 0xf3eef8);
        TOP.skirt(x, 0x4a148c, { len: 0.88, hem: 0xd1c4e9 });
        TOP.wideSleeves(x, 0x5e1fa0, { cuff: 0xd1c4e9 });
        TOP.sash(x, 0xd1c4e9);
        for (let i = 0; i < 3; i++) x.add(x.hips, G_SPH(0.016, 8, 6), M(0xd4af37, "metal"), 0.1 + i * 0.025, -0.05 - i * 0.03, -0.155);
        BACK.moon(x, { glow: 0xd1c4e9 });
      },
    },
    danbi: {
      st: { w: 0.95, bulk: 0.94, skin: 0xedc9a8, hair: 0x22301f, eye: 0x43a047, coat: 0x66bb6a, trim: 0xb3e5fc },
      base: { top: 0xf1f8e9, sleeve: L(0x66bb6a), fore: L(0x66bb6a), hand: L(0x2e7d32, "rubber"), pants: 0x263850, boot: L(0xfbc02d, "rubber") },
      make(x, c) {
        HAIR.bob(x, 0x22301f);
        HEAD.satgat(x, 0xc8a96e, { drop: 0x81d4fa });
        TOP.poncho(x, 0x66bb6a, { kind: "paint", hem: 0x2e7d32, stripe: 0xb3e5fc });
        TOP.belt(x, 0x2e7d32);
        LIMB.tallBoots(x, 0xfbc02d);
      },
    },
    cheolhyeol: {
      face: "none",
      st: { w: 1.28, bulk: 1.3, skin: 0x9c6b4e, hair: 0x1a1a1a, eye: 0xff1744, coat: 0x3a3c44, trim: 0xb71c1c },
      base: { top: 0x3a3c44, sleeve: L(0x6c717c, "metal"), fore: L(0x6c717c, "metal"), hand: L(0x5a5e68, "metal"), pants: 0x2c2d33, boot: L(0x5a5e68, "metal") },
      make(x, c) {
        HEAD.greatHelm(x, 0x7a7f8a, { eye: 0xff1744, horns: 0xd7ccc8, trim: 0xb71c1c });
        x.add(x.neck, G_CYL(0.092, 0.11, 0.13, 14), M(0x5a5e68, "metal"), 0, 0.03, 0);
        TOP.plate(x, 0x7a7f8a, { emblem: 0xff1744, trim: 0xb71c1c });
        TOP.pauldrons(x, 0x6c717c, { layers: !0, trim: 0xb71c1c, size: 1.35 });
        LIMB.gauntlets(x, 0x6c717c, { glow: 0xb71c1c });
        LIMB.greaves(x, 0x6c717c);
        TOP.belt(x, 0x22232a, { h: 0.08, kind: "metal", buckle: 0xb71c1c });
        x.add(x.hips, G_BOX(0.22, 0.42, 0.014), M(0x8e1414), 0, -0.2, -0.15, { r: [0.06, 0, 0] });
        x.add(x.hips, G_BOX(0.22, 0.38, 0.014), M(0x8e1414), 0, -0.18, 0.15, { r: [-0.06, 0, 0] });
      },
    },
    chujeok: {
      st: { w: 1.02, bulk: 1.0, skin: 0xd4a07a, hair: 0x2d1f16, eye: 0x4e342e, coat: 0x6d4c41, trim: 0xff9800 },
      base: { top: 0x3b4033, sleeve: L(0x6d4c41, "leather"), fore: L(0x6d4c41, "leather"), hand: L(0x3e2723, "leather"), pants: 0x4b4232, boot: L(0x3e2723, "leather") },
      make(x, c) {
        HAIR.cap(x, 0x2d1f16);
        HAIR.beard(x, 0x3a2a1e);
        HEAD.ranger(x, 0x5d4037, { band: 0x3e2723 });
        TOP.jacket(x, 0x6d4c41, { kind: "leather", shirt: 0x3b4033 });
        TOP.skirt(x, 0x6d4c41, { kind: "leather", len: 0.66, open: 0.5 });
        x.add(x.chest, G_TOR(0.12, 0.045, 8, 18), M(0x3e2a20, "fur"), 0, 0.42, 0.0, { r: [PI / 2, 0, 0] });
        TOP.bandolier(x, 0x3e2723, { tip: 0xff9800 });
        TOP.belt(x, 0x3e2723, { buckle: 0xbcaaa4 });
        x.add(x.armL.fore, G_BOX(0.05, 0.035, 0.065), M(0x263238, "rubber"), 0.045, -0.17, 0);
        x.add(x.armL.fore, G_BOX(0.004, 0.026, 0.05), GL(0xff9800, 1.8), 0.072, -0.17, 0);
        LIMB.tallBoots(x, 0x3e2723);
      },
    },
    hoero: {
      st: { w: 0.94, bulk: 0.92, skin: 0xf0d0b0, hair: 0x15151a, eye: 0x5d4037, coat: 0x1a1c20, trim: 0xffd740 },
      base: { top: 0x1a1c20, sleeve: L(0x1a1c20), fore: L(0x2a2d33), hand: L(0x15161a, "rubber"), pants: 0x1a1c20, boot: L(0x2a2d33, "rubber") },
      make(x, c) {
        HAIR.short(x, 0x15151a, { w: 1.9, tilt: -0.3, zig: 1 });
        x.add(x.neck, gBang(0.45, 1), M(0xffd740, "hair"), 0.004, 0.223, -0.006, { s: [0.25, 0.29, 0.274], r: [0, -0.4, -0.3] });
        HEAD.arVisor(x, 0xffd740);
        TOP.jacket(x, 0x22252b, { collar: 0x1a1c20, shirt: 0x15161a });
        LINES.circuit(x, 0xffd740);
        TOP.belt(x, 0x15161a, { buckle: 0xffd740 });
        BACK.backpack(x, { body: 0x22252b, glow: 0xffd740, antenna: !0 });
        PERCH.drone(x, { body: 0x2a2d33, glow: 0xffd740 });
        LIMB.kneePads(x, 0x2a2d33);
      },
    },
    yakcho: {
      band: { z: 0.36, sx: 0.8 },
      st: { w: 1.0, bulk: 0.98, skin: 0xe9c39b, hair: 0x8b6a3e, eye: 0x558b2f, coat: 0xf1e9d2, trim: 0x81c784 },
      base: { top: 0xf1e9d2, sleeve: L(0xf1e9d2), fore: null, hand: null, pants: 0x6d5a40, boot: L(0x4e3b2a, "leather") },
      bareHands: !0,
      make(x, c) {
        HAIR.braid(x, 0x8b6a3e);
        HEAD.scarfHead(x, 0x66bb6a);
        x.add(x.neck, G_CONE(0.02, 0.07, 5), M(0x33691e), 0.09, 0.36, 0.04, { r: [0, 0, -0.5] });
        TOP.apron(x, 0x66bb6a, { pocket: 0x4caf50 });
        TOP.belt(x, 0x5d4037, { buckle: 0xbcaaa4 });
        LINES.vials(x, { glows: [0xb9f6ca, 0xff80ab, 0xffe57f] });
        BACK.basket(x, { wicker: 0xa1887f, herb: 0x7cb342, flower: 0xffd54f });
        [x.armL, x.armR].forEach((A) => x.add(A.arm, G_CYL(0.066, 0.066, 0.05, 10), M(0xf1e9d2), 0, -0.22, 0));
      },
    },
    cheolbyeok: {
      st: { w: 1.16, bulk: 1.14, skin: 0xc99a73, hair: 0x2b2b2b, eye: 0x546e7a, coat: 0x546e7a, trim: 0xffca28 },
      base: { top: 0x546e7a, sleeve: L(0x546e7a), fore: null, hand: L(0xc9a227, "leather"), pants: 0x263238, boot: L(0x1d2226, "leather") },
      make(x, c) {
        HAIR.buzz(x, 0x2b2b2b);
        HAIR.beard(x, 0x2b2b2b);
        HEAD.hardhat(x, 0xffcf33, { goggles: 0xffca28 });
        TOP.vest(x, 0xff8f00, { stripes: 0xe0f7fa, pouches: 0x4e3b2a, kind: "paint" });
        [x.armL, x.armR].forEach((A) => x.add(A.arm, G_CYL(0.07, 0.07, 0.05, 10), M(0x546e7a), 0, -0.22, 0));
        TOP.belt(x, 0x3e2723, { h: 0.07, buckle: 0x9e9e9e });
        LIMB.kneePads(x, 0x1d2226);
        LIMB.cargo(x, 0x2e3b42);
        BACK.mortar(x, { tube: 0x607d8b, crate: 0x556b2f, stripe: 0xffca28 });
      },
    },
  };

  // install: colours and build for the body, the outfit hook
  for (const id in DESIGN) {
    const ag = AGENTS.find((a) => a.id === id);
    if (!ag) continue;
    const D = DESIGN[id];
    CH_STYLE[id] = Object.assign({}, CH_STYLE._default || {}, D.st);
    const B = D.base;
    CH_BASE_EXTRA[id] = { top: B.top, sleeve: B.sleeve, fore: B.fore, hand: B.hand, pants: B.pants, boot: B.boot };
    CH_OUTFIT[id] = function (x) {
      body(x, D);
      D.make(x, HX(ag.color));
      [x.hips, x.chest, x.neck, x.armL.arm, x.armL.fore, x.armR.arm, x.armR.fore, x.legL.leg, x.legL.shin, x.legR.leg, x.legR.shin].forEach(flatten);
    };
  }
  // the first fourteen keep their outfits and get the new head and face (round,
  // so their hair, hats and masks still fit); muyeong keeps the glowing eyes
  const FACE14 = { hwaryeong: "full", seorin: "full", muyeong: "none", gangcheol: "full", yeonhwa: "full", noeun: "full", baekho: "full", noeha: "full", gyeongyeon: "full", heuksa: "none", myeongjong: "full", jacheol: "full", hongyeol: "full", gunbong: "mouth" };
  for (const id in FACE14) {
    const old = CH_OUTFIT[id];
    if (!old || DESIGN[id]) continue;
    CH_OUTFIT[id] = function (x) {
      old.call(this, x);
      x.neck.position.y -= 0.015;
      face(x, FACE14[id], !0, id === "muyeong" ? [G_SPH(0.017, 7, 6), G_BOX(0.046, 0.012, 0.015)] : null);
    };
  }
  // the team stripe on the back goes over a cape, a shield or long hair
  const BF = buildFighter;
  buildFighter = function (tc, ag) {
    const f = BF.apply(this, arguments),
      D = ag && DESIGN[ag.id || ag.key];
    if (D && D.band && f && f.chest) {
      const s = f.chest.children.find((m) => m.isMesh && m.material === f.teamMat && m.position.z > 0.1);
      if (s) {
        null != D.band.y && (s.position.y = D.band.y);
        null != D.band.z && (s.position.z = D.band.z);
        D.band.sx && (s.scale.x = D.band.sx);
      }
    }
    return f;
  };
  window.CH_DESIGN = DESIGN;
  window.CH_LOOK = { face, body, flatten };
  window.CH_KIT = { HX, tone, mixc, M, GL, UP, shell, gOC, gArc, gSeg, zig, bar, rod, sub, HAIR, HEAD, TOP, LIMB, BACK, PERCH, LINES, L };
})();
