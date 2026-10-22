const fs = require("node:fs"), { fixture } = require("./browser-fixture"), { AUDIT_SRC } = require("./ui-audit-lib");
// UI audit: every main screen at phone, tablet and desktop sizes; reports controls that are cut off,
// covered (a tap would land elsewhere), too small, drawn over each other, or text that spills out.
// DFDF_UI_ONLY=title,select limits the screens; DFDF_UI_SHOTS=dir saves a picture of every problem screen.
const VIEWS = [
  ["phone-568x320", 568, 320, 1], ["phone-667x375", 667, 375, 1], ["phone-740x360", 740, 360, 1], ["phone-844x390", 844, 390, 1], ["phone-932x430", 932, 430, 1],
  ["tablet-1024x768", 1024, 768, 1], ["laptop-1280x720", 1280, 720, 0], ["desktop-1920x1080", 1920, 1080, 0],
];
const only = (process.env.DFDF_UI_ONLY || "").split(",").filter(Boolean), viewOnly = (process.env.DFDF_UI_VIEWS || "").split(",").filter(Boolean);
(async () => {
  const f = await fixture(), found = [], shots = process.env.DFDF_UI_SHOTS;
  shots && fs.mkdirSync(shots, { recursive: true });
  try {
    for (const [name, width, height, touch] of VIEWS) {
      if (viewOnly.length && !viewOnly.some((v) => name.includes(v))) continue;
      const page = await f.page("ui" + name.replace(/\D/g, ""), { width, height }, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {});
      await page.addScriptTag({ content: "window.__noop=1" });
      await page.evaluate((src) => { eval(src); titleCam = () => {}; }, AUDIT_SRC);
      const run = async (screen, prep, hide) => {
        if (only.length && !only.includes(screen)) return;
        try { await prep(); } catch (e) { found.push({ view: name, where: screen, kind: "could-not-open", error: String(e.message).slice(0, 120) }); return; }
        await page.waitForTimeout(450);
        // what lies behind an overlay is not the screen being looked at
        const out = await page.evaluate(([s, t, h]) => { const hid = (h || []).flatMap((q) => [...document.querySelectorAll(q)]); hid.forEach((e) => (e.style.visibility = "hidden")); const r = window.__audit(s, { touch: t }); hid.forEach((e) => (e.style.visibility = "")); return r; }, [screen, touch, hide]);
        for (const o of out) found.push({ view: name, ...o });
        if (shots && (out.length || process.env.DFDF_UI_ALL)) await page.screenshot({ path: `${shots}/${name}-${screen}.png` });
      };
      const back = () => page.evaluate(() => { for (const id of ["armory", "pause", "shop", "lobby"]) { const e = document.getElementById(id); e && (e.hidden = true); } try { GUN_SKINS.close(); } catch (e) {} try { closeShop(); } catch (e) {} document.querySelector(".home-practice") && (document.querySelector(".home-practice").open = false); show("s-title"); });
      const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
      await run("title", async () => { await back(); });
      await run("title-practice", async () => { await back(); await click(".home-practice summary"); }, ["#s-title .tt-left"]);
      await run("select", async () => { await back(); await click("#go-play"); });
      await run("select-practice", async () => { await back(); await click("#go-range"); });
      for (const cat of ["full", "small", "1v1"]) await run("select-maps-" + cat, async () => { await back(); await click("#go-play"); await page.evaluate((c) => { const b = [...document.querySelectorAll("#s-select .lb-tab, #s-select [data-cat], #s-select .map-tabs button")].find((x) => (x.dataset.cat || x.dataset.c || x.textContent).includes(c) || false); b && b.click(); }, cat === "full" ? "5" : cat === "small" ? "3" : "1"); });
      await run("settings", async () => { await back(); await click("#go-set"); }, ["#s-title"]);
      await run("armory-guns", async () => { await back(); await page.evaluate(() => GUN_SKINS.open("rifle", "gun")); }, ["#s-title"]);
      for (const tab of ["knife", "shop", "cos", "mine", "champions"]) await run("armory-" + tab, async () => {
        await back();
        await page.evaluate((t) => GUN_SKINS.open(t === "knife" ? "knife" : "rifle", "gun"), tab);
        if (tab !== "knife") await page.locator(tab === "cos" ? "#ar-tab-cos" : '#ar-tabs [data-tab="' + tab + '"]').click();
        const active = tab === "knife" ? "gun" : tab;
        await page.locator("#ar-p-" + active).waitFor({ state: "visible", timeout: 10000 });
      }, ["#s-title"]);
      await run("multi", async () => { await back(); await click("#go-multi"); });
      // in a match
      await page.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); });
      await page.waitForTimeout(600);
      await run("game-buy", async () => { await page.evaluate(() => { world.phase = "buy"; openShop(); }); }, ["#hud"]);
      await run("game-live", async () => { await page.evaluate(() => { closeShop(); world.phase = "live"; myActor().nades = 2; }); await page.waitForTimeout(900); });
      await run("game-scoreboard", async () => { await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { code: "Tab", key: "Tab" }))); }, ["#hud", "#touch", "#lockhint"]);
      await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keyup", { code: "Tab", key: "Tab" })));
      await page.evaluate(() => { try { document.getElementById("bd-x").click(); } catch (e) {} });
      await run("game-pause", async () => { await page.evaluate(() => { try { openPause(); } catch (e) { document.getElementById("pause").hidden = false; } }); }, ["#hud"]);
      await run("game-over", async () => { await page.evaluate(() => { document.getElementById("pause").hidden = true; world.round = 3; world.scoreAtk = 13; world.over = true; gameOver(); }); });
      await page.context().close();
    }
    fs.writeFileSync(process.env.DFDF_UI_OUT || "/tmp/ui-audit.json", JSON.stringify(found, null, 1));
    const by = {};
    for (const p of found) (by[p.kind] = by[p.kind] || []).push(p);
    for (const [k, v] of Object.entries(by)) console.log(k, v.length);
    console.log("pages errors:", f.errors.length ? f.errors.slice(0, 3) : 0);
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
