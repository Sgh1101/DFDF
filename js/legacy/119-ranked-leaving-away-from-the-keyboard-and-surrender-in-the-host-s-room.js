(() => {
  // Leaving, being away and giving up, in a match played with other people.
  //  - Who left (ranked rooms): the host watches which roster accounts are in the room and for how long one was
  //    not; the longest absence and whether he was away at the end go to the server with the result
  //    (109-ranked-flow, ranked_result `gone`), and the server decides who left (a drop that is back inside
  //    rank.leaveGraceS is not leaving). A guest whose host went away says so (ranked_void), so the guests of a
  //    vanished host are not judged for a match that could not end.
  //  - Away from the keyboard (ranked rooms only; a normal room is left as it was): a guest whose input does not
  //    change for rank.afkWarnS seconds of a live round (a tab in the background sends nothing either) gets a
  //    warning on his screen; rank.afkLeaveS seconds later his body goes to a bot, as on a drop, and he counts as
  //    having left. He may take the body back; the count stays.
  //  - Surrender (ranked and normal team modes): from round rank.surrenderRound (or after rank.surrenderS seconds
  //    in a mode without rounds) a player asks, the team has rank.surrenderVoteS seconds to vote, and when more
  //    than half of its people are for it the match ends as a loss for that team. The host runs the vote and
  //    ends the match through the normal game over, so the result is attested like any other.
  if ("undefined" == typeof room || "undefined" == typeof NET || "undefined" == typeof world || "undefined" == typeof sendEventTo || "undefined" == typeof gameOver || !window.RANKED) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const RK = window.RANKED;
  const lc = (s) => String(s == null ? "" : s).toLowerCase();
  const isHost = () => "host" === NET.mode;
  const num = (v, d) => (Number.isFinite(+v) && null != v ? +v : d);
  // the owner's numbers (SERVER_CFG.rank, see rank.* in the server's config); the same defaults as the server's
  const cfg = () => {
    const R = (window.SERVER_CFG && window.SERVER_CFG.rank) || {};
    return { grace: num(R.leaveGraceS, 60), warn: num(R.afkWarnS, 90), out: num(R.afkLeaveS, 30), sRound: num(R.surrenderRound, 5), sTime: num(R.surrenderS, 240), sVote: num(R.surrenderVoteS, 15), sCool: num(R.surrenderCoolS, 60) };
  };
  const say = (t, c) => {
    try {
      "function" == typeof banner && banner(t, c || "#ffc849");
    } catch (e) {}
  };
  const shout = (t, c) => {
    say(t, c);
    try {
      isHost() && sendEventAll({ t: "round", msg: t, color: c || "#ffc849" });
    } catch (e) {}
  };
  const running = () => !!(world.actors && world.actors.length) && "menu" !== world.phase && "over" !== world.phase;
  const human = (a) => !!a && !!a.ctrl && "ai" !== a.ctrl && "dead" !== a.ctrl;
  const actorOf = (peer) => world.actors.find((a) => a.ctrl === peer);
  const ranked = () => !!room.ranked && isHost();
  const myId = () => {
    try {
      return lc(window.ACCOUNT.session().user.id);
    } catch (e) {
      return "";
    }
  };

  // ── who is in the room, and for how long was somebody not (ranked, on the host) ──
  const LV = (RK.leave = { g: new Map(), afk: new Set(), rec: null });
  const present = () => {
    const out = new Set();
    for (const [peer, m] of room.members) peer !== NET.id && NET.conns.has(peer) && out.add(lc(m.name));
    return out;
  };
  function trackLeave() {
    const r = RK.flow && RK.flow.current && RK.flow.current();
    if (!r || r.sent || !ranked() || !room.started) return;
    if (LV.rec !== r) ((LV.rec = r), LV.g.clear(), LV.afk.clear());
    const here = present(),
      now = performance.now(),
      hid = myId();
    for (const id of r.a.concat(r.b)) {
      const key = lc(id);
      if (key === hid) continue;
      let g = LV.g.get(key);
      g || LV.g.set(key, (g = { since: null, max: 0 }));
      const away = !here.has(key);
      if (away && null == g.since) g.since = now;
      else if (!away && null != g.since) ((g.max = Math.max(g.max, now - g.since)), (g.since = null));
    }
  }
  // { account: { s: the longest absence in seconds, end: 1 if he was away when the match ended } }, for the result
  LV.report = () => {
    const out = {};
    try {
      trackLeave();
      const here = present(),
        now = performance.now();
      for (const [key, g] of LV.g) {
        const s = Math.round(Math.max(g.max, null != g.since ? now - g.since : 0) / 1000),
          end = LV.afk.has(key) || !here.has(key);
        (s > 0 || end) && (out[key] = { s, end: end ? 1 : 0 });
      }
    } catch (e) {}
    return out;
  };
  // a guest whose host is really gone says so, once: the match cannot end for anybody
  const _hl = hostLeftNotice;
  hostLeftNotice = function () {
    try {
      if ("client" === NET.mode && room.ranked && running() && window.ACCOUNT && ACCOUNT.api) {
        const s = ACCOUNT.session && ACCOUNT.session();
        s && s.token && ACCOUNT.api("ranked_void", { token: s.token, room: room.code || NET.room || "" }).catch(() => {});
      }
    } catch (e) {}
    return _hl.apply(this, arguments);
  };

  // ── away from the keyboard (ranked, on the host) ──
  const AFK = new Map(); // peer -> { key, changed, idle, warned }
  const afkOf = (peer) => {
    let s = AFK.get(peer);
    s || AFK.set(peer, (s = { key: "", changed: !1, idle: 0, warned: !1 }));
    return s;
  };
  const _oi = NET.onInput;
  NET.onInput = function (peer, data) {
    try {
      if (ranked() && data && Array.isArray(data.mv)) {
        const s = afkOf(peer),
          key = data.mv.join(",") + "|" + data.btn + "|" + data.yaw + "|" + data.pitch;
        key !== s.key && ((s.key = key), (s.changed = !0));
      }
    } catch (e) {}
    return _oi.apply(this, arguments);
  };
  function handOver(peer) {
    const a = actorOf(peer),
      m = room.members.get(peer);
    if (!a) return;
    m && LV.afk.add(lc(m.name));
    // as on a drop: the body goes to a bot, and he may take it back with a hello
    leaveInProgress(peer);
    for (const [p] of NET.conns) p === peer ? sendEventTo(p, { t: "afk-out", id: a.id }) : sendEventTo(p, { t: "ctrl", id: a.id, ctrl: "ai", name: a.name });
    say(L(`${a.name} 자리 비움 · 봇이 이어받습니다`, `${a.name} is away · a bot takes over`), "#ff8a9a");
  }
  let lastTick = 0;
  function afkTick(now) {
    const dt = Math.min(5, Math.max(0, (now - lastTick) / 1000)),
      C = cfg();
    lastTick = now;
    if (!ranked() || !running() || C.warn <= 0) return AFK.clear();
    for (const a of world.actors) {
      const peer = a.ctrl;
      if (!human(a) || "me" === peer || !NET.conns.has(peer)) continue;
      const s = afkOf(peer);
      if (s.changed) {
        s.changed = !1;
        s.idle = 0;
        s.warned && ((s.warned = !1), sendEventTo(peer, { t: "afk-ok" }));
      } else if ("live" === world.phase && a.alive) s.idle += dt;
      if (s.idle >= C.warn + C.out) {
        AFK.delete(peer);
        handOver(peer);
      } else if (s.idle >= C.warn) {
        // told again every few seconds: one message may be lost, and a guest that just came back to the tab hears it
        if (!s.warned || now - (s.at || 0) > 4000) ((s.warned = !0), (s.at = now), sendEventTo(peer, { t: "afk", s: Math.max(1, Math.ceil(C.warn + C.out - s.idle)) }));
      }
    }
  }

  // ── surrender: the vote on the host ──
  let SV = null; // { team, by, yes, no, end }
  const cool = { atk: 0, def: 0 };
  let matchT0 = 0;
  const modeOf = () => (window.GAME_MODES && GAME_MODES[room.mode]) || {};
  const teamMode = () => {
    const M = modeOf();
    return !(M.ffa || M.infect || M.range || M.zone);
  };
  const keyOf = (a) => ("me" === a.ctrl ? "host" : a.ctrl);
  function tally() {
    const keys = new Set(world.actors.filter((a) => a.team === SV.team && human(a)).map(keyOf)),
      n = keys.size,
      count = (set) => [...set].filter((k) => keys.has(k)).length;
    return { n, yes: count(SV.yes), no: count(SV.no), need: Math.floor(n / 2) + 1 };
  }
  // why this player cannot start a vote now ("" if he can)
  function whyNot(a) {
    const C = cfg();
    if (!a || !running() || !["buy", "live"].includes(world.phase)) return "phase";
    if (!teamMode() || C.sRound <= 0) return "mode";
    if (SV) return "busy";
    if (!modeOf().respawn ? world.round < C.sRound : (performance.now() - matchT0) / 1000 < C.sTime) return modeOf().respawn ? "early_t" : "early";
    if (cool[a.team] > performance.now()) return "cool";
    return "";
  }
  function push() {
    if (!SV) return;
    const t = tally(),
      left = Math.max(0, SV.end - performance.now());
    for (const a of world.actors) {
      if (!human(a) || a.team !== SV.team) continue;
      const k = keyOf(a),
        st = { t: "sv", st: "open", team: SV.team, by: SV.by, left, yes: t.yes, no: t.no, n: t.n, need: t.need, you: SV.yes.has(k) ? 1 : SV.no.has(k) ? 0 : -1 };
      "host" === k ? ui.state(st) : sendEventTo(k, st);
    }
  }
  function startVote(a) {
    const C = cfg();
    SV = { team: a.team, by: a.name, yes: new Set([keyOf(a)]), no: new Set(), end: performance.now() + 1000 * C.sVote };
    for (const o of world.actors) human(o) && o.team !== a.team && ("me" === o.ctrl ? say(L("상대 팀이 항복 투표를 시작했습니다", "The other team started a surrender vote"), "#8a97ab") : sendEventTo(o.ctrl, { t: "sv", st: "other" }));
    evaluate();
  }
  function evaluate() {
    if (!SV) return;
    const t = tally();
    if (!t.n) return end(null);
    if (t.yes >= t.need) return end(!0);
    if (t.no > t.n - t.need || performance.now() >= SV.end) return end(!1);
    push();
  }
  function end(ok) {
    const v = SV;
    if (!v) return;
    SV = null;
    const msg = { t: "sv", st: null === ok ? "gone" : ok ? "pass" : "fail", team: v.team };
    for (const a of world.actors) human(a) && a.team === v.team && ("me" === a.ctrl ? ui.state(msg) : sendEventTo(a.ctrl, msg));
    if (!1 === ok) cool[v.team] = performance.now() + 1000 * cfg().sCool;
    if (ok) surrender(v.team);
  }
  // the match ends with the other side the winner: its score is brought to the winning score, ours is left
  function surrender(team) {
    if (!running()) return;
    const win = "atk" === team ? "def" : "atk",
      wk = "atk" === win ? "scoreAtk" : "scoreDef",
      lk = "atk" === win ? "scoreDef" : "scoreAtk";
    world[wk] = Math.max(world[wk] | 0, modeOf().respawn ? (world[lk] | 0) + 1 : winRounds());
    shout(L(`${"atk" === team ? "공격팀" : "수비팀"}이 항복했습니다`, `The ${"atk" === team ? "attackers" : "defenders"} surrendered`), "#ffc849");
    world.over = !0;
    gameOver();
  }
  const REASON = {
    phase: () => L("지금은 항복할 수 없습니다", "You cannot surrender right now"),
    mode: () => L("이 모드에서는 항복할 수 없습니다", "Surrender is not available in this mode"),
    busy: () => L("이미 항복 투표가 열려 있습니다", "A surrender vote is already open"),
    early: (C) => L(`${C.sRound}라운드부터 항복할 수 있습니다`, `You can surrender from round ${C.sRound}`),
    early_t: (C) => L(`경기 시작 ${Math.round(C.sTime / 60)}분 뒤부터 항복할 수 있습니다`, `You can surrender ${Math.round(C.sTime / 60)} minutes into the match`),
    cool: () => L("투표가 부결된 직후에는 잠시 기다려야 합니다", "Wait a moment after a vote that failed"),
  };
  const refuse = (why) => say((REASON[why] || REASON.phase)(cfg()), "#ff8a9a");
  // a request from the host's own seat or from a guest
  function request(peer) {
    const a = "me" === peer ? myActor() : actorOf(peer),
      why = whyNot(a);
    if (why) return void ("me" === peer ? refuse(why) : sendEventTo(peer, { t: "sv-no", why }));
    startVote(a);
  }
  function cast(peer, yes) {
    if (!SV) return;
    const a = "me" === peer ? myActor() : actorOf(peer);
    if (!a || a.team !== SV.team || !human(a)) return;
    const k = keyOf(a);
    if (SV.yes.has(k) || SV.no.has(k)) return;
    (yes ? SV.yes : SV.no).add(k);
    evaluate();
  }
  const _oa = NET.onAction;
  NET.onAction = function (peer, msg) {
    if (isHost() && msg && "sur" === msg.t) return void request(peer);
    if (isHost() && msg && "surv" === msg.t) return void cast(peer, !!msg.v);
    return _oa.apply(this, arguments);
  };
  const _hsm = hostStartMatch;
  hostStartMatch = function () {
    SV = null;
    cool.atk = cool.def = 0;
    matchT0 = performance.now();
    AFK.clear();
    return _hsm.apply(this, arguments);
  };
  const _go = gameOver;
  gameOver = function () {
    SV && end(null);
    return _go.apply(this, arguments);
  };

  // ── what the player sees ──
  const st = document.createElement("style");
  st.textContent = `
#sv-box,#afk-box,#afk-out{position:fixed;z-index:70;color:#e8edf4;font-family:'Noto Sans KR',sans-serif;background:rgba(10,13,18,.9);border:1px solid rgba(255,200,73,.55);border-radius:14px;box-shadow:0 14px 36px -12px #000;pointer-events:none}
#sv-box[hidden],#afk-box[hidden],#afk-out[hidden]{display:none}
#sv-box{left:16px;top:34%;width:248px;padding:12px 14px}
#sv-box .sv-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
#sv-box .sv-h b{font-size:15px;letter-spacing:.02em;color:#ffe6a8}
#sv-box .sv-h span{font:700 18px/1 var(--f-display,inherit);color:#fff}
#sv-box .sv-sub{margin:6px 0 8px;font-size:12px;line-height:1.5;color:#b5c0d0}
#sv-box .sv-bar{height:4px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}
#sv-box .sv-bar i{display:block;height:100%;width:100%;background:#ffc849;transform-origin:left}
#sv-box .sv-btns{display:flex;gap:8px;margin-top:10px}
#sv-box .sv-btns button{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;font:700 13px/1 inherit;pointer-events:auto;cursor:pointer}
#sv-box .sv-btns button.yes{border-color:#4ade80aa;background:rgba(74,222,128,.16)}
#sv-box .sv-btns button.no{border-color:#ff8a9aaa;background:rgba(255,138,154,.14)}
#sv-box .sv-btns button.on{outline:2px solid #ffc849}
#sv-box .sv-btns button:disabled{opacity:.4;cursor:default}
#sv-box kbd{padding:2px 6px;border-radius:5px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);font:700 11px/1 inherit}
#sv-box.res .sv-bar,#sv-box.res .sv-btns{display:none}
#afk-box{left:50%;top:21%;transform:translateX(-50%);width:min(380px,calc(100vw - 32px));padding:12px 16px;text-align:center;border-color:#ff8a9a;background:rgba(40,12,16,.92)}
#afk-box b{display:block;font-size:15px;color:#ffb3bd}
#afk-box span{display:block;margin-top:4px;font-size:12px;line-height:1.5;color:#e8edf4}
#afk-box em{font:700 22px/1 var(--f-display,inherit);font-style:normal;color:#fff}
#afk-out{left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 32px));padding:18px 20px;text-align:center;border-color:#ff8a9a;pointer-events:auto}
#afk-out b{display:block;font-size:17px;color:#ffb3bd}
#afk-out p{margin:8px 0 14px;font-size:13px;line-height:1.6;color:#d0d8e4}
#afk-out .btns{display:flex;gap:10px;justify-content:center}
#afk-out button{min-width:96px;min-height:40px;padding:10px 18px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font:700 13px/1 inherit;cursor:pointer}
#afk-out button.go{border-color:#ffc849;background:rgba(255,200,73,.18)}
body.touching #sv-box{left:calc(8px + env(safe-area-inset-left,0px));top:30%;width:min(236px,38vw);padding:9px 11px}
body.touching #sv-box .sv-btns button{padding:11px 4px}
body.touching #sv-box .sv-btns button kbd{display:none}
@media (max-height:460px){#sv-box .sv-sub{margin:4px 0 6px;font-size:11px}#sv-box .sv-h b{font-size:13px}#afk-box{top:15%;padding:8px 14px}#afk-out{padding:12px 16px}#afk-out p{margin:6px 0 10px;font-size:12px}}
#pz-surrender small{display:block;margin-top:3px;font-size:10px;font-weight:400;opacity:.7}
#pause.from-menu #pz-surrender{display:none}`;
  document.head.appendChild(st);
  const mk = (tag, id, html, hidden) => {
    const e = document.createElement(tag);
    e.id = id;
    e.innerHTML = html;
    hidden && (e.hidden = !0);
    document.body.appendChild(e);
    return e;
  };
  const sv = mk("div", "sv-box", `<div class="sv-h"><b id="sv-t"></b><span id="sv-time"></span></div><div class="sv-sub" id="sv-sub"></div><div class="sv-bar"><i id="sv-bar"></i></div><div class="sv-btns"><button class="yes" id="sv-yes"><kbd>J</kbd><span id="sv-yes-t"></span></button><button class="no" id="sv-no"><kbd>K</kbd><span id="sv-no-t"></span></button></div>`, !0);
  const afk = mk("div", "afk-box", `<b>${L("자리를 비운 것 같습니다", "You seem to be away")}</b><span>${L("움직이지 않으면", "If you do not move, in")} <em id="afk-s"></em>${L("초 뒤 봇에게 넘어가고 경기를 떠난 것으로 처리됩니다", " s a bot takes over and you count as having left")}</span>`, !0);
  const out = mk("div", "afk-out", `<b>${L("봇이 대신 플레이하고 있습니다", "A bot is playing for you")}</b><p>${L("오래 움직이지 않아 봇에게 넘어갔고, 이 경기는 떠난 것으로 처리됩니다. 돌아가도 처리는 그대로입니다.", "You were idle for too long, so a bot took over and this match counts as left. Going back does not undo that.")}</p><div class="btns"><button class="go" id="afk-back">${L("다시 들어가기", "Take the body back")}</button><button id="afk-quit">${L("나가기", "Leave")}</button></div>`, !0);
  const ui = (window.RANKED_UI = { vote: null, left: 0, shown: "" });
  let deadline = 0,
    total = 1,
    ask = !1,
    you = -1;
  const text = (id, v) => {
    const e = $(id);
    e && e.textContent !== v && (e.textContent = v);
  };
  function hideVote() {
    sv.hidden = !0;
    ui.vote = null;
    ask = !1;
  }
  // the three faces of the box: asking (are you sure?), voting, and the answer
  ui.ask = () => {
    ask = !0;
    you = -1;
    deadline = performance.now() + 10000;
    total = 10000;
    sv.className = "";
    sv.hidden = !1;
    text("sv-t", L("항복 투표를 시작할까요?", "Start a surrender vote?"));
    text("sv-sub", L("팀원 과반이 찬성하면 이 경기는 패배로 끝납니다.", "If more than half of your team agrees, the match ends as a loss."));
    text("sv-yes-t", L("시작", "Start"));
    text("sv-no-t", L("취소", "Cancel"));
    $("sv-yes").disabled = $("sv-no").disabled = !1;
    $("sv-yes").classList.remove("on");
    $("sv-no").classList.remove("on");
    ui.shown = "ask";
  };
  ui.state = (s) => {
    if (!s) return;
    if ("other" === s.st) return say(L("상대 팀이 항복 투표를 시작했습니다", "The other team started a surrender vote"), "#8a97ab");
    ask = !1;
    sv.hidden = !1;
    if ("open" === s.st) {
      ui.vote = s;
      you = s.you;
      total = Math.max(1000, 1000 * cfg().sVote, s.left);
      deadline = performance.now() + s.left;
      sv.className = "";
      text("sv-t", L("항복 투표", "Surrender vote"));
      text("sv-sub", L(`${s.by}님이 시작했습니다 · 찬성 ${s.yes}/${s.need} · 반대 ${s.no}`, `Started by ${s.by} · yes ${s.yes}/${s.need} · no ${s.no}`));
      text("sv-yes-t", L("찬성", "Yes"));
      text("sv-no-t", L("반대", "No"));
      $("sv-yes").disabled = $("sv-no").disabled = you >= 0;
      $("sv-yes").classList.toggle("on", 1 === you);
      $("sv-no").classList.toggle("on", 0 === you);
      ui.shown = "open";
    } else {
      ui.vote = null;
      sv.className = "res";
      text("sv-t", "pass" === s.st ? L("항복 가결", "Surrender passed") : "fail" === s.st ? L("항복 부결", "Surrender failed") : L("투표 종료", "Vote closed"));
      text("sv-sub", "pass" === s.st ? L("팀이 항복했습니다.", "Your team surrendered.") : "fail" === s.st ? L("과반이 찬성하지 않았습니다.", "Not enough votes in favour.") : "");
      text("sv-time", "");
      ui.shown = "res";
      clearTimeout(ui.t);
      ui.t = setTimeout(() => {
        "res" === ui.shown && ((sv.hidden = !0), (ui.shown = ""));
      }, 3500);
    }
  };
  function answer(yes) {
    if (ask) {
      hideVote();
      ui.shown = "";
      return void (yes && (isHost() ? request("me") : sendAction({ t: "sur" })));
    }
    if (!ui.vote || you >= 0) return;
    you = yes ? 1 : 0;
    $("sv-yes").disabled = $("sv-no").disabled = !0;
    $("sv-yes").classList.toggle("on", yes);
    $("sv-no").classList.toggle("on", !yes);
    isHost() ? cast("me", yes) : sendAction({ t: "surv", v: yes ? 1 : 0 });
  }
  $("sv-yes").onclick = () => answer(!0);
  $("sv-no").onclick = () => answer(!1);
  // the key that asks, and the two that answer while the box is open
  addEventListener(
    "keydown",
    (e) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing) return;
      if ("F8" === e.code || "F8" === e.key) {
        e.preventDefault();
        return void ui.open();
      }
      if (!sv.hidden && ("open" === ui.shown || "ask" === ui.shown) && ("KeyJ" === e.code || "KeyK" === e.code)) {
        e.preventDefault();
        e.stopPropagation();
        answer("KeyJ" === e.code);
      }
    },
    !0
  );
  // asked from the key or the pause menu: only in a room with other people, in a mode with two teams
  ui.can = () => {
    if (!running() || "solo" === NET.mode || !teamMode() || cfg().sRound <= 0) return !1;
    const a = myActor();
    return !!(a && ["buy", "live"].includes(world.phase));
  };
  ui.open = () => {
    if (!ui.can()) return running() && "solo" !== NET.mode && teamMode() ? refuse("phase") : void 0;
    if (ui.vote || ask) return;
    if (!modeOf().respawn && world.round < cfg().sRound) return refuse("early");
    ui.ask();
    const p = $("pause");
    p && !p.hidden && ((p.hidden = !0), "function" == typeof updateLockHint && updateLockHint());
  };
  // the guest's side of the events
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    if (e && "client" === NET.mode) {
      if ("sv" === e.t) return void ui.state(e);
      if ("sv-no" === e.t) return void refuse(e.why);
      if ("afk" === e.t) {
        afkUntil = performance.now() + 1000 * num(e.s, 30);
        out.hidden = !0;
        return;
      }
      if ("afk-ok" === e.t) return void ((afkUntil = 0), (afk.hidden = !0));
      if ("afk-out" === e.t) {
        afkUntil = 0;
        afk.hidden = !0;
        out.hidden = !1;
        return;
      }
    }
    return _oe.apply(this, arguments);
  };
  let afkUntil = 0,
    quitAsk = !1,
    quitT = 0;
  // any input of his own takes the warning away at once (the host clears its count when the next input arrives)
  const wake = () => {
    afkUntil && !afk.hidden && ((afkUntil = 0), (afk.hidden = !0));
  };
  for (const ev of ["keydown", "mousedown", "touchstart", "pointerdown"]) addEventListener(ev, wake, !0);
  let lastMove = 0;
  addEventListener("mousemove", (e) => {
    if (afkUntil && performance.now() - lastMove > 120 && (Math.abs(e.movementX) + Math.abs(e.movementY) > 0 || !document.pointerLockElement)) ((lastMove = performance.now()), wake());
  }, !0);
  $("afk-back").onclick = () => {
    try {
      const a = myActor();
      sendAction({ t: "hello", name: "function" == typeof myName ? myName() : "", actorId: a ? a.id : null, prev: NET.peer && NET.peer.id });
    } catch (e) {}
    out.hidden = !0;
  };
  $("afk-quit").onclick = () => {
    out.hidden = !0;
    const q = $("pz-quit");
    // he has been told already: no second question
    q && ((quitAsk = !0), q.click());
  };

  // ── the pause menu: a surrender button, and a warning before leaving a ranked match ──
  const btns = document.querySelector("#pause .pz-btns"),
    quit = $("pz-quit");
  let surB = null;
  if (btns) {
    surB = document.createElement("button");
    surB.className = "btn";
    surB.id = "pz-surrender";
    quit ? btns.insertBefore(surB, quit) : btns.appendChild(surB);
    surB.onclick = () => ui.open();
  }
  function paintPause() {
    const p = $("pause");
    if (!p || p.hidden) return;
    const C = cfg();
    if (surB) {
      const show = running() && "solo" !== NET.mode && teamMode() && C.sRound > 0,
        early = !modeOf().respawn && world.round < C.sRound;
      surB.style.display = show ? "" : "none";
      surB.disabled = !ui.can() || early || !!(ui.vote || ask);
      surB.innerHTML = `${L("항복 투표", "Surrender")}<small>${early ? L(`${C.sRound}라운드부터`, `from round ${C.sRound}`) : "F8"}</small>`;
    }
    if (quit) {
      const rk = room.ranked && "solo" !== NET.mode && running() && !quitAsk;
      quit.textContent = quitAsk ? L("정말 나갈까요? 패배 처리", "Leave? Counts as a loss") : L("나가기", "Leave");
      quit.title = rk ? L("랭크전 도중에 나가면 패배로 처리됩니다", "Leaving a ranked match counts as a loss") : "";
    }
  }
  // leaving a ranked match asks once more
  if (quit) {
    quit.addEventListener(
      "click",
      (e) => {
        if (!room.ranked || "solo" === NET.mode || !running()) return;
        if (quitAsk) return void ((quitAsk = !1), clearTimeout(quitT));
        e.stopImmediatePropagation();
        e.preventDefault();
        quitAsk = !0;
        paintPause();
        clearTimeout(quitT);
        quitT = setTimeout(() => ((quitAsk = !1), paintPause()), 4000);
      },
      !0
    );
  }

  // ── the clock ──
  setInterval(() => {
    try {
      const now = performance.now();
      if (isHost()) {
        afkTick(now);
        trackLeave();
        SV && (running() ? evaluate() : end(null));
      }
      if (!running() || "solo" === NET.mode) {
        sv.hidden || "res" === ui.shown || hideVote();
        afk.hidden = out.hidden = !0;
        afkUntil = 0;
        ui.vote = null;
      }
      // the vote box counts down
      if (!sv.hidden && ("open" === ui.shown || "ask" === ui.shown)) {
        const left = Math.max(0, deadline - now);
        text("sv-time", String(Math.ceil(left / 1000)));
        $("sv-bar").style.transform = `scaleX(${Math.min(1, left / total)})`;
        "ask" === ui.shown && left <= 0 && (hideVote(), (ui.shown = ""));
        "open" === ui.shown && left <= 0 && !isHost() && (hideVote(), (ui.shown = ""));
      }
      // the warning counts down
      if (afkUntil) {
        const left = Math.max(0, Math.ceil((afkUntil - now) / 1000));
        afk.hidden = !1;
        text("afk-s", String(left));
        left <= 0 && ((afk.hidden = !0), (afkUntil = 0));
      } else afk.hidden = !0;
      paintPause();
    } catch (e) {}
  }, 250);
  const _sd = netShutdown;
  netShutdown = function () {
    SV = null;
    AFK.clear();
    LV.g.clear();
    LV.afk.clear();
    LV.rec = null;
    hideVote();
    ui.shown = "";
    afk.hidden = out.hidden = !0;
    afkUntil = 0;
    return _sd.apply(this, arguments);
  };
  window.RANKED_AWAY = { cfg, tally: () => (SV ? tally() : null), vote: () => SV, afk: AFK, request, cast, handOver, whyNot: (a) => whyNot(a || myActor()) };
})();
