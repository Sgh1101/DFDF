const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The Champions tab of the armory: its own card describes the skin and plays its sounds (the generic sound strip steps
// aside, so nothing on the page says "default / rifle"), the card is in the Transcendent colour, the side switch picks
// the attack or defense skin on the Phantom, and a preview button shows it is playing and settles again.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("champpanel", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById("go-armory").click());
    await page.waitForTimeout(1200);
    const stripOther = await page.evaluate(() => getComputedStyle(document.getElementById("skin-samples")).display);
    assert.notEqual(stripOther, "none", "the sound strip is shown on the other tabs");
    await page.evaluate(() => [...document.querySelectorAll("#ar-tabs .ar-tab")].find((b) => b.dataset.tab === "champions").click());
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
      const panel = document.getElementById("phantom-panel"), out = {};
      out.strip = getComputedStyle(document.getElementById("skin-samples")).display;
      out.title = panel.querySelector("h3").textContent;
      out.rar = panel.querySelector(".pp-rar").textContent;
      out.accent = getComputedStyle(panel).getPropertyValue("--rc").trim();
      out.tier = SKIN_TIERS.list.find((row) => row.id === 5).c;
      out.buttons = [...panel.querySelectorAll("[data-phantom-demo]")].map((b) => b.dataset.phantomDemo);
      out.skins = GUN_SKINS.list.filter((s) => /^champions_/.test(s.id)).map((s) => s.id + ":" + GUN_SKINS.fits(s, "scout") + ":" + GUN_SKINS.fits(s, "rifle"));
      panel.querySelector('[data-phantom-skin="champions_def"]').click();
      await new Promise((res) => setTimeout(res, 300));
      out.side = [...panel.querySelectorAll("[data-phantom-skin]")].map((b) => b.getAttribute("aria-pressed")).join();
      const shot = panel.querySelector('[data-phantom-demo="shot"]');
      shot.click(); out.playing = shot.classList.contains("playing");
      await new Promise((res) => setTimeout(res, 1100));
      out.settled = !shot.classList.contains("playing");
      shot.click(); document.getElementById("phantom-stop").click(); out.stopped = !shot.classList.contains("playing");
      return out;
    });
    assert.equal(r.strip, "none", "the generic strip steps aside on the Champions tab");
    assert.match(r.title, /챔피언스 팬텀/); assert.equal(r.rar, "초월");
    assert.equal(r.accent.toLowerCase(), r.tier.toLowerCase(), "the card wears the Transcendent colour");
    assert.deepEqual(r.buttons, ["shot", "kill", "fin", "inspect", "reload"]);
    assert.deepEqual(r.skins, ["champions_atk:true:false", "champions_def:true:false"], "the Champions skins are Phantom only");
    assert.equal(r.side, "false,true", "the side switch follows the choice");
    assert.ok(r.playing && r.settled && r.stopped, "a preview button shows it plays, settles, and stops");
    console.log("Champions panel: tinted card in the Transcendent colour, Phantom-only skins, side switch, preview buttons that play and settle, sound strip hidden on this tab only");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
