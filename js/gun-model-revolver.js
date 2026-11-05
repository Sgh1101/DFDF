(() => {
  'use strict';
  // The revolver (Verdict, key "revolver"): a generic double-action six-shot .357 with a
  // 6 inch full-lug barrel under a ventilated rib, a ramp front sight with a coloured insert,
  // an adjustable rear sight, a fluted cylinder on a swing-out crane, an exposed hammer with a
  // checkered spur, a round trigger guard, a side plate held by screws and a finger-groove
  // rubber grip with plain wood inserts. Features of the common service revolvers of that
  // class are mixed; no maker's name, logo, medallion or marking anywhere.
  //
  // Everything is measured in millimetres on the real gun and converted here:
  //   x: from the muzzle face backwards (0 .. 280 at the grip's butt)
  //   y: from the bore line upwards (+23 sight line .. -118 grip butt)
  //   s: across, from the centre line (+ is the right side)
  // The bore and the muzzle stay where the old blocky revolver had them (y 0.03, z -0.36,
  // where the muzzle flash and the tracers start); its length and height stay within a tenth.
  //
  // Material roles stay the stock GUNMAT kinds, so every skin recolours it: the stainless
  // frame, barrel and crane (body: skins paint their pattern there), the polished cylinder,
  // hammer, trigger and screws (metal), the blued sights, rubber grip and the dark bores
  // (dark), plain wood grip inserts (body) and a glowing front insert (glow).
  //
  // Moving parts for the reload (54-reload-animation.js) and the shot:
  //   revolver-crane     legacyAction "crane": swings out to the left about its pin (userData.open rad)
  //   revolver-cylinder  legacyAction "cylinder": turns a sixth on each shot (userData.spin)
  //   revolver-ejector   legacyAction "ejector": the rod and star push the empties back (userData.travel)
  //   revolver-rounds    legacyAction "rounds": the six case heads, hidden while the chambers are empty
  //   revolver-hammer    legacyAction "hammer": cocks back and falls with each shot (userData.cock)
  //   revolver-trigger   legacyAction "trigger": pulled with each shot (userData.pull)
  // The crane also carries what the speedloader needs: the open angle, the chamber circle
  // and the cartridge size, and where its cylinder's rear face is (userData.reload).
  if (typeof GUN_BUILD === 'undefined' || typeof GunBuilder !== 'function' || typeof GUNMAT === 'undefined' || typeof T === 'undefined') return;

  const K = 0.00185; // model units per millimetre
  const Z = (x) => -0.36 + x * K;
  const Y = (y) => 0.03 + y * K;
  const S = (s) => s * K;
  const UV_TILE = 0.16; // parts carry metre UVs; one texture tile per 0.16 like the boxes the skins fit

  // the cylinder: six chambers on a 13 mm circle, the top one on the bore
  const CYL = { front: 152.4, rear: 194.6, r: 19.5, axis: -13, chamber: 13, hole: 4.7, rim: 5.6 };
  CYL.mid = (CYL.front + CYL.rear) / 2;
  const FW = 16.75; // half the frame's width: the cylinder (39 mm) stands proud of it either side
  const WINDOW = { front: 151.4, rear: 195.6, top: 7.2, bottom: -33.2 };
  // the crane's pin: in the frame's lower left corner, parallel to the bore
  const PIVOT = { s: -12.5, y: -32 };
  const OPEN = Math.PI / 2; // how far the crane swings out
  const CHAMBER_ANGLES = [0, 1, 2, 3, 4, 5].map((i) => Math.PI / 2 + (i * Math.PI) / 3);

  function scaleUV(geo, su = 1 / UV_TILE, sv = 1 / UV_TILE) {
    const uv = geo.attributes.uv;
    if (!uv) return geo;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    uv.needsUpdate = true;
    return geo;
  }

  // A side profile ([x, y] mm points) extruded across the gun, width in mm, centred on `s`.
  function sideGeo(points, width, opt = {}) {
    const shape = new T.Shape();
    points.forEach(([x, y], i) => (i ? shape.lineTo(-Z(x), Y(y)) : shape.moveTo(-Z(x), Y(y))));
    shape.closePath();
    for (const hole of opt.holes || []) {
      const p = new T.Path();
      hole.forEach(([x, y], i) => (i ? p.lineTo(-Z(x), Y(y)) : p.moveTo(-Z(x), Y(y))));
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
    points.forEach(([s, y], i) => (i ? shape.lineTo(S(s), Y(y)) : shape.moveTo(S(s), Y(y))));
    shape.closePath();
    for (const hole of opt.holes || []) {
      const h = new T.Path();
      hole.forEach(([s, y], i) => (i ? h.lineTo(S(s), Y(y)) : h.moveTo(S(s), Y(y))));
      h.closePath();
      shape.holes.push(h);
    }
    const geo = new T.ExtrudeGeometry(shape, { depth: S(x1 - x0), bevelEnabled: false, steps: 1, curveSegments: 4 });
    geo.translate(0, 0, Z(x0));
    if (opt.front || opt.back) {
      const p = geo.attributes.position, zf = Z(x0) + 1e-6, zb = Z(x1) - 1e-6;
      for (let i = 0; i < p.count; i++) {
        const ymm = (p.getY(i) - 0.03) / K, z = p.getZ(i);
        if (z <= zf && opt.front) p.setZ(i, z + S(opt.front(ymm)));
        else if (z >= zb && opt.back) p.setZ(i, z + S(opt.back(ymm)));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    }
    return scaleUV(geo);
  }

  // A turned part: a profile of [x, r] mm points (x increasing for an outward face) spun
  // round an axis along the gun at height y, across s. Its UVs run along the part, so the
  // brushed finish follows the barrel.
  function latheGeo(profile, segs, y = 0, s = 0) {
    const pts = profile.map(([x, r]) => new T.Vector2(Math.max(0, S(r)), x * K));
    const geo = new T.LatheGeometry(pts, segs);
    const uv = geo.attributes.uv, np = pts.length;
    const rMax = Math.max(...profile.map(([, r]) => r)) * K;
    const along = [0];
    for (let j = 1; j < np; j++) along.push(along[j - 1] + pts[j].distanceTo(pts[j - 1]));
    for (let i = 0; i <= segs; i++) for (let j = 0; j < np; j++) uv.setXY(i * np + j, along[j] / UV_TILE, ((i / segs) * Math.PI * 2 * rMax) / UV_TILE);
    uv.needsUpdate = true;
    geo.rotateX(Math.PI / 2); // the lathe's axis onto the gun's, front toward the muzzle
    geo.translate(S(s), Y(y), Z(0));
    return geo;
  }

  function boxGeo(w, h, d, x, y, s, rx = 0, rz = 0) {
    // w across, h tall, d long (mm); centre at x (along), y (height), s (across)
    const g = new T.BoxGeometry(S(w), S(h), S(d));
    rx && g.rotateX(rx);
    rz && g.rotateZ(rz);
    g.translate(S(s), Y(y), Z(x));
    return scaleUV(g, 1, 1);
  }

  // a cylinder (radii in mm); axis 'z' along the gun, 'x' across, 'y' up
  function cylGeo(r0, r1, len, segs, axis, x, y, s, open = false) {
    const g = new T.CylinderGeometry(S(r0), S(r1), S(len), segs, 1, open);
    scaleUV(g, (2 * Math.PI * S(Math.max(r0, r1))) / UV_TILE, S(len) / UV_TILE);
    if (axis === 'z') g.rotateX(-Math.PI / 2);
    else if (axis === 'x') g.rotateZ(Math.PI / 2);
    g.translate(S(s), Y(y), Z(x));
    return g;
  }

  // an outline in the (s, y) plane (mm) extruded along the gun from x0 to x1
  function plateGeo(points, x0, x1) {
    return sectionGeo(points, x0, x1);
  }
  // the convex hull of some [s, y] points, counter-clockwise
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) {
      while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
      lo.push(q);
    }
    for (const q of p.slice().reverse()) {
      while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
      up.push(q);
    }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  const circle = (s, y, r, n = 16, a0 = 0) => Array.from({ length: n }, (_, i) => [s + r * Math.cos(a0 + (i / n) * Math.PI * 2), y + r * Math.sin(a0 + (i / n) * Math.PI * 2)]);

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
  // move a geometry built in gun coordinates into a part's own frame (its origin at `o`)
  const local = (geo, o) => (geo.translate(-o[0], -o[1], -o[2]), geo);

  // ── materials: stock kinds, own finish ──
  function materials() {
    const tone = (m, color, rough, metal) => {
      m.color.setHex(color);
      m.roughness = rough;
      m.metalness = metal;
      return m;
    };
    return {
      frame: tone(GUNMAT.black(), 0xb9bec4, 0.36, 0.72), // brushed stainless frame, barrel and crane
      cyl: tone(GUNMAT.steel(), 0xd2d6db, 0.24, 0.82), // the polished cylinder
      small: tone(GUNMAT.gunmetal(), 0x5a6068, 0.3, 0.8), // hammer, trigger, latch, screws, ejector: darker polished steel
      sight: tone(GUNMAT.blued(), 0x16171a, 0.55, 0.45), // blued sight blade and rear sight
      grip: tone(GUNMAT.rubber(), 0x1c1d20, 0.95, 0), // the finger-groove rubber grip
      wood: tone(GUNMAT.woodDark(), 0x4a2a18, 0.45, 0.02), // plain walnut inserts, no medallion
      bore: Object.assign(tone(GUNMAT.rubber(), 0x050506, 1, 0), { side: T.DoubleSide }), // bore, chambers, seams, slots
      insert: tone(GUNMAT.glow(0xff5a1f), 0xff5a1f, 0.4, 0), // front sight insert
      brass: tone(GUNMAT.brass(), 0xc9a24e, 0.32, 0.85), // case heads
      primer: tone(GUNMAT.copper(), 0xb8a07a, 0.35, 0.8), // primers
    };
  }

  // ── the barrel: round, crowned, a full lug under it and a ventilated rib over it ──
  function barrelGeo() {
    const g = [];
    // the crown: a recessed face cut at an angle, then the barrel's outside back into the frame
    g.push(latheGeo([[0.9, 4.6], [0.2, 7.2], [0.6, 8.6], [2, 9.6], [138.6, 9.6], [138.6, 0]], 32));
    // the lug: a rounded bar under the barrel, its front face raked back
    const LUG = [[-7.6, -3], [7.6, -3], [7.6, -20.5], [6.9, -23.6], [5, -26], [2.4, -27.1], [-2.4, -27.1], [-5, -26], [-6.9, -23.6], [-7.6, -20.5]];
    g.push(sectionGeo(LUG, 3.5, 138.6, { front: (y) => Math.max(0, -y - 6) * 0.42 }));
    // the rib: posts and a flat top bar with long vent windows through it
    const holes = [];
    for (let x = 30; x + 10 <= 134; x += 14.5) holes.push([[x, 10.6], [x + 10, 10.6], [x + 10, 13.1], [x, 13.1]]);
    g.push(sideGeo([[5, 8], [138.6, 8], [138.6, 15], [12, 15], [5, 13.4]], 9, { bevel: 0.5, holes }));
    // the front sight's base on the rib
    g.push(sideGeo([[3, 13.2], [6, 15.4], [22, 15.4], [22, 14], [3, 12.6]], 6, { bevel: 0.4 }));
    // the barrel's breech in the window, in front of the cylinder
    g.push(latheGeo([[150.9, 0], [150.9, 8], [151.95, 7.2], [151.95, 0]], 24));
    return merged(g);
  }
  function boreGeo() {
    // the bore: a dark blind hole, seen through the crown
    return merged([latheGeo([[10, 0], [10, 4.6], [0.85, 4.6]], 20)]);
  }

  // ── the frame: the lower frame with its window, the front post round the barrel, the top strap ──
  function frameGeo() {
    const g = [];
    // lower frame: round the cylinder window, back to the hammer and the grip frame
    g.push(sideGeo([
      [138.6, -4], [138.6, -27], [141, -33.4], [145, -37], [205, -37], [211, -37.5], [216.5, -33], [220.5, -22], [222.4, -10], [221.8, -2], [219.5, 4.5], [215.5, 8.5], [205.5, 9.6],
      [WINDOW.rear, 9.6], [WINDOW.rear, WINDOW.bottom + 1], [WINDOW.rear - 1, WINDOW.bottom], [WINDOW.front + 1, WINDOW.bottom], [WINDOW.front, WINDOW.bottom + 1], [WINDOW.front, -4],
    ], 2 * FW, { bevel: 1.2 }));
    // the front post round the barrel's breech, rounded on top into the rib
    g.push(sectionGeo([[-FW, -4], [FW, -4], [FW, 5], [FW - 1.9, 10.4], [11.4, 14.4], [6, 15.4], [-6, 15.4], [-11.4, 14.4], [-FW + 1.9, 10.4], [-FW, 5]], 138.6, WINDOW.front));
    // the top strap over the cylinder, rounded, flat on top under the rear sight
    g.push(sectionGeo([[-13, WINDOW.top], [13, WINDOW.top], [13, 10.6], [10.6, 14.2], [6, 15.4], [-6, 15.4], [-10.6, 14.2], [-13, 10.6]], WINDOW.front - 0.4, 207));
    // the ears either side of the hammer slot
    for (const s of [-1, 1]) g.push(sideGeo([[205.5, 8], [205.5, 13.6], [209, 14.2], [214.5, 12.2], [218.5, 7], [218.5, 4]], 5.2, { s: s * 6.3, bevel: 0.6 }));
    // the trigger guard: round, joining the frame in front and at the grip
    const C = [184, -40.5], ro = [24.5, 26], ri = [20, 21.6];
    const top = -35.6;
    const ao = Math.asin((top - C[1]) / ro[1]), ai = Math.asin((top - C[1]) / ri[1]);
    const ring = [];
    for (let i = 0; i <= 28; i++) {
      const a = Math.PI - ao + (i / 28) * (Math.PI + 2 * ao);
      ring.push([C[0] + ro[0] * Math.cos(a), C[1] + ro[1] * Math.sin(a)]);
    }
    for (let i = 0; i <= 28; i++) {
      const a = 2 * Math.PI + ai - (i / 28) * (Math.PI + 2 * ai);
      ring.push([C[0] + ri[0] * Math.cos(a), C[1] + ri[1] * Math.sin(a)]);
    }
    g.push(sideGeo(ring, 8.6, { bevel: 1.6, segments: 3 }));
    // the side plate's raised face on the right, a little proud of the frame
    g.push(sideGeo(SIDE_PLATE, 0.5, { s: FW + 0.2 }));
    return merged(g);
  }
  const SIDE_PLATE = [[197, -35], [197, 7], [211, 7.6], [218.4, 2], [220.4, -10], [218.4, -24], [213.6, -35]];

  // dark details: the side plate's seam, screw slots, the latch grooves
  function seamGeo() {
    const g = [];
    // the seam round the side plate: a thin dark outline just proud of the frame
    const cx = SIDE_PLATE.reduce((a, p) => a + p[0], 0) / SIDE_PLATE.length, cy = SIDE_PLATE.reduce((a, p) => a + p[1], 0) / SIDE_PLATE.length;
    const inset = SIDE_PLATE.map(([x, y]) => [cx + (x - cx) * 0.965, cy + (y - cy) * 0.97]);
    g.push(sideGeo(SIDE_PLATE, 0.3, { s: FW + 0.52, holes: [inset.slice().reverse()] }));
    // screw slots
    for (const [x, y, s] of SCREWS) g.push(boxGeo(0.6, 3.6, 0.6, x, y, s + Math.sign(s) * 0.45));
    // the latch's grooves
    for (let i = 0; i < 4; i++) g.push(boxGeo(0.5, 6, 0.7, 202.5 + i * 2.6, -7, -(FW + 2.8)));
    return merged(g);
  }
  // [x, y, s] of the screw heads: three on the side plate, the crane screw in front
  const SCREWS = [[201, -30, FW + 0.7], [215.5, -22, FW + 0.7], [207, 3.5, FW + 0.7], [145, -26, FW + 0.45]];

  function smallGeo() {
    const g = [];
    for (const [x, y, s] of SCREWS) g.push(cylGeo(2.5, 2.5, 0.9, 14, 'x', x, y, s));
    // the cylinder release latch, behind the cylinder on the left
    g.push(sideGeo([[199, -3], [212.5, -3], [214, -5], [214, -9.4], [212.5, -11], [199, -11]], 2.8, { s: -(FW + 1.3), bevel: 0.5 }));
    return merged(g);
  }

  // ── sights ──
  function sightGeo() {
    const g = [];
    // the front blade: a ramp rising to a square rear face
    g.push(sideGeo([[5.5, 15], [16, 23.2], [20, 23.2], [20, 15]], 3.2, { bevel: 0.25 }));
    // the rear sight: a body on the top strap, its blade with a square notch, the adjusting screws
    g.push(sectionGeo([[-6.4, 15], [6.4, 15], [6.4, 19.2], [5.2, 20.6], [-5.2, 20.6], [-6.4, 19.2]], 195.5, 209.5, { front: (y) => Math.max(0, y - 15) * 1.7 }));
    g.push(sectionGeo([[-7.6, 15.4], [7.6, 15.4], [7.6, 23], [1.6, 23], [1.6, 19.4], [-1.6, 19.4], [-1.6, 23], [-7.6, 23]], 208.6, 211.6));
    return merged(g);
  }
  function sightScrewsGeo() {
    return merged([
      cylGeo(1.5, 1.5, 1.2, 10, 'y', 201.5, 21, 0), // elevation
      cylGeo(1.3, 1.3, 1, 10, 'x', 209.5, 21, 7.9), // windage
    ]);
  }
  function insertGeo() {
    // the coloured insert in the front blade, its rear end square to the eye
    return sideGeo([[13, 18.6], [16.4, 21.7], [20.15, 21.7], [20.15, 18.6]], 3.4);
  }

  // ── the grip: finger grooves on the front strap, a palm swell on the back, rounded all round ──
  const RAKE = 0.33; // how far the grip leans back (mm per mm down)
  const frontStrap = (y) => 211 + (-36 - y) * RAKE;
  const backStrap = (y) => {
    const t = Math.min(1, Math.max(0, (y + 12) / -100));
    return 236 + (-12 - y) * 0.4 + 2.6 * Math.sin(Math.PI * t);
  };
  const ridges = (y) => [-53, -72.5, -92.5].reduce((a, r) => a + 3.6 * Math.exp(-(((y - r) / 4.2) ** 2)), 0);
  function gripPoints() {
    const p = [[211, -36]];
    for (let y = -38; y >= -112; y -= 2) p.push([frontStrap(y) - ridges(y), y]);
    p.push([frontStrap(-116) + 1.4, -118.4], [frontStrap(-116) + 5, -119.6]); // the front of the butt, rounded
    p.push([backStrap(-112) - 6, -117.4], [backStrap(-112) - 1.6, -115.6]); // the butt, a little higher at the back
    for (let y = -112; y <= -14; y += 4) p.push([backStrap(y), y]);
    p.push([234.6, -6], [231.6, -0.6], [227.6, 2.4], [223.6, 1.6], [221.6, -4], [220.6, -14], [218.4, -25], [215.6, -33]);
    return p;
  }
  function insertPoints() {
    const p = [];
    for (let y = -30; y >= -96; y -= 5) p.push([frontStrap(y) + 6.8, y]);
    p.push([frontStrap(-100) + 9, -101.5], [backStrap(-100) - 10, -101.5]);
    for (let y = -96; y <= -26; y += 5) p.push([backStrap(y) - 7.2, y]);
    p.push([backStrap(-22) - 9.5, -21.5], [frontStrap(-24) + 9, -24.5]);
    return p;
  }
  function gripGeo() {
    return sideGeo(gripPoints(), 36, { bevel: 4.2, segments: 3 });
  }
  function gripInsertGeo() {
    return sideGeo(insertPoints(), 36 - 2 * 0.3 + 0.9, { bevel: 0.45 });
  }

  // ── the hammer (its pin at H) and the trigger (its pin at TR) ──
  const H = [213.5, -2];
  function hammerGeo() {
    const g = [];
    g.push(sideGeo([[207.4, 3.5], [208.2, 9.6], [210.6, 13.4], [215, 15.4], [220, 15], [220.4, 10], [219, 6], [217.4, 0.5], [216, -6], [210, -6], [207.4, -1]], 7, { bevel: 0.6 }));
    // the spur: wider, swept back over the web of the hand, its end turned down
    g.push(sideGeo([[214.6, 14.8], [220, 16.6], [226, 17.8], [231, 17.9], [234.4, 16.9], [235.4, 14.8], [233.4, 13.6], [228, 13.2], [222.6, 11.4], [219.2, 8.6], [215.6, 10.4]], 10, { bevel: 1.1, segments: 2 }));
    return merged(g);
  }
  function hammerCheckerGeo() {
    // cross grooves over the spur's top
    const g = [], a = [219.6, 16.7], b = [232, 18];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 0.15;
      g.push(boxGeo(10.2, 0.7, 0.6, x, y, 0, ang));
    }
    // and a few along the spur, for the checkering
    for (const s of [-2.6, 0, 2.6]) g.push(boxGeo(0.45, 0.6, 12.6, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.3, s, ang));
    return merged(g);
  }
  const TR = [175, -33];
  function triggerGeo() {
    // a smooth wide face curving forward at the tip
    return sideGeo([[172.4, -34], [172.9, -42], [172.2, -49], [170.2, -55], [167.2, -59.4], [168.8, -60.6], [172.8, -57.6], [175.6, -51.4], [177.2, -44], [177.8, -34]], 7.4, { bevel: 0.6 });
  }

  // ── the cylinder: front and rear bands, six flutes between, chambers, notches ──
  function flutedSection(n = 144) {
    const Rc = 22, rf = 5.5, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let r = CYL.r;
      for (let f = 0; f < 6; f++) {
        let d = a - (f * Math.PI) / 3;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const q = Rc * Math.sin(d);
        if (Math.abs(q) < rf && Math.cos(d) > 0) r = Math.min(r, Rc * Math.cos(d) - Math.sqrt(rf * rf - q * q));
      }
      pts.push([r * Math.cos(a), CYL.axis + r * Math.sin(a)]);
    }
    return pts;
  }
  const FLUTE = [159, 186];
  function cylinderGeo() {
    const g = [];
    // the faces: discs with the six chamber mouths cut through them
    const mouths = [0, 1, 2, 3, 4, 5].map((i) => circle(...chamberAt(i), CYL.hole, 18));
    g.push(sectionGeo(circle(0, CYL.axis, 17.85, 48), CYL.front, CYL.front + 0.4, { holes: mouths }));
    g.push(latheGeo([[CYL.front, 17.8], [CYL.front + 1.4, CYL.r], [FLUTE[0], CYL.r], [FLUTE[0], 0]], 48, CYL.axis));
    g.push(sectionGeo(flutedSection(), FLUTE[0], FLUTE[1]));
    g.push(latheGeo([[FLUTE[1], 0], [FLUTE[1], CYL.r], [CYL.rear - 1.3, CYL.r], [CYL.rear, CYL.r - 1.2]], 48, CYL.axis));
    g.push(sectionGeo(circle(0, CYL.axis, CYL.r - 1.15, 48), CYL.rear - 0.4, CYL.rear, { holes: mouths }));
    return merged(g);
  }
  const chamberAt = (i, r = CYL.chamber) => [r * Math.cos(CHAMBER_ANGLES[i]), CYL.axis + r * Math.sin(CHAMBER_ANGLES[i])];
  function cylinderDarkGeo() {
    const g = [];
    for (let i = 0; i < 6; i++) {
      const [s, y] = chamberAt(i);
      // the chamber mouths in front, a short dark well each; the empty chambers at the back
      g.push(latheGeo([[CYL.front + 5, 0], [CYL.front + 5, CYL.hole], [CYL.front - 0.02, CYL.hole]], 16, y, s));
      g.push(latheGeo([[CYL.rear + 0.02, CYL.hole], [CYL.rear - 5, CYL.hole], [CYL.rear - 5, 0]], 16, y, s));
      // the bolt notch over each chamber on the rear band
      const a = CHAMBER_ANGLES[i];
      const notch = new T.BoxGeometry(S(2.8), S(1.2), S(5));
      notch.translate(0, S(CYL.r - 0.45), 0);
      notch.rotateZ(a - Math.PI / 2);
      notch.translate(0, Y(CYL.axis), Z(CYL.rear - 6.2));
      g.push(scaleUV(notch, 1, 1));
    }
    // the recess round the ejector star in the rear face
    g.push(plateGeo(starPoints(1.1), CYL.rear - 0.3, CYL.rear + 0.12));
    return merged(g);
  }
  function starPoints(k) {
    const star = [];
    for (let i = 0; i < 12; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 6;
      const r = (i % 2 ? 12.2 : 7.1) * k;
      star.push([r * Math.cos(a), CYL.axis + r * Math.sin(a)]);
    }
    return star;
  }
  function ejectorGeo() {
    const g = [];
    // the rod: from the star forward through the crane into the lug, its tip knurled
    g.push(cylGeo(3, 3, CYL.front - 116, 14, 'z', (CYL.front + 116) / 2, CYL.axis, 0));
    g.push(cylGeo(3.6, 3.6, 7, 14, 'z', 116 + 3.5, CYL.axis, 0));
    // the star: a six-armed plate between the case heads
    g.push(plateGeo(starPoints(1), CYL.rear - 1, CYL.rear + 0.35));
    return merged(g);
  }
  function roundsGeo() {
    const g = [];
    for (let i = 0; i < 6; i++) {
      const [s, y] = chamberAt(i);
      g.push(latheGeo([[CYL.rear - 2, 0], [CYL.rear - 2, CYL.rim], [CYL.rear + 0.3, CYL.rim], [CYL.rear + 0.3, 0]], 18, y, s));
    }
    return merged(g);
  }
  function primersGeo() {
    return merged([0, 1, 2, 3, 4, 5].map((i) => {
      const [s, y] = chamberAt(i);
      return cylGeo(2.2, 2.2, 0.3, 12, 'z', CYL.rear + 0.4, y, s);
    }));
  }
  // the crane: its arm in front of the cylinder, the tube round the rod, the pin barrel
  function craneGeo() {
    const g = [];
    const arm = hull([...circle(0, CYL.axis, 6.4, 20), ...circle(PIVOT.s, PIVOT.y, 3.8, 14)]);
    g.push(plateGeo(arm, 147.4, 152.05));
    g.push(cylGeo(5.2, 5.2, 9, 20, 'z', 143.4 + 0.1, CYL.axis, 0));
    g.push(cylGeo(3.8, 3.8, 13, 16, 'z', 145.5, PIVOT.y, PIVOT.s));
    return merged(g);
  }

  GUN_BUILD.revolver = () => {
    const b = GunBuilder();
    const root = b.group;
    const m = materials();
    root.name = 'dfdf-revolver';
    root.userData.weaponModel = 'dfdf-revolver';
    root.userData.modelRevision = 2;
    root.userData.anchors = {
      right: [0.004, Y(-64), Z(238)],
      muzzle: [0, Y(0), Z(-1)],
    };
    const add = (name, geo, mat, parent = root, live = parent !== root) => {
      const mesh = new T.Mesh(geo, mat);
      mesh.name = name;
      live && (mesh.userData.live = true);
      parent.add(mesh);
      return mesh;
    };
    const group = (name, parent, at, action, data = {}) => {
      const g = new T.Group();
      g.name = name;
      g.position.set(...at);
      action && (g.userData.legacyAction = action);
      Object.assign(g.userData, data);
      parent.add(g);
      return g;
    };
    // the static gun
    add('revolver-barrel', barrelGeo(), m.frame);
    add('revolver-frame', frameGeo(), m.frame);
    add('revolver-bore', boreGeo(), m.bore);
    add('revolver-seams', seamGeo(), m.bore);
    add('revolver-small-parts', smallGeo(), m.small);
    add('revolver-sights', sightGeo(), m.sight);
    add('revolver-sight-screws', sightScrewsGeo(), m.small);
    add('revolver-sight-insert', insertGeo(), m.insert);
    add('revolver-grip', gripGeo(), m.grip);
    add('revolver-grip-inserts', gripInsertGeo(), m.wood);
    // the hammer and the trigger turn on their pins
    const hp = [0, Y(H[1]), Z(H[0])];
    const hammer = group('revolver-hammer', root, hp, 'hammer', { cock: 0.62 });
    add('revolver-hammer-body', local(hammerGeo(), hp), m.small, hammer);
    add('revolver-hammer-checkering', local(hammerCheckerGeo(), hp), m.sight, hammer);
    const tp = [0, Y(TR[1]), Z(TR[0])];
    const trigger = group('revolver-trigger', root, tp, 'trigger', { pull: 0.32 });
    add('revolver-trigger-blade', local(triggerGeo(), tp), m.small, trigger);
    // the crane swings out on its pin to the left; the cylinder turns on it
    const pp = [S(PIVOT.s), Y(PIVOT.y), Z(CYL.mid)];
    const cp = [0, Y(CYL.axis), Z(CYL.mid)];
    const crane = group('revolver-crane', root, pp, 'crane', {
      open: OPEN,
      reload: {
        // in the crane's own frame: the cylinder's rear face centre
        rear: [cp[0] - pp[0], cp[1] - pp[1], Z(CYL.rear + 0.3) - pp[2]],
        chamberR: S(CYL.chamber),
        angles: CHAMBER_ANGLES,
        caseR: S(4.8),
        caseLen: S(33),
        rimR: S(CYL.rim),
      },
    });
    add('revolver-crane-arm', local(craneGeo(), pp), m.frame, crane);
    const cylinder = group('revolver-cylinder', crane, [cp[0] - pp[0], cp[1] - pp[1], 0], 'cylinder', { spin: Math.PI / 3 });
    add('revolver-cylinder-body', local(cylinderGeo(), cp), m.cyl, cylinder);
    add('revolver-chambers', local(cylinderDarkGeo(), cp), m.bore, cylinder);
    const ejector = group('revolver-ejector', cylinder, [0, 0, 0], 'ejector', { travel: S(15) });
    add('revolver-ejector-rod', local(ejectorGeo(), cp), m.small, ejector);
    const rounds = group('revolver-rounds', ejector, [0, 0, 0], 'rounds');
    add('revolver-case-heads', local(roundsGeo(), cp), m.brass, rounds);
    add('revolver-primers', local(primersGeo(), cp), m.primer, rounds);
    return root;
  };
  window.GUN_MODEL_REVOLVER = { revision: 2, mm: K };
})();
