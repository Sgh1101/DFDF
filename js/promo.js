window.PROMO = {
  video: "https://13fps-film.vercel.app/v/master_16x9.mp4",
  videoCalm: "https://13fps-film.vercel.app/v/cut_reduced_16x9.mp4",
  poster: "https://13fps-film.vercel.app/poster.jpg",
  captions: "https://13fps-film.vercel.app/captions.ko.vtt",
  page: "https://13fps-film.vercel.app/",
};
// 홍보영상: the small ▶ button in the homepage header. The film itself is shown by the notice card
// (js/notice-popup.js), which opens on its own after signing in; this button opens it again by hand. While `video`
// is not an http(s) address, or the owner switched the promo off (game.promoNotice), the button does not exist.
// The film is always the 16:9 one (also on a phone held upright); reduced motion gets the calm cut, also 16:9.
(() => {
  const P = window.PROMO, doc = document;
  const EN = () => "en" === window.GAME_LANG || "en" === (() => { try { return localStorage.getItem("lgp_lang"); } catch (e) { return ""; } })();
  const L = (ko, en) => (EN() ? en : ko);
  const url = (v) => (/^https?:\/\//i.test(String(v || "")) ? String(v) : "");
  const CSS = `
#promo-open{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:var(--gold,#ffc849);border-color:rgba(255,200,73,.45)}
#promo-open:hover{border-color:var(--gold,#ffc849)}
#promo-open i{font-style:normal;font-size:10px;line-height:1}
#promo-open.corner{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:50}
@media(pointer:coarse){#promo-open{min-height:36px}}
/* a phone upright: the header keeps one line, so the pill shrinks to its triangle and the other chips tighten a little */
@media(max-width:520px){
  #promo-open{min-width:36px;justify-content:center;padding:7px 10px}#promo-open .t{display:none}
  .top:has(#promo-open){gap:6px}.top:has(#promo-open) .chip{padding:7px 9px;white-space:nowrap}.top:has(#promo-open) #promo-open{padding:7px 10px}
}`;
  let btn = null;
  // the button: created when the film is there to show, removed when it is not; call again after changing PROMO
  function paint() {
    window.NOTICE && NOTICE.repaint();
    if (!url(P.video) || (window.NOTICE && NOTICE.promoOff)) { btn && btn.remove(); btn = null; return; }
    if (!btn) {
      if (!doc.body) return;
      if (!doc.getElementById("promo-css")) { const s = doc.createElement("style"); s.id = "promo-css"; s.textContent = CSS; doc.head.appendChild(s); }
      btn = doc.createElement("button");
      btn.id = "promo-open";
      btn.type = "button";
      btn.className = "chip";
      btn.onclick = () => window.NOTICE && NOTICE.open({ manual: !0 });
      // next to 문의 in the header when the page has one, else a pill in the bottom corner
      const fb = doc.getElementById("fbOpen");
      if (fb && fb.parentNode) fb.parentNode.insertBefore(btn, fb);
      else { btn.classList.add("corner"); doc.body.appendChild(btn); }
    }
    btn.innerHTML = `<i aria-hidden="true">▶</i><span class="t">${L("홍보영상", "Promo")}</span>`;
    btn.title = btn.ariaLabel = L("홍보영상 보기", "Watch the promo film");
  }
  Object.assign(P, { paint, open: () => window.NOTICE && NOTICE.open({ manual: !0 }), close: () => window.NOTICE && NOTICE.close() });
  doc.readyState === "loading" ? doc.addEventListener("DOMContentLoaded", paint) : paint();
})();
