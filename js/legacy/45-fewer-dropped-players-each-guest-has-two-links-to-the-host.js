
(() => {
  // Fewer dropped players. Each guest has two links to the host: a fast one
  // for positions (may lose packets) and a sure one for everything else. When
  // only the fast one dies, keep playing over the sure one instead of throwing
  // the guest out. A guest who drops in the lobby keeps their seat for 60 s
  // and dials back in by itself (in a match that already happened).
  const conns = () => NET.conns;
  const open = (c) => c && c.open;

  // ── host ──
  hostAccept = function (e) {
    const label = e.label, owner = NET.peer;
    const current = () => NET.mode === "host" && NET.peer === owner;
    // "me", "ai" and "dead" are what a body's ctrl says when no guest drives it: a guest that picked one of them as its
    // peer id would be taken for the host's own player (or a bot) and could cast, buy and aim as it
    if ((label !== "state" && label !== "event") || ["me", "ai", "dead"].includes(e.peer)) return e.close();
    e.on("open", () => {
      if (!current()) return e.close();
      let o = conns().get(e.peer);
      o || ((o = {}), conns().set(e.peer, o));
      const previous = o[label];
      o[label] = e;
      if (previous && previous !== e) previous.close();
      if (label === "event" && NET.onPeerJoin) NET.onPeerJoin(e.peer);
    });
    e.on("data", (data) => {
      const o = conns().get(e.peer);
      if (current() && o && o[label] === e && e.open) hostRecv(e.peer, data);
    });
    e.on("close", () => {
      const o = conns().get(e.peer);
      if (!current() || !o || o[label] !== e) return;
      o[label] = null;
      if (label === "state" && open(o.event)) return;
      // Remove ownership first so the other channel's close cannot drop twice.
      hostDrop(e.peer);
      for (const channel of [o.state, o.event]) {
        try { if (channel && channel !== e) channel.close(); } catch (error) {}
      }
    });
    e.on("error", () => {});
  };
  sendSnapshot = function (s) {
    if ("host" !== NET.mode) return;
    for (const [, o] of conns()) {
      const c = open(o.state) ? o.state : open(o.event) ? o.event : null;
      if (c)
        try {
          c.send(s);
        } catch (x) {}
    }
  };
  // lobby: hold the seat for a while
  const away = new Map();
  const _pg = NET.onPeerGone;
  NET.onPeerGone = function (peer) {
    if (room.started || !room.members.has(peer)) return _pg.apply(this, arguments);
    const m = room.members.get(peer);
    clearTimeout(away.get(peer));
    const code = NET.room, owner = NET.peer;
    away.set(peer, setTimeout(() => {
      away.delete(peer);
      NET.room === code && NET.peer === owner && room.members.has(peer) && !conns().has(peer) && _pg.call(NET, peer);
    }, 60000));
    m && (m.away = !0);
  };
  const shutdownAway = netShutdown;
  netShutdown = function () {
    for (const timer of away.values()) clearTimeout(timer);
    away.clear();
    return shutdownAway.apply(this, arguments);
  };
  const _oa = NET.onAction;
  NET.onAction = function (peer, m) {
    if (m && "hello" === m.t && !room.started && m.prev && room.members.has(m.prev)) {
      const old = room.members.get(m.prev);
      clearTimeout(away.get(m.prev));
      away.delete(m.prev);
      lobbyRemove(m.prev);
      const r = _oa.apply(this, arguments);
      try {
        const now = room.members.get(peer);
        if (now && old) {
          (now.team !== old.team || now.slot !== old.slot) && null === room.slots[old.team][old.slot] && lobbyMove(peer, old.team, old.slot);
          now.agentKey = old.agentKey;
          sendEventAll(lobbySnapshot());
          renderLobby(lobbySnapshot());
        }
      } catch (x) {}
      return r;
    }
    return _oa.apply(this, arguments);
  };

  // ── guest ──
  sendInput = function (e) {
    if ("client" !== NET.mode || !NET.up) return;
    const c = open(NET.up.state) ? NET.up.state : open(NET.up.event) ? NET.up.event : null;
    if (c)
      try {
        c.send(e);
      } catch (x) {}
  };
  // a message still in flight when the guest has already left (kicked,
  // closed, quit): ignore it instead of starting a match with no link
  const _ev = NET.onEvent;
  NET.onEvent = function () {
    if ("client" !== NET.mode || !NET.peer) return;
    return _ev.apply(this, arguments);
  };
  const _sn = NET.onSnapshot;
  NET.onSnapshot = function () {
    if ("client" !== NET.mode || !NET.peer) return;
    return _sn.apply(this, arguments);
  };
  // dropped in the lobby: dial back in too
  const _hg = NET.onHostGone;
  NET.onHostGone = function () {
    const rc = window.NET_RC || {};
    const inLobby = "client" === NET.mode && NET.room && "menu" === world.phase && document.getElementById("lobby") && !document.getElementById("lobby").hidden;
    if (inLobby && !rc.busy && !rc.quit && !rc.bye && typeof netRedial === "function") return void netRedial();
    return _hg.apply(this, arguments);
  };
})();
