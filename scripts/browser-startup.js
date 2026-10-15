const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture();
  let releaseEngine, releaseSkins, engineSeen, skinsSeen, page;
  const engineGate = new Promise((resolve) => { releaseEngine = resolve; }), skinsGate = new Promise((resolve) => { releaseSkins = resolve; });
  const engineStarted = new Promise((resolve) => { engineSeen = resolve; }), skinsStarted = new Promise((resolve) => { skinsSeen = resolve; });
  try {
    const loading = f.page("startup", undefined, {}, { path: "/play.html#skins", syncSkins: false, beforeLoad: async (p) => {
      page = p;
      await p.route("**/js/legacy/03-engine.js", async (route) => { engineSeen(); await engineGate; await route.continue(); });
      await p.route("**/api/v1?*", async (route) => {
        if (new URL(route.request().url()).searchParams.get("a") === "skins") { skinsSeen(); await skinsGate; }
        await route.fallback();
      });
    } });
    loading.catch(() => {}); // Keep early assertions from hiding failures behind a pending navigation.
    await engineStarted;
    await page.locator("#go-armory").waitFor({ state: "visible" });
    assert.equal(await page.locator("#go-armory").count(), 1);
    assert.equal(await page.locator("#go-armory").isVisible(), true);
    assert.equal(await page.locator("#go-armory").isDisabled(), true);
    assert.equal(await page.locator("#sel-grid .acard").count(), 0);
    releaseEngine(); await loading; await skinsStarted;
    assert.equal(await page.locator("#go-armory").count(), 1);
    assert.equal(await page.locator("#go-armory").isDisabled(), false);
    assert.equal(await page.locator("#armory").isVisible(), true);
    assert.equal(await page.evaluate(() => GUN_SKINS.curTab()), "pull");
    assert.equal(await page.locator("#ar-pull1").isVisible(), true);
    assert.equal(await page.locator("#ar-pull1").isDisabled(), true);
    assert.match(await page.locator("#ar-why").textContent(), /불러오는 중/);
    assert.equal(await page.locator("#sel-grid .acard").count(), 0);
    assert.equal(await page.locator("#title-roster .tr-chip").count(), await page.evaluate(() => AGENTS.length));
    releaseSkins(); await page.waitForFunction(() => GUN_SKINS.inv().synced);
    assert.equal(await page.locator("#ar-pull1").isDisabled(), false);
    await page.locator("#ar-pull1").click(); await page.waitForFunction(() => GUN_SKINS.reveal().on);
    await page.evaluate(() => { GUN_SKINS._skip(); GUN_SKINS.close(); });
    await page.locator("#go-armory").click(); assert.equal(await page.locator("#armory").isVisible(), true);
    await page.evaluate(() => GUN_SKINS.close());
    await page.evaluate(() => { location.hash = "skins-mine"; });
    await page.waitForFunction(() => GUN_SKINS.isOpen() && GUN_SKINS.curTab() === "mine");
    await page.evaluate(() => GUN_SKINS.close());
    assert.equal(await page.locator("#tt-img").evaluate((image) => image.naturalWidth), 0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => { const image = document.getElementById("tt-img"); return image.complete && image.naturalWidth > 0; });
    await page.locator("#go-play").click();
    assert.equal(await page.locator("#sel-grid .acard").count(), await page.evaluate(() => AGENTS.length));
    await page.waitForFunction(() => { const image = document.querySelector("#sel-grid .acard:not([hidden]) img"); return image.complete && image.naturalWidth > 0; });
    await page.waitForFunction(() => { const image = document.querySelector("#sel-detail .det-img"); return image.complete && image.naturalWidth > 0; });
    assert.deepEqual(f.errors, []);
    console.log("initial Armory button, boot deep link, delayed inventory, real pull, hash navigation and visible final portraits passed");
  } catch (error) {
    if (page && !page.isClosed()) console.log("startup failure", await page.evaluate(() => {
      const image = document.getElementById("tt-img");
      return { phase: world.phase, titleHidden: document.getElementById("s-title").hidden, armory: GUN_SKINS.isOpen(), image: image && { src: image.src, width: image.naturalWidth, rect: image.getBoundingClientRect().toJSON(), parent: getComputedStyle(image.parentElement).display } };
    }), f.errors);
    throw error;
  } finally { releaseEngine(); releaseSkins(); await f.browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
