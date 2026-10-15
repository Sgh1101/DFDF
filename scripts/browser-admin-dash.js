const assert = require("node:assert/strict");
const { chromium } = require(process.env.DFDF_PLAYWRIGHT_MODULE || "playwright");
const { harness } = require("../tests/api-harness");
// The owner page: the dashboard's summary, its quick switches and quick numbers, and the
// aim-assist grant on one account.
(async () => {
  const h = harness({ now: Date.now() }), errors = [];
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "admin-dash" });
  for (const id of ["alpha", "bravo", "charlie"]) await h.api("auth", { id, pw: "password", device: "dev-" + id });
  await h.api("a_user_set", { atoken: owner.atoken, id: "alpha", op: "rr", rr: 1250 });
  await h.api("a_user_set", { atoken: owner.atoken, id: "bravo", op: "rr", rr: 420 });
  const browser = await chromium.launch({ ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), headless: true, args: ["--no-sandbox"] });
  try {
    const open = async (viewport) => {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => d.accept());
      await page.route("**/api/v1?*", async (route) => {
        const r = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
        await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) });
      });
      await page.addInitScript((t) => sessionStorage.setItem("adm_t", t), owner.atoken);
      await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/admin.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".kpis .kpi");
      return page;
    };
    const page = await open({ width: 1280, height: 900 });
    const dash = await page.evaluate(() => ({
      kpis: document.querySelectorAll(".kpis .kpi").length,
      bars: document.querySelectorAll(".bars b").length,
      ranks: document.querySelectorAll(".hbar").length,
      chips: [...document.querySelectorAll("#db-sw .chip")].map((c) => c.textContent.trim()),
      top: document.querySelector(".mini") && document.querySelector(".mini").textContent,
      quick: document.querySelectorAll(".qc [data-q]").length,
    }));
    console.log(JSON.stringify(dash));
    assert.ok(dash.kpis >= 14 && dash.bars === 14 && dash.ranks >= 9 + 6 && dash.quick >= 12, "the dashboard has its cards, the 14-day chart, the tier and grant bars, the quick controls");
    assert.ok(dash.chips.includes("PC 에임 보정 켬") && dash.chips.includes("점검 모드 끔"));
    assert.match(dash.top, /alpha/);
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/admin-dash.png" : "/tmp/admin-dash.png", fullPage: true });
    // a switch at the top: the computer side of aim assist off for everyone
    await page.click('#db-sw .chip[data-p="aim.pc"]');
    await page.waitForFunction(() => /PC 에임 보정 끔/.test(document.querySelector("#db-sw").textContent));
    assert.equal((await h.api("a_config_get", { atoken: owner.atoken })).config.aim.pc, false);
    // quick numbers: the strength and the cost of a pull
    await page.fill('[data-q="aim.strength"]', "55");
    await page.fill('[data-q="gacha.cost1"]', "250");
    await page.fill('[data-q="game.announcement"]', "주말 이벤트");
    await page.click("#qc-save");
    await page.waitForFunction(() => /주말 이벤트/.test(document.querySelector("#main").textContent) && document.querySelector('[data-q="aim.strength"]').value === "55");
    const cfg = (await h.api("a_config_get", { atoken: owner.atoken })).config;
    assert.equal(cfg.aim.strength, 55); assert.equal(cfg.gacha.cost1, 250); assert.equal(cfg.game.announcement, "주말 이벤트");
    // one account: aim assist on a computer for 7 days
    await page.click('#nav button[data-v="users"]');
    await page.waitForSelector('tr[data-id="bravo"] button[data-op="aim"]');
    await page.click('tr[data-id="bravo"] button[data-op="aim"]');
    await page.check("#ai-pc");
    await page.fill("#ai-days", "7");
    await page.click("#ai-save");
    await page.waitForFunction(() => /에임 보정 PC/.test(document.querySelector('tr[data-id="bravo"]').textContent));
    const bravo = h.user("bravo");
    assert.equal(bravo.aim.pc, true); assert.ok(bravo.aim.until > Date.now() + 6 * 864e5);
    // a phone: nothing sticks out sideways
    const phone = await open({ width: 390, height: 844 });
    const over = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await phone.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/admin-dash-phone.png" : "/tmp/admin-dash-phone.png", fullPage: true });
    assert.ok(over <= 1, "no sideways scroll on a phone (" + over + ")");
    assert.deepEqual(errors, []);
    console.log("owner dashboard: summary, quick switches and numbers, aim grant per account");
  } finally { await browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
