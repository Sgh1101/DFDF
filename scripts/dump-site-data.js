// Reads the agents, maps and modes out of the running game and writes scripts/site-pages/data.json, plus a picture of
// every map from above (assets/site/maps/KEY.webp) and a portrait of every agent (assets/site/agents/ID.webp), the way the
// game itself draws them. scripts/build-site-pages.js then writes agents.html, maps.html and modes.html from it, so those
// pages say what the game really has. Run again after agents, maps or modes change:
//   /tmp/agent-browser.sh PORT WORKTREE scripts/dump-site-data.js   (or with the dev server up: node scripts/dump-site-data.js)
//   node scripts/build-site-pages.js
// --no-images keeps the pictures as they are.
const fs = require("node:fs"), path = require("node:path");
const { fixture } = require("./browser-fixture");
const root = path.resolve(__dirname, ".."), images = !process.argv.includes("--no-images");
const dataFile = path.join(__dirname, "site-pages", "data.json");
(async () => {
  const f = await fixture();
  try {
    const page = await f.page("sitedump", { width: 1280, height: 720 }, {}, { bootTimeout: 120000, quality: "visual" });
    // the maps that join the list after boot (the block-terrain map) and the server's map of the week
    await page.waitForFunction(() => window.ASCENT_TRIAL && MAP_LIST.some((m) => m.key === "ascent_trial") && window.WEEK_MAP_KEY !== undefined, null, { timeout: 60000 });
    const data = await page.evaluate(() => {
      const week = window.WEEK_MAP_KEY || "";
      const keep = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
      const roles = [...new Set(AGENTS.map((a) => a.role))];
      return {
        generated: "scripts/dump-site-data.js",
        roles,
        agents: AGENTS.map((a) => ({ ...keep(a, ["id", "name", "role", "color", "accent", "quote", "desc"]), abilities: a.abilities.map((x) => ({ ...keep(x, ["key", "name", "desc", "charges", "cd", "ult", "counterplay"]) })) })),
        // the permanent pool: the list without the map of the week
        maps: MAP_LIST.filter((m) => m.key !== week).map((m) => { const b = MAPS[m.key].bounds; return { key: m.key, name: m.name, size: MAP_SIZE(m.key), cat: MAP_CAT(m.key), width: Math.round(b.maxX - b.minX), depth: Math.round(b.maxZ - b.minZ), sites: (MAPS[m.key].sites || []).map((s) => s.id) }; }),
        weekCandidates: window.MAP_WEEK ? MAP_WEEK.CANDIDATES.length : 0,
        modes: Object.entries(GAME_MODES).map(([key, m]) => ({ key, name: m.name, sub: m.sub, kills: m.kills, time: m.time, win: m.win, flags: Object.keys(m).filter((k) => m[k] === true) })),
        // the modes the room and the solo picker list, in their order
        listed: [...document.querySelectorAll("#sel-modes button")].map((b) => b.textContent),
      };
    });
    // the picker lists modes by name: turn the names into keys
    data.listed = data.listed.map((n) => (data.modes.find((m) => m.name === n) || {}).key).filter(Boolean);
    if (images) {
      const shot = (w, h) => page.evaluate(({ w, h }) => {
        const m = MAPS[CUR_MAP_KEY], b = m.bounds, bw = b.maxX - b.minX, bd = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
        const cam = new T.PerspectiveCamera(40, 16 / 9, 1, 5000), a = m.attackSpawn;
        let ux = cx - a.x, uz = cz - a.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
        const canvas = renderer.domElement, aspect = canvas.width / canvas.height, el = 50 * Math.PI / 180, dist = Math.max(bw, bd) * (aspect < 1.5 ? 1.15 : 0.95);
        cam.aspect = aspect; cam.updateProjectionMatrix();
        cam.position.set(cx - ux * dist * Math.cos(el), dist * Math.sin(el), cz - uz * dist * Math.cos(el)); cam.lookAt(cx, 0, cz);
        const fog = scene.fog, f0 = fog && { d: fog.density, n: fog.near, f: fog.far }, vm = typeof VM !== "undefined" && VM.root, vmOn = vm && vm.visible;
        fog && (void 0 !== fog.density ? (fog.density = 0) : ((fog.near = 1e6), (fog.far = 2e6)));
        vm && (vm.visible = false);
        try {
          renderer.render(scene, cam);
          const out = document.createElement("canvas"); out.width = w; out.height = h;
          out.getContext("2d").drawImage(canvas, 0, 0, w, h); return out.toDataURL("image/webp", 0.72);
        } finally { fog && (void 0 !== fog.density ? (fog.density = f0.d) : ((fog.near = f0.n), (fog.far = f0.f))); vm && (vm.visible = vmOn); }
      }, { w, h });
      const save = (file, url) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64")); };
      data.mapImages = [];
      for (const m of data.maps) {
        await page.evaluate((key) => { room.mode = "std"; room.map = key; startGame(AGENTS[0], false); closeShop(); ADMIN.freezeAI = true; }, m.key);
        await page.waitForTimeout(m.key === "ascent_trial" ? 12000 : 2500);
        const ok = await page.evaluate(() => CUR_MAP_KEY) === m.key;
        if (!ok) { console.log("no picture for", m.key); continue; }
        save(path.join(root, "assets/site/maps", m.key + ".webp"), await shot(960, 540));
        data.mapImages.push(m.key); console.log("map picture", m.key);
      }
      data.agentImages = [];
      for (const a of data.agents) {
        const url = await page.evaluate((id) => { const ag = AGENTS.find((x) => x.id === id), src = agentPortrait(ag, 300, 380), c = document.createElement("canvas"), img = new Image(); return new Promise((res) => { img.onload = () => { c.width = 300; c.height = 380; c.getContext("2d").drawImage(img, 0, 0, 300, 380); res(c.toDataURL("image/webp", 0.8)); }; img.onerror = () => res(""); img.src = src; }); }, a.id);
        if (!url) { console.log("no portrait for", a.id); continue; }
        save(path.join(root, "assets/site/agents", a.id + ".webp"), url); data.agentImages.push(a.id);
      }
    } else if (fs.existsSync(dataFile)) { const old = JSON.parse(fs.readFileSync(dataFile, "utf8")); data.mapImages = old.mapImages; data.agentImages = old.agentImages; }
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 1) + "\n");
    console.log("wrote", path.relative(root, dataFile), data.agents.length, "agents", data.maps.length, "maps", data.modes.length, "modes; listed:", data.listed.join(","));
  } finally { await f.browser.close(); }
})();
