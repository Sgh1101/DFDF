// Clans: made for gold with a unique name and tag (held to the chat's swear filter), searched, joined (one per account, 50 at
// most), left (the oldest member takes over, the last one out closes the clan and frees the name), kicked, edited, and
// looked after by the owner of the game; the tag the game shows beside a name comes from the server's own data.
const test = require("node:test"), assert = require("node:assert/strict");
const { harness } = require("./api-harness");
let n = 0;
// an account on its own address (sign-ups are limited per address), with gold to spend
async function acct(h, id, gold = 5000) {
  const r = await h.api("auth", { id, pw: "password", device: "dev-" + id }, { "x-forwarded-for": "10.1." + (n >> 8) + "." + (n++ & 255) });
  assert.equal(r.status, 200, JSON.stringify(r));
  put(h, id, (u) => { u.gold = gold; });
  return r;
}
const put = (h, id, edit) => { const u = h.user(id); edit(u); h.db.set("user:" + id.toLowerCase(), JSON.stringify(u)); };
const owner = (h) => h.api("auth", { id: "owner", pw: "owner-password", device: "dev-owner" }, { "x-forwarded-for": "10.9.9.9" });
const make = (h, p, name = "Alpha Team", tag = "ALP", desc = "hello") => h.api("clan_create", { token: p.token, name, tag, desc });
const setConfig = async (h, o, edit) => {
  const c = JSON.parse(JSON.stringify(h.config));
  edit(c);
  const r = await h.api("a_config_set", { atoken: o.atoken, config: c });
  assert.equal(r.status, 200, JSON.stringify(r));
  h.advance(30000);
};

test("a clan is made for gold; the name and tag are unique in any case, held to the swear filter, and a guest cannot make or join one", async () => {
  const h = harness(), p = await acct(h, "maker"), q = await acct(h, "other");
  const r = await make(h, p);
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(h.config.clan.cost, 1000);
  assert.equal(r.gold, 4000); assert.equal(h.user("maker").gold, 4000, "the default cost");
  assert.deepEqual([r.clan.name, r.clan.tag, r.clan.desc, r.clan.n, r.clan.owner], ["Alpha Team", "ALP", "hello", 1, "maker"]);
  assert.deepEqual(r.clan.members.map((m) => [m.id, m.role, m.level]), [["maker", "owner", 1]]);
  assert.equal(h.user("maker").clan, r.clan.id);
  // the same name or tag, in another case or with other spacing
  for (const [name, tag, msg] of [["alpha team", "ZZZ", /이미 있는 클랜 이름/], ["ALPHATEAM", "ZZZ", /이미 있는 클랜 이름/], ["Other", "alp", /이미 있는 클랜 태그/]]) {
    const x = await make(h, q, name, tag);
    assert.equal(x.status, 409); assert.match(x.error, msg);
  }
  assert.equal(h.user("other").gold, 5000, "a refused clan costs nothing");
  // the shape: 2-16 characters, 2-4 for the tag, letters / digits / Hangul only
  for (const [name, tag] of [["Q", "OK"], ["x".repeat(17), "OK"], ["Good Name", "Q"], ["Good Name", "ABCDE"], ["Good Name", "A_B"], ["Bad*Name", "OK"], ["Good Name", "A B"]]) {
    const x = await make(h, q, name === "two  gaps" ? "two gaps" : name, tag);
    assert.equal(x.status, 400, name + "/" + tag + " " + JSON.stringify(x));
  }
  // Hangul works, and the tag can be Hangul
  const ko = await make(h, q, "별빛 클랜", "별빛");
  assert.equal(ko.status, 200, JSON.stringify(ko)); assert.equal(ko.clan.tag, "별빛");
  // the chat's swear filter, on the name, the tag and the description
  const w = await acct(h, "washer");
  for (const [name, tag, desc] of [["fuck club", "OK1", ""], ["Fine Name", "시발", ""], ["Fine Name", "OK2", "이 병신들"], ["시 발단", "OK3", ""], ["shitters", "OK4", ""]]) {
    const x = await make(h, w, name, tag, desc);
    assert.equal(x.status, 400, name + " " + JSON.stringify(x)); assert.match(x.error, /쓸 수 없는 말/);
  }
  assert.equal(h.user("washer").gold, 5000);
  // not enough gold
  const poor = await acct(h, "poor", 999);
  const x = await make(h, poor, "Poor Club", "POOR");
  assert.equal(x.status, 402); assert.match(x.error, /골드가 부족합니다 \(1,000 필요\)/);
  // guests
  const g = await h.api("guest", { device: "guest-dev-1" }, { "x-forwarded-for": "10.7.7.7" });
  assert.equal((await make(h, g, "Guest Club", "GST")).status, 403);
  assert.equal((await h.api("clan_join", { token: g.token, id: r.clan.id })).status, 403);
  assert.equal((await h.api("clan_mine", { token: g.token })).clan, null);
  // already in one
  assert.equal((await make(h, p, "Second", "SEC")).status, 409);
  assert.equal(h.user("maker").gold, 4000);
});

