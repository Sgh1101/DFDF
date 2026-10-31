(() => {
  // Two things that need to know who the humans in a room are:
  //  · The bots' skill (js/bot-skill.js). When a round starts the host reads the average account level of the
  //    humans (their average tier in a ranked room), turns it into one skill number and caches it in BOT_RT;
  //    diffTune() in the engine only reads that number afterwards.
  //  · A "Lv N" chip beside a player's name on the scoreboard, the lobby slots and the kill feed.
  // A guest still says its level (and tier) in the hello message, but that is only a claim. The host asks the server
  // (api `levels`, public info only) what the account of each name in the room really is, and the server's numbers
  // replace the claim: they set the room's skill and they are what the lobby, the actor list and the ctrl event hand
  // on. In a ranked room the roster the server answers to ranked_start brings the same numbers. A name with no account
  // (a guest) has no level: its claim is dropped, it is left out of the average and has no chip. If the server cannot
  // be reached the claim still counts for the skill (as before) but is marked unverified and NO chip shows for it:
  // a chip only ever shows a number the server gave. Bots never have one.
  // The clan tag beside a name travels the same way and is held to the same rule: the server's answer carries `clan` (the
  // tag) for an account that is in a clan, the host hands it on with the level, and a tag is never taken from a claim
  // (hello, a message from a guest). Mine is the server's too (js/legacy/124: CLAN_ME).
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
  // a clan tag as it may be shown: 2-4 letters, digits or Hangul, or nothing
  const tagClean = (s) => (/^[A-Za-z0-9가-힣]{2,4}$/.test(String(s == null ? "" : s)) ? String(s) : "");
  // what the host heard in each guest's hello: a CLAIM
  const PEER = new Map();
  // what the server says about each guest's account, by peer: { id, lv (null: no account), tr, placed }
  const VER = new Map();
  const nameOf = (peer) => {
    const m = room.members && room.members.get(peer);
    return m && m.name ? String(m.name) : "";
  };
  // the server's numbers for a peer, only while the peer still has the name they were read for
  const verified = (peer) => {
    const v = VER.get(peer);
    return v && v.id === nameOf(peer).toLowerCase() ? v : null;
  };
  // a ranked room reads the tier: an account still placing has its tier hidden and counts as Iron (what it always did)
  // ms: the mastery level of each agent the account has played ({agentId: level}, none played is {}); pl: still placing
  const fromServer = (u) => (u && Number.isFinite(+u.level) && +u.level >= 1 ? { lv: Math.floor(+u.level), tr: u.placed && Number.isFinite(+u.t) ? u.t : 0, ms: u.mast && "object" == typeof u.mast ? u.mast : {}, pl: !u.placed, ct: tagClean(u.clan) } : null);
  // what is SHOWN for an actor: mine, a guest's as the host handed it on, or what the server verified; never a claim
  const of = (a) => {
    if (!a || "ai" === a.ctrl || "dead" === a.ctrl) return null;
    if ("me" === a.ctrl) return own();
    if (a.__lv) return { lv: a.__lv, tr: null == a.__tr ? null : a.__tr };
    const v = verified(a.ctrl);
    return v && v.lv ? { lv: v.lv, tr: v.tr } : null;
  };
  // what the bots' skill reads: the same, and the claim only while the server has not answered (or cannot be reached)
  const forSkill = (a) => {
    if (!a || "ai" === a.ctrl || "dead" === a.ctrl) return null;
    if ("me" === a.ctrl) return own();
    if (a.__lv) return of(a);
    const v = verified(a.ctrl);
    if (v) return v.lv ? { lv: v.lv, tr: v.tr } : null;
    return PEER.get(a.ctrl) || null;
  };

  // the mastery level of the agent an actor plays, and whether its tier is still hidden (placement), for the pre-match screen:
  // mine from my account, a guest's as the host handed it on or as the server verified it, never a claim; a bot or an account
  // the server does not know has none. An agent the account never played is level 1.
  const mlv = (map, id) => (window.MASTERY ? window.MASTERY.levelOf(map, id, 1) : null);
  const agentId = (a) => (a && a.agent && (a.agent.id || a.agent.key)) || "";
  const mastOf = (a) => {
    if (!a || "ai" === a.ctrl || "dead" === a.ctrl) return null;
    if ("me" === a.ctrl) {
      try {
        const u = window.ACCOUNT && ACCOUNT.session() && ACCOUNT.session().user;
        return u && u.mast && "object" == typeof u.mast && !(window.SERVER_CFG && SERVER_CFG.mastery && !1 === SERVER_CFG.mastery.on) ? mlv(u.mast, agentId(a)) : null;
      } catch (e) {
        return null;
      }
    }
    if (a.__ml) return a.__ml;
    const v = verified(a.ctrl);
    return v && v.lv && v.ms ? mlv(v.ms, agentId(a)) : null;
  };
  const placingOf = (a) => {
    if (!a || "ai" === a.ctrl || "dead" === a.ctrl) return !1;
    if ("me" === a.ctrl) {
      try {
        const u = ACCOUNT.session().user;
        return !!(u && u.rank && u.rank.hidden);
      } catch (e) {
        return !1;
      }
    }
    if (null != a.__pl) return !!a.__pl;
    const v = verified(a.ctrl);
    return !!(v && v.lv && v.pl);
  };

  // the clan tag of an actor: mine from my own account (CLAN_ME, what the server said), a guest's as the host handed it on or as the
  // server verified it; a bot, an account the server does not know or one with no clan has none
  const tagOf = (a) => {
    if (!a || "ai" === a.ctrl || "dead" === a.ctrl) return "";
    if ("me" === a.ctrl) return window.CLAN_ME ? tagClean(CLAN_ME.tag) : "";
    if (null != a.__ct) return a.__ct;
    const v = verified(a.ctrl);
    return v && v.lv ? v.ct || "" : "";
  };

  // ── asking the server (host only) ──
  const ask = { timer: 0, busy: false, tries: 0 };
  // the guests in the room that the server has not been asked about yet
  const pending = () => [...(room.members ? room.members.keys() : [])].filter((p) => p !== NET.id && nameOf(p) && !verified(p));
  async function verifyNow() {
    if ("host" !== NET.mode || ask.busy || !window.ACCOUNT || !ACCOUNT.api || !ACCOUNT.online) return;
    const peers = pending();
    if (!peers.length) return;
    const ids = [...new Set(peers.map((p) => nameOf(p)))].slice(0, 12);
    ask.busy = true;
    try {
      const j = await ACCOUNT.api("levels", { ids });
      const users = (j && j.users) || {};
      const low = {};
      for (const k of Object.keys(users)) low[k.toLowerCase()] = users[k];
      for (const p of peers) {
        const id = nameOf(p).toLowerCase();
        if (!ids.some((x) => x.toLowerCase() === id) || !low[id]) continue;
        const f = fromServer(low[id]);
        VER.set(p, { id, lv: f ? f.lv : null, tr: f ? f.tr : null, ms: f ? f.ms : null, pl: f ? f.pl : !1, ct: f ? f.ct : "" });
      }
      ask.tries = 0;
      changed();
    } catch (e) {
      // the server cannot be reached: the claims stay, unverified, and we try again a few times
      ask.tries++ < 3 && (ask.timer = setTimeout(() => ((ask.timer = 0), verifyNow()), 5000 * ask.tries));
    } finally {
      ask.busy = false;
    }
    // somebody else joined while we were asking
    pending().some((p) => !peers.includes(p)) && schedule(50);
  }
  function schedule(ms) {
    if ("host" !== NET.mode || ask.timer) return;
    ask.timer = setTimeout(() => {
      ask.timer = 0;
      verifyNow();
    }, ms);
  }
  // the server's numbers changed: the room's skill, the lobby and the chips of a match under way follow
  function changed() {
    try {
      room.started && refresh();
    } catch (e) {}
    // the pre-match screen (js/legacy/114) draws what the server said as soon as it comes
    try {
      window.dispatchEvent(new CustomEvent("dfdf:levels"));
    } catch (e) {}
    try {
      if ("host" !== NET.mode) return;
      if (!room.started) {
        const snap = lobbySnapshot();
        renderLobby(snap);
        sendEventAll(snap);
      } else {
        // a match under way: tell the guests what the server says about each of them
        const list = (world.actors || []).filter((a) => a.ctrl && "ai" !== a.ctrl && "dead" !== a.ctrl && "me" !== a.ctrl).map((a) => ({ id: a.id, o: of(a), a }));
        sendEventAll({ t: "lvs", list: list.map((x) => ({ id: x.id, lv: x.o ? x.o.lv : 0, tr: x.o ? x.o.tr : null, ml: x.o ? mastOf(x.a) || 0 : 0, pl: placingOf(x.a) ? 1 : 0, ct: x.o ? tagOf(x.a) : "" })) });
      }
    } catch (e) {}
  }
  // ── the room's skill, once per round ──
  const refresh = () => {
    const B = window.BOT_SKILL;
    if (!B) return;
    const humans = (world.actors || []).filter((a) => a.ctrl && "ai" !== a.ctrl && "dead" !== a.ctrl).map(forSkill).filter(Boolean);
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
    ".lv-chip{display:inline-block;margin-left:6px;padding:0 6px;border-radius:99px;border:1px solid rgba(255,200,73,.45);background:rgba(255,200,73,.1);color:#ffc849;font:700 10px/15px var(--f-display,system-ui);letter-spacing:.04em;vertical-align:middle;white-space:nowrap}" +
    ".clan-tag{display:inline-block;margin-left:6px;padding:0 6px;border-radius:99px;border:1px solid rgba(34,211,238,.5);background:rgba(34,211,238,.1);color:#67e8f9;font:700 10px/15px var(--f-display,system-ui);letter-spacing:.04em;vertical-align:middle;white-space:nowrap}.pm-chips .clan-tag{margin-left:0}";
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
  // the tag as a chip: "[TAG]" (the text is only ever letters, digits and Hangul, but is made safe all the same)
  const tagText = (a) => {
    const t = tagOf(a);
    return t ? "[" + t + "]" : "";
  };
  const tagChipEl = (text) => {
    const s = document.createElement("span");
    s.className = "clan-tag";
    s.textContent = text;
    return s;
  };
  window.LV_CHIP = { own, of, mast: mastOf, placing: placingOf, peers: PEER, verified: VER, ask: verifyNow, refresh, forSkill, text: chipText, tag: tagOf, tagText, tagEl: tagChipEl, html: (a) => (tagText(a) ? `<span class="clan-tag">${tagText(a)}</span>` : "") + (chipText(a) ? `<span class="lv-chip">${chipText(a)}</span>` : "") };

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
        // whatever it claims, the server is asked who this name really is
        VER.delete(peer);
        ask.tries = 0;
        schedule(80);
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
    VER.clear();
    clearTimeout(ask.timer);
    ask.timer = 0;
    ask.tries = 0;
    return _lr.apply(this, arguments);
  };
  // the host's own entry too
  const infoOfPeer = (p) => {
    if (p === NET.id) return own();
    const v = verified(p);
    return v && v.lv ? { lv: v.lv, tr: v.tr } : null;
  };
  const tagOfPeer = (p) => {
    if (p === NET.id) return window.CLAN_ME ? tagClean(CLAN_ME.tag) : "";
    const v = verified(p);
    return v && v.lv ? v.ct || "" : "";
  };
  const _ls = lobbySnapshot;
  lobbySnapshot = function () {
    const s = _ls.apply(this, arguments);
    try {
      for (const t of ["atk", "def"])
        for (const m of s[t] || []) {
          const i = m && m.peer && infoOfPeer(m.peer);
          i && ((m.lv = i.lv), null != i.tr && (m.tr = i.tr));
          const ct = i && m.peer && tagOfPeer(m.peer);
          ct && (m.ct = ct);
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
        const ct = o && tagOf(a);
        ct && (m.ct = ct);
        // the mastery level of the agent it plays, and a tier still hidden
        const ml = o && mastOf(a);
        ml && (m.ml = ml);
        o && placingOf(a) && (m.pl = 1);
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
        a && ((a.__ml = whole(m.ml, 1, 10) || 0), (a.__pl = m.pl ? 1 : 0), (a.__ct = tagClean(m.ct)));
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
        const ct = i && tagOfPeer(e.ctrl);
        ct && (e.ct = ct);
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
        a && ((a.__lv = c ? c.lv : 0), (a.__tr = c ? c.tr : null), (a.__ct = c ? tagClean(e.ct) : ""));
      }
      // the host has heard from the server: the numbers of the guests in a match under way
      if (e && "lvs" === e.t && Array.isArray(e.list))
        for (const m of e.list.slice(0, 24)) {
          const a = m && world.actors.find((x) => x.id === m.id),
            c = a && clean(m.lv, m.tr);
          a && ((a.__lv = c ? c.lv : 0), (a.__tr = c ? c.tr : null), (a.__ml = whole(m.ml, 1, 10) || 0), (a.__pl = m.pl ? 1 : 0), (a.__ct = c ? tagClean(m.ct) : ""));
        }
    } catch (err) {}
    try {
      e && "lvs" === e.t && window.dispatchEvent(new CustomEvent("dfdf:levels"));
    } catch (err) {}
    return r;
  };

  // ── the match starts: whoever the server has not answered for yet is asked again right now ──
  if ("function" == typeof hostStartMatch) {
    const _hs = hostStartMatch;
    hostStartMatch = function () {
      try {
        "host" === NET.mode && pending().length && verifyNow();
      } catch (e) {}
      return _hs.apply(this, arguments);
    };
  }
  // ── a ranked room: the roster the server opened the match with (ranked_start) says the same, by account id ──
  window.addEventListener("dfdf:roster-levels", (ev) => {
    try {
      const lv = (ev && ev.detail) || {};
      const low = {};
      for (const k of Object.keys(lv)) low[k.toLowerCase()] = lv[k];
      for (const [peer] of room.members) {
        const id = nameOf(peer).toLowerCase();
        if (peer === NET.id || !id || !low[id]) continue;
        const f = fromServer(low[id]);
        VER.set(peer, { id, lv: f ? f.lv : null, tr: f ? f.tr : null, ms: f ? f.ms : null, pl: f ? f.pl : !1, ct: f ? f.ct : "" });
      }
      changed();
    } catch (e) {}
  });

  // ── the lobby slots ──
  const _rl = renderLobby;
  renderLobby = function (e) {
    const r = _rl.apply(this, arguments);
    try {
      for (const [t, id] of [["atk", "lb-atk"], ["def", "lb-def"]]) {
        const box = $(id);
        (e[t] || []).forEach((m, i) => {
          const nm = m && m.lv && box && box.children[i] && box.children[i].querySelector(".lb-nm");
          nm && !nm.querySelector(".clan-tag") && tagClean(m.ct) && nm.appendChild(tagChipEl("[" + tagClean(m.ct) + "]"));
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
