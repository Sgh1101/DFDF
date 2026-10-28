// An account's cheat ticket is for the peer that asked and stops when the account is banned: a guest that hands its ticket
// to another guest in the room gives that guest nothing, the real holder is still granted, and banning the account takes
// its cheats away at the host's next check (perm_ticket / perm_check, js/legacy/55-cheats-per-account-...).
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "perm-ticket-owner" });
    // account "cheater" has radar opened by the owner page; "plain" has nothing. They must exist before the pages sign in.
    for (const id of ["cheater", "plain"]) await f.h.api("auth", { id, pw: "password", device: "browser-test-" + id });
    assert.equal((await f.h.api("a_user_set", { atoken: owner.atoken, id: "cheater", op: "perm", perm: { on: true, radar: true }, days: 30 })).status, 200);
    const prep = async (page) => {
      await page.evaluate(async (port) => {
        render = () => {}; titleCam = () => {};
        await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } });
      }, PORT);
    };
    const host = await f.page("permhost"), A = await f.page("cheater"), B = await f.page("plain");
    for (const p of [host, A, B]) await prep(p);
    // every perm_check the host makes is logged with its answer
    await host.evaluate(() => {
      window.__checks = [];
      const api = ACCOUNT.api;
      ACCOUNT.api = async function (action, body) {
        const r = await api.apply(this, arguments);
        action === "perm_check" && __checks.push({ ticket: body.ticket, perm: !!(r && r.perm) });
        return r;
      };
    });
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    for (const [i, g] of [A, B].entries()) { await g.evaluate((c) => joinRoom(c), code); await host.waitForFunction((n) => room.members.size === n, i + 2, { timeout: 60000 }); }
    const peerA = await A.evaluate(() => NET.peer.id), peerB = await B.evaluate(() => NET.peer.id);
    await host.evaluate(() => { room.mode = "std"; hostStartMatch(); });
    for (const g of [A, B]) await g.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    const has = (peer) => host.evaluate((p) => ({ perm: PERM.host().perms.some(([k]) => k === p), grant: HUNTX.GRANT.has(p) }), peer);

    // 1. the real holder is granted on its own ticket
    await host.waitForFunction((p) => PERM.host().perms.some(([k]) => k === p), peerA, { timeout: 30000 });
    assert.deepEqual(await has(peerA), { perm: true, grant: true }, "the account's own guest gets its cheats");
    console.log("the holder's own ticket works");

    // 2. a ticket handed to another guest gives that guest nothing (it used to carry the account's cheats)
    f.h.advance(1000); // the server clock stands still in tests: a later second makes this ticket a different string from the holder's own
    const stolen = await A.evaluate(async (code) => (await ACCOUNT.api("perm_ticket", { token: ACCOUNT.session().token, room: code, p: NET.peer.id })).ticket, code);
    assert.equal(typeof stolen, "string");
    await B.evaluate((t) => NET.up.event.send({ t: "perm-hi", ticket: t }), stolen);
    await host.waitForFunction((t) => __checks.some((c) => c.ticket === t), stolen, { timeout: 30000 });
    await host.waitForTimeout(300);
    assert.deepEqual(await has(peerB), { perm: false, grant: false }, "the other guest did not get the cheats");
    assert.equal(await host.evaluate((t) => __checks.filter((c) => c.ticket === t).every((c) => !c.perm), stolen), true, "the server said no to the ticket from the wrong peer");
    assert.deepEqual(await has(peerA), { perm: true, grant: true }, "the holder keeps its cheats");
    console.log("a ticket shown by another guest is refused");

    // 3. a ticket made without a peer (an old client) is refused, not an error
    const old = await f.h.api("perm_ticket", { token: await A.evaluate(() => ACCOUNT.session().token), room: code });
    assert.equal(old.ticket, null);

    // 4. banning the account takes its cheats at the host's next check, ticket or not
    assert.equal((await f.h.api("a_user_set", { atoken: owner.atoken, id: "cheater", op: "ban", days: 1, reason: "test" })).status, 200);
    await host.evaluate(() => PERM.recheck());
    await host.waitForFunction((p) => !PERM.host().perms.some(([k]) => k === p), peerA, { timeout: 30000 });
    assert.deepEqual(await has(peerA), { perm: false, grant: false }, "the banned account lost its cheats in the room");
    console.log("a banned account loses its cheats at the next check");
    assert.deepEqual(f.errors, []);
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
