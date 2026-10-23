const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The spider's E and C look at what is in the aim line first.
//   E with an enemy in the line: the enemy is dragged to me (about 7 m) and slowed; I stay where I am and nothing swings.
//   E with nothing in the line: it is the web swing as before (the swing test keeps covering the swing itself).
//   C with an enemy in the line: the enemy is shut in (cannot move, shows), and I am not healed, rooted or protected.
//   C with nothing in the line: I go into the cocoon myself, as before (untouchable, cannot move, health back).
// The world is stepped by hand (the headless browser draws too slowly for real time to mean anything).
(async () => {
  const f = await fixture();
  const errors = [];
  try {
    const page = await f.page("spidersilk", { width: 1280, height: 720 });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.mouse.click(640, 360);
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS.find((a) => "geomi" === a.id), false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const out = {}, me = myActor() || player, geomi = AGENTS.find((a) => "geomi" === a.id);
      const E = geomi.abilities.find((a) => "y_webzip" === a.type), C = geomi.abilities.find((a) => "x_cocoon" === a.type);
      const dt = 1 / 60, step = (n) => { for (let i = 0; i < n; i++) { abilTick(dt); simMove(me, dt); } };
      const foes = foesOf(me); out.foes = foes.length;
      const foe = foes[0], others = foes.slice(1);
      const park = () => others.forEach((o, i) => { o.pos.x = me.pos.x + 400 + i; o.pos.z = me.pos.z + 400; });
      const dist = (a) => Math.hypot(a.pos.x - me.pos.x, a.pos.z - me.pos.z);
      // an open stretch of 16 m in front of me, where the enemy can stand in plain sight
      let yaw0 = null;
      for (let y = 0; y < 6.28 && yaw0 === null; y += 0.1) {
        const dx = -Math.sin(y), dz = -Math.cos(y);
        let ok = true;
        for (let d = 1; d <= 18; d += 0.5) if (collideXZ(me.pos.x + dx * d, me.pos.z + dz * d, me.y || 0, 0.5)) { ok = false; break; }
        ok && !rayBlocked(me.pos.x, (me.y || 0) + 1.5, me.pos.z, me.pos.x + dx * 16, (me.y || 0) + 1.2, me.pos.z + dz * 16) && (yaw0 = y);
      }
      out.open = yaw0 !== null;
      const put = (d) => { park(); me.yaw = yaw0; me.pitch = 0; foe.pos.x = me.pos.x - Math.sin(yaw0) * d; foe.pos.z = me.pos.z - Math.cos(yaw0) * d; foe.y = me.y; foe.root = 0; foe.revealed = 0; foe.slow = 1; foe.slowT = 0; };
      const clear = () => { me.invuln = 0; me.root = 0; me.hp = 50; foe.hp = 100; foe.alive = true; };
      // only the eggs: other effects fade on the real clock, which the hand-stepped world does not move
      const meshes = () => scene.children.filter((o) => o.isGroup && o.children.length === 2 && o.children[1].geometry && o.children[1].geometry.type === "IcosahedronGeometry").length;
      const home = [me.pos.x, me.pos.z];
      const still = () => Math.hypot(me.pos.x - home[0], me.pos.z - home[1]) < 0.05;

      // E at an enemy: dragged in about 7 m, slowed, and I did not swing
      put(14); clear(); const d0 = dist(foe); CAST_REFUND = false;
      castAbility("y_webzip", E); step(40);
      out.pulled = d0 - dist(foe); out.eSlow = foe.slow < 1 && foe.slowT > 0; out.eSwing = !!me.__swing; out.eStill = still(); out.eRefund = CAST_REFUND; CAST_REFUND = false;
      // an enemy close by is brought up to arm's length and no further
      put(5); clear(); const d1 = dist(foe); castAbility("y_webzip", E); step(40); out.near = [d1, dist(foe)];

      // E at nothing (the sky): no enemy is touched, the cast falls short and the charge comes back
      put(14); clear(); me.yaw = yaw0 + Math.PI; me.pitch = 1.4; CAST_REFUND = false;
      const d2 = dist(foe); castAbility("y_webzip", E); step(20);
      out.eMiss = { refund: CAST_REFUND, moved: Math.abs(d2 - dist(foe)), slow: foe.slow < 1 }; CAST_REFUND = false;

      // C at an enemy: they are shut in; I am not
      const m0 = meshes();
      put(14); clear(); castAbility("x_cocoon", C);
      out.trap = { root: foe.root, revealed: foe.revealed, meRoot: me.root || 0, meInvuln: me.invuln || 0, meHp: me.hp, foeInvuln: foe.invuln || 0, eggs: meshes() - m0 };
      step(60 * 3);
      out.trapEnd = { eggs: meshes() - m0 };
      // a dead enemy in the line is not a target
      put(14); clear(); foe.alive = false; castAbility("x_cocoon", C); out.deadFoe = { root: foe.root || 0, meInvuln: me.invuln || 0 }; foe.alive = true;
      step(60 * 3);

      // C at nothing: the cocoon is mine
      put(14); clear(); me.yaw = yaw0 + Math.PI; me.pitch = 0; foe.root = 0; castAbility("x_cocoon", C);
      out.self = { meRoot: me.root || 0, meInvuln: me.invuln || 0, meHp: me.hp, foeRoot: foe.root || 0 };
      step(60 * 3); out.errors = 0;
      out.descE = E.desc; out.descC = C.desc;
      return out;
    });
    console.log(JSON.stringify(r, null, 1));
    assert.ok(r.foes >= 1 && r.open, "a foe to aim at and an open line: " + JSON.stringify({ foes: r.foes, open: r.open }));
    // E
    assert.ok(r.pulled > 6.4 && r.pulled < 7.6, "the enemy is dragged about 7 m: " + r.pulled);
    assert.ok(r.eSlow && !r.eSwing && r.eStill && !r.eRefund, "slowed, and I did not swing or move: " + JSON.stringify(r));
    assert.ok(r.near[1] > 0.5 && r.near[1] < r.near[0], "a near enemy is brought closer but not through me: " + r.near);
    assert.ok(r.eMiss.refund && r.eMiss.moved < 0.05 && !r.eMiss.slow, "E at nothing is the old web cast: " + JSON.stringify(r.eMiss));
    // C
    assert.ok(r.trap.root >= 2.4 && r.trap.revealed >= 2.4, "the enemy is shut in and shows: " + JSON.stringify(r.trap));
    assert.ok(r.trap.meRoot === 0 && r.trap.meInvuln === 0 && r.trap.meHp === 50 && r.trap.foeInvuln === 0, "I am not in the cocoon and not healed, they are not protected: " + JSON.stringify(r.trap));
    assert.ok(r.trap.eggs === 1 && r.trapEnd.eggs === 0, "the egg is drawn and then taken away again: " + JSON.stringify([r.trap.eggs, r.trapEnd.eggs]));
    assert.ok(r.deadFoe.root === 0 && r.deadFoe.meInvuln >= 2, "a dead enemy is not a target, the cocoon is mine: " + JSON.stringify(r.deadFoe));
    assert.ok(r.self.meRoot >= 2 && r.self.meInvuln >= 2 && r.self.meHp === 90 && r.self.foeRoot === 0, "C at nothing is my own cocoon: " + JSON.stringify(r.self));
    assert.ok(/조준선/.test(r.descE) && /조준선/.test(r.descC), "the ability cards say it");
    assert.deepEqual(errors.concat(f.errors), [], "no page errors");
    console.log("Spider silk: E drags an enemy in the line and swings otherwise; C shuts an enemy in and is my own cocoon otherwise; no leftovers");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error("FAILED", e.message.slice(0, 1500)); process.exit(1); });
