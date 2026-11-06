(() => {
  'use strict';
  // Rush (key "smg"): a generic roller-delayed 9 mm submachine gun of the classic police pattern. A light grey
  // pressed-steel receiver with a stamped stiffening groove down each side and spot welds where the trunnion and the
  // end cap are fixed, a cocking tube over the barrel with its handle folded forward at the front sight, a ring-hooded
  // front post, a drum rear sight, a fluted polymer handguard, a slim polymer grip with finger grooves and a rounded
  // back, a curved 30-round steel magazine, front and rear sling loops, push pins and a collapsing two-strut stock.
  // No maker's name, logo or marking.
  // It is not Tempo (gun-model-machpist.js): a long gun with a stock, a handguard and an iron sight line, not a pistol.
  //
  // Everything is measured in millimetres on the real gun and converted here:
  //   x: from the muzzle face backwards (0 muzzle .. 706 butt pad)
  //   y: from the bore line upwards (+46 the sight line .. -190 the magazine's foot)
  //   s: across, from the centre line (+ is the right side, the ejection side)
  // The scale keeps the old blocky Rush's footprint: the muzzle where the old muzzle was (z -0.405), the bore at
  // y 0.026, about 0.7 long with the stock out.
  //
  // In first person the stock is drawn collapsed (userData.firstPerson on its group: 54-reload-animation.js moves it
  // before the hands are placed), so it does not fill the bottom of the screen; the third-person gun, a gun on the
  // floor and the armory show it extended. The muzzle flash in first person comes from this gun's muzzle
  // (userData.fpFlash, 18-gun-effects.js), not from the eye.
  //
  // Material roles stay the stock GUNMAT kinds, so every skin recolours it: the handguard and the lower (body), the
  // receiver, barrel, pins and struts (metal), the small parts, grip texture, magazine and butt (dark).
  if (typeof GUN_BUILD === 'undefined' || typeof GunBuilder !== 'function' || typeof GUNMAT === 'undefined' || typeof T === 'undefined') return;

  const K = 0.001; // model units per millimetre
  const Y0 = 0.026; // the bore line in model units
  const Z = (x) => -0.405 + x * K;
  const Y = (y) => Y0 + y * K;
  const S = (s) => s * K;
  const UV_TILE = 0.16; // parts carry metre UVs; one texture tile per 0.16 like the boxes the skins fit

  function scaleUV(geo, su = 1 / UV_TILE, sv = 1 / UV_TILE) {
    const uv = geo.attributes.uv;
    if (!uv) return geo;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    uv.needsUpdate = true;
    return geo;
  }

  const path = (p, pts) => pts.forEach(([a, b], i) => (i ? p.lineTo(a, b) : p.moveTo(a, b)));
  // points on a circle arc ([s, y] or [x, y]), from angle a0 to a1 (radians), n steps
  const arc = (cx, cy, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

  // A side profile ([x, y] mm points) extruded across the gun, width in mm, centred on `s`.
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
    const geo = new T.ExtrudeGeometry(shape, {
      depth: Math.max(S(width) - 2 * bevel, S(0.2)),
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelOffset: -bevel, // keep the silhouette on the drawn outline
      bevelSegments: opt.segments || 2,
      steps: 1,
      curveSegments: 4,
    });
    geo.rotateY(Math.PI / 2);
    geo.translate(-S(width) / 2 + bevel + S(opt.s || 0), 0, 0);
    return scaleUV(geo);
  }

  // A front-view section ([s, y] mm points) extruded along the gun from x0 to x1.
  // `front(y)` / `back(y)` (mm) move the front / rear face along the gun by height.
  function sectionGeo(points, x0, x1, opt = {}) {
    const shape = new T.Shape();
    const sx = opt.sx || 1;
    path(shape, points.map(([s, y]) => [S(s * sx), Y(y)]));
    shape.closePath();
    for (const hole of opt.holes || []) {
      const p = new T.Path();
      path(p, hole.map(([s, y]) => [S(s * sx), Y(y)]));
      p.closePath();
      shape.holes.push(p);
    }
    const geo = new T.ExtrudeGeometry(shape, { depth: S(x1 - x0), bevelEnabled: false, steps: 1, curveSegments: 4 });
    geo.translate(0, 0, Z(x0));
    if (opt.front || opt.back) {
      const p = geo.attributes.position, zf = Z(x0) + 1e-6, zb = Z(x1) - 1e-6;
      for (let i = 0; i < p.count; i++) {
        const ymm = (p.getY(i) - Y0) / K, z = p.getZ(i);
        if (z <= zf && opt.front) p.setZ(i, z + S(opt.front(ymm)));
        else if (z >= zb && opt.back) p.setZ(i, z + S(opt.back(ymm)));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    }
    // the walls' u runs round the section and v along the gun: swap them, so a finish's lines run along the gun
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
    return scaleUV(geo);
  }

  function boxGeo(w, h, d, x, y, s, rx = 0) {
    // w across, h tall, d long (mm); centre at x (along), y (height), s (across)
    const g = new T.BoxGeometry(S(w), S(h), S(d));
    rx && g.rotateX(rx);
    g.translate(S(s), Y(y), Z(x));
    return scaleUV(g, S(Math.max(w, d)) / UV_TILE, S(Math.max(h, d)) / UV_TILE);
  }

  // a cylinder (radii in mm, r0 toward the muzzle / the top); axis 'z' along the gun, 'x' across, 'y' up
  function cylGeo(r0, r1, len, segs, axis, x, y, s, open = false) {
    const g = new T.CylinderGeometry(S(r0), S(r1), S(len), segs, 1, open);
    scaleUV(g, (2 * Math.PI * S(Math.max(r0, r1))) / UV_TILE, S(len) / UV_TILE);
    if (axis === 'z') g.rotateX(-Math.PI / 2);
    else if (axis === 'x') g.rotateZ(Math.PI / 2);
    g.translate(S(s), Y(y), Z(x));
    return g;
  }
  // a cylinder along the gun between x0 (front) and x1 (rear), centred at height y
  const tube = (r0, r1, x0, x1, y = 0, segs = 24, open = false) => cylGeo(r0, r1, x1 - x0, segs, 'z', (x0 + x1) / 2, y, 0, open);
  // a flat disc or ring facing forward (toward the muzzle), at x
  function ringGeo(r0, r1, x, y = 0, s = 0, segs = 24) {
    const g = r0 > 0 ? new T.RingGeometry(S(r0), S(r1), segs) : new T.CircleGeometry(S(r1), segs);
    g.rotateY(Math.PI);
    g.translate(S(s), Y(y), Z(x));
    return scaleUV(g);
  }
  // a sling loop: a ring standing on the side of the gun, in the plane along the gun and up
  function loopGeo(x, y, s, r = 5.5, wire = 1.3) {
    const g = new T.TorusGeometry(S(r), S(wire), 6, 16);
    g.rotateY(Math.PI / 2);
    g.translate(S(s), Y(y), Z(x));
    return scaleUV(g);
  }

  // One mesh from many parts of one material (fewer draw calls, merged UVs kept).
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

  // ── the plain finish: seamless, so no tile shows ──
  // The shared plain finish (100-first-person-hands-and-gun-finish.js) draws a bright border round each tile and dark
  // square flecks, which read as square marks all over a long gun's sides. This gun brings its own: fine lines along
  // the gun for the steel, a soft round stipple for the polymer, both wrapping at the edges. A skin still replaces it.
  const FINISH = {};
  function finish(kind) {
    if (FINISH[kind] !== undefined) return FINISH[kind];
    let t = null;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      let seed = kind === 'metal' ? 23 : 41;
      const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      g.fillStyle = '#e4e4e4';
      g.fillRect(0, 0, 128, 128);
      if (kind === 'metal') {
        // brushed lines along u (the gun's length), drawn twice where they cross the edge so the tile wraps
        for (let i = 0; i < 520; i++) {
          const y = Math.floor(R() * 128), x = R() * 128, w = 20 + R() * 80, v = 205 + R() * 50;
          g.fillStyle = `rgba(${v},${v},${v},${0.16 + R() * 0.26})`;
          g.fillRect(x, y, w, 1);
          x + w > 128 && g.fillRect(x - 128, y, w, 1);
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

  // ── materials: stock kinds, own finish ──
  function materials() {
    const POLY = { polymer: 1, rubber: 1 };
    const tone = (m, color, rough, metal) => {
      // the shared finish has brightened the colour (x1.22) with its map; this gun's colours are its own
      if (m.userData && m.userData.finished) m.map = finish(POLY[m.userData.kind] ? 'poly' : 'metal');
      m.color.setHex(color);
      m.roughness = rough;
      m.metalness = metal;
      m.needsUpdate = true;
      return m;
    };
    return {
      receiver: tone(GUNMAT.gunmetal(), 0xa4a9af, 0.46, 0.55), // light grey pressed steel, painted
      weld: tone(GUNMAT.gunmetal(), 0x8e9399, 0.5, 0.6), // the spot welds, a touch darker than the paint round them
      poly: tone(GUNMAT.polymer(), 0x2b2d31, 0.78, 0.05), // the handguard and the lower: black polymer
      grip: tone(GUNMAT.rubber(), 0x1d1f22, 0.95, 0), // the grip's textured panels
      steel: tone(GUNMAT.steel(), 0x70757c, 0.34, 0.85), // barrel, pins, sling loops, stock struts
      dark: tone(GUNMAT.blued(), 0x1c1e22, 0.48, 0.55), // sights, controls, end cap, trigger
      bore: Object.assign(tone(GUNMAT.rubber(), 0x050506, 1, 0), { side: T.DoubleSide }), // bore, port, slot, seams
      mag: tone(GUNMAT.blued(), 0x2c2f34, 0.5, 0.6), // the steel magazine
      butt: tone(GUNMAT.blued(), 0x25272b, 0.55, 0.5), // the stock's butt
      pad: tone(GUNMAT.rubber(), 0x18191b, 0.97, 0), // its rubber pad
      round: tone(GUNMAT.brass(), 0xc9a24e, 0.32, 0.85), // the top round
    };
  }

  // ── the barrel ──
  const BAR_R = 7.6;
  function barrelGeo() {
    const g = [];
    g.push(tube(BAR_R, BAR_R, 0, 40, 0, 20)); // in front of the front sight
    g.push(tube(9.4, 9.4, 26, 34, 0, 20)); // the lug collar
    // the three locking lugs for a muzzle device, round the barrel
    for (const a of [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6]) g.push(boxGeo(4.4, 4.4, 9, 21, 9.2 * Math.sin(a), 9.2 * Math.cos(a)));
    g.push(tube(BAR_R - 0.6, BAR_R, -0.4, 1.2, 0, 20, true)); // the crown's edge
    // push pins: the lower's front and rear pins and the handguard pin, their heads proud of both sides
    g.push(cylGeo(2.8, 2.8, 41, 12, 'x', 302, -24, 0));
    g.push(cylGeo(2.8, 2.8, 41, 12, 'x', 446, -24, 0));
    g.push(cylGeo(2.4, 2.4, 45, 12, 'x', 218, -9, 0));
    // the sling loops: front on the front sight's base, rear on the end cap, both on the left
    g.push(loopGeo(50, 6, -13.6));
    g.push(loopGeo(476, 6, -20.6));
    return merged(g);
  }
  function boreGeo() {
    const g = [];
    g.push(cylGeo(4.6, 4.6, 6, 16, 'z', 2.6, 0, 0, true));
    g.push(ringGeo(0, 4.65, 5.5, 0, 0, 16));
    g.push(ringGeo(4.6, BAR_R - 0.6, -0.3, 0, 0, 20)); // the crown face, dark round the bore
    return merged(g);
  }

  // ── the front sight and the cocking tube ──
  const TUBE_Y = 23, TUBE_R = 11;
  const SL = 46; // the sight line's height above the bore
  // the front sight's base: one welded block round the barrel and the cocking tube
  const BASE_SECTION = [...arc(0, 0, 12.5, Math.PI, 2 * Math.PI, 10), [12.5, 8], [13, TUBE_Y], ...arc(0, TUBE_Y, 13, 0, Math.PI, 10), [-12.5, 8]];
  function frontSightGeo() {
    const g = [];
    const chamfer = (y) => Math.max(0, y - 30) * 0.5;
    g.push(sectionGeo(BASE_SECTION, 36, 62, { front: chamfer }));
    // the ring hood over the post, standing on the base
    const outer = arc(0, SL, 11.5, 0, 2 * Math.PI, 20).slice(0, -1);
    const inner = arc(0, SL, 8.8, 0, 2 * Math.PI, 20).slice(0, -1);
    g.push(sectionGeo(outer, 42, 55, { holes: [inner] }));
    g.push(sectionGeo([[-6, 34], [6, 34], [7.5, 38], [-7.5, 38]], 42, 55)); // its foot, welded on
    return merged(g);
  }
  function postGeo() {
    // the post: a tapered blade up to the sight line, in the middle of the hood
    return sectionGeo([[-1.9, 34.5], [1.9, 34.5], [1.3, SL], [-1.3, SL]], 47, 50.2);
  }
  function cockingTubeGeo() {
    const g = [];
    g.push(tube(TUBE_R, TUBE_R, 58, 232, TUBE_Y, 24));
    g.push(ringGeo(0, TUBE_R, 58, TUBE_Y, 0, 24)); // its front plug
    return merged(g);
  }
  // the handle's slot on the left of the tube
  const HANDLE = { x: 86, travel: 104 };
  function slotGeo() {
    return boxGeo(0.8, 4.6, HANDLE.travel + 14, HANDLE.x + HANDLE.travel / 2, TUBE_Y + 1.5, -(TUBE_R - 0.2));
  }
  // the charging handle, folded forward: a stem out of the slot and a round knob, angled up off the tube
  function handleGeo() {
    const g = [];
    g.push(sideGeo([[HANDLE.x - 5, TUBE_Y - 1], [HANDLE.x + 5, TUBE_Y - 1], [HANDLE.x + 6, TUBE_Y + 5], [HANDLE.x - 4, TUBE_Y + 5]], 20, { s: -(TUBE_R + 9), bevel: 0.8, segments: 1 }));
    g.push(cylGeo(4.6, 4.6, 11, 14, 'x', HANDLE.x + 1, TUBE_Y + 3, -(TUBE_R + 22)));
    for (let i = 0; i < 4; i++) g.push(cylGeo(5, 5, 0.8, 14, 'x', HANDLE.x + 1, TUBE_Y + 3, -(TUBE_R + 18) - i * 2.6)); // grip rings
    return merged(g);
  }
  const HANDLE_GRIP = [S(-(TUBE_R + 22)), Y(TUBE_Y + 3), Z(HANDLE.x + 1)];

  // ── the handguard: black polymer, three flutes down each side ──
  const HG = { x0: 62, x1: 226, w: 21.5, bottom: -32 };
  const HG_SECTION = (() => {
    const right = [
      [8.6, TUBE_Y - 8.2], [15.5, 13.6], [20.4, 9.5], [HG.w, 5.5],
      [HG.w, 3], [19, 1.6], [19, -2.6], [HG.w, -4],
      [HG.w, -8.5], [19, -9.9], [19, -14.1], [HG.w, -15.5],
      [HG.w, -20.5], [19.6, -26], [15, -30.4], [8, HG.bottom],
    ];
    return [...right, ...right.slice().reverse().map(([s, y]) => [-s, y])];
  })();
  function handguardGeo() {
    const g = [];
    g.push(sectionGeo(HG_SECTION, HG.x0, HG.x1, { front: (y) => Math.max(0, -y - 20) * 0.45 + Math.max(0, y - 8) * 0.3 }));
    // a raised band at the rear where it meets the receiver
    g.push(sectionGeo(HG_SECTION, HG.x1 - 9, HG.x1, { sx: 1.03 }));
    return merged(g);
  }

  // ── the receiver: pressed steel, a stiffening groove down each side ──
  const RW = 19; // its half width
  const RTOP = 37, RBOT = -18;
  const sideWall = (port) => {
    // the right side, top to bottom; the groove at y 10..14; with `port`, cut in round the ejection port
    const p = [[14.5, 35], [RW, 29], [RW, 14.6], [RW - 1.3, 13.4], [RW - 1.3, 11.2], [RW, 10]];
    if (port) p.push([RW, 6.5], [RW - 9.5, 6.5], [RW - 9.5, -5], [RW, -5]);
    p.push([RW, RBOT + 2], [RW - 2, RBOT]);
    return p;
  };
  const RECV_SECTION = (port) => {
    const r = sideWall(port), l = sideWall(false).map(([s, y]) => [-s, y]);
    return [[6, RTOP], ...r, ...l.reverse(), [-6, RTOP]];
  };
  const PORT = [250, 298];
  const TRUNNION = 236; // where the receiver starts, over the handguard's rear band
  function receiverGeo() {
    const g = [];
    g.push(sectionGeo(RECV_SECTION(false), TRUNNION - 12, PORT[0], { front: (y) => (y > 30 ? (y - 30) * 0.8 : 0) }));
    g.push(sectionGeo(RECV_SECTION(true), PORT[0], PORT[1]));
    g.push(sectionGeo(RECV_SECTION(false), PORT[1], 470));
    // the magazine well, pressed into the receiver's floor, its mouth flared
    g.push(sideGeo([[238, RBOT + 1], [292, RBOT + 1], [292, -45], [288, -50.5], [242.5, -50.5], [238, -45]], 31, { bevel: 1.4 }));
    g.push(sideGeo([[240, -46], [291, -46], [291, -50.5], [240, -50.5]], 33.4, { bevel: 1 }));
    // the stock's guide channels, welded along both sides of the receiver's rear
    for (const s of [-1, 1]) g.push(sectionGeo([[0, -3.8], [3, -3.8], [4, -2.6], [4, 2.6], [3, 3.8], [0, 3.8]].map(([a, y]) => [s * (RW - 0.5 + a), 12 + y]), 312, 468));
    // the rear sight's base on the top
    g.push(sectionGeo([[-9, RTOP - 1], [9, RTOP - 1], [8, RTOP + 4], [-8, RTOP + 4]], 430, 466));
    return merged(g);
  }
  // the spot welds where the trunnion, the well and the end-cap block are fixed (raised dots, both sides)
  function weldGeo() {
    const g = [];
    const dot = (x, y, side) => g.push(cylGeo(2.1, 2.1, 0.7, 10, 'x', x, y, side * (RW + 0.25)));
    for (const side of [-1, 1]) {
      for (const x of [242, 254, 266]) dot(x, 22, side);
      for (const x of [304, 318, 332]) dot(x, 0, side);
      for (const x of [446, 458]) dot(x, 23, side);
      for (const x of [446, 458]) dot(x, -2, side);
    }
    for (const x of [246, 262, 278]) for (const side of [-1, 1]) g.push(cylGeo(1.9, 1.9, 0.6, 10, 'x', x, -36, side * 15.8));
    return merged(g);
  }
  function receiverDarkGeo() {
    const g = [];
    // the bolt seen through the port, the cocking handle's slot, the end cap's seam
    g.push(boxGeo(0.6, 11, PORT[1] - PORT[0] - 0.6, (PORT[0] + PORT[1]) / 2, 0.75, RW - 9.3));
    g.push(slotGeo());
    g.push(sectionGeo(RECV_SECTION(false), 469.4, 470.4, { sx: 1.012 }));
    return merged(g);
  }
  function boltGeo() {
    // the bolt carrier's face behind the port, steel
    return boxGeo(2, 9.6, PORT[1] - PORT[0] - 8, (PORT[0] + PORT[1]) / 2 + 2, 0.75, RW - 10.2);
  }

  // ── the lower: trigger housing, guard and grip in one polymer piece ──
  const RAKE = (17 * Math.PI) / 180, TAN = Math.tan(RAKE);
  const GRIP_TOP = -32;
  const gFront = (y) => 386 + (GRIP_TOP - y) * TAN;
  const GROOVE = 2.4;
  // the front strap: three finger grooves (ridges at -62, -84, -106)
  const gFrontStrap = (y) => gFront(y) + (y < -62 && y > -126 ? GROOVE * 0.5 * (1 - Math.cos((2 * Math.PI * (y + 62)) / 22)) : 0);
  // the back: a rounded palm swell
  const gBack = (y) => {
    const t = (y - GRIP_TOP) / -96;
    return 436 + (GRIP_TOP - y) * TAN + 3.2 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  };
  const GRIP_FOOT = -130;
  function gripPoints() {
    const p = [[384, GRIP_TOP + 1]];
    for (let y = GRIP_TOP - 6; y > GRIP_FOOT + 6; y -= 1.5) p.push([gFrontStrap(y), y]);
    // a rounded foot, square to the grip
    p.push([gFront(GRIP_FOOT + 3) + 1, GRIP_FOOT + 1.4], [gFront(GRIP_FOOT) + 5, GRIP_FOOT - 0.4]);
    p.push([gBack(GRIP_FOOT) - 4, GRIP_FOOT - 0.4], [gBack(GRIP_FOOT + 3) - 0.6, GRIP_FOOT + 1.6]);
    for (let y = GRIP_FOOT + 6; y <= GRIP_TOP - 2; y += 3) p.push([gBack(y), y]);
    p.push([442, GRIP_TOP + 1]);
    return p;
  }
  function panelPoints() {
    const p = [];
    for (let y = -46; y >= -122; y -= 4) p.push([gFront(y) + 6.5, y]);
    for (let y = -122; y <= -46; y += 4) p.push([gBack(y) - 5.5, y]);
    return p;
  }
  function lowerGeo() {
    const g = [];
    // the housing under the receiver, from the front pin to the rear pin
    g.push(sideGeo([[296, RBOT], [452, RBOT], [452, -29], [446, -33], [302, -33], [296, -28]], 34.5, { bevel: 1.6 }));
    // the trigger guard, a squared front and a long rear for a gloved finger
    g.push(sideGeo(
      [[316, -31], [316, -47], [320, -56.5], [328, -62.5], [372, -62.5], [380, -58], [385, -48], [386, -32]],
      13,
      { bevel: 1.4, holes: [[[322.5, -35], [322.5, -46.5], [326, -53.5], [332, -56.5], [368, -56.5], [374.5, -52.5], [378.4, -44], [378.4, -35]]] },
    ));
    // the grip: slim, finger grooves on the front, a palm swell at the back; well rounded
    g.push(sideGeo(gripPoints(), 29, { bevel: 4, segments: 3 }));
    return merged(g);
  }
  // textured panels on both sides of the grip, and a band of ribs across its back
  function gripPanelGeo() {
    const g = [sideGeo(panelPoints(), 29.8)];
    for (let i = 0; i < 9; i++) {
      const y = -48 - i * 8.4, x = gBack(y) + 1.2;
      g.push(sideGeo([[x - 3.4, y + 1.4], [x + 0.5, y + 1.4], [x + 0.5, y - 1.4], [x - 3.4, y - 1.4]], 18));
    }
    return merged(g);
  }
  function controlsGeo() {
    const g = [];
    // the trigger: a curved blade on its pivot
    g.push(sideGeo([[344, -31], [351, -31], [350.4, -38], [349, -45], [349.6, -51.5], [347.8, -55.5], [344.6, -55.6], [344, -52.6], [345, -46], [344.6, -39], [343.4, -34]], 7, { bevel: 0.6 }));
    // the selector on the left above the grip: a hub and a lever pointing down and back (set to auto)
    g.push(cylGeo(5.4, 5.4, 2, 20, 'x', 412, -10.5, -(RW + 1)));
    g.push(sideGeo([[408, -8.4], [415.4, -8.4], [428, -21], [427, -25.5], [422.6, -25.5], [409.6, -14.6]], 2, { s: -(RW + 2.2), bevel: 0.5, segments: 1 }));
    g.push(cylGeo(1.6, 1.6, 2.8, 10, 'x', 412, -10.5, -(RW + 1.6)));
    // the magazine release paddle behind the well
    g.push(sideGeo([[292, -42], [298, -42], [304.5, -55.5], [301, -58.5], [292.5, -50.5]], 22, { bevel: 0.8 }));
    // the end cap: a pressed cap over the receiver's rear, with the stock's latch
    g.push(sectionGeo(RECV_SECTION(false).map(([s, y]) => [s * 1.02, y + (y > 0 ? 0.4 : -0.3)]), 470.4, 484, { back: (y) => -Math.max(0, y - 20) * 0.35 }));
    g.push(boxGeo(10, 6, 9, 480, -10, 0));
    // the rear sight: a drum on a short block, with guard ears on both sides
    g.push(sideGeo([[434, RTOP + 3], [462, RTOP + 3], [462, RTOP + 6], [434, RTOP + 6]], 14));
    for (const s of [-1, 1]) g.push(sideGeo([[440, RTOP + 4], [458, RTOP + 4], [456, SL + 9], [444, SL + 9]], 2.4, { s: s * 9.2, bevel: 0.4, segments: 1 }));
    return merged(g);
  }
  // the drum rear sight: a short drum across the line of sight, its peep hole on the line
  const DRUM = { x0: 444, x1: 456, r: 8.2, hole: 3.4 };
  function drumGeo() {
    const outer = arc(0, SL, DRUM.r, 0, 2 * Math.PI, 20).slice(0, -1);
    const hole = arc(0, SL, DRUM.hole, 0, 2 * Math.PI, 14).slice(0, -1);
    const g = [sectionGeo(outer, DRUM.x0, DRUM.x1, { holes: [hole] })];
    // the knurled windage knob on the right
    g.push(cylGeo(3.2, 3.2, 3, 12, 'x', 450, RTOP + 4.5, 9.2 + 2.6));
    return merged(g);
  }
  function drumHoleGeo() {
    // the inside of the peep hole, dark
    return cylGeo(DRUM.hole, DRUM.hole, DRUM.x1 - DRUM.x0 - 0.2, 14, 'z', (DRUM.x0 + DRUM.x1) / 2, SL, 0, true);
  }

  // ── the stock: two struts in the guide channels and a curved butt with a rubber pad ──
  const STOCK = { front: 470, butt: 688, collapse: 190 };
  function strutGeo() {
    const g = [];
    for (const s of [-1, 1]) g.push(tube(3.3, 3.3, STOCK.front, STOCK.butt + 4, 0, 12).translate(S(s * (RW + 2.4)), S(12), 0));
    return merged(g);
  }
  function buttGeo() {
    const g = [];
    // the butt: a pressed steel piece, the struts' yoke at the top, curved to the shoulder
    g.push(sideGeo([[STOCK.butt - 6, 20], [STOCK.butt + 6, 24], [STOCK.butt + 12, 17], [STOCK.butt + 12, -66], [STOCK.butt + 7, -76], [STOCK.butt - 4, -74], [STOCK.butt - 1, -30], [STOCK.butt - 5, 4]], 34, { bevel: 2, segments: 2 }));
    g.push(sideGeo([[STOCK.butt - 4, 16], [STOCK.butt + 6, 16], [STOCK.butt + 6, 8], [STOCK.butt - 4, 8]], 2 * (RW + 6), { bevel: 1.5 }));
    return merged(g);
  }
  function padGeo() {
    return sideGeo([[STOCK.butt + 11, 19], [STOCK.butt + 18, 17], [STOCK.butt + 18, -70], [STOCK.butt + 11, -75]], 38, { bevel: 2.5, segments: 2 });
  }

  // ── the magazine: a curved 30-round steel box, its top in the well ──
  const MAG = { top: -20, len: 172, bend: 0.5, half: 16.5, width: 22 };
  // the spine down the middle of the magazine, curving forward as it goes down
  const spine = (() => {
    const p = [[265, MAG.top]];
    const n = 24;
    for (let i = 1; i <= n; i++) {
      const th = (MAG.bend * (i - 0.5)) / n, dl = MAG.len / n, [x, y] = p[i - 1];
      p.push([x - Math.sin(th) * dl, y - Math.cos(th) * dl]);
    }
    return p.map(([x, y], i) => ({ x, y, th: (MAG.bend * i) / n }));
  })();
  // a point off the spine: `f` mm forward (toward the muzzle), at spine point i
  const off = (i, f) => {
    const q = spine[i];
    return [q.x - Math.cos(q.th) * f, q.y + Math.sin(q.th) * f];
  };
  function magBodyGeo() {
    const g = [];
    const n = spine.length - 1;
    const front = spine.map((_, i) => off(i, MAG.half)), back = spine.map((_, i) => off(i, -MAG.half)).reverse();
    g.push(sideGeo([...front, ...back], MAG.width, { bevel: 1.2 }));
    // the stamped rib down each side, a little behind the middle
    const r0 = spine.map((_, i) => off(i, -2)).slice(1, n), r1 = spine.map((_, i) => off(i, -7)).slice(1, n).reverse();
    g.push(sideGeo([...r0, ...r1], MAG.width + 1.4));
    return merged(g);
  }
  function magPlateGeo() {
    const n = spine.length - 1;
    const q = spine[n], d = [-Math.sin(q.th), -Math.cos(q.th)];
    const a = off(n, MAG.half + 2.2), b = off(n, -MAG.half - 1.4);
    const down = (p, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
    return sideGeo([down(a, 1.5), down(a, -5.5), down(b, -5.5), down(b, 1.5)], MAG.width + 3, { bevel: 1.2 });
  }
  function roundGeo() {
    // the top round in the feed lips, nose forward
    const caseG = new T.CylinderGeometry(S(4.8), S(4.8), S(19), 14);
    caseG.translate(0, S(-1.5), 0);
    const nose = new T.SphereGeometry(S(4.6), 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    nose.scale(1, 1.6, 1);
    nose.translate(0, S(8), 0);
    const g = merged([caseG, nose]);
    g.rotateX(-Math.PI / 2);
    g.translate(0, Y(MAG.top + 4.6), Z(spine[0].x - 2));
    return g;
  }

  GUN_BUILD.smg = () => {
    const b = GunBuilder();
    const root = b.group;
    const m = materials();
    root.name = 'dfdf-smg';
    root.userData.weaponModel = 'dfdf-smg';
    root.userData.modelRevision = 2;
    root.userData.fpFlash = true; // its first-person muzzle flash comes from its muzzle (18-gun-effects.js)
    root.userData.anchors = {
      // the right hand on the grip, the left hand behind the handguard at the magazine well (clear of the sights)
      right: [0.004, Y(-60), Z(416)],
      left: [S(-6), Y(-54), Z(234)],
      muzzle: [0, Y(0), Z(-1)],
      // the line of sight: the front post's tip (ADS puts it on the screen centre, in the drum's peep hole)
      sight: [0, Y(SL), Z(48.6)],
    };
    const add = (name, geo, mat, parent = root) => {
      const mesh = new T.Mesh(geo, mat);
      mesh.name = name;
      parent.add(mesh);
      return mesh;
    };
    add('smg-receiver', receiverGeo(), m.receiver);
    add('smg-spot-welds', weldGeo(), m.weld);
    add('smg-front-sight', frontSightGeo(), m.receiver);
    add('smg-cocking-tube', cockingTubeGeo(), m.receiver);
    add('smg-handguard', handguardGeo(), m.poly);
    add('smg-lower', lowerGeo(), m.poly);
    add('smg-grip-texture', gripPanelGeo(), m.grip);
    add('smg-controls', controlsGeo(), m.dark);
    add('smg-front-post', postGeo(), m.dark);
    add('smg-rear-drum', drumGeo(), m.dark);
    add('smg-barrel', barrelGeo(), m.steel);
    add('smg-bolt', boltGeo(), m.steel);
    add('smg-dark', receiverDarkGeo(), m.bore);
    add('smg-bore', boreGeo(), m.bore);
    add('smg-peep', drumHoleGeo(), m.bore);
    // the charging handle: the left hand pulls it back in a reload (54-reload-animation.js)
    const handle = new T.Group();
    handle.name = 'smg-charging-handle';
    handle.userData.legacyAction = 'charge';
    handle.userData.travel = S(HANDLE.travel);
    handle.userData.reload = { grip: HANDLE_GRIP };
    root.add(handle);
    add('smg-handle', handleGeo(), m.dark, handle).userData.live = true;
    // the stock: extended, collapsed in first person
    const stock = new T.Group();
    stock.name = 'smg-stock';
    stock.userData.firstPerson = { position: [0, 0, -S(STOCK.collapse)] };
    root.add(stock);
    add('smg-stock-struts', strutGeo(), m.steel, stock);
    add('smg-stock-butt', buttGeo(), m.butt, stock);
    add('smg-stock-pad', padGeo(), m.pad, stock);
    // the magazine: built with mag() so the reload pulls the whole assembly out of the well
    const magPart = (name, geo, mat) => {
      const mesh = b.mag(mat, S(1), S(1), S(1), 0, 0, 0, 0);
      mesh.geometry.dispose();
      mesh.geometry = geo;
      mesh.name = name;
      return mesh;
    };
    magPart('smg-magazine', magBodyGeo(), m.mag);
    magPart('smg-magazine-floorplate', magPlateGeo(), m.mag);
    magPart('smg-magazine-round', roundGeo(), m.round);
    return root;
  };
  window.GUN_MODEL_SMG = { revision: 2, mm: K };
})();
