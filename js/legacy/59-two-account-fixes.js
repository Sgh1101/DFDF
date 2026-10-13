
(() => {
  // Two account fixes.
  // 1. A guest's kills and deaths. The host counts every kill, but a guest's
  //    own match statistics never moved, so its result screen and the account
  //    saw 0 kills. The host's tally for my actor is mirrored here.
  // 2. Admin mode by the item. The owner can open only some of the room-wide
  //    settings for an account; the others are not offered on the panel.
  if ("undefined" == typeof NET || "undefined" == typeof world || "undefined" == typeof applySnapshot) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const AC = () => window.ACCOUNT || null;

  // ── 1. a guest's statistics ──
  const fresh = () => (world.stats = { kills: 0, deaths: 0, dmg: 0, shots: 0, hits: 0 });
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    try {
      e && "begin" === e.t && "client" === NET.mode && fresh();
    } catch (x) {}
    return _oe.apply(this, arguments);
  };
  let wasAlive = !0;
  const _as = applySnapshot;
  applySnapshot = function () {
    const r = _as.apply(this, arguments);
    try {
      if ("client" === NET.mode) {
        const me = "function" == typeof myActor && myActor();
        if (me) {
          world.stats || fresh();
          wasAlive && !me.alive && "menu" !== world.phase && world.stats.deaths++;
          wasAlive = !!me.alive;
          (me.kills | 0) > (world.stats.kills | 0) && (world.stats.kills = me.kills | 0);
        }
      }
    } catch (e) {}
    return r;
  };

  // ── 2. admin mode, item by item ──
  // the panel's room-wide tab builds these, in this order: seven sliders, then two switches
  const KNOBS = ["run", "roundT", "buyT", "matchT", "jumpV", "gravity", "aiSpeed", "infAll", "freezeAI"];
  const NAMES = { run: L("이동 속도", "Move speed"), roundT: L("라운드 시간", "Round time"), buyT: L("구매 시간", "Buy time"), matchT: L("데스매치 경기 시간", "Deathmatch length"), jumpV: L("점프 높이", "Jump"), gravity: L("중력", "Gravity"), aiSpeed: L("봇 속도", "Bot speed"), infAll: L("모든 능력 무제한", "Unlimited abilities"), freezeAI: L("봇 정지", "Freeze bots") };
  const allow = () => {
    try {
      const u = AC().session().user;
      return u && u.adminAllow && "object" == typeof u.adminAllow ? u.adminAllow : null;
    } catch (e) {
      return null;
    }
  };
  function prune() {
    if (window.IS_OWNER) return;
    const tab = document.querySelector("#ad-panel .ad-tabs button.on");
    if (!tab || "global" !== tab.dataset.t) return;
    const a = allow();
    if (!a) return;
    const items = [...document.querySelectorAll("#ad-grid .ad-item")],
      tgs = [...document.querySelectorAll("#ad-toggles .ad-tg")];
    items.length === 7 && items.forEach((n, i) => !1 === a[KNOBS[i]] && n.remove());
    tgs.length === 2 && tgs.forEach((n, i) => !1 === a[KNOBS[7 + i]] && n.remove());
    const off = KNOBS.filter((k) => !1 === a[k]),
      note = document.querySelector("#ad-panel .ad-note");
    note && off.length && !note.querySelector(".ad-off") && (note.innerHTML += ` <span class="ad-off" style="color:var(--steel-dim)">${L("운영자가 닫아 둔 항목", "Closed by the operator")}: ${off.map((k) => NAMES[k]).join(" · ")}</span>`);
  }
  if ("function" == typeof buildAdminUI) {
    const _b = buildAdminUI;
    buildAdminUI = function () {
      const r = _b.apply(this, arguments);
      try {
        prune();
      } catch (e) {}
      return r;
    };
  }
  window.ADMIN_ALLOW = allow;
})();
