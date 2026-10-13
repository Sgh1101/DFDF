(() => {
  const $ = (id) => document.getElementById(id), EN = window.GAME_LANG === "en", L = (ko, en) => EN ? en : ko;
  const menu = $("s-title").querySelector(".tt-menu");
  const account = ACCOUNT.session(), favoriteKey = "lgp_favorites:" + (account && account.user.id || "local");
  let favorites = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(favoriteKey) || "[]");
    if (Array.isArray(saved)) favorites = new Set(saved.filter((id) => AGENTS.some((a) => a.key === id)));
  } catch (e) {}
  let onlyFavorites = false;
  const tools = document.createElement("div"); tools.id = "agent-favorites";
  const filter = document.createElement("button"), star = document.createElement("button"), count = document.createElement("span");
  filter.className = star.className = "btn";
  filter.textContent = L("즐겨찾기만", "Favorites only");
  filter.onclick = () => { onlyFavorites = !onlyFavorites; paintFavorites(); };
  star.onclick = () => {
    favorites.has(picked.key) ? favorites.delete(picked.key) : favorites.add(picked.key);
    try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); } catch (e) {}
    paintFavorites();
  };
  tools.append(filter, star, count); $("s-select").querySelector(".sel-top").after(tools);
  $("s-select").querySelector(".sel-top .lbl").textContent = L(`${AGENTS.length}명 중 한 명을 고르세요`, `Choose one of ${AGENTS.length} agents`);
  function paintFavorites() {
    filter.setAttribute("aria-pressed", String(onlyFavorites));
    star.setAttribute("aria-pressed", String(favorites.has(picked.key)));
    star.textContent = `${favorites.has(picked.key) ? "★" : "☆"} ${picked.name}`;
    star.setAttribute("aria-label", `${picked.name} · ${L("즐겨찾기 변경", "Toggle favorite")}`);
    count.textContent = onlyFavorites && !favorites.size ? L("요원을 고른 뒤 ☆로 추가하세요", "Select an agent and use ☆ to save") : L(`${favorites.size}명 저장`, `${favorites.size} saved`);
    const role = window.SEL36 && SEL36.role();
    [...$("sel-grid").children].forEach((card, i) => { const agent = AGENTS[i]; card.hidden = !!(role && agent.role !== role) || onlyFavorites && !favorites.has(agent.key); });
  }
  new MutationObserver(paintFavorites).observe($("sel-grid"), { childList: true });
  paintFavorites();
  $("sel-roles").addEventListener("click", () => queueMicrotask(paintFavorites));
  addEventListener("storage", (event) => {
    if (event.key !== favoriteKey) return;
    try { const saved = JSON.parse(event.newValue || "[]"); if (Array.isArray(saved)) favorites = new Set(saved.filter((id) => AGENTS.some((a) => a.key === id))); paintFavorites(); } catch (e) {}
  });

  const controls = document.createElement("p");
  controls.textContent = L("PC: WASD 이동 · 마우스 조준 · 클릭 사격 · R 장전 · B 구매 · C/Q/E/X 능력 · Esc 설정. 모바일: 조이스틱 이동, 화면 오른쪽 조준, 화면의 사격·능력 버튼 사용.", "PC: WASD move · mouse aim · click fire · R reload · B buy · C/Q/E/X abilities · Esc settings. Mobile: joystick to move, right side to aim, fire and ability buttons.");
  menu.querySelector(".home-guide").append(controls);
  const modeGuide = document.createElement("details"); modeGuide.className = "home-guide"; modeGuide.id = "mode-guide";
  const modeTitle = document.createElement("summary"), modeText = document.createElement("p");
  modeTitle.textContent = L("선택한 모드 안내", "Selected mode guide"); modeGuide.append(modeTitle, modeText);
  $("sel-modes").parentElement.after(modeGuide);
  function describeMode() {
    const mode = GAME_MODES[room.mode] || GAME_MODES.std, n = MAP_SIZE(room.map);
    const target = room.mode === "tdm" ? Math.round(100 * n / 5) : room.mode === "dm" ? n === 1 ? 15 : n < 5 ? 25 : 40 : mode.win || 13;
    const team = mode.ffa ? L(`개인전 · 최대 ${n * 2}명`, `Free for all · up to ${n * 2} players`) : `${n} ${L("대", "vs")} ${n}`;
    const goal = mode.respawn ? L(`${target}킬 먼저 달성 또는 제한 시간 내 최다 처치. 사망 후 부활.`, `Reach ${target} kills first or lead when time expires. Respawn after death.`) : L(`${target}라운드 선승. 스파이크 설치·해제 또는 적 전멸. 라운드 내 자동 부활 없음.`, `First to ${target} rounds. Plant/defuse the spike or eliminate the enemy. No automatic respawn within a round.`);
    const extra = mode.noAbil ? L(" 요원 능력 사용 불가.", " Agent abilities disabled.") : mode.rush ? L(" 전원 스파이크·무작위 무기.", " Everyone carries a spike; weapons are random.") : L(" 요원 능력 사용 가능.", " Agent abilities enabled.");
    modeText.textContent = `${mode.name} · ${team}. ${goal}${extra}`;
  }
  document.addEventListener("click", (event) => { if (event.target.closest("#sel-modes,#sel-maps,#go-play,#go-resume")) queueMicrotask(describeMode); });
  addEventListener("server-config", describeMode); describeMode();

  const equipment = document.createElement("details"); equipment.className = "home-guide"; equipment.id = "home-equipment";
  const label = document.createElement("summary"), list = document.createElement("div");
  label.textContent = L("장착 스킨", "Equipped skins"); equipment.append(label, list); menu.append(equipment);
  let lastEquipment = "";
  function paintEquipment() {
    if ($("s-title").hidden) return;
    const mine = GUN_SKINS.mine(), guns = [...new Set(["rifle", "pistol", "knife", ...Object.keys(mine)])];
    const fingerprint = JSON.stringify(mine);
    if (lastEquipment === fingerprint) return;
    lastEquipment = fingerprint; list.replaceChildren();
    for (const gun of guns) {
      if (!WEAPONS[gun]) continue;
      const skin = GUN_SKINS.of(gun), button = document.createElement("button"); button.className = "btn";
      button.textContent = `${WEAPONS[gun].name} · ${EN ? skin.en : skin.ko}`;
      button.onclick = () => GUN_SKINS.open(gun, "gun");
      list.append(button);
    }
  }
  paintEquipment(); setInterval(paintEquipment, 1000);
  // One expanded panel at a time keeps the primary actions in view on phones.
  menu.addEventListener("toggle", (event) => {
    if (event.target.tagName !== "DETAILS" || !event.target.open) return;
    menu.querySelectorAll("details[open]").forEach((panel) => { if (panel !== event.target) panel.open = false; });
  }, true);
})();
