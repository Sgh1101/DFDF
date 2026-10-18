
(() => {
  // Knives. The knife kills in one cut, and its skins can be other knives
  // altogether, each with its own build and its own hands: a balisong that
  // flips open, a karambit that spins on the finger, a kukri that chops, a
  // tanto drawn from the back, a folding knife that flicks out. Every blade
  // is drawn as an outline in its side plane and given thickness with a
  // bevelled edge, so it reads as a blade and not as a bar. Parts that move
  // (the balisong's handles, the folding blade, the karambit around its ring)
  // are kept out of the viewmodel bake so they can turn.
  if ("undefined" == typeof WEAPONS || !WEAPONS.knife || "undefined" == typeof GUNMAT || "undefined" == typeof T || "undefined" == typeof VM) return;
  // one cut is enough, armour or not
  WEAPONS.knife.dmg = 400;
  const PI = Math.PI;
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x),
    ezS = "function" == typeof _ezS ? _ezS : (x) => x * x * (3 - 2 * x),
    ezO = "function" == typeof _ezO ? _ezO : (x) => 1 - Math.pow(1 - x, 3),
    seg = (t, a, b) => c01((t - a) / (b - a));
  const live = (m) => ((m.userData.live = !0), m);
  const mesh = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    (rx || ry || rz) && m.rotation.set(rx || 0, ry || 0, rz || 0);
    return m;
  };
  const box = (mat, w, h, d, x, y, z, rx, ry, rz) => mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
  const cyl = (mat, r1, r2, h, n, x, y, z, rx, ry, rz) => mesh(new T.CylinderGeometry(r1, r2, h, n || 10), mat, x, y, z, rx, ry, rz);
  // a pin across the knife (along x)
  const pin = (mat, r, len, x, y, z, n) => cyl(mat, r, r, len, n || 12, x, y, z, 0, 0, PI / 2);
  const torus = (mat, r, tube, n, x, y, z, rx, ry, rz) => mesh(new T.TorusGeometry(r, tube, 8, n || 16), mat, x, y, z, rx, ry, rz);
  // a ring around the grip (around z), squeezed to the grip's oval
  const band = (mat, r, tube, sy, x, y, z, tilt) => {
    const t = torus(mat, r, tube, 18, x, y, z, tilt || 0, 0, 0);
    t.scale.set(1, sy, 1);
    return t;
  };

  // ── outlines: points [z, y] in the knife's side plane, the tip toward -z;
  //    2 numbers = a line, 4 = a quadratic (control, end), 6 = a cubic ──
  const trace = (p, pts) => {
    pts.forEach((q, i) => {
      if (0 === i) p.moveTo(q[0], q[1]);
      else if (2 === q.length) p.lineTo(q[0], q[1]);
      else if (4 === q.length) p.quadraticCurveTo(q[0], q[1], q[2], q[3]);
      else p.bezierCurveTo(q[0], q[1], q[2], q[3], q[4], q[5]);
    });
    p.closePath();
  };
  // the outline given thickness across x, centred, with a bevel that makes the edge;
  // o: holes (outlines), bs (bevel width, default = depth), uv (texture repeats), x/y/z
  function prof(mat, pts, thick, bevel, o) {
    o = o || {};
    const sh = new T.Shape();
    trace(sh, pts);
    (o.holes || []).forEach((h) => {
      const p = new T.Path();
      trace(p, h);
      sh.holes.push(p);
    });
    const b = Math.max(0, Math.min(bevel || 0, thick / 2 - 0.0005)),
      depth = Math.max(0.001, thick - 2 * b);
    const geo = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: void 0 === o.bs ? b : o.bs, bevelSegments: o.seg || 2, curveSegments: o.cs || 12 });
    geo.translate(0, 0, -depth / 2);
    geo.rotateY(-PI / 2);
    if (o.uv && geo.attributes.uv) {
      const a = geo.attributes.uv.array;
      for (let i = 0; i < a.length; i++) a[i] *= o.uv;
    }
    return mesh(geo, mat, o.x, o.y, o.z, o.rx, o.ry, o.rz);
  }
  const bez = (p0, p1, p2, p3, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        u = 1 - t,
        a = u * u * u,
        b = 3 * u * u * t,
        c = 3 * u * t * t,
        d = t * t * t;
      out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
    return out;
  };
  const arc = (cz, cy, r, a0, a1, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      out.push([cz + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return out;
  };
  const shift = (pts, dy) => pts.map((p) => [p[0], p[1] + dy]);
  const rrect = (z0, z1, y0, y1, r) => [[z0 + r, y0], [z1 - r, y0], [z1, y0, z1, y0 + r], [z1, y1 - r], [z1, y1, z1 - r, y1], [z0 + r, y1], [z0, y1, z0, y1 - r], [z0, y0 + r], [z0, y0, z0 + r, y0]];
  // a slanted slot, cut through a handle
  const slot = (z0, y0, len, h, lean) => [[z0, y0], [z0 + len, y0], [z0 + len + lean, y0 + h], [z0 + lean, y0 + h]];
  const part = (name, x, y, z) => {
    const g = new T.Group();
    g.position.set(x || 0, y || 0, z || 0);
    g.userData.kpart = name;
    return g;
  };
  // everything inside a moving part stays its own mesh
  const finish = (g) => {
    g.traverse((o) => o.userData && o.userData.kpart && o.traverse((m) => m.isMesh && live(m)));
    return g;
  };

  // ── the builds: blade toward -z, handle toward +z, like the game's own knife ──
  const BUILD = {
    // the knife everyone starts with: a combat knife, a clip point with a belly,
    // sawback teeth on the spine, a crossguard, a ribbed grip and a pommel
    stock() {
      const g = new T.Group(),
        bl = GUNMAT.steel(),
        st = GUNMAT.steel(),
        pm = GUNMAT.polymer(),
        rb = GUNMAT.rubber(),
        bd = GUNMAT.blued(),
        gl = GUNMAT.glow(0xff5c28);
      const spine = [[-0.012, 0.034], [-0.07, 0.034]];
      for (let i = 0; i < 6; i++) spine.push([-0.08 - 0.02 * i, 0.026], [-0.09 - 0.02 * i, 0.034]);
      spine.push([-0.27, 0.034], [-0.35, 0.012, -0.424, 0.006], [-0.433, 0.003, -0.428, -0.003]);
      const edge = [[-0.36, -0.047, -0.24, -0.038], [-0.05, -0.038], [-0.04, -0.03], [-0.012, -0.03]];
      g.add(prof(bl, [...spine, ...edge], 0.016, 0.006, { bs: 0.007 }));
      g.add(prof(gl, rrect(-0.3, -0.05, 0.012, 0.02, 0.003), 0.0175, 0));
      g.add(prof(st, rrect(-0.008, 0.008, -0.05, 0.046, 0.004), 0.03, 0.003));
      g.add(prof(pm, [[0.01, 0.03], [0.13, 0.047, 0.235, 0.03], [0.248, 0.02], [0.248, -0.04], [0.13, -0.061, 0.01, -0.038]], 0.036, 0.011, { uv: 3 }));
      for (let i = 0; i < 5; i++) g.add(band(rb, 0.021, 0.0045, 1.9, 0, -0.004, 0.05 + 0.038 * i));
      g.add(prof(bd, rrect(0.248, 0.268, -0.042, 0.022, 0.006), 0.034, 0.005));
      g.add(torus(bd, 0.009, 0.003, 12, 0, -0.054, 0.262));
      return g;
    },
    // a balisong, open: a tanto blade with serrations on a black tang, two slotted
    // handles on their pins, a latch on the bite handle
    butterfly() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        tn = GUNMAT.tan(),
        ch = GUNMAT.chrome(),
        bk = GUNMAT.black(),
        gl = GUNMAT.glow(0x40c4ff);
      const blade = [[0.03, 0.026], [-0.015, 0.026], [-0.31, 0.026], [-0.35, 0.022, -0.362, 0.012], [-0.367, 0.007, -0.36, 0.002], [-0.29, -0.028], [-0.12, -0.028]];
      for (let i = 0; i < 3; i++) blade.push([-0.11 + 0.02 * i, -0.016, -0.1 + 0.02 * i, -0.028]);
      blade.push([-0.045, -0.028], [-0.04, -0.02], [-0.015, -0.02], [-0.015, -0.026], [0.03, -0.026]);
      g.add(prof(bl, blade, 0.012, 0.004, { bs: 0.006 }));
      // the grind along the edge and the swedge by the tip stay bright on the dark blade
      g.add(prof(ch, [[-0.29, -0.027], [-0.13, -0.027], [-0.13, -0.021], [-0.284, -0.021]], 0.0125, 0));
      g.add(prof(ch, [[-0.2, 0.02], [-0.34, 0.02], [-0.355, 0.014], [-0.2, 0.015]], 0.0125, 0));
      g.add(box(bk, 0.014, 0.054, 0.05, 0, 0, 0.004));
      g.add(pin(ch, 0.006, 0.036, 0, 0.014, 0));
      g.add(pin(ch, 0.006, 0.036, 0, -0.014, 0));
      // each handle: two plates with slanted slots, spacers between, one plate face lit
      const handle = (name, y, sign) => {
        const h = part(name, 0, y, 0);
        const pts = [...arc(0, 0, 0.014, PI / 2, 1.5 * PI, 8), [0.33, -0.014], [0.35, -0.008], [0.355, 0], [0.35, 0.009], [0.34, 0.014]];
        const holes = [0.034, 0.066, 0.098, 0.245, 0.277].map((z) => slot(z, -0.0085, 0.016, 0.017, 0.011));
        for (const sx of [-0.0115, 0.0115]) h.add(prof(tn, pts, 0.007, 0.0015, { holes, x: sx, uv: 3 }));
        for (const z of [0.19, 0.335]) h.add(pin(bk, 0.005, 0.016, 0, 0, z, 8));
        h.add(box(gl, 0.032, 0.004, 0.01, 0, 0.006 * sign, 0.2));
        sign < 0 && h.add(box(ch, 0.02, 0.005, 0.02, 0, -0.016, 0.33));
        g.add(h);
      };
      handle("hA", 0.014, 1);
      handle("hB", -0.014, -1);
      return finish(g);
    },
    // a karambit: a hooked claw off a grooved grip, a chrome pivot at the root,
    // the ring at the back; the whole knife turns around the ring
    karambit() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        bk = GUNMAT.black(),
        ch = GUNMAT.chrome(),
        gl = GUNMAT.glow(0xff3d5a);
      const spin = part("spin", 0, 0.008, 0.25);
      spin.add(torus(ch, 0.03, 0.0065, 20, 0, 0, 0, 0, PI / 2, 0));
      const handle = [[-0.016, 0.026], [-0.255, 0.02], [-0.272, 0.01], [-0.272, -0.02], [-0.258, -0.034], [-0.245, -0.036], [-0.21, -0.014, -0.175, -0.036], [-0.168, -0.038], [-0.133, -0.016, -0.098, -0.036], [-0.09, -0.038], [-0.06, -0.018, -0.03, -0.03], [-0.016, -0.02]];
      spin.add(prof(bk, handle, 0.026, 0.007, { uv: 3 }));
      spin.add(pin(ch, 0.015, 0.03, 0, -0.004, -0.248, 16));
      spin.add(pin(ch, 0.005, 0.03, 0, 0.004, -0.12, 8));
      spin.add(box(gl, 0.028, 0.003, 0.12, 0, 0.0215, -0.13));
      const claw = [[-0.252, 0.016], [-0.39, 0.03, -0.5, -0.06, -0.462, -0.196], [-0.46, -0.204, -0.453, -0.2], [-0.44, -0.11, -0.36, -0.045, -0.252, -0.03]];
      spin.add(prof(bl, claw, 0.013, 0.005, { bs: 0.007 }));
      g.add(spin);
      return finish(g);
    },
    // a kukri: a heavy blade that bends forward into a belly, the notch at its
    // base, a brass bolster, a wooden grip with a flared butt
    kukri() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        br = GUNMAT.brass(),
        wd = GUNMAT.wood(),
        bd = GUNMAT.blued();
      const spineC = bez([-0.09, 0.026], [-0.22, 0.018], [-0.33, -0.03], [-0.375, -0.09], 16);
      const edgeA = bez([-0.38, -0.1], [-0.372, -0.136], [-0.3, -0.166], [-0.24, -0.156], 10),
        edgeB = bez([-0.24, -0.156], [-0.17, -0.15], [-0.1, -0.086], [-0.07, -0.046], 10);
      const blade = [[-0.012, 0.028], [-0.09, 0.026], ...spineC.slice(1), [-0.383, -0.096, -0.38, -0.1], ...edgeA.slice(1), ...edgeB.slice(1), [-0.062, -0.04], [-0.052, -0.06, -0.044, -0.04], [-0.012, -0.034]];
      g.add(prof(bl, blade, 0.02, 0.007, { bs: 0.008 }));
      // the fuller follows the spine
      const top = [[-0.04, 0.027], [-0.09, 0.026], ...spineC.slice(1).filter((p) => p[0] > -0.31)];
      g.add(prof(bd, [...shift(top, -0.011), ...shift(top, -0.017).reverse()], 0.022, 0));
      g.add(prof(br, rrect(-0.012, 0.012, -0.042, 0.034, 0.005), 0.034, 0.004));
      g.add(prof(wd, [[0.012, 0.03], [0.11, 0.042, 0.2, 0.032], [0.238, 0.046], [0.25, 0.03], [0.25, -0.05], [0.238, -0.062], [0.2, -0.046], [0.11, -0.054, 0.012, -0.04]], 0.034, 0.011, { uv: 3 }));
      g.add(band(br, 0.02, 0.004, 1.9, 0, -0.006, 0.125));
      g.add(prof(br, rrect(0.25, 0.262, -0.052, 0.032, 0.005), 0.032, 0.004));
      return g;
    },
    // a tanto: a straight blade with the angled point, a temper line, a collar,
    // a round guard, a cord-wrapped grip with an ornament under the wrap
    tanto() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        ch = GUNMAT.chrome(),
        br = GUNMAT.brass(),
        bk = GUNMAT.black(),
        rb = GUNMAT.rubber(),
        gl = GUNMAT.glow(0xffffff);
      g.add(prof(bl, [[-0.012, 0.027], [-0.33, 0.027], [-0.386, 0.019], [-0.393, 0.014, -0.388, 0.009], [-0.3, -0.031], [-0.04, -0.031], [-0.03, -0.024], [-0.012, -0.024]], 0.015, 0.005, { bs: 0.007 }));
      g.add(prof(gl, [[-0.05, -0.015], [-0.29, -0.015], [-0.35, 0.012], [-0.35, 0.016], [-0.288, -0.011], [-0.05, -0.011]], 0.0165, 0));
      g.add(box(br, 0.02, 0.058, 0.022, 0, 0, -0.013));
      const tsuba = cyl(ch, 0.042, 0.042, 0.006, 24, 0, 0, 0.006, PI / 2, 0, 0);
      tsuba.scale.x = 0.72;
      g.add(tsuba);
      g.add(prof(bk, [[0.01, 0.026], [0.25, 0.022], [0.264, 0.012], [0.264, -0.024], [0.25, -0.034], [0.01, -0.03]], 0.028, 0.008, { uv: 3 }));
      for (let i = 0; i < 9; i++) g.add(band(rb, 0.016, 0.0035, 1.75, 0, -0.003, 0.035 + 0.025 * i, (i % 2 ? 1 : -1) * 0.55));
      g.add(box(gl, 0.034, 0.006, 0.024, 0, 0.002, 0.13));
      g.add(prof(ch, rrect(0.264, 0.274, -0.03, 0.018, 0.004), 0.026, 0.003));
      return g;
    },
    // a folding knife: steel liners under textured scales, a pocket clip, the
    // clip-point blade on its pivot with a flipper tab and a thumb stud
    flip() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        st = GUNMAT.steel(),
        pm = GUNMAT.polymer(),
        ch = GUNMAT.chrome(),
        gl = GUNMAT.glow(0x00e5ff);
      const PV = 0.03;
      const hp = (ins) => [[PV, 0.03 - ins], [0.26, 0.027 - ins], [0.305 - ins, 0.016], [0.312 - ins, 0], [0.305 - ins, -0.022], [0.14, -0.03 + ins], [0.07, -0.036 + ins, 0.045, -0.028 + ins], ...arc(PV, 0, 0.03 - ins, -PI / 2, -1.5 * PI, 10).slice(1)];
      g.add(prof(st, hp(0), 0.028, 0.002));
      g.add(prof(pm, hp(0.0035), 0.038, 0.004, { uv: 3 }));
      g.add(pin(ch, 0.011, 0.042, 0, 0, PV, 14));
      g.add(box(st, 0.003, 0.011, 0.15, 0.0215, 0.008, 0.225));
      g.add(pin(ch, 0.004, 0.044, 0, 0.008, 0.29, 8));
      g.add(box(gl, 0.04, 0.0035, 0.17, 0, -0.003, 0.175));
      const blade = part("blade", 0, 0, PV);
      const bp = [...arc(0, 0, 0.027, 0.42 * PI, -0.42 * PI, 10), [0, -0.03], [0.006, -0.05], [-0.012, -0.046], [-0.02, -0.03], [-0.03, -0.021], [-0.04, -0.03], [-0.18, -0.03], [-0.25, -0.03, -0.278, 0], [-0.25, 0.018, -0.2, 0.024], [-0.02, 0.026], [0, 0.026]];
      blade.add(prof(bl, bp, 0.013, 0.0045, { bs: 0.006 }));
      blade.add(pin(ch, 0.0045, 0.012, 0.012, 0.014, -0.04, 8));
      g.add(blade);
      return finish(g);
    },
    // a bayonet (the M9 kind): a clip point with sawteeth on the spine and the
    // slot for the wire cutter, a crossguard with the muzzle ring on top, a
    // chequered grip, a pommel with the rifle latch
    bayonet() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        st = GUNMAT.steel(),
        bd = GUNMAT.blued(),
        pm = GUNMAT.darkpoly(),
        ch = GUNMAT.chrome(),
        gl = GUNMAT.glow(0x9be7ff);
      const spine = [[-0.012, 0.031], [-0.07, 0.031]];
      for (let i = 0; i < 7; i++) spine.push([-0.078 - 0.018 * i, 0.022], [-0.087 - 0.018 * i, 0.031]);
      spine.push([-0.27, 0.031], [-0.33, 0.026, -0.395, 0.002], [-0.405, -0.004, -0.398, -0.01]);
      const edge = [[-0.35, -0.046, -0.26, -0.045], [-0.05, -0.043], [-0.04, -0.034], [-0.012, -0.034]];
      g.add(prof(bl, [...spine, ...edge], 0.016, 0.006, { bs: 0.007, holes: [rrect(-0.095, -0.05, -0.022, -0.008, 0.007)] }));
      // the swedge along the clip and the fuller stay bright
      g.add(prof(ch, [[-0.3, 0.024], [-0.37, 0.012], [-0.385, 0.002], [-0.3, 0.017]], 0.0165, 0));
      g.add(prof(gl, rrect(-0.27, -0.11, 0.006, 0.012, 0.003), 0.0168, 0));
      g.add(prof(st, rrect(-0.009, 0.009, -0.058, 0.05, 0.005), 0.032, 0.003));
      g.add(torus(st, 0.015, 0.0055, 18, 0, 0.068, -0.002));
      g.add(prof(pm, [[0.01, 0.03], [0.12, 0.044, 0.215, 0.032], [0.226, 0.026], [0.226, -0.038], [0.12, -0.056, 0.01, -0.04]], 0.036, 0.011, { uv: 4 }));
      for (let i = 0; i < 6; i++) g.add(band(pm, 0.0205, 0.004, 1.85, 0, -0.004, 0.035 + 0.031 * i));
      g.add(prof(bd, rrect(0.226, 0.262, -0.044, 0.03, 0.008), 0.034, 0.006));
      g.add(box(ch, 0.012, 0.01, 0.026, 0, 0.036, 0.244));
      g.add(pin(ch, 0.006, 0.038, 0, -0.03, 0.25, 10));
      return g;
    },
    // a gut knife: a drop point with the hook cut into its spine, a short guard,
    // a rubber grip with finger grooves and a lanyard hole
    gut() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        st = GUNMAT.steel(),
        rb = GUNMAT.rubber(),
        ch = GUNMAT.chrome(),
        gl = GUNMAT.glow(0xb2ff59);
      const blade = [[-0.012, 0.028], [-0.16, 0.03], [-0.172, 0.03], [-0.19, -0.004, -0.214, 0.012], [-0.226, 0.022, -0.222, 0.04], [-0.3, 0.034, -0.37, -0.004], [-0.376, -0.012, -0.366, -0.02], [-0.33, -0.05, -0.25, -0.048], [-0.05, -0.042], [-0.04, -0.033], [-0.012, -0.033]];
      g.add(prof(bl, blade, 0.015, 0.0055, { bs: 0.007 }));
      // the hook's own sharpened edge, polished
      g.add(prof(ch, [[-0.176, 0.026], [-0.19, 0.0, -0.21, 0.011], [-0.214, 0.016], [-0.19, 0.006, -0.178, 0.03]], 0.0158, 0));
      g.add(prof(gl, rrect(-0.15, -0.06, -0.006, 0.0, 0.003), 0.0162, 0));
      g.add(prof(st, rrect(-0.008, 0.008, -0.046, 0.04, 0.005), 0.03, 0.003));
      const grip = [[0.008, 0.03], [0.1, 0.036, 0.2, 0.03], [0.232, 0.022], [0.236, -0.03], [0.22, -0.046], [0.19, -0.028, 0.16, -0.046], [0.13, -0.03, 0.1, -0.048], [0.07, -0.03, 0.04, -0.046], [0.02, -0.034], [0.008, -0.036]];
      g.add(prof(rb, grip, 0.034, 0.011, { uv: 3, holes: [arc(0.214, -0.008, 0.008, 0, 2 * PI, 12)] }));
      g.add(prof(ch, rrect(0.236, 0.246, -0.032, 0.024, 0.004), 0.03, 0.003));
      g.add(box(gl, 0.036, 0.004, 0.11, 0, 0.032, 0.11));
      return g;
    },
    // a bowie: a long clip point with a sharpened false edge, a brass guard with
    // balled quillons, a grip of stacked leather rings between spacers, a brass pommel
    bowie() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        ch = GUNMAT.chrome(),
        br = GUNMAT.brass(),
        tn = GUNMAT.tan(),
        wd = GUNMAT.woodDark(),
        bk = GUNMAT.black();
      const blade = [[-0.012, 0.034], [-0.27, 0.037], [-0.3, 0.036], [-0.39, 0.026, -0.47, -0.006], [-0.476, -0.012, -0.466, -0.018], [-0.43, -0.06, -0.32, -0.058], [-0.07, -0.05], [-0.06, -0.04], [-0.012, -0.04]];
      g.add(prof(bl, blade, 0.019, 0.0065, { bs: 0.008 }));
      g.add(prof(ch, [[-0.3, 0.03], [-0.39, 0.02, -0.455, -0.004], [-0.46, -0.008], [-0.38, 0.012, -0.3, 0.023]], 0.0195, 0));
      g.add(prof(bk, rrect(-0.27, -0.06, 0.012, 0.02, 0.004), 0.0198, 0));
      g.add(prof(br, rrect(-0.01, 0.01, -0.072, 0.062, 0.006), 0.026, 0.004));
      for (const y of [-0.074, 0.064]) g.add(mesh(new T.SphereGeometry(0.011, 12, 9), br, 0, y, 0));
      g.add(prof(bk, [[0.01, 0.033], [0.24, 0.031], [0.24, -0.043], [0.01, -0.045]], 0.03, 0.009));
      for (let i = 0; i < 14; i++) g.add(band(i % 4 === 3 ? bk : i % 2 ? tn : wd, 0.0225, 0.0062, 1.6, 0, -0.006, 0.02 + 0.016 * i));
      g.add(prof(br, rrect(0.24, 0.258, -0.048, 0.036, 0.008), 0.036, 0.006));
      const dome = mesh(new T.SphereGeometry(0.03, 16, 10, 0, 2 * PI, 0, PI / 2), br, 0, -0.006, 0.258, PI / 2, 0, 0);
      dome.scale.set(0.6, 0.45, 1.4);
      g.add(dome);
      return g;
    },
    // a kunai: a leaf-shaped double-edged blade with a ridge down the middle, a
    // cord-wrapped handle and the ring at its end, which it turns on
    kunai() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        ch = GUNMAT.chrome(),
        bk = GUNMAT.black(),
        rb = GUNMAT.rubber(),
        gl = GUNMAT.glow(0xff2bd6);
      const leaf = [[-0.012, 0.014], [-0.05, 0.044, -0.12, 0.04], [-0.31, 0.0], [-0.12, -0.04, -0.05, -0.044], [-0.012, -0.014]];
      g.add(prof(bl, leaf, 0.017, 0.0075, { bs: 0.012 }));
      g.add(prof(ch, [[-0.02, 0.003], [-0.29, 0.0005], [-0.29, -0.0005], [-0.02, -0.003]], 0.019, 0));
      g.add(prof(gl, [[-0.03, 0.012], [-0.06, 0.03, -0.11, 0.028], [-0.1, 0.022, -0.04, 0.008]], 0.0175, 0));
      g.add(prof(gl, [[-0.03, -0.012], [-0.06, -0.03, -0.11, -0.028], [-0.1, -0.022, -0.04, -0.008]], 0.0175, 0));
      g.add(cyl(bk, 0.012, 0.012, 0.19, 10, 0, 0, 0.09, PI / 2, 0, 0));
      for (let i = 0; i < 11; i++) g.add(band(rb, 0.0135, 0.0042, 1.25, 0, 0, 0.012 + 0.0155 * i, (i % 2 ? 1 : -1) * 0.5));
      g.add(cyl(ch, 0.014, 0.011, 0.012, 12, 0, 0, 0.19, PI / 2, 0, 0));
      g.add(cyl(ch, 0.011, 0.014, 0.01, 12, 0, 0, -0.006, PI / 2, 0, 0));
      // the ring is its own part: the kunai turns on it, round the finger
      const ring = part("ring", 0, 0, 0.222);
      ring.add(torus(ch, 0.026, 0.006, 20, 0, 0, 0, 0, PI / 2, 0));
      g.add(ring);
      return finish(g);
    },
    // a stiletto that fires out of the front: a slim double-edged dagger blade
    // that slides out of a machined handle, a thumb slider, chrome ends, a
    // glass breaker at the back
    stiletto() {
      const g = new T.Group(),
        bl = GUNMAT.blade(),
        ch = GUNMAT.chrome(),
        bk = GUNMAT.black(),
        bd = GUNMAT.blued(),
        gl = GUNMAT.glow(0xffd54f);
      const hdl = [[-0.004, 0.026], [0.22, 0.026], [0.236, 0.016], [0.236, -0.03], [0.22, -0.04], [0.15, -0.034, 0.08, -0.04], [-0.004, -0.032]];
      g.add(prof(bk, hdl, 0.03, 0.006, { uv: 3 }));
      g.add(prof(bd, rrect(0.0, 0.22, -0.034, 0.022, 0.006), 0.034, 0.002));
      g.add(prof(gl, rrect(0.02, 0.2, 0.024, 0.028, 0.002), 0.012, 0));
      g.add(prof(gl, rrect(0.02, 0.2, -0.039, -0.035, 0.002), 0.012, 0));
      g.add(prof(ch, rrect(-0.018, 0.004, -0.034, 0.028, 0.008), 0.034, 0.005));
      g.add(prof(ch, rrect(0.232, 0.256, -0.032, 0.02, 0.008), 0.032, 0.005));
      g.add(mesh(new T.ConeGeometry(0.008, 0.014, 4), ch, 0, -0.006, 0.264, PI / 2, 0, 0));
      g.add(box(ch, 0.014, 0.008, 0.03, 0, 0.03, 0.08));
      // the blade on its track: slides back into the handle along z
      const blade = part("blade", 0, -0.004, -0.004);
      blade.add(prof(bl, [[0.0, 0.016], [-0.19, 0.016], [-0.245, 0.007, -0.272, 0.0], [-0.245, -0.007, -0.19, -0.016], [0.0, -0.016]], 0.011, 0.005, { bs: 0.007 }));
      blade.add(prof(ch, [[-0.01, 0.002], [-0.235, 0.0005], [-0.235, -0.0005], [-0.01, -0.002]], 0.0125, 0));
      g.add(blade);
      return finish(g);
    },
  };
  // where the hand closes on each knife: [y, z] of the grip's middle
  const HAND = { butterfly: [-0.01, 0.19], karambit: [0.004, 0.157], kukri: [-0.016, 0.13], tanto: [-0.014, 0.14], flip: [-0.012, 0.17], bayonet: [-0.008, 0.12], gut: [-0.008, 0.125], bowie: [-0.006, 0.13], kunai: [0, 0.095], stiletto: [-0.006, 0.12] };
  // how a knife is turned in the hand before the hand closes on it: the karambit
  // is held in a reverse grip, the ring up on the index finger, the handle down
  // through the fist and the claw out below it, curling forward
  const GRIP = { karambit: [-PI / 2, 0, PI] };
  // the game's hand is one ball at the grip point; a reverse grip wants the
  // other fingers closed down the handle too: [length along the handle, radius]
  const FIST = { karambit: [0.175, 0.04] };
  // how each knife sits in the hand: [rx, ry, rz, px, py, pz] added to the game's pose, and its size in hand
  const REST = { butterfly: [0, 0.1, -0.2, 0, 0, 0], karambit: [0.1, 0.25, 0.1, 0.06, -0.12, 0.04], kukri: [0.3, 0.25, -0.7, 0, 0, 0], tanto: [0, 0, 0, 0, 0, 0], flip: [0, 0, 0, 0, 0, 0], bayonet: [0, 0, 0, 0, 0, 0], gut: [0, 0.05, -0.1, 0, 0, 0], bowie: [0.08, 0.1, -0.2, 0, -0.01, 0], kunai: [0, 0, -0.15, 0, 0, 0], stiletto: [0, 0, 0, 0, 0, 0] };
  const SIZE = { butterfly: 1.1, karambit: 1.1, kukri: 1.05, tanto: 1.05, flip: 1.1, bayonet: 1.05, gut: 1.08, bowie: 1.0, kunai: 1.1, stiletto: 1.1 };
  const DRAW_D = { butterfly: 0.6, karambit: 0.5, kukri: 0.4, tanto: 0.42, flip: 0.38, bayonet: 0.5, gut: 0.5, bowie: 0.5, kunai: 0.55, stiletto: 0.48 };
  // attack: the kind that alternates and how long it takes
  const ATTACK = {
    butterfly: [
      ["slash", 0.26],
      ["stab", 0.22],
    ],
    karambit: [
      ["hook", 0.3],
      ["rip", 0.28],
    ],
    kukri: [
      ["chop", 0.34],
      ["cleave", 0.3],
    ],
    tanto: [
      ["stab", 0.2],
      ["cut", 0.24],
    ],
    flip: [
      ["slash", 0.26],
      ["stab", 0.22],
    ],
    bayonet: [
      ["stab", 0.22],
      ["slash", 0.26],
    ],
    gut: [
      ["slash", 0.26],
      ["upper", 0.28],
    ],
    bowie: [
      ["sweep", 0.32],
      ["chop", 0.34],
    ],
    kunai: [
      ["jab", 0.24],
      ["cut", 0.22],
    ],
    stiletto: [
      ["lunge", 0.26],
      ["slash", 0.24],
    ],
  };

  // ── the hands ──
  const parts = (a) => {
    if (!a) return null;
    if (a.userData.kp) return a.userData.kp;
    const kp = {};
    a.traverse((o) => o.userData && o.userData.kpart && (kp[o.userData.kpart] = o));
    return (a.userData.kp = kp);
  };
  const GS = () => window.GUN_SKINS,
    SP = () => window.SKIN_PERKS;
  const model = () => {
    try {
      const s = GS() && GS().of("knife");
      return s && s.model && BUILD[s.model] ? s.model : "";
    } catch (e) {
      return "";
    }
  };
  // the game places the hand from the knife's lower rear vertices; a typed knife
  // says where its grip is instead (a stand-in box tells the placer, then the
  // knife takes its place)
  if ("function" == typeof vmWithHands) {
    const _hands = vmWithHands;
    vmWithHands = function (e, t) {
      const m = "knife" === t ? model() : "",
        H = m && HAND[m];
      if (!H || !e) return _hands.apply(this, arguments);
      SIZE[m] && 1 !== SIZE[m] && e.scale.multiplyScalar(SIZE[m]);
      const s = (e.scale && e.scale.x) || 1,
        stand = new T.Group(),
        ph = new T.Mesh(new T.BoxGeometry(0.03, 0.08, 0.2), new T.MeshBasicMaterial({ visible: !1 }));
      let k = e;
      const gr = GRIP[m];
      if (gr) {
        k = new T.Group();
        k.add(e);
        k.rotation.set(gr[0], gr[1], gr[2]);
      }
      const v = new T.Vector3(0, H[0] * s, H[1] * s);
      gr && v.applyEuler(k.rotation);
      ph.position.set(v.x, v.y + 0.004, v.z - 0.106);
      stand.add(ph);
      const o = _hands.call(this, stand, t);
      o.remove(stand);
      o.add(k);
      const F = FIST[m];
      if (F)
        try {
          let hand = null;
          o.traverse((x) => !hand && x.isMesh && x.geometry && "SphereGeometry" === x.geometry.type && x.geometry.parameters && Math.abs(x.geometry.parameters.radius - 0.043) < 0.005 && (hand = x));
          if (hand) {
            const g = new T.Group(),
              L = F[0] * s,
              r = F[1];
            g.position.copy(hand.position);
            g.add(live(cyl(hand.material, r, 0.9 * r, L, 14, 0, -L / 2, 0)));
            g.add(live(mesh(new T.SphereGeometry(0.9 * r, 12, 9), hand.material, 0, -L, 0)));
            g.traverse((x) => x.isMesh && (x.castShadow = x.receiveShadow = !1));
            o.add(g);
            o.userData.fist = g;
          }
        } catch (e) {}
      return o;
    };
  }
  const IDLE = { t: 0, next: 5, anim: -1 };
  function pose(dt) {
    if (window.GUN_SKINS && GUN_SKINS.of('knife')?.pack) return;
    const a = VM.current,
      M = SP() && SP().state;
    if (!a || !M || !player.alive || !VM.root.visible || !a.visible) return;
    if ("knife" !== curWeaponKey() || player.ultW) return;
    const m = model();
    if (!m) return;
    const kp = parts(a),
      hA = kp.hA,
      hB = kp.hB,
      spin = kp.spin,
      blade = kp.blade;
    // rest
    hA && (hA.rotation.x = 0);
    hB && (hB.rotation.x = 0);
    spin && (spin.rotation.x = 0);
    blade && (blade.rotation.x = 0);
    const R = a.rotation,
      P = a.position,
      rs = REST[m];
    if (rs) {
      R.x += rs[0];
      R.y += rs[1];
      R.z += rs[2];
      P.x += rs[3];
      P.y += rs[4];
      P.z += rs[5];
    }
    // drawn
    if (M.draw.t >= 0) {
      const k = c01(M.draw.t / M.draw.D),
        e = ezO(k),
        r = 1 - e;
      if ("butterfly" === m) {
        hA && (hA.rotation.x = 3 * PI * r);
        hB && (hB.rotation.x = -3 * PI * r);
        P.y -= 0.06 * r;
        R.z -= 0.25 * r;
      } else if ("karambit" === m) {
        spin && (spin.rotation.x = 2 * PI * e);
        P.y -= 0.05 * r;
        R.z += 0.3 * Math.sin(k * PI);
      } else if ("kukri" === m) {
        P.y -= 0.28 * r;
        R.x -= 0.55 * r;
        R.z -= 0.2 * r;
      } else if ("tanto" === m) {
        P.z += 0.24 * r;
        P.x += 0.08 * r;
        R.y += 0.5 * r;
      } else if ("flip" === m) {
        const o = 1 - Math.pow(1 - k, 3) + 0.22 * Math.sin(k * PI * 2) * (1 - k);
        blade && (blade.rotation.x = PI * (1 - c01(o)));
        P.y -= 0.05 * r;
        R.z += 0.35 * r;
      } else if ("bayonet" === m) {
        // off the rifle: pulled back and down, then brought up
        P.z += 0.18 * r;
        P.y -= 0.1 * r;
        R.x -= 0.4 * r;
      } else if ("gut" === m) {
        P.y -= 0.12 * r;
        R.z -= 0.5 * r;
      } else if ("bowie" === m) {
        // drawn from the hip, heavy
        P.y -= 0.22 * r;
        P.x += 0.06 * r;
        R.x -= 0.4 * r;
        R.z -= 0.3 * r;
      } else if ("kunai" === m) {
        P.y -= 0.08 * r;
        R.z += 0.4 * Math.sin(k * PI);
      } else if ("stiletto" === m) {
        P.y -= 0.06 * r;
        R.z -= 0.2 * r;
      }
    }
    // inspect: the arm only raises the knife into view and lowers it again; the knife's own
    // tricks (it turns on its pivot, hand and arm stay) are in the knife-tricks module
    if (M.insp.t >= 0) {
      const s = M.insp.t,
        D = window.KNIVES && KNIVES.inspD ? KNIVES.inspD(m) : 2.6,
        up = ezS(seg(s, 0, 0.4)) * (1 - ezS(seg(s, D - 0.5, D)));
      P.x -= 0.08 * up;
      P.y += 0.06 * up;
      P.z += 0.12 * up;
      R.x += 0.2 * up;
    }
    // the cut
    if (M.knife.t >= 0) {
      const k = c01(M.knife.t / M.knife.D),
        e = ezS(k),
        sn = Math.sin(k * PI),
        kind = M.knife.kind;
      if ("slash" === kind) {
        R.y += 0.7 - 1.5 * e;
        P.x += 0.12 - 0.3 * e;
        R.z += -0.5 + 0.8 * e;
      } else if ("stab" === kind) {
        P.z -= 0.3 * sn;
        R.x -= 0.25 * sn;
      } else if ("hook" === kind) {
        R.y += 0.5 - 1.7 * e;
        R.z += 0.6 * sn;
        P.x += 0.1 - 0.26 * e;
        spin && (spin.rotation.x += PI * sn * 0.5);
      } else if ("rip" === kind) {
        P.z -= 0.22 * sn;
        P.y -= 0.1 * sn;
        R.x -= 0.6 * sn;
        spin && (spin.rotation.x += PI * e);
      } else if ("chop" === kind) {
        const up = seg(k, 0, 0.3),
          dn = seg(k, 0.3, 0.75),
          bk = seg(k, 0.75, 1);
        R.x += 0.9 * ezS(up) - 1.6 * ezS(dn) + 0.7 * ezS(bk);
        P.y += 0.12 * ezS(up) - 0.18 * ezS(dn) + 0.06 * ezS(bk);
        P.z -= 0.1 * ezS(dn) * (1 - ezS(bk));
      } else if ("cleave" === kind) {
        R.y += 1.0 - 2.0 * e;
        P.x += 0.16 - 0.34 * e;
        R.z += 0.4 * sn;
      } else if ("upper" === kind) {
        // a rising backhand cut
        R.x += -0.6 + 1.1 * e;
        P.y += -0.12 + 0.22 * e;
        P.x += -0.08 + 0.12 * e;
        R.z += 0.45 * sn;
      } else if ("sweep" === kind) {
        // a wide heavy swing right to left
        R.y += 1.25 - 2.5 * e;
        P.x += 0.2 - 0.42 * e;
        P.y += 0.04 * sn;
        R.z += -0.5 + 0.9 * e;
      } else if ("jab" === kind) {
        // two quick jabs
        const j = Math.abs(Math.sin(k * 2 * PI));
        P.z -= 0.2 * j;
        P.x -= 0.03 * j * (k < 0.5 ? 1 : -1);
        R.x -= 0.15 * j;
      } else if ("lunge" === kind) {
        // a long thrust with a twist at the end
        P.z -= 0.38 * sn;
        P.y += 0.03 * sn;
        R.x -= 0.2 * sn;
        R.z += 0.7 * ezS(seg(k, 0.3, 0.6)) * (1 - ezS(seg(k, 0.7, 1)));
      } else if ("cut" === kind) {
        R.y += -0.6 + 1.2 * e;
        P.x += -0.1 + 0.22 * e;
        R.z += -0.3 * sn;
      }
    }
    // held still: the knife's own idle trick now and then
    const still = Math.hypot(player.vel.x, player.vel.z) < 0.5 && !keys.fire && M.knife.t < 0 && M.draw.t < 0 && M.insp.t < 0;
    if (!still) IDLE.t = 0;
    else if (((IDLE.t += dt), IDLE.anim < 0 && IDLE.t > IDLE.next)) {
      IDLE.anim = 0;
      IDLE.t = 0;
      IDLE.next = 6 + 5 * Math.random();
    }
    if (spin && a.userData.fist) {
      const w = ((spin.rotation.x % (2 * PI)) + 2 * PI) % (2 * PI),
        open = c01(Math.min(w, 2 * PI - w) / 0.5),
        f = a.userData.fist;
      f.scale.set(1 - 0.3 * open, 1 - 0.92 * open, 1 - 0.3 * open);
    }
    if (IDLE.anim >= 0) {
      // the knife's own idle trick is in the knife-tricks module (the knife turns on its pivot)
      IDLE.anim += dt;
      c01(IDLE.anim / (window.KNIVES && KNIVES.idleD ? KNIVES.idleD(m) : 0.6)) >= 1 && (IDLE.anim = -1);
    }
  }
  const _tick = tickViewmodel;
  tickViewmodel = function (dt) {
    const r = _tick.apply(this, arguments);
    try {
      pose(dt || 0.016);
    } catch (e) {}
    return r;
  };
  window.KNIVES = { build: BUILD, drawD: (m) => DRAW_D[m] || 0.4, attack: (m, i) => { const l = ATTACK[m] || ATTACK.flip; return l[i % l.length]; }, model, parts, idle: IDLE, hand: HAND, grip: GRIP, rest: REST, size: SIZE };
})();
