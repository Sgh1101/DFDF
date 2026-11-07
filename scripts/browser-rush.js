const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
// Rush (gun-model-smg.js) in a real match, after the gun was looked at in the armory, in first person (hip, aim,
// reload) and in other fighters' hands:
//  · the stock is collapsed in first person only; the third-person gun and the armory keep it extended
//  · the left hand holds the gun behind the handguard, clear of the front sight and the muzzle
//  · aiming puts the front post's tip on the screen centre, in the drum's peep hole
//  · a reload pulls the charging handle with the left hand, all the way back, and lets it home
//  · its first-person muzzle flash is at its muzzle; an old gun's stays where it was (the eye)
//  · its plain finish is its own seamless one (no tile border, no square flecks)
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("rush", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
    await p.evaluate(() => {
      titleCam = () => {}; room.map = "glacier"; room.mode = "std"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true;
      for (const o of world.actors) if (o !== player) o.silenced = 1e9;
      player.weapons.primary = "smg"; player.slot = "primary"; player.ammo.smg = 30; player.reloading = 0; updateViewmodel(true);
    });
    await p.waitForTimeout(600);
    const out = await p.evaluate(() => {
      const r = {};
      const stockZ = (g) => { let s = null; g.traverse((n) => n.name === "smg-stock" && (s = n)); return s ? s.position.z : null; };
      // the gun in my hands, and the same gun in someone else's
      const vm = VM.current;
      r.fpStock = stockZ(vm);
      r.tpStock = stockZ(GUN_SKINS.template("smg", GUN_SKINS.list[0]));
      r.rawStock = stockZ(GUN_BUILD.smg());
      r.thumb = GUN_SKINS.thumb("smg", "default").length;
      // where the hands are, in the gun's own frame
      const gun = (() => { let g = null; vm.traverse((n) => n.userData.weaponModel === "dfdf-smg" && (g = n)); return g; })();
      vm.updateMatrixWorld(true);
      const local = (v) => gun.worldToLocal(v.clone());
      const A = gun.userData.anchors;
      const rl = vm.userData.rl;
      const P0 = rl.P0 ? local(rl.P0.clone().applyMatrix4(vm.matrixWorld)) : null;
      r.left = P0 && P0.toArray();
      r.muzzleZ = A.muzzle[2];
      r.frontSightZ = A.sight[2];
      // aiming: the post's tip and the drum's hole centre on the screen centre
      keys.ads = true; player.ads = true;
      for (let i = 0; i < 40; i++) tickViewmodel(1 / 60);
      vm.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const ndc = (x, y, z) => gun.localToWorld(new T.Vector3(x, y, z)).project(camera);
      const post = ndc(...A.sight), hole = ndc(A.sight[0], A.sight[1], -0.405 + 0.45) // the drum's middle, 450 mm from the muzzle;
      r.post = [post.x * 640, post.y * 360];
      r.hole = [hole.x * 640, hole.y * 360];
      keys.ads = false; player.ads = false;
      for (let i = 0; i < 40; i++) tickViewmodel(1 / 60);
      // a reload, posed by hand: the left hand on the handle, the handle back
      player.ammo.smg = 0; player.reserve.smg = 999; actorReload(player);
      const D = player.reloading > 0 ? player.reloading : 2.4;
      const handle = rl.actions.find((a) => a.kind === "charge");
      const at = (k) => { player.reloading = D * (1 - k); tickViewmodel(1 / 60); vm.updateMatrixWorld(true); };
      at(0); at(0.2); at(0.5); // from the start: the reload measures its length from the first frame it sees
      at(0.638);
      const grip = gun.localToWorld(new T.Vector3(...handle.node.userData.reload.grip)).clone();
      const handGrip = handle.node.localToWorld(new T.Vector3(...handle.node.userData.reload.grip));
      r.handleBack = handle.node.position.z - handle.position.z;
      // the hand's own point: P0 moved by the left hand group's offset
      const hand = rl.P0.clone().add(rl.lh.position.clone().sub(rl.lh0)).applyMatrix4(vm.matrixWorld);
      r.handToHandle = hand.distanceTo(handGrip);
      r.handToRestHandle = hand.distanceTo(grip);
      player.reloading = 0; tickViewmodel(1 / 60);
      r.handleRest = Math.abs(handle.node.position.z - handle.position.z);
      // the flash: mine at the muzzle, an old gun's at the eye
      const lit = () => { const before = FX_LIGHTS.map((l) => l.position.clone()); muzzleFlash(); const l = FX_LIGHTS.find((x, i) => !x.position.equals(before[i])); return l ? l.position.clone() : null; };
      const eye = () => new T.Vector3(player.pos.x, player.y + eyeHeight(), player.pos.z);
      tickViewmodel(1 / 60);
      const mz = GUN_FP_FLASH.muzzle(), l1 = lit();
      r.flash = { toMuzzle: l1.distanceTo(mz), fromCamera: l1.distanceTo(camera.position) };
      // a shot fired before this frame's viewmodel pose (the camera has moved on): still at the muzzle as drawn this frame
      camera.position.x += 0.3; const l3 = lit(); tickViewmodel(1 / 60); vm.updateMatrixWorld(true);
      r.flash.afterMove = l3.distanceTo(gun.localToWorld(new T.Vector3(...A.muzzle)));
      player.weapons.primary = "burst"; player.ammo.burst = 30; updateViewmodel(true); tickViewmodel(1 / 60);
      const l2 = lit();
      r.oldFlash = { fromEye: l2.distanceTo(eye()), muzzle: GUN_FP_FLASH.muzzle() };
      player.weapons.primary = "smg"; updateViewmodel(true);
      // the finish
      const shared = GUNMAT.steel().map;
      let own = 0, sharedUsed = 0;
      GUN_BUILD.smg().traverse((n) => { if (!n.isMesh || !n.material.map) return; n.material.map === shared ? sharedUsed++ : own++; });
      r.finish = { own, sharedUsed };
      return r;
    });
    console.log(JSON.stringify(out));
    assert.ok(out.rawStock === 0 && out.tpStock === 0, "the stock is extended in the armory build and other fighters' hands " + JSON.stringify(out));
    assert.ok(out.fpStock < -0.15, "the stock is collapsed in first person " + out.fpStock);
    assert.ok(out.thumb > 1000, "the armory thumbnail renders");
    assert.ok(out.left && out.left[2] > out.frontSightZ + 0.15, "the left hand is well behind the front sight " + JSON.stringify(out.left));
    assert.ok(Math.hypot(...out.post) < 3, "aiming puts the post's tip on the screen centre " + JSON.stringify(out.post));
    assert.ok(Math.hypot(out.hole[0] - out.post[0], out.hole[1] - out.post[1]) < 1.5, "the drum's peep hole is round the post " + JSON.stringify(out));
    assert.ok(out.handleBack > 0.09, "the reload pulls the charging handle back " + out.handleBack);
    assert.ok(out.handToHandle < 0.03, "the left hand is on the handle " + out.handToHandle);
    assert.ok(out.handleRest < 1e-9, "the handle is home after the reload");
    assert.ok(out.flash.toMuzzle < 1e-6 && out.flash.fromCamera > 0.5 && out.flash.fromCamera < 2 && out.flash.afterMove < 0.02, "the first-person flash is at the muzzle " + JSON.stringify(out.flash));
    assert.ok(out.oldFlash.fromEye < 1e-6 && out.oldFlash.muzzle === null, "an old gun keeps the flash at the eye " + JSON.stringify(out.oldFlash));
    assert.ok(out.finish.own > 5 && out.finish.sharedUsed === 0, "the plain finish is the gun's own " + JSON.stringify(out.finish));
    const dir = process.env.DFDF_SCREENSHOT_DIR || "test-results"; fs.mkdirSync(dir, { recursive: true });
    await p.screenshot({ path: path.join(dir, "rush-first-person.png") });
    assert.deepEqual(f.errors, []);
    console.log("rush: stock collapsed only in first person, hand clear of the sights, post in the peep hole, the handle pulled in a reload, the flash at the muzzle");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
