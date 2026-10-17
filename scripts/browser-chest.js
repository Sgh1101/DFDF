const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The golden chest in every building: one per house on every map that has them (none on the field, the duels, or in the modes
// that turn it off); five seconds of holding F opens it (letting go or leaving starts over); the golden pistol takes the
// pistol slot with one bullet that hits for 200, and is gone with that shot, the pistol back; a new round closes the chest.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("chest", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "pogu"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 1e5; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    // 1. a chest in every house, on the ground floor off the stair
    const counts = await page.evaluate(() => {
      const out = {};
      for (const m of MAP_LIST) {
        if (!BUILDINGS.plan[m.key]) { out[m.key] = [0, 0]; continue; }
        loadMap(m.key);
        out[m.key] = [GOLD_CHESTS.list().length, BUILDINGS.plan[m.key].b.length];
      }
      loadMap("pogu");
      return out;
    });
    for (const [k, [n, h]] of Object.entries(counts)) assert.equal(n, h, k + ": a chest for each house");
    assert.ok(Object.values(counts).filter(([n]) => n >= 2).length >= 16, "16 maps with two or more chests");
    const r = await page.evaluate(() => {
      const me = myActor(), out = {}, C = GOLD_CHESTS, L = C.list();
      // along the long side of the house the floor is clear
      const at = (c, d) => { const rot = BUILDINGS.plan[CUR_MAP_KEY].b[c.i][4]; me.pos.set(c.x + (rot ? 0 : d), 0, c.z + (rot ? d : 0)); me.y = 0; };
      window.__at = at;
      at(L[0], -2.6); me.hp = 100; me.invuln = 99;
      // the golden pistol is a real, quiet-in-the-lists gun
      out.stats = [WEAPONS.golden.dmg, WEAPONS.golden.mag, Object.keys(WEAPONS).includes("golden")];
      // too far: nothing happens
      keys.f = true; for (let i = 0; i < 120; i++) step(0.05);
      out.far = L[0].open;
      // let go half way: starts over
      at(L[0], -1.0);
      keys.f = true; for (let i = 0; i < 60; i++) step(0.05);   // 3 s
      out.half = L[0].open;
      keys.f = false; for (let i = 0; i < 80; i++) step(0.05);  // let go for 4 s
      keys.f = true; for (let i = 0; i < 60; i++) step(0.05);   // 3 s again: still not
      out.again = L[0].open;
      keys.f = false; for (let i = 0; i < 80; i++) step(0.05);
      // a full five seconds
      keys.f = true; for (let i = 0; i < 90; i++) step(0.05);   // 4.5 s
      out.before = L[0].open;
      for (let i = 0; i < 20; i++) step(0.05);                  // past 5 s
      keys.f = false;
      out.open = L[0].open;
      out.gun = [me.weapons.secondary, me.ammo.golden, me.slot, me.reserve.golden];
      out.shown = curWeaponKey();
      out.hint = !document.getElementById("chest-hint").hidden;
      return out;
    });
    assert.equal(r.far, false, "too far to open");
    assert.equal(r.half, false, "3 seconds is not enough");
    assert.equal(r.again, false, "letting go starts over");
    assert.equal(r.before, false, "4.5 seconds is not enough");
    assert.equal(r.open, true, "opens after five");
    assert.deepEqual(r.stats, [200, 1, false], "200 damage, one bullet, hidden from the lists");
    assert.deepEqual(r.gun, ["golden", 1, "secondary", 0]);
    assert.equal(r.shown, "golden");
    // 2. one shot: 200 damage to someone in front, then the gun is gone and the pistol is back
    const s = await page.evaluate(() => {
      world.roundTime = 1e5;
      const me = myActor(), L = GOLD_CHESTS.list(), out = {}, c = L[0], rot = BUILDINGS.plan[CUR_MAP_KEY].b[0][4];
      const foe = world.actors.find((a) => a !== me && a.team !== me.team && a.alive);
      window.__at(c, -3); me.yaw = rot ? Math.PI : -Math.PI / 2; me.pitch = 0; me.fireCd = 0;
      foe.pos.set(c.x + (rot ? 0 : 1.5), 0, c.z + (rot ? 1.5 : 0)); foe.invuln = 0; foe.hp = 100; foe.armor = 50; foe.y = 0;
      keys.fire = false;
      const before = foe.hp + foe.armor;
      fire();
      out.dealt = before - (foe.alive ? foe.hp + foe.armor : 0);
      out.dead = !foe.alive;
      out.left = me.ammo.golden;
      for (let i = 0; i < 12; i++) step(0.05);
      out.after = [me.weapons.secondary, me.ammo.golden, me.slot];
      out.cur = curWeaponKey();
      return out;
    });
    assert.ok(s.dead || s.dealt >= 100, "the shot kills: " + JSON.stringify(s));
    assert.equal(s.left, 0, "one bullet");
    assert.deepEqual(s.after.slice(0, 2), ["pistol", undefined], "gone with the shot, the pistol back");
    assert.notEqual(s.cur, "golden");
    // 3. a second chest opens for a guest-style request and a new round closes them again
    const n = await page.evaluate(() => {
      const L = GOLD_CHESTS.list();
      const open = L.filter((c) => c.open).length;
      world.round++; startRound(); world.phase = "live"; world.roundTime = 1e5;
      return [open, L.filter((c) => c.open).length, myActor().weapons.secondary];
    });
    assert.deepEqual(n, [1, 0, "pistol"], "a new round closes the chest");
    // 4. switched off where it should be
    const off = await page.evaluate(() => {
      world.roundTime = 1e5;
      const me = myActor(), L = GOLD_CHESTS.list(), out = [];
      for (const m of ["knife", "gun", "range"]) {
        room.mode = m; window.__at(L[1], -1); keys.f = true;
        for (let i = 0; i < 120; i++) step(0.05);
        out.push(L[1].open); keys.f = false;
      }
      room.mode = "std"; room.ranked = !0; window.__at(L[1], -1); keys.f = true;
      for (let i = 0; i < 120; i++) step(0.05);
      out.push(L[1].open); keys.f = false; room.ranked = !1;
      return out;
    });
    assert.deepEqual(off, [false, false, false, false], "off in the melee, ladder, range and ranked");
    assert.deepEqual(f.errors, []);
    console.log("chest: " + Object.keys(counts).length + " maps, five seconds, one 200-damage shot, gone after it");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
