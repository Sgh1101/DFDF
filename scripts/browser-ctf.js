const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
// 깃발 탈취: a flag at each spawn; walk into the other side's flag to take it, carry it to your own
// flag's place (their own flag need not be home); the carrier is slower; a carrier who dies drops it; a
// dropped flag goes home when its own side touches it or after 15 s; the other side picks it up;
// 3 captures win; kills do not score; bots go for flags; a guest sees the same flags.
(async () => {
  const f = await fixture();
  let signaling;
  try {
    const page = await f.page("flagger", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; render = () => {}; room.mode = "ctf"; room.map = "g05"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const C = CTF, F = C.F, me = myActor(), all = world.actors, out = { name: GAME_MODES.ctf.name, listed: [...document.querySelectorAll("#sel-modes button")].length };
      for (let i = 0; i < 5; i++) step(1 / 60);
      const mine = me.team, foeT = mine === "atk" ? "def" : "atk";
      out.homes = { atk: [F.atk.home.x, F.atk.home.z], def: [F.def.home.x, F.def.home.z], spawnA: [MAP.attackSpawn.x, MAP.attackSpawn.z], spawnD: [MAP.defendSpawn.x, MAP.defendSpawn.z] };
      out.hud = !!document.getElementById("ctf-hud") && !document.getElementById("ctf-hud").hidden;
      out.meshes = scene.children.filter((o) => o.userData && o.userData.cloth).length;
      // everyone far away, me beside the enemy flag
      const away = (a, i) => { a.pos.set(MAP.bounds.maxX - 3 - i, 0, MAP.bounds.maxZ - 3); a.invuln = 99; a.alive = true; };
      all.forEach((a, i) => a !== me && away(a, i));
      me.alive = true; me.invuln = 99;
      const foe = F[foeT], own = F[mine];
      // an own flag home does nothing for me, the other one is taken on touch
      me.pos.set(own.home.x, 0, own.home.z); step(0.1);
      out.ownUntouched = own.st === "home" && !C.carrying(me);
      me.pos.set(foe.home.x, foe.home.y, foe.home.z); step(0.1);
      out.taken = { st: foe.st, by: foe.by === me.id, carrying: !!C.carrying(me) };
      // the carrier is slower
      step(0.1);
      out.slow = me.speedBuff;
      // the flag follows me
      me.pos.set(foe.home.x + 20, 0, foe.home.z); step(0.1);
      out.follows = Math.abs(foe.x - me.pos.x) < 0.01;
      // coming home scores even with the own flag away (a stalled game helps nobody)
      own.st = "carried"; own.by = all.find((a) => a !== me && a.team === foeT).id;
      me.pos.set(own.home.x, own.home.y, own.home.z); step(0.1);
      out.scored = { caps: C.caps[mine], score: mine === "atk" ? world.scoreAtk : world.scoreDef, flagHome: foe.st === "home", dropped: !C.carrying(me), other: C.caps[foeT] };
      // a carrier who dies drops it on the spot; kills do not score
      const sa = world.scoreAtk, sd = world.scoreDef;
      me.pos.set(foe.home.x, foe.home.y, foe.home.z); step(0.1);
      me.pos.set(foe.home.x + 15, 0, foe.home.z + 4); step(0.1);
      me.invuln = 0;
      const killer = all.find((a) => a !== me && a.team === foeT);
      killActor(me, killer);
      out.dropped = { st: foe.st, nearDeath: Math.hypot(foe.x - (foe.home.x + 15), foe.z - (foe.home.z + 4)) < 0.1, scoresKept: world.scoreAtk === sa && world.scoreDef === sd, speed: me.speedBuff };
      // the foe side touches it: nothing (it is its own flag? no: it belongs to foe; foe touching returns it)
      const mate = all.find((a) => a !== me && a.team === foeT);
      mate.pos.set(foe.x, foe.y, foe.z); step(0.1);
      out.returned = { st: foe.st, atHome: Math.hypot(foe.x - foe.home.x, foe.z - foe.home.z) < 0.01 };
      mate.pos.set(MAP.bounds.maxX - 3, 0, MAP.bounds.maxZ - 3);
      // drop again, my side picks it up again, and a dropped flag goes home by itself after 15 s
      me.alive = true; me.invuln = 99; me.pos.set(foe.home.x, foe.home.y, foe.home.z); step(0.1);
      C.drop(foe, foe.home.x + 9, foe.home.z); me.pos.set(0, 0, 0); step(0.1);
      out.down = foe.st;
      for (let i = 0; i < 100; i++) step(0.2);
      out.timeout = { st: foe.st, atHome: Math.hypot(foe.x - foe.home.x, foe.z - foe.home.z) < 0.01 };
      // a dropped flag is taken by an enemy of it
      C.drop(Object.assign(foe, { st: "carried" }), foe.home.x + 9, foe.home.z);
      me.alive = true; me.pos.set(foe.x, foe.y, foe.z); step(0.1);
      out.retaken = { st: foe.st, by: foe.by === me.id };
      // bots: a goal for each
      C.sendHome(F[mine]); C.sendHome(F[foeT]);
      const bots = all.filter((a) => a !== me);
      out.goals = bots.map((b) => { const g = aiGoal(b), tf = F[b.team === "atk" ? "def" : "atk"], of = F[b.team]; return { team: b.team, toFoe: Math.hypot(g.x - tf.x, g.z - tf.z) < 1, toOwn: Math.hypot(g.x - of.home.x, g.z - of.home.z) < 10 }; });
      // a bot carrying heads home
      const cb = bots.find((b) => b.team === foeT);
      C.pickUp(F[mine], cb);
      const g2 = aiGoal(cb);
      out.carryGoalHome = Math.hypot(g2.x - F[foeT].home.x, g2.z - F[foeT].home.z) < 2;
      // 3 captures end the match
      C.caps[mine] = 2; world.scoreAtk = C.caps.atk; world.scoreDef = C.caps.def;
      C.sendHome(F[mine]); C.sendHome(F[foeT]);
      me.alive = true; me.pos.set(F[foeT].home.x, F[foeT].home.y, F[foeT].home.z); step(0.1);
      me.pos.set(F[mine].home.x, F[mine].home.y, F[mine].home.z); step(0.1);
      out.final = { caps: C.caps[mine], over: world.over, phase: world.phase };
      return out;
    });
    console.log(JSON.stringify(r));
    assert.equal(r.name, "깃발 탈취"); assert.ok(r.listed >= 10, "the mode is in the list");
    assert.deepEqual(r.homes.atk, r.homes.spawnA); assert.deepEqual(r.homes.def, r.homes.spawnD);
    assert.ok(r.hud && r.meshes === 2, "the bar and two flags");
    assert.ok(r.ownUntouched, "your own flag at home is left alone");
    assert.deepEqual(r.taken, { st: "carried", by: true, carrying: true });
    assert.ok(r.slow < 1 && r.slow > 0.8, "the carrier is slower: " + r.slow);
    assert.ok(r.follows);
    assert.deepEqual(r.scored, { caps: 1, score: 1, flagHome: true, dropped: true, other: 0 });
    assert.ok(r.dropped.st === "dropped" && r.dropped.nearDeath && r.dropped.scoresKept && r.dropped.speed === 1, JSON.stringify(r.dropped));
    assert.deepEqual(r.returned, { st: "home", atHome: true }, "its own side returns it by touch");
    assert.equal(r.down, "dropped");
    assert.deepEqual(r.timeout, { st: "home", atHome: true }, "a dropped flag goes home after 15 s");
    assert.deepEqual(r.retaken, { st: "carried", by: true });
    for (const g of r.goals) assert.ok(g.toFoe || g.toOwn, "a bot has a flag goal " + JSON.stringify(g));
    assert.ok(r.goals.some((g) => g.toFoe) && r.goals.some((g) => g.toOwn), "some go for the flag, some guard");
    assert.ok(r.carryGoalHome, "a carrier heads home");
    assert.deepEqual(r.final, { caps: 3, over: true, phase: "end" });
    // a round of bots playing, with the AI on: do they take flags?
    const bots = await page.evaluate(async () => {
      ADMIN.freezeAI = false; room.map = "nightport"; startGame(AGENTS[0], false); closeShop(); world.phase = "live";
      const me = myActor(); me.pos.set(MAP.bounds.maxX - 4, 0, MAP.bounds.maxZ - 4); me.invuln = 99;
      let took = 0, scored = 0;
      for (let i = 0; i < 6000; i++) { step(0.05); if (CTF.F.atk.st !== "home" || CTF.F.def.st !== "home") took++; if (CTF.caps.atk + CTF.caps.def > scored) scored = CTF.caps.atk + CTF.caps.def; }
      return { took, scored };
    });
    console.log(JSON.stringify(bots));
    assert.ok(bots.took > 20, "bots pick flags up: " + JSON.stringify(bots));
    await page.screenshot({ path: (process.env.SHOT_DIR || "/tmp") + "/ctf.png" });
    // online: a guest sees the flags the host moves
    await new Promise((resolve) => { const peer = PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (s) => { signaling = s; resolve(); }); });
    const host = await f.page("ctfhost"), guest = await f.page("ctfguest");
    for (const p of [host, guest]) await p.evaluate(async () => { render = () => {}; titleCam = () => {}; await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } }); });
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
    await host.evaluate(() => { room.mode = "ctf"; room.map = "g05"; hostStartMatch(); });
    await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor() && CTF.F.atk.home.x !== undefined, null, { timeout: 90000 });
    await host.evaluate(() => { world.phase = "live"; const F = CTF.F, me = myActor(); const foeT = me.team === "atk" ? "def" : "atk"; me.invuln = 99; me.pos.set(F[foeT].home.x, F[foeT].home.y, F[foeT].home.z); step(0.1); });
    await guest.waitForFunction(() => CTF.F.atk.st !== "home" || CTF.F.def.st !== "home", null, { timeout: 20000 });
    const seen = await guest.evaluate(() => ({ atk: CTF.F.atk.st, def: CTF.F.def.st, hud: !!document.getElementById("ctf-hud") }));
    assert.ok(seen.atk === "carried" || seen.def === "carried", "the guest sees a flag carried: " + JSON.stringify(seen));
    await host.evaluate(() => netShutdown());
    assert.deepEqual(f.errors, []);
    console.log("ctf: flags at the spawns, carry and capture, slowed carrier, drop on death, return by touch or time, bots, 3 wins, guest sync");
  } finally { await f.browser.close(); signaling && signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
