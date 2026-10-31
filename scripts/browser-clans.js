// Clans and the all-time boards, in the browser:
//  1. the homepage's Clan section (Korean and English; 1280x900, a phone held sideways 740x360 and a portrait phone 390x844): make a clan
//     (its cost leaves the wallet), an error shown, search and join from a second account, the owner kicks, a member leaves, the section is
//     gone for a guest and when the owner switches clans off;
//  2. the owner page's Clans view: search, the members, rename, delete;
//  3. the leaderboard screen's tabs (kills, level, wins, matches, clans; Korean and English; my own place outside the list);
//  4. the [TAG] beside names, from the server's data: the lobby of a room of three pages (two in the clan, one without), the scoreboard,
//     the pre-match VS cards, and the result board; a name's tag is not taken from what a guest claims.
// Screenshots go to test-results/clans-*.png.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000", dir = process.env.SHOT_DIR || "test-results";
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture(), h = f.h, errors = [];
  const shot = (page, name) => page.screenshot({ path: `${dir}/clans-${name}.png`, fullPage: true, timeout: 120000 }).catch(() => {});
  let ipn = 0;
  const account = async (id, gold = 5000, xp = 0) => {
    const s = await h.api("auth", { id, pw: "password", device: "browser-test-" + id }, { "x-forwarded-for": "10.4.0." + ipn++ });
    assert.equal(s.status, 200, JSON.stringify(s));
    const u = h.user(id); u.gold = gold; u.xp = xp; h.db.set("user:" + id, JSON.stringify(u));
    return s;
  };
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "browser-clans-owner" });
  // a context that talks to the in-memory server, on a page that is not the game (the homepage and the owner page)
  const plain = async (viewport, init = {}, path = "/index.html") => {
    const ctx = await f.browser.newContext({ viewport, serviceWorkers: "block" }), page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept(page.__prompt ? page.__prompt.shift() : undefined));
    await page.route("**/api/v1?*", async (route) => { const r = await h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {}); await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) }); });
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort()); await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
    await page.route("**/js/promo.js", async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: (await res.text()).replace(/video: "https?:[^"]*"/, 'video: "PROMO_VIDEO_URL"'), contentType: "text/javascript" }); });
    await page.addInitScript(({ s, lang, adm }) => { s && (localStorage.setItem("lgp_session", JSON.stringify(s)), sessionStorage.setItem("lgp_gate", s.token)); lang && localStorage.setItem("lgp_lang", lang); adm && sessionStorage.setItem("adm_t", adm); }, init);
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    return page;
  };
  const home = async (session, viewport = { width: 1280, height: 900 }, lang = "ko", hidden = false) => {
    const page = await plain(viewport, { s: session, lang });
    // the section fills in once the server has answered; for a guest, or with clans off, it never shows
    await page.waitForFunction(() => document.querySelector("#clanBody .cl-card"), null, { timeout: hidden ? 2500 : 20000 }).catch((e) => { if (!hidden) throw e; });
    return page;
  };
  const clanText = (page) => page.evaluate(() => document.getElementById("clanBody").innerText.replace(/\s+/g, " ").trim());
  const noSideways = async (page, what) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), what + ": no sideways scroll");
  try {
    // ── 1. the homepage ──
    const cap = await account("clancap", 5000, 350), mem = await account("clanmem", 5000, 120), third = await account("clanthird");
    const P = await home(cap);
    assert.equal(await P.locator("#clan").isVisible(), true, "the Clan section is there for an account");
    assert.equal(await P.locator("#clanTitle").textContent(), "클랜");
    assert.match(await clanText(P), /아직 클랜이 없습니다/);
    assert.match(await clanText(P), /클랜을 만들려면 .*1,000이 듭니다. 지금 5,000 골드/);
    assert.match(await P.locator("#clanMake").textContent(), /만들기 · .*1,000/);
    await P.fill("#clanName", "별빛 클랜"); await P.fill("#clanTag", "ST*R"); await P.click("#clanMake");
    await P.waitForSelector("#clanMsg.err");
    assert.match(await P.locator("#clanMsg").textContent(), /클랜 태그는 2~4자/, "the server's reason is shown");
    assert.equal(await P.inputValue("#clanName"), "별빛 클랜", "what was typed is kept");
    await P.fill("#clanTag", "STAR"); await P.fill("#clanDesc", "밤에 모여서 합니다"); await P.click("#clanMake");
    await P.waitForSelector("#clanLeave");
    assert.equal(await P.locator("#clan .cl-tag").textContent(), "[STAR]");
    assert.equal(await P.locator("#clan .cl-name").textContent(), "별빛 클랜");
    assert.equal(await P.inputValue("#clanDescEdit"), "밤에 모여서 합니다", "the owner edits the description in place");
    assert.deepEqual(await P.$$eval("#clanMembers .cl-m", (r) => r.map((x) => x.innerText.replace(/\s+/g, " ").trim())), ["Lv 3 clancap 클랜장"]);
    assert.match(await P.locator("#meGold").textContent(), /4,000/, "the cost left the wallet");
    assert.equal(h.user("clancap").gold, 4000);
    await shot(P, "home-owner");
    // a second account searches and joins
    const M = await home(mem);
    assert.match(await clanText(M), /경험치 상위 클랜 \[STAR\] 별빛 클랜 밤에 모여서 합니다 · 1\/50명/, "the top list shows the new clan");
    await M.fill("#clanQ", "zzz"); await M.click("#clanSearch");
    await M.waitForFunction(() => /찾은 클랜이 없습니다/.test(document.getElementById("clanBody").innerText));
    await M.fill("#clanQ", "star"); await M.press("#clanQ", "Enter");
    await M.waitForSelector("#clanResults [data-join]");
    assert.match(await clanText(M), /검색 결과 1개/);
    await shot(M, "home-search");
    await M.click("#clanResults [data-join]");
    await M.waitForSelector("#clanLeave");
    assert.deepEqual(await M.$$eval("#clanMembers .cl-m", (r) => r.map((x) => x.innerText.replace(/\s+/g, " ").trim())), ["Lv 3 clancap 클랜장", "Lv 2 clanmem 멤버"]);
    assert.equal(await M.locator("#clanDescEdit").count(), 0, "a member does not edit the description");
    assert.equal(await M.locator("[data-kick]").count(), 0, "or kick");
    assert.equal(h.user("clanmem").clan, h.user("clancap").clan);
    await shot(M, "home-member");
    // the owner sees the member, edits the description, kicks
    await P.reload(); await P.waitForSelector("#clanMembers .cl-m:nth-child(2)");
    await P.fill("#clanDescEdit", "주말에도 합니다"); await P.click("#clanDescSave");
    await P.waitForFunction(() => /저장했습니다/.test(document.getElementById("clanMsg").textContent));
    assert.equal((await h.api("clan_get", { id: h.user("clancap").clan })).clan.desc, "주말에도 합니다");
    assert.equal(await P.locator("[data-kick]").count(), 1, "one member to kick");
    await P.click("[data-kick]");
    await P.waitForFunction(() => document.querySelectorAll("#clanMembers .cl-m").length === 1);
    assert.equal(h.user("clanmem").clan, undefined, "the member is out");
    await M.reload(); await M.waitForSelector("#clanSearch");
    assert.match(await clanText(M), /아직 클랜이 없습니다/, "the kicked account is back to the search");
    // the member joins again and leaves; then the owner leaves and the clan is gone
    await M.click("#clanResults [data-join]"); await M.waitForSelector("#clanLeave");
    await M.click("#clanLeave"); await M.waitForSelector("#clanSearch");
    assert.equal(h.user("clanmem").clan, undefined);
    assert.match(await M.locator("#clanMsg").textContent(), /클랜에서 나왔습니다/);
    await M.click("#clanResults [data-join]"); await M.waitForSelector("#clanLeave");
    // English, and the other sizes
    for (const [name, vp, lang] of [["desktop-en", { width: 1280, height: 900 }, "en"], ["phone", { width: 740, height: 360 }, "ko"], ["portrait", { width: 390, height: 844 }, "en"]]) {
      const x = await home(cap, vp, lang);
      await x.waitForSelector("#clanMembers .cl-m");
      await noSideways(x, name);
      const txt = await clanText(x);
      lang === "en" ? assert.match(txt, /Leave the clan.*2\/50.*XP together.*Leader.*Member/) : assert.match(txt, /클랜 나가기.*2\/50명.*경험치 합계.*클랜장.*멤버/);
      const o = await x.evaluate(() => { const r = document.getElementById("clan").getBoundingClientRect(); return { right: r.right, w: innerWidth, kick: [...document.querySelectorAll("[data-kick]")].map((b) => { const q = b.getBoundingClientRect(); return q.right <= innerWidth && q.left >= 0; }) }; });
      assert.ok(o.right <= o.w + 1 && o.kick.every(Boolean), name + ": the section and its buttons are inside the screen");
      await x.evaluate(() => document.getElementById("clan").scrollIntoView()); await shot(x, "home-" + name + "-owner");
      const y = await home(third, vp, lang); await noSideways(y, name + " (no clan)");
      await y.evaluate(() => document.getElementById("clan").scrollIntoView()); await shot(y, "home-" + name + "-free");
      lang === "en" && assert.match(await clanText(y), /You are not in a clan yet.*Make a clan.*Making a clan costs .*1,000/);
      await x.context().close(); await y.context().close();
    }
    // a guest has none; with clans off nobody has one
    const guest = await h.api("guest", { device: "browser-clans-guest" }, { "x-forwarded-for": "10.4.9.9" });
    const G = await home(guest, undefined, "ko", true); await G.waitForTimeout(500);
    assert.equal(await G.locator("#clan").isVisible(), false, "no Clan section for a guest");
    await G.context().close();
    const cfg = JSON.parse(JSON.stringify(h.config)); cfg.clan.on = false;
    assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: cfg })).status, 200); h.advance(30000);
    const O = await home(cap, undefined, "ko", true); await O.waitForTimeout(500);
    assert.equal(await O.locator("#clan").isVisible(), false, "no Clan section while the owner has clans off");
    cfg.clan.on = true; await h.api("a_config_set", { atoken: owner.atoken, config: cfg }); h.advance(30000);
    await O.context().close(); await M.context().close(); await P.context().close();
    console.log("homepage: make (cost, error shown), search, join, edit, kick, leave, English, 3 sizes, guest and switch-off");

    // ── 2. the owner page ──
    const clanId = h.user("clancap").clan;
    await account("clanzed"); await h.api("clan_create", { token: (await h.api("auth", { id: "clanzed", pw: "password", device: "browser-test-clanzed" })).token, name: "Zebra Club", tag: "ZEB", desc: "" });
    const A = await plain({ width: 1280, height: 900 }, { adm: owner.atoken }, "/admin.html");
    A.__prompt = [];
    await A.waitForSelector(".kpis .kpi");
    await A.click('#nav button[data-v="clans"]');
    await A.waitForSelector("#cl tr[data-id]");
    assert.deepEqual(await A.$$eval("#cl tr[data-id]", (r) => r.map((x) => x.children[1].textContent)), ["Zebra Club", "별빛 클랜"], "both clans, by name");
    assert.match(await A.locator("#ccount").textContent(), /2개/);
    await A.fill("#cq", "zeb"); await A.click("#cgo");
    await A.waitForFunction(() => document.querySelectorAll("#cl tr[data-id]").length === 1);
    await A.fill("#cq", ""); await A.click("#cgo");
    await A.waitForFunction(() => document.querySelectorAll("#cl tr[data-id]").length === 2);
    await A.click(`#cl tr[data-id="${clanId}"] [data-op="members"]`);
    await A.waitForSelector("#cm table");
    assert.deepEqual(await A.$$eval("#cm table tr:not(:first-child)", (r) => r.map((x) => x.innerText.replace(/\s+/g, " ").trim().replace(/\d{4}.*$/, "").trim())), ["clancap 3 클랜장", "clanmem 2 멤버"], "the members with level and role");
    await shot(A, "admin");
    A.__prompt = ["별빛 본부", "STR2"];
    await A.click(`#cl tr[data-id="${clanId}"] [data-op="rename"]`);
    await A.waitForFunction(() => /별빛 본부/.test(document.getElementById("cl").textContent));
    assert.equal((await h.api("clan_get", { id: clanId })).clan.tag, "STR2");
    A.__prompt = ["Zebra Club", "STR2"];
    await A.click(`#cl tr[data-id]:not([data-id="${clanId}"]) [data-op="rename"]`);
    await A.waitForFunction(() => /이미 있는 클랜/.test(document.getElementById("toast").textContent));
    await A.click(`#cl tr[data-id="${clanId}"] [data-op="delete"]`);
    await A.waitForFunction(() => document.querySelectorAll("#cl tr[data-id]").length === 1);
    assert.equal((await h.api("clan_get", { id: clanId })).status, 404);
    assert.equal(h.user("clancap").clan, undefined); assert.equal(h.user("clanmem").clan, undefined);
    await A.setViewportSize({ width: 390, height: 844 }); await A.waitForTimeout(200);
    await shot(A, "admin-phone");
    await A.context().close();
    console.log("owner page: search, members, rename (and a clash told), delete");

    // ── 3. the leaderboard tabs ──
    // matches with a valid ticket put accounts on the boards
    const play = async (token, kills, win) => { const t = await h.api("match_start", { token }); h.advance(61000); const r = await h.api("progress", { token, mt: t.ticket, win, outcome: win ? "win" : "loss", kills, match: { mode: "std", s: win ? [13, 4] : [4, 13] } }); assert.equal(r.status, 200, JSON.stringify(r)); h.advance(21000); };
    const names = ["lbalpha", "lbbravo", "lbcharlie", "lbdelta"], toks = {};
    for (const [i, id] of names.entries()) toks[id] = (await account(id, 5000)).token;
    await h.api("clan_create", { token: toks.lbalpha, name: "Board Club", tag: "BRD", desc: "" });
    await h.api("clan_join", { token: toks.lbbravo, id: h.user("lbalpha").clan });
    await h.api("clan_create", { token: toks.lbcharlie, name: "Other Crew", tag: "OTH", desc: "" });
    await play(toks.lbalpha, 9, true); await play(toks.lbbravo, 4, true); await play(toks.lbcharlie, 12, false); await play(toks.lbdelta, 1, false);
    h.advance(20000);
    const L = await f.page("lbalpha", { width: 1280, height: 720 }, {}, { quality: false, syncSkins: false });
    await L.evaluate(() => { titleCam = () => {}; });
    await L.evaluate(() => LEADERBOARD.open());
    await L.waitForSelector("#lbd-tabs button");
    assert.deepEqual(await L.$$eval("#lbd-tabs button", (b) => b.map((x) => x.textContent)), ["랭크", "킬", "레벨", "승리", "경기", "클랜"]);
    assert.equal(await L.locator("#lbd-tabs button.on").textContent(), "랭크");
    await shot(L, "lb-rank");
    const rows = (page) => page.$$eval("#lbd-body .lbd-row:not(.hd)", (r) => r.map((x) => [...x.children].map((c) => c.innerText.replace(/\s+/g, " ").trim())));
    const go = async (tab, wait) => { await L.click(`#lbd-tabs button[data-tab="${tab}"]`); await L.waitForFunction((n) => document.querySelectorAll("#lbd-body .lbd-row:not(.hd)").length >= n, wait || 1, { timeout: 15000 }); };
    await go("kills", 4);
    assert.deepEqual(await rows(L), [["1", "lbcharlie[OTH]", "", "12"], ["2", "lbalpha[BRD]나", "", "9"], ["3", "lbbravo[BRD]", "", "4"], ["4", "lbdelta", "", "1"]]);
    assert.match(await L.locator("#lbd-me").textContent(), /2위 · lbalpha · 9 킬/);
    assert.match(await L.locator("#lbd-season").textContent(), /전체 기간/);
    await shot(L, "lb-kills");
    await go("level", 4);
    const lv = await rows(L);
    assert.equal(lv.length, 4); assert.match(lv[0][2], /^Lv \d+$/); assert.ok(+lv[0][3].replace(/,/g, "") >= +lv[3][3].replace(/,/g, ""), "XP, highest first"); assert.match(await L.locator("#lbd-me").textContent(), /위 · lbalpha .*Lv \d+ · [\d,]+ XP/);
    await go("wins", 4); assert.deepEqual((await rows(L)).map((r) => r[3]), ["1", "1", "0", "0"]);
    await go("matches", 4); assert.deepEqual((await rows(L)).map((r) => r[3]), ["1", "1", "1", "1"]);
    await go("clan", 2);
    const clans = await rows(L);
    assert.deepEqual(clans.map((r) => r[1]).sort(), ["[BRD]Board Club", "[OTH]Other Crew", "[ZEB]Zebra Club"], "the clans from before too, the tag first");
    assert.deepEqual(clans.find((r) => /BRD/.test(r[1])).slice(2, 3), ["2"], "two members");
    assert.match(await L.locator("#lbd-me").textContent(), /위 · \[BRD\]Board Club · [\d,]+ XP/);
    await shot(L, "lb-clan");
    // my place outside the list: a list of one row
    await L.evaluate(() => { LEADERBOARD.tab("kills"); });
    await L.setViewportSize({ width: 390, height: 844 }); await L.waitForTimeout(300);
    await shot(L, "lb-phone");
    assert.ok(await L.evaluate(() => document.getElementById("s-ranks").scrollWidth <= innerWidth + 1), "the board fits a portrait phone");
    await L.setViewportSize({ width: 852, height: 393 }); await L.waitForTimeout(300); await shot(L, "lb-landscape");
    const far = await h.api("board", { kind: "kills", n: 2, token: toks.lbdelta });
    assert.deepEqual([far.rows.length, far.me.pos, far.me.v], [2, 4, 1], "the own place outside the top rows comes from the server");
    await L.context().close();
    const LE = await f.page("lbbravo", { width: 1280, height: 720 }, {}, { quality: false, syncSkins: false, beforeLoad: (p) => p.addInitScript(() => localStorage.setItem("lgp_lang", "en")) });
    await LE.evaluate(() => { titleCam = () => {}; LEADERBOARD.open(); });
    await LE.waitForSelector("#lbd-tabs button");
    assert.deepEqual(await LE.$$eval("#lbd-tabs button", (b) => b.map((x) => x.textContent)), ["Ranked", "Kills", "Level", "Wins", "Matches", "Clans"]);
    await LE.click('#lbd-tabs button[data-tab="clan"]'); await LE.waitForSelector("#lbd-body .lbd-row.bd:not(.hd)");
    assert.match(await LE.locator("#lbd-season").textContent(), /All time/);
    assert.match(await LE.locator("#lbd-me").textContent(), /#\d+ · \[BRD\]Board Club/);
    await shot(LE, "lb-clan-en");
    await LE.context().close();
    console.log("leaderboard: tabs (ko, en), order, own place, clan board, phone and landscape");

    // ── 4. the tags in a game ──
    for (const id of ["tagcap", "tagmem", "tagnone"]) await account(id, 5000);
    const tcap = (await h.api("auth", { id: "tagcap", pw: "password", device: "browser-test-tagcap" })).token, tmem = (await h.api("auth", { id: "tagmem", pw: "password", device: "browser-test-tagmem" })).token;
    const made = await h.api("clan_create", { token: tcap, name: "Tag Squad", tag: "TAGS", desc: "" }); assert.equal(made.status, 200, JSON.stringify(made));
    assert.equal((await h.api("clan_join", { token: tmem, id: made.clan.id })).status, 200);
    const force = (p) => p.addInitScript(() => { window.PREMATCH_FORCE = true; window.PREMATCH_DURATION = 40000; });
    const quiet = async (p) => { await p.evaluate(() => { titleCam = () => {}; }); return p; };
    const prep = (page) => page.evaluate(async () => { await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } }); });
    // solo first: the pre-match cards and the result board show my own tag
    const S = await quiet(await f.page("tagcap", { width: 1280, height: 720 }, {}, { beforeLoad: force }));
    await S.waitForFunction(() => window.CLAN_ME && CLAN_ME.tag === "TAGS", null, { timeout: 15000 });
    await S.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); });
    await S.waitForSelector("#prematch .pm-card", { timeout: 30000 });
    assert.deepEqual(await S.$$eval("#prematch .pm-card .clan-tag", (e) => e.map((x) => x.closest(".pm-card").classList.contains("me") + ":" + x.textContent)), ["true:[TAGS]"], "only my card has a tag (the bots have none)");
    await shot(S, "game-prematch");
    await S.evaluate(() => { document.getElementById("prematch") && (window.PREMATCH_FORCE = false); try { PREMATCH.skip && PREMATCH.skip(); } catch (e) {} });
    await S.waitForFunction(() => document.getElementById("prematch").hidden || !document.getElementById("prematch").offsetParent, null, { timeout: 15000 }).catch(() => {});
    await S.evaluate(() => { world.round = 3; world.scoreAtk = 13; world.over = true; gameOver(); });
    await S.waitForSelector("#ov-board .ovb-row .clan-tag", { timeout: 15000 });
    assert.deepEqual(await S.$$eval("#ov-board .ovb-row .clan-tag", (e) => e.map((x) => x.textContent)), ["[TAGS]"], "the result board: my tag only");
    await shot(S, "game-result");
    await S.context().close();
    // a room: the host and a guest in the clan, a third page without one
    // loaded together: a third page opened beside two that already draw the title scene starves on this machine's CPUs
    const [host, g1, g2] = await Promise.all(["tagcap", "tagmem", "tagnone"].map(async (id) => quiet(await f.page(id, { width: 1280, height: 720 }, {}, { beforeLoad: force }))));
    for (const p of [host, g1, g2]) await prep(p);
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    // g2 claims a tag in its hello (nothing the host believes) and g1 has one from the server
    await g2.evaluate(() => { window.CLAN_ME = { id: "x", tag: "FAKE", name: "Fake" }; });
    for (const [i, g] of [g1, g2].entries()) { await g.evaluate((c) => joinRoom(c), code); await host.waitForFunction((n) => room.members.size === n, i + 2, { timeout: 60000 }); }
    const lobbyTags = (page) => page.$$eval("#lb-atk .lb-nm, #lb-def .lb-nm", (n) => n.map((x) => x.textContent.replace(/\s+/g, " ").trim()).filter(Boolean));
    await host.waitForFunction(() => [...document.querySelectorAll("#lb-atk .lb-nm, #lb-def .lb-nm")].filter((n) => n.querySelector(".lv-chip")).length >= 3, null, { timeout: 30000 });
    await g1.waitForFunction(() => [...document.querySelectorAll("#lb-atk .lb-nm, #lb-def .lb-nm")].filter((n) => n.querySelector(".lv-chip")).length >= 3, null, { timeout: 30000 });
    for (const [who, page] of [["host", host], ["guest", g1], ["guest without a clan", g2]]) {
      await page.waitForFunction(() => [...document.querySelectorAll("#lb-atk .lb-nm, #lb-def .lb-nm")].filter((n) => n.querySelector(".clan-tag")).length >= 2, null, { timeout: 30000 });
      const t = await lobbyTags(page);
      assert.equal(t.filter((x) => /\[TAGS\]/.test(x)).length, 2, who + " sees two [TAGS] in the lobby: " + JSON.stringify(t));
      assert.equal(t.filter((x) => /FAKE/.test(x)).length, 0, who + ": a tag nobody's server vouched for is not shown");
      assert.ok(t.some((x) => /^tagnone( \(나\))?\s*Lv \d+$/.test(x)), who + ": the account with no clan has only its level: " + JSON.stringify(t));
    }
    await shot(host, "game-lobby");
    await host.evaluate(() => { room.mode = "std"; room.map = "field"; hostStartMatch(); });
    for (const g of [g1, g2]) await g.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    for (const [who, page] of [["host", host], ["guest", g1], ["guest without a clan", g2]]) {
      await page.waitForSelector("#prematch .pm-card", { timeout: 30000 });
      await page.waitForFunction(() => document.querySelectorAll("#prematch .pm-card .clan-tag").length >= 2, null, { timeout: 20000 });
      assert.equal(await page.$$eval("#prematch .pm-card .clan-tag", (e) => e.filter((x) => x.textContent === "[TAGS]").length), 2, who + ": two cards carry the tag");
      assert.equal(await page.$$eval("#prematch .pm-card .clan-tag", (e) => e.filter((x) => /FAKE/.test(x.textContent) && !x.closest(".pm-card").classList.contains("me")).length), 0, who + ": nobody else is shown with the tag g2 set on its own page");
    }
    await shot(host, "game-vs");
    for (const p of [host, g1, g2]) await p.evaluate(() => { document.getElementById("prematch").hidden = true; world.roundTime = 99999; });
    for (const [who, page] of [["host", host], ["guest", g1]]) {
      await page.evaluate(() => { QOL.openBoard("sb", true); });
      await page.waitForSelector("#board .bd-row .clan-tag", { timeout: 10000 });
      const rows = await page.$$eval("#board .bd-row:not(.hd)", (r) => r.map((x) => [x.querySelector(".nm").firstChild.textContent, !!x.querySelector(".clan-tag")]).filter((x) => x[1]).map((x) => x[0]).sort());
      assert.deepEqual(rows, ["tagcap", "tagmem"], who + ": the scoreboard shows the tag on the two clan members and nobody else");
      await page.evaluate(() => QOL.closeBoard());
    }
    await shot(host, "game-scoreboard");
    await host.evaluate(() => { world.round = 3; world.scoreAtk = 13; world.over = true; gameOver(); });
    await host.waitForSelector("#ov-board .ovb-row", { timeout: 15000 });
    assert.deepEqual(await host.$$eval("#ov-board .ovb-row:not(.hd)", (r) => r.filter((x) => x.querySelector(".clan-tag")).map((x) => x.querySelector(".nm").firstChild.textContent).sort()), ["tagcap", "tagmem"], "the result board: the two clan members");
    await shot(host, "game-result-room");
    for (const p of [host, g1, g2]) await p.context().close();
    console.log("game: tags in the lobby, the VS cards, the scoreboard and the result board, from the server's data only");
  } finally {
    await f.browser.close(); signaling && signaling.close && signaling.close();
  }
  assert.deepEqual(errors.concat(f.errors), [], "no page errors");
  console.log("clans browser test passed");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
