const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Conquest: a ring on the map; stand in it alone and it turns your colour, hold it and the
// side scores a point a second; contested it stands still; kills do not score; it moves every
// 90 s after a warning; 120 points win; bots head for it; a guest sees the same hill.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("hiller", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; render = () => {}; room.mode = "hill"; room.map = "g05"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const C = CONQUEST, Z = C.Z, me = myActor(), all = world.actors, out = { name: GAME_MODES.hill.name };
      for (let i = 0; i < 5; i++) step(1 / 60);
      out.hills = Z.at.length;
      out.ring = !!scene.children.find((o) => o.userData && o.userData.fill);
      out.hud = document.getElementById("hill-hud") && !document.getElementById("hill-hud").hidden;
      // everyone away from the hill, me alone in it
      const far = (a, i) => { a.pos.set(Z.x + 60 + i * 2, 0, Z.z + 60); a.invuln = 99; };
      all.forEach((a, i) => a !== me && far(a, i));
      me.pos.set(Z.x, Z.y, Z.z); me.alive = true; me.invuln = 99;
      const mySide = me.team, p0 = Z.p;
      for (let i = 0; i < 20; i++) step(0.1);
      out.moving = { dir: Math.sign(Z.p) * (mySide === "atk" ? 1 : -1), p: Math.round(Z.p), who: Z.who };
      for (let i = 0; i < 80; i++) step(0.1);
      out.owned = { owner: Z.owner, mine: Z.owner === mySide };
      const s0 = mySide === "atk" ? world.scoreAtk : world.scoreDef;
      for (let i = 0; i < 50; i++) step(0.1);
      const s1 = mySide === "atk" ? world.scoreAtk : world.scoreDef;
      out.scoring = s1 - s0;
      // a foe steps in: contested, nothing moves; the owner keeps scoring
      const foe = all.find((a) => a !== me && a.team !== mySide);
      foe.pos.set(Z.x + 1, Z.y, Z.z); foe.alive = true; foe.invuln = 99;
      const pc = Z.p;
      for (let i = 0; i < 20; i++) { foe.pos.set(Z.x + 1, Z.y, Z.z); step(0.1); }
      out.contested = { who: Z.who, still: Z.p === pc, owner: Z.owner === mySide };
      // the foe alone takes it back, slowly
      me.pos.set(Z.x + 80, 0, Z.z); 
      for (let i = 0; i < 400; i++) { foe.pos.set(Z.x + 1, Z.y, Z.z); foe.alive = true; step(0.1); if (Z.owner !== mySide) break; }
      out.lost = Z.owner !== mySide;
      foe.pos.set(Z.x + 70, 0, Z.z);
      // a kill does not score
      const sa = world.scoreAtk, sd = world.scoreDef;
      for (const a of all) a.invuln = 0;
      const v = all.find((a) => a.team === "atk" && a !== me) , k = all.find((a) => a.team === "def" && a !== me);
      v.alive = true; killActor(v, k);
      out.kill = world.scoreAtk === sa && world.scoreDef === sd;
      // the bots' goal
      const bot = all.find((a) => a !== me && a.alive) || all[1];
      const g = aiGoal(bot);
      out.goal = Math.hypot(g.x - Z.x, g.z - Z.z) <= C.R;
      // the hill moves: a warning (the next ring), then the new place
      me.pos.set(Z.x + 80, 0, Z.z); foe.pos.set(Z.x + 80, 0, Z.z + 5);
      const i0 = Z.i, x0 = Z.x;
      Z.age = C.MOVE - 7;
      step(0.1); step(1.5);
      out.warned = !!Z.next;
      Z.age = C.MOVE - 0.05;
      step(0.1);
      out.moved = { i: Z.i !== i0 || Z.at.length === 1, off: Z.at.length > 1 ? Math.hypot(Z.x - x0, 0) > 1 || Z.i !== i0 : true, fresh: Z.owner === "none" && Z.p === 0, next: Z.next };
      // 120 ends it
      Z.owner = "atk"; Z.p = 100; Z.acc.atk = C.TARGET - 0.05;
      me.pos.set(Z.x, Z.y, Z.z); me.team === "atk" || (me.team = me.team);
      for (let i = 0; i < 5; i++) { all.filter((a) => a.team === "atk").forEach((a, j) => a.pos.set(Z.x + j * 0.3, Z.y, Z.z)); step(0.1); }
      out.over = world.over;
      await new Promise((r) => setTimeout(r, 3000));
      out.result = { phase: world.phase, head: document.getElementById("ov-head").textContent, score: document.getElementById("ov-score").textContent, mySide: me.team };
      return out;
    });
    console.log(JSON.stringify(r));
    assert.equal(r.name, "점령전");
    assert.ok(r.hills >= 1 && r.ring && r.hud, "hills, ring and bar");
    assert.equal(r.moving.dir, 1, "alone in the ring: it moves toward my side: " + JSON.stringify(r.moving));
    assert.ok(r.owned.mine, "held: " + JSON.stringify(r.owned));
    assert.ok(r.scoring >= 4 && r.scoring <= 6, "about a point a second: " + r.scoring);
    assert.deepEqual(r.contested, { who: "both", still: true, owner: true });
    assert.ok(r.lost, "the foe alone takes it back");
    assert.ok(r.kill, "kills do not score");
    assert.ok(r.goal, "bots go to the hill");
    assert.ok(r.warned && r.moved.fresh && r.moved.off, "it warns and moves: " + JSON.stringify(r.moved));
    assert.ok(r.over, "120 ends it");
    assert.ok(/승리|패배/.test(r.result.head) && r.result.phase === "over");
    await page.screenshot({ path: (process.env.SHOT_DIR || "/tmp") + "/conquest.png" });
    assert.deepEqual(f.errors, []);
    await page.close();
    // ── online: the guest sees the same hill ──
    const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
    let signaling = null;
    await new Promise((resolve) => PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); }));
    try {
      const host = await f.page("hillhost"), guest = await f.page("hillguest");
      for (const p of [host, guest]) await p.evaluate(async () => {
        render = () => {}; titleCam = () => {};
        await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
      });
      const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
      await guest.evaluate((code) => joinRoom(code), code);
      await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
      await host.evaluate(() => { room.mode = "hill"; room.map = "g05"; hostStartMatch(); });
      await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor() && room.mode === "hill", null, { timeout: 90000 });
      await host.evaluate(() => { world.phase = "live"; ADMIN.freezeAI = true; });
      await guest.waitForFunction(() => CONQUEST.Z.at.length > 0, null, { timeout: 15000 });
      const hz = await host.evaluate(() => ({ x: CONQUEST.Z.x, z: CONQUEST.Z.z, n: CONQUEST.Z.at.length }));
      const gz = await guest.evaluate(() => ({ x: CONQUEST.Z.x, z: CONQUEST.Z.z, n: CONQUEST.Z.at.length }));
      assert.deepEqual(gz, hz, "the same hill");
      // the host's hold shows on the guest
      await host.evaluate(() => { const Z = CONQUEST.Z; Z.owner = "atk"; Z.p = 100; });
      await guest.waitForFunction(() => CONQUEST.Z.owner === "atk" && CONQUEST.Z.p === 100, null, { timeout: 10000 });
      await guest.waitForFunction(() => /점령/.test((document.getElementById("hill-hud") || {}).textContent || ""), null, { timeout: 10000 });
      await host.evaluate(() => netShutdown());
      assert.deepEqual(f.errors, []);
      console.log("conquest online: the guest sees the same hill and who holds it");
    } finally { signaling && signaling.close(); }
    console.log("conquest: the ring, holding and scoring, contested, kills do not score, bots, the move, 120 wins");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
