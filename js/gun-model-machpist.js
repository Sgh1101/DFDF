(() => {
  'use strict';
  // Tempo (key "machpist"): a generic select-fire 9 mm machine pistol. A compact
  // polymer-frame striker pistol in the class of the full-auto service pistols:
  // a slide with three compensator cuts in its top, an open-emitter red dot in an
  // optic cut, a fire selector at the slide's left rear, a slide-width
  // three-chamber compensator on the barrel, finger grooves on the front strap,
  // a hand stop on the dust cover rail and a 33-round stick magazine that hangs
  // well below the grip with a wide baseplate. No maker's name, logo or marking.
  // It is not 참새 (gun-model-pistol.js) or Hush (gun-model-silenced.js): the
  // compensator, the optic, the selector, the hand stop, the long magazine and
  // the two-tone finish (a flat dark earth frame under a tungsten grey slide)
  // set it apart at a glance.
  //
  // Everything is measured in millimetres on the real gun and converted here:
  //   x: from the slide's front face backwards (-30 compensator face .. 200 grip heel)
  //   y: from the top of the slide downwards (0 .. -207 baseplate), the optic stands above 0
  //   s: across, from the centre line (+ is the right side, the ejection side)
  // The scale keeps the old blocky Tempo's footprint (0.37 long, 0.33 tall): the
  // compensator's face sits where the old muzzle was (z -0.276) and the red dot's
  // window is on the first-person aiming line.
  //
  // Material roles stay the stock GUNMAT kinds, so every skin recolours it:
  // the frame and the magazine baseplate (body), the slide, barrel and selector
  // (metal) with the stainless compensator, the optic, small parts and grip panels (dark), the red
  // dot and the front sight insert (glow). The optic's lens alone is a plain
  // material: a skin's glass is nearly opaque and would blind the aiming line.
  if (typeof GUN_BUILD === 'undefined' || typeof GunBuilder !== 'function' || typeof GUNMAT === 'undefined' || typeof T === 'undefined') return;

  const K = 0.00154; // model units per millimetre
  const BORE = -13.5; // the bore's height below the slide top (mm)
  const Y0 = 0.037; // the bore line in model units
  const Z = (x) => -0.2295 + x * K;
  const Y = (y) => Y0 + (y - BORE) * K;
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
        const ymm = (p.getY(i) - Y0) / K + BORE, z = p.getZ(i);
        if (z <= zf && opt.front) p.setZ(i, z + S(opt.front(ymm)));
        else if (z >= zb && opt.back) p.setZ(i, z + S(opt.back(ymm)));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    }
    // the walls' u runs round the section and v along the gun: swap them, so the brushed
    // finish's lines run along the slide and the compensator as they are machined
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
    return scaleUV(geo);
  }

  function boxGeo(w, h, d, x, y, s, rx = 0) {
    // w across, h tall, d long (mm); centre at x (along), y (height), s (across)
    const g = new T.BoxGeometry(S(w), S(h), S(d));
    rx && g.rotateX(rx);
    g.translate(S(s), Y(y), Z(x));
    return g;
  }

  // a cylinder (radii in mm, r0 toward the muzzle when along the gun); its UVs in metres like the rest
  function cylGeo(r0, r1, len, segs, axis, x, y, s, open = false) {
    const g = new T.CylinderGeometry(S(r0), S(r1), S(len), segs, 1, open);
    scaleUV(g, (2 * Math.PI * S(Math.max(r0, r1))) / UV_TILE, S(len) / UV_TILE);
    if (axis === 'z') g.rotateX(-Math.PI / 2);
    else if (axis === 'x') g.rotateZ(Math.PI / 2);
    g.translate(S(s), Y(y), Z(x));
    return g;
  }
  // a cylinder along the bore line between x0 (front) and x1 (rear)
  const tube = (r0, r1, x0, x1, segs = 24, open = false) => cylGeo(r0, r1, x1 - x0, segs, 'z', (x0 + x1) / 2, BORE, 0, open);
  // a flat disc or ring facing forward (toward the muzzle), at x
  function ringGeo(r0, r1, x, y = BORE, s = 0, segs = 24) {
    const g = r0 > 0 ? new T.RingGeometry(S(r0), S(r1), segs) : new T.CircleGeometry(S(r1), segs);
    g.rotateY(Math.PI);
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

  // a rounded rectangle outline ([s, y] points), for the optic's window and hood
  function roundRect(s0, s1, y0, y1, r, n = 4) {
    const p = [];
    const corner = (cs, cy, a0) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + (i / n) * (Math.PI / 2);
        p.push([cs + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    };
    corner(s1 - r, y0 + r, -Math.PI / 2);
    corner(s1 - r, y1 - r, 0);
    corner(s0 + r, y1 - r, Math.PI / 2);
    corner(s0 + r, y0 + r, Math.PI);
    return p;
  }

  // ── materials: stock kinds, own finish ──
  function materials() {
    const tone = (m, color, rough, metal) => {
      m.color.setHex(color);
      m.roughness = rough;
      m.metalness = metal;
      return m;
    };
    return {
      frame: tone(GUNMAT.tan(), 0x8a7553, 0.82, 0.04), // flat dark earth polymer frame and hand stop
      panel: tone(GUNMAT.rubber(), 0x56492f, 0.97, 0), // stippled grip panels and hand stop ribs, darker than the frame
      slide: tone(GUNMAT.gunmetal(), 0x9ba1a8, 0.4, 0.62), // tungsten grey slide: light enough to read in first person
      steel: tone(GUNMAT.steel(), 0xa9afb6, 0.28, 0.88), // barrel, selector, pins, trigger blade
      comp: tone(GUNMAT.steel(), 0xb4bac1, 0.3, 0.86), // bead-blasted stainless compensator, bright against the ports
      dark: tone(GUNMAT.blued(), 0x1b1d21, 0.5, 0.5), // slide stop, release, trigger, takedown
      optic: tone(GUNMAT.blued(), 0x17181b, 0.55, 0.45), // anodised optic, front sight, slide small parts
      bore: Object.assign(tone(GUNMAT.rubber(), 0x050506, 1, 0), { side: T.DoubleSide }), // bore, ports, slots, holes
      dot: tone(GUNMAT.glow(0xff2d1e), 0xff2d1e, 0.4, 0), // the red dot and the front sight insert
      lens: new T.MeshStandardMaterial({ color: 0x8fd8e6, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.2, side: T.DoubleSide, depthWrite: false }),
      mag: tone(GUNMAT.blued(), 0x3a3e45, 0.58, 0.35), // the magazine's charcoal polymer body, light enough to show its ribs and holes
      base: tone(GUNMAT.tan(), 0x8a7553, 0.8, 0.04), // the extended baseplate, frame colour
      round: tone(GUNMAT.brass(), 0xc9a24e, 0.32, 0.85), // the top round
    };
  }

  // ── the slide ──
  const SLIDE_W = 25.5;
  const SLIDE_LEN = 186;
  const H = SLIDE_W / 2;
  const SB = -28; // slide bottom
  const SLIDE_SECTION = [[-H, SB + 0.6], [-H + 0.6, SB], [H - 0.6, SB], [H, SB + 0.6], [H, -3.6], [H - 3, 0], [-H + 3, 0], [-H, -3.6]];
  // the ejection port: the top right cut away down to the chamber
  const PORT = [64, 104];
  const PORT_SECTION = [[-H, SB + 0.6], [-H + 0.6, SB], [H - 0.6, SB], [H, SB + 0.6], [H, -15], [-2.6, -15], [-2.6, 0], [-H + 3, 0], [-H, -3.6]];
  // the compensator cuts in the slide top: a slot down to the barrel
  const CUT_W = 3.2;
  const CUT_SECTION = [[-H, SB + 0.6], [-H + 0.6, SB], [H - 0.6, SB], [H, SB + 0.6], [H, -3.6], [H - 3, 0], [CUT_W, 0], [CUT_W, -6.5], [-CUT_W, -6.5], [-CUT_W, 0], [-H + 3, 0], [-H, -3.6]];
  const CUTS = [[13, 20], [23.5, 30.5], [34, 41]];
  // the optic cut: the slide top is milled 2.5 mm down under the red dot
  const OPTIC = [139, 181];
  const OPTIC_SECTION = [[-H, SB + 0.6], [-H + 0.6, SB], [H - 0.6, SB], [H, SB + 0.6], [H, -3.6], [H - 1.6, -2.5], [-H + 1.6, -2.5], [-H, -3.6]];
  const SERR = 1.1;

  function slideGeo() {
    const g = [];
    const nose = (y) => (y > -5 ? (y + 5) * 0.6 : y < -22 ? (-22 - y) * 0.55 : 0);
    // straight serrations: a narrower core through the zone and full-width ridges over it
    const serrations = (x0, x1, n, section = SLIDE_SECTION) => {
      g.push(sectionGeo(section, x0, x1, { sx: (SLIDE_W - 2 * SERR) / SLIDE_W }));
      const step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) g.push(sectionGeo(section, x0 + i * step + step * 0.5, x0 + (i + 1) * step, {}));
    };
    g.push(sectionGeo(SLIDE_SECTION, 0, CUTS[0][0], { front: nose }));
    let x = CUTS[0][0];
    for (const [a, b] of CUTS) {
      a > x && g.push(sectionGeo(SLIDE_SECTION, x, a));
      g.push(sectionGeo(CUT_SECTION, a, b));
      x = b;
    }
    g.push(sectionGeo(SLIDE_SECTION, x, 45));
    serrations(45, 61, 5);
    g.push(sectionGeo(SLIDE_SECTION, 61, PORT[0]));
    g.push(sectionGeo(PORT_SECTION, PORT[0], PORT[1]));
    g.push(sectionGeo(SLIDE_SECTION, PORT[1], OPTIC[0]));
    serrations(OPTIC[0], 169, 8, OPTIC_SECTION);
    g.push(sectionGeo(OPTIC_SECTION, 169, OPTIC[1]));
    g.push(sectionGeo(SLIDE_SECTION, OPTIC[1], SLIDE_LEN));
    return merged(g);
  }

  // the small parts that ride on the slide: optic, front sight, cover plate, extractor, the dark floors
  const DOT_Y = 10.5; // the red dot's height above the slide top: the first-person aiming line
  const HOOD = [143, 150.5];
  const WIN = { s: 8.4, y0: 3.6, y1: 16.2, r: 2.6 };
  const LENS_Y = 9.9, LENS_X = 149; // the lens's centre, in the middle of the leaning hood
  function opticGeo() {
    const g = [];
    // base plate in the cut and the low body behind the window, its top sloping to the rear
    g.push(sectionGeo(roundRect(-11.6, 11.6, -2.5, 3.6, 1.6), OPTIC[0] + 3, OPTIC[1] - 1));
    g.push(sectionGeo(roundRect(-11.6, 11.6, -1, 8.2, 2.4), 159, OPTIC[1] - 1.5, { back: (y) => -Math.max(0, y - 3) * 0.9 }));
    // the hood: a rounded frame round the window, leaning back at the top
    const lean = (y) => Math.max(0, y - 3) * 0.32;
    const outer = roundRect(-11.6, 11.6, 0, 18.4, 3.4);
    const inner = roundRect(-WIN.s, WIN.s, WIN.y0, WIN.y1, WIN.r).reverse();
    g.push(sectionGeo(outer, HOOD[0], HOOD[1], { holes: [inner], front: lean, back: lean }));
    // brightness buttons on both sides of the body, the emitter in front of it
    for (const s of [-1, 1]) g.push(boxGeo(1.4, 4.2, 6.5, 168, 3.6, s * 12.1));
    g.push(boxGeo(5, 3.2, 2.4, 158, 4.6, 0));
    // the front sight: a short post in a dovetail, square to the eye (it co-witnesses low in the window)
    g.push(sectionGeo([[-1.9, -0.4], [1.9, -0.4], [1.7, 5.8], [1.2, 6.6], [-1.2, 6.6], [-1.7, 5.8]], 4, 9.5, { front: (y) => Math.max(0, y) * 0.3 }));
    g.push(boxGeo(8.5, 1, 7, 6.8, -0.1, 0));
    // the slide cover plate, a little proud of the back face, its striker channel
    g.push(boxGeo(16, 20, 0.6, SLIDE_LEN + 0.2, -14.5, 0));
    g.push(boxGeo(3.6, 3.6, 0.5, SLIDE_LEN + 0.5, -13.5, 0));
    // the extractor on the right, behind the port
    g.push(boxGeo(0.7, 3.6, 16, PORT[1] + 8, -11.4, H + 0.2));
    // the dark floors under the port and the three compensator cuts
    g.push(boxGeo(14.5, 0.5, PORT[1] - PORT[0] - 0.4, (PORT[0] + PORT[1]) / 2, -14.7, 5.3));
    for (const [a, b] of CUTS) g.push(boxGeo(CUT_W * 2 - 0.1, 0.5, b - a - 0.1, (a + b) / 2, -6.3, 0));
    return merged(g);
  }
  // the fire selector at the slide's left rear: a hub on a cross pin and a lever swept down and back (set to full auto)
  function selectorGeo() {
    return merged([
      cylGeo(5, 5, 1.8, 20, 'x', 174.5, -10.5, -(H + 0.9)),
      cylGeo(1.7, 1.7, 2.8, 10, 'x', 174.5, -10.5, -(H + 1.4)),
      sideGeo([[170.2, -8.2], [178.6, -8.4], [185.6, -18.6], [185.8, -22.8], [181.6, -23.4], [172, -13.4]], 2, { s: -(H + 1.8), bevel: 0.5, segments: 1 }),
      ...[0, 1, 2].map((i) => boxGeo(0.7, 0.8, 3.8, 184.2 - i * 0.6, -17 - i * 2, -(H + 2.9), 0.75)),
    ]);
  }
  function dotGeo() {
    const g = [];
    const d = new T.CircleGeometry(S(1), 14);
    d.translate(0, Y(DOT_Y), Z(LENS_X + (DOT_Y - LENS_Y) * 0.32) + S(0.3));
    g.push(d);
    g.push(cylGeo(0.85, 0.85, 0.5, 10, 'z', 9.6, 4.6, 0)); // the front sight's insert, seen from behind
    return merged(g);
  }
  function lensGeo() {
    const shape = new T.Shape();
    path(shape, roundRect(-WIN.s, WIN.s, WIN.y0, WIN.y1, WIN.r).map(([s, y]) => [S(s), Y(y)]));
    const g = new T.ShapeGeometry(shape, 3);
    // a slight tilt like the hood's lean
    g.translate(0, -Y(LENS_Y), 0);
    g.rotateX(Math.atan(0.32));
    g.translate(0, Y(LENS_Y), Z(LENS_X));
    return scaleUV(g);
  }

  // ── the barrel and the compensator ──
  const COMP = { face: -30, back: -0.8 };
  function barrelGeo() {
    const g = [];
    g.push(tube(6.6, 6.6, COMP.back - 1.5, 34, 20)); // seen between the slide and the compensator as the slide runs back
    g.push(boxGeo(13, 7.4, PORT[1] - PORT[0] - 3, (PORT[0] + PORT[1]) / 2 + 1.2, -3.9, 0)); // hood, flush with the slide top
    g.push(cylGeo(7, 7, PORT[1] - PORT[0] - 2, 18, 'z', (PORT[0] + PORT[1]) / 2 + 0.4, BORE, 0)); // chamber under it
    g.push(cylGeo(5.2, 5.2, 36, 14, 'z', 15, -22, 0)); // the guide rod's spring, seen under the barrel when the slide runs back
    return merged(g);
  }
  // the compensator: slide-wide, flush with the slide's top; three chambers vent up and to both sides
  const CH = 12.4; // its half width
  const CB = -25.5; // its bottom
  const COMP_SECTION = [[-CH, CB + 1.2], [-CH + 1.2, CB], [CH - 1.2, CB], [CH, CB + 1.2], [CH, -3.4], [CH - 2.8, -0.6], [-CH + 2.8, -0.6], [-CH, -3.4]];
  const PORTED = [[-CH, CB + 1.2], [-CH + 1.2, CB], [CH - 1.2, CB], [CH, CB + 1.2], [CH, -19], [CH - 3.6, -19], [CH - 3.6, -7.6], [CH, -7.6], [CH, -3.4], [CH - 2.8, -0.6], [4.4, -0.6], [4.4, -7.6], [-4.4, -7.6], [-4.4, -0.6], [-CH + 2.8, -0.6], [-CH, -3.4], [-CH, -7.6], [-CH + 3.6, -7.6], [-CH + 3.6, -19], [-CH, -19]];
  const CHAMBERS = [[-25.5, -20.5], [-17.5, -12.5], [-9.5, -4.5]];
  function compGeo() {
    const g = [];
    // a chamfered front face, the walls between the chambers and a plain back
    g.push(sectionGeo(COMP_SECTION, COMP.face, CHAMBERS[0][0], { front: (y) => (y > -4 ? (y + 4) * 0.5 : y < -21 ? (-21 - y) * 0.5 : 0) }));
    let x = CHAMBERS[0][0];
    for (const [a, b] of CHAMBERS) {
      a > x && g.push(sectionGeo(COMP_SECTION, x, a));
      g.push(sectionGeo(PORTED, a, b));
      x = b;
    }
    g.push(sectionGeo(COMP_SECTION, x, COMP.back));
    // the crown boss round the bore on the face
    g.push(tube(6.2, 7.4, COMP.face - 1.2, COMP.face + 0.2, 24, true));
    g.push(ringGeo(4.6, 6.2, COMP.face - 1.2));
    // set screws under it, both sides
    for (const s of [-1, 1]) g.push(cylGeo(1.6, 1.6, 0.8, 10, 'x', -2.6, -20.5, s * (CH + 0.2)));
    return merged(g);
  }
  function compDarkGeo() {
    const g = [];
    // the bore, recessed, and its wall
    g.push(cylGeo(4.6, 4.6, 6, 16, 'z', COMP.face + 1.8, BORE, 0, true));
    g.push(ringGeo(0, 4.65, COMP.face + 4.7, BORE, 0, 16));
    // the chambers seen through the ports
    for (const [a, b] of CHAMBERS) g.push(boxGeo(2 * (CH - 3.5), 11.6, b - a - 0.2, (a + b) / 2, -13.3, 0));
    // the set screws' hex sockets
    for (const s of [-1, 1]) g.push(cylGeo(0.9, 0.9, 0.4, 6, 'x', -2.6, -20.5, s * (CH + 0.55)));
    return merged(g);
  }

  // ── the frame ──
  const TAN = Math.tan((21 * Math.PI) / 180);
  const RAKE = Math.atan(TAN);
  const GROOVE = 2.1; // the finger grooves' depth
  const front = (y) => 128 + (-44 - y) * TAN;
  // the front strap with three finger grooves (ridges at -58, -80, -102)
  const frontStrap = (y) => front(y) + (y < -58 && y > -124 ? GROOVE * 0.5 * (1 - Math.cos((2 * Math.PI * (y + 58)) / 22)) : 0);
  const back = (y) => {
    const t = (y + 50) / -72;
    return 171 + (-50 - y) * TAN + 1.8 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  };
  const BOTTOM = (x) => -126 + (x - front(-126)) * TAN; // grip bottom, square to the grip axis
  const F = [front(-126), -126];
  const R = (() => {
    let y = -110;
    for (let i = 0; i < 40; i++) y = BOTTOM(back(y));
    return [back(y), y];
  })();

  function gripPoints() {
    const p = [[124, -38], [178, -38], [180.5, -44]];
    for (let y = -48; y > R[1] + 1; y -= 4) p.push([back(y), y]);
    p.push(R, F);
    for (let y = -123; y <= -52; y += 1.5) p.push([frontStrap(y), y]);
    p.push([130, -47], [127.5, -43]);
    return p;
  }
  function panelPoints() {
    const p = [];
    for (let y = -62; y >= -114; y -= 4) p.push([front(y) + 5.2, y]);
    for (let y = -112; y <= -56; y += 4) p.push([back(y) - 4, y]);
    p.push([back(-52) - 6.5, -52], [front(-60) + 9, -54.5]);
    return p;
  }

  function frameGeo() {
    const g = [];
    // dust cover and receiver: from just behind the slide nose to the tang
    g.push(sideGeo([[9, SB], [190, SB], [190, -41], [14, -41], [9, -36]], 23, { bevel: 0.9 }));
    // trigger guard: square front with a serrated hook, its rear undercut into the grip
    g.push(sideGeo(
      [[80, -40], [81, -61], [83.2, -68.4], [88, -72], [122.5, -72], [128, -70.3], [131.8, -66.4], [133.8, -59.6], [134.3, -50], [133.4, -40]],
      12.5,
      { bevel: 1.2, holes: [[[87.4, -43], [87.8, -59.6], [90.2, -64.8], [94, -66.4], [120, -66.4], [124.6, -64.6], [127.6, -60.6], [128.7, -54.5], [128.4, -43]]] },
    ));
    // the tang and a short beavertail over the web of the hand
    g.push(sideGeo([[150, SB], [190, SB], [196, -29.8], [199, -32.4], [197.4, -35.4], [190, -38.8], [182, -42.4], [180.5, -44], [168, -44], [150, -41]], 24, { bevel: 1.4 }));
    // the grip: finger grooves on the front strap, a palm swell at the back; well rounded
    g.push(sideGeo(gripPoints(), 30.5, { bevel: 3, segments: 3 }));
    // the accessory rail: a dovetail section with three cross slots
    const RAIL = [[-8.4, -40.5], [8.4, -40.5], [8.4, -42.4], [10.2, -43.1], [10.2, -44.6], [8.8, -46], [-8.8, -46], [-10.2, -44.6], [-10.2, -43.1], [-8.4, -42.4]];
    const SLOT = [[-8.4, -40.5], [8.4, -40.5], [8.4, -42.4], [10.2, -43.1], [10.2, -43.9], [-10.2, -43.9], [-10.2, -43.1], [-8.4, -42.4]];
    let x = 18;
    for (const [a, b] of [[58, 61], [66, 69], [74, 77]]) {
      g.push(sectionGeo(RAIL, x, a));
      g.push(sectionGeo(SLOT, a, b));
      x = b;
    }
    g.push(sectionGeo(RAIL, x, 79.5));
    g.push(sectionGeo(RAIL, 13, 18, { front: (y) => Math.max(0, -41 - y) * 0.9 }));
    // the hand stop clamped on the rail's front: a clamp body and a ramp that stops the support hand sliding forward
    g.push(sideGeo([[16, -45.6], [54, -45.6], [54, -50.4], [49, -52.6], [36, -58.8], [27.6, -63.6], [22.6, -64.2], [19.2, -62], [17.4, -56], [16, -50]], 22, { bevel: 2.2, segments: 2 }));
    return merged(g);
  }
  // stippling panels on both grip sides and the hand stop's grip ribs (one extrusion each, proud of both faces)
  function panelGeo() {
    const g = [sideGeo(panelPoints(), 30.5 + 0.7, { bevel: 0 })];
    for (let i = 0; i < 4; i++) {
      const x = 39 - i * 5.2, y = -55.4 - i * 2.6;
      g.push(sideGeo([[x, y], [x + 2.6, y + 1.2], [x + 1.4, y - 1.6], [x - 1.2, y - 2.8]], 22.8));
    }
    return merged(g);
  }

  // controls: slide stop (left), takedown lever, magazine release, trigger, the hand stop's clamp screws
  function controlsGeo() {
    const g = [];
    const fw = 23 / 2;
    g.push(sideGeo([[118, -29.6], [138, -29.2], [143.6, -29.2], [145, -30.2], [144.6, -35], [137, -35.6], [132, -33], [118, -32.4]], 1.5, { s: -(fw + 0.7) }));
    for (let i = 0; i < 3; i++) g.push(boxGeo(0.5, 4.2, 0.7, 138.4 + i * 1.8, -32.4, -(fw + 1.6)));
    g.push(boxGeo(23 + 2.6, 2.4, 7, 97.5, -30.4, 0));
    g.push(boxGeo(23 + 3.2, 0.9, 2, 100, -30.4, 0));
    // magazine release behind the trigger guard, both sides
    g.push(boxGeo(30.5 + 1.4, 7.6, 6.6, 136.2, -46.8, 0));
    // trigger: a curved shoe on its bar
    g.push(sideGeo([[112, -41], [118.6, -41], [118.2, -46.5], [117.4, -52], [117.6, -58.4], [116.6, -62.4], [113.6, -62.6], [112.8, -60.4], [113.4, -54], [113, -47.4], [111.8, -44]], 7, { bevel: 0.6 }));
    g.push(boxGeo(5, 2.2, 13, 122.5, -41.8, 0));
    // the hand stop's two clamp screws on the left
    for (const x of [24, 46]) g.push(cylGeo(2.4, 2.4, 1.2, 12, 'x', x, -48.2, -11.6));
    return merged(g);
  }
  function pinsGeo() {
    return merged([
      cylGeo(1.5, 1.5, 23.6, 10, 'x', 92, -36.4, 0), // locking block pin
      cylGeo(1.5, 1.5, 23.6, 10, 'x', 116.4, -37.6, 0), // trigger pin
      cylGeo(1.5, 1.5, 30.9, 10, 'x', 170, -36.4, 0), // trigger housing pin
      sideGeo([[111.4, -46.5], [113, -46.2], [113.3, -58.8], [111.6, -60.2], [110.9, -58.2], [111.6, -52.6]], 2.1), // the trigger's safety blade
    ]);
  }

  // ── the magazine: a 33-round stick, its top inside the grip, its extended body well below ──
  const up = [-Math.sin(RAKE), Math.cos(RAKE)], fwd = [-Math.cos(RAKE), -Math.sin(RAKE)];
  const MID = [(F[0] + R[0]) / 2, (F[1] + R[1]) / 2]; // the middle of the grip's foot
  const at = (a, f) => [MID[0] + up[0] * a + fwd[0] * f, MID[1] + up[1] * a + fwd[1] * f];
  const MAG = { top: 82, bottom: -72, base: -80.4 };
  function magBodyGeo() {
    const g = [];
    // the single-stack-to-double-stack tube inside the grip, the wider extension below it
    g.push(sideGeo([at(MAG.top, 12.4), at(MAG.top - 3, 13.2), at(2, 13.2), at(2, -16.8), at(MAG.top - 1, -16.8), at(MAG.top, -15.8)], 21.4, { bevel: 1 }));
    g.push(sideGeo([at(2, 13.2), at(-1.5, 17.4), at(MAG.bottom, 17.4), at(MAG.bottom, -17), at(-1.5, -17), at(2, -16.8)], 23.2, { bevel: 1.4 }));
    // two stiffening ribs down each side of the extension
    for (const f of [-7.5, 7.5]) g.push(sideGeo([at(-6, f - 1.1), at(-6, f + 1.1), at(MAG.bottom + 2, f + 1.1), at(MAG.bottom + 2, f - 1.1)], 24.4));
    return merged(g);
  }
  function magBaseGeo() {
    // the extended baseplate: wider than the body, a finger lip at the front, bevelled all round
    return sideGeo([at(MAG.bottom + 1.5, 19.4), at(MAG.bottom - 1.4, 21.4), at(MAG.base + 1.6, 21.6), at(MAG.base, 19.6), at(MAG.base, -18.6), at(MAG.base + 2.4, -19.8), at(MAG.bottom + 1.5, -19.4)], 27.5, { bevel: 2, segments: 2 });
  }
  function magDarkGeo() {
    // witness holes down both sides of the extension, near the back edge
    const g = [];
    for (let i = 0; i < 6; i++) {
      const [x, y] = at(-10 - i * 10, -11.5);
      for (const s of [-1, 1]) g.push(cylGeo(1.5, 1.5, 0.5, 10, 'x', x, y, s * 11.75));
    }
    // the feed lips' opening at the top
    const [x, y] = at(MAG.top + 0.1, 2);
    const lip = new T.BoxGeometry(S(9), S(0.4), S(22));
    lip.rotateX(-RAKE);
    lip.translate(0, Y(y), Z(x));
    g.push(lip);
    return merged(g);
  }
  function roundGeo() {
    // the top round lying in the feed lips, square to the magazine's spine, nose forward
    const [x, y] = at(MAG.top + 4.2, 1.5);
    const caseG = new T.CylinderGeometry(S(4.8), S(4.8), S(19), 14);
    caseG.translate(0, S(-1.5), 0);
    const nose = new T.SphereGeometry(S(4.6), 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    nose.scale(1, 1.6, 1);
    nose.translate(0, S(8), 0);
    const g = merged([caseG, nose]);
    // stand it along the gun (-z is forward), then tip it with the grip's rake
    g.rotateX(-Math.PI / 2);
    g.rotateX(-RAKE);
    g.translate(0, Y(y), Z(x));
    return g;
  }

  GUN_BUILD.machpist = () => {
    const b = GunBuilder();
    const root = b.group;
    const m = materials();
    root.name = 'dfdf-machpist';
    root.userData.weaponModel = 'dfdf-machpist';
    root.userData.modelRevision = 2;
    root.userData.anchors = {
      right: [0.004, Y(-68), Z(163)],
      left: [-0.006, Y(-58), Z(32)],
      muzzle: [0, Y(BORE), Z(COMP.face - 1)],
      // the line of sight: the red dot's centre (ADS puts it on the screen centre)
      sight: [0, Y(DOT_Y), Z(LENS_X + (DOT_Y - LENS_Y) * 0.32) + S(0.3)],
    };
    const add = (name, geo, mat, parent = root) => {
      const mesh = new T.Mesh(geo, mat);
      mesh.name = name;
      parent.add(mesh);
      return mesh;
    };
    // the static gun
    add('machpist-frame', frameGeo(), m.frame);
    add('machpist-grip-panels', panelGeo(), m.panel);
    add('machpist-controls', controlsGeo(), m.dark);
    add('machpist-barrel', barrelGeo(), m.steel);
    add('machpist-pins', pinsGeo(), m.steel);
    add('machpist-compensator', compGeo(), m.comp);
    add('machpist-compensator-ports', compDarkGeo(), m.bore);
    // the slide moves as one with its optic and selector: it cycles on each shot and is racked in a reload
    const slide = new T.Group();
    slide.name = 'machpist-slide';
    slide.userData.legacyAction = 'slide';
    slide.userData.travel = S(30);
    root.add(slide);
    for (const mesh of [
      add('machpist-slide-body', slideGeo(), m.slide, slide),
      add('machpist-slide-parts', opticGeo(), m.optic, slide),
      add('machpist-selector', selectorGeo(), m.steel, slide),
      add('machpist-red-dot', dotGeo(), m.dot, slide),
      add('machpist-optic-lens', lensGeo(), m.lens, slide),
    ])
      mesh.userData.live = true;
    // the magazine: built with mag() so the reload pulls the whole assembly out of the grip;
    // each part is the box mag() makes, given the magazine's own shape (already placed in the gun)
    const magPart = (name, geo, mat) => {
      const mesh = b.mag(mat, S(1), S(1), S(1), 0, 0, 0, 0);
      mesh.geometry.dispose();
      mesh.geometry = geo;
      mesh.name = name;
      return mesh;
    };
    magPart('machpist-magazine', magBodyGeo(), m.mag);
    magPart('machpist-magazine-baseplate', magBaseGeo(), m.base);
    magPart('machpist-magazine-holes', magDarkGeo(), m.bore);
    magPart('machpist-magazine-round', roundGeo(), m.round);
    return root;
  };
  window.GUN_MODEL_MACHPIST = { revision: 2, mm: K };
})();
