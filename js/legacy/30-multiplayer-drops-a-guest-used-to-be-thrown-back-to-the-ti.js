
(() => {
  // Multiplayer drops. A guest used to be thrown back to the title with
  // "the host left" on the first hiccup: a phone switching apps, the screen
  // dimming, Wi-Fi changing. Now the guest dials back in on its own and takes
  // its body back; only a host that is really gone ends the match.

  // ── host ──
  // any "error" on either channel used to drop the player for good (even a
  // single oversized message). Only a closed channel counts, and when one of
  // the two channels closes, close the other so the guest notices and redials.
  const closeBoth = (id) => {
    const c = NET.conns.get(id);
    if (!c) return;
    for (const k of ["state", "event"])
      try {
        c[k] && c[k].open && c[k].close();
      } catch (e) {}
  };
  hostAccept = function (e) {
    const label = e.label;
    e.on("open", () => {
      let o = NET.conns.get(e.peer);
      o || ((o = {}), NET.conns.set(e.peer, o));
      o[label] = e;
      "event" === label && NET.onPeerJoin && NET.onPeerJoin(e.peer);
    });
    e.on("data", (t) => hostRecv(e.peer, t));
    e.on("close", () => {
      closeBoth(e.peer);
      hostDrop(e.peer);
    });
    e.on("error", (err) => {
      try {
        console.warn("[net] channel error from", e.peer, err && (err.type || err.message));
      } catch (x) {}
    });
  };
  // a guest that redials tells us its old id: let go of that one first so the
  // old body goes back to the bots and the "hello" below can take it again
  const _oa = NET.onAction;
  NET.onAction = function (peer, m) {
    const hello = m && "hello" === m.t;
    if (hello && m.prev && m.prev !== peer && NET.conns.has(m.prev)) {
      closeBoth(m.prev);
      hostDrop(m.prev);
    }
    const r = _oa.apply(this, arguments);
    // it came back into a different body (its own died meanwhile): tell
    // everyone, the guest included, who drives what now
    if (hello && null != m.actorId && room.started && "host" === NET.mode)
      try {
        const a = world.actors.find((o) => o.ctrl === peer);
        if (a && a.id !== m.actorId) {
          const old = actorById(m.actorId);
          old && sendEventAll({ t: "ctrl", id: old.id, ctrl: isAI(old) ? "ai" : old.ctrl, name: old.name });
          sendEventAll({ t: "ctrl", id: a.id, ctrl: peer, name: a.name });
          sendEventTo(peer, { t: "wallet", c: a.credits, w: a.weapons, am: a.ammo, ar: a.armor, s: a.slot });
        }
      } catch (e) {}
    return r;
  };
  // keep the match running while the host's tab is in the background
  // (requestAnimationFrame stops there; timers inside a worker do not)
  let worker = null,
    wLast = 0;
  const bgTick = () => {
    if (!document.hidden || "host" !== NET.mode || !NET.conns.size || "menu" === world.phase || "over" === world.phase) return;
    const now = performance.now(),
      real = Math.max(0, (now - (wLast || now)) / 1000),
      // same fixed-step split as tick(): <=0.05 s runs once as before; longer gaps
      // (background timers are throttled to ~1/s) run in equal sub-steps, capped
      n = real > 0.05 ? Math.min(5, Math.ceil(real / 0.05 - 1e-9)) : 1,
      dt = real > 0.05 ? Math.min(real, 0.25) / n : real;
    wLast = now;
    window.NET_BG = (window.NET_BG || 0) + 1;
    dt > 0 &&
      (() => {
        try {
          for (let i = 0; i < n && "menu" !== world.phase && "over" !== world.phase; i++) step(dt);
        } catch (e) {}
      })();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && "host" === NET.mode) {
      if (!worker)
        try {
          const url = URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),33)"], { type: "text/javascript" }));
          try { worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
          worker.onmessage = bgTick;
        } catch (e) {
          worker = null;
        }
      // no worker (blocked): a plain timer, slowed to ~1/s in the background
      worker || (worker = { terminate: ((h) => () => clearInterval(h))(setInterval(bgTick, 33)) });
      wLast = performance.now();
    } else if (worker) {
      worker.terminate();
      worker = null;
    }
  });

  const stopBackground = () => { if (worker) worker.terminate(); worker = null; wLast = 0; };
  const shutdownBackground = netShutdown;
  netShutdown = function () { stopBackground(); return shutdownBackground.apply(this, arguments); };
  addEventListener("match-finished", stopBackground);
  addEventListener("pagehide", stopBackground);

  // ── guest ──
  // joining waited 12 s for both channels; a busy phone mid-match (or a slow
  // network) needs longer, and a retry that tears down a half-open link just
  // starts the wait again. Same join, 25 s.
  netJoin = function (code, ms) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === "undefined") return reject(new Error("네트워크 모듈을 불러오지 못했습니다"));
      netCloseTransport();
      NET.room = code;
      NET.mode = "client";
      NET.status = "connecting";
      NET.error = null;
      const peer = new Peer(null, peerOpts());
      NET.peer = peer;
      let settled = false, notified = false;
      const current = () => NET.peer === peer && NET.mode === "client" && NET.room === code;
      const cancel = () => { if (!settled) { settled = true; clearTimeout(timer); reject(netAbortError()); } };
      const finish = (error) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (NET.cancelConnect === cancel) NET.cancelConnect = null;
        if (error) {
          if (current()) { NET.status = "error"; NET.error = error; netCloseTransport(); }
          reject(error);
        } else { NET.status = "open"; resolve(true); }
      };
      const timer = setTimeout(() => finish(new Error("방을 찾지 못했습니다")), ms || 25000);
      NET.cancelConnect = cancel;
      netWatchSignaling(peer);
      const gone = () => {
        if (!current() || notified) return;
        if (!settled) return finish(new Error("방과의 연결이 닫혔습니다"));
        notified = true; NET.status = "closed";
        NET.onHostGone && NET.onHostGone();
      };
      peer.on("open", () => {
        if (!current() || peer.destroyed || NET.up) return;
        const id = roomToPeerId(code),
          state = peer.connect(id, { label: "state", reliable: false, serialization: "json" }),
          event = peer.connect(id, { label: "event", reliable: true, serialization: "json" });
        const up = NET.up = { state, event };
        event.on("open", () => { if (current() && NET.up === up) finish(); });
        for (const [label, channel] of [["state", state], ["event", event]]) {
          channel.on("data", (data) => { if (current() && NET.up === up && up[label] === channel && channel.open) clientRecv(data); });
          channel.on("close", () => {
            if (!current() || NET.up !== up || up[label] !== channel) return;
            up[label] = null;
            // The reliable channel is sufficient, including while it is still opening.
            if (label === "event") gone();
          });
          channel.on("error", (error) => {
            if (!current() || NET.up !== up) return;
            if (label === "event" && !settled) finish(error);
            else if (label === "event" && !channel.open) gone();
          });
        }
      });
      peer.on("close", gone);
      peer.on("error", (error) => { if (current() && !settled) finish(error); });
    });
  };
  const RC = { busy: !1, quit: !1, bye: !1, generation: 0, snapT: performance.now(), wait: !1 };
  window.NET_RC = RC;
  const _os = NET.onSnapshot;
  NET.onSnapshot = function () {
    RC.snapT = performance.now();
    RC.wait && ((RC.wait = !1), pill(null));
    return _os.apply(this, arguments);
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    e && "bye" === e.t && (RC.bye = !0);
    return _oe.apply(this, arguments);
  };
  const _ns = netShutdown;
  netShutdown = function () {
    RC.quit = !0;
    RC.generation++;
    RC.busy = RC.wait = !1;
    pill(null);
    return _ns.apply(this, arguments);
  };
  const _jr = joinRoom;
  joinRoom = function () {
    RC.generation++;
    RC.busy = RC.wait = !1;
    RC.quit = RC.bye = !1;
    pill(null);
    RC.snapT = performance.now();
    return _jr.apply(this, arguments);
  };
  const inMatch = () => "client" === NET.mode && !!NET.room && "menu" !== world.phase && "over" !== world.phase;
  const _gone = NET.onHostGone;
  NET.onHostGone = function () {
    if (RC.busy || RC.quit) return;
    if (RC.bye || !inMatch()) return _gone.apply(this, arguments);
    redial();
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function redial() {
    if (RC.busy || RC.quit || RC.bye || NET.mode !== "client" || !NET.room) return;
    RC.busy = !0;
    const generation = RC.generation, active = () => generation === RC.generation && !RC.quit && !RC.bye;
    const code = NET.room,
      prev = NET.peer && NET.peer.id,
      me = typeof myActor == "function" && myActor(),
      actorId = me ? me.id : null;
    const TRIES = 6;
    let missing = 0;
    for (let i = 1; i <= TRIES && active(); i++) {
      pill(`연결이 끊겼습니다 · 다시 연결하는 중 (${i}/${TRIES})`);
      (RC.log = RC.log || []).push(Math.round(performance.now() / 100) / 10 + " try " + i);
      netCloseTransport();
      await sleep(250);
      if (!active()) break;
      try {
        await netJoin(code, 40000);
        if (!active()) break;
        sendAction({ t: "hello", name: myName(), actorId, prev });
        RC.snapT = performance.now();
        RC.busy = !1;
        RC.wait = !1;
        pill(null);
        try {
          banner("다시 연결했습니다", "#4ade80");
        } catch (e) {}
        window.NET_REDIALS = (window.NET_REDIALS || 0) + 1;
        return;
      } catch (e) {
        if (!active() || e.name === "AbortError") break;
        RC.lastErr = (e && (e.type || e.message)) || String(e);
        RC.log.push(Math.round(performance.now() / 100) / 10 + " fail " + RC.lastErr);
        // the host's id is not on the server any more: it closed the game
        if ("peer-unavailable" === (e && e.type) && ++missing >= 3) break;
        await sleep(1000 + 1000 * i);
      }
    }
    if (generation !== RC.generation) return;
    RC.busy = !1;
    pill(null);
    active() && _gone();
  }
  window.netRedial = redial;
  // no snapshots for a while: say so; for too long: the link is dead, redial
  setInterval(() => {
    if (!inMatch() || RC.busy) return;
    if (document.hidden) return void (RC.snapT = performance.now());
    const gap = performance.now() - RC.snapT;
    if (gap > 20000) return redial();
    if (gap > 4000) (RC.wait = !0), pill(`방장 응답을 기다리는 중… ${Math.round(gap / 1000)}초`);
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    // coming back from another app: give the link a moment before judging it
    document.hidden || (RC.snapT = Math.max(RC.snapT, performance.now() - 1000));
  });

  const el = document.createElement("div");
  el.id = "net-rc";
  el.hidden = !0;
  document.body.appendChild(el);
  function pill(t) {
    el.hidden = !t;
    t && (el.textContent = t);
  }
  const st = document.createElement("style");
  st.textContent = `#net-rc{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:65;padding:8px 16px;border-radius:999px;background:rgba(10,13,18,.86);border:1px solid rgba(255,200,73,.55);color:#ffe6a8;font:600 13px/1.3 'Noto Sans KR',sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 8px 24px -8px #000}#net-rc[hidden]{display:none}`;
  document.head.appendChild(st);
})();
