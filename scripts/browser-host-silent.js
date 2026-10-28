// Connections that never join cost the host nothing that lasts: anyone who knows a room code can open links to the host, and
// every link it kept used to be sent a snapshot 20 times a second (40 of them took the host from about 23 updates a second
// to about 10). Raw PeerJS links that never say "hello" are sent nothing, are closed when they stay silent, and cannot crowd
// out a real guest, who still joins a match in progress and plays.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
const SILENT = 40;
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const prep = async (page) => {
      await page.evaluate(async (port) => {
        render = () => {}; titleCam = () => {};
        await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } });
      }, PORT);
    };
    const host = await f.page("hoster"), A = await f.page("joinerA");
    for (const p of [host, A]) await prep(p);
    // the raw links come from a bare page that only has PeerJS (the game pages are slow enough already)
    const X = await (await f.browser.newContext()).newPage();
    await X.addScriptTag({ path: process.env.DFDF_PEERJS_PATH || require.resolve("peerjs/dist/peerjs.min.js") });
    await X.evaluate((port) => { window.peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } }); }, PORT);
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await A.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => room.members.size === 2, null, { timeout: 60000 });
    await host.evaluate(() => { room.mode = "std"; hostStartMatch(); });
    await A.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    await host.evaluate(() => {
      world.roundTime = 99999; world.phase = "live"; ADMIN.freezeAI = true; for (const a of world.actors) a.invuln = 999;
      window.__sent = 0; const send = sendSnapshot; sendSnapshot = function () { __sent++; return send.apply(this, arguments); };
    });
    await A.evaluate(() => { window.__got = 0; const on = NET.onSnapshot; NET.onSnapshot = function () { __got++; return on.apply(this, arguments); }; });
    // updates per second, on the host (snapshots it sends) and at the real guest (snapshots that arrive)
    const rate = async (ms) => {
      const read = async () => ({ sent: await host.evaluate(() => __sent), got: await A.evaluate(() => __got), t: Date.now() });
      const a = await read(); await host.waitForTimeout(ms); const b = await read(), s = (b.t - a.t) / 1000;
      return { sent: (b.sent - a.sent) / s, got: (b.got - a.got) / s };
    };
    const base = await rate(4000);
    console.log("updates per second with one guest", JSON.stringify(base));
    assert.ok(base.sent > 5 && base.got > 5, "the match sends updates: " + JSON.stringify(base));

    // 1. many raw links to the host that never say hello (half of them with both links, as a guest would open)
    const opened = await X.evaluate(async ([id, n]) => {
      window.__raw = [];
      for (let i = 0; i < n; i++) {
        const p = new Peer(null, peerOpts());
        await new Promise((r) => p.on("open", r));
        const links = [p.connect(id, { label: "state", reliable: false, serialization: "json" })];
        if (i % 2) links.push(p.connect(id, { label: "event", reliable: true, serialization: "json" }));
        __raw.push({ p, links });
      }
      await new Promise((r) => setTimeout(r, 3000));
      return __raw.reduce((s, r) => s + r.links.filter((c) => c.open).length, 0);
    }, [await host.evaluate(() => NET.id), SILENT]);
    console.log("raw links open at the guest side", opened);
    assert.ok(opened >= SILENT / 2, "the raw links really connected: " + opened);

    // 2. they do not slow the host: nothing is sent to them, and no more than a few are kept
    const during = await rate(4000);
    const kept = await host.evaluate(() => NET.conns.size);
    console.log("updates per second with the raw links", JSON.stringify(during), "kept", kept);
    assert.ok(kept <= 1 + 16, "a bounded number of silent peers is kept: " + kept);
    assert.ok(during.sent >= base.sent * 0.8, "the host keeps its update rate: " + JSON.stringify({ base, during }));
    assert.ok(during.got >= base.got * 0.8, "the guest keeps receiving: " + JSON.stringify({ base, during }));

    // 3. a real guest that joins the match in progress while they are still there gets a body and plays
    await A.evaluate(() => { document.getElementById("pz-quit").onclick(); });
    await A.waitForFunction(() => "solo" === NET.mode, null, { timeout: 30000 });
    await A.evaluate((c) => joinRoom(c), code);
    await A.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    const peerA = await A.evaluate(() => NET.peer.id);
    assert.equal(await host.evaluate((p) => world.actors.some((a) => a.ctrl === p), peerA), true, "the guest has a body");
    console.log("a real guest joined the match in progress during the flood");

    // 4. what stays silent is closed
    await host.waitForFunction(() => NET.conns.size === 1, null, { timeout: 30000 });
    const left = await X.evaluate(() => __raw.reduce((s, r) => s + r.links.filter((c) => c.open).length, 0));
    assert.equal(left, 0, "every silent link was closed");
    assert.equal(await host.evaluate(() => room.members.size), 2, "no seat went to a silent link");
    console.log("silent links were closed");

    // 5. after they are gone the host is as fast as before, and the guests still play (its input moves its body)
    const after = await rate(4000);
    console.log("updates per second afterwards", JSON.stringify(after));
    assert.ok(after.sent >= base.sent * 0.8, "the host is as fast as before: " + JSON.stringify({ base, after }));
    await A.evaluate(() => { keys.w = true; });
    const before = await host.evaluate((p) => { const a = world.actors.find((x) => x.ctrl === p); return [a.pos.x, a.pos.z]; }, peerA);
    await host.waitForTimeout(1500);
    await A.evaluate(() => { keys.w = false; });
    const now = await host.evaluate((p) => { const a = world.actors.find((x) => x.ctrl === p); return [a.pos.x, a.pos.z]; }, peerA);
    assert.ok(Math.hypot(now[0] - before[0], now[1] - before[1]) > 0.5, "the real guest's input still drives its body: " + JSON.stringify({ before, now }));
    console.log("real guests still play");

    // 6. a second flood, of event links only: it is gone in time too, and the real guest is not touched
    await X.evaluate(async (id) => {
      for (const r of __raw) try { r.p.destroy(); } catch (e) {}
      window.__raw = [];
      for (let i = 0; i < 30; i++) {
        const p = new Peer(null, peerOpts());
        await new Promise((r) => p.on("open", r));
        __raw.push({ p, links: [p.connect(id, { label: "event", reliable: true, serialization: "json" })] });
      }
    }, await host.evaluate(() => NET.id));
    await host.waitForTimeout(14000);
    assert.equal(await host.evaluate(() => NET.conns.size), 1, "the real guest is still connected after the silent ones timed out");
    assert.equal(await A.evaluate(() => "client" === NET.mode && "open" === NET.status), true, "the guest is still connected");
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("host silent-connection browser checks passed");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
