const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// A defender holding F on the planted spike used to keep it from going off: the fuse was only looked at when nobody
// was defusing, so a defuse that began with 2 s left (7 s needed) ended in a defuse 5 s after the spike should have
// blown. The fuse now ends the round the moment it runs out, defuser or not; a defuse that finishes in time still wins.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("spikefuse", { width: 1280, height: 720 });
    const out = await page.evaluate(() => {
      render = () => {};
      titleCam = () => {};
      room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop();
      aiThink = function () {};
      const me = myActor();
      const run = (fuse, hold) => {
        startRound(); world.phase = "live"; world.roundTime = 999; world.over = false;
        world.scoreAtk = world.scoreDef = 0;
        me.team = "def"; me.alive = true; me.hp = 100; me.invuln = 999;
        for (const a of world.actors) if (a !== me) { a.team = "atk"; a.alive = true; a.invuln = 999; a.hp = 100; a.pos.set(0, 0, 90); a.hasSpike = false; }
        const site = MAP.sites[0];
        plantSpike(site.x, site.z, site, false);
        world.spike.timer = fuse;
        me.pos.set(site.x + 1, 0, site.z);
        keys.f = hold;
        let t = 0;
        for (let i = 0; i < 160 && !world.over; i++) { step(0.05); t += 0.05; }
        keys.f = false;
        return { t: +t.toFixed(2), over: world.over, state: world.spike.state, atk: world.scoreAtk, def: world.scoreDef };
      };
      return { late: run(2, true), early: run(30, true) };
    });
    console.log(JSON.stringify(out));
    assert.equal(out.late.state, "boom", "the spike goes off on time with a defuser holding F");
    assert.deepEqual([out.late.atk, out.late.def], [1, 0], "the attackers take the round");
    assert.ok(out.late.t < 2.5, "it blew when the fuse ran out, not when the defuse would have finished: " + out.late.t);
    assert.equal(out.early.state, "defused", "a defuse that finishes in time still wins");
    assert.deepEqual([out.early.atk, out.early.def], [0, 1]);
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("spike fuse: ok");
  } finally {
    await f.browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
