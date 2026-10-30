(() => {
  // The screen before a match (like Brawl Stars'): for about three and a half seconds the two sides stand face to face, a card
  // for every player with the agent's portrait, the name, the account level, the title and the mastery of that agent, and the tier
  // in a ranked room; a free-for-all mode shows everyone in one grid. It is only drawn over the game: the buy phase runs
  // underneath, nothing is paused or sent, and a click, a tap or any key closes it.
  //  · Shown where a match is started: solo against bots (startGame), the host (hostStartMatch) and a guest when the host's
  //    "begin" arrives. Not for practice, the target range, a caster, nor a guest who joins a round under way ("joined").
  //  · Levels, tiers and mastery are the server's, from the same lookup as the Lv chips (109-bot-skill: LV_CHIP), and the cards
  //    follow it if the answer comes after the screen is up. Titles are 104's (KILLCAM.titleOf: a bot gets a catalogue title).
  //    A bot has no level and no mastery.
  //  · With the game's motion setting at 0 or the system's "reduce motion" there is no sliding: the cards simply stand there.
  //  · Browsers under automation (navigator.webdriver) do not get it unless PREMATCH_FORCE is set, so tests that click the buy
  //    menu straight after a start are not covered by it.
  if ("undefined" == typeof world || "undefined" == typeof room || "undefined" == typeof NET || "function" != typeof startGame || "function" != typeof hostStartMatch) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const DURATION = 3500, // PREMATCH_DURATION (ms) in the page makes it longer, for a screenshot
    dur = () => Math.max(1000, +window.PREMATCH_DURATION || DURATION),
    GRACE = 300; // input in the first moments does not close it (the key or tap that started the match)
  const MODE_EN = { std: "Standard", swift: "Swift", rush: "Spike Rush", tdm: "Team DM", dm: "Deathmatch", knife: "Knife Fight", gun: "Gun Game", range: "Target Range", hill: "Conquest", ctf: "Capture the Flag", zone: "Shrinking Zone", inf: "Infection" };
  const modeDef = () => (window.GAME_MODES && GAME_MODES[room.mode]) || {};
  const modeName = () => (EN ? MODE_EN[room.mode] : modeDef().name) || modeDef().name || "";
  const mapName = () => {
    try {
      const m = "undefined" != typeof MAP_LIST && MAP_LIST.find((x) => x.key === room.map);
      return m ? m.name : "";
    } catch (e) {
      return "";
    }
  };
  const isBot = (a) => {
    try {
      return "function" == typeof isAI ? !!isAI(a) : "ai" === a.ctrl;
    } catch (e) {
      return "ai" === a.ctrl;
    }
  };
  const nameOf = (a) => {
    try {
      const m = a.ctrl && room.members && room.members.get && room.members.get(a.ctrl);
      return (m && m.name) || a.name || (a.agent && a.agent.name) || "?";
    } catch (e) {
      return a.name || "?";
    }
  };
  const motion = () => {
    try {
      if ("function" == typeof MOT && MOT() <= 0) return !1;
      return !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return !0;
    }
  };

  // ── what a card says ──
  function cardOf(a) {
    const bot = isBot(a),
      info = !bot && window.LV_CHIP ? LV_CHIP.of(a) : null;
    let title = null;
    try {
      title = window.KILLCAM && KILLCAM.titleOf ? KILLCAM.titleOf(a) : null;
    } catch (e) {}
    const C = window.COSMETICS;
    return {
      id: a.id,
      team: a.team,
      me: "me" === a.ctrl,
      bot,
      name: nameOf(a),
      agent: a.agent,
      lv: info ? info.lv : 0,
      tr: info && null != info.tr ? info.tr : null,
      placing: !!(info && window.LV_CHIP && LV_CHIP.placing && LV_CHIP.placing(a)),
      mast: !bot && window.LV_CHIP && LV_CHIP.mast ? LV_CHIP.mast(a) : null,
      title: title && C ? { text: C.name(title), color: (C.tier(title.r) || [])[2] || "#9aa8bc" } : null,
    };
  }
  function cardHtml(c, i, side, anim) {
    const ag = c.agent || {},
      MT = window.MASTERY,
      R = window.RANK;
    const chips = [];
    c.bot ? chips.push(`<span class="pm-ai">AI</span>`) : c.lv ? chips.push(`<span class="lv-chip">Lv ${c.lv}</span>`) : 0;
    if (room.ranked && !c.bot && c.lv && R) chips.push(c.placing ? `<span class="pm-rk" style="--rc:#8a8f98">${R.badge(-1, 0, 15)}<i>${L("배치 중", "Placing")}</i></span>` : c.tr != null ? `<span class="pm-rk" style="--rc:${R.colors[c.tr] || "#8a8f98"}">${R.badge(c.tr, 0, 15)}<i>${esc(R.names[c.tr] || "")}</i></span>` : "");
    const style = `--ac:${esc(ag.color || "#ffc849")};--i:${i}`;
    return `<div class="pm-card ${side}${c.me ? " me" : ""}${c.bot ? " bot" : ""}${anim ? "" : " still"}" style="${style}" data-id="${esc(c.id)}">
      <div class="pm-pic"><img alt="" decoding="async">${c.mast && MT ? `<span class="pm-mast">${MT.badge(c.mast, 13)}</span>` : ""}${c.me ? `<span class="pm-you">${L("나", "YOU")}</span>` : ""}</div>
      <div class="pm-info"><div class="pm-name">${esc(c.name)}</div><div class="pm-sub"><span class="pm-ag">${esc(ag.name || "")}</span>${c.title ? `<span class="pm-ttl" style="color:${esc(c.title.color)}">${esc(c.title.text)}</span>` : ""}</div>${chips.length ? `<div class="pm-chips">${chips.join("")}</div>` : ""}</div>
    </div>`;
  }

  // ── the screen ──
  const css = document.createElement("style");
  css.textContent = `
#prematch{position:fixed;inset:0;z-index:1500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(6px,2vh,18px);padding:max(10px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));box-sizing:border-box;color:#fff;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;overflow:hidden;background:radial-gradient(120% 90% at 50% 50%,rgba(10,13,18,.78),rgba(5,7,10,.94))}
#prematch[hidden]{display:none}
#prematch::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,rgba(255,107,74,.2) 0 47%,transparent 47.2% 52.8%,rgba(56,189,248,.2) 52.8%)}
#prematch.ffa::before{background:radial-gradient(60% 70% at 50% 50%,rgba(255,200,73,.12),transparent)}
#prematch.fadeout{opacity:0;transition:opacity .22s}
.pm-body{display:contents}
.pm-top{position:relative;text-align:center;line-height:1.2}
.pm-top b{display:block;font:800 clamp(15px,2.6vw,26px)/1.1 var(--f-display,system-ui);letter-spacing:.06em}
.pm-top span{font-size:clamp(10px,1.4vw,13px);color:#9aa8bc;letter-spacing:.1em}
.pm-top .pm-rkd{margin-left:8px;padding:1px 8px;border-radius:99px;border:1px solid #ffc849;color:#ffc849;font-size:10px;font-weight:700}
.pm-stage{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:clamp(6px,2vw,28px);width:min(1500px,100%)}
.pm-side{display:flex;flex-direction:column;gap:8px;min-width:0}
.pm-label{font:800 clamp(11px,1.5vw,14px)/1 var(--f-display,system-ui);letter-spacing:.16em;text-align:center}
.pm-side.atk .pm-label{color:#ff8a6b}.pm-side.def .pm-label{color:#6cc8f5}
.pm-label i{font-style:normal;margin-left:7px;padding:1px 7px;border-radius:99px;background:rgba(255,200,73,.16);color:#ffc849;font-size:10px;letter-spacing:.04em}
.pm-cards{display:flex;gap:clamp(5px,1vw,12px);justify-content:center}
.pm-vs{font:900 clamp(34px,8vw,96px)/1 var(--f-display,system-ui);font-style:italic;color:#fff;text-shadow:0 0 28px rgba(255,200,73,.7),0 4px 0 #b8860b,0 8px 22px #000;padding:0 4px}
.pm-card{flex:1 1 0;min-width:0;max-width:134px;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;position:relative;background:linear-gradient(180deg,color-mix(in srgb,var(--ac) 26%,#141922),#0d1118 70%);border:1px solid color-mix(in srgb,var(--ac) 60%,#2a3444);box-shadow:0 14px 34px -14px #000,0 0 22px -10px var(--ac)}
.pm-card.me{border-color:#ffc849;box-shadow:0 0 0 2px rgba(255,200,73,.9),0 0 26px -4px rgba(255,200,73,.7),0 14px 34px -14px #000}
.pm-pic{position:relative;aspect-ratio:150/184;background:radial-gradient(circle at 50% 30%,color-mix(in srgb,var(--ac) 45%,#1b222e),#0d1118);flex:none}
.pm-pic{overflow:hidden}
.pm-pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%;display:block}
.pm-mast{position:absolute;left:4px;bottom:4px;line-height:0}
.pm-you{position:absolute;right:4px;top:4px;padding:1px 6px;border-radius:6px;background:#ffc849;color:#0b0e13;font:800 10px/14px var(--f-display,system-ui);letter-spacing:.06em}
.pm-info{padding:6px 7px 8px;display:flex;flex-direction:column;gap:2px;min-width:0}
.pm-name{font-weight:800;font-size:clamp(11px,1.15vw,14px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-sub{display:flex;flex-direction:column;min-width:0}
.pm-ag{font-size:10.5px;color:var(--ac);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-ttl{font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-chips{display:flex;align-items:center;gap:3px;flex-wrap:wrap;min-height:16px}
.pm-chips .lv-chip{margin-left:0}
.pm-ai{padding:0 6px;border-radius:99px;border:1px solid #5b6879;color:#8a97ab;font:700 10px/15px var(--f-display,system-ui);letter-spacing:.06em}
.pm-rk{display:inline-flex;align-items:center;gap:2px;color:var(--rc);font-size:10px;font-weight:700}
.pm-rk i{font-style:normal}
.pm-rk svg{width:15px;height:15px}
#prematch.ffa .pm-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(6px,1vw,12px);width:min(1180px,100%);position:relative}
#prematch.ffa .pm-card{--cw:clamp(92px,11vw,128px);width:var(--cw);flex:none}
.pm-hint{position:relative;font-size:clamp(10px,1.3vw,12px);color:#8a97ab;letter-spacing:.04em}
.pm-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.08)}
.pm-bar i{display:block;height:100%;width:100%;background:#ffc849;transform-origin:left}
#prematch.go .pm-card:not(.still){animation:pm-in-l .5s cubic-bezier(.2,.9,.25,1.05) both;animation-delay:calc(var(--i)*70ms + 60ms)}
#prematch.go .pm-card.def:not(.still){animation-name:pm-in-r}
#prematch.go.ffa .pm-card:not(.still){animation-name:pm-in-u}
#prematch.go .pm-vs{animation:pm-vs .55s cubic-bezier(.2,1.3,.3,1) .25s both}
@keyframes pm-in-l{from{transform:translateX(-90px);opacity:0}to{transform:none;opacity:1}}
@keyframes pm-in-r{from{transform:translateX(90px);opacity:0}to{transform:none;opacity:1}}
@keyframes pm-in-u{from{transform:translateY(40px) scale(.92);opacity:0}to{transform:none;opacity:1}}
@keyframes pm-vs{from{transform:scale(2.6);opacity:0}to{transform:none;opacity:1}}
#prematch.rd .pm-vs{animation:none!important}
#prematch.calm .pm-card,#prematch.calm .pm-vs{animation:none!important}
#prematch.calm .pm-bar{display:none}
@media (max-height:520px){
  #prematch{gap:4px}
  .pm-top b{font-size:15px}.pm-top span{font-size:10px}
  .pm-stage{gap:6px}
  .pm-side{gap:3px}
  .pm-label{font-size:11px}
  .pm-cards{flex-direction:column;gap:3px}
  .pm-card{--rh:clamp(40px,calc((100vh - 112px) / 5),58px);width:100%;max-width:none;flex:none;flex-direction:row;height:var(--rh);border-radius:9px}
  .pm-side.def .pm-card{flex-direction:row-reverse}
  .pm-pic{height:100%;width:var(--rh);aspect-ratio:auto}
  .pm-mast{left:2px;bottom:2px}.pm-mast .mastb{font-size:9px!important}
  .pm-you{top:2px;right:2px;font-size:8px;line-height:11px;padding:0 3px}
  .pm-info{padding:2px 6px;justify-content:center;gap:0;flex:1}
  .pm-side.def .pm-info{text-align:right;align-items:flex-end}
  .pm-side.def .pm-chips{justify-content:flex-end}
  .pm-name{font-size:12px}
  .pm-sub{flex-direction:row;gap:5px;align-items:baseline;flex-wrap:nowrap;overflow:hidden}
  .pm-side.def .pm-sub{flex-direction:row-reverse}
  .pm-ag{font-size:9.5px;flex:none}.pm-ttl{font-size:9px}
  .pm-chips{min-height:0;gap:3px}.pm-chips .lv-chip{font-size:9px;line-height:13px;padding:0 5px}
  .pm-rk svg{width:12px;height:12px}.pm-rk{font-size:9px}
  .pm-vs{font-size:34px}
  #prematch.ffa .pm-grid{gap:5px}
  #prematch.ffa .pm-card{--cw:min(104px,calc((100vw - 60px) / 5));flex-direction:column;height:auto;width:var(--cw);flex:none}
  #prematch.ffa .pm-pic{width:100%;height:auto;aspect-ratio:1/0.5}
  #prematch.ffa .pm-pic img{object-position:50% 14%}
  #prematch.ffa .pm-info{padding:2px 4px 3px;text-align:left;align-items:stretch}
  #prematch.ffa .pm-sub{flex-direction:row;gap:4px}
  #prematch.ffa .pm-name{font-size:10.5px}.pm-chips{flex-wrap:nowrap}
  #prematch.ffa .pm-vs{font-size:24px!important}
  .pm-bar{height:2px}
}
@media (max-width:620px) and (max-height:520px){.pm-vs{font-size:26px}.pm-stage{gap:3px}}
@media (min-height:521px) and (max-width:760px){.pm-card{flex:none;width:clamp(52px,16vw,96px)}.pm-pic{aspect-ratio:1/1.1}.pm-ag,.pm-ttl{font-size:9px}.pm-stage{grid-template-columns:1fr;gap:6px}.pm-vs{font-size:40px;text-align:center}.pm-cards{flex-wrap:wrap}}`;
  document.head.appendChild(css);

  const V = { el: null, timer: 0, poll: 0, raf: 0, t0: 0, shown: 0, kind: "", off: null };
  const portraits = (root) => {
    root.querySelectorAll(".pm-card").forEach((el) => {
      const a = (world.actors || []).find((x) => String(x.id) === el.dataset.id),
        img = el.querySelector("img");
      if (!a || !a.agent || !img) return;
      if (window.GAME_PORTRAITS) GAME_PORTRAITS.set(img, a.agent, 150, 184, true);
      else {
        try {
          img.src = agentPortrait(a.agent, 150, 184);
        } catch (e) {}
      }
    });
  };
  function draw(first) {
    const el = V.el;
    if (!el) return;
    const ffa = !!modeDef().ffa,
      list = (world.actors || []).map(cardOf),
      anim = first && motion();
    el.classList.toggle("ffa", ffa);
    const rk = room.ranked ? `<span class="pm-rkd">${L("랭크", "RANKED")}</span>` : "";
    const head = `<div class="pm-top"><b>${esc(modeName())}${rk}</b><span>${esc(mapName())}</span></div>`;
    const hint = `<div class="pm-hint">${L("화면을 누르거나 아무 키나 누르면 건너뜁니다", "Tap or press any key to skip")}</div>`;
    const bar = `<div class="pm-bar"><i></i></div>`;
    let body;
    if (ffa) body = `<div class="pm-vs" aria-hidden="true" style="font-size:clamp(26px,5vw,56px)">VS</div><div class="pm-grid">${list.map((c, i) => cardHtml(c, i, "ffa", anim)).join("")}</div>`;
    else {
      const side = (team, label) => {
        const mine = list.some((c) => c.me && c.team === team);
        const cs = list.filter((c) => c.team === team);
        return `<div class="pm-side ${team}"><div class="pm-label">${label}${mine ? `<i>${L("내 팀", "YOUR TEAM")}</i>` : ""}</div><div class="pm-cards">${cs.map((c, i) => cardHtml(c, i, team, anim)).join("")}</div></div>`;
      };
      body = `<div class="pm-stage">${side("atk", L("공격팀", "ATTACKERS"))}<div class="pm-vs" aria-hidden="true">VS</div>${side("def", L("수비팀", "DEFENDERS"))}</div>`;
    }
    // the head, hint and timer bar are drawn once; a redraw (the server's answer came) only changes the cards
    if (first) el.innerHTML = head + `<div class="pm-body">${body}</div>` + hint + bar;
    else {
      el.classList.add("rd");
      el.querySelector(".pm-body").innerHTML = body;
    }
    portraits(el);
  }
  function close(why) {
    const el = V.el;
    if (!el) return;
    clearTimeout(V.timer);
    clearInterval(V.poll);
    cancelAnimationFrame(V.raf);
    V.timer = V.poll = V.raf = 0;
    V.el = null;
    V.off && V.off();
    V.off = null;
    window.PREMATCH.last = why || "";
    const done = () => {
      try {
        el.remove();
      } catch (e) {}
    };
    if (why === "skip" && motion()) {
      el.classList.add("fadeout");
      setTimeout(done, 240);
      el.hidden = false;
      el.style.pointerEvents = "none";
    } else done();
    window.dispatchEvent(new CustomEvent("dfdf:prematch-end", { detail: why }));
  }
  const refresh = () => V.el && draw(false);
  function open(kind) {
    close("replace");
    const el = document.createElement("div");
    el.id = "prematch";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", L("경기 시작", "Match start"));
    el.dataset.kind = kind;
    document.body.appendChild(el);
    V.el = el;
    V.kind = kind;
    V.t0 = performance.now();
    draw(true);
    const calm = !motion();
    el.classList.toggle("calm", calm);
    // the animations start on the next frame, once the cards are in
    requestAnimationFrame(() => V.el === el && el.classList.add("go"));
    setTimeout(() => V.el === el && el.classList.add("go"), 60);
    const skip = (e) => {
      if (performance.now() - V.t0 < GRACE) return;
      if (e.type === "keydown" && (e.repeat || ["Shift", "Control", "Alt", "Meta"].includes(e.key))) return;
      close("skip");
    };
    const ev = ["pointerdown", "mousedown", "touchstart", "keydown"];
    ev.forEach((n) => window.addEventListener(n, skip, { capture: !0, passive: !0 }));
    window.addEventListener("dfdf:levels", refresh);
    V.off = () => {
      ev.forEach((n) => window.removeEventListener(n, skip, { capture: !0 }));
      window.removeEventListener("dfdf:levels", refresh);
    };
    // the time it stays is time the player SEES it: a frame that was held up (the map and the shaders loading right after a
    // start) counts for 100 ms at most, so a slow start does not use up the screen before it has been drawn once
    V.shown = 0;
    let last = 0;
    const bar = el.querySelector(".pm-bar i");
    const tick = (now) => {
      if (V.el !== el) return;
      last && (V.shown += Math.min(100, now - last));
      last = now;
      bar && !calm && (bar.style.transform = `scaleX(${Math.max(0, 1 - V.shown / dur()).toFixed(3)})`);
      V.shown >= dur() ? close("done") : (V.raf = requestAnimationFrame(tick));
    };
    V.raf = requestAnimationFrame(tick);
    // a tab that is not drawn does not hold the screen for ever
    V.timer = setTimeout(() => close("done"), dur() * 4);
    // the match ended or the player went back to the title: nothing to show any more
    V.poll = setInterval(() => {
      ["menu", "over"].includes(world.phase) && close("gone");
    }, 250);
  }
  function eligible(practice) {
    if (navigator.webdriver && !window.PREMATCH_FORCE) return !1;
    if (practice || window.GAME_PRACTICE || "range" === room.mode || window.CASTER) return !1;
    return !!(world.actors && world.actors.length > 1 && world.phase && "menu" !== world.phase);
  }
  // after the match has been built by the original function
  const after = (kind, r, practice) => {
    const go = () => {
      try {
        eligible(practice) && open(kind);
      } catch (e) {
        console.warn("prematch", e);
      }
    };
    if (r && "function" == typeof r.then) return r.then((v) => (go(), v));
    go();
    return r;
  };
  const _sg = startGame;
  startGame = function (e, t) {
    return after("solo", _sg.apply(this, arguments), !!t);
  };
  const _hs = hostStartMatch;
  hostStartMatch = function () {
    return after("host", _hs.apply(this, arguments), !1);
  };
  // a guest: when the host's "begin" has been handled (a "joined" into a round under way is another event, and gets none)
  const _oe = NET.onEvent;
  NET.onEvent = function (e) {
    const r = _oe && _oe.apply(this, arguments);
    e && "begin" === e.t && "client" === NET.mode && after("guest", null, !1);
    return r;
  };
  window.PREMATCH = { DURATION, open, close, active: () => !!V.el, cards: () => (world.actors || []).map(cardOf), kind: () => V.kind, last: "" };
})();
