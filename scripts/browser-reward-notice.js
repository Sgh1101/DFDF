const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// A match whose ticket the server would not give (its limit on matches started) used to end with no reward and nothing
// said, past a two-second banner at its start. The result screen now says the match brought nothing and why; the next
// match that gets its ticket shows its reward as before.
(async () => {
  const f = await fixture(), dir = process.env.SHOT_DIR || "test-results";
  fs.mkdirSync(dir, { recursive: true });
  try {
    const page = await f.page("rewarder", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("lgp_session")).token);
    // twelve matches started in the last ten minutes: the server's limit
    for (let i = 0; i < 12; i++) assert.equal((await f.h.api("match_start", { token })).status, 200);
    // a match started as from the title screen (startGame → lobbyStart asks for its ticket)
    const play = async () => {
      await page.evaluate(() => { titleCam = () => {}; render = () => {}; room.mode = "std"; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; });
      await page.waitForTimeout(800);
    };
    // the notice as a player sees it: on the result screen, inside the window, and nothing over it
    const notice = () => page.evaluate(() => {
      const c = document.getElementById("ov-noreward");
      if (!c || c.hidden || document.getElementById("s-over").hidden) return { shown: false, text: c ? c.textContent : "" };
      const r = c.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { shown: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && !!hit && (hit === c || c.contains(hit)), text: c.textContent };
    });
    const end = async () => {
      await page.evaluate(() => { world.over = !1; gameOver(); });
      await page.waitForTimeout(1500);
      return notice();
    };
    await play();
    const none = await end();
    assert.equal(none.shown, true, "the result screen says the match brought nothing");
    assert.match(none.text, /보상 없음/); assert.match(none.text, /너무 자주 시작/);
    await page.screenshot({ path: dir + "/reward-notice.png" });
    // on a phone in landscape too
    await page.setViewportSize({ width: 852, height: 393 }); await page.waitForTimeout(400);
    assert.equal((await notice()).shown, true, "the notice shows on a phone-sized screen");
    await page.screenshot({ path: dir + "/reward-notice-phone.png" });
    await page.setViewportSize({ width: 1280, height: 720 });
    console.log("a match without its ticket says so on the result screen:", none.text);
    // ten minutes on, a match gets its ticket again: its reward comes, and the notice is gone
    f.h.advance(601000);
    await page.evaluate(() => { world.phase = "menu"; });
    await play();
    f.h.advance(61000);
    const xp = f.h.user("rewarder").xp || 0;
    const fine = await end();
    await page.waitForFunction((x) => (JSON.parse(localStorage.getItem("lgp_session")).user.xp || 0) > x, xp, { timeout: 20000 });
    assert.equal(fine.shown, false, "no notice after a match that got its ticket");
    assert.ok((f.h.user("rewarder").xp || 0) > xp, "that match's reward came");
    assert.deepEqual(f.errors, [], "no page errors");
    console.log("the next match with a ticket is rewarded, and the notice is gone");
  } finally {
    await f.browser.close();
  }
  console.log("reward notice passed");
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
