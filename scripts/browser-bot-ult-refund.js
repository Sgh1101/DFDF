const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// An ultimate that finds no target hands its charge back ("대상이 없습니다 — 궁극기 반환"). A bot zeroed the charge
// after the cast, so the refund was thrown away: a bot with nobody in front of it lost its ultimate. Here a bot with
// a full charge casts 연쇄 뇌격 with nobody in view (the charge must stay), then 빙결 which always lands (it goes).
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("botultrefund", { width: 1280, height: 720 });
    const out = await page.evaluate(() => {
      render = () => {};
      titleCam = () => {};
      room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop();
      world.phase = "live"; world.roundTime = 999;
      const me = myActor(), bot = world.actors.find((a) => a !== me && isAI(a));
      for (const a of world.actors) if (a !== bot) a.pos.set(150, 0, 150);
      bot.pos.set(0, 0, 0); bot.yaw = 0; bot.silenced = 0;
      const cast = (agentId) => {
        const ag = AGENTS.find((a) => a.id === agentId);
        bot.agent = ag;
        bot.abilities = ag.abilities.map((d) => ({ def: d, cd: d.ult ? 0 : 999, charges: 0 }));
        bot.ultMax = ag.abilities.find((d) => d.ult).ult; bot.ultCharge = bot.ultMax;
        const ok = aiUseSkill(bot, null);
        return { ok, charge: bot.ultCharge, max: bot.ultMax };
      };
      return { refund: cast("danbi"), land: cast("seorin") };
    });
    console.log(JSON.stringify(out));
    assert.ok(out.refund.ok, "the bot tried the ultimate");
    assert.equal(out.refund.charge, out.refund.max, "no target: the charge comes back");
    assert.ok(out.land.ok);
    assert.equal(out.land.charge, 0, "an ultimate that lands spends its charge");
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("bot ult refund: ok");
  } finally {
    await f.browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
