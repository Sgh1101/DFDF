const test = require("node:test"), assert = require("node:assert/strict"), cause = require("../js/damage-cause");
test("a delayed shot preserves its skin and weapon after switching and unwinds nested damage", () => {
  const actor = { id: 7, weapon: "rpg", skin: "dragon" };
  const shot = cause.capture(actor, actor.weapon, "gun", 2, actor.skin);
  actor.weapon = "pistol"; actor.skin = "default";
  assert.equal(shot.gun, "rpg"); assert.equal(shot.skin, "dragon");
  cause.run(shot, () => {
    assert.equal(cause.get(), shot);
    assert.throws(() => cause.run({ kind: "ability" }, () => { throw new Error("cast failed"); }));
    assert.equal(cause.get(), shot);
  });
  assert.equal(cause.get(), null);
});
