
(() => {
  // Fewer dropped players. Each guest has two links to the host: a fast one
  // for positions (may lose packets) and a sure one for everything else. When
  // only the fast one dies, keep playing over the sure one instead of throwing
  // the guest out. A guest who drops in the lobby keeps their seat for 25 s
  // and dials back in by itself (in a match that already happened).
  const conns = () => NET.conns;
  const open = (c) => c && c.open;

  // ── host ──
  hostAccept = function (e) {
    const label = e.label;
    e.on("open", () => {
      let o = conns().get(e.peer);
      o || ((o = {}), conns().set(e.peer, o));
      o[label] = e;
      "event" === label && NET.onPeerJoin && NET.onPeerJoin(e.peer);
    });
    e.on("data", (t) => hostRecv(e.peer, t));
    e.on("close", () => {
      const o = conns().get(e.peer);
      if (!o) return;
      // the fast link alone: carry on over the sure one
      if ("state" === label && open(o.event)) return void (o.state = null);
      for (const k of ["state", "event"])
        try {
          o[k] && o[k] !== e && o[k].open && o[k].close();
        } catch (x) {}
      hostDrop(e.peer);
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
    away.set(peer, setTimeout(() => {
      away.delete(peer);
      room.members.has(peer) && !conns().has(peer) && _pg.call(NET, peer);
    }, 25000));
    m && (m.away = !0);
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
  const _nj = netJoin;
  netJoin = function () {
    const p = _nj.apply(this, arguments);
    // the fast link alone closing must not count as "the host is gone"
    p.then(() => {
      const up = NET.up,
        st = up && up.state;
      if (!st) return;
      const ls = st._events && st._events.close;
      st.removeAllListeners && st.removeAllListeners("close");
      st.on("close", () => {
        if (NET.up === up && open(up.event)) return void (up.state = null);
        NET.up === up && NET.onHostGone && NET.onHostGone();
      });
    }).catch(() => {});
    return p;
  };
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
