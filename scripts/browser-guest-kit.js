// Cheat mode's ability sets for a guest (js/legacy/25-admin-panel.js stepKit/setKit): a guest with cheats (an operator,
// or an account the owner opened cheats for) switches to another agent's four abilities with the arrow keys; the host
// must give its body the same set, and using an ability must cast the new set's ability. That includes a set picked
// before the host had the server's word on the guest (the operator check and the cheat ticket take a moment): the host
// set it aside then, and the guest's screen showed abilities the host never gave it.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "kit-owner" });
    for (const id of ["kithost", "kitop", "kitperm"]) await f.h.api("auth", { id, pw: "password", device: "browser-test-" + id });
    assert.equal((await f.h.api("a_user_set", { atoken: owner.atoken, id: "kitop", op: "operator", on: true })).status, 200);
    assert.equal((await f.h.api("a_user_set", { atoken: owner.atoken, id: "kitperm", op: "perm", perm: { on: true, cheat: true }, days: 30 })).status, 200);
    const quiet = async (p) => { await p.evaluate(() => { render = () => {}; titleCam = () => {}; }); return p; };
    const prep = (p) => p.evaluate(async (port) => { await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } }); }, PORT);
    const H = await quiet(await f.page("kithost")), O = await quiet(await f.page("kitop")), Q = await quiet(await f.page("kitperm"));
    for (const p of [H, O, Q]) await prep(p);
    await O.waitForTimeout(2500);
    const code = await H.evaluate(async () => { await createRoom(); return NET.room; });
    for (const [i, g] of [O, Q].entries()) { await g.evaluate((c) => joinRoom(c), code); await H.waitForFunction((n) => room.members.size === n, i + 2, { timeout: 60000 }); }
    // the server's answer about the operator comes late (as on a slow line)
    let release; const gate = new Promise((r) => (release = r));
    await H.route("**/api/v1?a=owner_check*", async (route) => { await gate; await route.fallback(); });
    await H.evaluate(() => { room.mode = "std"; room.map = "field"; hostStartMatch(); });
    for (const g of [O, Q]) await g.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    await H.evaluate(() => { world.roundTime = 99999; ADMIN.freezeAI = true; closeShop(); world.phase = "live"; });
    // the operator turns cheats on and picks a set at once, before the host has heard back from the server
    await H.evaluate(() => { window.__casts = []; const c = castAbility; castAbility = function (type) { window.__casts.push(type); return c.apply(this, arguments); }; });
    const early = await O.evaluate(() => { ADMIN2.setPersonal("cheat", true); ADMIN2.afterChange(); ADMIN2.stepKit(1); ADMIN2.stepKit(1); return myActor()._kit; });
    await O.waitForTimeout(1500);
    release();
    // the host learns who they are (operator: the server's word; the other: its account's cheat ticket)
    const peers = {};
    for (const [name, g] of [["op", O], ["perm", Q]]) peers[name] = await g.evaluate(() => NET.peer.id);
    await H.waitForFunction((p) => HUNTX.OWNP.has(p), peers.op, { timeout: 30000 });
    await Q.waitForFunction(() => document.body.innerText.includes("이 방에서도") || true, null, { timeout: 1000 });
    await H.waitForTimeout(4000);
    await O.waitForTimeout(2500);
    const earlyHost = await H.evaluate((p) => world.actors.find((x) => x.ctrl === p)._kit || null, peers.op);
    const earlyGuest = await O.evaluate(() => ({ kit: myActor()._kit || null, types: myActor().abilities.map((a) => a.def.type) }));
    console.log("early", JSON.stringify({ early, earlyHost, earlyGuest }));
    assert.ok(early, "the guest picked a set early");
    assert.equal(earlyHost, earlyGuest.kit, "the host gives the guest the set it picked before the server answered");
    // and using an ability casts that set's ability on the host
    await H.evaluate((p) => { const a = world.actors.find((x) => x.ctrl === p); a.alive = true; window.__casts = []; }, peers.op);
    await O.evaluate(() => useAbility(0));
    await H.waitForFunction(() => window.__casts.length > 0, null, { timeout: 5000 });
    assert.equal(await H.evaluate(() => window.__casts[0]), earlyGuest.types[0], "the ability cast is the one on the guest's screen");
    const counts = {};
    await H.evaluate(() => { window.__acts = {}; const o = NET.onAction; NET.onAction = (peer, m) => { const k = peer + ":" + (m && m.t); window.__acts[k] = (window.__acts[k] || 0) + 1; return o(peer, m); }; });
    const out = {};
    for (const [name, g] of [["op", O], ["perm", Q]]) {
      await g.evaluate(() => { ADMIN2.setPersonal("cheat", true); ADMIN2.afterChange(); });
      await g.waitForTimeout(1500);
      const t0 = Date.now();
      await g.evaluate(() => { const me = myActor(); me.alive = true; ADMIN2.stepKit(1); ADMIN2.stepKit(1); });
      const want = await g.evaluate(() => ({ kit: myActor()._kit, types: myActor().abilities.map((a) => a.def.type) }));
      let host = null;
      for (let i = 0; i < 30; i++) {
        host = await H.evaluate((p) => { const a = world.actors.find((x) => x.ctrl === p); return { kit: a._kit, types: a.abilities.map((x) => x.def.type) }; }, peers[name]);
        if (host.kit === want.kit) break;
        await H.waitForTimeout(200);
      }
      await g.waitForTimeout(3000);
      const later = await g.evaluate(() => ({ kit: myActor()._kit, cheat: ADMIN2.P.cheat, types: myActor().abilities.map((a) => a.def.type) }));
      const hostLater = await H.evaluate((p) => { const a = world.actors.find((x) => x.ctrl === p); return { kit: a._kit, types: a.abilities.map((x) => x.def.type) }; }, peers[name]);
      out[name] = { want, host, later, hostLater, ms: Date.now() - t0 };
    }
    out.acts = await H.evaluate(() => window.__acts);
    console.log(JSON.stringify(out, null, 1));
    for (const name of ["op", "perm"]) {
      const r = out[name];
      assert.ok(r.want.kit, name + ": the guest switched sets");
      assert.equal(r.later.kit, r.want.kit, name + ": the guest keeps the set it picked");
      assert.equal(r.hostLater.kit, r.want.kit, name + ": the host gives the guest's body the same set");
      assert.deepEqual(r.hostLater.types, r.later.types, name + ": the same four abilities on both sides");
    }
    // the host takes the set back (cheats ended, a new round for a guest without rights, the owner's revoke): the guest follows
    await H.evaluate((p) => { const a = world.actors.find((x) => x.ctrl === p); ADMIN2.setKit(a, a.agent); }, peers.perm);
    await Q.waitForFunction(() => !myActor()._kit, null, { timeout: 5000 });
    assert.deepEqual(f.errors, []);
    console.log("guest kit: operator and permitted guests switch ability sets and the host follows");
  } finally { await f.browser.close(); signaling && signaling.close && signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
