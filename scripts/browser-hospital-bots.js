const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 폐병원, bots and the minimap on three floors: the path graph covers every floor and the four stairs, every
// post the bots can be given is reachable, a bot given a post on the second or third floor walks up the
// stairs, stands there and looks across the atrium, a plain round puts some bots above the ground, the
// minimap shows the floor you stand on (and not every wall of every floor), and the tag names floor and room.
(async () => {
  const f = await fixture();
  try {
    const dir = process.env.SHOT_DIR;
    const page = await f.page("hospbots", { width: 1280, height: 720 });
    await page.evaluate(() => { titleCam = () => {}; });
    await page.evaluate(() => { room.mode = "std"; room.map = "hospital"; startGame(AGENTS[0], false); closeShop(); });
    await page.waitForFunction(() => { world.phase = "live"; return !HOSPITAL.barriers.list && world.actors.length >= 10; }, null, { timeout: 20000 });

    // ── the graph ──
    const g = await page.evaluate(() => {
      const N = HOSPITAL_NAV, G = N.graph(), P = HOSPITAL_PLAN, R = P.rows, C = P.cols, out = { free: [0, 0, 0], reach: [0, 0, 0], posts: [], routes: [] };
      for (let n = 0; n < 3; n++) for (let i = 0; i < R * C; i++) { G.free[n * R * C + i] && out.free[n]++; G.reach[n * R * C + i] && out.reach[n]++; }
      const spawn = MAPS.hospital.attackSpawn, def = MAPS.hospital.defendSpawn;
      const at = (n, x, z) => ({ pos: { x, z }, y: n * 4 });
      const ids = (lv, c, r) => (lv * R + r) * C + c;
      const sample = [];
      for (const reg of N.posts.RINGS.concat(N.posts.BRIDGE)) { const cells = N.cellsOf(reg); out.regions = (out.regions || []).concat([[reg.join(","), cells.length]]); sample.push(cells[0], cells[cells.length >> 1], cells[cells.length - 1]); }
      for (const [lv, c, r] of sample) {
        const k = ids(lv, c, r), x = -60 + 2.5 * (c + 0.5), z = -40 + 2.5 * (r + 0.5);
        out.posts.push([lv, c, r, G.free[k], G.reach[k]]);
        const p = N.route(at(0, spawn.x, spawn.z), x, z, lv), q = N.route(at(lv, x, z), def.x, def.z, 0);
        const len = (a) => { let s = 0; for (let i = 1; i < a.length; i++) s += Math.hypot(a[i].x - a[i - 1].x, a[i].z - a[i - 1].z); return Math.round(s); };
        // no hop changes the height by more than a step or two: the floors change only through the stair points
        const jumps = (a) => { let bad = 0; for (let i = 1; i < a.length; i++) { const d = Math.hypot(a[i].x - a[i - 1].x, a[i].z - a[i - 1].z), dy = Math.abs(a[i].y - a[i - 1].y); if (dy > 1.1) bad++; } return bad; };
        out.routes.push({ lv, c, r, up: p && [p.length, len(p), jumps(p), p.filter((w) => w.st).length], down: q && [q.length, len(q), jumps(q), q.filter((w) => w.st).length] });
      }
      return out;
    });
    console.log(JSON.stringify(g));
    assert.ok(g.free[0] > 300 && g.free[1] > 300 && g.free[2] > 300, "free cells on every floor: " + g.free);
    for (const [name, n] of g.regions) assert.ok(n >= 4, "region " + name + " has free cells (" + n + ")");
    for (const [lv, c, r, free, reach] of g.posts) { assert.ok(free, "post " + [lv, c, r] + " is free"); assert.ok(reach, "post " + [lv, c, r] + " is reachable from the lot"); }
    for (const r of g.routes) {
      assert.ok(r.up && r.down, "a route up to and back down from the post " + [r.lv, r.c, r.r]);
      assert.equal(r.up[2], 0, "no gap in the way up to " + [r.lv, r.c, r.r]); assert.equal(r.down[2], 0, "no gap in the way down from " + [r.lv, r.c, r.r]);
      assert.ok(r.up[3] >= 6 * r.lv && r.down[3] >= 6 * r.lv, "the stairs are on the way (" + r.lv + "): " + r.up[3]);
      assert.ok(r.up[1] > 60 && r.up[1] < 330, "a sane length " + r.up[1]);
    }

    // ── a bot given a post walks there: floor 2 and floor 3, one from each side ──
    const walk = await page.evaluate(() => {
      const out = {}, ids = (lv, c, r) => (lv * 40 + r) * 48 + c;
      const run = (team, post, steps) => {
        // everyone else is rooted and blind: only this bot moves; it is blind too, so this is the walk alone, no fights
        const bots = world.actors.filter((a) => isAI(a) && a.alive);
        for (const a of bots) { a.root = 9999; a.blind = 9999; }
        const e = bots.find((a) => a.team === team);
        e.root = 0; e.blind = 9999; e.hasSpike = false;
        const sp = spawnPointFor(team, 2);
        e.pos.set(sp.x, 0, sp.z); e.y = 0; e.ai = freshAIState();
        const [lv, c, r] = post, x = -60 + 2.5 * (c + 0.5), z = -40 + 2.5 * (r + 0.5);
        e.ai._hs = { lv, x, z, look: Math.atan2(-(1.25 - x), -(3.75 - z)), dwell: 1e9, born: -1, t: -1, done: false };
        world.phase = "live"; world.over = false;
        let reached = -1, maxY = 0, stuck = 0, last = null, hold = 0;
        for (let i = 0; i < steps; i++) {
          world.phase = "live"; world.roundTime = 60;
          netStep(0.05);
          maxY = Math.max(maxY, e.y);
          const d = Math.hypot(e.pos.x - x, e.pos.z - z);
          if (reached < 0 && d < 3 && Math.abs(e.y - lv * 4) < 0.6) reached = i * 0.05;
          if (reached >= 0 && i * 0.05 > reached + 6) { hold = Math.hypot(e.pos.x - (last ? last.x : e.pos.x), e.pos.z - (last ? last.z : e.pos.z)); }
          if (reached >= 0 && !last && i * 0.05 > reached + 4) last = { x: e.pos.x, z: e.pos.z };
        }
        const faces = Math.abs((((Math.atan2(-(1.25 - x), -(3.75 - z)) - e.yaw) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        for (const a of bots) { a.root = 0; a.blind = 0; }
        return { reached, maxY: +maxY.toFixed(1), end: [+e.pos.x.toFixed(1), +e.y.toFixed(1), +e.pos.z.toFixed(1)], target: [x, lv * 4, z], held: +hold.toFixed(2), facing: +faces.toFixed(2), alive: e.alive };
      };
      const cell = (reg, k) => { const cells = HOSPITAL_NAV.cellsOf(reg); return cells[k < 0 ? cells.length + k : k]; };
      const N = HOSPITAL_NAV.posts;
      out.atkRing = run("atk", cell(N.RINGS[0], 2), 1700);
      out.defRing = run("def", cell(N.RINGS[1], -3), 1700);
      out.atkBridge = run("atk", cell(N.BRIDGE[0], 3), 2400);
      out.defBridge = run("def", cell(N.BRIDGE[0], -4), 2400);
      return out;
    });
    console.log(JSON.stringify(walk));
    for (const [k, v] of Object.entries(walk)) {
      assert.ok(v.reached >= 0, k + " got to its post: " + JSON.stringify(v));
      assert.ok(v.reached < 70, k + " in good time (" + v.reached + " s)");
      assert.ok(v.held < 1.5, k + " stands on its post (moved " + v.held + " m)");
      assert.ok(v.facing < 0.5, k + " looks across the atrium (off by " + v.facing + " rad)");
    }
    assert.ok(walk.atkBridge.maxY > 7.5 && walk.defBridge.maxY > 7.5, "the bridge is on the third floor");

    // ── a plain round: bots in the building above the ground (up to three rounds, the posts are drawn by chance) ──
    const round = await page.evaluate(() => {
      const bots = world.actors.filter((a) => isAI(a)), out = { rounds: 0, upstairs: 0, top: 0 };
      for (let round = 0; round < 3 && !out.upstairs; round++) {
        for (const a of bots) { a.root = 0; a.blind = 0; a.invuln = 0; }
        startRound(); world.phase = "live"; out.rounds++;
        const seen = new Set();
        for (let i = 0; i < 1500; i++) {
          world.phase = "live"; world.roundTime = Math.max(world.roundTime, 40); world.over = false;
          netStep(0.05);
          for (const a of bots) if (a.alive && Math.round(a.y / 4) > 0) { seen.add(a.id); out.top = Math.max(out.top, +a.y.toFixed(1)); }
        }
        out.upstairs = seen.size;
      }
      return out;
    });
    console.log("round", JSON.stringify(round));
    assert.ok(round.upstairs >= 1, "in a plain round some bot goes above the ground: " + JSON.stringify(round));

    // ── the minimap shows the floor you are on ──
    const mm = await page.evaluate(() => {
      const me = myActor(), out = {};
      for (const a of world.actors) { a.root = 9999; a.blind = 9999; }
      for (const lv of [0, 1, 2]) {
        const y = lv * 4;
        me.pos.set(-38.75, y, -8.75); me.y = y; player.pos.set(-38.75, y, -8.75); player.y = y;
        drawMini();
        const d = mctx.getImageData(0, 0, mini.width, mini.height).data;
        let wall = 0, collider = 0, h = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i] === 0x81 && d[i + 1] === 0x95 && d[i + 2] === 0xb0) wall++; if (d[i] === 0x2a && d[i + 1] === 0x34 && d[i + 2] === 0x44) collider++; h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0; }
        out[lv] = { wall, collider, h, hasFill: typeof mctx.fillRect === "function" && !Object.prototype.hasOwnProperty.call(mctx, "fillRect") };
      }
      return out;
    });
    console.log("minimap", JSON.stringify(mm));
    assert.equal(new Set([mm[0].h, mm[1].h, mm[2].h]).size, 3, "a different picture on each floor");
    for (const lv of [0, 1, 2]) { assert.ok(mm[lv].wall > 300, "walls of floor " + lv + " are drawn (" + mm[lv].wall + ")"); assert.ok(mm[lv].hasFill, "fillRect restored"); }

    // ── the floor and the room, named in the strip under the building ──
    const tags = await page.evaluate(() => {
      const me = myActor(), out = {};
      const put = (key, lv, x, z) => { me.pos.set(x, lv * 4, z); me.y = lv * 4; player.pos.set(x, lv * 4, z); player.y = lv * 4; out[key] = HOSPITAL_NAV.tag(); };
      put("or", 0, -38.75, -31.25); put("ward", 1, -38.75, -31.25); put("deck", 2, 0, -33); put("lobby", 0, 0, 36); put("atriumHole", 1, 1.25, 6);
      return out;
    });
    console.log("tags", JSON.stringify(tags));
    assert.equal(tags.or, "1층 · 수술실"); assert.equal(tags.ward, "2층 · 병동"); assert.equal(tags.deck, "3층 · 옥상 데크"); assert.equal(tags.lobby, "1층 · 로비"); assert.equal(tags.atriumHole, "2층 · 아트리움");

    // ── the round tactical map: the floor you stand on, not every slab drawn over each other ──
    const tac = await page.evaluate(() => {
      const me = myActor(), out = {};
      for (const lv of [0, 1, 2]) {
        me.pos.set(-38.75, lv * 4, -8.75); me.y = lv * 4; player.pos.set(-38.75, lv * 4, -8.75); player.y = lv * 4;
        drawTac();
        const cv = HOSPITAL_NAV.tacFloor(lv), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        let seen = 0, h = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { seen++; h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 3] * 7 + (i % 9973)) | 0; }
        out[lv] = { seen, h, share: seen / (d.length / 4) };
      }
      out.total = COLLIDERS.length;
      return out;
    });
    console.log("tactical", JSON.stringify(tac));
    for (const lv of [0, 1, 2]) { assert.ok(tac[lv].seen > 2000 && tac[lv].share < 0.35, "floor " + lv + " paints its own walls, not every slab (" + tac[lv].seen + " px, " + (tac[lv].share * 100).toFixed(1) + "% of the picture)"); }
    assert.equal(new Set([tac[0].h, tac[1].h, tac[2].h]).size, 3, "a different tactical picture on each floor");

    if (dir) {
      for (const [name, lv] of [["f1", 0], ["f2", 1], ["f3", 2]]) {
        await page.evaluate((lv) => { closeShop(); const me = myActor(); me.pos.set(-38.75, lv * 4, -8.75); me.y = lv * 4; player.pos.set(-38.75, lv * 4, -8.75); player.y = lv * 4; world.phase = "live"; me.invuln = 999; }, lv);
        await page.waitForTimeout(900);
        const box = await page.evaluate(() => { const r = document.getElementById("mini").getBoundingClientRect(); return { x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }; });
        await page.screenshot({ path: dir + "/minimap-" + name + ".png", clip: box });
      }
    }

    // ── taking it down ──
    const gone = await page.evaluate(() => { loadMap("glacier"); drawMini(); drawTac(); return { key: CUR_MAP_KEY, iter: Object.prototype.hasOwnProperty.call(COLLIDERS, Symbol.iterator), fill: Object.prototype.hasOwnProperty.call(mctx, "fillRect") }; });
    assert.deepEqual(gone, { key: "glacier", iter: false, fill: false }, "the next map is drawn the engine's way");
    assert.deepEqual(f.errors, []);
    console.log("hospital bots: graph on 3 floors, 4 posts reached and held, plain round puts " + round.upstairs + " bot(s) upstairs, minimap and tactical map per floor, room named");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
