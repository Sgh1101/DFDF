
(() => {
  // Why a join failed. Every failure said "check the code", but a room that
  // exists and cannot be reached is a different problem: the host was found,
  // and the two networks would not connect directly (phone data, school or
  // office Wi-Fi). Without the relay server (TURN) that happens a lot.
  if ("function" != typeof netJoin || "function" != typeof netAlert) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  let why = "";
  const _nj = netJoin;
  netJoin = function () {
    why = "";
    return _nj.apply(this, arguments).catch((e) => {
      why = e && "peer-unavailable" === e.type ? "missing" : e && /방을 찾지 못했습니다/.test(e.message || "") ? "unreachable" : "other";
      throw e;
    });
  };
  const MSG = {
    missing: L("방을 찾지 못했습니다. 코드가 맞는지, 방이 아직 열려 있는지 확인해 주세요.", "Room not found. Check the code, and that the room is still open."),
    unreachable: L("방은 찾았지만 방장과 연결되지 않습니다. 모바일 데이터나 학교·회사 와이파이가 직접 연결을 막고 있을 수 있어요. 같은 와이파이에서 하거나 다른 네트워크로 바꿔 다시 시도해 주세요.", "The room is there but the host can't be reached. Phone data or a school/office Wi-Fi may block direct connections; try the same Wi-Fi as the host or another network."),
  };
  const _na = netAlert;
  netAlert = function (m) {
    if (why && MSG[why] && /코드를 확인해 주세요/.test(String(m || ""))) {
      m = MSG[why];
      // keep it on the room list as well: a banner is gone in a few seconds
      setTimeout(() => {
        try {
          const note = document.getElementById("mu-note");
          if (!note || document.getElementById("s-multi").hidden) return;
          let f = document.getElementById("mu-flash");
          f || ((f = document.createElement("div")), (f.id = "mu-flash"), (f.className = "mu-note mu-flash"), note.before(f));
          f.textContent = "⚠️ " + m;
          f.hidden = !1;
          clearTimeout(f._t);
          f._t = setTimeout(() => (f.hidden = !0), 20000);
        } catch (e) {}
      }, 300);
    }
    return _na.call(this, m);
  };
  window.JOIN_WHY = () => why;
})();
