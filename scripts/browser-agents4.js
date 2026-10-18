const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The two newest agents. 가면: copies the last ability an enemy cast nearby (and a guest's
// screen plays the copy), wears the other side's face on that side's screens (bots leave it
// alone beyond 5 m, the first shot hits harder, a shot or a hit ends it), trades guns, trades
// health. 심판: a yellow card that makes each shot cost health, a timeout under which nobody
// is hurt, an offside line that halves the damage of whoever crosses it, a red card back to
// the spawn. On the select screen with their own portraits.
(async () => {
  let signaling = null;
  const f = await fixture();
  try {
    const page = await f.page("agents4", { width: 1280, height: 800 });
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS.find((a) => "gamyeon" === a.id), false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      render = () => {};
      const out = {}, me = myActor(), def = (t) => AGENTS.flatMap((a) => a.abilities).find((d) => d.type === t);
      const foes = world.actors.filter((a) => a.team !== me.team), foe = foes[0], foe2 = foes[1];
      const live = () => { world.phase = "live"; world.smokes && (world.smokes.length = 0); for (const a of world.actors) { a.alive = true; a.invuln = 0; a.silenced = 0; } };
      const cast = (t) => { CAST_REFUND = false; castAbility(t, def(t)); const ref = CAST_REFUND; CAST_REFUND = false; return ref; };
      // somebody straight ahead, in the open
      const put = (a, dist) => {
        live();
        for (const d of [dist, dist * 0.75, dist * 0.5])
          for (let k = 0; k < 24; k++) {
            const x = me.pos.x - Math.sin(me.yaw) * d, z = me.pos.z - Math.cos(me.yaw) * d;
            if (!rayBlocked(me.pos.x, me.y + 1.5, me.pos.z, x, me.y + 1.2, z) && !collideXZ(x, z, 0, 0.5)) { a.pos.x = x; a.pos.z = z; a.y = me.y; return d; }
            me.yaw += Math.PI / 12;
          }
        return 0;
      };
      // everyone else far off (frozen bots still shoot what they see)
      const away = (a) => { a.pos.x = me.pos.x + 60 + 3 * (a.id | 0); a.pos.z = me.pos.z + 60; };
      for (const a of world.actors) a !== me && away(a);
      me.pitch = 0;

      // ── 흉내 ──
      out.mimicNone = cast("y_mimic");
      put(foe, 10);
      const rally = def("x_rally_cry");
      botCast(foe, "x_rally_cry", rally, { x: me.pos.x, z: me.pos.z });
      out.recorded = AGENTS4.lastFoeCast(me) && AGENTS4.lastFoeCast(me).type;
      step(1 / 60); step(0.25);
      out.label = document.querySelector("#skills .sk:first-child .sk-nm").textContent;
      me.armor = 0;
      out.mimicRefund = cast("y_mimic");
      out.mimicArmor = me.armor;
      out.mimicLast = AGENTS4.last[AGENTS4.last.length - 1].by === me && AGENTS4.last[AGENTS4.last.length - 1].type;
      // a guest's screen gets the copied cast under the mask's name and plays it
      const n0 = AGENTS4.last.length;
      me.armor = 0;
      replayCast({ a: me.id, ty: "x_rally_cry", x: Q.pos(me.pos.x), y: Q.pos(me.y), z: Q.pos(me.pos.z), yw: Q.ang(me.yaw), pt: 0 });
      out.replayed = { ran: AGENTS4.last.length === n0 + 1, armor: me.armor, listBack: me.agent.abilities.length };

      // ── 변장 ──
      put(foe, 10);
      cast("y_disguise");
      out.disg = { t: me.__disgT, botFar: aiPickTarget(foe) === me };
      foe.pos.x = me.pos.x - Math.sin(me.yaw) * 3; foe.pos.z = me.pos.z - Math.cos(me.yaw) * 3;
      out.disg.botNear = aiPickTarget(foe) === me;
      foe.hp = 100; foe.armor = 0;
      dealDamage(foe, 20, false, me);
      out.disg.ambush = Math.round(100 - foe.hp);
      out.disg.after = me.__disgT;
      foe.hp = 100;
      step(1 / 60);
      dealDamage(foe, 20, false, me);
      out.disg.plain = Math.round(100 - foe.hp);
      // an enemy in disguise, seen from here: one of us
      put(foe, 10);
      const realGroup = foe.group;
      botCast(foe, "y_disguise", def("y_disguise"), { x: me.pos.x, z: me.pos.z });
      syncActorModel(foe);
      const G = TEAM_GLOW;
      out.costume = { on: !!foe.__costume, swapped: foe.group !== realGroup, realHidden: !realGroup.visible, look: foe.__costume && foe.__costume.ag, ally: !!(foe.model._teamMeshes && foe.model._teamMeshes.length && foe.model._teamMeshes.every((o) => o.material !== G.ENEMY)) };
      // its shot gives it away
      foe._shotT = (world._clock || 0) + 1e3;
      step(1 / 60);
      out.costume.offOnShot = !foe.__costume && foe.group === realGroup && realGroup.visible && !(foe.__disgT > 0);
      // and the timer runs out
      botCast(foe, "y_disguise", def("y_disguise"), { x: me.pos.x, z: me.pos.z });
      const onAgain = !!foe.__costume, shot0 = foe._shotT;
      for (let i = 0; i < 82; i++) { foe.alive = true; foe.fireCd = 99; step(0.1); }
      out.costume.timedOut = onAgain && foe._shotT === shot0 && !foe.__costume && foe.group === realGroup;

      // ── 바꿔치기 ──
      put(foe, 12);
      me.weapons.primary = "vector"; me.weapons.secondary = "classic"; foe.weapons.primary = "sniper"; foe.slot = "primary";
      me.ammo.sniper = 0;
      out.swapRefund = cast("y_gunswap");
      out.swap = { me: [me.weapons.primary, me.slot, me.ammo.sniper === WEAPONS.sniper.mag], foe: [foe.weapons.primary, foe.slot] };
      away(foe);
      out.swapNobody = cast("y_gunswap");

      // ── 탈바꿈 ──
      put(foe, 15);
      me.hp = 20; me.armor = 5; foe.hp = 90; foe.armor = 40;
      me.ultCharge = 0;
      cast("y_ult_lifeswap");
      out.life = [Math.round(me.hp), me.armor, Math.round(foe.hp), foe.armor];
      away(foe); me.ultCharge = 0;
      cast("y_ult_lifeswap");
      out.lifeNobody = me.ultCharge === me.ultMax;

      // ── 옐로카드 ──
      put(foe, 14);
      foe.hp = 100; foe.armor = 0;
      out.cardRefund = cast("y_yellow");
      out.card = { t: foe.__cardT, lvl: foe.__cardLvl };
      const shoot = (a, n) => { for (let i = 0; i < n; i++) { a._shotT = 1e6 + Math.random() + (a.__s = (a.__s || 0) + 1); a.alive = true; step(1 / 60); } };
      shoot(foe, 3);
      out.card.after3 = Math.round(100 - foe.hp);
      shoot(foe, 12);
      out.card.capped = Math.round(100 - foe.hp);
      foe.hp = 100;
      cast("y_yellow");
      out.card.lvl2 = foe.__cardLvl;
      shoot(foe, 2);
      out.card.second = Math.round(100 - foe.hp);
      foe.__cardT = 0;

      // ── 타임아웃 ──
      put(foe, 5);
      foe2.pos.x = me.pos.x + 30; foe2.pos.z = me.pos.z;
      for (const a of [me, foe, foe2]) { a.hp = 100; a.armor = 0; }
      cast("y_timeout");
      dealDamage(me, 30, false, foe); dealDamage(foe, 30, false, me); dealDamage(foe2, 30, false, me);
      out.timeout = { inside: [me.hp, foe.hp], outsiderHitFromInside: foe2.hp, zones: AGENTS4.timeouts.length };
      for (let i = 0; i < 42; i++) { live(); step(0.1); }
      dealDamage(foe, 30, false, me);
      out.timeout.afterwards = Math.round(foe.hp);
      away(foe2);

      // ── 오프사이드 ──
      live();
      put(foe, 30);
      const p0 = { x: me.pos.x, z: me.pos.z }, fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
      cast("y_offside");
      const L = AGENTS4.lines[AGENTS4.lines.length - 1];
      // beyond the line, then across it toward me
      const at = (d) => { foe.pos.x = p0.x + fx * d; foe.pos.z = p0.z + fz * d; foe.alive = true; step(1 / 60); };
      at(32); at(30);
      out.offside = { line: !!L, before: foe.__weakT || 0 };
      at(20);
      out.offside.weak = foe.__weakT;
      me.hp = 100; me.armor = 0;
      dealDamage(me, 40, false, foe);
      out.offside.dmg = Math.round(100 - me.hp);
      // walking back out does nothing
      foe.__weakT = 0; at(30);
      out.offside.back = foe.__weakT || 0;

      // ── 레드카드 ──
      put(foe, 12);
      const before = Math.hypot(foe.pos.x - (foe.team === "atk" ? MAP.attackSpawn : MAP.defendSpawn).x, foe.pos.z - (foe.team === "atk" ? MAP.attackSpawn : MAP.defendSpawn).z);
      me.ultCharge = 0;
      cast("y_ult_red");
      const home = AGENTS4.homeOf(foe);
      out.red = { before: Math.round(before), after: +Math.hypot(foe.pos.x - home.x, foe.pos.z - home.z).toFixed(2), silenced: foe.silenced > 4 };
      away(foe); me.ultCharge = 0;
      cast("y_ult_red");
      out.redNobody = me.ultCharge === me.ultMax;
      // a guest is told and moves itself
      const mode = NET.mode;
      NET.mode = "client";
      NET.onEvent({ t: "y4", k: "rd", a: me.id, p: [me.pos.x, me.y, me.pos.z, home.x, home.y, home.z].map((v) => Math.round(v * 10)) });
      out.guestRed = +Math.hypot(me.pos.x - home.x, me.pos.z - home.z).toFixed(1);
      NET.onEvent({ t: "y4", k: "yc", a: foe.id, n: 2 });
      out.guestCard = foe.__cardLvl;
      NET.mode = mode;
      // a new round clears it all
      startRound();
      out.reset = !AGENTS4.timeouts.length && !AGENTS4.lines.length && world.actors.every((a) => !(a.__cardT > 0) && !(a.__disgT > 0) && !a.__costume);
      return out;
    });
    console.log(JSON.stringify(r));
    // 흉내
    assert.equal(r.mimicNone, true, "nothing to copy: the charge comes back");
    assert.equal(r.recorded, "x_rally_cry");
    assert.equal(r.label, "흉내 · 함성", "the tile says what it would copy");
    assert.equal(r.mimicRefund, false);
    assert.equal(r.mimicArmor, 30, "the copied rally cry gave me its armour");
    assert.equal(r.mimicLast, "x_rally_cry");
    assert.deepEqual(r.replayed, { ran: true, armor: 30, listBack: 4 }, "a guest plays the copy and the list is left as it was");
    // 변장
    assert.deepEqual(r.disg, { t: 8, botFar: false, botNear: true, ambush: 30, after: 0, plain: 20 });
    assert.ok(r.costume.on && r.costume.swapped && r.costume.realHidden && r.costume.ally, "an enemy in disguise looks like one of us: " + JSON.stringify(r.costume));
    assert.ok(r.costume.offOnShot && r.costume.timedOut, "a shot or the clock ends it");
    // 바꿔치기, 탈바꿈
    assert.equal(r.swapRefund, false);
    assert.deepEqual(r.swap, { me: ["sniper", "primary", true], foe: ["smg", "primary"] }, "swapped legacy Vector is canonicalized to the current SMG");
    assert.equal(r.swapNobody, true);
    assert.deepEqual(r.life, [90, 40, 20, 5]);
    assert.ok(r.lifeNobody, "no one to swap with: the ultimate comes back");
    // 옐로카드
    assert.equal(r.cardRefund, false);
    assert.deepEqual(r.card, { t: 8, lvl: 1, after3: 12, capped: 40, lvl2: 2, second: 16 });
    // 타임아웃
    assert.deepEqual(r.timeout, { inside: [100, 100], outsiderHitFromInside: 100, zones: 1, afterwards: 70 });
    // 오프사이드
    assert.deepEqual(r.offside, { line: true, before: 0, weak: 5, dmg: 20, back: 0 });
    // 레드카드
    assert.ok(r.red.before > 10 && r.red.after < 0.5 && r.red.silenced, "sent back to its spawn, silenced: " + JSON.stringify(r.red));
    assert.ok(r.redNobody);
    assert.equal(r.guestRed, 0);
    assert.equal(r.guestCard, 2);
    assert.ok(r.reset, "a new round clears every card, zone, line and disguise");
    assert.deepEqual(f.errors, []);

    // the select screen: both, with their own pictures
    await page.evaluate(() => { world.phase = "menu"; picked = AGENTS.find((a) => "gamyeon" === a.id); renderSelect(); show("s-select"); });
    await page.waitForFunction(() => { const i = document.querySelector("#sel-detail .det-img"); return !!(i && i.src); }, null, { timeout: 15000 }); // the portrait loader sets the picture a moment after the screen opens
    const sel = await page.evaluate(() => ({ cards: document.querySelectorAll("#sel-grid .acard").length, names: [...document.querySelectorAll("#sel-grid .acard-name")].map((e) => e.textContent), img: !!document.querySelector("#sel-detail .det-img").src }));
    assert.ok(sel.cards >= 42 && sel.img && ["가면", "심판"].every((n) => sel.names.includes(n)), "the select screen lists both new agents: " + JSON.stringify([sel.cards, sel.img]));
    const dir = process.env.SHOT_DIR || "/tmp";
    await page.screenshot({ path: dir + "/agents4-gamyeon.png" });
    await page.evaluate(() => { picked = AGENTS.find((a) => "simpan" === a.id); renderSelect(); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: dir + "/agents4-simpan.png" });
    assert.deepEqual(f.errors, []);
    console.log("가면 and 심판: mimic (and its replay), disguise, gun swap, life swap; yellow card, timeout, offside, red card; select screen");

    // ── online: a guest as 가면 against a host as 심판 ──
    await page.close();
    const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
    await new Promise((resolve) => PeerServer({ host: "127.0.0.1", port: 9000, path: "/" }, (server) => { signaling = server; resolve(); }));
    const host = await f.page("refhost"), guest = await f.page("maskguest");
    for (const p of [host, guest]) await p.evaluate(async () => {
      render = () => {}; titleCam = () => {};
      await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port: 9000, path: "/", secure: false, config: { iceServers: [] } });
      window.onlineEvents = []; const original = NET.onEvent;
      NET.onEvent = function (event) { onlineEvents.push(structuredClone(event)); return original.apply(this, arguments); };
    });
    const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
    await guest.evaluate((code) => joinRoom(code), code);
    await host.waitForFunction(() => NET.conns.size === 1 && room.members.size === 2);
    await host.evaluate(() => {
      const g = [...NET.conns.keys()][0], m = room.members.get(g), other = "atk" === m.team ? "def" : "atk";
      for (let i = 0; i < TEAM_SIZE && !lobbyMove(g, other, i); i++);
      for (const [k, x] of room.members) x.agentKey = k === g ? "gamyeon" : "simpan";
      room.mode = "std"; room.map = "glacier"; hostStartMatch();
    });
    await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor() && myActor().agent, null, { timeout: 90000 });
    const ids = await host.evaluate(() => {
      world.phase = "live"; ADMIN.freezeAI = true;
      const me = myActor(), g = world.actors.find((a) => a.ctrl !== "me" && a.ctrl !== "ai" && a.ctrl !== "dead");
      for (const a of world.actors) if (a !== me && a !== g) { a.pos.x = me.pos.x + 70 + 3 * a.id; a.pos.z = me.pos.z + 70; }
      // the guest in the open, 10 m ahead of the host
      for (let k = 0; k < 24; k++) {
        const x = me.pos.x - Math.sin(me.yaw) * 10, z = me.pos.z - Math.cos(me.yaw) * 10;
        if (!rayBlocked(me.pos.x, me.y + 1.5, me.pos.z, x, me.y + 1.2, z) && !collideXZ(x, z, 0, 0.5)) { g.pos.x = x; g.pos.z = z; g.y = me.y; break; }
        me.yaw += Math.PI / 12;
      }
      g.abilities.forEach((x) => { x.charges = Math.max(1, x.charges); x.cd = 0; });
      return { me: me.agent.id, guest: g.agent.id, gid: g.id, teams: me.team !== g.team };
    });
    assert.deepEqual([ids.me, ids.guest, ids.teams], ["simpan", "gamyeon", true]);
    await guest.waitForFunction(() => world.phase === "live" && myActor().alive);
    // the host blows its own whistle (10 m from the guest); the guest copies it
    await host.evaluate(() => castAbility("y_timeout", AGENTS.find((a) => a.id === "simpan").abilities[1]));
    await guest.waitForFunction(() => onlineEvents.some((e) => e.t === "cast" && e.ty === "y_timeout"));
    await guest.waitForFunction(() => /타임아웃/.test((document.querySelector("#skills .sk:first-child .sk-nm") || {}).textContent || ""), null, { timeout: 10000 });
    await guest.evaluate(() => useAbility(player.abilities.findIndex((x) => x.def.type === "y_mimic")));
    await guest.waitForFunction((gid) => onlineEvents.some((e) => e.t === "cast" && e.ty === "y_timeout" && e.a === gid), ids.gid, { timeout: 15000 });
    const mimic = await guest.evaluate(() => { const me = myActor(); return { played: AGENTS4.last.some((r) => r.by === me && r.type === "y_timeout"), zoneHere: AGENTS4.timeouts.some((z) => Math.hypot(z.x - me.pos.x, z.z - me.pos.z) < 2), listBack: me.agent.abilities.length }; });
    assert.deepEqual(mimic, { played: true, zoneHere: true, listBack: 4 }, "the guest's screen played its own copy");
    assert.ok(await host.evaluate((gid) => { const g = world.actors.find((a) => a.id === gid); return AGENTS4.timeouts.some((z) => Math.hypot(z.x - g.pos.x, z.z - g.pos.z) < 2); }, ids.gid), "the copy counts on the host");
    // let the whistles run out
    await host.waitForFunction(() => !AGENTS4.timeouts.length, null, { timeout: 15000 });
    // the host shows the guest a red card: it lands back at its spawn on its own screen
    const home = await host.evaluate((gid) => { const me = myActor(), g = world.actors.find((a) => a.id === gid); me.yaw = Math.atan2(-(g.pos.x - me.pos.x), -(g.pos.z - me.pos.z)); me.pitch = 0; castAbility("y_ult_red", AGENTS.find((a) => a.id === "simpan").abilities[3]); const h = AGENTS4.homeOf(g); return { x: h.x, z: h.z, at: Math.hypot(g.pos.x - h.x, g.pos.z - h.z) }; }, ids.gid);
    assert.ok(home.at < 0.5, "sent home on the host");
    await guest.waitForFunction(() => onlineEvents.some((e) => e.t === "y4" && e.k === "rd"));
    const there = await guest.evaluate((h) => +Math.hypot(myActor().pos.x - h.x, myActor().pos.z - h.z).toFixed(2), home);
    assert.ok(there < 1, "and on the guest's own screen: " + there);
    // a yellow card for the guest: it sees the card and pays for its shots
    await host.evaluate((gid) => { const me = myActor(), g = world.actors.find((a) => a.id === gid); g.pos.x = me.pos.x - Math.sin(me.yaw) * 10; g.pos.z = me.pos.z - Math.cos(me.yaw) * 10; g.y = me.y; g.hp = 100; g.armor = 0; castAbility("y_yellow", AGENTS.find((a) => a.id === "simpan").abilities[0]); }, ids.gid);
    await guest.waitForFunction(() => myActor().__cardT > 0 && document.getElementById("y4-hud") && /옐로카드/.test(document.getElementById("y4-hud").textContent), null, { timeout: 10000 });
    await host.evaluate((gid) => { const g = world.actors.find((a) => a.id === gid); for (let i = 0; i < 3; i++) { g._shotT = 1e7 + i; step(1 / 60); } }, ids.gid);
    await guest.waitForFunction(() => myActor().hp <= 88, null, { timeout: 10000 });
    await host.evaluate(() => netShutdown());
    assert.deepEqual(f.errors, []);
    console.log("online: the guest's copy plays on its screen, a red card moves the guest home, a yellow card shows and costs");
  } finally { await f.browser.close(); signaling && signaling.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
