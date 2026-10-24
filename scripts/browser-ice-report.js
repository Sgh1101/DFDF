const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// A guest whose connection broke can send the connection story with a bug report, without a console:
//   1. a connection that fails writes a compact summary (last 40 lines, types only, no addresses) to sessionStorage
//   2. losing the host shows a card with "연결 문제 신고"; it survives a reload
//   3. the card opens the bug form (where: 연결 끊김) which says "연결 기록 첨부됨 (N줄)" and has a checkbox to leave it out
//   4. sending stores it; the admin card shows it as a table and the inbox can filter on it
// The drop is simulated through the real code path: a real RTCPeerConnection is told its ICE state is "failed".
(async () => {
  const f = await fixture();
  try {
    const base = process.env.DFDF_BASE_URL || "http://127.0.0.1:3000", dir = process.env.SHOT_DIR || "/tmp";
    const page = await f.page("icedrop", { width: 960, height: 540 }, {}, { quality: "perf" });
    const drop = () => page.evaluate(async () => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.example.invalid:3478" }, { urls: "turn:turn.example.invalid:3478", username: "u", credential: "c" }] });
      Object.defineProperty(pc, "iceConnectionState", { get: () => "failed" });
      pc.dispatchEvent(new Event("iceconnectionstatechange"));
      const until = Date.now() + 5000;
      while (Date.now() < until && !iceLog().some((l) => l.pc === pc.__iceId && l.ev === "route:failed")) await new Promise((r) => setTimeout(r, 50));
      pc.close();
      return pc.__iceId;
    });
    // 1. a failed connection leaves a summary
    const id = await drop();
    const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("lgp_ice_report")));
    assert.ok(saved && saved.lines.length >= 3 && saved.lines.length <= 40, "a summary is kept: " + (saved && saved.lines.length));
    assert.ok(saved.lines.some((l) => l.pc === id && l.ev === "ice:failed"), "the failed state is in it");
    assert.ok(saved.lines.some((l) => l.pc === id && l.ev === "route:failed"), "and the route line");
    const created = saved.lines.find((l) => l.pc === id && l.ev === "created");
    assert.deepEqual([created.servers, created.turn], [2, 1], "server list reduced to counts");
    assert.doesNotMatch(JSON.stringify(saved), /\d+\.\d+\.\d+\.\d+|example\.invalid|candidate:/, "no address in the summary");
    // 2. the host is gone: a card offers the report (and again after a reload)
    await page.evaluate(() => { NET.mode = "client"; NET.room = "ABCDEF"; NET.onHostGone(); });
    await page.waitForSelector("#ice-notice:not([hidden])");
    assert.match(await page.textContent("#ice-notice"), /연결이 끊겼습니다/);
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("lgp_ice_report")).reason), "host-gone");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.GAME_BOOT && !document.documentElement.dataset.gameLoading, null, { timeout: 60000 });
    await page.waitForSelector("#ice-notice:not([hidden])", { timeout: 15000 });
    // 3. one tap: the bug form, prefilled, with the attachment line
    await page.click("#ice-notice-report");
    await page.waitForSelector("#fb-back:not([hidden])");
    assert.equal(await page.evaluate(() => document.getElementById("ice-notice").hidden), true, "the card is put away");
    assert.equal(await page.inputValue("#fb-where"), "연결 끊김");
    assert.match(await page.inputValue("#fb-text"), /연결이 끊겼/);
    assert.match(await page.textContent("#fb-ice-line"), /^연결 기록 첨부됨 \(\d+줄\)$/);
    assert.equal(await page.isChecked("#fb-ice-skip"), false);
    await page.screenshot({ path: dir + "/ice-report-form.png" });
    await page.click("#fb-go");
    await page.waitForSelector("#fb-msg.ok");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("lgp_ice_report")), null, "sent: the saved copy is cleared");
    // the same again, this time left out
    await drop();
    await page.evaluate(() => FEEDBACK.open({ type: "bug" }));
    await page.waitForSelector("#fb-ice-line");
    await page.check("#fb-ice-skip");
    await page.fill("#fb-text", "이번에는 연결 기록 없이 보냅니다.");
    await page.click("#fb-go");
    await page.waitForSelector("#fb-msg.ok");
    const stored = [...f.h.db.entries()].filter(([k]) => /^fb:/.test(k)).map(([, v]) => JSON.parse(v)).sort((a, b) => a.t - b.t || (a.text < b.text ? -1 : 1));
    const withIce = stored.filter((x) => x.ctx.ice), without = stored.filter((x) => !x.ctx.ice);
    assert.equal(stored.length, 2); assert.equal(withIce.length, 1); assert.equal(without.length, 1);
    assert.equal(withIce[0].bug.where, "연결 끊김"); assert.equal(withIce[0].ctx.ice.reason, "host-gone");
    assert.ok(withIce[0].ctx.ice.lines.some((l) => l.ev === "ice:failed"));
    assert.doesNotMatch(JSON.stringify(withIce[0].ctx.ice), /\d+\.\d+\.\d+\.\d+|example\.invalid/);
    // 4. the owner's box
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "ice-owner" });
    const ctx = await f.browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ap = await ctx.newPage();
    ap.on("pageerror", (e) => f.errors.push(e.message));
    await ap.route("**/api/v1?*", async (route) => {
      const r = await f.h.api(new URL(route.request().url()).searchParams.get("a"), route.request().postDataJSON() || {});
      await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r) });
    });
    await ap.addInitScript((t) => sessionStorage.setItem("adm_t", t), owner.atoken);
    await ap.goto(base + "/admin.html", { waitUntil: "domcontentloaded" });
    await ap.click('#nav [data-v="feedback"]', { timeout: 20000 });
    await ap.waitForSelector(".fbc");
    assert.equal(await ap.locator(".fbc").count(), 2);
    assert.match(await ap.textContent("#fsum"), /연결 기록 1/);
    await ap.check("#fi");
    await ap.waitForFunction(() => document.querySelectorAll(".fbc").length === 1);
    await ap.click(".fbc summary");
    await ap.waitForSelector(".fbc table.ice-log tbody tr");
    const head = await ap.$$eval(".fbc table.ice-log th", (t) => t.map((x) => x.textContent));
    assert.deepEqual(head, ["시각", "pc", "역할", "이벤트", "경로"]);
    const rows = await ap.$$eval(".fbc table.ice-log tbody tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent)));
    assert.ok(rows.length >= 3 && rows.length <= 40);
    assert.ok(rows.some((r) => r[3] === "ice:failed" && /^pc\d+$/.test(r[1])), "failed row: " + JSON.stringify(rows.slice(0, 3)));
    assert.ok(rows.some((r) => r[3] === "created" && /서버 2 \(TURN 1\)/.test(r[4])), "created row shows the server counts");
    assert.match(await ap.textContent(".fbc .in"), /방장 연결 끊김/);
    await ap.screenshot({ path: dir + "/ice-report-admin.png" });
    await ap.uncheck("#fi");
    await ap.waitForFunction(() => document.querySelectorAll(".fbc").length === 2);
    assert.deepEqual(f.errors, []);
    console.log("ICE report: a failed connection is kept in sessionStorage, the host-lost card offers the report (also after a reload), the form shows the attachment line and can leave it out, it is stored, and the admin card shows the table and filters on it. Browser only, drop simulated.");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
