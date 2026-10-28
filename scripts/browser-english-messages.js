const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
// The English page (localStorage lgp_lang = "en") has no Korean left in the banners and messages of a match, nor in the
// server's error texts. Agent, weapon, skin and ability names (and the ability descriptions) stay Korean on purpose.
//  1. every Korean text the code hands to banner / bannerMe / tellTeam / announce / spikeUI / netAlert / netLoading /
//     pill / pushKill (read from the sources) comes out in English;
//  2. a real match on the English page: the banners and messages that show up while the round starts, ends, switches
//     sides, the spike is planted and defused, someone dies, the pause, change-agent, admin and cheat screens are opened;
//  3. server errors: a wrong login, the limit on matches started, and a few more through GAME_REQUEST;
//  4. the Korean page keeps its Korean texts.
// All failures are listed together.
const HANGUL = /[가-힣]/, bad = [];
const check = (ok, message) => { if (!ok) bad.push(message); };
const root = path.join(__dirname, "..");

// ── 1. the literals handed to the message functions, read from the sources ──
function literalsOfCalls() {
  const files = [...fs.readdirSync(path.join(root, "js/legacy")).map((f) => "js/legacy/" + f), ...fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js")).map((f) => "js/" + f)];
  const CALL = /\b(banner|bannerMe|tellTeam|announce|spikeUI|netAlert|netLoading|pill|pushKill)\(/g;
  const argsOf = (s, i) => {
    let depth = 1, j = i, q = null;
    for (; j < s.length && depth > 0; j++) {
      const c = s[j];
      if (q) { if ("\\" === c) { j++; continue; } if ("`" === q && "$" === c && "{" === s[j + 1]) { let k = 1; j += 2; while (j < s.length && k > 0) { if ("{" === s[j]) k++; else if ("}" === s[j]) k--; j++; } j--; continue; } if (c === q) q = null; continue; }
      if ('"' === c || "'" === c || "`" === c) { q = c; continue; }
      if ("(" === c) depth++; else if (")" === c) depth--;
    }
    return s.slice(i, j - 1);
  };
  const out = new Map();
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    let m; CALL.lastIndex = 0;
    while ((m = CALL.exec(src))) {
      if (/function\s+$/.test(src.slice(m.index - 9, m.index))) continue;
      // already bilingual: L("ko", "en") / E(...) are left out
      let a = argsOf(src, m.index + m[0].length).replace(/\b[LE]\((?:[^()]|\([^()]*\))*\)/g, "");
      const lits = [];
      const grab = (text) => {
        for (const r of [/"((?:\\.|[^"\\\n])*)"/g, /'((?:\\.|[^'\\\n])*)'/g, /`((?:\\.|[^`\\])*)`/g]) {
          let x; while ((x = r.exec(text))) {
            let v = x[1];
            if (r.source.startsWith("`")) { (v.match(/\$\{([^}]*)\}/g) || []).forEach((e) => grab(e.slice(2, -1))); v = v.replace(/\$\{[^}]*\}/g, "1"); }
            lits.push(v);
          }
        }
      };
      grab(a);
      for (const v of lits) if (HANGUL.test(v)) out.set(v, f.replace(/^js\/(legacy\/)?/, "").slice(0, 14));
    }
  }
  return [...out];
}

