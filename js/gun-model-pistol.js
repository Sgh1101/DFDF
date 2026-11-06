(() => {
  'use strict';
  // The default pistol (참새, key "pistol"): a generic modern compact polymer
  // striker-fired 9 mm, drawn from real proportions (about 187 mm long,
  // 128 mm tall, 30 mm wide) at the size the old blocky pistol had in the game.
  // No maker's name, logo or marking anywhere.
  //
  // Everything is measured in millimetres on the real gun and converted here:
  //   x: from the muzzle face backwards (0 .. 188)
  //   y: from the top of the slide downwards (0 .. -123), sights stand above 0
  //   s: across, from the centre line (+ is the right side, the ejection side)
  // The bore keeps the old pistol's line (y 0.03 in model units) and the
  // muzzle sits where it was, so the add-on parts of the guns built on top of
  // this one (stinger, golden chest pistol) still land on the slide and barrel.
  //
  // Material roles stay the stock GUNMAT kinds, so every skin recolours it as
  // before: polymer frame (body), gunmetal slide and steel barrel (metal),
  // blued small parts and rubber grip panels (dark), glow sight dots (glow).
  if (typeof GUN_BUILD === 'undefined' || typeof GunBuilder !== 'function' || typeof GUNMAT === 'undefined' || typeof T === 'undefined') return;

  const K = 0.00214; // model units per millimetre
  const Z = (x) => -0.278 + x * K;
  const Y = (y) => 0.06 + y * K;
  const S = (s) => s * K;
  const UV_TILE = 0.16; // extruded parts carry metre UVs; one texture tile per 0.16 like the boxes the skins fit

  function scaleUV(geo) {
    const uv = geo.attributes.uv;
    if (!uv) return geo;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / UV_TILE, uv.getY(i) / UV_TILE);
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
    // shape x is -z: turn the extrusion axis onto +x, then centre it
    geo.rotateY(Math.PI / 2);
    geo.translate(-S(width) / 2 + bevel + S(opt.s || 0), 0, 0);
    return scaleUV(geo);
  }

  // A front-view section ([s, y] mm points) extruded along the gun from x0 to x1.
  // `shear(y)` (mm) pushes the front face backwards by height, for sloped noses and ramps.
  function sectionGeo(points, x0, x1, opt = {}) {
    const shape = new T.Shape();
    const sx = opt.sx || 1;
    points.forEach(([s, y], i) => (i ? shape.lineTo(S(s * sx), Y(y)) : shape.moveTo(S(s * sx), Y(y))));
    shape.closePath();
    const geo = new T.ExtrudeGeometry(shape, { depth: S(x1 - x0), bevelEnabled: false, steps: 1, curveSegments: 4 });
    // extruded along +z from Z(x1) (rear) toward the muzzle is -z: place it so z runs Z(x0)..Z(x1)
    geo.translate(0, 0, Z(x0));
    if (opt.shear) {
      const p = geo.attributes.position, front = Z(x0) + 1e-6;
      for (let i = 0; i < p.count; i++) {
        if (p.getZ(i) > front) continue;
        const ymm = (p.getY(i) - 0.06) / K;
        p.setZ(i, p.getZ(i) + S(opt.shear(ymm)));
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

  function cylGeo(r0, r1, len, segs, axis, x, y, s) {
    const g = new T.CylinderGeometry(S(r0), S(r1), S(len), segs);
    if (axis === 'z') g.rotateX(-Math.PI / 2); // top (r0) toward the muzzle
    else if (axis === 'x') g.rotateZ(Math.PI / 2);
    g.translate(S(s), Y(y), Z(x));
    return g;
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
      frame: tone(GUNMAT.polymer(), 0x2e3136, 0.86, 0.04), // matte black polymer
      panel: tone(GUNMAT.rubber(), 0x2a2d31, 0.97, 0), // stippled grip panels
      slide: tone(GUNMAT.gunmetal(), 0x50545b, 0.45, 0.5), // nitrided graphite slide
      steel: tone(GUNMAT.steel(), 0x9aa0a8, 0.3, 0.86), // barrel, hood, pins
      dark: tone(GUNMAT.blued(), 0x1d1f23, 0.5, 0.55), // controls, trigger, port interior
      sight: tone(GUNMAT.blued(), 0x1b1d20, 0.6, 0.45), // sights and slide parts (they ride with the slide)
      dot: tone(GUNMAT.glow(0xd6ffe2), 0xd6ffe2, 0.4, 0), // three-dot sights
      mag: tone(GUNMAT.blued(), 0x2a2d32, 0.45, 0.6), // magazine tube
      base: tone(GUNMAT.polymer(), 0x2e3136, 0.85, 0.04), // magazine baseplate
    };
  }

  // ── the slide: chamfered top, front and rear serrations, ejection port ──
  const SLIDE_W = 25.5;
  const SLIDE_LEN = 184;
  const H = SLIDE_W / 2;
  const SLIDE_SECTION = [[-H, -27.4], [-H + 0.6, -28], [H - 0.6, -28], [H, -27.4], [H, -6.5], [8.3, 0], [-8.3, 0], [-H, -6.5]];
  // in the port the top right is cut away down to the chamber
  const PORT = [60, 104];
  const PORT_SECTION = [[-H, -27.4], [-H + 0.6, -28], [H - 0.6, -28], [H, -27.4], [H, -15.5], [-2.2, -15.5], [-2.2, 0], [-8.3, 0], [-H, -6.5]];
  const SERR_DEPTH = 0.95;

  function slideGeo() {
    const g = [];
    // the nose: the top front and the bottom front are bevelled back
    const nose = (y) => (y > -8 ? (y + 8) * 0.62 : y < -23 ? (-23 - y) * 0.45 : 0);
    g.push(sectionGeo(SLIDE_SECTION, 0, 14, { shear: nose }));
    const serrations = (x0, x1, n) => {
      const step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const a = x0 + i * step;
        g.push(sectionGeo(SLIDE_SECTION, a, a + step * 0.48, { sx: (SLIDE_W - 2 * SERR_DEPTH) / SLIDE_W })); // groove
        g.push(sectionGeo(SLIDE_SECTION, a + step * 0.48, a + step)); // ridge
      }
    };
    serrations(14, 36, 6);
    g.push(sectionGeo(SLIDE_SECTION, 36, PORT[0]));
    g.push(sectionGeo(PORT_SECTION, PORT[0], PORT[1]));
    g.push(sectionGeo(SLIDE_SECTION, PORT[1], 142));
    serrations(142, 178, 9);
    g.push(sectionGeo(SLIDE_SECTION, 178, SLIDE_LEN));
    // the slide cover plate, a little proud of the back face
    g.push(boxGeo(15, 19, 0.6, SLIDE_LEN + 0.2, -14.5, 0));
    return merged(g);
  }

  // the sights (U-notch rear, post front) and the small parts that ride on the slide
  function slidePartsGeo() {
    const g = [];
    // front sight: a tapered post in a dovetail
    g.push(sectionGeo([[-1.9, -0.5], [1.9, -0.5], [1.7, 4.6], [1.2, 5.4], [-1.2, 5.4], [-1.7, 4.6]], 6.5, 12.5, { shear: (y) => Math.max(0, y) * 0.45 }));
    g.push(boxGeo(7.5, 1, 6.5, 9.5, -0.2, 0)); // its dovetail
    // rear sight: a wide block with a U notch, its front ramped
    const notch = [];
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI; // the round bottom of the U
      notch.push([1.8 * Math.cos(a), 3.3 + 1.8 * Math.sin(a) * 0.55]);
    }
    const rear = [[-10.8, -0.5], [10.8, -0.5], [10.8, 4.4], [9.2, 6.2], [1.8, 6.2], ...notch.slice().reverse(), [-1.8, 6.2], [-9.2, 6.2], [-10.8, 4.4]];
    g.push(sectionGeo(rear, 166, 175, { shear: (y) => Math.max(0, y) * 0.6 }));
    // the striker channel in the slide cover plate
    g.push(boxGeo(3.6, 3.6, 0.5, SLIDE_LEN + 0.55, -14, 0));
    // extractor on the right, behind the port, with the loaded-chamber bump
    g.push(boxGeo(0.7, 3.6, 15, PORT[1] + 7, -11.4, H + 0.2));
    g.push(boxGeo(0.9, 1.4, 4, PORT[1] + 2.5, -10.6, H + 0.35));
    // the port floor, dark so the opening reads as a hole
    g.push(boxGeo(14.5, 0.5, PORT[1] - PORT[0] - 0.4, (PORT[0] + PORT[1]) / 2, -15.2, 5.2));
    // the slide's front face: the bore opening and the recoil spring hole
    g.push(cylGeo(7.7, 7.7, 0.3, 18, 'z', -0.15, -14, 0));
    g.push(cylGeo(4.4, 4.4, 0.3, 14, 'z', -0.15, -23.4, 0));
    return merged(g);
  }

  function dotsGeo() {
    return merged([
      cylGeo(0.95, 0.95, 0.5, 10, 'z', 12.55 + 0.35, 3.3, 0), // front dot (seen from behind)
      cylGeo(1.05, 1.05, 0.5, 10, 'z', 175.2, 3.4, -5.6),
      cylGeo(1.05, 1.05, 0.5, 10, 'z', 175.2, 3.4, 5.6),
    ]);
  }

  // ── the barrel: crown at the muzzle and the hood in the port ──
  function barrelGeo() {
    const g = [];
    g.push(cylGeo(6.2, 6.8, 1.2, 20, 'z', -0.3, -14, 0)); // crown lip
    g.push(cylGeo(6.8, 6.8, 7, 20, 'z', 3.8, -14, 0)); // muzzle end
    g.push(boxGeo(13, 6.9, PORT[1] - PORT[0] - 3.2, (PORT[0] + PORT[1]) / 2 + 1.4, -3.95, 0)); // hood, flush with the slide top
    g.push(cylGeo(6.9, 6.9, PORT[1] - PORT[0] - 2, 18, 'z', (PORT[0] + PORT[1]) / 2 + 0.5, -14, 0)); // chamber under it
    g.push(cylGeo(2.4, 2.4, 0.3, 10, 'z', -0.4, -23.4, 0)); // guide rod tip
    return merged(g);
  }
  function boreGeo() {
    // the dark bore inside the crown, a little proud so the front reads as a hole
    return merged([cylGeo(4.5, 4.5, 0.6, 16, 'z', -0.75, -14, 0)]);
  }

  // ── the frame ──
  // grip lines: the front strap with finger grooves, the back strap with a palm swell
  const front = (y) => {
    const t = (y + 55) / -62;
    let x = 121 + 20 * t;
    for (const c of [-79, -99]) x -= 3.4 * Math.exp(-(((y - c) / 5.2) ** 2));
    return x;
  };
  const back = (y) => {
    const t = (y + 45) / -59;
    return 168 + 18 * t + 2.2 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  };
  const RAKE = Math.atan2(20, 62); // the grip's rake from vertical
  const BOTTOM = (x) => -117 + (x - 143) * Math.tan(RAKE); // grip bottom, square to the grip axis

  function gripPoints() {
    const p = [[117, -37], [165, -37], [168.5, -45]];
    for (let y = -49; y >= -101; y -= 4) p.push([back(y), y]);
    p.push([back(-103) + 0.1, -102.6], [184.6, BOTTOM(184.6) - 0.4]);
    // along the bottom, the magazine well's front cut-out, then up the front strap
    p.push([146, BOTTOM(146)], [142, BOTTOM(142) + 0.2], [front(-113.5) + 0.6, -113.5]);
    for (let y = -111; y <= -56; y += 2.5) p.push([front(y), y]);
    p.push([120.2, -53], [118.4, -49], [117.6, -44]);
    return p;
  }

  function panelPoints() {
    const p = [];
    for (let y = -57; y >= -105; y -= 3) p.push([front(y) + 3.6, y]);
    for (let y = -103; y <= -51; y += 4) p.push([back(y) - 3.6, y]);
    p.push([back(-49) - 6, -48.5], [front(-57) + 8, -50.5]);
    return p;
  }

  function frameGeo() {
    const g = [];
    // dust cover and receiver: from the frame's nose to the grip, under the slide
    g.push(sideGeo([[12.5, -28], [179, -28], [179, -41], [16.5, -41], [12.5, -37.5]], 23, { bevel: 0.9 }));
    // trigger guard, squared at the front, its rear undercut high into the grip
    g.push(sideGeo(
      [[63.6, -40], [64.6, -60.5], [67.4, -67], [72, -70.6], [108, -70.6], [113.6, -68.8], [117.3, -64.6], [119.4, -57.6], [120.2, -50], [119.5, -40]],
      13,
      { bevel: 1.3, holes: [[[71.2, -42.5], [72, -57.5], [74.8, -62.8], [79, -64.6], [105.5, -64.6], [110.3, -62.8], [113.3, -58.6], [114.7, -52.5], [114.5, -42.5]]] },
    ));
    // the tang: the beavertail over the web of the hand, as narrow as the slide
    g.push(sideGeo([[140, -28], [181, -28], [186.8, -29.3], [188.6, -31.4], [187, -33.8], [180, -36.4], [172.5, -40.5], [168.5, -45], [160, -45], [140, -41]], 24.5, { bevel: 1.4 }));
    // the grip, with its finger grooves and palm swell; well rounded
    g.push(sideGeo(gripPoints(), 29, { bevel: 2.6, segments: 3 }));
    // the accessory rail under the dust cover: a dovetail section with three cross slots
    const RAIL = [[-8.4, -40.5], [8.4, -40.5], [8.4, -42.4], [10.4, -43.1], [10.4, -44.6], [9, -46], [-9, -46], [-10.4, -44.6], [-10.4, -43.1], [-8.4, -42.4]];
    const SLOT = [[-8.4, -40.5], [8.4, -40.5], [8.4, -42.4], [10.4, -43.1], [10.4, -43.9], [-10.4, -43.9], [-10.4, -43.1], [-8.4, -42.4]];
    let x = 19;
    for (const [a, b] of [[27.5, 30.5], [38.5, 41.5], [49.5, 52.5]]) {
      g.push(sectionGeo(RAIL, x, a));
      g.push(sectionGeo(SLOT, a, b));
      x = b;
    }
    g.push(sectionGeo(RAIL, x, 63));
    // front of the rail: a small taper into the dust cover
    g.push(sectionGeo(RAIL, 16.5, 19, { shear: (y) => Math.max(0, -41 - y) * 0.5 }));
    return merged(g);
  }

  // stippling panels on both grip sides (one extrusion, proud of both faces)
  function panelGeo() {
    return sideGeo(panelPoints(), 29 + 0.7, { bevel: 0 });
  }

  // controls: slide stop (left), takedown lever (both sides), magazine release (left), trigger
  function controlsGeo() {
    const g = [];
    const fw = 23 / 2;
    // slide stop lever: a thin plate along the frame top with a raised thumb tab at its rear
    g.push(sideGeo([[104, -29.6], [124, -29.2], [129.5, -29], [131, -30], [130.6, -34.8], [126, -35.4], [121, -32.6], [104, -32.2]], 1.4, { s: -(fw + 0.6) }));
    for (let i = 0; i < 3; i++) g.push(boxGeo(0.5, 4.2, 0.7, 126.5 + i * 1.4, -32.2, -(fw + 1.45)));
    // takedown lever: a short tab each side, just under the slide
    g.push(boxGeo(23 + 3, 2.4, 7, 84.5, -30.2, 0));
    g.push(boxGeo(23 + 3.6, 1, 2, 87, -30.2, 0));
    // magazine release button behind the trigger guard, left side, with its checkering
    g.push(boxGeo(2.4, 7.5, 6.5, 122.6, -46, -(14.5 + 0.6)));
    g.push(boxGeo(0.6, 5.5, 4.6, 122.6, -46, -(14.5 + 2)));
    // trigger: curved shoe on its bar, the safety blade standing out of its face
    g.push(sideGeo([[96.8, -41], [103.5, -41], [102.8, -46], [101, -52.5], [101.6, -58.6], [100.2, -61.6], [97.6, -61.2], [96.4, -58.8], [97.3, -53], [97.4, -47], [96.6, -43.4]], 7.2, { bevel: 0.6 }));
    g.push(boxGeo(5, 2.2, 14, 107, -41.6, 0)); // trigger bar behind the shoe
    return merged(g);
  }
  function bladeGeo() {
    return sideGeo([[96.3, -46], [98, -45.6], [98.4, -58], [96.5, -59.6], [95.6, -57.6], [96.4, -52]], 2.2);
  }
  function pinsGeo() {
    return merged([
      cylGeo(1.5, 1.5, 23.6, 10, 'x', 79, -35.2, 0), // locking block pin
      cylGeo(1.5, 1.5, 23.6, 10, 'x', 101.2, -36.6, 0), // trigger pin
      cylGeo(1.5, 1.5, 29.4, 10, 'x', 160.5, -33.2, 0), // trigger housing pin
    ]);
  }

  GUN_BUILD.pistol = () => {
    const b = GunBuilder();
    const root = b.group;
    const m = materials();
    root.name = 'dfdf-pistol';
    root.userData.weaponModel = 'dfdf-pistol';
    root.userData.modelRevision = 2;
    root.userData.anchors = {
      right: [0.004, Y(-63), Z(150)],
      muzzle: [0, Y(-14), Z(-1)],
      // the line of sight: the front dot's centre, level with the two rear dots (ADS puts it on the screen centre)
      sight: [0, Y(3.3), Z(12.9)],
    };
    const add = (name, geo, mat, parent = root) => {
      const mesh = new T.Mesh(geo, mat);
      mesh.name = name;
      parent.add(mesh);
      return mesh;
    };
    // the static gun
    add('pistol-frame', frameGeo(), m.frame);
    add('pistol-grip-panels', panelGeo(), m.panel);
    add('pistol-controls', controlsGeo(), m.dark);
    add('pistol-trigger-blade', bladeGeo(), m.panel);
    add('pistol-barrel', barrelGeo(), m.steel);
    add('pistol-pins', pinsGeo(), m.steel);
    add('pistol-bore', boreGeo(), m.dark);
    // the slide moves as one: it cycles on each shot and is racked in a reload
    const slide = new T.Group();
    slide.name = 'pistol-slide';
    slide.userData.legacyAction = 'slide';
    slide.userData.travel = S(30);
    root.add(slide);
    for (const mesh of [add('pistol-slide-body', slideGeo(), m.slide, slide), add('pistol-slide-parts', slidePartsGeo(), m.sight, slide), add('pistol-sight-dots', dotsGeo(), m.dot, slide)]) mesh.userData.live = true;
    // the magazine: a tube hidden in the grip and the baseplate under it; built with mag()
    // so the reload pulls the whole assembly out of the grip
    const lean = -RAKE; // the box's up axis tips toward the muzzle with the grip
    const up = [-Math.sin(RAKE), Math.cos(RAKE)], fwd = [-Math.cos(RAKE), -Math.sin(RAKE)]; // (x mm, y mm)
    const bx = 164, by = BOTTOM(164); // middle of the grip bottom
    const at = (a, f) => [bx + up[0] * a + fwd[0] * f, by + up[1] * a + fwd[1] * f];
    const place = (name, mat, w, h, d, a, f) => {
      const [x, y] = at(a, f);
      const mesh = b.mag(mat, S(w), S(h), S(d), 0, Y(y), Z(x), lean);
      mesh.name = name;
      return mesh;
    };
    place('pistol-magazine', m.mag, 21.5, 82, 30, 41, 1);
    place('pistol-magazine-baseplate', m.base, 26.5, 5.8, 40, -2.7, 0.5);
    place('pistol-magazine-lip', m.base, 25, 3.4, 4.5, -3.6, 21.5);
    return root;
  };
  window.GUN_MODEL_PISTOL = { revision: 2, mm: K };
})();
