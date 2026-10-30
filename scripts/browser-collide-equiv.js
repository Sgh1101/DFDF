const fs = require("node:fs"), assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Collider queries through the spatial hash give exactly what a pass over every collider gives. The queries are groundAt,
// the casing ground query (groundTop with no margin), wallT (WALL_T) and rayBlocked. For each map the reference is the old
// brute-force code written out here; many random points and rays are compared (also from outside the grid, along an axis,
// straight up and down, from inside a box, at box corners, with a box to skip, with smoke), again after colliders are
// added, moved and removed with the hash live, and on the maps whose walls and doors move (Shift Arena, the train, the
// hospital) every second of a running match. A second check counts the colliders the queries walk: none of them may loop over
// the whole list (COLLIDERS[Symbol.iterator] is counted). Headless SwiftShader only; no timing is compared.
// DFDF_EQUIV_N (default 1500) points and rays per round.
const N = Number(process.env.DFDF_EQUIV_N) || 1500;
const HELPERS = () => {
  // the reference: the plain slab test, the plain loops over every collider
  window.__ref = {
    box(c, ox, oy, oz, dx, dy, dz, t1, ye) {
      let lo = 0, hi = t1;
      for (const [o, d, mn, mx] of [[ox, dx, c.minX, c.maxX], [oy, dy, (c.y0 || 0) - ye, c.h], [oz, dz, c.minZ, c.maxZ]]) {
        if (Math.abs(d) < 1e-9) { if (o <= mn || o >= mx) return Infinity; continue; }
        let a = (mn - o) / d, b = (mx - o) / d;
        if (a > b) [a, b] = [b, a];
        a > lo && (lo = a); b < hi && (hi = b);
        if (lo > hi) return Infinity;
      }
      return lo;
    },
    wall(ox, oy, oz, dx, dy, dz, maxT, skip, asc) {
      let best = maxT;
      for (const c of COLLIDERS) { if (c === skip || (!asc && !(c.h > 0.02))) continue; const t = __ref.box(c, ox, oy, oz, dx, dy, dz, best, asc ? 0 : 0.01); t < best && (best = t); }
      if (dy < 0) { const t = -oy / dy; t < best && (best = t); }
      return best;
    },
    blocked(e, t, o, a, n, r, s, asc) {
      const dx = a - e, dy = n - t, dz = r - o, d = Math.hypot(dx, dy, dz);
      if (!asc && d < 0.001) return false;
      if (asc) { if (__ref.wall(e, t, o, dx, dy, dz, 1, s, true) < 1) return true; }
      else for (const c of COLLIDERS) { if (c === s || !(c.h > 0.02)) continue; if (__ref.box(c, e, t, o, dx, dy, dz, 1, 0.01) < 1) return true; }
      if (asc) {
        for (const m of world.smokes) if (m.blocksVision) { const k = Math.ceil(d / 0.8); for (let i = 1; i < k; i++) { const f = i / k; if (t + dy * f < m.y + m.r && dist2(e + dx * f, o + dz * f, m.x, m.z) < m.r * m.r) return true; } }
        return false;
      }
      const h = Math.max(2, Math.ceil(d / 0.8));
      for (let k = 1; k < h; k++) { const f = k / h, x = e + dx * f, y = t + dy * f, z = o + dz * f; for (const m of world.smokes) if (m.blocksVision && y < m.y + m.r && dist2(x, z, m.x, m.z) < m.r * m.r) return true; }
      return false;
    },
    ground(x, z, y, m, tol) { let g = 0; for (const c of COLLIDERS) c.h <= y + tol && c.h > g && x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m && (g = c.h); return g; },
  };
  let seed = 424242;
  window.__rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // one round of random queries against the reference; returns the counts
  window.__round = (n, label) => {
    const R = __rnd, B = MAP.bounds, asc = !!(window.ASCENT_TRIAL && ASCENT_TRIAL.active && CUR_MAP_KEY === "ascent_trial");
    const X = (w) => B.minX - w + R() * (B.maxX - B.minX + 2 * w), Z = (w) => B.minZ - w + R() * (B.maxZ - B.minZ + 2 * w);
    const cs = COLLIDERS, pick = () => cs[Math.floor(R() * cs.length)];
    const bad = { ground: 0, casing: 0, wall: 0, blocked: 0 }, seen = { hitWall: 0, blocked: 0, ground: 0 };
    const fail = [];
    for (let i = 0; i < n; i++) {
      // points: on the map, a little outside it, far outside it, and on the edges of boxes (the margins matter there)
      const k = i % 4, c0 = pick();
      let x = k === 0 ? X(0) : k === 1 ? X(10) : k === 2 ? X(40) : (R() < 0.5 ? c0.minX : c0.maxX) + (R() - 0.5) * 1.6, z = k === 0 ? Z(0) : k === 1 ? Z(10) : k === 2 ? Z(40) : (R() < 0.5 ? c0.minZ : c0.maxZ) + (R() - 0.5) * 1.6;
      const y = R() * 12 - 0.5;
      const g = groundAt(x, z, y), rg = __ref.ground(x, z, y, PR, STEP_H);
      g !== rg && (bad.ground++, fail.length < 4 && fail.push(["ground", x, z, y, g, rg]));
      g > 0 && seen.ground++;
      const g2 = groundTop(x, z, y + 0.1, 0, 0.05), rg2 = __ref.ground(x, z, y + 0.1, 0, 0.05);
      g2 !== rg2 && (bad.casing++, fail.length < 4 && fail.push(["casing", x, z, y, g2, rg2]));
      // rays
      let ox = k === 3 ? c0.minX + R() * (c0.maxX - c0.minX) : X(k === 2 ? 30 : 0), oz = k === 3 ? c0.minZ + R() * (c0.maxZ - c0.minZ) : Z(k === 2 ? 30 : 0), oy = 0.2 + R() * 7;
      if (k === 3) oy = (c0.y0 || 0) + R() * (c0.h - (c0.y0 || 0));
      const len = [1, 4, 15, 60, 160][Math.floor(R() * 5)] * (0.3 + R()), a = R() * 6.283185, p = (R() - 0.5) * 0.7;
      let dx = Math.cos(a) * Math.cos(p) * len, dz = Math.sin(a) * Math.cos(p) * len, dy = Math.sin(p) * len;
      const mode = Math.floor(R() * 10);
      if (mode === 0) dx = 0; else if (mode === 1) dz = 0; else if (mode === 2) dx = dz = 0; else if (mode === 3) dy = 0;
      else if (mode === 4) { const t = pick(), cx = R() < 0.5 ? t.minX : t.maxX, cz = R() < 0.5 ? t.minZ : t.maxZ; dx = cx - ox; dz = cz - oz; dy = (t.h * R()) - oy; }
      else if (mode === 5) { dx = Math.round(dx / 8) * 8; dz = 8 * Math.round(R() * 6 - 3); }
      else if (mode === 6) { // exactly through a corner of four hash cells (and so on to the next ones)
        const i = Math.floor(R() * (CHASH.cols - 2)) + 1, j = Math.floor(R() * (CHASH.rows - 2)) + 1, sx = R() < 0.5 ? -1 : 1, sz = R() < 0.5 ? -1 : 1, L = 8 * (1 + Math.floor(R() * 8));
        dx = sx * L; dz = sz * L; ox = CHASH.minX + i * CHASH.cell - dx * 0.25; oz = CHASH.minZ + j * CHASH.cell - dz * 0.25; dy = (R() - 0.5) * 8;
      } else if (mode === 7) { // along a cell edge
        const i = Math.floor(R() * (CHASH.cols - 2)) + 1; ox = CHASH.minX + i * CHASH.cell; dx = 0; dz = (R() < 0.5 ? -1 : 1) * (10 + R() * 100);
      }
      const skip = R() < 0.15 ? pick() : undefined;
      const wt = WALL_T(ox, oy, oz, dx, dy, dz, 1, skip), rw = __ref.wall(ox, oy, oz, dx, dy, dz, 1, skip, asc);
      Math.abs(wt - rw) > 1e-9 && !(wt === rw) && (bad.wall++, fail.length < 4 && fail.push(["wall", ox, oy, oz, dx, dy, dz, wt, rw]));
      rw < 1 && seen.hitWall++;
      const wt2 = WALL_T(ox, oy, oz, dx * 3, dy * 3, dz * 3, 1.7, skip), rw2 = __ref.wall(ox, oy, oz, dx * 3, dy * 3, dz * 3, 1.7, skip, asc);
      Math.abs(wt2 - rw2) > 1e-9 && !(wt2 === rw2) && (bad.wall++, fail.length < 4 && fail.push(["wall3", ox, oy, oz, dx, dy, dz, wt2, rw2]));
      const bl = rayBlocked(ox, oy, oz, ox + dx, oy + dy, oz + dz, skip), rb = __ref.blocked(ox, oy, oz, ox + dx, oy + dy, oz + dz, skip, asc);
      bl !== rb && (bad.blocked++, fail.length < 4 && fail.push(["blocked", ox, oy, oz, dx, dy, dz, bl, rb]));
      rb && seen.blocked++;
    }
    return { label, n, asc, colliders: cs.length, bad, seen, fail };
  };
};
(async () => {
  const f = await fixture(), results = [];
  fs.mkdirSync("test-results", { recursive: true });
  const check = (r) => { console.log(JSON.stringify({ ...r, fail: r.fail.slice(0, 2) })); results.push(r); assert.deepEqual(r.bad, { ground: 0, casing: 0, wall: 0, blocked: 0 }, r.label + ": the hash queries agree with the plain loops: " + JSON.stringify(r.fail)); assert.ok(r.seen.hitWall > 30 && r.seen.ground > 30, r.label + ": the queries hit something often enough to mean anything " + JSON.stringify(r.seen)); };
  // how many colliders do the queries walk: counts COLLIDERS[Symbol.iterator] while 400 of each query run
  const WALK = () => {
    const R = __rnd, B = MAP.bounds, cs = COLLIDERS;
    let walked = 0; const it = Array.prototype[Symbol.iterator];
    cs[Symbol.iterator] = function* () { for (let i = 0; i < this.length; i++) { walked++; yield this[i]; } };
    try {
      for (let i = 0; i < 400; i++) {
        const x = B.minX + R() * (B.maxX - B.minX), z = B.minZ + R() * (B.maxZ - B.minZ), a = R() * 6.28;
        groundAt(x, z, 3); groundTop(x, z, 3, 0, 0.05); WALL_T(x, 1.5, z, Math.cos(a) * 40, 0, Math.sin(a) * 40, 1); rayBlocked(x, 1.5, z, x + Math.cos(a) * 30, 1.2, z + Math.sin(a) * 30);
      }
    } finally { delete cs[Symbol.iterator]; }
    return { walked, colliders: cs.length, calls: 1600 };
  };
  const mutate = (page, label, n) => page.evaluate(([label, n]) => {
    const R = __rnd, cs = COLLIDERS, out = [];
    // doors and rising walls: heights change, nothing else
    for (let i = 0; i < 25; i++) { const c = cs[Math.floor(R() * cs.length)]; c.__h0 === undefined && (c.__h0 = c.h); c.h = R() < 0.5 ? 0 : c.__h0; }
    // ability walls and the like: boxes added with the hash live (the engine adds them to their cells one by one)
    const B = MAP.bounds, made = [];
    for (let i = 0; i < 12; i++) made.push(addBox(B.minX + 8 + R() * (B.maxX - B.minX - 16), B.minZ + 8 + R() * (B.maxZ - B.minZ - 16), 1 + R() * 12, 1 + R() * 12, 1 + R() * 5, matWall(), { hp: 300, temp: false }));
    for (let i = 0; i < 3; i++) made.push(addBox(B.maxX - 1 + R() * 6, B.minZ + R() * 40, 8, 8, 3, matWall(), {}));
    out.push(__round(n, label + " + added boxes"));
    // a box that moves (the wall ability sets new extents and marks the hash dirty)
    for (const c of made.slice(0, 6)) { const dx = R() * 20 - 10, dz = R() * 20 - 10; c.minX += dx; c.maxX += dx; c.minZ += dz; c.maxZ += dz; }
    CHASH.dirty = true;
    out.push(__round(n, label + " + moved boxes"));
    // removed ones
    for (const c of made.slice(0, 5)) destroyCollider(c);
    for (let i = 0; i < 4; i++) cs.splice(Math.floor(R() * cs.length), 1);
    CHASH.dirty = true;
    out.push(__round(n, label + " + removed boxes"));
    // smoke
    world.smokes.length = 0;
    for (let i = 0; i < 4; i++) world.smokes.push({ x: B.minX + R() * (B.maxX - B.minX), y: 0, z: B.minZ + R() * (B.maxZ - B.minZ), r: 3 + R() * 5, blocksVision: true, t: 5 });
    out.push(__round(n, label + " + smoke"));
    world.smokes.length = 0;
    return out;
  }, [label, n]);
  try {
    // ── static maps: before and after changes with the hash live ──
    {
      const page = await f.page("equiv1", { width: 800, height: 600 });
      await page.evaluate(HELPERS);
      for (const key of ["garden", "rooftops", "pogu"]) {
        await page.evaluate((key) => { loadMap(key); chashBuild(); }, key);
        check(await page.evaluate(([n, key]) => __round(n, key), [N, key]));
        for (const r of await mutate(page, key, Math.floor(N / 2))) check(r);
        const w = await page.evaluate(WALK); console.log(key, "walked", JSON.stringify(w));
        assert.ok(w.walked < w.calls, key + ": the queries do not loop over the colliders: " + JSON.stringify(w));
      }
      await page.context().close();
    }
    // ── maps whose colliders move: every second of a running match ──
    for (const key of ["shift", "train", "hospital"]) {
      const page = await f.page("equiv" + key, { width: 800, height: 600 });
      await page.evaluate(HELPERS);
      await page.evaluate((key) => { titleCam = () => {}; room.mode = "std"; room.map = key; startGame(AGENTS[0], false); }, key);
      await page.waitForFunction((key) => CUR_MAP_KEY === key && !!myActor() && world.actors.length >= 6, key, { timeout: 120000 });
      const run = await page.evaluate(async ([n, key]) => {
        closeShop(); checkRoundEnd = function () {}; render = () => {}; for (const a of world.actors) a.invuln = 1e9;
        ADMIN.freezeAI = true;
        const out = [], sig = () => { let s = 0, k = 0; for (const c of COLLIDERS) { s += c.h * (1 + (k++ % 7)); } return Math.round(s * 100) + ":" + COLLIDERS.length; };
        let last = "", changes = 0, builds = 0;
        const cb = chashBuild; window.chashBuild = function () { builds++; return cb.apply(this, arguments); };
        for (let sec = 0; sec < 50; sec++) {
          for (let i = 0; i < 20; i++) { world.phase = "live"; world.roundTime = 999; step(0.05); }
          const s = sig(); s !== last && changes++; last = s;
          out.push(__round(n, key + " t=" + sec));
        }
        window.chashBuild = cb;
        return { out, changes, builds };
      }, [Math.floor(N / 3), key]);
      for (const r of run.out) { assert.deepEqual(r.bad, { ground: 0, casing: 0, wall: 0, blocked: 0 }, r.label + ": " + JSON.stringify(r.fail)); }
      const hits = run.out.reduce((s, r) => s + r.seen.hitWall, 0);
      console.log(key, "50 s of a match: colliders changed", run.changes, "times, hash rebuilt", run.builds, "times, wall hits compared", hits);
      results.push({ label: key + " running", changes: run.changes, builds: run.builds });
      assert.ok(hits > 200, key + ": rays hit walls");
      if (key !== "hospital") assert.ok(run.changes >= 3, key + ": the colliders really moved during the run (" + run.changes + " changes)");
      assert.ok(run.builds < 200, key + ": the hash is not rebuilt on every query (" + run.builds + ")");
      const w = await page.evaluate(WALK); console.log(key, "walked", JSON.stringify(w));
      assert.ok(w.walked < w.calls, key + ": the queries do not loop over the colliders: " + JSON.stringify(w));
      await page.context().close();
    }
    // ── 마크X발로: 44k colliders, its own box rules ──
    {
      const page = await f.page("equivascent", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
      await page.evaluate(HELPERS);
      await page.waitForFunction(() => VALORANT_PACK.status === "ready");
      await page.locator("#go-play").click();
      if (await page.locator("#sel-pick").isVisible()) await page.locator("#sel-pick").click();
      await page.locator("#sel-maps button").filter({ hasText: /^마크X발로$/ }).click();
      await page.waitForFunction(() => ASCENT_TRIAL.status === "ready");
      await page.locator("#sel-go").click({ timeout: 120000 });
      await page.waitForFunction(() => ASCENT_TRIAL.active && !!myActor(), null, { timeout: 120000 });
      check(await page.evaluate(([n]) => __round(n, "ascent"), [Math.floor(N / 3)]));
      for (const r of await mutate(page, "ascent", Math.floor(N / 6))) check(r);
      const w = await page.evaluate(WALK); console.log("ascent walked", JSON.stringify(w));
      assert.ok(w.walked < w.calls, "ascent: the queries do not loop over the colliders: " + JSON.stringify(w));
      await page.context().close();
    }
    assert.deepEqual(f.errors, []);
    fs.writeFileSync("test-results/collide-equiv.json", JSON.stringify(results, null, 2));
    console.log("collide-equiv: the hashed queries agree with the plain loops on every map, with colliders added, moved and removed, and during running matches");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
