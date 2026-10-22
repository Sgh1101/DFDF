const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// Neon is all this game's own: no outside file is fetched; line icons; a painted portrait; an outfit made with the
// character kit; first-person arms built here with their own motions for each skill; the bolt, charge, lane and spark
// effects made here and all cleared. The real input path (E, then a click slides 6 m and never fires) still holds.
(async () => {
  const f = await fixture();
  try {
    fs.mkdirSync("test-results/neon-look", { recursive: true });
    const p = await f.page("neonlook", { width: 1280, height: 800 });
    const outside = [], shaderErrors = [];
    p.on("request", (r) => /assets\/neon|neon-data|neon-fx-source|neon-appearance/.test(r.url()) && outside.push(r.url()));
    p.on("console", (m) => { if (m.type() === "error" && /shader|WebGLProgram/i.test(m.text())) shaderErrors.push(m.text()); });
    await p.locator("#go-play").click();
    const card = p.locator("#sel-grid .acard").filter({ has: p.locator(".acard-name", { hasText: /^네온$/ }) });
    await card.click();
    await p.waitForFunction(() => document.querySelector("#sel-detail .det-img")?.naturalWidth > 0);
    const look = await p.evaluate(() => {
      const ag = NEON_AGENT.agent, m = buildFighter(0x41cfff, ag);
      let meshes = 0, glow = 0, skin = 0, verts = 0;
      const lit = (mt) => mt && ((mt.emissive && mt.emissive.getHex() === 0x41cfff) || (mt.color && mt.color.getHex() === 0x41cfff) || (mt.vertexColors && mt.emissiveIntensity > 0));
      m.group.traverse((o) => { if (o.isMesh) { meshes++; verts += o.geometry.attributes.position.count; [].concat(o.material).some(lit) && glow++; o.userData.neonSkin && skin++; } });
      return {
        names: ag.abilities.map((a) => a.name), icons: ag.abilities.map((a) => AB_ICON_OF[a.type]),
        paint: !!(window.CH_PAINTKIT && CH_PAINTKIT.PAINT.neon_agent), design: !!(window.CH_DESIGN && CH_DESIGN.neon_agent),
        portrait: agentPortrait(ag, 300, 380).slice(0, 22), meshes, glow, skin, verts,
      };
    });
    assert.deepEqual(look.names, ["되튐 전격", "질주 회로", "전류 통로", "과충전"]);
    assert.deepEqual(look.icons, ["neonRelay", "neonGear", "neonLane", "neonOverdrive"]);
    assert.ok(look.paint && look.design, "a painted portrait and an outfit of our own");
    assert.match(look.portrait, /^data:image\//);
    assert.ok(look.verts > 5000 && look.glow >= 1 && look.skin === 0, JSON.stringify(look));
    assert.equal(await p.locator("img.ab-ic").count(), 0, "no image icons");
    await p.screenshot({ path: "test-results/neon-look/select.png" });
    await p.evaluate(() => { room.map = "pogu"; room.mode = "std"; });
    await p.locator("#sel-go").click();
    await p.waitForFunction(() => myActor()?.agent.id === "neon_agent");
    await p.evaluate(() => { closeShop(); ADMIN.freezeAI = true; world.phase = "live"; world.roundTime = 999; for (const a of world.actors) { a.invuln = 999; a.fireCd = 999; } const a = myActor(); a.yaw = 0; a.pitch = 0; followCamera(a, 0.1); requestAnimationFrame = () => 0; });
    await p.locator("#cv").click({ force: true });
    await p.waitForFunction(() => document.pointerLockElement === document.getElementById("cv"));
    // the arms: their own pose for each moment
    const arms = await p.evaluate(() => {
      const g = NEON_AGENT.buildArms("t"), r = () => g.userData.arms.r.root.position.toArray().concat(g.userData.arms.r.fore.rotation.toArray().slice(0, 2)).map((v) => +v.toFixed(3));
      const at = (clip, t, moving, shot) => { NEON_AGENT.poseArms(g, clip, t, moving, shot); return { r: r(), charged: g.userData.neonMotion.charged }; };
      return { throwBack: at("relay", 0.25, false, -1), throwOut: at("relay", 0.5, false, -1), lane: at("lane", 0.45, false, -1), run1: at("run", 0.1, true, -1), run2: at("run", 0.25, true, -1), ult: at("ult", 3, false, 5), shot: at("ult", 3, false, 0.01), tip: !!g.getObjectByName("neon-hand-r-tip") };
    });
    assert.notDeepEqual(arms.throwBack.r, arms.throwOut.r, "the throw winds back and snaps out");
    assert.notDeepEqual(arms.run1.r, arms.run2.r, "sprinting pumps the arms");
    assert.notDeepEqual(arms.lane.r, arms.ult.r);
    assert.ok(arms.shot.charged > arms.ult.charged, "a shot lights the hand");
    assert.ok(arms.tip);
    // the real input path: E, then with forward held one click slides, never fires, gives the weapon back after 6 m
    await p.evaluate(() => {
      abilClear(); const a = myActor(); a.y = 0; a.yaw = 0; a.pitch = 0; a.weapons.primary = "rifle"; a.slot = "primary"; a.ammo.rifle = 30; a.fireCd = 0;
      for (const b of world.actors) if (b !== a) b.pos.set(80 + b.id * 3, 0, 80);
      let found = false;
      for (let x = MAP.bounds.minX + 10; x <= MAP.bounds.maxX - 10 && !found; x += 3) for (let z = MAP.bounds.minZ + 10; z <= MAP.bounds.maxZ - 10 && !found; z += 3) {
        let clear = true; for (let d = 0; d <= 8; d += 0.15) if (collideXZ(x, z - d, 0.45, 0.3)) { clear = false; break; }
        if (clear) { a.pos.set(x, 0, z); found = true; }
      }
      if (!found) throw new Error("No clear sliding lane");
      a.onGround = true; a.vel.set(0, 0, 0); a.abilities[1].cd = 0; a.abilities[1].charges = 1; world.phase = "live";
    });
    await p.keyboard.press("e"); await p.keyboard.down("w"); await p.mouse.down();
    const slide = await p.evaluate(() => {
      const a = myActor(), before = a.pos.clone(); a.input = gatherInput(); actorFire(a); tickViewmodel(0.016);
      const shown = !!VM.root.getObjectByName("neon-skill-arms")?.visible, started = a.__neonSlide > 0 && a.__neonGear === 0;
      for (let i = 0; i < 18 && a.__neonSlide > 0; i++) { world.phase = "live"; step(0.05); }
      const distance = a.pos.distanceTo(before); actorFire(a); tickViewmodel(0.016);
      return { started, shown, distance, ended: a.__neonSlide === 0, ammo: a.ammo.rifle, restored: VM.current.visible };
    });
    await p.keyboard.up("w"); await p.mouse.up();
    assert.ok(slide.started && slide.ended && slide.restored, JSON.stringify(slide));
    assert.ok(Math.abs(slide.distance - 6) < 0.15, JSON.stringify(slide)); assert.equal(slide.ammo, 30, "the slide click never fires");
    // the effects: the orb lays the lane, two walls with current, the bolt and its charge; all gone after
    const fx = await p.evaluate(() => {
      const a = myActor(); abilClear(); a.yaw = 0; CAST_EXT.neon_lane(); abilTick(0.2);
      const preview = !!scene.getObjectByName("neon-lane-preview"); abilTick(0.21); abilTick(0.6);
      const walls = scene.children.filter((n) => n.name === "neon-fastlane").length;
      render(); abilClear(); a.pitch = -0.35; CAST_EXT.neon_relay(); abilTick(0.36); // just launched: a wall beside the lane can end the flight within a few frames
      const bolt = !!scene.getObjectByName("neon-relaybolt");
      for (let i = 0; i < 30 && !scene.getObjectByName("neon-relay-charge"); i++) abilTick(0.01);
      const charge = !!scene.getObjectByName("neon-relay-charge"); abilTick(0.9); render();
      abilClear();
      return { preview, walls, bolt, charge, left: NEON_EFFECTS.active.size };
    });
    assert.deepEqual(fx, { preview: true, walls: fx.walls >= 2 ? fx.walls : -1, bolt: true, charge: true, left: 0 });
    // the ultimate: our arms, a shot from the right fingertips
    const ult = await p.evaluate(() => { const a = myActor(); a.pitch = 0; a.ultCharge = a.ultMax; CAST_EXT.neon_overdrive(); a.ultW.cd = 0; ultwFire(a); tickViewmodel(0.016); render(); return { arms: !!VM.current.userData.neonArms, clip: VM.current.userData.neonMotion?.clip }; });
    assert.deepEqual(ult, { arms: true, clip: "ult" });
    await p.screenshot({ path: "test-results/neon-look/ultimate.png" });
    assert.deepEqual(outside, [], "nothing fetched from the old outside files");
    assert.deepEqual(shaderErrors, []); assert.deepEqual(f.errors, []);
    console.log("Neon look: our icons, portrait, outfit, arms and motions, effects; real E/click slide; nothing outside fetched. Browser only.");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
