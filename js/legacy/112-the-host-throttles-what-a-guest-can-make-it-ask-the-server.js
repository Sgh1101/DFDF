(() => {
  // The host asks the server on a guest's behalf for a few guest messages: a "skins" ticket is checked (skin_check),
  // a "hello" looks the name up (levels), "own-hi" and "perm-hi" check an owner / cheat ticket (owner_check,
  // perm_check). The server limits those calls per IP, so one guest spamming them could use up the quota the
  // host also needs for ranked_start, levels and the room heartbeat. Here each peer gets a small token bucket per
  // such message type; a message over the budget is dropped (one console line per peer and type). Any other
  // message goes through untouched and in order.
  //
  // What an honest client sends, per peer id (every redial is a NEW peer id, so it starts with a full bucket):
  //   hello    once on joining, once more after a redial (that one is a new peer)      -> 5, then 1 per 4 s
  //   skins    one with the hello and one per equip / inventory sync (newest wins)     -> 10, then 1 per 3 s
  //   own-hi   once per link, again within the last minute before the owner ticket ends -> 3, then 1 per 20 s
  //   perm-hi  once per link                                                           -> 3, then 1 per 20 s
  // "skins" is state (the newest table wins), so the newest message held back is delivered when a token comes
  // back: a player who equips many skins in a row still ends with the right one on the host, and the pace to
  // the server stays inside the budget.
  if ("undefined" == typeof NET || "function" != typeof NET.onAction) return;
  const RULES = {
    hello: { cap: 5, every: 4000 },
    skins: { cap: 10, every: 3000, latest: !0 },
    "own-hi": { cap: 3, every: 20000 },
    "perm-hi": { cap: 3, every: 20000 },
  };
  const STATE = new Map(); // peer -> Map(type -> { tokens, at, warned, held, timer })
  const isHost = () => "host" === NET.mode;
  function slot(peer, type, now) {
    let by = STATE.get(peer);
    by || STATE.set(peer, (by = new Map()));
    let s = by.get(type);
    s || by.set(type, (s = { tokens: RULES[type].cap, at: now, warned: !1, held: null, timer: 0 }));
    return s;
  }
  function refill(s, rule, now) {
    const dt = Math.max(0, now - s.at);
    s.at = now;
    s.tokens = Math.min(rule.cap, s.tokens + dt / rule.every);
  }
  // true when this peer may send this type now (and uses one token); a type without a rule is always true
  function take(peer, type, now) {
    const rule = Object.prototype.hasOwnProperty.call(RULES, type) ? RULES[type] : null;
    if (!rule) return !0;
    now = null == now ? Date.now() : now;
    const s = slot(peer, type, now);
    refill(s, rule, now);
    if (s.tokens < 1) return !1;
    s.tokens -= 1;
    return !0;
  }
  function forget(peer) {
    const by = STATE.get(peer);
    if (!by) return;
    for (const s of by.values()) clearTimeout(s.timer);
    STATE.delete(peer);
  }
  function clearAll() {
    for (const peer of [...STATE.keys()]) forget(peer);
  }
  // peers that left without onPeerGone telling us (a bounded safety net)
  function prune() {
    if (STATE.size <= 64) return;
    for (const peer of [...STATE.keys()]) NET.conns && NET.conns.has(peer) || forget(peer);
  }
  const _oa = NET.onAction;
  function deliverHeld(peer, type) {
    const by = STATE.get(peer),
      s = by && by.get(type);
    if (!s) return;
    s.timer = 0;
    const msg = s.held;
    if (!msg) return;
    if (!isHost() || !NET.conns.has(peer)) return void (s.held = null);
    if (!take(peer, type)) return void arm(peer, type, s);
    s.held = null;
    try {
      _oa.call(NET, peer, msg);
    } catch (e) {
      console.warn("[net] held " + type + " failed", e);
    }
  }
  function arm(peer, type, s) {
    if (s.timer) return;
    const rule = RULES[type];
    s.timer = setTimeout(() => deliverHeld(peer, type), Math.ceil(Math.max(0, 1 - s.tokens) * rule.every) + 20);
  }
  NET.onAction = function (peer, msg) {
    const type = msg && "object" == typeof msg && "string" == typeof msg.t ? msg.t : "";
    if (!isHost() || !Object.prototype.hasOwnProperty.call(RULES, type)) return _oa.apply(this, arguments);
    prune();
    if (take(peer, type)) {
      // a newer message of a "latest wins" type makes the held one stale
      const by = STATE.get(peer),
        s = by && by.get(type);
      s && (s.held = null);
      return _oa.apply(this, arguments);
    }
    const s = slot(peer, type);
    if (!s.warned) {
      s.warned = !0;
      console.warn("[net] " + type + " from " + peer + " is over its budget: dropping the extras");
    }
    if (RULES[type].latest) {
      s.held = msg;
      arm(peer, type, s);
    }
  };
  const _pg = NET.onPeerGone;
  NET.onPeerGone = function (peer) {
    try {
      forget(peer);
      window.MOBILE && window.MOBILE.peers && window.MOBILE.peers.delete(peer);
    } catch (e) {}
    return _pg && _pg.apply(this, arguments);
  };
  if ("function" == typeof netShutdown) {
    const _sd = netShutdown;
    netShutdown = function () {
      clearAll();
      return _sd.apply(this, arguments);
    };
  }
  window.PEER_THROTTLE = { rules: RULES, take, forget, clearAll, size: () => STATE.size };
})();
