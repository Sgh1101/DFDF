(() => {
  // A guest who loses the host gets a small card with "report the connection problem". It opens the bug form
  // prefilled (where: connection lost) and the form attaches the saved ICE story (see 110-… and js/feedback.js).
  // The card is also offered once after a reload that follows such a drop. A host that said goodbye on purpose
  // (NET_RC.bye) is not a connection problem and gets no card.
  if ("function" != typeof hostLeftNotice || "function" != typeof window.iceSave) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  let card = null;
  function hide(forget) {
    card && (card.hidden = !0);
    forget && window.iceOffer(!1);
  }
  function show() {
    if (!card) {
      card = document.createElement("div");
      card.id = "ice-notice";
      card.setAttribute("role", "status");
      card.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:1900;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(18,23,34,.96);color:#e8edf4;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 14px 40px -12px #000";
      const text = document.createElement("span");
      text.textContent = L("연결이 끊겼습니다.", "The connection was lost.");
      const go = document.createElement("button");
      go.type = "button";
      go.id = "ice-notice-report";
      go.textContent = L("연결 문제 신고", "Report connection problem");
      go.style.cssText = "min-height:36px;padding:0 14px;border-radius:10px;border:0;background:linear-gradient(180deg,#ffd869,#f0b72d);color:#14100a;font:800 12px/1 inherit;cursor:pointer";
      go.onclick = () => {
        hide(!0);
        window.FEEDBACK && window.FEEDBACK.open({ type: "bug", where: "connection" });
      };
      const x = document.createElement("button");
      x.type = "button";
      x.setAttribute("aria-label", L("닫기", "Close"));
      x.textContent = "✕";
      x.style.cssText = "min-width:32px;min-height:32px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;cursor:pointer";
      x.onclick = () => hide(!0);
      card.append(text, go, x);
      document.body.appendChild(card);
    }
    card.hidden = !1;
  }
  const _hl = hostLeftNotice;
  hostLeftNotice = function () {
    const intended = !!(window.NET_RC && window.NET_RC.bye);
    if (!intended) window.iceSave("host-gone", !0);
    const r = _hl.apply(this, arguments);
    if (!intended) show();
    return r;
  };
  window.ICE_NOTICE = { show, hide };
  // after a reload that followed a drop: offer it once more
  setTimeout(() => {
    const saved = window.iceSaved(10 * 60000);
    saved && saved.offer && show();
  }, 1500);
})();
