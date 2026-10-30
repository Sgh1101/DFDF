const fs = require("node:fs"), assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Fight cost: ten actors (5v5) that really shoot, on 마크X발로 (~44k colliders) and on 포구, with third-person casings on; the player is the tenth and stands still.
// Per step it counts the calls to the collider queries (rayBlocked, wallT, groundAt, the casing ground query) and times
// step(); and each frame also times render() on the CPU. Prints one JSON summary and writes test-results/firefight.json.
// Headless SwiftShader numbers are only good for comparing a run with another run on the same machine.
// DFDF_FIGHT_STEPS (default 600) steps are measured per map, DFDF_FIGHT_MAPS (default "ascent,pogu") picks the maps.
const STEPS = Number(process.env.DFDF_FIGHT_STEPS) || 600, MAPS = (process.env.DFDF_FIGHT_MAPS || "ascent,pogu").split(",");
(async () => {
  const f = await fixture(), summary = { steps: STEPS, note: "headless SwiftShader; relative numbers only" };
  fs.mkdirSync("test-results", { recursive: true });
  try {
    for (const map of MAPS) {
      const page = await f.page("fight" + map, { width: 1280, height: 720 }, {}, {
        bootTimeout: 120000,
        // the engine's own file lists are routed so the call counters sit inside the closures that call wallT and the casing ground query
        beforeLoad: async (p) => {
          // the game's rAF loops (tick, the gun-effects frame) are queued by hand so one "frame" runs all of them at a fixed 16.7 ms
          await p.addInitScript(() => { const prev = window.requestAnimationFrame; window.__rafQ = []; window.requestAnimationFrame = (cb) => (window.__manual ? window.__rafQ.push(cb) : prev(cb)); });
          const patch = (glob, from, to) => p.route(glob, async (route) => {
            const res = await route.fetch(), text = await res.text();
            await route.fulfill({ response: res, body: text.includes(from) ? text.replace(from, to) : text, contentType: "text/javascript" });
          });
          await patch("**/js/legacy/11-walls-must-stop-bullets-and-bodies.js", "function wallT(ox, oy, oz, dx, dy, dz, maxT, skip) {", "function wallT(ox, oy, oz, dx, dy, dz, maxT, skip) { (window.__Q || (window.__Q = {})).wallT = ((window.__Q || {}).wallT | 0) + 1;");
          await patch("**/js/legacy/18-gun-effects.js", "function groundAt(x, z, y) {", "function groundAt(x, z, y) { (window.__Q || (window.__Q = {})).casingGroundOwn = ((window.__Q || {}).casingGroundOwn | 0) + 1;");
        },
      });
      await page.waitForFunction(() => VALORANT_PACK.status === "ready");
      if (map === "ascent") {
        await page.locator("#go-play").click();
        if (await page.locator("#sel-pick").isVisible()) await page.locator("#sel-pick").click();
        await page.locator("#sel-maps button").filter({ hasText: /^마크X발로$/ }).click();
        await page.waitForFunction(() => ASCENT_TRIAL.status === "ready");
        await page.locator("#sel-go").click({ timeout: 120000 });
        await page.waitForFunction(() => ASCENT_TRIAL.active && !!myActor(), null, { timeout: 120000 });
      } else {
        await page.evaluate((m) => { titleCam = () => {}; room.mode = "std"; room.map = m; startGame(AGENTS[0], false); }, map);
        await page.waitForFunction((m) => CUR_MAP_KEY === m && !!myActor(), map, { timeout: 120000 });
      }
      const r = await page.evaluate(async (STEPS) => {
        window.__manual = true;
        // the loops queued before this point come in one by one (a slow frame on the big map takes a while): wait until the queue stops growing
        for (let last = -1, still = 0, i = 0; still < 4 && i < 100; i++) { await new Promise((r) => setTimeout(r, 300)); const n = window.__rafQ.length; still = n > 0 && n === last ? still + 1 : 0; last = n; } closeShop(); world.phase = "live"; world.roundTime = 999; checkRoundEnd = function () {};
        ADMIN.freezeAI = false; GFX.shells = true;
        let seed = 20240607; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); Math.random = rnd;
        // counters: globals that can be wrapped from outside; wallT and the casing's own query are counted inside their files
        const Q = (window.__Q = window.__Q || {}), counts = { rayBlocked: 0, groundAt: 0, groundTop: 0, collideXZ: 0, blockerTopAt: 0, chashBuild: 0, fire: 0, eject: 0 };
        const wrap = (name, key) => { if (typeof window[name] !== "function") return; const o = window[name]; window[name] = function () { counts[key || name]++; return o.apply(this, arguments); }; };
        wrap("rayBlocked"); wrap("groundAt"); wrap("groundTop"); wrap("collideXZ"); wrap("blockerTopAt"); wrap("chashBuild"); wrap("actorFire", "fire"); wrap("ejectShell", "eject");
        // nine bots and the player (who stands still, so the camera and the casings are in the middle of it), all invulnerable so the fight keeps going, close to the middle of the map
        for (const a of world.actors) { a.invuln = 1e9; a.hp = 100; }
        const M = { x: (MAP.attackSpawn.x + MAP.defendSpawn.x) / 2, z: (MAP.attackSpawn.z + MAP.defendSpawn.z) / 2 };
        const cells = [];
        for (let R = 14; R <= 60 && cells.length < 40; R += 8) { cells.length = 0; for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) if (GRID.walk[r * GRID.cols + c]) { const p = cellCenter(c, r); Math.hypot(p.x - M.x, p.z - M.z) < R && cells.push(p); } }
        for (const a of world.actors) {
          const p = cells[Math.floor(rnd() * cells.length)];
          a.pos.set(p.x, 0, p.z); a.y = groundAt(p.x, p.z, 3); a.vy = 0; a.ctrl === "me" || (a.ai = freshAIState()); a.root = 0; a.blind = 0;
        }
        // time step and render inside the game's own tick, count the queries per frame
        const acc = { step: 0, render: 0 }, timed = (name, key) => { const o = window[name]; window[name] = function () { const t0 = performance.now(); try { return o.apply(this, arguments); } finally { acc[key] += performance.now() - t0; } }; };
        timed("step", "step"); timed("render", "render");
        const chains = window.__rafQ.map((f) => f.name || "anon");
        let clock = performance.now();
        const frame = () => { clock += 1000 / 60; world.phase = "live"; world.roundTime = 999; const q = window.__rafQ.splice(0); for (const cb of q) cb(clock); };
        for (let i = 0; i < 60; i++) frame();
        for (const k in counts) counts[k] = 0; for (const k in Q) Q[k] = 0;
        const times = [], renders = [], frames = [], perStep = { rayBlocked: [], wallT: [], groundAt: [], casingGround: [] };
        const casing = () => (Q.casingGroundOwn | 0) + Math.max(0, counts.groundTop - counts.groundAt);
        for (let i = 0; i < STEPS; i++) {
          const b = { r: counts.rayBlocked, w: Q.wallT | 0, g: counts.groundAt, c: casing() };
          acc.step = acc.render = 0; const t0 = performance.now(); frame(); frames.push(performance.now() - t0);
          times.push(acc.step); renders.push(acc.render);
          perStep.rayBlocked.push(counts.rayBlocked - b.r); perStep.wallT.push((Q.wallT | 0) - b.w); perStep.groundAt.push(counts.groundAt - b.g); perStep.casingGround.push(casing() - b.c);
        }
        const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(3); };
        const mean = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
        return {
          chains, map: CUR_MAP_KEY, colliders: COLLIDERS.length, actors: world.actors.length, alive: world.actors.filter((a) => a.alive).length,
          stepMs: { p50: q(times, 0.5), p95: q(times, 0.95), max: q(times, 1), mean: mean(times) },
          frameMs: { p50: q(frames, 0.5), p95: q(frames, 0.95), mean: mean(frames) },
          renderMs: { n: renders.length, p50: q(renders, 0.5), p95: q(renders, 0.95), mean: mean(renders) },
          perFrame: Object.fromEntries(Object.entries(perStep).map(([k, v]) => [k, { mean: mean(v), max: Math.max(...v) }])),
          totals: { ...counts, wallT: Q.wallT | 0, casingGround: casing() },
          shotsPerSecond: +(counts.fire / (STEPS * 0.016)).toFixed(1),
        };
      }, STEPS);
      console.log(map, JSON.stringify(r));
      summary[map] = r;
      assert.ok(r.actors >= 10, map + ": ten actors");
      assert.ok(r.totals.fire > 20, map + ": the bots really fire (" + r.totals.fire + " shots)");
      // the bots look for targets every 0.1-0.2 s, not on every step (about 46 sight lines a frame in 5v5 before) and keep fighting as hard
      // (DFDF_FIGHT_BASELINE=1 skips this, to measure code without the throttle)
      if (!process.env.DFDF_FIGHT_BASELINE) {
        assert.ok(r.perFrame.rayBlocked.mean < 15, map + ": sight lines per frame " + r.perFrame.rayBlocked.mean);
        assert.ok(r.shotsPerSecond > 30, map + ": shots per second " + r.shotsPerSecond);
      }
      await page.context().close();
    }
    assert.deepEqual(f.errors, []);
    fs.writeFileSync("test-results/firefight" + (process.env.DFDF_FIGHT_TAG ? "-" + process.env.DFDF_FIGHT_TAG : "") + ".json", JSON.stringify(summary, null, 2));
    console.log("firefight summary " + JSON.stringify(summary));
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
