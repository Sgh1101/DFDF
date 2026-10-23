(() => {
  // Two things that need to know who the humans in a room are:
  //  · The bots' skill (js/bot-skill.js). When a round starts the host reads the average account level of the
  //    humans (their average tier in a ranked room), turns it into one skill number and caches it in BOT_RT;
  //    diffTune() in the engine only reads that number afterwards.
  //  · A "Lv N" chip beside a player's name on the scoreboard, the lobby slots and the kill feed. A guest says its
  //    level (and tier) in the hello message, the host passes it on in the lobby, the actor list and the ctrl
  //    event. A guest without an account has none and shows no chip; bots never do.
  if ("undefined" == typeof world || "undefined" == typeof room || "undefined" == typeof NET || "undefined" == typeof BOT_RT || "undefined" == typeof startRound) return;

  const $ = (id) => document.getElementById(id);
  const whole = (n, lo, hi) => (Number.isFinite(+n) && +n >= lo ? Math.min(hi, Math.floor(+n)) : null);
  // what a message says about a player is clamped, a client could send anything
  const clean = (lv, tr) => {
    const l = whole(lv, 1, 9999);
    return l ? { lv: l, tr: whole(tr, 0, 8) } : null;
  };
  // my own account: nothing for a guest or when signed out
  const own = () => {
    try {
      const u = window.ACCOUNT && ACCOUNT.session() && ACCOUNT.session().user;
      return u && !u.guest ? clean(u.level, u.rank && u.rank.t) : null;
    } catch (e) {
      return null;
    }
  };
  // what the host heard in each guest's hello
  const PEER = new Map();
  const of = (a) => {
    if (!a || "ai" === a.ctrl || "dead" === a.ctrl) return null;
    if ("me" === a.ctrl) return own();
    if (a.__lv) return { lv: a.__lv, tr: null == a.__tr ? null : a.__tr };
    return PEER.get(a.ctrl) || null;
  };

  // ── the room's skill, once per round ──
  const refresh = () => {
    const B = window.BOT_SKILL;
    if (!B) return;
    const humans = (world.actors || []).filter((a) => a.ctrl && "ai" !== a.ctrl && "dead" !== a.ctrl).map(of).filter(Boolean);
    BOT_RT.skill = B.roomSkill(humans.map((h) => ({ level: h.lv, tier: h.tr })), !!room.ranked);
  };
  const _sr = startRound;
  startRound = function () {
    try {
      refresh();
    } catch (e) {
      console.warn("bot skill", e);
    }
    return _sr.apply(this, arguments);
  };

  // ── the chip ──
  const css = document.createElement("style");
  css.textContent =
    ".lv-chip{display:inline-block;margin-left:6px;padding:0 6px;border-radius:99px;border:1px solid rgba(255,200,73,.45);background:rgba(255,200,73,.1);color:#ffc849;font:700 10px/15px var(--f-display,system-ui);letter-spacing:.04em;vertical-align:middle;white-space:nowrap}";
  document.head.appendChild(css);
  const chipText = (a) => {
    const i = of(a);
    return i ? "Lv " + i.lv : "";
  };
  const chipEl = (text) => {
    const s = document.createElement("span");
    s.className = "lv-chip";
    s.textContent = text;
    return s;
  };
  window.LV_CHIP = { own, of, peers: PEER, text: chipText, html: (a) => (chipText(a) ? `<span class="lv-chip">${chipText(a)}</span>` : "") };

  // ── what travels ──
  const _sa = sendAction;
  sendAction = function (m) {
    if (m && "hello" === m.t) {
      const o = own();
      o && (m = Object.assign({}, m, { lv: o.lv, tr: o.tr }));
    }
    return _sa.call(this, m);
  };
  const _oa = NET.onAction;
  NET.onAction = function (peer, msg) {
    try {
      if (msg && "hello" === msg.t && "host" === NET.mode) {
        const c = clean(msg.lv, msg.tr);
        c ? PEER.set(peer, c) : PEER.delete(peer);
      }
    } catch (e) {}
    const r = _oa && _oa.apply(this, arguments);
    try {
      // the host's own lobby shows the new player's chip too
      msg && "hello" === msg.t && "host" === NET.mode && !room.started && renderLobby(lobbySnapshot());
    } catch (e) {}
    return r;
  };
  const _lr = lobbyReset;
  lobbyReset = function () {
    PEER.clear();
    return _lr.apply(this, arguments);
  };
  // the host's own entry too
  const infoOfPeer = (p) => (p === NET.id ? own() : PEER.get(p) || null);
  const _ls = lobbySnapshot;
  lobbySnapshot = function () {
    const s = _ls.apply(this, arguments);
    try {
      for (const t of ["atk", "def"])
        for (const m of s[t] || []) {
          const i = m && m.peer && infoOfPeer(m.peer);
          i && ((m.lv = i.lv), null != i.tr && (m.tr = i.tr));
        }
    } catch (e) {}
    return s;
  };
  const _am = actorManifest;
  actorManifest = function () {
    const list = _am.apply(this, arguments);
    try {
      list.forEach((m, i) => {
        const a = world.actors[i],
          o = a && of(a);
        o && ((m.lv = o.lv), null != o.tr && (m.tr = o.tr));
      });
    } catch (e) {}
    return list;
  };
  const _cb = clientBeginMatch;
  clientBeginMatch = function (e) {
    const r = _cb.apply(this, arguments);
    try {
      for (const m of (e && e.actors) || []) {
        const a = world.actors.find((x) => x.id === m.id),
          c = clean(m.lv, m.tr);
        a && c && ((a.__lv = c.lv), (a.__tr = c.tr));
      }
    } catch (err) {}
    return r;
  };
  const _sea = sendEventAll;
  sendEventAll = function (e) {
    try {
      if (e && "ctrl" === e.t && e.ctrl && "ai" !== e.ctrl) {
        const i = infoOfPeer(e.ctrl);
        i && ((e.lv = i.lv), null != i.tr && (e.tr = i.tr));
      }
    } catch (err) {}
    return _sea.apply(this, arguments);
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    const r = _oe && _oe.apply(this, arguments);
    try {
      if (e && "ctrl" === e.t) {
        const a = world.actors.find((x) => x.id === e.id),
          c = clean(e.lv, e.tr);
        a && ((a.__lv = c ? c.lv : 0), (a.__tr = c ? c.tr : null));
      }
    } catch (err) {}
    return r;
  };

  // ── the lobby slots ──
  const _rl = renderLobby;
  renderLobby = function (e) {
    const r = _rl.apply(this, arguments);
    try {
      for (const [t, id] of [["atk", "lb-atk"], ["def", "lb-def"]]) {
        const box = $(id);
        (e[t] || []).forEach((m, i) => {
          const nm = m && m.lv && box && box.children[i] && box.children[i].querySelector(".lb-nm");
          nm && !nm.querySelector(".lv-chip") && nm.appendChild(chipEl("Lv " + m.lv));
        });
      }
    } catch (err) {}
    return r;
  };

  // ── the kill feed: the new row is on top, killer and victim are its first and last span ──
  const _pk = pushKill;
  pushKill = function (k, v) {
    const r = _pk.apply(this, arguments);
    try {
      const row = $("klog") && $("klog").firstElementChild;
      if (row) {
        const sp = row.querySelectorAll("span");
        [[sp[0], k], [sp[2], v]].forEach(([el, name]) => {
          const a = el && name && (world.actors || []).find((x) => (x.name || (x.agent && x.agent.name)) === name && chipText(x));
          a && el.appendChild(chipEl(chipText(a)));
        });
      }
    } catch (err) {}
    return r;
  };
})();
