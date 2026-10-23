const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 문의 · 제안: the form on the homepage and in the game's menu (bug, agent idea, player report ...), what
// it sends, the "mine" list with the answer, and the owner's box in the admin page (badge, list, status,
// reply, delete).
(async () => {
  const f = await fixture();
  try {
    const base = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000", dir = process.env.SHOT_DIR || "/tmp";
    const page = await f.page("sender", { width: 1280, height: 800 });
    // the game's menu has the entry too
    assert.equal(await page.locator("#go-feedback").count(), 1, "a Feedback item in the title menu");
    await page.evaluate(() => { document.getElementById("go-feedback").click(); });
    await page.waitForSelector("#fb-back:not([hidden])");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#fb .fb-types button").length), 7, "seven kinds");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.getElementById("fb-back").hidden), true, "Escape closes it");
    assert.equal(await page.locator("#pz-feedback").count(), 1, "and the settings window has a button");
    // the homepage
    await page.evaluate(() => localStorage.setItem("lgp_lang", "ko"));
    await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#fbOpen");
    await page.click("#fbOpen");
    await page.waitForSelector("#fb-back:not([hidden])");
    await page.screenshot({ path: dir + "/feedback-form.png" });
    // too short: not sent
    await page.fill("#fb-text", "짧");
    await page.click("#fb-go");
    assert.match(await page.textContent("#fb-msg"), /5자 이상/);
    // a bug
    await page.fill("#fb-title", "상점이 안 열려요");
    await page.selectOption("#fb-where", "상점 · 무기고");
    await page.fill("#fb-steps", "1. 시작 2. B 누르기");
    await page.fill("#fb-text", "구매 단계에서 B를 눌러도 상점이 열리지 않습니다.");
    await page.click("#fb-go");
    await page.waitForSelector("#fb-msg.ok");
    assert.match(await page.textContent("#fb-msg"), /접수되었습니다/);
    // the list of mine: where it stands
    assert.match(await page.textContent("#fb-body"), /상점이 안 열려요/);
    assert.match(await page.textContent("#fb-body"), /접수됨/);
    // an agent idea: name and an ability needed
    await page.click('.fb-tabs [data-t="new"]');
    await page.click('.fb-types [data-k="agent"]');
    await page.fill("#fb-text", "시간을 다루는 요원입니다. 되감기가 핵심입니다.");
    await page.click("#fb-go");
    assert.match(await page.textContent("#fb-msg"), /요원 이름/);
    await page.fill("#fb-an", "시계공");
    await page.selectOption("#fb-role", "전략가");
    await page.click("#fb-go");
    assert.match(await page.textContent("#fb-msg"), /능력을 하나 이상/);
    await page.fill("#fb-n0", "되감기"); await page.fill("#fb-d0", "3초 전 위치와 체력으로 돌아간다. 쿨 20초");
    await page.fill("#fb-n3", "시간 정지"); await page.fill("#fb-d3", "모두 2초 멈춘다");
    await page.click("#fb-go");
    await page.waitForSelector("#fb-msg.ok");
    // a player report
    await page.click('.fb-tabs [data-t="new"]');
    await page.click('.fb-types [data-k="report"]');
    await page.fill("#fb-text", "벽 너머를 보고 쏘는 것 같습니다.");
    await page.fill("#fb-target", "의심자");
    await page.selectOption("#fb-reason", "cheat");
    await page.fill("#fb-room", "abc123");
    await page.click("#fb-go");
    await page.waitForSelector("#fb-msg.ok");
    const stored = [...f.h.db.entries()].filter(([k]) => k.startsWith("fb:") && !k.startsWith("fbu:") && !k.startsWith("fbdup")).map(([, v]) => JSON.parse(v));
    assert.equal(stored.length, 3);
    const ag = stored.find((x) => x.type === "agent");
    assert.deepEqual(ag.agent.abilities.map((a) => a.key + ":" + a.name), ["Q:되감기", "X:시간 정지"]);
    assert.equal(ag.agent.role, "전략가");
    assert.equal(ag.by.id, "sender"); assert.equal(ag.ctx.page, "home"); assert.equal(ag.ctx.view, "1280x800");
    assert.deepEqual(stored.find((x) => x.type === "report").report, { target: "의심자", reason: "cheat", room: "ABC123" });
    // English
    await page.evaluate(() => localStorage.setItem("lgp_lang", "en"));
    await page.click("#fb-back .fb-x");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#fbOpen");
    await page.click("#fbOpen");
    await page.waitForSelector("#fb-back:not([hidden])");
    assert.match(await page.textContent("#fb .fb-types"), /Bug report/);
    await page.keyboard.press("Escape");

    // a phone sideways: the whole form fits, the send button can be pressed
    const ph = await f.page("phoner", { width: 568, height: 320 }, { hasTouch: true, isMobile: true });
    await ph.evaluate(() => { localStorage.setItem("lgp_lang", "ko"); });
    await ph.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
    await ph.waitForSelector("#fbOpen");
    await ph.tap("#fbOpen");
    await ph.waitForSelector("#fb-back:not([hidden])");
    const fit = await ph.evaluate(() => {
      const r = (e) => e.getBoundingClientRect(), box = r(document.getElementById("fb")), go = r(document.getElementById("fb-go"));
      const hit = document.elementFromPoint(go.left + go.width / 2, go.top + go.height / 2);
      return { inside: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth, goOn: go.bottom <= innerHeight && go.top >= 0, goHit: hit === document.getElementById("fb-go") };
    });
    assert.deepEqual(fit, { inside: true, goOn: true, goHit: true });
    await ph.screenshot({ path: dir + "/feedback-phone.png" });
    await ph.context().close();

    // the owner's box
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "fb-owner" });
    const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ap = await ctx.newPage();
    ap.on("pageerror", (e) => f.errors.push(e.message)); ap.on("dialog", (d) => d.accept());
    await ap.route("**/api/v1?*", async (route) => {
      const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
      await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) });
    });
    await ap.addInitScript((t) => sessionStorage.setItem("adm_t", t), owner.atoken);
    await ap.goto(base + "/admin.html", { waitUntil: "domcontentloaded" });
    await ap.waitForFunction(() => document.getElementById("fbBadge") && document.getElementById("fbBadge").textContent === "3", null, { timeout: 15000 });
    await ap.click('#nav [data-v="feedback"]');
    await ap.waitForSelector(".fbc");
    assert.equal(await ap.locator(".fbc").count(), 3);
    assert.match(await ap.textContent("#fsum"), /새 문의 3/);
    // filter by kind
    await ap.selectOption("#ft", "agent");
    await ap.waitForFunction(() => document.querySelectorAll(".fbc").length === 1);
    await ap.click(".fbc summary");
    await ap.waitForSelector(".fbc .abl");
    assert.match(await ap.textContent(".fbc .abl"), /되감기/);
    assert.match(await ap.textContent(".fbc .abl"), /시간 정지/);
    // opening one marks it seen
    await ap.waitForFunction(() => document.getElementById("fbBadge").textContent === "2");
    await ap.screenshot({ path: dir + "/feedback-admin.png" });
    // answer it and finish it
    await ap.fill(".fbc [data-note]", "재밌는 아이디어, 다음 요원 후보");
    await ap.fill(".fbc [data-reply]", "좋은 제안 감사합니다. 검토하겠습니다!");
    await ap.click(".fbc [data-save]");
    await ap.click('.fbc [data-s="done"]');
    await ap.waitForFunction(() => /완료/.test(document.querySelector(".fbc [data-st]").textContent));
    const saved = [...f.h.db.entries()].filter(([k]) => k.startsWith("fb:") && !k.startsWith("fbu:") && !k.startsWith("fbdup")).map(([, v]) => JSON.parse(v)).find((x) => x.type === "agent");
    assert.equal(saved.status, "done"); assert.equal(saved.reply, "좋은 제안 감사합니다. 검토하겠습니다!"); assert.equal(saved.note, "재밌는 아이디어, 다음 요원 후보");
    // the sender sees the answer, not the note
    await page.evaluate(() => localStorage.setItem("lgp_lang", "ko"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#fbOpen");
    await page.click("#fbOpen");
    await page.click('.fb-tabs [data-t="mine"]');
    await page.waitForSelector("#fb .fb-item");
    const mine = await page.textContent("#fb-body");
    assert.match(mine, /검토하겠습니다/); assert.match(mine, /완료/); assert.doesNotMatch(mine, /다음 요원 후보/);
    // a delete
    await ap.selectOption("#ft", "");
    await ap.waitForFunction(() => document.querySelectorAll(".fbc").length === 3);
    await ap.locator(".fbc").last().locator("summary").click();
    await ap.locator(".fbc").last().locator("[data-del]").click();
    await ap.waitForFunction(() => document.querySelectorAll(".fbc").length === 2);
    await ctx.close();
    assert.deepEqual(f.errors, []);
    console.log("feedback: the form (bug, agent, report), the list of mine with the answer, a phone fit, English, the owner's box with badge, filter, status, reply and delete");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
