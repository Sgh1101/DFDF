// Ragdolls (js/legacy/123-ragdolls-*.js) and emotes (js/legacy/123b-emotes-*.js).
// Ragdolls: a bot killed by a shot falls (its head ends near the ground, its parts stay connected, it stops within a few seconds and
// then costs nothing, it lies the way the shot went), one killed by an explosion is thrown much further, corpses are cleared at a round
// reset, a map change and the match end and capped (the oldest goes first), a respawn removes the body 3 s later, reduced motion gets
// the fall at once, and the Champions finisher's victim gets none (while the same gun's ordinary kill does) and its finisher is as it was.
// Emotes: the key plays the chosen one, holding or pressing twice opens the wheel (1-6, the mouse and the buttons pick), the camera goes
// round to the front of the body and stops short of a wall, moving / jumping / firing / aiming / an ability / a weapon switch /
// reloading / damage end it and it will not start dead, planting or in the shop, a bot answers a kill now and then (and not with an
// enemy in sight), a guest sees the host's emote and the host the guest's over the test transport (rate limit, bad messages, the owner's
// switch), a guest sees a ragdoll for a kill, and on a 740x360 phone the touch button plays and opens the list.
// Screenshots go to test-results/ragdoll-emotes-*.png. Usage: node scripts/browser-ragdoll-emotes.js [solo] [net] [touch]
const assert = require("node:assert/strict"), fs = require("node:fs"), { fixture } = require("./browser-fixture");
const { PeerServer } = require(process.env.DFDF_PEER_SERVER_MODULE || "peer");
const PORT = Number(process.env.DFDF_PEER_PORT) || 9000;
const want = process.argv.slice(2).filter((a) => ["solo", "net", "touch"].includes(a)), run = (s) => !want.length || want.includes(s);
fs.mkdirSync("test-results", { recursive: true });
(async () => {
  const f = await fixture();
  const shot = (page, name) => page.screenshot({ path: `test-results/ragdoll-emotes-${name}.png`, timeout: 120000 }).catch(() => {});
  // a solo match on the flat field, the bots told to stay put and not shoot, the view free of the lock hint
  const solo = async (page, mode = "std") => {
    await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height / 2);
    await page.evaluate((mode) => {
      titleCam = () => {}; room.mode = mode; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 99999; ADMIN.freezeAI = true; locked = true;
      const st = document.createElement("style"); st.textContent = "#lockhint{display:none!important}"; document.head.appendChild(st);
      for (const a of world.actors) { a.fireCd = 99999; if (a !== myActor()) a.invuln = 0; }
    }, mode);
    await page.waitForTimeout(900);
  };
  // Headless Chromium sometimes grants pointer lock without a gesture and drops it again; the game then opens the pause
  // menu, as it does when a player presses Esc, and an emote (rightly) does not start under it. The pages here never take
  // the lock (the test sets \`locked\` itself), and each step starts with the pause menu shut (hidden directly: togglePause(false) toggles, it does not close).
  const noLock = async (p) => { await p.evaluate(() => { for (const C of [Element, HTMLCanvasElement]) C.prototype.requestPointerLock = function () { return Promise.resolve(); }; }); return p; };
  try {
    if (run("solo")) {
      const page = await noLock(await f.page("rde1", { width: 1000, height: 600 }, {}, { quality: "perf" }));
      await solo(page);
      const base = f.errors.length;
      // ── a bot killed by a shot ──
      const shotR = await page.evaluate(() => {
        const me = myActor(), foes = world.actors.filter((a) => a.team !== me.team), foe = foes[0];
        for (const a of world.actors) if (a !== me && a !== foe) { a.pos.set(60 + Math.random() * 5, 0, 60); a.y = 0; a.invuln = 999; }
        me.pos.set(12, 0, 0); me.y = 0; me.yaw = 0; me.invuln = 999;
        foe.pos.set(12, 0, -8); foe.y = 0; foe.vel.set(0, 0, 0); foe.hp = 1; foe.armor = 0; foe.invuln = 0;
        for (let i = 0; i < 10; i++) step(1 / 60);
        me.pitch = Math.atan2(1.2 - actorEye(me), 8);
        const start = { x: foe.pos.x, z: foe.pos.z };
        for (let k = 0; k < 6 && foe.alive; k++) { me.fireCd = 0; me.ammo[actorWeaponKey(me)] = 12; me.pitch = Math.atan2(1.2 - actorEye(me), 8); actorFire(me); }
        const out = { dead: !foe.alive, corpses: RAGDOLL.corpses().length, mine: !!foe._rag, hidden: null };
        if (!foe._rag) return out;
        const c = foe._rag, hip0 = RAGDOLL.hip(c), head0 = RAGDOLL.head(c), t0 = performance.now();
        out.head0 = head0.y; out.rootVisible = c.root.visible; out.inScene = !!c.root.parent;
        out.shotKills = DAMAGE_CAUSE && true;
        let worst = 0, frames = 0, frozeAt = null;
        const bones = () => RAGDOLL.links(c).filter((l) => !l.kind);
        while (frames < 60 * 7) {
          step(1 / 60); frames++;
          if (frames % 5 === 0) for (const l of bones()) worst = Math.max(worst, Math.abs(l.now / l.rest - 1));
          if (c.body.frozen && frozeAt === null) frozeAt = frames / 60;
          if (frozeAt !== null && frames / 60 > frozeAt + 0.5) break;
        }
        const hip = RAGDOLL.hip(c), head = RAGDOLL.head(c), j = RAGDOLL.joints(c), feet = [j.find((x) => x[0] === "ftL"), j.find((x) => x[0] === "ftR")];
        const fx = (feet[0][1] + feet[1][1]) / 2, fz = (feet[0][3] + feet[1][3]) / 2;
        out.frozeAt = frozeAt; out.worst = worst; out.headY = head.y; out.hipMove = [hip.x - start.x, hip.z - start.z];
        out.axis = [head.x - fx, head.z - fz]; out.live = RAGDOLL.live();
        out.groupHidden = !foe.group.visible;
        const before = JSON.stringify(RAGDOLL.joints(c));
        for (let i = 0; i < 90; i++) step(1 / 60);
        out.stillAfter = before === JSON.stringify(RAGDOLL.joints(c));
        out.noGroundHole = j.every((x) => x[2] >= -0.001);
        out.tickMs = RAGDOLL.state.stats.stepMs;
        // what a still corpse is: matrices frozen
        out.frozenMatrices = !c.root.matrixAutoUpdate;
        return out;
      });
      assert.ok(shotR.dead && shotR.mine, "the shot killed the bot and it has a corpse: " + JSON.stringify(shotR));
      assert.ok(shotR.rootVisible && shotR.inScene, "the corpse is in the scene");
      assert.ok(shotR.headY < 0.45, "the head ends near the ground: " + shotR.headY);
      assert.ok(shotR.worst < 0.08, "the parts stay connected (no bone more than 8% off its length): " + shotR.worst);
      assert.ok(shotR.frozeAt !== null && shotR.frozeAt < 4, "it stops moving within a few seconds: " + shotR.frozeAt);
      assert.equal(shotR.live, 0, "no corpse is still being simulated"); assert.ok(shotR.stillAfter, "and it does not move after that"); assert.ok(shotR.frozenMatrices, "its matrices are frozen too");
      assert.ok(shotR.hipMove[1] < -0.3 && Math.abs(shotR.hipMove[0]) < 1.2, "it fell the way the shot went (away from the shooter, -z): " + shotR.hipMove);
      assert.ok(shotR.axis[1] < -0.5, "and lies with the head ahead of the feet along that line: " + shotR.axis);
      assert.ok(shotR.groupHidden, "the actor's own model is out of sight while the corpse lies there");
      assert.ok(shotR.noGroundHole, "no joint is under the floor");
      const shotDist = Math.hypot(...shotR.hipMove);
      await page.evaluate(() => { const me = myActor(), c = RAGDOLL.corpses()[0], h = RAGDOLL.hip(c); me.pos.set(h.x + 3.2, 0, h.z); me.yaw = Math.PI / 2; me.pitch = -0.3; });
      await page.waitForTimeout(700); await shot(page, "shot-corpse");
      console.log("ragdoll: a shot kill falls", shotDist.toFixed(2), "m, head at", shotR.headY.toFixed(2), "m, froze at", shotR.frozeAt.toFixed(2), "s, links within", (100 * shotR.worst).toFixed(1) + "%");

      // ── an explosion kill flies further ──
      const blast = await page.evaluate(() => {
        RAGDOLL.clear();
        const me = myActor(), foe = world.actors.filter((a) => a.team !== me.team)[1];
        me.pos.set(0, 0, 0); foe.alive = true; foe.hp = 100; foe.pos.set(6, 0, -8); foe.y = 0; foe.invuln = 0; foe.armor = 0; delete foe._rag; foe.group.visible = true;
        for (let i = 0; i < 5; i++) step(1 / 60);
        // the blast goes off a metre behind it, toward the shooter
        explode(6, -7, 5, 900, 400, 0xff8800);
        const c = foe._rag;
        if (!c) return { dead: !foe.alive };
        const start = { x: foe.pos.x, z: foe.pos.z };
        for (let i = 0; i < 60 * 7 && !c.body.frozen; i++) step(1 / 60);
        const h = RAGDOLL.hip(c), j = RAGDOLL.joints(c);
        return { dead: !foe.alive, move: [h.x - start.x, h.z - start.z], frozen: c.body.frozen, headY: RAGDOLL.head(c).y, maxY: Math.max(...j.map((x) => x[2])), worst: Math.max(...RAGDOLL.links(c).filter((l) => !l.kind).map((l) => Math.abs(l.now / l.rest - 1))) };
      });
      assert.ok(blast.dead && blast.frozen, "the blast killed it and the body settled: " + JSON.stringify(blast));
      const blastDist = Math.hypot(...blast.move);
      assert.ok(blastDist > 2.5 * shotDist && blastDist > 3, `the explosion threw it much further than the shot: ${blastDist.toFixed(2)} m against ${shotDist.toFixed(2)} m`);
      assert.ok(blast.move[1] < -0.5, "away from the blast's centre: " + blast.move);
      assert.ok(blast.worst < 0.1, "still connected after the flight: " + blast.worst);
      console.log("ragdoll: an explosion kill is thrown", blastDist.toFixed(2), "m (a shot:", shotDist.toFixed(2) + " m)");

      // ── corpses go at a round reset and a map change; the cap drops the oldest ──
      const cap = await page.evaluate(() => {
        RAGDOLL.clear();
        const me = myActor(), q = SETTINGS.quality, max = RAGDOLL.lod().max, ids = [];
        for (const a of world.actors) { a.alive = true; a.hp = 100; a.armor = 0; a.invuln = 0; delete a._rag; a.group.visible = true; }
        me.invuln = 999;
        const dead = world.actors.filter((a) => a !== me);
        dead.forEach((a, i) => a.pos.set(-20 + 5 * i, 0, -20));
        for (const a of dead) { dealDamage(a, 999, false, me); ids.push(a.id); step(1 / 60); }
        const kept = RAGDOLL.corpses().map((c) => c.id);
        const out = { q, max, killed: ids.length, kept: kept.length, newest: JSON.stringify(kept) === JSON.stringify(ids.slice(-max)), inScene: scene.children.filter((o) => o.userData && o.userData.ragdoll).length };
        startRound();
        out.afterRound = RAGDOLL.corpses().length; out.sceneAfter = scene.children.filter((o) => o.userData && o.userData.ragdoll).length;
        return out;
      });
      assert.equal(cap.kept, cap.max, "at most the preset's number of corpses: " + JSON.stringify(cap));
      assert.ok(cap.killed > cap.max && cap.newest, "the oldest went first, the newest stayed: " + JSON.stringify(cap));
      assert.equal(cap.inScene, cap.max, "and only those are in the scene");
      assert.equal(cap.afterRound, 0, "a new round clears them"); assert.equal(cap.sceneAfter, 0, "also out of the scene");
      const maps = await page.evaluate(() => {
        const me = myActor(); me.invuln = 999;
        const foe = world.actors.find((a) => a.team !== me.team); foe.alive = true; foe.hp = 100; foe.armor = 0; foe.invuln = 0; foe.pos.set(0, 0, -10); delete foe._rag;
        dealDamage(foe, 999, false, me);
        const before = RAGDOLL.corpses().length;
        loadMap(CUR_MAP_KEY === "glacier" ? "field" : "glacier"); step(1 / 60);
        return { before, after: RAGDOLL.corpses().length, preset: Object.fromEntries(Object.entries(RAGDOLL.LOD).map(([k, v]) => [k, v.max])) };
      });
      assert.equal(maps.before, 1); assert.equal(maps.after, 0, "a map change clears them");
      assert.ok(maps.preset.mobile < maps.preset.perf && maps.preset.perf < maps.preset.visual && maps.preset.visual <= maps.preset.ultra, "weaker presets keep fewer: " + JSON.stringify(maps.preset));
      console.log("ragdoll: capped at", cap.max, "(oldest first), cleared at a new round and at a map change");

      // ── reduced motion: the fall is over at once ──
      const rm = await page.evaluate(() => {
        loadMap("field"); step(1 / 60);
        const me = myActor(), foe = world.actors.find((a) => a.team !== me.team); foe.alive = true; foe.hp = 100; foe.armor = 0; foe.invuln = 0; foe.pos.set(0, 0, -10); foe.y = 0; delete foe._rag; foe.group.visible = true;
        SETTINGS.motion = 0;
        dealDamage(foe, 999, false, me);
        const c = foe._rag, out = c && { frozen: c.body.frozen, headY: RAGDOLL.head(c).y };
        SETTINGS.motion = 1; RAGDOLL.clear();
        return out;
      });
      assert.ok(rm && rm.frozen && rm.headY < 0.45, "reduced motion: the body is already lying down: " + JSON.stringify(rm));

      // ── a respawn mode: the body lies on for 3 s after the respawn, then goes ──
      await page.evaluate(() => { const st = SETTINGS.quality; room.mode = "tdm"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 99999; ADMIN.freezeAI = true; locked = true; for (const a of world.actors) a.fireCd = 99999; });
      await page.waitForTimeout(900);
      const rs = await page.evaluate(() => {
        const me = myActor(), foe = world.actors.find((a) => a.team !== me.team);
        me.invuln = 999; for (const a of world.actors) if (a !== foe && a !== me) { a.invuln = 999; a.pos.set(60, 0, 60); }
        foe.pos.set(0, 0, -10); foe.y = 0; foe.hp = 100; foe.armor = 0; foe.invuln = 0;
        dealDamage(foe, 999, false, me);
        const out = { mode: room.mode, made: !!foe._rag }, t = [];
        let aliveAt = null;
        for (let i = 0; i < 60 * 14 && aliveAt === null; i++) { step(1 / 60); if (foe.alive) aliveAt = (i + 1) / 60; }
        out.aliveAt = aliveAt; out.id = foe.id; out.still = RAGDOLL.corpses().some((c) => c.id === foe.id);
        return out;
      });
      // the corpse's 3 s run on the clock (not on the simulation), so the page is given real time
      const t0 = Date.now(); let goneAt = null, early = null;
      while (Date.now() - t0 < 9000) {
        const left = await page.evaluate((id) => { step(1 / 60); return RAGDOLL.corpses().some((c) => c.id === id); }, rs.id);
        const s = (Date.now() - t0) / 1000;
        if (!left) { goneAt = s; break; }
        await page.waitForTimeout(150);
      }
      rs.goneAt = goneAt;
      assert.ok(rs.made && rs.aliveAt !== null && rs.still, "the body fell and the fighter respawned: " + JSON.stringify(rs));
      assert.ok(rs.goneAt !== null && rs.goneAt >= 2.9 && rs.goneAt < 5.5, "the corpse goes about 3-4 s after the respawn: " + JSON.stringify(rs));
      console.log("ragdoll: respawn mode, the body gone", rs.goneAt.toFixed(1), "s after the respawn");
      // ── the Champions finisher: its victim gets no ragdoll and the finisher's hold is as the finisher test expects ──
      for (const [label, skin, last] of [["champions_atk", "champions_atk", true], ["champions_def", "champions_def", true], ["an ordinary skin, last enemy", "default", true], ["champions skin, not the last enemy", "champions_atk", false]]) {
        const start = await page.evaluate(([skin, last]) => {
          RAGDOLL.clear(); room.mode = "std"; room.map = "field"; room.rounds = 13;
          startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; world.phase = "live"; world.roundTime = 99999; locked = true;
          const me = myActor(), foes = world.actors.filter((a) => a.team !== me.team), victim = foes[0];
          for (const a of world.actors) { a.fireCd = 999; if (a.team !== me.team) a.alive = last ? a === victim : true; }
          me.weapons.primary = "scout"; me.slot = "primary";
          victim.hp = 1; victim.armor = victim.invuln = victim.shielded = 0; victim.pos.set(me.pos.x + 8, 0, me.pos.z); victim.y = 0;
          const at = performance.now();
          DAMAGE_CAUSE.run(DAMAGE_CAUSE.capture(me, "scout", "gun", world.round, skin), () => dealDamage(victim, 999, false, me));
          checkRoundEnd();
          return { id: victim.id, phase: world.phase, wait: world.championsFinishUntil - at, score: world.scoreAtk + world.scoreDef, snapshotMs: buildSnapshot(false).championsFinishMs, ev: !!(window.KILL_EVENT || {}) };
        }, [skin, last]);
        await page.waitForTimeout(1500);
        const after = await page.evaluate((id) => ({ corpse: RAGDOLL.corpses().some((c) => c.id === id), skipped: RAGDOLL.state.stats.skippedChampions, phase: world.phase }), start.id);
        if (label.startsWith("champions_")) {
          assert.equal(start.phase, "end", label + ": the round ended on the kill"); assert.ok(Math.abs(start.wait - 8000) < 50, label + ": the 8 s finisher hold is unchanged: " + start.wait); assert.equal(start.snapshotMs <= 8000 && start.snapshotMs > 7000, true, label + ": the snapshot carries the hold");
          assert.equal(after.corpse, false, label + ": the finisher's victim gets no ragdoll: " + JSON.stringify(after));
        } else if (last) assert.ok(start.wait <= 0 || !(start.wait > 0), label + ": no Champions hold: " + start.wait);
        if (!label.startsWith("champions_") && label !== "an ordinary skin, last enemy") assert.equal(after.corpse, true, label + ": the same gun's ordinary kill falls: " + JSON.stringify(after));
        else if (label === "an ordinary skin, last enemy") assert.equal(after.corpse, true, label + ": an ordinary finisher still leaves a body: " + JSON.stringify(after));
        console.log("ragdoll: " + label + " -> " + (after.corpse ? "falls" : "no ragdoll") + (start.wait > 0 ? ", finisher hold " + Math.round(start.wait) + " ms" : ""));
      }
      // ── emotes: the key, the wheel, the camera, what ends it, what stops it starting ──
      await page.evaluate(() => { const st = SETTINGS.quality; room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 99999; ADMIN.freezeAI = true; locked = true; for (const a of world.actors) { a.fireCd = 99999; a.invuln = 999; } });
      await page.waitForTimeout(900);
      await page.evaluate(() => { document.getElementById("pause").hidden = true; const me = myActor(); for (const a of world.actors) if (a !== me) a.pos.set(70 + Math.random() * 5, 0, 70); me.pos.set(0, 0, 0); me.y = 0; me.yaw = 0; me.pitch = 0; });
      const E = (fn, ...a) => page.evaluate(fn, ...a);
      const emoState = () => E(() => { const m = myActor(); return { me: !!EMOTE.state.me, i: EMOTE.state.me ? EMOTE.state.me.i : -1, body: !!m._emo, bodyI: m._emo ? m._emo.i : -1, why: EMOTE.state.why, wheel: !document.getElementById("emo-wheel").hidden, k: EMOTE.state.k }; });
      const calm = () => E(() => { document.getElementById("pause").hidden = true; EMOTE.cancel("test"); EMOTE.resetLimits(); const m = myActor(); m._emo = null; EMOTE.state.me = null; EMOTE.state.k = 0; EMOTE.state.cd = 0; for (const k of ["w", "a", "s", "d", "space", "fire", "ads", "r"]) keys[k] = false; m.alive = true; m.hp = 100; m.armor = 0; m.vy = 0; m.y = 0; m.onGround = true; m.ads = false; m.reloading = 0; m.planting = 0; m.defusing = 0; m.invuln = 999; world.phase = "live"; closeShop(); EMOTE.wheelClose(); });
      assert.deepEqual(await E(() => [EMOTE.on(), KEYMAP.codes("emote"), EMOTE.chosen()]), [true, ["KeyT"], 0], "the emote action is on T and the first emote is chosen");
      // the key: a tap plays the chosen emote
      await page.keyboard.press("KeyT");
      let st = await emoState();
      assert.ok(st.me && st.i === 0 && st.body && st.bodyI === 0, "T plays the chosen emote on my own body: " + JSON.stringify(st));
      await page.waitForTimeout(900);
      st = await emoState(); assert.ok(st.k > 0.5, "the camera went round to the front of the body: " + st.k);
      const cam = await E(() => { const a = myActor(), c = EMOTE.camera(), fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw); return { dist: Math.hypot(c.pos[0] - a.pos.x, c.pos[2] - a.pos.z), front: (c.pos[0] - a.pos.x) * fx + (c.pos[2] - a.pos.z) * fz, groupVisible: a.group.visible, vm: VM.root.visible }; });
      assert.ok(cam.dist > 2 && cam.dist < 3.2 && cam.front > 1.8, "in the open the camera is about 2.7 m in front: " + JSON.stringify(cam));
      assert.ok(cam.groupVisible, "my own body is drawn"); assert.equal(cam.vm, false, "and the hands and gun are not");
      await shot(page, "emote-wave");
      // natural end: it plays out its time and the body returns to the first-person state
      await E(() => { myActor()._emo.t0 = performance.now() - 3500; EMOTE.state.me && (EMOTE.state.me.t0 = performance.now() - 3500); for (let i = 0; i < 30; i++) step(1 / 60); });
      await page.waitForTimeout(700);
      st = await emoState(); assert.ok(!st.me && !st.body, "it ends by itself: " + JSON.stringify(st));
      await E(() => { for (let i = 0; i < 60; i++) step(1 / 60); });
      assert.equal(await E(() => myActor().group.visible), false, "and my body is out of the view again");
      // hold: the wheel
      await calm(); await page.waitForTimeout(300);
      await page.keyboard.down("KeyT"); await page.waitForTimeout(520);
      st = await emoState(); assert.ok(st.wheel, "holding T opens the wheel: " + JSON.stringify(st));
      const wheel = await E(() => [...document.querySelectorAll("#emo-wheel .emo-b")].map((b) => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
      assert.equal(wheel.length, 6); for (const [t, l, tp, w, h] of wheel) assert.ok(l >= 0 && tp >= 0 && l + w <= 1000 && tp + h <= 600, "on the screen: " + [t, l, tp]);
      assert.ok(wheel.every(([t], i) => t.startsWith(String(i + 1))), "numbered 1 to 6: " + JSON.stringify(wheel.map((x) => x[0])));
      await shot(page, "wheel");
      await page.keyboard.press("Digit4");
      st = await emoState(); assert.ok(st.me && st.i === 3 && !st.wheel, "4 picks the dance and the wheel closes: " + JSON.stringify(st));
      await page.keyboard.up("KeyT");
      assert.equal((await emoState()).i, 3, "letting go of T after a pick does nothing more");
      assert.equal(await E(() => EMOTE.chosen()), 3, "and the chosen emote is now the dance");
      // the mouse picks while the pointer is locked (its movement, not its place): up-right is the second one
      await calm(); await page.waitForTimeout(300);
      await page.keyboard.down("KeyT"); await page.waitForTimeout(520);
      await page.mouse.move(500, 300); await page.mouse.move(540, 270, { steps: 4 });
      assert.equal(await E(() => EMOTE.state.sel), 1, "moving up and right selects the second");
      await page.keyboard.up("KeyT");
      st = await emoState(); assert.ok(st.me && st.i === 1 && !st.wheel, "letting go plays the highlighted one: " + JSON.stringify(st));
      // two quick presses: a wheel that stays; a click on a button picks
      await calm(); await page.waitForTimeout(300);
      await page.keyboard.press("KeyT"); await page.waitForTimeout(90); await E(() => { EMOTE.state.me && (EMOTE.cancel("test")); });
      await page.keyboard.press("KeyT");
      st = await emoState(); assert.ok(st.wheel, "two quick presses open the wheel and it stays open: " + JSON.stringify(st));
      await page.waitForTimeout(500); assert.ok((await emoState()).wheel, "still open after the keys are up");
      const bb = await E(() => { const r = document.querySelector('#emo-wheel .emo-b[data-i="5"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.mouse.click(bb[0], bb[1]);
      st = await emoState(); assert.ok(st.me && st.i === 5 && !st.wheel, "a click on the sixth plays the sit: " + JSON.stringify(st));
      await page.waitForTimeout(800); await shot(page, "emote-sit");
      // Escape closes the wheel without playing
      await calm(); await page.waitForTimeout(300);
      await E(() => EMOTE.wheelOpen("sticky")); await page.keyboard.press("Escape");
      st = await emoState(); assert.ok(!st.wheel && !st.me, "Escape closes it: " + JSON.stringify(st));
      // a second tap while one plays stops it
      await calm(); await page.waitForTimeout(300);
      await page.keyboard.press("KeyT"); await page.waitForTimeout(900);
      assert.ok((await emoState()).me); await page.keyboard.press("KeyT");
      st = await emoState(); assert.ok(!st.me && st.why === "key", "a press while it plays stops it: " + JSON.stringify(st));
      console.log("emotes: T plays, holding and pressing twice open the wheel, 1-6, the mouse, a click and Escape work");

      // ── every emote shows on the body: each of the six moves the parts, and they differ ──
      const looks = await E(async () => {
        const out = [], m = myActor(), P = (a) => [a.model.armR.arm, a.model.armR.fore, a.model.armL.arm, a.model.armL.fore, a.model.chest, a.model.neck, a.model.hips, a.model.legL.leg, a.model.legR.leg].map((p) => [p.rotation.x, p.rotation.y, p.rotation.z].map((v) => +v.toFixed(2)).join(",")).join("|") + "|" + m.model.hips.position.y.toFixed(2);
        for (let i = 0; i < 6; i++) {
          EMOTE.resetLimits(); EMOTE.cancel("test"); EMOTE.state.cd = 0; m._emo = null;
          if (!EMOTE.play(i)) { out.push([i, "no"]); continue; }
          m._emo.t0 = performance.now() - 1300; for (let k = 0; k < 3; k++) step(1 / 60); m._emo && (m._emo.t0 = performance.now() - 1300); step(1 / 60);
          out.push([i, P(m)]);
        }
        EMOTE.cancel("test"); m._emo = null;
        return out;
      });
      assert.ok(looks.every((l) => l[1] !== "no"), "all six play: " + JSON.stringify(looks.map((l) => l[0])));
      assert.equal(new Set(looks.map((l) => l[1])).size, 6, "each leaves the body in a different pose");

      // ── the camera stays out of walls ──
      await calm();
      const wall = await E(() => {
        const me = myActor(), c = COLLIDERS.filter((k) => k.h >= 3 && !k.y0 && k.maxX - k.minX >= 5 && k.maxZ - k.minZ >= 0.5 && k.maxZ - k.minZ < 4).sort((p, q) => (q.maxX - q.minX) - (p.maxX - p.minX))[0];
        if (!c) return null;
        // stand 1 m south of the wall's south face, looking at it (forward is -z): the camera would be 2.7 m in front, through the wall
        me.pos.set((c.minX + c.maxX) / 2, 0, c.maxZ + 1.0); me.y = 0; me.yaw = 0; me.pitch = 0; me.vel.set(0, 0, 0);
        const ok = EMOTE.play(0);
        for (let i = 0; i < 60; i++) { step(1 / 60); EMOTE.state.me && (EMOTE.state.me.t0 = performance.now()); }
        const cm = EMOTE.camera();
        const to = [cm.pos[0] - cm.target[0], cm.pos[1] - cm.target[1], cm.pos[2] - cm.target[2]], len = Math.hypot(...to);
        const ray = WALL_T(cm.target[0], cm.target[1], cm.target[2], to[0] / len, to[1] / len, to[2] / len, len + 0.5);
        return { ok, wall: [c.minX, c.maxX, c.minZ, c.maxZ, c.h], me: [me.pos.x, me.pos.z], cam: cm.pos, dist: len, ray, inside: !!collideXZ(cm.pos[0], cm.pos[2], cm.pos[1], 0.05), side: cm.pos[2] > c.maxZ, k: cm.k };
      });
      assert.ok(wall && wall.ok, "found a wall and started: " + JSON.stringify(wall));
      assert.ok(wall.dist < 1.0 && wall.dist >= 0.45, "the camera came in to stop short of the wall: " + JSON.stringify(wall));
      assert.ok(!wall.inside && wall.side, "and is not inside it, on my side: " + JSON.stringify(wall));
      assert.ok(wall.ray >= wall.dist - 0.01, "nothing is between the body and the camera: " + JSON.stringify(wall));
      await page.waitForTimeout(500); await shot(page, "emote-wall");
      // and turning round it: at every angle the camera is outside every collider and the body can be seen along the ray
      const sweep = await E(() => {
        const me = myActor(); let worst = 9, bad = 0;
        for (let k = 0; k < 24; k++) {
          me.yaw = (k / 24) * Math.PI * 2; for (let i = 0; i < 20; i++) { step(1 / 60); EMOTE.state.me && (EMOTE.state.me.t0 = performance.now()); }
          const cm = EMOTE.camera(), to = [cm.pos[0] - cm.target[0], cm.pos[1] - cm.target[1], cm.pos[2] - cm.target[2]], len = Math.hypot(...to);
          const ray = WALL_T(cm.target[0], cm.target[1], cm.target[2], to[0] / len, to[1] / len, to[2] / len, len + 0.3);
          if (collideXZ(cm.pos[0], cm.pos[2], cm.pos[1], 0.02) || ray < len - 0.02) bad++;
          worst = Math.min(worst, ray - len);
        }
        return { bad, worst };
      });
      assert.equal(sweep.bad, 0, "turning all the way round the wall the camera never went into it: " + JSON.stringify(sweep));
      console.log("emotes: in the open the camera is", cam.dist.toFixed(2), "m out; at a wall", wall.dist.toFixed(2), "m, never inside it (24 angles)");

      // ── what ends it ──
      await calm(); await E(() => { const me = myActor(); me.pos.set(0, 0, 0); me.y = 0; me.yaw = 0; me.vel.set(0, 0, 0); });
      const cancels = [
        ["move", () => { keys.w = true; }], ["jump", () => { keys.space = true; }], ["fire", () => { keys.fire = true; }], ["aim", () => { keys.ads = true; }],
        ["ability", () => { useAbility(0); }], ["switch", () => { switchSlot("primary" === myActor().slot ? "secondary" : "secondary"); }], ["reload", () => { startReload(); }],
        ["damage", () => { const me = myActor(); me.invuln = 0; dealDamage(me, 5, false, world.actors.find((a) => a.team !== me.team)); }],
      ];
      for (const [why, act] of cancels) {
        await calm(); await E(() => { const me = myActor(); me.vel.set(0, 0, 0); me.vy = 0; me.y = 0; me.onGround = true; });
        const r = await E(([why, act]) => { EMOTE.resetLimits(); const ok = EMOTE.play(1); const before = !!EMOTE.state.me; (0, eval)("(" + act + ")")(); for (let i = 0; i < 3; i++) step(1 / 60); const m = myActor(); return { ok, before, after: !!EMOTE.state.me, why: EMOTE.state.why, sent: EMOTE.stats.cancelled }; }, [why, act.toString()]);
        assert.ok(r.ok && r.before && !r.after && r.why === why, `${why} ends it: ${JSON.stringify(r)}`);
      }
      // the real keys, too: W moves, Space jumps, R reloads, Q is an ability, 2 is the sidearm
      for (const [why, code] of [["move", "KeyW"], ["jump", "Space"], ["reload", "KeyR"], ["ability", "KeyQ"], ["switch", "Digit2"]]) {
        await calm(); await page.waitForTimeout(200); await E(() => { EMOTE.resetLimits(); EMOTE.play(2); });
        assert.ok((await emoState()).me, "playing before " + code);
        await page.keyboard.down(code); await page.waitForTimeout(150); await page.keyboard.up(code);
        st = await emoState(); assert.ok(!st.me && st.why === why, `the ${code} key ends it as "${why}": ${JSON.stringify(st)}`);
      }
      // it does not start at all: dead, planting, in the shop, moving, a menu open, switched off
      await calm();
      const noStart = await E(() => {
        const me = myActor(), r = {}, tryIt = (name, set, undo) => { EMOTE.resetLimits(); EMOTE.state.cd = 0; set(); r[name] = EMOTE.play(0); EMOTE.cancel("test"); undo(); };
        tryIt("dead", () => { me.alive = false; }, () => { me.alive = true; });
        tryIt("planting", () => { me.planting = 1; }, () => { me.planting = 0; });
        tryIt("defusing", () => { me.defusing = 1; }, () => { me.defusing = 0; });
        tryIt("shop", () => { world.phase = "buy"; toggleShop(); }, () => { closeShop(); world.phase = "live"; });
        tryIt("moving", () => { keys.a = true; }, () => { keys.a = false; });
        tryIt("firing", () => { keys.fire = true; }, () => { keys.fire = false; });
        tryIt("pause", () => { document.getElementById("pause").hidden = false; }, () => { document.getElementById("pause").hidden = true; });
        tryIt("off", () => { SERVER_CFG.game = Object.assign({}, SERVER_CFG.game, { emotes: false }); }, () => { SERVER_CFG.game = Object.assign({}, SERVER_CFG.game, { emotes: true }); });
        EMOTE.resetLimits(); EMOTE.state.cd = 0; r.control = EMOTE.play(0); EMOTE.cancel("test");
        return r;
      });
      assert.deepEqual(noStart, { dead: false, planting: false, defusing: false, shop: false, moving: false, firing: false, pause: false, off: false, control: true }, "every one of them keeps it from starting, and with none of them it starts");
      // the shop in the buy phase: the key does nothing either, and a wheel cannot open
      await E(() => { EMOTE.resetLimits(); world.phase = "buy"; toggleShop(); });
      await page.keyboard.press("KeyT"); await page.keyboard.down("KeyT"); await page.waitForTimeout(500); await page.keyboard.up("KeyT");
      st = await emoState(); assert.ok(!st.me && !st.wheel, "T in the buy phase's shop does nothing: " + JSON.stringify(st));
      await E(() => { closeShop(); world.phase = "live"; });
      // dying ends it and the camera comes back; no ragdoll of mine is hidden by it
      await calm(); await E(() => { EMOTE.resetLimits(); EMOTE.play(3); });
      await page.waitForTimeout(500);
      await E(() => { const me = myActor(); me.invuln = 0; dealDamage(me, 999, false, world.actors.find((a) => a.team !== me.team)); step(1 / 60); });
      st = await emoState(); assert.ok(!st.me && st.k === 0, "dying ends it: " + JSON.stringify(st));
      assert.ok(await E(() => RAGDOLL.corpses().some((c) => c.id === myActor().id)), "and my own body falls");
      console.log("emotes: moving, jumping, firing, aiming, an ability, a weapon switch, reloading, damage and death end it; dead, planting, shop, menu and the switch stop it starting");

      // ── bots answer a kill with an emote, not with an enemy in sight ──
      await page.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 99999; ADMIN.freezeAI = true; locked = true; for (const a of world.actors) a.fireCd = 99999; });
      await page.waitForTimeout(900);
      const bots = await E(async () => {
        const me = myActor(), killer = world.actors.find((a) => a.team !== me.team && isAI(a)), mates = world.actors.filter((a) => a.team === me.team && a !== me);
        const real = Math.random; Math.random = () => 0;
        const out = {};
        // enemies in sight of the killer: no emote
        me.invuln = 999; killer.pos.set(12, 0, -20); killer.y = 0; me.pos.set(12, 0, 0); me.y = 0;
        for (const a of world.actors) { a.alive = true; a.hp = 100; if (a !== killer && a !== me && a.team === killer.team) { a.pos.set(0, 0, -150); } }
        const victim = mates[0]; victim.pos.set(10, 0, -12); victim.y = 0; victim.invuln = 0; victim.armor = 0;
        EMOTE.resetLimits(); killer._emoCd = 0;
        dealDamage(victim, 999, false, killer);
        await new Promise((r) => setTimeout(r, 1400));
        out.seen = !!killer._emo;
        // nobody of the other team in sight (far away, or not there): an emote, and the bot stands still for it
        const victim2 = mates[1]; victim2.pos.set(10, 0, -12); victim2.y = 0; victim2.invuln = 0; victim2.armor = 0; victim2.alive = true; victim2.hp = 100; delete victim2._rag;
        for (const a of world.actors) if (a.team === me.team && a !== victim2) { a.pos.set(0, 0, 150); a.y = 0; }
        me.pos.set(0, 0, 150);
        killer.pos.set(0, 0, -60); killer._emoCd = 0; killer.root = 0;
        dealDamage(victim2, 999, false, killer);
        await new Promise((r) => setTimeout(r, 1500));
        out.alone = killer._emo ? killer._emo.i : -1; out.rooted = killer.root > 0; out.bots = EMOTE.stats.bots;
        Math.random = real;
        return out;
      });
      assert.equal(bots.seen, false, "a bot that sees an enemy does not emote: " + JSON.stringify(bots));
      assert.ok(bots.alone >= 0 && bots.rooted && bots.bots === 1, "a bot with nobody in sight does, and stands still: " + JSON.stringify(bots));
      console.log("emotes: a bot answers a kill when nobody is in sight (and not otherwise)");
      assert.deepEqual(f.errors.slice(base), [], "no page error in the solo part");
      console.log("solo checks passed");
    }
    if (run("net")) {
      // ── two pages over the test transport: a host and a guest (the host attacks, the guest defends) ──
      let signaling;
      await new Promise((resolve) => { PeerServer({ host: "127.0.0.1", port: PORT, path: "/" }, (server) => { signaling = server; resolve(); }); });
      try {
        const quiet = async (p) => { await p.evaluate(() => { window.__render = render; render = () => {}; titleCam = () => {}; }); return p; };
        const prep = (page) => page.evaluate(async (port) => { await ensurePeerLib(); peerOpts = () => ({ host: "127.0.0.1", port, path: "/", secure: false, config: { iceServers: [] } }); }, PORT);
        const host = await noLock(await quiet(await f.page("rdeH", { width: 852, height: 393 }, {}, { quality: "perf" }))), guest = await noLock(await quiet(await f.page("rdeG", { width: 852, height: 393 }, {}, { quality: "perf" })));
        const base = f.errors.length;
        await prep(host); await prep(guest);
        const code = await host.evaluate(async () => { await createRoom(); return NET.room; });
        await guest.evaluate((c) => joinRoom(c), code);
        await host.waitForFunction(() => room.members.size === 2, null, { timeout: 60000 });
        await host.evaluate(() => { room.mode = "std"; room.map = "field"; hostStartMatch(); });
        await guest.waitForFunction(() => "client" === NET.mode && world.actors.length > 0 && myActor(), null, { timeout: 90000 });
        const setup = (p) => p.evaluate(() => { world.roundTime = 99999; ADMIN.freezeAI = true; locked = true; closeShop(); for (const a of world.actors) { a.invuln = 999; a.fireCd = 99999; } });
        await setup(host); await setup(guest);
        await host.waitForTimeout(1000);
        // park the bots and put the two humans apart, in the open, facing each other
        const ids = await host.evaluate(() => {
          const me = myActor(), g = world.actors.find((a) => a.ctrl && "me" !== a.ctrl && "ai" !== a.ctrl && !isAI(a));
          for (const a of world.actors) if (a !== me && a !== g) { a.pos.set(60 + 3 * Math.random(), 0, 60); a.y = 0; }
          me.pos.set(0, 0, 0); g.pos.set(0, 0, -12); me.y = g.y = 0; me.yaw = 0; g.yaw = Math.PI;
          return { host: me.id, guest: g.id, peer: g.ctrl };
        });
        await host.waitForTimeout(800);
        const seen = (page, id) => page.evaluate((id) => { const a = world.actors.find((x) => x.id === id); return a && a._emo ? a._emo.i : -1; }, id);
        const waitSeen = (page, id, i) => page.waitForFunction(([id, i]) => { const a = world.actors.find((x) => x.id === id); return a && a._emo && a._emo.i === i; }, [id, i], { timeout: 10000 });
        const stats = (page) => page.evaluate(() => ({ ...EMOTE.stats }));
        // the host plays: the guest sees the host's body do it
        await host.evaluate(() => { EMOTE.resetLimits(); EMOTE.play(1); });
        await waitSeen(guest, ids.host, 1);
        assert.equal(await guest.evaluate(() => !myActor()._emo), true, "the guest's own body is not emoting");
        // the guest plays: the host sees it (and the guest sees itself at once)
        await guest.evaluate(() => { EMOTE.resetLimits(); EMOTE.play(3); });
        assert.equal(await seen(guest, ids.guest), 3, "the guest plays its own at once");
        await waitSeen(host, ids.guest, 3);
        assert.equal(await seen(host, ids.host), 1, "the host's own is still going");
        await host.evaluate(() => { const g = world.actors.find((a) => a._emo && "me" !== a.ctrl); const me = myActor(); me.pitch = 0; });
        await shot(host, "net-host-sees-guest-emote");
        // the guest ends it (moves): the host's copy stops
        await guest.evaluate(() => { keys.w = true; for (let i = 0; i < 3; i++) step(1 / 60); keys.w = false; });
        await host.waitForFunction((id) => { const a = world.actors.find((x) => x.id === id); return a && (!a._emo || a._emo.cancelT); }, ids.guest, { timeout: 10000 });
        // a played emote ends by itself on every screen
        await host.evaluate(() => { EMOTE.resetLimits(); EMOTE.cancel("test"); });
        await host.waitForTimeout(400);
        console.log("emotes online: the host's reaches the guest, the guest's the host, and a guest that moves stops its copy");

        // the host's checks: the rate limit (2 starts at once, then 1 per 2 s), what is not an emote, the owner's switch, a body that cannot
        await host.evaluate(() => { EMOTE.resetLimits(); world.actors.forEach((a) => (a._emo = null)); });
        const s0 = await stats(host);
        await guest.evaluate(() => { for (let i = 0; i < 6; i++) NET.up.event.send({ t: "emote", e: i % 6 }); });
        await host.waitForFunction((n) => EMOTE.stats.dropped >= n, s0.dropped + 4, { timeout: 8000 });
        const s1 = await stats(host);
        assert.equal(s1.relayed - s0.relayed, 2, "of six at once the host passed on two: " + JSON.stringify([s0, s1]));
        assert.equal(s1.dropped - s0.dropped, 4, "and dropped four");
        await host.evaluate(() => { EMOTE.resetLimits(); });
        const s2 = await stats(host);
        for (const bad of [{ t: "emote", e: 6 }, { t: "emote", e: -2 }, { t: "emote", e: 1.5 }, { t: "emote", e: "2" }, { t: "emote", e: null }, { t: "emote" }, { t: "emote", e: [1] }, { t: "emote", e: { valueOf: 1 } }])
          await guest.evaluate((m) => NET.up.event.send(m), bad);
        await host.waitForTimeout(900);
        const s3 = await stats(host);
        assert.equal(s3.relayed, s2.relayed, "none of the malformed or unknown ones was passed on: " + JSON.stringify([s2, s3]));
        // the stop from a guest that is not emoting is not relayed either
        await host.evaluate(() => world.actors.forEach((a) => (a._emo = null)));
        const s2b = await stats(host);
        await guest.evaluate(() => NET.up.event.send({ t: "emote", e: -1 }));
        await host.waitForTimeout(500);
        assert.equal((await stats(host)).relayed, s2b.relayed, "a stop with nothing to stop is not passed on");
        // a body that is planting or dead does not emote
        await host.evaluate(() => { EMOTE.resetLimits(); const g = world.actors.find((a) => a.ctrl && "me" !== a.ctrl && !isAI(a)); g.planting = 1; });
        await guest.evaluate(() => NET.up.event.send({ t: "emote", e: 2 }));
        await host.waitForTimeout(600);
        assert.equal(await seen(host, ids.guest), -1, "a guest that is planting cannot emote on the host");
        await host.evaluate(() => { const g = world.actors.find((a) => a.ctrl && "me" !== a.ctrl && !isAI(a)); g.planting = 0; EMOTE.resetLimits(); });
        // the owner's switch: the host drops it, a guest that has it switched off plays nothing
        await host.evaluate(() => { SERVER_CFG.game = Object.assign({}, SERVER_CFG.game, { emotes: false }); EMOTE.sync(); });
        const s4 = await stats(host);
        await guest.evaluate(() => NET.up.event.send({ t: "emote", e: 4 }));
        await host.waitForTimeout(700);
        assert.equal(await seen(host, ids.guest), -1, "with the switch off the host drops the guest's emote");
        assert.equal((await stats(host)).relayed, s4.relayed);
        assert.equal(await host.evaluate(() => { EMOTE.play(0); return !!myActor()._emo; }), false, "and plays none of its own");
        assert.equal(await host.evaluate(() => getComputedStyle(document.getElementById("tb-emote")).display), "none", "the touch button is gone");
        await host.evaluate(() => { SERVER_CFG.game = Object.assign({}, SERVER_CFG.game, { emotes: true }); EMOTE.sync(); EMOTE.resetLimits(); });
        console.log("emotes online: the host passes on two of six at once, drops what is malformed, a stop with nothing to stop, a planting body and the switched-off case");

        // an old guest (no emote file) neither breaks nor is broken: a message it does not know is ignored
        const err0 = f.errors.length;
        await guest.evaluate(() => { const o = NET.onEvent; NET.onEvent({ t: "emote", id: "nobody", e: 2 }); NET.onEvent({ t: "emote", id: myActor().id, e: 2 }); NET.onEvent({ t: "emote", id: {}, e: 2 }); NET.onEvent({ t: "emote", e: 99 }); });
        assert.equal(await seen(guest, ids.guest), -1, "an emote for my own body from the wire is not played (I play my own)");
        assert.equal(f.errors.length, err0);

        // ── a ragdoll on the guest's screen: the host kills a bot; the guest makes its own, the way the shot went ──
        const kill = await host.evaluate((ids) => {
          RAGDOLL.clear();
          const me = myActor(), foe = world.actors.find((a) => a.team !== me.team && isAI(a));
          foe.pos.set(8, 0, 8); foe.y = 0; foe.invuln = 0; foe.armor = 0; foe.hp = 1; foe.alive = true;
          me.pos.set(0, 0, 0); me.yaw = -Math.atan2(8, 8) + Math.PI; me.pitch = 0;
          for (let i = 0; i < 6; i++) step(1 / 60);
          dealDamage(foe, 999, false, me);
          return { id: foe.id, mine: !!foe._rag };
        }, ids);
        assert.ok(kill.mine, "the host made its own ragdoll");
        await guest.waitForFunction((id) => RAGDOLL.corpses().some((c) => c.id === id), kill.id, { timeout: 12000 });
        await guest.evaluate(() => { for (let i = 0; i < 60 * 5; i++) step(1 / 60); });
        const sides = await Promise.all([host, guest].map((p) => p.evaluate((id) => { const c = RAGDOLL.corpses().find((x) => x.id === id); return c && { hip: RAGDOLL.hip(c), head: RAGDOLL.head(c), dir: c.dir, frozen: c.body.frozen }; }, kill.id)));
        assert.ok(sides[1], "the guest has a corpse for the same body");
        assert.ok(sides[1].head.y < 0.5, "it lies on the guest's screen: " + JSON.stringify(sides[1]));
        // the killer is at (0,0), the victim at (8,8): both screens push it toward +x +z
        const dot = (c) => (c.hip.x - 8 + (c.hip.z - 8)) / Math.SQRT2;
        assert.ok(dot(sides[0]) > 0.2 && dot(sides[1]) > 0.1, "both pushed it away from the killer: " + JSON.stringify([dot(sides[0]), dot(sides[1])]));
        await shot(guest, "net-guest-corpse");
        // the guest's own body: killed by the host, it falls on the guest's own screen
        const mine = await host.evaluate((ids) => { const g = world.actors.find((a) => a.id === ids.guest), me = myActor(); g.invuln = 0; g.armor = 0; g.pos.set(0, 0, -12); dealDamage(g, 999, false, me); return !!g._rag; }, ids);
        assert.ok(mine);
        await guest.waitForFunction((id) => RAGDOLL.corpses().some((c) => c.id === id), ids.guest, { timeout: 12000 });
        console.log("ragdoll online: a guest makes its own for the host's kill and for its own death, pushed the same way");
        assert.deepEqual(f.errors.slice(base), [], "no page error in the net part");
      } finally { signaling.close(); }
    }

    if (run("touch")) {
      // ── a phone: the button is in the layout editor, taps play, a long press and two taps open the list ──
      const phone = await noLock(await f.page("rdeP", { width: 740, height: 360 }, { hasTouch: true, isMobile: true }, { quality: "mobile" }));
      const base = f.errors.length;
      await phone.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; world.roundTime = 99999; ADMIN.freezeAI = true; document.body.classList.add("touching"); for (const a of world.actors) { a.fireCd = 99999; a.invuln = 999; } locked = true; });
      await phone.waitForTimeout(1200);
      await phone.evaluate(() => { const me = myActor(); for (const a of world.actors) if (a !== me) a.pos.set(70, 0, 70); me.pos.set(0, 0, 0); me.y = 0; });
      const box = (id) => phone.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), getComputedStyle(document.getElementById(id)).display]; }, id);
      const [l, t, w, h, d] = await box("tb-emote");
      assert.ok(w >= 40 && h >= 40 && l >= 0 && t >= 0 && l + w <= 740 && t + h <= 360 && d !== "none", `tb-emote sits on the screen: ${[l, t, w, h, d]}`);
      // not on top of the chat and ping buttons
      for (const id of ["tb-chat", "tb-ping"]) { const [l2, t2, w2, h2] = await box(id); assert.ok(l + w <= l2 || l2 + w2 <= l || t + h <= t2 || t2 + h2 <= t, `${id} and tb-emote do not overlap`); }
      await shot(phone, "touch-740");
      assert.ok(await phone.evaluate(() => TOUCHLAY.parts.includes("tb-emote")), "it is a part the layout editor moves");
      await phone.evaluate(() => { togglePause(true); TOUCHLAY.open(); });
      await phone.waitForTimeout(400);
      const reach = await phone.evaluate(() => { const e = document.getElementById("tb-emote"), r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { part: e.classList.contains("mbe-part"), reach: hit === e || e.contains(hit), w: r.width }; });
      assert.ok(reach.part && reach.reach && reach.w > 30, "in the layout editor and reachable there: " + JSON.stringify(reach));
      await phone.evaluate(() => { TOUCHLAY.set("tb-emote", [0.5, 0.5, 1.2]); });
      await phone.waitForTimeout(200);
      const moved = await phone.evaluate(() => { const r = document.getElementById("tb-emote").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      assert.ok(Math.abs(moved[0] - 370) < 26 && Math.abs(moved[1] - 180) < 26, "the editor moved it: " + moved);
      await phone.evaluate(() => { TOUCHLAY.reset(); TOUCHLAY.close(false); togglePause(false); locked = true; });
      await phone.waitForTimeout(500);
      // a tap plays the chosen emote
      await phone.evaluate(() => { EMOTE.resetLimits(); EMOTE.state.cd = 0; });
      // (a tap is handled when the page gets to it, and frames are slow in this browser: each check waits for its state)
      const settle = (fn, arg) => phone.waitForFunction(fn, arg, { timeout: 3000 }).then(() => !0, () => !1);
      await phone.tap("#tb-emote");
      await settle(() => !!EMOTE.state.me);
      let st = await phone.evaluate(() => ({ me: EMOTE.state.me ? EMOTE.state.me.i : -1, wheel: !document.getElementById("emo-wheel").hidden }));
      assert.deepEqual(st, { me: 0, wheel: false }, "a tap plays the first emote");
      await phone.waitForTimeout(900); await shot(phone, "touch-emote");
      // a tap while it plays stops it (the wave lasts 3 s and a screenshot here can take most of that: if it has ended, it is
      // started again, so the tap below meets a playing emote)
      await phone.evaluate(() => { if (!EMOTE.state.me) { EMOTE.resetLimits(); EMOTE.state.cd = 0; EMOTE.play(EMOTE.chosen()); } EMOTE.state.why = ""; });
      assert.ok(await phone.evaluate(() => !!EMOTE.state.me), "an emote is playing before the tap");
      await phone.tap("#tb-emote");
      // stopped by the tap ("key"), not run out
      assert.equal(await settle(() => !EMOTE.state.me && EMOTE.state.why === "key"), true, "a tap while it plays stops it: " + JSON.stringify(await phone.evaluate(() => ({ me: !!EMOTE.state.me, why: EMOTE.state.why }))));
      // two taps: the list, and a tap on one plays it
      await phone.evaluate(() => { EMOTE.resetLimits(); EMOTE.state.cd = 0; window.__t = 0; });
      await phone.evaluate(() => {
        const e = document.getElementById("tb-emote"), r = e.getBoundingClientRect(), t = new Touch({ identifier: 2, target: e, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
        const tap = () => { for (const type of ["touchstart", "touchend"]) e.dispatchEvent(new TouchEvent(type, { touches: type === "touchstart" ? [t] : [], targetTouches: type === "touchstart" ? [t] : [], changedTouches: [t], bubbles: true, cancelable: true })); };
        tap(); EMOTE.cancel("test"); tap();
      });
      await settle(() => !document.getElementById("emo-wheel").hidden);
      st = await phone.evaluate(() => ({ wheel: !document.getElementById("emo-wheel").hidden }));
      assert.ok(st.wheel, "two quick taps open the list");
      const items = await phone.evaluate(() => [...document.querySelectorAll("#emo-wheel .emo-b")].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom), b.textContent]; }));
      for (const [a, b, c, e, tx] of items) assert.ok(a >= 0 && b >= 0 && c <= 740 && e <= 360, `${tx} is on the 740x360 screen: ${[a, b, c, e]}`);
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const A = items[i], B = items[j]; assert.ok(A[2] <= B[0] || B[2] <= A[0] || A[3] <= B[1] || B[3] <= A[1], "list items do not overlap: " + [A[4], B[4]]); }
      for (const [a, b, c, e] of items) assert.ok(c - a >= 44 && e - b >= 40, "big enough to tap: " + [c - a, e - b]);
      await shot(phone, "touch-wheel");
      await phone.tap('#emo-wheel .emo-b[data-i="2"]');
      await settle(() => !!EMOTE.state.me && document.getElementById("emo-wheel").hidden);
      st = await phone.evaluate(() => ({ me: EMOTE.state.me ? EMOTE.state.me.i : -1, wheel: !document.getElementById("emo-wheel").hidden }));
      assert.deepEqual(st, { me: 2, wheel: false }, "a tap on the third plays the salute and closes the list");
      // a long press opens the list too
      await phone.evaluate(() => { EMOTE.cancel("test"); EMOTE.resetLimits(); EMOTE.state.cd = 0; });
      await phone.waitForTimeout(700);
      const c = await phone.evaluate(() => { const r = document.getElementById("tb-emote").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await phone.evaluate(([x, y]) => { const e = document.getElementById("tb-emote"), t = new Touch({ identifier: 1, target: e, clientX: x, clientY: y }); e.dispatchEvent(new TouchEvent("touchstart", { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true })); }, c);
      await phone.waitForTimeout(650);
      assert.equal(await phone.evaluate(() => !document.getElementById("emo-wheel").hidden), true, "a long press opens the list");
      await phone.evaluate(([x, y]) => { const e = document.getElementById("tb-emote"), t = new Touch({ identifier: 1, target: e, clientX: x, clientY: y }); e.dispatchEvent(new TouchEvent("touchend", { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true })); }, c);
      assert.equal(await phone.evaluate(() => !document.getElementById("emo-wheel").hidden), true, "and it stays open after the finger lifts");
      await phone.evaluate(() => EMOTE.wheelClose());
      // the touch controls that end it: a tap on the fire button
      await phone.evaluate(() => { EMOTE.resetLimits(); EMOTE.state.cd = 0; EMOTE.play(4); });
      await phone.tap("#tb-jump");
      assert.equal(await phone.evaluate(() => !EMOTE.state.me), true, "a tap on a touch control ends it");
      // the owner's switch hides the button
      await phone.evaluate(() => { SERVER_CFG.game = Object.assign({}, SERVER_CFG.game, { emotes: false }); EMOTE.sync(); });
      assert.equal(await phone.evaluate(() => getComputedStyle(document.getElementById("tb-emote")).display), "none", "the button goes with the switch");
      console.log("phone: the button is on the screen and in the layout editor; a tap plays, a long press and two taps open a list that fits 740x360");
      assert.deepEqual(f.errors.slice(base), [], "no page error in the touch part");
    }

  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
