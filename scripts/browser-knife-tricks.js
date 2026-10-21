const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Each knife turns on its own pivot while the hand and arm stay: the karambit on its ring
// (with light trails), the rest on the grip; every inspect is a trick that ends as it began.
(async () => {
  const f = await fixture();
  try {
    await f.h.api('auth',{id:'knifer',pw:'password',device:'browser-test-knifer'});
    const owner=await f.h.api('auth',{id:'owner',pw:'owner-password',device:'knife-owner'});
    for(const id of ['tanto','kukri','flip','karambit','butterfly','bayonet','gut','bowie','kunai','stiletto'])await f.h.api('a_user_set',{atoken:owner.atoken,id:'knifer',op:'grant',item:'knife|'+id});
    const page = await f.page("knifer");
    await page.waitForFunction(()=>VALORANT_PACK.status==='ready'&&CHAMPIONS_PHANTOM.loaded(),null,{timeout:120000});
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; player.ultW=null;player.slot=Object.keys(player.weapons).find(s=>player.weapons[s]==='knife');updateViewmodel(true); });
    await page.waitForFunction(()=>myActor()?.alive&&curWeaponKey()==='knife'&&VM.current?.userData.key==='knife');
    const out = await page.evaluate(() => {
      render = () => {};
      const skins = GUN_SKINS, res = {};
      skins.inv().own = skins.inv().own || {}; skins.inv().own.knife = ["tanto", "kukri", "flip", "karambit", "butterfly", "bayonet", "gut", "bowie", "kunai", "stiletto"];
      player.slot = Object.keys(player.weapons).find((s) => player.weapons[s] === "knife");
      const names = {};
      for (const id of ["", "butterfly", "karambit", "flip", "tanto", "kukri", "bayonet", "gut", "bowie", "kunai", "stiletto"]) {
        skins.set("knife", id || "default");
        for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k];
        updateViewmodel(true);
        const a = VM.current, pv = KNIFE_PIVOT.of(a), m = KNIVES.model(), r = (res[id || "default"] = { model: m, pivot: !!pv });
        if (!pv) continue;
        a.updateMatrixWorld(true);
        // the arm: everything that is not on the pivot; turn the pivot and see what stays
        const inPv = new Set(); pv.traverse((x) => inPv.add(x));
        const armMeshes = []; a.traverse((x) => x.isMesh && !inPv.has(x) && !x.userData.live && armMeshes.push(x));
        const box = () => { a.updateMatrixWorld(true); const b = new THREE.Box3(); armMeshes.forEach((x) => b.expandByObject(x)); return b.getCenter(new THREE.Vector3()); };
        const tip = () => { let far = -1, t = null; const g = new THREE.Vector3(); pv.getWorldPosition(g); pv.traverse((x) => { if (!x.isMesh || !x.visible) return; x.geometry.computeBoundingBox(); const c = x.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(x.matrixWorld); const d = c.distanceTo(g); d > far && ((far = d), (t = c)); }); return t; };
        const h0 = box(), t0 = tip();
        pv.rotation.x += Math.PI; const h1 = box(), t1 = tip(); pv.rotation.x -= Math.PI;
        r.armMoved = +h0.distanceTo(h1).toFixed(4); r.knifeMoved = +t0.distanceTo(t1).toFixed(3);
        r.armMeshes = armMeshes.length; r.fingers = !!a.userData.fingers || !!a.userData.ringFinger;
        // the karambit pivots on its ring
        if (m === "karambit") { const ring = KNIVES.parts(a).spin, g = new THREE.Vector3(), q = new THREE.Vector3(); ring.getWorldPosition(g); pv.getWorldPosition(q); r.ringDist = +g.distanceTo(q).toFixed(4); r.ghosts = (pv.userData.ghosts || []).length; }
        // the trick: starts and ends as held, goes somewhere in between
        const D = KNIVES.inspD(m), T = { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0, open: 0, hA: 0, hB: 0, blade: 0, slide: 0, about: "" }, E = { ...T };
        const fn = KNIFE_TRICKS.SHOW[m]; let maxRx = 0, maxRy = 0, maxRz = 0, maxPy = 0, maxHA = 0, maxBl = 0, maxSl = 0;
        for (let s = 0; s <= D; s += 0.02) { for (const k in T) T[k] = 0; fn(s, T); maxRx = Math.max(maxRx, Math.abs(T.rx)); maxRy = Math.max(maxRy, Math.abs(T.ry)); maxRz = Math.max(maxRz, Math.abs(T.rz)); maxPy = Math.max(maxPy, Math.abs(T.py)); maxHA = Math.max(maxHA, Math.abs(T.hA)); maxBl = Math.max(maxBl, Math.abs(T.blade)); maxSl = Math.max(maxSl, T.slide); }
        for (const k in E) E[k] = 0; fn(D, E);
        const whole = (v) => { const w = Math.abs(v) % (2 * Math.PI); return Math.min(w, 2 * Math.PI - w) < 1e-6; };
        r.D = D; r.endsAtRest = whole(E.rx) && whole(E.ry) && whole(E.rz) && whole(E.hA) && whole(E.hB) && Math.abs(E.py) < 1e-6 && Math.abs(E.blade) < 1e-6 && Math.abs(E.pz) < 1e-6 && Math.abs(E.slide) < 1e-6;
        r.reach = { rx: +(maxRx / Math.PI).toFixed(2), ry: +(maxRy / Math.PI).toFixed(2), rz: +(maxRz / Math.PI).toFixed(2), py: +maxPy.toFixed(3), hA: +(maxHA / Math.PI).toFixed(2), blade: +(maxBl / Math.PI).toFixed(2), slide: +maxSl.toFixed(2) };
      }
      // an inspect run on the karambit: the trails show while it spins fast, the pivot comes back at the end
      skins.set("knife", "karambit"); for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k]; updateViewmodel(true);
      const M = SKIN_PERKS.state, pv = KNIFE_PIVOT.of(VM.current); let trail = 0, tossed = 0, maxY = 0;
      if (!pv) throw new Error('Missing karambit pivot: '+JSON.stringify({weapon:curWeaponKey(),slot:player.slot,weapons:player.weapons,skin:skins.of('knife').id,model:KNIVES.model(),vm:VM.current?.userData?.key,rows:res}));
      M.insp.t = 0;
      for (let i = 0; i < 600; i++) { tickViewmodel(0.01); if (M.insp.t < 0) break; const gh = pv.userData.ghosts; trail = Math.max(trail, ...gh.map((g) => (g.g.visible ? g.mat.opacity : 0))); maxY = Math.max(maxY, pv.position.y - pv.userData.p0.y); }
      res.run = { trail: +trail.toFixed(2), maxY: +maxY.toFixed(3), ended: M.insp.t < 0, err: window.__knifeErr ? String(window.__knifeErr) : null };
      // the idle trick, as a phone sees it (no inspect key): each knife does one when held still
      res.idle = {};
      for (const id of ["butterfly", "karambit", "flip", "tanto", "kukri", "bayonet", "gut", "bowie", "kunai", "stiletto"]) {
        skins.set("knife", id || "default"); for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k]; updateViewmodel(true);
        const a2 = VM.current, pv2 = KNIFE_PIVOT.of(a2), kp = KNIVES.parts(a2); let moved = 0; KNIVES.idle.t = 0; KNIVES.idle.anim = 0;
        M.insp.t = -1; M.knife.t = -1; M.draw.t = -1;
        for (let i = 0; i < 200 && KNIVES.idle.anim >= 0; i++) { tickViewmodel(0.01); moved = Math.max(moved, Math.abs(pv2.rotation.x) + Math.abs(pv2.rotation.y) + (kp.hA ? Math.abs(kp.hA.rotation.x) : 0) + (kp.blade ? Math.abs(kp.blade.rotation.x) : 0)); }
        tickViewmodel(0.016);
        res.idle[id || "default"] = { moved: +moved.toFixed(2), ended: KNIVES.idle.anim < 0, back: +(Math.abs(pv2.rotation.x) + Math.abs(pv2.rotation.y)).toFixed(3) };
      }
      // the kunai turns on its ring: the ring stays put while the knife whirls round it
      skins.set("knife", "kunai"); for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k]; updateViewmodel(true);
      { const a3 = VM.current, ring = KNIVES.parts(a3).ring, w0 = new THREE.Vector3(), w = new THREE.Vector3(); M.insp.t = -1; KNIVES.idle.anim = -1; tickViewmodel(0.016); a3.updateMatrixWorld(true); ring.getWorldPosition(w0); a3.worldToLocal(w0);
        let drift = 0, turned = 0; M.insp.t = 0.45;
        for (let i = 0; i < 160; i++) { tickViewmodel(0.01); a3.updateMatrixWorld(true); ring.getWorldPosition(w); a3.worldToLocal(w); drift = Math.max(drift, w.distanceTo(w0)); turned = Math.max(turned, Math.abs(KNIFE_PIVOT.of(a3).rotation.x)); }
        res.kunai.ring = { drift: +drift.toFixed(4), turned: +(turned / Math.PI).toFixed(2) }; M.insp.t = -1; }
      // the stiletto's blade goes into the handle and comes out again; it has trails
      skins.set("knife", "stiletto"); for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k]; updateViewmodel(true);
      { const a4 = VM.current, bl = KNIVES.parts(a4).blade, pv4 = KNIFE_PIVOT.of(a4); KNIVES.idle.anim = -1; M.insp.t = -1; M.draw.t = -1; tickViewmodel(0.016); const z0 = bl.userData.z0; let inZ = 0, trail4 = 0; M.insp.t = 0;
        for (let i = 0; i < 600; i++) { tickViewmodel(0.01); if (M.insp.t < 0) break; inZ = Math.max(inZ, bl.position.z - z0); trail4 = Math.max(trail4, ...pv4.userData.ghosts.map((g) => (g.g.visible ? g.mat.opacity : 0))); }
        tickViewmodel(0.016);
        res.stiletto.run = { inZ: +inZ.toFixed(3), back: +(bl.position.z - z0).toFixed(4), ghosts: pv4.userData.ghosts.length, trail: +trail4.toFixed(2), ended: M.insp.t < 0 }; }
      // the draw: the new knives each do their own flourish as they come out, and end held
      res.draw = {};
      for (const id of ["bayonet", "gut", "bowie", "kunai", "stiletto"]) {
        skins.set("knife", id); for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k]; updateViewmodel(true);
        const a5 = VM.current, pv5 = KNIFE_PIVOT.of(a5), bl5 = KNIVES.parts(a5).blade; KNIVES.idle.anim = -1; M.insp.t = -1; M.knife.t = -1;
        let mv = 0; M.draw.t = 0; M.draw.D = KNIVES.drawD(id); M.draw.typed = true;
        for (let i = 0; i < 120 && M.draw.t >= 0; i++) { tickViewmodel(0.01); mv = Math.max(mv, Math.abs(pv5.rotation.x) + Math.abs(pv5.rotation.y) + Math.abs(pv5.rotation.z) + (bl5 && bl5.userData.z0 !== undefined ? 10 * Math.abs(bl5.position.z - bl5.userData.z0) : 0)); }
        M.draw.t = -1; tickViewmodel(0.016);
        res.draw[id] = { moved: +mv.toFixed(2), back: +(Math.abs(pv5.rotation.x) + Math.abs(pv5.rotation.y) + Math.abs(pv5.rotation.z)).toFixed(3) };
      }
      skins.set("knife", "karambit"); for (const k in VM.cache) /^knife\|/.test(k) && delete VM.cache[k]; updateViewmodel(true);
      const pvK = KNIFE_PIVOT.of(VM.current); M.draw.t = -1; M.insp.t = -1; KNIVES.idle.anim = -1;
      tickViewmodel(0.016);
      res.after = { rot: [pvK.rotation.x, pvK.rotation.y, pvK.rotation.z].map((v) => +v.toFixed(3)), dy: +(pvK.position.y - pvK.userData.p0.y).toFixed(4) };
      return res;
    });
    console.log(JSON.stringify(out));
    const ALL = ["default", "butterfly", "karambit", "flip", "tanto", "kukri", "bayonet", "gut", "bowie", "kunai", "stiletto"];
    for (const k of ALL) {
      const r = out[k];
      assert.ok(r && r.pivot, k + " has a pivot");
      assert.ok(r.armMoved < 0.001, k + ": the arm stays (" + r.armMoved + ")");
      assert.ok(r.knifeMoved > 0.05, k + ": the knife turns (" + r.knifeMoved + ")");
      assert.ok(r.armMeshes > 0 && r.fingers, k + ": has an arm and fingers on the grip");
      assert.ok(r.endsAtRest, k + ": the trick ends as the knife is held");
    }
    assert.deepEqual(ALL.map((id) => out[id].model), ["", ...ALL.slice(1)]);
    // the five new knives: each its own trick
    assert.ok(out.bayonet.reach.rx >= 3.9 && out.bayonet.reach.ry >= 0.28, "the bayonet: a look along the flat, a flip, a reverse grip and back " + JSON.stringify(out.bayonet.reach));
    assert.ok(out.gut.reach.ry >= 1.9 && out.gut.reach.rz >= 0.34 && out.gut.reach.rx >= 1.9, "the gut knife: a palm spin, the hook shown, a toss " + JSON.stringify(out.gut.reach));
    assert.ok(out.bowie.reach.rx >= 1.9 && out.bowie.reach.py >= 0.14, "the bowie: thrown end over end " + JSON.stringify(out.bowie.reach));
    assert.ok(out.kunai.reach.rx >= 5.9 && out.kunai.ring.drift < 0.004 && out.kunai.ring.turned >= 3, "the kunai whirls about its ring, the ring stays put " + JSON.stringify(out.kunai));
    assert.ok(out.stiletto.reach.slide >= 0.99 && out.stiletto.reach.ry >= 3.9 && out.stiletto.reach.rx >= 3.9, "the stiletto: blade in, spun, thrown, blade out " + JSON.stringify(out.stiletto.reach));
    assert.ok(out.stiletto.run.inZ > 0.2 && Math.abs(out.stiletto.run.back) < 1e-4 && out.stiletto.run.ghosts === 3 && out.stiletto.run.trail > 0.1 && out.stiletto.run.ended, "the stiletto's blade slides in and out, with trails " + JSON.stringify(out.stiletto.run));
    for (const [k, r] of Object.entries(out.draw)) assert.ok(r.moved > 0.9 && r.back < 0.001, k + ": a flourish on the draw that ends held " + JSON.stringify(r));
    assert.ok(out.karambit.ringDist < 0.01, "the karambit turns about its ring (" + out.karambit.ringDist + ")");
    assert.equal(out.karambit.ghosts, 3);
    assert.ok(out.karambit.reach.rx >= 6 && out.karambit.reach.ry >= 3.5 && out.karambit.reach.py >= 0.12, "the karambit chain: spins, a flat helicopter, a toss " + JSON.stringify(out.karambit.reach));
    assert.ok(out.butterfly.reach.hA >= 3.5 && out.butterfly.reach.rz >= 1.9, "the balisong fans its handles and rolls over");
    assert.ok(out.flip.reach.blade >= 0.95, "the flipper shuts and opens");
    assert.ok(out.tanto.reach.rx >= 1.9, "the tanto goes into a reverse grip and back");
    assert.ok(out.run.trail > 0.1 && out.run.maxY > 0.12 && out.run.ended && !out.run.err, "the karambit run shows trails and a toss: " + JSON.stringify(out.run));
    assert.deepEqual(out.after, { rot: [0, 0, 0], dy: 0 });
    for (const [k, r] of Object.entries(out.idle)) { assert.ok(r.moved > 0.5, k + ": an idle trick shows (" + r.moved + ")"); assert.ok(r.ended, k + ": the idle trick ends"); assert.ok(r.back < 0.01, k + ": and the knife is back in the hand"); }
    assert.deepEqual(f.errors, []);
    console.log("knife tricks: every knife turns on its own pivot (the karambit on its ring, with trails), arm stays, every trick ends as it began");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
