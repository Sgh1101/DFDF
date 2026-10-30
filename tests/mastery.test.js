const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs");
const { harness } = require("./api-harness");
const rules = require("../js/game-rules.js");
const roster = require("../js/agent-roster.json");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-" + id });
// one match with a valid ticket (a minute of play unless `ms`), reported with the given agent / mode / kills
async function play(h, p, o = {}) {
  const t = await h.api("match_start", { token: p.token });
  assert.equal(t.status, 200);
  h.advance(o.ms || 61000);
  const win = o.win !== false;
  const r = await h.api("progress", { token: p.token, mt: o.noTicket ? "" : t.ticket, win, outcome: win ? "win" : "loss", kills: o.kills || 0, match: { mode: o.mode || "std", agent: o.agent, s: o.s || (win ? [13, 7] : [7, 13]) } });
  return r;
}
async function setConfig(h, owner, edit) {
  const c = JSON.parse(JSON.stringify(h.config));
  edit(c);
  const r = await h.api("a_config_set", { atoken: owner.atoken, config: c });
  assert.equal(r.status, 200, JSON.stringify(r));
  h.advance(30000);
}
const [A, B] = [roster[0], roster[1]];

test("only a match with a valid ticket counts for mastery; no ticket, a short match or a replay gives nothing", async () => {
  const h = harness(), p = await login(h);
  const none = await play(h, p, { agent: A.name, noTicket: true });
  assert.equal(none.status, 409);
  assert.equal(h.user("player").mast, undefined, "no ticket, no mastery");
  h.advance(30000);
  const short = await play(h, p, { agent: A.name, ms: 5000 });
  assert.equal(short.status, 409);
  assert.equal(h.user("player").mast, undefined, "a match too short for a reward");
  h.advance(30000);
  const ok = await play(h, p, { agent: A.name, kills: 2 });
  assert.equal(ok.status, 200);
  // 30 a match + 30 a win + 5 x 2 kills
  assert.deepEqual(h.user("player").mast[A.id], { xp: 70, m: 1, w: 1, k: 2 });
  assert.equal(ok.mastery.id, A.id); assert.equal(ok.mastery.gain, 70);
  // the same report again is the same receipt and counts nothing more
  const t = await h.api("match_start", { token: p.token });
  h.advance(61000);
  const b = { token: p.token, mt: t.ticket, win: true, outcome: "win", kills: 0, match: { mode: "std", agent: A.name, s: [13, 7] } };
  assert.equal((await h.api("progress", b)).status, 200);
  const xp1 = h.user("player").mast[A.id].xp;
  h.advance(30000);
  assert.equal((await h.api("progress", b)).status, 200);
  assert.equal(h.user("player").mast[A.id].xp, xp1, "a replay does not count again");
});

test("the agent is found by its name or its id in any case; an unknown or empty name counts for no agent", async () => {
  const h = harness(), p = await login(h);
  for (const [name, id] of [[A.name, A.id], [B.id.toUpperCase(), B.id], [" " + roster[2].name + " ", roster[2].id], [roster[3].id, roster[3].id]]) {
    const r = await play(h, p, { agent: name, win: false });
    assert.equal(r.status, 200, name);
    assert.equal(h.user("player").mast[id].m, 1, name + " -> " + id);
    h.advance(30000);
  }
  const before = JSON.stringify(h.user("player").mast);
  for (const name of ["", "누구", "constructor", "__proto__", "<b>x</b>", undefined]) {
    const r = await play(h, p, { agent: name });
    assert.equal(r.status, 200, String(name));
    assert.equal(r.mastery, null, String(name));
    h.advance(30000);
  }
  assert.equal(JSON.stringify(h.user("player").mast), before, "unknown names store nothing");
  assert.deepEqual(Object.keys(h.user("player").mast).sort(), [A.id, B.id, roster[2].id, roster[3].id].sort());
});

