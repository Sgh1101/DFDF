const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Two abilities name their shooter the old one-player way, "player" as a string: the mine (지뢰 회로, 늪 가스,
// 불씨 지뢰) and the piercing shot (관통 화살, 고드름 화살). Among actors a kill reads the killer's position, so
// such a kill threw: the victim stayed up at no health (a bot's cast swallowed the error; a mine going off in the
// round's step did not). A bot's mine also went off as the player: its blast hit the player's foes, the bot's own
// side among them. Here a bot (the player's foe) lays a mine and shoots a piercing arrow: the kills land and are
// the bot's, the mine's blast spares the bot's side, and nothing throws.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("abilitykillers", { width: 1280, height: 720 });
    const out = await page.evaluate(() => {
      render = () => {};
      titleCam = () => {};
      room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop();
      ADMIN.freezeAI = true; world.phase = "live"; world.roundTime = 999;
      const me = myActor(),
        bot = world.actors.find((a) => a.team !== me.team),
        mate = world.actors.find((a) => a.team === bot.team && a !== bot),
        foes = world.actors.filter((a) => a.team === me.team && a !== me);
      // an open stretch: nothing tall within 1.5 m of a 16 m line running north from (cx, cz)
      const B = MAP.bounds;
      let cx = 0, cz = 0;
      for (let k = 0; k < 400; k++) {
        const x = B.minX + 12 + ((k * 37) % 100) / 100 * (B.maxX - B.minX - 24), z = B.minZ + 24 + ((k * 61) % 100) / 100 * (B.maxZ - B.minZ - 36);
        let open = true;
        for (let s = 0; s <= 16 && open; s += 0.5) open = blockerTopAt(x, z - s, 0, 1.5) < 0.3;
        if (open) { cx = x; cz = z; break; }
      }
      const put = (a, x, z, hp) => {
        a.pos.x = x; a.pos.z = z; a.y = groundAt(x, z, 2);
        Object.assign(a, { alive: true, hp, armor: 0, invuln: 0, shielded: 0, undying: 0, blind: 999 });
      };
      const kills = [];
      addEventListener("kill-confirmed", (e) => kills.push(e.detail));
      const tryIt = (fn) => { try { fn(); return null; } catch (e) { return String((e && e.message) || e); } };
      const reset = () => world.actors.forEach((a, i) => put(a, B.maxX - 6 - 4 * i, B.maxZ - 6, 100)); // everyone else far off

      // the mine, laid by the bot 10 m ahead on a foe; a teammate of the bot stands 3 m off. First the foe has
      // health to spare (the blast goes off), then 30 (the mine kills)
      const mineOn = (victim, hp) => {
        reset();
        put(bot, cx, cz, 100); bot.yaw = 0; bot.pitch = 0;
        put(victim, cx, cz - 10, hp); put(mate, cx + 3, cz - 10, 100);
        const props = world.props.length;
        const castMine = tryIt(() => botCast(bot, "mine", { type: "mine", name: "지뢰" }));
        const laid = world.props.slice(props).find((p) => "trap" === p.type);
        let stepErr = null;
        for (let i = 0; i < 6 && !stepErr; i++) stepErr = tryIt(() => step(0.05));
        return { castMine, laid: !!laid, laidBy: !!laid && laid.by === bot, stepErr, victimAlive: victim.alive, victimHp: victim.hp, mateHp: mate.hp, kill: kills.find((k) => k.victim === victim.id) || null };
      };
      const blast = mineOn(foes[0], 300), mine = mineOn(foes[1], 30);

      // the piercing shot: the bot faces a foe 12 m off with 40 health
      reset();
      put(bot, cx, cz, 100); bot.yaw = 0; bot.pitch = 0;
      const target = foes[2];
      put(target, cx, cz - 12, 40);
      const castPierce = tryIt(() => {
        const e = bot.yaw;
        botCast(bot, "pierce", { type: "pierce", name: "관통" });
        bot.yaw = e;
      });
      const pierce = { castPierce, targetAlive: target.alive, targetHp: target.hp, kill: kills.find((k) => k.victim === target.id) || null };
      return { bot: bot.id, blast, mine, pierce };
    });
    console.log(JSON.stringify(out));
    const { bot, blast, mine, pierce } = out;
    for (const m of [blast, mine]) {
      assert.equal(m.castMine, null, "the bot lays its mine");
      assert.ok(m.laid && m.laidBy, "the mine knows who laid it");
      assert.equal(m.stepErr, null, "the mine going off does not throw");
    }
    assert.ok(blast.victimAlive && blast.victimHp < 300 - 45, "the foe takes the trigger and the blast (health " + blast.victimHp + ")");
    assert.equal(blast.mateHp, 100, "the blast spares the bot's own side");
    assert.equal(mine.victimAlive, false, "the mine's kill lands (health " + mine.victimHp + ")");
    assert.ok(mine.kill && mine.kill.killer === bot, "the mine's kill is the bot's: " + JSON.stringify(mine.kill));
    assert.equal(pierce.castPierce, null);
    assert.equal(pierce.targetAlive, false, "the piercing shot's kill lands (health " + pierce.targetHp + ")");
    assert.ok(pierce.kill && pierce.kill.killer === bot, "the piercing shot's kill is the bot's: " + JSON.stringify(pierce.kill));
    assert.deepEqual(f.errors, []);
    console.log("ability killers: a bot's mine and piercing shot kill, the kills are the bot's, the blast spares its side");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
