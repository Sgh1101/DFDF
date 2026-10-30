const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The maps' names on the English page. They were Korean everywhere a map shows: the room's map list, the line under the
// title, the loading text of the original-terrain map. Here: every map of MAP_LIST, in the room's list and in a match of its
// own, has no Korean name left in any text or label; the Korean page keeps its names.
(async () => {
  const f = await fixture(), bad = [];
  const check = (ok, message) => { if (!ok) bad.push(message); };
  try {
    const scan = (page, names) => page.evaluate((names) => {
      const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) for (const k of names) if (n.nodeValue.includes(k)) out.push((n.parentElement.id || n.parentElement.className || n.parentElement.tagName) + " :: " + n.nodeValue.trim().slice(0, 60));
      for (const e of document.body.querySelectorAll("[title],[aria-label]")) for (const k of names) for (const a of ["title", "aria-label"]) (e.getAttribute(a) || "").includes(k) && out.push(a + " " + (e.id || e.className) + " :: " + e.getAttribute(a).slice(0, 60));
      return out;
    }, names);

    // the English page
    const en = await f.page("mapnamesen", { width: 1280, height: 720 }, {}, { bootTimeout: 120000, beforeLoad: (p) => p.addInitScript(() => { try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} }) });
    await en.waitForFunction(() => window.ASCENT_TRIAL && MAP_LIST.some((m) => m.key === "ascent_trial"), null, { timeout: 60000 });
    const maps = await en.evaluate(() => MAP_LIST.map((m) => [m.key, m.name]));
    check(maps.length >= 22, "setup: the map list has " + maps.length + " maps");
    await en.click("#go-play");
    await en.waitForFunction(() => document.querySelectorAll("#sel-maps button").length > 0);
    await en.waitForTimeout(500);
    const list = await scan(en, maps.map((m) => m[1]));
    check(!list.length, "English map list still has Korean names: " + list.join(" | "));
    const chips = await en.evaluate(() => [...document.querySelectorAll("#sel-maps .lb-map")].map((b) => b.textContent.trim()));
    check(chips.length >= maps.length && chips.every((t) => !/[가-힣]/.test(t)), "every map chip is English (" + chips.length + " chips): " + chips.filter((t) => /[가-힣]/.test(t)).join(" | "));
    for (const [key, name] of maps) {
      await en.evaluate((key) => { titleCam = () => {}; render = () => {}; netShutdown(); clearActors(); room.mode = "std"; room.map = key; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = "live"; }, key);
      await en.waitForTimeout(400);
      const hits = await scan(en, [name]);
      check(!hits.length, "English page, match on " + key + " still shows " + name + ": " + hits.join(" | "));
    }
    // every map that takes its turn as the map of the week (js/map-week.js) has an English name, not only this week's
    const fs = require("node:fs"), path = require("node:path"), dir = path.join(__dirname, "../js/legacy");
    const src = fs.readdirSync(dir).map((n) => fs.readFileSync(path.join(dir, n), "utf8")).join("\n");
    const weekNames = require("../js/map-week.js").CANDIDATES.map((k) => { const m = new RegExp(`(?:"key":"${k}","name":"|key: "${k}", name: ")([^"]+)"`).exec(src); return [k, m && m[1]]; });
    check(weekNames.every(([, n]) => n), "setup: a name for every map of the week: " + weekNames.filter(([, n]) => !n).map(([k]) => k).join(","));
    const untranslated = await en.evaluate((list) => list.filter(([, n]) => n && /[가-힣]/.test(GAME_EN(n))).map(([k, n]) => k + " " + n), weekNames);
    check(!untranslated.length, "maps of the week without an English name: " + untranslated.join(" | "));
    check(f.errors.length === 0, "page errors: " + f.errors.join(" | "));
    await en.context().close();

    // the Korean page is as it was
    const ko = await f.page("mapnamesko", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
    await ko.click("#go-play");
    await ko.waitForFunction(() => document.querySelectorAll("#sel-maps .lb-map").length > 0);
    const koChips = await ko.evaluate(() => [...document.querySelectorAll("#sel-maps .lb-map")].map((b) => b.textContent.trim()));
    check(koChips.includes("포구") && koChips.includes("네온 정점"), "the Korean page keeps the Korean names: " + koChips.slice(0, 4).join(", "));
    await ko.context().close();
  } finally { await f.browser.close(); }
  assert.equal(bad.length, 0, "\n" + bad.join("\n"));
  console.log("map names are English on the English page, Korean on the Korean page");
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
