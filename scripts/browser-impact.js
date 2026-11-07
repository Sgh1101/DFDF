const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
// Impact (shotgun, gun-model-shotgun.js): the 12-gauge pump gun, in a real match, in first person (hip, aim, a shot,
// a reload), in other fighters' hands and in the armory:
//  · its own model, one moving part (the pump), a bead on the barrel, a flat receiver top
//  · the left hand holds the fore-end, under the barrel, clear of the bead and the muzzle
//  · aiming puts the bead's top on the screen centre, with the receiver's top just below it
//  · after a shot the fore-end goes back and forward again, and the left hand goes with it
//  · a reload ends with the pump: the fore-end goes all the way back with the hand and home again
//  · its first-person muzzle flash is at its muzzle; its plain finish is its own (no tile border, no square flecks)
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("impact", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
    await p.evaluate(() => {
      titleCam = () => {}; room.map = "glacier"; room.mode = "std"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true;
      for (const o of world.actors) if (o !== player) o.silenced = 1e9;
      player.weapons.primary = "shotgun"; player.slot = "primary"; player.ammo.shotgun = 8; player.reloading = 0; updateViewmodel(true);
    });
    await p.waitForTimeout(600);
    const dir = process.env.DFDF_SCREENSHOT_DIR || "test-results"; fs.mkdirSync(dir, { recursive: true });
    await p.screenshot({ path: path.join(dir, "impact-first-person.png") });
    const out = await p.evaluate(() => {
      const r = {}, W = window.GUN_MODEL_SHOTGUN;
      const vm = VM.current, rl = vm.userData.rl;
      const gun = (() => { let g = null; vm.traverse((n) => n.userData.weaponModel === "dfdf-shotgun" && (g = n)); return g; })();
      r.model = gun ? gun.userData.weaponModel : null;
      r.actions = rl.actions.map((a) => a.kind);
      r.thumb = GUN_SKINS.thumb("shotgun", "default").length;
      let meshes = 0; GUN_BUILD.shotgun().traverse((n) => n.isMesh && meshes++); r.meshes = meshes;
      r.thirdPerson = !!GUN_SKINS.template("shotgun", GUN_SKINS.list[0]);
      const has = (g, name) => { let s = false; g.traverse((n) => n.name === name && (s = true)); return s; };
      r.stock = { fp: has(vm, "shotgun-stock"), fpWrist: has(vm, "shotgun-wrist"), tp: has(GUN_SKINS.template("shotgun", GUN_SKINS.list[0]), "shotgun-stock-full"), fpGroup: has(vm, "shotgun-stock-full") };
      vm.updateMatrixWorld(true);
      const local = (v) => gun.worldToLocal(v.clone());
      const A = gun.userData.anchors;
      r.left = local(rl.P0.clone().applyMatrix4(vm.matrixWorld)).toArray();
      r.foreEnd = W.foreEnd; r.boreY = A.muzzle[1];
      // aiming
      keys.ads = true; player.ads = true;
      for (let i = 0; i < 40; i++) tickViewmodel(1 / 60);
      vm.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const px = (v) => { const q = gun.localToWorld(new T.Vector3(...v)).project(camera); return [q.x * 640, q.y * 360]; };
      r.bead = px(A.sight); r.top = px(W.receiverTop);
      // the aiming view below the bead: what of the gun is under each point straight down the middle
      const ray = new T.Raycaster();
      r.below = [-0.15, -0.3, -0.45, -0.6].map((y) => { ray.setFromCamera(new T.Vector2(0, y), camera); return ray.intersectObject(gun, true).length > 0; });
      return r;
    });
    await p.screenshot({ path: path.join(dir, "impact-aim.png") });
    const out2 = await p.evaluate(() => {
      const r = {};
      const vm = VM.current, rl = vm.userData.rl, pump = rl.actions.find((a) => a.kind === "pump");
      keys.ads = false; player.ads = false;
      for (let i = 0; i < 40; i++) tickViewmodel(1 / 60);
      // the hand's point (P0 moved by the left hand group's offset) and the fore-end's, in the viewmodel's frame
      const hand = () => rl.P0.clone().add(rl.lh.position.clone().sub(rl.lh0));
      const fe = () => { vm.updateMatrixWorld(true); return vm.worldToLocal(pump.node.localToWorld(new T.Vector3())); };
      tickViewmodel(1 / 60);
      const gap0 = hand().sub(fe());
      // a shot: half-way through the kick the fore-end is all the way back
      VM.kick = 0.85 * 0.5; tickViewmodel(0);
      r.shotBack = pump.node.position.z - pump.position.z;
      r.shotGap = hand().sub(fe()).distanceTo(gap0);
      VM.kick = 0; tickViewmodel(1 / 60);
      r.shotRest = Math.abs(pump.node.position.z - pump.position.z);
      // a reload, posed by hand: the pump at its end
      player.ammo.shotgun = 0; player.reserve.shotgun = 99; actorReload(player);
      const D = player.reloading > 0 ? player.reloading : 2.4;
      const at = (k) => { player.reloading = D * (1 - k); tickViewmodel(1 / 60); };
      at(0); at(0.3); at(0.6); at(0.8); at(0.9);
      r.reloadBack = pump.node.position.z - pump.position.z;
      r.reloadGap = hand().sub(fe()).distanceTo(gap0);
      at(0.99); player.reloading = 0; tickViewmodel(1 / 60);
      r.reloadRest = Math.abs(pump.node.position.z - pump.position.z);
      // the flash at the muzzle
      const lit = () => { const before = FX_LIGHTS.map((l) => l.position.clone()); muzzleFlash(); const l = FX_LIGHTS.find((x, i) => !x.position.equals(before[i])); return l ? l.position.clone() : null; };
      tickViewmodel(1 / 60);
      const mz = GUN_FP_FLASH.muzzle(), l1 = lit();
      r.flash = { toMuzzle: l1.distanceTo(mz), quiet: !!mz.quiet };
      const shared = GUNMAT.steel().map;
      let own = 0, sharedUsed = 0;
      GUN_BUILD.shotgun().traverse((n) => { if (!n.isMesh || !n.material.map) return; n.material.map === shared ? sharedUsed++ : own++; });
      r.finish = { own, sharedUsed };
      return r;
    });
    Object.assign(out, out2);
    console.log(JSON.stringify(out));
    assert.equal(out.model, "dfdf-shotgun", "Impact has its own model");
    assert.deepEqual(out.actions, ["pump"], "one moving part: the pump");
    assert.ok(out.meshes <= 30 && out.thumb > 1000 && out.thirdPerson, "a bounded model, a thumbnail and a world template " + out.meshes);
    assert.ok(out.left[2] > out.foreEnd[0] && out.left[2] < out.foreEnd[1] + 0.02 && out.left[1] < out.boreY, "the left hand is on the fore-end, under the barrel " + JSON.stringify([out.left, out.foreEnd]));
    assert.ok(Math.hypot(...out.bead) < 3, "aiming puts the bead on the screen centre " + JSON.stringify(out.bead));
    assert.ok(out.top[1] < out.bead[1] && out.bead[1] - out.top[1] < 40 && Math.abs(out.top[0]) < 2, "the receiver's top shows just below the bead " + JSON.stringify(out.top));
    assert.ok(!out.stock.fp && !out.stock.fpGroup && out.stock.fpWrist && out.stock.tp, "the whole stock is left out of first person (the wrist stays), and kept elsewhere " + JSON.stringify(out.stock));
    assert.ok(out.below.filter(Boolean).length <= 1, "the aiming view below the bead is clear of the stock " + JSON.stringify(out.below));
    assert.ok(out.shotBack > 0.08, "after a shot the fore-end goes back " + out.shotBack);
    assert.ok(out.shotGap < 0.006, "and the left hand goes with it " + out.shotGap);
    assert.ok(out.shotRest < 1e-9, "the fore-end is home again");
    assert.ok(out.reloadBack > 0.08 && out.reloadGap < 0.01, "the reload ends with the pump, the hand on the fore-end " + JSON.stringify([out.reloadBack, out.reloadGap]));
    assert.ok(out.reloadRest < 1e-9, "the fore-end is home after the reload");
    assert.ok(out.flash.toMuzzle < 1e-6 && !out.flash.quiet, "the first-person flash is at the muzzle " + JSON.stringify(out.flash));
    assert.ok(out.finish.own > 5 && out.finish.sharedUsed === 0, "the plain finish is the gun's own " + JSON.stringify(out.finish));
    assert.deepEqual(f.errors, []);
    console.log("impact: its own pump gun, the hand on the fore-end, the bead on the screen centre over the receiver, the pump worked after a shot and at the end of a reload with the hand on it, the flash at the muzzle");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