test("mastery XP: a base, a win bonus and a bonus per kill, with a cap per match", async () => {
  const h = harness(), p = await login(h);
  assert.equal((await play(h, p, { agent: A.id, win: false })).mastery.gain, 30, "a loss: the base only");
  h.advance(30000);
  assert.equal((await play(h, p, { agent: A.id, win: true })).mastery.gain, 60, "a win adds the win bonus");
  h.advance(30000);
  // kills are bounded by the ticket (one more every few seconds), so a long match is needed for many
  const big = await play(h, p, { agent: A.id, win: true, kills: 40, ms: 20 * 60000 });
  assert.equal(big.mastery.gain, 120, "60 + 40 x 5 is cut at the 120 cap");
  assert.deepEqual(h.user("player").mast[A.id].m, 3);
});

test("levels 1-10 grow: level L starts at step x L x (L-1) / 2, shown with progress to the next, and 10 is the top", async () => {
  const h = harness(), p = await login(h);
  const owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.mastery.perMatch = 100; c.mastery.perWin = 0; c.mastery.perKill = 0; c.mastery.maxPerMatch = 1000; });
  const seen = [];
  for (let i = 0; i < 4; i++) { const r = await play(h, p, { agent: A.id }); seen.push(r.mastery.lv); h.advance(30000); }
  // 100 xp -> level 2, 200 -> 2, 300 -> level 3, 400 -> 3
  assert.deepEqual(seen, [2, 2, 3, 3]);
  const me = (await h.api("me", { token: p.token })).user;
  assert.deepEqual(me.mast[A.id], { lv: 3, xp: 400, into: 100, need: 300, m: 4, w: 4, k: 0 });
  // the top level has nothing after it
  const u = h.user("player"); u.mast[A.id].xp = 4499; h.db.set("user:player", JSON.stringify(u));
  assert.equal((await h.api("me", { token: p.token })).user.mast[A.id].lv, 9);
  const top = await play(h, p, { agent: A.id });
  assert.equal(top.mastery.lv, 10);
  const view = top.user.mast[A.id];
  assert.equal(view.lv, 10); assert.equal(view.need, 0);
  h.advance(30000);
  assert.equal((await play(h, p, { agent: A.id })).mastery.lv, 10, "never past 10");
  // the owner's step moves the thresholds
  await setConfig(h, owner, (c) => { c.mastery.step = 50; });
  assert.equal((await h.api("me", { token: p.token })).user.mast[A.id].lv, 10);
  assert.equal(rules.ffaMode("std"), false);
});

test("a level gained pays gold out of the day's gold ceiling, at most maxGold a match; none when it is off", async () => {
  const h = harness(), p = await login(h), owner = await login(h, "owner");
  await setConfig(h, owner, (c) => { c.mastery.perMatch = 100; c.mastery.perWin = 0; c.mastery.perKill = 0; c.mastery.maxPerMatch = 1000; c.mastery.gold = 50; c.mastery.maxGold = 70; c.gold.perWin = 0; c.gold.perLoss = 0; c.gold.perKill = 0; });
  const g0 = h.user("player").gold;
  const first = await play(h, p, { agent: A.id });
  assert.equal(first.mastery.up, 1); assert.equal(first.mastery.gold, 50, "one level, 50 gold");
  assert.equal(h.user("player").gold, g0 + 50);
  assert.equal(first.user.gold, g0 + 50);
  h.advance(30000);
  const second = await play(h, p, { agent: A.id });
  assert.equal(second.mastery.up, 0); assert.equal(second.mastery.gold, 0, "no new level, no gold");
  // two levels in one match are cut at maxGold
  await setConfig(h, owner, (c) => { c.mastery.perMatch = 700; c.mastery.maxPerMatch = 1000; c.mastery.gold = 50; c.mastery.maxGold = 70; c.gold.perWin = 0; c.gold.perLoss = 0; c.gold.perKill = 0; });
  const g1 = h.user("player").gold;
  const jump = await play(h, p, { agent: B.id });
  assert.ok(jump.mastery.up >= 2);
  assert.equal(jump.mastery.gold, 70);
  assert.equal(h.user("player").gold, g1 + 70);
  // it counts against the day's ceiling, which it cannot go past
  await setConfig(h, owner, (c) => { c.mastery.perMatch = 100; c.mastery.maxPerMatch = 1000; c.mastery.gold = 50; c.mastery.maxGold = 1000; c.gold.maxPerDay = 100; c.gold.perWin = 0; c.gold.perLoss = 0; });
  const used = h.user("player").goldDay.n;
  const capped = await play(h, p, { agent: roster[2].id });
  assert.equal(capped.mastery.up, 1);
  assert.equal(capped.mastery.gold, Math.max(0, 100 - used) , "only what is left of the ceiling");
  assert.ok(h.user("player").goldDay.n <= Math.max(used, 100));
  h.advance(30000);
  // off: nothing counted, nothing shown
  const before = JSON.stringify(h.user("player").mast);
  await setConfig(h, owner, (c) => { c.mastery.on = false; });
  const off = await play(h, p, { agent: A.id });
  assert.equal(off.status, 200); assert.equal(off.mastery, null);
  assert.equal(JSON.stringify(h.user("player").mast), before);
  assert.deepEqual((await h.api("me", { token: p.token })).user.mast, {}, "the account shows none while it is off");
  assert.equal((await h.api("levels", { ids: ["player"] })).users.player.mast, undefined);
});

