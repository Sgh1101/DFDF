const assert = require("node:assert/strict");
const { chromium } = require(process.env.DFDF_PLAYWRIGHT_MODULE || "playwright");
const { harness } = require("../tests/api-harness");
// The owner page's 게임 설정 view after the cheat hunt (digits painted on a building) was taken out: the settings that
// only the hunt used are not listed, and the ones that remain are described as what they do now. The server holds a
// config saved in the days of the hunt, with all its keys: the page must show none of them and save without them.
const OLD = { enabled: false, codeLength: 4, startAtMiddle: true, moveAfterUse: true, resetEachRound: true, wrongWaitSec: 2 };
(async () => {
  const h = harness({ now: Date.now() }), errors = [];
  const old = JSON.parse(JSON.stringify(h.config)); Object.assign(old.cheat, OLD, { refillSec: 8 });
  h.db.set("config", JSON.stringify(old)); // before the first sign-in: the server keeps what it read for a while
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "admin-config" });
  const browser = await chromium.launch({ ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), headless: true, args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
    // the dashboard's switches no longer carry a 치트 switch (the old config said enabled: false)
    const chips = await page.evaluate(() => [...document.querySelectorAll("#db-sw .chip")].map((c) => c.textContent.trim()));
    assert.ok(chips.length >= 8 && chips.includes("점검 모드 끔"), "the dashboard's switches are there: " + chips);
    assert.ok(!chips.some((c) => /^치트 /.test(c)), "no 치트 switch on the dashboard: " + chips);
    // 게임 설정
    const settings = async () => {
      await page.click('#nav button[data-v="config"]');
      await page.waitForSelector('[data-k="cheat.refillSec"]');
      return page.evaluate(() => ({
        keys: [...document.querySelectorAll('#main [data-k^="cheat"]')].map((e) => e.dataset.k),
        all: [...document.querySelectorAll("#main [data-k]")].length,
        text: document.querySelector("#main").textContent,
        sec: (() => { const s = [...document.querySelectorAll("#main .sec")].find((x) => /^치트/.test(x.querySelector("h3").textContent)); return s ? s.textContent : ""; })(),
      }));
    };
    let v = await settings();
    await page.locator("#main .sec", { hasText: "치트 모드를 켠 계정" }).first().screenshot({ path: (process.env.SHOT_DIR || "/tmp") + "/admin-config-cheat.png" });
    assert.ok(v.keys.includes("cheat.refillSec") && v.keys.includes("cheat.ultInfinite"), "the 치트 section lists what the game still reads: " + v.keys);
    assert.deepEqual(v.keys.filter((k) => k.split(".")[1] in OLD), [], "and none of the hunt's settings: " + v.keys);
    assert.equal(await page.inputValue('[data-k="cheat.refillSec"]'), "8", "a saved value that is still used is shown");
    for (const dead of ["비밀번호 자릿수", "라운드 시작 때 가운데 건물", "번호 바꾸고 옮기기", "매 라운드 초기화", "틀렸을 때 기다리는 초", "숨은 비밀번호", "치트 사용", "비밀번호가 그려지지"]) assert.ok(!v.text.includes(dead), "the page no longer says: " + dead);
    assert.match(v.sec, /능력 충전/, "the section says what it does: " + v.sec);
    // saving writes the settings without the old keys; the rest of the page's settings are all still sent
    await page.click("#csave");
    await page.waitForFunction(() => /저장했습니다/.test(document.body.textContent));
    const stored = JSON.parse(h.db.get("config"));
    for (const k of Object.keys(OLD)) assert.equal(k in stored.cheat, false, "stored without cheat." + k);
    assert.equal(stored.cheat.refillSec, 8);
    for (const k of Object.keys(stored.cheat)) assert.ok(v.keys.some((x) => x === "cheat." + k || x.startsWith("cheat." + k + ".")), "what is stored is what the page lists: " + k);
    // reset: the defaults, and the same list again
    await page.click("#crst");
    await page.waitForFunction(() => document.querySelector('[data-k="cheat.refillSec"]') && document.querySelector('[data-k="cheat.refillSec"]').value === "5");
    assert.equal(h.db.has("config"), false, "reset removed the saved config");
    v = await settings();
    assert.deepEqual(v.keys.filter((k) => k.split(".")[1] in OLD), []);
    assert.deepEqual(errors, []);
    console.log("owner settings: no cheat-hunt settings listed, an old saved config loads, saves and resets");
  } finally { await browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
