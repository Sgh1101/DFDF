const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Menus around the settings: the English page has no Korean left in the graphics presets, the motion level, the controls hint and the equipment shop (agent, weapon and
// skin names stay as they are). All failures are listed together.
const HANGUL = /[가-힣]/, bad = [];
const check = (ok, message) => { if (!ok) bad.push(message); };
(async () => {
  const f = await fixture();
  try {
    // ── English page ──
    const en = await f.page("menusen", { width: 1280, height: 720 }, {}, { bootTimeout: 120000, beforeLoad: (p) => p.addInitScript(() => { try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} }) });
    const left = (selector) => en.evaluate(([s]) => [...document.querySelectorAll(s)].map((e) => e.textContent.trim()).filter((t) => /[가-힣]/.test(t)), [selector]);
    const attr = (selector, name) => en.evaluate(([s, a]) => [...document.querySelectorAll(s)].map((e) => e.getAttribute(a) || "").filter((t) => /[가-힣]/.test(t)), [selector, name]);
    await en.click("#go-set");
    await en.click('#pause .pz-tabs button[data-tab=gfx]');
    for (const [selector, what] of [["#st-quality .pz-q", "graphics preset names"], ["#st-q-desc", "graphics preset description"]]) { const l = await left(selector); check(!l.length, "English " + what + " still Korean: " + l.join(" | ")); }
    const t = await attr("#st-quality .pz-q", "title"); check(!t.length, "English graphics preset tooltips still Korean: " + t.join(" | "));
    await en.click('#pause .pz-tabs button[data-tab=fx]');
    for (const level of [0, 35, 70, 100, 140, 200]) {
      await en.evaluate((v) => { const e = document.getElementById("st-motion"); e.value = v; e.dispatchEvent(new Event("input")); }, level);
      await en.waitForTimeout(60);
      const l = await left("#st-motion-v, #st-motion-d"); check(!l.length, "English motion level " + level + "% still Korean: " + l.join(" | "));
    }
    await en.click("#pz-close");
    await en.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); });
    await en.waitForTimeout(800);
    await en.evaluate(() => { world.phase = "buy"; openShop(); });
    await en.waitForTimeout(600);
    const tips = await left("#tips"); check(!tips.length, "English controls hint still Korean: " + tips.join(" | "));
    const shop = await en.evaluate(() => {
      const out = [], kor = /[가-힣]/;
      // everything in the shop except the names of guns, skins and skills (and the descriptions of skills, which come with each agent)
      const skip = "#buy-name,#buy-skin,.sitem b,.buy-util b,#buy-preview,.buy-detail-skin";
      const root = document.getElementById("shop");
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const p = n.parentElement; if (kor.test(n.nodeValue) && !p.closest(skip)) out.push((p.id || p.className || p.tagName) + ": " + n.nodeValue.trim().slice(0, 50)); }
      for (const a of ["aria-label"]) for (const e of [root, ...root.querySelectorAll("[aria-label]")]) { const v = e.getAttribute(a) || ""; if (kor.test(v) && !e.classList.contains("sitem")) out.push("aria-label: " + v.slice(0, 50)); }
      return out;
    });
    check(!shop.length, "English equipment shop still Korean in " + shop.length + " places: " + shop.slice(0, 12).join(" | "));
    check(f.errors.length === 0, "page errors: " + f.errors.join(" | "));
    await en.context().close();
  } finally { await f.browser.close(); }
  assert.equal(bad.length, 0, "\n" + bad.join("\n"));
  console.log("map tour exit, settings control names and English menus passed");
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
