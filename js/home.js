(() => {
  const $ = (id) => document.getElementById(id), EN = window.GAME_LANG === "en", L = (ko, en) => EN ? en : ko;
  const title = $("s-title"), menu = title.querySelector(".tt-menu"), sub = title.querySelector(".tt-sub");
  const bar = document.createElement("nav"); bar.id = "home-account"; bar.setAttribute("aria-label", L("계정과 보상", "Account and rewards")); title.prepend(bar);
  function moveChips() {
    for (const id of ["acct-chip", "rank-chip", "gold-chip", "mis-chip"]) {
      const chip = $(id); if (chip && chip.parentElement !== bar) bar.append(chip);
    }
  }
  moveChips();
  const chips = new MutationObserver(moveChips); chips.observe(document.body, { childList: true });

  const practice = document.createElement("details"); practice.className = "home-practice";
  const summary = document.createElement("summary"); summary.textContent = L("연습", "Practice"); practice.append(summary);
  const practiceList = document.createElement("div"); practice.append(practiceList);
  for (const id of ["go-range", "go-fly"]) if ($(id)) practiceList.append($(id));
  sub.prepend(practice);
  $("go-armory").querySelector("b").textContent = L("무기고", "Armory");
  const resume = document.createElement("button"); resume.id = "go-resume"; resume.className = "tt-item home-resume";
  const key = "lgp_recent:" + (ACCOUNT.session() && ACCOUNT.session().user.id || "local");
  let recent = null; try { recent = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) {}
  function paintRecent() {
    resume.hidden = !recent || !AGENTS.some((a) => a.key === recent.agent) || !MAP_LIST.some((m) => m.key === recent.map) || !GAME_MODES[recent.mode];
    resume.replaceChildren();
    if (resume.hidden) return;
    const text = document.createElement("span"), label = document.createElement("b"), detail = document.createElement("small");
    label.textContent = L("최근 설정", "Recent settings");
    resume.setAttribute("aria-label", L("최근 설정으로 시작", "Start with recent settings"));
    detail.textContent = [AGENTS.find((a) => a.key === recent.agent).name, MAP_LIST.find((m) => m.key === recent.map).name, GAME_MODES[recent.mode] && GAME_MODES[recent.mode].name, recent.diff && (EN ? recent.diff : { easy: "순한맛", normal: "보통", hard: "빡셈" }[recent.diff])].filter(Boolean).join(" · ");
    text.append(label, detail); resume.append(text);
  }
  resume.onclick = () => {
    picked = AGENTS.find((a) => a.key === recent.agent) || picked;
    room.map = recent.map; room.mode = recent.mode; room.diff = ["easy", "normal", "hard"].includes(recent.diff) ? recent.diff : "normal";
    $("go-play").click(); paintSelMaps();
  };
  $("go-play").after(resume); paintRecent();
  const begin = startGame;
  startGame = function (agent, training) {
    if (!training) { recent = { agent: agent.key, mode: room.mode || "std", map: room.map, diff: room.diff || "normal" }; try { localStorage.setItem(key, JSON.stringify(recent)); } catch (e) {} paintRecent(); }
    return begin.apply(this, arguments);
  };

  const guide = document.createElement("details"); guide.className = "home-guide";
  guide.innerHTML = `<summary>${L("처음 플레이하시나요?", "First time playing?")}</summary><p>${L("사격장에서 이동·사격·요원 능력을 먼저 익혀 보세요. 일반전은 스파이크 설치/해제를 두고 싸우며, 데스매치는 처치 수로 승부합니다.", "Try movement, shooting and abilities in the range. Standard fights over planting and defusing the spike; deathmatch is decided by kills.")}</p>`;
  const train = document.createElement("button"); train.className = "btn"; train.textContent = L("사격장 열기", "Open range"); train.onclick = () => $("go-range").click(); guide.append(train); menu.append(guide);
  function counts() {
    const data = GAME_CATALOG.counts(), n = data.maps;
    $("go-play").querySelector("small").textContent = L(`AI 대전 · 모드 ${data.modes}종 · 맵 ${n}종`, `Versus AI · ${data.modes} modes · ${n} maps`);
    title.querySelector(".title-desc").textContent = L(`사이트를 두고 벌이는 전술 교전. ${data.agents}명 요원의 능력으로 각을 열고, 연막과 스파이크로 승부를 냅니다.`, `Fight for the site with ${data.agents} agents, abilities, smoke and the spike.`);
    const skins = data.skins;
    title.querySelector(".title-foot").textContent = L(`요원 ${data.agents}명 · 무기 ${data.weapons}종 · 맵 ${n}종 · 스킨 ${skins}종`, `${data.agents} agents · ${data.weapons} weapons · ${n} maps · ${skins} skins`);
    paintRecent();
  }
  counts(); addEventListener("server-config", counts);
  const news = title.querySelector(".tt-news");
  const newsLabel = document.createElement("div"), newsList = document.createElement("ul");
  newsLabel.className = "tn-lbl"; newsLabel.textContent = L("플레이 안내", "PLAY GUIDE");
  for (const item of GAME_CATALOG.news) {
    const row = document.createElement("li"), heading = document.createElement("b"), text = document.createElement("span");
    heading.textContent = L(...item.title); text.textContent = L(...item.text); row.append(heading, text); newsList.append(row);
  }
  news.replaceChildren(newsLabel, newsList);
  // the sound preview under the armory header: which skin and gun, what the sound is, and four ways to hear it
  const sample = document.createElement("section"); sample.id = "skin-samples"; sample.setAttribute("aria-label", L("스킨 음색 미리듣기", "Skin sound preview"));
  const text = document.createElement("div"); text.id = "skin-sample-label";
  text.innerHTML = '<div class="ss-title"><b></b><i class="ss-rar"></i></div><div class="ss-meta"><span class="ss-gun"></span><em class="ss-note"></em></div><div class="ss-tags"><span class="ss-tag ss-pack"></span><span class="ss-tag ss-fin"></span></div>';
  const part$ = (cls) => text.querySelector(cls);
  const group = document.createElement("div"); group.className = "ss-btns"; group.setAttribute("role", "group"); group.setAttribute("aria-label", L("미리듣기", "Preview"));
  sample.append(text, group);
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    shot: svg('<path d="M4 10v4h3l4 3V7L7 10H4z"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
    kill: svg('<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>'),
    fin: svg('<path d="M12 3l2.3 5.4L20 9.2l-4.3 3.9L17 19l-5-3-5 3 1.3-5.9L4 9.2l5.7-.8z"/>'),
    stop: svg('<rect x="7" y="7" width="10" height="10" rx="2"/>'),
  };
  // how long each preview sounds, for the moving bars (the sound itself is SOUNDPACK's)
  const LEN = { shot: 700, kill: 1100, fin: 2600 };
  let selected = "default", selectedGun = "rifle", timers = [];
  const settle = () => { timers.forEach(clearTimeout); timers = []; for (const b of group.children) b.classList.remove("playing"); };
  for (const [part, label] of [["shot", L("총소리", "Gunshot")], ["kill", L("처치음", "Kill sound")], ["fin", L("피니셔", "Finisher")], ["stop", L("정지", "Stop")]]) {
    const button = document.createElement("button"); button.type = "button"; button.className = "ss-btn"; button.dataset.sample = part;
    button.innerHTML = `${ICON[part]}<span>${label}</span><s class="ss-eq" aria-hidden="true"><i></i><i></i><i></i></s>`;
    button.onclick = () => {
      if (part === "stop") { SOUNDPACK.stop(); settle(); return; }
      settle();
      if (SOUNDPACK.preview(selected, part, selectedGun)) { button.classList.add("playing"); timers.push(setTimeout(() => button.classList.remove("playing"), LEN[part])); }
    };
    group.append(button);
  }
  $("armory").querySelector(".ar-hd").after(sample);
  function updateSample(id, gun) {
    selected = id; if (WEAPONS[gun]) selectedGun = gun;
    const pack = SOUNDPACK.packs[SOUNDPACK.skins[id]], skin = GUN_SKINS.list.find((s) => s.id === id), rar = skin && GUN_SKINS.rar[skin.rar], spec = window.GUNSYNTH && GUNSYNTH.SPEC[selectedGun];
    sample.style.setProperty("--rc", rar ? rar.c : "#8a97ab");
    part$(".ss-title b").textContent = skin ? (EN ? skin.en : skin.ko) : "";
    part$(".ss-rar").textContent = rar ? (EN ? rar.en : rar.ko) : "";
    part$(".ss-rar").style.color = rar ? rar.c : "";
    part$(".ss-gun").textContent = WEAPONS[selectedGun] ? WEAPONS[selectedGun].name : "";
    part$(".ss-note").textContent = !EN && spec ? spec.note : "";
    part$(".ss-pack").textContent = pack ? (EN ? pack.en : pack.ko) + L(" 음색", " sound") : L("기본 음색", "Stock sound");
    part$(".ss-fin").textContent = pack ? L("피니셔 지원", "Finisher available") : L("피니셔 없음", "No finisher");
    part$(".ss-pack").classList.toggle("on", !!pack); part$(".ss-fin").classList.toggle("on", !!pack);
    for (const k of ["fin", "kill"]) {
      const b = sample.querySelector(`[data-sample="${k}"]`);
      b.disabled = !pack;
      b.title = pack ? "" : L("이 스킨에는 전용 음색이 없습니다", "This skin has no sound pack");
    }
    settle();
  }
  updateSample("default");
  // the gun list (by gun) has no key on its buttons, and re-draws its skin cards for the chosen gun: follow that, so
  // the strip describes the gun in view (the carbine, not the rifle it started on) and plays its shot
  const skinList = $("ar-skins");
  if (skinList) {
    let syncT = 0;
    new MutationObserver(() => {
      clearTimeout(syncT);
      syncT = setTimeout(() => {
        const first = skinList.querySelector("[data-g]");
        if (!first || !WEAPONS[first.dataset.g] || first.dataset.g === selectedGun) return;
        // a new gun: show the skin it wears (a skin picked on the same gun is the click's, below)
        const worn = skinList.querySelector(".ar-sk.on") || first;
        updateSample(worn.dataset.s, first.dataset.g);
      }, 40);
    }).observe(skinList, { childList: true });
  }
  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-s],[data-th]");
    if (!card || !$("armory").contains(card)) return;
    const pair = String(card.dataset.th || "").split("|");
    updateSample(card.dataset.s || pair[1], card.dataset.g || pair[0]);
    SOUNDPACK.stop();
  }, true);
  const close = GUN_SKINS.close;
  GUN_SKINS.close = function () { SOUNDPACK.stop(); settle(); return close.apply(this, arguments); };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function motion() { title.classList.toggle("home-reduced", reduced.matches || SETTINGS.motion === 0 || ["mobile", "perf"].includes(SETTINGS.quality)); }
  const orbit = titleCam;
  let staticMap = null;
  titleCam = function () {
    if (title.classList.contains("home-reduced")) {
      if (staticMap === CUR_MAP_KEY) return;
      staticMap = CUR_MAP_KEY;
      return orbit.call(this, 0);
    }
    staticMap = null;
    return orbit.apply(this, arguments);
  };
  const draw = render;
  let lastHomeFrame = -Infinity, lastHomeMap = null;
  render = function () {
    if (world.phase === "menu" && !FLY.on && title.classList.contains("home-reduced")) {
      const now = performance.now();
      if (lastHomeMap === CUR_MAP_KEY && now - lastHomeFrame < 500) return;
      lastHomeFrame = now; lastHomeMap = CUR_MAP_KEY;
    } else lastHomeFrame = -Infinity;
    return draw.apply(this, arguments);
  };
  motion(); reduced.addEventListener("change", motion);
  setInterval(() => { if (!title.hidden) motion(); }, 1000);
})();
