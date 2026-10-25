const assert = require("node:assert/strict"), fs = require("fs"), path = require("path"), { fixture } = require("./browser-fixture");
// Abilities you can see: a fighter wears what is on them (slow, root, stun, seal, vulnerable, shield, reveal,
// blind) with its name over the head, and it all goes when the status ends; someone else's cast puts the
// ability's name over their head for a moment (your own does not); your own slow, root, blind, shield and reveal
// show in the status row; nothing is drawn on your own body in first person.
(async () => {
  const f = await fixture();
  const dir = process.env.SHOT_DIR || "test-results/ability-visibility";
  fs.mkdirSync(dir, { recursive: true });
  try {
    const page = await f.page("abilityvis", { width: 1280, height: 720 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.mouse.click(640, 360);
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const out = {}, V = ABILITY_VISIBILITY, me = myActor(), enemy = world.actors.find((a) => a.team !== me.team && a.alive);
      const step = (n) => { for (let i = 0; i < n; i++) abilTick(1 / 60); };
      // the enemy six metres in front, in plain view
      const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw);
      enemy.pos.x = me.pos.x - fx * 6; enemy.pos.z = me.pos.z - fz * 6; enemy.y = me.y || 0;
      Object.assign(enemy, { slowT: 3, root: 2, concuss: 2, suppress: 2, vuln: 2, shielded: 3, revealed: 3, blind: 2 });
      step(2);
      const rig = V.fx.get(enemy);
      out.rig = !!rig && rig.g.visible;
      out.parts = rig ? Object.keys(rig.parts).filter((k) => rig.parts[k].g.visible).sort() : [];
      out.label = rig && rig.label ? rig.label.userData.text : "";
      out.labelVisible = !!(rig && rig.label && rig.label.visible);
      // the same on me: nothing on my body (first person), the row under the crosshair names them
      Object.assign(me, { slowT: 3, root: 2, shielded: 3, revealed: 3, blind: 2 });
      step(1); updateStatusHud(me);
      const mine = V.fx.get(me);
      out.meDrawn = !!(mine && mine.g.visible);
      out.row = document.getElementById("statfx").textContent;
      return out;
    });
    await page.evaluate(() => { followCamera = () => {}; const me = myActor(), e = world.actors.find((a) => a.team !== me.team && a.alive); camera.position.set(e.pos.x + 2.6, (e.y || 0) + 2.1, e.pos.z + 2.6); camera.lookAt(e.pos.x, (e.y || 0) + 1.1, e.pos.z); renderer.render(scene, camera); });
    await page.screenshot({ path: path.join(dir, "statuses.png") });
    const r2 = await page.evaluate(async () => {
      const out = {}, V = ABILITY_VISIBILITY, me = myActor(), enemy = world.actors.find((a) => a.team !== me.team && a.alive);
      const step = (n) => { for (let i = 0; i < n; i++) abilTick(1 / 60); };
      for (const k of ["slowT", "root", "concuss", "suppress", "vuln", "shielded", "revealed", "blind"]) (enemy[k] = 0), (me[k] = 0);
      step(2);
      const rig = V.fx.get(enemy);
      out.cleared = !rig || !rig.g.visible;
      // someone else's cast: the name rises over them, then goes
      const def = enemy.agent.abilities.find((d) => !d.ult) || enemy.agent.abilities[0];
      withCaster(enemy, () => castAbility(def.type, def));
      const c = V.callouts.find((x) => x.a === enemy);
      out.callName = c ? c.s.userData.text : null;
      out.defName = def.name;
      out.callAbove = c ? c.s.position.y > (enemy.y || 0) + 2 : false;
      const ult = enemy.agent.abilities.find((d) => d.ult);
      if (ult) { withCaster(enemy, () => castAbility(ult.type, ult)); const u = V.callouts.filter((x) => x.a === enemy).pop(); out.ultBigger = u.s.scale.y > c.s.scale.y; }
      // my own cast: no name over my head
      const before = V.callouts.length, mdef = me.agent.abilities.find((d) => !d.ult);
      CAST_REFUND = false; castAbility(mdef.type, mdef); CAST_REFUND = false;
      out.ownCast = V.callouts.length - before;
      await new Promise((ok) => setTimeout(ok, 2600));
      step(2);
      out.callLeft = V.callouts.length;
      return out;
    });
    console.log(JSON.stringify({ ...r, ...r2 }));
    assert.ok(r.rig, "the enemy wears its statuses");
    assert.deepEqual(r.parts, ["blind", "concuss", "revealed", "root", "shielded", "slowT", "suppress", "vuln"], "one mark for each status");
    for (const w of ["둔화", "속박", "뇌진탕", "무기 봉인", "취약", "보호막", "노출", "실명"]) assert.ok(r.label.includes(w), "the line over the head names " + w + " (" + r.label + ")");
    assert.ok(r.labelVisible, "the line over the head shows");
    assert.equal(r.meDrawn, false, "nothing on my own body in first person");
    for (const w of ["둔화", "속박", "보호막", "노출", "실명"]) assert.ok(r.row.includes(w), "my status row shows " + w + " (" + r.row + ")");
    assert.ok(r2.cleared, "the marks go when the statuses end");
    assert.equal(r2.callName, r2.defName, "someone else's cast names the ability over them");
    assert.ok(r2.callAbove, "the name is over the head");
    if (r2.ultBigger !== undefined) assert.ok(r2.ultBigger, "an ultimate's name is bigger");
    assert.equal(r2.ownCast, 0, "my own cast puts no name over me");
    assert.equal(r2.callLeft, 0, "the names fade and are taken away");
    assert.deepEqual(errors, [], "no page errors");
    console.log("Ability visibility: eight status marks and a name line on the fighter, cleared when they end; cast names over other casters, bigger for an ultimate, none for your own; status row lists slow, root, blind, shield, reveal");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
