(() => {
  // The hands you see over the gun, and the finish of the gun itself.
  //  · Arms were two same-width tubes with a ring at the wrist and a ball for a fist; the
  //    gun hid the hand. Now the sleeve tapers from the cuff to the elbow with creases, it has
  //    a hard forearm pad and a strap at the wrist, the left wrist wears a small watch, the
  //    glove has four fingers with knuckle bumps and a knuckle guard, and the fist is smaller
  //    so the gun shows.
  //  · Plain gun materials (no skin) were flat colours. They now carry a faint brushed or
  //    stippled finish with wear, so the shape of a gun reads in the light.
  // Everything is built where vmArm builds the old arm: the new pieces take over the flags
  // (reload animation, knife rig) the pieces next to them carry, so they move with them.
  if ("function" != typeof vmArm || "undefined" == typeof T || "undefined" == typeof GUNMAT) return;

  // ── shared finish textures ──
  const tex = (draw, w, h, rep) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    rep && t.repeat.set(rep, rep);
    t.anisotropy = 4;
    "colorSpace" in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
    return t;
  };
  let seed = 11;
  const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  // brushed metal: fine lines along the barrel, a few bright scratches and darker worn edges
  const brushed = tex((g, w, h) => {
    g.fillStyle = "#e6e6e6";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const y = R() * h,
        v = 200 + R() * 55;
      g.fillStyle = `rgba(${v},${v},${v},${0.18 + R() * 0.3})`;
      g.fillRect(R() * w * 0.4, y, w * (0.2 + R() * 0.6), 1);
    }
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.5 + R() * 0.4})`;
      g.lineWidth = 0.8;
      g.beginPath();
      const x = R() * w,
        y = R() * h;
      g.moveTo(x, y);
      g.lineTo(x + (R() - 0.5) * 70, y + (R() - 0.5) * 24);
      g.stroke();
    }
    g.fillStyle = "rgba(60,60,60,.55)";
    for (let i = 0; i < 40; i++) g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
  }, 128, 128);
  // polymer: stipple
  const stipple = tex((g, w, h) => {
    g.fillStyle = "#dedede";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const v = R() < 0.5 ? 255 : 150;
      g.fillStyle = `rgba(${v},${v},${v},${0.2 + R() * 0.35})`;
      g.fillRect(R() * w, R() * h, 1.5, 1.5);
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = "rgba(255,255,255,.35)";
      g.fillRect(R() * w, R() * h, 6 + R() * 14, 1);
    }
  }, 128, 128);
  const FINISH = { steel: brushed, gunmetal: brushed, blued: brushed, black: brushed, polymer: stipple, darkpoly: stipple, rubber: stipple, tan: stipple, olive: stipple };
  for (const k of Object.keys(FINISH)) {
    const orig = GUNMAT[k];
    if ("function" != typeof orig) continue;
    GUNMAT[k] = function () {
      const m = orig.apply(this, arguments);
      // skins bring their own texture: only plain materials get the finish
      if (m && m.isMeshStandardMaterial && !m.map && !m.userData.finished) {
        m.map = FINISH[k];
        m.userData.finished = !0;
        m.color.multiplyScalar(1.22);
        m.needsUpdate = !0;
      }
      return m;
    };
  }

  // ── the arms ──
  const MAT = {};
  const std = (key, o) => MAT[key] || (MAT[key] = new T.MeshStandardMaterial(o));
  const padM = () => std("pad", { color: 0x2f353d, roughness: 0.55, metalness: 0.45 });
  const strapM = () => std("strap", { color: 0x17191c, roughness: 0.92, metalness: 0 });
  const buckleM = () => std("buckle", { color: 0xaab1b8, roughness: 0.3, metalness: 0.85 });
  const seamM = () => std("seam", { color: 0x0f1113, roughness: 0.95, metalness: 0 });
  const screenM = (c) => std("scr" + c, { color: 0x101418, emissive: c, emissiveIntensity: 1.1, roughness: 0.3 });
  const geoCache = {};
  const cacheGeo = (k, make) => geoCache[k] || (geoCache[k] = make());
  // a sleeve: tight at the cuff, full at the elbow, with creases along the forearm.
  // Local y runs from the wrist (-l/2) to the elbow (+l/2) like the cylinder it replaces.
  const sleeveGeo = (l) =>
    cacheGeo("sleeve" + l.toFixed(3), () => {
      const pts = [],
        n = 20;
      for (let i = 0; i <= n; i++) {
        const u = i / n,
          y = -l / 2 + u * l,
          base = 0.039 + 0.021 * Math.pow(u, 0.8),
          fold = u > 0.18 ? 0.0034 * Math.sin(u * 46) * Math.min(1, (u - 0.18) * 4) : 0,
          cuff = u < 0.08 ? 0.006 * (1 - u / 0.08) : 0;
        pts.push(new T.Vector2(base + fold + cuff, y));
      }
      return new T.LatheGeometry(pts, 12);
    });
  const geo = {
    pad: () => cacheGeo("pad", () => new T.BoxGeometry(0.044, 0.11, 0.008)),
    padEdge: () => cacheGeo("padEdge", () => new T.BoxGeometry(0.048, 0.016, 0.01)),
    strap: () => cacheGeo("strap", () => new T.CylinderGeometry(0.052, 0.052, 0.022, 16, 1, true)),
    buckle: () => cacheGeo("buckle", () => new T.BoxGeometry(0.02, 0.016, 0.01)),
    seam: () => cacheGeo("seam", () => new T.TorusGeometry(0.045, 0.0016, 3, 12)),
    finger: () => cacheGeo("finger", () => new T.CapsuleGeometry(0.0105, 0.026, 1, 6)),
    tip: () => cacheGeo("tip", () => new T.CapsuleGeometry(0.0095, 0.014, 1, 6)),
    knuckle: () => cacheGeo("knuckle", () => new T.SphereGeometry(0.0125, 6, 4)),
    guard: () => cacheGeo("guard", () => new T.BoxGeometry(0.058, 0.01, 0.034)),
    ridge: () => cacheGeo("ridge", () => new T.BoxGeometry(0.008, 0.006, 0.03)),
    watch: () => cacheGeo("watch", () => new T.BoxGeometry(0.036, 0.011, 0.036)),
    face: () => cacheGeo("face", () => new T.PlaneGeometry(0.026, 0.026)),
  };
  const _arm = vmArm;
  vmArm = function (parent, hand, elbow, sl, gl, tr, isLeft) {
    const n0 = parent && parent.children ? parent.children.length : 0;
    const r = _arm.apply(this, arguments);
    try {
      dress(parent, n0, hand, elbow, sl, gl, tr, !!isLeft);
    } catch (e) {
      console.warn("hands", e);
    }
    return r;
  };
  function dress(parent, n0, hand, elbow, sl, gl, tr, left) {
    const kids = parent.children.slice(n0);
    if (kids.length < 7 || !hand || !elbow) return;
    // the pieces the base arm made, in the order it made them
    const [sleeve, ring, wrist, fist, thumb, index, back] = kids;
    if (!sleeve.geometry || "CylinderGeometry" !== sleeve.geometry.type) return;
    const len = sleeve.geometry.parameters.height;
    // what the neighbours carry (reload animation: live + lhand; knife rig: armPart)
    const flags = Object.assign({}, kids[0].userData);
    const tag = (m) => {
      for (const k of ["live", "lhand", "armPart"]) flags[k] && (m.userData[k] = flags[k]);
      m.renderOrder = kids[0].renderOrder;
      m.frustumCulled = kids[0].frustumCulled;
      return m;
    };
    const add = (g, mat, x, y, z, rx, ry, rz, to) => {
      const m = new T.Mesh(g, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      (to || parent).add(tag(m));
      return m;
    };
    // the sleeve: tapered with creases
    sleeve.geometry = sleeveGeo(len);
    // where is "up" for this arm: the world's up, projected off the arm's axis, in the sleeve's own frame
    const axis = new T.Vector3().subVectors(elbow, hand).normalize();
    const up = new T.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
    const inv = sleeve.quaternion.clone().invert();
    const upL = up.clone().applyQuaternion(inv);
    // sleeve-local frame basis: y along the arm, p = up, q = across
    const q = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), upL).normalize();
    const basis = new T.Matrix4().makeBasis(q, new T.Vector3(0, 1, 0), upL.clone().normalize());
    const place = (m, y, out, across) => {
      m.position.set(q.x * (across || 0) + upL.x * out, y, q.z * (across || 0) + upL.z * out);
      m.quaternion.setFromRotationMatrix(basis);
      m.userData.live = flags.live;
      return m;
    };
    // a hard forearm pad with a lip, on the top of the arm
    const mkSleeveChild = (g, mat, y, out, across) => {
      const m = new T.Mesh(g, mat);
      tag(m);
      sleeve.add(m);
      return place(m, y, out, across);
    };
    const rad = (u) => 0.039 + 0.021 * Math.pow(u, 0.8);
    const yAt = (u) => -len / 2 + u * len;
    mkSleeveChild(geo.pad(), padM(), yAt(0.42), rad(0.42) + 0.0015, 0);
    mkSleeveChild(geo.padEdge(), padM(), yAt(0.42) + 0.058, rad(0.42) + 0.0005, 0);
    mkSleeveChild(geo.padEdge(), padM(), yAt(0.42) - 0.058, rad(0.42) - 0.0005, 0);
    // stitched seams and a strap just above the cuff
    for (const u of [0.1, 0.2]) {
      const m = new T.Mesh(geo.seam(), seamM());
      tag(m);
      m.rotation.x = Math.PI / 2;
      m.position.y = yAt(u);
      m.scale.setScalar(rad(u) / 0.045 + 0.02);
      sleeve.add(m);
    }
    const strap = new T.Mesh(geo.strap(), strapM());
    tag(strap);
    strap.position.y = yAt(0.15);
    strap.scale.set(rad(0.15) / 0.052 + 0.1, 1, rad(0.15) / 0.052 + 0.1);
    sleeve.add(strap);
    mkSleeveChild(geo.buckle(), buckleM(), yAt(0.15), rad(0.15) + 0.014, 0);
    // a watch on the left wrist, its face in the agent's colour
    if (left) {
      const col = tr && tr.emissive ? tr.emissive.getHex() : 0x66ccff;
      mkSleeveChild(geo.watch(), padM(), yAt(0.31), rad(0.31) + 0.007, 0.004);
      const f = mkSleeveChild(geo.face(), screenM(col), yAt(0.31), rad(0.31) + 0.0135, 0.004);
      f.rotateX(-Math.PI / 2);
    }
    // the glove: a smaller fist so the gun shows, four fingers wrapped round, knuckles and a guard
    fist.scale.multiplyScalar(0.8);
    const dirX = left ? 1 : -1; // the side the base arm puts its thumb on is the other one
    const glove = gl;
    const hx = hand.x,
      hy = hand.y,
      hz = hand.z;
    for (let i = 0; i < 4; i++) {
      const off = 0.03 - i * 0.021;
      // proximal bone then curled tip, across the front of the hand
      const a = add(geo.finger(), glove, hx - dirX * 0.002, hy + off, hz - 0.04, 0, 0, Math.PI / 2 + 0.05 * (i - 1.5));
      a.scale.set(1, 1.15 - i * 0.05, 1);
      add(geo.tip(), glove, hx + dirX * 0.034, hy + off - 0.003, hz - 0.03, 0.4, 0, Math.PI / 2);
      add(geo.knuckle(), glove, hx - dirX * 0.012, hy + off, hz - 0.052);
    }
    add(geo.guard(), padM(), hx + dirX * 0.002, hy + 0.049, hz - 0.012, 0.05, 0, 0);
    for (let i = -1; i <= 1; i++) add(geo.ridge(), strapM(), hx + dirX * 0.002 + i * 0.016, hy + 0.057, hz - 0.012);
  }
  window.VM_HANDS = { sleeveGeo };
})();
