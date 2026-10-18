const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
// The select screen and its real control path were explored before this test was authored.
(async () => {
  const f = await fixture(), dir = path.resolve("test-results/neon"); fs.mkdirSync(dir, { recursive: true });
  try {
    const p = await f.page("neontest", { width: 1280, height: 800 });
    await p.locator("#go-play").click();
    const card = p.locator("#sel-grid .acard").filter({ has: p.locator(".acard-name", { hasText: /^네온$/ }) });
    await card.click();
    await p.waitForFunction(() => picked.id === "neon_agent");
    assert.equal(await p.locator("#title-roster .tr-chip").count(), 43);
    await p.waitForFunction(() => NEON_AGENT.ready());
    assert.equal(await p.evaluate(() => NEON_AGENT.error()), null);
    assert.equal(await p.locator('.ab-ic[src*="assets/neon"]').count() >= 4, true);
    await p.waitForFunction(() => document.querySelector("#sel-detail .det-img")?.naturalWidth > 0);
    await p.screenshot({ path: path.join(dir, "select.png") });
    await p.evaluate(() => { room.map = "glacier"; room.mode = "std"; });
    await p.locator("#sel-go").click();
    await p.waitForFunction(() => myActor()?.agent.id === "neon_agent");
    await p.evaluate(() => { closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    const result = await p.evaluate(() => {
      // Freeze the frame loop while stepping the actual game simulation deterministically.
      world.phase = "live"; window.__neonRender = render; render = () => {};
      const me = myActor(), foe = world.actors.find(a => a.team !== me.team), out = {};
      for (const a of world.actors) if (a !== me) { a.fireCd = 999; a.pos.set(80 + a.id * 3, 0, 80); }
      const def = (type) => NEON_AGENT.agent.abilities.find(a => a.type === type);
      const cast = (type) => castAbility(type, def(type));
      // Find a real, clear lane on this map for range and wall tests.
      let spot;
      for (let x = -35; x <= 35 && !spot; x += 5) for (let z = -35; z <= 35 && !spot; z += 5) {
        if (collideXZ(x, z, 0.6, 0.4)) continue;
        if ([0, 1, 2, 3].some(k => { const yaw = k * Math.PI / 2; const end = { x: x - Math.sin(yaw) * 12, z: z - Math.cos(yaw) * 12 }; if (rayBlocked(x, 1.4, z, end.x, 1.4, end.z)) return false; spot = { x, z, yaw }; return true; })) break;
      }
      if (!spot) throw new Error("No clear test lane");
      me.pos.set(spot.x, 0, spot.z); me.y = groundAt(spot.x, spot.z, 0); me.yaw = spot.yaw; me.pitch = 0; me.invuln = 99;
      const dx = -Math.sin(me.yaw), dz = -Math.cos(me.yaw);
      const resetPos = () => { me.pos.set(spot.x, 0, spot.z); me.yaw = spot.yaw; me.vel.set(0, 0, 0); };
      const putFoe = (distance) => { foe.alive = true; foe.hp = 100; foe.armor = 0; foe.invuln = 0; foe.crouch = false; foe.forceCrouch = 0; foe.y = me.y; foe.pos.set(me.pos.x + dx * distance, 0, me.pos.z + dz * distance); };
      cast("neon_gear"); out.gear = me.__neonGear;
      me.input = { mv: [0, -1], btn: 0 }; const z0 = me.pos.clone(); simMove(me, 0.1); out.fast = me.pos.distanceTo(z0);
      NEON_AGENT.clear(me); resetPos(); simMove(me, 0.1); out.normal = me.pos.distanceTo(z0);
      resetPos(); cast("neon_gear"); me.input.mv = [0, 0]; me.onGround = true;
      out.slide = NEON_AGENT.slide(me); out.doubleSlide = NEON_AGENT.slide(me);
      const before = me.pos.clone(); for (let i = 0; i < 18; i++) { step(0.05); world.phase = "live"; }
      out.slideDistance = Math.hypot(me.pos.x - before.x, me.pos.z - before.z); out.slideEnded = me.__neonSlide === 0;
      for (let i = 0; i < 2; i++) { putFoe(8); killActor(foe, me); }
      out.refilled = me.__neonSlideReady;
      const blocker = COLLIDERS.find(c => c.h > 1 && c.maxZ - c.minZ > 1 && !collideXZ(c.minX - 1, (c.minZ + c.maxZ) / 2, 0.45, 0.28));
      if (!blocker) throw new Error("No wall for slide collision check");
      me.pos.set(blocker.minX - 1, 0, (blocker.minZ + blocker.maxZ) / 2); me.y = 0; me.yaw = -Math.PI / 2; me.onGround = true;
      cast("neon_gear"); NEON_AGENT.slide(me);
      for (let i = 0; i < 18; i++) { step(0.05); world.phase = "live"; }
      out.stoppedAtWall = me.pos.x < blocker.minX && me.__neonSlide === 0;
      foe.alive = true; botCast(foe, "neon_gear", def("neon_gear")); step(0.01); out.copiedGear = foe.__neonGear > 0; NEON_AGENT.clear(foe);
      resetPos(); cast("neon_lane");
      abilTick(.41); abilTick(.3);
      out.walls = scene.children.filter(o => o.name === "neon-fastlane").length;
      out.visionBlocked = rayBlocked(me.pos.x, 1.4, me.pos.z, me.pos.x + -dz * 5, 1.4, me.pos.z + dx * 5);
      out.forwardClear = !rayBlocked(me.pos.x, 1.4, me.pos.z, me.pos.x + dx * 6, 1.4, me.pos.z + dz * 6);
      abilClear(); out.wallsGone = scene.children.every(o => o.name !== "neon-fastlane");
      // Original projectile travels, bounces and produces delayed concussive zones.
      putFoe(5); me.pitch = -0.45; cast("neon_relay");
      for (let i = 0; i < 80 && !(foe.concuss > 0); i++) abilTick(0.05);
      out.concuss = foe.concuss || 0; out.relayNoDamage = foe.hp === 100; abilClear(); me.pitch = 0;
      putFoe(8); cast("neon_overdrive"); out.ultName = me.ultW.name; out.ultDuration = me.ultW.t;
      const aim = ultwAim(me, 0, 0), ray = ultwRay(me, aim.o, aim.dir, 40 / AB_D, false, false, 0.08);
      out.ray = { origin: aim.o.toArray(), dir: aim.dir.toArray(), foe: [foe.pos.x, foe.y, foe.pos.z, foe.crouch], hits: ray.hits.map(h => h.e.id), end: ray.endT, shield: foe.shielded, undying: foe.undying, phase: world.phase };
      me.ultW.cd = 0; ultwFire(me); out.ultDamage = 100 - foe.hp;
      const snap = buildSnapshot(false); out.snapshot = snap.neon.find(row => row[0] === me.id);
      const serverMode = NET.mode; NET.mode = "client"; foe.hp = 100; me.ultW.cd = 0; ultwFire(me); out.clientDamage = 100 - foe.hp; NET.mode = serverMode;
      tickViewmodel(0.016); out.originalArms = !!VM.current.getObjectByName("bedrock-rig");
      let vertices = 0; VM.current.traverse(o => { if (o.isMesh) vertices += o.geometry.attributes.position.count; }); out.armVertices = vertices;
      me.ultW.t = 17.5; me.ultW.cd = 0; followCamera(me, 0.1); tickViewmodel(0.016); __neonRender();
      return out;
    });
    console.log(result);
    assert.equal(result.gear, 10); assert.ok(result.fast > result.normal * 1.3);
    assert.equal(result.slide, true); assert.equal(result.doubleSlide, false); assert.ok(Math.abs(result.slideDistance - 6) < 0.15); assert.equal(result.slideEnded, true); assert.equal(result.refilled, true);
    assert.equal(result.stoppedAtWall, true); assert.equal(result.copiedGear, true);
    assert.ok(result.walls >= 2); assert.equal(result.visionBlocked, true); assert.equal(result.forwardClear, true); assert.equal(result.wallsGone, true);
    assert.ok(result.concuss > 0); assert.equal(result.relayNoDamage, true);
    assert.equal(result.ultName, "오버드라이브"); assert.equal(result.ultDuration, 20); assert.equal(result.ultDamage, 18); assert.equal(result.clientDamage, 0);
    assert.equal(result.snapshot[4], 20); assert.equal(result.originalArms, true); assert.equal(result.armVertices, 3 * 36);
    await p.screenshot({ path: path.join(dir, "original-overdrive-arms.png") });
    await p.evaluate(() => { const me = myActor(); endUltW(me); NEON_AGENT.clear(me); });
    assert.equal(await p.evaluate(() => myActor().__neonSlideReady), false);
    assert.deepEqual(f.errors, []);
    console.log("Neon: select, source assets, sprint/slide/refill, vision walls, bouncing concuss, authoritative ultimate passed");
  } finally { await f.browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
