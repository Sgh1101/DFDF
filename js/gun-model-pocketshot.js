(() => {
  'use strict';
  // Breach (key "pocketshot"): a generic 12-gauge side-by-side coach pistol. Two short
  // barrels joined side by side under a solid top rib with a brass bead, a boxlock action
  // with rounded fences, a hinge knuckle, a top lever on the tang and two exposed hammers,
  // double triggers in a long guard, a short splinter fore-end and a raked walnut pistol
  // grip with a steel cap. No maker's name, logo or marking. It is not Verdict
  // (gun-model-revolver.js) or the pump shotgun: the twin muzzles, the hammers and the
  // colour-cased action against blued barrels and walnut set it apart at a glance.
  //
  // Everything is measured in millimetres on the real gun and converted here:
  //   x: along the gun, backwards (45 the sawn muzzle .. 250 breech face .. 382 grip heel); the
  //      drawings count from where a full-length barrel's muzzle would be
  //   y: from the bores' centre line upwards (+29 hammer spurs .. -134 grip cap)
  //   s: across, from the centre line (+ is the right side)
  // The scale keeps the old Breach's footprint: the muzzle sits where the old one was
  // (z -0.32, bore height 0.027) and the gun is about as long (0.43).
  //
  // Material roles stay the stock GUNMAT kinds, so every skin recolours it: the walnut and
  // its checkering (body), the colour-cased action, hammers, fore-end iron and the
  // engraved side plates (metal: steel), the bright triggers, pins, extractor and sawn
  // muzzle faces (metal: chrome), the blued barrels, rib, guard, top lever and grip cap
  // (dark: blued). The bores alone are a plain unlit black that no skin touches. The stock
  // finish carries its own small canvas textures (case colours, engraving, walnut grain,
  // checkering), made once and shared by every copy of the gun.
  if (typeof GUN_BUILD === 'undefined' || typeof GunBuilder !== 'function' || typeof GUNMAT === 'undefined' || typeof T === 'undefined') return;

  const K = 0.00128; // model units per millimetre
  const ZM = -0.32; // the muzzle face
  const Y0 = 0.027; // the bores' centre line
  const X0 = 45; // the barrels are sawn off here: the muzzle face (the drawings run from the full-length muzzle)
  const Z = (x) => ZM + (x - X0) * K;
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
  const xmmOf = (z) => (z - ZM) / K;
  const ymmOf = (y) => (y - Y0) / K;

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
    path(shape, points.map(([s, y]) => [S(s), Y(y)]));
    shape.closePath();
    const geo = new T.ExtrudeGeometry(shape, { depth: S(x1 - x0), bevelEnabled: false, steps: 1, curveSegments: 4 });
    geo.translate(0, 0, Z(x0));
    if (opt.front || opt.back) {
      const p = geo.attributes.position, zf = Z(x0) + 1e-6, zb = Z(x1) - 1e-6;
      for (let i = 0; i < p.count; i++) {
        const ymm = ymmOf(p.getY(i)), z = p.getZ(i);
        if (z <= zf && opt.front) p.setZ(i, z + S(opt.front(ymm)));
        else if (z >= zb && opt.back) p.setZ(i, z + S(opt.back(ymm)));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    }
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
    return scaleUV(geo);
  }

  // A plan-view outline ([x, s] mm points) extruded upwards from y0, `thick` mm; `rise(x)` (mm)
  // lifts it along the gun so it can lie on a sloping tang.
  function topGeo(points, y0, thick, opt = {}) {
    const shape = new T.Shape();
    path(shape, points.map(([x, s]) => [S(s), -Z(x)]));
    shape.closePath();
    const bevel = S(opt.bevel || 0);
    const geo = new T.ExtrudeGeometry(shape, {
      depth: Math.max(S(thick) - 2 * bevel, S(0.2)),
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelOffset: -bevel,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 4,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, Y(y0) + bevel, 0);
    if (opt.rise) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + S(opt.rise(xmmOf(p.getZ(i)))));
      p.needsUpdate = true;
      geo.computeVertexNormals();
    }
    return scaleUV(geo);
  }

  // scale a part across the gun by f(x mm): the walnut head is as wide as the action, the grip narrower
  function taper(geo, f) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * f(xmmOf(p.getZ(i))));
    p.needsUpdate = true;
    geo.computeVertexNormals();
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
  // a flat outline ([x, y] mm) lying on a side of the gun at s (facing out); uv: 0..1 over its bounds
  // when `fit`, else metres like the rest
  function plateGeo(points, s, fit) {
    const right = s > 0;
    const shape = new T.Shape();
    path(shape, points.map(([x, y]) => [right ? -Z(x) : Z(x), Y(y)]));
    shape.closePath();
    const g = new T.ShapeGeometry(shape, 4);
    if (fit) {
      const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const xmm = xmmOf(right ? -pos.getX(i) : pos.getX(i)), ymm = ymmOf(pos.getY(i));
        uv.setXY(i, (x1 - xmm) / (x1 - x0), (ymm - y0) / (y1 - y0));
      }
      uv.needsUpdate = true;
    } else scaleUV(g);
    g.rotateY(right ? Math.PI / 2 : -Math.PI / 2);
    g.translate(S(s), 0, 0);
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
  const local = (geo, o) => (geo.translate(-o[0], -o[1], -o[2]), geo);
  const smooth = (a, b, v) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  // ── the stock finish's textures: made once, shared ──
  let TEX = null;
  function textures() {
    if (TEX) return TEX;
    let seed = 1907;
    const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const canvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    const tex = (c, rep = 1) => {
      const t = new T.CanvasTexture(c);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(rep, rep);
      t.anisotropy = 4;
      'colorSpace' in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
      return t;
    };
    // colour case hardening: a silver ground clouded with straw, peacock blue, violet and smoke
    const cased = canvas(256, 256);
    {
      const g = cased.getContext('2d'), w = 256, h = 256;
      g.fillStyle = '#a7abb1';
      g.fillRect(0, 0, w, h);
      const cols = ['#24458f', '#3a5fae', '#1f6fb4', '#5d3f92', '#7c58a0', '#c99a4c', '#e0bd72', '#d8a24a', '#8b5e34', '#4d6f9e', '#25272f', '#c7ccd3', '#6b7f9c'];
      const blot = (x, y, r, col, a) => {
        for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
          const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          gr.addColorStop(0, col);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalAlpha = a;
          g.fillStyle = gr;
          g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
        }
      };
      for (let i = 0; i < 80; i++) blot(R() * w, R() * h, 9 + R() * 40, cols[(R() * cols.length) | 0], 0.45 + R() * 0.4);
      // watery swirls
      g.lineCap = 'round';
      for (let i = 0; i < 30; i++) {
        const x = R() * w, y = R() * h;
        g.globalAlpha = 0.18 + R() * 0.22;
        g.strokeStyle = cols[(R() * cols.length) | 0];
        g.lineWidth = 2 + R() * 7;
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + (R() - 0.5) * 90, y + (R() - 0.5) * 90, x + (R() - 0.5) * 90, y + (R() - 0.5) * 90, x + (R() - 0.5) * 70, y + (R() - 0.5) * 70);
        g.stroke();
      }
      for (let i = 0; i < 2600; i++) {
        const v = R() < 0.5 ? 255 : 30;
        g.globalAlpha = 0.06 + R() * 0.08;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(R() * w, R() * h, 1, 1);
      }
      g.globalAlpha = 1;
    }
    // the side plates: case colours under a double border and scrollwork
    const plate = canvas(512, 256);
    {
      const g = plate.getContext('2d'), w = 512, h = 256;
      g.drawImage(cased, 0, 0, 256, 256);
      g.drawImage(cased, 256, 0, 256, 256);
      const line = (draw, width, light) => {
        // a cut line: dark, with a bright lip beside it
        g.save();
        g.translate(1.2, 1.2);
        g.strokeStyle = 'rgba(255,244,214,0.45)';
        g.lineWidth = width * 0.7;
        draw();
        g.restore();
        g.strokeStyle = light || 'rgba(24,20,18,0.85)';
        g.lineWidth = width;
        draw();
      };
      g.lineCap = g.lineJoin = 'round';
      const rr = (x, y, ww, hh, r) => () => {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + ww, y, x + ww, y + hh, r);
        g.arcTo(x + ww, y + hh, x, y + hh, r);
        g.arcTo(x, y + hh, x, y, r);
        g.arcTo(x, y, x + ww, y, r);
        g.closePath();
        g.stroke();
      };
      line(rr(10, 10, w - 20, h - 20, 18), 3.2);
      line(rr(20, 20, w - 40, h - 40, 12), 1.6);
      // a scroll: a spiral with leaves along it
      const scroll = (cx, cy, r, turns, dir, a0) => {
        const pts = [];
        for (let i = 0; i <= 80; i++) {
          const t = i / 80, a = a0 + dir * t * turns * Math.PI * 2, rad = r * (1 - 0.85 * t);
          pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, a]);
        }
        line(() => {
          g.beginPath();
          pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.stroke();
        }, 2.2);
        for (let i = 6; i < 60; i += 9) {
          const [x, y, a] = pts[i], n = a + dir * Math.PI / 2, l = r * 0.32 * (1 - i / 80);
          line(() => {
            g.beginPath();
            g.moveTo(x, y);
            g.quadraticCurveTo(x + Math.cos(n + 0.6) * l, y + Math.sin(n + 0.6) * l, x + Math.cos(n) * l * 1.4, y + Math.sin(n) * l * 1.4);
            g.stroke();
          }, 1.3);
        }
      };
      scroll(120, 128, 78, 1.35, 1, Math.PI);
      scroll(300, 120, 70, 1.3, -1, 0);
      scroll(430, 140, 52, 1.2, 1, Math.PI * 0.5);
      // a vine linking them
      line(() => {
        g.beginPath();
        g.moveTo(40, 210);
        g.bezierCurveTo(140, 250, 200, 40, 300, 50);
        g.bezierCurveTo(380, 58, 420, 220, 490, 200);
        g.stroke();
      }, 1.6);
      // fine background shading between the cuts
      g.globalAlpha = 0.18;
      g.strokeStyle = '#1a1716';
      g.lineWidth = 0.8;
      for (let i = 0; i < 140; i++) {
        const x = 24 + R() * (w - 48), y = 24 + R() * (h - 48);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 4, y + 3);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // walnut: a warm brown with dark grain lines running along the wood and a little figure
    const walnut = canvas(256, 256);
    {
      const g = walnut.getContext('2d'), w = 256, h = 256;
      g.fillStyle = '#5e3720';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) {
        const y = R() * h, hh = 10 + R() * 40;
        g.globalAlpha = 0.18 + R() * 0.2;
        g.fillStyle = R() < 0.5 ? '#3f2111' : '#8a5530';
        g.fillRect(0, y, w, hh);
        g.fillRect(0, y - h, w, hh);
      }
      g.lineCap = 'round';
      for (let i = 0; i < 64; i++) {
        const y0 = R() * h, amp = 1.5 + R() * 7, cyc = 1 + ((R() * 3) | 0), ph = R() * 6.28, amp2 = R() * 3, cyc2 = 3 + ((R() * 5) | 0);
        const dark = R() < 0.72;
        g.globalAlpha = dark ? 0.16 + R() * 0.28 : 0.1 + R() * 0.16;
        g.strokeStyle = dark ? '#26120a' : '#a06a3c';
        g.lineWidth = 0.5 + R() * (dark ? 1.4 : 1.2);
        for (const dy of [-h, 0, h]) {
          g.beginPath();
          for (let x = 0; x <= w; x += 4) {
            const y = y0 + dy + amp * Math.sin((x / w) * Math.PI * 2 * cyc + ph) + amp2 * Math.sin((x / w) * Math.PI * 2 * cyc2);
            x ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.stroke();
        }
      }
      for (let i = 0; i < 500; i++) {
        g.globalAlpha = 0.18;
        g.fillStyle = '#241008';
        g.fillRect(R() * w, R() * h, 2 + R() * 4, 0.8);
      }
      g.globalAlpha = 1;
    }
    // checkering: pointed diamonds cut into the wood, a bright edge on every ridge
    const checker = canvas(128, 128);
    {
      const g = checker.getContext('2d'), w = 128, h = 128;
      g.fillStyle = '#5a341b';
      g.fillRect(0, 0, w, h);
      const fam = (slope, col, width, off) => {
        g.strokeStyle = col;
        g.lineWidth = width;
        for (let c = -2 * h; c <= 2 * h; c += 16) {
          g.beginPath();
          g.moveTo(0, c + off);
          g.lineTo(w, c + off + slope * w);
          g.stroke();
        }
      };
      fam(0.5, 'rgba(255,214,160,0.35)', 1.2, 1.4);
      fam(-0.5, 'rgba(255,214,160,0.35)', 1.2, 1.4);
      fam(0.5, '#1e0f07', 2.6, 0);
      fam(-0.5, '#1e0f07', 2.6, 0);
    }
    const grip = tex(walnut);
    grip.center.set(0.5, 0.5);
    grip.rotation = 1.3; // the grain runs down the raked grip
    return (TEX = { cased: tex(cased), plate: tex(plate), walnut: tex(walnut), grip, checker: tex(checker, 4) });
  }

  // ── materials: stock kinds, own finish ──
  function materials() {
    const tone = (m, color, rough, metal, map) => {
      m.color.setHex(color);
      m.roughness = rough;
      m.metalness = metal;
      if (map) {
        m.map = map;
        m.needsUpdate = true;
      }
      return m;
    };
    const t = textures();
    return {
      cased: tone(GUNMAT.steel(), 0xffffff, 0.32, 0.62, t.cased), // the colour-cased action, fences, tang, hammers, fore-end iron
      plate: tone(GUNMAT.steel(), 0xffffff, 0.36, 0.58, t.plate), // the engraved side plates
      blued: tone(GUNMAT.blued(), 0x222d42, 0.28, 0.8), // barrels, rib, trigger guard, top lever, grip cap: deep blue-black
      bright: tone(GUNMAT.chrome(), 0xc6cad0, 0.24, 0.88), // triggers, hinge pin, screws, extractor
      dark: tone(GUNMAT.blued(), 0x111214, 0.65, 0.35), // screw slots, the hammer spurs' and lever's checkering
      wood: tone(GUNMAT.wood(), 0xffffff, 0.5, 0.02, t.walnut), // the fore-end
      grip: tone(GUNMAT.wood(), 0xffffff, 0.5, 0.02, t.grip), // the grip, its grain along the rake
      checker: tone(GUNMAT.woodDark(), 0xffffff, 0.78, 0, t.checker), // the grip's checkered panels
      bore: new T.MeshBasicMaterial({ color: 0x040405, side: T.DoubleSide }), // bores and chambers: unlit, black under every skin
      bead: tone(GUNMAT.brass(), 0xe0b95c, 0.22, 0.9), // the front bead
    };
  }

  // ── the barrels: two tubes touching all along, closer at the muzzle than at the breech ──
  const BL = 250; // barrel length: the breech face is at x 250
  const RM = 10.6, RB = 12.6; // outside radius at the muzzle and the breech
  const BORE_R = 9.3, CHAMBER_R = 10.2;
  const R = (x) => RM + ((RB - RM) * x) / BL;
  const TOE = Math.atan((RB - RM) / BL); // each barrel's angle off the centre line
  // a part built along z from the muzzle (z = x mm * K), turned onto one barrel's axis
  function onBarrel(geo, sig) {
    geo.rotateY(sig * TOE);
    geo.translate(S(sig * R(X0)), Y(0), Z(X0));
    return geo;
  }
  function lathe(profile, segs) {
    const pts = profile.map(([x, r]) => new T.Vector2(Math.max(0, S(r)), (x - X0) * K));
    const geo = new T.LatheGeometry(pts, segs);
    const uv = geo.attributes.uv, np = pts.length;
    const rMax = Math.max(...profile.map(([, r]) => r)) * K;
    const along = [0];
    for (let j = 1; j < np; j++) along.push(along[j - 1] + pts[j].distanceTo(pts[j - 1]));
    for (let i = 0; i <= segs; i++) for (let j = 0; j < np; j++) uv.setXY(i * np + j, along[j] / UV_TILE, ((i / segs) * Math.PI * 2 * rMax) / UV_TILE);
    uv.needsUpdate = true;
    geo.rotateX(Math.PI / 2);
    return geo;
  }
  const RIB_TOP = (x) => R(x) - 0.3;
  function barrelsGeo() {
    const g = [];
    for (const sig of [-1, 1]) {
      // the muzzle face with a small crown, the tapered tube, the breech face round the chamber
      g.push(onBarrel(lathe([[X0, BORE_R], [X0, R(X0) - 0.8], [X0 + 0.9, R(X0)], [BL - 1, RB], [BL, RB - 1], [BL, CHAMBER_R]], 32), sig));
    }
    // the top rib: a solid strip in the valley between the barrels, its top just under theirs
    g.push(sideGeo([[X0 + 0.5, 5], [X0 + 0.5, RIB_TOP(X0 + 0.5)], [BL, RIB_TOP(BL)], [BL, 5]], 7.4));
    // the bottom rib, from the muzzle to the fore-end
    g.push(sideGeo([[X0 + 0.5, -4], [132, -4], [132, -R(132) + 0.6], [X0 + 0.5, -R(X0) + 0.6]], 6.4));
    // the lumps under the breech: they drop into the action bar and hook round the hinge pin
    g.push(sideGeo([[197, -10.5], [249, -10.5], [249, -18], [224, -21.5], [205, -21.5], [199, -19], [194.5, -18.5]], 16, { bevel: 0.8, segments: 1 }));
    // the bead's little base on the rib
    g.push(cylGeo(1.4, 1.9, 1.6, 10, 'y', BEAD.x, RIB_TOP(BEAD.x) + 0.5, 0));
    return merged(g);
  }
  const BEAD = { x: X0 + 4.5, y: RIB_TOP(X0 + 4.5) + 2.5, r: 1.8 };
  function beadGeo() {
    const g = new T.SphereGeometry(S(BEAD.r), 14, 10);
    g.translate(0, Y(BEAD.y), Z(BEAD.x));
    return scaleUV(g);
  }
  // the bores at the muzzle and the chambers at the breech: dark tubes with a floor
  function boresGeo() {
    const g = [];
    for (const sig of [-1, 1]) {
      const bore = new T.CylinderGeometry(S(BORE_R), S(BORE_R), S(70), 18, 1, true);
      bore.rotateX(Math.PI / 2);
      bore.translate(0, 0, S(35));
      g.push(onBarrel(bore, sig));
      const floor = new T.CircleGeometry(S(BORE_R), 18);
      floor.rotateY(Math.PI);
      floor.translate(0, 0, S(70));
      g.push(onBarrel(floor, sig));
      const ch = new T.CylinderGeometry(S(CHAMBER_R), S(CHAMBER_R), S(26), 18, 1, true);
      ch.rotateX(Math.PI / 2);
      ch.translate(0, 0, S(BL - X0 - 13));
      g.push(onBarrel(ch, sig));
      const chFloor = new T.CircleGeometry(S(CHAMBER_R), 18);
      chFloor.translate(0, 0, S(BL - X0 - 26));
      g.push(onBarrel(chFloor, sig));
    }
    return merged(g);
  }
  // the extractor: a half moon in the breech face between the chambers, proud when the gun is open
  // and the sawn muzzles, dressed bright: a ring of bare steel round each bore
  function extractorGeo() {
    const g = [boxGeo(9, 6.5, 1.4, BL + 0.4, -6, 0), cylGeo(1.2, 1.2, 1.6, 8, 'z', BL + 0.4, -2.2, 0)];
    for (const sig of [-1, 1]) {
      const ring = new T.RingGeometry(S(BORE_R), S(R(X0) - 0.15), 36);
      ring.rotateY(Math.PI);
      ring.translate(0, 0, -S(0.08));
      g.push(onBarrel(scaleUV(ring), sig));
    }
    return merged(g);
  }

  // ── the fore-end: a short splinter of walnut under the barrels, its iron against the knuckle ──
  const FE = { x0: 128, x1: 172 };
  const H = [194, -14]; // the hinge pin
  const KNUCKLE_R = 11;
  const knuckleX = (y) => H[0] - Math.sqrt(Math.max(0, KNUCKLE_R * KNUCKLE_R - (y - H[1]) * (y - H[1])));
  function foreEndGeo() {
    const sec = [[-24.2, -1.5], [-25.2, -8], [-24, -15], [-20, -20.6], [-12.4, -23.8], [12.4, -23.8], [20, -20.6], [24, -15], [25.2, -8], [24.2, -1.5]];
    return sectionGeo(sec, FE.x0, FE.x1 + 0.5, { front: (y) => Math.max(0, -1.5 - y) * 0.42 + Math.max(0, y + 6) * 0.8 });
  }
  function foreEndIronGeo() {
    const sec = [[-25.6, -6], [-24.4, -15.4], [-20.4, -21.2], [-12.6, -24.4], [12.6, -24.4], [20.4, -21.2], [24.4, -15.4], [25.6, -6]];
    const g = [sectionGeo(sec, FE.x1, 182, { back: (y) => knuckleX(y) - 0.4 - 182 })];
    // the latch lever under the wood's tip, and its escutcheon
    g.push(sideGeo([[148, -23.2], [164, -23.2], [165, -24.6], [161, -26], [150, -25.6]], 5.5, { bevel: 0.5, segments: 1 }));
    g.push(boxGeo(10, 0.8, 20, 157, -23.6, 0));
    return merged(g);
  }

  // ── the action: a boxlock body, its fences, the tang, the hammers and the top lever ──
  const AW = 46; // the action's width
  const TANG_TOP = (x) => 8.5 - (x - 254) * 0.08;
  const HAMMER_S = 13.2;
  function actionGeo() {
    const g = [];
    // the body: the bar under the barrels ending in the rounded knuckle, the lock area behind the fences
    const knuckle = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 1.5 - (i / 10) * Math.PI * 0.62; // from under the pin round to the front
      knuckle.push([H[0] + KNUCKLE_R * Math.cos(a), H[1] + KNUCKLE_R * Math.sin(a)]);
    }
    g.push(sideGeo([[250, -10], [250, 5], [292, 5], [290.8, -6], [293.5, -16], [299.5, -25], ...knuckle], AW, { bevel: 2, segments: 2 }));
    // the fences: two rounded shoulders behind the breeches, sloping back into the lock area
    const RF = 13.6;
    const hump = (s) => Math.sqrt(Math.max(0, RF * RF - (Math.abs(s) - RB) * (Math.abs(s) - RB)));
    const sec = [[-AW / 2, -10], [AW / 2, -10]];
    for (let i = 0; i <= 32; i++) {
      const s = AW / 2 - (i / 32) * AW;
      sec.push([s, Math.max(5.2, hump(s))]);
    }
    g.push(sectionGeo(sec, 250, 256.5, { back: (y) => Math.max(0, RF - y) * 0.55 }));
    // the top tang, inlet flush with the wrist
    const tang = [[253, -9.4], [272, -8.6], [300, -7.4], [326, -6], [332, -3.4], [333.5, 0], [332, 3.4], [326, 6], [300, 7.4], [272, 8.6], [253, 9.4]];
    g.push(topGeo(tang, 8.5 - 4.5, 4.5, { rise: (x) => TANG_TOP(x) - 8.5, bevel: 0.6 }));
    // the hammers: a nose that falls on the fence, a neck and a tall spur, either side of the tang
    const hammer = [[263.5, 4.5], [259, 11.4], [260.4, 14.6], [267, 15.4], [273.5, 14], [279.5, 15], [285.5, 18.6], [291.5, 22.8], [297.5, 24.8], [302.6, 24.4], [303.6, 21.6], [298.6, 19.6], [292.8, 15.4], [290.4, 8], [289.4, 2], [286, -2], [279, -2.5], [272.5, 0], [267.5, 3]];
    for (const sig of [-1, 1]) g.push(sideGeo(hammer, 7.4, { s: sig * HAMMER_S, bevel: 1.4, segments: 2 }));
    // the trigger plate's tang down the front of the grip, behind the guard
    g.push(sideGeo([[296, -25.6], [312, -28.6], [319, -33.5], [323, -40.5], [321, -41.5], [316.5, -36], [309, -31], [296, -28.2]], 10, { bevel: 0.8, segments: 1 }));
    return merged(g);
  }
  // the engraved plates on both sides of the body
  const PLATE = [[203.5, -12.4], [247.5, -12.4], [250.5, -9.6], [252, 2.6], [288.2, 2.6], [287.6, -6], [290, -15.4], [294, -22.6], [205, -22.6], [200.4, -20.2], [199.8, -15.8]];
  function platesGeo() {
    return merged([-1, 1].map((sig) => plateGeo(PLATE, sig * (AW / 2 + 0.12), true)));
  }
  // bright parts: the hinge pin, screws, the triggers, the firing pins in the standing breech
  function brightGeo() {
    const g = [];
    g.push(cylGeo(3.4, 3.4, AW + 0.6, 18, 'x', H[0], H[1], 0)); // the hinge pin's ends
    for (const sig of [-1, 1]) {
      g.push(cylGeo(2.4, 2.4, 1, 14, 'x', 283.5, 2.8, sig * (HAMMER_S + 3.6))); // hammer pivot screws
      g.push(cylGeo(1.9, 1.9, 0.8, 12, 'x', 236, -18, sig * (AW / 2 + 0.4))); // plate screws
      g.push(cylGeo(1.9, 1.9, 0.8, 12, 'x', 272, -17, sig * (AW / 2 + 0.4)));
      g.push(cylGeo(1.6, 1.6, 0.8, 10, 'z', 249.6, 0, sig * RB)); // firing pins in the standing breech
    }
    g.push(cylGeo(2.2, 2.2, 0.7, 12, 'y', 266, TANG_TOP(266) + 3.1, 0)); // the top lever's pin head
    g.push(cylGeo(1.8, 1.8, 0.7, 12, 'y', 322, TANG_TOP(322) + 0.1, 0)); // the tang screw
    // double triggers: the front one (right barrel) a little right, the rear one a little left
    g.push(sideGeo([[273, -24], [279, -24], [279.2, -31], [281.2, -37.5], [283.8, -43.4], [282.8, -46.2], [279.6, -44.6], [277, -39], [274.2, -31.8]], 4.4, { s: 1.4, bevel: 0.5, segments: 1 }));
    g.push(sideGeo([[289.5, -24], [295.5, -24], [295.7, -30.6], [297.6, -36], [300, -41], [299, -43.6], [296, -42.2], [293.4, -37], [290.6, -31]], 4.4, { s: -1.4, bevel: 0.5, segments: 1 }));
    return merged(g);
  }
  function darkGeo() {
    const g = [];
    for (const sig of [-1, 1]) {
      g.push(boxGeo(0.5, 0.5, 3.6, 283.5, 2.8, sig * (HAMMER_S + 4.15)));
      g.push(boxGeo(0.5, 0.5, 3, 236, -18, sig * (AW / 2 + 0.85), 0.6));
      g.push(boxGeo(0.5, 0.5, 3, 272, -17, sig * (AW / 2 + 0.85), -0.4));
    }
    // the thumb piece's grooves and the lever pin's slot
    for (let i = 0; i < 4; i++) g.push(topGeo([[288 + i * 2.4, 1.6], [289 + i * 2.4, 1.6], [289 + i * 2.4, 8.6], [288 + i * 2.4, 8.6]], TANG_TOP(289 + i * 2.4) + 2.9, 0.5));
    g.push(boxGeo(3.6, 0.4, 0.5, 266, TANG_TOP(266) + 3.5, 0));
    g.push(boxGeo(3, 0.4, 0.5, 322, TANG_TOP(322) + 0.5, 0, 0, 0));
    return merged(g);
  }
  // the trigger guard (blued): long enough for two triggers, its rear running into the grip
  // the top lever, blued against the cased action: a boss on its pin and an arm swept back to the
  // right, a thumb piece at its end
  function leverGeo() {
    const lever = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.5 + (i / 10) * Math.PI;
      lever.push([266 + 6 * Math.sin(a), 6 * Math.cos(a)]);
    }
    lever.push([279, -4.4], [290, -2.6], [296.5, 0.2], [299, 4.6], [297.6, 9], [293, 10.6], [288, 8.8], [278, 5.4], [270, 5.4]);
    return topGeo(lever, TANG_TOP(266) - 0.4, 3.4, { rise: (x) => TANG_TOP(x) - TANG_TOP(266), bevel: 0.5 });
  }
  function guardGeo() {
    const outer = [[259, -24.5], [261, -33], [266, -42], [274, -49.5], [286, -53.2], [300, -53.2], [311, -49.6], [318, -43.4], [321.5, -37], [322, -31.5], [313, -28.5], [298, -26.2]];
    const hole = [[266, -28], [267, -35.5], [271.5, -43], [280, -47.6], [298.5, -47.6], [307.5, -44.4], [313.4, -38.4], [314.6, -31.6], [305, -28.6]];
    return merged([sideGeo(outer, 8.8, { holes: [hole], bevel: 1.2, segments: 2 }), leverGeo()]);
  }

  // ── the grip: raked walnut, as wide as the action at its head, rounded, with a steel cap ──
  const GRIP_W = 32;
  function gripGeo() {
    const pts = [
      [291.6, 5], [300, TANG_TOP(300) - 0.3], [316, TANG_TOP(316) - 0.3], [333.5, TANG_TOP(333.5) - 0.6], [337.5, 1], [341.5, -1.4], [345.2, -4.8], [348.4, -9.4], [351, -15], [353, -21.6], [354.6, -29], [356.4, -37.4],
      [358.8, -46], [364.2, -64], [370.4, -84], [376, -104], [380, -119],
      [349, -128.6],
      [345, -116], [341, -102], [337, -88], [333, -74], [328.6, -60], [324.4, -48], [320.6, -40.5], [316, -34.6], [308, -29.4], [299.5, -26],
      [293.5, -16], [290.8, -6],
    ];
    const g = sideGeo(pts, GRIP_W, { bevel: 7.5, segments: 3 });
    return taper(g, (x) => 1 + (AW / GRIP_W - 1) * (1 - smooth(296, 330, x)));
  }
  const CHECK = [[332, -54], [349.5, -45.5], [367, -103], [348.5, -109.5]];
  function checkerGeo() {
    return merged([-1, 1].map((sig) => plateGeo(CHECK, sig * (GRIP_W / 2 + 0.1), false)));
  }
  function capGeo() {
    return merged([
      sideGeo([[349, -128.4], [380, -118.8], [381.6, -123.2], [350.6, -133.2]], GRIP_W - 4, { bevel: 1.6, segments: 2 }),
      // the lanyard-free cap's screw
      cylGeo(1.8, 1.8, 0.6, 12, 'y', 365.4, -128.4, 0),
    ]);
  }

  GUN_BUILD.pocketshot = () => {
    const b = GunBuilder();
    const root = b.group;
    const m = materials();
    root.name = 'dfdf-pocketshot';
    root.userData.weaponModel = 'dfdf-pocketshot';
    root.userData.modelRevision = 2;
    root.userData.anchors = {
      right: [0.004, Y(-62), Z(346)],
      left: [-0.006, Y(-24), Z(150)],
      // the flash comes out of the right barrel, the one the front trigger fires
      muzzle: [S(R(X0)), Y(0), Z(X0 - 1)],
      // the line of sight: along the rib to the top of the bead; this point is over the breech
      sight: [0, Y(BEAD.y + BEAD.r), Z(BL)],
    };
    const add = (name, geo, mat, parent = root, live = parent !== root) => {
      const mesh = new T.Mesh(geo, mat);
      mesh.name = name;
      live && (mesh.userData.live = true);
      parent.add(mesh);
      return mesh;
    };
    // the static gun
    add('pocketshot-action', actionGeo(), m.cased);
    add('pocketshot-side-plates', platesGeo(), m.plate);
    add('pocketshot-bright-parts', brightGeo(), m.bright);
    add('pocketshot-small-dark', darkGeo(), m.dark);
    add('pocketshot-guard-and-lever', guardGeo(), m.blued);
    add('pocketshot-grip', gripGeo(), m.grip);
    add('pocketshot-grip-checkering', checkerGeo(), m.checker);
    add('pocketshot-grip-cap', capGeo(), m.blued);
    // the barrels and the fore-end tip down on the hinge pin in a reload
    const hp = [0, Y(H[1]), Z(H[0])];
    const brk = new T.Group();
    brk.name = 'pocketshot-barrels';
    brk.position.set(...hp);
    brk.userData.legacyAction = 'break';
    // for the reload: the breech between the two chambers (in this group's frame), the spacing
    // of the chambers and the size of a 12-gauge shell, so the two new shells go into them
    brk.userData.reload = {
      breech: [0, Y(0) - hp[1], Z(BL) - hp[2]],
      spacing: S(2 * RB),
      caseR: S(10.1),
      caseLen: S(64),
      rimR: S(11),
    };
    root.add(brk);
    add('pocketshot-barrel-pair', local(barrelsGeo(), hp), m.blued, brk);
    add('pocketshot-bores', local(boresGeo(), hp), m.bore, brk);
    add('pocketshot-bead', local(beadGeo(), hp), m.bead, brk);
    add('pocketshot-extractor', local(extractorGeo(), hp), m.bright, brk);
    add('pocketshot-fore-end', local(foreEndGeo(), hp), m.wood, brk);
    add('pocketshot-fore-end-iron', local(foreEndIronGeo(), hp), m.cased, brk);
    return root;
  };
  window.GUN_MODEL_POCKETSHOT = { revision: 2, mm: K };
})();
