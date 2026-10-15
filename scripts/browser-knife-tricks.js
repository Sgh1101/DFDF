const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Every knife turns on a pivot in the hand: during a spin the knife's tip moves round the
// grip while the hand and the arm stay where they are.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("knifer");
    const out = await page.evaluate(async () => {
      titleCam = () => {};
      room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true;
      const me = myActor(), skins = window.GUN_SKINS, of0 = skins.of, res = {};
      const list = ["", "butterfly", "karambit", "flip", "tanto", "kukri"];
      for (const id of list) {
        const sk = id ? SKIN_LIST_FIND(id) : null;
        skins.of = (k, ...r) => (k === "knife" ? sk || { id: "default", rar: 4 } : of0.call(skins, k, ...r));
        for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k];
        player.weapons.melee = player.weapons.melee || "knife";
        const slot = Object.keys(player.weapons).find((s) => player.weapons[s] === "knife");
        player.slot = slot;
        updateViewmodel(true);
        const a = VM.current, pv = KNIFE_PIVOT.of(a);
        if (!pv) { res[id || "default"] = { pivot: false }; continue; }
        // where the hand and the knife's farthest point are, at rest and half way through a spin
        const where = () => {
          a.updateMatrixWorld(true);
          let hand = null, tip = null, far = -1;
          const g = new THREE.Vector3(); pv.getWorldPosition(g);
          // the arm: everything not on the pivot (baked together by now)
          const inPv = new Set(); pv.traverse((x) => inPv.add(x));
          const box = new THREE.Box3();
          a.traverse((x) => { if (x.isMesh && !inPv.has(x)) box.expandByObject(x); });
          hand = box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
          pv.traverse((x) => { if (!x.isMesh) return; x.geometry.computeBoundingBox(); const c = x.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(x.matrixWorld); const d = c.distanceTo(g); d > far && ((far = d), (tip = c)); });
          return { hand, tip };
        };
        const r0 = where();
        pv.rotation.x += Math.PI; // half a turn on the pivot
        const r1 = where();
        pv.rotation.x -= Math.PI;
        const armInPivot = []; pv.traverse((x) => x.userData && x.userData.armPart && armInPivot.push(x.name || x.type));
        let liveAll = true; pv.traverse((x) => x.isMesh && !x.userData.live && (liveAll = false));
        res[id || "default"] = { pivot: true, gripFound: !!pv.userData.hand, pivotToHand: null, handMoved: r0.hand && r1.hand ? +r0.hand.distanceTo(r1.hand).toFixed(4) : null, tipMoved: +r0.tip.distanceTo(r1.tip).toFixed(3), armInPivot: armInPivot.length, liveAll };
      }
      skins.of = of0;
      // the inspect runs each trick without an error, and the frame after starts straight again
      SKIN_PERKS.state.insp.t = 1.2; tickViewmodel(0.016);
      const pv = KNIFE_PIVOT.of(VM.current); updateViewmodel(false);
      res.reset = pv ? pv.rotation.x === 0 && pv.rotation.y === 0 : null;
      return res;
      function SKIN_LIST_FIND(id) { const L = skins.skinsFor ? skins.skinsFor("knife") : []; return L.find((s) => s.id === id) || { id, model: id, rar: 4 }; }
    });
    console.log(JSON.stringify(out));
    for (const k of ["default", "butterfly", "karambit", "flip", "tanto", "kukri"]) {
      const r = out[k];
      assert.ok(r && r.pivot, k + " has a pivot");
      assert.ok(r.handMoved !== null && r.handMoved < 0.001, k + ": the hand stays (" + r.handMoved + ")");
      assert.ok(r.tipMoved > 0.05, k + ": the knife turns (" + r.tipMoved + ")");
      assert.equal(r.armInPivot, 0, k + ": no arm on the pivot");
      assert.equal(r.liveAll, true, k + ": the knife is kept out of the bake");
      assert.equal(r.gripFound, true, k + ": the pivot sits on the hand");
    }
    assert.equal(out.reset, true);
    assert.deepEqual(f.errors, []);
    console.log("knife tricks: every knife turns on its own pivot, hand and arm stay");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
