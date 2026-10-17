const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
// The actual source-VFX preview was explored and visually inspected before adding these assertions.
(async () => {
  const f = await fixture(), dir = path.resolve("test-results/phantom-motion"); fs.mkdirSync(dir, { recursive: true });
  try {
    const p = await f.page("motioncheck", { width: 1280, height: 800 }), shaderErrors = [];
    p.on("console", m => { if (m.type() === "error" && /WebGLProgram|VALIDATE_STATUS|shader error/i.test(m.text())) shaderErrors.push(m.text()); });
    await p.waitForFunction(() => CHAMPIONS_PHANTOM.loaded());
    await p.clock.install({ time: new Date("2030-01-01T00:00:00Z") }); await p.clock.pauseAt(new Date("2030-01-01T00:00:10Z"));
    await p.locator("#go-armory").click(); await p.locator('#ar-tabs [data-tab="champions"]').click();
    await p.locator('[data-phantom-demo="fin"]').click();
    async function state() {
      return p.evaluate(() => {
        const root = [...FINISHERS.active][0], motion = root?.getObjectByName("champions-source-motion"), model = root?.getObjectByName("champions-original-finisher"), pv = GUN_SKINS._pv();
        pv.r.render(pv.sc, pv.cam);
        const shape = []; let allFxFramed = true;
        motion?.traverse(o => { if (o.isMesh && o.visible) {
          const attribute = o.geometry.attributes.position;
          for (let i = 0; i < o.geometry.drawRange.count; i++) {
            const point = o.localToWorld(new T.Vector3().fromBufferAttribute(attribute, i)).project(pv.cam);
            if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) allFxFramed = false;
          }
          shape.push({ name: o.name, vertices: o.geometry.drawRange.count, positions: Array.from(attribute.array.slice(0, o.geometry.drawRange.count * 3)), decoded: o.material.map.image?.naturalWidth > 0 });
        } });
        const bones = []; model?.traverse(o => { if (o.name.startsWith("phantom-bone-")) bones.push(...o.matrixWorld.elements); });
        return { active: FINISHERS.active.size, time: motion?.userData.time, pulse: motion?.userData.pulse, vertices: motion?.userData.vertices, modelVisible: model?.visible, shape, bones, allFxFramed, glError: pv.r.getContext().getError() };
      });
    }
    await p.clock.fastForward(650); const coilA = await state();
    assert.equal(coilA.modelVisible, false); assert.ok(coilA.vertices > 0); assert.ok(coilA.shape.some(s => s.name.includes("ribbon_white")));
    const firstPixels = await p.locator("#ar-cv").screenshot(); await p.screenshot({ path: path.join(dir, "01-coils.png") });
    await p.clock.fastForward(200); const coilB = await state();
    assert.notDeepEqual(coilA.shape, coilB.shape, "source ribbons must move, not just be attached to the scene");
    assert.notDeepEqual(firstPixels, await p.locator("#ar-cv").screenshot(), "actual rendered preview changes while models stay hidden");
    await p.clock.fastForward(650); const swirlA = await state();
    await p.clock.fastForward(500); const swirlB = await state();
    assert.notDeepEqual(swirlA.shape.find(s => s.name.includes("swirl"))?.positions, swirlB.shape.find(s => s.name.includes("swirl"))?.positions);
    await p.screenshot({ path: path.join(dir, "02-rotating-swirl.png") });
    await p.clock.fastForward(1050); const flash = await state();
    assert.equal(flash.modelVisible, true); assert.ok(flash.pulse > 0 && flash.pulse < 1);
    await p.screenshot({ path: path.join(dir, "03-dragon-flash.png") });
    await p.clock.fastForward(200); const arc = await state();
    assert.equal(arc.pulse, 0); assert.ok(arc.shape.some(s => s.name.includes("white:add")), "source arcs between flashes");
    await p.screenshot({ path: path.join(dir, "04-arcs.png") });
    await p.clock.fastForward(750); const later = await state();
    assert.deepEqual(flash.bones, later.bones, "source JAR has static dragon/serpent bones; no invented skeletal animation");
    assert.notDeepEqual(arc.shape.find(s => s.name.includes("ember"))?.positions, later.shape.find(s => s.name.includes("ember"))?.positions);
    for (const s of [coilA, coilB, swirlA, swirlB, flash, arc, later]) { assert.equal(s.glError, 0); assert.equal(s.allFxFramed, true, "moving source FX must remain inside the preview"); assert.ok(s.shape.every(mesh => mesh.decoded)); }
    await p.clock.fastForward(4100); await p.clock.runFor(150);
    assert.equal(await p.evaluate(() => FINISHERS.active.size), 0); assert.equal(await p.evaluate(() => GUN_SKINS._pv().obj.visible), true);
    assert.equal(await p.evaluate(() => !!GUN_SKINS._pv().sc.getObjectByName("champions-source-motion")), false, "no orphaned source FX after preview cleanup");
    await p.evaluate(() => { SETTINGS.motion = 0; });
    assert.equal(await p.evaluate(() => FINISHERS.preview("champions_atk")), false);
    assert.deepEqual(shaderErrors, []); assert.deepEqual(f.errors, []);
    console.log("Source motion: changing rendered ribbon pixels, rotating swirl, 0.6s pulses/arcs, moving ember geometry, decoded original textures, static source bones, 8s cleanup, and reduced-motion passed");
  } finally { await f.browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
