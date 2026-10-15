(() => {
  // Ranked play. A ranked room is opened from "Play together" with one button
  // ("Find a ranked match": join an open ranked room, or open one). In it
  // everything the owner or a player could bend is off for everybody: the admin
  // switches, the cheat code and the cheats it gives, the owner's room commands,
  // an account's own cheat rights, and the host's room rules (the mode, the map
  // and the rounds are set when the room opens and stay). The server only moves
  // the rank (RR) for matches played in a ranked room, with enough real people;
  // other matches keep paying XP and gold and leave the rank where it is.
  if ("undefined" == typeof room || "undefined" == typeof ADMIN || "undefined" == typeof ADMIN_DEF || !window.ACCOUNT) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const AC = () => window.ACCOUNT || null;

  // the maps for 5 v 5 (the ranked ones), as the pool lists them
  const MAP_KEYS = ["pogu", "garden", "market", "glacier", "neon", "dunes", "jungle"];
  const RANKED = (window.RANKED = { on: () => !!room.ranked, locked: !1, MIN_HUMANS: 3 });
  room.ranked = !1;

  // ── what the lock holds off ──
  const G_DEF = { roundT: 100, buyT: 0, matchT: 0, infAll: !1 };
  const real = {};
  // the owner's and an admin's rights read as off while the lock is on
  for (const k of ["IS_OWNER", "ADMIN_GRANTED"]) {
    let v = window[k];
    try {
      Object.defineProperty(window, k, {
        configurable: !0,
        get: () => (RANKED.locked ? !1 : v),
        set: (x) => (v = x),
      });
    } catch (e) {}
  }
  function lockAdmin(on) {
    if (!!RANKED.locked === !!on) return;
    RANKED.locked = !!on;
    for (const k of Object.keys(ADMIN_DEF)) {
      try {
        if (on) {
          real[k] = ADMIN[k];
          Object.defineProperty(ADMIN, k, { configurable: !0, enumerable: !0, get: () => ADMIN_DEF[k], set() {} });
        } else Object.defineProperty(ADMIN, k, { configurable: !0, enumerable: !0, writable: !0, value: k in real ? real[k] : ADMIN_DEF[k] });
      } catch (e) {}
    }
    document.body.classList.toggle("ranked", !!on);
    on && clean();
  }
  // the switches that live outside ADMIN: personal and room cheats, the cheat code
  function clean() {
    try {
      const A2 = window.ADMIN2;
      if (A2) {
        let ch = !1;
        for (const k of Object.keys(A2.P)) {
          const want = "speed" === k || "fastFire" === k ? 1 : !1;
          A2.P[k] !== want && (A2.setPersonal(k, want), (ch = !0));
        }
        for (const k of Object.keys(G_DEF)) A2.G[k] !== G_DEF[k] && ((A2.G[k] = G_DEF[k]), (ch = !0));
        A2.PEERS && A2.PEERS.size && A2.PEERS.clear();
        ch && A2.afterChange && A2.afterChange();
      }
      const X = window.HUNTX;
      if (X) {
        const H = X.HUNT;
        H.unlocked = !1;
        H.granted = !1;
        H.code = "";
        X.OK && X.OK.clear();
        X.GRANT && X.GRANT.clear();
        X.OWNP && X.OWNP.clear();
      }
      "undefined" != typeof ADMIN_UNLOCKED && (ADMIN_UNLOCKED = !1);
      "undefined" != typeof FLY && FLY.on && (FLY.on = !1);
    } catch (e) {}
  }
  // a guest's switches and kit requests are not heard in a ranked room
  if ("undefined" != typeof NET) {
    const _oa = NET.onAction;
    NET.onAction = function (peer, msg) {
      if (RANKED.locked && msg && ("padm" === msg.t || "kit" === msg.t)) return;
      return _oa && _oa.apply(this, arguments);
    };
  }

  // ── the room: set when it opens, told to the guests with the lobby ──
  let next = !1;
  // open the next room as a ranked one
  RANKED.open = () => {
    next = !0;
    return createRoom();
  };
  const _reset = lobbyReset;
  lobbyReset = function () {
    const r = _reset.apply(this, arguments);
    room.ranked = !!next && "client" !== NET.mode;
    if (room.ranked) {
      room.mode = "std";
      room.rounds = 7;
      room.diff = "normal";
      const ok = MAP_KEYS.filter((k) => "undefined" == typeof MAPS || MAPS[k]);
      room.map = ok[Math.floor(Math.random() * ok.length)] || room.map;
    }
    next = !1;
    sync();
    return r;
  };
  const _opt = lobbySetOpt;
  lobbySetOpt = function () {
    return room.ranked ? !1 : _opt.apply(this, arguments);
  };
  const _snap = lobbySnapshot;
  lobbySnapshot = function () {
    const s = _snap.apply(this, arguments);
    s.ranked = !!room.ranked;
    return s;
  };
  const _sea = sendEventAll;
  sendEventAll = function (e) {
    e && ("begin" === e.t || "lobby" === e.t) && (e.ranked = !!room.ranked);
    return _sea.apply(this, arguments);
  };
  const _set = sendEventTo;
  sendEventTo = function (p, e) {
    e && "joined" === e.t && (e.ranked = !!room.ranked);
    return _set.apply(this, arguments);
  };
  const learn = (e) => {
    if (e && "client" === NET.mode && "ranked" in e) room.ranked = !!e.ranked;
  };
  const _rl = renderLobby;
  renderLobby = function (e) {
    learn(e);
    const r = _rl.apply(this, arguments);
    mark();
    return r;
  };
  for (const name of ["clientBeginMatch", "clientEnterMatch"]) {
    const f = window[name];
    "function" == typeof f &&
      (window[name] = function (e) {
        learn(e);
        sync();
        return f.apply(this, arguments);
      });
  }
  // the lock follows the room: on in a ranked room, off when it is left
  function sync() {
    const on = !!room.ranked && "solo" !== NET.mode;
    on || (room.ranked && "solo" === NET.mode && (room.ranked = !1));
    lockAdmin(on);
    on && clean();
    document.body.classList.toggle("ranked", !!on);
    mark();
  }
  const _sd = netShutdown;
  netShutdown = function () {
    const r = _sd.apply(this, arguments);
    room.ranked = !1;
    sync();
    return r;
  };
  setInterval(sync, 400);
  // the host cannot pick a map or a mode in a ranked room, in the lobby or on the select screen
  const _psm = paintSelMaps;
  paintSelMaps = function () {
    const r = _psm.apply(this, arguments);
    if (room.ranked) document.querySelectorAll("#sel-maps button, #sel-modes button").forEach((b) => (b.disabled = !0));
    return r;
  };

  // ── marks: the lobby, the match ──
  const css = document.createElement("style");
  css.textContent = `
#rk-badge{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:60;display:none;padding:2px 12px;border-radius:99px;font:700 11px/1.6 var(--f-display,inherit);letter-spacing:.16em;color:#fff3c9;background:rgba(40,28,6,.82);border:1px solid #ffd76a;box-shadow:0 0 14px -2px #ffb300;pointer-events:none}
body.ranked #rk-badge{display:block}
#lobby .lb-rk{display:none;margin:6px 0 0;font-size:12px;color:#ffe9a8}
body.ranked #lobby .lb-rk{display:block}
body.ranked #lb-rounds button,body.ranked #lb-diff button,body.ranked #lb-maps button,body.ranked #lb-mode button{pointer-events:none;opacity:.55}
.mu-card.mu-rank{border-color:#ffd76a66;background:linear-gradient(180deg,rgba(60,42,8,.45),rgba(20,16,6,.5))}
.mu-card.mu-rank .mu-ct{color:#ffd76a}
.mu-card.mu-rank p{margin:2px 0 10px;font-size:12px;line-height:1.5;color:var(--steel,#8a97ab)}
.mu-card.mu-rank .mu-go{background:linear-gradient(180deg,#ffd76a,#e0a526);color:#2a1d00}
.mu-room .mu-rk{display:inline-block;margin-left:6px;padding:0 6px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#2a1d00;background:#ffd76a}`;
  document.head.appendChild(css);
  const badge = document.createElement("div");
  badge.id = "rk-badge";
  badge.textContent = L("랭크전", "RANKED");
  document.body.appendChild(badge);
  function mark() {
    const lb = $("lobby");
    if (lb && !lb.querySelector(".lb-rk")) {
      const n = document.createElement("div");
      n.className = "lb-rk";
      n.textContent = L(`랭크전 · 관리자와 치트가 모두 꺼져 있습니다. 사람이 ${RANKED.MIN_HUMANS}명 이상이어야 RR이 반영됩니다.`, `Ranked · admin and cheats are off. RR counts with ${RANKED.MIN_HUMANS}+ real players.`);
      const code = lb.querySelector(".lb-code");
      code ? code.after(n) : lb.prepend(n);
    }
  }

  // ── the match ticket and the report ──
  // the ticket is asked for as ranked in a ranked room; if the server refuses,
  // the match still gets a plain one (XP and gold, no RR)
  RANKED.ticketBody = () => (room.ranked && "solo" !== NET.mode ? { ranked: !0, room: room.code || NET.room || "" } : {});
  RANKED.humans = () => {
    try {
      return world.actors.filter((a) => "function" == typeof isHuman && isHuman(a)).length;
    } catch (e) {
      return 0;
    }
  };

  // ── the way in: "Play together" gets a ranked card ──
  const chOf = () => {
    const cs = (window.SERVER_CFG && SERVER_CFG.channels) || [];
    let pref = "";
    try {
      pref = localStorage.getItem("lgp_ch") || "";
    } catch (e) {}
    const p = cs.find((c) => c.id === pref);
    if (p && !(p.mobile && !window.IS_MOBILE)) return p.id;
    const mob = cs.find((c) => c.mobile);
    return ((window.IS_MOBILE && mob) || cs.find((c) => !c.mobile) || cs[0] || { id: "s1" }).id;
  };
  let busy = !1;
  async function find() {
    if (busy) return;
    const a = AC(),
      sess = a && a.session && a.session();
    if (!a || !a.online || !sess || !sess.user || sess.user.guest) return void ("function" == typeof banner && banner(L("랭크전은 계정으로 로그인해야 합니다", "Ranked needs a signed-in account"), "#ff8a9a"));
    busy = !0;
    const btn = $("mu-rank-go");
    btn && (btn.disabled = !0);
    try {
      const ch = chOf();
      let rooms = [];
      try {
        rooms = (await a.api("rooms")).rooms || [];
      } catch (e) {}
      const open = rooms.filter((r) => r.ranked && r.ch === ch && "lobby" === r.state && r.n < r.max).sort((x, y) => y.n - x.n)[0];
      if (open) return void joinRoom(open.code);
      const m = a.meta;
      if (m) {
        m.name = L("랭크전", "Ranked") + " · " + (sess.user.id || "");
        m.ch = ch;
        m.priv = !1;
      }
      RANKED.open();
    } finally {
      busy = !1;
      btn && (btn.disabled = !1);
    }
  }
  function card() {
    const side = document.querySelector("#s-multi .mu-side");
    if (!side || $("mu-rank")) return;
    const c = document.createElement("div");
    c.className = "mu-card mu-rank";
    c.id = "mu-rank";
    c.innerHTML = `<div class="mu-ct">${L("랭크전", "Ranked")}</div><p>${L("관리자·치트·방 규칙 변경이 모두 꺼진 경기입니다. 이기면 RR이 오르고, 일반 경기에서는 RR이 바뀌지 않습니다.", "Admin, cheats and room rule changes are all off. Wins raise your RR; normal matches leave it alone.")}</p><button class="mu-go" id="mu-rank-go"><b>${L("랭크전 찾기", "Find a ranked match")}</b><small>${L("열린 랭크 방에 들어가거나 새로 엽니다", "Join an open ranked room or open one")}</small></button>`;
    side.prepend(c);
    $("mu-rank-go").onclick = find;
  }
  card();
  new MutationObserver(card).observe(document.body, { childList: !0, subtree: !1 });
  setTimeout(card, 800);
})();