test("the owner's mastery settings are validated and listed with their defaults", async () => {
  const h = harness(), owner = await login(h, "owner");
  const j = await h.api("a_config_get", { atoken: owner.atoken });
  assert.deepEqual(j.defaults.mastery, { on: true, perMatch: 30, perWin: 30, perKill: 5, maxPerMatch: 120, step: 100, gold: 50, maxGold: 200 });
  for (const [k, v] of [["step", 0], ["step", -5], ["perMatch", -1], ["gold", 1e9]]) {
    const c = JSON.parse(JSON.stringify(h.config)); c.mastery[k] = v;
    assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: c })).status, 400, k + "=" + v);
  }
  // an old stored config from before mastery gets the defaults
  const old = JSON.parse(JSON.stringify(h.config)); delete old.mastery;
  h.db.set("config", JSON.stringify(old)); h.advance(30000);
  assert.equal((await h.api("a_config_get", { atoken: owner.atoken })).config.mastery.step, 100);
  // admin.html names every setting in Korean
  const html = fs.readFileSync("admin.html", "utf8");
  for (const k of Object.keys(j.defaults.mastery)) assert.ok(html.includes("mastery." + k), "label for mastery." + k);
});

test("levels: other players' mastery levels are the server's, per agent played, left out for none, guests and unknown names", async () => {
  const h = harness(), p = await login(h), q = await login(h, "bobby");
  await play(h, p, { agent: A.name, kills: 1 }); h.advance(30000);
  await play(h, p, { agent: B.id });
  const g = await h.api("guest", { device: "guest-device-mast" });
  const r = await h.api("levels", { ids: ["player", "bobby", "NoSuchOne", g.user.id] });
  assert.deepEqual(r.users.player.mast, { [A.id]: 1, [B.id]: 1 });
  assert.equal(r.users.bobby.mast, undefined, "nothing played, nothing sent");
  assert.equal(r.users.NoSuchOne.mast, undefined); assert.equal(r.users[g.user.id].mast, undefined);
  assert.ok(JSON.stringify(r.users.player).length < 200, "small");
  // a level shows once it is reached
  const u = h.user("player"); u.mast[A.id].xp = 1000; h.db.set("user:player", JSON.stringify(u));
  assert.equal((await h.api("levels", { ids: ["player"] })).users.player.mast[A.id], 5);
  // XP, wins and kills stay private
  assert.ok(!/xp|"w"|"k"|"m"/.test(JSON.stringify((await h.api("levels", { ids: ["player"] })).users.player.mast)));
});

