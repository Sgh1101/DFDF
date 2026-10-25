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
  // the season's leaderboard (js/leaderboard.js, loaded just before this file) sits next to the armoury
  if (window.LEADERBOARD) {
    const lb = document.createElement("button");
    lb.className = "tt-item tt-mini home-minor";
    lb.id = "go-ranks";
    lb.type = "button";
    lb.innerHTML = `<b>${L("순위표", "Ranks")}</b>`;
    lb.title = L("이번 시즌 순위표", "This season's leaderboard");
    lb.insertAdjacentHTML("afterbegin", icon("M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M17 5h3v2a3 3 0 0 1-3 3 M7 5H4v2a3 3 0 0 0 3 3"));
    lb.onclick = () => LEADERBOARD.open();
    $("go-armory").after(lb);
  }
  // the target range was mounted before the practice menu existed and landed in the bar: it belongs in the menu
  const into = practice.querySelector(":scope > div");
  if (into && $("go-targets") && !into.contains($("go-targets"))) into.append($("go-targets"));
  // diagnostics (js/game-improvements.js, loaded later) joins the bar as an ordinary item, not a big box
  const tidy = () => {
    const d = $("go-diagnostics");
    if (!d || d.classList.contains("tt-item")) return;
    d.className = "tt-item tt-mini home-minor";
    d.innerHTML = `<b>${L("성능 진단", "Diagnostics")}</b>`;
    d.title = L("성능 진단", "Diagnostics");
    d.insertAdjacentHTML("afterbegin", icon("M3 12h4l2-6 4 12 2-6h6"));
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", tidy) : setTimeout(tidy);
  // feedback: bug reports, agent ideas, player reports, suggestions (the form is js/feedback.js)
  if (window.FEEDBACK) {
    const fb = document.createElement("button");
    fb.className = "tt-item tt-mini home-minor";
    fb.title = L("문의", "Feedback");
    fb.id = "go-feedback";
    fb.type = "button";
    fb.innerHTML = `<b>${L("문의", "Feedback")}</b>`;
    fb.insertAdjacentHTML("afterbegin", icon("M4 5h16v11H9l-5 4z M8 9h8 M8 12h5"));
    fb.onclick = () => FEEDBACK.open();
    $("go-set").after(fb);
    // paid cheats (shown only once the owner has opened the sale)
    if (window.ORDERS) {
      const od = document.createElement("button");
      od.className = "tt-item tt-mini home-minor";
      od.title = L("치트 구매", "Buy cheats");
      od.id = "go-order";
      od.type = "button";
      od.style.display = "none";
      od.innerHTML = `<b>${L("치트 구매", "Buy cheats")}</b>`;
      od.insertAdjacentHTML("afterbegin", icon("M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.4 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z"));
      od.onclick = () => ORDERS.open();
      fb.after(od);
      ORDERS.isOn().then((on) => (od.style.display = on ? "" : "none"));
    }
    const pz = document.querySelector("#pause .pz-btns");
    if (pz && !$("pz-feedback")) {
      const b = document.createElement("button");
      b.className = "btn";
      b.id = "pz-feedback";
      b.type = "button";
      b.textContent = L("문의", "Feedback");
      b.onclick = () => FEEDBACK.open();
      pz.insertBefore(b, pz.firstChild);
    }
  }
})();
