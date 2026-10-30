
(() => {
  // Fewer dropped players. Each guest has two links to the host: a fast one
  // for positions (may lose packets) and a sure one for everything else. When
  // only the fast one dies, keep playing over the sure one instead of throwing
  // the guest out. A guest who drops in the lobby keeps their seat for 60 s
  // and dials back in by itself (in a match that already happened).
  const conns = () => NET.conns;
  const open = (c) => c && c.open;

  // ── host ──
  // Anyone who knows the room code can open links to the host, and every link it keeps costs a snapshot 20 times a
  // second. A peer that has not said "hello" yet is "quiet": it is sent nothing, at most QUIET_MAX of them are kept
  // at once (the oldest goes first), and one that does not say hello within HELLO_MS is closed. A guest sends its hello the moment its
  // event link opens; the second link of a guest that has said hello is not counted.
  const HELLO_MS = 12000, QUIET_MAX = 16;
  const quiet = new Map(); // peer -> { owner, chs: its links so far, timer }
  const hush = (peer) => {
    const q = quiet.get(peer);
    if (!q) return;
    clearTimeout(q.timer);
    quiet.delete(peer);
  };
  const silenceEnd = (peer, q) => {
    if (quiet.get(peer) !== q) return;
    quiet.delete(peer);
    const o = conns().get(peer);
    // it never joined, so there is no seat to give back and nobody to tell
    if (q.owner === NET.peer && o && o.quiet) conns().delete(peer);
    for (const c of q.chs) try { c.close(); } catch (x) {}
  };
  hostAccept = function (e) {
    const label = e.label, owner = NET.peer;
    const current = () => NET.mode === "host" && NET.peer === owner;
    // "me", "ai" and "dead" are what a body's ctrl says when no guest drives it: a guest that picked one of them as its
    // peer id would be taken for the host's own player (or a bot) and could cast, buy and aim as it
    if ((label !== "state" && label !== "event") || ["me", "ai", "dead"].includes(e.peer)) return e.close();
    const known = conns().get(e.peer);
    let q = quiet.get(e.peer);
    if (!q && !(known && !known.quiet)) {
      // full: the one that has waited longest goes (a guest says hello within a second or two, so it is not that one)
      if (quiet.size >= QUIET_MAX) { const [oldest, oq] = quiet.entries().next().value; silenceEnd(oldest, oq); }
      quiet.set(e.peer, (q = { owner, chs: new Set(), timer: setTimeout(() => silenceEnd(e.peer, q), HELLO_MS) }));
    }
    q && q.chs.add(e);
    e.on("open", () => {
      if (!current()) return e.close();
      let o = conns().get(e.peer);
      if (!o) {
        // its time ran out before this link opened
        if (!q || quiet.get(e.peer) !== q) return e.close();
        conns().set(e.peer, (o = { quiet: !0 }));
      }
      const previous = o[label];
      o[label] = e;
      if (previous && previous !== e) previous.close();
      if (label === "event" && NET.onPeerJoin) NET.onPeerJoin(e.peer);
    });
    e.on("data", (data) => {
      const o = conns().get(e.peer);
      if (current() && o && o[label] === e && e.open) {
        if (o.quiet && data && "hello" === data.t) {
          o.quiet = !1;
          hush(e.peer);
        }
        hostRecv(e.peer, data);
      }
    });
    e.on("close", () => {
      if (q && q.chs.delete(e) && !q.chs.size && quiet.get(e.peer) === q) hush(e.peer);
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
  // A link that cannot keep up piles messages in its send buffer, and each one arrives later than the one before: the guest
  // sees the game the buffer's age behind. Past about two snapshots (or 1 KB of inputs) a message is not sent; the next one
  // carries the same state anyway.
  const backed = (c, limit) => !!(c && c.dataChannel && c.dataChannel.bufferedAmount > limit);
  let snapBytes = 0, snapSeen = 0;
  sendSnapshot = function (s) {
    if ("host" !== NET.mode) return;
    if (!(snapSeen++ % 20)) try { snapBytes = JSON.stringify(s).length; } catch (x) {}
    const limit = 2 * Math.max(snapBytes, 512);
    for (const [, o] of conns()) {
      if (o.quiet) continue;
      const c = open(o.state) ? o.state : open(o.event) ? o.event : null;
      if (backed(c, limit)) { NET.skipped = (NET.skipped || 0) + 1; continue; }
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
    for (const peer of [...quiet.keys()]) hush(peer);
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
    if (backed(c, 1024) && "in" === e.t) return void (NET.skippedIn = (NET.skippedIn || 0) + 1);
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
