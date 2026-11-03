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
    // its own sound pack (not the stock sound), banner and finisher figure; none of the pack's voices is loud enough to clip
    const wired = await page.evaluate(() => {
      const pk = SOUNDPACK.packs[SOUNDPACK.skins.champion], voices = pk ? ["shot", "kill", "head", "fin"].flatMap((k) => pk[k] || []) : [];
      const th = FINISHER_LEGEND.themes.champion;
      return { pack: !!pk && ["shot", "kill", "head", "fin"].every((k) => pk[k] && pk[k].length), loud: Math.max(0, ...voices.map((v) => v.v || 0)), kill: pk ? pk.kill.reduce((a, v) => a + (v.v || 0), 0) : 99, banner: !!KILLBANNER.table.champion, fig: th && th.fig, phantomPack: SOUNDPACK.skins.champions_atk, soft: th && th.soft };
    });
    assert.ok(wired.pack, "the skin has its own sound pack");
    assert.ok(wired.loud <= 0.25, "no voice louder than 0.25: " + wired.loud);
    assert.ok(wired.kill <= 1.1, "a kill sound's voices add up to " + wired.kill);
    assert.ok(wired.banner, "the skin has its own kill banner");
    assert.equal(wired.fig, "ripple", "the skin's own finisher figure");
    assert.equal(wired.phantomPack, "champions", "the Phantom keeps its own pack");
    // the shell keeps inside the gun's own outline, on every gun (the Vandal and the rest of the pack included), so a gun in the
    // skin is still that gun, and the waves run along the imported ones. The old shell had a pointed plate, a six-sided stock
    // behind it and a fin under it (1.37 times the built guns' height: a fish), followed a box that counted the pack's flat scope
    // overlay quads (the operator's: 3.3 m of armour on a 1.9 m gun), and the pattern, drawn from the pack's small atlas,
    // came out in scraps.
    const fit = await page.evaluate(() => {
      const T = THREE, skin = GUN_SKINS.list.find((s) => s.id === "champion"), res = {};
      const body = (root) => {
        root.updateMatrixWorld(true);
        const inv = root.matrixWorld.clone().invert(), box = new T.Box3(), s = new T.Vector3();
        root.traverseVisible((o) => {
          if (!o.isMesh || o.userData.kit || Math.abs(o.matrixWorld.determinant()) < 1e-12) return;
          o.geometry.boundingBox || o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld));
          b.getSize(s); if (Math.min(s.x, s.y, s.z) >= 1e-4) box.union(b);
        });
        return box.getSize(new T.Vector3());
      };
      for (const key of GUN_SKINS.guns().filter((g) => GUN_SKINS.skinsFor(g).some((x) => x.id === "champion"))) {
        const gun = body(GUN_SKINS.buildFor(key, skin)), g = GUN_SKINS.buildFor(key, skin);
        GUN_SKINS.apply(g, skin); g.updateMatrixWorld(true);
        const kit = g.children.find((c) => c.userData && c.userData.kitOf), kb = new T.Box3().setFromObject(kit).getSize(new T.Vector3());
        let lo = Infinity, hi = -Infinity, imported = false;
        g.traverse((o) => {
          if (o.userData.valorantRig) imported = true;
          if (!o.isMesh || o.userData.kit || !o.material.map) return;
          const uv = o.geometry.attributes.uv;
          for (let i = 0; i < uv.count; i++) { lo = Math.min(lo, uv.getX(i)); hi = Math.max(hi, uv.getX(i)); }
        });
        res[key] = { imported, kitH: +(kb.y / gun.y).toFixed(2), kitL: +(kb.z / gun.z).toFixed(2), flow: +(((hi - lo) * skin.tile) / gun.z).toFixed(2) };
      }
      return res;
    });
    console.log("champion shell vs gun:", JSON.stringify(fit));
    for (const [key, r] of Object.entries(fit)) {
      assert.ok(r.kitL <= 1, key + " shell is " + r.kitL + " times as long as the gun");
      assert.ok(r.kitH <= 1, key + " shell is " + r.kitH + " times as tall as the gun");
      if (r.imported) assert.ok(r.flow >= 0.8, key + " pattern spans only " + r.flow + " of the gun's length (atlas scraps)");
    }
    // the third-party weapon pack is gone: every gun is one of the game's own builds
    assert.ok(Object.keys(fit).length >= 18 && Object.values(fit).every((r) => !r.imported), "every gun checked, none imported");
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
      {
        const first = fx.filter((o) => o.mesh && o.mesh.geometry && o.mesh.geometry.type === "RingGeometry").map((o) => o.mesh), mz = W.muzzleOf(VM.current);
        res.ringAtMuzzle = mz ? Math.min(...first.map((m) => m.position.distanceTo(mz))) : -1;
        res.ringSolid = first.length > 0 && first.every((m) => m.material.blending === THREE.NormalBlending);
        res.ringColours = new Set(first.map((m) => m.material.color.getHex())).size;
      }
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
    assert.ok(out.ringAtMuzzle >= 0 && out.ringAtMuzzle < 0.05, "the rings start at the gun's muzzle: " + out.ringAtMuzzle);
    assert.ok(out.ringSolid, "the rings are solid colour (read on a bright sky)");
    assert.ok(out.ringColours >= 2, "the rings run through the skin's colours: " + out.ringColours);
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
