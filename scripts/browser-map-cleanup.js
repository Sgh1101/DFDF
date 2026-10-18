const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("mapresources");
    const cases = await page.evaluate(() => {
      const sharedGeometry = G_BOX(.17321, .19321, .23321), sharedMaterial = chMat(0x123456, "cloth");
      let sharedDisposed = 0;
      sharedGeometry.addEventListener("dispose", () => sharedDisposed++);
      sharedMaterial.addEventListener("dispose", () => sharedDisposed++);
      const results = [];
      for (const key of ["pogu", "market", "forge"]) {
        if (loadMap(key) === false) throw Error("Missing fixture map: " + key);
        const roots = [...MAP_GIMMICKS.meshes, ...scene.children.filter((root) => root.userData.siteFx)], textures = new Set(), geometries = new Set(), materials = new Set(), counts = new Map();
        for (const root of roots) root.traverse((node) => {
          if (node.geometry) geometries.add(node.geometry);
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material) { materials.add(material); if (material.map) textures.add(material.map); }
        });
        for (const resource of [...geometries, ...materials]) {
          counts.set(resource, 0); resource.addEventListener("dispose", () => counts.set(resource, counts.get(resource) + 1));
        }
        let disposedTextures = 0;
        for (const texture of textures) texture.addEventListener("dispose", () => disposedTextures++);
        const before = { doors: MAP_GIMMICKS.door.length, teleporters: MAP_GIMMICKS.tp.length, ziplines: MAP_GIMMICKS.zip.length };
        loadMap(key);
        results.push({ key, before, geometries: geometries.size, materials: materials.size, removed: roots.every((root) => root.parent === null), disposedOnce: [...counts.values()].every((count) => count === 1), sharedDisposed, disposedTextures });
      }
      return results;
    });
    for (const result of cases) {
      assert.ok(result.geometries > 0); assert.ok(result.materials > 0);
      assert.equal(result.removed, true); assert.equal(result.disposedOnce, true); assert.equal(result.sharedDisposed, 0); assert.equal(result.disposedTextures, 0);
    }
    assert.equal(cases[0].before.doors, 1); assert.equal(cases[1].before.teleporters, 2); assert.equal(cases[2].before.ziplines, 2);
    console.log("device map reload cleanup", cases);
    const door = await page.evaluate(() => {
      room.map = "pogu"; startGame(AGENTS[0], true); ADMIN.freezeAI = true; world.phase = "live"; closeShop();
      const a = myActor(), door = MAP_GIMMICKS.door[0];
      for (const actor of world.actors) if (actor !== a) actor.pos.set(-50, 0, -50);
      a.pos.set(door.sws[0].x, 0, door.sws[0].z); a.y = 0;
      const press = () => { door.cd = 0; dispatchEvent(new KeyboardEvent("keydown", { key: "f", code: "KeyF" })); dispatchEvent(new KeyboardEvent("keyup", { key: "f", code: "KeyF" })); };
      press(); const closed = !door.open && door.col.h === door.h;
      press(); return { closed, reopened: door.open && door.col.h === 0 };
    });
    assert.deepEqual(door, { closed: true, reopened: true });
    // Measure map reloads after gameplay checks, with actor caches out of the sample.
    await page.evaluate(() => { netShutdown(); clearActors(); world.phase = "menu"; show("s-title"); });
    const samples = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await page.evaluate(() => {
        loadMap("pogu"); camera.position.set(15, 5, -4); camera.lookAt(18, 1, -12); renderer.render(scene, camera);
        return { geometries: renderer.info.memory.geometries, devices: MAP_GIMMICKS.meshes.length };
      }));
      await page.waitForTimeout(100);
    }
    assert.equal(samples.every((sample) => sample.devices === 3), true);
    assert.ok(samples.at(-1).geometries <= samples.at(-2).geometries + 5, JSON.stringify(samples)); // (the buildings join the count once they first come into view: the last two reloads are compared)
    assert.deepEqual(f.errors, []);
    console.log("door controls and six rendered map reloads", samples);
  } finally { await f.browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
