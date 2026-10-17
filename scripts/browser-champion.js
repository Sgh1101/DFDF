const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 챔피언의 물결 (our own legendary skin): in the lists and the server's catalogue, the pattern draws, a
// shot with it sends rings out of the muzzle (not without it, not with the knife), a kill sends waves over the ground.
(async () => {
  const f = await fixture();
  try {
    const dir = process.env.SHOT_DIR || "/tmp";
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "champ-owner" });
    const page = await f.page("champ", { width: 1280, height: 800 });
    await f.h.api("a_user_set", { atoken: owner.atoken, id: "champ", op: "grant", item: "rifle|champion" });
    await f.h.api("a_user_set", { atoken: owner.atoken, id: "champ", op: "grant", item: "pistol|champion" });
    await page.evaluate(() => GUN_SKINS.sync());
    await page.waitForFunction(() => GUN_SKINS.owns("rifle", "champion"));
    const r = await page.evaluate(() => {
      const s = GUN_SKINS.list.find((x) => x.id === "champion");
      return { rar: s.rar, tier: GUN_SKINS.skinsFor("rifle").some((x) => x.id === "champion"), knife: GUN_SKINS.skinsFor("knife").some((x) => x.id === "champion"), count: GUN_SKINS.guns().length };
    });
    assert.deepEqual([r.rar, r.tier, r.knife], [4, true, true]);
    const cat = await f.h.api("catalog", {});
    assert.equal(cat.tiers.champion, 4);
    // the armoury draws it
    await page.evaluate(() => GUN_SKINS.open("rifle", "gun"));
    await page.waitForSelector('#ar-skins .ar-sk[data-s="champion"]');
    await page.click('#ar-skins .ar-sk[data-s="champion"]');
    await page.waitForTimeout(1800);
    await page.screenshot({ path: dir + "/champion-armory.png" });
    await page.evaluate(() => GUN_SKINS.close());
    // "apply to all": the skin shown goes on every gun that owns it (two granted here), others keep theirs, a not-owned one is refused
    await f.h.api("a_user_set", { atoken: owner.atoken, id: "champ", op: "grant", item: "smg|champion" });
    await page.evaluate(() => GUN_SKINS.sync());
    await page.waitForFunction(() => GUN_SKINS.owns("smg", "champion"));
    await page.evaluate(() => { GUN_SKINS.setAll("default"); GUN_SKINS.set("shotgun", "default"); GUN_SKINS.open("rifle", "gun"); });
    await page.waitForSelector('#ar-skins .ar-sk[data-s="champion"]');
    await page.click('#ar-skins .ar-sk[data-s="champion"]');
    await page.click("#ar-all");
    const all = await page.evaluate(() => ({ mine: GUN_SKINS.mine(), toast: document.getElementById("ar-toast").textContent }));
    assert.deepEqual(Object.keys(all.mine).sort(), ["pistol", "rifle", "smg"]);
    assert.ok(/3개/.test(all.toast), "says how many: " + all.toast);
    // a skin only previewed (not owned) is refused with a word, and nothing changes
    await page.evaluate(() => { const l = GUN_SKINS.list.find((s) => s.id === "lava"); document.querySelector('#ar-skins .ar-sk[data-s="lava"]').click(); });
    await page.click("#ar-all");
    const refused = await page.evaluate(() => ({ mine: GUN_SKINS.mine(), toast: document.getElementById("ar-toast").textContent }));
    assert.deepEqual(Object.keys(refused.mine).sort(), ["pistol", "rifle", "smg"]);
    assert.ok(/아직 없는/.test(refused.toast), "refusal is spoken: " + refused.toast);
    await page.evaluate(() => GUN_SKINS.close());
    // in a match
    await page.evaluate(() => { titleCam = () => {}; GUN_SKINS.set("rifle", "champion"); room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const out = await page.evaluate(() => {
      const me = myActor(), W = CHAMPION_WAVE, res = {};
      me.weapons.primary = "rifle"; me.slot = "primary";
      const rings = () => fx.filter((o) => o.mesh && o.mesh.geometry && o.mesh.geometry.type === "RingGeometry").length;
      res.wears = W.wears(me);
      const n0 = rings();
      actorFire(me);
      res.afterShot = rings() - n0;
      for (let i = 0; i < 30; i++) step(0.05);
      res.gone = rings();
      // the rings grow and fade
      actorFire(me); step(0.2);
      const m = fx.filter((o) => o.mesh.geometry.type === "RingGeometry").map((o) => o.mesh);
      res.grown = m.some((x) => x.scale.x > 0.1) && m.some((x) => x.material.opacity > 0);
      // another skin: none
      GUN_SKINS.set("rifle", "default"); for (let i = 0; i < 40; i++) step(0.05);
      const n1 = rings(); me.fireCd = 0; me.ammo.rifle = 30; actorFire(me);
      res.plain = rings() - n1;
      GUN_SKINS.set("rifle", "champion");
      // the knife: none
      me.slot = "knife"; const n2 = rings(); actorFire(me); res.knife = rings() - n2; me.slot = "primary";
      // a kill: waves
      const foe = world.actors.find((a) => a !== me && a.team !== me.team);
      foe.alive = true; foe.invuln = 0; foe.armor = 0; foe.hp = 1; foe.pos.set(me.pos.x + 12, 0, me.pos.z);
      const n3 = rings(); me.fireCd = 0; me.alive = true;
      killActor(foe, me);
      res.waves = rings() - n3;
      // someone with another skin: none
      GUN_SKINS.set("rifle", "default");
      const v = world.actors.find((a) => a !== me && a !== foe && a.alive);
      v.armor = 0; v.hp = 1; const n4 = rings(); killActor(v, me); res.noWaves = rings() - n4;
      return res;
    });
    console.log(JSON.stringify(out));
    assert.equal(out.wears, true);
    assert.ok(out.afterShot >= 2, "rings leave the muzzle: " + out.afterShot);
    assert.ok(out.grown, "they grow and light up");
    assert.equal(out.plain, 0, "no rings with another skin"); assert.equal(out.knife, 0, "none from the knife");
    assert.ok(out.waves >= 2, "a kill sends waves: " + out.waves);
    assert.equal(out.noWaves, 0);
    // a look at the gun while firing
    await page.evaluate(() => { GUN_SKINS.set("rifle", "champion"); const me = myActor(); me.alive = true; me.hp = 100; me.invuln = 99; me.slot = "primary"; for (const a of world.actors) if (a !== me) { a.pos.set(40, 0, 40); a.invuln = 99; } });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const me = myActor(); me.fireCd = 0; me.ammo.rifle = 30; actorFire(me); });
    await page.waitForTimeout(110);
    await page.screenshot({ path: dir + "/champion-fire.png" });
    assert.deepEqual(f.errors, []);
    console.log("champion: a legendary skin on every gun, wave rings from the muzzle, waves on a kill, none without it");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
