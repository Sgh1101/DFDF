const assert = require('node:assert/strict'), fs = require('node:fs'), zlib = require('node:zlib');
const { fixture } = require('./browser-fixture');
// The event map 사막 마을 (Kour.io map7, js/kour-map.js): its own box in the map pickers and the room lobby while the event is open, loaded only
// when picked, drawn with the original's textures and materials, walls that stop bodies and bullets, a ramp that is climbed, spawns on the floor,
// both sites on the bots' graph, bots that walk from the attackers' spawn to each site, a standard match, the minimaps, the graphics presets.
// Explored in Chromium first on a laptop and on a phone (touch): test-results/kour-*.png.
const PHONE = { isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' };
const KEY = 'desert_town';
(async () => {
  const f = await fixture(); fs.mkdirSync('test-results', { recursive: true });
  try {
    // what the source file says it needs: the materials its renderers use, and which of them carry a texture
    const src = JSON.parse(zlib.gunzipSync(fs.readFileSync('assets/maps/kour/map7.json.gz')));
    const used = new Set(); (function walk(ns) { for (const n of ns || []) { for (const m of n.materials || []) used.add(m); walk(n.children); } })(src.nodes);
    const textured = [...used].filter((m) => src.materials[m] && src.materials[m].texture), textures = new Set(textured.map((m) => src.materials[m].texture));
    assert.ok(textured.length >= 14 && textures.size === 16, 'setup: the source has ' + textured.length + ' textured materials and ' + textures.size + ' textures');

    // ── desktop: the event box, lazy loading, the pick ──
    const page = await f.page('kourdesk', { width: 1280, height: 720 }, {}, { quality: 'perf', bootTimeout: 120000 });
    await page.waitForFunction(() => window.SERVER_CFG && SERVER_CFG.eventMap !== undefined, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => KOUR_MAP.status), 'idle');
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.includes('/assets/maps/kour/')).length), 0, 'no map file is fetched on ordinary entry');
    await page.locator('#go-play').click();
    await page.waitForFunction(() => document.querySelectorAll('#sel-maps button').length > 0);
    // a laptop folds the map chips into one button that opens a sheet
    const openPick = async () => { if (await page.locator('#sel-pick').isVisible() && !(await page.locator('#sel-event').isVisible())) await page.locator('#sel-pick').click(); };
    await openPick();
    const box = await page.evaluate(() => ({
      key: window.EVENT_MAP_KEY, first: MAP_LIST[0].key, n: MAP_LIST.length, boxText: document.getElementById('sel-event')?.textContent,
      chipInBox: !!document.querySelector('#sel-event .lb-map'), chipsInList: [...document.querySelectorAll('#sel-maps .lb-map')].some((b) => b.textContent.trim() === '사막 마을'),
      tabs: [...document.querySelectorAll('.map-cats button')].map((b) => b.textContent), size: MAPS.desert_town.size,
    }));
    console.log('box', JSON.stringify(box));
    assert.equal(box.key, KEY); assert.equal(box.first, KEY, 'first in the list'); assert.ok(box.chipInBox && !box.chipsInList, 'its chip is in the event box, not among the regular chips');
    assert.match(box.boxText, /이벤트.*사막 마을.*11월 30일까지/, 'the box names it and the closing day');
    assert.equal(box.size, 5);
    const tabs = Object.fromEntries(box.tabs.map((t) => [t.replace(/\d+$/, ''), +t.match(/\d+$/)[0]]));
    assert.equal(tabs['전체'], box.n - 1, 'the tabs do not count the event map');
    await page.screenshot({ path: 'test-results/kour-select-desktop.png' });
    // choosing it: the box's chip, the map comes
    await page.locator('#sel-event .lb-map').click();
    await page.waitForFunction(() => KOUR_MAP.status === 'ready', null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => room.map), KEY);
    assert.ok(await page.evaluate(() => document.querySelector('#sel-event .lb-map').classList.contains('on')), 'the chip shows it is chosen');
    // a regular tab never moves the choice to the event map or away from it
    await openPick();
    await page.locator('.map-cats button[data-cat="small"]').click();
    assert.equal(await page.evaluate(() => room.map), KEY, 'the small-maps tab leaves the event map chosen');
    await openPick();
    await page.locator('.map-cats button[data-cat=""]').click();
    if (await page.locator('#sel-pick').isVisible() && await page.locator('#sel-event').isVisible()) await page.locator('#sel-pick').click();
    await page.locator('#sel-go').click({ timeout: 120000 });
    await page.waitForFunction(() => CUR_MAP_KEY === 'desert_town' && !!myActor() && KOUR_MAP.active, null, { timeout: 120000 });
    await page.evaluate(() => { closeShop(); ADMIN.freezeAI = true; world.phase = 'live'; world.roundTime = 999; });

    // ── the look: the original's textures, materials and shader ──
    const look = await page.evaluate(() => {
      const mats = new Set(); for (const m of KOUR_MAP.meshes) mats.add(m.material);
      const withMap = [...mats].filter((m) => m.map), missing = withMap.filter((m) => !(m.map.image && m.map.image.width > 0));
      const grid = [...mats].filter((m) => m.onBeforeCompile && m.customProgramCacheKey && m.customProgramCacheKey() === 'kour-grid-v1');
      renderer.render(scene, camera);
      const prog = renderer.info.programs.filter((p) => p.cacheKey && p.cacheKey.includes('kour-grid-v1')).length;
      return { stats: KOUR_MAP.renderStats, drawn: mats.size, withMap: withMap.length, missing: missing.length, images: new Set(withMap.map((m) => m.map.image.src.split('/').pop().split('?')[0])).size, grid: grid.length, prog, fog: !!scene.fog, bg: scene.background.getHex(), floorShown: floor.visible };
    });
    console.log('look', JSON.stringify(look));
    assert.equal(look.missing, 0, 'no texture without its picture');
    assert.equal(look.images, 16, 'all 16 source textures are on the materials');
    assert.ok(look.withMap >= textured.length, 'textured materials in the scene: ' + look.withMap + ' of ' + textured.length);
    assert.ok(look.grid >= 6 && look.prog >= 1, 'the Grid shader (world-space projection) is on the original grid materials');
    assert.equal(look.floorShown, false, 'the engine floor is hidden: the town has its own');
    assert.equal(look.stats.triangles, 13710, 'every triangle of the source is drawn once');
    assert.ok(look.stats.meshes < 200, 'merged by material and square: ' + look.stats.meshes + ' meshes');

    // ── collision ──
    const col = await page.evaluate(() => {
      const a = myActor(), out = {};
      // 1. a wall stops a body, and a shot: a wall with room to walk up to it
      let wall = null;
      for (const c of COLLIDERS) {
        if (c.kour !== 'w' || c.h - c.y0 < 3 || c.maxZ - c.minZ < 3 || c.maxX - c.minX > 1) continue;
        const z = (c.minZ + c.maxZ) / 2, x = c.minX - PR - .3;
        for (const y of KOUR_MAP.levels(x, z)) {
          if (c.y0 > y + .1 || c.h < y + 2.5 || collideXZ(x, z, y + .02, PR)) continue;
          const p = { x, z }; let yy = y; for (let i = 0; i < 100; i++) yy = moveWithSlide(p, .1, 0, yy, PR);
          // the ray stops at the nearest box face on its line (a neighbouring box of the same wall can stand a little closer than the one picked)
          let first = Infinity; for (const q of COLLIDERS) if (q.h > .02 && q.maxX > x && z >= q.minZ && z <= q.maxZ && y + 1 >= q.y0 && y + 1 <= q.h) first = Math.min(first, Math.max(q.minX, x) - x);
          wall = { x, z, y, stopped: p.x + PR <= c.minX + .001, ray: WALL_T(x, y + 1, z, 1, 0, 0, 10), distance: first, wallX: c.minX }; break;
        }
        if (wall) break;
      }
      out.wall = wall;
      if (wall) {
        const e = world.actors.find((q) => q.team !== a.team); e.pos.set(wall.wallX + 1.5, wall.y, wall.z); e.y = wall.y; e.hp = 100; e.invuln = 0; e.alive = true;
        actorHitscan(a, new T.Vector3(wall.x, wall.y + 1.2, wall.z), new T.Vector3(1, 0, 0), { range: 20, dmg: 50, hs: 1 }, false);
        out.enemyHP = e.hp;
      }
      // 2. the way from the defenders' start (the pit) up to the attackers' (a deck): walked with the body's own movement
      const D = MAP.defendSpawn, A = MAP.attackSpawn, route = findPath(D.x, D.z, A.x, A.z, D.y);
      a.pos.set(D.x, D.y, D.z); a.y = D.y; a.vy = 0; a.onGround = true; a.root = 0; a.slow = 1; a.speedBuff = 1; a.ads = false;
      let reached = 0, maxY = a.y, minY = a.y;
      for (const p of route) {
        for (let n = 0; n < 160 && Math.hypot(p.x - a.pos.x, p.z - a.pos.z) > .16; n++) { a.yaw = Math.atan2(-(p.x - a.pos.x), -(p.z - a.pos.z)); a.input.mv = [0, -1]; a.input.btn = 0; simMove(a, .0125); maxY = Math.max(maxY, a.y); minY = Math.min(minY, a.y); }
        if (Math.hypot(p.x - a.pos.x, p.z - a.pos.z) > .3) break; reached++;
      }
      a.input.mv = [0, 0]; a.vel.set(0, 0, 0);
      out.route = { length: route.length, reached, minY, maxY, end: Math.hypot(a.pos.x - A.x, a.pos.z - A.z), startY: D.y, deckY: A.y };
      return out;
    });
    console.log('collision', JSON.stringify(col));
    assert.ok(col.wall, 'a wall to walk into was found'); assert.ok(col.wall.stopped, 'a body stops at the wall');
    assert.ok(Math.abs(col.wall.ray - col.wall.distance) < .03, 'a shot stops at the wall: ' + col.wall.ray + ' vs ' + col.wall.distance);
    assert.equal(col.enemyHP, 100, 'an enemy behind the wall takes no damage');
    assert.equal(col.route.reached, col.route.length, 'the whole route was walked');
    assert.ok(col.route.maxY - col.route.minY > 4, 'ramps and stairs were climbed: ' + (col.route.maxY - col.route.minY).toFixed(1) + ' m');
    assert.ok(col.route.end < 1.5, 'and it ended at the attackers\' start');

    // ── the layout: spawns on the floor, sites on the bots' graph, bots that walk there ──
    const lay = await page.evaluate(() => {
      const N = KOUR_MAP.nav, out = { spawns: [], sites: [] };
      for (const t of ['atk', 'def']) for (const p of KOUR_MAP.spawns[t]) out.spawns.push({ t, x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1), free: !collideXZ(p.x, p.z, p.y + .02, PR), ground: +groundAt(p.x, p.z, p.y + .1).toFixed(2), inBounds: p.x > MAP.bounds.minX && p.x < MAP.bounds.maxX && p.z > MAP.bounds.minZ && p.z < MAP.bounds.maxZ });
      out.actors = world.actors.map((q) => ({ team: q.team, free: !collideXZ(q.pos.x, q.pos.z, q.y + .02, PR), ok: Math.abs(groundAt(q.pos.x, q.pos.z, q.y + .1) - q.y) < .05 }));
      const A = MAP.attackSpawn, D = MAP.defendSpawn;
      const len = (p) => p.reduce((d, q, i) => d + (i ? Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) : 0), 0);
      for (const s of MAP.sites) out.sites.push({ id: s.id, fromAtk: Math.round(len(findPath(A.x, A.z, s.x, s.z, A.y))), fromDef: Math.round(len(findPath(D.x, D.z, s.x, s.z, D.y))), onMain: S_main(s), ring: s.r });
      function S_main(s) { const i = gz(s.z) * GRID.cols + gx(s.x); return !!GRID.walk[i]; }
      out.nav = { nodes: N.nodes, groups: N.groups.slice(0, 3), walkCells: GRID.walk.reduce((x, y) => x + y, 0), cell: GRID.cell };
      // a bot's walk: navNext and the body's own movement, from the attackers' start to the site, 80 s at most
      ADMIN.freezeAI = false;   // the page froze the bots for the earlier checks; a bot has to be allowed to move here
      out.walks = MAP.sites.map((s) => {
        const b = world.actors.find((q) => isAI(q) && q.team === 'atk'), start = KOUR_MAP.spawns.atk[0];
        b.pos.set(start.x, start.y, start.z); b.y = start.y; b.vy = 0; b.onGround = true; b.invuln = 1e6; b.ai.path = null; let steps = 0, d = 1e9;
        for (; steps < 3200; steps++) {
          const q = navNext(b, s.x, s.z, .025); b.yaw = Math.atan2(-(q.x - b.pos.x), -(q.z - b.pos.z)); b.input.mv = [0, -1]; b.input.btn = 0; simMove(b, .025);
          d = Math.hypot(b.pos.x - s.x, b.pos.z - s.z); if (d < 3) break;
        }
        b.input.mv = [0, 0]; return { id: s.id, steps, seconds: steps * .025, d: +d.toFixed(1), y: +b.y.toFixed(1) };
      });
      ADMIN.freezeAI = true;
      return out;
    });
    console.log('layout', JSON.stringify(lay));
    assert.equal(lay.spawns.length, 10);
    assert.ok(lay.spawns.every((p) => p.free && p.inBounds && Math.abs(p.ground - p.y) < .05), 'every spawn is on the floor, free of colliders and inside the map');
    assert.ok(lay.actors.every((q) => q.free && q.ok), 'the fighters stand on the floor, none in a collider');
    assert.equal(new Set(lay.spawns.map((p) => p.x + ',' + p.z)).size, 10, 'ten different places');
    for (const s of lay.sites) assert.ok(s.onMain && s.fromAtk > 20 && s.fromDef > 5, 'site ' + s.id + ' is on the graph and reachable from both starts: ' + JSON.stringify(s));
    assert.ok(Math.abs(lay.sites[0].fromAtk - lay.sites[1].fromAtk) / Math.max(lay.sites[0].fromAtk, lay.sites[1].fromAtk) < .3, 'the sites are about as far from the attackers: ' + lay.sites.map((s) => s.fromAtk).join(' / '));
    assert.ok(lay.nav.groups[0] > 3000, 'one large connected town');
    for (const w of lay.walks) assert.ok(w.d <= 3, 'a bot walks from the attackers\' start to site ' + w.id + ': ' + JSON.stringify(w));

    // ── a standard match runs: bots leave their start, no page errors ──
    const play = await page.evaluate(() => {
      for (const q of world.actors) { q.invuln = 999; if (q.ai) q.ai.skill = null; }
      ADMIN.freezeAI = false; world.phase = 'live'; world.roundTime = 999;
      const before = world.actors.map((q) => ({ x: q.pos.x, z: q.pos.z }));
      for (let i = 0; i < 600; i++) netStep(.05);
      const moved = world.actors.filter((q, i) => isAI(q) && Math.hypot(q.pos.x - before[i].x, q.pos.z - before[i].z) > 8).length;
      return { moved, bots: world.actors.filter(isAI).length, phase: world.phase, spike: world.spike.state, onFloor: world.actors.every((q) => q.y > -.5 && !collideXZ(q.pos.x, q.pos.z, q.y + .02, PR * .7)) };
    });
    console.log('match', JSON.stringify(play));
    assert.ok(play.moved >= 7, 'bots of both teams walk through the town (' + play.moved + ' of ' + play.bots + ')');
    assert.ok(play.onFloor, 'and none of them ends inside a collider');

    // ── the minimaps draw the layout ──
    const mini = await page.evaluate(() => {
      ADMIN.freezeAI = true; drawMini(); drawTac();
      const px = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, set = new Set(); for (let i = 0; i < d.length; i += 4 * 97) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return set.size; };
      toggleBigMap(true); const big = document.getElementById('bm-c');
      const r = { mini: px(mini), tac: px(tac), big: px(big), paint: typeof MAP_WALLS_PAINT, boxes: COLLIDERS.length };
      toggleBigMap(false); return r;
    });
    console.log('minimaps', JSON.stringify(mini));
    assert.ok(mini.mini > 5 && mini.tac > 5 && mini.big > 5, 'all three maps are drawn: ' + JSON.stringify(mini));
    assert.equal(mini.paint, 'function');

    // ── pictures, looked at by eye ──
    const shot = async (name, spot) => {
      await page.evaluate((s) => {
        const a = myActor(), p = KOUR_MAP.snap({ x: s.x, z: s.z }, s.y); a.pos.set(p.x, p.y, p.z); a.y = p.y; a.vy = 0; a.yaw = s.yaw; a.pitch = s.pitch || 0; a.invuln = 1e6;
        world.phase = 'buy'; world.roundTime = 999; ADMIN.freezeAI = true; followCamera(a, .1); renderer.render(scene, camera); drawMini(); drawTac();
      }, spot);
      await page.waitForTimeout(300); await page.screenshot({ path: 'test-results/' + name + '.png' });
    };
    const { A, D } = await page.evaluate(() => ({ A: { ...MAP.attackSpawn }, D: { ...MAP.defendSpawn } }));
    await shot('kour-desktop-deck', { x: A.x, z: A.z, y: A.y, yaw: 3.0, pitch: -.05 });
    await shot('kour-desktop-street', { x: 0, z: 10, y: 4, yaw: 0.8, pitch: .02 });
    await shot('kour-desktop-pit', { x: D.x, z: D.z, y: D.y, yaw: 0, pitch: .05 });

    // ── the event goes by itself: the page reads the same day the server announced ──
    const gone = await page.evaluate(() => {
      const keep = SERVER_CFG.eventMap, out = {};
      room.map = 'pogu'; world.phase = 'menu';
      SERVER_CFG.eventMap = { key: KEY_(), last: '20250101', until: Date.now() - 1000 }; POGU.setPool(); out.afterLast = { key: window.EVENT_MAP_KEY, inList: MAP_LIST.some((m) => m.key === 'desert_town'), box: !!document.getElementById('sel-event') };
      SERVER_CFG.eventMap = null; POGU.setPool(); out.off = { key: window.EVENT_MAP_KEY, inList: MAP_LIST.some((m) => m.key === 'desert_town') };
      SERVER_CFG.eventMap = { key: KEY_(), last: '', until: 0 }; POGU.setPool(); out.noEnd = { key: window.EVENT_MAP_KEY, inList: MAP_LIST.some((m) => m.key === 'desert_town') };
      SERVER_CFG.eventMap = { key: KEY_(), last: '20261130', until: Date.now() + 5000 }; POGU.setPool(); out.before = { key: window.EVENT_MAP_KEY };
      function KEY_() { return 'desert_town'; }
      SERVER_CFG.eventMap = keep; POGU.setPool(); return out;
    });
    console.log('gone', JSON.stringify(gone));
    assert.deepEqual(gone.afterLast, { key: '', inList: false, box: false }, 'after its last day: not in the list, no box');
    assert.deepEqual(gone.off, { key: '', inList: false }, 'switched off: not in the list');
    assert.deepEqual(gone.noEnd, { key: 'desert_town', inList: true }, 'an empty last day has no end');
    assert.equal(gone.before.key, 'desert_town', 'before its last day it is open');

    // ── leaving frees what the map made ──
    const mem = await page.evaluate(() => {
      room.map = 'desert_town'; loadMap('desert_town'); const meshes = KOUR_MAP.meshes.slice(), geos = meshes.map((m) => m.geometry); let disposed = 0; geos.forEach((g) => g.addEventListener('dispose', () => disposed++));
      const maps = new Set(meshes.map((m) => m.material.map).filter(Boolean)); let mapsDisposed = 0; maps.forEach((t) => t.addEventListener('dispose', () => mapsDisposed++));
      renderer.render(scene, camera); const during = { ...renderer.info.memory };
      loadMap('pogu'); renderer.render(scene, camera);
      return { active: KOUR_MAP.active, meshes: KOUR_MAP.meshes.length, kour: COLLIDERS.filter((c) => c.kour).length, disposed, expected: geos.length, maps: maps.size, mapsDisposed, floor: floor.visible, cell: GRID.cell, key: CUR_MAP_KEY, during, after: { ...renderer.info.memory }, paint: window.MAP_WALLS_PAINT };
    });
    console.log('cleanup', JSON.stringify(mem));
    assert.equal(mem.active, false); assert.equal(mem.meshes, 0); assert.equal(mem.kour, 0); assert.equal(mem.disposed, mem.expected, 'every geometry is disposed'); assert.ok(mem.floor);
    assert.equal(mem.cell, 2.5, 'the engine grid is back'); assert.equal(mem.paint, null);
    assert.equal(mem.mapsDisposed, mem.maps, 'every texture is disposed'); assert.ok(mem.maps >= 14 && mem.after.geometries < mem.during.geometries, 'the GPU copies went with it');
    await page.close();

    // ── a phone: the mobile preset, touch, the small-landscape picker ──
    const phone = await f.page('kourphone', { width: 740, height: 360 }, PHONE, { quality: 'mobile', bootTimeout: 120000 });
    await phone.waitForFunction(() => window.SERVER_CFG && SERVER_CFG.eventMap !== undefined, null, { timeout: 30000 });
    await phone.locator('#go-play').tap();
    if (await phone.locator('#sel-pick').isVisible()) await phone.locator('#sel-pick').tap();
    await phone.waitForSelector('#sel-event .lb-map', { timeout: 30000 });
    assert.ok(await phone.locator('#sel-event').isVisible(), 'the event box is visible on a phone');
    await phone.screenshot({ path: 'test-results/kour-select-phone.png' });
    await phone.locator('#sel-event .lb-map').tap();
    await phone.waitForFunction(() => KOUR_MAP.status === 'ready', null, { timeout: 90000 });
    await phone.evaluate(() => { startGame(AGENTS[0], true); });
    await phone.waitForFunction(() => CUR_MAP_KEY === 'desert_town' && !!myActor() && KOUR_MAP.active, null, { timeout: 120000 });
    const ph = await phone.evaluate(() => {
      closeShop(); ADMIN.freezeAI = true; world.phase = 'live'; world.roundTime = 999;
      const a = myActor(), A = MAP.attackSpawn; a.pos.set(A.x, A.y, A.z); a.y = A.y; a.yaw = 3.0; a.pitch = -.05; followCamera(a, .1); renderer.render(scene, camera);
      const mats = new Set(KOUR_MAP.meshes.map((m) => m.material));
      return { q: SETTINGS.quality, stats: KOUR_MAP.renderStats, withMap: [...mats].filter((m) => m.map && m.map.image && m.map.image.width > 0).length, calls: renderer.info.render.calls, shadow: renderer.shadowMap.enabled, touching: document.body.classList.contains('touching') };
    });
    console.log('phone', JSON.stringify(ph));
    assert.equal(ph.q, 'mobile'); assert.ok(ph.touching); assert.equal(ph.stats.chunk, 90, 'the mobile preset draws in bigger squares (fewer draw calls)');
    assert.ok(ph.withMap >= textured.length, 'textures are on the phone too'); assert.equal(ph.shadow, false);
    await phone.waitForTimeout(400); await phone.screenshot({ path: 'test-results/kour-phone-deck.png' });
    // a live switch of the preset rebuilds the squares, nothing is lost
    const sw = await phone.evaluate(() => { setQuality('perf'); const a = { chunk: KOUR_MAP.renderStats.chunk, meshes: KOUR_MAP.meshes.length, tris: KOUR_MAP.renderStats.triangles }; setQuality('mobile'); return { perf: a, back: { chunk: KOUR_MAP.renderStats.chunk, meshes: KOUR_MAP.meshes.length, tris: KOUR_MAP.renderStats.triangles } }; });
    assert.equal(sw.perf.chunk, 56); assert.equal(sw.back.chunk, 90); assert.equal(sw.perf.tris, 13710); assert.equal(sw.back.tris, 13710); assert.ok(sw.perf.meshes > sw.back.meshes);
    await phone.evaluate(() => { const a = myActor(), p = KOUR_MAP.snap({ x: 0, z: 10 }, 4); a.pos.set(p.x, p.y, p.z); a.y = p.y; a.yaw = .8; followCamera(a, .1); renderer.render(scene, camera); });
    await phone.waitForTimeout(400); await phone.screenshot({ path: 'test-results/kour-phone-street.png' });
    assert.deepEqual(f.errors, [], 'page errors');
    console.log('Desert Town: event box, lazy load, original look, walls, ramps, spawns, sites, bots, match, minimaps, presets, cleanup and the closing day passed');
  } finally { await f.browser.close(); }
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
