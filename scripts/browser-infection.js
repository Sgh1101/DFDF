const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Infection: one infected to start (a knife, 100 armour, quicker), the rest survivors with a
// gun; a survivor the infected kills joins them (after the 3 s), no shop, bots with a knife close
// in; the survivors win on the clock, the infected when none are left; a guest takes the host's
// word on who is infected.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("infect", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; render = () => {}; room.mode = "inf"; room.map = "g05"; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      world.phase = "live";
      const me = myActor(), all = world.actors, out = { mode: GAME_MODES.inf.name };
      // the start, read at once (the bots in the page's own loop shoot the infected meanwhile)
      INFECTION.begin();
      const inf = all.filter((a) => a.team === "atk"), sv = all.filter((a) => a.team === "def");
      out.start = { infected: inf.length, survivors: sv.length, total: all.length, first: !!INFECTION.first() && INFECTION.first() === inf[0] };
      out.infKit = inf.map((a) => [a.weapons.primary, a.weapons.secondary, a.slot, a.armor, a.speedBuff > 1.1]);
      out.survKit = sv.every((a) => a.weapons.primary && a.slot === "primary");
      out.scores = [world.scoreDef, world.scoreAtk];
      for (const a of all) a.hp = 100;
      // no shop and no buying
      applyPurchase(sv[0], "weapon", "sniper");
      openShop();
      out.shop = { bought: sv[0].weapons.primary === "sniper", open: !document.getElementById("shop").hidden };
      // a survivor killed by the infected joins them
      const it = inf[0], victim = sv[0];
      for (const a of all) if (a !== it) a.invuln = 0;
      victim.alive = true; it.alive = true;
      const k0 = it.kills | 0;
      killActor(victim, it);
      step(1 / 60);
      out.caught = { team: victim.team, kills: it.kills - k0, scores: [world.scoreDef, world.scoreAtk], dead: !victim.alive };
      // after its respawn time: a knife, the infected spawn
      for (let i = 0; i < 70; i++) step(0.05);
      out.risen = { alive: victim.alive, team: victim.team, kit: [victim.weapons.primary, victim.weapons.secondary, victim.slot].join("/"), fast: victim.speedBuff > 1.1 };
      // a survivor that dies to anything else (the infected's team does not shoot its own)
      const friend = all.find((a) => a !== victim && a.team === "atk" && a !== it);
      out.hud = document.getElementById("inf-hud").textContent;
      // a bot with a knife walks in
      const bot = all.find((a) => a !== me && a.team === "atk" && a.alive && a !== me);
      const foe = all.find((a) => a.team === "def" && a.alive && a !== me) || me;
      if (bot && foe && bot !== foe) {
        ADMIN.freezeAI = false;
        // everyone else far away, so the bot's target is the one we set
        for (const a of all) a !== bot && a !== foe && a.pos.set(foe.pos.x + 70 + a.id * 3, 0, foe.pos.z + 70);
        bot.pos.set(foe.pos.x + 9, 0, foe.pos.z); bot.ai.state = "fight"; bot.ai.lastSeen = { x: foe.pos.x, z: foe.pos.z };
        let fired = 0; const _af = actorFire; actorFire = function (e) { e === bot && fired++; return _af.apply(this, arguments); };
        aiThink(bot, 1 / 60);
        out.bot = { mv: bot.input.mv.slice(), fired };
        ADMIN.freezeAI = true;
      }
      // the last survivor falls: the infected win
      for (const a of all) a.invuln = 0;
      let guard = 0;
      while (all.some((a) => a.team === "def") && guard++ < 20) {
        const s2 = all.find((a) => a.team === "def"); s2.alive = true; killActor(s2, it); step(1 / 60);
      }
      await new Promise((r) => setTimeout(r, 400));
      out.end = { over: world.over, phase: world.phase, scores: [world.scoreDef, world.scoreAtk] };
      await new Promise((r) => setTimeout(r, 2800));
      out.result = { phase: world.phase, head: document.getElementById("ov-head").textContent, score: document.getElementById("ov-score").textContent };
      return out;
    });
    console.log(JSON.stringify(r));
    assert.equal(r.mode, "감염");
    assert.deepEqual(r.start, { infected: 1, survivors: r.start.total - 1, total: r.start.total, first: true });
    assert.deepEqual(r.infKit[0].slice(0, 3), [null, null, "knife"]); assert.equal(r.infKit[0][3], 100, "the first infected: 100 armour"); assert.ok(r.infKit[0][4]);
    assert.ok(r.survKit, "survivors hold a gun");
    assert.deepEqual(r.scores, [r.start.total - 1, 1]);
    assert.deepEqual(r.shop, { bought: false, open: false });
    assert.equal(r.caught.team, "atk"); assert.equal(r.caught.kills, 1); assert.ok(r.caught.scores[0] <= r.start.total - 2 && r.caught.scores[1] >= 2 && r.caught.scores[0] + r.caught.scores[1] === r.start.total, "the counts move (a bot may have caught one too): " + JSON.stringify(r.caught.scores));
    assert.ok(r.risen.alive && r.risen.team === "atk" && r.risen.kit === "//knife" && r.risen.fast, "the caught one is back as infected: " + JSON.stringify(r.risen));
    assert.match(r.hud, /생존자 \d+ · 감염 [2-9]/, "the bar counts both sides");
    assert.ok(!r.bot || (r.bot.mv[1] === -1 && r.bot.fired === 0), "an infected bot walks in and does not cut from afar");
    assert.ok(r.end.over && r.end.scores[0] === 0 && r.end.scores[1] === r.start.total, "nobody left: " + JSON.stringify(r.end));
    assert.equal(r.result.head, "승리", "the infected side (this player is the infected) wins");
    assert.equal(r.result.score, "1 : 0");
    // the clock: survivors win
    const clock = await page.evaluate(async () => {
      room.mode = "inf"; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = "live";
      for (let i = 0; i < 5; i++) step(1 / 60);
      const me = myActor();
      world.roundTime = 0.05;
      for (let i = 0; i < 8; i++) step(0.05);
      await new Promise((r) => setTimeout(r, 3200));
      return { over: world.over, mySide: me.team, head: document.getElementById("ov-head").textContent, score: document.getElementById("ov-score").textContent };
    });
    console.log(JSON.stringify(clock));
    assert.ok(clock.over);
    assert.equal(clock.head, clock.mySide === "def" ? "승리" : "패배", "the survivors win on the clock");
    assert.deepEqual(f.errors, []);
    await page.close();
    // ── online: the guest sees the same infected, and one caught after the start ──
    const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
    let signaling = null;
    await new Promise((resolve) => PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); }));
    try {
      const host = await f.page("infhost"), guest = await f.page("infguest");
      for (const p of [host, guest]) await p.evaluate(async () => {
        render = () => {}; titleCam = () => {};
        await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
      });
      const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
      await guest.evaluate((code) => joinRoom(code), code);
      await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
      await host.evaluate(() => { room.mode = "inf"; room.map = "g05"; hostStartMatch(); });
      await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor() && room.mode === "inf", null, { timeout: 90000 });
      await host.evaluate(() => { world.phase = "live"; ADMIN.freezeAI = true; });
      const sides = (page) => page.evaluate(() => world.actors.map((a) => a.id + ":" + a.team).sort().join(","));
      await guest.waitForFunction(async () => world.actors.some((a) => a.team === "atk"), null, { timeout: 15000 });
      await guest.waitForFunction(async (h) => world.actors.map((a) => a.id + ":" + a.team).sort().join(",") === h, await sides(host), { timeout: 10000 }).catch(() => {});
      assert.equal(await sides(guest), await sides(host), "the same infected on both screens");
      assert.ok(await host.evaluate(() => world.actors.filter((a) => a.team === "atk").length) >= 1);
      // a survivor caught on the host reaches the guest (and the bar)
      const caught = await host.evaluate(() => {
        const it = INFECTION.first(), v = world.actors.find((a) => a.team === "def" && a.alive);
        for (const a of world.actors) a.invuln = 0;
        killActor(v, it);
        return v.id;
      });
      await guest.waitForFunction((id) => { const a = actorById(id); return a && a.team === "atk"; }, caught, { timeout: 15000 });
      await guest.waitForFunction(() => /감염 [2-9]/.test((document.getElementById("inf-hud") || {}).textContent || ""), null, { timeout: 15000 });
      await host.evaluate(() => netShutdown());
      assert.deepEqual(f.errors, []);
      console.log("infection online: the guest sees the same infected, and a catch reaches it");
    } finally { signaling && signaling.close(); }
    console.log("infection: one infected to start, the caught join, no shop, knife bots, the last survivor or the clock ends it");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
