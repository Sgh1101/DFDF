(() => {
  // The map of the week (the server picks it, js/map-week.js; js/legacy/76 puts it in the list) wears a "이번 주 맵" tag
  // in the map pickers of the game screen and the room lobby.
  if ("undefined" == typeof MAP_LIST || "function" != typeof paintSelMaps || "function" != typeof paintMaps) return;
  const L = (ko, en) => ("en" === window.GAME_LANG ? en : ko);
  const mark = (box) => {
    if (!box) return;
    const wk = window.WEEK_MAP_KEY || "";
    [...box.querySelectorAll(".lb-map:not(.lbm-rand)")].forEach((c, i) => {
      const m = MAP_LIST[i],
        tag = c.querySelector(".map-wk");
      if (m && wk && m.key === wk) {
        tag || c.insertAdjacentHTML("beforeend", `<em class="map-wk">${L("이번 주 맵", "Map of the week")}</em>`);
        c.classList.add("wk");
      } else {
        tag && tag.remove();
        c.classList.remove("wk");
      }
    });
  };
  const css = document.createElement("style");
  css.textContent = `.lb-map .map-wk{font-style:normal;margin-left:6px;padding:1px 6px;border-radius:99px;font-family:var(--f-display);font-size:9.5px;background:rgba(255,200,73,.18);color:var(--gold);white-space:nowrap}
.lb-map.wk{border-color:rgba(255,200,73,.55)}`;
  document.head.appendChild(css);
  const _ps = paintSelMaps;
  paintSelMaps = function () {
    const r = _ps.apply(this, arguments);
    mark(document.getElementById("sel-maps"));
    return r;
  };
  const _pm = paintMaps;
  paintMaps = function () {
    const r = _pm.apply(this, arguments);
    mark(document.getElementById("lb-maps"));
    return r;
  };
  // the list changed (the server's settings arrived, another map of the week): the pickers that are drawn are drawn again
  addEventListener("maps-changed", () => {
    try {
      const box = document.getElementById("sel-maps");
      box && box.childElementCount && paintSelMaps();
    } catch (e) {}
  });
})();
