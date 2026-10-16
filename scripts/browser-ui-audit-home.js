const fs = require("node:fs"), { fixture } = require("./browser-fixture"), { AUDIT_SRC } = require("./ui-audit-lib");
// The same audit for the homepage (index.html): phones in both directions, tablet, desktop.
const VIEWS = [["phone-390x844", 390, 844, 1], ["phone-360x640", 360, 640, 1], ["phone-320x568", 320, 568, 1], ["phone-844x390", 844, 390, 1], ["tablet-768x1024", 768, 1024, 1], ["laptop-1280x720", 1280, 720, 0]];
(async () => {
  const f = await fixture(), found = [], shots = process.env.DFDF_UI_SHOTS;
  shots && fs.mkdirSync(shots, { recursive: true });
  try {
    for (const [name, width, height, touch] of VIEWS) {
      const page = await f.page("home" + width, { width, height }, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {});
      await page.evaluate(() => localStorage.setItem("lgp_lang", "ko"));
      await page.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/index.html", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      await page.evaluate((src) => eval(src), AUDIT_SRC);
      const run = async (screen, prep) => {
        try { await prep(); } catch (e) { found.push({ view: name, where: screen, kind: "could-not-open", error: String(e.message).slice(0, 100) }); return; }
        await page.waitForTimeout(500);
        const out = await page.evaluate(([s, t]) => window.__audit(s, { touch: t }), [screen, touch]);
        for (const o of out) found.push({ view: name, ...o });
        if (shots && (out.length || process.env.DFDF_UI_ALL)) await page.screenshot({ path: `${shots}/${name}-${screen}.png`, fullPage: true });
      };
      await run("home", async () => {});
      await run("home-scrolled", async () => { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); });
      await page.context().close();
    }
    fs.writeFileSync(process.env.DFDF_UI_OUT || "/tmp/ui-audit-home.json", JSON.stringify(found, null, 1));
    const by = {};
    for (const p of found) (by[p.kind] = by[p.kind] || []).push(p);
    for (const [k, v] of Object.entries(by)) console.log(k, v.length);
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
