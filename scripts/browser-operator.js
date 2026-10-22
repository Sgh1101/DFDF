const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The Operator ("sniper") kills with any hit: at close range, far away, through armour and a shield, whoever fires it
// (the player, or a bot through the actors' own fire). Another gun with the same shot does not, and what is dealt stays
// no more than what the target had left.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("operator", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; room.mode = "dm"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 1e5; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      world.roundTime = 1e5;
      const me = myActor(), out = { kills: [], rifle: [] };
      const foe = world.actors.find((a) => a !== me && a.alive);
      for (const a of world.actors) if (a !== me && a !== foe) a.pos.set(900, 0, 900);
      const shoot = (key, d, opts = {}) => {
        me.pos.set(0, 0, 0); me.y = 0; me.yaw = Math.PI; me.pitch = Math.atan2(-0.6, d); me.fireCd = 0; me.recoil = 0; me.onGround = true; me.vel.set(0, 0, 0); me.reloading = 0; me.invuln = 0;
        me.weapons.primary = key; me.slot = "primary"; me.ammo[key] = 5; me.reserve[key] = 999;
        foe.alive = true; foe.hp = 100; foe.armor = opts.armor == null ? 50 : opts.armor; foe.shielded = opts.shield || 0; foe.invuln = 0; foe.vuln = 0; 
        foe.group && (foe.group.visible = true);
        foe.pos.set(0, 0, d); foe.y = 0;
        const before = foe.hp + foe.armor;
        actorFire(me);
        return { dead: !foe.alive, left: foe.alive ? foe.hp + foe.armor : 0, before };
      };
      for (const d of [4, 30, 80, 110]) out.kills.push([d, shoot("sniper", d).dead]);
      out.shield = shoot("sniper", 60, { shield: 1 }).dead;
      out.noArmor = shoot("sniper", 60, { armor: 0 }).dead;
      for (const d of [4, 60]) out.rifle.push([d, shoot("rifle", d).dead]);
      out.marks = typeof OPERATOR_LETHAL; out.b = MAP.bounds;
      return out;
    });
    console.log(JSON.stringify(r));
    for (const [d, dead] of r.kills) assert.equal(dead, true, "the Operator kills at " + d + " m");
    assert.equal(r.shield, true, "through a shield");
    assert.equal(r.noArmor, true, "without armour");
    assert.ok(r.rifle.every(([, dead]) => !dead), "another gun does not kill in one hit: " + JSON.stringify(r.rifle));
    // a bot firing it through the actors' own fire
    const b = await page.evaluate(() => {
      world.roundTime = 1e5;
      const me = myActor(), bot = world.actors.find((a) => a !== me && a.alive && a.ctrl !== "me");
      for (const a of world.actors) if (a !== me && a !== bot) a.pos.set(900, 0, 900);
      me.alive = true; me.hp = 100; me.armor = 50; me.invuln = 0; me.pos.set(0, 0, 10); me.y = 0; 
      bot.pos.set(0, 0, 0); bot.y = 0; bot.onGround = true; bot.recoil = 0; bot.vel.set(0, 0, 0); bot.concuss = 0; bot.yaw = Math.PI; bot.pitch = Math.atan2(-0.6, 10); bot.ai && (bot.ai.accuracy = 1e-6);
      bot.weapons.primary = "sniper"; bot.slot = "primary"; bot.ammo.sniper = 5; bot.reserve.sniper = 99; bot.fireCd = 0; bot.reloading = 0;
      actorFire(bot);
      return { dead: !me.alive || me.hp <= 0 };
    });
    console.log(JSON.stringify(b));
    assert.equal(b.dead, true, "a bot's Operator shot kills too");
    assert.deepEqual(f.errors, []);
    console.log("operator: one hit kills, near and far, through armour and shield; other guns unchanged");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
