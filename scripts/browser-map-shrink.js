const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The big 5v5 maps drawn at three quarters: each one is built once at the old size (MAP_SHRINK = 1) and once
// at the new, the same way a match builds it. The bounds and the spawn-to-site distances are three quarters,
// every spawn slot still walks to every site (and the walk is shorter), no spawn stands inside a wall, the
// houses, towers and switch doors are all still there, and nothing is left outside the smaller bounds.
const MAPS5 = ["glacier", "neon", "dunes", "garden", "market", "jungle"];
async function measure(f, id, shrink) {
  const page = await f.page(id, { width: 960, height: 540 }, {}, { beforeLoad: (p) => (shrink ? Promise.resolve() : p.addInitScript(() => (window.MAP_SHRINK = 1))) });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.mouse.click(480, 270);
  const out = {};
  for (const key of MAPS5) {
    out[key] = await page.evaluate((key) => {
      titleCam = () => {};
      room.mode = "std";
      room.map = key;
      startGame(AGENTS[0], false);
      closeShop();
      ADMIN.freezeAI = true;
      const b = MAP.bounds, w = b.maxX - b.minX, d = b.maxZ - b.minZ;
      const len = (p, sx, sz, x, z) => {
        if (!p || !p.length) return null;
        const last = p[p.length - 1];
        if (Math.hypot(last.x - x, last.z - z) > 4) return null;
        let s = 0, px = sx, pz = sz;
        for (const q of p) (s += Math.hypot(q.x - px, q.z - pz)), (px = q.x), (pz = q.z);
        return s;
      };
      const walks = [], stuck = [];
      for (const side of ["atk", "def"])
        for (let i = 0; i < TEAM_SIZE; i++) {
          const s = spawnPointFor(side, i);
          if (collideXZ(s.x, s.z, 0, 0.4)) stuck.push(side + i);
          for (const site of MAP.sites) walks.push(len(findPath(s.x, s.z, site.x, site.z), s.x, s.z, site.x, site.z));
        }
      const atk = MAP.attackSpawn, far = MAP.sites.map((s) => Math.hypot(s.x - atk.x, s.z - atk.z));
      let outside = 0;
      const pad = 40;
      if ("undefined" != typeof DECOR)
        DECOR.children.forEach((c) => {
          const p = c.position;
          (p.x < b.minX - pad || p.x > b.maxX + pad || p.z < b.minZ - pad || p.z > b.maxZ + pad) && outside++;
        });
      // where a body (radius PR) can walk on the ground from the attackers' spawn, on a half-metre grid
      const C = 0.5, cols = Math.ceil(w / C), rows = Math.ceil(d / C), seen = new Uint8Array(cols * rows);
      const cell = (x, z) => [Math.floor((x - b.minX) / C), Math.floor((z - b.minZ) / C)];
      const free = (i, j) => !collideXZ(b.minX + (i + 0.5) * C, b.minZ + (j + 0.5) * C, 0.3, PR);
      // start on the free cell nearest the spawn (the spawn point itself can sit on a step)
      let [si, sj] = cell(atk.x, atk.z);
      search: for (let r = 0; r <= 8; r++) for (let a = -r; a <= r; a++) for (let c = -r; c <= r; c++) if (free(si + a, sj + c)) { si += a; sj += c; break search; }
      const q = [si + sj * cols];
      seen[q[0]] = 1;
      while (q.length) {
        const n = q.pop(), i = n % cols, j = (n / cols) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, c = j + dj, m = a + c * cols;
          if (a < 0 || c < 0 || a >= cols || c >= rows || seen[m]) continue;
          seen[m] = 2;
          if (free(a, c)) (seen[m] = 1), q.push(m);
        }
      }
      let area = 0, open = 0;
      for (let m = 0; m < seen.length; m++) seen[m] === 1 && area++;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) free(i, j) && open++;
      const near = (x, z) => {
        const [i, j] = cell(x, z);
        for (let r = 0; r <= 6; r++) for (let a = -r; a <= r; a++) for (let c = -r; c <= r; c++) if (seen[i + a + (j + c) * cols] === 1) return true;
        return false;
      };
      const walkTo = MAP.sites.map((s) => near(s.x, s.z)).concat([near(MAP.defendSpawn.x, MAP.defendSpawn.z)]);
      const built = window.BUILDINGS && BUILDINGS.built ? (Array.isArray(BUILDINGS.built) ? BUILDINGS.built.length : Object.keys(BUILDINGS.built).length) : 0;
      const gim = window.MAP_GIMMICKS ? MAP_GIMMICKS.door.length + MAP_GIMMICKS.tp.length + MAP_GIMMICKS.zip.length : 0;
      return { w, d, walks, stuck, far, outside, built, gim, colliders: COLLIDERS.length, area: area * C * C, reach: area / open, walkTo };
    }, key);
  }
  await page.context().close();
  return { out, errors };
}
(async () => {
  const f = await fixture();
  try {
    const before = await measure(f, "shrinkoff", false), after = await measure(f, "shrinkon", true);
    const rows = {};
    for (const key of MAPS5) {
      const a = before.out[key], b = after.out[key];
      const ok = (v) => v.filter((x) => x != null);
      const sum = (v) => ok(v).reduce((s, x) => s + x, 0);
      rows[key] = { size: [a.w.toFixed(0) + "x" + a.d.toFixed(0), b.w.toFixed(0) + "x" + b.d.toFixed(0)], walk: [sum(a.walks).toFixed(0), sum(b.walks).toFixed(0)], reached: [ok(a.walks).length, ok(b.walks).length, b.walks.length], stuck: b.stuck, outside: b.outside, built: [a.built, b.built], gim: [a.gim, b.gim], colliders: [a.colliders, b.colliders] };
      console.log(key, JSON.stringify(rows[key]), JSON.stringify(a.walks.map((x) => x && Math.round(x))), JSON.stringify(b.walks.map((x) => x && Math.round(x))));
      assert.ok(Math.abs(b.w / a.w - 0.75) < 0.01 && Math.abs(b.d / a.d - 0.75) < 0.01, key + ": the bounds are three quarters");
      b.far.forEach((x, i) => assert.ok(Math.abs(x / a.far[i] - 0.75) < 0.02, key + ": spawn to site is three quarters"));
      const lost = a.walks.map((x, i) => (x != null && b.walks[i] == null ? i : -1)).filter((i) => i >= 0);
      assert.deepEqual(lost, [], key + ": every spawn slot that reached a site still does");
      const both = a.walks.map((x, i) => (x != null && b.walks[i] != null ? i : -1)).filter((i) => i >= 0);
      const was = both.reduce((s, i) => s + a.walks[i], 0), now = both.reduce((s, i) => s + b.walks[i], 0);
      rows[key].sameWalks = (now / was).toFixed(2);
      assert.ok(now < was * 0.85, key + ": the walks are shorter (" + (now / was).toFixed(2) + ")");
      rows[key].area = [a.area.toFixed(0), b.area.toFixed(0), (b.area / a.area).toFixed(3)];
      assert.deepEqual(b.walkTo, a.walkTo, key + ": a body walks from the attackers' spawn to the same sites and the defenders' spawn");
      rows[key].reach = [a.reach.toFixed(3), b.reach.toFixed(3)];
      assert.ok(b.area / a.area > 0.5625 * 0.9, key + ": the ground a body can walk is about three quarters squared (" + (b.area / a.area).toFixed(3) + ")");
      assert.ok(b.reach > a.reach - 0.01, key + ": as much of the open ground is reachable from the spawn as before, nothing walled off (" + a.reach.toFixed(3) + " -> " + b.reach.toFixed(3) + ")");
      assert.deepEqual(b.stuck, [], key + ": no spawn inside a wall");
      assert.equal(b.outside, 0, key + ": nothing left outside the smaller map");
      assert.equal(b.built, a.built, key + ": the same houses and towers");
      assert.equal(b.gim, a.gim, key + ": the same switch doors and teleporters");
    }
    console.log(JSON.stringify(rows));
    assert.deepEqual(before.errors, [], "no page errors at the old size");
    assert.deepEqual(after.errors, [], "no page errors");
    console.log("Map shrink: six big 5v5 maps at three quarters, every spawn still walks to every site and the walks are shorter, no spawn in a wall, houses and gimmicks all there");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
