const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Saved settings that are not what a setting can hold (a NaN once saved comes back as null, a value of the wrong type,
// a number far outside its slider) used to be taken as they were: a null sensitivity stopped mouse look for good and
// the settings screen threw when it showed the number. Such values are now dropped (the default stays) or brought
// inside the slider's range.
(async () => {
  const f = await fixture();
  try {
    const stored = { sens: null, adsSens: "abc", touchSens: 1e9, motion: -3, shake: "yes", showFps: 1, quality: 42, dmgNums: false };
    const page = await f.page("setcorrupt", { width: 1280, height: 720 }, {}, { bootTimeout: 120000, beforeLoad: (p) => p.addInitScript((s) => { try { localStorage.setItem("lgp_set", JSON.stringify(s)); } catch (e) {} }, stored) });
    const s = await page.evaluate(() => ({ sens: SETTINGS.sens, adsSens: SETTINGS.adsSens, touchSens: SETTINGS.touchSens, motion: SETTINGS.motion, shake: SETTINGS.shake, showFps: SETTINGS.showFps, quality: SETTINGS.quality, dmgNums: SETTINGS.dmgNums, def: { sens: SET_DEF.sens, adsSens: SET_DEF.adsSens, shake: SET_DEF.shake, showFps: SET_DEF.showFps } }));
    assert.equal(s.sens, s.def.sens, "a null sensitivity keeps the default");
    assert.equal(s.adsSens, s.def.adsSens, "text where a number belongs keeps the default");
    assert.equal(s.touchSens, 3, "a number past the slider is brought to its end");
    assert.equal(s.motion, 0, "a number below the slider is brought to its start");
    assert.equal(s.shake, s.def.shake, "text where a switch belongs keeps the default");
    assert.equal(s.showFps, s.def.showFps, "a number where a switch belongs keeps the default");
    assert.equal(typeof s.quality, "string", "the graphics preset is a preset");
    assert.equal(s.dmgNums, false, "a good value is still taken");
    // the settings screen opens and shows the numbers
    await page.click("#go-set");
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.getElementById("st-sens-v").textContent), "1.00", "the settings screen shows the sensitivity");
    // mouse look turns (with a null sensitivity it was BASE_SENS * null = 0)
    const look = await page.evaluate(() => BASE_SENS * SETTINGS.sens * SETTINGS.adsSens);
    assert.ok(Number.isFinite(look) && look > 0, "the look speed is a positive number: " + look);
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("corrupted settings are dropped or brought into range; the settings screen and mouse look work");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
