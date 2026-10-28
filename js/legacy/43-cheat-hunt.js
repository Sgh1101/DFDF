
(() => {
  // Cheats in a room: who may switch them on, and what they do. The owner, and an account the owner gave cheats to,
  // have them always (nothing clamped); a guest's switches count only once the host knows its account (GRANT, OWNP).
  // Abilities come back every few seconds under cheat mode. Admin mode is closed to everyone (it is meant to open
  // with a paid pass, not built yet). The code that used to be painted on a building and gave anyone who found it
  // the round's cheats is gone.
  const $ = (id) => document.getElementById(id);
  const A2 = window.ADMIN2;
  if (!A2 || "undefined" == typeof NET) return;
  const isClient = () => "client" === NET.mode;
  const DEF = { radar: !1, wall: !1, cheat: !1, god: !1, oneShot: !1, infAmmo: !1, noRecoil: !1, speed: 1, fastFire: 1 };
  const HUNT = { unlocked: !1 }; // granted: set by the owner and account modules
  const OK = new Set(); // host: guests let in for this round (the modules that grant cheats clear and fill it)
  const GRANT = new Set(); // host: guests the owner gave cheats to (kept between rounds)
  const OWNP = new Set(); // host: guests the server confirmed as the owner
  // the owner, or a player the owner gave cheats to: always open, nothing clamped
  const boss = () => !!window.IS_OWNER || !!HUNT.granted;
  const free2 = (peer) => GRANT.has(peer) || OWNP.has(peer);
  // the owner's rules (admin page → /api/v1 config), with the built-in defaults
  const CDEF = { enabled: !0, refillSec: 5, ultInfinite: !1, allow: {}, maxSpeed: 3, maxFastFire: 10 };
  const C = () => Object.assign({}, CDEF, (window.SERVER_CFG && window.SERVER_CFG.cheat) || {});
  const allowed = (k) => !1 !== (C().allow || {})[k];
  // ── host / solo: every round guests lose their place and personal switches go back ──
  function relock() {
    if (boss()) {
      HUNT.unlocked = !0;
      return refresh();
    }
    HUNT.unlocked = !1;
    const P = A2.P;
    if (Object.keys(DEF).some((k) => P[k] !== DEF[k])) {
      for (const k in DEF) A2.setPersonal(k, DEF[k]);
      A2.afterChange();
    }
    refresh();
  }
  function dropGuests() {
    OK.clear();
    for (const p of [...A2.PEERS.keys()]) free2(p) || A2.PEERS.delete(p);
    for (const a of world.actors || []) "me" !== a.ctrl && !free2(a.ctrl) && a._kit && a.agent && A2.setKit(a, a.agent);
  }
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    try {
      isClient() || (dropGuests(), relock());
    } catch (e) {}
    return r;
  };

  // ── cheats: abilities come back every 5 s, the ultimate never refills ──
  let cheatT = 0;
  function refill(a, full) {
    if (!a || !a.alive || !a.abilities) return;
    for (const x of a.abilities) x.def && (full || !x.def.ult) && ((x.cd = 0), (x.charges = Math.max(x.charges || 0, x.def.charges || 1)));
    (full || C().ultInfinite) && (a.ultCharge = a.ultMax || 5);
  }
  // the owner: everything, ultimate too, back the moment it is used
  const ownerActor = (a) => !!a && (("me" === a.ctrl && !!window.IS_OWNER) || OWNP.has(a.ctrl));
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      if ("menu" !== world.phase) {
        if (!isClient()) for (const a of world.actors || []) { if (!ownerActor(a)) continue; const f = A2.flagsFor(a); f && f.cheat && refill(a, !0); }
        else window.IS_OWNER && A2.P.cheat && refill(myActor(), !0);
      }
    } catch (e) {}
    try {
      if ("menu" !== world.phase && (cheatT += dt || 0) >= Math.max(0, +C().refillSec || 0)) {
        cheatT = 0;
        if (!isClient()) for (const a of world.actors || []) { const f = A2.flagsFor(a); f && f.cheat && !ownerActor(a) && refill(a); }
        else A2.P.cheat && refill(myActor());
      }
    } catch (e) {}
    return r;
  };

  // ── network ──
  const _oa = NET.onAction;
  NET.onAction = (peer, msg) => {
    // cheat switches from a guest the host has not let in do nothing
    if (msg && ("padm" === msg.t || "kit" === msg.t) && !OK.has(peer) && !free2(peer)) {
      A2.PEERS.delete(peer);
      return;
    }
    if (msg && "padm" === msg.t && msg.p && !free2(peer)) msg = Object.assign({}, msg, { p: tame(Object.assign({}, ...["buff", ...Object.keys(DEF)].filter((k) => k in Object(msg.p)).map((k) => ({ [k]: msg.p[k] })))) });
    return _oa(peer, msg);
  };
  function tame(p) {
    const c = C();
    for (const k in DEF) allowed(k) || (p[k] = DEF[k]);
    null != p.speed && (p.speed = Math.min(+p.speed || 1, c.maxSpeed));
    null != p.fastFire && (p.fastFire = Math.min(+p.fastFire || 1, c.maxFastFire));
    return p;
  }
  // my own switches too (checked every second)
  setInterval(() => {
    try {
      if (boss()) {
        HUNT.unlocked || ((HUNT.unlocked = !0), refresh());
        return;
      }
      const P = A2.P,
        want = tame(Object.assign({}, P));
      let ch = !1;
      for (const k in DEF) P[k] !== want[k] && (A2.setPersonal(k, want[k]), (ch = !0));
      !C().enabled && HUNT.unlocked && relock();
      ch && A2.afterChange();
    } catch (e) {}
  }, 1000);
  // ── the panel: 치트 and 관리자 (closed) ──
  const tabsEl = document.querySelector("#ad-panel .ad-tabs");
  const tabBtn = (t) => tabsEl && tabsEl.querySelector(`button[data-t="${t}"]`);
  const curTab = () => {
    const b = tabsEl && tabsEl.querySelector("button.on");
    return b ? b.dataset.t : "me";
  };
  if (tabBtn("me") && tabBtn("global")) {
    tabBtn("me").innerHTML = "치트";
    tabBtn("global").innerHTML = "관리자 <small>🔒</small>";
  }
  const E = (ko, en) => ("en" === window.GAME_LANG ? en : ko);
  openAdmin = function () {
    // like the settings tab: only an account with admin rights (or the owner) opens it, F9 included
    if (!(window.ADMIN_GRANTED || window.IS_OWNER)) return;
    $("admin").hidden = !1;
    try {
      document.exitPointerLock();
    } catch (e) {}
    $("ad-lock").hidden = !0;
    $("ad-panel").hidden = !1;
    const b = tabBtn("me");
    b ? b.click() : buildAdminUI();
  };
  tryAdminPass = () => {};
  window.adminPassOk = () => !1;
  const _bui = buildAdminUI;
  buildAdminUI = function () {
    const r = _bui.apply(this, arguments);
    try {
      decorate();
    } catch (e) {}
    return r;
  };
  function decorate() {
    const t = curTab(),
      note = document.querySelector("#ad-panel .ad-note"),
      grid = $("ad-grid"),
      tg = $("ad-toggles"),
      out = $("ad-lockout"),
      def = $("ad-default");
    out && ((out.hidden = "me" !== t || !HUNT.unlocked), (out.textContent = "치트 잠그기"));
    def && (def.hidden = "me" !== t || !HUNT.unlocked);
    if ("global" === t && window.ADMIN_GRANTED) {
      note && (note.innerHTML = E("<b>관리자 모드</b> · 운영자가 열어 준 기간 동안 쓸 수 있습니다. ", "<b>Admin mode</b> · open for the period the operator granted. ") + (isClient() ? E("방 설정은 방장만 바꿀 수 있습니다.", "Only the host can change room settings.") : E("방 전체에 적용됩니다.", "Applies to the whole room.")));
      return;
    }
    if ("global" === t) {
      // admin mode: nobody unless the owner opened it for this account
      $("ad-panel").classList.remove("ad-locked");
      grid && (grid.innerHTML = "");
      tg && (tg.innerHTML = "");
      note && (note.innerHTML = E("<b>관리자 모드는 잠겨 있습니다.</b> 운영자가 열어 준 계정만 쓸 수 있습니다.", "<b>Admin mode is locked.</b> Only accounts the operator opened it for can use it."));
      return;
    }
    if (HUNT.unlocked) {
      // switches the owner has not allowed are not offered
      const NAMES = { radar: "작은 지도에 적 표시", wall: "벽 너머 적 보기", cheat: "치트 모드", god: "무적", oneShot: "한 방 처치", infAmmo: "탄약 무제한", noRecoil: "반동 없음", speed: "내 이동 속도", fastFire: "내 연사 속도" };
      for (const k in NAMES) {
        if (allowed(k) || boss()) continue;
        document.querySelectorAll("#ad-toggles .ad-tg, #ad-grid .ad-item").forEach((n) => n.textContent.includes(NAMES[k]) && n.remove());
      }
      if (boss()) {
        note && (note.innerHTML = window.IS_OWNER ? E("<b>운영자</b> · 모든 치트가 항상 열려 있고 제한이 없습니다.", "<b>Owner</b> · every cheat is always open, no limits.") : E("<b>운영자가 치트를 열어 주었습니다.</b> 운영자가 거둘 때까지 열려 있습니다.", "<b>The owner gave you cheats</b> until they take them back."));
        return;
      }
      note && (note.innerHTML = E("<b>치트가 열려 있습니다.</b> 나에게만 적용되고 다른 사람 화면에는 아무 표시도 없습니다.", "<b>Cheats are open.</b> Only you are affected and nobody else sees anything."));
      return;
    }
    grid && (grid.innerHTML = "");
    tg && (tg.innerHTML = "");
    if (!note) return;
    note.innerHTML = C().enabled
      ? E("<b>치트 권한이 없습니다.</b> 운영자가 열어 준 계정만 쓸 수 있습니다.", "<b>No cheat rights.</b> Only accounts the operator opened cheats for can use them.")
      : E("<b>운영자가 치트를 꺼 두었습니다.</b>", "<b>The operator has switched cheats off.</b>");
  }
  function refresh() {
    try {
      ADMIN_UNLOCKED = HUNT.unlocked;
      const open = $("admin") && !$("admin").hidden && !$("ad-panel").hidden;
      open && buildAdminUI();
    } catch (e) {}
  }
  $("ad-lockout") &&
    ($("ad-lockout").onclick = () => {
      relock();
      buildAdminUI();
      banner("치트를 잠갔습니다", "#8a97ab");
    });
  // the settings tab is the way in to cheats now
  setInterval(() => {
    try {
      ADMIN_UNLOCKED = HUNT.unlocked;
      const b = $("pz-adtab");
      b && b.lastChild && 3 === b.lastChild.nodeType && "치트" !== b.lastChild.textContent && (b.lastChild.textContent = "치트");
      // the cheats and 관리자 tabs are only for accounts with admin rights
      const adm = !!(window.ADMIN_GRANTED || window.IS_OWNER);
      b && (b.style.display = adm ? "" : "none");
      const g = tabBtn("global");
      g && (g.style.display = adm ? "" : "none");
      const m = tabBtn("me");
      m && (m.style.display = adm ? "" : "none");
    } catch (e) {}
  }, 500);
  const st = document.createElement("style");
  st.textContent = `#ad-lockout[hidden],#ad-default[hidden]{display:none}`;
  document.head.appendChild(st);
  window.HUNTX = { HUNT, OK, GRANT, OWNP, relock, refresh, isClient, E };
})();
