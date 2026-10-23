const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Blocky characters: every agent's body is drawn as cubes. The check builds every agent with the cubes on and off and
// asserts: each character piece is cubes (or a fist, which the knife rig finds by its sphere, or a box that was already
// one), the gun is untouched, every piece keeps its place, turn and size (the rig moves as before), the cubes have fewer
// triangles than the round body, and switching the setting off gives the round body back. Hit detection works on
// positions, so it is not part of the shape and is covered by the existing aim and knife checks.
(async () => {
  const f = await fixture();
  const errors = [];
  try {
    const page = await f.page("blocky", { width: 1280, height: 720 });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.mouse.click(640, 360);
    await page.evaluate(() => { titleCam = () => {}; room.mode = "std"; room.map = "glacier"; startGame(AGENTS[0], false); closeShop(); world.phase = "live"; ADMIN.freezeAI = true; });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const out = { agents: AGENTS.length, bad: [], round: 0, moved: [], tris: { on: 0, off: 0 }, fists: { on: 0, off: 0 }, sample: null };
      const kinds = (g) => { const k = {}; g.traverse((o) => { if (o.isMesh) k[o.geometry.type] = (k[o.geometry.type] || 0) + 1; }); return k; };
      const tris = (g) => { let t = 0; g.traverse((o) => { if (o.isMesh) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return t; };
      const placement = (m) => { const a = []; m.group.traverse((o) => { if (o.isMesh) a.push([o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z].map((v) => +v.toFixed(6))); }); return a; };
      for (const ag of AGENTS) {
        window.BLOCKY_OFF = true;
        const off = buildFighter(0x3a7bd5, ag);
        window.BLOCKY_OFF = false;
        const on = buildFighter(0x3a7bd5, ag);
        const kOff = kinds(off.group);
        let cubesOff = 0;
        off.group.traverse((o) => { if (o.isMesh && o.geometry.userData.blocky) cubesOff++; });
        out.round += cubesOff;
        out.tris.off += tris(off.group);
        out.tris.on += tris(on.group);
        // every piece on the body is cubes, a fist, or a box that was already one; the gun is left alone
        const fistOf = (g) => g.type === "SphereGeometry" && g.parameters && Math.abs(g.parameters.radius - 0.043) < 0.006;
        const skip = new Set(); on.gun && on.gun.traverse((o) => skip.add(o));
        on.group.traverse((o) => {
          if (!o.isMesh || skip.has(o)) return;
          const g = o.geometry;
          if (fistOf(g)) out.fists.on++;
          if (!(g.userData.blocky || g.type === "BoxGeometry" || fistOf(g))) out.bad.push(ag.id + ":" + g.type);
        });
        off.group.traverse((o) => { if (o.isMesh && fistOf(o.geometry)) out.fists.off++; });
        const a = placement(off), b = placement(on);
        if (a.length !== b.length || a.some((row, i) => row.some((v, k) => Math.abs(v - b[i][k]) > 1e-6))) out.moved.push(ag.id);
        if (!out.sample && ag.id === "neon_agent") out.sample = { off: kOff, on: kinds(on.group) };
      }
      window.BLOCKY_OFF = false;
      // two fighters of one agent: clearing one frees only its own cubes, not the other's or the kept ones
      const one = buildFighter(0x3a7bd5, AGENTS[0]), two = buildFighter(0xd53a3a, AGENTS[0]);
      const own = (m) => { const s = new Set(); m.group.traverse((o) => o.isMesh && o.geometry.userData.blocky && s.add(o.geometry)); return s; };
      const a1 = own(one), a2 = own(two);
      let freed2 = 0, freedKept = 0;
      a2.forEach((g) => g.addEventListener("dispose", () => freed2++));
      BLOCKY.cache.forEach((h) => h.geo.addEventListener("dispose", () => freedKept++));
      chDispose(one.group);
      out.shared = { first: a1.size, overlap: [...a1].filter((g) => a2.has(g)).length, freedOther: freed2, freedKept };
      chDispose(two.group);
      return out;
    });
    console.log(JSON.stringify({ agents: r.agents, cubesWithOff: r.round, tris: r.tris, fists: r.fists, bad: r.bad.slice(0, 5), moved: r.moved, sample: r.sample }));
    assert.equal(r.round, 0, "with the setting off there are no cubes: the round body is back");
    assert.deepEqual(r.bad, [], "every piece is cubes, a fist or a box");
    assert.deepEqual(r.moved, [], "every piece keeps its place, turn and size");
    assert.ok(r.tris.on < r.tris.off, "the cubes have fewer triangles than the round body (" + r.tris.on + " < " + r.tris.off + ")");
    assert.equal(r.fists.on, r.fists.off, "the fists the knife rig finds are the same with and without the cubes");
    console.log(JSON.stringify({ shared: r.shared }));
    assert.ok(r.shared.first > 0 && r.shared.overlap === 0, "each fighter owns its own cubes");
    assert.equal(r.shared.freedOther, 0, "clearing one fighter does not free another fighter's cubes");
    assert.equal(r.shared.freedKept, 0, "nor the kept ones the next fighter is copied from");
    assert.deepEqual(errors, [], "no page errors");
    console.log("Blocky characters: " + r.agents + " agents built as cubes with the same placement, the fists kept for the knife rig, the gun untouched, and the round body back when switched off");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
