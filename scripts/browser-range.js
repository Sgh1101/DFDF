const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The target range: from the practice menu, the open field with nobody else on it; targets
// pop up, strafe, fly and flash; a shot that crosses one scores (a head double, a run
// multiplies); only while the minute runs; the best score is kept per gun; never reported;
// the room's mode goes back on leaving.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("ranger", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; });
    // the way in: a button in the practice menu
    assert.equal(await page.evaluate(() => !!document.querySelector(".home-practice #go-targets") || !!document.getElementById("go-targets")), true, "a button in the practice menu");
    await page.evaluate(() => { render = () => {}; room.mode = "dm"; document.getElementById("go-targets").click(); });
    await page.waitForTimeout(900);
    const r = await page.evaluate(async () => {
      const R = TARGET_RANGE.RANGE, me = myActor(), out = { mode: room.mode, map: CUR_MAP_KEY, actors: world.actors.length, practice: window.GAME_PRACTICE };
      for (let i = 0; i < 5; i++) step(1 / 60);
      out.warm = RANGE_COUNT = R.targets.length;
      out.phase = world.phase;
      // the warm-up (buy phase): shots do not score
      const hitAt = (q, head) => {
        const sc = (q.kind === "gold" ? 0.7 : 1) * 1.3;
        const y = head ? q.py + 1.62 * sc : q.py + 0.85 * sc;
        const o = new T.Vector3(q.px, q.py + 1.4, q.pz + 2.5);
        const d = new T.Vector3(0, y - o.y, -2.5).normalize();
        return [o, d];
      };
      const target = (kind) => { const q = R.targets.find((x) => x.kind === kind && x.hit < 0) ; return q; };
      let q = R.targets.find((x) => x.hit < 0 && x.px != null);
      let [o, d] = hitAt(q, !1);
      const w = WEAPONS[curWeaponKey()] || WEAPONS.rifle;
      hitscan(o, d, w, "rifle");
      out.warmScore = R.score;
      // the minute
      world.phase = "live"; for (let i = 0; i < 5; i++) step(1 / 60);
      for (let i = 0; i < 30; i++) step(0.05);
      out.live = R.live;
      // a body shot, then a head shot, then a miss
      const live = () => R.targets.filter((x) => x.hit < 0 && x.px != null && (R.t - x.born) > 0.4 && (R.t - x.born) < x.life - 0.3 && x.kind !== "drone");
      const shoot = (qq, head) => { world.stats.shots++; const [o2, d2] = hitAt(qq, head); hitscan(o2, d2, w, "rifle"); step(0.016); };
      q = live()[0]; shoot(q, !1);
      out.body = { score: R.score, kind: q.kind, pts: TARGET_RANGE.KINDS[q.kind].pts, hit: q.hit >= 0 };
      const s1 = R.score;
      q = live()[0]; shoot(q, !0);
      const k = TARGET_RANGE.KINDS[q.kind];
      out.head = { gained: R.score - s1, pts: Math.round(k.pts * k.head * TARGET_RANGE.mult(R.streak)), heads: R.heads };
      // a miss shot (a fired shot that hits nothing): the run drops on the next step
      const st = R.streak;
      world.stats.shots++; step(0.016); 
      out.run = { before: st, after: R.streak };
      // a run: five hits, the multiplier rises
      R.streak = 0;
      for (let n = 0; n < 60 && R.streak < 5; n++) { const qq = live()[0]; if (!qq) { TARGET_RANGE.add(me, "pop"); for (let i = 0; i < 6; i++) step(0.1); continue; } shoot(qq, !1); }
      out.mult = TARGET_RANGE.mult(), out.streak = R.streak;
      // a wall between: no score (shoot from behind the ground)
      // the clock runs out
      const sc = R.score;
      world.roundTime = 0.05;
      for (let i = 0; i < 10; i++) step(0.05);
      await new Promise((r2) => setTimeout(r2, 3200));
      out.end = { phase: world.phase, head: document.getElementById("ov-head").textContent, kills: document.getElementById("ov-k").textContent, label: document.querySelector("#ov-k").parentElement.querySelector(".lbl").textContent, scoreKept: sc, best: localStorage.getItem("lgp_range:" + (actorWeaponKey(me) || "gun")) };
      return out;
    });
    console.log(JSON.stringify(r));
    assert.equal(r.mode, "range"); assert.equal(r.map, "field"); assert.equal(r.actors, 1, "nobody else on the field"); assert.equal(r.practice, true, "never reported");
    assert.ok(r.warm >= 3, "targets to warm up on: " + r.warm);
    assert.equal(r.warmScore, 0, "no score before the minute");
    assert.ok(r.live);
    assert.ok(r.body.hit && r.body.score >= r.body.pts, "a body shot scores: " + JSON.stringify(r.body));
    assert.equal(r.head.gained, r.head.pts, "a head counts double: " + JSON.stringify(r.head)); assert.equal(r.head.heads, 1);
    assert.equal(r.run.after, 0, "a miss drops the run");
    assert.ok(r.mult >= 1.5 && r.streak >= 5, "five in a row raise the multiplier: " + r.mult);
    assert.match(r.end.head, /^\d+점$/); assert.equal(r.end.label, "명중"); assert.ok(+r.end.best > 0, "the best is kept");
    // leaving for the menu puts the room's mode back
    await page.evaluate(() => document.getElementById("ov-menu").click());
    await page.waitForFunction(() => room.mode !== "range", null, { timeout: 5000 });
    assert.notEqual(await page.evaluate(() => room.mode), "range");
    assert.equal(await page.evaluate(() => document.querySelector("#ov-k").parentElement.querySelector(".lbl").textContent), "명중", "(the result labels stay as the range left them until a match ends)");
    assert.deepEqual(f.errors, []);
    console.log("target range: the way in, nobody else on the field, warm-up, score by body and head, runs, a miss, the best kept, the mode back");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
