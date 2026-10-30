const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
const CB = require("../js/colorblind.js");
// Colour-blind mode (pause menu > screen effects): the outline of the other side, the dots on the minimap and the tactical map,
// the scoreboard and roster team colours, the hit marker and the damage flash follow the mode. Desktop and phone landscape.
const shot = (n) => (process.env.SHOT_DIR || "test-results") + "/colorblind-" + n + ".png";
const toRgb = (h) => (typeof h === "number" ? [(h >> 16) & 255, (h >> 8) & 255, h & 255] : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const near = (a, b, t = 8) => a.every((v, i) => Math.abs(v - b[i]) <= t);
(async () => {
  const f = await fixture();
  try {
    for (const [name, vp, ctx] of [["desk", { width: 1280, height: 720 }, {}], ["phone", { width: 852, height: 393 }, { hasTouch: true, isMobile: true }]]) {
      const page = await f.page("cb" + name, vp, ctx);
      await page.evaluate(() => { room.mode = "std"; room.map = "field"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
      await page.waitForTimeout(1500);
      for (const mode of CB.MODES) {
        const P = CB.PAL[mode];
        // the setting through the menu, as a player does it
        await page.evaluate(() => togglePause(true));
        await page.click('#pause .pz-tabs button[data-tab=fx]');
        await page.click(`#st-cb-opts [data-cb=${mode}]`);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("lgp_set")).colorblind), mode, "the choice is stored");
        assert.equal(await page.evaluate(() => document.querySelector("#st-cb-opts .on").dataset.cb), mode);
        if (mode === "rg") await page.screenshot({ path: shot(name + "-menu") });
        await page.evaluate(() => togglePause(false));
        await page.waitForTimeout(400);
        const r = await page.evaluate(() => {
          const me = myActor() || player, mates = world.actors.filter((a) => a !== me && a.team === me.team && a.alive), foes = world.actors.filter((a) => a.team !== me.team && a.alive);
          const b = MAP.bounds, put = (a, dx, dz) => { a.pos.x = me.pos.x + dx; a.pos.z = me.pos.z + dz; a.revealed = 99; };
          put(mates[0], -14, -10); put(foes[0], 14, -10);
          const sample = (ctx, cv, a) => { const x = ((a.pos.x - b.minX) * cv.width) / (b.maxX - b.minX), y = ((a.pos.z - b.minZ) * cv.height) / (b.maxZ - b.minZ); return [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3); };
          // the match keeps its people in world.actors; the old drawing of both maps reads world.entities, so it gets them for one drawing
          const keep = world.entities;
          world.entities = world.actors.slice();
          drawMini();
          world.entities = keep;
          const mini = { ally: sample(mctx, document.getElementById("mini"), mates[0]), enemy: sample(mctx, document.getElementById("mini"), foes[0]) };
          // the shape an enemy is drawn with: a circle (arc) as ever, a diamond (lines) while a mode is on
          const ops = [], proto = CanvasRenderingContext2D.prototype, fd = Object.getOwnPropertyDescriptor(proto, "fillStyle");
          let cur = "";
          Object.defineProperty(mctx, "fillStyle", { configurable: true, get() { return fd.get.call(this); }, set(v) { cur = String(v); fd.set.call(this, v); } });
          const enemyColor = CB.get("mapEnemy");
          for (const m of ["arc", "lineTo"]) mctx[m] = function (...a) { cur === enemyColor && ops.push(m); return proto[m].apply(this, a); };
          world.entities = world.actors.slice();
          drawMini();
          world.entities = keep;
          delete mctx.fillStyle; delete mctx.arc; delete mctx.lineTo;
          const corner = ops;
          syncActorModel(mates[0]); syncActorModel(foes[0]);
          const glow = { ally: TEAM_GLOW.ALLY.userData.uTeam.value.getHex(), enemy: TEAM_GLOW.ENEMY.userData.uTeam.value.getHex(), onAlly: mates[0].model._teamMeshes.some((o) => o.material === TEAM_GLOW.ALLY), onEnemy: foes[0].model._teamMeshes.some((o) => o.material === TEAM_GLOW.ENEMY) };
          QOL.openBoard("sb", true);
          const col = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).color : null; };
          const board = { mine: col(".bd-team.mine h4"), foe: col(".bd-team.foe h4") };
          const roster = { mine: col("#rs-n-mine"), foe: col("#rs-n-foe") };
          hitMarker(true);
          const head = document.getElementById("cross").style.filter;
          const d = document.getElementById("dmg"); d.classList.add("hit");
          const hurt = getComputedStyle(d).boxShadow;
          return { mini, corner, glow, board, roster, head, hurt, attr: document.documentElement.dataset.cb || "off" };
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: shot(`${name}-${mode}-board`) });
        await page.evaluate(() => { QOL.closeBoard(); document.getElementById("dmg").classList.remove("hit"); });
        const pc = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
        assert.equal(r.attr, mode);
        assert.ok(near(r.mini.ally, toRgb(P.mapAlly), 4), `${name} ${mode} minimap ally ${r.mini.ally}`);
        assert.ok(near(r.mini.enemy, toRgb(P.mapEnemy), 4), `${name} ${mode} minimap enemy ${r.mini.enemy}`);
        assert.ok(r.corner.length > 0, "an enemy was drawn");
        assert.ok("off" === mode ? r.corner.every((m) => "arc" === m) : r.corner.every((m) => "lineTo" === m), `${name} ${mode}: enemies are circles when off and diamonds while a mode is on (${r.corner})`);
        assert.equal(r.glow.ally, P.outAlly); assert.equal(r.glow.enemy, P.outEnemy);
        assert.ok(r.glow.onAlly && r.glow.onEnemy, "the characters wear the two outline materials");
        assert.deepEqual(pc(r.board.mine), toRgb(P.uiAlly), `${name} ${mode} scoreboard allies ${r.board.mine}`);
        assert.deepEqual(pc(r.board.foe), toRgb(P.uiFoe), `${name} ${mode} scoreboard enemies ${r.board.foe}`);
        assert.deepEqual(pc(r.roster.mine), "off" === mode ? toRgb("#4ade80") : toRgb(P.uiAlly), `${name} ${mode} roster allies ${r.roster.mine}`);
        assert.deepEqual(pc(r.roster.foe), "off" === mode ? toRgb("#ff5566") : toRgb(P.uiFoe), `${name} ${mode} roster enemies ${r.roster.foe}`);
        assert.deepEqual(pc(r.head), toRgb(P.head), `${name} ${mode} headshot marker ${r.head}`);
        assert.deepEqual(pc(r.hurt), P.hurt.split(",").map(Number), `${name} ${mode} damage flash ${r.hurt}`);
        // the tactical map: the colours its dots are drawn with
        const tac = await page.evaluate(() => {
          const log = [], d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "fillStyle");
          Object.defineProperty(tctx, "fillStyle", { configurable: true, get() { return d.get.call(this); }, set(v) { log.push(String(v)); d.set.call(this, v); } });
          const keep = world.entities;
          world.entities = world.actors.slice();
          drawTac();
          world.entities = keep;
          delete tctx.fillStyle;
          return log;
        });
        assert.ok(tac.includes(P.mapAlly) && tac.includes(P.mapEnemy), `${name} ${mode} tactical map colours ${[...new Set(tac)]}`);
        if (mode === "rg") await page.screenshot({ path: shot(name + "-rg-hud") });
      }
      await page.evaluate(() => { SETTINGS.colorblind = "off"; saveSettings(); CB.apply(); });
    }
    assert.deepEqual(f.errors, []);
    console.log("colour-blind: outline, minimap, scoreboard, roster, hit marker and damage flash follow the mode on desktop and phone");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
