// Per-agent mastery and the free-for-all result, in the browser: the homepage's mastery list and match history (the newer modes by name, in both
// languages, a free-for-all by its placing), and a Knife Fight played to the end in solo whose winner, level on kills with another player, is paid as a win
// (it used to be a draw) with the mastery XP and the level-up gold on the result screen.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const dir = process.env.SHOT_DIR || "test-results";
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000";
(async () => {
  const f = await fixture();
  try {
    const roster = require("../js/agent-roster.json");
    // ── the homepage ──
    await f.h.api("auth", { id: "homeprof", pw: "password", device: "browser-test-homeprof" });
    const u = f.h.user("homeprof");
    u.mast = {}; roster.slice(0, 9).forEach((a, i) => { u.mast[a.id] = { xp: 450 * (9 - i) + i * 7, m: 20 - i, w: 10 - i, k: 80 - i * 5 }; });
    const MODES = ["std", "swift", "rush", "tdm", "dm", "knife", "gun", "zone", "hill", "ctf", "inf", "range"];
    u.hist = MODES.map((mode, i) => ({ mode, map: "빙하 관측소", agent: "화령", k: 10 - (i % 5), d: 3, a: 1, dmg: 800, cs: 700, rank: 1 + (i % 3), n: 8, s: [9, 9], win: i % 2 === 0, t: Date.now() - i * 3600e3, xp: 100, gold: 100, rr: 0 }));
    f.h.db.set("user:homeprof", JSON.stringify(u));
    await f.h.api("auth", { id: "nomast", pw: "password", device: "browser-test-nomast" });
    const home = async (page, lang) => { await page.evaluate((l) => localStorage.setItem("lgp_lang", l), lang); await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded" }); };
    const page = await f.page("homeprof", { width: 1280, height: 900 });
    for (const lang of ["ko", "en"]) {
      await home(page, lang);
      await page.waitForSelector("#mastList .mr", { timeout: 20000 });
      const got = await page.evaluate(() => ({
        title: document.querySelector("#mast h3").textContent, rows: [...document.querySelectorAll("#mastList .mr")].map((r) => ({ id: r.dataset.agent, lv: +r.querySelector(".mastb").dataset.lv, name: r.querySelector(".mn b").textContent, role: r.querySelector(".mn small").textContent, xp: r.querySelector(".mb2 small").textContent, rec: r.querySelector(".mw").textContent })),
        more: (document.getElementById("mastMore") || {}).textContent, hist: [...document.querySelectorAll("#histList .hr")].map((h) => ({ mode: h.querySelector(".mid b").childNodes[0].textContent.split(" · ")[0], res: h.querySelector(".res b").textContent, sc: h.querySelector(".res span").textContent })),
      }));
      assert.equal(got.rows.length, 5, "the best five first");
      assert.deepEqual(got.rows.map((r) => r.id), roster.slice(0, 5).map((a) => a.id), "best first");
      assert.deepEqual([got.rows[0].lv, got.rows[0].xp, got.rows[2].lv, got.rows[2].xp], [9, "450 / 900 XP", 8, "364 / 800 XP"]);
      assert.equal(got.rows[0].name, roster[0].name);
      if (lang === "ko") { assert.equal(got.title, "요원 숙련도"); assert.equal(got.rows[0].role, "타격대"); assert.equal(got.rows[0].rec, "20경기 · 10승"); assert.equal(got.more, "전체 보기 (9명)"); }
      else { assert.equal(got.title.toLowerCase(), "agent mastery"); assert.equal(got.rows[0].role, "Duelist"); assert.equal(got.rows[0].rec, "20 matches · 10 wins"); assert.equal(got.more, "Show all (9 agents)"); }
      // the match history: every mode by its name (none shows as a raw key), the modes without sides by placing and kills
      const want = await page.evaluate((modes) => modes.map((m) => T[L].modes[m]), MODES);
      assert.ok(want.every((n, i) => n && n !== MODES[i]), "every mode has a name in " + lang + ": " + want.join());
      assert.deepEqual(got.hist.map((h) => h.mode), want, "history shows the names");
      const ffa = ["dm", "knife", "gun", "zone", "range"].map((m) => got.hist[MODES.indexOf(m)]);
      for (const h of ffa) assert.ok(/^(\d+위|\d+(st|nd|rd|th))$/.test(h.res) && /(킬|kills)$/.test(h.sc), "a free-for-all shows the placing and the kills: " + JSON.stringify(h));
      for (const m of ["std", "tdm", "hill", "ctf", "inf"]) { const h = got.hist[MODES.indexOf(m)]; assert.ok(/9 - 9/.test(h.sc), m + " shows the score " + JSON.stringify(h)); }
      lang === "ko" && (await page.evaluate(() => document.getElementById("mast").scrollIntoView()), await page.waitForTimeout(300), await page.screenshot({ path: dir + "/mastery-home.png" }));
    }
    await page.click("#mastMore");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#mastList .mr").length), 9, "show all");
    await page.screenshot({ path: dir + "/mastery-home-all.png" });
    await page.click("#mastMore");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#mastList .mr").length), 5, "and back");
    // a phone held sideways
    await page.setViewportSize({ width: 740, height: 360 });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no sideways scroll on a phone");
    await page.context().close();
    const none = await f.page("nomast", { width: 1280, height: 900 });
    await home(none, "ko");
    await none.waitForSelector("#mast .empty", { timeout: 20000 });
    assert.match(await none.evaluate(() => document.querySelector("#mast .empty").textContent), /아직 숙련도가 없습니다/);
    await none.context().close();

    // ── a Knife Fight to the end: level on kills with a bot, the player first on fewer deaths ──
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "browser-owner-device-m" });
    await f.h.api("auth", { id: "knifer", pw: "password", device: "browser-test-knifer" });
    const k = f.h.user("knifer"); k.mast = { [roster[2].id]: { xp: 95, m: 4, w: 2, k: 10 } }; f.h.db.set("user:knifer", JSON.stringify(k));
    void owner;
    const game = await f.page("knifer", { width: 1280, height: 720 });
    const g0 = f.h.user("knifer").gold;
    const result = async (mode) => {
      await game.evaluate((m) => { room.mode = m; startGame(AGENTS.find((a) => a.id === "gangcheol") || AGENTS[2], false); ADMIN.freezeAI = true; }, mode);
      await game.waitForTimeout(2000); // the match ticket is asked for as the match starts
      f.h.advance(61000);
      return game.evaluate(() => {
        const me = myActor(), bot = world.actors.find((a) => "ai" === a.ctrl);
        me.kills = 7; bot.kills = 7;
        QOL.ST.set(me.id, { k: 7, d: 1, a: 0, dmg: 900 }); QOL.ST.set(bot.id, { k: 7, d: 4, a: 0, dmg: 900 });
        gameOver();
        const s = LAST_MATCH;
        return { outcome: s.outcome, win: s.win, rank: s.rank, s: s.s, mode: s.mode, agent: s.agent };
      });
    };
    assert.equal(roster[2].id, "gangcheol");
    const r1 = await result("knife");
    assert.deepEqual([r1.outcome, r1.win, r1.rank, r1.s, r1.mode], ["win", true, 1, [7, 7], "knife"], "the winner of a level knife fight is a winner, not a draw: " + JSON.stringify(r1));
    await game.waitForSelector("#ov-mast:not([hidden])", { timeout: 30000 });
    const after = f.h.user("knifer");
    assert.equal(after.wins, 1, "the server counted the win"); assert.equal(after.hist[0].win, true); assert.equal(after.hist[0].mode, "knife");
    // 30 + 30 for the win + 5 x 7 kills = 95 on top of 95: level 2 -> 3 (300 starts level 3: 190 < 300 is level 2), so check against the server
    assert.equal(after.mast.gangcheol.xp, 95 + 95); assert.equal(after.mast.gangcheol.m, 5);
    const cell = await game.evaluate(() => ({ b: document.querySelector("#ov-mast b").textContent.replace(/\s+/g, " ").trim() + " " + document.querySelector("#ov-mast .mup").textContent, l: document.querySelector("#ov-mast .lbl").textContent, lv: +document.querySelector("#ov-mast .mastb").dataset.lv }));
    assert.match(cell.b, /\+95 XP/); assert.match(cell.b, /Lv 1 → 2 · 🪙 \+50/); assert.equal(cell.lv, 2); assert.match(cell.l, /^강철 숙련도 · /);
    assert.ok(after.gold >= g0 + 100 + 50, "the win gold and the level gold");
    await game.screenshot({ path: dir + "/mastery-result.png" });
    f.h.advance(31000);
    // the other free-for-all modes too (the placing decides, never the equal kills)
    for (const mode of ["gun", "dm"]) {
      const r = await result(mode);
      assert.deepEqual([r.outcome, r.win], ["win", true], mode + " " + JSON.stringify(r));
      await game.waitForFunction((n) => ACCOUNT.session().user.wins >= n, mode === "gun" ? 2 : 3, { timeout: 30000 });
      f.h.advance(31000);
    }
    assert.equal(f.h.user("knifer").wins, 3);
    assert.deepEqual(f.errors, []);
    console.log("mastery: homepage list and history names in both languages, a level knife fight / gun game / deathmatch is a win, with mastery XP and level gold on the result");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
