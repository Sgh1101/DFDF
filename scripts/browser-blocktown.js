const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
// 네모 마을 (blocktown), in a real page on a laptop and on a phone: the home tile opens agent select on the map and 전투 투입
// starts it; nothing big is downloaded; the draw calls and triangles of a frame; every spawn and both sites are on the
// bots' network; a body walks the routes with the real movement; then the bots play: a whole round with both teams
// fighting, and a plant on A and on B. All the while no fighter is below the ground or inside a block.
const OUT = process.env.SHOT_DIR || "test-results";
const RUNS = [
  { name: "desktop", viewport: { width: 1280, height: 720 }, ctx: {}, quality: "visual", full: true },
  { name: "phone", viewport: { width: 852, height: 393 }, ctx: { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, quality: "mobile", full: false },
];
(async () => {
  const f = await fixture(), report = {};
  fs.mkdirSync(OUT, { recursive: true });
  try {
    for (const run of RUNS) {
      const page = await f.page("blocktown" + run.name, run.viewport, run.ctx, { bootTimeout: 240000, quality: run.quality });
      const R = (report[run.name] = {});
      // ── the home tile, agent select, 전투 투입 ──
      assert.equal(await page.evaluate(() => MAP_LIST.some((m) => m.key === "blocktown") && MAP_SIZE("blocktown")), 5, "listed as a 5v5 map");
      const tile = page.locator("#go-blocktown");
      assert.match(await tile.textContent(), /네모 마을/);
      // the home menu fades in: the click waits for the tile to stand still
      await tile.click({ timeout: 120000 });
      await page.waitForFunction(() => !document.getElementById("s-select").hidden && room.map === "blocktown");
      const picked = await page.evaluate(() => [...document.querySelectorAll("#sel-maps button")].filter((b) => /on|sel|active/.test(b.className) || b.getAttribute("aria-pressed") === "true").map((b) => b.textContent.trim()));
      R.selectChip = picked;
      await page.screenshot({ path: path.join(OUT, `blocktown-${run.name}-select.png`) });
      await page.locator("#sel-go").click({ timeout: 60000 });
      await page.waitForFunction(() => CUR_MAP_KEY === "blocktown" && window.BLOCKTOWN && BLOCKTOWN.active && !!myActor() && world.actors.length === 10, null, { timeout: 240000 });
      R.stats = await page.evaluate(() => BLOCKTOWN.stats);
      R.requests = await page.evaluate(() => performance.getEntriesByType("resource").filter((r) => /blocktown|\/assets\/maps\//.test(r.name)).map((r) => r.name.replace(location.origin, "")));
      assert.ok(R.requests.every((u) => /\/js\/blocktown-(layout|map)\.js/.test(u) || /blocktown-preview/.test(u)), "no map pack is downloaded: " + R.requests.join(", "));
      assert.ok(R.stats.meshes <= 40 && R.stats.triangles < 120000 && R.stats.colliders < 5000, "a light map: " + JSON.stringify(R.stats));
      // ── a frame's cost: what the renderer draws for the game scene ──
      await page.evaluate(() => {
        closeShop();
        const r = renderer.render;
        window.__frames = [];
        renderer.render = function (s, c) { const out = r.apply(this, arguments); s === scene && __frames.push({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }); return out; };
      });
      await page.waitForFunction(() => __frames.length >= 6, null, { timeout: 120000 });
      R.frame = await page.evaluate(() => __frames.slice(-3));
      // the whole frame counts the fighters, guns and effects too; the blocks themselves are BLOCKTOWN.stats.meshes draws
      assert.ok(R.frame.every((x) => x.calls < 600 && x.triangles < 400000), "frame cost: " + JSON.stringify(R.frame));
      await page.screenshot({ path: path.join(OUT, `blocktown-${run.name}-spawn.png`) });
      // ── the bots' network ──
      R.routes = await page.evaluate(() => {
        const out = {};
        for (const [team, s] of [["atk", MAP.attackSpawn], ["def", MAP.defendSpawn]]) for (const site of MAP.sites) out[team + site.id] = BLOCKTOWN.route(s.x, s.z, 0, site.x, site.z).length;
        // the raised places: the bridge, the walkway, the quarry ledge
        const up = (bx, bz) => { const p = BLOCKTOWN.layout.toWorld([bx, bz]), r = BLOCKTOWN.route(MAP.attackSpawn.x, MAP.attackSpawn.z, 0, p.x, p.z, 3.75); return r.length ? +r[r.length - 1].y.toFixed(2) : -1; };
        out.bridgeY = up(84, 64); out.walkwayY = up(98, 49); out.ledgeY = up(124, 40);
        out.nodes = Object.entries(MAP.nodes).filter(([, p]) => !BLOCKTOWN.route(MAP.attackSpawn.x, MAP.attackSpawn.z, 0, p.x, p.z).length && Math.hypot(p.x - MAP.attackSpawn.x, p.z - MAP.attackSpawn.z) > 3).map(([k]) => k);
        return out;
      });
      assert.ok(["atkA", "atkB", "defA", "defB"].every((k) => R.routes[k] > 20), "spawns reach both sites: " + JSON.stringify(R.routes));
      assert.deepEqual(R.routes.nodes, [], "every map point is reachable");
      assert.ok(R.routes.bridgeY > 3.5 && R.routes.ledgeY > 3.5 && R.routes.walkwayY > 3.5, "the raised levels are on the network: " + JSON.stringify(R.routes));
      if (run.full) {
        // ── the keyboard: W walks ──
        const begin = await page.evaluate(() => { const a = myActor(); a.invuln = 999; world.phase = "live"; world.roundTime = 999; return { x: a.pos.x, z: a.pos.z }; });
        if (!(await page.evaluate(() => document.pointerLockElement === document.getElementById("cv")))) await page.locator("#cv").click({ force: true });
        await page.keyboard.down("w");
        await page.waitForFunction((p) => Math.hypot(player.pos.x - p.x, player.pos.z - p.z) > 2, begin, { timeout: 60000 });
        await page.keyboard.up("w");
        // ── a body on the routes, with the real movement: to each site, and up onto the bridge and the ledge ──
        R.walks = await page.evaluate(() => {
          const a = myActor(), out = {};
          const go = (from, to, name) => {
            a.pos.set(from.x, 0, from.z); a.y = from.y || 0; a.vy = 0; a.onGround = true; a.root = 0; a.slow = 1; a.speedBuff = 1;
            const route = BLOCKTOWN.route(from.x, from.z, a.y, to.x, to.z, to.y || 0);
            let reached = 0, maxY = a.y, minY = a.y, inside = 0;
            for (const p of route) {
              for (let n = 0; n < 80 && Math.hypot(p.x - a.pos.x, p.z - a.pos.z) > 0.16; n++) {
                a.yaw = Math.atan2(-(p.x - a.pos.x), -(p.z - a.pos.z)); a.input.mv = [0, -1]; a.input.btn = 0; simMove(a, 0.0125);
                maxY = Math.max(maxY, a.y); minY = Math.min(minY, a.y);
                collideXZ(a.pos.x, a.pos.z, a.y + 0.05, PR * 0.5) && inside++;
              }
              if (Math.hypot(p.x - a.pos.x, p.z - a.pos.z) > 0.3) break;
              reached++;
            }
            a.input.mv = [0, 0]; a.vel.set(0, 0, 0);
            out[name] = { points: route.length, reached, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), inside, end: +Math.hypot(a.pos.x - to.x, a.pos.z - to.z).toFixed(1) };
          };
          const W = (b) => BLOCKTOWN.layout.toWorld(b);
          go(MAP.attackSpawn, MAP.sites[0], "atk→A");
          go(MAP.attackSpawn, MAP.sites[1], "atk→B");
          go(MAP.defendSpawn, MAP.sites[0], "def→A");
          go(MAP.defendSpawn, MAP.sites[1], "def→B");
          go(MAP.nodes.cutS, { ...W([84, 64]), y: 3.75 }, "onto the bridge");
          go(MAP.nodes.cutS, { ...W([124, 40]), y: 3.75 }, "onto the A ledge");
          go({ ...W([124, 40]), y: 3.75 }, MAP.sites[0], "ledge→A");
          const s = MAP.attackSpawn; a.pos.set(s.x, 0, s.z); a.y = 0;
          return out;
        });
        for (const [k, w] of Object.entries(R.walks)) assert.ok(w.points > 0 && w.reached === w.points && w.inside === 0 && w.minY >= -0.001, k + ": " + JSON.stringify(w));
        assert.ok(R.walks["onto the bridge"].maxY > 3.7 && R.walks["onto the A ledge"].maxY > 3.7, "the stairs lift a body");
        // a shot through a wall does nothing; a jump under the bridge stops at its floor
        R.wall = await page.evaluate(() => {
          const a = myActor(), W = (b) => BLOCKTOWN.layout.toWorld(b), p = W([84, 64]);
          const t = world.actors.find((q) => q.team !== a.team);
          // the station house wall: from the yard (x block 70) toward the west, the house fills blocks 60..67
          const from = W([70, 50]), to = W([63, 50]);
          t.pos.set(to.x, 0, to.z); t.y = 0; t.hp = 100; t.invuln = 0; t.alive = true;
          actorHitscan(a, new T.Vector3(from.x, 1.2, from.z), new T.Vector3(-1, 0, 0), { range: 40, dmg: 50, hs: 1 }, false);
          a.pos.set(p.x, 0, p.z); a.y = 0; a.vy = 0; a.onGround = true; a.input.mv = [0, 0]; a.vel.set(0, 0, 0); a.input.btn = BTN.JUMP;
          let head = 0;
          for (let i = 0; i < 100; i++) { simMove(a, 0.01); a.input.btn = 0; head = Math.max(head, a.y + 2.3); }
          const s = MAP.attackSpawn; a.pos.set(s.x, 0, s.z); a.y = 0;
          return { enemyHP: t.hp, head: +head.toFixed(3), deck: 2.5 };
        });
        assert.equal(R.wall.enemyHP, 100, "a wall stops the shot");
        assert.ok(R.wall.head <= R.wall.deck + 0.001, "a jump stops under the bridge: " + JSON.stringify(R.wall));
      }
      // ── the bots play ──
      const sim = (secs, until) => page.evaluate(async ({ secs, until }) => {
        const out = { seconds: 0, below: 0, inside: 0, deaths: 0, hurt: 0, moved: 0, maxStill: 0 };
        const prev = new Map(world.actors.map((a) => [a, { alive: a.alive, hp: a.hp, x: a.pos.x, z: a.pos.z, far: 0 }]));
        const done = () => (until === "end" ? world.phase !== "live" : until === "planted" ? world.spike.state === "planted" : false);
        for (let k = 0; k < secs * 30 && !done(); k++) {
          step(1 / 30);
          out.seconds += 1 / 30;
          for (const a of world.actors) {
            const p = prev.get(a);
            if (!p) continue;
            a.alive && (a.y || 0) < -0.01 && out.below++;
            a.alive && a.onGround && collideXZ(a.pos.x, a.pos.z, (a.y || 0) + 0.05, PR * 0.5) && out.inside++;
            p.alive && !a.alive && out.deaths++;
            a.hp < p.hp && out.hurt++;
            p.alive = a.alive; p.hp = a.hp;
            p.far = Math.max(p.far, Math.hypot(a.pos.x - p.x, a.pos.z - p.z));
          }
          k % 15 === 14 && (await new Promise((r) => setTimeout(r, 0)));
        }
        out.moved = [...prev].filter(([a, p]) => a.ctrl !== "me" && p.far > 8).length;
        out.seconds = Math.round(out.seconds);
        const c = world.actors.find((a) => a.hasSpike);
        c && (out.carrier = { ctrl: c.ctrl, team: c.team, at: [Math.round(c.pos.x), Math.round(c.pos.z)], plan: c._plantSite && c._plantSite.id, path: c.ai && c.ai.path && c.ai.path.length });
        out.phase = world.phase; out.spike = world.spike.state; out.site = world.spike.planterSite; out.score = [world.scoreAtk, world.scoreDef];
        return out;
      }, { secs, until });
      const prepare = (site) => page.evaluate((site) => {
        closeShop(); ADMIN.freezeAI = false;
        world.phase = "live"; world.roundTime = 999;
        const me = myActor(); me.invuln = 9999;
        if (site) {
          // the attackers go for one site; the defenders stay home and cannot see (the plant itself is under test)
          const s = MAP.sites.find((x) => x.id === site), atk = world.actors.filter((a) => a.team === "atk" && a !== me);
          for (const a of world.actors) if (a.team === "def") { a.root = 9999; a.blind = 9999; a.invuln = 9999; }
          // each attacker starts from the attackers' spawn
          atk.forEach((a, i) => { const p = spawnPointFor("atk", i); a.pos.set(p.x, 0, p.z); a.y = 0; a.vy = 0; a.ai && (a.ai.site = s, a.ai.path = null); a._plantSite = s; a.hasSpike = false; });
          me.hasSpike = false; player.hasSpike = false;
          atk[0].hasSpike = true; world.spike.state = "carried"; world.spike.carrier = atk[0];
        }
      }, site);
      if (run.full) {
        // a whole round with both teams fighting
        await prepare(null);
        await page.evaluate(() => { world.roundTime = 100; });
        R.round = await sim(160, "end");
        assert.ok(R.round.phase !== "live", "the round ended: " + JSON.stringify(R.round));
        assert.ok(R.round.moved >= 8 && R.round.hurt > 0, "bots moved and fought: " + JSON.stringify(R.round));
        await page.screenshot({ path: path.join(OUT, `blocktown-${run.name}-round.png`) });
        // a plant on each site
        R.plants = {};
        for (const site of ["A", "B"]) {
          // a fresh match for each plant (the menu's own start, as 전투 투입 calls it)
          await page.evaluate(() => { cancelRoundEnd(); netShutdown(); clearActors(); room.mode = "std"; room.map = "blocktown"; startGame(AGENTS[0], false); });
          await page.waitForFunction(() => CUR_MAP_KEY === "blocktown" && BLOCKTOWN.active && !!myActor() && world.actors.length === 10 && world.round === 1, null, { timeout: 240000 });
          await prepare(site);
          const r = await sim(150, "planted");
          R.plants[site] = r;
          assert.equal(r.spike, "planted", "planted on " + site + ": " + JSON.stringify(r));
          assert.equal(r.site, site);
          await page.screenshot({ path: path.join(OUT, `blocktown-${run.name}-plant-${site}.png`) });
          for (const k of ["below", "inside"]) assert.equal(r[k], 0, k + " on the way to " + site);
        }
      } else {
        await prepare(null);
        R.live = await sim(30, null);
        assert.ok(R.live.moved >= 6, "bots move on the phone: " + JSON.stringify(R.live));
        await page.screenshot({ path: path.join(OUT, `blocktown-${run.name}-live.png`) });
      }
      for (const r of [R.round, R.live].filter(Boolean)) for (const k of ["below", "inside"]) assert.equal(r[k], 0, k + ": " + JSON.stringify(r));
      console.log(run.name, JSON.stringify(R));
      await page.context().close();
    }
    assert.deepEqual(f.errors, [], "no page errors");
    fs.writeFileSync(path.join(OUT, "blocktown-report.json"), JSON.stringify(report, null, 1));
    console.log("blocktown ok");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
