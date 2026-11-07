const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
// Veil (whisper, gun-model-smg.js): the integrally suppressed 9 mm, in a real match, in first person (hip, aim, reload),
// in other fighters' hands and in the armory:
//  · its own model (not Rush's): a can over the whole front, a red dot, no drum rear sight, an olive-drab receiver
//  · the stock is collapsed in first person only; the third-person gun and the armory keep it extended
//  · the left hand holds the gun behind the can (at the magazine well), clear of the sights, the can and the muzzle
//  · aiming puts the red dot on the screen centre, inside the optic's window, with the front post below it
//  · a reload pulls the charging handle with the left hand, all the way back, and lets it home
//  · its first-person flash is at its muzzle, and smaller and dimmer than Rush's
//  · its plain finish is its own seamless one (no tile border, no square flecks)
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("veil", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
    await p.evaluate(() => {
      titleCam = () => {}; room.map = "glacier"; room.mode = "std"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true;
      for (const o of world.actors) if (o !== player) o.silenced = 1e9;
      player.weapons.primary = "whisper"; player.slot = "primary"; player.ammo.whisper = 30; player.reloading = 0; updateViewmodel(true);
    });
    await p.waitForTimeout(600);
    const dir = process.env.DFDF_SCREENSHOT_DIR || "test-results"; fs.mkdirSync(dir, { recursive: true });
    await p.screenshot({ path: path.join(dir, "veil-first-person.png") });
    const out = await p.evaluate(() => {
      const r = {}, W = window.GUN_MODEL_WHISPER;
      const named = (g, name) => { let s = null; g.traverse((n) => n.name === name && (s = n)); return s; };
      const vm = VM.current;
      const gun = (() => { let g = null; vm.traverse((n) => n.userData.weaponModel === "dfdf-whisper" && (g = n)); return g; })();
      r.model = gun ? gun.userData.weaponModel : null;
      r.fpStock = named(vm, "whisper-stock").position.z;
      r.tpStock = named(GUN_SKINS.template("whisper", GUN_SKINS.list[0]), "whisper-stock").position.z;
      r.rawStock = named(GUN_BUILD.whisper(), "whisper-stock").position.z;
      r.thumb = GUN_SKINS.thumb("whisper", "default").length;
      const raw = GUN_BUILD.whisper(), rush = GUN_BUILD.smg();
      r.parts = { can: !!named(raw, "whisper-can"), optic: !!named(raw, "whisper-optic"), dot: !!named(raw, "whisper-red-dot"), drum: !!named(raw, "smg-rear-drum") || !!named(raw, "whisper-rear-drum"), meshes: 0 };
      raw.traverse((n) => n.isMesh && r.parts.meshes++);
      r.colors = { veil: named(raw, "whisper-receiver").material.color.getHexString(), rush: named(rush, "smg-receiver").material.color.getHexString() };
      // where the left hand is, in the gun's own frame
      vm.updateMatrixWorld(true);
      const local = (v) => gun.worldToLocal(v.clone());
      const A = gun.userData.anchors, rl = vm.userData.rl;
      r.left = rl.P0 ? local(rl.P0.clone().applyMatrix4(vm.matrixWorld)).toArray() : null;
      r.canRear = W.canRear; r.boreY = A.muzzle[1];
      // aiming
      keys.ads = true; player.ads = true;
      for (let i = 0; i < 40; i++) tickViewmodel(1 / 60);
      vm.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const px = (v) => { const q = gun.localToWorld(v.clone()).project(camera); return [q.x * 640, q.y * 360]; };
      r.dot = px(new T.Vector3(...A.sight));
      r.post = px(new T.Vector3(...W.post));
      const w0 = px(new T.Vector3(...W.window.at)), w1 = px(new T.Vector3(W.window.at[0] + W.window.r, W.window.at[1], W.window.at[2]));
      r.window = { centre: w0, r: Math.hypot(w1[0] - w0[0], w1[1] - w0[1]) };
      return r;
    });
    await p.screenshot({ path: path.join(dir, "veil-aim.png") });
    const out2 = await p.evaluate(() => {
      const r = {};
      const vm = VM.current, rl = vm.userData.rl;
      const gun = (() => { let g = null; vm.traverse((n) => n.userData.weaponModel === "dfdf-whisper" && (g = n)); return g; })();
      keys.ads = false; player.ads = false;
      for (let i = 0; i < 40; i++) tickViewmodel(1 / 60);
      // a reload, posed by hand: the left hand on the handle, the handle back
      player.ammo.whisper = 0; player.reserve.whisper = 999; actorReload(player);
      const D = player.reloading > 0 ? player.reloading : 2.4;
      const handle = rl.actions.find((a) => a.kind === "charge");
      const at = (k) => { player.reloading = D * (1 - k); tickViewmodel(1 / 60); vm.updateMatrixWorld(true); };
      at(0); at(0.2); at(0.5); at(0.638);
      const handGrip = handle.node.localToWorld(new T.Vector3(...handle.node.userData.reload.grip));
      r.handleBack = handle.node.position.z - handle.position.z;
      const hand = rl.P0.clone().add(rl.lh.position.clone().sub(rl.lh0)).applyMatrix4(vm.matrixWorld);
      r.handToHandle = hand.distanceTo(handGrip);
      player.reloading = 0; tickViewmodel(1 / 60);
      r.handleRest = Math.abs(handle.node.position.z - handle.position.z);
      // the flash: at the muzzle, smaller than Rush's
      const lit = () => { const before = FX_LIGHTS.map((l) => l.position.clone()); muzzleFlash(); const l = FX_LIGHTS.find((x, i) => !x.position.equals(before[i])); return l || null; };
      tickViewmodel(1 / 60);
      const mz = GUN_FP_FLASH.muzzle(), l1 = lit();
      r.flash = { toMuzzle: l1.position.distanceTo(mz), quiet: !!mz.quiet, intensity: l1.intensity };
      player.weapons.primary = "smg"; player.ammo.smg = 30; updateViewmodel(true); tickViewmodel(1 / 60);
      const l2 = lit();
      r.rushFlash = { quiet: !!GUN_FP_FLASH.muzzle().quiet, intensity: l2.intensity };
      player.weapons.primary = "whisper"; updateViewmodel(true);
      // the finish
      const shared = GUNMAT.steel().map;
      let own = 0, sharedUsed = 0;
      GUN_BUILD.whisper().traverse((n) => { if (!n.isMesh || !n.material.map) return; n.material.map === shared ? sharedUsed++ : own++; });
      r.finish = { own, sharedUsed };
      return r;
    });
    Object.assign(out, out2);
    console.log(JSON.stringify(out));
    assert.equal(out.model, "dfdf-whisper", "Veil has its own model");
    assert.ok(out.parts.can && out.parts.optic && out.parts.dot && !out.parts.drum, "a can, a red dot and no drum rear sight " + JSON.stringify(out.parts));
    assert.ok(out.parts.meshes <= 30, "a reasonable number of meshes " + out.parts.meshes);
    assert.notEqual(out.colors.veil, out.colors.rush, "a finish of its own, not Rush's grey");
    assert.ok(out.rawStock === 0 && out.tpStock === 0, "the stock is extended in the armory build and other fighters' hands");
    assert.ok(out.fpStock < -0.15, "the stock is collapsed in first person " + out.fpStock);
    assert.ok(out.thumb > 1000, "the armory thumbnail renders");
    assert.ok(out.left && out.left[2] > out.canRear + 0.002 && out.left[1] < out.boreY, "the left hand is behind the can and below the bore " + JSON.stringify([out.left, out.canRear]));
    assert.ok(Math.hypot(...out.dot) < 3, "aiming puts the red dot on the screen centre " + JSON.stringify(out.dot));
    assert.ok(out.window.r > 5 && Math.hypot(out.window.centre[0] - out.dot[0], out.window.centre[1] - out.dot[1]) < 2, "the dot is in the middle of the optic's window " + JSON.stringify(out.window));
    assert.ok(out.post[1] < out.dot[1] - 4 && Math.abs(out.post[0] - out.dot[0]) < 2 && Math.hypot(out.post[0] - out.dot[0], out.post[1] - out.dot[1]) < out.window.r, "the front post shows below the dot, in the window " + JSON.stringify(out.post));
    assert.ok(out.handleBack > 0.09, "the reload pulls the charging handle back " + out.handleBack);
    assert.ok(out.handToHandle < 0.03, "the left hand is on the handle " + out.handToHandle);
    assert.ok(out.handleRest < 1e-9, "the handle is home after the reload");
    assert.ok(out.flash.toMuzzle < 1e-6 && out.flash.quiet && !out.rushFlash.quiet && out.flash.intensity < out.rushFlash.intensity / 2, "the first-person flash is at the muzzle, dimmer than Rush's " + JSON.stringify([out.flash, out.rushFlash]));
    assert.ok(out.finish.own > 5 && out.finish.sharedUsed === 0, "the plain finish is the gun's own " + JSON.stringify(out.finish));
    assert.deepEqual(f.errors, []);
    console.log("veil: its own suppressed model with a red dot, stock collapsed only in first person, hand behind the can, the dot on the screen centre with the post below it, the handle pulled in a reload, a small flash at the muzzle");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
