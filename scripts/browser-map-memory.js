// GPU memory over map loads: loading one map after another in the same page (a round started on each, so the
// fighters and guns are built) must stop growing renderer.info.memory after the first cycle. A map frees what it
// built for itself (sky, site markers, signs, the pogu textures), a fighter frees its voxel pieces, the spike
// carrier's mark is one shared cone; cached and shared resources must stay alive.
// The third-person gun templates are cached per gun and skin and fill as bots meet new guns and skins (the cache is
// bounded, see test:gun-memory), so what a gun builder made is counted apart: the check is on the geometries and
// textures that are not gun models.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const MAPS = ["pogu", "hospital", "market", "glacier", "neon"], CYCLES = 3, SLACK = { geometries: 40, textures: 24 };
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("mapmemory", { width: 960, height: 540 }, {}, { bootTimeout: 120000 });
    await page.evaluate(() => {
      // which uploaded geometries and textures are alive (and which of them a gun builder made)
      const live = new Map(), GUN = /bedrock-rig|valorant-pack|legacy-gun-models|58-gun-skins|champions-phantom|phantom-|GUN_BUILD|GunBuilder|buildProcWeapon|bakeDeep|buildFor|skinMat/;
      const kind = () => GUN.test(new Error().stack || "");
      const BG = THREE.BufferGeometry.prototype, TX = THREE.Texture.prototype, setAttribute = BG.setAttribute, needs = Object.getOwnPropertyDescriptor(TX, "needsUpdate");
      BG.setAttribute = function () { if (this.userData.__gun === undefined) this.userData.__gun = kind(); return setAttribute.apply(this, arguments); };
      Object.defineProperty(TX, "needsUpdate", { get: needs.get, set(v) { if (v && this.userData.__gun === undefined) this.userData.__gun = kind(); needs.set.call(this, v); } });
      for (const [proto, name] of [[BG, "geometries"], [TX, "textures"]]) {
        const add = proto.addEventListener, dispose = proto.dispose;
        proto.addEventListener = function (type) { if ("dispose" === type) live.set(this, name); return add.apply(this, arguments); };
        proto.dispose = function () { live.delete(this); return dispose.apply(this, arguments); };
      }
      window.__gunLive = () => { const n = { geometries: 0, textures: 0 }; for (const [item, name] of live) if (item.userData.__gun) n[name]++; return n; };
      // shared things that must never be freed by a map change or a cleared round
      window.__shared = [G_BOX(.17321, .19321, .23321), chMat(0x123456, "cloth"), THEMES.glacier.floor, TH().floor];
      window.__sharedDisposed = 0;
      for (const item of window.__shared) item.addEventListener("dispose", () => window.__sharedDisposed++);
    });
    const samples = [];
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      const row = {};
      for (const key of MAPS) {
        row[key] = await page.evaluate((key) => {
          netShutdown(); clearActors(); world.phase = "menu";
          if (loadMap(key) === false) throw Error("Missing map: " + key);
          room.map = key; startGame(AGENTS[0], true); ADMIN.freezeAI = true; closeShop();
          for (let i = 0; i < 5; i++) step(1 / 30);
          // draw everything, not only what the camera sees: a piece is on the GPU once it has been drawn
          scene.traverse((node) => { node.frustumCulled = false; });
          renderer.render(scene, camera);
          const memory = renderer.info.memory, gun = window.__gunLive();
          return { geometries: memory.geometries, textures: memory.textures, gunGeometries: gun.geometries, gunTextures: gun.textures };
        }, key);
        row[key].others = { geometries: row[key].geometries - row[key].gunGeometries, textures: row[key].textures - row[key].gunTextures };
      }
      samples.push(row);
    }
    console.log("renderer.info.memory per cycle: geometries/textures, of them the gun models' (the rest is checked)");
    samples.forEach((row, i) => console.log("cycle", i + 1, MAPS.map((key) => `${key} ${row[key].geometries}/${row[key].textures} (gun ${row[key].gunGeometries}/${row[key].gunTextures})`).join("  ")));
    // the five maps together: a map that places a few random props differs a little from one load to the next
    for (let cycle = 1; cycle < CYCLES; cycle++) for (const what of ["geometries", "textures"]) {
      const grew = MAPS.reduce((sum, key) => sum + samples[cycle][key].others[what] - samples[cycle - 1][key].others[what], 0);
      console.log(`cycle ${cycle + 1} ${what} outside the gun models: ${grew >= 0 ? "+" : ""}${grew}`);
      if (cycle >= 2) assert.ok(grew <= SLACK[what], `${what} grew by ${grew} in cycle ${cycle + 1}: ` + JSON.stringify(samples));
    }
    const final = await page.evaluate(() => {
      const sky = scene.children.find((node) => node.isMesh && node.material && node.material.side === THREE.BackSide);
      const uploaded = (texture) => !!(texture && renderer.properties.get(texture).__webglTexture);
      return { sharedDisposed: window.__sharedDisposed, sky: !!sky, skyUploaded: !!sky && uploaded(sky.material.map) };
    });
    assert.equal(final.sharedDisposed, 0, "a shared resource was freed");
    assert.equal(final.sky, true, "the sky dome is missing"); assert.equal(final.skyUploaded, true, "the sky texture is not on the GPU");
    // the map still draws: a picture after all those switches (the last map, the hospital and pogu again)
    for (const key of ["neon", "hospital", "pogu"]) {
      await page.evaluate((key) => {
        if (CUR_MAP_KEY !== key) { netShutdown(); clearActors(); room.map = key; startGame(AGENTS[0], true); }
        world.phase = "live"; ADMIN.freezeAI = true; closeShop(); $("pause").hidden = true; step(1 / 30);
      }, key);
      await page.waitForTimeout(600);
      await page.evaluate(() => { $("pause").hidden = true; });
      await page.screenshot({ path: (process.env.SHOT_DIR || "/tmp") + "/map-memory-" + key + ".png" });
    }
    assert.deepEqual(f.errors, []);
    console.log("map memory ok", final);
  } finally { await f.browser.close(); }
})();
