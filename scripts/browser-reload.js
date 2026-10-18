const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Every gun reloads in its own way: the style each one gets, its props, the left
// hand moving through the reload and back to rest, and no error on any frame.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("reloader");
    const out = await page.evaluate(() => {
      titleCam = () => {}; render = () => {};
      room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true;
      const res = {};
      for (const key of Object.keys(WEAPONS)) {
        if (key === "knife") continue;
        player.weapons.primary = key; player.slot = "primary"; player.ammo[key] = 0;
        updateViewmodel(true);
        const a = VM.current, rl = a.userData.rl || {};
        const D = 2; let moved = 0, magOff = 0;
        player.reloading = D; tickViewmodel(0.016);
        for (let i = 1; i <= 40; i++) {
          player.reloading = Math.max(0.0001, D * (1 - i / 40));
          tickViewmodel(0.016);
          if (rl.lh && rl.lh0) moved = Math.max(moved, rl.lh.position.distanceTo(rl.lh0));
          if (rl.mag && rl.mag0) magOff = Math.max(magOff, rl.mag.position.distanceTo(rl.mag0));
        }
        player.reloading = 0; tickViewmodel(0.016);
        const back = rl.lh && rl.lh0 ? rl.lh.position.distanceTo(rl.lh0) : 0;
        res[key] = { style: rl.style, moved: +moved.toFixed(3), back: +back.toFixed(4), magOff: +magOff.toFixed(3), loader: !!rl.loader, pair: !!rl.pair, cap: !!rl.cap, empties: rl.empties ? rl.empties.length : 0 };
      }
      return res;
    });
    console.log(JSON.stringify(out));
    const want = { pistol: "pistol", silenced: "pistol", revolver: "revolver", machpist: "pistol", smg: "mag", shotgun: "shells", autoshot: "shells", rifle: "mag", carbine: "mag", burst: "mag", hmg: "belt", marksman: "mag", sniper: "bolt", pocketshot: "break", whisper: "mag", scout: "mag", bullpup: "mag", rpg: "rocket" };
    assert.deepEqual(Object.keys(out).sort(), Object.keys(want).sort(), "every current firearm has an explicit reload expectation");
    for (const [k, s] of Object.entries(want)) assert.equal(out[k].style, s, k + " reloads as " + s);
    for (const [k, r] of Object.entries(out)) {
      assert.ok(r.moved > 0.05, k + ": the left hand works (" + r.moved + ")");
      assert.ok(r.back < 0.002, k + ": the hand is back after the reload (" + r.back + ")");
    }
    assert.ok(out.revolver.loader && out.revolver.empties === 6, "revolver has a speedloader and six empties");
    assert.ok(out.pocketshot.pair, "pocketshot has two shells in the hand");
    assert.ok(out.rpg.cap, "the rocket has a nose cap");
    for (const k of ["rifle", "sniper", "hmg", "scout"]) assert.ok(out[k].magOff > 0.05, k + ": the magazine comes out (" + out[k].magOff + ")");
    assert.deepEqual(f.errors, []);
    console.log("reloads: every gun's own style, hand back at rest, no errors");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
