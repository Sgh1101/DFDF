const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// A defender holding F on the planted spike used to keep it from going off: the fuse was only looked at when nobody
// was defusing, so a defuse that began with 2 s left (7 s needed) ended in a defuse 5 s after the bomb should have
// blown. The fuse now ends the round the moment it runs out, defuser or not; a defuse that finishes in time still wins.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("spikefuse", { width: 568, height: 320 });
    const out = await page.evaluate(() => {
      render = () => {};
      titleCam = () => {};
      room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop();
      aiThink = function () {};
      const me = myActor();
      const reset = () => {
        startRound(); world.phase = "live"; world.roundTime = 999; world.over = false;
        world.scoreAtk = world.scoreDef = 0;
        me.team = "def"; me.alive = true; me.hp = 100; me.invuln = 999;
        for (const a of world.actors) if (a !== me) { a.team = "atk"; a.alive = true; a.invuln = 999; a.hp = 100; a.pos.set(0, 0, 90); a.hasSpike = false; }
        const site = MAP.sites[0];
        plantSpike(site.x, site.z, site, false);
        me.pos.set(site.x + 1, 0, site.z);
        return site;
      };
      const run = (fuse) => {
        reset();
        world.spike.timer = fuse;
        keys.f = true;
        let t = 0;
        for (let i = 0; i < 160 && !world.over; i++) { step(0.05); t += 0.05; }
        keys.f = false;
        return { t: +t.toFixed(2), over: world.over, state: world.spike.state, atk: world.scoreAtk, def: world.scoreDef };
      };
      const late = run(2), early = run(30);
      const guest = world.actors.find(actor => actor !== me);
      const guestFinish = remaining => {
        const site = reset();
        guest.team = "def";
        guest.ctrl = "test-guest";
        guest.pos.set(site.x + 1, 0, site.z);
        guest.input.btn = BTN.USE;
        guest.defusing = SPIKE.DEFUSE - remaining;
        world.spike.timer = 0.03;
        step(0.05);
        return { state: world.spike.state, atk: world.scoreAtk, def: world.scoreDef };
      };
      const guestLate = guestFinish(0.04), guestEarly = guestFinish(0.02);
      reset();
      for (const actor of world.actors) if (actor.team === "atk") actor.alive = false;
      world.roundTime = 0;
      step(0);
      updateHUD();
      const bar = document.getElementById("tb-spike"), clock = document.getElementById("tb-time");
      const start = { fuse: world.spike.timer, bar: bar?.value, shown: !!bar && !bar.hidden, clockHidden: clock.hidden, phase: world.phase };
      for (let i = 0; i < 400; i++) tickSpikeFuse(0.05);
      updateHUD();
      const bounds = bar?.getBoundingClientRect();
      const middle = { value: bar?.value, phase: world.phase, prompt: document.getElementById("spike").classList.contains("on"), fits: !!bounds && bounds.width > 0 && bounds.left >= 0 && bounds.right <= innerWidth };
      for (let i = 0; i < 399; i++) tickSpikeFuse(0.05);
      const beforeExpiry = world.spike.state;
      step(0.05);
      const expired = { state: world.spike.state, atk: world.scoreAtk, def: world.scoreDef, barHidden: bar?.hidden };
      loadMap("dunes");
      const c = MAP.sites.find(site => site.id === "C");
      const distance = (spawn) => {
        let total = 0, previous = spawn;
        for (const point of findPath(spawn.x, spawn.z, c.x, c.z)) {
          total += Math.hypot(point.x - previous.x, point.z - previous.z);
          previous = point;
        }
        return total;
      };
      const dunes = { clear: !collideXZ(c.x, c.z, 0.02, PR), site: siteAt(c.x, c.z)?.id, atk: distance(MAP.attackSpawn), def: distance(MAP.defendSpawn) };
      return { late, early, guestLate, guestEarly, start, middle, beforeExpiry, expired, dunes };
    });
    console.log(JSON.stringify(out));
    assert.equal(out.late.state, "boom", "the bomb goes off on time with a defuser holding F");
    assert.deepEqual([out.late.atk, out.late.def], [1, 0], "the attackers take the round");
    assert.ok(out.late.t < 2.5, "it blew when the fuse ran out, not when the defuse would have finished: " + out.late.t);
    assert.equal(out.early.state, "defused", "a defuse that finishes in time still wins");
    assert.deepEqual([out.early.atk, out.early.def], [0, 1]);
    assert.deepEqual(out.guestLate, { state: "boom", atk: 1, def: 0 }, "a guest cannot defuse after the deadline inside a step");
    assert.deepEqual(out.guestEarly, { state: "defused", atk: 0, def: 1 }, "a guest can defuse before the deadline inside the same step");
    assert.deepEqual(out.start, { fuse: 40, bar: 1, shown: true, clockHidden: true, phase: "live" });
    assert.equal(out.middle.phase, "live", "the planted spike remains live after all attackers die");
    assert.ok(Math.abs(out.middle.value - 0.5) < 1e-6, "the bar is half full after 20 seconds");
    assert.equal(out.middle.prompt, false, "no planted countdown text is shown");
    assert.ok(out.middle.fits, "the bar fits the small landscape screen");
    assert.equal(out.beforeExpiry, "planted");
    assert.deepEqual(out.expired, { state: "boom", atk: 1, def: 0, barHidden: true });
    assert.ok(out.dunes.clear && out.dunes.site === "C" && out.dunes.def < out.dunes.atk, "the relocated C site is open and reachable sooner from defender spawn");
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("spike fuse: ok");
  } finally {
    await f.browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
