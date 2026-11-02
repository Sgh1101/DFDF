const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The game's type: readable Korean faces. Titles, banners and numbers in Black Han Sans, body text in Noto Sans KR,
// on the game page and on the homepage. The Champions Phantom's kill banner keeps its own type (Orbitron for the word,
// Noto Sans KR for the small lines), as it was. The fixture blocks Google Fonts, so this checks the families the
// pages ask for, not the drawn glyphs.
const DISPLAY = /^"Black Han Sans"/, BODY = /^"Noto Sans KR"/;
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("softfonts", { width: 1280, height: 720 });
    // the agents' names on the select screen: Black Han Sans (the owner's pick) at its own weight, not made bold by the
    // browser (Black Han Sans at 900 looked smeared)
    await page.evaluate(() => { titleCam = () => {}; document.getElementById("go-play").click(); });
    await page.waitForFunction(() => document.querySelector("#sel-grid .acard-name") && document.querySelector("#sel-detail .det-name"));
    const agentNames = await page.evaluate(() => [".acard-name", ".det-name"].map((s) => { const cs = getComputedStyle(document.querySelector(s)); return [s, cs.fontFamily, cs.fontWeight]; }));
    for (const [s, fam, weight] of agentNames) { assert.match(fam, /^"Black Han Sans"/, s + " is in Black Han Sans: " + fam); assert.equal(weight, "400", s + " is not made bold"); }
    await page.evaluate(() => { room.mode = "std"; room.map = "pogu"; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = "live"; });
    await page.waitForFunction(() => myActor()?.alive && !document.getElementById("hud").hidden);
    const read = () => page.evaluate(() => Object.fromEntries(["#kf-main", "#kf-sub", "#kf-tag", "#kf-streak", "#phantom-emblems", "#banner", "#tb-time", "#roster", "body"].map((s) => { const e = document.querySelector(s); return [s, e ? getComputedStyle(e).fontFamily : null]; })));
    // a kill with a plain skin: the banner's word and the centre banner in Black Han Sans, the rest in Noto Sans KR
    await page.evaluate(() => { window.KILL_EVENT = null; killStreak = 0; playKillFx("화령", false); banner("라운드 승리", "#4ade80"); });
    await page.waitForFunction(() => !!document.getElementById("kf-main").textContent);
    const plain = await read();
    for (const s of ["#kf-main", "#kf-tag", "#kf-streak", "#banner"]) assert.match(plain[s], DISPLAY, s + " is in Black Han Sans: " + plain[s]);
    for (const s of ["#kf-sub", "#roster", "body"]) assert.match(plain[s], BODY, s + " is in Noto Sans KR: " + plain[s]);
    // the Champions Phantom's banner as it was
    await page.evaluate(() => { window.KILL_EVENT = { kind: "gun", skin: "champions_atk" }; killStreak = 0; playKillFx("화령", false); });
    await page.waitForFunction(() => !!document.getElementById("kf-main").textContent);
    const champ = await read();
    assert.match(await page.evaluate(() => document.getElementById("killfx").className), /phantom-attack/, "the Champions banner is up");
    for (const s of ["#kf-main", "#kf-tag", "#kf-streak"]) assert.equal(champ[s], "Orbitron, system-ui, sans-serif", s + " in the Champions banner keeps Orbitron");
    for (const s of ["#kf-sub", "#phantom-emblems"]) assert.equal(champ[s], '"Noto Sans KR", system-ui, sans-serif', s + " in the Champions banner keeps Noto Sans KR");
    // the next plain kill is on the heading face again
    await page.evaluate(() => { window.KILL_EVENT = null; killStreak = 0; playKillFx("화령", false); });
    await page.waitForFunction(() => !!document.getElementById("kf-main").textContent);
    assert.match((await read())["#kf-main"], DISPLAY, "a plain banner after the Champions one is in Black Han Sans again");
    // the pages ask Google Fonts for both faces (and still for the two the Champions banner and the map labels use)
    const links = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href).filter((h) => /fonts\.googleapis/.test(h)));
    assert.ok(links.some((h) => /family=Black\+Han\+Sans/.test(h) && /family=Black\+Han\+Sans/.test(h) && /family=Orbitron/.test(h) && /family=Noto\+Sans\+KR/.test(h)), "the game page loads Black Han Sans, Orbitron and Noto Sans KR: " + links);
    await page.context().close();

    // the homepage
    const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 720 } }), home = await ctx.newPage();
    await home.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await home.route("https://fonts.gstatic.com/**", (r) => r.abort());
    await home.route("**/api/v1?*", async (route) => { const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {}); await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) }); });
    await home.goto((process.env.DFDF_BASE_URL || "http://127.0.0.1:3000") + "/index.html", { waitUntil: "domcontentloaded" });
    const hv = await home.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { fd: cs.getPropertyValue("--fd").trim(), fb: cs.getPropertyValue("--fb").trim(), body: getComputedStyle(document.body).fontFamily }; });
    assert.match(hv.fd, /^'Black Han Sans'/, "homepage titles in Black Han Sans: " + hv.fd);
    assert.match(hv.fb, /^'Noto Sans KR'/, "homepage text in Noto Sans KR: " + hv.fb);
    assert.match(hv.body, BODY, "homepage body in Noto Sans KR: " + hv.body);
    await ctx.close();
    assert.deepEqual(f.errors, []);
    console.log("soft fonts: Black Han Sans for titles and banners, Noto Sans KR for text, Black Han Sans for the agents' names, on the game and the homepage; the Champions banner as it was");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
