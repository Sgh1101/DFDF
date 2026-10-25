const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Aim assist: on a phone the view leans toward an enemy near the crosshair and follows it a
// little; on a computer only with the owner's grant (or admin mode); a computer never in ranked.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("aimer");
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(600);
    const out = await page.evaluate(() => {
      render = () => {};
      const A = AIM_ASSIST, res = {};
      const foe = otherFighters().find((o) => o.team !== player.team && o.alive);
      // a clear line: turn until 9 m ahead is open
      // (bots throw smoke even when frozen, and smoke blocks sight: clear it first)
      // ADMIN.freezeAI stops the bots walking, not casting: a bot spider's silk pulls the player in, a bot's dash moves
      // itself, and either changes the angle between them without any aim assist. Silence every other fighter.
      const put = (off) => {
        for (const o of world.actors) if (o !== player) o.silenced = 1e9;
        world.smokes && (world.smokes.length = 0);
        world.phase = "live"; player.alive = true; foe.alive = true;
        for (const dist of [9, 7, 5, 3.5])
          for (let k = 0; k < 24; k++) {
            const yaw = player.yaw + off, x = player.pos.x - Math.sin(yaw) * dist, z = player.pos.z - Math.cos(yaw) * dist;
            if (!rayBlocked(player.pos.x, player.y + eyeHeight(), player.pos.z, x, player.y + 1.3, z) && !collideXZ(x, z, 0, 0.5)) { foe.pos.x = x; foe.pos.z = z; foe.y = player.y; return true; }
            player.yaw += Math.PI / 12;
          }
        return false;
      };
      const err = () => { const dx = foe.pos.x - player.pos.x, dz = foe.pos.z - player.pos.z; let d = Math.atan2(-dx, -dz) - player.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
      // run the game for a while, the player turning a hair each step (so the assist sees someone aiming)
      const run = (n, moveFoe) => { for (let i = 0; i < n; i++) { player.invuln = 99; foe.invuln = 99; player.yaw += 1e-4; if (moveFoe) { foe.pos.x += moveFoe.x; foe.pos.z += moveFoe.z; } player.pitch = 0; step(1 / 60); } };
      player.vel.set(0, 0, 0);
      const trial = (label, setup) => {
        player.pitch = 0;
        setup();
        A.state.init = false; A.state.tgt = null;
        const ok = put(0.07); const e0 = err(); run(60); const e1 = err();
        res[label] = { placed: ok, before: +e0.toFixed(4), after: +e1.toFixed(4), pulled: e1 < e0 * 0.8, on: A.on(), why: A.access().why || "" };
      };
      const sess = ACCOUNT.session(); sess.user = sess.user || {};
      trial("phone", () => { A._phone = true; A.pref.mobile = true; });
      trial("phoneOff", () => { A._phone = true; A.pref.mobile = false; });
      trial("pcNoGrant", () => { A._phone = false; A.pref.pc = true; sess.user.aim = { pc: false, mobile: true }; });
      trial("pcGrant", () => { A._phone = false; A.pref.pc = true; sess.user.aim = { pc: true, mobile: true }; });
      trial("pcGrantSwitchOff", () => { A._phone = false; A.pref.pc = false; sess.user.aim = { pc: true, mobile: true }; });
      trial("phoneClosedForAccount", () => { A._phone = true; A.pref.mobile = true; sess.user.aim = { pc: false, mobile: false }; });
      window.SERVER_CFG = Object.assign({}, window.SERVER_CFG || {}, { aim: { mobile: false, pc: true, strength: 35, range: 45, cone: 8, ranked: true } });
      trial("phoneOwnerOff", () => { A._phone = true; A.pref.mobile = true; sess.user.aim = { pc: false, mobile: true }; });
      window.SERVER_CFG.aim = { mobile: true, pc: true, strength: 35, range: 45, cone: 8, ranked: true };
      // ranked: a computer loses it even with the grant, a phone keeps it
      room.ranked = true; RANKED.locked = true;
      trial("pcRanked", () => { A._phone = false; A.pref.pc = true; sess.user.aim = { pc: true, mobile: true }; });
      trial("phoneRanked", () => { A._phone = true; A.pref.mobile = true; });
      room.ranked = false; RANKED.locked = false;
      // following: the enemy walks sideways and the view goes a little with it
      A._phone = true; A.pref.mobile = true; A.state.init = false; A.state.tgt = null;
      res.followPlaced = put(0); const y0 = player.yaw;
      const side = { x: -Math.cos(player.yaw) * 0.03, z: Math.sin(player.yaw) * 0.03 };
      run(40, side);
      res.follow = { turned: +Math.abs(player.yaw - y0 - 40 * 1e-4).toFixed(4), err: +err().toFixed(4) };
      // a wall in between: nothing
      res.err = window.__aimErr ? String(window.__aimErr) : null;
      // the settings row
      res.row = { sw: !!document.getElementById("st-aim"), lvl: !!document.getElementById("st-aimlvl") };
      A._phone = false; sess.user.aim = { pc: false, mobile: true }; A.paint();
      res.row.pcText = document.getElementById("st-aim-d").textContent; res.row.pcDisabled = document.getElementById("st-aim").disabled;
      return res;
    });
    console.log(JSON.stringify(out));
    for (const k of ["phone", "pcGrant", "phoneRanked"]) assert.ok(out[k].placed && out[k].on && out[k].pulled, k + ": the aim leans in " + JSON.stringify(out[k]));
    for (const k of ["phoneOff", "pcNoGrant", "pcGrantSwitchOff", "phoneClosedForAccount", "phoneOwnerOff", "pcRanked"]) assert.ok(!out[k].on && !out[k].pulled, k + ": no assist " + JSON.stringify(out[k]));
    assert.match(out.pcNoGrant.why, /권한|owner/);
    assert.match(out.pcRanked.why, /랭크|ranked/);
    assert.ok(out.followPlaced, "the enemy is placed for the follow check");
    assert.ok(out.follow.turned > 0.02, "the aim follows a moving enemy " + JSON.stringify(out.follow));
    assert.equal(out.err, null);
    assert.ok(out.row.sw && out.row.lvl && out.row.pcDisabled && /권한|owner/.test(out.row.pcText), "the settings switch, locked on a computer without the grant " + JSON.stringify(out.row));
    assert.deepEqual(f.errors, []);
    console.log("aim assist: phone free, computer by grant, off in ranked on a computer, follows a moving enemy");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
