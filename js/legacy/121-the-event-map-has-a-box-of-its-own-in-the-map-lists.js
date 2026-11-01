(() => {
  // The event map (사막 마을, js/event-map.js and js/kour-map.js) is in MAP_LIST first while the server announces it, but the
  // pickers show it in a box of its own: the engine draws every chip in order, then this moves the event's chip into the
  // "이벤트" box above the size tabs, with the day it closes. Choosing it works like choosing any map. The tabs do not count it
  // (js/legacy/50-map-sizes.js) and when its last day is over (or the owner switches it off) the box and the map are gone.
  if ("undefined" == typeof MAP_LIST || "function" != typeof paintSelMaps || "function" != typeof paintMaps) return;
  const EN = "en" === window.GAME_LANG, L = (ko, en) => (EN ? en : ko);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const until = () => {
    const e = window.SERVER_CFG && SERVER_CFG.eventMap, s = e && e.last;
    if (!s || !/^\d{8}$/.test(s)) return L("진행 중", "Open now");
    const m = +s.slice(4, 6), d = +s.slice(6, 8);
    return EN ? `Until ${MON[m - 1]} ${d}` : `${m}월 ${d}일까지`;
  };
  const css = document.createElement("style");
  css.textContent = `.map-event{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px 8px;margin:0 0 6px;padding:5px 8px;border:1px dashed rgba(255,200,73,.5);border-radius:12px;background:rgba(255,200,73,.05)}
.map-event .me-tag{font-family:var(--f-display);font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--gold);padding:1px 8px;border-radius:99px;background:rgba(255,200,73,.16);white-space:nowrap}
.map-event .me-end{font-size:11px;color:var(--steel-dim,#8a97ab);white-space:nowrap}
.map-event .lb-map{border-color:rgba(255,200,73,.55)}
.map-event[hidden]{display:none}
@media (max-height:560px){.map-event{margin-bottom:3px;padding:3px 6px;gap:4px 6px}.map-event .me-tag{font-size:9px}.map-event .me-end{font-size:10px}}`;
  document.head.appendChild(css);
  // the chip the engine drew for the event map: the chips are the list in order, the random one (if any) apart
  function move(box, id) {
    if (!box) return;
    let ev = document.getElementById(id);
    const key = window.EVENT_MAP_KEY || "", at = key ? MAP_LIST.findIndex((m) => m.key === key) : -1;
    if (!key || at < 0) { ev && ev.remove(); return; }
    const chip = [...box.querySelectorAll(".lb-map:not(.lbm-rand)")][at];
    if (!chip) return;
    if (!ev) {
      ev = document.createElement("div");
      ev.id = id; ev.className = "map-event"; ev.setAttribute("role", "group"); ev.setAttribute("aria-label", L("이벤트 맵", "Event map"));
    }
    const tabs = box.previousElementSibling && box.previousElementSibling.classList.contains("map-cats") ? box.previousElementSibling : box;
    tabs.parentNode.insertBefore(ev, tabs);
    ev.replaceChildren();
    const tag = document.createElement("span"), end = document.createElement("span");
    tag.className = "me-tag"; tag.textContent = L("이벤트", "Event");
    end.className = "me-end"; end.textContent = until();
    chip.hidden = !1;
    ev.append(tag, chip, end);
  }
  const _ps = paintSelMaps;
  paintSelMaps = function () {
    const r = _ps.apply(this, arguments);
    move(document.getElementById("sel-maps"), "sel-event");
    return r;
  };
  const _pm = paintMaps;
  paintMaps = function () {
    const r = _pm.apply(this, arguments);
    move(document.getElementById("lb-maps"), "lb-event");
    return r;
  };
  // the list changed (the server's settings arrived, the event ended): the pickers that are drawn are drawn again
  addEventListener("maps-changed", () => {
    try {
      const box = document.getElementById("sel-maps");
      box && box.childElementCount && paintSelMaps();
      for (const id of ["sel-event", "lb-event"]) !window.EVENT_MAP_KEY && document.getElementById(id) && document.getElementById(id).remove();
    } catch (e) {}
  });
  // the last day ends while the page is open: the list is set again at that moment
  let timer = 0;
  const arm = () => {
    clearTimeout(timer);
    const e = window.SERVER_CFG && SERVER_CFG.eventMap, wait = e && e.until ? e.until - Date.now() : 0;
    if (wait > 0 && wait < 2 ** 31 - 1) timer = setTimeout(() => { try { window.POGU && POGU.setPool(); } catch (x) {} }, wait + 50);
  };
  addEventListener("server-config", arm);
  arm();
})();
