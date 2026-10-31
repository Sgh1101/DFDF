const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { harness } = require("./api-harness");
const { build, PAGES } = require("../scripts/build-site-pages");
const { NAV } = require("../scripts/site-pages/layout");
const root = path.resolve(__dirname, ".."), read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const data = JSON.parse(read("scripts/site-pages/data.json"));
// the text of a page the way a reader gets it: no tags, entities undone, spaces squeezed
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

test("the committed pages and sitemap are what scripts/build-site-pages.js writes", () => {
  const files = build();
  assert.deepEqual(Object.keys(files).filter((f) => f !== "sitemap.xml").sort(), PAGES.map((p) => (p === "patch-notes" ? "patch-notes" : p) + ".html").sort(), "every page of the list is written");
  for (const [name, html] of Object.entries(files)) assert.equal(read(name), html, name + " is out of date: run node scripts/build-site-pages.js");
});

test("every page has the header, the footer, the meta tags and a canonical link on 13fps.xyz", () => {
  for (const [name, html] of Object.entries(build())) {
    if (name === "sitemap.xml") continue;
    assert.match(html, /<title>[^<]+ \| 13<\/title>/, name + " title");
    assert.match(html, /<meta name="description" content="[^"]{40,}">/, name + " description");
    assert.ok(html.includes(`<link rel="canonical" href="https://13fps.xyz/${name}">`), name + " canonical");
    for (const p of ["og:title", "og:description", "og:url", "og:image", "og:type"]) assert.ok(html.includes(`property="${p}"`), name + " " + p);
    assert.ok(html.includes('<a class="btn go sh-play" href="./play.html">게임 시작</a>'), name + " header play button");
    for (const [f, label] of NAV) assert.ok(html.includes(`<a href="./${f}"`) && html.includes(`>${label}</a>`), name + " links " + f);
    assert.ok(html.includes('<a href="./privacy.html">개인정보처리방침</a>'), name + " footer privacy link");
    assert.ok(html.includes('href="./css/pages.css"'), name + " stylesheet");
    assert.ok(!/<script[^>]*src="[^"]*(adsbygoogle|googlesyndication|pagead)/.test(html), name + " has no ad script yet");
  }
});

test("each content page has real text (several hundred words) in its HTML", () => {
  const files = build(), min = { "guide.html": 900, "controls.html": 700, "modes.html": 800, "maps.html": 900, "agents.html": 1200, "patch-notes.html": 500, "about.html": 600, "privacy.html": 600, "contact.html": 300 };
  for (const [name, n] of Object.entries(min)) {
    const words = text(files[name]).split(" ").filter(Boolean).length;
    assert.ok(words >= n, `${name} has ${words} words, expected at least ${n}`);
  }
});

test("agents.html names every agent and each of its four abilities (the game's roster and the dump agree)", () => {
  const page = text(read("agents.html")), roster = JSON.parse(read("js/agent-roster.json"));
  assert.equal(data.agents.length, roster.length, "data.json has every agent of js/agent-roster.json: run scripts/dump-site-data.js");
  assert.deepEqual(data.agents.map((a) => a.id).sort(), roster.map((a) => a.id).sort());
  for (const a of data.agents) {
    assert.ok(page.includes(a.name), "agent " + a.name);
    assert.equal(a.abilities.length, 4, a.name + " has four abilities");
    for (const x of a.abilities) { assert.ok(page.includes(x.name), `${a.name}: ability ${x.name}`); assert.ok(page.includes(x.desc.replace(/\s+/g, " ")), `${a.name}: text of ${x.name}`); }
    assert.ok(fs.existsSync(path.join(root, "assets/site/agents", a.id + ".webp")), "portrait of " + a.id);
  }
  assert.ok(page.includes("능력 " + data.agents.length * 4 + "개"), "the count of abilities");
});

test("maps.html has every map of the pool with its size, and a picture", () => {
  const page = text(read("maps.html"));
  assert.equal(data.maps.length, 22, "the permanent pool is 22 maps");
  for (const m of data.maps) {
    assert.ok(page.includes(m.name), "map " + m.name);
    assert.ok(page.includes(`${m.width}×${m.depth}m`), m.name + " footprint");
    assert.ok(read("maps.html").includes(`src="./assets/site/maps/${m.key}.webp"`), m.name + " picture");
    assert.ok(fs.existsSync(path.join(root, "assets/site/maps", m.key + ".webp")), "picture file of " + m.key);
    assert.ok(page.includes({ full: "5대5", small: "소규모 3대3", "1v1": "1대1" }[m.cat]), m.name + " size class");
  }
  const by = (c) => data.maps.filter((m) => m.cat === c).length;
  assert.deepEqual([by("full"), by("small"), by("1v1")], [11, 8, 3], "the pool is 11 + 8 + 3");
});

