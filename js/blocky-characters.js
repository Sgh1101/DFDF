// Blocky characters: every character body is drawn as cubes (voxels), the way the block-building sandbox draws people.
// A body is already one merged piece per part (chBake). Each piece is re-drawn as a grid of small cubes: the piece's
// surface is sampled, every cell it touches becomes a cube, and each cube takes the colour the surface shows there, so
// the hair, the skin, the shirt and the belt keep their colours and the spider's legs stay thin. Only the outside faces
// of the cubes are built. A piece keeps its own position, rotation and scale, so the rig (arms, legs, head pivots, the
// reload and knife animations) moves exactly as before.
// Left alone: the guns (weapons, not characters), the fists (the knife rig finds them by their sphere), and pieces that
// are already cubes (the neon agent's skin). Hit detection works on positions, not on shapes, so it does not change.
// Each agent's cubes are worked out once and kept; every fighter gets its own copy (marked userData.blocky), which
// the engine frees with the fighter. Set window.BLOCKY_OFF = true before a character
// is built to get the round body back; window.BLOCKY_CELL sets the cube size in metres (default 0.07).
(() => {
  if ("function" != typeof buildFighter || "undefined" == typeof CH_GEO || "undefined" == typeof T) return;

  const FIST_R = 0.043;
  const AX = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)];
  const CACHE = new Map();

  // a texture's pixels (read once), for pieces that wear a picture (the neon agent's skin)
  const PIX = new Map();
  function pixelsOf(tex) {
    if (PIX.has(tex.uuid)) return PIX.get(tex.uuid);
    let out = null;
    try {
      const im = tex.image,
        w = im && (im.width || im.naturalWidth),
        h = im && (im.height || im.naturalHeight);
      if (w && h) {
        // a cube is several centimetres: 256 pixels on the long side is plenty and reads fast
        const k = Math.min(1, 256 / Math.max(w, h)),
          tw = Math.max(1, Math.round(w * k)),
          th = Math.max(1, Math.round(h * k));
        const cv = document.createElement("canvas");
        cv.width = tw;
        cv.height = th;
        const cx = cv.getContext("2d");
        cx.drawImage(im, 0, 0, tw, th);
        out = { w: tw, h: th, d: cx.getImageData(0, 0, tw, th).data };
      }
    } catch (e) {
      out = null;
    }
    PIX.set(tex.uuid, out);
    return out;
  }
  // the same piece in plain voxel colours, so the texture's picture is not doubled by the material
  const PLAIN = new Map();
  const plainOf = (mat) => {
    let m = PLAIN.get(mat.uuid);
    if (!m) {
      m = mat.clone();
      m.map = null;
      m.alphaMap = null;
      m.alphaTest = 0;
      m.transparent = false;
      m.vertexColors = true;
      m.color.setRGB(1, 1, 1);
      PLAIN.set(mat.uuid, m);
    }
    return m;
  };

  // ── sampling: every cell a piece's surface touches ──
  function voxelize(src, mat, g) {
    const P = src.attributes.position,
      C = src.attributes.color,
      R = src.attributes.chrm,
      E = src.attributes.chem,
      U = src.attributes.uv,
      idx = src.index ? src.index.array : null,
      n = idx ? idx.length : P.count,
      pix = mat && mat.map && U ? pixelsOf(mat.map) : null,
      vc = !!(pix || (mat && mat.vertexColors && C));
    const cells = new Map(),
      K = 4096,
      OFF = 2048;
    const put = (x, y, z, col, rough, emit) => {
      const ix = Math.floor(x / g),
        iy = Math.floor(y / g),
        iz = Math.floor(z / g),
        k = ((ix + OFF) * K + (iy + OFF)) * K + (iz + OFF);
      let e = cells.get(k);
      if (!e) cells.set(k, (e = { ix, iy, iz, r: 0, gg: 0, b: 0, ro: 0, me: 0, er: 0, eg: 0, eb: 0, n: 0 }));
      e.n++;
      if (col) {
        e.r += col[0];
        e.gg += col[1];
        e.b += col[2];
      }
      if (rough) {
        e.ro += rough[0];
        e.me += rough[1];
      }
      if (emit) {
        e.er += emit[0];
        e.eg += emit[1];
        e.eb += emit[2];
      }
    };
    const pa = new T.Vector3(),
      pb = new T.Vector3(),
      pc = new T.Vector3(),
      cross = new T.Vector3();
    for (let t = 0; t + 2 < n; t += 3) {
      const a = idx ? idx[t] : t,
        b = idx ? idx[t + 1] : t + 1,
        c = idx ? idx[t + 2] : t + 2;
      pa.fromBufferAttribute(P, a);
      pb.fromBufferAttribute(P, b);
      pc.fromBufferAttribute(P, c);
      cross.subVectors(pb, pa).cross(pc.clone().sub(pa));
      const area = cross.length() / 2,
        m = Math.min(24, Math.max(1, Math.ceil(Math.sqrt(area / (g * g / 9)) * 1.15)));
      for (let i = 0; i <= m; i++)
        for (let j = 0; i + j <= m; j++) {
          const u = (i + 0.33) / (m + 0.33),
            v = (j + 0.33) / (m + 0.33),
            w = 1 - u - v;
          if (w < 0) continue;
          const x = pa.x * w + pb.x * u + pc.x * v,
            y = pa.y * w + pb.y * u + pc.y * v,
            z = pa.z * w + pb.z * u + pc.z * v;
          let col = null;
          if (pix) {
            // the picture under the point, linear, skipped where it is see-through
            const pu = U.getX(a) * w + U.getX(b) * u + U.getX(c) * v,
              pv = U.getY(a) * w + U.getY(b) * u + U.getY(c) * v,
              fx = pu - Math.floor(pu),
              fy = pv - Math.floor(pv),
              px = Math.min(pix.w - 1, Math.floor(fx * pix.w)),
              py = Math.min(pix.h - 1, Math.floor((1 - fy) * pix.h)),
              o = (py * pix.w + px) * 4;
            if (pix.d[o + 3] < 128) continue;
            col = [Math.pow(pix.d[o] / 255, 2.2), Math.pow(pix.d[o + 1] / 255, 2.2), Math.pow(pix.d[o + 2] / 255, 2.2)];
          } else if (vc)
            col = [C.getX(a) * w + C.getX(b) * u + C.getX(c) * v, C.getY(a) * w + C.getY(b) * u + C.getY(c) * v, C.getZ(a) * w + C.getZ(b) * u + C.getZ(c) * v];
          const rough = R ? [R.getX(a) * w + R.getX(b) * u + R.getX(c) * v, R.getY(a) * w + R.getY(b) * u + R.getY(c) * v] : null;
          const emit = E ? [E.getX(a) * w + E.getX(b) * u + E.getX(c) * v, E.getY(a) * w + E.getY(b) * u + E.getY(c) * v, E.getZ(a) * w + E.getZ(b) * u + E.getZ(c) * v] : null;
          put(x, y, z, col, rough, emit);
        }
    }
    return { cells, vc, hasR: !!R, hasE: !!E, mat: pix ? plainOf(mat) : null };
  }

  // ── geometry: only the outside faces of the cells ──
  function build(cells, vc, hasR, hasE, g) {
    const has = (ix, iy, iz) => cells.has(((ix + 2048) * 4096 + (iy + 2048)) * 4096 + (iz + 2048));
    const pos = [],
      nor = [],
      col = [],
      rm = [],
      em = [];
    const c3 = (ix, iy, iz) => [ix, iy, iz];
    for (const e of cells.values()) {
      const s = 1 / Math.max(1, e.n);
      const rgb = [e.r * s, e.gg * s, e.b * s],
        ro = [e.ro * s || 1, e.me * s],
        ee = [e.er * s, e.eg * s, e.eb * s];
      for (let a = 0; a < 3; a++)
        for (const sg of [1, -1]) {
          const d = [e.ix, e.iy, e.iz];
          const nb = [d[0], d[1], d[2]];
          nb[a] += sg;
          if (has(nb[0], nb[1], nb[2])) continue;
          // the face's own corners: the cell's plane on this side, its two other axes
          const p = (a + 1) % 3,
            q = (a + 2) % 3,
            plane = (d[a] + (sg > 0 ? 1 : 0)) * g;
          const corner = (u, v) => {
            const o = [0, 0, 0];
            o[a] = plane;
            o[p] = (d[p] + u) * g;
            o[q] = (d[q] + v) * g;
            return o;
          };
          let c0 = corner(0, 0),
            c1 = corner(1, 0),
            c2 = corner(1, 1),
            c3p = corner(0, 1);
          if (sg < 0) [c1, c3p] = [c3p, c1];
          for (const tri of [[c0, c1, c2], [c0, c2, c3p]]) {
            for (const v of tri) {
              pos.push(v[0], v[1], v[2]);
              nor.push(AX[a].x * sg, AX[a].y * sg, AX[a].z * sg);
              col.push(rgb[0], rgb[1], rgb[2]);
              rm.push(ro[0], ro[1]);
              em.push(ee[0], ee[1], ee[2]);
            }
          }
        }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    if (vc) {
      geo.setAttribute("color", new T.Float32BufferAttribute(col, 3));
      geo.setAttribute("chrm", new T.Float32BufferAttribute(rm, 2));
      geo.setAttribute("chem", new T.Float32BufferAttribute(em, 3));
    }
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  // a cheap fingerprint of a piece, so the same agent's same part is only worked out once
  const sig = (geo) => {
    const P = geo.attributes.position;
    let s = P.count;
    for (let i = 0; i < P.count; i += 7) s = (s * 31 + Math.round(P.getX(i) * 1e4) + Math.round(P.getY(i) * 1e4) * 7 + Math.round(P.getZ(i) * 1e4) * 13) | 0;
    return s;
  };

  // the cell is a size on screen: a piece that is drawn small (scaled down) gets smaller cells in its own space
  function cubesFor(mesh, key) {
    const src = mesh.geometry;
    const sc = mesh.scale,
      k0 = Math.cbrt(Math.abs(sc.x * sc.y * sc.z)) || 1,
      g = (window.BLOCKY_CELL || 0.07) / k0;
    const k = key + "|" + sig(src) + "|" + g.toFixed(5);
    let hit = CACHE.get(k);
    if (!hit) {
      const v = voxelize(src, mesh.material, g);
      const geo = build(v.cells, v.vc, v.hasR, v.hasE, g);
      geo.userData.shared = true;
      hit = { geo, mat: v.mat };
      CACHE.set(k, hit);
    }
    return hit;
  }

  function blocky(f, who) {
    const skip = new Set();
    if (f.gun) f.gun.traverse((o) => skip.add(o));
    const cached = new Set(CH_GEO.values());
    let i = 0;
    f.group.traverse((o) => {
      if (!o.isMesh || !o.geometry || skip.has(o)) return;
      const gm = o.geometry;
      i++;
      if (gm.type === "BoxGeometry" || gm.userData.shared || gm.userData.blocky) return;
      if (gm.type === "SphereGeometry" && gm.parameters && Math.abs(gm.parameters.radius - FIST_R) < 0.006) return;
      const hit = cubesFor(o, who + "|" + i);
      // each fighter owns a copy: the engine frees a fighter's baked pieces when it is cleared, so two fighters
      // of the same agent must not share one (it was freed twice, and the cached one with it)
      const geo = hit.geo.clone();
      geo.userData = { blocky: !0 };
      o.geometry = geo;
      if (hit.mat) o.material = hit.mat;
      if (!cached.has(gm) && !gm.userData.shared) gm.dispose();
    });
  }

  const BF = buildFighter;
  buildFighter = function (team, agent) {
    const f = BF.apply(this, arguments);
    if (f && f.group && !window.BLOCKY_OFF)
      try {
        blocky(f, (agent && (agent.id || agent.key)) || "_default");
      } catch (e) {
        console.warn("blocky body", e);
      }
    return f;
  };
  window.BLOCKY = { cache: CACHE };
})();
