const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.DFDF_PLAYWRIGHT_MODULE || "playwright");
const { harness } = require("../tests/api-harness");
// The owner page, 게임 설정: "이 설정을 기본값으로" saves the form as the owner's default, "전부 기본값" goes back to it,
// "처음 설정으로" goes back to the game's own values, and the fields that differ from the default are marked with a ↺.
(async () => {
  const h = harness({ now: Date.now() }), errors = [], dialogs = [], shots = process.env.SHOT_DIR || "test-results";
  fs.mkdirSync(shots, { recursive: true });
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "admin-defaults" });
  const A = owner.atoken, get = async () => await h.api("a_config_get", { atoken: A });
  // the season number and today's shop list were moved before: no button here may take them back
  const c0 = JSON.parse(JSON.stringify(h.config)); c0.season.skip = 3; c0.season.startDay = 20260915; c0.shop.reroll = 5; c0.shop.weekly.reroll = 2;
  assert.equal((await h.api("a_config_set", { atoken: A, config: c0 })).status, 200);
  const F = JSON.parse(JSON.stringify(h.config)), factory = { strength: F.aim.strength, guest: F.game.guestAllowed, note: F.game.announcement, cost: F.gacha.cost1 };
  assert.equal(factory.guest, true);
  const browser = await chromium.launch({ ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), headless: true, args: ["--no-sandbox"] });
  try {
    const open = async (viewport) => {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => { dialogs.push(d.message()); d.accept(); });
      await page.route("**/api/v1?*", async (route) => {
        const r = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
        await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) });
      });
      await page.addInitScript((t) => sessionStorage.setItem("adm_t", t), A);
      await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/admin.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".kpis .kpi");
      await page.click('#nav button[data-v="config"]');
      await page.waitForSelector("#cfg [data-k]");
      return page;
    };
    const kept = async (why) => {
      const c = (await get()).config;
      assert.deepEqual([c.season.skip, c.season.startDay, c.shop.reroll, c.shop.weekly.reroll], [3, 20260915, 5, 2], "season and shop numbers stay: " + why);
    };
    const status = (page) => page.$eval("#cstat", (e) => e.textContent.replace(/\s+/g, " ").trim());
    const marked = (page) => page.$$eval("#cfg .f.chg input[data-k]", (l) => l.map((e) => e.dataset.k).sort());
    const K = (k) => `[data-k="${k}"]`;
    const page = await open({ width: 1280, height: 900 });

    // nothing saved: the default is the game's own, nothing is marked, and there is no 처음 설정으로
    assert.match(await status(page), /^기본값: 게임 처음 설정 · 기본값과 다른 설정 0개$/);
    assert.deepEqual(await marked(page), []);
    assert.equal(await page.$("#cfac"), null);
    assert.deepEqual(await page.$$eval(".save button", (l) => l.map((b) => b.textContent)), ["전부 기본값", "이 설정을 기본값으로", "저장"]);
    assert.equal((await get()).saved, null);

    // change a number, a checkbox and a text: they are marked and counted as they change
    await page.fill(K("aim.strength"), "55");
    await page.uncheck(K("game.guestAllowed"));
    await page.fill(K("game.announcement"), "기본 공지");
    assert.deepEqual(await marked(page), ["aim.strength", "game.announcement", "game.guestAllowed"]);
    assert.match(await status(page), /기본값과 다른 설정 3개$/);
    assert.match(await page.getAttribute('[data-rs="aim.strength"]', "title"), new RegExp("^기본값\\(" + factory.strength + "\\)으로$"));
    assert.equal(await page.isVisible('[data-rs="aim.strength"]'), true);
    assert.equal(await page.isVisible('[data-rs="gacha.cost1"]'), false, "an unchanged field has no ↺");
    await page.fill(K("aim.strength"), String(factory.strength));
    assert.match(await status(page), /기본값과 다른 설정 2개$/);
    await page.fill(K("aim.strength"), "55");
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: shots + "/admin-defaults-marks.png" });

    // 이 설정을 기본값으로: the server's config and its saved default both hold them
    await page.click("#cdef");
    await page.waitForFunction(() => /운영자가 저장한 설정/.test(document.querySelector("#cstat").textContent));
    assert.match(dialogs.pop(), /지금 화면의 설정을 저장하고 기본값으로 정할까요/);
    let g = await get();
    assert.equal(g.config.aim.strength, 55); assert.equal(g.config.game.guestAllowed, false); assert.equal(g.config.game.announcement, "기본 공지");
    assert.equal(g.saved.config.aim.strength, 55); assert.equal(g.saved.config.game.guestAllowed, false); assert.equal(g.saved.config.game.announcement, "기본 공지");
    assert.ok(Math.abs(g.saved.t - Date.now()) < 60000);
    assert.equal(g.defaults.aim.strength, factory.strength, "the game's own values are untouched");
    await kept("after saving the default");
    assert.match(await status(page), /^기본값: 운영자가 저장한 설정 \(.+\) · 기본값과 다른 설정 0개$/);
    assert.deepEqual(await marked(page), []);
    assert.equal(await page.inputValue(K("aim.strength")), "55");
    assert.deepEqual(await page.$$eval(".save button", (l) => l.map((b) => b.textContent)), ["처음 설정으로", "전부 기본값", "이 설정을 기본값으로", "저장"]);

    // change them again and 저장: the default stays, the marks show against it
    await page.fill(K("aim.strength"), "20");
    await page.check(K("game.guestAllowed"));
    await page.fill(K("game.announcement"), "다른 공지");
    await page.fill(K("gacha.cost1"), "777");
    await page.click("#csave");
    await page.waitForFunction(() => /저장했습니다/.test(document.querySelector("#toast").textContent));
    g = await get();
    assert.equal(g.config.aim.strength, 20); assert.equal(g.config.gacha.cost1, 777); assert.equal(g.config.game.guestAllowed, true);
    assert.equal(g.saved.config.aim.strength, 55); assert.equal(g.saved.config.gacha.cost1, factory.cost, "the saved default did not change");
    await kept("after 저장");
    assert.deepEqual(await marked(page), ["aim.strength", "gacha.cost1", "game.announcement", "game.guestAllowed"]);
    assert.match(await status(page), /기본값과 다른 설정 4개$/);
    assert.equal(await page.getAttribute('[data-rs="game.guestAllowed"]', "title"), "기본값(끔)으로");
    assert.equal(await page.getAttribute('[data-rs="game.announcement"]', "title"), "기본값(기본 공지)으로");
    await page.evaluate(() => document.querySelector('[data-k="gacha.cost1"]').scrollIntoView({ block: "center" }));
    await page.screenshot({ path: shots + "/admin-defaults-changed.png" });

    // ↺ on one field puts the default in it; 저장 then saves that
    await page.click('[data-rs="aim.strength"]');
    assert.equal(await page.inputValue(K("aim.strength")), "55");
    await page.click('[data-rs="game.guestAllowed"]');
    assert.equal(await page.isChecked(K("game.guestAllowed")), false);
    assert.deepEqual(await marked(page), ["gacha.cost1", "game.announcement"]);
    assert.match(await status(page), /기본값과 다른 설정 2개$/);
    assert.equal((await get()).config.aim.strength, 20, "↺ alone saves nothing");
    await page.click("#csave");
    await page.waitForFunction(() => /저장했습니다/.test(document.querySelector("#toast").textContent));
    g = await get();
    assert.equal(g.config.aim.strength, 55); assert.equal(g.config.game.guestAllowed, false); assert.equal(g.config.gacha.cost1, 777); assert.equal(g.config.game.announcement, "다른 공지");
    await kept("after ↺ and 저장");

    // 전부 기본값: the saved default, on the screen and on the server
    await page.click("#crst");
    await page.waitForFunction(() => document.querySelector('[data-k="gacha.cost1"]').value !== "777");
    assert.match(dialogs.pop(), /^모든 설정을 저장해 둔 기본값\(.+\)으로 되돌릴까요\? 시즌 번호와 오늘 상점 목록은 그대로입니다\.$/);
    g = await get();
    assert.equal(g.config.aim.strength, 55); assert.equal(g.config.game.guestAllowed, false); assert.equal(g.config.game.announcement, "기본 공지"); assert.equal(g.config.gacha.cost1, factory.cost);
    assert.equal(await page.inputValue(K("aim.strength")), "55"); assert.equal(await page.isChecked(K("game.guestAllowed")), false); assert.equal(await page.inputValue(K("game.announcement")), "기본 공지");
    assert.match(await status(page), /기본값과 다른 설정 0개$/);
    assert.equal(g.saved.config.aim.strength, 55);
    await kept("after 전부 기본값");

    // 처음 설정으로: the game's own values; the saved default stays
    await page.click("#cfac");
    await page.waitForFunction((v) => document.querySelector('[data-k="aim.strength"]').value === v, String(factory.strength));
    assert.match(dialogs.pop(), /^모든 설정을 게임이 처음 정한 값으로 되돌릴까요\? 저장해 둔 기본값은 지워지지 않습니다\.$/);
    g = await get();
    assert.equal(g.config.aim.strength, factory.strength); assert.equal(g.config.game.guestAllowed, true); assert.equal(g.config.game.announcement, factory.note);
    assert.equal(await page.isChecked(K("game.guestAllowed")), true); assert.equal(await page.inputValue(K("game.announcement")), "");
    assert.equal(g.saved.config.aim.strength, 55, "the saved default is still there");
    assert.match(await status(page), /운영자가 저장한 설정.* · 기본값과 다른 설정 3개$/);
    await kept("after 처음 설정으로");
    await page.screenshot({ path: shots + "/admin-defaults-factory.png" });
    await page.click("#crst");
    await page.waitForFunction(() => document.querySelector('[data-k="aim.strength"]').value === "55");
    assert.equal((await get()).config.aim.strength, 55, "and one press brings the default back");
    await kept("after 전부 기본값 again");

    // without a saved default, 전부 기본값 gives the game's own values and asks in those words
    h.db.delete("config:default");
    await page.click('#nav button[data-v="dash"]'); await page.waitForSelector(".kpis .kpi");
    await page.click('#nav button[data-v="config"]'); await page.waitForSelector("#cstat");
    await page.waitForFunction(() => /게임 처음 설정/.test(document.querySelector("#cstat").textContent));
    await page.click("#crst");
    await page.waitForFunction((v) => document.querySelector('[data-k="aim.strength"]').value === v, String(factory.strength));
    assert.match(dialogs.pop(), /^모든 설정을 게임 처음 값으로 되돌릴까요\? 시즌 번호와 오늘 상점 목록은 그대로입니다\.$/);
    await kept("after 전부 기본값 with nothing saved");

    // a phone: the four buttons wrap and stay in reach, nothing sticks out sideways
    await h.api("a_config_default_set", { atoken: A, config: (await get()).config });
    const phone = await open({ width: 390, height: 844 });
    await phone.fill(K("aim.strength"), "42");
    await phone.fill(K("game.announcement"), "폰에서 바꾼 공지");
    const lay = await phone.evaluate(() => ({
      over: document.documentElement.scrollWidth - innerWidth,
      bar: [...document.querySelectorAll(".save button")].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width) }; }),
    }));
    console.log(JSON.stringify(lay));
    assert.ok(lay.over <= 1, "no sideways scroll on a phone (" + lay.over + ")");
    assert.equal(lay.bar.length, 4);
    lay.bar.forEach((b) => { assert.ok(b.l >= 0 && b.r <= 390 && b.b <= 844 && b.w >= 60, "button in reach: " + JSON.stringify(b)); });
    await phone.screenshot({ path: shots + "/admin-defaults-phone.png" });
    await phone.evaluate(() => document.querySelector('[data-k="aim.strength"]').scrollIntoView({ block: "center" }));
    await phone.screenshot({ path: shots + "/admin-defaults-phone-marks.png" });
    assert.deepEqual(errors, []);
    console.log("owner settings: save as default, restore it, factory values, marks and ↺");
  } finally { await browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
