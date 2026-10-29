// The screen before a match (js/legacy/114): solo cards for both sides (agent, name, level, title, mastery), free-for-all grid, skip by key / click /
// tap, closing on its own, reduced motion, phone landscape sizes, English; two pages (the guest sees the same cards, the server's numbers, none for a
// late join); and the mastery badges on the agent cards of the lobby picker and the solo select screen.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const dir = process.env.SHOT_DIR || "test-results";
// automated browsers do not get the screen unless asked (so the other tests' clicks are not covered by it); it is kept up for 40 s so there is
// time to look, except in the one check that times the real length
const force = (p) => p.addInitScript(() => { window.PREMATCH_FORCE = true; window.PREMATCH_DURATION = 40000; });
const forceEn = (p) => p.addInitScript(() => { window.PREMATCH_FORCE = true; window.PREMATCH_DURATION = 40000; try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} });
const phone = { hasTouch: true, isMobile: true };
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "browser-owner-device-vs" });
    // an account with a level and mastery in the server's own record, made before it signs in
    const account = async (id, level, mast) => {
      await f.h.api("auth", { id, pw: "password", device: "browser-test-" + id });
      assert.equal((await f.h.api("a_user_set", { atoken: owner.atoken, id, op: "level", level })).status, 200);
      const u = f.h.user(id); u.mast = mast; f.h.db.set("user:" + id, JSON.stringify(u));
    };
    const agents = require("../js/agent-roster.json");
    const A0 = agents[0].id, A1 = agents[1].id;
    await account("vssolo", 23, { [A0]: { xp: 2300, m: 12, w: 6, k: 30 }, [A1]: { xp: 100, m: 1, w: 0, k: 0 } });
    const solo = await f.page("vssolo", { width: 1280, height: 720 }, {}, { beforeLoad: force });
    assert.deepEqual(await solo.evaluate(() => { const m = ACCOUNT.session().user.mast; return [Object.keys(m).length, m[AGENTS[0].id].lv, m[AGENTS[0].id].into, m[AGENTS[0].id].need]; }), [2, 7, 200, 700], "the account carries its mastery from the server");
    const titleId = await solo.evaluate(() => { const t = COSMETICS.items.find((x) => "title" === x.s && x.r >= 3); ACCOUNT.session().user.cos = { own: [t.id], eq: { title: t.id } }; return t.id; });

    // ── 1. solo, desktop: a card for each of the ten players, the sides, mine marked ──
    // the portraits drawn once already (the cache), so the drawing in idle time does not decide whether the test passes
    await solo.evaluate(() => AGENTS.forEach((a) => agentPortrait(a, 150, 184)));
    const open = async (page, mode = "std", agent = 0) => {
      await page.evaluate(([m, a]) => { room.mode = m; startGame(AGENTS[a], false); }, [mode, agent]);
      await page.waitForSelector("#prematch .pm-card", { timeout: 30000 });
    };
    await open(solo);
    const cards = await solo.evaluate(() => {
      const t = (el, s) => { const n = el.querySelector(s); return n ? n.textContent.trim() : null; };
      return {
        n: document.querySelectorAll("#prematch .pm-card").length, atk: document.querySelectorAll("#prematch .pm-side.atk .pm-card").length, def: document.querySelectorAll("#prematch .pm-side.def .pm-card").length,
        head: t(document.getElementById("prematch"), ".pm-top b"), vs: t(document.getElementById("prematch"), ".pm-stage > .pm-vs"), labels: [...document.querySelectorAll("#prematch .pm-label")].map((l) => l.textContent.trim()),
        mine: [...document.querySelectorAll("#prematch .pm-card.me")].map((c) => ({ name: t(c, ".pm-name"), agent: t(c, ".pm-ag"), title: t(c, ".pm-ttl"), lv: t(c, ".lv-chip"), mast: (c.querySelector(".mastb") || {}).dataset && c.querySelector(".mastb").dataset.lv, you: t(c, ".pm-you"), side: c.classList.contains("atk") ? "atk" : "def" })),
        bots: [...document.querySelectorAll("#prematch .pm-card.bot")].map((c) => ({ ai: !!c.querySelector(".pm-ai"), lv: !!c.querySelector(".lv-chip"), mast: !!c.querySelector(".mastb"), title: !!c.querySelector(".pm-ttl"), agent: t(c, ".pm-ag"), name: t(c, ".pm-name") })),
        want: { title: COSMETICS.name(COSMETICS.by[ACCOUNT.session().user.cos.eq.title]), agent: AGENTS[0].name, map: MAP_LIST.find((m) => m.key === room.map).name, mode: GAME_MODES.std.name },
        phase: world.phase, roundTime: world.roundTime,
      };
    });
    assert.equal(cards.n, 10); assert.equal(cards.atk, 5); assert.equal(cards.def, 5);
    assert.equal(cards.head, cards.want.mode); assert.equal(cards.vs, "VS"); assert.deepEqual(cards.labels.map((l) => l.replace(/\s*내 팀$/, "")), ["공격팀", "수비팀"]);
    assert.equal(cards.mine.length, 1);
    assert.deepEqual(cards.mine[0], { name: "vssolo", agent: cards.want.agent, title: cards.want.title, lv: "Lv 23", mast: "7", you: "나", side: cards.mine[0].side });
    assert.equal(cards.bots.length, 9);
    assert.ok(cards.bots.every((b) => b.ai && !b.lv && !b.mast && b.agent && b.name), "a bot has no level and no mastery, and says it is AI: " + JSON.stringify(cards.bots[0]));
    assert.ok(cards.bots.every((b) => b.title), "bots wear catalogue titles");
    // the buy phase is under it: not paused, not over, the game goes on drawing (a frame counter moves)
    assert.deepEqual(await solo.evaluate(() => [world.phase, document.getElementById("pause").hidden]), ["buy", true]);
    const frames = await solo.evaluate(() => (window.__fr = 0, new Promise((res) => { const n = () => (++__fr >= 5 ? res(__fr) : requestAnimationFrame(n)); requestAnimationFrame(n); })));
    assert.equal(frames, 5);
    await solo.screenshot({ path: dir + "/prematch-desk-5v5.png" });
    // the card is inside the screen, the cards stand on both sides of the VS
    const box = await solo.evaluate(() => { const r = (e) => e.getBoundingClientRect(), vs = r(document.querySelector("#prematch .pm-stage > .pm-vs")); return { vs: [vs.left, vs.right], atkMax: Math.max(...[...document.querySelectorAll(".pm-card.atk")].map((c) => r(c).right)), defMin: Math.min(...[...document.querySelectorAll(".pm-card.def")].map((c) => r(c).left)), all: [...document.querySelectorAll(".pm-card")].every((c) => r(c).left >= 0 && r(c).right <= innerWidth && r(c).top >= 0 && r(c).bottom <= innerHeight) }; });
    assert.ok(box.all, "every card is on screen"); assert.ok(box.atkMax <= box.vs[0] + 2 && box.defMin >= box.vs[1] - 2, "attackers left of the VS, defenders right of it " + JSON.stringify(box));

    // portraits are drawn for the cards
    await solo.waitForFunction(() => [...document.querySelectorAll("#prematch .pm-card img")].every((i) => i.src.startsWith("data:")), null, { timeout: 3000 });
    // ── 2. closing: a key, a click, and on its own after about three and a half seconds ──
    await solo.waitForTimeout(400);
    await solo.keyboard.press("x");
    await solo.waitForFunction(() => !PREMATCH.active() && !document.getElementById("prematch"), null, { timeout: 5000 });
    assert.equal(await solo.evaluate(() => PREMATCH.last), "skip");
    assert.equal(await solo.evaluate(() => world.phase), "buy", "the round is still there");
    await open(solo); await solo.waitForTimeout(400);
    await solo.mouse.click(640, 360);
    await solo.waitForFunction(() => !document.getElementById("prematch"), null, { timeout: 5000 });
    assert.equal(await solo.evaluate(() => PREMATCH.last), "skip");
    // a key held down from before the start (auto-repeat) and a lone modifier do not close it
    await open(solo);
    await solo.waitForTimeout(400);
    await solo.keyboard.down("Shift"); await solo.keyboard.up("Shift");
    assert.ok(await solo.evaluate(() => PREMATCH.active()), "Shift alone does not skip");
    await solo.evaluate(() => { PREMATCH.close("replace"); delete window.PREMATCH_DURATION; });
    await open(solo);
    const t0 = Date.now();
    await solo.waitForFunction(() => !document.getElementById("prematch"), null, { timeout: 60000 });
    const took = Date.now() - t0;
    assert.equal(await solo.evaluate(() => PREMATCH.last), "done");
    await solo.evaluate(() => { window.PREMATCH_DURATION = 40000; }); // long again, to look at the rest
    assert.ok(took > 2500, "it stays about three and a half seconds, not less (" + took + " ms)");
    // no screen for practice, the target range; and none when the page has no force flag in an automated browser
    await solo.evaluate(() => { room.mode = "std"; startGame(AGENTS[0], true); });
    await solo.waitForTimeout(1500);
    assert.equal(await solo.evaluate(() => PREMATCH.active()), false, "practice has none");
    await solo.evaluate(() => { room.mode = "range"; startGame(AGENTS[0], true); });
    await solo.waitForTimeout(1500);
    assert.equal(await solo.evaluate(() => PREMATCH.active()), false, "the target range has none");
    await solo.evaluate(() => { PREMATCH_FORCE = false; room.mode = "std"; startGame(AGENTS[0], false); });
    await solo.waitForTimeout(1500);
    assert.equal(await solo.evaluate(() => PREMATCH.active()), false, "an automated browser has none unless asked");
    await solo.evaluate(() => { PREMATCH_FORCE = true; });

    // ── 3. a free-for-all: everyone in a grid ──
    for (const mode of ["knife", "dm"]) {
      await open(solo, mode);
      const ffa = await solo.evaluate(() => ({ cards: document.querySelectorAll("#prematch .pm-grid .pm-card").length, sides: document.querySelectorAll("#prematch .pm-side").length, ffa: document.getElementById("prematch").classList.contains("ffa"), head: document.querySelector("#prematch .pm-top b").textContent, mine: document.querySelectorAll("#prematch .pm-card.me").length, vs: document.querySelectorAll("#prematch .pm-vs").length }));
      assert.deepEqual([ffa.cards, ffa.sides, ffa.ffa, ffa.mine, ffa.vs], [10, 0, true, 1, 1], mode + " " + JSON.stringify(ffa));
      assert.equal(ffa.head, await solo.evaluate((m) => GAME_MODES[m].name, mode));
      mode === "knife" && (await solo.waitForTimeout(600), await solo.screenshot({ path: dir + "/prematch-desk-ffa.png" }));
      await solo.waitForTimeout(400); await solo.keyboard.press("x");
      await solo.waitForFunction(() => !document.getElementById("prematch"));
    }

    // ── 4. reduced motion: the game's motion setting at 0, or the system's: the cards just stand there ──
    await open(solo);
    await solo.waitForSelector("#prematch.go"); // the animations start on a frame after the cards are in
    const slide = await solo.evaluate(() => ({ atk: getComputedStyle(document.querySelector(".pm-card.atk")).animationName, def: getComputedStyle(document.querySelector(".pm-card.def")).animationName, vs: getComputedStyle(document.querySelector(".pm-stage > .pm-vs")).animationName, calm: document.getElementById("prematch").classList.contains("calm") }));
    assert.deepEqual(slide, { atk: "pm-in-l", def: "pm-in-r", vs: "pm-vs", calm: false }, "they slide in from both sides");
    await solo.waitForTimeout(400); await solo.keyboard.press("x"); await solo.waitForFunction(() => !document.getElementById("prematch"));
    await solo.evaluate(() => { SETTINGS.motion = 0; });
    await open(solo);
    assert.deepEqual(await solo.evaluate(() => [getComputedStyle(document.querySelector(".pm-card.atk")).animationName, getComputedStyle(document.querySelector(".pm-stage > .pm-vs")).animationName, document.getElementById("prematch").classList.contains("calm"), getComputedStyle(document.querySelector(".pm-bar")).display]), ["none", "none", true, "none"], "the game's motion setting at 0");
    await solo.evaluate(() => { SETTINGS.motion = 1; }); await solo.waitForTimeout(400); await solo.keyboard.press("x"); await solo.waitForFunction(() => !document.getElementById("prematch"));
    await solo.emulateMedia({ reducedMotion: "reduce" });
    await open(solo);
    assert.deepEqual(await solo.evaluate(() => [getComputedStyle(document.querySelector(".pm-card.def")).animationName, document.getElementById("prematch").classList.contains("calm")]), ["none", true], "the system's reduce motion");
    await solo.waitForTimeout(400); await solo.keyboard.press("x"); await solo.waitForFunction(() => !document.getElementById("prematch"));
    await solo.emulateMedia({ reducedMotion: "no-preference" });
    await solo.context().close();

    // ── 5. phone landscape sizes and touch: every card on screen in both layouts, a tap closes it ──
    for (const [w, h] of [[568, 320], [740, 360], [844, 390]]) {
      const p = await f.page("vsphone", { width: w, height: h }, phone, { beforeLoad: force });
      for (const mode of ["std", "knife"]) {
        await open(p, mode);
        await p.waitForTimeout(1600); // the cards have slid in
        const fit = await p.evaluate(() => { const r = (e) => e.getBoundingClientRect(); return { n: document.querySelectorAll(".pm-card").length, off: [...document.querySelectorAll(".pm-card, .pm-top, .pm-hint")].filter((c) => r(c).left < -0.5 || r(c).right > innerWidth + 0.5 || r(c).top < -0.5 || r(c).bottom > innerHeight + 0.5).length, scroll: document.documentElement.scrollWidth <= innerWidth, overlap: (() => { const cs = [...document.querySelectorAll(".pm-card")].map(r); let o = 0; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i], b = cs[j]; a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && o++; } return o; })() }; });
        assert.deepEqual([fit.n, fit.off, fit.overlap], [10, 0, 0], `${w}x${h} ${mode}: ${JSON.stringify(fit)}`);
        (w === 740) && await p.screenshot({ path: `${dir}/prematch-phone-${mode}.png` });
        await p.touchscreen.tap(Math.round(w / 2), Math.round(h / 2));
        await p.waitForFunction(() => !document.getElementById("prematch"), null, { timeout: 5000 });
        assert.equal(await p.evaluate(() => PREMATCH.last), "skip", "a tap closes it");
      }
      await p.context().close();
    }

    // ── 6. English ──
    const en = await f.page("vssolo", { width: 1280, height: 720 }, {}, { beforeLoad: forceEn });
    await open(en);
    const enText = await en.evaluate(() => ({ labels: [...document.querySelectorAll(".pm-label")].map((l) => l.textContent.trim()), hint: document.querySelector(".pm-hint").textContent, head: document.querySelector(".pm-top b").textContent, you: document.querySelector(".pm-you").textContent, badge: document.querySelector(".pm-card.me .mastb").getAttribute("aria-label") }));
    assert.ok(/^ATTACKERS/.test(enText.labels[0]) && /^DEFENDERS/.test(enText.labels[1]), JSON.stringify(enText));
    assert.deepEqual([enText.hint, enText.head, enText.you, enText.badge], ["Tap or press any key to skip", "Standard", "YOU", "Mastery Lv 7"]);
    await en.context().close();

    // ── 7. two pages: the guest sees the same cards, with the server's level, title and mastery for the other player ──
    await account("vshost", 4, { [A0]: { xp: 450, m: 5, w: 2, k: 8 } });   // lv 3 of A0
    await account("vsguest", 30, { [A1]: { xp: 4600, m: 60, w: 30, k: 200 } }); // lv 10 of A1
    const host = await f.page("vshost", { width: 1280, height: 720 }, {}, { beforeLoad: force }), guest = await f.page("vsguest", { width: 1280, height: 720 }, {}, { beforeLoad: force });
    for (const page of [host, guest]) await page.evaluate(async () => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
    });
    const t = await host.evaluate(() => { const t = COSMETICS.items.find((x) => "title" === x.s && x.r === 4) || COSMETICS.items.find((x) => "title" === x.s); return t.id; });
    await host.evaluate((id) => { ACCOUNT.session().user.cos = { own: [id], eq: { title: id } }; }, t);
    const tg = await guest.evaluate(() => { const t = COSMETICS.items.filter((x) => "title" === x.s)[1]; ACCOUNT.session().user.cos = { own: [t.id], eq: { title: t.id } }; return t.id; });
    assert.notEqual(t, tg);
    // the guest's account says Lv 1 / no mastery in its own session; the server has the real numbers
    await guest.evaluate((a1) => { const u = ACCOUNT.session().user; u.level = 1; u.mast = { [a1]: { lv: 10, xp: 4600, into: 100, need: 0, m: 60, w: 30, k: 200 } }; }, A1);
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2, null, { timeout: 60000 });
    await host.waitForFunction(() => [...LV_CHIP.verified.values()].length === 1, null, { timeout: 20000 });
    // the lobby picker: the badge of each agent is that account's mastery
    await guest.waitForSelector("#lb-agents .lad-card");
    const picker = async (page) => page.evaluate(() => [...document.querySelectorAll("#lb-agents .lad-card")].map((c, i) => [AGENTS[i].id, c.querySelector(".mastb") && +c.querySelector(".mastb").dataset.lv]));
    const hp = await picker(host), gp = await picker(guest);
    assert.equal(hp.length, await host.evaluate(() => AGENTS.length)); assert.ok(hp.every(([, lv]) => lv >= 1 && lv <= 10));
    assert.equal(Object.fromEntries(hp)[A0], 3, "the host's picker: A0 is Lv 3"); assert.equal(Object.fromEntries(hp)[A1], 1, "an agent never played is Lv 1");
    assert.equal(Object.fromEntries(gp)[A1], 10, "the guest's picker: A1 is Lv 10"); assert.equal(Object.fromEntries(gp)[A0], 1);
    await host.screenshot({ path: dir + "/prematch-lobby-badges.png" });
    // who plays what: the host A0, the guest A1
    await host.evaluate((a0) => { requestAgent(AGENTS.find((a) => a.id === a0).key); }, A0);
    await guest.evaluate((a1) => requestAgent(AGENTS.find((a) => a.id === a1).key), A1);
    await host.waitForFunction(([a0, a1]) => { const m = [...room.members.values()].map((x) => x.agentKey); return m.includes(AGENTS.find((a) => a.id === a0).key) && m.includes(AGENTS.find((a) => a.id === a1).key); }, [A0, A1], { timeout: 20000 });
    await host.evaluate(() => { room.mode = "std"; room.diff = "normal"; hostStartMatch(); ADMIN.freezeAI = true; });
    await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    await host.waitForSelector("#prematch .pm-card"); await guest.waitForSelector("#prematch .pm-card");
    const view = (page) => page.evaluate(() => [...document.querySelectorAll("#prematch .pm-card")].map((c) => { const t = (s) => { const n = c.querySelector(s); return n ? n.textContent.trim() : null; }; return { name: t(".pm-name"), agent: t(".pm-ag"), title: t(".pm-ttl"), lv: t(".lv-chip"), mast: c.querySelector(".mastb") ? +c.querySelector(".mastb").dataset.lv : null, ai: !!c.querySelector(".pm-ai"), team: c.classList.contains("atk") ? "atk" : "def", me: c.classList.contains("me") }; }));
    // wait for the guest's cards to carry the server's numbers (they follow the host's answer if it comes after the screen is up)
    await host.waitForFunction(() => [...document.querySelectorAll("#prematch .pm-card")].filter((c) => c.querySelector(".lv-chip")).length === 2, null, { timeout: 15000 });
    await guest.waitForFunction(() => [...document.querySelectorAll("#prematch .pm-card")].filter((c) => c.querySelector(".lv-chip")).length === 2, null, { timeout: 15000 });
    const hv = await view(host), gv = await view(guest);
    assert.equal(hv.length, gv.length);
    // a player's own card reads its own session (made to claim Lv 1 above); every other card is what the host's server lookup said
    const mine = new Set([...hv, ...gv].filter((c) => c.me).map((c) => c.name));
    const strip = (v) => v.map(({ me, ...r }) => (mine.has(r.name) && !r.ai ? { ...r, lv: "own" } : r));
    assert.deepEqual(strip(gv), strip(hv), "the guest sees the same cards as the host");
    const humans = hv.filter((c) => !c.ai);
    assert.equal(humans.length, 2);
    const h1 = humans.find((c) => c.name === "vshost"), g1 = humans.find((c) => c.name === "vsguest");
    assert.deepEqual([h1.lv, h1.mast, g1.lv, g1.mast], ["Lv 4", 3, "Lv 30", 10], "levels and mastery are the server's, not the guest's own Lv 1: " + JSON.stringify(humans));
    assert.equal(h1.title, await host.evaluate((id) => COSMETICS.name(COSMETICS.by[id]), t)); assert.equal(g1.title, await host.evaluate((id) => COSMETICS.name(COSMETICS.by[id]), tg));
    assert.deepEqual([hv.filter((c) => c.me).map((c) => c.name), gv.filter((c) => c.me).map((c) => c.name)], [["vshost"], ["vsguest"]], "each marks its own card");
    await guest.screenshot({ path: dir + "/prematch-guest.png" });
    // a late join into the round under way gets no screen
    await account("vslate", 5, {});
    const late = await f.page("vslate", { width: 1280, height: 720 }, {}, { beforeLoad: force });
    await late.evaluate(async () => { render = () => {}; titleCam = () => {}; await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } }); });
    await host.keyboard.press("x"); await guest.keyboard.press("x");
    await late.evaluate((c) => joinRoom(c), code);
    await late.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 }).catch(() => {});
    await late.waitForTimeout(1500);
    const lateState = await late.evaluate(() => ({ screen: !!document.getElementById("prematch"), started: world.actors.length > 0, last: PREMATCH.last }));
    assert.equal(lateState.screen, false, "a late join gets no screen: " + JSON.stringify(lateState));
    await host.evaluate(() => netShutdown()); await guest.evaluate(() => netShutdown());

    // ── 8. the solo select screen's cards carry the badge too (with the progress in the tooltip), in AGENTS order, whatever the tabs hide ──
    const sel = await f.page("vssolo", { width: 1280, height: 720 }, {}, { beforeLoad: force });
    await sel.evaluate(() => { renderSelect(); show("s-select"); });
    const sc = await sel.evaluate(() => [...document.querySelectorAll("#sel-grid .acard")].map((c, i) => [AGENTS[i].id, c.querySelector(".mastb") && +c.querySelector(".mastb").dataset.lv, c.querySelector(".mb-pos") && c.querySelector(".mb-pos").title]));
    assert.equal(sc.length, await sel.evaluate(() => AGENTS.length));
    assert.equal(sc.find(([id]) => id === A0)[1], 7); assert.equal(sc.find(([id]) => id === A1)[1], 2); assert.ok(sc.every(([, lv]) => lv >= 1));
    assert.match(sc.find(([id]) => id === A0)[2], /숙련도 Lv 7 · 200 \/ 700 XP · 12경기 6승/);
    await sel.screenshot({ path: dir + "/prematch-select-badges.png" });
    // mastery off (the owner's switch): no badge, and no screen chip
    await sel.evaluate(() => { SERVER_CFG.mastery = { on: false }; renderSelect(); });
    assert.equal(await sel.evaluate(() => document.querySelectorAll("#sel-grid .mastb").length), 0, "off: no badges");
    assert.deepEqual(f.errors, []);
    console.log("pre-match screen: cards for both sides and free-for-all, skip by key / click / tap, closes on its own, reduced motion, phone sizes, English, guest sees the host's cards with server numbers, no screen for a late join; badges on the lobby and solo cards");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
