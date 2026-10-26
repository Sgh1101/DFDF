const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
// Cheats the owner gives a player in a room (by name, so they survive a dropped link) end with that room: the same
// page hosting another room later does not hand them to the same name again.
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const host = await f.page("grhost"), guest = await f.page("grguest");
    for (const page of [host, guest]) await page.evaluate(async () => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
    });
    const play = async () => {
      await host.evaluate(() => createRoom());
      const code = await host.evaluate(() => NET.room);
      await guest.evaluate((c) => joinRoom(c), code);
      await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
      await host.evaluate(() => { room.mode = "std"; hostStartMatch(); });
      await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
      return guest.evaluate(() => NET.peer.id);
    };
    const gid = await play();
    const given = await host.evaluate((gid) => {
      const a = world.actors.find((x) => x.ctrl === gid);
      OWNER_UI.run({ op: "cheat", id: a.id, v: 1 });
      return HUNTX.GRANT.has(gid);
    }, gid);
    assert.equal(given, true, "the owner gave the guest cheats");
    await host.evaluate(() => netShutdown());
    await guest.waitForFunction(() => NET.status !== "open").catch(() => {});
    await guest.evaluate(() => netShutdown());
    const gid2 = await play();
    assert.notEqual(gid2, gid);
    await host.waitForTimeout(2600); // the host checks its grants every second
    const again = await host.evaluate((gid2) => ({ grant: HUNTX.GRANT.has(gid2) }), gid2);
    const mine = await guest.evaluate(() => HUNTX.HUNT.granted);
    assert.deepEqual([again.grant, mine], [false, false], "a new room starts without the old room's grants");
    assert.deepEqual(f.errors, []);
    console.log("owner grant: cheats the owner gave in one room are not given again in the next");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
