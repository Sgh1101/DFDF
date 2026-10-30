const fs = require("node:fs"), assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Shot effects (tracer, muzzle flash, blood, sparks, wall dust and chips) reuse a fixed set of objects instead of making and
// disposing geometry, materials and objects for every shot, and the point lights are few and constant per preset:
//  1. lights per preset: the effects pool holds 1, 2, 2, 4 (mobile, perf, visual, ultra); the golden chests have a light only on visual and ultra, inside the lamp budget
//  2. the effects still show: a tracer line, the muzzle flash planes and blood drops appear in the scene with their colours and fade away
//  3. a firefight's worth of shots makes no new geometry or material, and the pools stay at their size however many shots come before a frame
//  4. other shooters' casings show on visual and ultra only; your own gun's casings stay on perf
// Writes test-results/fx-pool-*.png (a frame with the effects on).
(async () => {
  const f = await fixture(), fails = [];
  // each part runs on its own, so a run on code without the change lists every part that fails
  const section = async (name, run) => { try { await run(); } catch (e) { fails.push(name + ": " + String(e.message).split("\n")[0]); console.log("FAIL", name, String(e.message).split("\n")[0]); } };
  fs.mkdirSync("test-results", { recursive: true });
  try {
    const page = await f.page("fxpool", { width: 1280, height: 720 }, {}, { bootTimeout: 120000, quality: "perf" });
    await page.waitForFunction(() => VALORANT_PACK.status === "ready");
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "pogu"; startGame(AGENTS[0], false); });
    await page.waitForFunction(() => CUR_MAP_KEY === "pogu" && !!myActor(), null, { timeout: 120000 });
    await page.evaluate(() => { closeShop(); world.phase = "live"; world.roundTime = 999; checkRoundEnd = function () {}; ADMIN.freezeAI = true; for (const a of world.actors) { a.invuln = 1e9; a.hp = 100; } });

    // 1. lights per preset
    await section("lights", async () => {
    const lightsOf = () => page.evaluate(() => {
      const points = []; scene.traverse((o) => { o.isPointLight && points.push(o); });
      const chests = scene.children.filter((g) => g.isGroup && g.children.some((c) => c.isMesh && c.material.blending === T.AdditiveBlending && c.geometry.type === "CylinderGeometry")).length;
      return { quality: SETTINGS.quality, map: CUR_MAP_KEY, total: points.length, chestLights: points.filter((l) => l.color.getHex() === 0xffc24a).length, chests, effects: FX_LIGHTS.length, lamps: GFX.lamps, counted: LAMP_LIT.n };
    });
    const want = { mobile: 1, perf: 2, visual: 2, ultra: 4 }, seen = {};
    for (const q of ["mobile", "perf", "visual", "ultra"]) {
      await page.evaluate((q) => setQuality(q), q);
      await page.waitForFunction((q) => SETTINGS.quality === q && CUR_MAP_KEY === "pogu" && !!myActor(), q, { timeout: 120000 });
      const r = seen[q] = await lightsOf();
      console.log("lights", JSON.stringify(r));
      assert.ok(r.chests >= 1, q + ": the map has golden chests (" + r.chests + ")");
      assert.equal(r.effects, want[q], q + ": effects light pool");
      assert.ok(r.chestLights <= Math.max(0, r.lamps), q + ": chest lights " + r.chestLights + " are inside the lamp budget " + r.lamps);
      if (r.lamps < 12) assert.equal(r.chestLights, 0, q + ": no chest lights on the presets with few lamps");
      assert.ok(r.counted >= r.chestLights, q + ": chest lights are counted in the lamps (" + r.counted + ")");
      assert.ok(r.counted <= r.lamps, q + ": lit lamps " + r.counted + " stay in the budget " + r.lamps);
      // a burst of flashes and fx frames leaves the number of lights as it was
      await page.evaluate(() => { for (let i = 0; i < 40; i++) { fxFlash(16766602, 1, 12, i, 1, 0, 0.07, 1); muzzleFlash(); updateFx(0.016); } });
      assert.equal((await lightsOf()).total, r.total, q + ": the number of lights does not change while playing");
    }
    assert.ok(seen.mobile.total < seen.ultra.total + 1 && seen.perf.effects < seen.ultra.effects, "fewer lights on the lighter presets");
    });
    await page.evaluate(() => setQuality("perf"));
    await page.waitForFunction(() => SETTINGS.quality === "perf" && CUR_MAP_KEY === "pogu" && !!myActor(), null, { timeout: 120000 });
    await page.evaluate(() => { closeShop(); world.phase = "live"; world.roundTime = 999; ADMIN.freezeAI = true; });

    // 2. the effects show
    await section("look", async () => {
    const look = await page.evaluate(() => {
      const bot = world.actors.find((a) => a !== myActor() && a.alive && a.model), out = {};
      bot.pos.set(camera.position.x + 3, 0, camera.position.z); bot.y = 0;
      const mark = () => new Set(scene.children), added = (m) => scene.children.filter((o) => !m.has(o));
      const near = (a, b, e) => Math.abs(a - b) <= (e || 0.02);
      updateFx(1); // nothing left from before
      // your tracer: pale yellow, 70% opaque, x1.6 bright, from 1.4 m in front of the muzzle to 50 m
      let m = mark(); addTracer(new T.Vector3(0, 2, 0), 0, 0, 50);
      let a = added(m).filter((o) => o.isLine);
      out.tracerCount = a.length;
      const tl = a[0], tp = tl.geometry.attributes.position.array, tc = new T.Color(16773312).multiplyScalar(1.6);
      out.tracer = { r: near(tl.material.color.r, tc.r), g: near(tl.material.color.g, tc.g), b: near(tl.material.color.b, tc.b), opacity: tl.material.opacity, from: [tp[0], tp[1], tp[2]], to: [tp[3], tp[4], tp[5]] };
      updateFx(0.035); out.tracerHalf = tl.material.opacity;
      updateFx(0.05); out.tracerGone = !tl.parent;
      // another shooter's tracer (bot): 55% opaque, pale yellow-white
      m = mark(); worldTracer(bot, new T.Vector3(0, 0, -1), 40);
      a = added(m).filter((o) => o.isLine); const wl = a[0], wc = new T.Color(16771504).multiplyScalar(1.6);
      out.worldTracer = { n: a.length, opacity: wl.material.opacity, color: near(wl.material.color.r, wc.r) && near(wl.material.color.g, wc.g) && near(wl.material.color.b, wc.b), length: Math.abs(wl.geometry.attributes.position.array[5] - wl.geometry.attributes.position.array[2]) };
      updateFx(1);
      // a guest sees the host's shot (FX.SHOT)
      m = mark(); playRemoteFX([[FX.SHOT, Q.pos(0), Q.pos(2), Q.pos(0), 0]]);
      a = added(m).filter((o) => o.isLine); out.remoteTracer = { n: a.length, opacity: a[0] && a[0].material.opacity };
      updateFx(1);
      // the muzzle flash: two planes, warm yellow, 95% opaque, grows and fades in 55 ms
      m = mark(); worldMuzzleFlash(bot);
      a = added(m).filter((o) => o.isGroup);
      const g = a[0], fc = new T.Color(16768922);
      out.flash = { groups: a.length, planes: g.children.length, plane: g.children.every((c) => c.geometry === FXG.flash), color: near(g.children[0].material.color.r, fc.r) && near(g.children[0].material.color.g, fc.g) && near(g.children[0].material.color.b, fc.b), opacity: g.children[0].material.opacity, light: FX_LIGHTS.some((l) => l.intensity > 0) };
      const s0 = g.scale.x; updateFx(0.0275); out.flashHalf = { opacity: g.children[0].material.opacity, grew: g.scale.x > 0.7 };
      updateFx(0.05); out.flashGone = !g.parent;
      // blood: red drops, fall and fade
      m = mark(); bloodBurst(0, 1, 0, 0xcc2222);
      a = added(m).filter((o) => o.isMesh && o.geometry === FXG.blood);
      const bc = new T.Color(0xcc2222), y0 = a.map((o) => o.position.y);
      out.blood = { n: a.length, color: a.every((o) => near(o.material.color.r, bc.r) && near(o.material.color.g, bc.g) && near(o.material.color.b, bc.b)), opacity: a[0].material.opacity };
      updateFx(0.31); out.bloodHalf = { opacity: a[0].material.opacity, moved: a.every((o, i) => o.position.y !== y0[i]) };
      updateFx(0.4); out.bloodGone = a.every((o) => !o.parent);
      // a spark where a bullet hits: a glowing sprite in the colour, then gone
      m = mark(); impactSpark(0, 1, 0, 16757575);
      a = added(m).filter((o) => o.isSprite); out.spark = { n: a.length, opacity: a[0] && a[0].material.opacity };
      updateFx(1); out.sparkGone = a.every((o) => !o.parent);
      out.fxLeft = fx.length;
      return out;
    });
    console.log("look", JSON.stringify(look));
    assert.equal(look.tracerCount, 1, "one tracer line per shot");
    assert.ok(look.tracer.r && look.tracer.g && look.tracer.b, "tracer colour");
    assert.ok(Math.abs(look.tracer.opacity - 0.7) < 0.01, "tracer opacity " + look.tracer.opacity);
    assert.deepEqual(look.tracer.from.map((v) => +v.toFixed(2)), [0, 2, -1.4]);
    assert.deepEqual(look.tracer.to.map((v) => +v.toFixed(2)), [0, 2, -50]);
    assert.ok(Math.abs(look.tracerHalf - 0.35) < 0.02, "tracer fades " + look.tracerHalf);
    assert.ok(look.tracerGone, "tracer leaves the scene");
    assert.equal(look.worldTracer.n, 1); assert.ok(look.worldTracer.color, "bot tracer colour"); assert.ok(Math.abs(look.worldTracer.opacity - 0.55) < 0.01); assert.ok(Math.abs(look.worldTracer.length - 40) < 0.01, "bot tracer length");
    assert.equal(look.remoteTracer.n, 1, "a guest sees the host's tracer"); assert.ok(Math.abs(look.remoteTracer.opacity - 0.55) < 0.01);
    assert.equal(look.flash.groups, 1); assert.equal(look.flash.planes, 2); assert.ok(look.flash.plane); assert.ok(look.flash.color, "flash colour"); assert.ok(Math.abs(look.flash.opacity - 0.95) < 0.01); assert.ok(look.flash.light, "the flash lights the scene");
    assert.ok(Math.abs(look.flashHalf.opacity - 0.475) < 0.03 && look.flashHalf.grew, "flash fades and grows " + JSON.stringify(look.flashHalf)); assert.ok(look.flashGone);
    assert.equal(look.blood.n, 5, "blood drops on perf (7 x 0.65)"); assert.ok(look.blood.color, "blood colour"); assert.equal(look.blood.opacity, 1);
    assert.ok(Math.abs(look.bloodHalf.opacity - 0.5) < 0.03 && look.bloodHalf.moved, "blood falls and fades " + JSON.stringify(look.bloodHalf)); assert.ok(look.bloodGone);
    assert.equal(look.spark.n, 1); assert.ok(look.spark.opacity > 0.9); assert.ok(look.sparkGone);
    assert.equal(look.fxLeft, 0, "every effect has been taken out of the list");
    // one frame with the effects on, for looking at
    await page.evaluate(() => { const bot = world.actors.find((a) => a !== myActor() && a.alive && a.model); const d = new T.Vector3(); camera.getWorldDirection(d); bot.pos.set(camera.position.x + d.x * 6, 0, camera.position.z + d.z * 6); worldMuzzleFlash(bot); addTracer(new T.Vector3(camera.position.x, camera.position.y - 0.2, camera.position.z), player.yaw, player.pitch, 40); bloodBurst(camera.position.x + d.x * 5, 1.2, camera.position.z + d.z * 5, 13386820); impactSpark(camera.position.x + d.x * 8, 1, camera.position.z + d.z * 8, 16757575); updateFx(0.02); render(); });
    await page.screenshot({ path: "test-results/fx-pool-effects.png" });
    await page.evaluate(() => updateFx(2));
    });

    // 3. a firefight's worth of shots: nothing new is made, and the pools hold
    await section("pools", async () => {
    const made = await page.evaluate(() => {
      const bot = world.actors.find((a) => a !== myActor() && a.alive && a.model);
      bot.pos.set(camera.position.x + 3, 0, camera.position.z); bot.y = 0;
      const ids = () => ({ geometries: new T.BufferGeometry().id, materials: new T.MeshBasicMaterial().id, textures: new T.Texture().id });
      const shot = (i) => {
        addTracer(new T.Vector3(0, 2, 0), i * 0.1, 0, 60); muzzleFlash(); worldMuzzleFlash(bot); worldTracer(bot, new T.Vector3(0, 0, -1), 60);
        playRemoteFX([[FX.SHOT, Q.pos(i % 40), Q.pos(2), Q.pos(0), i]]);
        bloodBurst(i % 7, 1, 0, i % 2 ? 13386820 : 16726862); impactSpark(i % 5, 1, 0, 16757575);
        window.GUNFX && GUNFX.wallImpact(camera.position.x + 2 + (i % 3), 0.01, camera.position.z + 1);
        updateFx(0.016);
      };
      for (let i = 0; i < 120; i++) shot(i); // warm up: the pools and the shelf of glow sprites fill
      const a = ids(); const n0 = { geometries: renderer.info.memory.geometries };
      for (let i = 0; i < 600; i++) shot(i);
      const b = ids();
      const out = { geometries: b.geometries - a.geometries - 1, materials: b.materials - a.materials - 1, textures: b.textures - a.textures - 1 };
      // many shots before the next frame: the oldest is taken over, nothing grows
      const pre = fx.length;
      for (let i = 0; i < 400; i++) { addTracer(new T.Vector3(0, 2, 0), 0, 0, 60); worldMuzzleFlash(bot); bloodBurst(0, 1, 0, 13386820); }
      const cnt = (p) => scene.children.filter(p).length;
      out.lines = cnt((o) => o.isLine && o.material.transparent); out.flashes = cnt((o) => o.isGroup && o.children.length === 2 && o.children[0].geometry === FXG.flash); out.blood = cnt((o) => o.isMesh && o.geometry === FXG.blood);
      out.fxEntries = fx.length; out.fxGrowth = fx.length - pre;
      updateFx(0.016); out.fxEntriesAfter = fx.length;
      updateFx(2); out.leftInScene = cnt((o) => (o.isLine && o.material.transparent) || (o.isGroup && o.children.length === 2 && o.children[0].geometry === FXG.flash) || (o.isMesh && o.geometry === FXG.blood)); out.fxLeft = fx.length;
      out.glowShelf = typeof GLOW_FREE === "object" ? GLOW_FREE.length : -1;
      return out;
    });
    console.log("made", JSON.stringify(made));
    assert.ok(made.geometries <= 4, "no geometry made for 600 shots: " + made.geometries);
    assert.ok(made.materials <= 6, "no material made for 600 shots: " + made.materials);
    assert.ok(made.textures <= 2, "no texture made for 600 shots: " + made.textures);
    assert.ok(made.lines <= 48, "tracer lines are bounded: " + made.lines);
    assert.ok(made.flashes <= 16, "muzzle flashes are bounded: " + made.flashes);
    assert.ok(made.blood <= 128, "blood drops are bounded: " + made.blood);
    assert.ok(made.lines >= 1 && made.flashes >= 1 && made.blood >= 1, "and still shown: " + JSON.stringify(made));
    assert.ok(made.fxGrowth <= 48 + 16 + 128, "400 shots before a frame add at most the pools' size to the list of plays: " + made.fxGrowth);
    assert.ok(made.fxEntriesAfter <= made.fxEntries && made.fxLeft === 0 && made.leftInScene === 0, "cancelled and finished plays leave the list and the scene: " + JSON.stringify(made));
    assert.ok(made.glowShelf <= 640, "the shelf of glow sprites is capped: " + made.glowShelf);

    });

    // 4. casings
    await section("casings", async () => {
    const casings = {};
    for (const q of ["mobile", "perf", "visual"]) {
      await page.evaluate((q) => setQuality(q), q);
      await page.waitForFunction((q) => SETTINGS.quality === q && CUR_MAP_KEY === "pogu" && !!myActor(), q, { timeout: 120000 });
      casings[q] = await page.evaluate(() => {
        closeShop(); world.phase = "live"; world.roundTime = 999; ADMIN.freezeAI = true;
        const bot = world.actors.find((a) => a !== myActor() && a.alive && a.model);
        bot.pos.set(camera.position.x + 3, 0, camera.position.z); bot.y = 0;
        GUNFX.clearHoles();
        for (let i = 0; i < 80; i++) worldMuzzleFlash(bot);
        const other = GUNFX.LIVE.length;
        GUNFX.clearHoles();
        const key = curWeaponKey(), before = GUNFX.LIVE.length; let fired = 0;
        player.alive = true; player.ammo[key] = 30;
        for (let i = 0; i < 6; i++) { player.reloading = 0; player.fireCd = 0; const a0 = player.ammo[key]; try { fire(); } catch (e) {} fired += player.ammo[key] < a0 ? 1 : 0; }
        return { other, mine: GUNFX.LIVE.length - before, fired, shells: GFX.shells, fx: GFX.fx };
      });
      console.log("casings", q, JSON.stringify(casings[q]));
    }
    assert.equal(casings.mobile.other, 0, "no third-person casings on mobile");
    assert.equal(casings.perf.other, 0, "no third-person casings on perf");
    assert.ok(casings.visual.other > 0, "third-person casings on visual");
    assert.ok(casings.perf.fired > 0 && casings.perf.mine > 0, "your own casings stay on perf: " + JSON.stringify(casings.perf));
    assert.ok(casings.visual.mine > 0, "your own casings on visual");
    });
    assert.deepEqual(f.errors, []);
    assert.deepEqual(fails, [], "parts that failed");
    console.log("fx pool ok");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
