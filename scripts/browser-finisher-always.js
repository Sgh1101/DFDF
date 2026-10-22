const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// A player's round-ending kill always plays the Champions finisher (whatever the gun wears); a bot's never does.
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
    // 2. my last kill of a round, with the plain default skin: the Champions finisher plays, and the round waits for it
    const mine = await p.evaluate(() => {
      room.mode = "std"; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = "live";
      const me = myActor(), victim = world.actors.find((a) => a.team !== me.team);
      for (const a of world.actors) { a.fireCd = 999; if (a.team !== me.team) a.alive = a === victim; }
      me.weapons.primary = "rifle"; me.slot = "primary"; GUN_SKINS.set("rifle", "default");
      victim.hp = 1; victim.armor = victim.invuln = victim.shielded = 0; victim.pos.set(me.pos.x + 8, 0, me.pos.z); victim.y = 0;
      const events = []; addEventListener("kill-confirmed", (e) => events.push(e.detail));
      const at = performance.now();
      DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(me, "rifle", "gun", world.round, "default"), () => dealDamage(victim, 999, false, me));
      checkRoundEnd(); updateHUD();
      const e = events.find((x) => x.victim === victim.id) || {};
      return { skin: e.skin, finisherSkin: e.finisherSkin, finisher: e.finisher, byBot: !!e.byBot, active: FINISHERS.active.size, wait: world.championsFinishUntil - at, team: me.team };
    });
    assert.equal(mine.skin, "default");
    assert.equal(mine.finisher, true, JSON.stringify(mine));
    assert.equal(mine.finisherSkin, mine.team === "atk" ? "champions_atk" : "champions_def");
    assert.equal(mine.byBot, false);
    assert.ok(mine.active > 0, "the finisher is on screen");
    assert.ok(mine.wait > 7000 && mine.wait <= 8100, "the round waits for the Champions finisher: " + mine.wait);
    // 3. the same in the next round (every round), still with the default skin
    const again = await p.evaluate(async () => {
      startRound(); closeShop(); ADMIN.freezeAI = true; world.phase = "live";
      const me = myActor(), victim = world.actors.find((a) => a.team !== me.team);
      for (const a of world.actors) { a.fireCd = 999; if (a.team !== me.team) a.alive = a === victim; }
      me.weapons.primary = "rifle"; me.slot = "primary";
      victim.hp = 1; victim.armor = victim.invuln = victim.shielded = 0; victim.pos.set(me.pos.x + 8, 0, me.pos.z); victim.y = 0;
      const events = []; addEventListener("kill-confirmed", (e) => events.push(e.detail));
      DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(me, "rifle", "gun", world.round, "default"), () => dealDamage(victim, 999, false, me));
      checkRoundEnd();
      const e = events.find((x) => x.victim === victim.id) || {};
      return { finisher: e.finisher, active: FINISHERS.active.size, round: world.round };
    });
    assert.equal(again.finisher, true, JSON.stringify(again));
    assert.ok(again.active > 0);
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
    console.log("Finisher every round for a player's last kill (default skin too); none for a bot; bots wear a skin on every gun up to Legendary, never Transcendent. Browser only.");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
