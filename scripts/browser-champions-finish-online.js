const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
(async () => {
  let signaling;
  await new Promise(resolve => PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, server => { signaling = server; resolve(); }));
  const f = await fixture();
  try {
    const host = await f.page("finishhost"), guest = await f.page("finishguest");
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "finish-online-owner" });
    await f.h.api("a_user_set", { atoken: owner.atoken, id: "finishhost", op: "grant", item: "scout|champions_def" });
    await host.evaluate(() => GUN_SKINS.sync());
    for (const p of [host, guest]) {
      await p.waitForFunction(() => CHAMPIONS_PHANTOM.loaded());
      await p.evaluate(async () => {
        render = () => {}; titleCam = () => {};
        await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
      });
    }
    const code = await host.evaluate(async () => { GUN_SKINS.set("scout", "champions_def"); await createRoom(); return NET.room; });
    await guest.evaluate(code => joinRoom(code), code);
    await host.waitForFunction(() => room.members.size === 2 && NET.conns.size === 1);
    await host.evaluate(() => { room.mode = "std"; room.map = "field"; hostStartMatch(); });
    await guest.waitForFunction(() => NET.mode === "client" && myActor(), null, { timeout: 90000 });
    await host.evaluate(() => {
      closeShop(); world.phase = "live"; world.roundTime = 999; ADMIN.freezeAI = true;
      for (const a of world.actors) { a.fireCd = 999; a.invuln = 999; }
    });
    await guest.waitForFunction(() => world.phase === "live");
    const round = await host.evaluate(() => {
      const me = myActor(), foes = world.actors.filter(a => a.team !== me.team), victim = foes[0];
      for (const a of foes) a.alive = a === victim;
      me.weapons.primary = "scout"; me.slot = "primary"; GUN_SKINS.set("scout", "champions_def");
      victim.hp = 1; victim.armor = victim.invuln = victim.shielded = 0;
      DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(me, "scout", "gun", world.round, "champions_def"), () => dealDamage(victim, 999, false, me));
      checkRoundEnd(); return world.round;
    });
    await guest.waitForFunction(() => world.phase === "end" && world.championsFinishUntil > performance.now());
    const remaining = await guest.evaluate(() => world.championsFinishUntil - performance.now());
    assert.ok(remaining > 5000 && remaining <= 8000, "host sends remaining hold time to guest");
    await guest.waitForFunction(() => [...FINISHERS.active].some(g => g.getObjectByName("champions-original-finisher")?.visible), null, { timeout: 10000 });
    const shape = await guest.evaluate(() => {
      const figure = [...FINISHERS.active].map(g => g.getObjectByName("champions-original-finisher")).find(Boolean);
      const motion = [...FINISHERS.active].map(g => g.getObjectByName("champions-source-motion")).find(Boolean);
      return { snake: figure.userData.serpent, height: new T.Box3().setFromObject(figure).getSize(new T.Vector3()).y, min: figure.userData.playerHeight * 5, round: world.round, phase: world.phase, seed: motion.userData.seed, vertices: motion.userData.vertices };
    });
    assert.equal(shape.snake, "red"); assert.ok(shape.height >= shape.min); assert.equal(shape.round, round); assert.equal(shape.phase, "end");
    assert.ok(shape.vertices > 0); assert.equal(shape.seed, await host.evaluate(() => [...FINISHERS.active].map(g => g.getObjectByName("champions-source-motion")).find(Boolean).userData.seed), "host and guest share the source random seed");
    await host.waitForFunction(r => world.round === r + 1 && world.phase === "buy", round, { timeout: 12000 });
    await guest.waitForFunction(r => world.round === r + 1 && world.phase === "buy" && FINISHERS.active.size === 0, round, { timeout: 10000 });
    assert.deepEqual(f.errors, []);
    await host.evaluate(() => netShutdown());
    console.log("Real local WebRTC host/guest: shared eight-second countdown, original red serpent, >=5x height, next round and effect cleanup passed");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
