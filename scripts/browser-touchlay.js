const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Touch layout: what the editor shows is what the match shows. After moving parts and saving, every part sits in the same box
// in the editor and in the match, at two phone sizes (the top strip used to stand on end in the editor and lie down in the match).
(async () => {
  const f = await fixture();
  try {
    for (const [w, h] of [[844, 390], [932, 430]]) {
      const page = await f.page("tlay" + w, { width: w, height: h }, { hasTouch: true, isMobile: true });
      await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; document.body.classList.add("touching"); });
      await page.waitForTimeout(1200);
      const SEL = { fire: "#tb-fire", ads: "#tb-ads", jump: "#tb-jump", rel: "#tb-rel", nade: "#tb-nade", tab0: '#tabil .tab[data-a="0"]', tab3: '#tabil .tab[data-a="3"]', util: "#mb-util", mini: "#mini" };
      const rects = () => page.evaluate((SEL) => Object.fromEntries(Object.entries(SEL).map(([k, s]) => { const r = document.querySelector(s).getBoundingClientRect(); return [k, [r.left, r.top, r.width, r.height].map((v) => Math.round(v))]; })), SEL);
      await page.evaluate(() => { togglePause(true); TOUCHLAY.open(); });
      await page.waitForTimeout(400);
      await page.evaluate(() => { TOUCHLAY.set("tb-fire", [0.82, 0.62, 1.2]); TOUCHLAY.set("tb-jump", [0.9, 0.4, 1]); TOUCHLAY.set("tab-0", [0.3, 0.8, 1]); TOUCHLAY.set("mb-util", [0.5, 0.12, 1]); TOUCHLAY.set("mini", [0.15, 0.2, 1]); TOUCHLAY.set("tb-nade", [0.6, 0.25, 1]); });
      const editing = await rects();
      await page.evaluate(() => TOUCHLAY.close(true));
      await page.evaluate(() => togglePause(false));
      await page.waitForTimeout(1200);
      const playing = await rects();
      for (const k of Object.keys(SEL)) for (let i = 0; i < 4; i++) assert.ok(Math.abs(editing[k][i] - playing[k][i]) <= 1, `${w}x${h} ${k}: editor ${editing[k]} vs match ${playing[k]}`);
      // the strip is lying down (wider than tall) in both
      assert.ok(playing.util[2] > playing.util[3] && editing.util[2] > editing.util[3], "the top strip keeps its shape");
      // wiped inline places are put back
      await page.evaluate(() => { const e = document.getElementById("tb-fire"); e.style.removeProperty("left"); e.style.removeProperty("top"); });
      await page.waitForFunction(() => !!document.getElementById("tb-fire").style.getPropertyValue("left"), null, { timeout: 12000 });
    }
    assert.deepEqual(f.errors, []);
    console.log("touch layout: the editor and the match show every part in the same place and shape, wiped places come back");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
