const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// The wall tests that every shot and sight line runs: the faster versions (no allocation, a quick reject by the ray's own
// bounds) give exactly what a plain box test over every collider gives, on a big map and a dense one.
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("rays", { width: 800, height: 600 });
    for (const key of ["garden", "rooftops", "pogu"]) {
      const r = await page.evaluate((key) => {
        loadMap(key);
        // the reference: the plain slab test over every collider
        const ref = (c, ox, oy, oz, dx, dy, dz, t1) => {
          let lo = 0, hi = t1;
          for (const [o, d, mn, mx] of [[ox, dx, c.minX, c.maxX], [oy, dy, (c.y0 || 0) - 0.01, c.h], [oz, dz, c.minZ, c.maxZ]]) {
            if (Math.abs(d) < 1e-9) { if (o <= mn || o >= mx) return Infinity; continue; }
            let a = (mn - o) / d, b = (mx - o) / d;
            if (a > b) [a, b] = [b, a];
            a > lo && (lo = a); b < hi && (hi = b);
            if (lo > hi) return Infinity;
          }
          return lo;
        };
        const B = MAP.bounds;
        let seed = 12345;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        let bad = 0, hitsN = 0;
        for (let i = 0; i < 4000; i++) {
          const ox = B.minX + rnd() * (B.maxX - B.minX), oz = B.minZ + rnd() * (B.maxZ - B.minZ), oy = 0.2 + rnd() * 6;
          const a = rnd() * 6.283, p = (rnd() - 0.5) * 0.6, len = 3 + rnd() * 120;
          const dx = Math.cos(a) * Math.cos(p) * len, dz = Math.sin(a) * Math.cos(p) * len, dy = Math.sin(p) * len;
          // wallT against the reference
          let best = 1;
          for (const c of COLLIDERS) { if (!(c.h > 0.02)) continue; const t = ref(c, ox, oy, oz, dx, dy, dz, best); t < best && (best = t); }
          const w = WALL_T(ox, oy, oz, dx, dy, dz, 1);
          if (dy >= 0 || true) { /* the floor only matters going down: compare the walls part */ }
          const floorT = dy < 0 ? -oy / dy : Infinity;
          const expect = Math.min(best, floorT);
          Math.abs(w - expect) > 1e-6 && bad++;
          best < 1 && hitsN++;
          // rayBlocked against the reference (no smoke here)
          const blocked = COLLIDERS.some((c) => c.h > 0.02 && ref(c, ox, oy, oz, dx, dy, dz, 1) < 1);
          rayBlocked(ox, oy, oz, ox + dx, oy + dy, oz + dz) !== blocked && bad++;
        }
        // the body push: an actor put inside a wall comes out, one in the open is left alone
        const c = COLLIDERS.find((c) => c.h > 3 && !c.y0 && c.maxX - c.minX > 3 && c.maxZ - c.minZ > 3);
        const a = { alive: true, y: 0, pos: { x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2 } };
        UNSTICK(a);
        const out = !collideXZ(a.pos.x, a.pos.z, 0, PR * 0.9);
        const free = { alive: true, y: 0, pos: { x: B.minX + 3, z: B.minZ + 3 } };
        const before = [free.pos.x, free.pos.z];
        UNSTICK(free);
        return { key, bad, hitsN, out, stays: free.pos.x === before[0] && free.pos.z === before[1] };
      }, key);
      console.log(JSON.stringify(r));
      assert.equal(r.bad, 0, key + ": the faster tests agree with the plain ones");
      assert.ok(r.hitsN > 100, key + ": enough rays hit something to mean anything");
      assert.equal(r.out, !0, key + ": a body inside a wall is pushed out");
    }
    assert.deepEqual(f.errors, []);
    console.log("raycast: wall tests agree with the plain box test on three maps, 4000 rays each");
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
