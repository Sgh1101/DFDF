const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Bots round corners instead of standing against them. A bot passed every route point within 5.5 m for the next one
// even when the next one lay behind the wall the route went round, and never planned its route again on the way;
// on neon one going from the attack spawn toward the south-east roof or the defenders' north lane stopped against
// the end of the long wall at x≈38 for good. Each walk here: one real bot (the game's AI, its goal pointed at the
// spot), everyone else down, the round kept from ending.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("botcorners", { width: 1280, height: 720 });
    const out = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      titleCam = () => {};
      render = () => {};
      room.mode = "std"; room.map = "neon"; startGame(AGENTS[0], false);
      for (let i = 0; i < 100 && !(myActor() && CUR_MAP_KEY === "neon"); i++) await sleep(100);
      closeShop();
      ADMIN.freezeAI = true; world.roundTime = 0.01; step(0.05); world.roundTime = 1e6; ADMIN.freezeAI = false;
      const me = myActor(); me && releaseToAI(me.id);
      const bot = world.actors.find((a) => a.team === "atk"), from = { x: bot.pos.x, z: bot.pos.z, y: bot.y || 0 };
      checkRoundEnd = function () {};
      let target = null;
      const goal = aiGoal;
      aiGoal = function (e) { return e === bot && target ? { x: target.x, z: target.z } : goal.apply(this, arguments); };
      const walk = (to) => {
        for (const a of world.actors) if (a !== bot) { a.alive = false; a.hp = 0; }
        Object.assign(bot, { alive: true, hp: 100, ctrl: "ai", ai: freshAIState(), hasSpike: false, root: 0, slow: 1, y: from.y, vy: 0 });
        bot.pos.x = from.x; bot.pos.z = from.z;
        intelClear(); target = to;
        let best = 1e9, bestAt = 0;
        for (let t = 0; t < 90; t += 0.05) {
          step(0.05);
          const d = Math.hypot(bot.pos.x - to.x, bot.pos.z - to.z);
          if (d < best - 0.3) { best = d; bestAt = t; }
          if (d < 2.5) return { ok: true, t: +t.toFixed(1) };
          if (t - bestAt > 10) break;
        }
        return { ok: false, at: [+bot.pos.x.toFixed(1), +bot.pos.z.toFixed(1)], best: +best.toFixed(1) };
      };
      const res = {};
      for (const k of ["seRoof", "defN"]) res[k] = [walk(MAP.nodes[k]), walk(MAP.nodes[k]), walk(MAP.nodes[k])];
      return res;
    });
    console.log(JSON.stringify(out));
    for (const [k, runs] of Object.entries(out)) runs.forEach((r, i) => assert.ok(r.ok, "neon: a bot from the attack spawn gets to " + k + " (try " + (i + 1) + "): " + JSON.stringify(r)));
    assert.deepEqual(f.errors, []);
    console.log("bot corners: on neon the bot rounds the long wall's end to seRoof and defN, three tries each");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
