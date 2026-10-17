const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// Two-storey buildings and watchtowers: every map but the field and the duels has two or more houses and a tower; each house's stair
// is really climbed with the game's own movement (ground -> upper floor), the roof cannot be reached, no spawn, site or waypoint is cut off
// (the bots' own grid), and the colliders carry the floors (y0).
(async () => {
  const f = await fixture();
  try {
    const dir = process.env.SHOT_DIR || "/tmp";
    const page = await f.page("bld", { width: 1280, height: 720 });
    const maps = await page.evaluate(() => MAP_LIST.map((m) => m.key));
    const skip = ["field", "d01", "d03", "d04"];
    const want = maps.filter((k) => !skip.includes(k));
    assert.equal(maps.length, 20, "the map count stays the same");
    const res = [];
    for (const key of want) {
      const r = await page.evaluate((key) => {
        loadMap(key);
        const P = BUILDINGS.plan[key], out = { key, houses: P ? P.b.length : 0, towers: P ? P.t.length : 0 };
        const m = MAP;
        // 1. the colliders: floors with a bottom, stairs
        out.floors = COLLIDERS.filter((c) => c.y0 > 0).length;
        // 2. climb every house's stair and every tower's stair with the game's own stepping
        const climb = (x, z, dx, dz, steps, top) => {
          const e = { x, z };
          let y = 0;
          for (let i = 0; i < steps; i++) y = moveWithSlide(e, dx * 0.12, dz * 0.12, y, PR);
          return { y: Math.round(y * 100) / 100, x: e.x, z: e.z };
        };
        out.up = [];
        for (const [x, z, L, S, rot, flip] of P ? P.b : []) {
          // from the stair's foot (u 1.3, across the middle of the strip) along u
          const v = 0.5 + 0.1 + 1.1, w0 = BUILDINGS.toWorld([1.3, 1.3, v, v, 0, 0], x, z, L, S, rot, flip);
          const px = w0[0], pz = w0[4], dx = rot ? 0 : 1, dz = rot ? 1 : 0;
          const a = climb(px, pz, dx, dz, 130);
          out.up.push(a.y);
        }
        for (const [x, z, rot] of P ? P.t : []) {
          const v = 2.2, w0 = BUILDINGS.toWorld([0, 0.05, v, v, 0, 0], x, z, 9.4, 4.4, rot);
          const a = climb(w0[0], w0[4], rot ? 0 : 1, rot ? 1 : 0, 110);
          out.up.push(a.y);
        }
        // 3. nothing cut off: the bots' grid reaches the defenders' spawn, the sites and the waypoints from the attackers' spawn
        const toCell = (p) => [Math.floor((p.x - GRID.minX) / GRID.cell), Math.floor((p.z - GRID.minZ) / GRID.cell)];
        const seen = new Uint8Array(GRID.cols * GRID.rows), start = nearestWalkable(...toCell(m.attackSpawn)), q = [start[1] * GRID.cols + start[0]];
        seen[q[0]] = 1;
        let n = 0;
        while (q.length) {
          const i = q.pop(); n++;
          const cx = i % GRID.cols, cz = (i / GRID.cols) | 0;
          for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = cx + a, z = cz + b; if (x < 0 || z < 0 || x >= GRID.cols || z >= GRID.rows) continue; const j = z * GRID.cols + x; if (GRID.walk[j] && !seen[j]) { seen[j] = 1; q.push(j); } }
        }
        const near = (p) => { const [cx, cz] = toCell(p); for (let r = 0; r < 8; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const x = cx + a, z = cz + b; if (x >= 0 && z >= 0 && x < GRID.cols && z < GRID.rows && seen[z * GRID.cols + x]) return true; } return false; };
        out.reach = { def: near(m.defendSpawn), sites: (m.sites || []).every(near), nodes: Object.values(m.nodes || {}).filter((p) => !near(p)).length };
        // 4. nothing stands on a spawn or a site
        const inside = (p) => COLLIDERS.some((c) => c.kind && p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ);
        out.clear = !inside(m.attackSpawn) && !inside(m.defendSpawn) && (m.sites || []).every((s) => !inside(s));
        return out;
      }, key);
      res.push(r);
    }
    console.log(JSON.stringify(res.map((r) => [r.key, r.houses, r.towers, r.floors, r.up.join("/"), r.reach.nodes, r.reach.def && r.reach.sites, r.clear])));
    for (const r of res) {
      assert.ok(r.houses >= 2, r.key + ": two or more houses, has " + r.houses);
      assert.ok(r.towers >= 1 || r.key === "train", r.key + ": a tower (the narrow train has houses only)");
      assert.ok(r.floors >= 6 * r.houses, r.key + ": floors carry a bottom");
      assert.ok(r.up.every((y) => y >= 3.3 && y <= 3.6), r.key + ": every stair climbed to the upper floor: " + r.up.join(","));
      assert.ok(r.reach.def && r.reach.sites && r.reach.nodes === 0, r.key + ": nothing cut off " + JSON.stringify(r.reach));
      assert.ok(r.clear, r.key + ": no spawn or site inside a building");
    }
    assert.deepEqual(f.errors, []);
    console.log("buildings: " + want.length + " maps with two-storey houses and a tower, stairs climbed, nothing cut off");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
