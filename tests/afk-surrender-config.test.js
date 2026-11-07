const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { harness } = require("./api-harness");

// Ranked play was removed on 2026-11-07 (and with it leaving penalties, ranked tickets and results): what is left of the
// rank settings is what a game still runs on, AFK and surrender (and the numbers an older client still reads).
const ownerLogin = (h) => h.api("auth", { id: "owner", pw: "owner-password", device: "device-123" });

test("config: the AFK and surrender settings have defaults, the game gets them, the owner page labels them", async () => {
  const h = harness(), R = h.config.rank;
  assert.deepEqual({ leaveGraceS: R.leaveGraceS, afkWarnS: R.afkWarnS, afkLeaveS: R.afkLeaveS, surrenderRound: R.surrenderRound, surrenderS: R.surrenderS, surrenderVoteS: R.surrenderVoteS, surrenderCoolS: R.surrenderCoolS },
    { leaveGraceS: 60, afkWarnS: 90, afkLeaveS: 30, surrenderRound: 5, surrenderS: 240, surrenderVoteS: 15, surrenderCoolS: 60 });
  const c = await h.api("config");
  assert.equal(c.status, 200);
  assert.deepEqual(c.config.rank, { minHumans: 3, leaveGraceS: 60, afkWarnS: 90, afkLeaveS: 30, surrenderRound: 5, surrenderS: 240, surrenderVoteS: 15, surrenderCoolS: 60 });
  assert.equal("win" in R || "loss" in R || "leaveRR" in R || "maxPerDay" in R, false, "no rank points: ranked play is gone");
  assert.equal("season" in h.config || "aiComp" in h.config || "aiComp" in c.config, false, "no seasons and no AI rating");
  const admin = fs.readFileSync("admin.html", "utf8");
  for (const key of ["leaveGraceS", "afkWarnS", "afkLeaveS", "surrenderRound", "surrenderS", "surrenderVoteS", "surrenderCoolS"]) assert.ok(admin.includes(`"rank.${key}"`), "admin.html labels rank." + key);
  // a value the owner changes is the one used
  const o = await ownerLogin(h), cur = (await h.api("a_config_get", { atoken: o.atoken })).config;
  cur.rank.afkWarnS = 0;
  assert.equal((await h.api("a_config_set", { atoken: o.atoken, config: cur })).status, 200);
  const c2 = await h.api("config");
  assert.equal(c2.config.rank.afkWarnS, 0);
  assert.equal(c2.config.rank.leaveGraceS, 60, "the rest keep their defaults");
});
