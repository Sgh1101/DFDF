
(() => {
  // 40 maps and 24 agents: a single scrolling row of map chips (with a
  // "random" chip first) instead of a wall of buttons, and counts that match.
  const nA = AGENTS.length,
    nM = MAP_LIST.length;
  const KO = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];
  const tens = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];
  const korN = (n) => (n < 10 ? KO[n] : tens[Math.floor(n / 10)] + (n % 10 ? KO[n % 10] : ""));
  const swap = (sel, f) => document.querySelectorAll(sel).forEach((e) => (e.innerHTML = f(e.innerHTML)));
  swap(".title-desc", (h) => h.replace("열네 요원", korN(nA) + " 요원"));
  swap("#s-select .lbl, .lbl", (h) => h.replace("열네 명 중", korN(nA) + " 명 중"));
  swap("#go-play small", (h) => h.replace(/맵 \d+종/, `맵 ${nM}종`));
  swap(".title-foot", (h) => h.replace(/요원 \d+명/, `요원 ${nA}명`).replace(/맵 \d+종/, `맵 ${nM}종`));
  document.querySelectorAll("li").forEach((li) => /10개 맵 전부/.test(li.textContent) && (li.innerHTML = `<b>맵 ${nM}종 · 요원 ${nA}명</b><span>새 맵 ${nM - 10}개와 새 요원 ${nA - 14}명이 추가되었습니다</span>`));

  const keepOn = (box) => {
    const on = box && box.querySelector(".lb-map.on");
    on && on.scrollIntoView({ block: "nearest", inline: "center" });
  };
  const _ps = paintSelMaps;
  paintSelMaps = function () {
    const r = _ps.apply(this, arguments);
    const box = document.getElementById("sel-maps");
    if (box) {
      const b = document.createElement("button");
      b.className = "lb-map lbm-rand";
      b.textContent = "🎲 무작위";
      b.onclick = () => {
        const l = MAP_LIST.filter((m) => m.key !== room.map);
        room.map = l[Math.floor(Math.random() * l.length)].key;
        paintSelMaps();
      };
      box.prepend(b);
      requestAnimationFrame(() => keepOn(box));
    }
    return r;
  };
  const _pm = paintMaps;
  paintMaps = function () {
    const r = _pm.apply(this, arguments);
    requestAnimationFrame(() => keepOn(document.getElementById("lb-maps")));
    return r;
  };
  // horizontal wheel for mouse users
  for (const id of ["sel-maps", "lb-maps"]) {
    const el = document.getElementById(id);
    el &&
      el.addEventListener(
        "wheel",
        (e) => {
          if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
          el.scrollLeft += e.deltaY;
          e.preventDefault();
        },
        { passive: !1 }
      );
  }
  const st = document.createElement("style");
  st.textContent = `
#sel-maps,#lb-maps{display:flex!important;flex-wrap:nowrap!important;justify-content:flex-start!important;overflow-x:auto;overflow-y:hidden;gap:6px;padding:4px 2px 8px;scrollbar-width:thin;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;min-width:0;max-width:100%}
#sel-maps .lb-map,#lb-maps .lb-map{flex:none;white-space:nowrap;scroll-snap-align:center}
#sel-maps{max-width:min(860px,62vw)}
#sel-maps .lbm-rand{border-style:dashed}
@media (max-width:900px){#sel-maps{max-width:58vw}#sel-maps .lb-map,#lb-maps .lb-map{padding:6px 10px;font-size:12px}}`;
  document.head.appendChild(st);
  try {
    paintSelMaps();
  } catch (e) {}
})();
