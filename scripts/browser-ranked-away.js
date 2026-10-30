const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
// Leaving, being away and giving up in a room with other people (js/legacy/119-ranked-leaving-...), on three browsers, a PeerServer
// and the real server code (the fixture's in-process API): a host on a desktop screen, a guest in English on a landscape phone
// screen (A, defends) and a guest on a touch phone (B, attacks with the host).
//  1. a ranked match: B's link drops and comes back inside the window (no penalty); A leaves for good: the host's result names
//     him and the server applies a loss and the extra penalty; the others are settled without waiting for him
//  2. a ranked match: nobody moves on A's side of the room -> the warning on his screen (countdown, English), then he is handed
//     to a bot and counts as having left; a moving guest is left alone; A takes his body back; the surrender vote: refused
//     before round 5, one that fails (and a wait before the next), one that passes and ends the match as the team's loss,
//     attested like any other (A, who went away, still gets his penalty); the pause menu button and the leave warning
//  3. a normal room: no AFK handling, and a surrender passes there too
// Screenshots go to test-results/ranked-away-*.png (desktop and phone landscape).
const SIGNAL = Number(process.env.DFDF_SIGNAL_PORT) || 9211;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: SIGNAL, path: "/", }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  const shot = (page, name) => page.screenshot({ path: `test-results/ranked-away-${name}.png`, timeout: 120000 }).catch(() => {});
  const W = { polling: 200, timeout: 90000 };
  try {
    // (the match start can hold a page for over 12 s on a loaded machine, the length a request is given: no limit here)
    const wire = (page) => page.evaluate(async (port) => { render = () => {}; titleCam = () => {}; window.GAME_REQUEST = async (url, o = {}) => { const response = await fetch(url, o), data = await response.json().catch(() => ({ ok: false, error: "서버 응답을 읽을 수 없습니다" })); return { response, data }; }; await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } }); }, SIGNAL);
    const host = await f.page("awayhost", { width: 1280, height: 720 }); await wire(host);
    const A = await f.page("awaya", { width: 852, height: 393 }, {}, { beforeLoad: (p) => p.addInitScript(() => { try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} }) }); await wire(A);
    const B = await f.page("awayb", { width: 852, height: 393 }, { hasTouch: true, isMobile: true }); await wire(B);
    const ownerTok = (await f.h.api("auth", { id: "owner", pw: "owner-password", device: "away-owner" })).atoken;
    for (const id of ["awayhost", "awaya", "awayb"]) assert.equal((await f.h.api("a_user_set", { atoken: ownerTok, id, op: "rr", rr: 300 })).status, 200);
    const names = { awayhost: host, awaya: A, awayb: B };
    const rr = (id) => f.h.user(id).rr;
    const cfgAll = (o) => Promise.all([host, A, B].map((p) => p.evaluate((o) => { SERVER_CFG.rank = Object.assign({}, SERVER_CFG.rank, o); }, o)));
    const home = (...pages) => Promise.all(pages.map((p) => p.evaluate(() => { try { netShutdown(); } catch (e) {} world.phase = "menu"; show("s-title"); })));
    // a room of the three, and a match in it; ranked: the host's roster is on the server and everybody has a ranked ticket
    async function matchOnce(ranked) {
      const code = await host.evaluate(async (ranked) => { ranked ? await RANKED.open() : await createRoom(); return NET.room; }, ranked);
      if (ranked) for (let i = 0; i < 60 && !f.h.db.get("room:" + code); i++) await sleep(500);
      for (const p of [A, B]) await p.evaluate((c) => joinRoom(c), code);
      await host.waitForFunction(() => NET.conns.size === 2 && room.members.size === 3, null, W);
      await host.evaluate(() => { hostStartMatch(); });
      for (const p of [A, B]) await p.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, W);
      let id = null;
      if (ranked) {
        await host.waitForFunction(() => RANKED.flow.current() && RANKED.flow.current().info, null, W);
        id = await host.evaluate(() => RANKED.flow.current().info.id);
        for (const who of Object.keys(names)) for (let i = 0; i < 60 && !f.h.db.get("rmt:" + id + ":" + who); i++) await sleep(500);
      }
      // the round runs (the buy phase of a test room would otherwise last for ever)
      // the bots stand still (nobody shoots the player who is away), and the round runs
      await host.evaluate(() => { aiThink = () => {}; world.phase = "live"; world.roundTime = 900; });
      for (const p of [A, B]) await p.waitForFunction(() => "live" === world.phase, null, W);
      return { code, id };
    }
    // a loaded machine can starve a page for more than the 12 s a request is given: the whole start is tried again
    async function match(ranked) {
      for (let attempt = 1; ; attempt++) {
        try { return await matchOnce(ranked); } catch (e) {
          if (attempt >= 3) throw e;
          console.log("match start failed, trying again:", e.message.split("\n")[0]);
          await home(host, A, B); await sleep(3000);
        }
      }
    }
    const peerOf = (name) => host.evaluate((n) => [...room.members].find(([, m]) => m.name === n)[0], name);
    const ctrlOf = (name) => host.evaluate((n) => { const a = world.actors.find((x) => x.name === n); return a ? (isAI(a) ? "ai" : a.ctrl === "me" ? "me" : "guest") : null; }, name);
    const move = (page) => page.evaluate(() => { window.__mv = setInterval(() => { keys.w = !keys.w; }, 400); });
    const still = (page) => page.evaluate(() => { clearInterval(window.__mv); keys.w = false; });

    // ───────── 1. a ranked match: a drop that comes back, and a player who leaves ─────────
    const m1 = await match(!0);
    // B's links close; its redial is slowed to 2.5 s so the host really sees him gone for a while, then back (a reconnect)
    await B.waitForFunction(() => NET.up && NET.up.event && NET.up.event.open && !NET_RC.busy, null, W);
    const redials = await B.evaluate(() => window.NET_REDIALS | 0);
    await B.evaluate(() => { const j = netJoin; netJoin = async (...a) => { await new Promise((r) => setTimeout(r, 2500)); netJoin = j; return j(...a); }; const up = NET.up; up.event.close(); up.state && up.state.close(); });
    await B.waitForFunction((n) => window.NET_REDIALS > n, redials, W);
    await host.waitForFunction(() => { const g = RANKED.leave.g.get("awayb"); return g && null == g.since && g.max >= 2000; }, null, W);
    assert.equal(await ctrlOf("awayb"), "guest", "B has its body back");
    const back = await host.evaluate(() => RANKED.leave.report().awayb);
    assert.ok(back && back.end === 0 && back.s >= 2 && back.s < 60, "B was away a few seconds and is here: " + JSON.stringify(back));
    // A leaves for good
    await A.evaluate(() => { netShutdown(); world.phase = "menu"; show("s-title"); });
    await host.waitForFunction(() => { const g = RANKED.leave.g.get("awaya"); return g && null != g.since; }, null, W);
    f.h.advance(61000);
    await host.evaluate(() => { world.scoreAtk = 7; world.scoreDef = 2; gameOver(); });
    await B.evaluate(() => { world.scoreAtk = 7; world.scoreDef = 2; gameOver(); });
    for (let i = 0; i < 60 && !f.h.db.get("rmres:" + m1.id); i++) await sleep(500);
    const res1 = JSON.parse(f.h.db.get("rmres:" + m1.id) || "null");
    assert.ok(res1, "the host sent the result");
    assert.deepEqual(res1.lv, ["awaya"], "the server named only the one who left (B's drop was inside the window)");
    assert.equal(rr("awaya"), 300 - 12 - 8, "a loss and the extra penalty, applied by the server when the result came");
    assert.deepEqual(f.h.user("awaya").rmDone, [m1.id]);
    // the others settle without waiting for A's vote (60 s) and gain RR
    for (const who of ["awayhost", "awayb"]) { await (names[who]).waitForFunction(() => ((((ACCOUNT.session() || {}).user || {}).placement) || {}).done >= 0 && true, null, W); for (let i = 0; i < 90 && !(f.h.user(who).rmDone || []).includes(m1.id); i++) await sleep(500); assert.ok(f.h.user(who).rmDone.includes(m1.id), who + " settled"); }
    assert.ok(rr("awayhost") > 300 && rr("awayb") > 300, "B reconnected: no penalty, and the win counts for him");
    const r1 = { awayhost: rr("awayhost"), awayb: rr("awayb") };
    await home(host, A, B);

    // ───────── 2. a ranked match: away from the keyboard, giving up ─────────
    await cfgAll({ afkWarnS: 4, afkLeaveS: 14, surrenderRound: 5, surrenderVoteS: 20, surrenderCoolS: 4 });
    const m2 = await match(!0);
    await move(B);
    // before round 5 the vote is refused, on the guest's screen and on the host's own
    await B.keyboard.press("F8");
    await B.waitForFunction(() => /5라운드부터/.test(document.getElementById("banner").textContent), null, W);
    await host.keyboard.press("F8");
    await host.waitForFunction(() => /5라운드부터/.test(document.getElementById("banner").textContent), null, W);
    assert.equal(await host.evaluate(() => document.getElementById("sv-box").hidden), true);
    // A does not move: the warning on his screen (English), counting down; B keeps moving and hears nothing
    await A.waitForFunction(() => !document.getElementById("afk-box").hidden, null, W);
    const warn = await A.evaluate(() => { const r = document.getElementById("afk-box").getBoundingClientRect(); return { text: document.getElementById("afk-box").textContent, s: +document.getElementById("afk-s").textContent, r: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight }; });
    assert.match(warn.text, /You seem to be away/); assert.match(warn.text, /a bot takes over/);
    assert.ok(warn.s > 0 && warn.s <= 14, "a countdown: " + warn.s);
    assert.ok(warn.r[0] >= 0 && warn.r[2] <= warn.vw && warn.r[1] >= 0 && warn.r[3] <= warn.vh, "the warning is inside the phone screen: " + warn.r);
    await shot(A, "afk-warning-phone");
    assert.equal(await B.evaluate(() => document.getElementById("afk-box").hidden), true, "a moving guest gets no warning");
    // moving takes it away at once (and the host forgets the count)
    await move(A);
    await A.waitForFunction(() => document.getElementById("afk-box").hidden, null, W);
    await host.waitForFunction(async () => ![...RANKED_AWAY.afk.values()].some((s) => s.warned), null, W);
    assert.equal(await ctrlOf("awaya"), "guest");
    // and stops again: warning, then the hand-over
    await still(A);
    await A.waitForFunction(() => !document.getElementById("afk-box").hidden, null, W);
    await A.waitForFunction(() => !document.getElementById("afk-out").hidden, null, W);
    assert.equal(await ctrlOf("awaya"), "ai", "his body is a bot's now, as on a drop");
    assert.equal(await ctrlOf("awayb"), "guest");
    assert.equal(await A.evaluate(() => document.getElementById("afk-box").hidden), true);
    const out = await A.evaluate(() => { const r = document.getElementById("afk-out").getBoundingClientRect(); return { text: document.getElementById("afk-out").textContent, r: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight, btn: [...document.querySelectorAll("#afk-out button")].map((b) => [b.getBoundingClientRect().width, b.getBoundingClientRect().height]) }; });
    assert.match(out.text, /A bot is playing for you/); assert.match(out.text, /counts as left/);
    assert.ok(out.r[0] >= 0 && out.r[2] <= out.vw && out.r[1] >= 0 && out.r[3] <= out.vh, "the card is inside the phone screen: " + out.r);
    assert.ok(out.btn.every(([w, h]) => w >= 90 && h >= 34), "buttons are big enough to tap: " + JSON.stringify(out.btn));
    await shot(A, "afk-handed-over-phone");
    const rep = await host.evaluate(() => RANKED.leave.report());
    assert.equal(rep.awaya.end, 1, "away for good in the host's report");
    // he takes his body back; the count stays
    await A.click("#afk-back");
    await A.waitForFunction(() => document.getElementById("afk-out").hidden, null, W);
    await host.waitForFunction((n) => { const a = world.actors.find((x) => x.name === n); return a && !isAI(a); }, "awaya", W);
    assert.equal((await host.evaluate(() => RANKED.leave.report())).awaya.end, 1, "still counted as left");
    await move(A);
    await cfgAll({ afkWarnS: 0 });

    // the pause menu: the surrender button (not yet), the warning before leaving a ranked match
    await A.evaluate(() => togglePause(true));
    await A.waitForFunction(() => !document.getElementById("pause").hidden, null, W);
    await A.waitForFunction(() => document.getElementById("pz-surrender").disabled, null, W);
    const pz = await A.evaluate(() => { const b = document.getElementById("pz-surrender"); return { show: b.style.display !== "none", off: b.disabled, text: b.textContent }; });
    assert.deepEqual([pz.show, pz.off], [true, true]); assert.match(pz.text, /from round 5/);
    await A.click("#pz-quit");
    assert.match(await A.evaluate(() => document.getElementById("pz-quit").textContent), /Leave\? Counts as a loss/);
    assert.notEqual(await A.evaluate(() => world.phase), "menu", "the first click only asks");
    await A.waitForTimeout(800);
    await shot(A, "pause-leave-warning-phone");
    await A.waitForFunction(() => /^Leave$|^나가기$/.test(document.getElementById("pz-quit").textContent.trim()), null, W);
    await A.evaluate(() => { document.getElementById("pause").hidden = !0; });

    // round 5: B asks, the host says no -> it fails; a second try straight away has to wait
    await host.evaluate(() => { world.round = 5; });
    for (const p of [A, B]) await p.waitForFunction(() => world.round >= 5, null, W);
    await B.keyboard.press("F8");
    await B.waitForFunction(() => !document.getElementById("sv-box").hidden, null, W);
    assert.match(await B.evaluate(() => document.getElementById("sv-t").textContent), /항복 투표를 시작할까요/);
    await shot(B, "vote-ask-phone");
    await B.keyboard.press("KeyJ");
    await host.waitForFunction(() => !document.getElementById("sv-box").hidden && /awayb/.test(document.getElementById("sv-sub").textContent), null, W);
    await B.waitForFunction(() => /찬성 1\/2/.test(document.getElementById("sv-sub").textContent), null, W);
    // the opposite team is told, but has no vote
    assert.equal(await A.evaluate(() => document.getElementById("sv-box").hidden), true, "the other team has no vote box");
    const vp = await B.evaluate(() => { const b = document.getElementById("sv-box").getBoundingClientRect(); return { r: [b.left, b.top, b.right, b.bottom], vw: innerWidth, vh: innerHeight, touching: document.body.classList.contains("touching"), btn: [...document.querySelectorAll("#sv-box .sv-btns button")].map((x) => [x.getBoundingClientRect().width, x.getBoundingClientRect().height]) }; });
    assert.ok(vp.r[0] >= 0 && vp.r[2] <= vp.vw && vp.r[1] >= 0 && vp.r[3] <= vp.vh, "the vote box is inside the phone screen: " + vp.r);
    assert.ok(vp.btn.every(([w, h]) => w >= 60 && h >= 34), "vote buttons are big enough to tap: " + JSON.stringify(vp.btn));
    await shot(B, "vote-open-phone");
    await shot(host, "vote-open-desktop");
    // the host does not agree
    await host.keyboard.press("KeyK");
    await host.waitForFunction(() => /항복 부결/.test(document.getElementById("sv-t").textContent), null, W);
    await B.waitForFunction(() => /항복 부결/.test(document.getElementById("sv-t").textContent), null, W);
    await shot(host, "vote-failed-desktop");
    assert.equal(await host.evaluate(() => world.phase), "live", "the match goes on");
    await B.keyboard.press("F8");
    await B.keyboard.press("KeyJ");
    await B.waitForFunction(() => /기다려야/.test(document.getElementById("banner").textContent), null, W);
    await sleep(4500);
    // the pause menu now offers the button, and it opens the same question
    await host.evaluate(() => togglePause(true));
    await host.waitForFunction(() => !document.getElementById("pause").hidden, null, W);
    await host.waitForFunction(() => /항복 투표/.test(document.getElementById("pz-surrender").textContent) && !document.getElementById("pz-surrender").disabled, null, W);
    assert.match(await host.evaluate(() => document.getElementById("pz-surrender").textContent), /항복 투표.*F8/);
    await host.waitForTimeout(800);
    await shot(host, "pause-surrender-desktop");
    await host.click("#pz-surrender");
    await host.waitForFunction(() => document.getElementById("pause").hidden && !document.getElementById("sv-box").hidden && /시작할까요/.test(document.getElementById("sv-t").textContent), null, W);
    await shot(host, "vote-ask-desktop");
    await host.keyboard.press("KeyJ");
    await B.waitForFunction(() => /찬성 1\/2/.test(document.getElementById("sv-sub").textContent) && !document.getElementById("sv-yes").disabled, null, W);
    f.h.advance(61000);
    await B.click("#sv-yes");
    // more than half of the team: the match is over, a loss for the attackers (the defenders' 7)
    for (const p of [host, A, B]) await p.waitForFunction(() => "over" === world.phase, null, W);
    assert.deepEqual(await host.evaluate(() => [world.scoreAtk, world.scoreDef]), [0, 7], "the other side is given the winning score");
    assert.equal(await host.evaluate(() => LAST_MATCH.outcome), "loss");
    assert.equal(await A.evaluate(() => LAST_MATCH.outcome), "win");
    assert.match(await host.evaluate(() => document.getElementById("ov-head").textContent), /패배/);
    await shot(host, "surrendered-desktop");
    // attested like any other result: the host's team lost
    for (let i = 0; i < 60 && !f.h.db.get("rmres:" + m2.id); i++) await sleep(500);
    const res2 = JSON.parse(f.h.db.get("rmres:" + m2.id) || "null");
    assert.ok(res2); assert.equal(res2.w, "b", "the defenders are the winners");
    assert.deepEqual(res2.lv, ["awaya"], "A went away, so the loss and penalty are his even on the winning side");
    for (const who of ["awayhost", "awayb"]) for (let i = 0; i < 120 && !(f.h.user(who).rmDone || []).includes(m2.id); i++) await sleep(500);
    assert.ok((f.h.user("awayhost").rmDone || []).includes(m2.id) && (f.h.user("awayb").rmDone || []).includes(m2.id), "the surrendering team settled their loss");
    assert.ok(rr("awayhost") < r1.awayhost && rr("awayb") < r1.awayb, "RR went down for the team that surrendered");
    assert.equal(f.h.user("awaya").rmDone[0], m2.id);
    assert.ok(rr("awaya") < 300 - 20, "the penalty came on top of the first one");
    // the one who went away is told so on his result screen
    await A.waitForFunction(() => /You left during the match/.test((document.getElementById("ov-rank") || {}).textContent || ""), null, { polling: 500, timeout: 150000 });
    await shot(A, "left-result-phone");
    await home(host, A, B); await still(B); await still(A);

    // ───────── 3. a normal room: no AFK handling; a team can surrender there too ─────────
    await cfgAll({ afkWarnS: 2, afkLeaveS: 2 });
    await match(!1);
    await sleep(6000);
    assert.equal(await ctrlOf("awaya"), "guest", "nobody is handed over in a normal room");
    assert.equal(await A.evaluate(() => document.getElementById("afk-box").hidden && document.getElementById("afk-out").hidden), true);
    // A is the only human defender: he asks, confirms, and his team has given up
    await host.evaluate(() => { world.round = 5; });
    await A.waitForFunction(() => world.round >= 5, null, W);
    await A.keyboard.press("F8");
    await A.waitForFunction(() => /Start a surrender vote/.test(document.getElementById("sv-t").textContent), null, W);
    await shot(A, "vote-ask-english-phone");
    await A.keyboard.press("KeyJ");
    for (const p of [host, A, B]) await p.waitForFunction(() => "over" === world.phase, null, W);
    const win = await host.evaluate(() => [world.scoreAtk, world.scoreDef, winRounds(), LAST_MATCH.outcome]);
    assert.deepEqual(win, [win[2], 0, win[2], "win"], "the attackers are given the winning score");
    assert.equal(await A.evaluate(() => LAST_MATCH.outcome), "loss");
    assert.deepEqual(f.errors, []);
    console.log("ranked-away ok");
  // the PeerServer keeps the process alive after close(), as in the other PeerServer tests: the exit is explicit
  } finally { await f.browser.close(); signaling && signaling.close && signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e.message); console.error(e.stack); process.exit(1); });