(async () => {
  const f = await fixture();
  try {
    // ── the English page ──
    const en = await f.page("englishmsg", { width: 1280, height: 720 }, {}, { bootTimeout: 120000, beforeLoad: (p) => p.addInitScript(() => { try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} }) });
    // names that stay Korean; the recorder of every text that has Korean in it after the page's own translation
    await en.evaluate(() => {
      const names = new Set();
      for (const a of AGENTS) { names.add(a.name); for (const k in a) "string" === typeof a[k] && /[가-힣]/.test(a[k]) && a[k].length < 80 && names.add(a[k]); for (const d of a.abilities || []) { [d.name, d.desc, d.counterplay, d.tag].forEach((x) => x && names.add(String(x))); } }
      for (const k in WEAPONS) names.add(WEAPONS[k].name);
      for (const s of GUN_SKINS.list || []) { names.add(s.ko); }
      // map names and the bots' first names are names too; 잔영, 그림자 사냥 and 섬광 are the first names of abilities that agents renamed
      for (const m of MAP_LIST || []) { names.add(m.name); }
      for (const k in MAPS || {}) { MAPS[k] && MAPS[k].name && names.add(MAPS[k].name); }
      for (const n of ["이준", "서윤", "도현", "하늘", "민석", "지우", "태양", "세인", "은별", "한결", "잔영", "그림자 사냥", "섬광"]) names.add(n);
      window.__names = [...names].filter((n) => /[가-힣]/.test(n)).sort((a, b) => b.length - a.length);
      window.__strip = (t) => { for (const n of window.__names) t = t.split(n).join(""); return t; };
      window.__left = [];
      // looked at a moment later: the page's own translator answers a new text in the same turn, a text still Korean after that is left
      const note = (where, t, node, attr) => setTimeout(() => {
        if (node && !node.isConnected) return;
        if ("tt-bgname" === where) return; // the map name and place on the title screen
        t = ((attr ? node.getAttribute(attr) : node ? node.nodeValue : t) || "").replace(/\s+/g, " ").trim();
        if (/[가-힣]/.test(t) && /[가-힣]/.test(window.__strip(t))) window.__left.push(where + " :: " + t.slice(0, 100));
      }, 0);
      new MutationObserver((ms) => {
        for (const m of ms) {
          if ("attributes" === m.type) note("@" + m.attributeName + " " + (m.target.id || m.target.className), "", m.target, m.attributeName);
          else if ("characterData" === m.type) note(m.target.parentElement && (m.target.parentElement.id || m.target.parentElement.className), "", m.target);
          else m.addedNodes.forEach((n) => { if (3 === n.nodeType) note(n.parentElement && (n.parentElement.id || n.parentElement.className), "", n); else if (1 === n.nodeType) { const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let x; while ((x = w.nextNode())) { if (!/^(SCRIPT|STYLE)$/.test(x.parentElement.tagName)) note(x.parentElement.id || x.parentElement.className || x.parentElement.tagName, "", x); } } });
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder"] });
      // every banner text, in order (the next banner often replaces the one before it at once)
      window.__banners = [];
      // what each banner call says in English (two banners in one turn leave only the last one on the screen)
      window.__calls = [];
      const real = banner;
      banner = function (text) { try { window.__calls.push(window.GAME_EN ? window.GAME_EN(String(text)) : String(text)); } catch (e) {} return real.apply(this, arguments); };
      new MutationObserver(() => window.__banners.push(document.getElementById("banner").textContent)).observe(document.getElementById("banner"), { subtree: true, childList: true, characterData: true });
    });
    const left = async (label) => { const l = await en.evaluate(() => { const r = [...new Set(window.__left)]; window.__left = []; return r; }); check(!l.length, "English page, " + label + ", Korean left: " + l.slice(0, 12).join(" | ")); };

    // 1. the literals in the sources
    const lits = literalsOfCalls();
    const fails = await en.evaluate((list) => list.filter(([text]) => {
      const t = window.GAME_EN ? window.GAME_EN(text) : text; // (no GAME_EN: the old page translates nothing of these)
      return /[가-힣]/.test(window.__strip(t)) && !/^(남은 |발|초| 사이트|개인전 )$/.test(text);
    }).map(([text, file]) => file + " :: " + text.slice(0, 70)), lits);
    check(fails.length === 0, "English page: " + fails.length + " of " + lits.length + " message texts in the code stay Korean: " + fails.slice(0, 60).join(" | "));

    // 2. a match
    await en.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); });
    await en.waitForTimeout(1200);
    await en.evaluate(() => { closeShop(); });
    await left("title, start and buy phase");
    const bannerHas = async (re, what) => { const b = await en.evaluate(() => window.__banners.concat(window.__calls)); check(b.some((t) => re.test(t)), "English banner missing: " + what + " (saw " + JSON.stringify(b.slice(-8)) + ")"); };
    await bannerHas(/^Round 1 · Buy phase$/, "round 1 buy phase");
    // round ends, each reason
    for (const [reason, side, re] of [["수비팀 전멸", "atk", /^Round (won|lost) · Defenders eliminated$/], ["공격팀 전멸", "def", /^Round (won|lost) · Attackers eliminated$/], ["시간 초과", "def", /^Round (won|lost) · Time ran out$/], ["스파이크 폭발", "atk", /^Round (won|lost) · Spike detonated$/]]) {
      await en.evaluate(([r, s]) => { world.over = false; world.phase = "live"; clearTimeout(roundEndTimer); endRound(s, r); clearTimeout(roundEndTimer); }, [reason, side]);
      await bannerHas(re, "round end, " + reason);
    }
    // the spike
    await en.evaluate(() => { cancelRoundEnd(); world.over = false; world.phase = "live"; closeShop(); plantSpike(player.pos.x, player.pos.z, MAP.sites[0], true); });
    await en.waitForTimeout(400);
    await bannerHas(/^Spike planted at site /, "spike planted");
    await en.evaluate(() => { world.spike.timer = 20; });
    await en.waitForTimeout(600);
    await en.evaluate(() => { world.spike.timer = 5; player.team = "def"; player.defusing = 0; });
    await en.waitForTimeout(500);
    await left("spike planted");
    await en.evaluate(() => { defuseDone("player"); clearTimeout(roundEndTimer); });
    await bannerHas(/^Round (won|lost) · Spike defused$/, "spike defused");
    // half time: sides swap once the last round of the first half (round halfTime()) is over
    await en.evaluate(() => { world.over = false; world.phase = "live"; world.scoreAtk = 0; world.scoreDef = 0; world.round = halfTime(); endRound("atk", "수비팀 전멸"); });
    await en.waitForFunction(() => window.__calls.some((t) => /Switching sides/.test(t)), null, { timeout: 15000 }).catch(() => {});
    await bannerHas(/^Switching sides$/, "half time");
    await en.waitForTimeout(800);
    await left("round end and half time");
    // death, spectating, the scoreboard, the map, the pause menu
    await en.evaluate(() => { const foe = (world.actors || []).find((a) => a.team !== player.team) || world.entities.find((a) => a.team !== player.team); foe && killActor(foe, player); });
    await en.waitForTimeout(500);
    await en.keyboard.down("Tab"); await en.waitForTimeout(500); await en.keyboard.up("Tab");
    await en.keyboard.press("m"); await en.waitForTimeout(400); await en.keyboard.press("m");
    await en.evaluate(() => { player.hp = 0; try { killActor(player, null); } catch (e) {} });
    await en.waitForTimeout(800);
    await left("kill, death, scoreboard and map");
    await en.evaluate(() => { $("pz-agent") && $("pz-agent").click(); });
    await en.waitForTimeout(500);
    await en.evaluate(() => { const c = $("as-close"); c && c.click(); });
    await en.evaluate(() => { ADMIN_UNLOCKED = true; $("pz-admin").click(); openAdmin(); buildAdminUI(); });
    await en.waitForTimeout(500);
    await en.evaluate(() => { for (const b of document.querySelectorAll("#admin button")) { try { b.matches("#ad-lockout,#ad-default,.ad-x") || b.click(); } catch (e) {} } });
    await en.waitForTimeout(500);
    await en.evaluate(() => { $("ad-default") && $("ad-default").click(); });
    await en.waitForTimeout(300);
    await en.evaluate(() => { $("ad-lockout") && $("ad-lockout").click(); });
    await en.waitForTimeout(400);
    await bannerHas(/^(Admin mode|Cheats) locked$/, "admin locked");
    await left("pause, change agent and admin screens");

    // 3. server errors
    const direct = await en.evaluate(async () => {
      const call = async (a, b) => { try { await (async () => { const { response, data } = await GAME_REQUEST("/api/v1?a=" + a, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); if (!data.ok) throw Object.assign(new Error(data.error), { ko: data.errorKo }); })(); return "ok"; } catch (e) { return e.message + "|" + (e.ko || ""); } };
      return { shortId: await call("auth", { id: "x", pw: "password", device: "d1234567" }), pw: await call("auth", { id: "englishmsg", pw: "wrong-password", device: "d1234567" }), bad: await call("me", { token: "nope" }), shop: await call("shop_buy", { token: "nope" }) };
    });
    check(!HANGUL.test(direct.shortId.split("|")[0]) && /2-16/.test(direct.shortId), "server error, short id: " + direct.shortId);
    check(/^That ID already exists\./.test(direct.pw) && /\|이미 있는 아이디입니다/.test(direct.pw), "server error, wrong password for a taken id: " + direct.pw);
    check(!HANGUL.test(direct.bad.split("|")[0]) && /sign in again/i.test(direct.bad), "server error, bad token: " + direct.bad);
    // the limit on matches started: 12 tickets are used up, the next match's banner says why
    const token = await en.evaluate(() => JSON.parse(localStorage.getItem("lgp_session")).token);
    for (let i = 0; i < 12; i++) await f.h.api("match_start", { token });
    await en.evaluate(() => { window.__banners.length = 0; world.phase = "menu"; });
    await en.waitForTimeout(1500);
    await en.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); });
    await en.waitForTimeout(2500);
    const limit = await en.evaluate(() => window.__banners.slice());
    check(limit.some((t) => /^Sent too often$/.test(t)), "English banner missing: the limit on matches started (saw " + JSON.stringify(limit.slice(-6)) + ")");
    await left("server errors");
    await en.context().close();

    // a wrong login on the home page (the game page sends a signed-out player there to sign in; it uses the same GAME_REQUEST)
    const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
    const home = await ctx.newPage(); home.on("pageerror", (e) => f.errors.push(e.message));
    await home.route("**/api/v1?*", async (route) => { const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {}); await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) }); });
    for (const host of ["fonts.googleapis.com", "fonts.gstatic.com"]) await home.route("https://" + host + "/**", (route) => route.abort());
    await home.addInitScript(() => { try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} });
    await home.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/", { waitUntil: "domcontentloaded" });
    const shown = await home.waitForSelector("#uid", { state: "visible", timeout: 30000 }).catch(() => null);
    check(!!shown, "the sign-in form of the home page did not show");
    if (shown) {
      await home.fill("#uid", "englishmsg"); await home.fill("#upw", "not-the-password"); await home.click("#doAuth");
      await home.waitForFunction(() => document.getElementById("aerr").textContent.trim(), null, { timeout: 15000 }).catch(() => {});
      const err = await home.evaluate(() => document.getElementById("aerr").textContent.trim());
      check(/^That ID already exists\./.test(err), "wrong login on the home page: " + err);
    }
    await ctx.close();

    // 4. the Korean page keeps its Korean
    const ko = await f.page("koreanmsg", { width: 1280, height: 720 }, {}, { bootTimeout: 120000 });
    await ko.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); });
    await ko.waitForTimeout(1200);
    const koBanner = await ko.evaluate(() => document.getElementById("banner").textContent);
    check(/라운드 · 구매 단계/.test(koBanner), "Korean page: the buy phase banner changed (" + koBanner + ")");
    const koErr = await ko.evaluate(async () => { const { data } = await GAME_REQUEST("/api/v1?a=auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "x", pw: "password", device: "d1234567" }) }); return data.error; });
    check(/^아이디는 2~16자/.test(koErr), "Korean page: the server error changed (" + koErr + ")");
    await ko.context().close();
    check(f.errors.length === 0, "page errors: " + f.errors.join(" | "));
  } finally { await f.browser.close(); }
  assert.equal(bad.length, 0, "\n" + bad.join("\n"));
  console.log("English match messages and server errors passed");
})().then(() => process.exit(0), (e) => { console.error(e.message || e); process.exit(1); });
