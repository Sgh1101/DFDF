
(() => {
  // The touch controls, laid out by the player. Settings → 조작 → 버튼 배치
  // 편집 opens the controls over the screen: drag any button where you like,
  // tap one and slide its size. The layout is kept on this device and, signed
  // in, on the account (the newer of two devices wins), so a phone and a
  // tablet each keep their own hands. The joystick is left alone: it already
  // floats to wherever the thumb lands.
  if ("undefined" == typeof world || !document.getElementById("touch")) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  // what can be moved: [key, element finder, name, sizes through --mbs?]
  const PARTS = [
    ["tb-fire", () => $("tb-fire"), L("사격", "Fire"), !0],
    ["tb-fire2", () => $("tb-fire2"), L("왼쪽 사격", "Left fire"), !0],
    ["tb-ads", () => $("tb-ads"), L("조준", "Aim"), !0],
    ["tb-jump", () => $("tb-jump"), L("점프", "Jump"), !0],
    ["tb-crouch", () => $("tb-crouch"), L("앉기", "Crouch"), !0],
    ["tb-rel", () => $("tb-rel"), L("장전", "Reload"), !0],
    ["tb-use", () => $("tb-use"), L("설치/해제 (F)", "Use (F)"), !0],
    ["tb-nade", () => $("tb-nade"), L("수류탄", "Grenade"), !0],
    ["tab-0", () => document.querySelector('#tabil .tab[data-a="0"]'), L("능력 Q", "Ability Q"), !0],
    ["tab-1", () => document.querySelector('#tabil .tab[data-a="1"]'), L("능력 E", "Ability E"), !0],
    ["tab-2", () => document.querySelector('#tabil .tab[data-a="2"]'), L("능력 C", "Ability C"), !0],
    ["tab-3", () => document.querySelector('#tabil .tab[data-a="3"]'), L("궁극기 X", "Ultimate X"), !0],
    ["mb-util", () => $("mb-util"), L("위쪽 메뉴 줄", "Top strip"), !1],
    ["mini", () => $("mini"), L("작은 지도", "Minimap"), !1],
  ];
  const BY = {};
  PARTS.forEach((p) => (BY[p[0]] = p));
  const KEYS = PARTS.map((p) => p[0]);

  // ── the layout: key → [x, y, size], x and y as fractions of the screen ──
  const touchCacheKey = "lgp_touch_layout:" + ((window.ACCOUNT && ACCOUNT.session() && ACCOUNT.session().user.id) || "local");
  const TL = { t: 0, m: {} };
  const clean = (m) => {
    const o = {};
    if (m && "object" == typeof m)
      for (const k of KEYS) {
        const v = m[k];
        Array.isArray(v) && 3 === v.length && v.every((n) => isFinite(+n)) && (o[k] = [Math.min(1, Math.max(0, +v[0])), Math.min(1, Math.max(0, +v[1])), Math.min(2.5, Math.max(0.4, +v[2]))]);
      }
    return o;
  };
  try {
    const j = JSON.parse(localStorage.getItem(touchCacheKey) || "null");
    j && j.m && ((TL.m = clean(j.m)), (TL.t = +j.t || 0));
  } catch (e) {}
  const save = () => {
    try {
      localStorage.setItem(touchCacheKey, JSON.stringify(TL));
    } catch (e) {}
  };
  const globalSize = () => {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mbs"));
    return isFinite(v) && v > 0 ? v : 1;
  };
  let appliedG = 0;
  const hudBox = () => {
    const h = $("hud"),
      r = h && h.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? r : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  };
  // a part gets its place and size as inline rules that beat the stylesheet
  function place(key) {
    const p = BY[key],
      el = p && p[1]();
    if (!el) return;
    const v = TL.m[key];
    const set = (k, val) => el.style.setProperty(k, val, "important");
    if (!v) {
      for (const k of ["position", "left", "top", "right", "bottom", "transform", "--mbs", "margin", "width", "height"]) el.style.removeProperty(k);
      return;
    }
    set("position", "absolute");
    set("left", (100 * v[0]).toFixed(2) + "%");
    set("top", (100 * v[1]).toFixed(2) + "%");
    set("right", "auto");
    set("bottom", "auto");
    set("margin", "0");
    if (key === "tb-nade") { set("width", "calc(48px * var(--mbs))"); set("height", "calc(48px * var(--mbs))"); }
    if (p[3]) {
      set("--mbs", String(globalSize() * v[2]));
      set("transform", "translate(-50%,-50%)");
    } else set("transform", `translate(-50%,-50%) scale(${v[2]})`);
  }
  function applyAll() {
    appliedG = globalSize();
    for (const k of KEYS) place(k);
  }
  applyAll();
  // the size slider in the settings moves the global size: follow it
  setInterval(() => {
    try {
      Object.keys(TL.m).length && globalSize() !== appliedG && applyAll();
    } catch (e) {}
  }, 500);

  // ── the account keeps it ──
  const AC = () => window.ACCOUNT || null;
  const token = () => {
    try {
      const s = AC() && AC().session && AC().session();
      return (s && s.token) || "";
    } catch (e) {
      return "";
    }
  };
  const online = () => {
    try {
      const o = AC() && AC().online;
      return "function" == typeof o ? !!o() : !!o;
    } catch (e) {
      return !1;
    }
  };
  // a change is sent 1.2 s after the last edit and sent again until the
  // server echoes it (two saves of the account may cross and one be lost);
  // a newer layout on the server (another device) wins and is taken over
  let pulled = "",
    acked = TL.t,
    pushT = 0,
    busy = !1,
    pendingPrefs = null;
  function take(srv) {
    if (ED.on) { if (!pendingPrefs || +srv.t > +pendingPrefs.t) pendingPrefs = srv; return; }
    TL.m = clean(srv.touch);
    TL.t = +srv.t || Date.now();
    acked = TL.t;
    save();
    applyAll();
  }
  async function push() {
    const t = token();
    if (!t || !online() || busy || ED.on) return;
    busy = !0;
    const at = TL.t;
    try {
      const j = await AC().api("prefs", { token: t, set: { touch: TL.m }, t: at }),
        srv = j && j.prefs;
      if (srv && srv.touch) {
        const st = +srv.t || 0;
        if (st > at) take(srv);
        else if (st === at) {
          acked = at;
          // look once more a little later: a crossing save may have dropped it
          setTimeout(() => {
            pulled = "";
            sync(!1);
          }, 4000);
        }
      }
    } catch (e) {}
    busy = !1;
  }
  async function sync(force) {
    const t = token();
    if (!t || !online() || ED.on) return;
    if (TL.t && acked < TL.t && !pushT) return push();
    if (!force && pulled === t) return;
    pulled = t;
    try {
      const j = await AC().api("prefs", { token: t }),
        srv = j && j.prefs,
        st = (srv && +srv.t) || 0;
      if (srv && srv.touch && st > TL.t) take(srv);
      else if (TL.t && st < TL.t) {
        acked = st;
        push();
      } else if (st === TL.t) acked = TL.t;
    } catch (e) {
      pulled = "";
    }
  }
  setInterval(() => sync(!1), 2500);
  function changed() {
    TL.t = Date.now();
    save();
    applyAll();
    clearTimeout(pushT);
    pushT = setTimeout(() => {
      pushT = 0;
      push();
    }, 1200);
  }

  // ── the editor ──
  const css = document.createElement("style");
  css.textContent = `
body.mb-editing #hud>*:not(#touch):not(#mini){visibility:hidden!important}
body.mb-editing #hud{visibility:visible!important;z-index:64!important;pointer-events:auto!important}
body.mb-editing #hud #touch,body.mb-editing #hud #tbtns,body.mb-editing #hud #tabil{pointer-events:none}
body.mb-editing .mbe-part{pointer-events:auto!important;outline:2px dashed rgba(56,214,255,.75);outline-offset:3px;cursor:move;touch-action:none;display:grid!important;opacity:1!important;transition:none!important}
body.mb-editing .mbe-part.hide{display:grid!important}
body.mb-editing .mbe-part.mbe-sel{outline:3px solid #ffc849;box-shadow:0 0 0 6px rgba(255,200,73,.25)}
body.mb-editing #mb-util,body.mb-editing #mini{pointer-events:auto!important}
body.mb-editing #mb-util .mb{pointer-events:none!important}
#mbe-back{position:fixed;inset:0;z-index:63;background:radial-gradient(ellipse at 50% 50%,rgba(14,20,30,.55),rgba(6,8,12,.86));background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:40px 40px}
#mbe-bar{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:66;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;max-width:min(760px,96vw);padding:8px 12px;border-radius:14px;background:rgba(14,19,27,.94);border:1px solid var(--line,#2a3444);color:var(--ink,#e8edf4);font-size:12px}
#mbe-bar h4{font-family:var(--f-display);font-size:12px;letter-spacing:.14em;margin:0 4px 0 0}
#mbe-bar .mbe-name{min-width:72px;color:var(--gold,#ffc849);font-weight:700}
#mbe-bar input[type=range]{width:120px}
#mbe-bar .btn{padding:9px 12px;font-size:11px;min-height:44px}
#mbe-bar .mbe-hint{width:100%;text-align:center;font-size:10.5px;color:var(--steel-dim,#5b6879)}
@media(max-width:600px){#mbe-bar{gap:6px;padding:6px 8px}#mbe-bar input[type=range]{width:90px}#mbe-bar .btn{padding:8px 9px}}
`;
  document.head.appendChild(css);
  const ED = { on: !1, sel: null, before: null, was: null, drag: null };
  let bar = null,
    back = null;
  function buildBar() {
    if (bar) return;
    back = document.createElement("div");
    back.id = "mbe-back";
    bar = document.createElement("div");
    bar.id = "mbe-bar";
    bar.innerHTML = `<h4>${L("버튼 배치", "Button layout")}</h4><span class="mbe-name" id="mbe-name">—</span>
      <label>${L("크기", "Size")} <input type="range" id="mbe-size" min="0.6" max="1.8" step="0.05" value="1"></label><b id="mbe-pct">100%</b>
      <button class="btn" id="mbe-one">${L("이 버튼 기본값", "Reset this")}</button><button class="btn" id="mbe-all">${L("전부 기본값", "Reset all")}</button>
      <button class="btn btn-go" id="mbe-save">${L("저장", "Save")}</button><button class="btn" id="mbe-x">${L("취소", "Cancel")}</button>
      <div class="mbe-hint">${L("끌어서 옮기고, 누른 뒤 크기를 조절합니다. 조이스틱은 엄지가 닿는 자리로 알아서 옵니다.", "Drag to move; tap, then slide the size. The joystick floats to your thumb on its own.")}</div>`;
    for (const el of [back, bar]) {
      el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: !0 });
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    const size = () => bar.querySelector("#mbe-size");
    size().addEventListener("input", () => {
      if (!ED.sel) return;
      const v = cur(ED.sel);
      v[2] = +size().value;
      TL.m[ED.sel] = v;
      bar.querySelector("#mbe-pct").textContent = Math.round(100 * v[2]) + "%";
      place(ED.sel);
    });
    bar.querySelector("#mbe-one").onclick = () => {
      if (!ED.sel) return;
      delete TL.m[ED.sel];
      place(ED.sel);
      select(ED.sel);
    };
    bar.querySelector("#mbe-all").onclick = () => {
      TL.m = {};
      applyAll();
      ED.sel && select(ED.sel);
    };
    bar.querySelector("#mbe-save").onclick = () => close(!0);
    bar.querySelector("#mbe-x").onclick = () => close(!1);
  }
  // where a part is now, as a layout entry (from its box when it has none yet)
  function cur(key) {
    if (TL.m[key]) return TL.m[key].slice();
    const el = BY[key][1](),
      r = el && el.getBoundingClientRect();
    const h = hudBox();
    return r && r.width ? [(r.left + r.width / 2 - h.left) / h.width, (r.top + r.height / 2 - h.top) / h.height, 1] : [0.5, 0.5, 1];
  }
  function select(key) {
    ED.sel = key;
    PARTS.forEach(([k]) => {
      const el = BY[k][1]();
      el && el.classList.toggle("mbe-sel", k === key);
    });
    const v = cur(key);
    bar.querySelector("#mbe-name").textContent = BY[key][2];
    bar.querySelector("#mbe-size").value = v[2];
    bar.querySelector("#mbe-pct").textContent = Math.round(100 * v[2]) + "%";
  }
  // dragging: pointer events on the part itself; the game's own touch handlers never see it
  const H = new Map();
  function arm(key) {
    const el = BY[key][1]();
    if (!el || H.has(el)) return;
    el.classList.add("mbe-part");
    const previousTab = el.getAttribute("tabindex");
    el.addEventListener("focus", () => { if (ED.on) select(key); });
    el.addEventListener("keydown", (event) => {
      if (!ED.on || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const value = cur(key), axis = event.key === "ArrowLeft" || event.key === "ArrowRight" ? 0 : 1;
      value[axis] = Math.max(.02, Math.min(.98, value[axis] + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) * (event.shiftKey ? .05 : .01)));
      TL.m[key] = value; place(key);
    });
    const block = (e) => {
      if (!ED.on) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    const down = (e) => {
      if (!ED.on) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      select(key);
      const v = cur(key);
      ED.drag = { key, id: e.pointerId, x0: e.clientX, y0: e.clientY, v0: v };
      try {
        el.setPointerCapture(e.pointerId);
      } catch (x) {}
    };
    const move = (e) => {
      if (!ED.on || !ED.drag || ED.drag.key !== key || e.pointerId !== ED.drag.id) return;
      e.preventDefault();
      const d = ED.drag,
        v = d.v0.slice(),
        h = hudBox();
      v[0] = Math.min(0.98, Math.max(0.02, d.v0[0] + (e.clientX - d.x0) / h.width));
      v[1] = Math.min(0.98, Math.max(0.02, d.v0[1] + (e.clientY - d.y0) / h.height));
      TL.m[key] = v;
      place(key);
    };
    const up = (e) => {
      if (!ED.drag || ED.drag.key !== key || e.pointerId !== ED.drag.id) return;
      ED.drag = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (x) {}
    };
    el.addEventListener("touchstart", block, { capture: !0, passive: !1 });
    el.addEventListener("touchend", block, { capture: !0, passive: !1 });
    el.addEventListener("touchcancel", block, { capture: !0, passive: !1 });
    el.addEventListener("pointerdown", down, { capture: !0 });
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", block, { capture: !0 });
    H.set(el, previousTab);
  }
  function open() {
    if (ED.on) return;
    buildBar();
    ED.on = !0;
    resetTouchInput();
    ED.before = JSON.stringify(TL.m);
    const hud = $("hud"),
      touch = $("touch"),
      pz = $("pause");
    ED.was = { hud: hud && hud.hidden, touch: touch && touch.hidden, touching: document.body.classList.contains("touching"), pz: pz && pz.hidden, pzDisp: pz && pz.style.display };
    hud && (hud.hidden = !1);
    touch && (touch.hidden = !1);
    document.body.classList.add("touching", "mb-editing");
    pz && (pz.style.display = "none");
    try {
      document.exitPointerLock && document.exitPointerLock();
    } catch (e) {}
    // beside the HUD, so the z-order below is the HUD's own (a backdrop on the body would sit over it)
    ((hud && hud.parentNode) || document.body).append(back, bar);
    KEYS.forEach(arm);
    for (const [el] of H) el.tabIndex = 0;
    applyAll();
    select("tb-fire");
  }
  function close(keep) {
    if (!ED.on) return;
    ED.on = !1;
    ED.drag = null;
    for (const [el, tab] of H) { if (tab === null) el.removeAttribute("tabindex"); else el.setAttribute("tabindex", tab); }
    if (keep) {
      JSON.stringify(TL.m) !== ED.before && changed();
    } else {
      TL.m = JSON.parse(ED.before || "{}");
      applyAll();
    }
    if (pendingPrefs) {
      if (+pendingPrefs.t > TL.t) take(pendingPrefs);
      pendingPrefs = null;
    }
    PARTS.forEach(([k]) => {
      const el = BY[k][1]();
      el && el.classList.remove("mbe-sel");
    });
    back.remove();
    bar.remove();
    document.body.classList.remove("mb-editing");
    const w = ED.was || {},
      hud = $("hud"),
      touch = $("touch"),
      pz = $("pause");
    w.touching || document.body.classList.remove("touching");
    hud && (hud.hidden = !!w.hud);
    touch && (touch.hidden = !!w.touch);
    pz && (pz.style.display = w.pzDisp || "");
  }
  addEventListener(
    "keydown",
    (e) => {
      if (!ED.on || e.key === "Tab" || e.key.startsWith("Arrow") || e.target.tagName === "INPUT") return;
      e.stopImmediatePropagation();
      "Escape" === e.key && close(!1);
    },
    !0
  );
  // the way in: a row in the settings' controls pane
  try {
    const pane = document.querySelector('.pz-pane[data-pane="ctl"]');
    if (pane && !$("mbe-open")) {
      const d = document.createElement("div");
      d.className = "pz-row";
      d.innerHTML = `<div class="xh-line"><span style="font-weight:700">${L("터치 버튼 배치", "Touch button layout")}</span><button class="btn" id="mbe-open" style="padding:9px 16px;font-size:11px;min-height:44px">${L("버튼 배치 편집", "Edit layout")}</button></div><div style="font-size:10.5px;color:var(--steel-dim);margin-top:4px">${L("버튼을 끌어서 옮기고 크기를 바꿉니다. 이 기기와 계정에 저장됩니다.", "Drag the buttons and set their size. Kept on this device and on your account.")}</div>`;
      pane.appendChild(d);
      $("mbe-open").onclick = () => {
        sync(!0);
        open();
      };
    }
  } catch (e) {}
  window.TOUCHLAY = { open, close, layout: () => TL, set: (k, v) => { const value = clean({ [k]: v })[k]; if (!value) return; TL.m[k] = value; ED.on ? applyAll() : changed(); }, reset: () => { TL.m = {}; ED.on ? applyAll() : changed(); }, apply: applyAll, parts: KEYS, sync: () => sync(!0), editing: () => ED.on, select };
})();
