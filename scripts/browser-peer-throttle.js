// A guest that spams the messages which make the host ask the server (skins with random tickets, hellos) must not use
// up the host's API quota: the host passes only the budgeted number on, the guest keeps exactly one seat, and a normal
// skin change made right afterwards still reaches the host.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const host = await f.page("hoster"), guest = await f.page("joiner");
    // every API call the host page makes, by action
    const calls = {};
    host.on("request", (request) => { const m = /\/api\/v1\?a=([a-z_]+)/.exec(request.url()); if (m) calls[m[1]] = (calls[m[1]] || 0) + 1; });
    for (const page of [host, guest]) await page.evaluate(async (port) => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } });
    }, PORT);
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((code) => joinRoom(code), code);
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2, null, { timeout: 60000 });
    const peer = await guest.evaluate(() => NET.peer.id);
    const rules = await host.evaluate(() => JSON.parse(JSON.stringify(PEER_THROTTLE.rules)));
    assert.ok(rules.skins && rules.hello, "the host page has the throttle");
    // the join's own skins / levels calls are over before the burst is counted
    await host.waitForTimeout(2500);

    // 1. fifty skins messages with fresh random tickets, all in one go
    const skinBefore = calls.skin_check || 0;
    await guest.evaluate(() => {
      for (let i = 0; i < 50; i++) sendAction({ t: "skins", m: {}, k: "forged." + Math.random().toString(36).slice(2) + "." + i });
    });
    await host.waitForTimeout(rules.skins.every + 2500); // the newest one held back is let through once
    const skinCalls = (calls.skin_check || 0) - skinBefore;
    assert.ok(skinCalls >= 1, "the host checked some tickets: " + skinCalls);
    assert.ok(skinCalls <= rules.skins.cap + 1, "skin_check calls stayed in the budget: " + skinCalls + " > " + (rules.skins.cap + 1));
    console.log("skins: 50 sent, the host called skin_check", skinCalls, "times (budget", rules.skins.cap + " + 1)");

    // 2. twenty hellos, spread over about a second; count the ones the host really handled
    await host.evaluate(() => { window.__hellos = 0; const add = lobbyAdd; lobbyAdd = function () { window.__hellos++; return add.apply(this, arguments); }; });
    const levelsBefore = calls.levels || 0;
    await guest.evaluate(async () => { for (let i = 0; i < 20; i++) { sendAction({ t: "hello", name: myName() }); await new Promise((r) => setTimeout(r, 50)); } });
    await host.waitForTimeout(1500);
    const handled = await host.evaluate(() => window.__hellos), levelCalls = (calls.levels || 0) - levelsBefore;
    assert.ok(handled <= rules.hello.cap, "hellos handled by the host: " + handled + " > " + rules.hello.cap);
    assert.ok(levelCalls <= rules.hello.cap, "levels calls: " + levelCalls + " > " + rules.hello.cap);
    console.log("hello: 20 sent, the host handled", handled, "and called levels", levelCalls, "times");

    // 3. the guest still has exactly one seat and the room is intact
    const seat = await host.evaluate((peer) => ({ seats: ["atk", "def"].flatMap((t) => room.slots[t]).filter((s) => s === peer).length, members: room.members.size, conns: NET.conns.size }), peer);
    assert.deepEqual(seat, { seats: 1, members: 2, conns: 1 });

    // 4. a normal skin change right after the burst still reaches the host (held at most one refill, never lost)
    const before = await guest.evaluate(() => GUN_SKINS.mine().rifle || "default");
    assert.notEqual(before, "dragon");
    await guest.evaluate(() => GUN_SKINS.set("rifle", "dragon"));
    await host.waitForFunction((peer) => { const t = GUN_SKINS.peer.get(peer); return !!t && t.rifle === "dragon"; }, peer, { timeout: 30000 });
    console.log("a normal skin change after the burst reached the host");

    // 5. the state of the peer goes with the peer
    assert.equal(await host.evaluate(() => PEER_THROTTLE.size()), 1);
    // close the guest's channels first (as browser-network-recovery.js does): a bare netShutdown does not always
    // tell the host in time
    await guest.evaluate(() => { for (const c of Object.values(NET.up || {})) try { c && c.close && c.close(); } catch (e) {} netShutdown(); });
    await host.waitForFunction(() => NET.conns.size === 0, null, { timeout: 60000 });
    assert.equal(await host.evaluate(() => PEER_THROTTLE.size()), 0, "the throttle forgot the peer that left");
    await host.evaluate(() => netShutdown());
    assert.deepEqual(f.errors, []); console.log("peer throttle browser checks passed");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
