const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Design review fixes:
//  · desktop HUD: the touch-only swap arrows are not drawn with a mouse, and the credit line shows in the buy
//    phase only (the ammo panel was 234 px tall)
//  · the result screen: at 1280x720 the whole result fits without scrolling; on a 844x390 phone the MVP card
//    is clear of the button bar
//  · phone armory: the picked gun is in view (clear of the edge fade) in the sideways gun row, the row keeps its
//    place when a gun is picked, and a row with more to scroll fades on that side
//  · settings and the ranked card never leave 1-2 letters alone on a line
//  · an agent card waiting for its portrait shows a figure in the agent's colour
//  · result-screen and armory skin-card labels are 11 px or larger
//  · 내 스킨 with a few skins ends with a card that leads to the shop and the pull
//  · phone armory 660px and wider: the skin tier guide is a chip in the top bar, not a row of its own, and its
//    table opens on screen; at 568px it keeps its row so every tab fits
const orphans = (root) => {
  const out = [], walk = document.createTreeWalker(document.querySelector(root), NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode()); ) {
    const e = n.parentElement;
    if (n.textContent.trim().length < 6 || !e.offsetParent) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const lines = [];
    for (const r of range.getClientRects()) { if (!r.width) continue; const l = lines.find((x) => Math.abs(x.top - r.top) < 3); l ? (l.w += r.width) : lines.push({ top: r.top, w: r.width }); }
    lines.sort((a, b) => a.top - b.top);
    if (lines.length > 1 && lines[lines.length - 1].w < parseFloat(getComputedStyle(e).fontSize) * 2.2) out.push(n.textContent.trim());
  }
  return out;
};
const small = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.textContent.trim().slice(0, 20) + " " + getComputedStyle(e).fontSize);
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("polish1280", { width: 1280, height: 720 });
    await page.evaluate(() => { titleCam = () => {}; });
    // settings: no lone letters
    await page.evaluate(() => document.getElementById("go-set").click());
    await page.waitForTimeout(700);
    assert.deepEqual(await page.evaluate(orphans, "#pause"), [], "settings lines end with whole words");
    await page.evaluate(() => { document.getElementById("pause").hidden = true; show("s-title"); });
    // agent select: a card without its portrait yet carries the placeholder figure (one card's picture is taken
    // away, so the check does not depend on how fast the portraits are drawn)
    await page.evaluate(() => document.getElementById("go-play").click());
    await page.waitForTimeout(300);
    const wait = await page.evaluate(() => { const c = document.querySelectorAll("#sel-grid .acard")[3]; c.querySelector(".acard-img").removeAttribute("src"); return getComputedStyle(c).backgroundImage; });
    assert.ok((wait.match(/radial-gradient/g) || []).length >= 3, "a waiting agent card shows the placeholder figure: " + wait);
    // armory: skin-card labels, then 내 스킨's way to more skins
    await page.evaluate(() => { show("s-title"); GUN_SKINS.open("rifle", "gun"); });
    await page.locator('#ar-tabs [data-tab="shop"]').click();
    await page.locator("#sh-list .it").first().waitFor({ timeout: 45000 });
    assert.deepEqual(await page.evaluate(small, "#sh-list .it small, #sh-list .it i"), [], "shop card labels are 11px or larger");
    await page.locator('#ar-tabs [data-tab="gun"]').click();
    await page.locator("#ar-skins .ar-sk").first().waitFor({ timeout: 45000 });
    assert.deepEqual(await page.evaluate(small, "#ar-skins .ar-sk i"), [], "by-gun skin tile labels are 11px or larger");
    await page.locator('#ar-tabs [data-tab="mine"]').click();
    await page.waitForTimeout(400);
    const mine = await page.evaluate(() => ({ cards: document.querySelectorAll("#mi-list .it").length, more: !!document.querySelector("#mi-list .mi-more"), empty: !!document.querySelector("#mi-list .mi-empty"), worn: [...document.querySelectorAll("#mi-list .it.eq")].map((e) => getComputedStyle(e, "::after").fontSize) }));
    assert.ok(mine.worn.every((v) => parseFloat(v) >= 11), "the worn badge is 11px or larger: " + mine.worn);
    if (!mine.cards) assert.ok(mine.empty && !mine.more, "an empty collection shows its own message, not the extra card");
    else if (mine.cards >= 8) assert.ok(!mine.more, "a full collection has no extra card");
    else {
      assert.ok(mine.more, "a short collection ends with the card to more skins");
      await page.locator('#mi-list .mi-more [data-go="shop"]').click();
      assert.equal(await page.evaluate(() => document.querySelector("#ar-tabs .ar-tab.on").dataset.tab), "shop", "the card's 상점 opens the shop tab");
    }
    await page.evaluate(() => { document.getElementById("armory").hidden = true; try { GUN_SKINS.close(); } catch (e) {} show("s-title"); });
    // HUD in a match
    await page.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { world.phase = "buy"; updateHUD(); });
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("am-credit")).display !== "none"), true, "credits show in the buy phase");
    await page.evaluate(() => { world.phase = "live"; updateHUD(); });
    await page.waitForTimeout(200);
    const hud = await page.evaluate(() => ({ swap: getComputedStyle(document.querySelector("#ammo .am-swap")).display, credit: getComputedStyle(document.getElementById("am-credit")).display, h: document.getElementById("ammo").getBoundingClientRect().height }));
    assert.equal(hud.swap, "none", "no swap arrows with a mouse");
    assert.equal(hud.credit, "none", "no credit line in a fight");
    assert.ok(hud.h < 120, "the ammo panel is compact: " + hud.h);
    // the result screen fits a 1280x720 laptop
    await page.evaluate(() => { world.round = 3; world.scoreAtk = 13; world.over = true; gameOver(); });
    await page.waitForTimeout(700);
    const over = await page.evaluate(() => { const o = document.getElementById("s-over"), bar = document.getElementById("ov-again").parentElement.getBoundingClientRect(), board = document.getElementById("ov-board").getBoundingClientRect(); return { scroll: o.scrollHeight - o.clientHeight, boardBottom: board.bottom, barTop: bar.top, small: [...o.querySelectorAll("*")].filter((e) => e.offsetParent && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.textContent.trim().slice(0, 12)) }; });
    assert.ok(over.scroll <= 1, "the result fits without scrolling: " + over.scroll);
    assert.ok(over.boardBottom <= over.barTop + 1, "the table ends above the buttons");
    assert.deepEqual(over.small, [], "result labels are 11px or larger");
    await page.context().close();

    const phone = await f.page("polish844", { width: 844, height: 390 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await phone.evaluate(() => { titleCam = () => {}; });
    // the ranked card
    await phone.evaluate(() => document.getElementById("go-multi").click());
    await phone.waitForTimeout(700);
    assert.deepEqual(await phone.evaluate(orphans, "#mu-rank"), [], "the ranked card ends lines with whole words");
    // armory: the picked gun is in view clear of the edge fade, the row remembers its place and fades where it has
    // more to scroll
    await phone.evaluate(() => { show("s-title"); GUN_SKINS.open("rifle", "gun"); });
    await phone.locator('#ar-tabs [data-tab="gun"]').click();
    await phone.waitForTimeout(800);
    const inView = () => phone.evaluate(() => { const g = document.getElementById("ar-guns"), row = g.getBoundingClientRect(), on = document.querySelector("#ar-guns .ar-gun.on").getBoundingClientRect(); const atStart = g.scrollLeft < 2, atEnd = g.scrollLeft + g.clientWidth > g.scrollWidth - 2; return on.left >= row.left + (atStart ? -1 : 36) && on.right <= row.right - (atEnd ? -1 : 36); });
    assert.ok(await inView(), "the picked gun is in view, clear of the fades");
    const fades = () => phone.evaluate(() => [...document.getElementById("ar-guns").classList].filter((c) => c.startsWith("sfade")).sort().join(" "));
    await phone.evaluate(() => { const g = document.getElementById("ar-guns"); g.scrollLeft = 0; g.dispatchEvent(new Event("scroll")); });
    await phone.waitForFunction(() => { const c = document.getElementById("ar-guns").classList; return c.contains("sfade-r") && !c.contains("sfade-l"); });
    await phone.evaluate(() => { const g = document.getElementById("ar-guns"); g.scrollLeft = g.scrollWidth; g.dispatchEvent(new Event("scroll")); });
    await phone.waitForFunction(() => { const c = document.getElementById("ar-guns").classList; return c.contains("sfade-l") && !c.contains("sfade-r"); });
    assert.equal(await fades(), "sfade-l", "at the end of the row only the start fades");
    // scrolled along the row, a tap on a gun in view keeps the row where it was (it used to jump back to the start)
    const kept = await phone.evaluate(() => {
      const g = document.getElementById("ar-guns"); g.scrollLeft = 300;
      const row = g.getBoundingClientRect(), b = [...g.querySelectorAll(".ar-gun:not(.on)")].find((x) => { const r = x.getBoundingClientRect(); return r.left > row.left + 50 && r.right < row.right - 50; });
      b.click(); return [300, g.scrollLeft];
    });
    assert.ok(Math.abs(kept[1] - kept[0]) <= 1, "the gun row keeps its place: " + kept);
    assert.ok(await inView(), "the picked gun is in view after the row is rebuilt");
    await phone.evaluate(() => { document.getElementById("armory").hidden = true; try { GUN_SKINS.close(); } catch (e) {} show("s-title"); });
    // the tier guide: a chip in the top bar on phones 660px and wider (where the browser can anchor it), its table
    // on screen; at 568px it keeps its row and every tab fits
    for (const [w, h] of [[844, 390], [667, 375], [568, 320]]) {
      await phone.setViewportSize({ width: w, height: h });
      await phone.evaluate(() => GUN_SKINS.open("rifle", "gun"));
      await phone.waitForTimeout(600);
      const tier = await phone.evaluate(() => { const hd = document.querySelector("#armory .ar-hd").getBoundingClientRect(), g = document.getElementById("skin-tier-guide").getBoundingClientRect(), tabs = document.getElementById("ar-tabs"), gold = document.getElementById("ar-gold").getBoundingClientRect(), last = [...tabs.querySelectorAll(".ar-tab")].pop().getBoundingClientRect(); return { chip: getComputedStyle(document.getElementById("skin-tier-guide")).position === "absolute", anchored: CSS.supports("anchor-name:--a"), inBar: g.top >= hd.top - 1 && g.bottom <= hd.bottom + 1, clearTabs: g.left >= last.right - 1, clearGold: g.right <= gold.left + 1, tabsFit: tabs.scrollWidth <= tabs.clientWidth + 1 }; });
      if (w >= 660 && tier.anchored) {
        assert.deepEqual([tier.chip, tier.inBar, tier.clearTabs, tier.clearGold], [true, true, true, true], w + ": the tier guide is a chip in the top bar " + JSON.stringify(tier));
        await phone.locator("#skin-tier-guide summary").tap();
        const table = await phone.evaluate(() => { const r = document.querySelector("#skin-tier-guide .skin-tier-scroll").getBoundingClientRect(); return { on: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.height > 60, r: [r.left, r.right, r.top, r.height].map(Math.round) }; });
        assert.ok(table.on, w + ": the opened tier table is on screen " + JSON.stringify(table.r));
        await phone.locator("#skin-tier-guide summary").tap();
      } else assert.equal(tier.chip, false, w + ": the tier guide keeps its row");
      assert.ok(tier.tabsFit, w + ": every armory tab fits the bar");
      await phone.evaluate(() => { document.getElementById("armory").hidden = true; try { GUN_SKINS.close(); } catch (e) {} });
    }
    await phone.setViewportSize({ width: 844, height: 390 });
    // the result screen on a phone: the MVP card is clear of the buttons
    await phone.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); });
    await phone.waitForTimeout(600);
    await phone.evaluate(() => { world.round = 3; world.scoreAtk = 13; world.over = true; gameOver(); });
    await phone.waitForTimeout(700);
    const mvp = await phone.evaluate(() => ({ mvp: document.querySelector("#ov-board .ovb-mvp").getBoundingClientRect().bottom, bar: document.getElementById("ov-again").parentElement.getBoundingClientRect().top }));
    assert.ok(mvp.mvp <= mvp.bar, "the MVP card is above the buttons: " + JSON.stringify(mvp));
    await phone.context().close();
    console.log("design polish: ok");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
