const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
// 축소전: free for all, one life; a safe circle covers the map and closes in stages on a new smaller one
// (shown beforehand); outside it hurts (armour does not help) more each stage; out is out, no
// respawn, a place is kept; the last one standing wins; bots stay in; a guest sees the same circle.
(async () => {
  const f = await fixture();
  let signaling;
  try {
    const page = await f.page("zoner", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; render = () => {}; room.mode = "zone"; room.map = "nightport"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const S = SHRINK_ZONE, Z = S.Z, me = myActor(), all = world.actors, out = { name: GAME_MODES.zone.name, n: all.length };
      for (let i = 0; i < 5; i++) step(0.05);
      const b = MAP.bounds;
      out.covers = [[b.minX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ], [b.maxX, b.minZ]].every(([x, z]) => Math.hypot(x - Z.x, z - Z.z) <= Z.r);
      out.hud = !!document.getElementById("zone-hud") && !document.getElementById("zone-hud").hidden;
      out.wall = !!scene.children.find((o) => o.userData && o.userData.wall && o.userData.nx);
      out.next = { inside: Math.hypot(Z.to.x - Z.x, Z.to.z - Z.z) + Z.to.r <= Z.r + 0.01, smaller: Z.to.r < Z.r };
      out.ffa = new Set(all.map((a) => a.team)).size === all.length;
      // outside the circle: health drops, armour is left alone
      for (const a of all) if (a !== me) { a.pos.set(Z.x, 0, Z.z); a.invuln = 99; }
      me.armor = 50; me.hp = 100; me.invuln = 0;
      Z.from = { x: Z.x, z: Z.z, r: 6 }; Z.to = { x: Z.x, z: Z.z, r: 6 }; S.cur();
      me.pos.set(Z.x + 40, 0, Z.z);
      const hp0 = me.hp;
      for (let i = 0; i < 20; i++) step(0.1);
      out.outside = { lost: +(hp0 - me.hp).toFixed(1), expect: +(S.dps() * 2).toFixed(1), armor: me.armor, flagged: S.outside(me) };
      out.vig = +document.getElementById("zone-vig").style.opacity > 0;
      // inside: nothing
      me.pos.set(Z.x, 0, Z.z); me.hp = 100;
      for (let i = 0; i < 20; i++) step(0.1);
      out.inside = me.hp;
      // the stages: wait, closing, the next circle
      const { cx, cz } = { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2 };
      S.reset(); me.pos.set(cx, 0, cz); me.hp = 100;
      const r0 = Z.r, st0 = Z.stage;
      Z.t = S.WAIT - 0.05; step(0.1);
      out.closing = Z.state;
      const mid = []; for (let i = 0; i < 9; i++) { step(1); mid.push(+Z.r.toFixed(1)); }
      for (let i = 0; i < 10; i++) step(1);
      out.stage = { stage: Z.stage - st0, state: Z.state, smaller: Z.r < r0, shrank: mid.every((v, i) => i === 0 || v <= mid[i - 1]) };
      out.stageDmg = S.dps();
      // out is out
      const v = all.find((a) => a !== me);
      for (const a of all) { a.invuln = 0; a.alive = true; a.hp = 100; }
      const before = all.filter((a) => a.alive).length;
      v.pos.set(Z.x + 500, 0, Z.z); v.hp = 1; v.armor = 0;
      step(0.2); step(0.2);
      out.out = { alive: v.alive, place: S.placeOf(v), expect: before };
      for (let i = 0; i < 100; i++) step(0.1);
      out.noRespawn = !v.alive;
      // the last one standing
      me.alive = true; me.hp = 100; me.armor = 50; me.invuln = 99; me.pos.set(Z.x, 0, Z.z); delete Z.places[me.id];
      for (const a of all) if (a !== me && a.alive) { a.armor = 0; a.hp = 1; killActor(a, me); }
      for (let i = 0; i < 10; i++) step(0.1);
      out.last = { over: world.over, phase: world.phase, me: S.placeOf(me), alive: all.filter((a) => a.alive).length };
      return out;
    });
    console.log(JSON.stringify(r));
    assert.equal(r.name, "축소전"); assert.ok(r.n >= 4);
    assert.ok(r.covers, "the first circle covers the whole map"); assert.ok(r.hud && r.wall, "the bar and the wall");
    assert.ok(r.next.inside && r.next.smaller, "the next circle fits inside and is smaller");
    assert.ok(r.ffa, "everyone alone");
    assert.ok(Math.abs(r.outside.lost - r.outside.expect) < 0.8 && r.outside.armor === 50 && r.outside.flagged, "damage outside, armour untouched: " + JSON.stringify(r.outside));
    assert.ok(r.vig, "the red edge");
    assert.equal(r.inside, 100, "no damage inside");
    assert.equal(r.closing, "shrink");
    assert.deepEqual(r.stage, { stage: 1, state: "wait", smaller: true, shrank: true });
    assert.ok(r.stageDmg > 2, "more damage at the next stage");
    assert.ok(!r.out.alive && r.out.place === r.out.expect, "out, with a place: " + JSON.stringify(r.out));
    assert.ok(r.noRespawn, "no respawn");
    assert.deepEqual(r.last, { over: true, phase: "end", me: 1, alive: 1 });
    // bots stay in
    const bots = await page.evaluate(() => {
      ADMIN.freezeAI = false; startGame(AGENTS[0], false); closeShop(); world.phase = "live";
      const S = SHRINK_ZONE, Z = S.Z, me = myActor(); me.invuln = 99;
      const goals = world.actors.filter((a) => a !== me).map((a) => { const g = aiGoal(a); return Math.hypot(g.x - Z.x, g.z - Z.z) <= Z.r; });
      let minAlive = 99, outsideFrames = 0;
      for (let i = 0; i < 2400; i++) { step(0.05); minAlive = Math.min(minAlive, world.actors.filter((a) => a.alive).length); for (const a of world.actors) if (a.alive && S.outside(a) && a !== me) outsideFrames++; if (world.over) break; }
      return { goals, stage: Z.stage, minAlive, over: world.over, outsideFrames };
    });
    console.log(JSON.stringify(bots));
    assert.ok(bots.goals.every(Boolean), "a bot's goal is inside the circle");
    assert.ok(bots.stage >= 1, "the zone moved on: " + bots.stage);
    await page.screenshot({ path: (process.env.SHOT_DIR || "/tmp") + "/zone.png" });
    // online
    await new Promise((resolve) => { const peer = PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (s) => { signaling = s; resolve(); }); });
    const host = await f.page("zonehost"), guest = await f.page("zoneguest");
    for (const p of [host, guest]) await p.evaluate(async () => { render = () => {}; titleCam = () => {}; await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } }); });
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
    await host.evaluate(() => { room.mode = "zone"; room.map = "nightport"; hostStartMatch(); });
    await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor() && SHRINK_ZONE.Z.from.r > 0, null, { timeout: 90000 });
    await host.evaluate(() => { world.phase = "live"; const Z = SHRINK_ZONE.Z; Z.t = SHRINK_ZONE.WAIT - 0.01; step(0.1); step(0.5); });
    await guest.waitForFunction(() => SHRINK_ZONE.Z.state === "shrink", null, { timeout: 20000 });
    const seen = await guest.evaluate(() => ({ state: SHRINK_ZONE.Z.state, r: SHRINK_ZONE.Z.r > 0, hud: !!document.getElementById("zone-hud") }));
    assert.deepEqual(seen, { state: "shrink", r: true, hud: true });
    await host.evaluate(() => netShutdown());
    assert.deepEqual(f.errors, []);
    console.log("zone: the circle covers the map, closes in stages, damage outside past armour, out is out with a place, last one wins, bots stay in, guest sync");
  } finally { await f.browser.close(); signaling && signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
