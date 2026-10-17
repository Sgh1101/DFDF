const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture(), manifest = "**/assets/champions-phantom/**/manifest.json";
  try {
    const page = await f.page("phantomretry", { width: 1280, height: 800 }, {}, { beforeLoad: async (p) => p.route(manifest, (route) => route.fulfill({ status: 503, body: "unavailable" })) });
    await page.locator("#go-armory").click(); await page.locator('#ar-tabs [data-tab="champions"]').click();
    await page.waitForFunction(() => document.getElementById("phantom-model-message").textContent.includes("실패"));
    assert.equal(await page.locator("#phantom-model-notice").isVisible(), true);
    assert.equal(await page.evaluate(() => CHAMPIONS_PHANTOM.loaded()), false);
    assert.equal(await page.evaluate(() => !!GUN_SKINS._pv()?.obj), false, "a failed original load never shows the painted stock carbine as a preview");
    await page.locator('[data-phantom-skin="champions_def"]').click();
    assert.equal(await page.evaluate(() => !!GUN_SKINS._pv()?.obj), false, "switching variants cannot reveal a substitute model");
    await page.unroute(manifest); await page.locator("#phantom-retry").click();
    await page.waitForFunction(() => CHAMPIONS_PHANTOM.loaded() && GUN_SKINS._pv()?.obj?.getObjectByName("phantom-rig"));
    assert.equal(await page.locator("#phantom-model-notice").isVisible(), false);
    assert.match(await page.locator("#phantom-status").innerText(), /자동 적용/);
    assert.equal(await page.evaluate(() => { let vertices = 0; GUN_SKINS._pv().obj.getObjectByName("phantom-rig").traverse((part) => { if (part.isMesh) vertices += part.geometry.attributes.position.count; }); return vertices; }), 878 * 36);
    assert.equal(await page.evaluate(() => GUN_SKINS.of("carbine").id), "default", "loading the original still does not grant an unowned skin");
    assert.deepEqual(f.errors, []);
    console.log("Phantom loading: clear error instead of a substitute gun, variant switching, retry to the complete original, ownership preserved");
  } finally { await f.browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
