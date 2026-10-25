// A guest's name is markup and a repeated hello: the host must clean the name, keep one seat, start without a throw,
// and the scoreboard / combat log / free-for-all board must show a hostile name as text.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
const EVIL = '<img src=x onerror="window.__xss=1">' + "x".repeat(300);
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const host = await f.page("hoster"), guest = await f.page("joiner");
    for (const page of [host, guest]) await page.evaluate(async (port) => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } });
      window.__thrown = [];
      window.onlineEvents = []; const original = NET.onEvent;
      NET.onEvent = function (event) { onlineEvents.push(structuredClone(event)); return original.apply(this, arguments); };
    }, PORT);
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((args) => { localStorage.setItem("lgp_name", args.name); return joinRoom(args.code); }, { name: EVIL, code });
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2, null, { timeout: 60000 });
    const peer = await guest.evaluate(() => NET.peer.id);

    // two more hellos from the same peer, then wait for the host to answer both with a lobby snapshot
    const lobbies = () => guest.evaluate(() => onlineEvents.filter((e) => e.t === "lobby").length);
    const before = await lobbies();
    await guest.evaluate(() => { sendAction({ t: "hello", name: myName() }); sendAction({ t: "hello", name: myName() }); });
    await guest.waitForFunction((n) => onlineEvents.filter((e) => e.t === "lobby").length >= n + 2, before, { timeout: 30000 });

    const lobby = await host.evaluate((peer) => {
      renderLobby(lobbySnapshot());
      const seats = ["atk", "def"].flatMap((t) => room.slots[t]).filter((s) => s === peer).length;
      const m = room.members.get(peer);
      return { seats, members: room.members.size, name: m && m.name, injected: document.querySelectorAll('#lobby img[src="x"]').length, xss: window.__xss || 0 };
    }, peer);
    assert.equal(lobby.seats, 1, "one seat for the guest");
    assert.equal(lobby.members, 2);
    assert.ok(lobby.name && lobby.name.length >= 1 && lobby.name.length <= 16, "stored name is 1-16 characters: " + lobby.name);
    assert.doesNotMatch(lobby.name, /[<>&"'`]/);
    assert.equal(lobby.injected, 0, "no element came out of the name in the lobby");
    assert.equal(lobby.xss, 0);
    assert.equal(await guest.evaluate(() => window.__xss || 0), 0);
    console.log("lobby: one seat, name stored as", JSON.stringify(lobby.name));

    // Start must not throw (a stale seat used to kill the room)
    const started = await host.evaluate(() => { try { room.mode = "std"; hostStartMatch(); return { ok: true, actors: world.actors.length }; } catch (e) { return { ok: false, error: String(e && e.message || e) }; } });
    assert.equal(started.ok, true, started.error);
    await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });

    // a repeated hello in the match returns the same body, never a second one
    const own = await host.evaluate((peer) => world.actors.filter((a) => a.ctrl === peer).map((a) => a.id), peer);
    assert.equal(own.length, 1, "the guest drives one body");
    await guest.evaluate(() => { sendAction({ t: "hello", name: myName() }); sendAction({ t: "hello", name: myName() }); });
    await guest.waitForFunction(() => onlineEvents.filter((e) => e.t === "joined").length >= 2, null, { timeout: 30000 });
    await host.waitForTimeout(500);
    const after = await host.evaluate((peer) => ({ bodies: world.actors.filter((a) => a.ctrl === peer).map((a) => a.id), name: (world.actors.find((a) => a.ctrl === peer) || {}).name, members: room.members.size }), peer);
    assert.deepEqual(after.bodies, own, "still the same single body");
    assert.ok(after.name.length <= 16 && !/[<>&"'`]/.test(after.name), "actor name is clean: " + after.name);
    const guestSide = await guest.evaluate(() => world.actors.map((a) => a.name || "").filter((n) => /[<>&"'`]/.test(n) || n.length > 16));
    assert.deepEqual(guestSide, [], "no actor name on the guest carries markup");

    // sinks: even a name that is already raw in memory must be shown as text
    const sinks = await host.evaluate(async () => {
      const raw = '<img src=x onerror="window.__xss=1">', me = myActor(), foe = world.actors.find((a) => a !== me && a.ctrl !== "ai") || world.actors.find((a) => a !== me);
      foe.name = raw;
      QOL.LOG().rows.push({ round: world.round, from: foe.id, to: me.id, amt: 10 });
      QOL.openBoard("cl", true);
      const cl = document.querySelector("#bd-body");
      const combat = { imgs: cl.querySelectorAll('img[src="x"]').length, text: cl.textContent.includes("<img") };
      QOL.openBoard("sb", true);
      const score = { imgs: document.querySelectorAll('#bd-body img[src="x"]').length };
      QOL.closeBoard();
      // the board lists the top five by kills: the hostile name leads it so it is surely on it
      const mode = room.mode, kills = foe.kills; let ffa = null;
      try { room.mode = "dm"; foe.kills = 99; updateHUD(); const b = document.getElementById("mode-board"); ffa = { imgs: b ? b.querySelectorAll('img[src="x"]').length : -1, text: !!b && b.textContent.includes("<img") }; }
      finally { room.mode = mode; foe.kills = kills; }
      await new Promise((r) => setTimeout(r, 300));
      return { combat, score, ffa, xss: window.__xss || 0 };
    });
    assert.equal(sinks.combat.imgs, 0, "combat log does not build elements from a name");
    assert.equal(sinks.combat.text, true, "combat log shows the name as text");
    assert.equal(sinks.score.imgs, 0);
    assert.equal(sinks.ffa.imgs, 0, "free-for-all board does not build elements from a name");
    assert.equal(sinks.ffa.text, true, "free-for-all board shows the name as text");
    assert.equal(sinks.xss, 0);
    console.log("sinks: combat log, scoreboard and free-for-all board show the name as text");

    await host.evaluate(() => netShutdown()); await guest.waitForFunction(() => NET.status !== "open");
    assert.deepEqual(f.errors, []); console.log("name safety browser checks passed");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
