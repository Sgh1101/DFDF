const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// A zone that hurts (a wall of fire, lava, a flame pool...) is ticked by the world's step, long after the cast
// returned, when the game's "player" is the human again. It used to name the human as the attacker: a bot's fire
// credited its kills, its damage and its ultimate charge to the human, hurt the human's own side as "the human's"
// damage, and a human standing in it was hurt by the old one-player path (no killer, no kill feed). The zone now
// remembers who laid it. Here a bot (the player's foe) lays a damaging zone on the human's teammate and on the
// human, and the human lays one on a bot.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("zoneowner", { width: 1280, height: 720 });
    const out = await page.evaluate(() => {
      render = () => {};
      titleCam = () => {};
      room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop();
      world.phase = "live"; world.roundTime = 9999;
      aiThink = function () {}; checkRoundEnd = function () {};
      const me = myActor(),
        bot = world.actors.find((a) => a.team !== me.team),
        foes = world.actors.filter((a) => a.team === me.team && a !== me),
        mates = world.actors.filter((a) => a.team === bot.team && a !== bot);
      const hits = [], kills = [];
      const _dd = dealDamage; dealDamage = function (v, n, h, att) { hits.push({ victim: v && v.id, att: att && att.id }); return _dd.apply(this, arguments); };
      const _ka = killActor; killActor = function (v, k) { kills.push({ victim: v && v.id, killer: k && k.id }); return _ka.apply(this, arguments); };
      const put = (a, x, z, hp) => {
        a.pos.x = x; a.pos.z = z; a.y = 0;
        Object.assign(a, { alive: true, hp, armor: 0, invuln: 0, shielded: 0, undying: 0, vuln: 0 });
      };
      const park = () => world.actors.forEach((a, i) => put(a, 60 + 4 * i, 60, 100));
      const run = (n) => { for (let i = 0; i < n; i++) step(0.1); };
      const res = {};
      // 1. the bot's fire on the human's teammate: the teammate burns down, the bot is the killer
      park(); hits.length = kills.length = 0;
      const stats0 = { kills: world.stats.kills, dmg: world.stats.dmg, ult: me.ultCharge };
      put(bot, 0, 0, 100); put(foes[0], 0, -6, 20);
      withCaster(bot, () => makeZone(0, -6, 4, 2, 6, 0xff5a3c, { dps: 30, name: "test" }));
      run(12);
      res.mate = { alive: foes[0].alive, hits: hits.filter((h) => h.victim === foes[0].id).map((h) => h.att), kills: kills.slice(), humanStats: [world.stats.kills - stats0.kills, world.stats.dmg - stats0.dmg, me.ultCharge - stats0.ult] };
      // 2. the human stands in the bot's fire: hurt as the bot's doing, and dies with the bot named as the killer
      park(); hits.length = kills.length = 0;
      put(bot, 0, 0, 100); put(me, 0, -6, 15);
      withCaster(bot, () => makeZone(0, -6, 4, 2, 6, 0xff5a3c, { dps: 30, name: "test" }));
      run(12);
      res.human = { alive: me.alive, hits: hits.filter((h) => h.victim === me.id).map((h) => h.att), kills: kills.filter((k) => k.victim === me.id) };
      // 3. the human's own fire on a bot: still the human's
      park(); hits.length = kills.length = 0;
      me.alive = true; put(me, 0, 0, 100); put(bot, 0, -6, 20);
      const s1 = world.stats.kills;
      makeZone(0, -6, 4, 2, 6, 0xff5a3c, { dps: 30, name: "test" });
      run(12);
      res.own = { alive: bot.alive, kills: kills.slice(), humanKills: world.stats.kills - s1, att: hits.filter((h) => h.victim === bot.id).map((h) => h.att) };
      res.ids = { me: me.id, bot: bot.id };
      return res;
    });
    console.log(JSON.stringify(out));
    const { me, bot } = out.ids;
    assert.equal(out.mate.alive, false, "the teammate burns down");
    assert.ok(out.mate.hits.length > 0 && out.mate.hits.every((a) => a === bot), "the bot's fire hurts as the bot: " + JSON.stringify(out.mate.hits));
    assert.deepEqual(out.mate.kills, [{ victim: out.mate.kills[0] && out.mate.kills[0].victim, killer: bot }], "the kill is the bot's");
    assert.deepEqual(out.mate.humanStats, [0, 0, 0], "nothing is credited to the human: kills, damage, ultimate");
    assert.equal(out.human.alive, false, "the human dies in the fire");
    assert.ok(out.human.hits.length > 0 && out.human.hits.every((a) => a === bot), "the human is hurt as the bot's doing: " + JSON.stringify(out.human.hits));
    assert.deepEqual(out.human.kills, [{ victim: me, killer: bot }], "the human's death names the bot");
    assert.equal(out.own.alive, false, "the human's own fire burns the bot");
    assert.ok(out.own.att.every((a) => a === me), "the human's own fire is the human's");
    assert.deepEqual(out.own.kills.map((k) => k.killer), [me]);
    assert.equal(out.own.humanKills, 1, "and counts for the human");
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("zone owner: ok");
  } finally {
    await f.browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
