const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// The button-layout editor's bar (#mbe-bar) on small landscape phones. It sits top centre, but was only allowed half the
// screen's width (a fixed box at left:50% shrinks to the room to its right), so its rows stacked four high and covered the
// left fire button (and, once widened, the minimap and the menu buttons in the top corners). Now it is as wide as its
// content, between the corner parts, and loses its title and hint on a low screen: at every size below, no touch part is
// under it, it lies inside the screen, and its buttons can be pressed.
const SIZES = [[568, 320], [640, 360], [667, 375], [740, 360], [844, 390]];
(async () => {
  const f = await fixture(), dir = process.env.SHOT_DIR || "test-results", bad = [];
  fs.mkdirSync(dir, { recursive: true });
  const check = (ok, message) => { if (!ok) bad.push(message); };
  try {
    for (const [w, h] of SIZES) {
      const page = await f.page("editbar" + w, { width: w, height: h }, { hasTouch: true, isMobile: true }, { bootTimeout: 120000 });
      await page.evaluate(() => { titleCam = () => {}; setTouchMode(true); room.mode = "std"; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = "live"; document.getElementById("pause").hidden = true; });
      await page.waitForTimeout(700);
      await page.evaluate(() => TOUCHLAY.open());
      await page.waitForFunction(() => !!document.getElementById("mbe-bar"), null, { timeout: 15000 });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const rect = document.getElementById("mbe-bar").getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
        const under = [...document.querySelectorAll(".mbe-part")].map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.width > 0 && x.r.height > 0).map((x) => {
          const ox = Math.max(0, Math.min(x.r.right, rect.right) - Math.max(x.r.left, rect.left)), oy = Math.max(0, Math.min(x.r.bottom, rect.bottom) - Math.max(x.r.top, rect.top));
          return { id: x.e.id || x.e.className, covered: (ox * oy) / (x.r.width * x.r.height) };
        }).filter((x) => x.covered > 0.02);
        // each button can be pressed where it is: what is on top at its centre is the button
        const pressable = ["mbe-one", "mbe-all", "mbe-save", "mbe-x", "mbe-size"].map((id) => {
          const b = document.getElementById(id).getBoundingClientRect(), top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return { id, ok: b.width > 0 && b.left >= 0 && b.right <= vw && b.top >= 0 && b.bottom <= vh && !!top && (top.id === id || top.closest("#" + id) !== null || document.getElementById(id).contains(top)) };
        });
        return { bar: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, vw, vh, under, pressable };
      });
      const tag = w + "x" + h;
      check(r.bar.left >= 0 && r.bar.right <= r.vw && r.bar.top >= 0 && r.bar.bottom <= r.vh, tag + ": the bar lies inside the screen " + JSON.stringify(r.bar));
      check(r.bar.bottom - r.bar.top <= 0.3 * r.vh, tag + ": the bar is at most 30% of the screen's height (" + Math.round(r.bar.bottom - r.bar.top) + " of " + r.vh + ")");
      check(!r.under.length, tag + ": touch parts under the bar: " + r.under.map((x) => x.id + " " + x.covered.toFixed(2)).join(", "));
      check(r.pressable.every((x) => x.ok), tag + ": every control can be pressed: " + JSON.stringify(r.pressable.filter((x) => !x.ok)));
      await page.screenshot({ path: dir + "/touch-editor-bar-" + w + ".png" });
      await page.context().close();
    }
    check(f.errors.length === 0, "page errors: " + f.errors.join(" | "));
  } finally { await f.browser.close(); }
  assert.equal(bad.length, 0, "\n" + bad.join("\n"));
  console.log("the layout editor's bar covers no touch part at " + SIZES.map((s) => s.join("x")).join(", "));
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
