const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
(async () => {
  const f = await fixture(), shots = process.env.DFDF_SCREENSHOT_DIR || "/tmp/dfdf-home-layout";
  fs.mkdirSync(shots, { recursive: true });
  try {
    const page = await f.page("homelayout", { width: 1440, height: 900 });
    for (const [name, width, height] of [["desktop", 1440, 900], ["tablet", 1024, 768], ["mobile", 852, 393], ["small", 568, 320], ["portrait", 390, 844]]) {
      await page.setViewportSize({ width, height }); await page.mouse.move(0, 0);
      await page.waitForFunction(() => ["acct-chip", "rank-chip", "gold-chip", "mis-chip"].every((id) => document.getElementById(id)));
      const theme = await page.evaluate(() => {
        const read = () => ["#go-play", "#go-multi", ".title-mark", "#tt-img"].map((selector) => {
          const s = getComputedStyle(document.querySelector(selector));
          return [s.backgroundImage, s.color, s.borderRadius, s.boxShadow, s.fontFamily, s.fontSize, s.filter, s.maskImage];
        });
        const chips = () => ["acct-chip", "rank-chip", "gold-chip", "mis-chip"].map((id) => {
          const s = getComputedStyle(document.getElementById(id));
          return [s.backgroundImage, s.backgroundColor, s.color, s.borderColor, s.borderRadius, s.boxShadow, s.fontFamily];
        });
        const sheet = document.querySelector('link[href="./css/home-navigation.css"]').sheet, actual = read(), actualChips = chips();
        sheet.disabled = true;
        const original = read(), originalChips = chips(); sheet.disabled = false;
        return { actual, original, actualChips, originalChips };
      });
      assert.deepEqual(theme.actual, theme.original, name + " original button, logo and portrait styles");
      assert.deepEqual(theme.actualChips, theme.originalChips, name + " original account, tier, gold and mission styles");
      assert.equal(await page.locator(".title-mark").textContent(), "13");
      assert.equal(await page.locator(".tt-left .title-sub").count(), 0);
      assert.equal(await page.locator(".home-brand").textContent(), "13");
      const layout = await page.evaluate(() => {
        const root = document.getElementById("s-title"), header = document.querySelector(".home-header").getBoundingClientRect();
        return { overflow: root.scrollWidth > innerWidth, items: ["go-play", "go-multi", "go-armory", "go-set", "home-account"].map((id) => {
          const e = document.getElementById(id), r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { id, within: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, hit: !!hit && (hit === e || e.contains(hit)), belowHeader: !["go-play", "go-multi"].includes(id) || r.top >= header.bottom };
        }) };
      });
      assert.equal(layout.overflow, false, name + " horizontal overflow");
      for (const item of layout.items) { assert.equal(item.within, true, name + " " + item.id + " bounds"); assert.equal(item.hit, true, name + " " + item.id + " covered"); assert.equal(item.belowHeader, true, name + " main buttons overlap header"); }
      assert.equal(await page.locator("#go-armory").count(), 1);
      if (name === "desktop") await page.waitForFunction(() => document.getElementById("tt-img").naturalWidth > 0);
      await page.screenshot({ path: `${shots}/home-${name}.png` });
      await page.locator(".home-header .home-practice summary").click(); await page.locator("#go-range").click();
      assert.equal(await page.locator("#s-select").isVisible(), true); await page.locator("#sel-back").click();
      assert.equal(await page.locator(".home-practice").evaluate((e) => e.open), false);
      await page.locator("#go-set").click(); assert.equal(await page.locator("#pause.from-menu").isVisible(), true); await page.locator("#pz-close").click();
      await page.locator("#go-armory").click(); assert.equal(await page.locator("#armory").isVisible(), true); await page.locator("#ar-close").click();
      await page.locator("#go-multi").click(); assert.equal(await page.locator("#s-multi").isVisible(), true); await page.locator("#mu-back").click();
      console.log(name, "original styles, top navigation, bounds and menu clicks passed");
    }
    assert.deepEqual(f.errors, []);
  } finally { await f.browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
