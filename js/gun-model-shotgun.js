(() => {
  'use strict';
  // Impact (key "shotgun"): a generic 12-gauge pump-action shotgun of the classic police pattern. A machined steel
  // receiver with a flat top, an ejection port on the right and a loading port with its shell lifter underneath, an
  // 18.5-inch barrel with a brass bead, a magazine tube under it held by a barrel clamp, a ribbed synthetic fore-end
  // on two action bars, a cross-bolt safety behind the trigger, a slide release, sling swivels, a synthetic stock and a
  // ventilated recoil pad. Matte black parkerized steel and black polymer. No maker's name, logo or marking.
  //
  // The fore-end is its own group (legacyAction "pump"): 54-reload-animation.js works it back and forth after every
  // shot and at the end of a reload, and the left hand rides it. Its first-person muzzle flash comes from its muzzle
  // (userData.fpFlash, 18-gun-effects.js). Aiming puts the bead's top on the screen centre, over the flat receiver top.
  //
  // Measured in millimetres on the real gun and converted here:
  //   x: from the muzzle face backwards (0 muzzle .. 1020 the pad's back)
  //   y: from the bore line upwards (+15 the bead's top .. -176 the stock's toe)
  //   s: across, from the centre line (+ is the right side, the ejection side)
  // The muzzle is where the old Impact's was (z -0.596) and the bore at its height (y 0.031).
  //
  // Material roles are the stock GUNMAT kinds, so every skin recolours it: the stock and fore-end (body), the receiver,
  // barrel, tube and bars (metal), the small parts (dark), the pad (rubber), the bead (brass).
  if (typeof GUN_BUILD === 'undefined' || typeof GunBuilder !== 'function' || typeof GUNMAT === 'undefined' || typeof T === 'undefined') return;

  const K = 0.001;
  const Y0 = 0.031;
  const Z = (x) => -0.596 + x * K;
  const Y = (y) => Y0 + y * K;
  const S = (s) => s * K;
  const UV_TILE = 0.16;

  function scaleUV(geo, su = 1 / UV_TILE, sv = 1 / UV_TILE) {
    const uv = geo.attributes.uv;
    if (!uv) return geo;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    uv.needsUpdate = true;
    return geo;
  }
  const path = (p, pts) => pts.forEach(([a, b], i) => (i ? p.lineTo(a, b) : p.moveTo(a, b)));
  const arc = (cx, cy, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  // a side profile ([x, y] mm) extruded across the gun, `width` mm, centred on opt.s
  function sideGeo(points, width, opt = {}) {
    const shape = new T.Shape();
    path(shape, points.map(([x, y]) => [-Z(x), Y(y)]));
    shape.closePath();
    for (const hole of opt.holes || []) {
      const p = new T.Path();
      path(p, hole.map(([x, y]) => [-Z(x), Y(y)]));
      p.closePath();
      shape.holes.push(p);
    }
    const bevel = S(opt.bevel || 0);
    const geo = new T.ExtrudeGeometry(shape, { depth: Math.max(S(width) - 2 * bevel, S(0.2)), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelOffset: -bevel, bevelSegments: opt.segments || 2, steps: 1, curveSegments: 4 });
    geo.rotateY(Math.PI / 2);
    geo.translate(-S(width) / 2 + bevel + S(opt.s || 0), 0, 0);
    return scaleUV(geo);
  }
  // a front-view section ([s, y] mm) extruded along the gun from x0 to x1; back(y) moves the rear face by height
  function sectionGeo(points, x0, x1, opt = {}) {
    const shape = new T.Shape(), sx = opt.sx || 1, sy = opt.sy || 1;
    path(shape, points.map(([s, y]) => [S(s * sx), Y(y * sy)]));
    shape.closePath();
    for (const hole of opt.holes || []) {
      const p = new T.Path();
      path(p, hole.map(([s, y]) => [S(s * sx), Y(y * sy)]));
      p.closePath();
      shape.holes.push(p);
    }
    const geo = new T.ExtrudeGeometry(shape, { depth: S(x1 - x0), bevelEnabled: false, steps: 1, curveSegments: 4 });
    geo.translate(0, 0, Z(x0));
    if (opt.back || opt.front) {
      const p = geo.attributes.position, zf = Z(x0) + 1e-6, zb = Z(x1) - 1e-6;
      for (let i = 0; i < p.count; i++) {
        const ymm = (p.getY(i) - Y0) / K, z = p.getZ(i);
        if (z <= zf && opt.front) p.setZ(i, z + S(opt.front(ymm)));
        else if (z >= zb && opt.back) p.setZ(i, z + S(opt.back(ymm)));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    }
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i)); // the finish's lines run along the gun
    return scaleUV(geo);
  }
  function boxGeo(w, h, d, x, y, s) {
    const g = new T.BoxGeometry(S(w), S(h), S(d));
    g.translate(S(s), Y(y), Z(x));
    return scaleUV(g, S(Math.max(w, d)) / UV_TILE, S(Math.max(h, d)) / UV_TILE);
  }
  function cylGeo(r0, r1, len, segs, axis, x, y, s, open = false) {
    const g = new T.CylinderGeometry(S(r0), S(r1), S(len), segs, 1, open);
    scaleUV(g, (2 * Math.PI * S(Math.max(r0, r1))) / UV_TILE, S(len) / UV_TILE);
    if (axis === 'z') g.rotateX(-Math.PI / 2);
    else if (axis === 'x') g.rotateZ(Math.PI / 2);
    g.translate(S(s), Y(y), Z(x));
    return g;
  }
  const tube = (r0, r1, x0, x1, y = 0, segs = 24, open = false) => cylGeo(r0, r1, x1 - x0, segs, 'z', (x0 + x1) / 2, y, 0, open);
  function ringGeo(r0, r1, x, y = 0, s = 0, segs = 24) {
    const g = r0 > 0 ? new T.RingGeometry(S(r0), S(r1), segs) : new T.CircleGeometry(S(r1), segs);
    g.rotateY(Math.PI);
    g.translate(S(s), Y(y), Z(x));
    return scaleUV(g);
  }
  function merged(list) {
    let count = 0;
    const parts = list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      n.attributes.normal || n.computeVertexNormals();
      count += n.attributes.position.count;
      return n;
    });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
    let o = 0;
    for (const n of parts) {
      const c = n.attributes.position.count;
      pos.set(n.attributes.position.array, o * 3);
      nor.set(n.attributes.normal.array, o * 3);
      if (n.attributes.uv) uv.set(n.attributes.uv.array, o * 2);
      o += c;
    }
    for (const g of list) g.dispose();
    for (const n of parts) n.dispose();
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    return out;
  }

  // ── the plain finish: seamless (the shared one draws tile borders and square flecks) ──
  const FINISH = {};
  function finish(kind) {
    if (FINISH[kind] !== undefined) return FINISH[kind];
    let t = null;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      let seed = kind === 'metal' ? 29 : 53;
      const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      g.fillStyle = '#e4e4e4';
      g.fillRect(0, 0, 128, 128);
      if (kind === 'metal') {
        // a parkerized surface: a fine even grain, no direction
        for (let i = 0; i < 2600; i++) {
          const v = R() < 0.5 ? 252 : 190;
          g.fillStyle = `rgba(${v},${v},${v},${0.12 + R() * 0.2})`;
          g.fillRect(R() * 128, R() * 128, 1, 1);
        }
      } else {
        for (let i = 0; i < 1300; i++) {
          const x = R() * 128, y = R() * 128, v = R() < 0.5 ? 250 : 170;
          g.fillStyle = `rgba(${v},${v},${v},${0.16 + R() * 0.28})`;
          g.beginPath();
          g.arc(x, y, 0.6 + R() * 0.7, 0, 2 * Math.PI);
          g.fill();
        }
      }
      t = new T.CanvasTexture(c);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 4;
      'colorSpace' in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
      t.userData = { shared: true };
    } catch (e) {
      t = null;
    }
    return (FINISH[kind] = t);
  }
  function materials() {
    const POLY = { polymer: 1, rubber: 1 };
    const tone = (m, color, rough, metal) => {
      if (m.userData && m.userData.finished) m.map = finish(POLY[m.userData.kind] ? 'poly' : 'metal');
      m.color.setHex(color);
      m.roughness = rough;
      m.metalness = metal;
      m.needsUpdate = true;
      return m;
    };
    return {
      steel: tone(GUNMAT.gunmetal(), 0x55585d, 0.52, 0.64), // parkerized receiver, barrel, tube, clamp
      bars: tone(GUNMAT.steel(), 0x6d7177, 0.34, 0.85), // the action bars, the lifter, pins and swivels: bright steel
      poly: tone(GUNMAT.polymer(), 0x2d2f33, 0.72, 0.05), // the stock and the fore-end
      dark: tone(GUNMAT.blued(), 0x161719, 0.5, 0.5), // trigger guard, trigger, safety, release, cap
      pad: tone(GUNMAT.rubber(), 0x141415, 0.97, 0), // the recoil pad
      bore: Object.assign(tone(GUNMAT.rubber(), 0x040405, 1, 0), { side: T.DoubleSide }), // bore, ports, seams
      bead: tone(GUNMAT.brass(), 0xe0b95c, 0.22, 0.9), // the front bead
    };
  }

  // ── the barrel, the magazine tube and the clamp ──
  const BAR_R = 10, BORE_R = 9.3, TUBE_Y = -23, TUBE_R = 11;
  const BEAD = { x: 9, y: 13, r: 2.2 };
  function barrelGeo() {
    const g = [];
    g.push(tube(BAR_R, BAR_R, 0, 432, 0, 28));
    g.push(tube(12.2, 12.2, 428, 446, 0, 28)); // the barrel's extension ring where it meets the receiver
    g.push(tube(BAR_R - 0.6, BAR_R, -0.4, 1.2, 0, 28, true)); // the crown's edge
    g.push(tube(TUBE_R, TUBE_R, 64, 442, TUBE_Y, 24)); // the magazine tube
    g.push(tube(12.2, 12.2, 46, 64, TUBE_Y, 24)); // its cap
    g.push(ringGeo(0, 12.2, 46, TUBE_Y, 0, 24));
    // the barrel clamp: one band round the barrel and the tube, a screw through it
    const clamp = [...arc(0, 0, BAR_R + 2, 0, Math.PI, 12), [-(TUBE_R + 2), TUBE_Y], ...arc(0, TUBE_Y, TUBE_R + 2, Math.PI, 2 * Math.PI, 12), [BAR_R + 2, 0]];
    g.push(sectionGeo(clamp, 72, 88));
    g.push(cylGeo(3, 3, 2 * (TUBE_R + 4), 12, 'x', 80, TUBE_Y + 12, 0));
    // the bead's base, soldered to the barrel
    g.push(sectionGeo([[-2.4, BAR_R - 1], [2.4, BAR_R - 1], [1.8, BEAD.y - 1], [-1.8, BEAD.y - 1]], BEAD.x - 3, BEAD.x + 3));
    return merged(g);
  }
  function boreGeo() {
    return merged([cylGeo(BORE_R, BORE_R, 8, 20, 'z', 4, 0, 0, true), ringGeo(0, BORE_R + 0.05, 8, 0, 0, 20), ringGeo(BORE_R, BAR_R - 0.6, -0.3, 0, 0, 24)]);
  }
  function beadGeo() {
    const b = new T.SphereGeometry(S(BEAD.r), 14, 10);
    b.translate(0, Y(BEAD.y), Z(BEAD.x));
    return scaleUV(b);
  }
  // swivels: a loop under the clamp and a stud with a loop under the stock
  function swivelGeo() {
    const loop = (x, y) => {
      const t = new T.TorusGeometry(S(6.5), S(1.4), 6, 16);
      t.rotateY(Math.PI / 2);
      t.translate(0, Y(y), Z(x));
      return scaleUV(t);
    };
    return { front: merged([loop(80, TUBE_Y - TUBE_R - 9), cylGeo(3, 3, 6, 10, 'y', 80, TUBE_Y - TUBE_R - 3, 0)]), rear: merged([loop(905, -158), cylGeo(3, 3, 6, 10, 'y', 905, -151, 0)]) };
  }

  // ── the receiver: machined, a flat top, the ports ──
  const RX0 = 440, RX1 = 640, RTOP = 14, RBOT = -50, RW = 15;
  const RECV = [[-9, RTOP], [9, RTOP], [RW, RTOP - 6], [RW, RBOT + 4], [RW - 3, RBOT], [-(RW - 3), RBOT], [-RW, RBOT + 4], [-RW, RTOP - 6]];
  function receiverGeo() {
    const g = [];
    // the rear runs down into the tang that the stock fits over; the front face is round the barrel ring and the tube
    g.push(sectionGeo(RECV, RX0, RX1, { back: (y) => -Math.max(0, -y - 10) * 0.22 }));
    // the top tang, into the stock
    g.push(sectionGeo([[-7, RTOP - 2], [7, RTOP - 2], [6, RTOP - 6], [-6, RTOP - 6]], RX1 - 2, RX1 + 26));
    // a shallow sighting groove down the flat top (its floor: dark, separate)
    return merged(g);
  }
  function receiverDarkGeo() {
    const g = [];
    g.push(boxGeo(6, 0.6, RX1 - RX0 - 30, (RX0 + RX1) / 2, RTOP + 0.05, 0)); // the sighting groove's floor
    g.push(boxGeo(0.8, 15, 68, 505, 5, RW + 0.05)); // the ejection port
    g.push(boxGeo(20, 0.8, 86, 563, RBOT - 0.05, 0)); // the loading port
    g.push(boxGeo(0.6, 0.6, RX1 - RX0, (RX0 + RX1) / 2, RBOT + 14, -(RW + 0.05))); // the left side's seam
    return merged(g);
  }
  function boltGeo() {
    // the bolt in the port, and the shell lifter in the loading port
    return merged([boxGeo(1.4, 12, 60, 507, 5, RW - 1.2), boxGeo(17, 1.6, 80, 563, RBOT + 1.6, 0), cylGeo(2.8, 2.8, 2 * RW + 2, 12, 'x', 520, -33, 0), cylGeo(2.8, 2.8, 2 * RW + 2, 12, 'x', 612, -33, 0)]);
  }
  // trigger guard, trigger, cross-bolt safety, slide release
  function controlsGeo() {
    const g = [];
    g.push(sideGeo([[598, RBOT], [674, RBOT], [676, -58], [668, -72], [656, -78], [612, -78], [600, -70], [596, -58]], 14, { bevel: 1.4, holes: [[[606, RBOT - 4], [664, RBOT - 4], [665, -60], [660, -69], [652, -72], [616, -72], [607, -66], [605, -58]]] }));
    g.push(sideGeo([[626, RBOT], [633, RBOT], [632, -58], [630.5, -64], [631.5, -69], [629.6, -72], [626.4, -72], [626, -68], [627, -62], [626.6, -56]], 7, { bevel: 0.6 }));
    g.push(cylGeo(3.6, 3.6, 2 * RW + 6, 14, 'x', 662, -38, 0)); // the safety's button, proud of both sides
    g.push(sideGeo([[586, -40], [598, -40], [600, -56], [590, -56]], 3, { s: -(RW + 1.4), bevel: 0.6, segments: 1 })); // the slide release
    return merged(g);
  }

  // ── the fore-end on its action bars (the pump group) ──
  const FE = { x0: 120, x1: 340, travel: 95 }; // at rest a stroke's length in front of the receiver
  const FE_SECTION = (() => {
    const right = [[8, -11.5], [17, -12.5], [23, -18], [25, -28], [24, -38], [19, -46], [10, -51]];
    return [...right, ...right.slice().reverse().map(([s, y]) => [-s, y])];
  })();
  function foreEndGeo() {
    const g = [], n = 11, step = (FE.x1 - FE.x0) / n;
    // ribs round it: raised bands and shallow valleys
    for (let i = 0; i < n; i++) {
      const a = FE.x0 + i * step;
      g.push(sectionGeo(FE_SECTION, a, a + step * 0.55, { holes: [arc(0, TUBE_Y, TUBE_R + 0.4, 0, 2 * Math.PI, 18).slice(0, -1)] }));
      g.push(sectionGeo(FE_SECTION, a + step * 0.55, a + step, { sx: 0.93, sy: 1, holes: [arc(0, TUBE_Y, TUBE_R + 0.4, 0, 2 * Math.PI, 18).slice(0, -1)] }));
    }
    return merged(g);
  }
  function barsGeo() {
    // two action bars from the fore-end's rear into the receiver, flat on the tube's sides
    return merged([-1, 1].map((sd) => boxGeo(2, 6, RX0 - FE.x1 + 20, (FE.x1 - 10 + RX0 + 10) / 2, TUBE_Y + 1, sd * (TUBE_R + 1.4))));
  }

  // ── the stock and its pad ──
  const BUTT = 1000;
  // the stock is slim at the wrist and widens toward the butt: its width scaled by how far back a point is
  function taper(geo, k = 1) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const xmm = (p.getZ(i) - Z(0)) / K, t = Math.max(0, Math.min(1, (xmm - RX1) / 280));
      p.setX(i, p.getX(i) * (0.76 + 0.24 * t) * k);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }
  function stockGeo() {
    // a classic drop: the comb just under the receiver's top, the heel 60 mm lower, a 130 mm butt
    const top = [[RX1 - 4, RTOP - 1], [700, RTOP - 8], [820, -20], [BUTT, -45]];
    const bottom = [[BUTT, -175], [930, -160], [840, -130], [760, -100], [700, -78], [664, -60], [RX1 - 6, RBOT + 2]];
    return taper(sideGeo([...top, ...bottom], 40, { bevel: 5, segments: 3 }));
  }
  // the stock's wrist alone, the part the right hand holds: what first person draws of the stock (the whole stock would fill
  // the aiming view, the gun being held out in front of the eye). A hair inside the whole stock, so it never shows elsewhere.
  const WRIST_END = 760;
  function wristGeo() {
    const top = [[RX1 - 4, RTOP - 1.5], [700, RTOP - 8.5], [WRIST_END, -8.5]];
    const bottom = [[WRIST_END, -99], [700, -77.5], [664, -59.5], [RX1 - 6, RBOT + 2.5]];
    return taper(sideGeo([...top, ...bottom], 40, { bevel: 5, segments: 3 }), 0.97);
  }
  function padGeo() {
    const g = [sideGeo([[BUTT, -45], [BUTT + 20, -43], [BUTT + 22, -173], [BUTT + 1, -176]], 40, { bevel: 3, segments: 2 })];
    // the pad's vents: dark slots on both sides (separate) are drawn by padSlotGeo
    return merged(g);
  }
  function padSlotGeo() {
    const g = [];
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) g.push(boxGeo(0.6, 22, 10, BUTT + 11, -63 - i * 30, sd * 20.1));
    return merged(g);
  }

  GUN_BUILD.shotgun = () => {
    const b = GunBuilder();
    const root = b.group;
    const m = materials();
    root.name = 'dfdf-shotgun';
    root.userData.weaponModel = 'dfdf-shotgun';
    root.userData.modelRevision = 2;
    root.userData.fpFlash = true;
    root.userData.anchors = {
      // the right hand round the stock's wrist, the left hand on the fore-end (under the barrel, clear of the bead)
      right: [0.004, Y(-58), Z(690)],
      left: [S(-6), Y(-40), Z(250)],
      muzzle: [0, Y(0), Z(-1)],
      // the line of sight: the bead's top, over the flat receiver top
      sight: [0, Y(BEAD.y + BEAD.r), Z(BEAD.x)],
    };
    const add = (name, geo, mat, parent = root) => {
      const mesh = new T.Mesh(geo, mat);
      mesh.name = name;
      parent.add(mesh);
      return mesh;
    };
    add('shotgun-receiver', receiverGeo(), m.steel);
    add('shotgun-barrel', barrelGeo(), m.steel);
    add('shotgun-bore', boreGeo(), m.bore);
    add('shotgun-bead', beadGeo(), m.bead);
    add('shotgun-ports', receiverDarkGeo(), m.bore);
    add('shotgun-bolt', boltGeo(), m.bars);
    add('shotgun-controls', controlsGeo(), m.dark);
    const sw = swivelGeo();
    add('shotgun-swivel', sw.front, m.bars);
    // the stock, the pad and the rear swivel: left out of the first-person build, which draws the wrist instead
    const stock = new T.Group();
    stock.name = 'shotgun-stock-full';
    stock.userData.firstPerson = { remove: true };
    root.add(stock);
    add('shotgun-stock', stockGeo(), m.poly, stock);
    add('shotgun-pad', padGeo(), m.pad, stock);
    add('shotgun-pad-vents', padSlotGeo(), m.bore, stock);
    add('shotgun-swivel-rear', sw.rear, m.bars, stock);
    add('shotgun-wrist', wristGeo(), m.poly);
    // the pump: the fore-end and its bars slide back and forth along the tube
    const pump = new T.Group();
    pump.name = 'pump';
    pump.userData.legacyAction = 'pump';
    pump.userData.travel = S(FE.travel);
    root.add(pump);
    add('shotgun-fore-end', foreEndGeo(), m.poly, pump).userData.live = true;
    add('shotgun-action-bars', barsGeo(), m.bars, pump).userData.live = true;
    return root;
  };
  window.GUN_MODEL_SHOTGUN = { revision: 2, mm: K, bead: [0, Y(BEAD.y + BEAD.r), Z(BEAD.x)], receiverTop: [0, Y(RTOP), Z(RX0 + 20)], foreEnd: [Z(FE.x0), Z(FE.x1)] };
})();
