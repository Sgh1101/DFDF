const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The knife cut everything in reach in front of it, with no look at what lay between or above: through a wall, and
// through the floor to someone standing a storey up. A shot is stopped by both. Here a wall between two fighters
// 2 m apart, then a fighter on another floor right above, and then nothing in the way (the cut still lands).
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("kniwalls", { width: 1280, height: 720 });
    const out = await page.evaluate(() => {
      render = () => {};
      titleCam = () => {};
      room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop();
      world.phase = "live"; world.roundTime = 9999;
      aiThink = function () {}; checkRoundEnd = function () {};
      const me = myActor(), bot = world.actors.find((a) => a !== me && a.team !== me.team);
      // an open stretch
      const B = MAP.bounds;
      let cx = 0, cz = 0;
      for (let k = 0; k < 800; k++) {
        const x = B.minX + 14 + ((k * 37) % 101) / 101 * (B.maxX - B.minX - 28), z = B.minZ + 20 + ((k * 61) % 103) / 103 * (B.maxZ - B.minZ - 30);
        let open = true;
        for (let dx = -4; dx <= 4 && open; dx += 1.5) for (let dz = -8; dz <= 3 && open; dz += 1.5) open = blockerTopAt(x + dx, z + dz, 0, 1.2) < 0.3;
        if (open) { cx = x; cz = z; break; }
      }
      const hits = [];
      const _dd = dealDamage; dealDamage = function (v, n, h, att) { hits.push(v && v.id); return _dd.apply(this, arguments); };
      world.actors.forEach((a, i) => { a.pos.set(cx + 60 + 4 * i, 0, cz + 60); a.y = 0; a.alive = true; a.hp = 100; a.armor = 0; a.invuln = 0; });
      bot.ctrl = "remote"; bot.weapons.knife = "knife"; bot.slot = "knife";
      const cut = (vy) => { hits.length = 0; me.hp = 100; me.alive = true; me.y = vy; bot.pos.set(cx, 0, cz); bot.yaw = 0; bot.fireCd = 0; me.pos.set(cx, vy, cz - 2); actorFire(bot); return hits.slice(); };
      const open = cut(0);
      const above = cut(5);
      const wall = addBox(cx, cz - 1, 4, 0.3, 4, new T.MeshBasicMaterial({ color: 0xffffff }), { temp: true, y: 0 });
      const through = cut(0);
      destroyCollider(wall);
      const after = cut(0);
      return { open, above, through, after, me: me.id };
    });
    console.log(JSON.stringify(out));
    assert.deepEqual(out.open, [out.me], "a cut in the open lands");
    assert.deepEqual(out.above, [], "no cut through the floor to another storey");
    assert.deepEqual(out.through, [], "no cut through a wall");
    assert.deepEqual(out.after, [out.me], "with the wall gone it lands again");
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("knife walls: ok");
  } finally {
    await f.browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
