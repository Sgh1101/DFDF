const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
// Giving up in a room with other people (js/legacy/119-ranked-leaving-...: the surrender vote; ranked play was removed on
// 2026-11-07, so its leaving and away-from-keyboard parts no longer run), on three browsers, a PeerServer and the real server
// code (the fixture's in-process API): a host on a desktop screen, a guest in English on a landscape phone screen (A, defends)
// and a guest on a touch phone (B, attacks with the host). A normal room: no AFK handling, and a team can surrender.
// Screenshots go to test-results/surrender-*.png.
const SIGNAL = Number(process.env.DFDF_SIGNAL_PORT) || 9211;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: SIGNAL, path: "/", }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  const shot = (page, name) => page.screenshot({ path: `test-results/surrender-${name}.png`, timeout: 120000 }).catch(() => {});
  const W = { polling: 200, timeout: 90000 };
  try {
    const wire = (page) => page.evaluate(async (port) => { render = () => {}; titleCam = () => {}; window.GAME_REQUEST = async (url, o = {}) => { const response = await fetch(url, o), data = await response.json().catch(() => ({ ok: false, error: "서버 응답을 읽을 수 없습니다" })); return { response, data }; }; await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } }); }, SIGNAL);
    const host = await f.page("awayhost", { width: 1280, height: 720 }); await wire(host);
    const A = await f.page("awaya", { width: 852, height: 393 }, {}, { beforeLoad: (p) => p.addInitScript(() => { try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} }) }); await wire(A);
    const B = await f.page("awayb", { width: 852, height: 393 }, { hasTouch: true, isMobile: true }); await wire(B);
    const cfgAll = (o) => Promise.all([host, A, B].map((p) => p.evaluate((o) => { SERVER_CFG.rank = Object.assign({}, SERVER_CFG.rank, o); }, o)));
    const home = (...pages) => Promise.all(pages.map((p) => p.evaluate(() => { try { netShutdown(); } catch (e) {} world.phase = "menu"; show("s-title"); })));
    async function matchOnce() {
      const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
      for (const p of [A, B]) await p.evaluate((c) => joinRoom(c), code);
      await host.waitForFunction(() => NET.conns.size === 2 && room.members.size === 3, null, W);
      await host.evaluate(() => { hostStartMatch(); });
      for (const p of [A, B]) await p.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, W);
      // the bots stand still (nobody shoots the player who is away), and the round runs
      await host.evaluate(() => { aiThink = () => {}; world.phase = "live"; world.roundTime = 900; });
      for (const p of [A, B]) await p.waitForFunction(() => "live" === world.phase, null, W);
      return { code };
    }
    // a loaded machine can starve a page for more than the 12 s a request is given: the whole start is tried again
    async function match() {
      for (let attempt = 1; ; attempt++) {
        try { return await matchOnce(); } catch (e) {
          if (attempt >= 3) throw e;
          console.log("match start failed, trying again:", e.message.split("\n")[0]);
          await home(host, A, B); await sleep(3000);
        }
      }
    }
    const ctrlOf = (name) => host.evaluate((n) => { const a = world.actors.find((x) => x.name === n); return a ? (isAI(a) ? "ai" : a.ctrl === "me" ? "me" : "guest") : null; }, name);
    // no ranked room any more: nothing in the game opens one
    assert.equal(await host.evaluate(() => typeof window.RANKED), "undefined", "ranked play is gone");

    // ───────── 3. a normal room: no AFK handling; a team can surrender there too ─────────
    await cfgAll({ afkWarnS: 2, afkLeaveS: 2 });
    await match();
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
    console.log("surrender ok: a normal room, no AFK handling, a team gives up by vote");
  // the PeerServer keeps the process alive after close(), as in the other PeerServer tests: the exit is explicit
  } finally { await f.browser.close(); signaling && signaling.close && signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e.message); console.error(e.stack); process.exit(1); });

