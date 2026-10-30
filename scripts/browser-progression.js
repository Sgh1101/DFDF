// Progression rewards in the browser: the homepage's level-reward and achievement lists (Korean and English, desktop and a phone held
// sideways), the missions panel with missions picked from the pool, and the result screen's lines for the first win of the day, a level
// reward with its cosmetic, and an achievement (a solo match played to its end, on a desktop and on a phone).
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const dir = process.env.SHOT_DIR || "test-results";
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
const roster = require("../js/agent-roster.json");
const ROLE = { 타격대: "duelist", 감시자: "sentinel", 척후대: "initiator", 전략가: "controller" };
(async () => {
  const f = await fixture();
  try {
    const put = (id, edit) => { const u = f.h.user(id); edit(u); f.h.db.set("user:" + id, JSON.stringify(u)); };
    // ── the homepage ──
    await f.h.api("auth", { id: "homeprog", pw: "password", device: "browser-test-homeprog" });
    put("homeprog", (u) => { u.xp = 2100; u.wins = 4; u.kills = 63; u.matches = 9; u.fwDay = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10); u.lvPaid = 7; u.mast = { hwaryeong: { xp: 450, m: 5, w: 2, k: 30 } }; u.ach = { got: { win1: Date.now() - 1000 }, roles: { duelist: 1, sentinel: 1 }, modes: { std: 1, rush: 1, dm: 1 } }; u.cos = { own: ["scout"], eq: {} }; });
    const home = async (page, lang) => { await page.evaluate((l) => localStorage.setItem("lgp_lang", l), lang); await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" }); await page.waitForSelector("#achList .pr", { timeout: 20000 }); };
    const hp = await f.page("homeprog", { width: 1280, height: 900 });
    for (const lang of ["ko", "en"]) {
      await home(hp, lang);
      const got = await hp.evaluate(() => ({
        lvr: document.querySelector("#lvr h3").textContent, ach: document.querySelector("#ach h3").textContent,
        fw: document.querySelector("#fwRow").innerText.replace(/\s+/g, " ").trim(), fwOn: document.querySelector("#fwRow").classList.contains("on"),
        ms: [...document.querySelectorAll("#lvrList [data-lv]")].map((r) => ({ lv: r.dataset.lv, on: r.classList.contains("on"), next: r.classList.contains("next"), t: r.innerText.replace(/\s+/g, " ").trim() })),
        each: document.querySelector("#lvrList .prn").textContent,
        achs: [...document.querySelectorAll("#achList [data-ach]")].map((r) => ({ id: r.dataset.ach, done: r.classList.contains("on"), t: r.innerText.replace(/\s+/g, " ").trim(), bar: r.querySelector("i u") ? r.querySelector("i u").style.width : null })),
      }));
      assert.deepEqual(got.ms.map((m) => [m.lv, m.on]), [["5", true], ["10", false], ["20", false], ["30", false], ["50", false]], "level 7 has reached the first milestone");
      assert.equal(got.ms[1].next, true, "the next one is marked");
      assert.equal(got.fwOn, false, "today's first win is taken");
      assert.deepEqual(got.achs.map((a) => a.id), ["win1", "kill100", "play50", "mast5", "roles", "modes"]);
      assert.deepEqual(got.achs.map((a) => a.done), [true, false, false, false, false, false]);
      assert.equal(got.achs[1].bar, "63%", "63 of 100 kills"); assert.match(got.achs[4].t, /^2\/4/); assert.match(got.achs[5].t, /^3\/11/); assert.match(got.achs[3].t, /^3\/5/);
      if (lang === "ko") {
        assert.equal(got.lvr, "레벨 보상"); assert.equal(got.ach, "업적"); assert.match(got.fw, /오늘의 첫 승리 보너스.*🪙 100 · 50 XP.*오늘 받음/);
        assert.match(got.ms[0].t, /Lv 5 칭호 · 탐험가 🪙 240 달성/); assert.match(got.ms[1].t, /Lv 10 네임카드 · 네온 도시 🪙 240 3레벨 남음/);
        assert.match(got.each, /레벨이 오를 때마다 🪙 40/); assert.match(got.achs[0].t, /첫 승리.*경기에서 처음으로 이기기.*🪙 100 달성/);
      } else {
        assert.equal(got.lvr.toLowerCase(), "level rewards"); assert.equal(got.ach.toLowerCase(), "achievements"); assert.match(got.fw, /First win of the day.*🪙 100 · 50 XP.*Taken today/);
        assert.match(got.ms[0].t, /Lv 5 Titles · Scout 🪙 240 Reached/); assert.match(got.ms[1].t, /3 levels to go/); assert.match(got.achs[4].t, /Every role/);
      }
      lang === "ko" && (await hp.evaluate(() => document.getElementById("lvr").scrollIntoView()), await hp.waitForTimeout(300), await hp.screenshot({ path: dir + "/progression-home.png" }));
    }
    await hp.evaluate(() => document.getElementById("ach").scrollIntoView()); await hp.waitForTimeout(200);
    await hp.screenshot({ path: dir + "/progression-home-ach.png" });
    await hp.setViewportSize({ width: 740, height: 360 }); await hp.waitForTimeout(300);
    assert.ok(await hp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no sideways scroll on a phone");
    await hp.evaluate(() => document.getElementById("lvr").scrollIntoView()); await hp.waitForTimeout(300);
    await hp.screenshot({ path: dir + "/progression-home-phone.png" });
    // a fresh account: the first win is open, nothing reached
    await hp.context().close();
    await f.h.api("auth", { id: "newbie", pw: "password", device: "browser-test-newbie" });
    const np = await f.page("newbie", { width: 1280, height: 900 });
    await home(np, "ko");
    assert.deepEqual(await np.evaluate(() => [document.querySelector("#fwRow").classList.contains("on"), document.querySelector("#fwRow .pw").textContent, document.querySelectorAll("#lvrList [data-lv].on").length, document.querySelectorAll("#achList .pr.on").length]), [true, "오늘 받을 수 있음", 0, 0]);
    await np.context().close();

    // ── the missions panel ──
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "browser-owner-device-p" });
    void owner;
    const sess = await f.h.api("auth", { id: "misser", pw: "password", device: "browser-test-misser" });
    const pool = (await f.h.api("missions", { token: sess.token })).missions.list.filter((x) => "x" === x.id[1]);
    assert.equal(pool.length, 4);
    const matchFor = (x) => ({ mode: "mode" === x.f.k ? x.f.v : "std", agent: "agent" === x.f.k ? x.f.v : "role" === x.f.k ? roster.find((a) => ROLE[a.role] === x.f.v).id : undefined, kills: "kills" === x.stat ? Math.min(24, x.n) : 0 });
    // finish one daily one through the server (valid tickets), leave the rest
    const target = pool.find((x) => "d" === x.per);
    for (let i = 0; i < 12; i++) {
      const t = await f.h.api("match_start", { token: sess.token }); f.h.advance(61000);
      const o = matchFor(target);
      const r = await f.h.api("progress", { token: sess.token, mt: t.ticket, win: true, outcome: "win", kills: o.kills, match: { mode: o.mode, agent: o.agent, s: [13, 5] } });
      assert.equal(r.status, 200); f.h.advance(21000);
      if (r.missions.list.find((x) => x.id === target.id).done) break;
    }
    const panel = await f.page("misser", { width: 1280, height: 720 });
    for (const lang of ["ko", "en"]) {
      await panel.evaluate((l) => { localStorage.setItem("lgp_lang", l); }, lang);
      if (lang === "en") { await panel.reload({ waitUntil: "domcontentloaded" }); await panel.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading, null, { timeout: 90000 }); }
      await panel.evaluate(() => { MISSIONS.state.st = null; MISSIONS.open(); });
      await panel.waitForSelector("#mis .ms-row", { timeout: 15000 });
      await panel.waitForFunction(() => document.querySelectorAll("#mis .ms-row").length >= 10, null, { timeout: 15000 });
      const rows = await panel.evaluate(() => [...document.querySelectorAll("#mis .ms-row")].map((r) => ({ t: r.querySelector(".ms-t").firstChild.textContent, n: r.querySelector(".ms-t span").textContent, cls: r.className, btn: r.querySelector(".ms-btn").textContent.trim(), id: r.querySelector(".ms-btn").dataset.id })));
      assert.equal(rows.length, 10, "six fixed and four picked");
      const dynRows = rows.filter((r) => "x" === r.id[1]);
      assert.equal(dynRows.length, 4);
      // each picked row reads as the shared words say, for this language
      const want = await panel.evaluate((list) => list.map((x) => PROGRESSION.mission(x, (id) => AGENTS.find((a) => a.id === id).name)), pool);
      assert.deepEqual(dynRows.map((r) => r.t).sort(), want.sort());
      assert.ok(dynRows.every((r) => /\d/.test(r.t)));
      lang === "ko" ? assert.ok(dynRows.some((r) => /(승리|판 하기|처치)/.test(r.t)) && !dynRows.some((r) => /[A-Za-z]{4,}.*(Win|Play|Get) /.test(r.t))) : assert.ok(dynRows.every((r) => /^(Win|Play|Get) /.test(r.t)), JSON.stringify(dynRows.map((r) => r.t)));
      const done = dynRows.find((r) => r.id === target.id);
      // ready to claim at first (Korean pass); claimed in the English pass, which comes after the claim
      "ko" === lang ? assert.ok(/done/.test(done.cls) && /^받기/.test(done.btn), JSON.stringify(done)) : assert.ok(/got/.test(done.cls) && "Claimed" === done.btn, JSON.stringify(done));
      await panel.screenshot({ path: dir + "/progression-missions-" + lang + ".png" });
      if (lang === "ko") {
        // claim it through the panel: the gold once, then it reads as claimed
        const g0 = f.h.user("misser").gold;
        await panel.click(`#mis .ms-btn[data-id="${target.id}"]`);
        await panel.waitForFunction((id) => document.querySelector(`#mis .ms-btn[data-id="${id}"]`).textContent.trim() === "받음", target.id, { timeout: 15000 });
        assert.equal(f.h.user("misser").gold, g0 + target.gold);
        assert.equal((await f.h.api("mission_claim", { token: sess.token, id: target.id })).status, 409, "not twice");
        assert.equal(f.h.user("misser").gold, g0 + target.gold);
        await panel.evaluate(() => MISSIONS.close());
      }
    }
    // a phone held sideways: the panel scrolls inside itself and the rows do not overflow
    await panel.setViewportSize({ width: 740, height: 360 }); await panel.waitForTimeout(300);
    assert.ok(await panel.evaluate(() => { const c = document.querySelector("#mis .ms-card"); return c.scrollWidth <= c.clientWidth + 1 && c.getBoundingClientRect().bottom <= innerHeight + 1; }));
    await panel.screenshot({ path: dir + "/progression-missions-phone.png" });
    await panel.context().close();

    // ── the result screen ──
    const play = async (page, win) => {
      await page.evaluate(() => { room.mode = "std"; startGame(AGENTS.find((a) => a.id === "hwaryeong") || AGENTS[0], false); ADMIN.freezeAI = true; });
      await page.waitForTimeout(2500); // the match ticket is asked for as the match starts
      f.h.advance(61000);
      await page.evaluate((w) => { const me = myActor(); me.kills = 3; world[me.team === "atk" ? "scoreAtk" : "scoreDef"] = w ? 13 : 5; world[me.team === "atk" ? "scoreDef" : "scoreAtk"] = w ? 7 : 13; gameOver(); }, win);
    };
    const cells = (page) => page.evaluate(() => Object.fromEntries(["ov-fw", "ov-lvr", "ov-ach", "ov-mast"].map((id) => { const c = document.getElementById(id); return [id, c && !c.hidden ? c.innerText.replace(/\s+/g, " ").trim() : null]; })));
    for (const [name, vp, id] of [["desk", { width: 1280, height: 720 }, "resdesk"], ["phone", { width: 740, height: 360 }, "resphone"]]) {
      await f.h.api("auth", { id, pw: "password", device: "browser-test-" + id });
      put(id, (u) => { u.xp = 950; }); // level 4: the next win reaches level 5, a milestone
      const g0 = f.h.user(id).gold;
      const page = await f.page(id, vp);
      await play(page, true);
      await page.waitForSelector("#ov-fw:not([hidden])", { timeout: 30000 });
      const c1 = await cells(page);
      assert.match(c1["ov-fw"], /🪙 \+100.*오늘의 첫 승리 보너스.*\+50 XP/, JSON.stringify(c1));
      assert.match(c1["ov-lvr"], /🪙 \+240.*레벨 보상 · Lv 4 → 5.*획득: 칭호 탐험가/i, JSON.stringify(c1));
      assert.match(c1["ov-ach"], /첫 승리.*업적 달성.*🪙 \+100/, JSON.stringify(c1));
      const u = f.h.user(id);
      assert.ok(u.cos.own.includes("scout")); assert.equal(u.fwDay.length, 10); assert.ok(u.ach.got.win1);
      assert.ok(u.gold >= g0 + 100 + 240 + 100, "the match gold and all three rewards");
      await page.waitForTimeout(500);
      await page.screenshot({ path: dir + "/progression-result-" + name + ".png" });
      // every reward tile fits inside the screen's width and none is cut off inside its box
      assert.ok(await page.evaluate(() => ["ov-fw", "ov-lvr", "ov-ach"].every((i) => { const c = document.getElementById(i), r = c.getBoundingClientRect(); return r.right <= innerWidth && c.scrollWidth <= c.clientWidth + 1; })), "tiles are not clipped");
      if (name === "phone") assert.ok(await page.evaluate(() => { const s = document.getElementById("s-over"); return s.scrollWidth <= s.clientWidth + 1; }), "the tiles do not push the result sideways");
      // a second win the same day: no first-win tile, no level or achievement again
      f.h.advance(31000);
      await play(page, true);
      await page.waitForFunction(() => ACCOUNT.session().user.wins >= 2, null, { timeout: 30000 });
      await page.waitForTimeout(800);
      const c2 = await cells(page);
      assert.equal(c2["ov-fw"], null, "once a day: " + JSON.stringify(c2)); assert.equal(c2["ov-lvr"], null); assert.equal(c2["ov-ach"], null);
      assert.equal(f.h.user(id).wins, 2);
      await page.context().close();
      f.h.advance(31000);
    }
    // a loss gives none of the three, but its own gold and mastery stay
    await f.h.api("auth", { id: "resloss", pw: "password", device: "browser-test-resloss" });
    const lp = await f.page("resloss", { width: 1280, height: 720 });
    await play(lp, false);
    await lp.waitForSelector("#ov-mast:not([hidden])", { timeout: 30000 });
    const c3 = await cells(lp);
    assert.equal(c3["ov-fw"], null); assert.equal(c3["ov-ach"], null); assert.equal(c3["ov-lvr"], null);
    assert.equal(f.h.user("resloss").fwDay, undefined);
    await lp.context().close();
    assert.deepEqual(f.errors, []);
    console.log("progression: homepage lists (ko/en, desktop, phone), missions panel with pooled missions and one claim, result lines for first win, level reward and achievement");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
