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
  // feedback: bug reports, agent ideas, player reports, suggestions (the form is js/feedback.js)
  if (window.FEEDBACK) {
    const fb = document.createElement("button");
    fb.className = "tt-item tt-mini";
    fb.id = "go-feedback";
    fb.type = "button";
    fb.innerHTML = `<b>${L("문의", "Feedback")}</b>`;
    fb.insertAdjacentHTML("afterbegin", icon("M4 5h16v11H9l-5 4z M8 9h8 M8 12h5"));
    fb.onclick = () => FEEDBACK.open();
    $("go-set").after(fb);
    // paid cheats (shown only once the owner has opened the sale)
    if (window.ORDERS) {
      const od = document.createElement("button");
      od.className = "tt-item tt-mini";
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
