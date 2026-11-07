// The operator's card (js/legacy/125-operator-card.js). Alone: an operator's starting pistol becomes the card and a throw kills
// the nearest enemy (armour, shield and invulnerability or not), once per 0.6 s; a plain player never keeps it. Online: a
// guest operator gets the card only after the host has the server's word for it, the throw is judged by the host (the
// guest presses fire as usual), everyone sees the card fly, and a plain guest gets nothing.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "card-owner" });
    for (const id of ["cardop", "cardguest", "cardplain", "cardhost"]) await f.h.api("auth", { id, pw: "password", device: "browser-test-" + id });
    for (const id of ["cardop", "cardguest"]) assert.equal((await f.h.api("a_user_set", { atoken: owner.atoken, id, op: "operator", on: true })).status, 200);
    const quiet = async (p) => { await p.evaluate(() => { window.__render = render; render = () => {}; titleCam = () => {}; }); return p; };

    // ── alone ──
    const solo = async (id) => {
      const page = await quiet(await f.page(id));
      await page.waitForTimeout(2500); // who am I (IS_OWNER for an operator)
      await page.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 99999; ADMIN.freezeAI = true; });
      await page.waitForFunction(() => myActor()?.alive);
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => {
        const me = myActor(), out = { owner: !!window.IS_OWNER, sidearm: me.weapons.secondary };
        const enemies = world.actors.filter((a) => a.team !== me.team && a.alive);
        // the nearest one is 6 m away with armour, a shield and invulnerability; the rest far off
        enemies.forEach((a, i) => { a.pos.set(me.pos.x + (i === 0 ? 6 : 40 + i * 5), a.pos.y, me.pos.z); });
        const near = enemies[0]; near.armor = 50; near.shielded = 9; near.invuln = 9;
        if (me.weapons.secondary !== OP_CARD.key) { me.weapons.secondary = OP_CARD.key; me.ammo[OP_CARD.key] = 1; } // a plain player forcing it
        me.slot = "secondary"; me.fireCd = 0;
        const kills0 = world.stats.kills | 0;
        actorFire(me);
        out.nearDead = !near.alive; out.othersAlive = enemies.slice(1).every((a) => a.alive); out.kills = (world.stats.kills | 0) - kills0;
        // straight away again: the cooldown holds
        const second = enemies[1]; second.pos.set(me.pos.x + 3, second.pos.y, me.pos.z);
        actorFire(me); out.cooldownHeld = second.alive;
        return out;
      });
      await page.waitForTimeout(1200);
      r.after = await page.evaluate(() => myActor().weapons.secondary);
      await page.context().close();
      return r;
    };
    const op = await solo("cardop"), plain = await solo("cardplain");
    console.log("solo", JSON.stringify({ op, plain }));
    assert.equal(op.owner, true);
    assert.equal(op.sidearm, "card", "an operator's starting pistol becomes the card");
    assert.ok(op.nearDead && op.othersAlive && op.kills === 1, "the card kills the nearest enemy only, armour and invulnerability or not");
    assert.ok(op.cooldownHeld, "one throw per 0.6 s");
    assert.equal(op.after, "card");
    assert.equal(plain.sidearm, "pistol", "a plain player has the pistol");
    assert.ok(!plain.nearDead && plain.after === "pistol", "a plain player who forces the card kills nobody and loses it");

    // ── online: a plain host, a guest operator and a plain guest ──
    const prep = (p) => p.evaluate(async (port) => { await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } }); }, PORT);
    const H = await quiet(await f.page("cardhost")), G = await quiet(await f.page("cardguest")), P = await quiet(await f.page("cardplain"));
    for (const p of [H, G, P]) await prep(p);
    await G.waitForTimeout(2500);
    const code = await H.evaluate(async () => { await createRoom(); return NET.room; });
    for (const [i, g] of [G, P].entries()) { await g.evaluate((c) => joinRoom(c), code); await H.waitForFunction((n) => room.members.size === n, i + 2, { timeout: 60000 }); }
    const gPeer = await G.evaluate(() => NET.peer.id), pPeer = await P.evaluate(() => NET.peer.id);
    await H.evaluate(() => { room.mode = "std"; room.map = "field"; hostStartMatch(); });
    for (const g of [G, P]) await g.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    await H.evaluate(() => { world.roundTime = 99999; ADMIN.freezeAI = true; closeShop(); world.phase = "live"; locked = true; });
    // the guest operator says who it is; the host asks the server; then the card is given
    await H.waitForFunction((p) => HUNTX.OWNP.has(p), gPeer, { timeout: 30000 });
    await H.waitForFunction((p) => world.actors.find((a) => a.ctrl === p)?.weapons.secondary === "card", gPeer, { timeout: 10000 });
    await G.waitForFunction(() => myActor().weapons.secondary === "card", null, { timeout: 10000 });
    assert.equal(await H.evaluate((p) => world.actors.find((a) => a.ctrl === p).weapons.secondary, pPeer), "pistol", "a plain guest keeps the pistol");
    // the guest throws by pressing fire; the host finds the nearest enemy of the guest and kills it
    const target = await H.evaluate((p) => {
      const g = world.actors.find((a) => a.ctrl === p), foes = world.actors.filter((a) => a.alive && a.team !== g.team);
      foes.forEach((a, i) => { a.pos.set(g.pos.x + (i === 0 ? 7 : 50 + 5 * i), a.pos.y, g.pos.z); a.invuln = 0; });
      foes[0].armor = 50; foes[0].invuln = 9;
      return foes[0].id;
    }, gPeer);
    await G.evaluate(() => { const me = myActor(); me.slot = "secondary"; player.slot = "secondary"; try { updateViewmodel(true); } catch (e) {} });
    await G.waitForTimeout(400);
    // a press can fall inside the card's draw on a slow machine (and the throw then never starts): press again, a few
    // times, until the host has the kill; what is checked is that a throw kills, not that the first 250 ms catch it
    const dead = (id) => !world.actors.find((a) => String(a.id) === String(id)).alive;
    for (let i = 0; i < 10 && !(await H.evaluate(dead, target)); i++) {
      await G.evaluate(() => { keys.fire = true; setTimeout(() => (keys.fire = false), 250); });
      await H.waitForFunction(dead, target, { timeout: 2000 }).catch(() => {});
    }
    assert.ok(await H.evaluate(dead, target), "the host kills the nearest enemy of the guest operator");
    const seen = await P.evaluate(() => new Promise((res) => { const t0 = performance.now(); (function wait() { const dead = world.actors.filter((a) => !a.alive).length; dead || performance.now() - t0 > 4000 ? res(dead) : setTimeout(wait, 100); })(); }));
    assert.ok(seen >= 1, "the other guest sees the kill");
    // a plain guest pressing fire with the card forced in its own game kills nobody: the host does not give it the card
    const alive0 = await H.evaluate(() => world.actors.filter((a) => a.alive).length);
    await P.evaluate(() => { const me = myActor(); me.weapons.secondary = "card"; me.slot = "secondary"; player.slot = "secondary"; keys.fire = true; setTimeout(() => (keys.fire = false), 250); });
    await H.waitForTimeout(1500);
    assert.equal(await H.evaluate(() => world.actors.filter((a) => a.alive).length), alive0, "a plain guest's forced card kills nobody");
    assert.deepEqual(f.errors, []);
    console.log("operator card: alone an operator's card kills the nearest enemy (armour/invulnerability or not) once per 0.6 s and a plain player has none; online the host gives it to a confirmed guest operator, judges the throw, and ignores a plain guest's");
  } finally { await f.browser.close(); signaling && signaling.close && signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
