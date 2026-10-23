const test = require("node:test"), assert = require("node:assert/strict");
const B = require("../js/bot-skill");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " != " + b);
const TIERS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const increasing = (list) => list.every((n, i) => i === 0 || n >= list[i - 1]);

test("ranked tiers map straight onto 0.60 .. 1.20, Iron to Radiant", () => {
  const skills = TIERS.map(B.tierSkill);
  near(skills[0], 0.6);
  near(skills[8], 1.2);
  assert.ok(increasing(skills) && new Set(skills).size === 9, "strictly higher every tier");
  skills.forEach((s, i) => near(s, 0.6 + 0.075 * i));
  near(skills[4], 0.9);
  // an average of tiers lands between them; out of range and junk stay inside the bounds
  near(B.tierSkill(3.5), 0.6 + 0.075 * 3.5);
  assert.equal(B.tierSkill(-4), 0.6);
  assert.equal(B.tierSkill(40), 1.2);
  assert.equal(B.tierSkill(NaN), B.DEFAULT_SKILL);
});

test("account level maps to 0.60 at Lv1 up to 1.00 at Lv50+, rising and never above normal", () => {
  const skills = Array.from({ length: 120 }, (_, i) => B.levelSkill(i + 1));
  assert.equal(skills[0], 0.6);
  assert.equal(B.levelSkill(50), 1);
  assert.equal(B.levelSkill(500), 1);
  assert.ok(increasing(skills), "monotonic");
  assert.ok(skills.every((s) => s >= 0.6 && s <= 1));
  assert.ok(B.levelSkill(49) < 1 && B.levelSkill(25) > B.levelSkill(24), "still climbing before Lv50");
  assert.equal(B.levelSkill(0), 0.6);
  assert.equal(B.levelSkill(NaN), B.DEFAULT_SKILL);
});

test("skill 1.0 is exactly the old normal, 0.6 is 60% of it and 1.2 is the old hard", () => {
  assert.deepEqual(B.tune(1), B.NORMAL);
  assert.deepEqual(B.tune(1.2), B.HARD);
  const floor = B.tune(0.6);
  for (const k in B.NORMAL) {
    const want = B.INVERSE[k] ? B.NORMAL[k] / 0.6 : B.NORMAL[k] * 0.6;
    assert.ok(Math.abs(floor[k] - want) < 1e-3 * Math.max(1, want), k + ": " + floor[k] + " vs " + want);
  }
  // the live game hands its own tables in and gets the same thing
  assert.deepEqual(B.tune(1, B.NORMAL, B.HARD), B.NORMAL);
  assert.equal(B.tune(1.2, B.NORMAL, { ...B.HARD, turn: 12 }).turn, 12);
  assert.equal(B.tune(1, { ...B.NORMAL, turn: 5 }, B.HARD).turn, 5);
  // halfway between normal and hard
  near(B.tune(1.1).turn, 7.5);
});

test("every bot number gets harder as skill rises, with no jump at normal", () => {
  const steps = [];
  for (let s = 0.6; s <= 1.2001; s += 0.01) steps.push(B.tune(s));
  for (const k in B.HARD) {
    const seq = steps.map((t) => t[k]);
    for (let i = 1; i < seq.length; i++) {
      const harder = B.INVERSE[k] ? seq[i] <= seq[i - 1] : seq[i] >= seq[i - 1];
      assert.ok(harder, `${k} step ${i}: ${seq[i - 1]} -> ${seq[i]}`);
    }
    assert.ok(seq.every((n) => Number.isFinite(n) && n > 0), k + " stays positive");
    assert.notEqual(seq[0], seq[seq.length - 1], k + " actually moves");
  }
  // never an aimbot: past the ceiling nothing gets better than the old hard
  const top = B.tune(9);
  assert.deepEqual(top, B.HARD);
  for (const k in B.HARD) assert.ok(B.INVERSE[k] ? top[k] >= B.HARD[k] : top[k] <= B.HARD[k]);
  assert.deepEqual(B.tune(-5), B.tune(B.SKILL_MIN));
  assert.equal(B.tune(0.95).budget % 1, 0);
});

test("a room takes its skill from the humans: tiers when ranked, levels otherwise, guests left out", () => {
  near(B.roomSkill([{ tier: 0 }, { tier: 8 }], true), B.tierSkill(4));
  near(B.roomSkill([{ tier: 2 }], true), B.tierSkill(2));
  // levels average first, then map (a Lv1 and a Lv50 are a Lv25.5 room)
  near(B.roomSkill([{ level: 1 }, { level: 50 }], false), B.levelSkill(25.5));
  // a ranked room ignores levels and a plain room ignores tiers
  near(B.roomSkill([{ level: 50, tier: 0 }], true), 0.6);
  near(B.roomSkill([{ level: 1, tier: 8 }], false), 0.6);
  // guests have neither; if nobody is known the room gets the default
  near(B.roomSkill([{ level: 10 }, {}], false), B.levelSkill(10));
  assert.equal(B.roomSkill([{}, null], false), B.DEFAULT_SKILL);
  assert.equal(B.roomSkill([], true), B.DEFAULT_SKILL);
  // a better room is never easier
  assert.ok(B.roomSkill([{ level: 30 }], false) > B.roomSkill([{ level: 3 }], false));
  assert.ok(B.roomSkill([{ tier: 6 }], true) > B.roomSkill([{ tier: 1 }], true));
});

test("the presets keep their meaning", () => {
  assert.equal(B.PRESET.easy, 0.6);
  assert.equal(B.PRESET.hard, 1.2);
  assert.deepEqual(B.tune(B.PRESET.hard), B.HARD);
});
