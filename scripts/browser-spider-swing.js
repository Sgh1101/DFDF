const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The spider's web swing (E): both hands fire and the tips take a moment to land, the body swings on the rope in an
// arc that gathers speed (not a straight line at one speed), the rope is drawn and taken away again, the picture of
// the one swinging widens and leans and comes back, a jump lets go and keeps the speed, the motion setting turns the
// camera effects off, a cast at nothing gives the charge back, and nothing is left in the scene afterwards.
// The world is stepped by hand (the headless browser draws too slowly for real time to mean anything).
(async () => {
  const f = await fixture();
  const errors = [];
  try {
    const page = await f.page("spiderswing", { width: 1280, height: 720 });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.mouse.click(640, 360);
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS.find((a) => "geomi" === a.id), false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const out = {}, me = myActor() || player, def = AGENTS.find((a) => "geomi" === a.id).abilities.find((a) => "y_webzip" === a.type);
      const dt = 1 / 60, step = (n) => { for (let i = 0; i < n; i++) { abilTick(dt); simMove(me, dt); followCamera(me, dt); } };
      const ropes = () => scene.children.filter((o) => o.userData && o.userData.radius && o.material && o.material.color.getHex() === 0xf2f4f7).length;
      let aim = null;
      // a point on the side of a wall (the wall goes on above it), not on top of something
      for (let yaw = 0; yaw < 6.28 && !aim; yaw += 0.1) { me.yaw = yaw; me.pitch = 0.3; const a = aimPoint(48); if (a && a.hit && (a.y || 0) > 2) { const d = Math.hypot(a.x - me.pos.x, a.z - me.pos.z), ux = (a.x - me.pos.x) / d, uz = (a.z - me.pos.z) / d; if (d > 18 && d < 40 && blockerTopAt(a.x + ux * 0.35, a.z + uz * 0.35, 0, 0.1) > a.y + 0.6) aim = { yaw, d }; } }
      out.aimed = !!aim;
      const home = [me.pos.x, me.y, me.pos.z], fov0 = viewFOV.now;
      const reset = () => { me.pos.x = home[0]; me.pos.z = home[2]; me.y = home[1]; me.vy = 0; me.__carry = null; me.__hangY = null; me.__climbT = 0; };
      const cast = () => { me.yaw = aim.yaw; me.pitch = 0.3; CAST_REFUND = false; castAbility("y_webzip", def); const x = CAST_REFUND; CAST_REFUND = false; return x; };
      const ropes0 = ropes();
      out.refunded = cast();
      const S = me.__swing;
      out.hasSwing = !!S && !S.done;
      out.ropes = ropes() - ropes0;
      // the tips fly first: nothing moves for the first moments
      step(6); out.heldAtFirst = Math.hypot(me.pos.x - home[0], me.pos.z - home[2]) < 0.05;
      const tr = [];
      let fovMax = 0, rollMax = 0, streak = 0;
      for (let i = 0; i < 400 && !S.done; i++) {
        step(1);
        fovMax = Math.max(fovMax, camera.fov - fov0); rollMax = Math.max(rollMax, Math.abs(camera.rotation.z));
        const el = document.getElementById("swing-fx"); el && (streak = Math.max(streak, +el.style.opacity || 0));
        tr.push({ x: me.pos.x, y: me.y, z: me.pos.z, s: S.speed || 0 });
      }
      out.ended = !!S.done;
      const a1 = tr[tr.length - 1], dx = a1.x - home[0], dy = a1.y - home[1], dz = a1.z - home[2], L = Math.hypot(dx, dy, dz) || 1;
      let dev = 0;
      for (const p of tr) { const px = p.x - home[0], py = p.y - home[1], pz = p.z - home[2], k = (px * dx + py * dy + pz * dz) / (L * L); dev = Math.max(dev, Math.hypot(px - dx * k, py - dy * k, pz - dz * k)); }
      out.dev = dev; out.moved = Math.hypot(dx, dz);
      const sp = tr.map((p) => p.s).filter((v) => v > 0);
      out.first = sp[0]; out.peak = Math.max(...sp); out.last = sp[sp.length - 1];
      out.fovMax = fovMax; out.rollMax = rollMax; out.streak = streak;
      step(90);
      out.fovAfter = Math.abs(camera.fov - fov0);
      out.ropesAfter = ropes() - ropes0;
      out.hung = me.__hangY != null;
      // let go with a jump: the speed goes on and the body does not stop at once
      reset(); step(30);
      cast(); step(42);
      me.input.btn |= BTN.JUMP; step(2); me.input.btn &= ~BTN.JUMP;
      const p0 = [me.pos.x, me.pos.z]; step(18);
      out.letGo = !!me.__swing.done;
      out.carried = Math.hypot(me.pos.x - p0[0], me.pos.z - p0[1]);
      step(200);
      // the motion setting off: no widening, no lean
      reset(); step(30);
      const motion = SETTINGS.motion; SETTINGS.motion = 0;
      let wide = 0, lean = 0; cast();
      for (let i = 0; i < 60; i++) { step(1); wide = Math.max(wide, camera.fov - fov0); lean = Math.max(lean, Math.abs(camera.rotation.z)); }
      SETTINGS.motion = motion; out.noWiden = wide; out.noLean = lean;
      step(200);
      // a cast at nothing: the charge comes back, and the strands go
      reset(); step(30);
      me.pitch = 1.4; CAST_REFUND = false; castAbility("y_webzip", def); out.missRefund = CAST_REFUND; CAST_REFUND = false;
      step(120);
      out.leftover = ropes() - ropes0;
      return out;
    });
    console.log(JSON.stringify(r));
    assert.ok(r.aimed && r.hasSwing && !r.refunded, "a cast at a wall holds and keeps its charge");
    assert.equal(r.ropes, 4, "two hands, two strands each");
    assert.ok(r.heldAtFirst, "the body waits while the tips fly");
    assert.ok(r.ended && r.moved > 5, "the body goes toward the wall");
    assert.ok(r.dev > 0.5, "the way there is an arc, not a straight line (" + r.dev.toFixed(2) + " m off it)");
    assert.ok(r.peak > r.first * 2.5, "the speed gathers, it does not start at its top (" + r.first.toFixed(1) + " -> " + r.peak.toFixed(1) + " m/s)");
    assert.ok(r.peak > 14 && r.peak < 48, "fast, but not absurd (" + r.peak.toFixed(1) + " m/s)");
    assert.ok(r.fovMax > 2 && r.fovMax < 14, "the view widens a little (" + r.fovMax.toFixed(1) + " deg)");
    assert.ok(r.rollMax > 0.006 && r.rollMax < 0.2, "it leans and sways, not much (" + r.rollMax.toFixed(3) + ")");
    assert.ok(r.streak > 0.05, "speed lines come in");
    assert.ok(r.fovAfter < 1, "the view comes back");
    assert.equal(r.ropesAfter, 0, "the strands are taken away afterwards");
    assert.ok(r.hung, "arriving at a wall above the floor hangs on it, as before");
    assert.ok(r.letGo && r.carried > 1.2, "a jump lets go and the speed goes on (" + r.carried.toFixed(1) + " m)");
    assert.ok(r.noWiden < 0.3 && r.noLean < 0.006, "the motion setting off keeps the view still");
    assert.ok(r.missRefund, "a cast at nothing gives the charge back");
    assert.equal(r.leftover, 0, "nothing is left behind");
    assert.deepEqual(errors, [], "no page errors");
    console.log("Spider swing: two hands, tips that fly and land, an arc that gathers speed, a view that widens and leans and comes back, let-go keeps the speed, motion setting honoured, miss refunded, scene clean");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
