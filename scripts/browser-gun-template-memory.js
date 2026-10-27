// Third-person gun templates (js/legacy/58-gun-skins.js) are cached per gun and skin, and a fighter's gun is a clone that
// draws the template's geometry. Bots wear a new random skin every round, so over a long session the cache has to stay
// bounded: a template nobody wears is freed (its own geometry and material) once a few more recent ones have been used,
// a template a fighter wears is never freed, and neither is the Champions Phantom's (it is built once and kept).
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const ROUNDS = 40, WARM = 12, MAX_TEMPLATES = 40, SLACK_GEOMETRIES = 200;
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("gunmemory", { width: 960, height: 540 }, {}, { bootTimeout: 120000 });
    await page.evaluate(() => {
      // which uploaded geometries are alive (marked as a gun model's when a gun builder made them), and which were freed
      // (a freed one drawn again is uploaded again)
      const live = new Set(), GUN = /bedrock-rig|valorant-pack|legacy-gun-models|58-gun-skins|champions-phantom|phantom-|GUN_BUILD|GunBuilder|buildProcWeapon|bakeDeep|buildFor|skinMat/;
      const BG = THREE.BufferGeometry.prototype, setAttribute = BG.setAttribute, add = BG.addEventListener, dispose = BG.dispose;
      window.__freed = new WeakSet(); window.__reuploaded = 0;
      BG.setAttribute = function () { if (this.userData.__gun === undefined) this.userData.__gun = GUN.test(new Error().stack || ""); return setAttribute.apply(this, arguments); };
      BG.addEventListener = function (type) {
        if ("dispose" === type && this.userData.__gun) { live.add(this); if (__freed.has(this)) { __freed.delete(this); window.__reuploaded++; } }
        return add.apply(this, arguments);
      };
      BG.dispose = function () { live.delete(this); __freed.add(this); return dispose.apply(this, arguments); };
      window.__gunLive = () => live.size;
    });
    // the Champions Phantom's templates: built before the churn (once its model is in, which clears the cache), they
    // must be the same ones after it
    await page.waitForFunction(() => CHAMPIONS_PHANTOM.loaded(), null, { timeout: 120000 });
    await page.waitForTimeout(500);
    const champions = await page.evaluate(() => {
      const skins = ["champions_atk", "champions_def"].map((id) => GUN_SKINS.list.find((s) => s.id === id));
      window.__champions = skins.map((s) => ({ id: s.id, tpl: GUN_SKINS.template("scout", s) }));
      return window.__champions.map((c) => c.id + "|" + !!c.tpl);
    });
    assert.deepEqual(champions, ["champions_atk|true", "champions_def|true"]);
    const rows = [];
    for (let round = 0; round < ROUNDS; round++) {
      rows.push(await page.evaluate((round) => {
        netShutdown(); clearActors(); world.phase = "menu";
        if (loadMap("pogu") === false) throw Error("Missing map: pogu");
        room.map = "pogu"; startGame(AGENTS[0], true); ADMIN.freezeAI = true; closeShop();
        // every bot holds some gun, in the random skin the game gives it for that gun
        const guns = GUN_SKINS.guns().filter((k) => "knife" !== k);
        let i = 0;
        for (const a of world.actors) if ("ai" === a.ctrl) a.weapons.primary = guns[(round * 7 + i++ * 5) % guns.length];
        for (let n = 0; n < 4; n++) step(1 / 30);
        for (const a of world.actors) syncActorModel(a);
        scene.traverse((node) => { node.frustumCulled = false; });
        renderer.render(scene, camera);
        // what the fighters wear now: still cached, and not freed
        const worn = [], wornFreed = [];
        for (const a of world.actors) if (a.model && a.model.gun && a.model.gun.userData.tp) {
          worn.push(a.model.gun.userData.tp);
          a.model.gun.traverse((o) => { if (o.geometry && __freed.has(o.geometry)) wornFreed.push(a.model.gun.userData.tp); });
        }
        const cached = GUN_SKINS.templates ? GUN_SKINS.templates() : null;
        return { round, worn: worn.length, uncached: cached ? worn.filter((id) => !cached.includes(id)).length : 0, wornFreed: wornFreed.length, templates: cached ? cached.length : -1, gunGeometries: __gunLive(), reuploaded: __reuploaded };
      }, round));
    }
    rows.filter((r, i) => i % 4 === 3).forEach((r) => console.log(JSON.stringify(r)));
    // the geometries of gun models stop growing once the first rounds have filled what is worn and the recent few
    const warm = Math.max(...rows.slice(WARM / 2, WARM).map((r) => r.gunGeometries)), last = rows.slice(-8).map((r) => r.gunGeometries);
    console.log("gun geometries alive: warm-up peak", warm, "last rounds", last.join(","));
    assert.ok(Math.max(...last) <= warm + SLACK_GEOMETRIES, `gun geometries keep growing: ${warm} after warm-up, ${Math.max(...last)} at the end`);
    assert.ok(rows.every((r) => r.worn > 0), "bots wore no third-person gun");
    assert.ok(rows.every((r) => r.templates >= 0), "GUN_SKINS.templates() is missing");
    assert.ok(Math.max(...rows.map((r) => r.templates)) <= MAX_TEMPLATES, "the template cache is not bounded: " + JSON.stringify(rows.map((r) => r.templates)));
    assert.ok(rows.every((r) => r.uncached === 0), "a worn template is not in the cache");
    // a template a fighter wears is never freed (its clones would be uploaded again), nor is one that is built again
    assert.deepEqual(rows.filter((r) => r.wornFreed).map((r) => r.round), [], "a template that a fighter wears was freed");
    assert.equal(rows[rows.length - 1].reuploaded, 0, "a freed gun geometry was uploaded again");
    // the Champions Phantom: the same templates, with their geometry and material untouched
    const after = await page.evaluate(() => window.__champions.map((c) => {
      let freed = 0, meshes = 0; c.tpl.traverse((o) => { if (o.isMesh) { meshes++; __freed.has(o.geometry) && freed++; } });
      return { id: c.id, same: GUN_SKINS.template("scout", GUN_SKINS.list.find((s) => s.id === c.id)) === c.tpl, cached: GUN_SKINS.templates().includes("scout|" + c.id), meshes, freed };
    }));
    console.log("champions templates after the rounds:", JSON.stringify(after));
    for (const c of after) { assert.ok(c.same && c.cached, c.id + " template was evicted or rebuilt"); assert.ok(c.meshes > 0 && c.freed === 0, c.id + " template geometry was freed"); }
    assert.deepEqual(f.errors, []);
    console.log("gun template memory ok");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
