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
  const sample = document.createElement("section"); sample.id = "skin-samples"; sample.setAttribute("aria-label", L("스킨 연출 미리보기", "Skin effect preview"));
  const text = document.createElement("span"); text.id = "skin-sample-label"; sample.append(text);
  let selected = "default", selectedGun = "rifle";
  for (const [part, label] of [["shot", L("총소리", "Gunshot")], ["kill", L("처치음", "Kill sound")], ["fin", L("피니셔", "Finisher")], ["stop", L("정지", "Stop")]]) {
    const button = document.createElement("button"); button.className = "btn"; button.textContent = label; button.dataset.sample = part;
    button.onclick = () => part === "stop" ? SOUNDPACK.stop() : SOUNDPACK.preview(selected, part, selectedGun);
    sample.append(button);
  }
  $("armory").querySelector(".ar-hd").after(sample);
  function updateSample(id, gun) {
    selected = id; if (WEAPONS[gun]) selectedGun = gun;
    const pack = SOUNDPACK.packs[SOUNDPACK.skins[id]], skin = GUN_SKINS.list.find((s) => s.id === id);
    text.textContent = skin ? `${EN ? skin.en : skin.ko} · ${pack ? EN ? pack.en : pack.ko : L("기본 음색", "Stock sound")} · ${pack ? L("피니셔 지원", "Finisher available") : L("피니셔 없음", "No finisher")}` : "";
    sample.querySelector('[data-sample="fin"]').disabled = !pack;
    sample.querySelector('[data-sample="kill"]').disabled = !pack;
  }
  updateSample("default");
  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-s],[data-th]");
    if (!card || !$("armory").contains(card)) return;
    const pair = String(card.dataset.th || "").split("|");
    updateSample(card.dataset.s || pair[1], card.dataset.g || pair[0]);
    SOUNDPACK.stop();
  }, true);
  const close = GUN_SKINS.close;
  GUN_SKINS.close = function () { SOUNDPACK.stop(); return close.apply(this, arguments); };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function motion() { title.classList.toggle("home-reduced", reduced.matches || SETTINGS.motion === 0 || ["fast", "low"].includes(SETTINGS.quality)); }
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
