const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 달리는 열차: listed as a 3v3 map; five bridge gates in three sets, one set shut at a time
// on a 20 s clock; every spot reachable whatever the gates; the world outside moves; a guest
// takes the host's word; a round start resets the bridges.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("rider", { width: 1280, height: 720 });
    await page.evaluate(() => { titleCam = () => {}; });
    const r = await page.evaluate(async () => {
      room.mode = "std"; room.map = "train"; startGame(AGENTS[0], false); closeShop();
      const S = TRAIN_MAP, M = MAPS.train;
      const out = { key: CUR_MAP_KEY, gates: S.gates.length, listed: MAP_LIST.some((m) => m.key === "train"), size: MAP_SIZE("train"), cat: MAP_CAT("train") };
      const cell = (x, z) => [Math.floor((x - GRID.minX) / GRID.cell), Math.floor((z - GRID.minZ) / GRID.cell)];
      const ok = (c, r) => c >= 0 && r >= 0 && c < GRID.cols && r < GRID.rows && GRID.walk[r * GRID.cols + c] === 1;
      const flood = (from) => {
        let [c0, r0] = cell(from.x, from.z); [c0, r0] = nearestWalkable(c0, r0);
        const seen = new Uint8Array(GRID.cols * GRID.rows), q = [[c0, r0]]; seen[r0 * GRID.cols + c0] = 1;
        while (q.length) { const [c, r] = q.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = c + dc, b = r + dr; if (ok(a, b) && !seen[b * GRID.cols + a]) { seen[b * GRID.cols + a] = 1; q.push([a, b]); } } }
        return (p) => { let [c, r] = cell(p.x, p.z); [c, r] = nearestWalkable(c, r); return !!seen[r * GRID.cols + c]; };
      };
      out.phases = [];
      for (let p = 0; p < 3; p++) {
        S.setPhase(p, true);
        const reach = flood(M.attackSpawn), bad = [];
        for (const [k, v] of Object.entries(M.nodes)) reach(v) || bad.push(k);
        reach(M.defendSpawn) || bad.push("defendSpawn");
        for (const s of M.sites) reach(s) || bad.push("site" + s.id);
        out.phases.push({ p, shut: S.gates.filter((g) => g.up).map((g) => g.z), unreachable: bad });
      }
      // the clock
      S.setPhase(0, true); world.phase = "live"; S.t = 0;
      const seen = [];
      for (let i = 0; i < 64; i++) { world.phase = "live"; netStep(1); seen.push(S.p); }
      out.clock = { at19: seen[18], at21: seen[20], at41: seen[40] };
      // the world goes by
      const z0 = S.movers[0].o.position.z, off0 = S.scroll[0].t.offset.y;
      netStep(0.5);
      out.moves = { mover: +(S.movers[0].o.position.z - z0).toFixed(2), scroll: S.scroll[0].t.offset.y !== off0 };
      // the edge walls are hidden, the containers coloured
      out.hiddenEdges = COLLIDERS.filter((c) => c.mesh && !c.mesh.visible && c.h === 6).length;
      // a round start resets; a guest takes the host's word
      S.setPhase(2, true); startRound(); out.afterRound = S.p;
      const mode = NET.mode; NET.mode = "client"; NET.onEvent({ t: "train", p: 1, n: 12 }); out.guest = { p: S.p, t: Math.round(S.t) }; NET.mode = mode;
      // the hud during a live round
      world.phase = "live"; netStep(0.016);
      out.hud = getComputedStyle(document.getElementById("train-hud")).display;
      // back to another map: everything taken down
      return out;
    });
    console.log(JSON.stringify(r));
    assert.equal(r.key, "train"); assert.equal(r.gates, 5); assert.ok(r.listed);
    assert.equal(r.size, 3); assert.equal(r.cat, "small");
    assert.deepEqual(r.phases.map((p) => p.shut), [[-24, 24], [-48, 48], [0]], "one set shut at a time");
    for (const p of r.phases) assert.deepEqual(p.unreachable, [], "everything reachable in phase " + p.p);
    assert.deepEqual(r.clock, { at19: 0, at21: 1, at41: 2 });
    assert.ok(r.moves.mover > 5 && r.moves.scroll, "the world outside moves");
    assert.equal(r.hiddenEdges, 4);
    assert.equal(r.afterRound, 0);
    assert.deepEqual(r.guest, { p: 1, t: 8 });
    assert.equal(r.hud, "block");
    // a look from the deck
    await page.evaluate(() => { const me = myActor(); me.pos.set(-8, 0, 40); player.pos.set(-8, 0, 40); player.yaw = 0.35; player.pitch = -0.05; world.phase = "live"; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/train.png" : "/tmp/train.png" });
    await page.evaluate(() => { player.pos.set(-6, 0, 2); player.yaw = -1.3; });
    await page.waitForTimeout(800);
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/train2.png" : "/tmp/train2.png" });
    // left in the middle of a live round (the pause menu's 나가기): the count goes, on the title and on the next map
    const count = await page.evaluate(() => {
      const el = document.getElementById("train-hud");
      world.phase = "live"; netStep(0.016);
      const out = { live: getComputedStyle(el).display };
      document.getElementById("pz-quit").click(); out.title = getComputedStyle(el).display;
      room.mode = "std"; room.map = "pogu"; startGame(AGENTS[0], false); closeShop();
      world.phase = "live"; netStep(0.016); out.next = getComputedStyle(el).display;
      return out;
    });
    assert.deepEqual(count, { live: "block", title: "none", next: "none" }, "the count leaves with the round");
    const gone = await page.evaluate(() => { loadMap("shift"); return { meshes: TRAIN_MAP.meshes.length, gates: TRAIN_MAP.gates.length }; });
    assert.deepEqual(gone, { meshes: 0, gates: 0 });
    assert.deepEqual(f.errors, []);
    console.log("runaway train: listed 3v3, bridges on a clock, all reachable, the world moves, guest sync, the count gone after leaving, cleanup");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
