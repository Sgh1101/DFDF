(() => {
  // AI competitive: "Competitive" on the solo select screen. The rules are fixed like a ranked room's (standard mode, first
  // to 13, a 5v5 map the player picks or gets by chance, admin switches and cheats off for the match: it uses the lock of
  // js/legacy/81, RANKED.ai), the bots follow the account's AI rating (one skill number, js/bot-skill.js, the tiers' own
  // line: Iron 0.60 ... Radiant 1.20) and the result goes to the server as an AI competitive match. The server keeps a
  // rating for it that is apart from the real rank (api/v1.js, u.ai): RR, seasons and the leaderboard never move for it.
  // Here: the choice, the lock for the length of the match, the bots, and the tile on the result screen.
  if ("undefined" == typeof world || "undefined" == typeof room || "undefined" == typeof NET || "undefined" == typeof BOT_RT || "function" != typeof startGame || !window.RANKED || !RANKED.sync || !window.ACCOUNT) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const $ = (id) => document.getElementById(id);
  // on: chosen on the select screen; live: the lock is held (a match under way); match: this match is reported as one
  const AIC = (window.AI_COMP = { on: !1, live: !1, match: !1, skill: null, seen: !1, t0: 0 });
  const user = () => {
    try {
      const s = ACCOUNT.session();
      return (s && s.user) || null;
    } catch (e) {
      return null;
    }
  };
  const ai = () => {
    const u = user();
    return u && !u.guest && u.ai && "object" == typeof u.ai ? u.ai : null;
  };
  const cfgOn = () => !(window.SERVER_CFG && SERVER_CFG.aiComp && !1 === SERVER_CFG.aiComp.on);
  const usable = () => !!ai() && cfgOn();
  const NAMES = () => (window.RANK && RANK.names) || [];
  const tierName = (a) => (a ? (NAMES()[a.t] || "") + (a.t < 8 && a.div ? " " + a.div : "") : "");
  const step = (a) => (a.t >= 8 ? 24 : a.t * 3 + (a.div || 1) - 1);
  // the tier as a number with a fraction (Gold 2 with 50 into it is 3.5): the bots' skill is a straight line over it
  const frac = (a) => (a.t >= 8 ? 8 : a.t + ((a.div || 1) - 1) / 3 + (a.into || 0) / 300);
  const skillOf = (a) => (window.BOT_SKILL ? BOT_SKILL.tierSkill(a ? frac(a) : 0) : null);
  // the three old steps by name, for the player: the skill itself runs smoothly inside them
  const stepName = (sk) => (sk < 0.8 ? L("순한맛", "Easy") : sk < 1.05 ? L("보통", "Normal") : L("빡셈", "Hard"));
  const full = (k) => "function" != typeof MAP_CAT || "full" === MAP_CAT(k);

  // ── the bots: while the lock is held their skill is the rating's, whoever sets it ──
  {
    let held = BOT_RT.skill;
    try {
      Object.defineProperty(BOT_RT, "skill", { configurable: !0, enumerable: !0, get: () => (AIC.live && Number.isFinite(AIC.skill) ? AIC.skill : held), set: (v) => (held = v) });
    } catch (e) {}
  }

  // ── the lock ──
  function hold() {
    AIC.live = !0;
    AIC.seen = !1;
    AIC.t0 = Date.now();
    RANKED.ai = !0;
    RANKED.sync();
  }
  function release() {
    if (!AIC.live && !RANKED.ai) return;
    AIC.live = !1;
    RANKED.ai = !1;
    RANKED.sync();
  }
  // the match is over, or the player left it: the lock goes (a match that never showed a round is let go after a few seconds)
  setInterval(() => {
    try {
      if (!AIC.live) return;
      const ph = world.phase;
      if (["buy", "live", "end"].includes(ph)) AIC.seen = !0;
      else if (AIC.seen ? ["over", "menu"].includes(ph) : Date.now() - AIC.t0 > 8000) release();
    } catch (e) {}
  }, 250);
  {
    const _sd = netShutdown;
    netShutdown = function () {
      const r = _sd.apply(this, arguments);
      release();
      return r;
    };
  }

  // ── the match starts: the fixed rules, the bots' skill, the lock ──
  {
    const _sg = startGame;
    startGame = function (agent, practice) {
      const on = !!AIC.on && !practice && usable();
      AIC.match = on;
      if (on) {
        room.mode = "std";
        room.diff = "normal";
        if (!full(room.map)) {
          const l = MAP_LIST.filter((m) => full(m.key));
          l.length && (room.map = l[Math.floor(Math.random() * l.length)].key);
        }
        AIC.skill = skillOf(ai());
        hold();
      } else release();
      const r = _sg.apply(this, arguments);
      // NET.mode turns "solo" inside startGame: the lock follows at once, not at the next tick
      on && RANKED.sync();
      return r;
    };
  }
  // the report says so: this is the match the server may count for the AI rating (it still checks it)
  if (window.RESULTS && RESULTS.summary) {
    const _sum = RESULTS.summary;
    RESULTS.summary = function () {
      const m = _sum.apply(this, arguments);
      m && AIC.match && "solo" === NET.mode && (m.aic = 1);
      return m;
    };
  }

  // ── the select screen ──
  const css = document.createElement("style");
  css.textContent = `#sel-comp{color:var(--gold,#ffc849);border-color:rgba(255,200,73,.45)}
#sel-comp em{font-style:normal;margin-left:6px;padding:0 6px;border-radius:99px;font-size:10px;background:rgba(255,200,73,.16);color:var(--gold,#ffc849);white-space:nowrap}
.sel-modes #sel-comp.on{border-color:var(--gold,#ffc849);background:color-mix(in srgb,var(--gold,#ffc849) 16%,transparent);color:var(--ink,#fff)}
#sel-comp:disabled{opacity:.55}
#s-select.aic .map-cats{display:none}
#ov-aic b{display:flex;align-items:center;justify-content:center;gap:7px;font-size:15px;white-space:nowrap}
#ov-aic .lbl{white-space:normal}
#ov-aic[hidden]{display:none}`;
  document.head.appendChild(css);
  const modes = $("sel-modes");
  let prevCat = "";
  const practice = () => !!($("sel-go") && "1" === $("sel-go").dataset.practice);
  const act = () => AIC.on && !practice();
  const clickCat = (c) => {
    const tab = document.querySelector(`#s-select .map-cats [data-cat="${c}"]`);
    tab && tab.click();
  };
  const curCat = () => {
    const on = document.querySelector("#s-select .map-cats .on");
    return on ? on.dataset.cat || "" : "";
  };
  function paintState() {
    const b = $("sel-comp");
    if (!b || !modes) return;
    const a = ai(),
      ok = usable(),
      on = act();
    b.hidden = practice();
    b.disabled = !ok;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
    b.innerHTML = "";
    b.append(L("경쟁전", "Competitive"));
    if (a) {
      const em = document.createElement("em");
      em.textContent = tierName(a);
      b.append(em);
    }
    b.title = ok
      ? L("5대5 일반전 · 13선승 · 치트 끔 · 내 AI 점수에 맞춰 봇이 강해집니다", "5v5 standard · first to 13 · cheats off · bots follow your AI rating")
      : cfgOn()
        ? L("계정으로 로그인해야 AI 점수가 쌓입니다", "Sign in with an account to earn an AI rating")
        : L("지금은 쉬고 있습니다", "Competitive is off right now");
    for (const o of modes.querySelectorAll(".lb-map")) o !== b && on && o.classList.remove("on");
    const s = $("s-select");
    s && s.classList.toggle("aic", on);
    const d = $("sel-mode-sub");
    on && d && (d.textContent = L(`경쟁전 · 5대5 일반전 · 13선승 · 치트 끔 · 봇 ${stepName(skillOf(a))}`, `Competitive · 5v5 standard · first to 13 · cheats off · ${stepName(skillOf(a))} bots`));
  }
  function chip() {
    if (!modes) return;
    let b = $("sel-comp");
    if (!b) {
      b = document.createElement("button");
      b.id = "sel-comp";
      b.type = "button";
      b.className = "lb-map";
      b.onclick = () => pick(!AIC.on);
    }
    modes.firstChild !== b && modes.prepend(b);
    paintState();
  }
  function pick(on) {
    on = !!on && usable();
    if (on === AIC.on) return paintState();
    AIC.on = on;
    if (on) {
      room.mode = "std";
      prevCat = curCat();
      clickCat("full");
    } else clickCat(prevCat);
    paintSelMaps();
  }
  if (modes) {
    new MutationObserver(() => modes.firstChild !== $("sel-comp") && chip()).observe(modes, { childList: !0 });
    // another mode chosen: the competitive choice is off (the chip's own handler then draws the modes)
    modes.addEventListener(
      "click",
      (e) => {
        const b = e.target.closest && e.target.closest("button");
        b && "sel-comp" !== b.id && AIC.on && pick(!1);
      },
      !0,
    );
  }
  {
    const _psm = paintSelMaps;
    paintSelMaps = function () {
      if (act() && !full(room.map)) {
        const l = MAP_LIST.filter((m) => full(m.key));
        l.length && (room.map = l[0].key);
      }
      const r = _psm.apply(this, arguments);
      chip();
      return r;
    };
  }
  // the screen opens as practice or as a match: the chip follows
  for (const id of ["go-play", "go-range"]) $(id) && $(id).addEventListener("click", () => queueMicrotask(paintState));
  addEventListener("server-config", paintState);
  addEventListener("account-reward", () => queueMicrotask(paintState));

  // ── the result screen: a tile with the AI tier and what the match changed ──
  const WHY = {
    guest: L("게스트는 AI 점수가 쌓이지 않습니다", "Guests do not earn an AI rating"),
    too_short: L("경기가 너무 짧아 반영되지 않았습니다", "Too short, so it did not count"),
  };
  const WHY_ANY = L("조건에 맞지 않아 반영되지 않았습니다", "Did not meet the rules, so it did not count");
  addEventListener("account-reward", (e) => {
    try {
      const j = e.detail,
        r = j && j.ai;
      if (!r || "over" !== world.phase) return;
      const st = document.querySelector("#s-over .ov-stats");
      if (!st) return;
      let c = $("ov-aic");
      if (!c) {
        c = document.createElement("div");
        c.className = "ov-st";
        c.id = "ov-aic";
        c.innerHTML = "<b></b><span class=\"lbl\"></span>";
        st.appendChild(c);
      }
      c.hidden = !1;
      const a = r.after || (j.user && j.user.ai),
        d = r.rr | 0,
        b = c.querySelector("b"),
        lbl = c.querySelector(".lbl"),
        col = (window.RANK && a && RANK.colors[a.t]) || "#8a97ab";
      const badge = window.RANK && a ? RANK.badge(a.t, a.div, 26) : "";
      if (!r.counted) {
        b.innerHTML = `${badge} <span style="color:#8a97ab">±0</span>`;
        lbl.textContent = WHY[r.why] || WHY_ANY;
        lbl.style.color = "#8a97ab";
        c.title = "";
        return;
      }
      b.innerHTML = `${badge} <span style="color:${d > 0 ? "#4ade80" : d < 0 ? "#ff6b7a" : "#8a97ab"}">${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}</span>`;
      lbl.textContent = L("AI 경쟁전 · ", "AI Competitive · ") + tierName(a) + (r.capped ? L(" · 오늘 상승 한도", " · daily limit") : "");
      lbl.style.color = col;
      c.title = a.t >= 8 ? `${a.rr}` : L(`다음 단계까지 ${100 - a.into}`, `${100 - a.into} to the next division`);
      const was = r.before;
      if (was && a && step(a) !== step(was))
        setTimeout(() => {
          try {
            const up = step(a) > step(was);
            "function" == typeof banner && banner(up ? L(`승급! AI ${tierName(a)}`, `Promoted! AI ${tierName(a)}`) : L(`강등 · AI ${tierName(a)}`, `Demoted · AI ${tierName(a)}`), up ? col : "#ff6b7a");
          } catch (x) {}
        }, 2300);
    } catch (err) {}
  });
  // a new match: last match's tile goes
  setInterval(() => {
    try {
      "over" !== world.phase && $("ov-aic") && !$("ov-aic").hidden && ($("ov-aic").hidden = !0);
    } catch (e) {}
  }, 1000);
})();
