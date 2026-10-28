// The cheat-code hunt, checked by the host. The code reaches every guest so their screens can paint it on the building,
// so a changed client could send it straight from its spawn, or try every code in a second. The host now takes a guest's
// code only from an account the server confirmed (the cheat tabs are for accounts with admin rights, and F9 no longer
// opens them for anyone else), once the guest's body has been where it could see every painted side, and holds off the
// next try for wrongWaitSec after a refused one; the guest's screen says which.
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
      window.__ans = []; const oe = NET.onEvent; NET.onEvent = (e) => { e && "hunt-ans" === e.t && __ans.push(e); return oe(e); };
    }, PORT);
    const host = await f.page("hunthost"), guest = await f.page("huntguest");
    for (const p of [host, guest]) await prep(p);
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => room.members.size === 2, null, { timeout: 60000 });
    const peer = await guest.evaluate(() => NET.peer.id);
    await host.evaluate(() => { room.mode = "std"; room.map = "pogu"; hostStartMatch(); });
    await guest.waitForFunction(() => "client" === NET.mode && myActor() && HUNTX.HUNT.code.length > 0, null, { timeout: 90000 });
    await host.evaluate(() => { world.roundTime = 99999; ADMIN.freezeAI = true; for (const a of world.actors) a.invuln = 999; });
    const sides = await host.evaluate(() => HUNTX.sides().length);
    assert.ok(sides >= 2, "the code is painted on " + sides + " sides");
    const state = () => host.evaluate((p) => ({ ok: HUNTX.OK.has(p), seen: (HUNTX.SEEN.get(p) || { s: new Set() }).s.size, v: HUNTX.HUNT.v }), peer);
    const send = async (c) => {
      const n = await guest.evaluate(() => __ans.length);
      await guest.evaluate((c) => sendAction({ t: "hunt-try", r: HUNTX.HUNT.r, v: HUNTX.HUNT.v, c }), c);
      await guest.waitForFunction((n) => __ans.length > n, n, { timeout: 20000 });
      return guest.evaluate(() => __ans[__ans.length - 1]);
    };
    const right = () => guest.evaluate(() => HUNTX.HUNT.code);

    // 0. an account without admin rights: F9 opens nothing
    await guest.evaluate(() => dispatchEvent(new KeyboardEvent("keydown", { key: "F9" })));
    assert.equal(await guest.evaluate(() => document.getElementById("admin").hidden), true, "F9 opens no cheat panel for an account without admin rights");
    console.log("F9 opens nothing for an account without admin rights");

    // 1. a changed client opens its panel anyway; typed from the spawn, far from the building: refused, and the panel
    // says to go and see it
    assert.ok((await state()).seen < sides, "setup: from its spawn the guest has not seen every side");
    await guest.evaluate(() => { window.ADMIN_GRANTED = true; openAdmin(); document.getElementById("ht-pass").value = HUNTX.HUNT.code; document.getElementById("ht-go").click(); });
    await guest.waitForFunction(() => __ans.length > 0, null, { timeout: 20000 });
    await guest.waitForTimeout(200);
    const err = await guest.evaluate(() => { const e = document.getElementById("ht-err"); return e && !e.hidden ? e.textContent : ""; });
    assert.equal((await state()).ok, false, "a code sent from the spawn is not taken");
    assert.match(err, /직접 모두 보고/, "the panel says to go and see the digits (" + err + ")");
    await guest.evaluate(() => closeAdmin());
    console.log("a code from someone who has not seen it is refused");

    // 2. the guest's body walks round the building: in front of each painted side, with a clear view of it
    await guest.waitForTimeout(2200);
    for (let k = 0; k < sides; k++) {
      const spot = await host.evaluate(([p, k]) => {
        const s = HUNTX.sides()[k], c = s.pts[1];
        for (let d = 3; d <= 14; d += 0.5) {
          const x = s.fx + s.nx * d, z = s.fz + s.nz * d;
          if (!collideXZ(x, z, 0, 0.5) && !rayBlocked(x, 1.5, z, c.x, c.y, c.z)) {
            const a = world.actors.find((a) => a.ctrl === p);
            a.pos.set(x, 0, z); a.y = 0; a.vy = 0;
            return { x, z };
          }
        }
        return null;
      }, [peer, k]);
      assert.ok(spot, "found a spot in front of side " + k);
      await host.waitForTimeout(500);
    }
    assert.equal((await state()).seen, sides, "the host saw the guest look at every painted side");
    // ...but the server never confirmed this account: the right code is still refused
    assert.equal((await send(await right())).ok, false, "the right code from an account the server did not confirm is refused");
    assert.equal((await state()).ok, false, "and that guest gets no cheats");
    console.log("a guest whose account is not confirmed gets nothing, even with the right code");

    // 3. the host has confirmed the account (as the server's answer to its ticket does); after the wait, a wrong try
    // holds off the next one: the right code straight after it is refused too
    await host.evaluate((p) => HUNTX.GRANT.add(p), peer);
    await guest.waitForTimeout(2300);
    const wrong = String((Number(await right()) + 1) % 10 ** (await right()).length).padStart((await right()).length, "0");
    assert.equal((await send(wrong)).ok, false, "a wrong code is refused");
    const rushed = await send(await right());
    assert.equal(rushed.ok, false, "the right code within wrongWaitSec of a wrong one is refused");
    assert.equal((await state()).ok, false, "and the guest gets no cheats from it");
    console.log("a refused try holds off the next one");

    // 4. after the wait, the right code from a guest that has seen it is taken, and the code moves on
    const v = (await state()).v;
    await guest.waitForTimeout(2300);
    const fine = await send(await right());
    assert.equal(fine.ok, true, "the right code after the wait, from a guest that saw it, is taken");
    const after = await state();
    assert.equal(after.ok, true, "the host lets the guest's cheat switches through");
    assert.equal(after.v, v + 1, "the code moved to another building");
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("a guest that went and saw the code gets the round's cheats");
  } finally {
    await f.browser.close();
  }
  console.log("cheat hunt host checks passed");
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
