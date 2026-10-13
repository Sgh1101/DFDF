
(() => {
  // (the shop grid squeezed its rows to the screen height on phones, so the
  //  columns spilled into each other; rows now take their content height
  //  and the grid scrolls — see the style block)

  // Touch input now binds once in the engine.

  // 2. a small settings button right under the minimap (touch controls
  //    already have a gear in the top-right strip, so only without them)
  const mini = document.getElementById("mini");
  if (!mini) return;
  const b = document.createElement("button");
  b.id = "mini-set";
  b.type = "button";
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>설정';
  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePause(!0);
  };
  b.addEventListener("click", go);
  b.addEventListener("touchend", go, { passive: !1 });
  b.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: !0 });
  // in <body> above the "click to play" cover, below the pause screen
  document.body.appendChild(b);
  const shop = document.getElementById("shop");
  let last = null;
  (function place() {
    requestAnimationFrame(place);
    const r = mini.getBoundingClientRect();
    const over = ["pause", "admin", "bigmap", "board", "lobby"].some((id) => {
      const el = document.getElementById(id);
      return el && !el.hidden && getComputedStyle(el).display !== "none";
    });
    const show = r.width > 0 && getComputedStyle(mini).display !== "none" && "menu" !== world.phase && !(shop && !shop.hidden) && !IS_TOUCH && !over;
    const key = show ? `${Math.round(r.left)},${Math.round(r.bottom)},${Math.round(r.width)}` : "";
    if (key === last) return;
    last = key;
    b.hidden = !show;
    if (show) {
      b.style.left = r.left + r.width / 2 + "px";
      b.style.top = r.bottom + 6 + "px";
    }
  })();
  const st = document.createElement("style");
  st.textContent = `
#mini-set{position:fixed;transform:translateX(-50%);z-index:36;display:inline-flex;align-items:center;gap:4px;padding:3px 9px 3px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(8,11,16,.72);color:#aeb9c9;font:600 10.5px/1.2 'Noto Sans KR',sans-serif;cursor:pointer;pointer-events:auto;white-space:nowrap}
#mini-set:hover{color:#fff;border-color:rgba(255,255,255,.3)}
#mini-set svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
#mini-set[hidden]{display:none}
#shop .shop-grid{grid-template-rows:none!important;grid-auto-rows:max-content!important;align-content:start;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
#shop .shop-col{min-height:max-content}
@media (max-width:379px) and (orientation:portrait){body.touching #hud #mini{width:74px!important;height:74px!important}body.touching #hud #stick{width:calc(100px*var(--mbs))!important;height:calc(100px*var(--mbs))!important;left:calc(env(safe-area-inset-left) + 3%)!important}}`;
  document.head.appendChild(st);
})();
