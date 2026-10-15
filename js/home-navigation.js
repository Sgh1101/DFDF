(() => {
  const $ = (id) => document.getElementById(id), EN = window.GAME_LANG === "en", L = (ko, en) => EN ? en : ko;
  const header = document.querySelector("#s-title .home-header"), nav = header.querySelector(".tt-sub"), practice = nav.querySelector(".home-practice");
  header.append($("home-account"));
  nav.setAttribute("aria-label", L("홈 메뉴", "Home menu"));
  nav.querySelector(".home-current").textContent = L("플레이", "Play");
  nav.insertBefore($("go-armory"), practice);
  nav.prepend(nav.querySelector(".home-current"));
  practice.addEventListener("click", (event) => { if (event.target.closest("button")) practice.open = false; });
  const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
  for (const [element, path] of [
    [$("go-armory"), "M3 7h13l4 3v3h-8l-2 6H6l2-6H3z M16 7V4 M6 7V4 M3 10h6"],
    [practice.querySelector("summary"), "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12 M12 10v4 M10 12h4"],
    [$("go-set"), "M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6"],
  ]) element.insertAdjacentHTML("afterbegin", icon(path));
})();
