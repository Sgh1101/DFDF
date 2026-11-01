// The article pages (guide, controls, modes, maps, agents, patch notes, about, contact, privacy), the home page's links and
// text block, and the service worker with them. Looked at in screenshots (test-results/site-pages/) at 375 x 740 and 1280 x 800
// before these checks were written. The data pages are also compared with the live game (AGENTS, MAP_LIST, GAME_MODES).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ||= "1";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { fixture } = require("./browser-fixture");
const BASE = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000", SHOTS = path.join(__dirname, "..", "test-results", "site-pages");
const PAGES = ["guide", "controls", "modes", "maps", "agents", "patch-notes", "about", "contact", "privacy"];
const NAV = [["guide", "게임 소개"], ["controls", "조작법"], ["modes", "모드"], ["maps", "맵"], ["agents", "요원"], ["patch-notes", "패치노트"], ["about", "소개"], ["contact", "문의"]];
const SIZES = [[375, 740], [1280, 800]];
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "site-pages", "data.json"), "utf8"));
(async () => {
  const f = await fixture(), h = f.h, errors = []; let offline = false; // while offline, failed loads are the point
  fs.mkdirSync(SHOTS, { recursive: true });
  const owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "site-owner" }), A = owner.atoken;
  const route = async (page) => {
    await page.route("**/api/v1?*", async (r) => { const j = await h.api(new URL(r.request().url()).searchParams.get("a"), r.request().postDataJSON() || {}); await r.fulfill({ status: j.status, contentType: "application/json", body: JSON.stringify(j) }); });
    // the web fonts are not reachable here: an empty answer, so nothing counts as a failed load
    await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "" }));
    await page.route("https://fonts.gstatic.com/**", (r) => r.fulfill({ status: 204, body: "" }));
    page.on("pageerror", (e) => errors.push(page.url() + " " + e.message));
    page.on("console", (m) => m.type() === "error" && !offline && errors.push(page.url() + " console: " + m.text()));
  };
  const open = async (ctx, p) => { const page = await ctx.newPage(); await route(page); await page.goto(`${BASE}/${p}`, { waitUntil: "load" }); return page; };
  try {
    // ── every page, at a phone and a desktop size ──
    for (const [w, hgt] of SIZES) {
      const ctx = await f.browser.newContext({ viewport: { width: w, height: hgt }, serviceWorkers: "block", isMobile: w < 500 });
      for (const p of PAGES) {
        const page = await open(ctx, p + ".html");
        const r = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth, iw: innerWidth, h1: document.querySelector("h1").textContent,
          nav: [...document.querySelectorAll(".sh-nav a")].map((a) => [a.getAttribute("href"), a.textContent, a.getBoundingClientRect().width > 0]),
          foot: [...document.querySelectorAll(".sf-links a")].map((a) => a.getAttribute("href")),
          play: [...document.querySelectorAll('a[href="./play.html"]')].map((a) => [a.textContent.trim(), a.getBoundingClientRect().width, a.getBoundingClientRect().height]),
          canonical: document.querySelector('link[rel=canonical]').href, og: !!document.querySelector('meta[property="og:title"]'), desc: document.querySelector('meta[name=description]').content.length,
          lang: document.documentElement.lang, over: [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".tbl-wrap")).map((e) => e.tagName + "." + e.className).slice(0, 5),
        }));
        assert.ok(r.sw <= r.iw, `${p} ${w}: no horizontal scroll (${r.sw} > ${r.iw})`);
        assert.deepEqual(r.over, [], `${p} ${w}: nothing sticks out of the page`);
        assert.deepEqual(r.nav.map((n) => [n[0], n[1]]), NAV.map(([k, l]) => [`./${k}.html`, l]), `${p}: header navigation`);
        assert.ok(r.nav.every((n) => n[2]), `${p} ${w}: every navigation link is shown`);
        assert.deepEqual(r.foot, NAV.map(([k]) => `./${k}.html`).concat("./privacy.html"), `${p}: footer links`);
        assert.ok(r.play.length >= 2 && r.play.every(([t, bw, bh]) => t === "게임 시작" && bw >= 80 && bh >= 40), `${p} ${w}: header and footer 게임 시작 buttons`);
        assert.equal(r.canonical, `https://13fps.xyz/${p}.html`); assert.ok(r.og && r.desc >= 40 && r.lang === "ko");
        await page.screenshot({ path: path.join(SHOTS, `${p}-${w}.png`), fullPage: true });
        await page.close();
      }
      await ctx.close();
    }
    console.log("pages: header, footer, meta, no sideways scroll at 375 and 1280");

    // ── the text is in the HTML, not made by scripts ──
    const noJs = await f.browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
    for (const [p, need] of [["guide", ["스파이크", "구매 시간", "랭크전", "초대 코드"]], ["controls", ["Enter", "F8", "키 설정", "터치"]], ["modes", data.modes.map((m) => m.name)], ["maps", data.maps.map((m) => m.name)], ["agents", data.agents.map((a) => a.name)], ["patch-notes", ["패치노트"]], ["about", ["무료", "공정"]], ["privacy", ["Google", "쿠키"]]]) {
      const page = await noJs.newPage(); await page.route("https://fonts.*/**", (r) => r.abort());
      await page.goto(`${BASE}/${p}.html`, { waitUntil: "domcontentloaded" });
      const t = await page.locator("main").innerText();
      assert.ok(t.length > 1200, `${p}: ${t.length} characters readable without scripts`);
      for (const n of need) assert.ok(t.includes(n), `${p}: "${n}" is in the HTML`);
      await page.close();
    }
    await noJs.close();
    console.log("the pages read without scripts");

    // ── the data pages against the live game ──
    const game = await f.page("sitepages", { width: 1280, height: 800 }, {}, { bootTimeout: 120000 });
    await game.waitForFunction(() => window.ASCENT_TRIAL && MAP_LIST.some((m) => m.key === "ascent_trial") && window.WEEK_MAP_KEY !== undefined, null, { timeout: 60000 });
    const live = await game.evaluate(() => ({
      agents: AGENTS.map((a) => [a.id, a.name, a.role, a.abilities.map((x) => [x.key, x.name, x.desc])]),
      maps: MAP_LIST.filter((m) => m.key !== window.WEEK_MAP_KEY).map((m) => [m.key, m.name, MAP_SIZE(m.key)]),
      modes: Object.entries(GAME_MODES).map(([k, m]) => [k, m.name, m.sub]), listed: [...document.querySelectorAll("#sel-modes button")].map((b) => b.textContent),
    }));
    assert.deepEqual(data.agents.map((a) => [a.id, a.name, a.role, a.abilities.map((x) => [x.key, x.name, x.desc])]), live.agents, "agents.html is made from the live roster: run scripts/dump-site-data.js");
    assert.deepEqual(data.maps.map((m) => [m.key, m.name, m.size]), live.maps, "the map pool of maps.html is the live pool");
    assert.deepEqual(data.modes.map((m) => [m.key, m.name, m.sub]), live.modes, "modes.html lists the live GAME_MODES");
    assert.deepEqual(data.listed.map((k) => data.modes.find((m) => m.key === k).name), live.listed, "the room's mode buttons");
    await game.close();
    console.log("agents", live.agents.length, "maps", live.maps.length, "modes", live.modes.length, "match the game");

    // ── the contact form ──
    const send = async (page, o) => {
      await page.selectOption("#cType", o.type || "ask");
      o.title && await page.fill("#cTitle", o.title);
      await page.fill("#cText", o.text); o.contact && await page.fill("#cContact", o.contact);
      await page.click("#cSend");
      await page.waitForFunction(() => !document.querySelector("#cMsg").hidden && /접수|5자|이름/.test(document.querySelector("#cMsg").textContent), null, { timeout: 10000 });
    };
    for (const [w, hgt] of SIZES) {
      // a visitor with no account: a guest session of the device
      const ctx = await f.browser.newContext({ viewport: { width: w, height: hgt }, serviceWorkers: "block" });
      let page = await open(ctx, "contact.html");
      assert.equal(await page.locator("#contactMail").isHidden(), true, "no e-mail line until the owner sets one");
      assert.equal(await page.locator("#mineBox").isHidden(), true);
      await page.fill("#cText", "abc"); await page.click("#cSend");
      assert.match(await page.locator("#cMsg").textContent(), /5자 이상/, "too short is refused before sending");
      await page.screenshot({ path: path.join(SHOTS, `contact-error-${w}.png`) });
      const gtitle = `게스트 문의 ${w}`;
      await send(page, { type: "bug", title: gtitle, text: "게스트로 보내는 긴 문의 내용입니다. 모드와 맵은 일반전 포구입니다." });
      const msg = await page.locator("#cMsg").textContent();
      assert.match(msg, /접수되었습니다 \(접수 번호 [a-z0-9]+\)/); assert.match(msg, /내가 보낸 문의/);
      await page.waitForSelector("#mineList li");
      assert.match(await page.locator("#mineList").textContent(), new RegExp(gtitle + ".*버그 신고.*접수됨"));
      assert.equal(await page.inputValue("#cText"), "", "the form is cleared after sending");
      await page.screenshot({ path: path.join(SHOTS, `contact-sent-${w}.png`), fullPage: true });
      const list = (await h.api("a_feedback", { atoken: A })).items;
      const mine = list.find((x) => x.title === gtitle);
      assert.ok(mine, "the owner's feedback list has the guest's message");
      assert.equal(mine.by.guest, true); assert.equal(mine.type, "bug"); assert.equal(mine.ctx.page, "contact"); assert.match(mine.text, /^게스트로 보내는/);
      // the owner answers: the reply shows on the page
      await h.api("a_feedback_set", { atoken: A, id: mine.id, status: "done", reply: "확인했고 고쳤습니다" });
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector("#mineList li .re");
      assert.match(await page.locator("#mineList").textContent(), /완료.*답변: 확인했고 고쳤습니다/);
      await ctx.close();
      // a signed-in account: its own session, its own name
      const id = "site" + w, s = await h.api("auth", { id, pw: "password", device: "site-" + id });
      const ctx2 = await f.browser.newContext({ viewport: { width: w, height: hgt }, serviceWorkers: "block" });
      await ctx2.addInitScript((sess) => localStorage.setItem("lgp_session", JSON.stringify(sess)), s);
      page = await open(ctx2, "contact.html");
      await page.selectOption("#cType", "report"); assert.equal(await page.locator("#cReportBox").isVisible(), true, "a player report asks for the name");
      await page.fill("#cText", "신고 내용을 적었습니다 충분히"); await page.click("#cSend");
      assert.match(await page.locator("#cMsg").textContent(), /이름을 적어/);
      await page.fill("#cTarget", "나쁜사람");
      const atitle = `계정 문의 ${w}`;
      await send(page, { type: "report", title: atitle, text: "신고 내용을 적었습니다 충분히", contact: "답장은 여기로" });
      assert.match(await page.locator("#cMsg").textContent(), /접수되었습니다/);
      const acc = (await h.api("a_feedback", { atoken: A })).items.find((x) => x.title === atitle);
      assert.ok(acc, "the owner's list has the account's message");
      assert.equal(acc.by.id, id); assert.equal(acc.by.guest, false); assert.equal(acc.type, "report"); assert.equal(acc.report.target, "나쁜사람"); assert.equal(acc.contact, "답장은 여기로");
      await ctx2.close();
    }
    console.log("contact form: guest and account messages reached the owner's list, with the reply shown back");

    // the owner's e-mail address: shown only when set
    const setMail = async (v) => { const c = JSON.parse(JSON.stringify((await h.api("a_config_get", { atoken: A })).config)); c.game.contactEmail = v; assert.equal((await h.api("a_config_set", { atoken: A, config: c })).status, 200); };
    const mctx = await f.browser.newContext({ viewport: { width: 375, height: 740 }, serviceWorkers: "block" });
    await setMail("hello@example.com");
    let page = await open(mctx, "contact.html");
    await page.waitForSelector("#contactMail:not([hidden])");
    assert.equal(await page.getAttribute("#contactMailLink", "href"), "mailto:hello@example.com"); assert.equal(await page.textContent("#contactMailLink"), "hello@example.com");
    await page.screenshot({ path: path.join(SHOTS, "contact-email-375.png") }); await page.close();
    await setMail("");
    page = await open(mctx, "contact.html"); await page.waitForTimeout(800);
    assert.equal(await page.locator("#contactMail").isHidden(), true, "no address, no line"); await page.close(); await mctx.close();
    console.log("contact e-mail line: only when game.contactEmail is set");

    // ── privacy: the advertising section ──
    const pctx = await f.browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
    page = await open(pctx, "privacy.html");
    const ads = await page.evaluate(() => { const h2 = document.getElementById("ads"); const box = []; for (let e = h2.nextElementSibling; e && e.tagName !== "H2"; e = e.nextElementSibling) box.push(e); return { head: h2.textContent, text: box.map((e) => e.textContent).join(" "), links: box.flatMap((e) => [...e.querySelectorAll("a")].map((a) => a.href)) }; });
    assert.equal(ads.head, "광고와 광고 쿠키");
    for (const s of ["제3자 공급업체", "Google", "이전에 방문한 기록", "광고 쿠키", "이 사이트 및/또는 인터넷의 다른 사이트"]) assert.ok(ads.text.includes(s), s);
    for (const l of ["https://adssettings.google.com/", "https://www.aboutads.info/choices", "https://www.youronlinechoices.eu/"]) assert.ok(ads.links.includes(l), l);
    assert.ok(!(await page.textContent("main")).includes("광고나 별도의 분석 도구는 사용하지 않습니다"));
    assert.equal(await page.locator('a[href="./contact.html"]').count() >= 3, true, "deletion requests go to the contact page");
    await page.close(); await pctx.close();
    console.log("privacy: advertising section with the required disclosures and opt-out links");

    // ── the home page: footer links, the text block, the top links on a wide screen ──
    for (const lang of ["ko", "en"]) for (const [w, hgt] of SIZES) {
      const ctx = await f.browser.newContext({ viewport: { width: w, height: hgt }, serviceWorkers: "block" });
      await ctx.addInitScript((l) => localStorage.setItem("lgp_lang", l), lang);
      const hp = await open(ctx, "index.html");
      await hp.waitForFunction(() => document.querySelectorAll("#feat li").length > 0 && typeof CFG !== "undefined" && !!CFG);
      const r = await hp.evaluate(() => ({
        foot: [...document.querySelectorAll("footer .fnav a")].map((a) => [a.getAttribute("href"), a.textContent.trim(), a.getBoundingClientRect().height]),
        intro: [...document.querySelectorAll(".intro")].filter((e) => e.offsetParent).map((e) => ({ lang: e.lang, text: e.textContent.length, links: [...e.querySelectorAll("a")].map((a) => a.getAttribute("href")) })),
        top: getComputedStyle(document.querySelector(".tnav")).display, sw: document.documentElement.scrollWidth, iw: innerWidth,
      }));
      assert.deepEqual(r.foot.map((x) => x[0]), NAV.map(([k]) => `./${k}.html`).concat("./privacy.html"), `home ${lang} ${w}: footer links`);
      assert.ok(r.foot.every((x) => x[1] && x[2] >= 28), "link labels are filled in and easy to tap");
      assert.equal(r.intro.length, 1, "one text block per language"); assert.equal(r.intro[0].lang, lang); assert.ok(r.intro[0].text > 200);
      for (const l of ["./guide.html", "./modes.html", "./maps.html", "./agents.html"]) assert.ok(r.intro[0].links.includes(l), l);
      assert.equal(r.top, w >= 1000 ? "flex" : "none", "the top links show on a wide screen only"); assert.ok(r.sw <= r.iw, "no sideways scroll");
      if (lang === "ko") assert.deepEqual(r.foot.map((x) => x[1]), ["게임 소개", "조작법", "모드", "맵", "요원", "패치노트", "소개", "문의", "개인정보처리방침"]);
      await hp.screenshot({ path: path.join(SHOTS, `home-${lang}-${w}.png`), fullPage: true });
      await ctx.close();
    }
    console.log("home page: footer links, text block, top links");

    // ── the service worker leaves the pages alone ──
    const sctx = await f.browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "allow" });
    const sp = await open(sctx, "index.html");
    await sp.evaluate(() => navigator.serviceWorker.ready); await sp.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    await sp.goto(`${BASE}/guide.html`, { waitUntil: "load" });
    assert.match(await sp.locator("h1").textContent(), /게임 소개/);
    assert.equal(await sp.evaluate(async () => { for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) if (/\.html$|pages\.css|\/$/.test(new URL(r.url).pathname)) return r.url; } return ""; }), "", "no article page or its stylesheet is cached");
    await sctx.setOffline(true); offline = true;
    await sp.goto(`${BASE}/guide.html`, { waitUntil: "domcontentloaded" });
    assert.match(await sp.locator("body").innerText(), /인터넷에 연결되어 있지 않습니다/, "offline: the friendly screen");
    await sctx.setOffline(false); offline = false;
    await sp.getByRole("button", { name: "다시 시도" }).click(); await sp.waitForSelector("h1");
    assert.match(await sp.locator("h1").textContent(), /게임 소개/, "back online: the page, from the network");
    await sctx.close();
    console.log("service worker: pages come from the network, an offline visit gets the friendly screen");

    assert.deepEqual(errors, [], "no page errors or console errors");
    console.log("site pages passed");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
