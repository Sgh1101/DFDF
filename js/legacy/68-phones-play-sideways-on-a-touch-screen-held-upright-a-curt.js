
(() => {
  // Phones play sideways. On a touch screen held upright a curtain asks for
  // a turn and keeps every tap to itself; it lifts the moment the screen is
  // wider than it is tall. Where the browser allows it the screen is also
  // locked to landscape on the first touch (the installed app asks for it in
  // its manifest already). A narrow desktop window is left alone.
  if ("undefined" == typeof document || !document.body) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const coarse = () => {
    try {
      return matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches;
    } catch (e) {
      return !1;
    }
  };
  // a phone, a tablet, the app, or the touch controls switched on
  const phone = () => !!window.IS_MOBILE || ("undefined" != typeof IS_TOUCH && !!IS_TOUCH) || coarse();
  const portrait = () => innerHeight > innerWidth;
  const css = document.createElement("style");
  css.textContent = `#rotate{position:fixed;inset:0;z-index:12000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#0b0e14;color:#e8ecf3;text-align:center;font-family:var(--f-body,sans-serif);padding:24px;touch-action:none;user-select:none}#rotate[hidden]{display:none}#rotate .rt-ph{width:46px;height:82px;border:3px solid #9fb4cc;border-radius:9px;position:relative;box-sizing:border-box;animation:rt-turn 2s ease-in-out infinite}#rotate .rt-ph:after{content:"";position:absolute;left:50%;bottom:5px;width:12px;height:3px;margin-left:-6px;border-radius:2px;background:#9fb4cc}#rotate b{font-size:19px;letter-spacing:.02em}#rotate span{font-size:12px;color:#8fa0b6;line-height:1.5}@keyframes rt-turn{0%,20%{transform:rotate(0)}55%,100%{transform:rotate(-90deg)}}`;
  document.head.appendChild(css);
  const el = document.createElement("div");
  el.id = "rotate";
  el.hidden = !0;
  el.innerHTML = `<div class="rt-ph"></div><b>${L("폰을 가로로 돌려 주세요", "Turn your phone sideways")}</b><span>${L("13은 가로 화면에서만 할 수 있습니다", "13 is played in landscape only")}</span>`;
  document.body.appendChild(el);
  function lock() {
    try {
      const o = screen.orientation;
      o && o.lock && o.lock("landscape").catch(() => {});
    } catch (e) {}
  }
  // the curtain keeps every tap, and each one is a chance to ask for landscape
  for (const t of ["touchstart", "touchmove", "touchend", "pointerdown", "pointerup", "click"])
    el.addEventListener(
      t,
      (e) => {
        e.stopPropagation();
        ("touchstart" === t || "touchmove" === t) && e.cancelable && e.preventDefault();
        "touchend" !== t && "click" !== t || lock();
      },
      { passive: !1 }
    );
  function check() {
    const on = phone() && portrait();
    if (el.hidden !== on) return on;
    el.hidden = !on;
    document.body.classList.toggle("rotate-wait", on);
    return on;
  }
  addEventListener("resize", check);
  addEventListener("orientationchange", check);
  try {
    matchMedia("(orientation: portrait)").addEventListener("change", check);
  } catch (e) {}
  document.addEventListener(
    "touchend",
    function once() {
      document.removeEventListener("touchend", once);
      phone() && lock();
    },
    { passive: !0 }
  );
  // the touch-controls switch counts too
  if ("function" == typeof setTouchMode) {
    const _stm = setTouchMode;
    setTouchMode = function () {
      const r = _stm.apply(this, arguments);
      try {
        check();
      } catch (e) {}
      return r;
    };
  }
  check();
  window.LANDSCAPE = { check, portrait, phone, lock, shown: () => !el.hidden };
})();
