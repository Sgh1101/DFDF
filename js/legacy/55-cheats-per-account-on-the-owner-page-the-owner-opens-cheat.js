
(() => {
  // Cheats per account. On the owner page the owner opens cheats for one
  // account item by item: switches, how far it may speed itself up or fire
  // faster, the buff, an end date. Signed in with that account, the cheat
  // panel opens with just those items and those limits. In a room the host
  // asks the server what the guest's account may do (with a ticket that only
  // says who it is and which peer it is for, never the sign-in) and holds the
  // guest's switches to the same limits; the answer is asked again every
  // minute, so a change on the owner page counts mid-game.
  // The buff: every ability but the ultimate comes back every N seconds
  // (10 unless the owner set another number for the account).
  const A2 = window.ADMIN2,
    X = window.HUNTX,
    AC = window.ACCOUNT;
  if (!A2 || !X || "undefined" == typeof NET) return;
  const $ = (id) => document.getElementById(id);
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const isClient = () => "client" === NET.mode;
  const SW = ["radar", "wall", "cheat", "god", "oneShot", "infAmmo", "noRecoil"];
  const NAMES = { radar: "작은 지도에 적 표시", wall: "벽 너머 적 보기", cheat: "치트 모드", god: "무적", oneShot: "한 방 처치", infAmmo: "탄약 무제한", noRecoil: "반동 없음", speed: "내 이동 속도", fastFire: "내 연사 속도" };
  const BUFF_DEF = 10;
  const clampBuff = (s) => (s > 0 ? Math.max(1, Math.min(120, Math.round(s))) : 0);
  const permOf = (p) => (p && p.on && !(p.until && p.until < Date.now()) ? p : null);
  const sess = () => {
    try {
      return AC && AC.session ? AC.session() : null;
    } catch (e) {
      return null;
    }
  };
  const say = (t, c) => {
    try {
      banner(t, c || "#ffc849");
    } catch (e) {}
  };

  // ── my account ──
  let MY = null, // what the owner opened for this account (null: nothing)
    MY_SET = !1, // I opened the panel for it
    OWNER_GRANT_ME = !1, // the owner gave me every cheat in this room
    BUFF_PICK = BUFF_DEF; // the owner (or someone given every cheat) picks the interval
  const iOwner = () => !!window.IS_OWNER;
  const iFull = () => iOwner() || OWNER_GRANT_ME;
  function readMine() {
    const s = sess();
    MY = iOwner() ? null : permOf(s && s.user && s.user.perm);
  }
  async function refreshMine() {
    const s = sess();
    if (!s || !s.token || !s.user || !AC.api) return;
    try {
      const j = await AC.api("me", { token: s.token });
      j && j.user && (s.user.perm = j.user.perm || null);
    } catch (e) {}
    enforce(); // at once (a tab in the background runs its timers late)
  }
  setInterval(refreshMine, 60000);
  const mySecs = () => (iFull() ? BUFF_PICK : MY && MY.buff > 0 ? MY.buff : 0);
  window.PERM = { mine: () => MY, secs: mySecs, refresh: refreshMine };

  // my switches stay inside what the account may: at once whenever they are
  // sent to a host, and checked four times a second (that also catches a
  // change on the owner page)
  function holdMine() {
    if (!MY || iFull()) return !1;
    const P = A2.P;
    let ch = !1;
    for (const k of SW) P[k] && !MY[k] && (A2.setPersonal(k, !1), (ch = !0));
    P.speed > (MY.speed || 1) && (A2.setPersonal("speed", MY.speed || 1), (ch = !0));
    P.fastFire > (MY.fastFire || 1) && (A2.setPersonal("fastFire", MY.fastFire || 1), (ch = !0));
    return ch;
  }
  function enforce() {
    try {
      readMine();
      const P = A2.P;
      let ch = !1;
      if (MY && !iFull()) {
        if (!X.HUNT.granted || !MY_SET) {
          MY_SET = !0;
          X.HUNT.granted = !0;
          X.HUNT.unlocked = !0;
          X.refresh(!0);
        }
        ch = holdMine();
      } else if (MY_SET && !MY && !iFull()) {
        // the owner closed this account's cheats
        MY_SET = !1;
        X.HUNT.granted = !1;
        X.relock();
        say(L("운영자가 이 계정의 치트를 닫았습니다", "The owner closed this account's cheats"), "#8a97ab");
      }
      P.buff && !(mySecs() > 0 && X.HUNT.unlocked) && ((P.buff = !1), (ch = !0));
      ch && A2.afterChange();
    } catch (e) {}
  }
  setInterval(enforce, 250);

  // ── the panel: only what the account may, and the buff ──
  const curTab = () => {
    const b = document.querySelector("#ad-panel .ad-tabs button.on");
    return b ? b.dataset.t : "";
  };
  const findItem = (name) => [...document.querySelectorAll("#ad-toggles .ad-tg, #ad-grid .ad-item")].find((n) => ((n.querySelector(".ad-tgname, .ad-name") || {}).textContent || "").trim() === name);
  function buffToggle(host) {
    const n = document.createElement("div");
    n.className = "ad-tg ad-buff" + (A2.P.buff ? " on" : "");
    n.innerHTML = `<div><div class="ad-tgname">${L("버프", "Buff")}</div><div class="ad-tgdesc">${L(`궁극기를 뺀 모든 능력이 <b>${mySecs()}초</b>마다 다시 찹니다`, `Every ability but the ultimate refills every <b>${mySecs()} s</b>`)}</div></div><span class="ad-dot"><i></i></span>`;
    n.onclick = () => {
      A2.P.buff = !A2.P.buff;
      n.classList.toggle("on", !!A2.P.buff);
      A2.afterChange();
      A2.P.buff && say(L(`버프 · ${mySecs()}초마다 능력이 다시 찹니다`, `Buff · abilities every ${mySecs()} s`), "#9ccc65");
    };
    const after = findItem(NAMES.cheat);
    after ? after.after(n) : host.appendChild(n);
  }
  function buffSlider(host) {
    const l = document.createElement("div");
    l.className = "ad-item ad-buffsec";
    l.innerHTML = `<div class="ad-top"><span class="ad-name">${L("버프 간격", "Buff interval")}</span><span class="ad-val"><input class="ad-num" type="number" min="1" max="60" step="1"><span class="ad-unit">${L("초", "s")}</span></span></div><div class="ad-desc">${L("버프를 켜면 이 간격마다 궁극기를 뺀 모든 능력이 다시 찹니다", "With the buff on, every ability but the ultimate refills at this interval")}</div><input type="range" min="1" max="60" step="1"><div class="ad-range"><span>1</span><span>${L("기본", "default")} ${BUFF_DEF}</span><span>60</span></div>`;
    const rg = l.querySelector("input[type=range]"),
      nm = l.querySelector(".ad-num");
    const paint = () => ((rg.value = BUFF_PICK), (nm.value = BUFF_PICK));
    const set = (v) => {
      BUFF_PICK = clampBuff(+v) || BUFF_DEF;
      paint();
      const d = document.querySelector(".ad-buff .ad-tgdesc b");
      d && (d.textContent = L(BUFF_PICK + "초", BUFF_PICK + " s"));
      A2.P.buff && A2.afterChange();
    };
    rg.oninput = () => set(rg.value);
    nm.onchange = () => set(nm.value);
    paint();
    host.appendChild(l);
  }
  function decorate() {
    if ("me" !== curTab() || !X.HUNT.unlocked) return;
    const tg = $("ad-toggles"),
      grid = $("ad-grid"),
      note = document.querySelector("#ad-panel .ad-note");
    if (MY && !iFull()) {
      for (const k of SW) if (!MY[k]) (findItem(NAMES[k]) || { remove() {} }).remove();
      for (const [k, max] of [
        ["speed", MY.speed || 1],
        ["fastFire", MY.fastFire || 1],
      ]) {
        const it = findItem(NAMES[k]);
        if (!it) continue;
        if (!(max > 1)) {
          it.remove();
          continue;
        }
        it.querySelectorAll("input").forEach((i) => (i.max = String(max)));
        const top = it.querySelector(".ad-range span:last-child");
        top && (top.textContent = String(max));
      }
      note &&
        (note.innerHTML = L(
          `<b>운영자가 이 계정에 열어 준 치트</b>입니다${MY.until ? ` (${new Date(MY.until).toLocaleDateString("ko-KR")}까지)` : ""}. 나에게만 적용되고, 같이 하기에서는 방장이 서버에 확인한 뒤 같은 한도로 적용합니다.`,
          `<b>Cheats the owner opened for this account</b>${MY.until ? ` (until ${new Date(MY.until).toLocaleDateString()})` : ""}. Only you are affected; in a room the host checks with the server and applies the same limits.`
        ));
    }
    if (mySecs() > 0 && tg) {
      buffToggle(tg);
      iFull() && grid && buffSlider(grid);
    }
  }
  const _bui = buildAdminUI;
  buildAdminUI = function () {
    const r = _bui.apply(this, arguments);
    try {
      decorate();
    } catch (e) {
      console.warn("perm panel", e);
    }
    return r;
  };

  // ── network ──
  // (a guest's ticket names the room and the peer it was asked for: it is no use in another room or to another guest)
  // my switches carry the buff (seconds, 0 = off)
  const _sa = sendAction;
  sendAction = function (m) {
    if (m && "padm" === m.t && m.p) {
      const p = Object.assign({}, m.p);
      try {
        readMine();
        if (holdMine()) {
          for (const k in p) k in A2.P && (p[k] = A2.P[k]);
          setTimeout(() => A2.afterChange(), 0); // the panel shows what stayed on
        }
      } catch (e) {}
      p.buff = A2.P.buff ? mySecs() : 0;
      m = Object.assign({}, m, { p });
    }
    return _sa.call(this, m);
  };
  // host: who has what
  const PERMS = new Map(), // peer → the account's cheats, as the server says
    TICKET = new Map(), // peer → its ticket (asked again every minute)
    LAST = new Map(), // peer → the newest ticket it showed (an older answer coming back late counts for nothing)
    ADDED = new Set(), // peers I let in for their account's cheats
    OGRANT = new Set(); // peers the owner gave every cheat in this room
  const _se = sendEventTo;
  sendEventTo = function (p, e) {
    e && "own-grant" === e.t && (e.on ? OGRANT.add(p) : OGRANT.delete(p));
    return _se.apply(this, arguments);
  };
  function tameTo(p, perm) {
    for (const k of SW) perm[k] || (p[k] = !1);
    p.speed = Math.min(+p.speed || 1, perm.speed || 1);
    p.fastFire = Math.min(+p.fastFire || 1, perm.fastFire || 1);
    p.buff = p.buff > 0 && perm.buff > 0 ? perm.buff : 0;
    return p;
  }
  function dropPeer(peer) {
    PERMS.delete(peer);
    TICKET.delete(peer);
    LAST.delete(peer);
    if (ADDED.has(peer)) {
      ADDED.delete(peer);
      OGRANT.has(peer) || X.OWNP.has(peer) || (X.GRANT.delete(peer), A2.PEERS.delete(peer));
    }
  }
  async function checkPeer(peer, ticket, quiet) {
    if (!ticket || !AC || !AC.api || isClient()) return;
    let perm = null;
    try {
      const j = await AC.api("perm_check", { ticket, room: NET.room, p: peer });
      perm = permOf(j && j.perm);
    } catch (e) {
      return; // the server did not answer: keep what we had
    }
    if (LAST.get(peer) !== ticket) return; // a newer ticket came in meanwhile
    if (!perm) {
      const had = PERMS.has(peer);
      dropPeer(peer);
      had && sendEventTo(peer, { t: "perm-off" });
      return;
    }
    const fresh = !PERMS.has(peer);
    PERMS.set(peer, perm);
    TICKET.set(peer, ticket);
    X.GRANT.has(peer) || (X.GRANT.add(peer), ADDED.add(peer));
    // switches already on beyond the new limits come down now
    const f = A2.PEERS.get(peer);
    f && !OGRANT.has(peer) && !X.OWNP.has(peer) && tameTo(f, perm);
    (fresh || !quiet) && sendEventTo(peer, { t: "perm-ok", perm });
  }
  const _oa = NET.onAction;
  NET.onAction = function (peer, m) {
    if (m && "perm-hi" === m.t) {
      const t = String(m.ticket || "");
      LAST.set(peer, t);
      return void checkPeer(peer, t);
    }
    if (m && "padm" === m.t && m.p) {
      const p = Object.assign({}, m.p);
      if (X.OWNP.has(peer) || OGRANT.has(peer)) p.buff = clampBuff(+p.buff || 0);
      else if (PERMS.has(peer)) tameTo(p, PERMS.get(peer));
      else p.buff = 0;
      m = Object.assign({}, m, { p });
    }
    // another agent's set is part of 치트 모드
    if (m && "kit" === m.t && PERMS.has(peer) && !OGRANT.has(peer) && !X.OWNP.has(peer) && !PERMS.get(peer).cheat) return;
    return _oa.call(this, peer, m);
  };
  const _sd = netShutdown;
  netShutdown = function () {
    OWNER_GRANT_ME = !1; // the owner's grant in that room ends with it
    return _sd.apply(this, arguments);
  };
  const _pg = NET.onPeerGone;
  NET.onPeerGone = function (peer) {
    try {
      dropPeer(peer);
      OGRANT.delete(peer);
    } catch (e) {}
    return _pg && _pg.apply(this, arguments);
  };
  setInterval(() => {
    if (isClient()) return;
    // the owner taking back a room grant does not undo the account's own cheats
    for (const peer of PERMS.keys()) X.GRANT.has(peer) || (X.GRANT.add(peer), ADDED.add(peer));
  }, 1000);
  setInterval(() => {
    if (isClient()) return;
    for (const [peer, t] of TICKET) checkPeer(peer, t, !0);
  }, 60000);
  // guest: show the host what my account may (again after every new line)
  let sentFor = "";
  setInterval(async () => {
    if (!isClient() || "open" !== NET.status || !NET.room || !NET.peer || !NET.peer.id || !MY || iOwner()) return;
    // again after a redialled link: the host forgets a guest whose line dropped
    const key = (NET.peer && NET.peer.id) + "|" + NET.room + "|" + (window.NET_REDIALS || 0);
    if (sentFor === key) return;
    sentFor = key;
    try {
      const s = sess(),
        j = await AC.api("perm_ticket", { token: s.token, room: NET.room, p: NET.peer.id });
      j && j.ticket ? sendAction({ t: "perm-hi", ticket: j.ticket }) : (sentFor = "");
    } catch (e) {
      sentFor = "";
    }
  }, 1500);
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "own-grant" === e.t) OWNER_GRANT_ME = !!e.on;
    if (e && "perm-ok" === e.t) {
      say(L("이 계정의 치트가 이 방에서도 적용됩니다", "This account's cheats apply in this room too"));
      try {
        A2.afterChange(); // the host takes my switches from now on
      } catch (x) {}
      return;
    }
    if (e && "perm-off" === e.t) return void say(L("방장 확인: 이 계정의 치트가 닫혀 있습니다", "Host check: this account's cheats are closed"), "#8a97ab");
    if (e && "buffed" === e.t) return void refillNonUlt(typeof myActor == "function" ? myActor() : null);
    return _oe.apply(this, arguments);
  };

  // ── the buff ──
  function refillNonUlt(a) {
    if (!a || !a.alive || !a.abilities) return;
    for (const x of a.abilities) x.def && !x.def.ult && ((x.cd = 0), (x.charges = Math.max(x.charges || 0, x.def.charges || 1)));
    if (a === (typeof myActor == "function" && myActor())) {
      try {
        SFX.pick();
      } catch (e) {}
      try {
        updateHUD();
      } catch (e) {}
    }
  }
  const BT = new Map();
  function buffSecsFor(a) {
    if (!a) return 0;
    if ("me" === a.ctrl) return A2.P.buff && X.HUNT.unlocked ? mySecs() : 0;
    const f = A2.PEERS.get(a.ctrl);
    return f && f.buff > 0 ? f.buff : 0;
  }
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      if (!isClient() && ("live" === world.phase || "buy" === world.phase))
        for (const a of world.actors || []) {
          const s = buffSecsFor(a);
          if (!(s > 0) || !a.alive) {
            BT.delete(a.id);
            continue;
          }
          const t = (BT.get(a.id) || 0) + (dt || 0);
          if (t >= s) {
            BT.set(a.id, 0);
            refillNonUlt(a);
            a.ctrl && "me" !== a.ctrl && "ai" !== a.ctrl && sendEventTo(a.ctrl, { t: "buffed" });
          } else BT.set(a.id, t);
        }
    } catch (e) {}
    return r;
  };
  window.PERM.host = () => ({ perms: [...PERMS.entries()], added: [...ADDED], ogrant: [...OGRANT], fresh: [...TICKET].map(([p, t]) => LAST.get(p) === t) });
  window.PERM.recheck = () => {
    for (const [peer, t] of TICKET) checkPeer(peer, t, !0);
  };

  const st = document.createElement("style");
  st.textContent = `#ad-toggles .ad-buff .ad-tgdesc b{color:#c5e1a5}`;
  document.head.appendChild(st);
})();
