const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 전설 마무리: the round's last kill with a legendary skin in a standard match turns the world's sky and plays the skin's
// own figure; any other skin now plays the Champions finisher (no sky); every legendary's figure runs clean and the sky comes back.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("fin", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const out = await page.evaluate(() => {
      const res = {}, me = myActor(), foes = world.actors.filter((o) => o.team !== me.team);
      const sky = () => scene.background.getHex();
      const base = sky();
      const lastKill = (skin) => {
        world.round++; startRound(); world.phase = "live";
        for (const o of foes) { o.alive = o === foes[0]; }
        const v = foes[0]; v.alive = true; v.hp = 1; v.armor = v.shielded = 0; v.invuln = me.invuln = 0;
        v.pos.set(me.pos.x + 6, 0, me.pos.z);
        me.weapons.primary = "rifle"; me.slot = "primary"; GUN_SKINS.set("rifle", skin);
        const n = fx.length;
        DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(me, "rifle", "gun", world.round, skin), () => dealDamage(v, 999, false, me));
        return fx.length - n;
      };
      res.legendAdded = lastKill("champion");
      res.activeLegend = FINISHERS.active.size;
      for (let i = 0; i < 22; i++) step(0.05);
      res.skyDuring = sky() !== base;
      for (let i = 0; i < 144; i++) step(0.05);
      res.skyAfter = sky() === base;
      res.plainAdded = lastKill("default");
      res.activePlain = FINISHERS.active.size;
      for (let i = 0; i < 40; i++) step(0.05);
      res.skyPlain = sky() === base;
      // a rare skin: the ordinary ring only
      res.rareActive = (lastKill("koi"), FINISHERS.active.size);
      // every legendary's figure, one after another, and the sky back
      res.themes = {};
      for (const id of Object.keys(FINISHER_LEGEND.themes)) {
        world.round++; startRound(); world.phase = "live";
        const ok = FINISHER_LEGEND.play({ x: me.pos.x + 5, y: 1, z: me.pos.z }, { id });
        for (let i = 0; i < (id === "champion" ? 162 : 70); i++) step(0.05);
        res.themes[id] = ok && sky() === base;
      }
      // a new round ends one in the middle
      lastKill("champion"); for (let i = 0; i < 8; i++) step(0.05);
      const mid = sky() !== base; world.round++; startRound();
      res.roundEnds = mid && sky() === base;
      return res;
    });
    console.log(JSON.stringify(out));
    assert.ok(out.legendAdded >= 2, "figure and sky: " + out.legendAdded);
    assert.equal(out.activeLegend, 2);
    assert.equal(out.skyDuring, true); assert.equal(out.skyAfter, true);
    // a player's round-ending kill always plays the Champions finisher, even with the stock or a rare skin
    assert.ok(out.activePlain >= 1, "the Champions finisher with the stock skin");
    assert.equal(out.skyPlain, true, "and it does not tint the sky like a legendary");
    assert.ok(out.rareActive >= 1);
    assert.ok(Object.keys(out.themes).length >= 12);
    for (const [k, v] of Object.entries(out.themes)) assert.equal(v, true, k);
    assert.equal(out.roundEnds, true);
    assert.deepEqual(f.errors, []);
    console.log("finisher: legendary last kill turns the sky and draws its figure, any other skin gets the Champions finisher without the sky, the sky comes back");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
