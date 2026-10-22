// The map on the agent select screen. The map picked below is drawn from above at an angle (from behind the
// attackers' spawn, looking down at about 50 degrees, the whole map in the frame) by the game's own renderer,
// and that picture is the screen's backdrop; its name, team size and footprint sit above the map chips. On a
// phone the picture also heads the map sheet. Picking another map loads it (only on the menu, never in a match)
// and takes a new picture; each map's picture is kept, so going back to a map is instant.
(() => {
  const sel = document.getElementById("s-select");
  if (!sel || "undefined" == typeof T || "function" != typeof loadMap || "undefined" == typeof MAPS) return;
  const L = (ko, en) => ("en" === window.GAME_LANG ? en : ko);
  const CACHE = new Map();
  const cam = new T.PerspectiveCamera(40, 16 / 9, 1, 5000);

  const cap = document.createElement("div");
  cap.id = "sel-mapcap";
  cap.setAttribute("aria-live", "polite");
  sel.appendChild(cap);
  const card = document.createElement("div");
  card.id = "sel-mapcard";
  card.setAttribute("aria-hidden", "true");
  const mid = sel.querySelector(".sel-foot .sel-mid");
  mid && mid.prepend(card);

  const visible = () => !sel.hidden;
  const canLoad = (k) => "undefined" != typeof world && world && "menu" === world.phase && MAPS[k] && !MAPS[k].graphicsStatic;

  function shoot(key) {
    const m = MAPS[key];
    if (!m || !m.bounds) return null;
    const b = m.bounds, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    // from behind the attackers' spawn toward the middle, so the picture reads the way the attack goes
    const a = m.attackSpawn || { x: cx, z: b.maxZ };
    let ux = cx - a.x, uz = cz - a.z;
    const ul = Math.hypot(ux, uz) || 1;
    (ux /= ul), (uz /= ul);
    const canvas = renderer.domElement, aspect = canvas.width / canvas.height || 16 / 9;
    // far enough that the whole footprint fits, seen 50 degrees down
    const el = (50 * Math.PI) / 180, span = Math.max(w, d), dist = span * (aspect < 1.5 ? 1.15 : 0.95);
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    cam.position.set(cx - ux * dist * Math.cos(el), dist * Math.sin(el), cz - uz * dist * Math.cos(el));
    cam.lookAt(cx, 0, cz);
    const fog = scene.fog, vm = "undefined" != typeof VM && VM.root, vmOn = vm && vm.visible;
    scene.fog = null;
    vm && (vm.visible = !1);
    try {
      renderer.render(scene, cam);
      // read the picture in the same task it was drawn, before the browser clears it
      const W = Math.min(1280, canvas.width), H = Math.round(W / aspect), out = document.createElement("canvas");
      out.width = W;
      out.height = H;
      out.getContext("2d").drawImage(canvas, 0, 0, W, H);
      return out.toDataURL("image/jpeg", 0.82);
    } finally {
      scene.fog = fog;
      vm && (vm.visible = vmOn);
    }
  }

  function caption(key) {
    cap.replaceChildren();
    const m = MAPS[key], item = ("undefined" != typeof MAP_LIST ? MAP_LIST : []).find((x) => x.key === key);
    if (!m || !m.bounds) return;
    const n = window.TEAMS_BY_MAP ? TEAMS_BY_MAP.sizeOf(key) : 5, b = m.bounds;
    const name = document.createElement("b"), size = document.createElement("span");
    name.textContent = (item && item.name) || m.name || key;
    size.textContent = `${n}${L("대", "v")}${n} · ${Math.round(b.maxX - b.minX)}×${Math.round(b.maxZ - b.minZ)}m`;
    cap.append(name, size);
  }
  function show(key) {
    const url = CACHE.get(key);
    sel.classList.toggle("has-mapshot", !!url);
    url ? sel.style.setProperty("--mapshot", `url("${url}")`) : sel.style.removeProperty("--mapshot");
    card.style.backgroundImage = url ? `url("${url}")` : "";
    caption(key);
    place();
  }
  // the name sits in the free corner at the top left of the bar with the map chips; a phone's bar is one row
  // of buttons with no room, and its map button already names the map
  function place() {
    const foot = sel.querySelector(".sel-foot");
    if (!foot || !visible()) return;
    const r = foot.getBoundingClientRect();
    cap.hidden = r.height < 120;
    cap.style.top = Math.round(r.top + 14) + "px";
  }

  let want = null, timers = [];
  function take(key) {
    timers.forEach(clearTimeout);
    timers = [];
    want = key;
    show(key);
    const go = () => {
      if (!visible() || want !== key) return;
      if (("undefined" != typeof CUR_MAP_KEY ? CUR_MAP_KEY : "") !== key) {
        if (!canLoad(key)) return;
        loadMap(key);
      }
      try {
        const url = shoot(key);
        url && (CACHE.set(key, url), show(key));
      } catch (e) {
        console.warn("map shot", e);
      }
    };
    // a map already pictured just shows (the match start loads it anyway); a new one loads only once the picking
    // stops (skipping through the chips does not load every map), and is taken again after its textures arrive
    if (CACHE.has(key)) return;
    timers.push(setTimeout(go, 390), setTimeout(go, 1250), setTimeout(go, 2750));
  }

  let last = null;
  const check = () => {
    if (!visible()) return void (last = null);
    const key = "undefined" != typeof room && room ? room.map : null;
    key && key !== last && ((last = key), take(key));
    place();
  };
  setInterval(check, 250);
  sel.addEventListener("click", (e) => e.target.closest && e.target.closest(".lb-map") && setTimeout(check, 0));
  addEventListener("resize", place);

  window.SELECT_MAPSHOT = { cache: CACHE, shoot, take, check, camera: cam };
})();