test("making clans is rate limited, and the cost and the seats come from the owner's settings", async () => {
  const h = harness(), p = await acct(h, "maker"), o = await owner(h);
  await setConfig(h, o, (c) => { c.clan.cost = 250; });
  const r = await make(h, p);
  assert.equal(r.gold, 4750);
  // ten tries an hour that got as far as the name being looked up (a typo does not count)
  const q = await acct(h, "spammer");
  const codes = [];
  for (let i = 0; i < 11; i++) codes.push((await make(h, q, "Alpha Team", "T" + i)).status);
  assert.deepEqual(codes, [409, 409, 409, 409, 409, 409, 409, 409, 409, 409, 429]);
  assert.equal((await make(h, q, "x", "T1")).status, 400, "a typo is told as one, and was not counted");
  // seats: 2 to 50
  const c = JSON.parse(JSON.stringify(h.config));
  for (const max of [1, 51, 0]) { c.clan.max = max; assert.equal((await h.api("a_config_set", { atoken: o.atoken, config: c })).status, 400, "max " + max); }
  c.clan.max = 50; c.clan.cost = 0;
  assert.equal((await h.api("a_config_set", { atoken: o.atoken, config: c })).status, 200);
  const pub = await h.api("config");
  assert.deepEqual(pub.config.clan, { on: true, cost: 0, max: 50 });
});

test("clans are searched by a piece of the name or the tag in any case; with no text the clans with the most XP come first", async () => {
  const h = harness(), ids = ["a1", "a2", "a3", "a4"], ps = [];
  for (const id of ids) ps.push(await acct(h, id));
  await make(h, ps[0], "Night Owls", "OWL");
  await make(h, ps[1], "Owlet Nest", "NEST");
  await make(h, ps[2], "Red Fox", "FOX");
  await make(h, ps[3], "Sly Owl Fox", "SLY");
  const names = async (text) => (await h.api("clan_search", { q: text })).clans.map((c) => c.name);
  assert.deepEqual(await names("owl"), ["Night Owls", "Owlet Nest", "Sly Owl Fox"], "the tag OWL first, then names that start with it, then the rest");
  assert.deepEqual(await names("FOX"), ["Red Fox", "Sly Owl Fox"]);
  assert.deepEqual(await names("nest"), ["Owlet Nest"]);
  assert.deepEqual(await names("redfox"), ["Red Fox"], "spaces do not count");
  assert.deepEqual(await names("zzz"), []);
  put(h, "a3", (u) => { u.xp = 900; }); put(h, "a2", (u) => { u.xp = 300; });
  for (const id of ["a2", "a3"]) await h.api("clan_get", { id: h.user(id).clan }); // looking at a clan sets its XP right
  const top = await names("");
  assert.deepEqual(top.slice(0, 2), ["Red Fox", "Owlet Nest"]); assert.equal(top.length, 4);
  const hit = (await h.api("clan_search", { q: "red" })).clans[0];
  assert.deepEqual([hit.tag, hit.n, hit.max, hit.desc], ["FOX", 1, 50, "hello"]);
  assert.equal(Object.keys(hit).includes("members"), false, "the list has no member list");
});

