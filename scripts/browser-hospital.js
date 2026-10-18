const assert = require("node:assert/strict"), { fixture } = require("./browser-fixture");
// 폐병원 (5v5, three floors): listed in the full-size class, the whole building is walkable for people
// (every open doorway on every floor, the four stairs, nothing cut off by a prop) and for the bots on the
// ground floor (every node, both sites and both spawns reachable on their grid), the entrances stay shut
// while buying, the draw calls stay low, and everything is taken down when another map loads.
(async () => {
  const f = await fixture();
  try {
    const dir = process.env.SHOT_DIR;
    const page = await f.page("hospital", { width: 1280, height: 720 }, {}, {quality:'perf'});
    await page.evaluate(() => { titleCam = () => {}; });
    const load = await page.evaluate(() => {
      room.mode = "std"; room.map = "hospital"; startGame(AGENTS[0], false); closeShop();
      return { key: CUR_MAP_KEY, listed: MAP_LIST.some((m) => m.key === "hospital"), size: MAP_SIZE("hospital"), cat: MAP_CAT("hospital"), colliders: COLLIDERS.length, meshes: HOSPITAL.meshes.length, mats: new Set(HOSPITAL.meshes.map((m) => m.material.uuid)).size, lights: HOSPITAL.lights.length, slabs: COLLIDERS.filter((c) => c.y0 > 0).length };
    });
    console.log(JSON.stringify(load));
    assert.equal(load.key, "hospital"); assert.ok(load.listed, "in the map list"); assert.equal(load.size, 5); assert.equal(load.cat, "full");
    assert.ok(load.colliders > 1000 && load.slabs > 500, "walls, slabs and props are colliders");
    assert.ok(load.mats <= 40 && load.meshes <= 300, "merged by material and cut into chunks: " + load.meshes + " meshes of " + load.mats + " materials");
    assert.ok(load.lights >= 3 && load.lights <= 5, "a handful of real lights (every light is paid on every pixel)");

    // the entrances are barriered while buying (checked below): start the round first
    await page.waitForFunction(() => { world.phase = "live"; return !HOSPITAL.barriers.list; }, null, { timeout: 15000 });
    // ── people: every stair climbs, every open doorway can be walked through ──
    const walk = await page.evaluate(() => {
      const P = HOSPITAL_PLAN, C = P.cols, R = P.rows, ex = (c) => -60 + 2.5 * c, ez = (r) => -40 + 2.5 * r, cx = (c) => ex(c + 0.5), cz = (r) => ez(r + 0.5);
      const out = { stairs: [], edges: 0, bad: [], skipped: 0, unreached: [] };
      // the stairs: walk straight up the middle from the low end
      for (const [from, c, r] of P.stairs) {
        const pos = new THREE.Vector3(ex(c + 1), 0, ez(r + 1) + 1.2);
        let y = from * 4;
        for (let i = 0; i < 90; i++) y = moveWithSlide(pos, 0, -0.2, y, PR);
        out.stairs.push({ from, c, r, y });
      }
      const zone = (n, c, r) => (c < 0 || r < 0 || c >= C || r >= R ? " " : P.levels[n].f[r][c]);
      const floorCell = (n, c, r) => { const z = zone(n, c, r); return z !== " " && z !== "0" && z !== "9"; };
      const key = (n, c, r) => n + ":" + c + "," + r;
      const free = (n, c, r) => floorCell(n, c, r) && "s" !== zone(n, c, r) && !collideXZ(cx(c), cz(r), n * 4, PR);
      // moves between free cells are cached; a doorway that cannot be walked is reported
      const moves = new Map();
      const can = (n, c, r, c2, r2) => {
        const k = key(n, c, r) + ">" + key(n, c2, r2);
        if (moves.has(k)) return moves.get(k);
        const pos = new THREE.Vector3(cx(c), n * 4, cz(r));
        moveWithSlide(pos, cx(c2) - cx(c), cz(r2) - cz(r), n * 4, PR);
        const ok = Math.hypot(pos.x - cx(c2), pos.z - cz(r2)) < 0.25;
        moves.set(k, ok);
        return ok;
      };
      const open = (n, c, r) => {
        const L = P.levels[n], v = [];
        r > 0 && +L.H[r][c] === 0 && v.push([c, r - 1]);
        r < R - 1 && +L.H[r + 1][c] === 0 && v.push([c, r + 1]);
        c > 0 && +L.V[r][c] === 0 && v.push([c - 1, r]);
        c < C - 1 && +L.V[r][c + 1] === 0 && v.push([c + 1, r]);
        return v;
      };
      for (let n = 0; n < 3; n++) for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (!free(n, c, r)) continue;
        for (const [a, b] of open(n, c, r)) {
          if (!free(n, a, b)) { out.skipped++; continue; }
          out.edges++;
          can(n, c, r, a, b) || (out.bad.length < 20 && out.bad.push([n, c, r, a, b]));
        }
      }
      // reach: from the attackers' side over verified moves, taking each stair where it joins two floors
      const links = new Map();
      for (const [from, c, r] of P.stairs) for (const w of [0, 1]) {
        const lo = key(from, c + w, r + 1), hi = key(from + 1, c + w, r - 4);
        (links.get(lo) || links.set(lo, []).get(lo)).push(hi); (links.get(hi) || links.set(hi, []).get(hi)).push(lo);
      }
      const start = [0, Math.floor((P.attackSpawn[0] + 60) / 2.5), Math.floor((P.attackSpawn[1] + 40) / 2.5)];
      const seen = new Set([key(...start)]), q = [start];
      while (q.length) {
        const [n, c, r] = q.pop();
        const next = open(n, c, r).filter(([a, b]) => free(n, a, b) && can(n, c, r, a, b)).map(([a, b]) => [n, a, b]);
        for (const k of links.get(key(n, c, r)) || []) { const [m, rest] = k.split(":"), [a, b] = rest.split(","); next.push([+m, +a, +b]); }
        for (const [m, a, b] of next) { const k = key(m, a, b); if (!seen.has(k) && floorCell(m, a, b) && free(m, a, b)) { seen.add(k); q.push([m, a, b]); } }
      }
      for (let n = 0; n < 3; n++) for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (free(n, c, r) && !seen.has(key(n, c, r)) && out.unreached.length < 20) out.unreached.push([n, c, r]);
      out.reached = seen.size;
      return out;
    });
    console.log("stairs", JSON.stringify(walk.stairs), "edges", walk.edges, "skipped", walk.skipped, "reached cells", walk.reached);
    for (const s of walk.stairs) assert.equal(s.y, (s.from + 1) * 4, "stair from level " + s.from + " at " + s.c + "," + s.r + " climbs a whole floor");
    assert.deepEqual(walk.bad, [], "every doorway between free cells can be walked through");
    assert.deepEqual(walk.unreached, [], "every free cell on every floor is reachable from the lot");

    // ── bots: the ground floor on their own grid ──
    const grid = await page.evaluate(() => {
      const M = MAPS.hospital, cell = (x, z) => [Math.floor((x - GRID.minX) / GRID.cell), Math.floor((z - GRID.minZ) / GRID.cell)];
      const [c0, r0] = nearestWalkable(...cell(M.attackSpawn.x, M.attackSpawn.z));
      const seen = new Uint8Array(GRID.cols * GRID.rows), q = [[c0, r0]]; seen[r0 * GRID.cols + c0] = 1;
      while (q.length) { const [c, r] = q.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = c + dc, b = r + dr; if (a >= 0 && b >= 0 && a < GRID.cols && b < GRID.rows && GRID.walk[b * GRID.cols + a] === 1 && !seen[b * GRID.cols + a]) { seen[b * GRID.cols + a] = 1; q.push([a, b]); } } }
      const out = { blocked: [], cut: [], paths: {} };
      const pts = Object.entries(M.nodes).concat([["defendSpawn", M.defendSpawn]], M.sites.map((s) => ["site" + s.id, s]));
      for (const [k, v] of pts) { const [c, r] = cell(v.x, v.z); GRID.walk[r * GRID.cols + c] === 1 || out.blocked.push(k); seen[r * GRID.cols + c] || out.cut.push(k); }
      for (const s of M.sites) { const p = findPath(M.attackSpawn.x, M.attackSpawn.z, s.x, s.z); let len = 0; for (let i = 1; i < p.length; i++) len += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); out.paths[s.id] = [p.length, Math.round(len), +Math.hypot(p[p.length - 1].x - s.x, p[p.length - 1].z - s.z).toFixed(1)]; }
      const dp = findPath(M.attackSpawn.x, M.attackSpawn.z, M.defendSpawn.x, M.defendSpawn.z); out.paths.D = [dp.length];
      out.walkable = +(GRID.walk.reduce((s, v) => s + v, 0) / GRID.walk.length).toFixed(2);
      return out;
    });
    console.log(JSON.stringify(grid));
    assert.deepEqual(grid.blocked, [], "nodes stand on open ground"); assert.deepEqual(grid.cut, [], "everything reachable for the bots");
    for (const id of ["A", "B"]) assert.ok(grid.paths[id][1] > 60 && grid.paths[id][1] < 400 && grid.paths[id][2] < 3.5, "a path into site " + id + " (waypoints, metres, end distance): " + grid.paths[id]);

    // ── the entrances are shut while buying ──
    const gates = await page.evaluate(() => {
      const M = MAPS.hospital, gx = [-41.25, 0, 38.75], z = 40;
      world.phase = "buy"; return new Promise((res) => setTimeout(() => {
        const shut = gx.map((x) => !!collideXZ(x, z, 0.3, 0.75));
        world.phase = "live";
        setTimeout(() => res({ shut, open: gx.map((x) => !collideXZ(x, z, 0.3, 0.75)) }), 400);
      }, 400));
    });
    console.log("entrances", JSON.stringify(gates));
    assert.deepEqual(gates.shut, [true, true, true], "closed while buying");
    assert.deepEqual(gates.open, [true, true, true], "open when the round is live");

    // ── floors switch off when they cannot be seen, and come back at the atrium, on decks, outside ──
    const fl = await page.evaluate(async () => {
      const wait = () => new Promise((r) => setTimeout(r, 700)), me = myActor(), vis = (lv) => HOSPITAL.chunks.filter((m) => m.userData.lv === lv && m.visible).length;
      const put = async (x, y, z) => { me.pos.set(x, y, z); me.y = y; player.pos.set(x, y, z); player.y = y; world.phase = "live"; camera.position.set(x, y + 1.7, z); for (const t of HOSPITAL.tick) t(0, 0); };
      const out = {};
      await put(-33.75, 0, -8.75); out.groundRoom = [vis(0), vis(1), vis(2)];
      await put(0, 0, 5); out.atrium = [vis(0), vis(1), vis(2)];
      await put(0, 0, 52); out.lot = [vis(0), vis(1), vis(2)];
      await put(-38.75, 8, -8.75); out.thirdRoom = [vis(0), vis(1), vis(2)];
      await put(-20, 8, -33); out.deck = [vis(0), vis(1), vis(2)];
      out.total = [0, 1, 2].map((lv) => HOSPITAL.chunks.filter((m) => m.userData.lv === lv).length);
      return out;
    });
    console.log("floors", JSON.stringify(fl));
    assert.equal(fl.groundRoom[2], 0, "in a ground-floor room the third floor is not drawn");
    assert.ok(fl.groundRoom[0] > 0 && fl.groundRoom[1] > 0, "the floors you can see are");
    assert.equal(fl.atrium[2], fl.total[2], "at the atrium everything is drawn");
    assert.equal(fl.lot[0], fl.total[0], "outside everything is drawn");
    assert.equal(fl.thirdRoom[0], 0, "in a third-floor room the ground floor is not drawn");
    assert.equal(fl.deck[0], fl.total[0], "on a deck everything is drawn");

    // ── a look: the atrium from the balcony and from the floor ──
    if (dir) {
      const at = async (name, x, y, z, yaw, pitch) => {
        await page.evaluate(([x, y, z, yaw, pitch]) => { const me = myActor(); me.pos.set(x, y, z); me.y = y; player.pos.set(x, y, z); player.y = y; player.yaw = yaw; player.pitch = pitch; world.phase = "live"; me.invuln = 999; }, [x, y, z, yaw, pitch]);
        await page.waitForTimeout(1400);
        await page.screenshot({ path: dir + "/hospital-" + name + ".png" });
      };
      await at("atrium", 0, 0, 22, 0, -0.02); await at("balcony", -18, 4, 22, -0.35, -0.28); await at("lobby", 0, 0, 36, 0, 0); await at("bridge", -14, 8, 5, -1.57, -0.2);
    }

    // ── the graphics presets: more light and sharper surfaces on the stronger ones, the bank freed afterwards ──
    const tiers = await page.evaluate(() => {
      const out = {}, was = SETTINGS.quality;
      for (const q of ["mobile", "perf", "visual", "ultra", "perf"]) {
        setQuality(q);
        const mats = new Set(HOSPITAL.meshes.map((m) => m.material)), has = (k) => [...mats].some((m) => m[k] && m[k].image);
        const wall = [...mats].find((m) => m.map && m.map.image && m.map.image.width >= 256 && m.normalMap !== void 0 && m.vertexColors);
        const sizes = [...mats].filter((m) => m.vertexColors && m.map && m.map.image).map((m) => m.map.image.width);
        out[q + (out[q] ? "2" : "")] = { lights: HOSPITAL.lights.length, mapMax: Math.max(...sizes), normal: has("normalMap"), rough: has("roughnessMap"), aniso: Math.max(...[...mats].filter((m) => m.vertexColors && m.map).map((m) => m.map.anisotropy)), key: HOSPITAL.key, bankMs: HOSPITAL.bankMs };
      }
      setQuality(was);
      return out;
    });
    console.log("tiers", JSON.stringify(tiers));
    assert.deepEqual([tiers.mobile.lights, tiers.perf.lights, tiers.visual.lights, tiers.ultra.lights], [2, 3, 7, 9], "lights follow the preset");
    assert.ok(tiers.mobile.mapMax === tiers.perf.mapMax && tiers.perf.mapMax < tiers.visual.mapMax, "sharper surfaces on visual presets: " + [tiers.mobile.mapMax, tiers.perf.mapMax, tiers.visual.mapMax]);
    assert.ok(!tiers.mobile.normal && !tiers.perf.normal && tiers.visual.normal && tiers.visual.rough && tiers.ultra.normal, "relief and gloss maps only from the visual preset");
    assert.ok(tiers.visual.aniso >= tiers.perf.aniso, "filtering is not weaker on the stronger preset");
    assert.ok(!tiers.perf2.normal && tiers.perf2.mapMax === tiers.perf.mapMax, "going back to a weaker preset frees the stronger textures");
    assert.ok(tiers.visual.bankMs < 6000, "the textures of the strongest preset are made quickly (" + tiers.visual.bankMs + " ms; reading a GPU canvas back used to take 14 s)");

    // ── taking it down ──
    const gone = await page.evaluate(() => { const previous=new Set(COLLIDERS);loadMap("glacier"); return { key: CUR_MAP_KEY, lights: HOSPITAL.lights.length, meshes: HOSPITAL.meshes.length, retained: COLLIDERS.filter(c=>previous.has(c)).length, built: HOSPITAL.key }; });
    assert.deepEqual(gone, { key: "glacier", lights: 0, meshes: 0, retained: 0, built: null }, "hospital meshes, lights and collider objects leave the next map; its own building floors remain valid");
    assert.deepEqual(f.errors, []);
    console.log("hospital: listed, 4 stairs, " + walk.edges + " doorways, every cell reachable, bots reach both sites, entrances shut while buying, cleaned up");
  } finally { await f.browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
