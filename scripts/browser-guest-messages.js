// What a guest can make the host do, and how a leaver is announced: lobby messages are ignored once the match runs, malformed
// messages throw nothing, a weapon key must be a string, a peer id of "me" / "ai" / "dead" is refused, a guest plants and
// defuses the spike, the host leaving says so, and a guest that quits has its body handed to a bot.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const prep = async (page, forceId) => {
      await page.evaluate(async ([port, forceId]) => {
        render = () => {}; titleCam = () => {};
        await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } });
        window.__alerts = []; const alert = netAlert; netAlert = function (m) { __alerts.push(String(m)); return alert.apply(this, arguments); };
        if (forceId) { const P = window.Peer; window.Peer = function (id, o) { return new P(forceId, o); }; window.Peer.prototype = P.prototype; }
      }, [PORT, forceId]);
    };
    const raw = (page, msg) => page.evaluate((m) => NET.up.event.send(m), msg);
    const host = await f.page("hoster"), A = await f.page("joinerA"), B = await f.page("joinerB");
    for (const p of [host, A, B]) await prep(p);
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    for (const [i, g] of [A, B].entries()) { await g.evaluate((c) => joinRoom(c), code); await host.waitForFunction((n) => room.members.size === n, i + 2, { timeout: 60000 }); }
    const peerA = await A.evaluate(() => NET.peer.id), peerB = await B.evaluate(() => NET.peer.id);
    await host.evaluate(() => { room.mode = "std"; hostStartMatch(); });
    for (const g of [A, B]) await g.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    await host.evaluate(() => { world.roundTime = 99999; ADMIN.freezeAI = true; for (const a of world.actors) a.invuln = 999; });

    // 1. lobby messages after the start do nothing (they used to put the lobby up over every guest)
    const slots = () => host.evaluate(() => JSON.stringify(room.slots) + JSON.stringify([...room.members].map(([k, m]) => [k, m.team, m.slot, m.agentKey])));
    const before = await slots();
    const key = await host.evaluate((p) => room.members.get(p).agentKey, peerB);
    await raw(B, { t: "agent", key });
    for (const team of ["atk", "def"]) for (let slot = 0; slot < 5; slot++) await raw(B, { t: "move", team, slot });
    await host.waitForTimeout(1000);
    assert.equal(await A.evaluate(() => document.getElementById("lobby").hidden), true, "the other guest's screen is not covered by the lobby");
    assert.equal(await slots(), before, "the seats did not change");
    console.log("lobby messages are ignored in a match");

    // 2. malformed messages throw nothing on the host
    f.errors.length = 0;
    for (const m of [{ t: "move", team: null, slot: null }, { t: "move", team: "x", slot: 0 }, { t: "move", team: "atk", slot: "1" }, { t: "hello", name: { toString: 1 } }, { t: "hello", name: ["a", { toString: 1 }] }, { t: "buy", kind: { toString: 1 }, key: 1 }, { t: "buy", kind: "weapon", key: { toString: 1 } }]) await raw(B, m);
    await host.waitForTimeout(800);
    assert.deepEqual(f.errors, [], "no uncaught error on the host");
    console.log("malformed messages throw nothing");

    // 3. a weapon key must be a string (an array used to land in the weapon slot, and an array holding "rpg" fired as a hitscan)
    const primary = () => host.evaluate((p) => { const a = world.actors.find((x) => x.ctrl === p); return a.weapons.primary; }, peerB);
    await raw(B, { t: "buy", kind: "weapon", key: ["rpg"] }); await host.waitForTimeout(400);
    assert.equal(await primary(), null, "an array key buys nothing");
    await raw(B, { t: "buy", kind: "weapon", key: "rifle" }); await host.waitForTimeout(400);
    assert.equal(await primary(), "rifle", "a normal purchase still works");
    console.log("weapon keys are checked");

    // 4. a guest whose peer id is "me" / "ai" / "dead" is not let in (it would drive the host's own player)
    const ctrlsBefore = await host.evaluate(() => world.actors.map((a) => String(a.ctrl)).join());
    for (const id of ["me", "ai", "dead"]) {
      const M = await f.page("joiner" + id); await prep(M, id);
      M.evaluate((c) => joinRoom(c), code).catch(() => {});
      await host.waitForTimeout(4000);
      assert.equal(await host.evaluate((id) => NET.conns.has(id) || room.members.has(id), id), false, "no seat for the peer id " + id);
      await M.evaluate(() => { try { netShutdown(); } catch (e) {} });
    }
    assert.equal(await host.evaluate(() => world.actors.map((a) => String(a.ctrl)).join()), ctrlsBefore, "the bodies did not change hands");
    console.log("reserved peer ids are refused");

    // 5. a guest plants and defuses: the real client holds F, the host counts the time
    const setup = await host.evaluate((p) => {
      const g = world.actors.find((a) => a.ctrl === p);
      for (const a of world.actors) if (a !== g) { a.pos.x = 300; a.pos.z = 300; a.hasSpike = false; }
      g.team = "atk"; g.hasSpike = true; g.alive = true; world.phase = "live"; world.over = false;
      world.spike.state = "carried"; world.spike.carrier = g;
      const site = MAP.sites[0]; g.pos.x = site.x; g.pos.z = site.z; g.vel.set(0, 0, 0);
      return { plant: SPIKE.PLANT, defuse: SPIKE.DEFUSE };
    }, peerB);
    await B.waitForFunction(() => world.phase === "live", null, { timeout: 20000 });
    const spike = () => host.evaluate((p) => { const g = world.actors.find((a) => a.ctrl === p); return { state: world.spike.state, planting: g.planting, defusing: g.defusing }; }, peerB);
    await B.evaluate(() => { keys.f = true; });
    await host.waitForTimeout(1200);
    assert.ok((await spike()).planting > 0, "planting counts up on the host while F is held");
    await B.evaluate(() => { keys.f = false; });
    await host.waitForTimeout(800);
    const released = await spike();
    assert.equal(released.state, "carried");
    assert.equal(released.planting, 0, "letting go stops it");
    await B.evaluate(() => { keys.f = true; });
    await host.waitForFunction(() => world.spike.state === "planted", null, { timeout: (setup.plant + 8) * 1000 });
    await B.evaluate(() => { keys.f = false; });
    console.log("a guest planted the spike");
    await host.evaluate((p) => { const g = world.actors.find((a) => a.ctrl === p); g.team = "def"; g.hasSpike = false; world.spike.x = g.pos.x + 0.5; world.spike.z = g.pos.z; world.spike.timer = 9999; world.spike.halfDefused = false; for (const a of world.actors) a.planting = 0; }, peerB);
    await B.evaluate(() => { keys.f = true; });
    await host.waitForFunction(() => world.spike.state === "defused", null, { timeout: (setup.defuse + 10) * 1000 });
    await B.evaluate(() => { keys.f = false; });
    console.log("a guest defused the spike");

    // 6. a guest that quits: the host gives its body to a bot at once
    const bodyA = await host.evaluate((p) => world.actors.find((a) => a.ctrl === p).id, peerA);
    await A.evaluate(() => { document.getElementById("pz-quit").onclick(); });
    await host.waitForFunction((id) => world.actors.find((x) => x.id === id).ctrl === "ai", bodyA, { timeout: 15000 });
    console.log("a guest that quit was replaced by a bot");

    // 7. the host quits on purpose: the guest is told at once, without redialling or the connection-problem card
    await host.evaluate(() => { document.getElementById("pz-quit").onclick(); });
    await B.waitForFunction(() => "solo" === NET.mode, null, { timeout: 10000 });
    const seen = await B.evaluate(() => ({ alerts: __alerts, redials: (window.NET_RC && NET_RC.log) || [], card: !!document.getElementById("ice-notice") && !document.getElementById("ice-notice").hidden }));
    assert.ok(seen.alerts.some((m) => /방장/.test(m)), "told the host left: " + JSON.stringify(seen.alerts));
    assert.deepEqual(seen.redials, [], "no redial");
    assert.equal(seen.card, false, "no connection-problem card");
    console.log("the host leaving was announced");
    assert.deepEqual(f.errors, []);
    console.log("guest message browser checks passed");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