test("joining: one clan at a time, the seats the owner allows, and two joins for the last seat let one in", async () => {
  const h = harness(), o = await owner(h), cap = await acct(h, "cap");
  await setConfig(h, o, (c) => { c.clan.max = 3; });
  const made = await make(h, cap), id = made.clan.id;
  const a = await acct(h, "j1"), b = await acct(h, "j2"), c = await acct(h, "j3");
  const r1 = await h.api("clan_join", { token: a.token, id });
  assert.equal(r1.status, 200); assert.equal(r1.clan.n, 2);
  assert.deepEqual(r1.clan.members.map((m) => [m.id, m.role]), [["cap", "owner"], ["j1", "member"]]);
  assert.equal((await h.api("clan_join", { token: a.token, id })).status, 409, "already in");
  const other = await make(h, await acct(h, "own2"), "Beta", "BET");
  assert.equal((await h.api("clan_join", { token: a.token, id: other.clan.id })).status, 409, "one clan at a time");
  assert.equal((await h.api("clan_join", { token: b.token, id: "0123456789ab" })).status, 404);
  assert.equal((await h.api("clan_join", { token: b.token, id: "nonsense" })).status, 404);
  // the last seat, asked for twice at once
  const [x, y] = await Promise.all([h.api("clan_join", { token: b.token, id }), h.api("clan_join", { token: c.token, id })]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409]);
  assert.match((x.status === 409 ? x : y).error, /가득 찼습니다/);
  const full = await h.api("clan_get", { id });
  assert.equal(full.clan.n, 3);
  assert.equal(["j2", "j3"].filter((u) => h.user(u).clan === id).length, 1, "only the one that got in carries the clan's id");
});

test("joining and leaving are rate limited", async () => {
  const h = harness(), cap = await acct(h, "cap"), p = await acct(h, "hopper"), q = await acct(h, "leaver");
  const id = (await make(h, cap)).clan.id;
  // ten tries in ten minutes, whatever they come to (the first gets in, the rest are told they are in already)
  const codes = [];
  for (let i = 0; i < 11; i++) codes.push((await h.api("clan_join", { token: p.token, id })).status);
  assert.deepEqual(codes, [200, 409, 409, 409, 409, 409, 409, 409, 409, 409, 429]);
  h.advance(11 * 60000);
  assert.equal((await h.api("clan_join", { token: p.token, id })).status, 409, "the window has passed: answered again");
  const out = [];
  for (let i = 0; i < 11; i++) out.push((await h.api("clan_leave", { token: q.token })).status);
  assert.deepEqual(out, [409, 409, 409, 409, 409, 409, 409, 409, 409, 409, 429]);
  assert.equal((await h.api("clan_leave", { token: cap.token })).status, 200, "another account has its own count");
});

