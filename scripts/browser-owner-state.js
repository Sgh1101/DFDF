const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Owner and admin switches that must not outlive what they were set for:
//  - unlimited abilities for everyone (the room-wide switch) are saved with the other room settings but start off on
//    the next visit, like every other cheat switch (a copy of the saved settings in browser storage cannot turn it on);
//  - what the owner does to one player in a match (unkillable, pinned in place) belongs to that match: the next match
//    builds new actors with the same numbers, and none of them may come out protected or stuck.
(async () => {
  const f = await fixture(), problems = [];
  try {
    const page = await f.page("ownerstate", { width: 1280, height: 720 }, {}, {
      bootTimeout: 120000,
      beforeLoad: (p) => p.addInitScript(() => {
        if (!sessionStorage.getItem("owner_state_seeded")) { sessionStorage.setItem("owner_state_seeded", "1"); localStorage.setItem("lgp_gadm", JSON.stringify({ infAll: true, roundT: 100 })); }
      }),
    });
    const boot = await page.evaluate(() => ({ infAll: ADMIN2.G.infAll, infAbil: ADMIN.infAbil }));
    console.log(JSON.stringify({ boot }));
    boot.infAll || boot.infAbil ? problems.push("unlimited abilities start on from the saved settings: " + JSON.stringify(boot)) : 0;
    const live = () => page.evaluate(async () => {
      titleCam = () => {}; room.mode = "dm"; room.map = "field";
      startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 1e5; ADMIN.freezeAI = true;
      await new Promise((r) => setTimeout(r, 800));
    });
    await live();
    const refilled = await page.evaluate(async () => {
      const me = myActor(); me.abilities[0].cd = 9; me.abilities[0].charges = 0;
      await new Promise((r) => setTimeout(r, 500));
      return me.abilities[0].cd === 0 && me.abilities[0].charges > 0;
    });
    refilled && problems.push("abilities are refilled for free");
    const first = await page.evaluate(() => {
      const me = myActor(), others = world.actors.filter((a) => a !== me && a.alive), bot = others[0], mate = others[1];
      OWNER_UI.run({ op: "god", id: bot.id, v: 1 }); OWNER_UI.run({ op: "bind", id: mate.id, v: 1 });
      bot.hp = 100; bot.armor = 0; bot.invuln = 0; dealDamage(bot, 60, false, me);
      return { bot: bot.id, mate: mate.id, hp: bot.hp };
    });
    assert.equal(first.hp, 100, "the owner's unkillable player takes no damage");
    await live();
    const next = await page.evaluate(async (first) => {
      const me = myActor(), bot = world.actors.find((a) => a.id === first.bot), mate = world.actors.find((a) => a.id === first.mate);
      await new Promise((r) => setTimeout(r, 400));
      const out = { god: [...OWNER_UI.OWN.god], bind: [...OWNER_UI.OWN.bind], botIsMe: bot === me, mateIsMe: mate === me, mateRoot: mate.root };
      if (bot !== me) { bot.alive = true; bot.hp = 100; bot.armor = 0; bot.invuln = 0; dealDamage(bot, 60, false, me); out.hp = bot.hp; }
      return out;
    }, first);
    console.log(JSON.stringify({ next }));
    next.god.length && problems.push("a player stays unkillable into the next match: " + next.god);
    next.bind.length && problems.push("a player stays pinned into the next match: " + next.bind);
    !next.botIsMe && !(next.hp < 100) && problems.push("the new player with the unkillable one's number takes no damage");
    !next.mateIsMe && next.mateRoot > 0 && problems.push("the new player with the pinned one's number cannot move");
    assert.deepEqual(problems, []);
    assert.deepEqual(f.errors, []);
    console.log("owner state: unlimited abilities start off; unkillable and pinned players are cleared when the next match starts");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
