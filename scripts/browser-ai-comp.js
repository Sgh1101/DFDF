const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// AI competitive in solo play (a rating of its own, apart from the real rank), in the browser on the real server code:
//  A. the select screen (desktop and a 740x360 touch phone): a "Competitive" chip with the account's AI tier; choosing it
//     locks the mode to standard, shows only the 5v5 maps and hides the category tabs; choosing another mode lets go; it is
//     off in practice, for an account with no rating (a guest) and when the owner switched it off;
//  B. the match: the fixed rules (standard, 13 rounds, ten fighters on a 5v5 map), the admin switches, cheats and the owner's
//     claim held shut by the ranked lock, the bots' skill following a seeded AI rating (Iron 0.60 ... Radiant 1.20) and a
//     normal match after it back on the humans' level; the lock goes when the match ends and when the player leaves;
//  C. a match played to its end: the report reaches the server as an AI competitive match, the AI rating moves and the real
//     rank, MMR and placement do not, the result screen has the tile (on a phone too), a normal solo match leaves the rating alone;
//  D. the homepage line with the AI tier and the record, Korean and English, desktop and phone.
const dir = process.env.SHOT_DIR || "test-results", BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
fs.mkdirSync(dir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seed = (f, id, edit) => { const u = f.h.user(id); edit(u); f.h.db.set("user:" + id, JSON.stringify(u)); };
const real = (f, id) => { const u = f.h.user(id); return JSON.stringify([u.rr, u.mmr, u.placed, u.ssn, u.rmDone]); };
// the select screen is opened, and (on a small screen) the sheet with the map and mode chips
async function openSelect(page) {
  await page.evaluate(() => { document.getElementById("go-play").click(); });
  await page.waitForFunction(() => !document.getElementById("s-select").hidden && document.getElementById("sel-comp"), null, { timeout: 30000 });
  await sleep(500);
}
const openSheet = async (page) => { const pick = await page.$("#sel-pick"); if (pick && (await pick.isVisible()) && !(await page.evaluate(() => document.querySelector("#s-select .sel-foot").classList.contains("pick-open")))) { await pick.click(); await sleep(400); } };
const chipState = (page) => page.evaluate(() => {
  const b = document.getElementById("sel-comp"), r = b.getBoundingClientRect();
  return { text: b.textContent, on: b.classList.contains("on"), disabled: b.disabled, hidden: b.hidden, title: b.title, first: document.querySelector("#sel-modes").firstChild === b,
    rect: { l: r.left, t: r.top, r: r.right, b: r.bottom }, vw: innerWidth, vh: innerHeight, aic: AI_COMP.on,
    others: [...document.querySelectorAll("#sel-modes .lb-map")].filter((x) => x !== b).map((x) => ({ t: x.textContent, on: x.classList.contains("on") })),
    maps: [...document.querySelectorAll("#sel-maps .lb-map:not(.lbm-rand)")].filter((x) => !x.hidden).length,
    nonFull: [...document.querySelectorAll("#sel-maps .lb-map:not(.lbm-rand)")].filter((x, i) => !x.hidden && "full" !== MAP_CAT(MAP_LIST[i].key)).length,
    tabs: getComputedStyle(document.querySelector("#sel-maps").previousElementSibling).display, sub: document.getElementById("sel-mode-sub").textContent, mode: room.mode, map: room.map, full: MAP_CAT(room.map),
    label: (document.querySelector("#sel-pick span") || {}).textContent || "" };
});
(async () => {
  const f = await fixture(), errors = [];
  try {
    // accounts: a gold-3 AI rating with a placed real rank (to see it stays), a new one on the phone
    await f.h.api("auth", { id: "aicsolo", pw: "password", device: "browser-test-aicsolo" });
    seed(f, "aicsolo", (u) => { u.ai = { rr: 1190, played: 12, w: 7, best: 1450 }; u.rr = 450; u.mmr = 1450; u.placed = 5; });
    await f.h.api("auth", { id: "aicphone", pw: "password", device: "browser-test-aicphone" });
    const page = await f.page("aicsolo", { width: 1280, height: 720 });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.mouse.click(640, 360);

    // ── A. the select screen on a desktop ──
    await openSelect(page); await openSheet(page);
    let c = await chipState(page);
    assert.ok(c.first && !c.on && !c.disabled && !c.hidden, "the chip is first among the modes, off, usable: " + JSON.stringify(c));
    assert.equal(c.text, "경쟁전골드 3", "it says the AI tier: " + c.text);
    assert.ok(c.others.find((x) => x.t === "일반전").on, "standard is the picked mode before");
    assert.ok(c.nonFull > 0, "all the maps are offered before (some are not 5v5)");
    const maps0 = c.maps;
    await page.screenshot({ path: dir + "/aic-select-before.png" });
    await page.click("#sel-comp"); await sleep(700); await openSheet(page);
    c = await chipState(page);
    assert.ok(c.on && c.aic && c.mode === "std", "chosen: " + JSON.stringify(c));
    assert.ok(c.others.every((x) => !x.on), "no other mode shows as picked");
    assert.ok(c.maps > 0 && c.maps < maps0 && c.nonFull === 0 && c.full === "full", `only the 5v5 maps are offered (${c.maps} of ${maps0}), the picked one is one`);
    assert.equal(c.tabs, "none", "the category tabs are away");
    assert.match(c.sub, /경쟁전 · 5대5 일반전 · 13선승 · 치트 끔 · 봇 (순한맛|보통|빡셈)/);
    assert.match(c.label, /경쟁전/, "the sheet's button says so: " + c.label);
    await page.screenshot({ path: dir + "/aic-select-on.png" });
    // the random chip picks a 5v5 map
    for (let i = 0; i < 4; i++) { await openSheet(page); await page.click("#sel-maps .lbm-rand"); await sleep(250); assert.equal((await chipState(page)).full, "full", "random stays on 5v5 maps"); }
    // another mode: competitive lets go, the maps come back
    await openSheet(page);
    await page.evaluate(() => [...document.querySelectorAll("#sel-modes .lb-map")].find((b) => b.textContent === "팀 데스매치").click()); await sleep(700);
    c = await chipState(page);
    assert.ok(!c.on && !c.aic && c.mode === "tdm" && c.maps === maps0 && c.tabs !== "none", "another mode lets go: " + JSON.stringify({ on: c.on, mode: c.mode, maps: c.maps, tabs: c.tabs }));
    assert.ok(c.others.find((x) => x.t === "팀 데스매치").on);
    // standard again, and competitive again
    await openSheet(page);
    await page.evaluate(() => [...document.querySelectorAll("#sel-modes .lb-map")].find((b) => b.textContent === "일반전").click()); await sleep(400);
    await openSheet(page); await page.click("#sel-comp"); await sleep(600);
    assert.equal((await chipState(page)).on, true);
    // the chip is its own toggle
    await openSheet(page); await page.click("#sel-comp"); await sleep(600);
    c = await chipState(page);
    assert.ok(!c.on && c.mode === "std" && c.maps === maps0, "off again: " + JSON.stringify({ on: c.on, mode: c.mode, maps: c.maps }));
    // practice (the range): no chip
    await page.evaluate(() => document.getElementById("sel-back").click()); await sleep(300);
    await page.evaluate(() => document.getElementById("go-range").click()); await sleep(700);
    assert.equal((await chipState(page)).hidden, true, "no competitive choice in practice");
    await page.evaluate(() => document.getElementById("sel-back").click()); await sleep(300);
    // an account with no rating (a guest) and the owner's switch: shown but shut, with the reason
    await page.evaluate(() => { document.getElementById("go-play").click(); });
    await sleep(600);
    await page.evaluate(() => { window.__ai = ACCOUNT.session().user.ai; ACCOUNT.session().user.ai = null; dispatchEvent(new Event("server-config")); });
    await sleep(300);
    c = await chipState(page);
    assert.ok(c.disabled && !c.hidden && /로그인/.test(c.title), "no rating: shut with the reason " + c.title);
    await page.evaluate(() => { ACCOUNT.session().user.ai = window.__ai; SERVER_CFG.aiComp = { on: false }; dispatchEvent(new Event("server-config")); });
    await sleep(300);
    c = await chipState(page);
    assert.ok(c.disabled && /쉬고/.test(c.title), "switched off by the owner: " + c.title);
    await page.evaluate(() => { SERVER_CFG.aiComp = { on: true }; dispatchEvent(new Event("server-config")); });
    await sleep(300);
    assert.equal((await chipState(page)).disabled, false);

    // ── B. the match and its lock ──
    const rules = () => page.evaluate(() => ({ live: AI_COMP.live, match: AI_COMP.match, locked: RANKED.locked, body: document.body.classList.contains("ranked"), badge: document.getElementById("rk-badge").textContent, mode: room.mode, rounds: room.rounds, win: winRounds(), diff: room.diff, map: room.map, full: MAP_CAT(room.map), actors: world.actors.length, phase: world.phase, skill: BOT_RT.skill, tune: diffTune(), nm: NET.mode }));
    const cheats = () => page.evaluate(async () => {
      ADMIN.god = true; ADMIN.infAmmo = true; ADMIN.run = 99; ADMIN.freezeAI = true; ADMIN2.setPersonal("god", true); ADMIN2.afterChange(); window.IS_OWNER = true;
      await new Promise((r) => setTimeout(r, 900));
      return { god: ADMIN.god, ammo: ADMIN.infAmmo, run: ADMIN.run === ADMIN_DEF.run, freeze: ADMIN.freezeAI, pgod: ADMIN2.P.god, owner: window.IS_OWNER };
    });
    // before: the switches are the player's own
    const free = await page.evaluate(() => { ADMIN.god = true; const v = ADMIN.god; ADMIN.god = false; return v; });
    assert.equal(free, true, "outside a competitive match the switches work");
    await openSheet(page); await page.click("#sel-comp"); await sleep(600);
    assert.equal((await chipState(page)).on, true);
    const seedRating = (rr) => page.evaluate((rr) => { const t = rr >= 2400 ? 8 : Math.floor(rr / 300); ACCOUNT.session().user.ai = { rr, t, div: t >= 8 ? 0 : (Math.floor(rr / 100) % 3) + 1, into: rr % 100, tier: "x", played: 3, w: 1, best: rr }; }, rr);
    const skills = [];
    for (const rr of [0, 1190, 2600]) {
      await seedRating(rr);
      await page.evaluate(() => document.getElementById("sel-go").click());
      await page.waitForFunction(() => "buy" === world.phase && world.actors.length === 10, null, { timeout: 60000 });
      const r = await rules();
      assert.deepEqual([r.live, r.match, r.locked, r.body, r.badge, r.mode, r.rounds, r.win, r.diff, r.full, r.actors, r.nm], [true, true, true, true, "AI 경쟁전", "std", 13, 13, "normal", "full", 10, "solo"], `the rules at ${rr}: ` + JSON.stringify(r));
      skills.push(r);
      // the bots read the rating, not the account's level
      rr === 1190 && assert.deepEqual(await cheats(), { god: false, ammo: false, run: true, freeze: false, pgod: false, owner: false }, "admin, cheats and the owner's claim are shut");
      rr === 0 && (await page.screenshot({ path: dir + "/aic-match.png" }));
    }
    assert.deepEqual(skills.map((s) => s.skill), [0.6, 0.8975, 1.2], "Iron 0.60, Gold 3 0.8975, Radiant 1.20");
    assert.ok(skills[0].tune.dmg < skills[1].tune.dmg && skills[1].tune.dmg < skills[2].tune.dmg && skills[0].tune.err > skills[1].tune.err && skills[1].tune.err > skills[2].tune.err, "stronger bots as the rating rises: damage up, aim error down");
    // leaving the match lets go of the lock
    await page.evaluate(() => { world.phase = "menu"; show("s-title"); });
    await page.waitForFunction(() => !RANKED.locked && !AI_COMP.live && !document.body.classList.contains("ranked"), null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => { ADMIN.god = true; const v = ADMIN.god; ADMIN.god = false; return v; }), true, "the player's switches are back after leaving");
    // a normal solo match after it: not competitive, the bots read the account's level again
    await openSelect(page); await openSheet(page);
    assert.equal((await chipState(page)).on, true, "the choice stays after a match");
    await page.click("#sel-comp"); await sleep(500);
    assert.equal((await chipState(page)).on, false);
    await page.evaluate(() => document.getElementById("sel-go").click());
    await page.waitForFunction(() => "buy" === world.phase && world.actors.length > 0, null, { timeout: 60000 });
    let n = await rules();
    assert.deepEqual([n.live, n.match, n.locked, n.body], [false, false, false, false], "a normal match is not locked");
    assert.equal(n.skill, 0.6, "the bots follow the account's level in a normal match");
    // ...and its result leaves the rating alone: no tile
    const base = JSON.stringify(f.h.user("aicsolo").ai), real0 = real(f, "aicsolo");
    f.h.advance(400000);
    await page.evaluate(() => { const me = myActor(); me.kills = 2; world[me.team === "atk" ? "scoreAtk" : "scoreDef"] = 13; world[me.team === "atk" ? "scoreDef" : "scoreAtk"] = 6; gameOver(); });
    for (let i = 0; i < 60 && f.h.user("aicsolo").matches < 1; i++) await sleep(500);
    assert.equal(f.h.user("aicsolo").matches, 1, "the normal match was reported");
    assert.equal(JSON.stringify(f.h.user("aicsolo").ai), base, "a normal solo match does not move the AI rating");
    assert.equal(await page.evaluate(() => !!(document.getElementById("ov-aic") && !document.getElementById("ov-aic").hidden)), false, "no tile after a normal match");
    assert.equal(await page.evaluate(() => LAST_MATCH.aic), undefined, "and it is not reported as competitive");
    f.h.advance(31000);

    // ── C. a competitive match played to its end ──
    assert.equal(await page.evaluate(() => ACCOUNT.session().user.ai.rr), 1190, "the report gave the page the server's rating back");
    await page.evaluate(() => document.getElementById("ov-menu").click());
    await openSelect(page); await openSheet(page);
    await page.click("#sel-comp"); await sleep(500);
    assert.equal((await chipState(page)).on, true);
    await page.evaluate(() => document.getElementById("sel-go").click());
    await page.waitForFunction(() => "buy" === world.phase && AI_COMP.live, null, { timeout: 60000 });
    f.h.advance(400000);
    await page.evaluate(() => { const me = myActor(); me.kills = 4; world[me.team === "atk" ? "scoreAtk" : "scoreDef"] = 13; world[me.team === "atk" ? "scoreDef" : "scoreAtk"] = 7; gameOver(); });
    await page.waitForSelector("#ov-aic:not([hidden])", { timeout: 40000 });
    await sleep(600);
    const ended = await page.evaluate(() => ({ locked: RANKED.locked, live: AI_COMP.live, body: document.body.classList.contains("ranked"), last: LAST_MATCH, tile: document.getElementById("ov-aic").innerText.replace(/\s+/g, " ").trim(), god: (ADMIN.god = true, ADMIN.god) }));
    await page.evaluate(() => { ADMIN.god = false; });
    assert.deepEqual([ended.locked, ended.live, ended.body, ended.god], [false, false, false, true], "the lock is let go when the match ends");
    assert.deepEqual([ended.last.aic, ended.last.mode, ended.last.n, ended.last.s.join(":")], [1, "std", 10, "13:7"], "it is reported as an AI competitive match");
    // 1190 + 18 + 4 kills = 1212: Gold 3 -> Platinum 1
    const ai = f.h.user("aicsolo").ai;
    assert.deepEqual([ai.rr, ai.played, ai.w, ai.best], [1212, 13, 8, 1450], "the server moved the AI rating by its numbers");
    assert.equal(real(f, "aicsolo"), real0, "RR, MMR, placement, season: untouched");
    assert.match(ended.tile, /^\+22 AI 경쟁전 · 플래티넘 1$/, ended.tile);
    assert.equal(JSON.stringify(await f.h.api("leaderboard", {})).includes("aicsolo"), false, "not on the leaderboard");
    await page.screenshot({ path: dir + "/aic-over.png" });
    // a new match clears the tile
    await page.evaluate(() => document.getElementById("ov-again").click());
    await page.waitForFunction(() => document.getElementById("ov-aic").hidden, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => AI_COMP.live && AI_COMP.match), true, "playing again is a competitive match again");
    f.h.advance(31000);
    await page.evaluate(() => { world.phase = "menu"; show("s-title"); });

    // ── A/B/C on a 740x360 touch phone, the account with a first match: every tile of the result screen ──
    const phone = await f.page("aicphone", { width: 740, height: 360 }, { hasTouch: true, isMobile: true });
    phone.on("pageerror", (e) => errors.push(e.message));
    await phone.evaluate(() => document.getElementById("go-play").click());
    await phone.waitForFunction(() => !document.getElementById("s-select").hidden, null, { timeout: 30000 });
    await sleep(600);
    await openSheet(phone);
    let p = await chipState(phone);
    assert.ok(!p.hidden && !p.disabled && p.rect.l >= 0 && p.rect.r <= p.vw && p.rect.t >= 0 && p.rect.b <= p.vh && p.text === "경쟁전아이언 1", "the chip fits the phone sheet: " + JSON.stringify(p));
    await phone.tap("#sel-comp"); await sleep(700);
    p = await chipState(phone);
    assert.ok(p.on && p.nonFull === 0 && p.tabs === "none" && /경쟁전/.test(p.label), "chosen with a tap: " + JSON.stringify({ on: p.on, nonFull: p.nonFull, tabs: p.tabs, label: p.label }));
    await openSheet(phone);
    await phone.screenshot({ path: dir + "/aic-select-phone.png" });
    await phone.evaluate(() => { const pk = document.querySelector("#s-select .sel-foot.pick-open"); pk && document.getElementById("sel-pick").click(); });
    await sleep(300);
    await phone.evaluate(() => document.getElementById("sel-go").click());
    await phone.waitForFunction(() => "buy" === world.phase && AI_COMP.live, null, { timeout: 60000 });
    assert.equal(await phone.evaluate(() => BOT_RT.skill), 0.6, "a new account (Iron 1) meets the weakest bots");
    f.h.advance(400000);
    await phone.evaluate(() => { const me = myActor(); me.kills = 3; world[me.team === "atk" ? "scoreAtk" : "scoreDef"] = 13; world[me.team === "atk" ? "scoreDef" : "scoreAtk"] = 9; gameOver(); });
    await phone.waitForSelector("#ov-aic:not([hidden])", { timeout: 40000 });
    await sleep(900);
    const t = await phone.evaluate(() => {
      const tiles = [...document.querySelectorAll("#s-over .ov-stats .ov-st")].filter((e) => !e.hidden && e.offsetParent), mine = document.getElementById("ov-aic").getBoundingClientRect();
      const tops = tiles.map((e) => Math.round(e.getBoundingClientRect().top)), mvp = document.querySelector("#s-over .ovb-mvp"), btn = document.getElementById("ov-again").getBoundingClientRect();
      return { n: tiles.length, rows: new Set(tops).size, tile: document.getElementById("ov-aic").innerText.replace(/\s+/g, " ").trim(), in: mine.left >= 0 && mine.right <= innerWidth && mine.bottom <= innerHeight, noScroll: document.documentElement.scrollWidth <= innerWidth, mvpTop: mvp ? mvp.getBoundingClientRect().top : 0, lastTile: Math.max(...tiles.map((e) => e.getBoundingClientRect().bottom)), btnTop: btn.top };
    });
    assert.equal(t.tile, "+21 AI 경쟁전 · 아이언 1", t.tile);
    assert.ok(t.in && t.noScroll, "the tile fits the phone: " + JSON.stringify(t));
    assert.ok(t.rows <= 2 && t.n >= 8, "the tiles of a first win (rewards and all) wrap to at most two compact rows at 740x360: " + JSON.stringify(t));
    assert.ok(t.lastTile <= t.mvpTop + 1, "the tiles stay above the MVP card: " + JSON.stringify(t));
    await phone.screenshot({ path: dir + "/aic-over-phone.png" });
    const first = f.h.user("aicphone").ai;
    assert.deepEqual([first.rr, first.played, first.w, first.best], [21, 1, 1, 21], "a first win: 18 and three kills");

    // ── D. the homepage ──
    for (const [name, pg, vp] of [["desk", page, { width: 1280, height: 900 }], ["phone", phone, { width: 740, height: 360 }]]) {
      await pg.setViewportSize(vp);
      const id = name === "desk" ? "aicsolo" : "aicphone";
      for (const lang of ["ko", "en"]) {
        await pg.evaluate((l) => localStorage.setItem("lgp_lang", l), lang);
        await pg.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" });
        await pg.waitForFunction(() => document.getElementById("meAi") && !document.getElementById("meAi").hidden && document.getElementById("meAiT").textContent, null, { timeout: 30000 });
        await sleep(400);
        const h = await pg.evaluate(() => ({ n: document.getElementById("meAiN").textContent, t: document.getElementById("meAiT").textContent, rank: document.getElementById("meTierN").textContent, svg: document.querySelector("#meAiB svg") && document.querySelector("#meAiB svg").getBoundingClientRect().width, vis: document.getElementById("meAi").getBoundingClientRect().width > 0, over: document.documentElement.scrollWidth <= innerWidth }));
        const want = name === "desk" ? (lang === "ko" ? ["플래티넘 1", "AI 경쟁전 · 13판 8승 · 최고 플래티넘 3"] : ["Platinum 1", "AI Competitive · 13 played · 8 won · best Platinum 3"]) : (lang === "ko" ? ["아이언 1", "AI 경쟁전 · 1판 1승 · 최고 아이언 1"] : ["Iron 1", "AI Competitive · 1 played · 1 won · best Iron 1"]);
        assert.deepEqual([h.n, h.t], want, `${name} ${lang}: ` + JSON.stringify(h));
        assert.ok(h.vis && h.svg > 20 && h.over, `${name} ${lang} fits: ` + JSON.stringify(h));
        assert.ok(!/배치|Placing|RR/.test(h.n + h.t), "the AI line is not the real rank's text");
        await pg.screenshot({ path: `${dir}/aic-home-${name}-${lang}.png` });
      }
    }
    // a placed, real rank on the account is not shown as the AI tier and not changed
    assert.equal(real(f, "aicsolo"), real0);
    assert.deepEqual(errors, [], "no page errors");
    console.log("ai-comp ok");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await f.browser.close();
  }
})();