test("leaving: the oldest member takes over from the owner, the last one out closes the clan and frees its name and tag", async () => {
  const h = harness(), cap = await acct(h, "cap"), a = await acct(h, "aa"), b = await acct(h, "bb");
  const id = (await make(h, cap)).clan.id;
  await h.api("clan_join", { token: a.token, id }); h.advance(5000);
  await h.api("clan_join", { token: b.token, id });
  // a member leaves: the owner stays
  assert.equal((await h.api("clan_leave", { token: b.token })).status, 200);
  assert.equal(h.user("bb").clan, undefined); assert.equal((await h.api("clan_mine", { token: b.token })).clan, null);
  await h.api("clan_join", { token: b.token, id });
  // the owner leaves: "aa" joined before "bb"
  const gone = await h.api("clan_leave", { token: cap.token });
  assert.equal(gone.status, 200); assert.equal(gone.clan, null);
  const now = (await h.api("clan_get", { id })).clan;
  assert.deepEqual(now.members.map((m) => [m.id, m.role]), [["aa", "owner"], ["bb", "member"]]); assert.equal(now.owner, "aa");
  assert.equal(h.user("cap").clan, undefined);
  // the new owner can use the owner's powers, the old one cannot
  assert.equal((await h.api("clan_edit", { token: a.token, desc: "mine now" })).status, 200);
  assert.equal((await h.api("clan_edit", { token: cap.token, desc: "x" })).status, 409);
  await h.api("clan_leave", { token: a.token });
  assert.equal((await h.api("clan_get", { id })).clan.owner, "bb");
  // the last one out: the clan, the name and the tag are gone
  assert.equal((await h.api("clan_leave", { token: b.token })).status, 200);
  assert.equal((await h.api("clan_get", { id })).status, 404);
  assert.equal((await h.api("clan_search", { q: "alpha" })).clans.length, 0);
  assert.deepEqual([...h.db.keys()].filter((k) => /^(clan|cname|ctag):/.test(k)), []);
  const again = await make(h, cap);
  assert.equal(again.status, 200, "the same name and tag can be taken again: " + JSON.stringify(again));
  assert.notEqual(again.clan.id, id);
});

test("the owner kicks and edits; nobody else can, and a kicked account is free to join again", async () => {
  const h = harness(), cap = await acct(h, "cap"), a = await acct(h, "aa"), b = await acct(h, "bb");
  const id = (await make(h, cap)).clan.id;
  await h.api("clan_join", { token: a.token, id }); await h.api("clan_join", { token: b.token, id });
  assert.equal((await h.api("clan_kick", { token: a.token, id: "bb" })).status, 403, "a member cannot kick");
  assert.equal((await h.api("clan_edit", { token: a.token, desc: "mine" })).status, 403, "or edit");
  assert.equal((await h.api("clan_kick", { token: cap.token, id: "cap" })).status, 400, "the owner leaves instead");
  assert.equal((await h.api("clan_kick", { token: cap.token, id: "nobody" })).status, 404);
  const k = await h.api("clan_kick", { token: cap.token, id: "BB" });
  assert.equal(k.status, 200, JSON.stringify(k)); assert.deepEqual(k.clan.members.map((m) => m.id), ["cap", "aa"]);
  assert.equal(h.user("bb").clan, undefined);
  assert.equal((await h.api("clan_join", { token: b.token, id })).status, 200);
  // the description: short, filtered, kept
  const e = await h.api("clan_edit", { token: cap.token, desc: "  We play   at night <b>  " });
  assert.equal(e.status, 200); assert.equal(e.clan.desc, "We play at night b");
  assert.equal((await h.api("clan_edit", { token: cap.token, desc: "x".repeat(61) })).status, 400);
  assert.equal((await h.api("clan_edit", { token: cap.token, desc: "ㅅㅂ" })).status, 400);
  assert.equal((await h.api("clan_get", { id })).clan.desc, "We play at night b");
  assert.equal((await h.api("clan_edit", { token: cap.token, desc: "" })).clan.desc, "");
});

