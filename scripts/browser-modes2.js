const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Knife Fight and Gun Game: the loadouts the host keeps, the ladder going up on a kill and
// down on a knife death, the last step won with the knife, bots closing in with a knife,
// no shop. And the 1v1 maps: a death in a respawn mode comes back, a lost round revives.
(async () => {
  const f = await fixture();
  try {
    const run = async (id, map, mode, fn, arg) => {
      const page = await f.page(id);
      await page.evaluate(([map, mode]) => { titleCam = () => {}; render = () => {}; room.mode = mode; room.map = map; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; }, [map, mode]);
      await page.waitForTimeout(700);
      const out = await page.evaluate(fn, arg);
      await page.close();
      return out;
    };
    // ── knife fight ──
    const knife = await run("kf", "g05", "knife", async () => {
      const me = myActor(), all = world.actors;
      for (let i = 0; i < 5; i++) step(1 / 60);
      const loadouts = all.map((a) => [a.weapons.primary, a.weapons.secondary, a.slot].join("/"));
      const before = player.weapons.primary;
      applyPurchase(me, "weapon", "rifle");
      const shopBlocked = me.weapons.primary === null;
      openShop();
      // a bot with a knife walks in and cuts only in reach
      const bot = all.find((a) => a !== me && a.alive);
      ADMIN.freezeAI = false;
      bot.pos.set(me.pos.x + 8, 0, me.pos.z); bot.ai.state = "fight"; bot.ai.lastSeen = { x: me.pos.x, z: me.pos.z };
      let fired = 0; const _af = actorFire; actorFire = function (e) { e === bot && fired++; return _af.apply(this, arguments); };
      aiThink(bot, 1 / 60);
      const far = { mv: bot.input.mv.slice(), fired: fired };
      return { loadouts, before, shopBlocked, shopOpen: !document.getElementById("shop").hidden, far, name: GAME_MODES.knife.name, kills: GAME_MODES.knife.kills };
    });
    console.log("knife", JSON.stringify(knife));
    assert.ok(knife.loadouts.every((l) => l === "//knife"), "everyone holds only the knife: " + knife.loadouts.join(" "));
    assert.ok(knife.shopBlocked && !knife.shopOpen, "no buying, no shop");
    assert.equal(knife.far.mv[1], -1, "a knife bot walks in");
    assert.equal(knife.far.fired, 0, "and does not swing from 8 m");
    // ── gun game ──
    const gun = await run("gg", "g05", "gun", async () => {
      const me = myActor(), L = GUN_GAME.LADDER, res = { ladder: L.slice() };
      for (let i = 0; i < 5; i++) step(1 / 60);
      res.start = [me.weapons.primary, me.weapons.secondary, me.slot].join("/");
      const foes = world.actors.filter((a) => a !== me);
      const kill = (v) => { v.alive = true; v.invuln = 0; killActor(v, me); step(1 / 60); };
      const seen = [];
      for (let i = 0; i < 4; i++) { kill(foes[i % foes.length]); seen.push(me.kills + ":" + (me.weapons.primary || me.weapons.secondary || "knife")); }
      res.after4 = seen;
      res.hud = (document.getElementById("gg-hud") || {}).textContent || "";
      // knifed by a foe: down a step
      const k0 = me.kills, foe = foes[0]; foe.alive = true; foe.slot = "knife";
      killActor(me, foe); res.knifed = [k0, me.kills];
      // straight to the last step: only the knife, and a knife kill ends it
      me.alive = true; me.kills = L.length - 1; step(1 / 60);
      res.last = [me.weapons.primary, me.weapons.secondary, me.slot].join("/");
      me.slot = "knife"; kill(foes[1]);
      await new Promise((r) => setTimeout(r, 300));
      res.over = world.over; res.phase = world.phase; res.top = world.scoreAtk;
      return res;
    });
    console.log("gun", JSON.stringify(gun));
    assert.equal(gun.ladder.length, 13); assert.equal(gun.ladder[12], "knife");
    assert.equal(gun.start, gun.ladder[0] + "//primary");
    assert.deepEqual(gun.after4.map((s) => s.split(":")[1]), gun.ladder.slice(1, 5), "each kill brings the next gun");
    assert.match(gun.hud, /총기 순환 5\/13/);
    assert.deepEqual(gun.knifed, [4, 3], "a knife death costs a step");
    assert.equal(gun.last, "//knife", "the last step is the knife alone");
    assert.ok(gun.over && gun.top === 13, "a kill on the last step wins: " + JSON.stringify(gun));
    // ── the 1v1 maps: deaths come back ──
    for (const mode of ["dm", "tdm", "gun"]) {
      const r = await run("d" + mode, "d01", mode, async () => {
        const me = myActor(), foe = world.actors.find((a) => a !== me);
        killActor(me, foe);
        // game time, stepped here: a slow or stalling machine does not change the answer
        let t = 0;
        while (!me.alive && t < 6) {
          world.phase = "live";
          step(0.05);
          t += 0.05;
        }
        return { back: me.alive, after: +t.toFixed(2) };
      });
      console.log("1v1", mode, JSON.stringify(r));
      assert.ok(r.back && r.after <= 3.3, "1v1 " + mode + ": back about 3 s (game time) after a death");
    }
    const round = await run("dstd", "d02", "std", async () => {
      const me = myActor(), foe = world.actors.find((a) => a !== me);
      killActor(me, foe);
      const t0 = performance.now();
      while (!(world.round >= 2 && me.alive) && performance.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 200));
      return { round: world.round, alive: me.alive };
    });
    console.log("1v1 std", JSON.stringify(round));
    assert.ok(round.round >= 2 && round.alive, "1v1 rounds: the next round revives");
    assert.deepEqual(f.errors, []);
    console.log("knife fight and gun game: loadouts, ladder, knife demotion, knife win, knife bots, no shop; 1v1 deaths come back");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
