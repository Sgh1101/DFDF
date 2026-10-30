const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { harness } = require("./api-harness");
const login = (h, id = "player") => h.api("auth", { id, pw: id === "owner" ? "owner-password" : "password", device: "device-123" });

// the chat: the owner's switch (game.chat), the two touch buttons the server keeps in a saved layout, the files that carry it
test("game.chat is on by default, the owner can switch it off, a value that is not a boolean keeps the default, and the game reads it from the public settings", async () => {
  const h = harness(), owner = await login(h, "owner");
  assert.equal((await h.api("config", {})).config.game.chat, true, "on for everyone by default");
  assert.equal((await h.api("a_config_get", { atoken: owner.atoken })).defaults.game.chat, true);
  const set = (chat) => { const c = JSON.parse(JSON.stringify(h.config)); c.game.chat = chat; return h.api("a_config_set", { atoken: owner.atoken, config: c }); };
  const off = await set(false);
  assert.equal(off.status, 200); assert.equal(off.config.game.chat, false);
  assert.equal((await h.api("config", {})).config.game.chat, false, "the public settings carry it");
  assert.equal((await set("no")).config.game.chat, true, "a string is not a switch: the default stays");
  const old = JSON.parse(JSON.stringify(h.config)); delete old.game.chat;
  assert.equal((await h.api("a_config_set", { atoken: owner.atoken, config: old })).config.game.chat, true, "settings saved before the key existed read as on");
});

test("a saved touch layout keeps the chat and ping buttons, and still drops a name it does not know", async () => {
  const h = harness(), p = await login(h);
  const touch = { "tb-chat": [0.2, 0.3, 1.1], "tb-ping": [0.25, 0.3, 0.9], "tb-fire": [0.8, 0.5, 1], "tb-bogus": [0.5, 0.5, 1] };
  const r = await h.api("prefs", { token: p.token, set: { touch }, t: 1000 });
  assert.deepEqual(Object.keys(r.prefs.touch).sort(), ["tb-chat", "tb-fire", "tb-ping"]);
  assert.deepEqual(r.prefs.touch["tb-chat"], [0.2, 0.3, 1.1]);
  assert.deepEqual(h.user("player").prefs.touch["tb-ping"], [0.25, 0.3, 0.9]);
});

test("the owner's page names the setting, and the chat file is loaded by the game after the host's throttles", () => {
  const admin = fs.readFileSync("admin.html", "utf8");
  assert.match(admin, /"game\.chat":\s*\["채팅과 핑"/, "an owner-page label for game.chat");
  const manifest = JSON.parse(fs.readFileSync("js/legacy/manifest.json", "utf8")), play = fs.readFileSync("play.html", "utf8");
  const file = "js/legacy/115-chat-quick-chat-and-pings.js", at = manifest.indexOf(file);
  assert.ok(at > manifest.findIndex((f) => /112-the-host-throttles/.test(f)), "after the throttles, whose wrapper of NET.onAction it sits on top of");
  assert.ok(play.indexOf('<script src="./' + file) > play.indexOf('<script src="./js/legacy/112-the-host-throttles'), "play.html loads it too");
  const parts = fs.readFileSync("js/legacy/66-touch-layout.js", "utf8");
  for (const id of ["tb-chat", "tb-ping"]) assert.ok(parts.includes('["' + id + '"'), id + " is a part the layout editor moves");
});
