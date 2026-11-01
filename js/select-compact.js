// Agent select on a small landscape phone: the map and mode chips fold into one button that opens a sheet,
// so the agent cards keep the screen (the chips used to take half of it, and at 568x320 all of it).
(() => {
  const foot = document.querySelector("#s-select .sel-foot"), mid = foot && foot.querySelector(".sel-mid"), back = document.getElementById("sel-back");
  if (!foot || !mid || !back) return;
  const L = (ko, en) => ("en" === window.GAME_LANG ? en : ko);
  const pick = document.createElement("button");
  pick.type = "button"; pick.id = "sel-pick"; pick.className = "btn";
  pick.setAttribute("aria-expanded", "false"); pick.setAttribute("aria-controls", "sel-mid");
  mid.id = mid.id || "sel-mid";
  pick.innerHTML = "<span></span><i aria-hidden=\"true\">▾</i>";
  back.after(pick);
  const label = (root) => {
    const on = document.querySelector(root + " .lb-map.on");
    if (!on) return "";
    const t = [...on.childNodes].find((n) => 3 === n.nodeType && n.textContent.trim());
    return (t ? t.textContent : on.textContent).trim();
  };
  const refresh = () => { pick.firstChild.textContent = `${label("#sel-maps") || "-"} · ${label("#sel-modes") || "-"}`; pick.title = L("맵과 모드 바꾸기", "Change map and mode"); };
  const place = () => { mid.style.bottom = Math.round(innerHeight - foot.getBoundingClientRect().top + 8) + "px"; };
  const set = (open) => {
    foot.classList.toggle("pick-open", open); pick.setAttribute("aria-expanded", String(open));
    pick.lastChild.textContent = open ? "▴" : "▾";
    open && place();
  };
  pick.onclick = (e) => { e.stopPropagation(); set(!foot.classList.contains("pick-open")); };
  // choosing a map or a mode closes the sheet (the category filter stays open)
  mid.addEventListener("click", (e) => { const c = e.target.closest && e.target.closest("#sel-maps .lb-map, #sel-modes .lb-map"); c && setTimeout(() => { refresh(); set(false); }, 0); });
  document.addEventListener("click", (e) => { foot.classList.contains("pick-open") && !foot.contains(e.target) && set(false); });
  document.addEventListener("keydown", (e) => { "Escape" === e.key && foot.classList.contains("pick-open") && (set(false), pick.focus()); });
  // leaving the screen (back, start, or anything else) closes the sheet
  const screen = document.getElementById("s-select");
  screen && new MutationObserver(() => screen.hidden && set(false)).observe(screen, { attributes: true, attributeFilter: ["hidden"] });
  addEventListener("resize", () => foot.classList.contains("pick-open") && place());
  new MutationObserver(refresh).observe(mid, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
  addEventListener("server-config", refresh);
  refresh();
})();
