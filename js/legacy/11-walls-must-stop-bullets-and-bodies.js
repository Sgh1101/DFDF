
(() => {
  // Walls must stop bullets and bodies.
  // 1) Shots used to sample points every 0.75–4 m along the ray, so thin walls
  //    and long shots on the big maps slipped between samples. Every wall test
  //    below is an exact ray/box intersection instead.
  // 2) A safety net pushes any actor that ends a step inside a collider back out.
  // 3) Solid-looking props at leg height with no collider get one at map load.

  // first t in (t0, t1] where the ray o + d*t enters the box, or Infinity
  // (no arrays, no destructuring: this runs for every collider the ray's cells hold on every shot and every sight line)
  // ye: how far under a box's bottom the ray still counts (0.01 unless given; the Ascent map's boxes use 0)
  function boxT(c, ox, oy, oz, dx, dy, dz, t1, ye) {
    let lo = 0,
      hi = t1,
      a,
      b,
      t;
    const yb = (c.y0 || 0) - (ye === undefined ? 0.01 : ye);
    // x
    if (dx > -1e-9 && dx < 1e-9) {
      if (ox <= c.minX || ox >= c.maxX) return Infinity;
    } else {
      a = (c.minX - ox) / dx;
      b = (c.maxX - ox) / dx;
      if (a > b) (t = a), (a = b), (b = t);
      a > lo && (lo = a);
      b < hi && (hi = b);
      if (lo > hi) return Infinity;
    }
    // y (a floor has a bottom)
    if (dy > -1e-9 && dy < 1e-9) {
      if (oy <= yb || oy >= c.h) return Infinity;
    } else {
      a = (yb - oy) / dy;
      b = (c.h - oy) / dy;
      if (a > b) (t = a), (a = b), (b = t);
      a > lo && (lo = a);
      b < hi && (hi = b);
      if (lo > hi) return Infinity;
    }
    // z
    if (dz > -1e-9 && dz < 1e-9) {
      if (oz <= c.minZ || oz >= c.maxZ) return Infinity;
    } else {
      a = (c.minZ - oz) / dz;
      b = (c.maxZ - oz) / dz;
      if (a > b) (t = a), (a = b), (b = t);
      a > lo && (lo = a);
      b < hi && (hi = b);
      if (lo > hi) return Infinity;
    }
    return lo;
  }
  const ascentOn = () => window.ASCENT_TRIAL && ASCENT_TRIAL.active && CUR_MAP_KEY === 'ascent_trial';
  // The nearest hit t in (0, maxT] of the ray o + d*t against the colliders, maxT if none; with `any` the first hit ends it.
  // It walks the hash cells the ray passes through (a stamp on each collider keeps one that spans several cells from being
  // tested twice) and runs the exact box test on the colliders in them; those reaching past the grid (CHASH.out) are always
  // tested. asc: the Ascent map's boxes (no skipping of low ones, no slack under the bottom).
  function rayHit(ox, oy, oz, dx, dy, dz, maxT, skip, any, asc) {
    (!CHASH.dirty && CHASH.buckets) || chashBuild();
    const gen = ++CHASH.gen,
      ye = asc ? 0 : 0.01,
      out = CHASH.out,
      cell = CHASH.cell,
      cols = CHASH.cols,
      rows = CHASH.rows,
      bk = CHASH.buckets,
      sx = dx > 0 ? 1 : dx < 0 ? -1 : 0,
      sz = dz > 0 ? 1 : dz < 0 ? -1 : 0,
      tx = sx ? cell / Math.abs(dx) : Infinity,
      tz = sz ? cell / Math.abs(dz) : Infinity;
    let best = maxT,
      c,
      t,
      i;
    for (i = 0; i < out.length; i++) {
      c = out[i];
      if (c === skip || (!asc && !(c.h > 0.02))) continue;
      c.qs = gen;
      t = boxT(c, ox, oy, oz, dx, dy, dz, best, ye);
      if (t < best && ((best = t), any)) return best;
    }
    let ix = Math.floor((ox - CHASH.minX) / cell),
      iz = Math.floor((oz - CHASH.minZ) / cell),
      nx = sx ? (CHASH.minX + (sx > 0 ? ix + 1 : ix) * cell - ox) / dx : Infinity,
      nz = sz ? (CHASH.minZ + (sz > 0 ? iz + 1 : iz) * cell - oz) / dz : Infinity,
      tie = false;
    for (let n = 0; n < 4096; n++) {
      // the cell the ray is in; after a step that crosses a corner exactly, the two cells beside it as well
      for (let q = 0; q < (tie ? 3 : 1); q++) {
        const cx = q === 1 ? ix - sx : ix,
          cz = q === 2 ? iz - sz : iz;
        if (cx < 0 || cz < 0 || cx >= cols || cz >= rows) continue;
        const b = bk[cz * cols + cx];
        if (b)
          for (i = 0; i < b.length; i++) {
            c = b[i];
            if (c.qs === gen || c === skip) continue;
            c.qs = gen;
            if (!asc && !(c.h > 0.02)) continue;
            t = boxT(c, ox, oy, oz, dx, dy, dz, best, ye);
            if (t < best && ((best = t), any)) return best;
          }
      }
      const nt = nx < nz ? nx : nz;
      if (!(nt <= best) || nt === Infinity) break;
      tie = Math.abs(nx - nz) < 1e-9;
      if (tie) ((nx += tx), (nz += tz), (ix += sx), (iz += sz));
      else if (nx < nz) ((nx += tx), (ix += sx));
      else ((nz += tz), (iz += sz));
      // out of the grid and heading away: nothing left to visit
      if ((ix < 0 && sx <= 0) || (ix >= cols && sx >= 0) || (iz < 0 && sz <= 0) || (iz >= rows && sz >= 0)) break;
    }
    return best;
  }
  // nearest wall hit along a ray (direction need not be unit; t is in its units)
  function wallT(ox, oy, oz, dx, dy, dz, maxT, skip) {
    let best = rayHit(ox, oy, oz, dx, dy, dz, maxT, skip, false, ascentOn());
    // the floor
    if (dy < 0) {
      const t = -oy / dy;
      t < best && (best = t);
    }
    return best;
  }
  window.WALL_T = wallT;

  rayBlocked = function (e, t, o, a, n, r, s) {
    const dx = a - e,
      dy = n - t,
      dz = r - o;
    if (Math.hypot(dx, dy, dz) < 0.001) return !1;
    if (rayHit(e, t, o, dx, dy, dz, 1, s, true, false) < 1) return !0;
    // smoke volumes are big spheres; sampling is fine for them (and nothing to sample while none blocks sight)
    const smokes = world.smokes;
    let any = !1;
    for (let k = 0; k < smokes.length; k++) if (smokes[k].blocksVision) any = !0;
    if (!any) return !1;
    const d = Math.hypot(dx, dy, dz),
      h = Math.max(2, Math.ceil(d / 0.8));
    for (let k = 1; k < h; k++) {
      const f = k / h,
        x = e + dx * f,
        y = t + dy * f,
        z = o + dz * f;
      for (const m of smokes) if (m.blocksVision && y < m.y + m.r && dist2(x, z, m.x, m.z) < m.r * m.r) return !0;
    }
    return !1;
  };

  actorHitscan = function (e, t, o, a, n) {
    let r = null,
      s = a.range;
    // where does this exact shot line hit a wall?
    const wall = wallT(t.x, t.y, t.z, o.x, o.y, o.z, s);
    for (const q of world.actors) {
      if (!q.alive || q.team === e.team || q === e) continue;
      const u = new T.Vector3(q.pos.x - t.x, q.y + 0.95 * BODY_K - t.y, q.pos.z - t.z).dot(o);
      if (u < 0 || u > s || u > wall) continue;
      const i = o.clone().multiplyScalar(u).add(t),
        l = i.y - (q.y + (q.crouch ? 0.74 : 0.95) * BODY_K),
        c = Math.hypot(i.x - q.pos.x, i.z - q.pos.z),
        d = q.y + (q.crouch ? 1.47 : 1.86) * BODY_K,
        h = Math.hypot(i.x - q.pos.x, i.y - d, i.z - q.pos.z) < 0.17 * BODY_K;
      (h || (c < 0.56 * BODY_K && Math.abs(l) < (q.crouch ? 0.64 : 0.75) * BODY_K)) && ((r = { e: q, head: h, t: u }), (s = u));
    }
    if (!r) s = Math.min(s, wall);
    if (DOMES.length) {
      const k = domeBlockT(t, o, s);
      k < s && ((r = null), (s = k));
    }
    SHOOTABLES.length && shootableHit(t, o, s, e, a.dmg) && (r = null);
    if (r) {
      let m = a.dmg * (r.head ? a.hs : 1);
      const f = Math.max(0.55, 1 - (r.t / a.range) * 0.45),
        g = "function" == typeof isAI && isAI(e) ? 0.5 * diffTune().dmg : 1;
      dealDamage(r.e, m * f * g, r.head, e);
      "me" === e.ctrl && (world.stats.hits++, hitMarker(r.head), SFX.hit(r.head));
    } else {
      const x = t.x + o.x * s,
        y = t.y + o.y * s,
        z = t.z + o.z * s;
      pushFX(FX.IMPACT, x, y, z, 0);
      "me" === e.ctrl && impactSpark(x, y, z, 16767392);
    }
  };

  // legacy single-player path (range / old bots)
  hitscan = function (e, t, o, a) {
    let n = null,
      r = o.range;
    const wall = wallT(e.x, e.y, e.z, t.x, t.y, t.z, r);
    let hitC = null;
    if (wall < r) for (const c of COLLIDERS) if (boxT(c, e.x, e.y, e.z, t.x, t.y, t.z, wall + 1e-3) <= wall + 1e-4) { hitC = c; break; }
    for (const q of otherFighters()) {
      if (!q.alive || q.team === player.team) continue;
      const u = new T.Vector3(q.pos.x - e.x, q.y + 0.95 * BODY_K - e.y, q.pos.z - e.z).dot(t);
      if (u < 0 || u > r || u > wall) continue;
      const s = t.clone().multiplyScalar(u).add(e),
        i = s.y - (q.y + (q.crouch ? 0.74 : 0.95) * BODY_K),
        l = Math.hypot(s.x - q.pos.x, s.z - q.pos.z),
        c = q.y + (q.crouch ? 1.47 : 1.86) * BODY_K,
        d = Math.hypot(s.x - q.pos.x, s.y - c, s.z - q.pos.z) < 0.17 * BODY_K;
      (d || (l < 0.56 * BODY_K && Math.abs(i) < (q.crouch ? 0.64 : 0.75) * BODY_K)) && ((n = { e: q, head: d, t: u }), (r = u));
    }
    if (!n && wall < o.range) {
      hitC && hitC.destructible && ((hitC.hp -= o.dmg), hitC.hp <= 0 && destroyCollider(hitC));
      return void impactSpark(e.x + t.x * wall, e.y + t.y * wall, e.z + t.z * wall, 10135480);
    }
    if (n) {
      const k = n.t > 0.62 * o.range ? 0.72 : 1;
      damageEntity(n.e, o.dmg * k * (n.head ? o.hs : 1), n.head, "player");
      world.stats.hits++;
      impactSpark(n.e.pos.x, n.e.y + (n.head ? 1.86 * BODY_K : 1), n.e.pos.z, n.head ? 16726862 : 16757575);
      hitMarker(n.head);
    }
  };

  // ── bodies: never end a step inside a collider ──
  function unstick(a) {
    if (!a || !a.alive || !a.pos) return;
    const y = a.y || 0;
    for (let pass = 0; pass < 3; pass++) {
      let moved = !1;
      let near;
      if (window.ASCENT_TRIAL && ASCENT_TRIAL.active && CUR_MAP_KEY === 'ascent_trial') {
        near = ASCENT_TRIAL.nearby(a.pos.x, a.pos.z, PR + 0.1);
      } else {
        // Preserve the regular maps' grid and Ascent's vertical spatial index.
        (!CHASH.dirty && CHASH.buckets) || chashBuild();
        const m = PR + 0.1,
          c0 = Math.max(0, Math.floor((a.pos.x - m - CHASH.minX) / CHASH.cell)),
          c1 = Math.min(CHASH.cols - 1, Math.floor((a.pos.x + m - CHASH.minX) / CHASH.cell)),
          r0 = Math.max(0, Math.floor((a.pos.z - m - CHASH.minZ) / CHASH.cell)),
          r1 = Math.min(CHASH.rows - 1, Math.floor((a.pos.z + m - CHASH.minZ) / CHASH.cell));
        near = [];
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const bk = CHASH.buckets[r * CHASH.cols + c]; if (bk) for (let i = 0; i < bk.length; i++) near.includes(bk[i]) || near.push(bk[i]); }
      }
      for (const c of near) {
        if (!(c.h > y + STEP_H) || c.h < 0.3 || (c.y0 && y + 2.3 <= c.y0)) continue; // things you can step onto are fine (and floors overhead)
        const px = a.pos.x,
          pz = a.pos.z;
        // overlap of the body core (a bit smaller than the move radius) with the box
        const r = PR * 0.6;
        if (px + r <= c.minX || px - r >= c.maxX || pz + r <= c.minZ || pz - r >= c.maxZ) continue;
        const pushes = [
          [c.minX - PR - 0.01 - px, 0],
          [c.maxX + PR + 0.01 - px, 0],
          [0, c.minZ - PR - 0.01 - pz],
          [0, c.maxZ + PR + 0.01 - pz],
        ].sort((u, v) => Math.abs(u[0] + u[1]) - Math.abs(v[0] + v[1]));
        // take the shortest push that lands somewhere free
        for (const [dx, dz] of pushes) {
          if (!collideXZ(px + dx, pz + dz, y, PR * 0.9)) {
            a.pos.x += dx;
            a.pos.z += dz;
            moved = !0;
            break;
          }
        }
        if (moved) break;
      }
      if (!moved) break;
    }
  }
  window.UNSTICK = unstick;
  const _ns = netStep;
  netStep = function () {
    const r = _ns.apply(this, arguments);
    try {
      if (world.actors && world.actors.length) {
        if (isHost()) for (const a of world.actors) a._zip || unstick(a);
        else {
          const me = myActor();
          me && !me._zip && unstick(me);
        }
      }
    } catch (e) {}
    return r;
  };

  // ── props that look solid at leg height but have no collider ──
  function ghostScan() {
    return scanSlice(0.4, 1.1, !1) + scanSlice(1.1, 1.7, !0);
  }
  function scanSlice(y0, y1, needSupport) {
    const b = MAP.bounds,
      PX = 0.35,
      W = Math.ceil((b.maxX - b.minX) / PX),
      H = Math.ceil((b.maxZ - b.minZ) / PX);
    const cam = new T.OrthographicCamera(b.minX, b.maxX, -b.minZ, -b.maxZ, 1, 400);
    cam.position.set(0, 200, 0);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const rt = new T.WebGLRenderTarget(W, H),
      hidden = [];
    scene.traverse((o) => {
      const skip = (o.userData && (o.userData.mapDetail || o.userData.actor || o.userData.gim)) || o === floor || (o.isMesh && o.material && (o.material.transparent || o.material.side === T.BackSide)) || o.isSprite || o.isPoints || o.isLine;
      skip && o.visible && ((o.visible = !1), hidden.push(o));
    });
    const bg = scene.background,
      fog = scene.fog,
      pr = renderer.getPixelRatio(),
      ov = scene.overrideMaterial,
      clip = renderer.clippingPlanes;
    scene.background = new T.Color(0);
    scene.fog = null;
    scene.overrideMaterial = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide });
    renderer.clippingPlanes = [new T.Plane(new T.Vector3(0, 1, 0), -y0), new T.Plane(new T.Vector3(0, -1, 0), y1)];
    renderer.setPixelRatio(1);
    const px = new Uint8Array(W * H * 4);
    try {
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    } finally {
      renderer.setRenderTarget(null);
      renderer.clippingPlanes = clip;
      scene.overrideMaterial = ov;
      scene.background = bg;
      scene.fog = fog;
      renderer.setPixelRatio(pr);
      hidden.forEach((o) => (o.visible = !0));
      rt.dispose();
    }
    const covered = new Uint8Array(W * H);
    for (const c of COLLIDERS) {
      if (c.h < 0.4) continue;
      const x0 = Math.floor((c.minX - b.minX) / PX) - 1,
        x1 = Math.ceil((c.maxX - b.minX) / PX) + 1,
        z0 = Math.floor((c.minZ - b.minZ) / PX) - 1,
        z1 = Math.ceil((c.maxZ - b.minZ) / PX) + 1;
      for (let z = Math.max(0, z0); z < Math.min(H, z1); z++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) covered[z * W + x] = 1;
    }
    const ghost = new Uint8Array(W * H);
    // slices of tapered shapes come out as thin broken rings: grow them by a pixel
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!(px[(y * W + x) * 4] > 60)) continue;
        const zi = H - 1 - y;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              zz = zi + dz;
            xx >= 0 && zz >= 0 && xx < W && zz < H && !covered[zz * W + xx] && (ghost[zz * W + xx] = 1);
          }
      }
    const seen = new Uint8Array(W * H),
      rc = new T.Raycaster();
    rc.camera = camera;
    const keepClear = [...MAP.sites, MAP.attackSpawn, MAP.defendSpawn];
    let added = 0;
    for (let i = 0; i < W * H; i++) {
      if (!ghost[i] || seen[i]) continue;
      const st = [i];
      seen[i] = 1;
      let n = 0,
        x0 = 1e9,
        x1 = -1,
        z0 = 1e9,
        z1 = -1;
      while (st.length) {
        const j = st.pop(),
          x = j % W,
          z = (j / W) | 0;
        n++;
        x < x0 && (x0 = x);
        x > x1 && (x1 = x);
        z < z0 && (z0 = z);
        z > z1 && (z1 = z);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const xx = x + dx,
            zz = z + dz,
            q = zz * W + xx;
          xx >= 0 && zz >= 0 && xx < W && zz < H && ghost[q] && !seen[q] && ((seen[q] = 1), st.push(q));
        }
      }
      const w = (x1 - x0 - 1) * PX,
        d = (z1 - z0 - 1) * PX;
      if (n < 3 || w < 0.6 || d < 0.6 || w > 14 || d > 14) continue;
      const cx = b.minX + ((x0 + x1 + 1) / 2) * PX,
        cz = b.minZ + ((z0 + z1 + 1) / 2) * PX;
      if (keepClear.some((p) => p && Math.hypot(p.x - cx, p.z - cz) < 3)) continue;
      // how tall is it? low mounds you can step on stay walkable
      rc.set(new T.Vector3(cx, 40, cz), new T.Vector3(0, -1, 0));
      const hit = rc.intersectObjects(scene.children, !0).find((h) => h.object.isMesh && !(h.object.userData && (h.object.userData.mapDetail || h.object.userData.actor)) && h.object !== floor && !h.object.material.transparent);
      const top = hit ? Math.min(hit.point.y, 6) : 1.2;
      if (top < 0.9) continue;
      // head-height pass: only canopies that stand on something (a trunk or post collider)
      if (needSupport && !COLLIDERS.some((c) => c.h > 0.9 && c.minX < cx + 0.7 && c.maxX > cx - 0.7 && c.minZ < cz + 0.7 && c.maxZ > cz - 0.7 && c.maxX - c.minX < 2 && c.maxZ - c.minZ < 2)) continue;
      // trees and cones taper, so use a smaller footprint than the widest slice
      const s = needSupport ? 0.6 : 0.8;
      COLLIDERS.push({ minX: cx - (w * s) / 2, maxX: cx + (w * s) / 2, minZ: cz - (d * s) / 2, maxZ: cz + (d * s) / 2, h: Math.max(1.2, top), mesh: null, hp: 1 / 0, destructible: !1, temp: !1, decor: !0, ghost: !0 });
      added++;
    }
    if (added) {
      CHASH.dirty = !0;
      try {
        buildGrid();
      } catch (e) {}
    }
    return added;
  }
  // the scan costs a couple of renders, so it runs once per map load when a
  // round actually starts (not for title-screen backgrounds)
  let pending = !0;
  function ensureScan() {
    if (!pending) return;
    pending = !1;
    try {
      window.GHOST_COLLIDERS = ghostScan();
    } catch (e) {
      console.warn("ghostScan", e);
    }
  }
  window.ENSURE_GHOST_SCAN = ensureScan;
  const _lm = loadMap;
  loadMap = function () {
    const r = _lm.apply(this, arguments);
    r !== !1 && (pending = !0);
    return r;
  };
  const _sr = startRound;
  startRound = function () {
    ensureScan();
    return _sr.apply(this, arguments);
  };
})();
