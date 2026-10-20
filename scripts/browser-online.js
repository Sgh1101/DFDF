const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
(async () => {
  let signaling;
    await new Promise((resolve) => {
      const peer = PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); });
      peer.on("connection", (client) => console.log("signaling connected", client.getId()));
      peer.on("message", (client, message) => { if (message.type !== "HEARTBEAT") console.log("signal", message.type); });
    });
  const f = await fixture();
  try {
    const host = await f.page("hoster");
    // This test checks data-channel behavior; the separate flow test renders scenes.
    await host.evaluate(() => { render = () => {}; titleCam = () => {}; });
    const guest = await f.page("joiner");
    await guest.evaluate(() => { render = () => {}; titleCam = () => {}; });
    for (const page of [host, guest]) await page.evaluate(async () => {
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
      const alert = netAlert; netAlert = function (message) { console.log("network alert", message); return alert.apply(this, arguments); };
      window.onlineEvents = []; const original = NET.onEvent;
      NET.onEvent = function (event) { onlineEvents.push(structuredClone(event)); return original.apply(this, arguments); };
    });
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    assert.match(code, /^[A-Z0-9]{6}$/);
    await guest.evaluate((code) => joinRoom(code), code);
    console.log("host state", await host.evaluate(() => ({status:NET.status,code:NET.room,conns:NET.conns.size,members:room.members.size,error:NET.error && NET.error.message})));
    console.log("guest state", await guest.evaluate(() => ({status:NET.status,code:NET.room,error:NET.error && NET.error.message})));
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
    await host.evaluate(() => { room.mode = "std"; hostStartMatch(); ADMIN.freezeAI = true; for (const a of world.actors) { a.fireCd = 999; a.invuln = 999; } });
    await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    const first = await host.evaluate(() => ({ id: world.actors.find((a) => a.ctrl !== "me" && a.ctrl !== "ai").id, peer: [...NET.conns.keys()][0] }));
    // Recover the living guest before the independent last-kill scenario.
    await host.evaluate(() => { world.phase = "live"; world.roundTime = 999; });
    await guest.waitForFunction(id => myActor()?.id === id && myActor().alive && world.phase === "live", first.id, {timeout:30000});
    const paths=await guest.evaluate(async()=>{const out=[];for(const c of [NET.up.state,NET.up.event]){if(c?.peerConnection){const p=RUNTIME_TOOLS.connectionPath(await c.peerConnection.getStats());if(p)out.push(p);}}return out;});
    assert.ok(paths.length>0,'actual WebRTC path can be diagnosed');assert.ok(paths.every(p=>!p.relay&&p.local==='host'&&p.remote==='host'));
    assert.ok(paths.every(p=>Object.keys(p).every(k=>['local','remote','protocol','relay'].includes(k))));
    // Transport destruction already triggers automatic recovery. Starting a second
    // manual netJoin here raced that recovery and cancelled its connection.
    const redials = await guest.evaluate(() => window.NET_REDIALS || 0);
    await guest.evaluate(() => NET.peer.destroy());
    await guest.waitForFunction(n => (window.NET_REDIALS || 0) > n && !NET_RC.busy && NET.status === "open", redials, { timeout: 90000 }).catch(async error => { console.log("guest recovery", JSON.stringify(await guest.evaluate(() => ({status:NET.status,mode:NET.mode,peer:NET.peer?.id,phase:world.phase,rc:NET_RC,actor:myActor()?.id}))), f.errors); throw error; });
    await host.waitForFunction(peer => !NET.conns.has(peer) && NET.conns.size === 1 && world.actors.some((a) => a.ctrl !== "me" && a.ctrl !== "ai" && a.ctrl !== "dead"), first.peer).catch(async error => {
      console.log("recovery diagnostics", JSON.stringify({ host: await host.evaluate(() => ({ conns: [...NET.conns].map(([id,c]) => ({id,state:c.state?.open,event:c.event?.open})), actors: world.actors.map(a => ({id:a.id,ctrl:a.ctrl,alive:a.alive})) })), guest: await guest.evaluate(() => ({ peer: NET.peer?.id, status: NET.status, rc: NET_RC, actor: myActor()?.id })) }));
      throw error;
    });
    const restored = await host.evaluate(() => world.actors.find((a) => a.ctrl !== "me" && a.ctrl !== "ai" && a.ctrl !== "dead").id);
    assert.equal(restored, first.id);
    console.log("WebRTC transport replacement restored the original seat");
    const report = await host.evaluate(() => {
      world.phase = "live";
      const a = myActor(), foes = world.actors.filter((o) => o.team !== a.team), v = foes.find((o) => o.ctrl !== "ai") || foes[0];
      for (const o of foes) o.alive = o === v;
      v.hp = 1; v.armor = 0; v.invuln = 0;
      a.weapons.primary = "rpg"; a.slot = "primary"; GUN_SKINS.set("rpg", "dragon");
      const cause = DAMAGE_CAUSE.capture(a, "rpg", "gun", world.round, "dragon");
      a.slot = "secondary";
      DAMAGE_CAUSE.run(cause, () => dealDamage(v, 999, false, a));
      return { victim: v.id, effects: FINISHERS.active.size };
    });
    await guest.waitForFunction(() => onlineEvents.some((e) => e.t === "kill-detail"));
    const detail = await guest.evaluate(() => onlineEvents.find((e) => e.t === "kill-detail"));
    assert.equal(detail.gun, "rpg"); assert.equal(detail.skin, "dragon"); assert.equal(detail.finisher, true); assert.equal(report.effects, 1);
    await guest.evaluate(() => { const event = onlineEvents.find((e) => e.t === "kill-detail"); FINISHERS.clear(); NET.onEvent(event); });
    assert.equal(await guest.evaluate(() => FINISHERS.active.size), 0);
    console.log("WebRTC host → guest: captured weapon/skin, last kill, duplicate suppression passed");
    await host.evaluate(() => netShutdown()); await guest.waitForFunction(() => NET.status !== "open");
    assert.deepEqual(f.errors, []); console.log("online browser checks passed");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
