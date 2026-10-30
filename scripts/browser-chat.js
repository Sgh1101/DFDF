// Chat, quick chat and pings (js/legacy/115-chat-quick-chat-and-pings.js), on four pages and a PeerServer: a host, two guests on
// different teams (A defends, B attacks, the host attacks) and a guest running the game WITHOUT the chat file (an older game).
// Checked: all chat reaches everyone, team chat stays on the team (lobby and match), 80 characters and no control characters, 3
// messages per 5 s, swear words masked, mute (a click on a name, kept for the session), typing "w" does not walk, quick chat (Z then
// a number, the chips, Shift for all), a ping marker (sprite, minimap, sound, 4 s) for a teammate and not for an enemy, the owner's
// switch (UI gone, the host drops the messages), a ranked room, an older guest ignoring the new messages, English, and on a phone the
// two touch buttons (in the layout editor's list and working). Screenshots go to test-results/chat-*.png.
const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
(async () => {
  let signaling;
  await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
  const f = await fixture();
  const shot = (page, name) => page.screenshot({ path: `test-results/chat-${name}.png`, timeout: 120000 }).catch(() => {});
  try {
    const prep = async (page) => {
      await page.evaluate(async (port) => { titleCam = () => {}; await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } }); }, PORT);
    };
    const hist = (page) => page.evaluate(() => CHAT.hist().filter((m) => !m.sys).map((m) => ({ id: m.id, n: m.n, tm: m.tm, s: m.s, m: m.m, q: m.q })));
    const texts = async (page) => (await hist(page)).map((m) => m.m);
    const everyone = {};
    const state = (page) => page.evaluate(() => ({ mode: NET.mode, phase: world.phase, lobby: !document.getElementById("lobby").hidden, actors: world.actors.length, chat: typeof CHAT === "undefined" ? null : { on: CHAT.on(), root: !document.getElementById("cht").hidden, texts: CHAT.hist().map((m) => m.m || m.q || m.sys) } })).catch((e) => String(e));
    const heard = (page, text) => page.waitForFunction((t) => CHAT.hist().some((m) => m.m === t), text, { timeout: 15000 }).catch(async (e) => { e.message += "\nnobody heard \"" + text + "\"; pages: " + JSON.stringify(Object.fromEntries(await Promise.all(Object.entries(everyone).map(async ([k, p]) => [k, await state(p)])))); throw e; });
    const silent = async (page, text, who) => { await page.waitForTimeout(1200); assert.ok(!(await texts(page)).includes(text), `${who} must not hear "${text}"`); };
    const raw = (page, msg) => page.evaluate((m) => NET.up.event.send(m), msg);
    const reset = (...pages) => Promise.all(pages.map((p) => p.evaluate(() => CHAT.resetLimits())));
    const typeIn = async (page, keys, text) => { await page.keyboard.press(keys); await page.keyboard.type(text); await page.keyboard.press("Enter"); };

    // the older guest: the same page with the chat file blanked out
    // a page draws nothing until a step needs the picture (the machine has four cores; every page would draw the title scene)
    const quiet = async (p) => { await p.evaluate(() => { window.__render = render; render = () => {}; titleCam = () => {}; }); return p; };
    const host = await quiet(await f.page("chatH")), A = await quiet(await f.page("chatA")), B = await quiet(await f.page("chatB"));
    const C = await quiet(await f.page("chatC", { width: 852, height: 393 }, {}, { beforeLoad: (p) => p.route("**/js/legacy/115-chat-quick-chat-and-pings.js", (r) => r.fulfill({ body: "", contentType: "text/javascript" })) }));
    Object.assign(everyone, { host, A, B, C });
    for (const p of [host, A, B, C]) await prep(p);
    assert.equal(await C.evaluate(() => typeof CHAT), "undefined", "page C runs without the chat file");
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    const peers = {};
    for (const [i, [name, g]] of [["A", A], ["B", B], ["C", C]].entries()) {
      await g.evaluate((c) => joinRoom(c), code);
      await host.waitForFunction((n) => room.members.size === n, i + 2, { timeout: 60000 });
      peers[name] = await g.evaluate(() => NET.peer.id);
    }
    const teams = await host.evaluate(() => [...room.members].map(([k, m]) => [k, m.team]));
    const teamOf = (id) => teams.find(([k]) => k === id)[1];
    const hostId = await host.evaluate(() => NET.id);
    assert.equal(teamOf(peers.A), "def"); assert.equal(teamOf(peers.B), "atk"); assert.equal(teamOf(hostId), "atk");
    await A.waitForFunction(() => lobbyState && lobbyState.atk.concat(lobbyState.def).filter((x) => x && x.peer).length === 4, null, { timeout: 60000 });
    await B.waitForFunction(() => !document.getElementById("lobby").hidden, null, { timeout: 60000 });

    // ── the lobby: the join lines, all chat from the keyboard, team chat inside the team ──
    assert.ok((await host.evaluate(() => CHAT.hist().filter((m) => "join" === m.sys).length)) >= 3, "the host saw three joins");
    await typeIn(A, "Shift+Enter", "hello everyone");
    for (const p of [host, A, B]) await heard(p, "hello everyone");
    const line = await host.evaluate(() => { const n = [...document.querySelectorAll("#cht-log .cht-m")].find((e) => /hello everyone/.test(e.textContent)); return { tag: n.querySelector(".tg").className, name: n.querySelector(".n").className, text: n.textContent }; });
    assert.match(line.tag, /\ba\b/); assert.match(line.name, /\bdef\b/, "A's name is coloured by A's team (defence)");
    await typeIn(A, "Enter", "defence only");
    await heard(A, "defence only"); await silent(host, "defence only", "the host (attack)"); await silent(B, "defence only", "B (attack)");
    await typeIn(B, "Enter", "attack only");
    await heard(host, "attack only"); await heard(B, "attack only"); await silent(A, "attack only", "A (defence)");
    assert.equal((await hist(host)).find((m) => m.m === "attack only").s, "t");
    await shot(host, "lobby-852");
    console.log("lobby: join lines, all chat, team chat stays on the team");

    // ── start the match ──
    await host.evaluate(() => { room.mode = "std"; room.map = "field"; hostStartMatch(); });
    for (const g of [A, B, C]) await g.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
    await host.evaluate(() => { world.roundTime = 99999; ADMIN.freezeAI = true; for (const a of world.actors) a.invuln = 999; locked = true; });
    await Promise.all([A, B].map((p) => p.evaluate(() => { locked = true; })));
    await Promise.all([host, A, B].map((p) => p.evaluate(() => { closeShop(); document.activeElement && document.activeElement.blur && document.activeElement.blur(); })));
    await host.waitForTimeout(800);
    await reset(host);

    // ── all chat, team chat ──
    await A.evaluate(() => CHAT.post("a", "gg from A", -1));
    for (const p of [host, A, B]) await heard(p, "gg from A");
    await reset(host);
    await B.evaluate(() => CHAT.post("t", "B to team", -1));
    await heard(host, "B to team"); await heard(B, "B to team"); await silent(A, "B to team", "the enemy A");
    await A.evaluate(() => CHAT.post("t", "A to team", -1));
    await heard(A, "A to team"); await silent(host, "A to team", "the enemy host"); await silent(B, "A to team", "the enemy B");
    await host.evaluate(() => CHAT.post("t", "host to team", -1));
    await heard(B, "host to team"); await silent(A, "host to team", "the enemy A");
    console.log("match: all chat reaches everyone, team chat stays on the team (guest to guest, host to guest, enemy side)");

    // ── what the host accepts ──
    await reset(host);
    await raw(A, { t: "chat", s: "a", m: "가".repeat(200) });
    await heard(B, "가".repeat(80));
    assert.ok(!(await texts(B)).some((t) => t && t.length > 80), "no message longer than 80");
    await raw(A, { t: "chat", s: "a", m: "\u0007hi\u0000 th​ere\n\tmate‮" });
    await heard(B, "hi there mate");
    await raw(A, { t: "chat", s: "a", m: "   \n\t  " });
    await raw(A, { t: "chat", s: "a", m: { toString: 1 } });
    await raw(A, { t: "chat", s: "a", q: 99 });
    await raw(A, { t: "chat", s: "a", q: "3" });
    await raw(A, { t: "chat" }); await raw(A, { t: "mark", x: [1], y: {}, z: "z" }); await raw(A, { t: "chat", s: 5, m: "scope is not a letter" });
    await heard(B, "scope is not a letter");
    await host.waitForTimeout(600);
    assert.deepEqual((await texts(B)).filter((t) => t !== undefined && /^\s*$/.test(t)), [], "an empty message is dropped");
    await reset(host);
    await raw(A, { t: "chat", s: "a", m: "씨발 ㅅㅂ f u c k you 시 발 SHIT 병신" });
    await heard(B, "*** *** *** you *** *** ***");
    await raw(A, { t: "chat", s: "a", m: "좋아요 보지 마세요 class pass assist cocktail" });
    await heard(B, "좋아요 보지 마세요 class pass assist cocktail");
    await reset(host);
    for (let i = 0; i < 6; i++) await raw(A, { t: "chat", s: "a", m: "burst" + i });
    await heard(B, "burst2"); await B.waitForTimeout(1200);
    assert.deepEqual((await texts(B)).filter((t) => /^burst/.test(t)), ["burst0", "burst1", "burst2"], "3 messages in a burst, the rest dropped");
    await B.waitForTimeout(1900);
    await raw(A, { t: "chat", s: "a", m: "burst-later" });
    await heard(B, "burst-later");
    await reset(host);
    console.log("host checks: 80 characters, control characters, empty and malformed dropped, swear words masked, 3 per 5 s");

    // ── mute: a click on a name, kept for the session, and an unmute chip ──
    await B.keyboard.press("Enter");
    await B.waitForSelector("#cht-box:not([hidden])");
    await B.click(`#cht-log .n[data-id="${peers.A}"]`);
    assert.equal(await B.evaluate(() => CHAT.state.muted.size), 1);
    assert.match(await B.evaluate(() => sessionStorage.getItem("dfdf_chat_mute")), /chatA/, "kept for the session, by name");
    await shot(B, "mute-852");
    await B.keyboard.press("Escape");
    await A.evaluate(() => CHAT.post("a", "after the mute", -1));
    await heard(host, "after the mute"); await silent(B, "after the mute", "B who muted A");
    await B.keyboard.press("Enter");
    await B.click("#cht-mutes button");
    assert.equal(await B.evaluate(() => CHAT.state.muted.size), 0);
    await B.keyboard.press("Escape");
    await reset(host);
    await A.evaluate(() => CHAT.post("a", "after the unmute", -1));
    await heard(B, "after the unmute");
    console.log("mute: hides one player, remembered, undone from the chip");

    // ── typing "w" does not walk; the box takes the mouse and the keys, Escape gives them back ──
    const p0 = await host.evaluate(() => { const a = myActor(); return [a.pos.x, a.pos.z]; });
    await host.keyboard.press("Enter");
    await host.waitForFunction(() => document.activeElement && document.activeElement.id === "cht-in", null, { timeout: 5000 });
    await host.keyboard.down("w");
    await host.waitForTimeout(700);
    const during = await host.evaluate(() => ({ w: !!keys.w, v: document.getElementById("cht-in").value, pos: [myActor().pos.x, myActor().pos.z], paused: !document.getElementById("pause").hidden, lockhint: !document.getElementById("lockhint").hidden }));
    await host.keyboard.up("w");
    assert.equal(during.w, false, "the game did not see W");
    assert.match(during.v, /^w+$/, "W went into the box");
    assert.ok(Math.hypot(during.pos[0] - p0[0], during.pos[1] - p0[1]) < 0.05, "the player did not move");
    assert.equal(during.paused, false, "the pause menu is not opened by the box"); assert.equal(during.lockhint, false, "no click-to-lock cover over the box");
    await host.keyboard.press("a"); await host.keyboard.press("Space"); await host.keyboard.press("1");
    assert.match(await host.evaluate(() => document.getElementById("cht-in").value), /^w+a 1$/, "keys all went into the box");
    await shot(host, "box-852");
    await host.keyboard.press("Escape");
    assert.equal(await host.evaluate(() => CHAT.state.open || !document.getElementById("pause").hidden), false, "Escape closes the box and is not taken by the pause menu");
    await host.keyboard.down("w");
    await host.waitForFunction(() => keys.w === true, null, { timeout: 3000 });
    await host.keyboard.up("w");
    console.log("typing: W stays in the box, the player does not move, Escape closes without pausing, keys work again after");

    // ── quick chat ──
    await reset(host);
    const slot0 = await B.evaluate(() => player.slot);
    await B.keyboard.press("z");
    await B.waitForSelector("#cht-qm:not([hidden])");
    await shot(B, "quick-852");
    await B.keyboard.press("2");
    await host.waitForFunction(() => CHAT.hist().some((m) => 1 === m.q && "t" === m.s), null, { timeout: 15000 });
    assert.equal(await host.evaluate(() => CHAT.phrase(1)), "고마워요");
    await A.waitForTimeout(800);
    assert.ok(!(await hist(A)).some((m) => 1 === m.q), "the enemy did not get the phrase");
    assert.equal(await B.evaluate(() => document.getElementById("cht-qm").hidden), true, "the menu closed");
    assert.equal(await B.evaluate(() => player.slot), slot0, "the number key did not switch the weapon while the menu was open");
    await reset(host);
    await B.keyboard.press("z"); await B.keyboard.press("Shift+Digit0");
    await A.waitForFunction(() => CHAT.hist().some((m) => 9 === m.q && "a" === m.s), null, { timeout: 15000 });
    await reset(host);
    await B.keyboard.press("Enter");
    await B.click('#cht-qc button[data-q="6"]');
    await host.waitForFunction(() => CHAT.hist().some((m) => 6 === m.q && "t" === m.s), null, { timeout: 15000 });
    assert.equal(await B.evaluate(() => CHAT.state.open), false, "a chip sends and closes the box");
    console.log("quick chat: Z + number (team), Shift for all, the chips");

    // ── pings ──
    await reset(host, A, B);
    const P = await host.evaluate(() => { const a = myActor(); return { x: Math.round(a.pos.x + 8), y: 0.3, z: Math.round(a.pos.z + 4) }; });
    await host.evaluate((p) => CHAT.ping(p), P);
    await B.waitForFunction(() => CHAT.pings().length === 1, null, { timeout: 15000 });
    const got = await B.evaluate(() => ({ p: CHAT.pings()[0], sprite: !!scene.getObjectByName("ping"), snd: CHAT.stats.pingSounds }));
    assert.ok(Math.abs(got.p.x - P.x) < 0.2 && Math.abs(got.p.z - P.z) < 0.2, "the teammate got the point");
    assert.equal(got.sprite, true, "a sprite is in the world"); assert.ok(got.snd >= 1, "and a sound was asked for");
    const px = await (async () => {
      const read = (page) => page.evaluate((P) => { drawMini(); const b = MAP.bounds, x = Math.round((P.x - b.minX) * mini.width / (b.maxX - b.minX)), z = Math.round((P.z - b.minZ) * mini.height / (b.maxZ - b.minZ)); return Array.from(mctx.getImageData(x, z, 1, 1).data); }, P);
      return { B: await read(B), A: await read(A) };
    })();
    assert.ok(px.B[0] > 230 && px.B[1] > 170 && px.B[1] < 230 && px.B[2] < 120, "the minimap shows the gold mark for the teammate: " + px.B);
    assert.ok(!(px.A[0] > 230 && px.A[1] > 170 && px.A[2] < 120), "and not for the enemy: " + px.A);
    await A.waitForTimeout(800);
    assert.equal(await A.evaluate(() => CHAT.pings().length + CHAT.stats.pingSounds + (scene.getObjectByName("ping") ? 1 : 0)), 0, "the enemy saw and heard nothing");
    // it lasts about 4 s, and goes by itself
    const life = await B.evaluate(() => new Promise((res) => { const t0 = performance.now() - CHAT.pings()[0].age, iv = setInterval(() => { if (!CHAT.pings().length) { clearInterval(iv); res(performance.now() - t0); } }, 40); }));
    assert.ok(life > 3500 && life < 5600, "a ping lasts about 4 s, it lasted " + Math.round(life));
    assert.equal(await B.evaluate(() => !!scene.getObjectByName("ping")), false, "its sprite is gone");
    // a ping from the enemy side goes to the enemy side
    await reset(host, A, B);
    await A.evaluate((P) => CHAT.ping({ x: P.x - 3, y: 0.3, z: P.z - 3 }), P);
    await A.waitForFunction(() => CHAT.pings().length === 1, null, { timeout: 5000 });
    await host.waitForTimeout(1200);
    assert.equal(await host.evaluate(() => CHAT.pings().length) + (await B.evaluate(() => CHAT.pings().length)), 0, "A's ping did not reach the other team");
    // one a second, and nothing outside the map
    await reset(host, A, B);
    const sounds = () => host.evaluate(() => CHAT.stats.pingSounds);
    const s0 = await sounds();
    await raw(B, { t: "mark", x: P.x, y: 0.3, z: P.z }); await raw(B, { t: "mark", x: P.x + 1, y: 0.3, z: P.z });
    await host.waitForTimeout(1000);
    assert.equal((await sounds()) - s0, 1, "two pings in a row: only one passes");
    await host.waitForTimeout(1100);
    await raw(B, { t: "mark", x: 1e9, y: 0, z: 0 }); await raw(B, { t: "mark", x: "a", y: 0, z: 0 }); await raw(B, { t: "mark" });
    await host.waitForTimeout(800);
    assert.equal((await sounds()) - s0, 1, "a point outside the map is dropped");
    // the V key: the point under the crosshair, from the wall ray
    await reset(host, A, B);
    await host.evaluate(() => { render = window.__render; const a = myActor(); a.pitch = -0.55; a.input && (a.input.pitch = a.pitch); locked = true; });
    await host.waitForFunction(() => { const p = CHAT.aim(), a = myActor(); return !!p && Math.hypot(p.x - a.pos.x, p.z - a.pos.z) < 15; }, null, { timeout: 30000 });
    const aim = await host.evaluate(() => { const p = CHAT.aim(), a = myActor(); return p && { d: Math.hypot(p.x - a.pos.x, p.z - a.pos.z), y: p.y }; });
    assert.ok(aim && aim.d > 1 && aim.d < 15 && Math.abs(aim.y) < 1.2, "the ray finds the floor ahead: " + JSON.stringify(aim));
    await host.keyboard.press("v");
    await host.evaluate(() => { render = () => {}; });
    await B.waitForFunction((id) => CHAT.pings().some((p) => p.id === id), hostId, { timeout: 15000 });
    const n1 = await sounds();
    await host.keyboard.press("Enter"); await host.keyboard.type("v"); await host.keyboard.press("Escape");
    await host.waitForTimeout(300);
    assert.equal(await sounds(), n1, "typing a V does not ping");
    console.log("pings: teammate sees sprite + minimap mark + sound for 4 s, the enemy nothing, 1 per second, bad points dropped, the V key");

    // ── the owner's switch ──
    const owner = await f.h.api("auth", { id: "owner", pw: "owner-password", device: "browser-owner-device" });
    const serverChat = async (on) => { const c = JSON.parse(JSON.stringify(f.h.config)); c.game.chat = on; const r = await f.h.api("a_config_set", { atoken: owner.atoken, config: c }); assert.equal(r.status, 200); assert.equal(r.config.game.chat, on); };
    const setCfg = (page, on) => page.evaluate((on) => { window.SERVER_CFG = Object.assign({}, window.SERVER_CFG, { game: Object.assign({}, (window.SERVER_CFG || {}).game, { chat: on }) }); dispatchEvent(new CustomEvent("server-config", { detail: window.SERVER_CFG })); }, on);
    await serverChat(false);
    await setCfg(host, false);
    assert.equal(await host.evaluate(() => CHAT.post("a", "off message", -1)), "off");
    assert.equal(await host.evaluate(() => document.body.classList.contains("cht-off") && getComputedStyle(document.getElementById("cht")).display), "none", "the host's chat UI is hidden");
    await host.keyboard.press("Enter");
    assert.equal(await host.evaluate(() => CHAT.state.open), false, "Enter opens nothing");
    await B.evaluate(() => CHAT.post("a", "to a host that has it off", -1));
    await silent(A, "to a host that has it off", "A"); await silent(host, "to a host that has it off", "the host");
    await host.evaluate(() => CHAT.ping({ x: 0, y: 0.3, z: 0 }));
    await B.waitForTimeout(800);
    await setCfg(A, false);
    assert.equal(await A.evaluate(() => document.body.classList.contains("cht-off") && getComputedStyle(document.getElementById("cht")).display), "none", "a guest's UI is hidden too");
    await serverChat(true);
    await setCfg(host, true); await setCfg(A, true);
    await reset(host, A, B);
    await B.evaluate(() => CHAT.post("a", "back on", -1));
    await heard(A, "back on");
    assert.equal(await host.evaluate(() => document.body.classList.contains("cht-off")), false);
    console.log("owner switch: UI hidden, the host drops the messages and pings, back on works");

    // ── a ranked room: chat passes the guest-message filter ──
    await host.evaluate(() => { room.ranked = true; });
    await reset(host);
    await A.evaluate(() => CHAT.post("a", "ranked all", -1)); await heard(B, "ranked all");
    await B.evaluate(() => CHAT.post("t", "ranked team", -1)); await heard(host, "ranked team");
    await reset(host);
    await B.evaluate((P) => CHAT.ping({ x: P.x, y: 0.3, z: P.z }), P);
    await host.waitForFunction(() => CHAT.pings().length >= 1, null, { timeout: 10000 });
    await host.evaluate(() => { room.ranked = false; });
    console.log("ranked: all chat, team chat and pings pass");

    // ── an older game (no chat file) ignores the new messages and says nothing back, as a guest and as the host ──
    await reset(host);
    await host.evaluate(() => CHAT.post("a", "for everyone, old or new", -1));
    await heard(A, "for everyone, old or new");
    await host.evaluate((P) => CHAT.ping({ x: P.x, y: 0.3, z: P.z }), P);
    await C.waitForTimeout(1500);
    assert.deepEqual(f.errors, [], "no error on the older guest or the host");
    assert.equal(await C.evaluate(() => "client" === NET.mode && world.actors.length > 0 && !!myActor() && !document.getElementById("cht")), true, "the older guest plays on, without a chat box");
    for (const p of [host, A, B, C]) await p.context().close();
    const base = f.errors.length; // what the closing of those pages said is not the game's
    const OH = await quiet(await f.page("chatOldHost", { width: 852, height: 393 }, {}, { beforeLoad: (p) => p.route("**/js/legacy/115-chat-quick-chat-and-pings.js", (r) => r.fulfill({ body: "", contentType: "text/javascript" })) }));
    const NG = await quiet(await f.page("chatNewGuest"));
    for (const p of [OH, NG]) await prep(p);
    const oldCode = await OH.evaluate(async () => { await createRoom(); return NET.room; });
    await NG.evaluate((c) => joinRoom(c), oldCode);
    await OH.waitForFunction(() => room.members.size === 2, null, { timeout: 60000 });
    await NG.waitForFunction(() => !document.getElementById("lobby").hidden, null, { timeout: 60000 });
    const seats = () => OH.evaluate(() => JSON.stringify([room.slots, [...room.members].map(([k, m]) => [m.team, m.slot])]));
    const seats0 = await seats();
    await NG.evaluate(() => { CHAT.post("a", "anyone there?", -1); CHAT.post("t", "", 2); });
    await OH.waitForTimeout(1500);
    assert.equal(await seats(), seats0, "a host without chat ignores the chat of a new guest (the lobby is as it was)");
    assert.equal(await OH.evaluate(() => typeof CHAT + "," + !document.getElementById("cht")), "undefined,true");
    assert.deepEqual(f.errors.slice(base), [], "no error on the older host or the new guest");
    console.log("older game: ignores chat and pings without errors, as a guest and as a host");

    // ── English: the text of the interface and the phrases ──
    const en = await f.page("chatEn", { width: 852, height: 393 }, {}, { beforeLoad: (p) => p.addInitScript(() => { try { localStorage.setItem("lgp_lang", "en"); } catch (e) {} }) });
    await quiet(en); await en.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await en.waitForTimeout(800);
    await en.evaluate(() => { CHAT.open("t"); });
    const ui = await en.evaluate(() => ({ tabs: [...document.querySelectorAll(".cht-tabs button")].map((b) => b.textContent), send: document.getElementById("cht-send").textContent, chips: [...document.querySelectorAll("#cht-qc button")].map((b) => b.textContent), ph: document.getElementById("cht-in").placeholder, close: document.getElementById("cht-x").textContent, qm: document.getElementById("cht-qm").textContent, tb: [document.getElementById("tb-chat").textContent, document.getElementById("tb-ping").textContent] }));
    assert.deepEqual(ui.tabs, ["Team", "All"]); assert.equal(ui.send, "Send"); assert.equal(ui.close, "Close");
    assert.deepEqual(ui.chips, ["Nice", "Thanks", "Need help", "Go A", "Go B", "Fall back", "Enemy spotted", "Plant the spike", "Regroup", "GG"]);
    assert.match(ui.ph, /^To your team/); assert.match(ui.qm, /QUICK CHAT/); assert.deepEqual(ui.tb, ["Chat", "Ping"]);
    assert.ok(!/[가-힣]/.test(JSON.stringify(ui)), "no Korean left in the English interface: " + JSON.stringify(ui));
    await en.click('#cht-qc button[data-q="3"]');
    await en.waitForFunction(() => /Go A/.test(document.getElementById("cht-log").textContent), null, { timeout: 5000 });
    console.log("English: tabs, chips, placeholder, buttons and a phrase in English");

    // ── a phone: the two buttons are in the layout editor and work ──
    const phone = await f.page("chatPhone", { width: 740, height: 360 }, { hasTouch: true, isMobile: true });
    await phone.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; document.body.classList.add("touching"); });
    await phone.waitForTimeout(1200);
    const boxes = await phone.evaluate(() => ["tb-chat", "tb-ping"].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), getComputedStyle(document.getElementById(id)).display]; }));
    for (const [id, l, t, w, h, d] of boxes) { assert.ok(w >= 40 && h >= 40 && l >= 0 && t >= 0 && l + w <= 740 && t + h <= 360 && d !== "none", `${id} sits on the screen: ${[l, t, w, h, d]}`); }
    await shot(phone, "touch-740");
    assert.ok(await phone.evaluate(() => TOUCHLAY.parts.includes("tb-chat") && TOUCHLAY.parts.includes("tb-ping")), "both are parts the layout editor moves");
    await phone.evaluate(() => { togglePause(true); TOUCHLAY.open(); });
    await phone.waitForTimeout(400);
    const edit = await phone.evaluate(() => ["tb-chat", "tb-ping"].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { id, part: e.classList.contains("mbe-part"), w: r.width, shown: getComputedStyle(e).display }; }));
    for (const e of edit) assert.ok(e.part && e.w > 30 && "none" !== e.shown, "in the layout editor: " + JSON.stringify(e));
    // and nothing of the editor (its bar) sits on them: they can be picked up where they start
    const reach = await phone.evaluate(() => ["tb-chat", "tb-ping"].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [id, h === e || e.contains(h)]; }));
    assert.deepEqual(reach, [["tb-chat", true], ["tb-ping", true]], "both buttons are reachable in the layout editor");
    await phone.evaluate(() => { TOUCHLAY.set("tb-chat", [0.5, 0.45, 1.2]); });
    await phone.waitForTimeout(200);
    const moved = await phone.evaluate(() => { const r = document.getElementById("tb-chat").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    assert.ok(Math.abs(moved[0] - 370) < 24 && Math.abs(moved[1] - 162) < 24, "the editor moved the chat button: " + moved);
    await shot(phone, "touch-editor-740");
    await phone.evaluate(() => { TOUCHLAY.reset(); TOUCHLAY.close(false); togglePause(false); });
    await phone.waitForTimeout(500);
    // tap the chat button: the panel opens at the top (the keyboard will not hide it); a chip sends; the text field sends
    await phone.tap("#tb-chat");
    await phone.waitForSelector("#cht-box:not([hidden])");
    await shot(phone, "touch-box-740");
    const top = await phone.evaluate(() => { const r = document.getElementById("cht-box").getBoundingClientRect(); return [r.top, r.bottom, r.left, r.right]; });
    assert.ok(top[0] >= 0 && top[1] < 200 && top[2] >= 0 && top[3] <= 740, "the panel is at the top of the phone: " + top);
    await phone.tap('#cht-qc button[data-q="0"]');
    await phone.waitForFunction(() => /좋아요/.test(document.getElementById("cht-log").textContent), null, { timeout: 5000 });
    assert.equal(await phone.evaluate(() => CHAT.state.open), false, "a chip sends and closes");
    await phone.tap("#tb-chat");
    await phone.fill("#cht-in", "touch hello");
    await phone.tap("#cht-send");
    await phone.waitForFunction(() => CHAT.hist().some((m) => "touch hello" === m.m), null, { timeout: 5000 });
    // the ping button: a point under the crosshair (aim at the floor)
    await phone.evaluate(() => { const a = myActor(); a.pitch = -0.55; });
    await phone.waitForTimeout(900);
    await phone.tap("#tb-ping");
    await phone.waitForFunction(() => CHAT.pings().length === 1, null, { timeout: 8000 });
    // the M map: a tap on the map pings there
    await phone.waitForFunction(() => CHAT.pings().length === 0, null, { timeout: 8000 });
    await phone.evaluate(() => toggleBigMap(true));
    await phone.waitForTimeout(500);
    const c = await phone.evaluate(() => { const r = document.getElementById("cht-bmp").getBoundingClientRect(); return [r.left + r.width * 0.4, r.top + r.height * 0.4, r.width]; });
    assert.ok(c[2] > 100, "the map layer covers the map");
    await shot(phone, "touch-map-740");
    await phone.touchscreen.tap(c[0], c[1]);
    await phone.waitForFunction(() => CHAT.pings().length === 1, null, { timeout: 8000 });
    assert.equal(await phone.evaluate(() => document.querySelectorAll("#cht-bmp i").length), 1, "a mark on the map");
    assert.equal(await phone.evaluate(() => document.getElementById("bigmap").hidden), false, "tapping the map does not close it");
    await shot(phone, "touch-map-ping-740");
    // the owner's switch hides the buttons
    await serverChat(false);
    await setCfg(phone, false);
    assert.equal(await phone.evaluate(() => ["tb-chat", "tb-ping"].map((id) => getComputedStyle(document.getElementById(id)).display)).then((d) => d.join()), "none,none", "buttons gone with the switch");
    console.log("phone: the buttons are in the layout editor, the panel, chips, text field, ping button and the map tap work");

    assert.deepEqual(f.errors.slice(base), []);
    console.log("chat browser checks passed");
  } finally { await f.browser.close(); signaling.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
