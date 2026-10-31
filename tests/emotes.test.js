const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const EM = require("../js/emotes");
const { harness } = require("./api-harness");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-123" });
const fresh = () => { globalThis.SETTINGS = { binds: {} }; globalThis.saveSettings = () => {}; delete require.cache[require.resolve("../js/keymap.js")]; return require("../js/keymap.js"); };

// The emotes: the six keyframe animations (js/emotes.js), the host's rate limit, the key, the owner's switch and the touch button.
test("six emotes, with Korean and English names, and a valid index is a whole number in range", () => {
  assert.equal(EM.LIST.length, 6);
  assert.deepEqual(EM.IDS, ["wave", "cheer", "salute", "dance", "laugh", "sit"]);
  for (const e of EM.LIST) { assert.match(e.ko, /^[가-힣 ]+$/, e.id + " has a Korean name"); assert.match(e.en, /^[A-Za-z ]+$/, e.id + " has an English name"); assert.ok(e.dur > 1 && e.dur <= 12); }
  assert.equal(new Set(EM.LIST.map((e) => e.ko)).size, 6); assert.equal(new Set(EM.LIST.map((e) => e.en)).size, 6);
  for (const v of [0, 5]) assert.equal(EM.valid(v), true);
  for (const v of [-1, 6, 1.5, "1", null, undefined, NaN, {}, [0]]) assert.equal(EM.valid(v), false, String(v));
  assert.equal(EM.name(3), "춤"); assert.equal(EM.name(3, true), "Dance"); assert.equal(EM.name(9), "");
});

test("every pose is finite and within what a joint can do, at any time of the emote, and only the known parts are named", () => {
  const parts = new Set(["hips", "chest", "neck", "armL", "foreL", "armR", "foreR", "legL", "shinL", "legR", "shinR", "hy"]);
  EM.LIST.forEach((e, i) => {
    for (let t = 0; t <= e.dur; t += 1 / 30) {
      const p = EM.pose(i, t);
      assert.ok(p, e.id + " has a pose at " + t);
      for (const [k, v] of Object.entries(p)) {
        assert.ok(parts.has(k), e.id + ": unknown part " + k);
        if (k === "hy") { assert.ok(Number.isFinite(v) && v > 0.05 && v < 1.3, e.id + " hips height " + v); continue; }
        assert.ok(Array.isArray(v) && v.length === 3 && v.every((a) => Number.isFinite(a) && Math.abs(a) <= 3.2), e.id + " " + k + " " + v);
      }
    }
    assert.equal(EM.pose(i, -0.01), null); assert.equal(EM.pose(i, e.dur + 0.01), null);
  });
  assert.equal(EM.pose(9, 1), null);
});

test("the pose eases in and out: nothing before or after, full in the middle, no jump at either end", () => {
  EM.LIST.forEach((e, i) => {
    assert.equal(EM.weight(i, -1), 0); assert.equal(EM.weight(i, e.dur + 1), 0);
    assert.equal(EM.weight(i, 0), 0); assert.equal(EM.weight(i, e.dur), 0);
    assert.equal(EM.weight(i, e.dur / 2), 1);
    let prev = 0;
    for (let t = 0; t <= e.dur; t += 1 / 60) { const w = EM.weight(i, t); assert.ok(w >= 0 && w <= 1); assert.ok(Math.abs(w - prev) < 0.1, e.id + " no jump at " + t); prev = w; }
  });
  assert.equal(EM.weight(99, 1), 0);
});

test("the emotes differ: no two poses are the same a moment in", () => {
  const key = (i) => JSON.stringify(EM.pose(i, 1.1), (k, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v));
  assert.equal(new Set(EM.LIST.map((e, i) => key(i))).size, 6);
});

test("the host's rate limit: two starts at once, then one every two seconds, for each player on its own", () => {
  const b = new Map();
  assert.equal(EM.take(b, "a", 0), true); assert.equal(EM.take(b, "a", 10), true);
  assert.equal(EM.take(b, "a", 20), false, "the third at once is dropped");
  assert.equal(EM.take(b, "b", 20), true, "another player has its own bucket");
  assert.equal(EM.take(b, "a", 1000), false, "half the refill time is not enough");
  assert.equal(EM.take(b, "a", 2100), true, "one more after two seconds");
  assert.equal(EM.take(b, "a", 2150), false);
  for (let i = 0; i < 20; i++) EM.take(b, "a", 60000);
  assert.equal(EM.take(b, "a", 60000), false, "never more than the cap, however long it waited");
  assert.equal(EM.take(b, "a", 60000 + 4000) && EM.take(b, "a", 60000 + 4001), true, "a long wait gives the two");
  assert.equal(EM.take(b, "a", 60000 + 4002), false);
});

