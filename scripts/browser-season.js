const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Ranked seasons: an account seen after its season ended gets the reward for its tier, the
// season skin (월계관) on every gun from Gold up, its RR cut; the title screen says so once
// (and the homepage too, gone from both once seen), the tier chip names the season and the
// days left. The season skin is never offered: in the armoury it says how it is earned.
(async () => {
  const f = await fixture();
  try {
    const dir = process.env.SHOT_DIR || "/tmp";
    const page = await f.page("seasoned", { width: 1280, height: 800 });
    // the season this account played: four counted ranked matches, Platinum 2 (1300 RR)
    const u = f.h.user("seasoned");
    assert.equal(u.ssn.n, 1);
    Object.assign(u.ssn, { played: 4 });
    u.rr = 1300;
    f.h.db.set("user:seasoned", JSON.stringify(u));
    const gold0 = u.gold;
    // the owner ends it now
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "season-owner" });
    const c = JSON.parse(JSON.stringify((await f.h.api("a_config_get", { atoken: owner.atoken })).config));
    c.season.skip = 1;
    assert.equal((await f.h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 200);
    f.h.advance(31000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading);
    await page.waitForSelector("#ssn-note:not([hidden])", { timeout: 20000 });
    const text = await page.evaluate(() => document.getElementById("ssn-note").textContent);
    assert.match(text, /시즌 1 종료 — 플래티넘 2로 마쳤습니다\. 보상 🪙1,000 · 전용 스킨 「월계관」 총 19종 · RR은 650부터 다시/);
    const after = f.h.user("seasoned");
    assert.deepEqual([after.gold - gold0, after.rr, after.ssn.n, after.ssnLog.length], [1000, 650, 2, 1]);
    await page.screenshot({ path: dir + "/season-note.png" });
    // the tier chip: the new season and the days left
    await page.waitForFunction(() => /시즌 2 · \d+일 남음 · 랭크전 0판 \(보상까지 3판 더\)/.test((document.getElementById("rank-chip") || {}).title || ""), null, { timeout: 10000 });
    // the season skin, worn on the rifle
    await page.evaluate(() => GUN_SKINS.sync());
    await page.waitForFunction(() => GUN_SKINS.owns("rifle", "laurel") && GUN_SKINS.owns("knife", "laurel"));
    await page.click("#sn-ok");
    assert.ok(await page.evaluate(() => document.getElementById("ssn-note").hidden && localStorage.getItem("lgp_ssn_seen") === "1"));
    await page.evaluate(() => GUN_SKINS.open("rifle", "gun"));
    await page.waitForSelector('#ar-skins .ar-sk[data-s="laurel"]');
    await page.click('#ar-skins .ar-sk[data-s="laurel"]');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: dir + "/season-laurel.png" });
    await page.evaluate(() => GUN_SKINS.close());
    // the homepage: the season line; the note already seen there too, until it is not
    await page.evaluate(() => localStorage.setItem("lgp_lang", "ko"));
    await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => /시즌 2 · /.test((document.getElementById("meSeason") || {}).textContent || ""), null, { timeout: 20000 });
    assert.ok(await page.evaluate(() => document.getElementById("ssnEnd").hidden));
    await page.evaluate(() => localStorage.removeItem("lgp_ssn_seen"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#ssnEnd:not([hidden])", { timeout: 20000 });
    assert.match(await page.evaluate(() => document.getElementById("ssnEnd").textContent), /시즌 1 종료 — 플래티넘 2로 마쳤습니다/);
    await page.screenshot({ path: dir + "/season-home.png" });
    await page.click("#ssnEndOk");
    assert.ok(await page.evaluate(() => document.getElementById("ssnEnd").hidden && localStorage.getItem("lgp_ssn_seen") === "1"));
    // another account, without it: the armoury says how it is earned, and offers no wishlist
    const other = await f.page("noseason", { width: 1280, height: 800 });
    await other.evaluate(() => GUN_SKINS.open("smg", "gun"));
    await other.waitForSelector('#ar-skins .ar-sk.locked[data-s="laurel"]');
    await other.click('#ar-skins .ar-sk[data-s="laurel"]');
    await other.waitForFunction(() => /시즌 보상/.test(document.getElementById("ar-cap").textContent));
    assert.equal(await other.evaluate(() => !!document.getElementById("ar-wish")), false);
    // and no bot wears it, whatever the owner allows
    assert.ok(await other.evaluate(() => { room.mode = "std"; startGame(AGENTS[0], false); return world.actors.every((a) => !a.skins || Object.values(a.skins).every((s) => s !== "laurel")); }));
    assert.deepEqual(f.errors, []);
    console.log("seasons: the reward, the season skin, the RR cut, the note on the title screen and the homepage, the season on the tier chip, the skin never offered");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
