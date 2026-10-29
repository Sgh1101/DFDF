const fs = require("node:fs"), assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Bot sight: how long a bot takes to open fire on an enemy that comes into view, and how many sight lines it traces while
// enemies stand about. A bot used to trace a sight line to every enemy in range on every step (about 45 a step in 5v5);
// it now looks again every 100-200 ms (staggered by bot) and keeps its target in between. The delay this adds to the first
// shot has to stay small. Each trial: one bot facing the spot an enemy will appear on, the enemy first behind a wall,
// then moved into view; the time from that to the bot's first actorFire is recorded. DFDF_SIGHT_TAG names the output file.
const MAPS = (process.env.DFDF_SIGHT_MAPS || "pogu").split(","), TRIALS = Number(process.env.DFDF_SIGHT_TRIALS) || 40;
(async () => {
  const f = await fixture(), summary = {};
  fs.mkdirSync("test-results", { recursive: true });
  try {
    for (const map of MAPS) {
      const page = await f.page("sight" + map, { width: 1280, height: 720 });
      await page.evaluate((m) => { titleCam = () => {}; room.mode = "std"; room.map = m; startGame(AGENTS[0], false); }, map);
      await page.waitForFunction((m) => CUR_MAP_KEY === m && !!myActor(), map, { timeout: 120000 });
      const r = await page.evaluate(async (TRIALS) => {
        requestAnimationFrame = () => 0; closeShop(); world.phase = "live"; world.roundTime = 1e6; checkRoundEnd = function () {};
        render = () => {}; ADMIN.freezeAI = false;
        let seed = 777; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); Math.random = rnd;
        const me = myActor(); me && releaseToAI(me.id);
        const bot = world.actors.find((a) => a.team === "atk"), foe = world.actors.find((a) => a.team !== "atk");
        for (const a of world.actors) if (a !== bot && a !== foe) { a.alive = false; a.hp = 0; }
        const cells = [];
        for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) if (GRID.walk[r * GRID.cols + c]) cells.push(cellCenter(c, r));
        const eye = (p) => [p.x, 1.5, p.z], tgt = (p) => [p.x, 1.1, p.z];
        const sees = (a, b) => !rayBlocked(a.x, 1.5, a.z, b.x, 1.1, b.z);
        // a spot for the bot with an open view of B (20-35 m) and a hidden spot H (within 60 m of the bot) behind a wall
        const trials = [];
        for (let tries = 0; tries < 20000 && trials.length < 6; tries++) {
          const A = cells[Math.floor(rnd() * cells.length)], B = cells[Math.floor(rnd() * cells.length)], H = cells[Math.floor(rnd() * cells.length)];
          const dB = Math.hypot(A.x - B.x, A.z - B.z), dH = Math.hypot(A.x - H.x, A.z - H.z);
          if (dB > 20 && dB < 35 && dH > 15 && dH < 60 && sees(A, B) && !sees(A, H) && Math.hypot(B.x - H.x, B.z - H.z) > 8) trials.push({ A, B, H });
        }
        let firedAt = -1, simT = 0;
        const fire = actorFire; actorFire = function (e) { e === bot && firedAt < 0 && (firedAt = simT); return fire.apply(this, arguments); };
        const place = (a, p) => { a.pos.set(p.x, 0, p.z); a.y = groundAt(p.x, p.z, 3); a.vy = 0; };
        const out = [];
        for (let i = 0; i < TRIALS; i++) {
          const tr = trials[i % trials.length];
          Object.assign(foe, { alive: true, hp: 100, invuln: 1e9, blind: 1e9, root: 1e9, ctrl: "ai", hasSpike: false });
          Object.assign(bot, { alive: true, hp: 100, invuln: 1e9, blind: 0, root: 1e9, ctrl: "ai", hasSpike: false, ai: freshAIState(), ammo: bot.ammo, fireCd: 0, reloading: 0 });
          place(bot, tr.A); place(foe, tr.H); intelClear();
          bot.yaw = Math.atan2(-(tr.B.x - tr.A.x), -(tr.B.z - tr.A.z));
          for (const k in bot.ammo) bot.ammo[k] = 99;
          // the bot idles with nobody in sight for a random while, so the moment the enemy appears lands anywhere in its sight cycle
          const idle = 20 + Math.floor(rnd() * 40);
          firedAt = -1; simT = 0;
          for (let s = 0; s < idle; s++) { world.phase = "live"; world.roundTime = 1e6; step(0.016); }
          const early = firedAt >= 0;
          place(foe, tr.B); firedAt = -1; simT = 0;
          let s = 0;
          for (; s < 250 && firedAt < 0; s++) { world.phase = "live"; world.roundTime = 1e6; simT += 0.016; step(0.016); }
          out.push({ ms: firedAt < 0 ? null : Math.round(firedAt * 1000), early });
        }
        actorFire = fire;
        const ms = out.map((o) => o.ms).filter((v) => v !== null).sort((a, b) => a - b);
        const q = (p) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))];
        return { trials: out.length, spots: trials.length, fired: ms.length, early: out.filter((o) => o.early).length, meanMs: Math.round(ms.reduce((x, y) => x + y, 0) / Math.max(1, ms.length)), p50Ms: q(0.5), p95Ms: q(0.95), maxMs: ms[ms.length - 1], all: ms };
      }, TRIALS);
      console.log(map, JSON.stringify(r)); summary[map] = r;
      assert.ok(r.spots >= 3, map + ": found sight spots");
      assert.equal(r.fired, r.trials, map + ": the bot fires at every enemy that comes into view");
      // before the throttle (every step): mean 116 ms, p95 240 ms here; a look every 0.10-0.20 s adds about 40 ms
      assert.ok(r.meanMs < 250 && r.p95Ms < 450, map + ": the first shot comes soon after the enemy shows: " + JSON.stringify({ mean: r.meanMs, p95: r.p95Ms }));
      await page.context().close();
    }
    assert.deepEqual(f.errors, []);
    fs.writeFileSync("test-results/bot-sight" + (process.env.DFDF_SIGHT_TAG ? "-" + process.env.DFDF_SIGHT_TAG : "") + ".json", JSON.stringify(summary, null, 2));
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
