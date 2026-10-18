const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
(async () => {
  let signaling;
  await new Promise(resolve => PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, server => { signaling = server; resolve(); }));
  const f = await fixture();
  try {
    const host = await f.page("neonhost"), guest = await f.page("neonguest");
    for (const p of [host, guest]) await p.evaluate(async () => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
    });
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate(code => joinRoom(code), code);
    await host.waitForFunction(() => room.members.size === 2 && NET.conns.size === 1);
    await host.evaluate(() => {
      for (const member of room.members.values()) member.agentKey = "neon_agent";
      room.mode = "std"; room.map = "glacier"; hostStartMatch();
    });
    await guest.waitForFunction(() => NET.mode === "client" && myActor()?.agent.id === "neon_agent", null, { timeout: 90000 });
    await host.evaluate(() => { closeShop(); world.phase = "live"; world.roundTime = 999; ADMIN.freezeAI = true; for (const a of world.actors) { a.invuln = 999; a.fireCd = 999; } });
    await guest.waitForFunction(() => world.phase === "live");
    await guest.evaluate(() => { closeShop(); useAbility(1); });
    await host.waitForFunction(() => world.actors.some(a => a.ctrl !== "me" && a.ctrl !== "ai" && a.__neonGear > 0));
    await guest.waitForFunction(() => myActor().__neonGear > 0);
    await guest.evaluate(() => { keys.fire = true; });
    await host.waitForFunction(() => world.actors.some(a => a.ctrl !== "me" && a.ctrl !== "ai" && a.__neonSlideReady === false));
    await guest.waitForFunction(() => myActor().__neonSlideReady === false);
    await guest.evaluate(() => { keys.fire = false; });
    await guest.waitForFunction(() => !(myActor().__neonSlide > 0));
    // The guest asks to cast; only the host consumes the charge and creates the ultimate.
    await host.evaluate(() => { const a = world.actors.find(a => a.ctrl !== "me" && a.ctrl !== "ai"); a.ultCharge = a.ultMax; });
    await guest.waitForFunction(() => myActor().ultCharge === myActor().ultMax);
    await guest.evaluate(() => useAbility(3));
    await host.waitForFunction(() => world.actors.some(a => a.ctrl !== "me" && a.ctrl !== "ai" && a.ultW?.kind === "neon"));
    await guest.waitForFunction(() => myActor().ultW?.kind === "neon");
    const server = await host.evaluate(() => { const a = world.actors.find(a => a.ctrl !== "me" && a.ctrl !== "ai"); return { charge: a.ultCharge, time: a.ultW.t, ready: a.__neonSlideReady }; });
    const client = await guest.evaluate(() => ({ charge: myActor().ultCharge, time: myActor().ultW.t, ready: myActor().__neonSlideReady }));
    assert.equal(server.charge, 0); assert.equal(client.charge, 0); assert.ok(Math.abs(server.time - client.time) < 1); assert.equal(server.ready, true); assert.equal(client.ready, true);
    await guest.evaluate(() => { keys.ads = true; });
    await guest.waitForFunction(() => myActor().__neonSlideReady === false);
    assert.ok(await host.evaluate(() => world.actors.some(a => a.ctrl !== 'me' && a.ctrl !== 'ai' && a.ultW?.kind === 'neon' && !a.__neonSlideReady)));
    await guest.evaluate(() => { keys.ads = false; });
    await guest.evaluate(() => { window.__neonBeams = 0; const old = NET.onEvent; NET.onEvent = function(e) { if (e.t === "neon-beam") __neonBeams++; return old.apply(this, arguments); }; keys.fire = true; });
    await guest.waitForFunction(() => __neonBeams > 0);
    await guest.evaluate(() => { keys.fire = false; });
    await host.evaluate(() => {
      const a = myActor(), g = world.actors.find(a => a.ctrl !== "me" && a.ctrl !== "ai");
      a.pos.set(-35, 0, -35); a.y = 0; a.yaw = 0; a.pitch = -0.45;
      g.pos.set(-35, 0, -40); g.y = 0; g.input.mv = [0, 0];
      castAbility("neon_relay", NEON_AGENT.agent.abilities[0]);
      for (let i = 0; i < 80 && !(g.concuss > 0); i++) abilTick(0.05);
      if (!(g.concuss > 0)) throw new Error("Relay Bolt did not hit the guest");
    });
    await guest.waitForFunction(() => myActor().concuss > 0);
    await guest.waitForFunction(() => !(myActor().concuss > 0), null, { timeout: 15000 });
    assert.deepEqual(f.errors, []);
    await host.evaluate(() => netShutdown());
    console.log("Real local WebRTC peers: guest High Gear/left-click slide, authoritative Overdrive, replicated timers/charges, Relay Bolt stun and expiry passed");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
