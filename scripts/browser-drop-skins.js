const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// A gun swapped for one on the ground lies there in the skin its owner wore on it (not the skin of an earlier drop on the
// same spot, and not the stock one), on the host's screen and in the drops list the host sends to the guests.
(async () => {
  const f = await fixture();
  try {
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "drop-skins-owner" });
    const page = await f.page("dropskins", { width: 960, height: 540 }, {}, { quality: "perf" });
    assert.equal((await f.h.api("a_user_set", { atoken: owner.atoken, id: "dropskins", op: "grant", item: "smg|lava" })).status, 200);
    await page.evaluate(() => GUN_SKINS.sync());
    await page.waitForFunction(() => GUN_SKINS.owns("smg", "lava") && GUN_SKINS.owns("rifle", "dragon"), null, { timeout: 20000 });
    await page.evaluate(() => {
      GUN_SKINS.set("rifle", "dragon"); GUN_SKINS.set("smg", "lava");
      titleCam = () => {}; room.mode = "std"; room.map = "field"; room.rounds = 13; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true;
    });
    await page.waitForTimeout(600);
    const out = await page.evaluate(() => {
      const me = myActor(), foes = world.actors.filter((a) => a.team !== me.team), res = { solo: [], host: [] };
      world.actors.forEach((a) => { if (a !== me) a.fireCd = 999; });
      me.alive = true; me.hp = 100; me.invuln = 999; me.weapons.primary = "rifle"; me.slot = "primary";
      // a foe holding an SMG dies beside me (another foe lives, so it is not the round's last kill): the gun lies there
      const v = foes[0]; v.hp = 1; v.armor = v.shielded = 0; v.weapons.primary = "smg"; v.pos.set(me.pos.x + 1, 0, me.pos.z); v.y = 0;
      dealDamage(v, 999, false, me);
      for (let i = 0; i < 6; i++) step(0.05);
      const ground = () => QOL.DROPS().map((d) => ({ key: d.key, skin: d.mesh && d.mesh.userData.spin ? d.mesh.userData.spin.userData.skin || "default" : "?" }));
      const index = (id) => GUN_SKINS.list.find((s) => s.id === id).i;
      // press the pickup key on the spot four times: the gun in hand goes down, the one on the ground comes up
      const swap = (mode, sent) => {
        const held = me.weapons.primary, saved = { mode: NET.mode, conns: NET.conns };
        if (mode === "host") { NET.mode = "host"; NET.conns = new Map([["peer-x", { event: { open: true, send: (m) => sent.push(JSON.parse(JSON.stringify(m))) } }]]); }
        try { QOL.tryPickup(); } finally { NET.mode = saved.mode; NET.conns = saved.conns; }
        for (let i = 0; i < 3; i++) step(0.05);
        const down = ground().find((g) => g.key === held), want = GUN_SKINS.of(held).id, list = sent.filter((m) => m.t === "drops").pop();
        const row = list && list.l.find((r) => r[1] === held);
        return { held, want, skin: down && down.skin, sentIndex: row ? row[4] : undefined, wantIndex: index(want) };
      };
      for (let i = 0; i < 4; i++) res.solo.push(swap("solo", []));
      for (let i = 0; i < 4; i++) res.host.push(swap("host", []));
      return res;
    });
    console.log(JSON.stringify(out));
    for (const r of out.solo) assert.equal(r.skin, r.want, "the " + r.held + " dropped in a swap lies in its owner's skin: " + JSON.stringify(r));
    for (const r of out.host) {
      assert.equal(r.skin, r.want, "on the host's screen: " + JSON.stringify(r));
      assert.equal(r.sentIndex, r.wantIndex, "and in the list the guests are sent: " + JSON.stringify(r));
    }
    assert.deepEqual(f.errors, []);
    console.log("drop skins: a gun swapped for one on the ground lies in its owner's skin, on the host and in the drops list");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
