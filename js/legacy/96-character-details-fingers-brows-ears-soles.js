(() => {
  // A last detail pass on every fighter, added after the body is built and baked:
  //  · the glove was a black block: now four fingers curl forward off it and the thumb sits
  //    on the inner side, with a ridge of knuckles on the back;
  //  · the face had eyes, a nose and a mouth but a bare brow line: eyebrows (in the hair
  //    colour) and ears (in the skin colour);
  //  · boots stood on their bare tube ends: now a thick sole with a heel.
  // The pieces go into the same baked meshes the body already uses (same vertex format), so
  // a fighter is still one mesh per body part: no extra draw calls.
  if ("function" != typeof buildFighter || "undefined" == typeof T || "undefined" == typeof CH_STYLE) return;
  const HX = (c) => ("string" == typeof c ? parseInt(c.replace("#", ""), 16) : c);
  const lin = (hex, k) => {
    const c = new T.Color(HX(hex));
    return [c.r * (k || 1), c.g * (k || 1), c.b * (k || 1)];
  };
  const G = {
    box: new T.BoxGeometry(1, 1, 1),
    cap: new T.CapsuleGeometry(1, 1, 3, 8),
    sph: new T.SphereGeometry(1, 10, 8),
  };
  const _m = new T.Matrix4(),
    _q = new T.Quaternion(),
    _e = new T.Euler(),
    _p = new T.Vector3(),
    _s = new T.Vector3();
  // a piece: a geometry, where it goes (position, euler), its size, its colour and surface
  const piece = (geo, x, y, z, rx, ry, rz, sx, sy, sz, col, rough, metal) => ({
    geo,
    m: new T.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)),
    col,
    rough: rough ?? 0.8,
    metal: metal ?? 0,
  });
  const NAMES = ["position", "normal", "color", "chrm", "chem"];
  // append pieces to a baked mesh (non-indexed, attributes position normal color chrm chem)
  function append(mesh, pieces) {
    if (!mesh || !mesh.geometry || !pieces.length) return;
    const g = mesh.geometry;
    for (const n of NAMES) if (!g.attributes[n]) return;
    const add = { position: [], normal: [], color: [], chrm: [], chem: [] };
    const nm = new T.Matrix3(),
      v = new T.Vector3();
    for (const p of pieces) {
      const src = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      src.applyMatrix4(p.m);
      nm.getNormalMatrix(p.m);
      const pa = src.attributes.position,
        na = src.attributes.normal;
      for (let i = 0; i < pa.count; i++) {
        add.position.push(pa.getX(i), pa.getY(i), pa.getZ(i));
        v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
        add.normal.push(v.x, v.y, v.z);
        add.color.push(p.col[0], p.col[1], p.col[2]);
        add.chrm.push(p.rough, p.metal);
        add.chem.push(0, 0, 0);
      }
      src.dispose();
    }
    const out = new T.BufferGeometry();
    for (const n of NAMES) {
      const a = g.attributes[n],
        isz = a.itemSize,
        arr = new Float32Array(a.array.length + add[n].length);
      arr.set(a.array);
      arr.set(add[n], a.array.length);
      out.setAttribute(n, new T.BufferAttribute(arr, isz));
    }
    out.computeBoundingSphere();
    out.computeBoundingBox();
    g.dispose();
    mesh.geometry = out;
  }
  const meshOf = (grp) => grp && grp.children && grp.children.find((c) => c.isMesh && c.geometry && c.geometry.attributes && c.geometry.attributes.chrm);

  // the glove colour is read off the baked glove itself (the dark vertices at the end of the forearm)
  function gloveColour(mesh) {
    const g = mesh.geometry,
      p = g.attributes.position,
      c = g.attributes.color;
    let r = 0,
      gg = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.28) ((r += c.getX(i)), (gg += c.getY(i)), (b += c.getZ(i)), n++);
    return n ? [r / n, gg / n, b / n] : [0.03, 0.03, 0.035];
  }
  function hand(fore, side) {
    const mesh = meshOf(fore);
    if (!mesh) return;
    const col = gloveColour(mesh),
      lift = col.map((v) => Math.min(1, v * 1.5 + 0.012)),
      pcs = [];
    // four fingers curling forward (-z) off the lower edge of the glove
    for (let i = 0; i < 4; i++) {
      const x = -0.0265 + i * 0.0177,
        len = 0.034 - (i === 3 ? 0.008 : i === 0 ? 0.002 : 0);
      pcs.push(piece(G.cap, x, -0.368, -0.036, 0.62, 0, 0, 0.0086, len, 0.0086, col, 0.85, 0));
      // the fingertip bends under
      pcs.push(piece(G.cap, x, -0.402, -0.058, 1.35, 0, 0, 0.0082, 0.014, 0.0082, col, 0.85, 0));
      // a knuckle on the back of the hand
      pcs.push(piece(G.sph, x, -0.288, -0.0, 0, 0, 0, 0.0105, 0.0085, 0.0105, lift, 0.7, 0.05));
    }
    // the thumb on the inner side
    pcs.push(piece(G.cap, side * 0.043, -0.318, -0.026, 0.9, 0, side * 0.35, 0.0095, 0.034, 0.0095, col, 0.85, 0));
    // a ridge across the back of the hand
    pcs.push(piece(G.box, 0, -0.272, 0.014, 0, 0, 0, 0.074, 0.007, 0.012, lift, 0.6, 0.1));
    append(mesh, pcs);
  }
  function face(m, st) {
    const mesh = meshOf(m.neck);
    if (!mesh) return;
    const skin = lin(st.skin, 1),
      hair = lin(st.hair, 0.55),
      pcs = [];
    // brows above the eyes, tilted down towards the nose
    for (const s of [-1, 1]) pcs.push(piece(G.box, s * 0.04, 0.248, -0.104, 0, s * 0.12, -s * 0.2, 0.046, 0.0085, 0.011, hair, 0.6, 0.02));
    // ears
    for (const s of [-1, 1]) pcs.push(piece(G.sph, s * 0.107, 0.2, 0.004, 0, 0, 0, 0.0145, 0.03, 0.022, skin, 0.72, 0));
    append(mesh, pcs);
  }
  function boot(shin) {
    const mesh = meshOf(shin);
    if (!mesh) return;
    const g = mesh.geometry,
      p = g.attributes.position;
    let lo = 9;
    for (let i = 0; i < p.count; i++) lo = Math.min(lo, p.getY(i));
    const sole = [0.012, 0.012, 0.013];
    append(mesh, [
      // the sole, a touch longer than the boot, and a heel block
      piece(G.box, 0, lo + 0.004, -0.055, 0, 0, 0, 0.162, 0.03, 0.31, sole, 0.95, 0),
      piece(G.box, 0, lo + 0.012, 0.062, 0, 0, 0, 0.15, 0.046, 0.05, [0.02, 0.02, 0.022], 0.9, 0),
      // a welt line where the sole meets the boot
      piece(G.box, 0, lo + 0.026, -0.05, 0, 0, 0, 0.166, 0.006, 0.314, [0.3, 0.3, 0.3], 0.6, 0.1),
    ]);
  }
  const _bf = buildFighter;
  buildFighter = function () {
    const m = _bf.apply(this, arguments);
    try {
      const agent = arguments[1],
        id = agent ? agent.id || agent.key : "_default",
        st = CH_STYLE[id] || CH_STYLE._default || {};
      hand(m.armL.fore, 1);
      hand(m.armR.fore, -1);
      st.skin && st.hair && face(m, st);
      boot(m.legL.shin);
      boot(m.legR.shin);
    } catch (e) {
      console.warn("fighter details", e);
    }
    return m;
  };
})();
