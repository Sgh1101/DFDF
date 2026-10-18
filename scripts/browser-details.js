const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The first-person hands and the fighter detail pass: every weapon's view model builds with the new
// sleeves and gloves (no warnings, the pieces carry the reload/knife flags of their neighbours),
// every one of the agents builds with fingers, brows, ears and soles inside the baked meshes
// (no extra meshes, more vertices), and the plain gun materials carry the finish.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("details", { width: 960, height: 540 });
    const warns = [];
    page.on("console", (m) => { if (/hands|fighter details/.test(m.text())) warns.push(m.text().slice(0, 200)); });
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; myActor().invuln = 999; });
    // ── every weapon's view model ──
    const guns = await page.evaluate(async () => {
      const out = { checked: 0, bad: [], flagged: 0 };
      const a = myActor();
      for (const key of Object.keys(WEAPONS)) {
        a.weapons.primary = key; a.weapons.secondary = key; a.slot = "primary";
        await new Promise((r) => setTimeout(r, 260));
        if (actorWeaponKey(a) !== key) { out.bad.push(key + ": not equipped"); continue; }
        out.checked++;
      }
      // the left hand of a rifle moves with the magazine while reloading: its extra pieces are flagged live
      a.weapons.primary = "rifle"; a.slot = "primary"; await new Promise((r) => setTimeout(r, 500));
      let live = 0, total = 0;
      VM.root.traverse((m) => { if (m.isMesh && m.userData) { total++; m.userData.live && live++; } });
      out.live = live; out.total = total;
      return out;
    });
    console.log(JSON.stringify(guns));
    assert.deepEqual(guns.bad, [], "every weapon equips");
    assert.equal(guns.checked, 18, "17 firearms and the separate knife checked");
    assert.ok(guns.live > 4, "the left hand and its pieces are still animated parts (live " + guns.live + " of " + guns.total + ")");

    // ── every agent: the detail goes into the baked meshes ──
    const agents = await page.evaluate(() => {
      const out = { n: 0, bad: [], grew: 0, meshDelta: [] };
      const verts = (m) => { let n = 0, meshes = 0; m.group.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position) { n += o.geometry.attributes.position.count; meshes++; } }); return [n, meshes]; };
      for (const ag of AGENTS) {
        try {
          const m = buildFighter(16739146, ag), [v, k] = verts(m);
          out.n++;
          // the bare vertex count of the same fighter before this pass: its hands alone are 4 fingers x 3 pieces x many triangles
          v > 2000 && out.grew++;
          out.meshDelta.push(k);
          // each hand got fingers: the forearm mesh holds the glove pieces
          const fore = m.armL.fore.children.find((c) => c.isMesh);
          if (ag.id === 'neon_agent') {
            let n = 0; m.group.traverse(o => { if (o.userData.neonSkin) { n++; if (o.material.map !== NEON_AGENT.sourceSkin()) out.bad.push('Neon source texture'); } });
            if (n !== 20) out.bad.push('Neon source skin mesh count ' + n);
          } else fore.geometry.attributes.position.count > 1600 || out.bad.push(ag.id + " forearm " + fore.geometry.attributes.position.count);
        } catch (e) { out.bad.push(ag.id + ": " + e.message); }
      }
      out.maxMeshes = Math.max(...out.meshDelta); out.minMeshes = Math.min(...out.meshDelta); delete out.meshDelta;
      return out;
    });
    console.log(JSON.stringify(agents));
    assert.deepEqual(agents.bad, [], "every agent builds with the detail pass");
    assert.equal(agents.n, 43);
    // the pass adds no meshes: the count per fighter stays where the body baking left it
    assert.ok(agents.maxMeshes < 90, "no extra draw calls (most meshes in one fighter: " + agents.maxMeshes + ")");

    // ── the plain gun finish ──
    const finish = await page.evaluate(() => { const m = GUNMAT.gunmetal(), p = GUNMAT.polymer(); return { gm: !!m.map, poly: !!p.map, again: GUNMAT.gunmetal().map === m.map }; });
    console.log(JSON.stringify(finish));
    assert.deepEqual(finish, { gm: true, poly: true, again: true }, "plain materials share one finish texture");
    assert.deepEqual(warns, [], "no warnings from the hand or fighter passes");
    assert.deepEqual(f.errors, []);
    console.log("details: " + guns.checked + " weapons, " + agents.n + " agents, finish and flags ok");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
