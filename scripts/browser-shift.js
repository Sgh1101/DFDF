const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("shifter");
    await page.evaluate(() => { titleCam = () => {}; });
    const r = await page.evaluate(async () => {
      room.mode = "std"; room.map = "shift"; startGame(AGENTS[0], false); closeShop();
      const S = SHIFT_ARENA, M = MAPS.shift;
      const out = { key: CUR_MAP_KEY, walls: S.walls.length, listed: MAP_LIST.some((m) => m.key === "shift"), size: MAP_SIZE("shift"), cat: MAP_CAT("shift") };
      // one cell of the walk grid for a point, and a flood fill over it
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
        out.phases.push({ p, up: S.walls.filter((w) => w.up).length, colliders: COLLIDERS.filter((c) => c.h > 3.5).length, unreachable: bad });
      }
      // the clock: a change every 22 s of a live round; the warning glows the barriers about to move
      S.setPhase(0, true); world.phase = "live"; S.t = 0;
      const seen = [];
      for (let i = 0; i < 70; i++) { netStep(1); seen.push(S.p); }
      out.clock = { phases: [...new Set(seen)], at3: seen[22], at46: seen[45] };
      S.setPhase(0, true); S.t = PHASE_S_FOR_TEST(S) - 2;
      netStep(0.1);
      out.warn = S.mats.slice(0, 3).some((m) => m.emissiveIntensity > 0);
      // a round start puts it back; a guest takes the host's word
      S.setPhase(2, true); startRound(); out.afterRound = S.p;
      const mode = NET.mode; NET.mode = "client"; NET.onEvent({ t: "shift", p: 1, n: 12 }); out.guest = { p: S.p, t: Math.round(S.t) }; NET.mode = mode;
      // the hud
      out.hud = !!document.getElementById("shift-hud");
      // another map takes the barriers away
      room.map = "glacier"; startGame(AGENTS[0], false); closeShop();
      out.gone = { key: CUR_MAP_KEY, walls: S.walls.length, meshes: S.meshes.length };
      return out;
      function PHASE_S_FOR_TEST(S) { return S.PHASE_S; }
    });
    console.log(JSON.stringify(r));
    assert.equal(r.key, "shift"); assert.equal(r.walls, 8); assert.equal(r.listed, true); assert.equal(r.size, 3); assert.equal(r.cat, "small");
    for (const p of r.phases) { assert.deepEqual(p.unreachable, [], "phase " + p.p + " reaches everything"); assert.ok(p.up >= 5 && p.up <= 6, "two of three sets stand in phase " + p.p); }
    assert.deepEqual(r.clock.phases, [0, 1, 2, 3]); assert.equal(r.clock.at3, 1); assert.equal(r.warn, true); assert.equal(r.afterRound, 0); assert.deepEqual(r.guest, { p: 1, t: 10 }); assert.equal(r.hud, true);
    assert.deepEqual(r.gone, { key: "glacier", walls: 0, meshes: 0 });
    assert.deepEqual(f.errors, []);
    console.log("shift arena: plan, reachability in every phase, clock, warning, round reset, guest sync and clean-up passed");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
