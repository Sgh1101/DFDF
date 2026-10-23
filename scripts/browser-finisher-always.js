const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// A player's round-ending kill plays the finisher of the skin the gun wears: none with the stock skin, the skin's own
// with a legendary, the Champions one (and its 8 s hold) only with a Champions skin; a bot's never does.
// Bots wear a random skin on every gun, any tier but Transcendent.
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("finishalways", { width: 960, height: 540 }, {}, { quality: "perf" });
    await p.waitForFunction(() => CHAMPIONS_PHANTOM.loaded());
    // 1. bots: every gun skinned, none above Legendary, and different bots wear different things
    const bots = await p.evaluate(() => {
      room.mode = "std"; room.map = "field"; room.rounds = 13;
      startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true;
      const me = myActor(), out = { guns: 0, skinned: 0, tiers: new Set(), sets: new Set(), top: 0 };
      for (const a of world.actors) {
        if (a === me || a.ctrl !== "ai") continue;
        const worn = [];
        for (const key of Object.keys(WEAPONS)) {
          const s = GUN_SKINS.skinOf(a, key);
          out.guns++;
          if (s && s.id !== "default") { out.skinned++; out.tiers.add(s.rar); worn.push(key + ":" + s.id); }
          if (s && s.rar >= 5) out.top++;
        }
        out.sets.add(worn.join());
      }
      return { guns: out.guns, skinned: out.skinned, tiers: [...out.tiers].sort(), differentBots: out.sets.size, top: out.top, bots: world.actors.filter((a) => a.ctrl === "ai").length };
    });
    assert.ok(bots.bots >= 4 && bots.guns > 0, JSON.stringify(bots));
    assert.equal(bots.top, 0, "no Transcendent skin on a bot");
    assert.ok(bots.skinned >= bots.guns * 0.9, "bots wear a skin on (nearly) every gun they could: " + JSON.stringify(bots));
    assert.ok(Math.max(...bots.tiers) <= 4 && bots.tiers.length >= 2, "a spread of tiers up to Legendary: " + JSON.stringify(bots.tiers));
    assert.ok(bots.differentBots >= 2, "bots do not all wear the same skins");
    // 2. my last kill of a round with each kind of skin: the stock skin has none, a legendary its own finisher and no
    //    Champions hold, the Champions Phantom the Champions finisher with the round waiting for it
    const mine = await p.evaluate(() => {
      const one = (gun, skin) => {
        room.mode = "std"; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = "live"; world.championsFinishUntil = 0;
        const me = myActor(), victim = world.actors.find((a) => a.team !== me.team);
        for (const a of world.actors) { a.fireCd = 999; if (a.team !== me.team) a.alive = a === victim; }
        me.weapons.primary = gun; me.slot = "primary"; GUN_SKINS.set(gun, skin);
        victim.hp = 1; victim.armor = victim.invuln = victim.shielded = 0; victim.pos.set(me.pos.x + 8, 0, me.pos.z); victim.y = 0;
        const events = [], on = (e) => events.push(e.detail); addEventListener("kill-confirmed", on);
        const legend = [], play = FINISHER_LEGEND.play; FINISHER_LEGEND.play = function (e, sk) { legend.push(sk && sk.id); return play.apply(this, arguments); };
        const at = performance.now();
        DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(me, gun, "gun", world.round, skin), () => dealDamage(victim, 999, false, me));
        checkRoundEnd(); updateHUD();
        FINISHER_LEGEND.play = play; removeEventListener("kill-confirmed", on);
        const e = events.find((x) => x.victim === victim.id) || {};
        return { skin: e.skin, finisherSkin: e.finisherSkin || null, finisher: !!e.finisher, byBot: !!e.byBot, active: FINISHERS.active.size, legend: legend.join(), wait: (world.championsFinishUntil || 0) - at };
      };
      return { plain: one("rifle", "default"), lava: one("rifle", "lava"), wave: one("smg", "champion"), champions: one(VALORANT_DATA.championsWeapon, "champions_atk") };
    });
    assert.equal(mine.plain.finisherSkin, null, "no skin is put in place of the gun's: " + JSON.stringify(mine.plain));
    assert.equal(mine.plain.finisher, false, "no finisher with the stock skin");
    assert.ok(mine.plain.wait <= 0, "and no Champions hold");
    for (const k of ["lava", "wave"]) {
      assert.equal(mine[k].finisher, true, k + ": " + JSON.stringify(mine[k]));
      assert.equal(mine[k].legend, mine[k].skin, k + " plays its own legendary finisher");
      assert.ok(mine[k].wait <= 0, k + " does not hold the round like the Champions finisher");
    }
    assert.equal(mine.champions.finisher, true, JSON.stringify(mine.champions));
    assert.ok(mine.champions.active > 0, "the Champions finisher is on screen");
    assert.ok(mine.champions.wait > 7000 && mine.champions.wait <= 8100, "the round waits for the Champions finisher: " + mine.champions.wait);
    // 4. a bot's round-ending kill: no finisher, no hold
    const bot = await p.evaluate(() => {
      startRound(); closeShop(); ADMIN.freezeAI = true; world.phase = "live";
      const me = myActor(), killer = world.actors.find((a) => a.team !== me.team && a.ctrl === "ai");
      for (const a of world.actors) { a.fireCd = 999; if (a.team === me.team) a.alive = a === me; }
      me.hp = 1; me.armor = me.invuln = me.shielded = 0;
      killer.weapons.primary = "rifle"; killer.slot = "primary";
      const events = []; addEventListener("kill-confirmed", (e) => events.push(e.detail));
      const at = performance.now(), before = world.championsFinishUntil || 0;
      DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(killer, "rifle", "gun", world.round, "champion"), () => dealDamage(me, 999, false, killer));
      checkRoundEnd();
      const e = events.find((x) => x.victim === me.id) || {};
      return { finisher: e.finisher, byBot: !!e.byBot, hold: (world.championsFinishUntil || 0) > at + 1000 && world.championsFinishUntil !== before, active: FINISHERS.active.size };
    });
    assert.equal(bot.byBot, true, JSON.stringify(bot));
    assert.equal(bot.finisher, false);
    assert.equal(bot.hold, false);
    assert.equal(bot.active, 0);
    assert.deepEqual(f.errors, []);
    console.log("A player's last kill plays its own skin's finisher (none for the stock skin, Champions only for Champions); none for a bot; bots wear a skin on every gun up to Legendary, never Transcendent. Browser only.");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
