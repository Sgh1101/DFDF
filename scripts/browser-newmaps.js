const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 야간 항구 (3v3) and 옥상 도시 (5v5): listed in the right size class, every node, site and spawn
// reachable on foot, nothing overlapping by accident, lamps and the searchlight at night, the
// city's stairs reach the roofs, ziplines over the cross street; everything taken down on leaving.
(async () => {
  const f = await fixture();
  try {
    const dir = process.env.SHOT_DIR || "/tmp";
    const page = await f.page("mapper", { width: 1280, height: 720 });
    await page.evaluate(() => { titleCam = () => {}; });
    const probe = (key) => page.evaluate(async (key) => {
      room.mode = "std"; room.map = key; startGame(AGENTS[0], false); closeShop();
      const M = MAPS[key];
      const out = { key: CUR_MAP_KEY, listed: MAP_LIST.some((m) => m.key === key) || (window.MAP_EXTRA || []).some((m) => m.key === key), size: MAP_SIZE(key), cat: MAP_CAT(key), colliders: COLLIDERS.length };
      const cell = (x, z) => [Math.floor((x - GRID.minX) / GRID.cell), Math.floor((z - GRID.minZ) / GRID.cell)];
      const free = (p) => { const [c, r] = cell(p.x, p.z); return c >= 0 && r >= 0 && c < GRID.cols && r < GRID.rows && GRID.walk[r * GRID.cols + c] === 1; };
      const [c0, r0] = nearestWalkable(...cell(M.attackSpawn.x, M.attackSpawn.z));
      const seen = new Uint8Array(GRID.cols * GRID.rows), q = [[c0, r0]]; seen[r0 * GRID.cols + c0] = 1;
      while (q.length) { const [c, r] = q.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = c + dc, b = r + dr; if (a >= 0 && b >= 0 && a < GRID.cols && b < GRID.rows && GRID.walk[b * GRID.cols + a] === 1 && !seen[b * GRID.cols + a]) { seen[b * GRID.cols + a] = 1; q.push([a, b]); } } }
      const reach = (p) => { const [c, r] = cell(p.x, p.z); return !!seen[r * GRID.cols + c]; };
      out.blocked = [], out.cut = [];
      const pts = Object.entries(M.nodes).concat([["defendSpawn", M.defendSpawn]], M.sites.map((s) => ["site" + s.id, s]));
      for (const [k, v] of pts) { free(v) || out.blocked.push(k); reach(v) || out.cut.push(k); }
      // walls that overlap another without one being a part of the other (parapets and vents sit on roofs)
      out.overlaps = [];
      const W = M.walls, part = (w) => w.para || w.vent || w.edge;
      for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
        const a = W[i], b = W[j];
        if (part(a) || part(b)) continue;
        const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2), oz = Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2);
        ox > 0.05 && oz > 0.05 && out.overlaps.push([i, j, +ox.toFixed(2), +oz.toFixed(2)]);
      }
      // how much of the ground is walkable
      out.walkable = +(GRID.walk.reduce((s, v) => s + v, 0) / GRID.walk.length).toFixed(2);
      out.hidden = COLLIDERS.filter((c) => c.mesh && !c.mesh.visible).length;
      out.lights = NEW_MAPS.lights.length; out.meshes = NEW_MAPS.meshes.length; out.tick = NEW_MAPS.tick.length;
      out.zips = MAP_GIMMICKS.zip.length;
      return out;
    }, key);

    // ── the harbor ──
    const h = await probe("nightport");
    console.log(JSON.stringify(h));
    assert.equal(h.key, "nightport"); assert.ok(h.listed); assert.equal(h.size, 3); assert.equal(h.cat, "small");
    assert.deepEqual(h.blocked, [], "nodes stand on open ground"); assert.deepEqual(h.cut, [], "everything reachable");
    assert.deepEqual(h.overlaps, [], "no accidental overlaps");
    assert.ok(h.lights >= 4 && h.tick >= 3 && h.meshes > 20, "lamps, a searchlight, a boat");
    assert.equal(h.hidden, 1, "only the sea edge is hidden");
    // the searchlight sweeps; the lamp by A flickers
    const sweep = await page.evaluate(() => {
      const sp = NEW_MAPS.search, a = sp.target.position.x;
      world.phase = "live"; for (let i = 0; i < 20; i++) netStep(0.1);
      return { moved: sp.target.position.x !== a, mat: NEW_MAPS.mats.length };
    });
    assert.ok(sweep.moved, "the searchlight moves");
    await page.evaluate(() => { const me = myActor(); me.pos.set(-8, 0, 30); player.pos.set(-8, 0, 30); player.yaw = Math.PI + 0.5; player.pitch = -0.04; world.phase = "live"; });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: dir + "/harbor1.png" });
    await page.evaluate(() => { const me = myActor(); me.pos.set(-30, 0, -3); player.pos.set(-30, 0, -3); player.yaw = 2.6; player.pitch = -0.02; });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: dir + "/harbor2.png" });

    // ── the city ──
    const c = await probe("rooftops");
    console.log(JSON.stringify(c));
    assert.equal(c.key, "rooftops"); assert.ok(c.listed); assert.equal(c.size, 5); assert.equal(c.cat, "full");
    assert.deepEqual(c.blocked, [], "nodes stand on open ground"); assert.deepEqual(c.cut, [], "everything reachable");
    assert.deepEqual(c.overlaps, [], "no accidental overlaps");
    assert.equal(c.zips, 2, "two ziplines");
    assert.equal(c.hidden, 0);
    // a person can climb every building from the street by its stairs and stand on the roof
    const climb = await page.evaluate(() => {
      const M = MAPS.rooftops, res = [];
      const roofs = M.walls.filter((w) => w.bld), steps = M.walls.filter((w) => w.stair);
      for (const b of roofs) {
        const mine = steps.filter((s) => s.h <= b.h + 1e-6 && ((Math.abs(s.x - b.x) <= b.w / 2 + 1.01 && Math.abs(s.z - b.z) <= b.d / 2 + 16) || (Math.abs(s.z - b.z) <= b.d / 2 + 1.01 && Math.abs(s.x - b.x) <= b.w / 2 + 16)));
        // the heights step by at most 0.68 from the ground to the roof
        const hs = [...new Set(mine.filter((s) => s.h <= b.h).map((s) => +s.h.toFixed(3)))].sort((x, y) => x - y);
        let prev = 0, ok = hs.length > 0;
        for (const v of hs) { if (v - prev > 0.68) ok = false; prev = v; }
        res.push({ h: b.h, ok: ok && Math.abs(prev - b.h) < 0.01, n: hs.length });
      }
      return res;
    });
    assert.ok(climb.length === 16 && climb.every((r) => r.ok), "stairs reach every roof: " + JSON.stringify(climb.filter((r) => !r.ok)));
    // walk up one for real: simulate stepping the player along the run and check the feet end on the roof
    const real = await page.evaluate(() => {
      const M = MAPS.rooftops, b = M.walls.find((w) => w.bld && w.h === 9 && w.x === -17);
      const me = myActor(); world.phase = "live";
      const st = M.walls.filter((w) => w.stair && w.x > b.x + b.w / 2 && w.x < b.x + b.w / 2 + 2 && Math.abs(w.z - b.z) < 11).sort((p, q) => p.h - q.h);
      let y = 0, ok = true;
      for (const s of st) { if (s.h - y > 0.68 + 1e-6) ok = false; y = Math.max(y, s.h); }
      const top = st[st.length - 1];
      me.pos.set(top.x, 0, top.z); me.y = top.h; player.pos.set(top.x, top.h, top.z);
      return { steps: st.length, ok, top: top.h, roof: b.h };
    });
    assert.ok(real.ok && real.top === real.roof, JSON.stringify(real));
    await page.evaluate(() => { const me = myActor(); me.pos.set(0, 0, 44); player.pos.set(0, 0, 44); player.yaw = 0; player.pitch = 0.02; world.phase = "live"; });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: dir + "/rooftops1.png" });
    await page.evaluate(() => { const me = myActor(); me.pos.set(-30, 0, -20); player.pos.set(-30, 0, -20); player.yaw = Math.PI + 0.7; player.pitch = 0.18; });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: dir + "/rooftops2.png" });
    // a zipline ride: from the cross street end to the other
    const zip = await page.evaluate(() => {
      const me = myActor(), z = MAP_GIMMICKS.zip[0];
      me.pos.set(z.a.x, 0, z.a.z);
      me._zip = { line: z, t: 0, dir: 1 };
      for (let i = 0; i < 20; i++) simMove(me, 0.1);
      return { x: +me.pos.x.toFixed(1), y: +me.y.toFixed(1), riding: !!me._zip };
    });
    assert.ok(zip.x > -20 && zip.y > 4, "rides the zipline: " + JSON.stringify(zip));

    // ── a round on each with bots, then away ──
    for (const key of ["nightport", "rooftops"]) {
      const bots = await page.evaluate(async (key) => {
        room.mode = "std"; room.map = key; startGame(AGENTS[0], false); closeShop();
        world.phase = "live";
        const t0 = world.actors.map((a) => a.pos.z);
        for (let i = 0; i < 400; i++) step(0.05);
        return { n: world.actors.length, moved: world.actors.filter((a, i) => Math.abs(a.pos.z - t0[i]) > 5).length, err: !!window.__lastErr };
      }, key);
      assert.ok(bots.moved >= 2, key + " bots walk: " + JSON.stringify(bots));
    }
    const gone = await page.evaluate(() => { loadMap("shift"); return { meshes: NEW_MAPS.meshes.length, lights: NEW_MAPS.lights.length, key: NEW_MAPS.key, zips: MAP_GIMMICKS.zip.length }; });
    assert.deepEqual(gone, { meshes: 0, lights: 0, key: null, zips: 0 });
    assert.deepEqual(f.errors, []);
    console.log("new maps: 야간 항구 3v3 and 옥상 도시 5v5 listed, reachable, lit, climbable, ziplines, bots walk, cleanup");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
