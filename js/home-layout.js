(() => {
  const $ = (id) => document.getElementById(id), EN = window.GAME_LANG === "en", L = (ko, en) => EN ? en : ko;
  const title = $("s-title"), header = title.querySelector(".home-header"), nav = title.querySelector(".tt-sub"), footer = title.querySelector(".home-footer");
  header.append($("home-account"));
  nav.setAttribute("aria-label", L("홈 메뉴", "Home menu"));
  nav.querySelector(".home-current").textContent = L("플레이", "Play");
  title.querySelector(".title-mark").textContent = L("플레이", "PLAY");
  title.querySelector(".home-agent-heading span").textContent = L("요원 둘러보기", "EXPLORE AGENTS");
  nav.insertBefore($("go-armory"), nav.querySelector(".home-practice"));
  nav.prepend(nav.querySelector(".home-current"));
  nav.querySelector(".home-practice").addEventListener("click", (event) => {
    if (event.target.closest("button")) nav.querySelector(".home-practice").open = false;
  });
  title.querySelector(".tt-news").hidden = true;
  const guide = title.querySelector(".tt-menu > .home-guide");
  guide.querySelector("summary").textContent = L("플레이 가이드", "Play guide");
  const equipment = $("home-equipment"), stats = title.querySelector(".title-foot");
  footer.append(guide, equipment, stats);
  const panels = [];
  function placePanel(detail, panel) {
    const rect = detail.getBoundingClientRect(), width = Math.min(360, innerWidth - 32);
    panel.style.width = width + "px";
    panel.style.left = Math.max(16, Math.min(rect.left, innerWidth - width - 16)) - rect.left + "px";
    panel.style.maxHeight = Math.max(80, rect.top - header.getBoundingClientRect().bottom - 20) + "px";
  }
  for (const detail of [guide, equipment]) {
    const panel = document.createElement("div"), heading = document.createElement("div"), label = document.createElement("b"), close = document.createElement("button");
    panel.className = "home-detail-panel"; heading.className = "home-detail-heading";
    label.textContent = detail.querySelector("summary").textContent;
    close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", L("닫기", "Close"));
    close.onclick = () => { detail.open = false; detail.querySelector("summary").focus(); };
    heading.append(label, close); panel.append(heading);
    for (const child of [...detail.children]) if (child.tagName !== "SUMMARY") panel.append(child);
    detail.append(panel); panels.push([detail, panel]);
    detail.querySelector("summary").addEventListener("click", () => {
      if (!detail.open) placePanel(detail, panel);
    });
    panel.addEventListener("click", (event) => {
      if (event.target.closest(".btn")) { detail.open = false; detail.querySelector("summary").focus(); }
    }, true);
    detail.addEventListener("toggle", () => { if (detail.open) placePanel(detail, panel); });
  }
  addEventListener("resize", () => { for (const [detail, panel] of panels) if (detail.open) placePanel(detail, panel); });
  const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
  const icons = {
    armory: "M3 7h13l4 3v3h-8l-2 6H6l2-6H3z M16 7V4 M6 7V4 M3 10h6",
    practice: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12 M12 10v4 M10 12h4",
    settings: "M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    solo: "M8 5v14l12-7z",
    multi: "M8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M16 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M2 20v-4a6 6 0 0 1 12 0v4 M14 14a5 5 0 0 1 8 4v2",
  };
  for (const [element, key] of [[$("go-armory"), "armory"], [nav.querySelector(".home-practice summary"), "practice"], [$("go-set"), "settings"]]) {
    element.insertAdjacentHTML("afterbegin", icon(icons[key]));
  }
  for (const [id, key, number] of [["go-play", "solo", "01"], ["go-multi", "multi", "02"]]) {
    const button = $(id), badge = document.createElement("span");
    badge.className = "home-action-icon"; badge.setAttribute("aria-hidden", "true"); badge.innerHTML = icon(icons[key]);
    button.prepend(badge); button.querySelector("i").innerHTML = icon("M6 18 18 6 M6 6h12v12");
    button.querySelector("i").setAttribute("aria-hidden", "true");
    button.dataset.number = number;
  }
  function labels() {
    const counts = GAME_CATALOG.counts();
    $("home-agent-count").textContent = L(`${counts.agents}명의 요원`, `${counts.agents} agents`);
    title.querySelector(".title-desc").textContent = L("혼자 실력을 쌓거나, 친구들과 전장으로.\n원하는 방식으로 라운드를 시작하세요.", "Train solo or join your friends.\nChoose how you play your next round.");
  }
  labels(); addEventListener("server-config", labels);
  function chipNames() {
    for (const [id, ko, en] of [["acct-chip", "계정과 전적", "Account and stats"], ["mis-chip", "미션", "Missions"], ["gold-chip", "골드와 스킨 뽑기", "Gold and skin pulls"]]) {
      const chip = $(id); if (chip) chip.setAttribute("aria-label", L(ko, en) + (id === "acct-chip" ? " · " + chip.textContent : ""));
    }
  }
  chipNames(); new MutationObserver(chipNames).observe($("home-account"), { childList: true });
})();
