const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
// The original finisher was explored and captured before this UI test was authored.
(async () => {
  const f = await fixture(), dir = path.resolve("test-results/champions-finish"); fs.mkdirSync(dir, { recursive: true });
  try {
    const p = await f.page("finish8", { width: 1280, height: 800 });
    await p.waitForFunction(() => CHAMPIONS_PHANTOM.loaded());
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "finish-owner" });
    for (const skin of ["champions_atk", "champions_def"]) await f.h.api("a_user_set", { atoken: owner.atoken, id: "finish8", op: "grant", item: "carbine|" + skin });
    await p.evaluate(() => GUN_SKINS.sync());
    await p.clock.install({ time: new Date("2030-01-01T00:00:00Z") }); await p.clock.pauseAt(new Date("2030-01-01T00:00:10Z"));
    await p.locator("#go-armory").click(); await p.locator('#ar-tabs [data-tab="champions"]').click();
    await p.locator('[data-phantom-demo="fin"]').click();
    await p.clock.fastForward(3000);
    const preview = await p.evaluate(() => {
      const group = [...FINISHERS.active][0], figure = group.getObjectByName("champions-original-finisher"), pv = GUN_SKINS._pv();
      pv.r.render(pv.sc, pv.cam);
      const box = new T.Box3().setFromObject(figure), corners = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new T.Vector3(x, y, z).project(pv.cam).toArray());
      return { visible: figure.visible, height: box.getSize(new T.Vector3()).y, min: figure.userData.playerHeight * 5, weaponHidden: !pv.obj.visible, cameraHeight: pv.ty, fullyFramed: corners.every(v => v.every(c => Math.abs(c) < 1)) };
    });
    assert.equal(preview.visible, true); assert.ok(preview.height >= preview.min - 1e-6); assert.equal(preview.weaponHidden, true); assert.ok(preview.cameraHeight > 1); assert.equal(preview.fullyFramed, true, "source models must fit inside camera view AND near/far clipping planes");
    await p.screenshot({ path: path.join(dir, "original-cream-preview.png") });
    await p.locator("#phantom-stop").click();
    assert.equal(await p.evaluate(() => GUN_SKINS._pv().obj.visible && FINISHERS.active.size === 0), true);
    await p.evaluate(() => GUN_SKINS.close());
    const metrics = async () => p.evaluate(() => {
      updateFx(0); updateHUD();
      const root = [...FINISHERS.active].find(g => g.getObjectByName("champions-original-finisher")), figure = root?.getObjectByName("champions-original-finisher");
      let vertices = 0, procedural = 0, map;
      figure?.traverse(o => { if (o.isMesh) { vertices += o.geometry.attributes.position.count; if (["TubeGeometry", "ConeGeometry"].includes(o.geometry.type)) procedural++; } });
      figure?.getObjectByName("original-dragon_low")?.traverse(o => { if (o.material) map = o.material.map.name; });
      return { round: world.round, phase: world.phase, active: FINISHERS.active.size, visible: !!figure?.visible, height: figure ? new T.Box3().setFromObject(figure).getSize(new T.Vector3()).y : 0, min: figure?.userData.playerHeight * 5, snake: figure?.userData.serpent, map, vertices, procedural, timer: document.getElementById("tb-time").textContent };
    });
    for (const skin of ["champions_atk", "champions_def"]) {
      const start = await p.evaluate(skin => {
        titleCam = () => {}; room.mode = "std"; room.map = "field"; room.rounds = 13;
        startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = "live";
        const me = myActor(), foes = world.actors.filter(a => a.team !== me.team), victim = foes[0];
        for (const a of world.actors) { a.fireCd = 999; if (a.team !== me.team) a.alive = a === victim; }
        me.weapons.primary = "carbine"; me.slot = "primary"; GUN_SKINS.set("carbine", skin);
        victim.hp = 1; victim.armor = victim.invuln = victim.shielded = 0;
        victim.pos.set(me.pos.x + 8, 0, me.pos.z); victim.y = 0;
        const at = performance.now();
        DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(me, "carbine", "gun", world.round, skin), () => dealDamage(victim, 999, false, me));
        checkRoundEnd(); updateHUD();
        followCamera = () => {}; camera.position.set(victim.pos.x + 18, 8, victim.pos.z + 25); camera.lookAt(victim.pos.x, 6, victim.pos.z);
        window.__finishRender = window.__finishRender || render; render = () => {};
        return { round: world.round, phase: world.phase, wait: world.championsFinishUntil - at, score: world.scoreAtk + world.scoreDef, snapshotMs: buildSnapshot(false).championsFinishMs };
      }, skin);
      assert.equal(start.phase, "end"); assert.equal(start.wait, 8000); assert.equal(start.score, 1); assert.equal(start.snapshotMs, 8000);
      await p.clock.fastForward(2600); assert.equal((await metrics()).visible, false, "source model starts at 2.66s, without a generated replacement snake");
      await p.clock.fastForward(100); let state = await metrics(); assert.equal(state.visible, true); assert.match(state.map, /dragon_low_black/);
      await p.clock.fastForward(100); state = await metrics();
      assert.equal(state.snake, skin === "champions_atk" ? "cream" : "red"); assert.ok(state.height >= state.min - 1e-6); assert.equal(state.procedural, 0);
      assert.equal(state.vertices, (214 + (skin === "champions_atk" ? 259 : 256)) * 36);
      assert.match(state.map, skin === "champions_atk" ? /dragon_low_black/ : /dragon_low_white/);
      await p.evaluate(() => __finishRender()); await p.screenshot({ path: path.join(dir, skin + "-large-original.png") });
      await p.clock.fastForward(5199); state = await metrics(); assert.equal(state.round, start.round); assert.equal(state.phase, "end"); assert.equal(state.visible, true); assert.equal(state.timer, "1");
      await p.clock.fastForward(1); state = await metrics(); assert.equal(state.round, start.round + 1); assert.equal(state.phase, "buy"); assert.equal(state.active, 0);
      console.log(skin, "source vertices", (214 + (skin === "champions_atk" ? 259 : 256)) * 36, "height", preview.height, "8s next round passed");
    }
    await p.evaluate(() => { room.mode = "std"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.championsFinishUntil = performance.now() + 8000; endRound("atk", "test"); netShutdown(); });
    const cancelledRound = await p.evaluate(() => world.round); await p.clock.fastForward(9000); assert.equal(await p.evaluate(() => world.round), cancelledRound);
    assert.deepEqual(f.errors, []);
    console.log("Original serpent/dragon, correct variants, all cubes, >=5x player height, full preview framing, 7.999s hold, 8s next round, and leaving cancels stale restart passed");
  } finally { await f.browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
