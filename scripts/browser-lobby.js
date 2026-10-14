const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture(), shots = process.env.DFDF_SCREENSHOT_DIR || "/tmp/dfdf-lobby";
  fs.mkdirSync(shots, { recursive: true });
  try {
    const page = await f.page("lobbydesign", { width: 1440, height: 900 });
    for (const [name, width, height] of [["desktop", 1440, 900], ["tablet", 1024, 768], ["mobile", 852, 393], ["small", 568, 320], ["portrait", 390, 844]]) {
      await page.setViewportSize({ width, height });
      const bounds = await page.evaluate(() => {
        const ids = ["go-play", "go-multi", "go-armory", "go-set", "home-account"];
        return { overflow: document.getElementById("s-title").scrollWidth > innerWidth, items: ids.map((id) => {
          const e = document.getElementById(id), r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { id, x: r.x, y: r.y, width: r.width, height: r.height, within: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, hit: !!hit && (e === hit || e.contains(hit)) };
        }) };
      });
      assert.equal(bounds.overflow, false, name + " horizontal overflow");
      for (const item of bounds.items) { assert.equal(item.within, true, name + " " + item.id + " outside viewport"); assert.equal(item.hit, true, name + " " + item.id + " is covered"); }
      assert.equal(await page.locator("#go-armory").count(), 1);
      if (name === "desktop") {
        await page.waitForFunction(() => document.getElementById("tt-img").naturalWidth > 0);
        assert.equal(await page.locator("#title-roster button").count(), await page.evaluate(() => AGENTS.length));
        const agent = page.locator("#title-roster button").first();
        assert.equal(await agent.isVisible(), true); assert.equal(await agent.evaluate((e) => getComputedStyle(e).opacity), "1");
        await agent.focus(); await page.keyboard.press("Enter"); assert.equal(await agent.getAttribute("aria-pressed"), "true");
      }
      await page.screenshot({ path: `${shots}/home-${name}.png` });
      for (const summary of [".home-footer>.home-guide summary", "#home-equipment summary"]) {
        await page.locator(summary).first().click();
        const popup = page.locator(".home-footer details[open] .home-detail-panel");
        const rect = await popup.boundingBox();
        assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1 && rect.y >= 0 && rect.y + rect.height <= height + 1, name + " " + summary + " footer popup bounds " + JSON.stringify(rect));
        await popup.locator(".home-detail-heading button").click();
        assert.equal(await page.locator(".home-footer details[open]").count(), 0);
      }
      if (name === "mobile") {
        await page.locator("#home-equipment summary").click();
        await page.locator("#home-equipment .home-detail-panel .btn").first().click();
        assert.equal(await page.locator("#armory").isVisible(), true);
        await page.locator("#ar-close").click();
        assert.equal(await page.locator("#home-equipment").evaluate((e) => e.open), false);
        assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("#home-equipment summary")), true);
      }
      await page.locator(".home-practice summary").click();
      await page.locator("#go-range").click(); assert.equal(await page.locator("#s-select").isVisible(), true);
      await page.locator("#sel-back").click();
      await page.locator("#go-multi").click(); assert.equal(await page.locator("#s-multi").isVisible(), true);
      await page.locator("#mu-back").click();
      await page.locator("#go-set").click(); assert.equal(await page.locator("#pause.from-menu").isVisible(), true);
      await page.locator("#pz-close").click();
      await page.locator("#go-armory").click(); assert.equal(await page.locator("#armory").isVisible(), true);
      await page.locator("#ar-close").click();
      console.log(name, "layout, footer panels, range, multiplayer, settings and armory passed");
    }
    const english = await f.page("lobbyenglish", { width: 852, height: 393 }, {}, { beforeLoad: (p) => p.addInitScript(() => localStorage.setItem("lgp_lang", "en")) });
    assert.equal(await english.locator(".title-mark").textContent(), "PLAY");
    assert.equal(await english.locator("#go-armory b").textContent(), "Armory");
    assert.equal(await english.locator(".home-footer>.home-guide summary").first().textContent(), "Play guide");
    await english.screenshot({ path: `${shots}/home-english.png` });
    assert.deepEqual(f.errors, []);
  } finally { await f.browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
