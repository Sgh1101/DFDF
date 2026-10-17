(() => {
  "use strict";
  const GS = window.GUN_SKINS, A = window.PHANTOM_ASSETS;
  if (!GS || !A) return;
  const ids = ["champions_atk", "champions_def"], isSkin = (id) => ids.includes(id);
  const L = (ko, en) => window.GAME_LANG === "en" ? en : ko, $ = (id) => document.getElementById(id);
  const variant = (id) => id === ids[0] ? "attacker" : "defender";
  let assets = null, model = null, ready = false, selected = ids[0], preview = null, previewRAF = 0, generation = 0, installRevision = 0, loading = false, bannerHome = null, bundledRequest = null;
  const urls = new Map(), textures = new Map(), materials = new Map();
  let killPreviewCount = 0;
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
      tex.name = name;
      tex.colorSpace = T.SRGBColorSpace; tex.magFilter = T.NearestFilter;
      textures.set(name, tex);
    }
    return textures.get(name);
  }
  const buildGeo = (geo, mat) => { const rig = BEDROCK_RIG.build(geo, mat); rig.name = "phantom-rig"; rig.userData.phantomRig = true; return rig; };
  function weapon(id) {
    const side = variant(id), key = "weapon-" + side;
    if (!materials.has(key)) {
      const mask = "textures/item/phantom_" + side + "_glowmask.png";
      materials.set(key, new T.MeshStandardMaterial({ map: texture("textures/item/phantom_" + side + ".png"), alphaTest: 0.1, emissive: assets[mask] ? 0xffffff : 0, emissiveMap: assets[mask] ? texture(mask) : null, emissiveIntensity: 0.45, metalness: 0.55, roughness: 0.35, side: T.DoubleSide }));
    }
    const rig = buildGeo(model.geo, materials.get(key)), wrapper = new T.Group();
    // Source points down +X; DFDF points down -Z. Fit to the carbine's grip.
    // Preserve the larger Phantom fit and the shared 1.5x first-person gun sizing.
    rig.rotation.y = Math.PI / 2; rig.scale.setScalar(0.02); wrapper.add(rig);
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

  function finisher(group, skin, event = {}) {
    // The supplied renderer draws BOTH source models, not a generated spiral.
    // client.c.b.d: models appear at 2.66s; DEFENDER changes black -> white at 2.8s.
    // ATTACKER uses serpent_cream; DEFENDER uses serpent_red (c.a enum verified).
    const snake = skin.id === ids[0] ? "cream" : "red";
    const names = ["dragon_low", "serpent_" + snake];
    if (!model || !names.every(name => assets["geo/finisher/" + name + ".geo.json"])) return null;
    const figure = new T.Group(), native = new T.Group(), mats = [];
    figure.name = "champions-original-finisher"; figure.userData.phantom = true;
    // Original GeckoLib unit conversion and the renderer's 1.25 scale about y=4.15.
    native.scale.setScalar(1.25 / 16); native.position.y = 4.15 * (1 - 1.25); figure.add(native);
    for (const name of names) {
      const path = name === "dragon_low" ? "dragon_low_black" : name;
      const material = new T.MeshBasicMaterial({ map: texture("textures/finisher/" + path + ".png"), transparent: true, alphaTest: 0.01, side: T.DoubleSide });
      mats.push(material);
      const geo = A.json(assets, "geo/finisher/" + name + ".geo.json")["minecraft:geometry"][0];
      const rig = buildGeo(geo, material); rig.name = "original-" + name; rig.userData.source = "geo/finisher/" + name + ".geo.json"; native.add(rig);
    }
    const box = new T.Box3().setFromObject(figure), size = box.getSize(new T.Vector3());
    const playerHeight = 2.1 * BODY_K, enlargement = Math.max(1, playerHeight * 5 / size.y);
    figure.scale.setScalar(enlargement);
    figure.position.y = -0.6 - box.min.y * enlargement; // victim's foot, same origin as the source scene
    figure.rotation.y = Number.isFinite(event.finisherYaw) ? event.finisherYaw : 0;
    figure.userData.playerHeight = playerHeight; figure.userData.height = size.y * enlargement;
    figure.userData.serpent = snake; figure.visible = false; group.add(figure);
    const effects = PHANTOM_FINISHER_MOTION.create(group, texture, skin.id === ids[0], event, enlargement, figure.position.y, figure.rotation.y);
    return (t) => {
      const seconds = t * 8;
      figure.visible = seconds >= 2.66 && seconds < 8;
      mats[0].map = texture("textures/finisher/dragon_low_" + (skin.id === ids[1] && seconds >= 2.8 ? "white" : "black") + ".png");
      // Original one-second alpha exit, with the hold shortened for the requested 8s round transition.
      for (const material of mats) material.opacity = 1 - Math.max(0, Math.min(1, seconds - 7));
      effects.step(seconds, group.userData.previewScene ? GUN_SKINS._pv().cam : camera);
    };
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
      const weaponTextures = ["attacker", "defender"].flatMap(side => ["", "_glowmask"].map(suffix => `textures/item/phantom_${side}${suffix}.png`));
      const finisherTextures = ["dragon_low_black", "dragon_low_white", "serpent_cream", "serpent_red"].map(name => `textures/finisher/${name}.png`);
      finisherTextures.push(...PHANTOM_FINISHER_MOTION.textures.map(name => `textures/finisher/fx/${name}.png`));
      const decoded = await Promise.allSettled([...weaponTextures, ...finisherTextures].map(async name => {
        if (!next[name]) return;
        const address = URL.createObjectURL(new Blob([next[name]], { type: "image/png" })); stagedUrls.set(name, address);
        const tex = await new T.TextureLoader().loadAsync(address); stagedTextures.set(name, tex);
        tex.name = name;
        if (weaponTextures.includes(name) && (tex.image.naturalWidth !== parsed.geo.description.texture_width || tex.image.naturalHeight !== parsed.geo.description.texture_height)) throw Error("원본 텍스처와 모델 크기가 맞지 않습니다.");
        tex.colorSpace = T.SRGBColorSpace; tex.magFilter = T.NearestFilter;
      }));
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
  let playingTimer = 0;
  const settle = () => { clearTimeout(playingTimer); for (const b of document.querySelectorAll("#phantom-panel .pp-btn.playing")) b.classList.remove("playing"); };
  function stop() {
    settle(); cancelAnimationFrame(previewRAF); previewRAF = 0; SOUNDPACK.stop();
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
      killPreviewCount = killPreviewCount % 5 + 1;
      $("kf-main").textContent = L("처치 미리보기", "KILL PREVIEW"); $("kf-sub").textContent = L(`원본 ${killPreviewCount}킬 연주 · 다시 누르면 다음 단계`, `Original kill ${killPreviewCount} · press again for next`); $("kf-streak").hidden = true;
      banner(selected, killPreviewCount, false); window.CHAMPIONS_AUDIO && CHAMPIONS_AUDIO.play(killPreviewCount, true);
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
    if (id !== selected) killPreviewCount = 0;
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
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    shot: svg('<path d="M4 10v4h3l4 3V7L7 10H4z"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
    kill: svg('<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>'),
    fin: svg('<path d="M12 3l2.3 5.4L20 9.2l-4.3 3.9L17 19l-5-3-5 3 1.3-5.9L4 9.2l5.7-.8z"/>'),
    inspect: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    reload: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    stop: svg('<rect x="7" y="7" width="10" height="10" rx="2"/>'),
  };
  const demoButton = ([k, v]) => `<button type="button" class="pp-btn" data-phantom-demo="${k}">${ICON[k]}<span>${v}</span><s class="pp-eq" aria-hidden="true"><i></i><i></i><i></i></s></button>`;
  panel.style.setProperty("--rc", (SKIN_TIERS.list.find((row) => row.id === 5) || {}).c || "#ff7bd5");
  panel.innerHTML = `<div class="pp-head"><div class="pp-titles"><span class="pp-kicker">CHAMPIONS · ${L("카빈 전용", "CARBINE ONLY")}</span><h3>${L("챔피언스 팬텀", "Champions Phantom")}<i class="pp-rar">${L("초월", "TRANSCENDENT")}</i></h3></div>
    <div class="pp-sides" role="group" aria-label="${L("진영", "Side")}"><button type="button" class="pp-side" data-phantom-skin="champions_atk" aria-pressed="true"><b></b>${L("공격 · 붉은빛", "Attack · Crimson")}</button><button type="button" class="pp-side" data-phantom-skin="champions_def" aria-pressed="false"><b></b>${L("수비 · 상아빛", "Defense · Ivory")}</button></div></div>
    <p class="pp-desc">${L("전설보다 높은 최고 등급의 카빈 스킨. 원본 모델에 처치 배너, 용 마무리, 전용 합성 사운드가 함께 적용됩니다.", "The highest tier above Legendary, for the carbine: the original model with a kill banner, a dragon finisher and its own synthesized sound.")}</p>
    <div class="pp-tags"><span class="pp-tag">${L("공격 / 수비", "Attack / Defense")}</span><span class="pp-tag">${L("처치 배너", "Kill banner")}</span><span class="pp-tag">${L("용 마무리", "Dragon finisher")}</span><span class="pp-tag">${L("전용 사운드", "Own sound")}</span></div>
    <div class="pp-rows"><div class="pp-row"><em>${L("소리", "Sound")}</em><div class="pp-btns" role="group">${[["shot", L("발사음", "Shot")], ["kill", L("킬 배너·소리", "Kill banner & sound")], ["fin", L("마무리", "Finisher")]].map(demoButton).join("")}</div></div>
    <div class="pp-row"><em>${L("연출", "Motion")}</em><div class="pp-btns" role="group">${[["inspect", L("살펴보기", "Inspect")], ["reload", L("재장전", "Reload")]].map(demoButton).join("")}<button type="button" class="pp-btn pp-stop" id="phantom-stop">${ICON.stop}<span>${L("중지", "Stop")}</span></button></div></div></div>
    <p id="phantom-status" role="status">${L("제공된 원본 모델·텍스처를 불러오는 중…", "Loading the supplied original model and textures…")}</p>
    <div class="pp-source"><label class="phantom-import">${L("다른 원본 JAR 불러오기", "Import another original JAR")}<input id="phantom-file" type="file" accept=".jar,.zip" aria-label="${L("챔피언스 팬텀 JAR", "Champions Phantom JAR")}"></label><button type="button" id="phantom-remove">${L("제공된 원본으로 복원", "Restore supplied original")}</button></div>
    <small>${L("제공된 원본 모델과 텍스처가 자동 적용됩니다. 원본 제작: Seafle. 별도로 불러온 JAR은 이 브라우저에만 저장됩니다. 미보유 스킨은 미리보기만 가능합니다. 챔피언스 탭 코인 700개 또는 기존 뽑기 0.00000000000000001%로 획득합니다.", "The supplied original model and textures load automatically. Original by Seafle. A separately imported JAR stays in this browser. Unowned skins are preview only; obtain them for 700 coins here or a 0.00000000000000001% regular pull.")}</small>`;
  $("champions-content").appendChild(panel);
  addEventListener("champions-open", showSelected);
  new MutationObserver(() => { if ($("ar-p-champions").hidden) stop(); }).observe($("ar-p-champions"), { attributes: true, attributeFilter: ["hidden"] });
  panel.querySelectorAll("[data-phantom-skin]").forEach((b) => b.onclick = () => choose(b.dataset.phantomSkin));
  panel.querySelectorAll("[data-phantom-demo]").forEach((b) => b.onclick = () => {
    choose(selected); demo(b.dataset.phantomDemo); b.classList.add("playing");
    playingTimer = setTimeout(settle, { shot: 800, kill: 1500, fin: 2800, inspect: 3000, reload: 2800 }[b.dataset.phantomDemo] || 1500);
  });
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
