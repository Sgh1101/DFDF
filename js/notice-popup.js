// 공지 팝업: the one card in the middle of the homepage that carries what the owner wants everyone to see after
// signing in: the announcement text (game.announcement) and the promo film (js/promo.js, switched by
// game.promoNotice), with two answers under the film (a review, something to add) that open the feedback form
// (js/feedback.js) with that kind chosen. X, Esc and a click on the backdrop close it and remember it, keyed by
// what it showed (announcement + film address): the same notice stays away on the next visit, a changed one comes
// back. The header's ▶ button (js/promo.js) opens the film part again by hand and remembers nothing.
(() => {
  if (window.NOTICE) return;
  const doc = document, KEY = "lgp_notice_seen";
  const EN = () => "en" === window.GAME_LANG || "en" === (() => { try { return localStorage.getItem("lgp_lang"); } catch (e) { return ""; } })();
  const L = (ko, en) => (EN() ? en : ko);
  const url = (v) => (/^https?:\/\//i.test(String(v || "")) ? String(v) : "");
  const signedIn = () => { try { const s = JSON.parse(localStorage.getItem("lgp_session") || "null"); return !!(s && s.token); } catch (e) { return !1; } };
  const seen = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const remember = (k) => { try { localStorage.setItem(KEY, k); } catch (e) {} };
  // FNV-1a: a short stand-in for "this exact text and film"
  const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  const st = { ann: "", promo: !0, maintenance: !1, ready: !1 };
  const P = () => window.PROMO || {};
  const film = () => (st.promo ? url(P().video) : "");
  // the film for this screen: the calm cut when reduced motion is asked for, else the master (both 16:9)
  const cut = () => (window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches && url(P().videoCalm)) || film();
  const key = () => (st.ann || film() ? hash(st.ann + "\n" + film()) : "");
  const CSS = `
#np-back{position:fixed;inset:0;z-index:1900;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(3,5,9,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:var(--fb,system-ui,sans-serif);color:var(--ink,#e8edf4);animation:npFade .18s ease-out}
#np-back[hidden]{display:none}
#np{width:min(760px,100%);max-height:calc(100dvh - 28px);display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:20px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01)),#121722;box-shadow:0 40px 100px -30px #000,inset 0 1px 0 rgba(255,255,255,.08);animation:npPop .22s cubic-bezier(.2,.8,.3,1)}
#np.ann-only{width:min(480px,100%)}
#np header{display:flex;align-items:center;gap:10px;min-width:0;flex:none}
#np header h2{flex:1;margin:0;font-family:var(--fb,inherit);font-weight:700;font-size:16px;line-height:1.2;letter-spacing:.04em;text-transform:none;color:inherit}
#np .np-x{flex:none;min-width:36px;min-height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;font:inherit;cursor:pointer}
#np .np-body{display:flex;flex-direction:column;gap:12px;min-height:0;overflow:auto}
#np .np-ann{margin:0;padding:12px 14px;border-radius:12px;border:1px solid #5c4b1f;background:rgba(255,200,73,.08);color:var(--gold,#ffc849);font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
#np .np-film{display:flex;flex-direction:column;gap:10px;min-width:0}
#np .np-stage{position:relative;min-width:0}
#np video{display:block;width:100%;aspect-ratio:16/9;border-radius:12px;background:#000;object-fit:contain}
#np .np-play{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:2px solid rgba(255,255,255,.85);background:rgba(10,13,18,.62);color:#fff;font-size:24px;line-height:1;padding:0 0 0 4px;cursor:pointer;backdrop-filter:blur(2px)}
#np .np-play:hover{background:rgba(255,59,78,.85);border-color:#fff}
#np .np-play[hidden]{display:none}
#np .np-side{display:flex;flex-direction:column;gap:8px;min-width:0}
#np .np-link{align-self:flex-start;display:inline-flex;align-items:center;min-height:36px;padding:0 4px;color:#8fb8d8;font-size:12.5px;text-decoration:underline}
#np .np-acts{display:flex;flex-wrap:wrap;gap:8px}
#np .np-acts button{flex:1 1 200px;min-height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:inherit;font-weight:700;font-size:13px;line-height:1.2;cursor:pointer}
#np .np-acts button:hover{border-color:var(--gold,#ffc849)}
#np .np-acts button.main{border-color:transparent;color:#14100a;background:linear-gradient(180deg,#ffd869,#f0b72d)}
#np .np-note{margin:0;font-size:11.5px;line-height:1.5;color:#8a97ab}
#np .np-err{margin:0;font-size:12px;color:#ff8a8a}
#np [hidden]{display:none!important}
html.np-lock{overflow:hidden}
@keyframes npFade{from{opacity:0}to{opacity:1}}
@keyframes npPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){#np-back,#np{animation:none}}
@media(max-height:520px) and (min-width:560px){
  #np-back{padding:6px}
  #np{max-height:calc(100dvh - 12px);padding:10px;gap:8px}
  /* sideways on a phone: the film on the left, the words and the buttons in a column on the right */
  #np .np-body{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:8px 10px;align-items:start}
  #np .np-film{display:contents}
  #np .np-stage{grid-column:1;grid-row:1/span 3}
  #np .np-ann{grid-column:2;padding:8px 10px;font-size:12.5px;line-height:1.5}
  #np .np-side{grid-column:2}
  #np .np-acts{flex-direction:column}#np .np-acts button{flex:none}
  #np.ann-only .np-body{display:flex}
}`;
  let back = null, video = null, opener = null, down = !1, manual = !1;
  const q = (s) => back.querySelector(s);
  function build() {
    if (back) return;
    const s = doc.createElement("style");
    s.id = "np-css";
    s.textContent = CSS;
    doc.head.appendChild(s);
    back = doc.createElement("div");
    back.id = "np-back";
    back.hidden = !0;
    back.innerHTML = `<div id="np" role="dialog" aria-modal="true" aria-labelledby="np-h"><header><h2 id="np-h"></h2><button class="np-x" type="button"></button></header><div class="np-body"><p class="np-ann" hidden></p><div class="np-film" hidden><div class="np-stage"><video playsinline preload="none" crossorigin="anonymous"></video><button class="np-play" type="button">▶</button></div><div class="np-side"><p class="np-err" role="alert" hidden></p><a class="np-link" target="_blank" rel="noopener noreferrer" hidden></a><div class="np-acts"><button type="button" class="main" data-k="review"></button><button type="button" data-k="idea"></button></div><p class="np-note"></p></div></div></div></div>`;
    doc.body.appendChild(back);
    video = q("video");
    back.addEventListener("mousedown", (e) => { down = e.target === back; });
    back.addEventListener("click", (e) => { e.target === back && down && close(); down = !1; });
    q(".np-x").onclick = close;
    q(".np-play").onclick = () => { q(".np-play").hidden = !0; video.controls = !0; const r = video.play(); r && r.catch && r.catch(() => {}); video.focus(); };
    video.addEventListener("error", () => { if (video.getAttribute("src")) { q(".np-err").textContent = L("영상을 불러오지 못했습니다. 새 탭에서 열어 보세요.", "The film could not be loaded. Try opening it in a new tab."); q(".np-err").hidden = !1; q(".np-play").hidden = !0; video.controls = !0; } });
    back.querySelectorAll(".np-acts button").forEach((b) => (b.onclick = () => { close(); window.FEEDBACK && FEEDBACK.open({ type: b.dataset.k }); }));
    doc.addEventListener("keydown", (e) => {
      if (!back || back.hidden) return;
      if ("Escape" === e.key) return void (e.stopPropagation(), close());
      if ("Tab" !== e.key) return;
      // keep Tab inside the card
      const f = [...back.querySelectorAll("button:not([disabled]),a[href],video[controls]")].filter((x) => !x.hidden && x.offsetParent !== null), first = f[0], last = f[f.length - 1];
      if (!f.length) return void e.preventDefault();
      if (!back.contains(doc.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }, !0);
  }
  // the words are drawn each time the card opens or the language changes
  function text() {
    const ann = manual ? "" : st.ann, hasFilm = !!film();
    q(".np-ann").hidden = !ann;
    q(".np-ann").textContent = ann ? "📢 " + ann : "";
    q(".np-film").hidden = !hasFilm;
    q("#np").classList.toggle("ann-only", !hasFilm);
    q("#np-h").textContent = ann ? L("공지", "Notice") : L("홍보영상", "Promo film");
    const x = q(".np-x");
    x.textContent = "✕";
    x.setAttribute("aria-label", L("닫기", "Close"));
    const a = q(".np-link"), page = url(P().page);
    a.hidden = !page;
    a.href = page || "#";
    a.textContent = L("새 탭에서 보기", "Open in a new tab");
    q('[data-k="review"]').textContent = "⭐ " + L("후기 남기기", "Leave a review");
    q('[data-k="idea"]').textContent = "💡 " + L("추가했으면 하는 점 보내기", "Suggest something to add");
    q(".np-note").textContent = signedIn() ? "" : L("후기와 제안은 로그인(또는 게스트로 시작)한 뒤 보낼 수 있습니다.", "Sign in (or start as a guest) to send a review or a suggestion.");
    q(".np-play").setAttribute("aria-label", L("영상 재생", "Play the film"));
    video.setAttribute("aria-label", L("홍보영상", "Promo film"));
  }
  // by hand ({ manual: true }) it is the film only; otherwise whatever there is to announce
  function open(o) {
    manual = !!(o && o.manual);
    if (!doc.body || (manual && !film()) || (!manual && !st.ann && !film())) return;
    build();
    opener = doc.activeElement;
    text();
    q(".np-err").hidden = !0;
    video.controls = !1;
    q(".np-play").hidden = !1;
    if (film()) {
      const poster = url(P().poster), caps = url(P().captions);
      poster ? video.setAttribute("poster", poster) : video.removeAttribute("poster");
      if (caps) {
        const tr = doc.createElement("track");
        tr.kind = "captions"; tr.srclang = "ko"; tr.label = "한국어"; tr.default = !0; tr.src = caps;
        video.appendChild(tr);
      }
      // attached now, but preload="none": nothing of the film is fetched until play is pressed
      video.setAttribute("src", cut());
    }
    back.hidden = !1;
    doc.documentElement.classList.add("np-lock");
    (q(".np-film").hidden ? q(".np-x") : q(".np-play")).focus();
  }
  function close() {
    if (!back || back.hidden) return;
    !manual && remember(key());
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.querySelectorAll("track").forEach((t) => t.remove());
    video.controls = !1;
    video.load();
    back.hidden = !0;
    doc.documentElement.classList.remove("np-lock");
    opener && opener.focus && opener.focus();
    opener = null;
  }
  window.NOTICE = {
    // the owner's settings (game.announcement, game.promoNotice, game.maintenance); then the button and the card follow
    configure(game) {
      const g = game || {};
      st.ann = String(g.announcement || "").trim();
      st.promo = !1 !== g.promoNotice;
      st.maintenance = !!g.maintenance;
      st.ready = !0;
      back && !back.hidden && !st.ann && !film() && close();
      window.PROMO && PROMO.paint && PROMO.paint();
    },
    // after signing in, on the homepage: once for each thing to announce
    auto() {
      if (st.maintenance || (back && !back.hidden)) return;
      const k = key();
      k && k !== seen() && open();
    },
    open, close,
    repaint() { back && !back.hidden && text(); },
    // the button waits for the settings (it would flash otherwise), and goes when the owner switches the promo off
    get promoOff() { return !st.ready || !st.promo; },
    key,
  };
})();