test("modes.html has every mode of the game's list, with its rule line and the keys match the game's source", () => {
  const page = text(read("modes.html"));
  const src = read("js/legacy/05-game-modes.js"), keys = [...src.matchAll(/^\s{4}(\w+): \{ name: "/gm)].map((m) => m[1]);
  for (const k of keys) assert.ok(data.modes.some((m) => m.key === k), "data.json has the mode " + k + ": run scripts/dump-site-data.js");
  for (const m of data.modes) {
    assert.ok(page.includes(m.name), "mode " + m.name);
    assert.ok(page.includes(m.sub), "rule line of " + m.name);
    assert.ok(read("modes.html").includes(`id="${m.key}"`), "anchor " + m.key);
  }
  assert.equal(data.listed.length, 11, "the picker lists eleven modes");
});

test("controls.html lists every default key of js/keymap.js", () => {
  const KEYMAP = require("../js/keymap.js"), html = read("controls.html");
  for (const a of KEYMAP.ACTIONS) {
    assert.ok(html.includes(`<td>${a.ko}</td>`), "action " + a.ko);
    for (const c of a.def) assert.ok(html.includes(`<kbd>${KEYMAP.label(c)}</kbd>`), a.ko + " key " + c);
  }
  for (const k of ["F8", "Enter", "Esc"]) assert.ok(html.includes(`<kbd>${k}</kbd>`), k);
});

test("the patch notes are newest first and the page's date is the newest one", () => {
  const dates = [...read("patch-notes.html").matchAll(/<time datetime="(\d{4}-\d\d-\d\d)"/g)].map((m) => m[1]);
  assert.ok(dates.length >= 10);
  assert.deepEqual(dates, dates.slice().sort().reverse(), "newest first");
  assert.ok(read("sitemap.xml").includes(`<loc>https://13fps.xyz/patch-notes.html</loc>\n    <lastmod>${dates[0]}</lastmod>`));
});

test("privacy.html carries the advertising disclosures and the new effective date", () => {
  const html = read("privacy.html"), t = text(html);
  assert.ok(!t.includes("광고나 별도의 분석 도구는 사용하지 않습니다"), "the no-ads sentence is gone");
  for (const s of ["제3자 공급업체", "Google", "쿠키", "이전에 방문한 기록", "다른 사이트", "https://adssettings.google.com", "https://www.aboutads.info/choices", "https://www.youronlinechoices.eu", "만 14세 미만", "방침의 변경", "시행일: 2026년 10월 31일"]) assert.ok(t.includes(s) || html.includes(s), s);
  assert.ok(html.includes('id="ads"'));
  assert.ok(html.includes('href="./contact.html"'), "links to the contact page for deletion requests");
});

test("robots.txt allows the site but not the owner page, and names the sitemap", () => {
  const r = read("robots.txt");
  assert.match(r, /^User-agent: \*$/m); assert.match(r, /^Allow: \/$/m);
  assert.match(r, /^Disallow: \/admin$/m); assert.match(r, /^Disallow: \/admin\.html$/m);
  assert.match(r, /^Sitemap: https:\/\/13fps\.xyz\/sitemap\.xml$/m);
  assert.ok(!/^Disallow: \/$/m.test(r) && !/Disallow: \/(guide|maps|agents|privacy)/.test(r));
});

test("sitemap.xml lists the home page, the game and every page with a lastmod, and nothing that does not exist", () => {
  const x = read("sitemap.xml"), locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(x.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  const want = ["", "play.html", ...PAGES.map((p) => p + ".html")].map((p) => "https://13fps.xyz/" + p);
  assert.deepEqual(locs, want);
  assert.equal([...x.matchAll(/<lastmod>\d{4}-\d\d-\d\d<\/lastmod>/g)].length, locs.length, "every url has a lastmod");
  for (const l of locs) { const f = l.replace("https://13fps.xyz/", "") || "index.html"; assert.ok(fs.existsSync(path.join(root, f)), f + " exists"); }
  assert.ok(!x.includes("admin"));
});

test("the home page footer links every new page and the home page has a text block about the game", () => {
  const html = read("index.html");
  for (const f of ["guide", "controls", "modes", "maps", "agents", "patch-notes", "about", "contact", "privacy"]) assert.ok(new RegExp(`<footer>[\\s\\S]*href="\\./${f}\\.html"`).test(html), "footer links " + f);
  assert.match(html, /<section class="intro" lang="ko">[\s\S]*href="\.\/guide\.html"[\s\S]*href="\.\/modes\.html"[\s\S]*href="\.\/maps\.html"[\s\S]*href="\.\/agents\.html"/);
});

test("game.contactEmail: empty by default, in the public config, checked on save", async () => {
  const h = harness(), owner = await h.api("auth", { id: "owner", pw: "owner-password", device: "d-owner" }), A = owner.atoken;
  assert.equal(h.config.game.contactEmail, "", "the default is empty: no address in the code");
  assert.equal((await h.api("config", {})).config.game.contactEmail, "", "the public config serves it");
  const set = async (v) => { const c = JSON.parse(JSON.stringify((await h.api("a_config_get", { atoken: A })).config)); c.game.contactEmail = v; return h.api("a_config_set", { atoken: A, config: c }); };
  for (const bad of ["no-at-sign", "a@b", "a b@c.de", "<x>@y.zz", "a@b.cc'\"", "x".repeat(80) + "@y.zz"]) assert.equal((await set(bad)).status, 400, "rejects " + bad);
  assert.equal((await h.api("config", {})).config.game.contactEmail, "", "a rejected value was not saved");
  const ok = await set("  help@example.com  ");
  assert.equal(ok.status, 200); assert.equal(ok.config.game.contactEmail, "help@example.com", "trimmed");
  assert.equal((await h.api("config", {})).config.game.contactEmail, "help@example.com");
  assert.equal((await set("")).status, 200, "it can be cleared");
  assert.equal((await h.api("config", {})).config.game.contactEmail, "");
  assert.ok(/game\.contactEmail": \["문의 이메일"/.test(read("admin.html")), "labelled on the owner page");
});

test("no e-mail address is written into the pages or the contact script", () => {
  for (const f of ["contact.html", "about.html", "privacy.html", "js/contact-page.js"]) assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(read(f).replace(/\[\^\\s@<>"'\]\+@\[\^\\s@<>"'\]\+\\\.\[\^\\s@<>"'\]\+/g, "")), f + " has no address");
});
