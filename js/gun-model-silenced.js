(() => {
  'use strict';
  // The suppressed pistol (부엉이, key "silenced"): a generic full-size polymer
  // striker-fired 9 mm with a threaded barrel and a long cylindrical suppressor,
  // drawn from real proportions (pistol about 207 x 136 x 33 mm, suppressor
  // 143 x 35 mm) at the size the old blocky suppressed pistol had in the game.
  // It is not the compact 참새 (gun-model-pistol.js) made longer: the slide is
  // longer, its serrations are raked, the sights are tall suppressor-height
  // sights, the front strap is straight and the magazine well flares.
  // No maker's name, logo or marking anywhere.
  //
  // Everything is measured in millimetres on the real gun and converted here:
  //   x: from the slide's front face backwards (-150 suppressor tip .. 207 tang)
  //   y: from the top of the slide downwards (0 .. -134), sights stand above 0
  //   s: across, from the centre line (+ is the right side, the ejection side)
  // The bore keeps the old model's line (y 0.03 in model units), the
  // suppressor's front face sits where the old one ended (z -0.567, where the
  // muzzle flash and the tracers start) and the tang where its grip ended.
  //
  // Material roles stay the stock GUNMAT kinds, so every skin recolours it:
  // polymer frame and the suppressor tube (body), gunmetal slide, steel barrel
  // and machined suppressor caps (metal), blued small parts and rubber grip
  // panels (dark), glow sight dots (glow).
  if (typeof GUN_BUILD === 'undefined' || typeof GunBuilder !== 'function' || typeof GUNMAT === 'undefined' || typeof T === 'undefined') return;

  const K = 0.0019; // model units per millimetre
  const BORE = -15; // the bore's height below the slide top (mm)
  const Z = (x) => -0.2815 + x * K;
  const Y = (y) => 0.03 + (y - BORE) * K;
  const S = (s) => s * K;
  const UV_TILE = 0.16; // parts carry metre UVs; one texture tile per 0.16 like the boxes the skins fit

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
  // `front(y)` / `back(y)` (mm) move the front / rear face along the gun by height,
  // for sloped noses and the raked serrations.
  function sectionGeo(points, x0, x1, opt = {}) {
    const shape = new T.Shape();
    const sx = opt.sx || 1;
    points.forEach(([s, y], i) => (i ? shape.lineTo(S(s * sx), Y(y)) : shape.moveTo(S(s * sx), Y(y))));
    shape.closePath();
    const geo = new T.ExtrudeGeometry(shape, { depth: S(x1 - x0), bevelEnabled: false, steps: 1, curveSegments: 4 });
    geo.translate(0, 0, Z(x0));
    if (opt.front || opt.back) {
      const p = geo.attributes.position, zf = Z(x0) + 1e-6, zb = Z(x1) - 1e-6;
      for (let i = 0; i < p.count; i++) {
        const ymm = (p.getY(i) - 0.03) / K + BORE, z = p.getZ(i);
        if (z <= zf && opt.front) p.setZ(i, z + S(opt.front(ymm)));
        else if (z >= zb && opt.back) p.setZ(i, z + S(opt.back(ymm)));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    }
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
  const tube = (r0, r1, x0, x1, segs = 28, open = false) => cylGeo(r0, r1, x1 - x0, segs, 'z', (x0 + x1) / 2, BORE, 0, open);
  // a flat ring facing forward (the end faces of the suppressor), at x
  function ringGeo(r0, r1, x, segs = 28) {
    const g = new T.RingGeometry(S(r0), S(r1), segs);
    g.rotateY(Math.PI); // face the muzzle (-z)
    g.translate(0, Y(BORE), Z(x));
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

  // ── materials: stock kinds, own finish ──
  function materials() {
    const tone = (m, color, rough, metal) => {
      m.color.setHex(color);
      m.roughness = rough;
      m.metalness = metal;
      return m;
    };
    return {
      frame: tone(GUNMAT.polymer(), 0x2c2f34, 0.86, 0.04), // matte black polymer
      panel: tone(GUNMAT.rubber(), 0x26292d, 0.97, 0), // stippled grip panels
      slide: tone(GUNMAT.gunmetal(), 0x5b5f66, 0.42, 0.55), // nitrided slide
      steel: tone(GUNMAT.steel(), 0x8d939b, 0.32, 0.85), // barrel, threads, pins
      can: tone(GUNMAT.black(), 0x303338, 0.6, 0.35), // anodised suppressor tube
      cap: tone(GUNMAT.gunmetal(), 0x4d5259, 0.36, 0.72), // machined end caps and collar
      bore: Object.assign(tone(GUNMAT.rubber(), 0x050506, 1, 0), { side: T.DoubleSide }), // the dark bore and spanner holes
      dark: tone(GUNMAT.blued(), 0x1b1d21, 0.5, 0.55), // controls, trigger, the bore
      sight: tone(GUNMAT.blued(), 0x18191c, 0.6, 0.45), // tall sights (they ride with the slide)
      dot: tone(GUNMAT.glow(0xffc46b), 0xffc46b, 0.4, 0), // amber tritium dots
      mag: tone(GUNMAT.blued(), 0x292c31, 0.45, 0.6), // magazine tube
      base: tone(GUNMAT.polymer(), 0x2c2f34, 0.85, 0.04), // extended baseplate
    };
  }

  // ── the slide: flat top with wide chamfers, raked serrations front and rear, ejection port ──
  const SLIDE_W = 25.5;
  const SLIDE_LEN = 202;
  const H = SLIDE_W / 2;
  const SLIDE_BOT = -29;
  const SLIDE_SECTION = [[-H, SLIDE_BOT + 0.6], [-H + 0.6, SLIDE_BOT], [H - 0.6, SLIDE_BOT], [H, SLIDE_BOT + 0.6], [H, -5.6], [7.4, 0], [-7.4, 0], [-H, -5.6]];
  // in the port the top right is cut away down to the chamber
  const PORT = [66, 112];
  const PORT_SECTION = [[-H, SLIDE_BOT + 0.6], [-H + 0.6, SLIDE_BOT], [H - 0.6, SLIDE_BOT], [H, SLIDE_BOT + 0.6], [H, -16.5], [-2.4, -16.5], [-2.4, 0], [-7.4, 0], [-H, -5.6]];
  const SERR_DEPTH = 1.1;
  const RAKE_MM = 6.5; // the serrations lean forward this far over the slide's height
  const slant = (y) => -RAKE_MM * Math.min(1, Math.max(0, (y - SLIDE_BOT) / -SLIDE_BOT));

  function slideGeo() {
    const g = [];
    const nose = (y) => (y > -7 ? (y + 7) * 0.7 : y < -24 ? (-24 - y) * 0.5 : 0);
    // raked serrations: a narrower core through the zone and full-width ridges leaning forward over it;
    // the plain slide either side is cut on the same rake so the grooves meet it cleanly
    const serrations = (x0, x1, n, ridge) => {
      g.push(sectionGeo(SLIDE_SECTION, x0 - RAKE_MM, x1, { sx: (SLIDE_W - 2 * SERR_DEPTH) / SLIDE_W }));
      const step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const a = x0 + i * step + step * (1 - ridge);
        g.push(sectionGeo(SLIDE_SECTION, a, a + step * ridge, { front: slant, back: slant }));
      }
    };
    g.push(sectionGeo(SLIDE_SECTION, 0, 18, { front: nose, back: slant }));
    serrations(18, 40, 6, 0.5);
    g.push(sectionGeo(SLIDE_SECTION, 40, PORT[0], { front: slant }));
    g.push(sectionGeo(PORT_SECTION, PORT[0], PORT[1]));
    g.push(sectionGeo(SLIDE_SECTION, PORT[1], 158, { back: slant }));
    serrations(158, 196, 9, 0.5);
    g.push(sectionGeo(SLIDE_SECTION, 196, SLIDE_LEN, { front: slant }));
    // the slide cover plate, a little proud of the back face
    g.push(boxGeo(16, 21, 0.6, SLIDE_LEN + 0.2, -15.5, 0));
    return merged(g);
  }

  // the tall sights and the small parts that ride on the slide
  function slidePartsGeo() {
    const g = [];
    // front sight: a tall tapered post in a dovetail, its rear face square to the eye
    g.push(sectionGeo([[-2.2, -0.5], [2.2, -0.5], [2, 8.6], [1.4, 9.6], [-1.4, 9.6], [-2, 8.6]], 5.5, 13, { front: (y) => Math.max(0, y) * 0.35 }));
    g.push(boxGeo(9, 1.2, 7.5, 9.3, -0.1, 0)); // its dovetail base
    // rear sight: a tall block with a deep U notch, ramped at the front, serrated at the back
    const notch = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      notch.push([2.1 * Math.cos(a), 7.3 + 2.1 * Math.sin(a) * 0.7]);
    }
    const rear = [[-11.4, -0.5], [11.4, -0.5], [11.4, 3.2], [10.4, 8.6], [8.8, 10.2], [2.1, 10.2], ...notch.slice().reverse(), [-2.1, 10.2], [-8.8, 10.2], [-10.4, 8.6], [-11.4, 3.2]];
    g.push(sectionGeo(rear, 181, 192, { front: (y) => Math.max(0, y - 1) * 0.7 }));
    for (let i = 0; i < 4; i++) g.push(boxGeo(22.4, 0.5, 0.6, 191.6, 1.8 + i * 2.2, 0)); // anti-glare lines on its back face
    // striker channel in the cover plate
    g.push(boxGeo(3.8, 3.8, 0.5, SLIDE_LEN + 0.55, -15, 0));
    // extractor on the right, behind the port, with the loaded-chamber bump
    g.push(boxGeo(0.7, 3.8, 17, PORT[1] + 8, -12.2, H + 0.2));
    g.push(boxGeo(0.9, 1.5, 4.5, PORT[1] + 2.8, -11.3, H + 0.35));
    // the port floor, dark so the opening reads as a hole
    g.push(boxGeo(14.5, 0.5, PORT[1] - PORT[0] - 0.4, (PORT[0] + PORT[1]) / 2, -16.2, 5.2));
    // the slide's front face: the bore opening and the recoil spring hole
    g.push(cylGeo(7.9, 7.9, 0.3, 18, 'z', -0.15, BORE, 0));
    g.push(cylGeo(4.6, 4.6, 0.3, 14, 'z', -0.15, -24.6, 0));
    return merged(g);
  }

  function dotsGeo() {
    return merged([
      cylGeo(1.05, 1.05, 0.5, 10, 'z', 13.2, 7.4, 0), // front dot (seen from behind)
      cylGeo(1.05, 1.05, 0.5, 10, 'z', 192.1, 7.3, -5.9),
      cylGeo(1.05, 1.05, 0.5, 10, 'z', 192.1, 7.3, 5.9),
    ]);
  }

  // ── the barrel: threaded muzzle out of the slide, hood and chamber in the port ──
  function barrelGeo() {
    const g = [];
    g.push(tube(6.9, 6.9, -1.2, 6, 20)); // the barrel's end inside the slide nose
    // the threaded length between the slide and the suppressor: a shoulder, then crests and roots
    g.push(tube(6.6, 6.6, -2.4, -1.2, 20));
    for (let x = -2.4; x > -8.6; x -= 1) {
      g.push(tube(6.15, 6.15, x - 0.5, x, 18));
      g.push(tube(5.7, 5.7, x - 1, x - 0.5, 18));
    }
    g.push(boxGeo(13, 7.4, PORT[1] - PORT[0] - 3.2, (PORT[0] + PORT[1]) / 2 + 1.4, -4.2, 0)); // hood, flush with the slide top
    g.push(cylGeo(7.1, 7.1, PORT[1] - PORT[0] - 2, 18, 'z', (PORT[0] + PORT[1]) / 2 + 0.5, BORE, 0)); // chamber under it
    g.push(cylGeo(2.5, 2.5, 0.3, 10, 'z', -0.4, -24.6, 0)); // guide rod tip
    return merged(g);
  }

  // ── the suppressor: rear cap with wrench flats, a knurled mounting collar, the tube, a stepped front cap ──
  const CAN_R = 17.5;
  const CAN = { rear: -7.5, collar: -21, tube: -37, frontCap: -136, tip: -150 };

  // the rear cap's section: a circle with two flats for a spanner, left and right
  function flatCircle(r, flat, n = 32) {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      p.push([Math.max(-flat, Math.min(flat, r * Math.cos(a))), BORE + r * Math.sin(a)]);
    }
    return p;
  }

  function canCapsGeo() {
    const g = [];
    // rear cap: a chamfer onto the thread, then the flatted body
    g.push(tube(CAN_R - 1.2, 9, CAN.rear - 1.6, CAN.rear, 28));
    g.push(sectionGeo(flatCircle(CAN_R - 1.2, CAN_R - 3.4), CAN.collar + 1, CAN.rear - 1.6));
    // mounting collar: knurl rings, crests and roots
    g.push(tube(CAN_R - 0.6, CAN_R - 0.6, CAN.collar + 1, CAN.collar, 30)); // shoulder
    const n = 9, step = (CAN.collar - CAN.tube) / n;
    for (let i = 0; i < n; i++) {
      const x = CAN.collar - i * step;
      g.push(tube(CAN_R - 0.2, CAN_R - 0.2, x - step * 0.55, x, 30)); // crest
      g.push(tube(CAN_R - 1.1, CAN_R - 1.1, x - step, x - step * 0.55, 30)); // root
    }
    // front cap: a sleeve over the tube, a step, a chamfer down to the face
    g.push(tube(CAN_R + 0.15, CAN_R + 0.15, CAN.frontCap - 8, CAN.frontCap, 32));
    g.push(tube(CAN_R - 0.9, CAN_R - 0.9, CAN.frontCap - 9.5, CAN.frontCap - 8, 30)); // the step's groove
    g.push(tube(CAN_R - 3, CAN_R + 0.15, CAN.tip, CAN.frontCap - 9.5, 32, true)); // chamfer
    g.push(ringGeo(7.4, CAN_R - 3, CAN.tip, 32)); // the face
    g.push(tube(7.2, 7.4, CAN.tip - 0.8, CAN.tip, 24, true)); // the raised boss round the bore
    g.push(ringGeo(4.9, 7.2, CAN.tip - 0.8, 24));
    return merged(g);
  }
  function canTubeGeo() {
    // the anodised tube between the collar and the front cap, two fine witness lines near the front
    return merged([tube(CAN_R, CAN_R, CAN.frontCap, CAN.tube, 36)]);
  }
  function canDarkGeo() {
    const g = [];
    // the bore, a recessed dark disc, and its wall
    g.push(cylGeo(4.9, 4.9, 6, 18, 'z', CAN.tip - 0.8 + 3, BORE, 0, true));
    g.push(ringGeo(0, 4.95, CAN.tip + 2.2, 18));
    // four spanner holes in the front face
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, r = 11.3;
      g.push(cylGeo(1.3, 1.3, 0.4, 10, 'z', CAN.tip - 0.05, BORE + r * Math.sin(a), r * Math.cos(a)));
    }
    // two fine witness lines on the tube near the front cap
    g.push(tube(CAN_R + 0.08, CAN_R + 0.08, CAN.frontCap + 6.6, CAN.frontCap + 6, 36));
    g.push(tube(CAN_R + 0.08, CAN_R + 0.08, CAN.frontCap + 9.6, CAN.frontCap + 9, 36));
    return merged(g);
  }

  // ── the frame ──
  // grip lines: a straight front strap and a back strap with a palm swell, both on the grip's rake
  const RAKE = Math.atan2(20, 62);
  const TAN = Math.tan(RAKE);
  const front = (y) => 138.5 + (-56 - y) * TAN;
  const back = (y) => {
    const t = (y + 47) / -74;
    return 184 + (-47 - y) * TAN + 2.4 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  };
  const BOTTOM = (x) => -126 + (x - front(-126)) * TAN; // grip bottom, square to the grip axis
  // the grip's foot: the front strap's bottom corner F and where the back strap meets the bottom line, R
  const F = [front(-126), -126];
  const R = (() => {
    let y = -110;
    for (let i = 0; i < 40; i++) y = BOTTOM(back(y)); // the back strap is near vertical: this settles fast
    return [back(y), y];
  })();

  function gripPoints() {
    const p = [[133, -39], [181, -39], [184.5, -47]];
    for (let y = -51; y > R[1] + 1; y -= 4) p.push([back(y), y]);
    p.push(R, F);
    for (let y = -123; y <= -60; y += 5) p.push([front(y), y]);
    p.push([137.6, -54.5], [135.6, -50], [134, -45]);
    return p;
  }

  function panelPoints() {
    const p = [];
    for (let y = -60; y >= -110; y -= 5) p.push([front(y) + 4, y]);
    for (let y = -108; y <= -53; y += 5) p.push([back(y) - 4, y]);
    p.push([back(-50) - 6.5, -50], [front(-60) + 8.5, -52.5]);
    return p;
  }

  // the flared magazine well: a rounded collar round the grip's foot that widens toward the bottom
  // (an outline seen from below, extruded up the grip axis and tapered to the grip's own size)
  function magwellGeo() {
    const up = [-Math.sin(RAKE), Math.cos(RAKE)], along = [Math.cos(RAKE), Math.sin(RAKE)];
    const L = Math.hypot(R[0] - F[0], R[1] - F[1]);
    const mid = [(F[0] + R[0]) / 2, (F[1] + R[1]) / 2];
    const hw = 16.9, hl = L / 2 + 2.6, rc = 5, h = 15;
    const shape = new T.Shape();
    shape.moveTo(-hw + rc, -hl);
    shape.lineTo(hw - rc, -hl);
    shape.absarc(hw - rc, -hl + rc, rc, -Math.PI / 2, 0);
    shape.lineTo(hw, hl - rc);
    shape.absarc(hw - rc, hl - rc, rc, 0, Math.PI / 2);
    shape.lineTo(-hw + rc, hl);
    shape.absarc(-hw + rc, hl - rc, rc, Math.PI / 2, Math.PI);
    shape.lineTo(-hw, -hl + rc);
    shape.absarc(-hw + rc, -hl + rc, rc, Math.PI, Math.PI * 1.5);
    const geo = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: 0.9, bevelThickness: 0.9, bevelOffset: -0.9, bevelSegments: 2, steps: 2, curveSegments: 4 });
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const sv = p.getX(i), vv = p.getY(i), w = p.getZ(i);
      const t = Math.min(1, Math.max(0, w / h)), k = t * t; // the flare opens fastest at the very bottom
      const sx = 1 - k * (1 - 14.95 / hw), sy = 1 - k * (1 - (L / 2 + 0.3) / hl);
      const ww = w - 0.4;
      const x = mid[0] + along[0] * vv * sy + up[0] * ww, y = mid[1] + along[1] * vv * sy + up[1] * ww;
      p.setXYZ(i, S(-sv * sx), Y(y), Z(x)); // mirrored across so the faces keep their outward winding
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    return scaleUV(geo, K / UV_TILE, K / UV_TILE); // its outline was drawn in millimetres
  }

  function frameGeo() {
    const g = [];
    // dust cover and receiver: full length, out to just behind the slide nose
    g.push(sideGeo([[12, SLIDE_BOT], [196, SLIDE_BOT], [196, -43], [16, -43], [12, -39]], 23, { bevel: 0.9 }));
    // trigger guard: square front, its rear undercut high into the grip
    g.push(sideGeo(
      [[79.6, -42], [80.6, -62.5], [83.4, -69], [88, -72.6], [124, -72.6], [129.6, -70.8], [133.3, -66.6], [135.4, -59.6], [136.2, -52], [135.5, -42]],
      13,
      { bevel: 1.3, holes: [[[87.2, -44.5], [88, -59.5], [90.8, -64.8], [95, -66.6], [121.5, -66.6], [126.3, -64.8], [129.3, -60.6], [130.7, -54.5], [130.5, -44.5]]] },
    ));
    // the tang and a long beavertail
    g.push(sideGeo([[156, SLIDE_BOT], [199, SLIDE_BOT], [205, -30.6], [207, -33], [205.4, -35.6], [197.5, -38.6], [189, -42.4], [184.5, -47], [176, -47], [156, -43]], 24.5, { bevel: 1.4 }));
    // the grip: straight front strap, palm swell; well rounded
    g.push(sideGeo(gripPoints(), 29.5, { bevel: 2.7, segments: 3 }));
    // the flared magazine well at its foot
    g.push(magwellGeo());
    // the accessory rail: a dovetail section with four cross slots
    const RAIL = [[-8.4, -42.5], [8.4, -42.5], [8.4, -44.4], [10.4, -45.1], [10.4, -46.6], [9, -48], [-9, -48], [-10.4, -46.6], [-10.4, -45.1], [-8.4, -44.4]];
    const SLOT = [[-8.4, -42.5], [8.4, -42.5], [8.4, -44.4], [10.4, -45.1], [10.4, -45.9], [-10.4, -45.9], [-10.4, -45.1], [-8.4, -44.4]];
    let x = 22;
    for (const [a, b] of [[30, 33], [41, 44], [52, 55], [63, 66]]) {
      g.push(sectionGeo(RAIL, x, a));
      g.push(sectionGeo(SLOT, a, b));
      x = b;
    }
    g.push(sectionGeo(RAIL, x, 79));
    g.push(sectionGeo(RAIL, 17, 22, { front: (y) => Math.max(0, -43 - y) * 0.9 }));
    return merged(g);
  }

  // stippling panels on both grip sides (one extrusion, proud of both faces)
  function panelGeo() {
    return sideGeo(panelPoints(), 29.5 + 0.7, { bevel: 0 });
  }

  // controls: extended slide stop (left), takedown lever, oversized magazine release (left), trigger
  function controlsGeo() {
    const g = [];
    const fw = 23 / 2;
    // slide stop: a thin plate along the frame top with a long ribbed thumb shelf at the rear
    g.push(sideGeo([[118, -30.6], [140, -30.2], [147.5, -30], [149, -31], [148.6, -36.6], [141, -37.4], [136, -34.2], [118, -33.6]], 1.6, { s: -(fw + 0.7) }));
    for (let i = 0; i < 4; i++) g.push(boxGeo(0.5, 5, 0.7, 141.2 + i * 1.7, -33.6, -(fw + 1.65)));
    // takedown lever, both sides
    g.push(boxGeo(23 + 3, 2.6, 7.5, 100.5, -31.4, 0));
    g.push(boxGeo(23 + 3.6, 1, 2, 103, -31.4, 0));
    // oversized magazine release behind the trigger guard, left side
    g.push(boxGeo(2.6, 8.5, 7.5, 138.8, -48.5, -(14.75 + 0.7)));
    g.push(boxGeo(0.6, 6.4, 5.4, 138.8, -48.5, -(14.75 + 2.2)));
    // trigger: a flat-faced shoe on its bar, the safety blade standing out of its face
    g.push(sideGeo([[112.8, -43], [119.5, -43], [119, -48], [117.8, -54], [117.8, -61.2], [116.6, -63.6], [113.8, -63.4], [113.2, -61], [113.6, -54.5], [113.4, -49], [112.6, -45.4]], 7.4, { bevel: 0.6 }));
    g.push(boxGeo(5, 2.2, 14, 123, -43.6, 0)); // trigger bar
    return merged(g);
  }
  function bladeGeo() {
    return sideGeo([[112.2, -48], [114, -47.6], [114.3, -60.2], [112.4, -61.6], [111.6, -59.6], [112.4, -54]], 2.2);
  }
  function pinsGeo() {
    return merged([
      cylGeo(1.5, 1.5, 23.6, 10, 'x', 95, -37.2, 0), // locking block pin
      cylGeo(1.5, 1.5, 23.6, 10, 'x', 117.2, -38.6, 0), // trigger pin
      cylGeo(1.5, 1.5, 29.9, 10, 'x', 176.5, -35.2, 0), // trigger housing pin
    ]);
  }

  GUN_BUILD.silenced = () => {
    const b = GunBuilder();
    const root = b.group;
    const m = materials();
    root.name = 'dfdf-silenced';
    root.userData.weaponModel = 'dfdf-silenced';
    root.userData.modelRevision = 2;
    root.userData.anchors = {
      right: [0.004, Y(-66), Z(166)],
      muzzle: [0, Y(BORE), Z(CAN.tip - 1)],
      // the line of sight: the front dot's centre, level with the two rear dots (ADS puts it on the screen centre)
      sight: [0, Y(7.4), Z(13.2)],
    };
    const add = (name, geo, mat, parent = root) => {
      const mesh = new T.Mesh(geo, mat);
      mesh.name = name;
      parent.add(mesh);
      return mesh;
    };
    // the static gun
    add('silenced-frame', frameGeo(), m.frame);
    add('silenced-grip-panels', panelGeo(), m.panel);
    add('silenced-controls', controlsGeo(), m.dark);
    add('silenced-trigger-blade', bladeGeo(), m.panel);
    add('silenced-barrel', barrelGeo(), m.steel);
    add('silenced-pins', pinsGeo(), m.steel);
    add('silenced-suppressor', canTubeGeo(), m.can);
    add('silenced-suppressor-caps', canCapsGeo(), m.cap);
    add('silenced-suppressor-bore', canDarkGeo(), m.bore);
    // the slide moves as one: it cycles on each shot and is racked in a reload
    const slide = new T.Group();
    slide.name = 'silenced-slide';
    slide.userData.legacyAction = 'slide';
    slide.userData.travel = S(32);
    root.add(slide);
    for (const mesh of [add('silenced-slide-body', slideGeo(), m.slide, slide), add('silenced-slide-parts', slidePartsGeo(), m.sight, slide), add('silenced-sight-dots', dotsGeo(), m.dot, slide)]) mesh.userData.live = true;
    // the magazine: a tube hidden in the grip and the extended baseplate under it; built with mag()
    // so the reload pulls the whole assembly out of the grip
    const lean = -RAKE;
    const up = [-Math.sin(RAKE), Math.cos(RAKE)], fwd = [-Math.cos(RAKE), -Math.sin(RAKE)];
    const bx = (F[0] + R[0]) / 2, by = (F[1] + R[1]) / 2; // the middle of the grip's foot
    const at = (a, f) => [bx + up[0] * a + fwd[0] * f, by + up[1] * a + fwd[1] * f];
    const place = (name, mat, w, h, d, a, f) => {
      const [x, y] = at(a, f);
      const mesh = b.mag(mat, S(w), S(h), S(d), 0, Y(y), Z(x), lean);
      mesh.name = name;
      return mesh;
    };
    place('silenced-magazine', m.mag, 21.5, 90, 31, 45, 1);
    place('silenced-magazine-baseplate', m.base, 33, 6, 50, -3.4, 0);
    place('silenced-magazine-lip', m.base, 30, 2.2, 47, -7.2, 0);
    return root;
  };
  window.GUN_MODEL_SILENCED = { revision: 2, mm: K };
})();
