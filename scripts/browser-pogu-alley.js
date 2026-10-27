const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Pogu's B-link alley (x 30..38, z -56..-8) has two crates that narrow it to 3 m. The bots' grid only tests each
// 2.5 m cell's centre (radius 0.95), so with both crates in full width no cell centre was free in their two rows:
// the grid was cut there, bLink was out of reach from both spawns, and findPath's straight-line fallback hid it. The
// alley's east door to B site (x 38..42) was 4 m with both rows of cell centres 0.75 m from a wall, so bots from bLink
// went the long way round; it is 4.5 m now.
// Here: a BFS over GRID (alley cells, bLink and B site from both spawns), then real bots (the game's AI, its goal
// pointed at the spot) walking from each spawn to bLink and on to B site, three tries each.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("poguAlley", { width: 1280, height: 720 });
    const out = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      titleCam = () => {};
      render = () => {};
      room.mode = "std"; room.map = "pogu"; startGame(AGENTS[0], false);
      for (let i = 0; i < 100 && !(myActor() && CUR_MAP_KEY === "pogu"); i++) await sleep(100);
      closeShop();
      ADMIN.freezeAI = true; world.roundTime = 0.01; step(0.05); world.roundTime = 1e6; ADMIN.freezeAI = false;
      const me = myActor(); me && releaseToAI(me.id);
      checkRoundEnd = function () {};
      // the spawn barriers come and go on a 100 ms timer: let them settle before looking at the grid
      await sleep(600);
      // 4-neighbour BFS over the walkable cells; from (x0,z0) to everything reachable, optionally inside a box
      const cellOf = (x, z) => [gx(x), gz(z)];
      const bfs = (from, box) => {
        const seen = new Uint8Array(GRID.cols * GRID.rows), q = [];
        const ok = (c, r) => c >= 0 && r >= 0 && c < GRID.cols && r < GRID.rows && GRID.walk[r * GRID.cols + c] && (!box || (cellCenter(c, r).x > box[0] && cellCenter(c, r).x < box[1] && !(cellCenter(c, r).z > box[2])));
        if (!ok(from[0], from[1])) return seen;
        seen[from[1] * GRID.cols + from[0]] = 1; q.push(from);
        while (q.length) {
          const [c, r] = q.pop();
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nc = c + dc, nr = r + dr;
            if (ok(nc, nr) && !seen[nr * GRID.cols + nc]) { seen[nr * GRID.cols + nc] = 1; q.push([nc, nr]); }
          }
        }
        return seen;
      };
      const has = (seen, p) => { const [c, r] = cellOf(p.x, p.z); return !!seen[r * GRID.cols + c]; };
      const bl = MAP.nodes.bLink, bs = MAP.nodes.bSite;
      const grid = {
        bLinkFree: !!GRID.walk[gz(bl.z) * GRID.cols + gx(bl.x)],
        fromAtk: [has(bfs(cellOf(MAP.attackSpawn.x, MAP.attackSpawn.z)), bl), has(bfs(cellOf(MAP.attackSpawn.x, MAP.attackSpawn.z)), bs)],
        fromDef: [has(bfs(cellOf(MAP.defendSpawn.x, MAP.defendSpawn.z)), bl), has(bfs(cellOf(MAP.defendSpawn.x, MAP.defendSpawn.z)), bs)],
      };
      // the alley on its own: walls close it at x 30 and 38, so a search kept inside it goes end to end or not at all
      const alley = bfs(cellOf(34.75, -13), [30, 38]);
      grid.alleyThrough = has(alley, { x: 34.75, z: -54 });
      grid.alleyToLink = has(alley, bl);
      // the alley's east door to B site (x 38..42, z -52..-47.5): kept south of the alley's other end (z -16),
      // bLink reaches B site only through it
      grid.doorToSite = has(bfs(cellOf(bl.x, bl.z), [30, 74, -16]), bs);
      const bot0 = (team) => world.actors.find((a) => a.team === team);
      const res = { grid };
      const goal = aiGoal;
      let bot = null, target = null;
      aiGoal = function (e) { return e === bot && target ? { x: target.x, z: target.z } : goal.apply(this, arguments); };
      const walk = (to, from) => {
        for (const a of world.actors) if (a !== bot) { a.alive = false; a.hp = 0; }
        Object.assign(bot, { alive: true, hp: 100, ctrl: "ai", ai: freshAIState(), hasSpike: false, root: 0, slow: 1, y: 0, vy: 0 });
        bot.pos.x = from.x; bot.pos.z = from.z;
        intelClear(); target = to;
        // stuck means the bot has not moved 1 m in 8 s
        let best = 1e9, mark = { x: bot.pos.x, z: bot.pos.z }, markAt = 0;
        for (let t = 0; t < 150; t += 0.05) {
          step(0.05);
          const d = Math.hypot(bot.pos.x - to.x, bot.pos.z - to.z);
          if (d < best) best = d;
          if (d < 2.5) return { ok: true, t: +t.toFixed(1) };
          if (t - markAt > 8) { if (Math.hypot(bot.pos.x - mark.x, bot.pos.z - mark.z) < 1) break; mark = { x: bot.pos.x, z: bot.pos.z }; markAt = t; }
        }
        return { ok: false, at: [+bot.pos.x.toFixed(1), +bot.pos.z.toFixed(1)], best: +best.toFixed(1) };
      };
      for (const [team, spawn] of [["atk", MAP.attackSpawn], ["def", MAP.defendSpawn]]) {
        bot = bot0(team);
        res[team] = [];
        for (let i = 0; i < 3; i++) res[team].push({ link: walk(bl, spawn), site: walk(bs, bl) });
      }
      return res;
    });
    console.log(JSON.stringify(out));
    const g = out.grid;
    assert.ok(g.bLinkFree, "the grid cell at bLink is walkable");
    assert.deepEqual(g.fromAtk, [true, true], "grid: attack spawn reaches bLink and B site");
    assert.deepEqual(g.fromDef, [true, true], "grid: defend spawn reaches bLink and B site");
    assert.ok(g.alleyThrough && g.alleyToLink, "grid: the alley is open end to end inside its own walls");
    assert.ok(g.doorToSite, "grid: from bLink, B site is reached through the alley's east door");
    for (const team of ["atk", "def"]) out[team].forEach((r, i) => {
      assert.ok(r.link.ok, team + " bot walks spawn -> bLink (try " + (i + 1) + "): " + JSON.stringify(r.link));
      assert.ok(r.site.ok, team + " bot walks bLink -> B site (try " + (i + 1) + "): " + JSON.stringify(r.site));
      // through the door it is about 40 m; the long way round took 19-22 s
      assert.ok(r.site.t < 15, team + " bot goes bLink -> B site through the door (try " + (i + 1) + "): " + r.site.t + " s");
    });
    assert.deepEqual(f.errors, []);
    console.log("pogu alley: the grid is open through the B-link alley and bots walk spawn -> bLink -> B site from both sides");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