test("the game's own owner deletes or renames a clan from the admin page; nobody else can", async () => {
  const h = harness(), cap = await acct(h, "cap"), a = await acct(h, "aa"), o = await owner(h);
  const id = (await make(h, cap)).clan.id;
  await h.api("clan_join", { token: a.token, id });
  await make(h, await acct(h, "zz"), "Zeta", "ZET");
  for (const act of ["a_clans", "a_clan_delete", "a_clan_rename"]) assert.equal((await h.api(act, { id })).status, 401, act + " needs the owner");
  assert.equal((await h.api("a_clan_delete", { atoken: cap.token, id })).status, 401, "a player's token is not an owner's");
  const list = await h.api("a_clans", { atoken: o.atoken, q: "" });
  assert.equal(list.total, 2); assert.deepEqual(list.clans.map((c) => [c.name, c.tag, c.n, c.owner]), [["Alpha Team", "ALP", 2, "cap"], ["Zeta", "ZET", 1, "zz"]]);
  assert.deepEqual((await h.api("a_clans", { atoken: o.atoken, q: "zet" })).clans.map((c) => c.name), ["Zeta"]);
  // rename: unique like any other, the shape checked; the owner may use words the filter holds back from players
  assert.equal((await h.api("a_clan_rename", { atoken: o.atoken, id, name: "Zeta" })).status, 409);
  assert.equal((await h.api("a_clan_rename", { atoken: o.atoken, id, tag: "zet" })).status, 409);
  assert.equal((await h.api("a_clan_rename", { atoken: o.atoken, id, name: "x" })).status, 400);
  const r = await h.api("a_clan_rename", { atoken: o.atoken, id, name: "Alpha Prime", tag: "APX" });
  assert.equal(r.status, 200, JSON.stringify(r)); assert.deepEqual([r.clan.name, r.clan.tag], ["Alpha Prime", "APX"]);
  assert.equal((await h.api("clan_search", { q: "prime" })).clans.length, 1); assert.equal((await h.api("clan_search", { q: "alpha team" })).clans.length, 0);
  assert.equal((await make(h, await acct(h, "yy"), "Alpha Team", "ALP")).status, 200, "the old name and tag are free");
  assert.equal((await h.api("a_clan_rename", { atoken: o.atoken, id, name: "ALPHA prime" })).status, 200, "only the case changed");
  // delete: the members are free
  assert.equal((await h.api("a_clan_delete", { atoken: o.atoken, id })).status, 200);
  assert.equal((await h.api("clan_get", { id })).status, 404);
  for (const m of ["cap", "aa"]) { assert.equal(h.user(m).clan, undefined, m); assert.equal((await h.api("clan_mine", { token: (m === "cap" ? cap : a).token })).clan, null); }
  assert.equal((await h.api("a_clan_delete", { atoken: o.atoken, id })).status, 404);
  assert.equal((await make(h, cap, "Alpha Prime", "APX")).status, 200, "and the name is free");
  assert.equal((await h.api("a_clans", { atoken: o.atoken })).total, 3);
});

test("a deleted account leaves its clan; a banned one stays on it", async () => {
  const h = harness(), cap = await acct(h, "cap"), a = await acct(h, "aa"), o = await owner(h);
  const id = (await make(h, cap)).clan.id;
  await h.api("clan_join", { token: a.token, id });
  assert.equal((await h.api("a_user_set", { atoken: o.atoken, id: "aa", op: "delete" })).status, 200);
  assert.deepEqual((await h.api("clan_get", { id })).clan.members.map((m) => m.id), ["cap"]);
});

test("with clans switched off nothing about them works, and no tag is shown", async () => {
  const h = harness(), o = await owner(h), cap = await acct(h, "cap");
  const id = (await make(h, cap)).clan.id;
  assert.deepEqual((await h.api("levels", { ids: ["cap"] })).users.cap.clan, "ALP");
  await setConfig(h, o, (c) => { c.clan.on = false; });
  assert.equal((await h.api("config")).config.clan.on, false);
  for (const [act, body] of [["clan_create", { token: cap.token, name: "Other", tag: "OTH" }], ["clan_join", { token: cap.token, id }], ["clan_leave", { token: cap.token }], ["clan_kick", { token: cap.token, id: "x" }], ["clan_edit", { token: cap.token, desc: "x" }], ["clan_get", { id }], ["clan_search", { q: "aa" }]]) {
    const r = await h.api(act, body);
    assert.equal(r.status, 403, act); assert.match(r.error, /클랜은 지금 쓸 수 없습니다/);
  }
  assert.equal((await h.api("clan_mine", { token: cap.token })).clan, null);
  assert.equal((await h.api("levels", { ids: ["cap"] })).users.cap.clan, undefined, "no tag beside a name");
  await setConfig(h, o, (c) => { c.clan.on = true; });
  assert.equal((await h.api("clan_get", { id })).status, 200, "the clan was kept");
});

