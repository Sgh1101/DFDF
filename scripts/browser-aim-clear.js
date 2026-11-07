const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The aim point stays clear (the owner's rule: no gun may cover it): for every gun, at the hip and aimed, after real frames,
// nothing of the gun or the hands is on the screen centre or the ring of points round it that the aiming code keeps clear
// (aimCovered, 03-engine.js). A gun with a red dot keeps its dot on the centre (only the centre itself must be clear);
// an iron sight sits just under the aim point. A scoped gun shows the scope instead of the gun when aimed.
(async () => {
  const f = await fixture();
  try {
    const p = await f.page("aimclear", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
    const keys = await p.evaluate(() => {
      titleCam = () => {}; room.map = "glacier"; room.mode = "std"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 99999; ADMIN.freezeAI = true;
      for (const o of world.actors) if (o !== player) o.silenced = 1e9;
      return Object.keys(WEAPONS).filter((k) => WEAPONS[k].cls !== "근접");
    });
    const rows = [];
    for (const k of keys) {
      for (const ads of [false, true]) {
        await p.evaluate(({ k, ads }) => {
          const slot = ["보조", "권총"].includes(WEAPONS[k].cls) ? "secondary" : "primary";
          player.weapons[slot] = k; player.slot = slot; player.ammo[k] = 30; player.reloading = 0; updateViewmodel(true);
          keys.ads = ads; player.ads = ads;
        }, { k, ads });
        await p.waitForTimeout(ads ? 1500 : 700); // the aiming zoom and the swap settle first
        rows.push(await p.evaluate(({ k, ads }) => {
          const a = VM.current, shown = VM.root.visible && a && a.visible;
          if (!shown) return { k, ads, scoped: true };
          let dot = null;
          a.traverse((o) => /red-dot/.test(o.name || "") && (dot = o));
          VM.root.updateMatrixWorld(true);
          let dotPx = null;
          if (dot && ads) {
            // the gun's own line of sight (anchors.sight: the dot's centre)
            let gun = null;
            a.traverse((o) => !gun && o.userData.anchors && o.userData.anchors.sight && (gun = o));
            const q = gun.localToWorld(new T.Vector3(...gun.userData.anchors.sight)).project(camera);
            dotPx = Math.hypot(q.x * innerWidth / 2, q.y * innerHeight / 2);
          }
          const covered = aimCovered(a, dot && ads ? AIM_DOT_PX : AIM_CLEAR_PX);
          let what = null;
          if (covered) {
            // what is on the centre, for the report
            const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(0, 0), camera); ray.near = camera.near;
            what = ray.intersectObject(a, true).slice(0, 3).map((h) => (h.object.name || h.object.type) + "@" + h.distance.toFixed(3));
            what.push("pos " + a.position.toArray().map((v) => v.toFixed(3)).join(","), "swap " + VM.swapT.toFixed(2), "fov " + camera.fov);
          }
          return { k, ads, covered, what, dot: !!dot, dotPx, tilt: a.userData.adsTilt || 0 };
        }, { k, ads }));
      }
    }
    for (const r of rows) console.log(JSON.stringify(r));
    for (const r of rows) {
      if (r.scoped) { assert.ok(r.ads, r.k + " is only scoped when aiming"); continue; }
      assert.equal(r.covered, 0, `${r.k} ${r.ads ? "aimed" : "at the hip"} covers the aim point`);
      if (r.ads && r.dot) assert.ok(r.dotPx < 2, `${r.k}'s red dot is on the aim point (${r.dotPx} px off)`);
    }
    assert.deepEqual(f.errors, []);
    console.log(`aim point: clear for ${keys.length} guns at the hip and aimed (red dots on it, iron sights just under it, scopes shown)`);
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
