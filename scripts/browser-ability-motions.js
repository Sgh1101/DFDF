const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
// Every ability's own cast motion, in a real match: the hands follow the authored path and stay in view, the second
// hand comes in only for two-handed moves, the forearm never swings through the camera, the release effects fire and
// are all gone after, and others see the same move on the caster's body. Browser only (headless Chromium).
(async () => {
  const f = await fixture();
  try {
    fs.mkdirSync("test-results/ability-motions", { recursive: true });
    const p = await f.page("abilitymotions", { width: 960, height: 540 }, {}, { quality: "visual" });
    await p.locator("#go-play").click();
    await p.locator("#sel-grid .acard").filter({ hasText: "화령" }).click();
    await p.locator("#sel-go").click();
    await p.waitForFunction(() => !!myActor() && world.actors.length >= 4);
    await p.evaluate(() => { closeShop(); ADMIN.freezeAI = true; world.phase = "live"; world.phaseT = 999; myActor().invuln = 999; for (const a of world.actors) if (a !== myActor()) { a.pos.x = 300; a.pos.z = 300; } });
    // a real cast through the game's ability input goes through the new motion
    await p.evaluate(() => { const ab = myActor().abilities[1]; ab.charges = Math.max(1, ab.charges | 0); ab.cd = 0; });
    // the E key calls useAbility(1) only under pointer lock, which headless Chromium does not always keep
    await p.evaluate(() => useAbility(1));
    await p.waitForFunction(() => ABILITY_MOTION_FX.state.type === "proj_fire", null, { timeout: 15000 }).catch(async () => { throw new Error("no cast from useAbility(1): " + JSON.stringify(await p.evaluate(() => ({ phase: world.phase, ab: myActor().abilities[1], style: VM_CAST.style, s: ABILITY_MOTION_FX.state.type, active: document.activeElement && document.activeElement.id, agent: myActor().agent.id, alive: myActor().alive })))); });
    const real = await p.evaluate(() => ({ style: VM_CAST.style, state: ABILITY_MOTION_FX.state.type, timed: VM_CAST.dur === CAST_DUR[VM_CAST.style] }));
    assert.deepEqual(real, { style: "detail:proj_fire", state: "proj_fire", timed: true });
    const result = await p.evaluate(() => {
      window.requestAnimationFrame = () => 0;
      const me = myActor(), out = { types: 0, problems: [], twoHanded: 0, cues: {}, bodies: {} };
      const cam = camera, v = new THREE.Vector3(), info = renderer.info.memory;
      const live = AGENTS.flatMap((a) => a.abilities.map((d) => [a, d])).filter(([, d]) => ABILITY_MOTIONS.motions[d.type]);
      out.live = live.length;
      const run = (agent, d, count = true) => {
        const m = ABILITY_MOTIONS.motions[d.type], style = "detail:" + d.type;
        player.agent = me.agent = agent;
        vmCast(style);
        if (VM_CAST.style !== style) return out.problems.push(d.type + " style " + VM_CAST.style);
        const dur = VM_CAST.dur, steps = Math.ceil(dur / 0.016), seen = new Set();
        let inView = 0, mid = 0, support = false, nearEye = 0;
        for (let i = 0; i < steps; i++) {
          tickViewmodel(dur / steps);
          const o = 1 - Math.max(0, VM_CAST.t) / dur, vm = ABILITY_DETAILS.vm();
          for (const n of ABILITY_MOTION_FX.shown()) seen.add(n.replace("ability-motion-", ""));
          if (vm.support && vm.support.visible && VM_CAST.t > 0) support = true;
          if (o > 0.3 && o < 0.75 && vm.tool) {
            mid++;
            VM.root.updateMatrixWorld(true); cam.updateMatrixWorld(); vm.tool.getWorldPosition(v);
            const local = v.clone().applyMatrix4(cam.matrixWorldInverse);
            if (-local.z < 0.2) nearEye++;
            v.project(cam);
            if (Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1) inView++;
            // the sleeve runs from the wrist to below the view
            const sleeve = VM_CAST.grp.children[0], end = new THREE.Vector3();
            sleeve.geometry.computeBoundingBox(); end.set(0, sleeve.geometry.boundingBox.max.y, 0).applyMatrix4(sleeve.matrixWorld).project(cam);
            if (end.y > -0.6 && Math.abs(end.x) < 1) out.problems.push(d.type + " forearm end in view at " + o.toFixed(2));
          }
        }
        tickViewmodel(0.05);
        if (inView < mid * 0.8) out.problems.push(d.type + " tool in view " + inView + "/" + mid);
        if (nearEye) out.problems.push(d.type + " tool near the eye " + nearEye);
        if (!!m.s !== support) out.problems.push(d.type + " second hand " + support + " for " + JSON.stringify(m.s && "yes"));
        for (const [kind] of ABILITY_MOTIONS.cues(d.type)) if (!seen.has(kind)) out.problems.push(d.type + " never showed " + kind);
        if (m.trail > 0.25 && !seen.has("trail")) out.problems.push(d.type + " no trail");
        if (ABILITY_MOTION_FX.shown().length) out.problems.push(d.type + " left " + ABILITY_MOTION_FX.shown());
        if (VM_CAST.grp.visible) out.problems.push(d.type + " hands stay up");
        if (!count) return;
        if (support) out.twoHanded++;
        for (const k of seen) out.cues[k] = (out.cues[k] || 0) + 1;
        out.types++;
      };
      for (const [a, d] of live) run(a, d);
      abilClear(); render();
      // the same agent casting again and again leaves nothing behind (switching agents rebuilds the hands, as before)
      const own = live.filter(([a]) => a.id === "hwaryeong");
      for (const [a, d] of own) run(a, d, false);
      abilClear(); render();
      const g0 = info.geometries;
      for (let i = 0; i < 5; i++) for (const [a, d] of own) run(a, d, false);
      abilClear(); render();
      out.geometryGrowth = info.geometries - g0;
      // seen from outside: a bot casts, its own body follows the same path
      const bot = world.actors.find((a) => a !== me && a.model && a.model.armL);
      bot.pos.x = me.pos.x; bot.pos.z = me.pos.z - 4; bot.alive = true;
      const pose = (type, o) => {
        const model = bot.model, style = "detail:" + type, d = CAST_DUR[style];
        bot._castS = style; bot._castD = d; bot._castT = d * (1 - o) + 0.001;
        castPose(bot, model, 0.001);
        return [model.armL.arm.rotation.x, model.armL.fore.rotation.x, model.armL.arm.rotation.z, model.chest.rotation.y].map((n) => +n.toFixed(3));
      };
      const rest = pose("proj_fire", 1);
      for (const type of ["proj_fire", "x_ground_slam", "pierce", "x_ult_storm_eye", "y_ult_red"]) out.bodies[type] = pose(type, 0.45);
      out.bodyRest = rest; out.bodyAfter = pose("x_ground_slam", 1);
      return out;
    });
    console.log(JSON.stringify({ types: result.types, live: result.live, twoHanded: result.twoHanded, cues: result.cues, growth: result.geometryGrowth }));
    assert.deepEqual(result.problems, []);
    assert.equal(result.types, result.live);
    assert.ok(result.live >= 100, "every non-native ability has its motion: " + result.live);
    assert.ok(result.twoHanded >= 30, "two-handed moves: " + result.twoHanded);
    for (const k of ["trail", "flash", "bolt", "ring", "shock", "spark", "swirl", "charge"]) assert.ok(result.cues[k] > 3, k + " " + result.cues[k]);
    assert.ok(result.geometryGrowth <= 0, "geometry grows by " + result.geometryGrowth);
    const bodies = Object.values(result.bodies).map((b) => b.join());
    assert.equal(new Set(bodies).size, bodies.length, "spectator poses differ: " + JSON.stringify(result.bodies));
    for (const b of Object.values(result.bodies)) assert.notDeepEqual(b, result.bodyRest);
    // three moments for the eye
    for (const [type, o, name] of [["x_ground_slam", 0.52, "slam"], ["ult_fire", 0.6, "channel"], ["pierce", 0.5, "bow"], ["x_ult_storm_eye", 0.6, "twirl"]]) {
      await p.evaluate(([type, o]) => { player.agent = myActor().agent = AGENTS.find((a) => a.abilities.some((d) => d.type === type)); vmCast("detail:" + type); const d = VM_CAST.dur, n = Math.ceil(o * d / 0.016); for (let i = 0; i < n; i++) tickViewmodel(o * d / n); render(); }, [type, o]);
      await p.screenshot({ path: `test-results/ability-motions/${name}.png` });
    }
    assert.deepEqual(f.errors, []);
    console.log("Ability motions: " + result.types + " abilities with their own hand path, second hand, trail and release effects, cleaned up; spectator body follows. Browser only.");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