test("a guest earns mastery the way it earns XP (on its own record), and is not told apart by levels", async () => {
  const h = harness(), g = await h.api("guest", { device: "guest-device-m1" });
  const t = await h.api("match_start", { token: g.token });
  assert.equal(t.status, 200);
  h.advance(61000);
  const r = await h.api("progress", { token: g.token, mt: t.ticket, win: true, outcome: "win", kills: 1, match: { mode: "std", agent: A.name, s: [13, 1] } });
  assert.equal(r.status, 200);
  assert.ok(r.gain > 0, "a guest gets XP");
  assert.equal(r.mastery.id, A.id);
  assert.equal(r.user.mast[A.id].xp, 65);
  assert.equal((await h.api("levels", { ids: [g.user.id] })).users[g.user.id].mast, undefined);
});

test("free-for-all modes: the winner is not a draw when the kills are level, and the win pays; the server decides the modes, not the client", async () => {
  const h = harness(), p = await login(h);
  const modes = ["dm", "knife", "gun", "zone"];
  for (const mode of modes) {
    const g0 = h.user("player").gold, w0 = h.user("player").wins || 0;
    // the client's s is [my kills, the top kills]: the same number for the one on top
    const r = await play(h, p, { mode, s: [9, 9], win: true, agent: A.id });
    assert.equal(r.status, 200, mode);
    assert.equal(h.user("player").wins, w0 + 1, mode + " counts as a win");
    assert.equal(h.user("player").hist[0].win, true, mode);
    assert.ok(h.user("player").gold - g0 >= h.config.gold.perWin, mode + " pays the win gold");
    h.advance(30000);
  }
  // a team mode still draws on equal scores; so does a client that lies about the mode
  const d = await play(h, p, { mode: "tdm", s: [50, 50], win: true });
  assert.equal(h.user("player").hist[0].win, false, "tdm: equal score is a draw");
  h.advance(30000);
  const lie = await play(h, p, { mode: "std", s: [5, 5], win: true });
  assert.equal(h.user("player").hist[0].win, false);
  void d; void lie;
});

test("GAME_RULES.outcome: every ffa mode is decided by the placing; the server's list is the 05-game-modes ffa modes", () => {
  for (const m of ["dm", "knife", "gun", "zone", "range"]) {
    assert.equal(rules.outcome(m, [20, 20], 1), "win", m);
    assert.equal(rules.outcome(m, [39, 40], 2), "loss", m);
  }
  assert.equal(rules.outcome("tdm", [10, 10], 1), "draw");
  assert.equal(rules.outcome("std", [13, 7], 3), "win");
  const src = fs.readFileSync("js/legacy/05-game-modes.js", "utf8").split("const ORDER")[0];
  const ffa = [...src.matchAll(/^\s{4}(\w+): \{[^\n]*\bffa: !0/gm)].map((x) => x[1]).sort();
  assert.deepEqual([...rules.FFA_MODES].sort(), ffa, "the list has the modes the game marks ffa");
});

test("the homepage and the room list name every mode of the game in both languages, and the homepage reads the server's free-for-all list", () => {
  const src = fs.readFileSync("js/legacy/05-game-modes.js", "utf8").split("const ORDER")[0];
  const keys = [...src.matchAll(/^\s{4}(\w+): \{ name:/gm)].map((x) => x[1]).sort();
  assert.ok(keys.length >= 12, "found the modes: " + keys);
  const keysOf = (s) => [...s.matchAll(/(\w+): "/g)].map((x) => x[1]).sort();
  const html = fs.readFileSync("index.html", "utf8");
  const tables = [...html.matchAll(/modes: \{([^}]*)\}/g)].map((x) => keysOf(x[1]));
  assert.equal(tables.length, 2, "a Korean and an English table");
  for (const t of tables) assert.deepEqual(t, keys);
  const list = fs.readFileSync("js/legacy/48-multiplayer-home.js", "utf8").match(/const MODE_EN = \{([^}]*)\}/);
  assert.deepEqual(keysOf(list[1]), keys, "the English room list");
  const ffa = html.match(/const FFA = (\[[^\]]*\])/);
  assert.deepEqual(JSON.parse(ffa[1]).sort(), [...rules.FFA_MODES].sort(), "the homepage's free-for-all list is the server's");
});