test("the key: T by default, shown with the others, rebindable, and a key serves one action", () => {
  const K = fresh(), a = K.ACTIONS.find((x) => x.id === "emote");
  assert.ok(a, "an emote action"); assert.equal(a.group, "other"); assert.deepEqual(K.codes("emote"), ["KeyT"]);
  assert.equal(a.ko, "이모트"); assert.equal(a.en, "Emote"); assert.equal(K.name("emote"), "T");
  for (const other of K.ACTIONS) if (other.id !== "emote") assert.ok(!K.codes(other.id).includes("KeyT"), other.id + " does not use T");
  assert.ok(K.is({ code: "KeyT", key: "ㅅ" }, "emote"), "T by its place, whatever the input method types");
  assert.deepEqual(K.bind("emote", "KeyJ"), { ok: true, swapped: null }); assert.deepEqual(K.codes("emote"), ["KeyJ"]);
  assert.ok(!K.is({ code: "KeyT" }, "emote")); assert.ok(K.is({ code: "KeyJ" }, "emote"));
  assert.equal(globalThis.SETTINGS.binds.emote.join(), "KeyJ");
  // the key of another action: it is taken, and the emote action is left with the old key (a swap)
  const r = K.bind("ping", "KeyJ"); assert.deepEqual(r, { ok: true, swapped: "emote" }); assert.deepEqual(K.codes("emote"), ["KeyV"]);
  K.reset(); assert.deepEqual(K.codes("emote"), ["KeyT"]);
  // an action that is not on the key list is no key flag: a press of T moves nothing the game reads
  const keys = {}; assert.deepEqual(K.apply(keys, { code: "KeyT" }, true), ["emote"]); assert.deepEqual(keys, {});
});

test("game.emotes is on by default, the owner can switch it off, a value that is not a boolean keeps the default, and the game reads it from the public settings", async () => {
  const h = harness(), owner = await login(h, "owner");
  assert.equal((await h.api("config", {})).config.game.emotes, true, "on for everyone by default");
  assert.equal((await h.api("a_config_get", { atoken: owner.atoken })).defaults.game.emotes, true);
  const set = (v) => { const c = JSON.parse(JSON.stringify(h.config)); c.game.emotes = v; return h.api("a_config_set", { atoken: owner.atoken, config: c }); };
  const off = await set(false);
  assert.equal(off.status, 200); assert.equal(off.config.game.emotes, false);
  assert.equal((await h.api("config", {})).config.game.emotes, false, "the public settings carry it");
  assert.equal((await set("no")).config.game.emotes, true, "a string is not a switch: the default stays");
  const old = JSON.parse(JSON.stringify(h.config)); delete old.game.emotes;
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: old })).config.game.emotes, true, "settings saved before the key existed read as on");
});

test("a saved touch layout keeps the emote button, and still drops a name it does not know", async () => {
  const h = harness(), p = await login(h);
  const touch = { "tb-emote": [0.3, 0.4, 1.2], "tb-chat": [0.2, 0.3, 1.1], "tb-fire": [0.8, 0.5, 1], "tb-bogus": [0.5, 0.5, 1] };
  const r = await h.api("prefs", { token: p.token, set: { touch }, t: 1000 });
  assert.deepEqual(Object.keys(r.prefs.touch).sort(), ["tb-chat", "tb-emote", "tb-fire"]);
  assert.deepEqual(h.user("player").prefs.touch["tb-emote"], [0.3, 0.4, 1.2]);
});

test("the owner's page names the setting, the layout editor moves the button, and the files are loaded by the game in order", () => {
  const admin = fs.readFileSync("admin.html", "utf8");
  assert.match(admin, /"game\.emotes":\s*\["이모트"/, "an owner-page label for game.emotes");
  assert.match(fs.readFileSync("js/legacy/66-touch-layout.js", "utf8"), /\["tb-emote"/, "tb-emote is a part the layout editor moves");
  const manifest = JSON.parse(fs.readFileSync("js/legacy/manifest.json", "utf8")), play = fs.readFileSync("play.html", "utf8");
  const files = manifest.filter((f) => /\/123b?-/.test(f));
  assert.equal(files.length, 2, "the ragdoll and the emote files");
  for (const f of files) assert.ok(play.includes('<script src="./' + f), f + " is loaded by play.html");
  assert.ok(manifest.indexOf(files[0]) > manifest.findIndex((f) => /115-chat/.test(f)), "after the chat, whose way of sending it uses");
  for (const f of ["js/emotes.js", "js/ragdoll-verlet.js"]) {
    const at = play.indexOf('<script src="./' + f); assert.ok(at > 0, f + " is loaded by play.html");
    assert.ok(at < play.indexOf('<script src="./js/legacy/02-graphics-setup.js'), f + " comes before the legacy files that read it");
  }
});
