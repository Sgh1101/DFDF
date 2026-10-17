(() => {
  "use strict";
  const GS = window.GUN_SKINS, A = window.PHANTOM_ASSETS;
  if (!GS || !A) return;
  const ids = ["champions_atk", "champions_def"], isSkin = (id) => ids.includes(id);
  const L = (ko, en) => window.GAME_LANG === "en" ? en : ko, $ = (id) => document.getElementById(id);
  const variant = (id) => id === ids[0] ? "attacker" : "defender";
  let assets = null, model = null, ready = false, selected = ids[0], preview = null, previewRAF = 0, generation = 0, installRevision = 0, loading = false, bannerHome = null, bundledRequest = null;
  const urls = new Map(), textures = new Map(), materials = new Map();
  const rad = Math.PI / 180;
  const motion = () => SETTINGS.motion !== 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  function url(name) {
    if (!assets?.[name]) return "";
    if (!urls.has(name)) urls.set(name, URL.createObjectURL(new Blob([assets[name]], { type: "image/png" })));
    return urls.get(name);
  }
  function texture(name) {
    if (!textures.has(name)) {
      const tex = new T.TextureLoader().load(url(name));
      tex.colorSpace = T.SRGBColorSpace; tex.magFilter = T.NearestFilter;
      textures.set(name, tex);
    }
    return textures.get(name);
  }
  // Merge boxes per bone: the supplied weapon has 878 cubes, but only 13 mesh draws.
  function geometry(cubes, pivot, desc) {
    const positions = [], normals = [], uv = [];
    const faces = ["east", "west", "up", "down", "south", "north"];
    for (const cube of cubes) {
      const size = cube.size.map((v) => Math.max(v, 0.001)), inflation = Number(cube.inflate) || 0;
      const g = new T.BoxGeometry(...size.map((v) => Math.max(0.001, v + inflation * 2)));
      const coords = g.getAttribute("uv"), indices = g.index;
      for (let face = 0; face < 6; face++) {
        let spec = cube.uv?.[faces[face]];
        if (Array.isArray(cube.uv)) {
          const [u, v] = cube.uv, [x, y, z] = size;
          const box = [[u, v + z, z, y], [u + z + x, v + z, z, y], [u + z, v, x, z], [u + z + x, v, x, z], [u + z + x + z, v + z, x, y], [u + z, v + z, x, y]][face];
          spec = { uv: box.slice(0, 2), uv_size: box.slice(2) };
        }
        if (!spec) { // Absent faces are removed below, rather than sampling an unrelated pixel.
          for (let k = face * 6; k < face * 6 + 6; k++) indices.array[k] = 0;
          continue;
        }
        const origin = spec.uv || [0, 0], extent = spec.uv_size || [size[0], size[1]];
        for (let k = face * 4; k < face * 4 + 4; k++) {
          coords.setXY(k, (origin[0] + coords.getX(k) * extent[0]) / desc.texture_width, 1 - (origin[1] + (1 - coords.getY(k)) * extent[1]) / desc.texture_height);
        }
      }
      g.translate(...cube.origin.map((v, i) => v + size[i] / 2));
      if (cube.rotation) {
        const p = cube.pivot || pivot; g.translate(...p.map((v) => -v));
        g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...cube.rotation.map((v) => v * rad), "ZYX")));
        g.translate(...p);
      }
      g.translate(...pivot.map((v) => -v));
      const flat = g.toNonIndexed();
      positions.push(...flat.attributes.position.array); normals.push(...flat.attributes.normal.array); uv.push(...flat.attributes.uv.array);
      flat.dispose(); g.dispose();
    }
    const merged = new T.BufferGeometry();
    merged.setAttribute("position", new T.Float32BufferAttribute(positions, 3)); merged.setAttribute("normal", new T.Float32BufferAttribute(normals, 3)); merged.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    return merged;
  }
  function buildGeo(geo, mat) {
    const rig = new T.Group(), nodes = new Map();
    rig.name = "phantom-rig"; rig.userData.phantomRig = true;
    for (const bone of geo.bones) {
      const node = new T.Group(), pivot = bone.pivot || [0, 0, 0], parent = geo.bones.find((b) => b.name === bone.parent), base = parent?.pivot || [0, 0, 0];
      node.name = "phantom-bone-" + bone.name;
      node.position.set(...pivot.map((v, i) => v - base[i]));
      node.rotation.set(...(bone.rotation || [0, 0, 0]).map((v) => v * rad), "ZYX");
      node.userData.base = { p: node.position.toArray(), r: (bone.rotation || [0, 0, 0]).slice() };
      if (bone.cubes?.length) node.add(new T.Mesh(geometry(bone.cubes, pivot, geo.description), mat));
      nodes.set(bone.name, node);
    }
    for (const bone of geo.bones) (nodes.get(bone.parent) || rig).add(nodes.get(bone.name));
    return rig;
  }
  function weapon(id) {
    const side = variant(id), key = "weapon-" + side;
    if (!materials.has(key)) {
      const mask = "textures/item/phantom_" + side + "_glowmask.png";
      materials.set(key, new T.MeshStandardMaterial({ map: texture("textures/item/phantom_" + side + ".png"), alphaTest: 0.1, emissive: assets[mask] ? 0xffffff : 0, emissiveMap: assets[mask] ? texture(mask) : null, emissiveIntensity: 0.45, metalness: 0.55, roughness: 0.35, side: T.DoubleSide }));
    }
    const rig = buildGeo(model.geo, materials.get(key)), wrapper = new T.Group();
    // Source points down +X; DFDF points down -Z. Fit to the carbine's existing grip.
    // (drawn at 1.5x the first fit, which read small next to the other guns; its rear stays where the carbine's was, the extra length goes forward)
    rig.rotation.y = Math.PI / 2; rig.scale.setScalar(0.01875); wrapper.add(rig);
    const box = new T.Box3().setFromObject(wrapper), center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
    rig.position.set(-center.x, -center.y + 0.02, -center.z + 0.3 - size.z / 2);
    return wrapper;
  }
  function fallback(root, skin) {
    const palette = { body: skin.body[0], metal: skin.metal[0], dark: skin.dark[0], glow: skin.glow };
    root.traverse((part) => {
      const kind = part.material?.userData?.kind;
      if (!part.isMesh || !kind) return;
      const cls = /glow|glass/.test(kind) ? "glow" : /steel|chrome|brass|copper|metal|blade/.test(kind) ? "metal" : /rubber|blued/.test(kind) ? "dark" : "body", key = skin.id + cls;
      if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color: palette[cls], metalness: cls === "metal" ? 0.9 : 0.5, roughness: 0.3, emissive: cls === "glow" ? skin.glow : 0, emissiveIntensity: 0.7 }));
      part.material = materials.get(key);
    });
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const mesh = new T.Mesh(new T.BoxGeometry(0.008, 0.016, 0.05), new T.MeshBasicMaterial({ color: skin.glow }));
      mesh.position.set(side * 0.055, 0.035 + Math.sin(i) * 0.012, -0.08 - i * 0.055); mesh.rotation.x = -0.45; root.add(mesh);
    }
  }
  function dress(root, skin) {
    if (root.userData.skin === skin.id && root.userData.phantomGeneration === generation) return root;
    if (model) {
      const replacement = weapon(skin.id);
      root.traverse((part) => { if (part.geometry && !part.geometry.userData.shared) part.geometry.dispose(); });
      root.clear(); root.add(replacement);
    } else fallback(root, skin);
    root.userData.skin = skin.id; root.userData.phantomGeneration = generation;
    return root;
  }
  // Preserve bones when the engine normally bakes the viewmodel and hands into one mesh.
  const bake = bakeDeep;
  bakeDeep = function (root) {
    let animated = false; root.traverse((part) => { if (part.userData.phantomRig) animated = true; });
    return animated ? root : bake.apply(this, arguments);
  };
  function pose(root, clip, time) {
    if (!model || !root) return;
    const anim = model.clips[clip], length = anim?.animation_length || 1;
    if (!anim) return;
    const t = anim.loop ? time % length : Math.min(time, length);
    root.traverse((node) => {
      if (!node.name.startsWith("phantom-bone-") || !node.userData.base) return;
      const track = anim.bones?.[node.name.slice(13)], base = node.userData.base;
      const p = A.sample(track?.position, t, [0, 0, 0]), r = A.sample(track?.rotation, t, [0, 0, 0]), s = A.sample(track?.scale, t, [1, 1, 1]);
      // Root/hand/camera tracks encode Minecraft's first-person placement. DFDF owns that placement.
      const movable = /magazine|mag_and_lefthand|charge_handle|bolt|trigger|mag_release/.test(node.name);
      node.position.fromArray(base.p.map((v, i) => v + (movable ? p[i] : 0)));
      node.rotation.set(...base.r.map((v, i) => (v + (movable ? r[i] : 0)) * rad), "ZYX"); node.scale.set(...(movable ? s : [1, 1, 1]));
    });
  }
  const vm = { current: null, time: 0, shot: 0, reload: 0 };
  const tick = tickViewmodel;
  tickViewmodel = function (dt) {
    const result = tick.apply(this, arguments), gun = VM.current;
    if (!gun || !player.alive || player.ultW || !isSkin(GS.of(curWeaponKey()).id)) return result;
    vm.time += dt || 0.016;
    if (gun !== vm.current) { vm.current = gun; vm.time = 0; }
    let clip = "idle", time = vm.time;
    if (player.reloading > 0) {
      if (!vm.reload) vm.reload = player.reloading;
      clip = "reload_tactical"; time = (1 - player.reloading / vm.reload) * (model?.clips[clip]?.animation_length || 2.7);
    } else { vm.reload = 0; if (vm.shot > 0) { clip = player.ads ? "shoot_aim" : "shoot"; time = 0.18 - vm.shot; vm.shot -= dt || 0.016; } else if (vm.time < 0.45) { clip = "draw"; time = vm.time; } }
    if (motion()) pose(gun, clip, time);
    return result;
  };
  const kick = viewmodelFireKick;
  viewmodelFireKick = function () { const r = kick.apply(this, arguments); vm.shot = 0.18; return r; };
  const renderFrame = render;
  render = function () {
    const brightness = motion() ? 0.45 + Math.sin(performance.now() / 550) * 0.12 : 0.45;
    for (const mat of materials.values()) if (mat.emissiveMap) mat.emissiveIntensity = brightness;
    return renderFrame.apply(this, arguments);
  };

  function finisher(group, skin) {
    const crown = new T.Group(); crown.userData.phantom = true; group.add(crown);
    const gold = new T.MeshBasicMaterial({ color: 0xeacb81, transparent: true, opacity: 0.9 });
    const ring = new T.Mesh(new T.TorusGeometry(0.45, 0.035, 6, 40), gold); ring.rotation.x = Math.PI / 2; crown.add(ring);
    const points = Array.from({ length: 65 }, (_, i) => { const t = i / 64; return new T.Vector3(Math.cos(t * Math.PI * 4) * (0.55 - 0.25 * t), 0.2 + t * 2.1, Math.sin(t * Math.PI * 4) * (0.55 - 0.25 * t)); });
    crown.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 56, 0.045, 5, false), new T.MeshBasicMaterial({ color: skin.glow, transparent: true, opacity: 0.9 })));
    const head = new T.Mesh(new T.ConeGeometry(0.18, 0.4, 4), gold); head.position.copy(points[64]); head.rotation.z = -0.7; crown.add(head);
    if (model && assets["geo/finisher/dragon_low.geo.json"]) {
      const geo = A.json(assets, "geo/finisher/dragon_low.geo.json")["minecraft:geometry"][0];
      const dragon = buildGeo(geo, new T.MeshBasicMaterial({ map: texture("textures/finisher/dragon_low_" + (skin.id === ids[0] ? "black" : "white") + ".png"), transparent: true, side: T.DoubleSide }));
      const b = new T.Box3().setFromObject(dragon), c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3());
      dragon.position.sub(c); const mount = new T.Group(); mount.add(dragon); mount.scale.setScalar(1.4 / Math.max(s.x, s.y, s.z)); mount.position.y = 1.25; crown.add(mount);
    }
    return (t) => { crown.rotation.y = t * Math.PI * 2; crown.position.y = Math.sin(t * Math.PI) * 0.45; crown.scale.setScalar(Math.min(1, t * 7) * (1 - Math.max(0, t - 0.7) / 0.3)); };
  }
  function banner(id, kills = 1, final = false) {
    const fx = $("killfx"); if (!fx) return;
    fx.classList.remove("phantom-attack", "phantom-defense");
    const old = $("phantom-emblems"); if (old) old.remove();
    if (!isSkin(id)) return;
    const side = variant(id); fx.classList.add(id === ids[0] ? "phantom-attack" : "phantom-defense");
    fx.style.setProperty("--phantom-accent", id === ids[0] ? "#ff405d" : "#ffe5a3");
    const frame = url("textures/gui/banner/" + (final ? "frame_fin" : "frame" + Math.min(5, kills)) + ".png");
    fx.style.setProperty("--phantom-frame", frame ? `url("${frame}")` : "none");
    const dots = document.createElement("div"); dots.id = "phantom-emblems"; dots.setAttribute("aria-label", L(`${kills} 처치`, `${kills} kills`));
    for (let i = 0; i < 5; i++) { const dot = document.createElement("span"); dot.textContent = i < kills ? "◆" : "◇"; dots.appendChild(dot); }
    $("kf-badge").appendChild(dots);
    const tag = $("kf-tag"); if (tag) tag.textContent = L("챔피언스 팬텀 · 초월", "CHAMPIONS PHANTOM · TRANSCENDENT") + (final ? " · FINISHER" : "");
    if (assets) {
      const emblem = url("textures/gui/banner/" + (final ? "emblem_fin_" + side : "emblem_new_" + side) + ".png");
      if (emblem) dots.style.backgroundImage = `url("${emblem}")`;
    }
  }
  const killFx = playKillFx;
  playKillFx = function () {
    const r = killFx.apply(this, arguments), event = window.KILL_EVENT;
    const id = event ? (["gun", "head", "melee"].includes(event.kind) ? event.skin : "") : (!player.ultW ? GS.of(curWeaponKey()).id : "");
    banner(id, Math.min(5, Math.max(1, killStreak | 0)), !!(event && GAME_RULES.finisher(event))); return r;
  };
  // Original synth voices: the JAR contains no audio recordings.
  SOUNDPACK.packs.champions = {
    ko: "챔피언스 팬텀", en: "Champions Phantom",
    shot: [{ w: "sine", f: 150, to: 48, d: 0.15, v: 0.4 }, { w: "noise", d: 0.065, v: 0.22, cut: 1800, ft: "bandpass" }, { w: "triangle", f: 1760, to: 880, d: 0.08, v: 0.07 }],
    kill: [{ w: "triangle", f: 587, d: 0.18, v: 0.24 }, { w: "sine", f: 880, d: 0.32, v: 0.18, at: 0.07 }, { w: "sine", f: 1175, d: 0.4, v: 0.12, at: 0.14 }],
    head: [{ w: "sine", f: 2349, d: 0.28, v: 0.12 }, { w: "noise", d: 0.05, v: 0.15, cut: 6000, ft: "highpass" }],
    fin: [{ w: "sine", f: 70, to: 35, d: 1, v: 0.4 }, ...[587, 740, 880, 1175].map((f, i) => ({ w: "triangle", f, d: 0.65, v: 0.18, at: 0.16 + i * 0.14 }))],
  };
  for (const id of ids) SOUNDPACK.skins[id] = "champions";

  // IndexedDB is local to this browser. No source assets enter API requests or peer messages.
  async function store(value, remove = false) {
    const db = await new Promise((resolve, reject) => { const req = indexedDB.open("dfdf-phantom", 1); req.onupgradeneeded = () => req.result.createObjectStore("assets"); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    try { return await new Promise((resolve, reject) => { const tx = db.transaction("assets", value || remove ? "readwrite" : "readonly"), os = tx.objectStore("assets"); const req = remove ? os.delete("local") : value ? os.put(value, "local") : os.get("local"); tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
  }
  function refresh() {
    generation++;
    window.refreshSkinAssets();
  }
  function release() {
    for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear();
    for (const tex of textures.values()) tex.dispose(); textures.clear();
    for (const mat of materials.values()) mat.dispose(); materials.clear();
  }
  function bundled() {
    if (!bundledRequest) bundledRequest = A.bundled().catch((error) => { bundledRequest = null; throw error; });
    return bundledRequest;
  }
  function availability(message) {
    const slot = $("slot-champions");
    slot.classList.toggle("phantom-unavailable", !ready); slot.setAttribute("aria-busy", String(!ready));
    $("phantom-model-message").textContent = message || L("제공된 원본 모델을 불러오는 중…", "Loading the supplied original model…");
    $("phantom-model-notice").hidden = ready;
  }
  async function install(next, persist = true, origin = "local") {
    const parsed = A.validate(next); // Validate before replacing a working pack.
    const revision = ++installRevision, stagedTextures = new Map(), stagedUrls = new Map(); let committed = false;
    try {
      const decoded = await Promise.allSettled(["attacker", "defender"].flatMap((side) => ["", "_glowmask"].map(async (suffix) => {
        const name = `textures/item/phantom_${side}${suffix}.png`; if (!next[name]) return;
        const address = URL.createObjectURL(new Blob([next[name]], { type: "image/png" })); stagedUrls.set(name, address);
        const tex = await new T.TextureLoader().loadAsync(address); stagedTextures.set(name, tex);
        if (tex.image.naturalWidth !== parsed.geo.description.texture_width || tex.image.naturalHeight !== parsed.geo.description.texture_height) throw Error("원본 텍스처와 모델 크기가 맞지 않습니다.");
        tex.colorSpace = T.SRGBColorSpace; tex.magFilter = T.NearestFilter;
      })));
      const failed = decoded.find((item) => item.status === "rejected"); if (failed) throw failed.reason;
      if (revision !== installRevision) return;
      if (persist) await store(next);
      if (revision !== installRevision) return;
      stop(); release(); assets = next; model = parsed; ready = true;
      for (const [name, tex] of stagedTextures) textures.set(name, tex);
      for (const [name, address] of stagedUrls) urls.set(name, address);
      committed = true; refresh(); availability();
      $("phantom-status").textContent = origin === "bundled" ? L("제공된 원본 모델·텍스처 자동 적용됨 · Seafle 제작", "Supplied original model and textures loaded automatically · by Seafle") : L("불러온 원본 모델·텍스처 적용됨 · Seafle 제작", "Imported original model and textures loaded · by Seafle");
      if (GS.isOpen() && GS.curTab() === "champions") showSelected();
    } finally {
      if (!committed) { for (const tex of stagedTextures.values()) tex.dispose(); for (const address of stagedUrls.values()) URL.revokeObjectURL(address); }
    }
  }
  function stop() {
    cancelAnimationFrame(previewRAF); previewRAF = 0; SOUNDPACK.stop();
    if (preview) {
      preview.obj.position.copy(preview.position); preview.obj.rotation.copy(preview.rotation);
      pose(preview.obj, "idle", 0); preview = null;
    }
    const fx = $("killfx");
    if (bannerHome) { bannerHome.appendChild(fx); bannerHome = null; fx.hidden = true; fx.classList.remove("phantom-preview"); }
  }
  function demo(part) {
    stop(); const skin = GS.list.find((s) => s.id === selected);
    if (part === "kill") {
      const fx = $("killfx"); bannerHome = fx.parentElement; document.body.appendChild(fx); fx.classList.add("phantom-preview"); fx.hidden = false;
      $("kf-main").textContent = L("처치 미리보기", "KILL PREVIEW"); $("kf-sub").textContent = "CHAMPIONS 2026"; $("kf-streak").hidden = true;
      banner(selected, 3, false); SOUNDPACK.preview(selected, "kill", "carbine");
    }
    else if (part === "shot" || part === "fin") SOUNDPACK.preview(selected, part, "carbine");
    else if (motion()) {
      const studio = GS._pv(); if (!studio) return;
      const obj = studio.obj;
      if (!obj) return;
      preview = { obj, position: obj.position.clone(), rotation: obj.rotation.clone() }; const started = performance.now();
      const duration = part === "inspect" ? 3 : 2.8;
      const frame = () => {
        if (!preview || !GS.isOpen() || studio.obj !== obj) return stop();
        const t = (performance.now() - started) / 1000; if (t > duration) return stop();
        obj.position.copy(preview.position); obj.rotation.copy(preview.rotation);
        const envelope = Math.sin(Math.PI * t / duration);
        obj.rotation.z += envelope * (part === "inspect" ? 0.6 : -0.35);
        obj.rotation.y += envelope * Math.sin(t * 2) * (part === "inspect" ? 0.8 : 0.15);
        pose(obj, part === "inspect" ? "inspect" : "reload_tactical", t); previewRAF = requestAnimationFrame(frame);
      };
      previewRAF = requestAnimationFrame(frame);
    }
  }
  function choose(id) {
    stop(); selected = id; GS.open("carbine", "champions");
    if (GS.owns("carbine", id)) GS.set("carbine", id);
    showSelected();
  }
  function showSelected() {
    GS.preview("carbine", selected);
    const studio = GS._pv();
    if (studio?.obj) {
      const size = new T.Box3().setFromObject(studio.obj).getSize(new T.Vector3());
      studio.fit = { L: Math.max(size.x, size.z), H: size.y, w: 0.68, h: 0.62 };
    }
    for (const b of document.querySelectorAll("[data-phantom-skin]")) b.setAttribute("aria-pressed", String(b.dataset.phantomSkin === selected));
  }
  const guide = document.createElement("details"); guide.id = "skin-tier-guide";
  guide.innerHTML = `<summary>${L("스킨 등급표", "Skin tier guide")} <span>${L("최고 등급: 초월", "Highest tier: Transcendent")}</span></summary>
    <div class="skin-tier-scroll"><table><caption>${L("일반 → 희귀 → 영웅 → 전설 → 초월", "Common → Rare → Epic → Legendary → Transcendent")}</caption><thead><tr><th>${L("순위", "Rank")}</th><th>${L("등급", "Tier")}</th><th>${L("구분", "Details")}</th></tr></thead><tbody>${SKIN_TIERS.list.slice().reverse().map((row, i) => `<tr data-tier="${row.id}"${row.id === 5 ? ' class="highest"' : ""}><th scope="row">${i + 1}</th><td style="color:${row.c}">${L(row.ko, row.en)}</td><td>${row.id === 5 ? L("전설보다 높은 최고 등급 · 700 초월 코인", "Above Legendary · 700 Transcendent coins") : row.id === 4 ? L("초월 바로 아래 등급", "One tier below Transcendent") : L(`${row.id}단계`, `Tier ${row.id}`)}</td></tr>`).join("")}</tbody></table></div>`;
  $("armory").querySelector(".ar-hd").after(guide);
  const notice = document.createElement("div"); notice.id = "phantom-model-notice";
  notice.innerHTML = `<p id="phantom-model-message" role="status"></p><button type="button" id="phantom-retry">${L("원본 다시 불러오기", "Retry original model")}</button>`;
  $("slot-champions").appendChild(notice); availability();
  const panel = document.createElement("section"); panel.id = "phantom-panel";
  panel.innerHTML = `<details open><summary>${L("챔피언스 팬텀 · 스킨과 연출 미리보기", "Champions Phantom · Skin & effects preview")}</summary><div class="phantom-content">
    <p>${L("초월 등급 · 전설보다 높은 최고 등급 · 카빈 공격/수비 · 처치 배너 · 용 마무리 · 전용 합성 사운드", "Transcendent · Above Legendary · Carbine Attack/Defense · Kill banner · Dragon finisher · Synth sound")}</p>
    <div class="phantom-buttons"><button type="button" data-phantom-skin="champions_atk" aria-pressed="true">${L("공격 · 붉은빛", "Attack · Crimson")}</button><button type="button" data-phantom-skin="champions_def" aria-pressed="false">${L("수비 · 상아빛", "Defense · Ivory")}</button></div>
    <div class="phantom-buttons">${[["shot", L("발사음", "Shot")], ["kill", L("킬 배너·소리", "Kill banner & sound")], ["fin", L("마무리", "Finisher")], ["inspect", L("살펴보기", "Inspect")], ["reload", L("재장전", "Reload")]].map(([k, v]) => `<button type="button" data-phantom-demo="${k}">${v}</button>`).join("")}<button type="button" id="phantom-stop">${L("중지", "Stop")}</button></div>
    <p id="phantom-status" role="status">${L("제공된 원본 모델·텍스처를 불러오는 중…", "Loading the supplied original model and textures…")}</p>
    <label class="phantom-import">${L("다른 원본 JAR 불러오기", "Import another original JAR")}<input id="phantom-file" type="file" accept=".jar,.zip" aria-label="${L("챔피언스 팬텀 JAR", "Champions Phantom JAR")}"></label><button type="button" id="phantom-remove">${L("제공된 원본으로 복원", "Restore supplied original")}</button>
    <small>${L("제공된 원본 모델과 텍스처가 자동 적용됩니다. 원본 제작: Seafle. 별도로 불러온 JAR은 이 브라우저에만 저장됩니다. 미보유 스킨은 미리보기만 가능합니다. 챔피언스 탭 코인 700개 또는 기존 뽑기 0.00000000000000001%로 획득합니다.", "The supplied original model and textures load automatically. Original by Seafle. A separately imported JAR stays in this browser. Unowned skins are preview only; obtain them for 700 coins here or a 0.00000000000000001% regular pull.")}</small>
    </div></details>`;
  $("champions-content").appendChild(panel);
  addEventListener("champions-open", showSelected);
  new MutationObserver(() => { if ($("ar-p-champions").hidden) stop(); }).observe($("ar-p-champions"), { attributes: true, attributeFilter: ["hidden"] });
  panel.querySelectorAll("[data-phantom-skin]").forEach((b) => b.onclick = () => choose(b.dataset.phantomSkin));
  panel.querySelectorAll("[data-phantom-demo]").forEach((b) => b.onclick = () => { choose(selected); demo(b.dataset.phantomDemo); });
  $("phantom-stop").onclick = stop;
  $("phantom-file").onchange = async (event) => {
    const file = event.target.files[0]; if (!file || loading) return;
    ++installRevision; loading = true; $("phantom-file").disabled = $("phantom-remove").disabled = true;
    try { if (file.size > 48 * 1024 * 1024) throw Error("JAR 파일은 48MB 이하여야 합니다."); $("phantom-status").textContent = L("불러오는 중…", "Importing…"); await install(await A.read(await file.arrayBuffer())); choose(selected); }
    catch (e) { $("phantom-status").textContent = L("불러오기 실패: ", "Import failed: ") + e.message; }
    finally { loading = false; event.target.value = ""; $("phantom-file").disabled = $("phantom-remove").disabled = false; }
  };
  async function restoreBundled() {
    if (loading) return;
    ++installRevision; loading = true; $("phantom-file").disabled = $("phantom-remove").disabled = $("phantom-retry").disabled = true;
    try { const original = await bundled(); await install(original, false, "bundled"); await store(null, true).catch(() => {}); }
    catch (error) { const message = L("원본 불러오기 실패: ", "Original model failed to load: ") + error.message; $("phantom-status").textContent = message; availability(message); }
    finally { loading = false; $("phantom-file").disabled = $("phantom-remove").disabled = $("phantom-retry").disabled = false; }
  }
  $("phantom-remove").onclick = $("phantom-retry").onclick = restoreBundled;
  new MutationObserver(() => { if ($("armory").hidden) stop(); }).observe($("armory"), { attributes: true, attributeFilter: ["hidden"] });
  window.CHAMPIONS_PHANTOM = { isSkin, dress, finisher, choose, demo, stop, pose, loaded: () => ready };
  // Do not overwrite a user import if the startup IndexedDB read resolves later.
  const version = generation;
  (async () => {
    const saved = await store().catch(() => null);
    if (saved && generation === version && !loading) {
      try { await install(saved, false); return; } catch (error) { /* A broken local override must not hide the supplied original. */ }
    }
    try { const original = await bundled(); if (generation === version && !loading) await install(original, false, "bundled"); }
    catch (error) { if (generation === version && !ready) { const message = L("원본 불러오기 실패: ", "Original model failed to load: ") + error.message; $("phantom-status").textContent = message; availability(message); } }
  })();
})();
