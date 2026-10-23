const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const host = await f.page("rankhost"), guest = await f.page("rankguest");
    for (const page of [host, guest]) await page.evaluate(async () => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
    });
    // a normal room first: nothing is locked, a switch sticks
    const plain = await host.evaluate(async () => { await createRoom(); ADMIN.god = true; const r = { ranked: room.ranked, god: ADMIN.god, set: lobbySetOpt("rounds", 3) }; ADMIN.god = false; netShutdown(); return r; });
    assert.deepEqual(plain, { ranked: false, god: true, set: true });
    // the ranked room
    const code = await host.evaluate(async () => { await RANKED.open(); return NET.room; });
    const h1 = await host.evaluate(() => ({ ranked: room.ranked, mode: room.mode, rounds: room.rounds, locked: RANKED.locked, set: lobbySetOpt("map", "neon"), body: document.body.classList.contains("ranked") }));
    assert.equal(h1.ranked, true); assert.equal(h1.mode, "std"); assert.equal(h1.rounds, 7); assert.equal(h1.locked, true); assert.equal(h1.set, false); assert.equal(h1.body, true);
    // the admin switches do not stick, and the cheat flags are cleaned
    const h2 = await host.evaluate(async () => {
      ADMIN.god = true; ADMIN.infAmmo = true; ADMIN.run = 99; ADMIN2.setPersonal("god", true); ADMIN2.P.radar = true;
      window.IS_OWNER = true; window.ADMIN_GRANTED = true; HUNTX.HUNT.unlocked = true;
      await new Promise((r) => setTimeout(r, 800));
      return { god: ADMIN.god, ammo: ADMIN.infAmmo, run: ADMIN.run === ADMIN_DEF.run, pgod: ADMIN2.P.god, radar: ADMIN2.P.radar, owner: window.IS_OWNER, adm: window.ADMIN_GRANTED, unlocked: HUNTX.HUNT.unlocked };
    });
    assert.deepEqual(h2, { god: false, ammo: false, run: true, pgod: false, radar: false, owner: false, adm: false, unlocked: false });
    await guest.evaluate((code) => joinRoom(code), code);
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
    await guest.waitForFunction(() => room.ranked === true && RANKED.locked === true);
    // the guest cannot turn a cheat on either, and the host does not hear a request for one
    const g1 = await guest.evaluate(async () => { ADMIN.god = true; ADMIN2.setPersonal("god", true); await new Promise((r) => setTimeout(r, 800)); return { god: ADMIN.god, pgod: ADMIN2.P.god }; });
    assert.deepEqual(g1, { god: false, pgod: false });
    // the ticket for the report is asked for as ranked, and the room is on the list as ranked
    const body = await guest.evaluate(() => RANKED.ticketBody());
    assert.deepEqual(body, { ranked: true, room: code });
    // the server learns the room from the host's report; the host then opens the match with its roster
    // (ranked_start) and tells the room, and the guest's ticket is the ranked one for that match
    await host.waitForFunction(() => document.body.classList.contains("ranked"));
    for (let i = 0; i < 60 && !f.h.db.get("room:" + code); i++) await new Promise((r) => setTimeout(r, 500));
    assert.ok(f.h.db.get("room:" + code), "the server knows the ranked room");
    await host.evaluate(() => { room.mode = "std"; hostStartMatch(); });
    await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    await host.waitForFunction(() => RANKED.flow.current() && RANKED.flow.current().info, null, { timeout: 30000 });
    const info = await host.evaluate(() => RANKED.flow.current().info);
    assert.deepEqual(info.a.concat(info.b).sort(), ["rankguest", "rankhost"]);
    const served = await guest.evaluate(async () => {
      const j = await RANKED.flow.ticket(ACCOUNT.session().token, ACCOUNT.api);
      return { ticketRanked: !!(j && j.ranked), flagged: !!(j && RANKED.flow.isRanked(j.ticket)) };
    });
    assert.deepEqual(served, { ticketRanked: true, flagged: true });
    assert.equal(await guest.evaluate(() => room.ranked && RANKED.locked), true);
    // leaving the room lifts the lock
    await host.evaluate(() => netShutdown());
    await guest.waitForFunction(() => NET.status !== "open");
    await guest.evaluate(() => netShutdown());
    const after = await guest.evaluate(async () => { await new Promise((r) => setTimeout(r, 700)); ADMIN.god = true; const r = { ranked: room.ranked, locked: RANKED.locked, god: ADMIN.god }; ADMIN.god = false; return r; });
    assert.deepEqual(after, { ranked: false, locked: false, god: true });
    assert.deepEqual(f.errors, []);
    console.log("ranked room: admin and cheats locked for host and guest, room rules fixed, ranked ticket from the host's roster, lock lifted on leaving");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
