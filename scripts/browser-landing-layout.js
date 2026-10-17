const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The first screen after signing in (index.html): on a desktop window the title sits left and the profile card
// with the way into the game sits right, so the button is in view at 1280 x 720 (the single 440 px column put it
// at y = 728); phones and short landscape windows keep their layouts and nothing scrolls sideways anywhere.
const SIZES = [[1920, 1080, 1], [1366, 768, 1], [1280, 720, 1], [1024, 768, 1], [768, 1024, 0], [390, 844, 0], [360, 640, 0], [844, 390, 0]];
(async () => {
  const f = await fixture(), seen = [];
  try {
    for (const [width, height, desktop] of SIZES) {
      const touch = width < 900;
      const page = await f.page("land" + width, { width, height }, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : {});
      await page.evaluate(() => localStorage.setItem("lgp_lang", "ko"));
      await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/index.html", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => { const e = document.getElementById("enter"); return e && e.getBoundingClientRect().height > 0; }, null, { timeout: 15000 });
      const r = await page.evaluate(() => {
        const e = document.getElementById("enter").getBoundingClientRect(), h = document.querySelector(".hero h1").getBoundingClientRect(), c = document.querySelector(".card").getBoundingClientRect();
        return { top: Math.round(e.top), bottom: Math.round(e.bottom), heroRight: Math.round(h.right), cardLeft: Math.round(c.left), scrollW: document.documentElement.scrollWidth, winW: innerWidth, winH: innerHeight };
      });
      seen.push([width, height, r.bottom]);
      assert.ok(r.scrollW <= r.winW, width + "x" + height + ": nothing scrolls sideways (" + r.scrollW + " > " + r.winW + ")");
      if (desktop) {
        assert.ok(r.bottom <= r.winH - 8, width + "x" + height + ": the way in is in view (bottom " + r.bottom + " of " + r.winH + ")");
        assert.ok(r.heroRight < r.cardLeft, width + "x" + height + ": the title and the card stand side by side");
      }
      await page.context().close();
    }
    assert.deepEqual(f.errors, []);
    console.log("landing layout: button in view on desktop windows " + JSON.stringify(seen.filter((s) => s[0] >= 1000)) + ", no sideways scroll anywhere");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
