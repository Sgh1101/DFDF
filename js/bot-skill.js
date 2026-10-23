(function (root) {
  "use strict";
  // How hard the bots are, as ONE number: skill, a multiple of the old "normal" bot. 1.00 is exactly the old normal.
  //  · a ranked room reads the average tier of its human players: Iron 0.60 ... Radiant 1.20 (nine steps)
  //  · any other room reads their average account level: Lv1 0.60 ... Lv50+ 1.00 (never above the old normal)
  // Below 1.00 every number is the old normal's scaled by the skill (what a bot can do x skill, what it gets wrong
  // / skill), so 0.60 is a bot with 60% of normal's reach, turn speed, damage and headshots and 1/0.6 of its aim error.
  // Above 1.00 the numbers walk in a straight line from normal to the old hard preset, which sits at SKILL_MAX (1.20).
  // Nothing goes past hard (turn 9, error 0.26, spread 0.072: the ceiling of what the game ever had), so a Radiant
  // bot is the old hard bot and never an aimbot; skill above 1.20 is clamped.
  // Pure functions only, so node tests can load this file; the game wraps diffTune() around tune() once per round.
  const SKILL_MIN = 0.6, // Lv1 and Iron
    SKILL_NORMAL = 1, // the old normal; Lv50+
    SKILL_MAX = 1.2; // the old hard; Radiant
  const TIERS = 9; // iron, bronze, silver, gold, platinum, diamond, ascendant, immortal, radiant (api/v1.js RANKS)
  // account level -> skill, straight lines between these points, flat past the last
  const LEVEL_POINTS = [
    [1, 0.6],
    [5, 0.65],
    [10, 0.72],
    [20, 0.82],
    [30, 0.9],
    [40, 0.96],
    [50, 1],
  ];
  // a room with nobody to read (all guests): a little under the old normal
  const DEFAULT_SKILL = 0.8;
  // a bot's numbers where lower means harder: they are divided by the skill below normal, not multiplied
  const INVERSE = { err: 1, spread: 1 };
  // the old presets as they play now (module 31 folded in); the game hands in its live DIFF_TUNE, and the browser test
  // checks these still match it
  const NORMAL = { turn: 6, tol: 0.13, range: 80, dmg: 1, budget: 4200, hs: 0.08, err: 0.42, spread: 0.09 };
  const HARD = { turn: 9, tol: 0.17, range: 120, dmg: 1.35, budget: 6500, hs: 0.18, err: 0.26, spread: 0.072 };
  // what the plain presets mean once the rooms pick their own skill: easy and hard are fixed, normal is the
  // automatic one (it follows the humans in the room)
  const PRESET = { easy: SKILL_MIN, hard: SKILL_MAX };

  const num = (n) => (typeof n === "number" && Number.isFinite(n) ? n : NaN);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const r4 = (n) => Math.round(n * 1e4) / 1e4;
  const clampSkill = (s) => (Number.isFinite(+s) ? clamp(+s, SKILL_MIN, SKILL_MAX) : DEFAULT_SKILL);
  // ranked: tier index 0..8 (a fraction is fine, it is an average) -> 0.60 .. 1.20
  function tierSkill(tier) {
    const t = clamp(num(tier), 0, TIERS - 1);
    return Number.isNaN(t) ? DEFAULT_SKILL : r4(SKILL_MIN + ((SKILL_MAX - SKILL_MIN) * t) / (TIERS - 1));
  }
  // anything else: account level -> 0.60 .. 1.00
  function levelSkill(level) {
    const l = num(level);
    if (Number.isNaN(l)) return DEFAULT_SKILL;
    const p = LEVEL_POINTS;
    if (l <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++)
      if (l <= p[i][0]) return r4(p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * (l - p[i - 1][0])) / (p[i][0] - p[i - 1][0]));
    return p[p.length - 1][1];
  }
  const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : NaN);
  // the room's skill from its human players: [{ level, tier }, ...] (a guest has neither and is left out)
  function roomSkill(humans, ranked) {
    const key = ranked ? "tier" : "level";
    const known = (humans || []).map((h) => num(h && h[key])).filter((n) => !Number.isNaN(n) && (ranked ? n >= 0 : n >= 1));
    if (!known.length) return DEFAULT_SKILL;
    return ranked ? tierSkill(mean(known)) : levelSkill(mean(known));
  }
  // the bot numbers at a skill: 1 returns normal exactly, 1.2 returns hard exactly, 0.6 is 60% of normal
  function tune(skill, normal, hard) {
    const n = normal || NORMAL,
      h = hard || HARD,
      s = clampSkill(skill),
      up = Math.max(0, (s - SKILL_NORMAL) / (SKILL_MAX - SKILL_NORMAL)), // 0 at normal, 1 at hard
      out = {};
    for (const k in h) {
      if ("number" != typeof h[k] || "number" != typeof n[k]) continue;
      out[k] = r4(s >= SKILL_NORMAL ? n[k] * (1 - up) + h[k] * up : INVERSE[k] ? n[k] / s : n[k] * s);
    }
    // whole numbers stay whole: the gold a bot spends
    out.budget = Math.round(out.budget);
    return out;
  }
  const api = { SKILL_MIN, SKILL_NORMAL, SKILL_MAX, TIERS, LEVEL_POINTS, DEFAULT_SKILL, INVERSE, NORMAL, HARD, PRESET, clampSkill, tierSkill, levelSkill, roomSkill, tune };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BOT_SKILL = api;
})(typeof window === "object" ? window : globalThis);