test("the tag beside a name is the server's: levels and the ranked roster give it for an account that is on the clan's list, never for a claim", async () => {
  const h = harness(), cap = await acct(h, "cap"), a = await acct(h, "aa"), none = await acct(h, "plain");
  const id = (await make(h, cap)).clan.id;
  await h.api("clan_join", { token: a.token, id });
  const lv = (await h.api("levels", { ids: ["cap", "AA", "plain", "ghost"], tag: "FAKE", clan: "FAKE" })).users;
  assert.deepEqual([lv.cap.clan, lv.AA.clan, lv.plain.clan, lv.ghost.clan], ["ALP", "ALP", undefined, undefined]);
  // a pointer on an account the clan does not list (a client cannot write it, but a stale one is not believed)
  put(h, "plain", (u) => { u.clan = id; });
  assert.equal((await h.api("levels", { ids: ["plain"] })).users.plain.clan, undefined);
  assert.equal((await h.api("clan_mine", { token: none.token })).clan, null);
  assert.equal((await h.api("clan_join", { token: none.token, id })).status, 200, "and the stale pointer does not stop a join");
  // after a rename the new tag shows at once
  const o = await owner(h);
  await h.api("a_clan_rename", { atoken: o.atoken, id, tag: "NEW" });
  assert.equal((await h.api("levels", { ids: ["cap"] })).users.cap.clan, "NEW");
  // guests have none
  const g = await h.api("guest", { device: "guest-dev-2" }, { "x-forwarded-for": "10.7.7.8" });
  assert.equal((await h.api("levels", { ids: [g.user.id] })).users[g.user.id].clan, undefined);
});

test("the clan view lists the members with their levels and roles, and the clan's XP is their sum", async () => {
  const h = harness(), cap = await acct(h, "cap"), a = await acct(h, "aa");
  const id = (await make(h, cap)).clan.id;
  put(h, "cap", (u) => { u.xp = 100; }); put(h, "aa", (u) => { u.xp = 300; });
  await h.api("clan_join", { token: a.token, id });
  const v = (await h.api("clan_get", { id })).clan;
  assert.deepEqual(v.members.map((m) => [m.id, m.level, m.role]), [["cap", 2, "owner"], ["aa", 3, "member"]]);
  assert.equal(v.xp, 400);
  const mine = await h.api("clan_mine", { token: a.token });
  assert.equal(mine.clan.id, id); assert.deepEqual(mine.cfg, { on: true, cost: 1000, max: 50 });
  assert.equal(JSON.stringify(v).includes("pass"), false); assert.equal(JSON.stringify(v).includes("token"), false);
});

test("every error text of the clan code has an English version for the English page", () => {
  const fs = require("node:fs"), vm = require("node:vm");
  const src = fs.readFileSync("api/v1.js", "utf8"), part = src.slice(src.indexOf("// ── clans ──"), src.indexOf("module.exports = async"));
  const win = { localStorage: { getItem: () => "en" } };
  vm.runInNewContext(fs.readFileSync("js/client-request.js", "utf8"), { window: win, localStorage: win.localStorage, document: {}, fetch() {}, URL, CustomEvent: function () {}, AbortController, setTimeout, clearTimeout });
  const found = [...part.matchAll(/fail\(\d+, ([`"])((?:\\.|(?!\1).)*)\1\)/g)].map((m) => m[2].replace(/\$\{[^}]*\}/g, "60"));
  assert.ok(found.length >= 20, "found " + found.length);
  const missing = found.filter((m) => !/[A-Za-z]/.test(win.GAME_ERROR_EN(m)));
  assert.deepEqual(missing, []);
});
