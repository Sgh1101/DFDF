const test = require("node:test"), assert = require("node:assert/strict");
const rules = require("../js/game-rules");
test("network input rejects malformed movement, angles and sequence", () => {
  const valid = { seq: 1, mv: [1, -1], yaw: 3, pitch: 0.2, btn: 1, sl: 0 };
  assert.equal(rules.validInput(valid), true);
  for (const input of [{ ...valid, mv: null }, { ...valid, yaw: NaN }, { ...valid, pitch: Infinity }, { ...valid, seq: -1 }, { ...valid, seq: 1.5 }, { ...valid, mv: [50, 0] }]) assert.equal(rules.validInput(input), false);
});
test("host enforces cooldown, charges, silence and ultimate charge", () => {
  const actor = { alive: true, ultCharge: 5, ultMax: 5 };
  assert.equal(rules.abilityReady(actor, { def: {}, cd: 0, charges: 1 }, "live"), true);
  for (const ability of [{ def: {}, cd: 30, charges: 1 }, { def: {}, cd: 0, charges: 0 }]) assert.equal(rules.abilityReady(actor, ability, "live"), false);
  assert.equal(rules.abilityReady({ ...actor, silenced: 1 }, { def: {}, charges: 1 }, "live"), false);
  assert.equal(rules.abilityReady(actor, { def: {}, charges: 1 }, "over"), false);
  assert.equal(rules.abilityReady({ ...actor, ultCharge: 4 }, { def: { ult: 5 } }, "live"), false);
});
test("finishers are restricted to a standard last-enemy weapon kill", () => {
  const event = { mode: "std", last: true, kind: "gun", killer: 1, victim: 2, skin: "dragon" };
  assert.equal(rules.finisher(event), true);
  for (const value of [{ ...event, mode: "tdm" }, { ...event, mode: "dm" }, { ...event, last: false }, { ...event, kind: "ability" }, { ...event, kind: "grenade" }, { ...event, kind: "environment" }, { ...event, kind: undefined }, { ...event, victim: 1 }, { ...event, skin: "default" }]) assert.equal(rules.finisher(value), false);
});
test("draw and deathmatch outcomes use data independent of UI text", () => {
  assert.equal(rules.outcome("tdm", [10, 10]), "draw");
  assert.equal(rules.outcome("std", [13, 7]), "win");
  assert.equal(rules.outcome("dm", [39, 40], 2), "loss");
});

test("the eight-second presentation is reserved for Champions last-enemy finishers", () => {
  const event = { mode: "std", last: true, kind: "gun", killer: 1, victim: 2 };
  for (const skin of ["champion", "champions_atk", "champions_def"]) assert.equal(rules.championsFinisher({ ...event, skin }), true);
  for (const patch of [{ skin: "dragon" }, { skin: "champions_atk", mode: "tdm" }, { skin: "champions_atk", last: false }, { skin: "champions_atk", kind: "ability" }, { skin: "champions_def", finisher: false }]) assert.equal(rules.championsFinisher({ ...event, ...patch }), false);
});
