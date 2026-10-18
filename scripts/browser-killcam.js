const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Dying shows who killed you: for two seconds the view is on the killer (turned to where I fell, a few metres away,
// looking at them), their name floats over their head with their title beside it, the agent and the gun are under the
// name, and then the usual death flow goes on. A death with nobody to blame (the world) shows nothing. A title that is
// not in the catalogue is not shown. The world is stepped by hand: the headless browser draws too slowly for real time.
(async () => {
  const f = await fixture();
  const errors = [];
  try {
    const page = await f.page("killcam", { width: 1280, height: 720 });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.mouse.click(640, 360);
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const out = {}, me = myActor() || player, foe = world.actors.find((a) => a.team !== me.team && a.alive && isAI(a));
      const nm = (a) => a.name || (a.agent && a.agent.name);
      const plate = () => document.getElementById("kc-plate");
      const aim = () => { camera.updateMatrixWorld(); const d = camera.getWorldDirection(new camera.position.constructor()), to = camera.position.clone().set(foe.pos.x, (foe.y || 0) + 1.3, foe.pos.z).sub(camera.position); const L = to.length(); return { dot: d.dot(to.normalize()), L }; };
      // the title: a bot gets one from the catalogue, the same every time; a bad id gets none
      out.botTitle = KILLCAM.titleOf(foe) && KILLCAM.titleOf(foe).s;
      out.same = KILLCAM.titleOf(foe).id === KILLCAM.titleOf(foe).id;
      out.badId = KILLCAM.titleOf({ id: "x", ctrl: "p", __ttl: "marksman" }) && KILLCAM.titleOf({ id: "x", ctrl: "p", __ttl: "marksman" }).id;
      out.noBad = KILLCAM.titleOf({ id: "x", ctrl: "p", __ttl: "rm -rf" });
      // a guest's title goes in the actor list the host sends (only a real title; anything else is dropped)
      const guest = world.actors.find((x) => x !== me && x.team === me.team), mode = NET.mode, ctrl = guest.ctrl, was = room.started;
      try {
        NET.mode = "host"; guest.ctrl = "peer-x"; room.started = false;
        NET.onAction("peer-x", { t: "hello", name: "손님", ttl: "marksman" });
        out.manifestTitle = actorManifest()[world.actors.indexOf(guest)].ttl;
        NET.onAction("peer-x", { t: "hello", name: "손님", ttl: "<img src=x onerror=1>" });
        out.manifestBad = actorManifest()[world.actors.indexOf(guest)].ttl || "";
      } finally { NET.mode = mode; guest.ctrl = ctrl; room.started = was; }
      // killed by the world: nothing
      killActor(me, null);
      out.worldSpectate = me.spectateT;
      for (let i = 0; i < 4; i++) deathCam(0.1);
      out.worldActive = KILLCAM.active();
      me.alive = true; me.hp = 100; me.spectateT = 0;
      // killed by a foe
      me.pos.x = foe.pos.x + 12; me.pos.z = foe.pos.z; me.y = foe.y;
      killActor(me, foe);
      out.spectateT = me.spectateT;
      deathCam(0.05);
      out.active = KILLCAM.active();
      for (let i = 0; i < 8; i++) deathCam(0.05);
      const a1 = aim();
      out.dot = a1.dot; out.dist = a1.L;
      const p = plate();
      out.on = p.classList.contains("on");
      out.name = p.querySelector(".kc-name").textContent; out.want = nm(foe);
      out.title = p.querySelector(".kc-title") && p.querySelector(".kc-title").textContent;
      out.wantTitle = KILLCAM.titleOf(foe) && COSMETICS.name(KILLCAM.titleOf(foe));
      out.sub = p.querySelector(".kc-sub") && p.querySelector(".kc-sub").textContent;
      out.px = [parseFloat(p.style.left), parseFloat(p.style.top)];
      // an ally is not taken over while the kill view runs
      out.takeOver = takeOverAlly(null);
      out.stillDead = !me.alive;
      // and it goes by itself
      for (let i = 0; i < 40; i++) deathCam(0.05);
      out.after = KILLCAM.active();
      out.onAfter = plate().classList.contains("on");
      return out;
    });
    console.log(JSON.stringify(r));
    assert.equal(r.botTitle, "title", "a bot wears a title from the catalogue");
    assert.ok(r.same, "the same bot, the same title");
    assert.equal(r.badId, "marksman", "a guest's real title is shown");
    assert.equal(r.noBad, null, "an unknown title is not");
    assert.equal(r.manifestTitle, "marksman", "a guest's title is in the actor list");
    assert.equal(r.manifestBad, "", "a title that is not in the catalogue is dropped");
    assert.equal(r.worldActive, false, "a death with nobody to blame shows no kill view");
    assert.ok(r.spectateT >= 2, "the death view lasts at least as long as the kill view (" + r.spectateT + ")");
    assert.ok(r.active && r.on, "the kill view and the plate are up");
    assert.ok(r.dot > 0.97, "the camera looks at the killer (" + r.dot.toFixed(3) + ")");
    assert.ok(r.dist > 1 && r.dist < 4.6, "a few metres away (" + r.dist.toFixed(1) + " m)");
    assert.equal(r.name, r.want, "their name is on the plate");
    assert.equal(r.title, r.wantTitle, "their title is beside it");
    assert.ok(r.sub && r.sub.length > 2, "the agent and the gun are under it (" + r.sub + ")");
    assert.ok(r.px[0] > 100 && r.px[0] < 1180 && r.px[1] > 20 && r.px[1] < 700, "the plate is on screen over the head (" + r.px + ")");
    assert.equal(r.takeOver, false, "no ally is taken over while it runs");
    assert.ok(r.stillDead, "still dead");
    assert.equal(r.after, false, "it ends by itself after two seconds");
    assert.equal(r.onAfter, false, "the plate goes");
    assert.deepEqual(errors, [], "no page errors");
    console.log("Kill cam: two seconds on the killer with name and title over their head, agent and gun under it, no ally taken over meanwhile, nothing for a death by the world");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
