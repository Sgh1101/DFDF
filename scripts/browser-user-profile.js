const assert = require("node:assert/strict");
const { chromium } = require(process.env.DFDF_PLAYWRIGHT_MODULE || "playwright");
const { harness } = require("../tests/api-harness");
// The owner page's player profile: a player's name opens one window (info, sign-ins, pulls and shop, matches and
// rank, orders, the whole log with a filter and a CSV export) from one call, from every table where a name shows.
(async () => {
  const h = harness({ now: Date.now() }), errors = [];
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "admin-profile" });
  const ids = ["alpha", "bravo"], tok = {};
  for (const id of ids) tok[id] = (await h.api("auth", { id, pw: "password", device: "dev-" + id })).token;
  await h.api("a_user_set", { atoken: owner.atoken, id: "alpha", op: "gold", gold: 20000 });
  assert.equal((await h.api("gacha", { token: tok.alpha, n: 10 })).status, 200);
  const shop = await h.api("shop", { token: tok.alpha }), it = shop.items.find((x) => !x.own);
  assert.equal((await h.api("shop_buy", { token: tok.alpha, g: it.g, s: it.s, day: shop.day })).status, 200);
  assert.equal((await h.api("auth", { id: "alpha", pw: "wrong-pass", device: "dev-alpha" })).status, 401);
  assert.equal((await h.api("room_up", { token: tok.alpha, code: "PROF01", name: "profile room", players: ["alpha", "bravo"] })).status, 200);
  assert.equal((await h.api("feedback_submit", { token: tok.alpha, type: "ask", text: "profile test question" })).status, 200);
  const cfg = (await h.api("a_config_get", { atoken: owner.atoken })).config;
  cfg.order.on = true; cfg.order.bank = "test bank 000";
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: cfg })).status, 200);
  assert.equal((await h.api("order_create", { token: tok.alpha, items: ["radar"], days: 7 })).status, 200);
  await h.api("a_user_set", { atoken: owner.atoken, id: "bravo", op: "ban", days: 3, reason: "profile test" });
  const browser = await chromium.launch({ ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), headless: true, args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    let profileCalls = 0;
    await page.route("**/api/v1?*", async (route) => {
      const a = new URL(route.request().url()).searchParams.get("a");
      a === "a_user_profile" && profileCalls++;
      const r = await h.api(a, route.request().postDataJSON() || {});
      await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) });
    });
    await page.addInitScript((t) => sessionStorage.setItem("adm_t", t), owner.atoken);
    await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/admin.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".kpis .kpi");
    const go = async (v) => { await page.click(`#nav button[data-v="${v}"]`); await page.waitForTimeout(300); };
    const closeProfile = async () => { await page.click("#pf-x"); await page.waitForSelector("#pf", { state: "detached" }); };
    const openFrom = async (view, sel, name) => {
      await go(view);
      await page.waitForSelector(sel, { timeout: 8000 });
      await page.click(sel);
      await page.waitForSelector("#pf .pf-tabs");
      assert.match(await page.textContent("#pf .pfh h3"), new RegExp(name), view + ": the window is for " + name);
    };

    // 1. the users table: the window and all its sections
    await openFrom("users", '#ul .uname[data-user="alpha"]', "alpha");
    const tabs = await page.$$eval("#pf .pf-tabs button", (b) => b.map((x) => x.textContent));
    assert.deepEqual(tabs, ["정보", "접속 기록", "뽑기·상점", "경기·랭크", "주문", "전체 로그"]);
    const info = await page.textContent('#pf [data-p="info"]');
    for (const w of ["계정", "골드·구매", "랭크", "스킨", "장착한 스킨", "미션", "문의 1건"]) assert.ok(info.includes(w), "info has " + w);
    assert.ok(/숨은 MMR/.test(info), "the owner sees the hidden MMR");
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/profile-info.png" : "/tmp/profile-info.png" });
    const tab = async (t) => { await page.click(`#pf .pf-tabs button[data-t="${t}"]`); return page.textContent(`#pf [data-p="${t}"]`); };
    const conn = await tab("conn");
    assert.ok(conn.includes("가입") && conn.includes("로그인 실패") && /IP 127\.0\.0\.1/.test(conn) && /dev-alpha/.test(conn), "sign-in, the failed password, IP and device: " + conn.slice(0, 200));
    const shopTab = await tab("shop");
    assert.ok(shopTab.includes("뽑기") && /10회 뽑기/.test(shopTab) && shopTab.includes("구매"), "the pull and the purchase");
    assert.ok((await page.$$('#pf [data-p="shop"] .hbar')).length >= 5, "the rarity breakdown");
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/profile-shop.png" : "/tmp/profile-shop.png" });
    assert.ok((await tab("match")).includes("전적"));
    const order = await tab("order");
    assert.ok(/radar|레이더/.test(order) && order.includes("입금 대기"), "the order: " + order.slice(0, 200));

    // 2. the whole log: filter by kind, search, and the CSV
    await tab("all");
    const total = await page.$$eval("#pf-list tr", (r) => r.length);
    await page.selectOption("#pf-k", "gacha");
    assert.match(await page.textContent("#pf-n"), /^1줄$/);
    await page.selectOption("#pf-k", "");
    await page.fill("#pf-q", "로그인 실패");
    assert.match(await page.textContent("#pf-n"), /^1줄$/);
    await page.fill("#pf-q", "");
    assert.equal(await page.$$eval("#pf-list tr", (r) => r.length), total);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pf-csv")]);
    assert.match(dl.suggestedFilename(), /^profile-alpha-\d{8}\.csv$/);
    const csv = require("node:fs").readFileSync(await dl.path(), "utf8");
    assert.ok(csv.startsWith("﻿\"시각(UTC)\""), "a header row, UTF-8 mark");
    assert.ok(/"gacha"/.test(csv) && /"login"|"join"/.test(csv) && /"loginfail"/.test(csv), "the lines are in it");
    assert.ok(!/wrong-pass/.test(csv) && !csv.includes("owner-password"), "no secrets in it");
    assert.equal(csv.trim().split("\r\n").length - 1 >= 6, true);
    await closeProfile();

    // 3. the name opens it from the other tables, without doing what the row's own buttons do
    await openFrom("rooms", '.room .pl .uname[data-user="bravo"]', "bravo");
    assert.ok((await page.textContent('#pf [data-p="info"]')).includes("차단"), "bravo is banned and the window says so");
    await closeProfile();
    await openFrom("bans", '#main table .uname[data-user="bravo"]', "bravo");
    await closeProfile();
    assert.equal((await h.api("a_bans", { atoken: owner.atoken })).bans.some((b) => b.kind === "user" && b.key === "bravo"), true, "clicking the name did not lift the ban");
    await openFrom("orders", "#ol .uname", "alpha");
    await closeProfile();
    await openFrom("feedback", '.fbc summary .uname[data-user="alpha"]', "alpha");
    await closeProfile();
    await go("logs");
    await page.waitForSelector("#ll .uname", { timeout: 8000 });
    await page.click('#ll .uname[data-user="alpha"]');
    await page.waitForSelector("#pf .pf-tabs");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#pf", { state: "detached" });
    assert.equal(profileCalls, 6, "one call per window (users, rooms, bans, orders, feedback, logs)");
    assert.equal((await h.api("a_user_set", { atoken: owner.atoken, id: "alpha", op: "note", note: "still alpha" })).status, 200);

    // 4. a phone-width window still shows its tables
    await page.setViewportSize({ width: 390, height: 800 });
    await openFrom("users", '#ul .uname[data-user="alpha"]', "alpha");
    await tab("all");
    assert.ok(await page.$$eval("#pf-list th", (t) => t.length === 3 && t.every((x) => x.offsetParent)), "all three columns stay on a phone");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no sideways scroll on the page");
    await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/profile-phone.png" : "/tmp/profile-phone.png" });
    assert.deepEqual(errors, []);
    console.log("user profile: one window from every table, six sections, filter + CSV, phone width");
  } finally { await browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
