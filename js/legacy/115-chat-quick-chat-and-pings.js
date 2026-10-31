(() => {
  // Chat, quick chat and pings.
  //  - Text chat (all / team) in a match and in the room lobby: a log that fades after 8 s, a box (Enter = team, Shift+Enter
  //    = all) that shows the recent history, names coloured by team, a click or tap on a name mutes that player.
  //  - Quick chat: ten fixed phrases (Z, then a number key; Shift+number = all; also chips in the box). A phrase travels as
  //    its number, so every player reads it in their own language.
  //  - Pings: V (or the touch button, or a click on the minimap / the M map) marks a point for the team for 4 s: a sprite
  //    in the world, a ring on the minimap and the M map, a sound.
  //  Network: a guest sends {t:"chat"} / {t:"mark"} (a ping; "ping" is the latency probe) on the reliable event link; the host checks it (80 characters, no
  //  control characters, 3 messages per 5 s, 1 ping per second, swear words become ***), then relays it: all chat to
  //  everyone, team chat and pings only to the peers whose body is on the sender's team (in a free-for-all the team is
  //  one player, so a team message comes back to the sender alone). The host's own messages and solo play take the same
  //  road locally. An older game ignores the two new message types. The owner can switch it all off (game.chat).
  if ("undefined" == typeof NET || "undefined" == typeof world || "undefined" == typeof room || "function" != typeof NET.onAction) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const MAX_LEN = 80,
    FADE_MS = 8000,
    KEEP = 60,
    PING_MS = 4000,
    MAX_PINGS = 8,
    LOCAL = "\0local";
  // a token bucket per peer and kind, in the style of the host's other throttles: 3 messages per 5 s, 1 ping per second
  const RATE = { chat: { cap: 3, every: 5000 / 3 }, ping: { cap: 1, every: 1000 } },
    BUCKET = new Map();
  function take(key, kind, now) {
    const r = RATE[kind];
    now = null == now ? Date.now() : now;
    let by = BUCKET.get(key);
    by || BUCKET.set(key, (by = {}));
    const s = by[kind] || (by[kind] = { tokens: r.cap, at: now });
    s.tokens = Math.min(r.cap, s.tokens + Math.max(0, now - s.at) / r.every);
    s.at = now;
    if (s.tokens < 1) return !1;
    s.tokens -= 1;
    BUCKET.size > 64 && prune();
    return !0;
  }
  function prune() {
    for (const k of [...BUCKET.keys()]) k === LOCAL || (NET.conns && NET.conns.has(k)) || BUCKET.delete(k);
  }

  // ── what is said ──
  // control characters out (a line break or tab becomes a space), spaces folded, trimmed, cut to 80 characters
  const CTRL = new RegExp("[" + [[0, 8], [11, 31], [127, 159], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff]].map((r) => String.fromCharCode(r[0]) + "-" + String.fromCharCode(r[1])).join("") + "]", "g"),
    BREAKS = new RegExp("[\\t\\n\\r" + String.fromCharCode(0x2028, 0x2029) + "]", "g");
  function clean(s) {
    if ("string" != typeof s) return "";
    s = s.slice(0, 600).replace(BREAKS, " ").replace(CTRL, "").replace(/ {2,}/g, " ").trim();
    return Array.from(s).slice(0, MAX_LEN).join("").trim();
  }
  // swear words become *** (js/word-filter.js, the same filter the server holds clan names to)
  const mask = (s) => (window.WORD_FILTER ? WORD_FILTER.mask(s) : String(s));

  // ten fixed phrases: [Korean, English]. The number travels, so everyone reads it in their own language.
  const QUICK = [
    ["좋아요", "Nice"],
    ["고마워요", "Thanks"],
    ["도와주세요", "Need help"],
    ["A로 가요", "Go A"],
    ["B로 가요", "Go B"],
    ["후퇴해요", "Fall back"],
    ["적 발견", "Enemy spotted"],
    ["스파이크 설치", "Plant the spike"],
    ["다시 모여요", "Regroup"],
    ["GG", "GG"],
  ];
  const phrase = (q) => (QUICK[q] ? QUICK[q][EN ? 1 : 0] : "");

  // ── the owner's switch: game.chat (on unless it is exactly false) ──
  const on = () => {
    const c = window.SERVER_CFG;
    return !(c && c.game && !1 === c.game.chat);
  };

  // ── where we are ──
  const lobbyUp = () => {
      const l = $("lobby");
      return !!l && !l.hidden;
    },
    live = () => !!(world.actors && world.actors.length && "menu" !== world.phase && !lobbyUp()),
    here = () => lobbyUp() || live(),
    ffa = () => {
      try {
        const m = window.GAME_MODES && GAME_MODES[room.mode];
        return !!(live() && m && m.ffa);
      } catch (e) {
        return !1;
      }
    },
    // the pause menu and the owner's panel take the keys; the shop does not use Enter, V or Z, so it can stay open under the chat
    modal = () => ["pause", "admin"].some((id) => $(id) && !$(id).hidden),
    shopUp = () => !!($("shop") && !$("shop").hidden),
    myKey = () => ("client" === NET.mode ? NET.peer && NET.peer.id : NET.id) || "me";
  let soloName = null;
  const ownName = () => soloName || (soloName = myName());
  const baseTeam = (a) => {
    const t = a && (a._baseTeam || a.team);
    return "atk" === t || "def" === t ? t : "";
  };
  // who a peer is (null = this machine): name, the team key used for routing, the colour, and the body when there is one
  function ident(peer) {
    const self = null === peer,
      pid = self ? NET.id : peer,
      a = live() ? world.actors.find((x) => (self ? "me" === x.ctrl : x.ctrl === pid)) : null,
      m = pid ? room.members.get(pid) : null;
    if (!a && !m) return null;
    return {
      key: self ? myKey() : peer,
      name: String((a && a.name) || (m && m.name) || (self ? ownName() : "플레이어")).slice(0, 16),
      team: String(a ? a.team : m.team),
      color: a ? baseTeam(a) : m.team,
      alive: !a || !1 !== a.alive,
      actor: a,
    };
  }

  // ── the log, the box and the menus ──
  const S = { open: !1, qm: !1, scope: "t", hist: [], pings: new Map(), muted: new Map(), map: !1, raf: 0 };
  const stats = { shown: 0, pingSounds: 0, dropped: 0 };
  // muted players are kept by name for the session: a player who redials gets a new peer id, but not a new name
  try {
    for (const k of JSON.parse(sessionStorage.getItem("dfdf_chat_mute") || "[]")) "string" == typeof k && S.muted.set(k.slice(0, 16), 1);
  } catch (e) {}
  const keepMutes = () => {
    try {
      sessionStorage.setItem("dfdf_chat_mute", JSON.stringify([...S.muted.keys()]));
    } catch (e) {}
  };
  const css = document.createElement("style");
  css.id = "cht-css";
  css.textContent = `
#cht{position:fixed;left:22px;bottom:128px;z-index:14;width:min(400px,44vw);display:flex;flex-direction:column;gap:6px;pointer-events:none;font:500 13px/1.45 'Noto Sans KR',system-ui,sans-serif;color:#e8edf4}
#cht[hidden],#cht-box[hidden],#cht-qm[hidden],#cht-fab[hidden]{display:none!important}
#cht.top{z-index:61}
body.cht-off #cht,body.cht-off #cht-fab,body.cht-off #cht-qm,body.cht-off #tb-chat,body.cht-off #tb-ping{display:none!important}
body.cht-ffa #tb-ping{display:none}
#cht-log{display:flex;flex-direction:column;justify-content:flex-end;gap:3px;max-height:150px;overflow:hidden}
#cht.open #cht-log{max-height:min(230px,34vh);overflow-y:auto;justify-content:flex-start;pointer-events:auto;scrollbar-width:thin}
#cht.open #cht-log::before{content:'';flex:1 1 auto}
.cht-m{flex:none;align-self:flex-start;max-width:100%;padding:3px 9px;border-radius:8px;background:rgba(8,11,16,.7);text-shadow:0 1px 3px rgba(0,0,0,.9);overflow-wrap:anywhere;opacity:1;transition:opacity .6s}
.cht-m .tg{display:inline-block;margin-right:5px;padding:0 5px;border-radius:5px;font-size:10.5px;font-weight:800;letter-spacing:.04em;background:rgba(255,255,255,.12);color:#c9d2de}
.cht-m .tg.t{background:rgba(74,222,128,.2);color:#8ff0b2}
.cht-m .n{font-weight:800}
.cht-m .n.atk{color:var(--atk,#ff6b4a)}.cht-m .n.def{color:var(--def,#38bdf8)}.cht-m .n.none{color:#c9d2de}
#cht.open .cht-m .n{pointer-events:auto;cursor:pointer;text-decoration:underline dotted rgba(255,255,255,.35);text-underline-offset:3px}
.cht-m.q .x{color:#ffe08a}
.cht-m.sys{color:#8a97ab;font-size:12px;background:rgba(8,11,16,.5)}
#cht:not(.open) .cht-m.fade{opacity:0}
#cht:not(.open) .cht-m.gone{display:none}
#cht-box{pointer-events:auto;display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:12px;background:rgba(10,13,18,.92);border:1px solid var(--line,#2a3444);box-shadow:0 12px 32px -12px #000}
#cht-box .top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cht-tabs{display:flex;gap:4px}
.cht-tabs button,#cht-x,#cht-send,#cht-qc button,#cht-mutes button,#cht-fab{font:700 12px/1 'Noto Sans KR',system-ui,sans-serif;color:#e8edf4;border:1px solid var(--stroke2,rgba(255,255,255,.13));background:rgba(255,255,255,.06);border-radius:9px;padding:7px 11px;cursor:pointer}
.cht-tabs button.on{background:rgba(255,200,73,.2);border-color:rgba(255,200,73,.6);color:#ffe08a}
body.cht-ffa .cht-tabs button[data-s=t]{display:none}
#cht-x{margin-left:auto;padding:7px 10px}
#cht-mutes{display:flex;gap:4px;flex-wrap:wrap}
#cht-mutes button{padding:5px 8px;font-size:11px;color:#ff9aa4;border-color:rgba(255,90,105,.4)}
#cht-qc{display:flex;flex-wrap:wrap;gap:4px}
#cht-qc button{padding:6px 9px;font-weight:600}
#cht-qc button:hover,.cht-tabs button:hover,#cht-x:hover,#cht-send:hover{background:rgba(255,255,255,.14)}
#cht-form{display:flex;gap:6px;margin:0}
#cht-in{flex:1 1 auto;min-width:0;padding:9px 11px;border-radius:9px;border:1px solid var(--stroke2,rgba(255,255,255,.13));background:rgba(0,0,0,.4);color:#e8edf4;font:500 14px 'Noto Sans KR',system-ui,sans-serif;outline:0}
#cht-in:focus{border-color:var(--cyan,#22d3ee)}
#cht-send{background:linear-gradient(180deg,#ff5b6b,#e0303f);border-color:rgba(255,110,122,.5)}
#cht-qm{position:fixed;left:22px;bottom:128px;z-index:62;min-width:190px;padding:10px 12px;border-radius:12px;background:rgba(10,13,18,.92);border:1px solid var(--line,#2a3444);color:#e8edf4;font:500 13px/1.7 'Noto Sans KR',system-ui,sans-serif;box-shadow:0 12px 32px -12px #000}
#cht-qm b{display:block;font-size:11px;letter-spacing:.14em;color:#8a97ab;margin-bottom:2px}
#cht-qm div{display:flex;gap:8px;cursor:pointer}#cht-qm div:hover{color:#ffe08a}
#cht-qm kbd{display:inline-block;min-width:18px;text-align:center;border-radius:5px;background:rgba(255,255,255,.12);font:700 11px/18px system-ui}
#cht-qm small{display:block;margin-top:4px;color:#5b6879;font-size:10.5px}
#cht-fab{position:fixed;left:16px;bottom:16px;z-index:61;padding:10px 14px;background:rgba(14,19,27,.9)}
#cht-fab kbd{margin-left:6px;font:700 10px system-ui;color:#8a97ab}
body.cht-lobby #cht{bottom:64px;left:16px}
body.touching #cht-fab kbd{display:none}
body.cht-buy:not(.touching) #cht{bottom:254px}
body.cht-typing #mini{pointer-events:auto;cursor:crosshair}
.cht-tb{position:absolute;width:calc(46px*var(--mbs,1));height:calc(46px*var(--mbs,1));border-radius:50%;pointer-events:auto;display:grid;place-items:center;background:rgba(14,19,27,.62);border:1.5px solid rgba(255,255,255,.22);color:#e8edf4;font:700 calc(10.5px*var(--mbs,1))/1 'Noto Sans KR',system-ui,sans-serif;backdrop-filter:blur(6px);touch-action:none;padding:0}
#tb-ping{border-color:rgba(255,200,73,.7);color:#ffe08a;background:rgba(255,200,73,.16)}
/* under the minimap, left of the layout editor's bar, so both can be picked up there */
#tb-chat{left:calc(10px + env(safe-area-inset-left));top:106px}
#tb-ping{left:calc(62px + env(safe-area-inset-left));top:106px}
body.touching #cht{left:10px;bottom:auto;top:158px;width:160px}
body.touching #cht-log{max-height:46px}
body.touching.cht-lobby #cht{top:auto;bottom:62px}
body.touching #cht.open{top:6px;bottom:auto;left:112px;width:calc(100vw - 124px);flex-direction:column-reverse}
body.touching #cht.open #cht-log{max-height:min(70px,20vh)}
body.touching #cht-qm{left:112px;bottom:auto;top:6px}
#bigmap .bm-card{position:relative}
#cht-bmp{position:absolute;cursor:crosshair;touch-action:manipulation}
#cht-bmp i{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#ffc849;border:2px solid #0a0d12;box-shadow:0 0 0 0 rgba(255,200,73,.7);animation:chtPulse .9s ease-out infinite;pointer-events:none}
@keyframes chtPulse{to{box-shadow:0 0 0 22px rgba(255,200,73,0)}}
@media (max-height:480px){#cht,body.cht-buy:not(.touching) #cht{bottom:10px}#cht-qm{bottom:10px}#cht.open #cht-log{max-height:min(110px,24vh)}#cht-box{padding:6px;gap:5px}#cht-qc button{padding:5px 7px;font-size:11px}#cht-in{padding:7px 9px}.cht-m{font-size:12px}#cht-qm{line-height:1.5;padding:7px 10px}}
`;
  document.head.appendChild(css);
  const root = document.createElement("div");
  root.id = "cht";
  root.hidden = !0;
  root.innerHTML = `<div id="cht-log" aria-live="polite"></div>
<div id="cht-box" hidden><div class="top"><div class="cht-tabs"><button type="button" data-s="t"></button><button type="button" data-s="a"></button></div><span id="cht-mutes"></span><button type="button" id="cht-x"></button></div>
<div id="cht-qc"></div>
<form id="cht-form" autocomplete="off"><input id="cht-in" maxlength="${MAX_LEN}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send"><button type="submit" id="cht-send"></button></form></div>`;
  document.body.appendChild(root);
  const log = $("cht-log"),
    box = $("cht-box"),
    input = $("cht-in"),
    qc = $("cht-qc");
  const tabs = {
    t: box.querySelector('[data-s="t"]'),
    a: box.querySelector('[data-s="a"]'),
  };
  tabs.t.textContent = L("팀", "Team");
  tabs.a.textContent = L("전체", "All");
  $("cht-x").textContent = L("닫기", "Close");
  $("cht-x").setAttribute("aria-label", L("채팅 닫기", "Close chat"));
  $("cht-send").textContent = L("보내기", "Send");
  const qm = document.createElement("div");
  qm.id = "cht-qm";
  qm.hidden = !0;
  qm.innerHTML = `<b>${L("빠른 말하기", "QUICK CHAT")}</b>` + QUICK.map((p, i) => `<div data-q="${i}"><kbd>${(i + 1) % 10}</kbd><span></span></div>`).join("") + `<small>${L("번호 키 · Shift+번호는 전체", "Number key · Shift+number: all")}</small>`;
  document.body.appendChild(qm);
  qm.querySelectorAll("[data-q] span").forEach((s, i) => (s.textContent = phrase(i)));
  QUICK.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.q = i;
    b.textContent = phrase(i);
    qc.appendChild(b);
  });
  const fab = document.createElement("button");
  fab.type = "button";
  fab.id = "cht-fab";
  fab.hidden = !0;
  fab.innerHTML = `<span></span><kbd>Enter</kbd>`;
  fab.firstChild.textContent = L("채팅", "Chat");
  document.body.appendChild(fab);
  for (const el of [box, log, qm, fab]) {
    // a click on the chat must not reach the game (it would take the mouse lock back and close the box)
    for (const ev of ["mousedown", "pointerdown", "touchstart"]) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: !0 });
  }

  input.setAttribute("aria-label", L("채팅 입력", "Chat message"));
  const setScope = (s) => {
    S.scope = "a" === s || ffa() ? "a" : "t";
    tabs.t.classList.toggle("on", "t" === S.scope);
    tabs.a.classList.toggle("on", "a" === S.scope);
    input.placeholder = "t" === S.scope ? L("팀에게 · Enter 보내기 · Esc 닫기", "To your team · Enter to send · Esc to close") : L("모두에게 · Enter 보내기 · Esc 닫기", "To everyone · Enter to send · Esc to close");
  };
  setScope("t");
  const scrollLog = () => (log.scrollTop = log.scrollHeight);

  function line(m) {
    const d = document.createElement("div");
    d.className = "cht-m";
    if (m.sys) {
      d.classList.add("sys");
      d.textContent = "join" === m.sys ? L(`${m.n} 님이 입장했습니다`, `${m.n} joined`) : "leave" === m.sys ? L(`${m.n} 님이 나갔습니다`, `${m.n} left`) : String(m.m || "");
    } else {
      const tg = document.createElement("span");
      tg.className = "tg " + m.s;
      tg.textContent = "t" === m.s ? L("팀", "Team") : L("전체", "All");
      const n = document.createElement("span");
      n.className = "n " + (m.tm || "none");
      n.textContent = m.n;
      n.title = m.id === myKey() ? "" : L("눌러서 음소거", "Click to mute");
      n.dataset.id = m.id;
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = " " + (m.q >= 0 ? "⚡ " + phrase(m.q) : m.m);
      d.append(tg, n, ": ", x);
      m.q >= 0 && d.classList.add("q");
    }
    setTimeout(() => d.classList.add("fade"), FADE_MS);
    setTimeout(() => d.classList.add("gone"), FADE_MS + 800);
    return d;
  }
  function show(m) {
    if (!m.sys && m.id !== myKey() && S.muted.has(m.n)) return void stats.dropped++;
    S.hist.push(m);
    S.hist.length > KEEP && S.hist.shift();
    log.appendChild(line(m));
    while (log.children.length > KEEP) log.firstChild.remove();
    stats.shown++;
    S.open && scrollLog();
  }
  function paintMutes() {
    const el = $("cht-mutes");
    el.textContent = "";
    for (const n of S.muted.keys()) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.n = n;
      b.textContent = L(`${n} 음소거 해제`, `Unmute ${n}`);
      el.appendChild(b);
    }
  }
  function toggleMute(name, id) {
    name = String(name || "").slice(0, 16);
    const me = ident(null);
    if (!name || id === myKey() || name === ((me && me.name) || ownName())) return;
    const was = S.muted.has(name);
    was ? S.muted.delete(name) : S.muted.set(name, 1);
    keepMutes();
    paintMutes();
    show({ sys: "note", m: was ? L(`${name} 님의 음소거를 풀었습니다`, `Unmuted ${name}`) : L(`${name} 님을 음소거했습니다`, `Muted ${name}`) });
  }
  log.addEventListener("click", (e) => {
    const n = e.target.closest && e.target.closest(".n");
    n && toggleMute(n.textContent, n.dataset.id);
  });
  $("cht-mutes").addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("button");
    b && toggleMute(b.dataset.n);
  });

  // ── sending ──
  const note = (m) => show({ sys: "note", m });
  // what the sender is told when the host (or this machine) turns a message down
  const tooFast = () => note(L("채팅이 너무 빠릅니다. 잠시 후에 보내 주세요", "You are sending messages too fast"));
  // the host's side: check, mask, route. peer = a guest's peer id, null = this machine. Returns what happened.
  function hostChat(peer, msg) {
    if (!on()) return "off";
    if (!msg || "object" != typeof msg) return "bad";
    const who = ident(peer);
    if (!who) return "nobody";
    let text = null,
      q = -1;
    if (Number.isInteger(msg.q)) {
      if (msg.q < 0 || msg.q >= QUICK.length) return "bad";
      q = msg.q;
    } else {
      text = clean(msg.m);
      if (!text) return "empty";
    }
    if (!take(who.key, "chat")) return "rate";
    const out = { t: "chat", id: who.key, n: who.name, tm: who.color, s: "t" === msg.s ? "t" : "a" };
    q >= 0 ? (out.q = q) : (out.m = mask(text));
    if ("a" === out.s) {
      sendEventAll(out);
      show(out);
    } else {
      if ("host" === NET.mode)
        for (const [p, c] of NET.conns) {
          if (c.quiet) continue;
          const w = ident(p);
          w && w.team === who.team && sendEventTo(p, out);
        }
      const me = ident(null);
      me && me.team === who.team && show(out);
    }
    return "ok";
  }
  // what a message arriving from the host may hold: checked again here, never trusted as markup (it is only ever text)
  function recvChat(e) {
    if (!on() || !here()) return;
    const n = clean(e.n).slice(0, 16);
    if ("string" == typeof e.sys) {
      return void (n && ("join" === e.sys || "leave" === e.sys) && show({ sys: e.sys, n }));
    }
    const m = { id: String(e.id || "").slice(0, 64), n: n || "?", tm: "atk" === e.tm || "def" === e.tm ? e.tm : "", s: "t" === e.s ? "t" : "a", q: -1 };
    if (Number.isInteger(e.q) && e.q >= 0 && e.q < QUICK.length) m.q = e.q;
    else {
      m.m = mask(clean(e.m));
      if (!m.m) return;
    }
    show(m);
  }
  function post(scope, text, q) {
    if (!on() || !here()) return "off";
    ffa() && (scope = "a");
    const msg = { t: "chat", s: scope };
    q >= 0 ? (msg.q = q) : (msg.m = text);
    if ("client" === NET.mode) {
      if (!take(LOCAL, "chat")) return void tooFast(), "rate";
      sendAction(msg);
      return "ok";
    }
    const r = hostChat(null, msg);
    "rate" === r && tooFast();
    return r;
  }
  function submit() {
    const t = clean(input.value);
    if (t) {
      post(S.scope, t, -1);
      input.value = "";
    }
    close(!0);
  }
  function quick(q, scope) {
    post(scope || S.scope, "", q);
  }
  // the host's other tasks: a guest joining or leaving the lobby is a line for everyone
  function sys(kind, name) {
    const e = { t: "chat", sys: kind, n: String(name).slice(0, 16) };
    sendEventAll(e);
    show(e);
  }

  // ── opening and closing the box ──
  const editable = (t) => !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)));
  function releaseKeys() {
    try {
      for (const k of Object.keys(keys)) keys[k] = !1;
      keys.space = !1;
      "undefined" != typeof player && player && (player.ads = !1);
      "function" == typeof resetTouchInput && resetTouchInput();
      window.KEY_GUARD && KEY_GUARD.letGo && KEY_GUARD.letGo();
    } catch (e) {}
  }
  const held = () => S.open || S.map;
  function open(scope) {
    if (!on() || !here()) return !1;
    if (S.open) {
      scope && setScope(scope);
      !IS_TOUCH && input.focus({ preventScroll: !0 });
      return !0;
    }
    if (live() && modal()) return !1;
    S.open = !0;
    S.lob = lobbyUp();
    qmClose();
    setScope(scope || "t");
    root.classList.add("open");
    root.classList.add("top");
    box.hidden = !1;
    document.body.classList.add("cht-typing");
    paintMutes();
    if (live()) {
      releaseKeys();
      try {
        document.pointerLockElement && document.exitPointerLock();
      } catch (e) {}
      "function" == typeof updateLockHint && updateLockHint();
    }
    scrollLog();
    !IS_TOUCH && input.focus({ preventScroll: !0 });
    return !0;
  }
  function close(relock) {
    if (!S.open) return;
    S.open = !1;
    box.hidden = !0;
    root.classList.remove("open");
    lobbyUp() || root.classList.remove("top");
    document.body.classList.remove("cht-typing");
    input.blur();
    "function" == typeof updateLockHint && updateLockHint();
    if (relock && live() && !IS_TOUCH && !modal() && !shopUp() && !S.map && "function" == typeof tryLock) {
      lockCooldown = 0;
      tryLock();
    }
  }
  function qmOpen() {
    if (!on() || !live() || S.open || modal()) return;
    S.qm = !0;
    qm.hidden = !1;
    clearTimeout(S.qmT);
    S.qmT = setTimeout(qmClose, 6000);
  }
  function qmClose() {
    S.qm = !1;
    qm.hidden = !0;
    clearTimeout(S.qmT);
  }
  // the game must not see a key while one of our boxes has it
  const KEYS_DIGIT = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8, Digit0: 9 };
  function onKey(e) {
    const typing = e.target === input || document.activeElement === input;
    if (typing) {
      e.stopImmediatePropagation();
      if ("keydown" !== e.type) return;
      if ("Enter" === e.key) {
        // Enter that ends a Hangul composition only commits the syllable
        e.isComposing || 229 === e.keyCode || (e.preventDefault(), submit());
      } else if ("Escape" === e.key) (e.preventDefault(), close(!0));
      else if ("Tab" === e.key) (e.preventDefault(), setScope("t" === S.scope ? "a" : "t"));
      return;
    }
    if ("keydown" !== e.type) return;
    if (S.open) {
      "Escape" === e.key && (e.preventDefault(), e.stopImmediatePropagation(), close(!0));
      return;
    }
    if (S.qm) {
      const q = KEYS_DIGIT[e.code];
      if (void 0 !== q) {
        e.preventDefault();
        e.stopImmediatePropagation();
        qmClose();
        quick(q, e.shiftKey || ffa() ? "a" : "t");
      } else if ("Escape" === e.key || KEYMAP.is(e, "quickchat")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        qmClose();
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || editable(e.target) || !on() || !here()) return;
    if ("Enter" === e.key) {
      if (open(e.shiftKey ? "a" : "t")) (e.preventDefault(), e.stopImmediatePropagation());
    } else if (KEYMAP.is(e, "quickchat") && live() && !modal()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      qmOpen();
    } else if (KEYMAP.is(e, "ping") && live() && !modal() && (locked || IS_TOUCH)) {
      e.stopImmediatePropagation();
      ping();
    }
  }
  for (const ev of ["keydown", "keyup", "keypress"]) addEventListener(ev, onKey, !0);
  input.addEventListener("focus", () => document.body.classList.add("cht-typing"));
  $("cht-form").addEventListener("submit", (e) => (e.preventDefault(), submit()));
  $("cht-x").addEventListener("click", () => close(!0));
  fab.addEventListener("click", () => (S.open ? close(!1) : open("t")));
  for (const b of tabs.t.parentNode.children) b.addEventListener("click", () => (setScope(b.dataset.s), !IS_TOUCH && input.focus({ preventScroll: !0 })));
  qc.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("button");
    if (!b) return;
    quick(+b.dataset.q, S.scope);
    close(!0);
  });
  qm.addEventListener("click", (e) => {
    const d = e.target.closest && e.target.closest("[data-q]");
    d && (qmClose(), quick(+d.dataset.q, "t"));
  });
  // closing leaves the mouse free; a click on the game takes the lock again, and that closes the box
  document.addEventListener("pointerlockchange", () => document.pointerLockElement && S.open && live() && close(!1));
  // the engine opens the pause menu when the lock is lost with no menu up: not while we hold the mouse on purpose
  if ("function" == typeof togglePause) {
    const _tp = togglePause;
    togglePause = function (e) {
      return !0 === e && held() ? void 0 : _tp.apply(this, arguments);
    };
  }
  // and its "click to lock" cover stays away while the box is open
  if ("function" == typeof updateLockHint) {
    const _ul = updateLockHint;
    updateLockHint = function () {
      const r = _ul.apply(this, arguments);
      if (held()) {
        const h = $("lockhint");
        h && (h.hidden = !0);
      }
      return r;
    };
  }

  // ── pings ──
  const aimO = new THREE.Vector3(),
    aimD = new THREE.Vector3();
  // the point under the crosshair, from the engine's own wall ray (walls and the floor)
  function aimPoint() {
    if ("function" != typeof window.WALL_T || "undefined" == typeof camera) return null;
    camera.getWorldDirection(aimD);
    aimO.copy(camera.position);
    const far = 220,
      t = window.WALL_T(aimO.x, aimO.y, aimO.z, aimD.x, aimD.y, aimD.z, far);
    if (!(t < far - 0.05)) return null;
    const b = Math.max(0, t - 0.25);
    return { x: aimO.x + aimD.x * b, y: aimO.y + aimD.y * b, z: aimO.z + aimD.z * b };
  }
  // the ground under an x,z on the map (a click on the map): the highest thing a ray from above meets
  function groundAt(x, z) {
    if ("function" != typeof window.WALL_T) return 0;
    const t = window.WALL_T(x, 90, z, 0, -1, 0, 140);
    return t < 140 ? 90 - t : 0;
  }
  const r1 = (v) => Math.round(10 * v) / 10,
    mapBounds = () => ("undefined" != typeof MAP && MAP && MAP.bounds) || null;
  const num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
  function inMap(x, y, z) {
    const b = mapBounds();
    return num(x, (b ? b.minX : -400) - 40, (b ? b.maxX : 400) + 40) && num(z, (b ? b.minZ : -400) - 40, (b ? b.maxZ : 400) + 40) && num(y, -30, 150);
  }
  function hostPing(peer, msg) {
    if (!on()) return "off";
    if (!msg || "object" != typeof msg) return "bad";
    const who = ident(peer);
    if (!who || !live() || ffa()) return "nobody";
    if (!who.alive) return "dead";
    if (!inMap(msg.x, msg.y, msg.z)) return "bad";
    if (!take(who.key, "ping")) return "rate";
    const out = { t: "mark", id: who.key, n: who.name, tm: who.color, x: r1(msg.x), y: r1(msg.y), z: r1(msg.z) };
    if ("host" === NET.mode)
      for (const [p, c] of NET.conns) {
        if (c.quiet || p === peer) continue;
        const w = ident(p);
        w && w.team === who.team && sendEventTo(p, out);
      }
    // the sender sees its own at once; the host is a teammate like any other
    if (null === peer) addPing(out);
    else {
      const me = ident(null);
      me && me.team === who.team && addPing(out);
    }
    return "ok";
  }
  // what the player does: from the crosshair (or a given point, from the map)
  function ping(pt) {
    if (!on() || !live()) return !1;
    if (ffa()) return note(L("개인전에서는 핑을 쓸 수 없습니다", "Pings are off in free-for-all")), !1;
    const me = ("function" == typeof myActor && myActor()) || player;
    if (!me || !1 === me.alive) return !1;
    pt = pt || aimPoint();
    if (!pt || !inMap(pt.x, pt.y, pt.z)) return !1;
    const msg = { t: "mark", x: r1(pt.x), y: r1(pt.y), z: r1(pt.z) };
    if ("client" === NET.mode) {
      if (!take(LOCAL, "ping")) return !1;
      sendAction(msg);
      const a = ident(null);
      addPing(Object.assign({ id: myKey(), n: (a && a.name) || ownName(), tm: baseTeam(me) }, msg));
      return !0;
    }
    return "ok" === hostPing(null, msg);
  }
  function blip() {
    stats.pingSounds++;
    try {
      if ("object" == typeof SETTINGS && SETTINGS && !SETTINGS.sfx) return;
      const ac = window.GAME_AUDIO && GAME_AUDIO.context && GAME_AUDIO.context();
      if (!ac) return;
      "suspended" === ac.state && ac.resume();
      const o = ac.createOscillator(),
        g = ac.createGain(),
        t = ac.currentTime;
      o.type = "sine";
      o.frequency.setValueAtTime(740, t);
      o.frequency.exponentialRampToValueAtTime(1480, t + 0.09);
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 0.26);
      o.connect(g);
      g.connect(GAME_AUDIO.output); // the effects bus, so the volume sliders reach it
      o.start(t);
      o.stop(t + 0.3);
    } catch (e) {}
  }
  // the sprite: a gold pin with the sender's name and the distance above it, seen through walls, the same size on any screen
  function paintPin(p, dist) {
    const g = p.cv.getContext("2d");
    g.clearRect(0, 0, 192, 224);
    const label = p.n + " · " + dist + "m";
    g.font = "700 25px 'Noto Sans KR',system-ui,sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const w = Math.min(188, g.measureText(label).width + 22);
    g.fillStyle = "rgba(8,11,16,.82)";
    g.beginPath();
    g.roundRect ? g.roundRect(96 - w / 2, 4, w, 38, 10) : g.rect(96 - w / 2, 4, w, 38);
    g.fill();
    g.fillStyle = "atk" === p.tm ? "#ff8a6e" : "def" === p.tm ? "#6fcdfa" : "#e8edf4";
    g.fillText(label, 96, 24, 176);
    g.beginPath();
    g.moveTo(96, 222);
    g.bezierCurveTo(56, 168, 58, 150, 58, 128);
    g.arc(96, 118, 38, Math.PI, 0);
    g.bezierCurveTo(134, 150, 136, 168, 96, 222);
    g.closePath();
    g.fillStyle = "#ffc849";
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = "#0a0d12";
    g.stroke();
    g.beginPath();
    g.arc(96, 118, 14, 0, 7);
    g.fillStyle = "#0a0d12";
    g.fill();
    p.tex.needsUpdate = !0;
    p.dist = dist;
  }
  function makeSprite(p) {
    if ("undefined" == typeof scene || "undefined" == typeof THREE) return;
    p.cv = document.createElement("canvas");
    p.cv.width = 192;
    p.cv.height = 224;
    p.tex = new THREE.CanvasTexture(p.cv);
    THREE.SRGBColorSpace && (p.tex.colorSpace = THREE.SRGBColorSpace);
    p.mat = new THREE.SpriteMaterial({ map: p.tex, transparent: !0, depthTest: !1, depthWrite: !1, sizeAttenuation: !1, fog: !1 });
    p.sp = new THREE.Sprite(p.mat);
    p.sp.center.set(0.5, 0.02);
    p.sp.renderOrder = 999;
    p.sp.frustumCulled = !1;
    p.sp.position.set(p.x, p.y, p.z);
    p.sp.name = "ping";
    scene.add(p.sp);
    placeSprite(p, performance.now());
  }
  // size, distance label and fade, now and on every frame (a sprite that waits for its first frame would be 1 unit big)
  function placeSprite(p, now) {
    if (!p.sp) return;
    const age = now - p.born,
      k = camera.projectionMatrix ? camera.projectionMatrix.elements[5] : 1.3,
      d = Math.round(camera.position.distanceTo(p.sp.position));
    d !== p.dist && paintPin(p, d);
    // about 7% of the screen height, bobbing; fading out in the last 700 ms
    const px = Math.min(72, Math.max(40, 0.075 * innerHeight)),
      s = ((px / innerHeight) * 2) / k,
      pulse = 1 + 0.09 * Math.sin(age / 110);
    p.sp.scale.set((s * 192 * pulse) / 224, s * pulse, 1);
    p.mat.opacity = Math.min(1, (PING_MS - age) / 700);
  }
  function dropPing(p) {
    clearTimeout(p.timer);
    if (p.sp) {
      p.sp.parent && p.sp.parent.remove(p.sp);
      p.tex && p.tex.dispose();
      p.mat && p.mat.dispose();
      p.sp = null;
    }
    p.el && p.el.remove();
    p.el = null;
  }
  function addPing(e) {
    if (!on() || !live() || ffa()) return;
    if (!inMap(e.x, e.y, e.z)) return;
    const id = String(e.id || "").slice(0, 64);
    if (id !== myKey() && S.muted.has(clean(e.n).slice(0, 16))) return;
    const old = S.pings.get(id);
    old && (dropPing(old), S.pings.delete(id));
    while (S.pings.size >= MAX_PINGS) {
      const k = S.pings.keys().next().value;
      dropPing(S.pings.get(k));
      S.pings.delete(k);
    }
    const p = { id, n: clean(e.n).slice(0, 16) || "?", tm: "atk" === e.tm || "def" === e.tm ? e.tm : "", x: e.x, y: e.y, z: e.z, born: performance.now(), dist: -1 };
    makeSprite(p);
    // the frame loop takes it down too; this timer is for a page too busy to draw
    p.timer = setTimeout(() => S.pings.get(id) === p && (dropPing(p), S.pings.delete(id)), PING_MS);
    S.pings.set(id, p);
    mapMark(p);
    blip();
    S.raf || (S.raf = requestAnimationFrame(frame));
  }
  function frame() {
    S.raf = 0;
    const now = performance.now();
    for (const [id, p] of S.pings) {
      if (now - p.born >= PING_MS || !live()) {
        dropPing(p);
        S.pings.delete(id);
        continue;
      }
      placeSprite(p, now);
    }
    S.pings.size && (S.raf = requestAnimationFrame(frame));
  }
  function clearPings() {
    for (const p of S.pings.values()) dropPing(p);
    S.pings.clear();
  }
  // the minimap: a ring that spreads from the point, over everything else
  if ("function" == typeof drawMini) {
    const _dm = drawMini;
    drawMini = function () {
      const r = _dm.apply(this, arguments);
      try {
        if (S.pings.size && "undefined" != typeof mctx && "undefined" != typeof mini && live()) {
          const b = mapBounds(),
            sx = mini.width / (b.maxX - b.minX),
            sz = mini.height / (b.maxZ - b.minZ),
            now = performance.now();
          for (const p of S.pings.values()) {
            const x = (p.x - b.minX) * sx,
              z = (p.z - b.minZ) * sz,
              age = now - p.born,
              k = (age % 900) / 900;
            mctx.save();
            mctx.globalAlpha = Math.min(1, (PING_MS - age) / 700);
            mctx.strokeStyle = `rgba(255,200,73,${0.95 * (1 - k)})`;
            mctx.lineWidth = 2.5;
            mctx.beginPath();
            mctx.arc(x, z, 6 + 16 * k, 0, 7);
            mctx.stroke();
            mctx.fillStyle = "#ffc849";
            mctx.strokeStyle = "#0a0d12";
            mctx.lineWidth = 2;
            mctx.beginPath();
            mctx.arc(x, z, 5.5, 0, 7);
            mctx.fill();
            mctx.stroke();
            mctx.restore();
          }
        }
      } catch (e) {}
      return r;
    };
  }
  // the M map: a layer over its canvas draws the marks (a click there sends one); the mouse is let free while it is open
  const bigmap = $("bigmap"),
    bmc = $("bm-c");
  let bmp = null;
  const bmGeo = () => {
    const b = mapBounds(),
      w = b.maxX - b.minX,
      h = b.maxZ - b.minZ,
      c = bmc.width,
      d = bmc.height,
      s = Math.min(c / w, d / h);
    return { b, s, ox: (c - w * s) / 2, oz: (d - h * s) / 2, c, d };
  };
  function bmFit() {
    if (!bmp || !bmc) return;
    bmp.style.left = bmc.offsetLeft + "px";
    bmp.style.top = bmc.offsetTop + "px";
    bmp.style.width = bmc.clientWidth + "px";
    bmp.style.height = bmc.clientHeight + "px";
  }
  function mapMark(p) {
    if (!bmp || !mapBounds()) return;
    const g = bmGeo(),
      i = document.createElement("i");
    i.style.left = ((100 * (g.ox + (p.x - g.b.minX) * g.s)) / g.c).toFixed(2) + "%";
    i.style.top = ((100 * (g.oz + (p.z - g.b.minZ) * g.s)) / g.d).toFixed(2) + "%";
    p.el = i;
    bmp.appendChild(i);
  }
  if (bigmap && bmc) {
    bmp = document.createElement("div");
    bmp.id = "cht-bmp";
    bmc.parentNode.insertBefore(bmp, bmc.nextSibling);
    bmp.addEventListener("click", (e) => {
      // the card closes on any click; a click on the map itself is a ping
      e.stopPropagation();
      if (!on() || !live() || ffa() || !mapBounds()) return;
      const r = bmp.getBoundingClientRect(),
        g = bmGeo(),
        x = (((e.clientX - r.left) / r.width) * g.c - g.ox) / g.s + g.b.minX,
        z = (((e.clientY - r.top) / r.height) * g.d - g.oz) / g.s + g.b.minZ;
      x >= g.b.minX && x <= g.b.maxX && z >= g.b.minZ && z <= g.b.maxZ && ping({ x, y: groundAt(x, z), z });
    });
    new MutationObserver(() => {
      if (bigmap.hidden) {
        if (S.map) {
          S.map = !1;
          "function" == typeof updateLockHint && updateLockHint();
          if (live() && !IS_TOUCH && !S.open && !modal() && !shopUp() && "function" == typeof tryLock) {
            lockCooldown = 0;
            tryLock();
          }
        }
        return;
      }
      bmFit();
      const hint = $("bm-hint");
      hint && on() && !ffa() && (hint.textContent = IS_TOUCH ? L("지도를 눌러 핑 · 바깥을 누르면 닫힘", "Tap the map to ping · tap outside to close") : L("지도를 눌러 핑 · " + KEYMAP.name("map") + " 닫기", "Click the map to ping · " + KEYMAP.name("map") + " to close"));
      bmp.style.display = on() && !ffa() ? "" : "none";
      // a mouse needs its cursor to click the map: let the lock go while it is open (it comes back when it closes)
      if (!IS_TOUCH && document.pointerLockElement && on() && !ffa()) {
        S.map = !0;
        try {
          document.exitPointerLock();
        } catch (e) {}
      }
    }).observe(bigmap, { attributes: !0, attributeFilter: ["hidden"] });
    addEventListener("resize", bmFit);
  }
  // a click on the corner minimap (when the mouse is free, with the box open) pings there too
  const mini0 = $("mini");
  mini0 &&
    mini0.addEventListener(
      "click",
      (e) => {
        if (IS_TOUCH || !S.open || !on() || !live() || ffa() || !mapBounds()) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const r = mini0.getBoundingClientRect(),
          b = mapBounds(),
          x = b.minX + ((e.clientX - r.left) / r.width) * (b.maxX - b.minX),
          z = b.minZ + ((e.clientY - r.top) / r.height) * (b.maxZ - b.minZ);
        ping({ x, y: groundAt(x, z), z });
      },
      !0,
    );

  // ── touch: a chat button and a ping button, movable in the layout editor ──
  const touch = $("touch");
  function tbtn(id, text, aria, act) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.className = "cht-tb";
    b.textContent = text;
    b.setAttribute("aria-label", aria);
    let tapped = 0;
    b.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        tapped = Date.now();
        act();
      },
      { passive: !1 },
    );
    b.addEventListener("click", () => Date.now() - tapped > 600 && act());
    touch && touch.appendChild(b);
    return b;
  }
  tbtn("tb-chat", L("채팅", "Chat"), L("채팅", "Chat"), () => (S.open ? close(!1) : open("t")));
  tbtn("tb-ping", L("핑", "Ping"), L("핑", "Ping"), () => (qmClose(), ping()));

  // ── the rest: join / leave lines, a clean slate, what the host and the guests hear ──
  if ("function" == typeof lobbyAdd) {
    const _la = lobbyAdd;
    lobbyAdd = function (p) {
      const had = room.members.has(p),
        r = _la.apply(this, arguments);
      try {
        const m = room.members.get(p);
        !had && m && p !== NET.id && "host" === NET.mode && !room.started && sys("join", m.name);
      } catch (e) {}
      return r;
    };
  }
  if ("function" == typeof lobbyRemove) {
    const _lr = lobbyRemove;
    lobbyRemove = function (p) {
      const m = room.members.get(p),
        r = _lr.apply(this, arguments);
      try {
        m && p !== NET.id && "host" === NET.mode && !room.started && sys("leave", m.name);
      } catch (e) {}
      return r;
    };
  }
  const _oa = NET.onAction;
  NET.onAction = function (peer, msg) {
    const t = msg && "object" == typeof msg ? msg.t : "";
    if ("chat" === t || "mark" === t) {
      "host" === NET.mode && ("chat" === t ? hostChat(peer, msg) : hostPing(peer, msg));
      return;
    }
    return _oa.apply(this, arguments);
  };
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    const t = e && "object" == typeof e ? e.t : "";
    if ("chat" === t) return void recvChat(e);
    if ("mark" === t) return void addPing(e);
    return _oe && _oe.apply(this, arguments);
  };
  const _pg = NET.onPeerGone;
  NET.onPeerGone = function (peer) {
    BUCKET.delete(peer);
    return _pg && _pg.apply(this, arguments);
  };
  if ("function" == typeof netShutdown) {
    const _sd = netShutdown;
    netShutdown = function () {
      try {
        S.hist.length = 0;
        log.textContent = "";
        clearPings();
        BUCKET.clear();
        S.open && close(!1);
        qmClose();
      } catch (e) {}
      return _sd.apply(this, arguments);
    };
  }
  // the page follows the owner's switch, the lobby and the mode
  function sync() {
    const off = !on(),
      lob = lobbyUp(),
      ok = !off && here();
    document.body.classList.toggle("cht-off", off);
    document.body.classList.toggle("cht-lobby", lob);
    document.body.classList.toggle("cht-ffa", ffa());
    document.body.classList.toggle("cht-buy", "buy" === world.phase);
    root.hidden = !ok;
    fab.hidden = !(ok && lob);
    root.classList.toggle("top", lob || S.open);
    if (!ok) {
      S.open && close(!1);
      S.qm && qmClose();
      S.pings.size && off && clearPings();
    }
    ffa() && "t" === S.scope && setScope("a");
    // the pause menu came up under an open box (the touch menu button): the box goes
    S.open && live() && modal() && close(!1);
    // the room became a match (or the match a room): a box left open would keep the keys from the game
    S.open && S.lob !== lob && close(!1);
    S.open && !live() && !lob && close(!1);
  }
  setInterval(sync, 400);
  addEventListener("server-config", sync);
  sync();
  window.CHAT = {
    on,
    clean,
    mask,
    take,
    QUICK,
    phrase,
    hostChat,
    hostPing,
    post,
    quick,
    ping,
    open,
    close,
    toggleMute,
    state: S,
    stats,
    resetLimits: () => BUCKET.clear(),
    hist: () => S.hist.slice(),
    pings: () => [...S.pings.values()].map((p) => ({ id: p.id, n: p.n, x: p.x, y: p.y, z: p.z, age: performance.now() - p.born })),
    aim: aimPoint,
    sync,
  };
})();
