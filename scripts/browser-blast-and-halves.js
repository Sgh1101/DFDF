const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 1) The RPG and grenades burst at the radius they define (ARMS.ROCKET.r, ARMS.NADE.r). The ability area multiplier
//    (window.AB_R, js/legacy/22) is for abilities only: an ability blast still comes out AB_R times wider.
// 2) The sides change after a half has been played, not one round early. With 13 to win the first half is 12 rounds
//    ("12:12 is sudden death"), so the swap comes between round 12 and round 13. halfTime() is the number of rounds in
//    a half; each round mode (std, swift, rush) scales it with its win count.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("rulesfix", { width: 1280, height: 720 }, {}, { bootTimeout: 180000 });
    const r = await page.evaluate(() => {
      room.mode = "std"; room.diff = "hard"; startGame(AGENTS[0], false); ADMIN.freezeAI = true; world.phase = "live";
      const a = myActor(), foes = world.actors.filter((o) => o.team !== a.team);
      // foes stand at the given distances from wherever the blast goes off; returns the distances that were hurt
      function blast(dists, fire) {
        const prevExp = explode, prevHurt = hurtFighter, hurt = new Set();
        let went = false;
        hurtFighter = function (t) { hurt.add(t); return prevHurt.apply(this, arguments); };
        explode = function (x, z) {
          went = true;
          dists.forEach((d, i) => { const o = foes[i]; o.alive = true; o.hp = 100; o.armor = 0; o.shielded = 0; o.invuln = 0; o.pos.set(x + d, 0, z); });
          return prevExp.apply(this, arguments);
        };
        try {
          for (const o of foes) o.alive = false; // out of the way of the flight
          world.phase = "live"; fire();
          for (let i = 0; i < 400 && !went; i++) abilTick(.02);
        } finally { explode = prevExp; hurtFighter = prevHurt; }
        return { went, hurt: dists.filter((d, i) => hurt.has(foes[i])) };
      }
      const R = ARMS.ROCKET.r, N = ARMS.NADE.r, ab = 9;
      a.weapons.primary = "rpg"; a.slot = "primary"; a.nades = 2;
      return {
        AB_R: window.AB_R, R, N, ab,
        rocket: blast([0.8 * R, 1.2 * R, 1.6 * R], () => ARMS.hostLaunch("rocket", a)),
        nade: blast([0.8 * N, 1.2 * N, 1.6 * N], () => ARMS.hostLaunch("nade", a)),
        // an ability blast (the engine's own grenade ability uses explode with r = 9)
        ability: blast([0.8 * ab, 1.2 * ab, 1.6 * ab, 2 * ab], () => explode(a.pos.x + 20, a.pos.z, ab, 65, 25, 0xffa726)),
      };
    });
    assert.ok(r.AB_R > 1.2, "the ability multiplier is on: " + r.AB_R);
    assert.ok(r.rocket.went && r.nade.went && r.ability.went);
    assert.deepEqual(r.rocket.hurt, [0.8 * r.R], "the rocket hurts inside its own radius " + r.R + " only: " + JSON.stringify(r.rocket.hurt));
    assert.deepEqual(r.nade.hurt, [0.8 * r.N], "the grenade hurts inside its own radius " + r.N + " only: " + JSON.stringify(r.nade.hurt));
    assert.deepEqual(r.ability.hurt, [0.8 * r.ab, 1.2 * r.ab, 1.6 * r.ab], "an ability keeps the wider area: " + JSON.stringify(r.ability.hurt));
    // the 3.6 s between rounds is not what is under test
    await page.evaluate(() => { const st = window.setTimeout; window.__st = st; window.setTimeout = (fn, ms, ...r) => st(fn, ms >= 3000 && ms < 20000 ? 0 : ms, ...r); });
    for (const [mode, rounds] of [["std", 13], ["swift", 13], ["rush", 13]]) {
      const r = await page.evaluate(async ([mode, rounds]) => {
        room.mode = mode; room.rounds = rounds; room.diff = "hard"; startGame(AGENTS[0], false); ADMIN.freezeAI = true;
        const out = [], win = winRounds(), half = halfTime();
        // the two sides take turns winning, so nobody gets to the win count before the swap
        for (let i = 0; i < 2 * win && world.phase !== "over"; i++) {
          world.phase = "live"; world.over = false;
          const played = world.round, before = player.team, sa = world.scoreAtk, sd = world.scoreDef, side = i % 2 ? "atk" : "def";
          endRound(side, "probe");
          await new Promise((res) => __st(res, 30));
          out.push({ played, next: world.round, swapped: player.team !== before, side, sa, sd, atk: world.scoreAtk, def: world.scoreDef, over: world.phase === "over" });
        }
        try { gameOver(); netShutdown(); world.phase = "menu"; } catch (e) {}
        return { mode, rounds, win, half, out };
      }, [mode, rounds]);
      const swaps = r.out.filter((o) => o.swapped);
      assert.equal(swaps.length, 1, `${r.mode}/${r.rounds}: one swap, got ${JSON.stringify(swaps)}`);
      const s = swaps[0];
      assert.equal(s.played, r.half, `${r.mode}/${r.rounds}: the swap follows round ${r.half}, the last round of the half (it came after round ${s.played})`);
      assert.equal(s.next, r.half + 1, `${r.mode}/${r.rounds}: the first round of the second half is round ${r.half + 1}`);
      // the score goes to the side it was won on: the two counters swap with the teams
      assert.deepEqual([s.atk, s.def], [s.sd + ("def" === s.side ? 1 : 0), s.sa + ("atk" === s.side ? 1 : 0)], `${r.mode}/${r.rounds}: the score swaps with the teams`);
      console.log(r.mode, r.rounds, "win", r.win, "half", r.half, "swap after round", s.played);
    }
    assert.deepEqual(f.errors, []);
    console.log("weapon blasts keep their own radius; the sides swap after the last round of a half");
  } catch (e) { console.error("page errors", f.errors); throw e; } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
