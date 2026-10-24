const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
// The competitive client flow, on the real server code (the fixture's in-process API):
//  A. a ranked room of three real browsers (host, guest, the operator): the host opens the match
//     on the server (ranked_start), everybody takes a ranked ticket, the host sends the result,
//     each player settles his own match: placement 1/5 for everyone, the operator's match counts
//     too. Cheats: refused for a normal account (switches, owner commands), allowed for the operator.
//  B. placement and the tier reveal (five attested matches), the result screen cell, the leaderboard
//     screen with my row marked, the room list's band, and the message for a room out of range.
const SIGNAL = Number(process.env.DFDF_SIGNAL_PORT) || 9187;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: SIGNAL, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  try {
    const dir = process.env.SHOT_DIR || "/tmp";
    const wire = (page) => page.evaluate(async (port) => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } });
    }, SIGNAL);
    // each page is wired (its drawing switched off) as soon as it exists: with the earlier pages still drawing the title
    // screen through the software renderer, the next page's boot starved on a loaded machine and timed out
    const host = await f.page("rkflowhost"); await wire(host);
    const guest = await f.page("rkflowguest"); await wire(guest);
    const op = await f.page("owner", undefined, {}, { pw: "owner-password" }); await wire(op);

    // ── A. one ranked match through the whole flow ──
    const code = await host.evaluate(async () => { await RANKED.open(); return NET.room; });
    for (let i = 0; i < 60 && !f.h.db.get("room:" + code); i++) await sleep(500);
    assert.ok(f.h.db.get("room:" + code), "the host reported its ranked room");
    assert.equal(JSON.parse(f.h.db.get("room:" + code)).ranked, true);
    for (const page of [guest, op]) await page.evaluate((c) => joinRoom(c), code);
    await host.waitForFunction(() => NET.conns.size === 2 && room.members.size === 3, null, { timeout: 60000 });
    for (const page of [guest, op]) await page.waitForFunction(() => room.ranked === true, null, { timeout: 90000 });

    // the lock: the normal accounts are shut out, the operator keeps his own cheats once the server confirmed him
    await op.waitForFunction(() => RANKED.isOperator() && RANKED.operator === true && RANKED.locked === false, null, { timeout: 90000 });
    await host.waitForFunction(() => HUNTX.OWNP.size === 1, null, { timeout: 90000 });
    const peers = await host.evaluate(() => ({ guest: [...room.members].find(([, m]) => m.name === "rkflowguest")[0], op: [...room.members].find(([, m]) => m.name === "owner")[0] }));
    const g1 = await guest.evaluate(async () => {
      ADMIN.god = true; ADMIN.infAmmo = true; ADMIN2.setPersonal("god", true); ADMIN2.afterChange(); HUNTX.HUNT.unlocked = true; window.IS_OWNER = true;
      await new Promise((r) => setTimeout(r, 900));
      return { god: ADMIN.god, ammo: ADMIN.infAmmo, pgod: ADMIN2.P.god, unlocked: HUNTX.HUNT.unlocked, locked: RANKED.locked, owner: window.IS_OWNER, operator: RANKED.isOperator() };
    });
    assert.deepEqual(g1, { god: false, ammo: false, pgod: false, unlocked: false, locked: true, owner: false, operator: false }, "a normal account stays locked, even claiming to be the owner");
    const o1 = await op.evaluate(async () => {
      ADMIN2.setPersonal("god", true); ADMIN2.afterChange(); ADMIN.run = 99;
      await new Promise((r) => setTimeout(r, 900));
      return { god: ADMIN.god, pgod: ADMIN2.P.god, owner: window.IS_OWNER, runShut: ADMIN.run === ADMIN_DEF.run, body: document.body.classList.contains("ranked") };
    });
    assert.deepEqual(o1, { god: true, pgod: true, owner: true, runShut: true, body: true }, "the operator keeps personal cheats; room-wide switches stay shut");
    // the host heard the operator's switch and nobody else's
    await host.waitForFunction((p) => ADMIN2.PEERS.has(p) && ADMIN2.PEERS.get(p).god === true, peers.op, { timeout: 45000 });
    assert.equal(await host.evaluate((p) => ADMIN2.PEERS.has(p), peers.guest), false);
    const refused = await host.evaluate((p) => {
      NET.onAction(p, { t: "padm", p: { cheat: true, god: true, oneShot: true, speed: 3 } });
      NET.onAction(p, { t: "kit", key: AGENTS[0].key });
      NET.onAction(p, { t: "perm-hi", ticket: "x" });
      return { padm: ADMIN2.PEERS.has(p), grant: (HUNTX.GRANT.add(p), HUNTX.GRANT.has(p)) };
    }, peers.guest);
    assert.deepEqual(refused, { padm: false, grant: false });

    // the match: the host opens it on the server and tells the room
    await host.evaluate(() => { room.mode = "std"; hostStartMatch(); });
    for (const page of [guest, op]) await page.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    await host.waitForFunction(() => RANKED.flow.current() && RANKED.flow.current().info, null, { timeout: 90000 });
    const info = await host.evaluate(() => RANKED.flow.current().info);
    assert.deepEqual([info.a.concat(info.b).sort(), typeof info.rm], [["owner", "rkflowguest", "rkflowhost"], "string"]);
    assert.equal(info.ownerPlayed, true);
    // everybody's ticket is the ranked one for this match (a client waited for the host's "roster is in")
    for (const [who, page] of [["rkflowhost", host], ["rkflowguest", guest], ["owner", op]]) {
      for (let i = 0; i < 40 && !f.h.db.get("rmt:" + info.id + ":" + who); i++) await sleep(500);
      assert.ok(f.h.db.get("rmt:" + info.id + ":" + who), who + " took a ranked ticket");
    }
    // cheat commands in the live match: the operator may set his own health, nobody else's; a normal account may do neither
    const ids = await host.evaluate(() => Object.fromEntries(world.actors.filter((a) => a.name && !isAI(a)).map((a) => [a.name, { id: a.id, ctrl: a.ctrl }])));
    const cmd = await host.evaluate(({ peers, ids }) => {
      const act = (id) => world.actors.find((a) => a.id === id);
      const mineOp = ids.owner.id, mineGuest = ids.rkflowguest.id;
      const hpGuest = act(mineGuest).hp;
      NET.onAction(peers.guest, { t: "own", op: "hp", id: mineGuest, v: 1 });
      NET.onAction(peers.guest, { t: "own", op: "kill", id: mineOp });
      NET.onAction(peers.op, { t: "own", op: "kill", id: mineGuest });
      NET.onAction(peers.op, { t: "own", op: "cheat", id: mineGuest, v: true });
      const afterRefusals = { guestHp: act(mineGuest).hp === hpGuest, guestAlive: act(mineGuest).alive, opAlive: act(mineOp).alive, grant: HUNTX.GRANT.has(peers.guest) };
      NET.onAction(peers.op, { t: "own", op: "hp", id: mineOp, v: 777 });
      return { afterRefusals, opHp: act(mineOp).hp };
    }, { peers, ids });
    assert.deepEqual(cmd.afterRefusals, { guestHp: true, guestAlive: true, opAlive: true, grant: false });
    assert.equal(cmd.opHp, 777, "the operator can set his own health");

    // the end: kills for the bonus, the atk side wins on every screen; the host's result goes first
    await host.evaluate(() => { const a = world.actors.find((x) => x.name === "rkflowguest"); a.kills = 4; });
    f.h.advance(61000);
    for (const page of [host, guest, op]) await page.evaluate(() => { world.scoreAtk = 7; world.scoreDef = 2; gameOver(); });
    const resKey = "rmres:" + info.id;
    for (let i = 0; i < 40 && !f.h.db.get(resKey); i++) await sleep(500);
    const res = JSON.parse(f.h.db.get(resKey) || "null");
    assert.ok(res, "the host sent the result");
    const hostTeam = info.a.includes("rkflowhost") ? "a" : "b";
    assert.equal(res.w, "a", "the attacking side (the roster's team a) won");
    assert.equal(await host.evaluate((t) => (LAST_MATCH.outcome === "win") === (t === "a"), hostTeam), true, "and the host's own outcome agrees with its team");
    assert.equal(res.k.rkflowguest, 4, "kills per account come from the host's tally");
    // each player settles: placement 1/5 for all three, the operator's match counts like the others
    for (const [who, page] of [["rkflowhost", host], ["rkflowguest", guest], ["owner", op]]) {
      await page.waitForFunction(() => ((((ACCOUNT.session() || {}).user || {}).placement) || {}).done === 1, null, { timeout: 60000 });
      const u = f.h.user(who);
      assert.deepEqual([u.placed, u.rr, u.rmDone.length], [1, 0, 1], who + " is placing: counted, RR untouched");
    }
    assert.equal(JSON.parse(f.h.db.get("rm:" + info.id)).ownerPlayed, true);
    // the result screen says "Placement 1/5" instead of an RR change
    await guest.waitForFunction(() => /배치 1\/5/.test((document.getElementById("ov-rank") || {}).textContent || ""), null, { timeout: 45000 });
    await guest.screenshot({ path: dir + "/ranked-flow-over.png" });
    // and the title chip hides the tier
    await guest.evaluate(() => { netShutdown(); world.phase = "menu"; show("s-title"); });
    await guest.waitForFunction(() => /배치 1\/5/.test((document.getElementById("rank-chip") || {}).textContent || ""), null, { timeout: 30000 });
    for (const page of [host, op]) await page.evaluate(() => { try { netShutdown(); } catch (e) {} });
    await sleep(700);
    assert.deepEqual(await op.evaluate(() => ({ locked: RANKED.locked, operator: RANKED.operator, ranked: room.ranked })), { locked: false, operator: false, ranked: false });

    // ── B. five matches: placement, the reveal, the leaderboard, the room list ──
    const names = ["lbp1", "lbp2", "lbp3"], tok = {};
    for (const id of names) tok[id] = (await f.h.api("auth", { id, pw: "password", device: "lb-" + id })).token;
    let last = null;
    async function match(n, winner = "a") {
      const room = "LBR00" + n;
      assert.equal((await f.h.api("room_up", { token: tok.lbp1, code: room, ranked: true, players: names })).status, 200);
      const s = await f.h.api("ranked_start", { token: tok.lbp1, room, a: ["lbp1", "lbp2"], b: ["lbp3"] });
      assert.equal(s.status, 200);
      const mt = {};
      for (const id of names) mt[id] = (await f.h.api("match_start", { token: tok[id], ranked: true, room })).ticket;
      f.h.advance(61000);
      assert.equal((await f.h.api("ranked_result", { token: tok.lbp1, rm: s.rm, w: winner, k: { lbp1: 3 } })).status, 200);
      const out = {};
      for (const id of names) out[id] = await f.h.api("progress", { token: tok[id], mt: mt[id], kills: id === "lbp1" ? 3 : 0, win: (id !== "lbp3") === (winner === "a"), match: { mode: "std", s: [7, 3] } });
      return out;
    }
    for (let n = 1; n <= 4; n++) { last = await match(n); assert.equal(last.lbp1.rankedCounted, true); }
    assert.deepEqual([last.lbp1.placement, last.lbp1.rank.hidden], [{ done: 4, of: 5 }, true]);
    const p1 = await f.page("lbp1", { width: 1280, height: 800 });
    await p1.waitForFunction(() => /배치 4\/5/.test((document.getElementById("rank-chip") || {}).textContent || ""), null, { timeout: 45000 });
    assert.equal(await p1.evaluate(() => document.getElementById("rank-chip").textContent.includes("아이언")), false, "no tier while placing");
    // the room list: the band of a ranked room as a tier, and "Find a ranked match" shows my standing
    const stub = {};
    await p1.route("**/api/v1?*", (route) => {
      const a = new URL(route.request().url()).searchParams.get("a");
      return stub[a] ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stub[a]) }) : route.fallback();
    });
    stub.rooms = { ok: true, rooms: [{ code: "ABCDEF", name: "랭크전 · far", ch: "s1", mode: "std", map: "pogu", ranked: true, band: 1350, range: 150, n: 2, max: 10, state: "lobby", host: "far", created: Date.now() }] };
    await p1.evaluate(() => MULTI.open());
    await p1.waitForSelector(".mu-room .mu-band");
    assert.equal(await p1.evaluate(() => document.querySelector(".mu-room .mu-band").textContent), "브론즈 1", "band 1350 = 350 RR = Bronze 1");
    await p1.waitForFunction(() => /배치 4\/5/.test(document.getElementById("mu-rank-me").textContent), null, { timeout: 30000 });
    await p1.screenshot({ path: dir + "/ranked-flow-rooms.png" });
    // out of range: a clear message and no connection attempt
    stub.ranked_can_join = { ok: false, ranked: true, range: 150, band: 1350 };
    const far = await p1.evaluate(async () => {
      let tried = 0; const join = netJoin; netJoin = async () => { tried++; throw new Error("no"); };
      await joinRoom("ABCDEF"); netJoin = join;
      return { tried, banner: document.getElementById("banner").textContent, note: document.getElementById("mu-note").textContent };
    });
    assert.equal(far.tried, 0);
    assert.match(far.banner, /실력대\(브론즈 1 부근\)가 나와 너무 달라 들어갈 수 없습니다/);
    assert.match(far.note, /입장 범위가 넓어집니다/);
    // a guest is turned away from a ranked room with its own message
    delete stub.ranked_can_join; delete stub.rooms;
    const guestMsg = await p1.evaluate(() => { const u = ACCOUNT.session().user; u.guest = true; const m = RANKED.joinNote({ ranked: true, ok: true }); u.guest = false; return m; });
    assert.match(guestMsg, /로그인한 계정만/);

    // the fifth match reveals the tier on the result screen (the report's answer is the server's)
    last = await match(5);
    const j = last.lbp1;
    assert.deepEqual([j.rankedCounted, j.placement, !!j.rank.hidden], [true, { done: 5, of: 5 }, false]);
    await p1.evaluate(() => { world.phase = "menu"; show("s-title"); });
    await p1.waitForTimeout(700);
    await p1.evaluate((j) => {
      const s = ACCOUNT.session(); world.phase = "over"; show("s-over");
      s.user = j.user; s.hist = j.hist;
      dispatchEvent(new CustomEvent("account-reward", { detail: j }));
    }, j);
    const tierName = await p1.evaluate((j) => RANK.names[j.user.rank.t] + (j.user.rank.div ? " " + j.user.rank.div : ""), j);
    await p1.waitForFunction((t) => { const text = (document.getElementById("ov-rank") || {}).textContent || ""; return text.includes(t) && /배치 완료/.test(text); }, tierName, { timeout: 45000 });
    await p1.screenshot({ path: dir + "/ranked-flow-reveal.png" });
    // a counted match after placement shows the RR change; one that did not count says why
    await p1.evaluate((j) => { world.phase = "menu"; }, j);
    await p1.waitForTimeout(700);
    await p1.evaluate((j) => {
      const j2 = Object.assign({}, j, { rr: 14, rankedCounted: true, placement: { done: 5, of: 5 } });
      world.phase = "over"; dispatchEvent(new CustomEvent("account-reward", { detail: j2 }));
    }, j);
    await p1.waitForFunction(() => /\+14/.test((document.getElementById("ov-rank") || {}).textContent || ""), null, { timeout: 45000 });
    await p1.evaluate(() => { world.phase = "menu"; });
    await p1.waitForTimeout(700);
    await p1.evaluate((j) => { world.phase = "over"; dispatchEvent(new CustomEvent("account-reward", { detail: Object.assign({}, j, { rr: 0, rankedCounted: false, rankedWhy: "few_humans" }) })); }, j);
    await p1.waitForFunction(() => /사람이 부족해/.test((document.getElementById("ov-rank") || {}).textContent || ""), null, { timeout: 45000 });

    // the leaderboard screen: from the home menu, the season, my row marked
    await p1.evaluate(() => { world.phase = "menu"; show("s-title"); });
    await p1.waitForSelector("#go-ranks");
    await p1.click("#go-ranks");
    await p1.waitForSelector("#s-ranks:not([hidden]) .lbd-row.me", { timeout: 45000 });
    const board = await p1.evaluate(() => ({ rows: document.querySelectorAll("#lbd-body .lbd-row:not(.hd)").length, me: document.querySelector("#lbd-body .lbd-row.me .nm").textContent, season: document.getElementById("lbd-season").textContent, mine: document.getElementById("lbd-me").textContent, rr: [...document.querySelectorAll("#lbd-body .lbd-row:not(.hd)")].map((r) => +r.querySelector(".n").textContent) }));
    assert.equal(board.rows, 3);
    assert.match(board.me, /^lbp1/);
    assert.match(board.season, /시즌 1 · \d+일 남음/);
    assert.match(board.mine, /1위|2위|3위/);
    assert.deepEqual(board.rr, [...board.rr].sort((x, y) => y - x), "sorted by RR");
    await p1.screenshot({ path: dir + "/ranked-flow-board.png" });
    await p1.keyboard.press("Escape");
    assert.equal(await p1.evaluate(() => document.getElementById("s-ranks").hidden && !document.getElementById("s-title").hidden), true);
    // a phone-sized screen keeps the slim header and shows the screen without sideways scrolling
    await p1.setViewportSize({ width: 390, height: 780 });
    await p1.evaluate(() => LEADERBOARD.open());
    await p1.waitForSelector("#s-ranks:not([hidden]) .lbd-row.me");
    assert.equal(await p1.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await p1.screenshot({ path: dir + "/ranked-flow-board-phone.png" });
    assert.deepEqual(f.errors, []);
    console.log("ranked flow: attested match (roster, tickets, result, settle), placement and reveal, RR cell, leaderboard, band and range message, cheats locked for normal accounts and open for the operator");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
