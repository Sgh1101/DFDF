// Cheats in a room, after the code that was painted on a building was taken out. Nothing is painted on any wall and no
// "hunt" message goes between host and guests any more, and a guest who sends the old code message gets no answer. What
// stays: a plain account does not get the cheat panel (F9 included); a guest's cheat switches count only once the host
// knows its account (an owner grant, or an account the server checked), and then they do.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
(async () => {
  await new Promise((resolve) => PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, resolve));
  const f = await fixture();
  try {
    const prep = (page) => page.evaluate(async (port) => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } });
      window.__ev = []; const oe = NET.onEvent; NET.onEvent = (e) => { e && e.t && __ev.push(e.t); return oe(e); };
    }, PORT);
    const host = await f.page("cphost"), guest = await f.page("cpguest");
    for (const p of [host, guest]) await prep(p);
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => room.members.size === 2, null, { timeout: 60000 });
    const peer = await guest.evaluate(() => NET.peer.id);
    await host.evaluate(() => { room.mode = "std"; room.map = "pogu"; hostStartMatch(); });
    await guest.waitForFunction(() => "client" === NET.mode && myActor(), null, { timeout: 90000 });
    await host.evaluate(() => { world.roundTime = 99999; ADMIN.freezeAI = true; for (const a of world.actors) a.invuln = 999; });
    // the old code went out every 3 seconds: wait for more than one
    await guest.waitForTimeout(7000);

    // 1. nothing painted, nothing sent
    for (const [name, page] of [["host", host], ["guest", guest]]) {
      const walls = await page.evaluate(() => { let n = 0; scene.traverse((o) => { o.userData && o.userData.hunt && n++; }); return n; });
      assert.equal(walls, 0, name + ": no digits are painted on any building");
    }
    assert.equal(await guest.evaluate(() => __ev.filter((t) => /^hunt/.test(t)).length), 0, "no hunt message reached the guest");
    assert.equal(await host.evaluate(() => typeof HUNTX.HUNT.code), "undefined", "the host holds no code");
    console.log("nothing is painted and no hunt message is sent");

    // 2. the old code message gets no answer and opens nothing
    await guest.evaluate(() => sendAction({ t: "hunt-try", r: 1, v: 1, c: "0000" }));
    await guest.waitForTimeout(1500);
    assert.equal(await guest.evaluate(() => __ev.filter((t) => /^hunt/.test(t)).length), 0, "a hunt-try gets no answer");
    assert.equal(await host.evaluate((p) => HUNTX.OK.has(p), peer), false, "and lets nobody in");

    // 3. F9 opens nothing for an account without admin rights
    await guest.evaluate(() => dispatchEvent(new KeyboardEvent("keydown", { key: "F9" })));
    assert.equal(await guest.evaluate(() => document.getElementById("admin").hidden), true, "F9 opens no cheat panel for a plain account");

    // 4. a guest the host does not know cannot switch cheats on; one it does can
    await guest.evaluate(() => sendAction({ t: "padm", p: { god: true, oneShot: true } }));
    await host.waitForTimeout(800);
    assert.equal(await host.evaluate((p) => ADMIN2.PEERS.has(p), peer), false, "an unconfirmed guest's cheat switches are dropped");
    await host.evaluate((p) => HUNTX.GRANT.add(p), peer);
    await guest.evaluate(() => sendAction({ t: "padm", p: { god: true } }));
    await host.waitForFunction((p) => ADMIN2.PEERS.has(p) && ADMIN2.PEERS.get(p).god === true, peer, { timeout: 10000 });
    console.log("a guest's cheat switches count only once the host knows its account");
    assert.deepEqual(f.errors, [], "no page errors");
  } finally { await f.browser.close(); }
  console.log("cheat panel checks passed");
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
