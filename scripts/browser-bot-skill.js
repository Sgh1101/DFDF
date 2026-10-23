// Bot skill follows the humans in the room (js/bot-skill.js), and the Lv chip shows on the scoreboard, lobby and kill feed.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const host = await f.page("skillhost"), guest = await f.page("skillguest");
    for (const page of [host, guest]) await page.evaluate(async () => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
    });

    // 1. the tables the module keeps are the numbers the game plays with: skill 1.0 is the old normal, 1.2 is the old hard, 0.6 is 60% of normal
    const tables = await host.evaluate(() => {
      const B = BOT_SKILL, pick = (o) => Object.fromEntries(Object.keys(B.HARD).map((k) => [k, o[k]]));
      room.mode = "std"; room.diff = "hard";
      return { hard: pick(DIFF_TUNE.hard), normal: pick(DIFF_TUNE.normal), modHard: B.HARD, modNormal: B.NORMAL, live: pick(diffTune()), floor: B.tune(0.6) };
    });
    assert.deepEqual(tables.modHard, tables.hard, "bot-skill HARD matches the live hard preset");
    assert.deepEqual(tables.modNormal, tables.normal, "bot-skill NORMAL matches the live normal preset");
    assert.deepEqual(tables.live, tables.hard, "room.diff 'hard' plays exactly as before");
    assert.ok(Math.abs(tables.floor.turn - 0.6 * tables.normal.turn) < 1e-3 && Math.abs(tables.floor.dmg - 0.6) < 1e-3);

    // 2. the same room at different account levels (Lv1 0.60 ... Lv50 1.00): every bot number moves the right way, and the bots really use it
    const byLevel = await host.evaluate(() => {
      const out = [];
      for (const level of [1, 10, 25, 50]) {
        ACCOUNT.session().user.level = level;
        room.mode = "std"; room.diff = "normal";
        startGame(AGENTS[0], false); ADMIN.freezeAI = true;
        step(0.001);
        const bot = world.actors.find((a) => "ai" === a.ctrl), t = diffTune();
        out.push({ level, skill: BOT_RT.skill, turn: t.turn, tol: t.tol, range: t.range, dmg: t.dmg, hs: t.hs, err: t.err, spread: t.spread, accuracy: bot.ai.accuracy, bots: world.actors.filter((a) => "ai" === a.ctrl).length });
      }
      return out;
    });
    for (let i = 1; i < byLevel.length; i++) {
      const a = byLevel[i - 1], b = byLevel[i];
      assert.ok(b.skill > a.skill, `skill rises with level ${a.level} -> ${b.level}`);
      for (const k of ["turn", "tol", "range", "dmg", "hs"]) assert.ok(b[k] > a[k], `${k} rises: ${a[k]} -> ${b[k]}`);
      for (const k of ["err", "spread"]) assert.ok(b[k] < a[k], `${k} (lower is better aim) falls: ${a[k]} -> ${b[k]}`);
    }
    assert.ok(byLevel.every((r) => r.bots > 0));
    // the cone a bot shoots with is the room's spread, tightened for a one-shot-at-a-time gun (module 31: x1, x0.6 rifle, x0.35 sniper)
    for (const r of byLevel) assert.ok([1, 0.6, 0.35].some((k) => Math.abs(r.accuracy - r.spread * k) < 1e-9), `accuracy ${r.accuracy} vs spread ${r.spread}`);
    assert.ok(byLevel[3].skill === 1 && byLevel[0].skill === 0.6, "Lv1 0.60, Lv50 1.00");
    // Lv50 is exactly today's normal bot
    assert.deepEqual(await host.evaluate(() => { const t = diffTune(), n = DIFF_TUNE.normal; return Object.keys(BOT_SKILL.NORMAL).every((k) => t[k] === n[k]); }), true);
    console.log("bot numbers by level", byLevel.map((r) => `Lv${r.level}: skill ${r.skill} turn ${r.turn} err ${r.err} dmg ${r.dmg} accuracy ${r.accuracy}`).join(" | "));

    // ranked: the tier decides, Iron 0.60 ... Radiant 1.20, and a level is ignored
    const byTier = await host.evaluate(() => {
      const out = [];
      ACCOUNT.session().user.level = 1;
      for (const t of [0, 4, 8]) {
        ACCOUNT.session().user.rank = { t, tier: "x", div: 1, rr: 0 };
        room.mode = "std"; room.diff = "normal"; startGame(AGENTS[0], false); ADMIN.freezeAI = true;
        room.ranked = true; startRound(); step(0.001);
        const bot = world.actors.find((a) => "ai" === a.ctrl);
        out.push({ tier: t, skill: BOT_RT.skill, turn: diffTune().turn, spread: diffTune().spread, accuracy: bot.ai.accuracy });
        room.ranked = false;
      }
      return out;
    });
    assert.deepEqual(byTier.map((r) => r.skill), [0.6, 0.9, 1.2]);
    assert.ok(byTier[0].turn < byTier[1].turn && byTier[1].turn < byTier[2].turn && byTier[0].spread > byTier[1].spread && byTier[1].spread > byTier[2].spread);
    // the presets still work: easy is the lowest, hard is exactly the old hard, whatever the room's skill was
    const presets = await host.evaluate(() => { BOT_RT.skill = 0.85; const r = {}; for (const d of ["easy", "normal", "hard"]) { room.diff = d; r[d] = diffTune().dmg; } room.diff = "normal"; return r; });
    assert.ok(presets.easy === 0.6 && presets.easy < presets.normal && presets.normal < presets.hard && presets.hard === 1.35, JSON.stringify(presets));

    // 3. the chip on the scoreboard: mine says Lv N, the bots have none, a guest account has none
    const board = await host.evaluate(() => {
      ACCOUNT.session().user.level = 7;
      room.mode = "std"; room.diff = "normal"; startGame(AGENTS[0], false); ADMIN.freezeAI = true;
      QOL.openBoard("sb", true);
      const rows = [...document.querySelectorAll("#bd-body .bd-row:not(.hd)")];
      const me = rows.find((r) => r.classList.contains("me")), chips = rows.map((r) => r.querySelector(".lv-chip") ? r.querySelector(".lv-chip").textContent : null);
      const guest = (() => { const u = ACCOUNT.session().user; u.guest = true; const t = LV_CHIP.text(myActor()); u.guest = false; return t; })();
      const botChip = LV_CHIP.text(world.actors.find((a) => "ai" === a.ctrl));
      return { me: me.querySelector(".lv-chip") && me.querySelector(".lv-chip").textContent, chips: chips.filter(Boolean), rows: rows.length, guest, botChip };
    });
    assert.equal(board.me, "Lv 7");
    assert.deepEqual(board.chips, ["Lv 7"], "only the human has a chip");
    assert.ok(board.rows >= 4);
    assert.equal(board.guest, ""); assert.equal(board.botChip, "");
    await host.evaluate(() => { QOL.closeBoard && QOL.closeBoard(); netShutdown(); });

    // 4. online: the guest's level and tier travel in hello; the lobby slots, the host's room skill and the guest's scoreboard know it
    await host.evaluate(() => { ACCOUNT.session().user.level = 4; ACCOUNT.session().user.rank = { t: 2, tier: "silver", div: 1, rr: 0 }; });
    await guest.evaluate(() => { ACCOUNT.session().user.level = 30; ACCOUNT.session().user.rank = { t: 6, tier: "ascendant", div: 1, rr: 0 }; });
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
    await guest.waitForFunction(() => document.querySelectorAll("#lobby .lv-chip").length === 2);
    const lobby = async (page) => page.evaluate(() => [...document.querySelectorAll("#lb-atk .lb-slot, #lb-def .lb-slot")].filter((s) => s.querySelector(".lv-chip")).map((s) => s.querySelector(".lb-nm").textContent.replace(/\s+/g, " ").trim()));
    for (const names of [await lobby(host), await lobby(guest)]) {
      assert.equal(names.length, 2, JSON.stringify(names));
      assert.ok(names.some((n) => /skillhost.*Lv 4$|Lv 4$/.test(n)) && names.some((n) => /Lv 30$/.test(n)), JSON.stringify(names));
    }
    const heard = await host.evaluate(() => [...LV_CHIP.peers].map(([, v]) => v));
    assert.deepEqual(heard, [{ lv: 30, tr: 6 }]);
    await host.evaluate(() => { room.mode = "std"; room.diff = "normal"; hostStartMatch(); ADMIN.freezeAI = true; });
    await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    const online = await host.evaluate(() => ({ skill: BOT_RT.skill, want: BOT_SKILL.roomSkill([{ level: 4 }, { level: 30 }], false) }));
    assert.equal(online.skill, online.want, "the host's skill is the average of both humans' levels");
    const seen = await guest.evaluate(() => {
      QOL.openBoard("sb", true);
      return [...document.querySelectorAll("#bd-body .bd-row:not(.hd) .lv-chip")].map((c) => c.textContent).sort();
    });
    assert.deepEqual(seen, ["Lv 30", "Lv 4"], "the guest's scoreboard shows both humans");
    // the kill feed: a human's name carries the chip, a bot's does not
    const feed = await host.evaluate(() => {
      const me = myActor(), bot = world.actors.find((a) => "ai" === a.ctrl);
      pushKill(bot.name || bot.agent.name, me.name || me.agent.name);
      return [...document.querySelectorAll("#klog .kl")[0].querySelectorAll(".lv-chip")].map((c) => c.textContent);
    });
    assert.deepEqual(feed, ["Lv 4"]);
    assert.deepEqual(f.errors, []);
    console.log("bot skill: tiers and levels set the bots' numbers monotonic, hard stays the old hard, Lv chip on scoreboard, lobby slots and kill feed, guest level travels in hello");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
