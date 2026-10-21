(() => {
  // 감염 (infection). One fighter starts as the infected (the 술래): a knife, a full
  // suit of armour, quicker on its feet. Everyone else is a survivor with a gun. A survivor
  // the infected kills joins the infected after the usual 3 s, and every one of them
  // is a knife and some speed too. Survivors win by lasting the 180 s; the infected
  // win when the last survivor falls. The top bar counts survivors against the infected.
  // The host decides every team and tells each guest; no abilities, no shop.
  if ("undefined" == typeof killActor || "undefined" == typeof step || !window.GAME_MODES || !GAME_MODES.inf) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const MODE = "inf";
  const ours = () => "object" == typeof room && room && MODE === room.mode;
  const inMatch = () => !!(world.actors && world.actors.length);
  const isHost = () => "undefined" == typeof NET || "client" !== NET.mode;
  const peerOf = (a) => "undefined" != typeof NET && "host" === NET.mode && a.ctrl && "me" !== a.ctrl && "dead" !== a.ctrl && !("function" == typeof isAI && isAI(a));
  const GUNS = ["rifle", "carbine", "battle", "bullpup", "smg", "vector", "shotgun", "burst"].filter((k) => WEAPONS[k]);
  const SPEED = 1.18;
  const surv = (a) => "def" === a.team,
    seeker = (a) => "atk" === a.team;
  const send = (o) => {
    try {
      "host" === NET.mode && sendEventAll(Object.assign({ t: "inf" }, o));
    } catch (e) {}
  };
  const say = (a, msg, col) => {
    if ("me" === a.ctrl) banner(msg, col);
    else if (peerOf(a)) sendEventTo(a.ctrl, { t: "round", msg, color: col });
  };

  // ── loadouts: a gun for a survivor, only the knife for the infected ──
  function wallet(a) {
    peerOf(a) && sendEventTo(a.ctrl, { t: "wallet", c: a.credits, w: a.weapons, am: a.ammo, ar: a.armor, s: a.slot });
  }
  function hold(a, slot) {
    a.reloading = 0;
    if ("me" === a.ctrl && "function" == typeof switchSlot) {
      try {
        switchSlot(slot);
      } catch (e) {
        a.slot = slot;
      }
    } else a.slot = slot;
    try {
      "function" == typeof syncActorModel && syncActorModel(a);
    } catch (e) {}
  }
  function knifeOnly(a) {
    const W = a.weapons;
    if (!W || (!W.primary && !W.secondary && "knife" === a.slot)) return !1;
    W.primary = null;
    W.secondary = null;
    W.knife = "knife";
    hold(a, "knife");
    wallet(a);
    return !0;
  }
  function gunUp(a) {
    const key = GUNS[Math.floor(Math.random() * GUNS.length)],
      W = a.weapons;
    W.primary = key;
    W.knife = "knife";
    a.ammo = a.ammo || {};
    a.reserve = a.reserve || {};
    a.ammo[key] = WEAPONS[key].mag;
    a.reserve[key] = 999999;
    hold(a, "primary");
    wallet(a);
  }

  // ── who is infected ──
  let FIRST = null;
  function make(a, first) {
    a.team = "atk";
    a.__inf = first ? 2 : 1;
    if (first) {
      // the first one is the hardest to put down: a full suit of armour on top of the health
      a.hp = 100;
      a.armor = 100;
    }
    a.speedBuff = Math.max(a.speedBuff || 1, SPEED);
    a.speedBuffT = 9999;
    knifeOnly(a);
  }
  function begin() {
    const acts = world.actors.slice();
    for (const a of acts) {
      a.team = "def";
      a.__inf = 0;
      a.speedBuff = 1;
      a.speedBuffT = 0;
    }
    const pick = acts[Math.floor(Math.random() * acts.length)];
    FIRST = pick;
    for (const a of acts) a === pick ? make(a, !0) : gunUp(a);
    send({ all: 1, ids: [pick.id], first: pick.id });
    tell();
    count();
  }
  function tell() {
    const nm = (FIRST && (FIRST.name || (FIRST.agent && FIRST.agent.name))) || "?";
    for (const a of world.actors) {
      if (a === FIRST) say(a, L("당신이 술래입니다 — 모두를 감염시키세요", "You are the infected — catch them all"), "#ff3b4e");
      else say(a, L(`술래: ${nm} · 3분을 버티세요`, `Infected: ${nm} · last three minutes`), "#ffc849");
    }
  }
  function count() {
    let s = 0,
      i = 0;
    for (const a of world.actors) surv(a) ? s++ : i++;
    world.scoreDef = s;
    world.scoreAtk = i;
    return s;
  }
  function finish() {
    if (world.over) return;
    world.over = !0;
    world.phase = "end";
    banner(L("경기 종료", "Match over"), "#ffc849");
    "host" === NET.mode && sendEventAll({ t: "round", msg: L("경기 종료", "Match over"), color: "#ffc849" });
    scheduleMatchFinish();
  }

  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    if (ours() && inMatch() && isHost()) {
      try {
        begin();
      } catch (e) {
        console.warn("infection", e);
      }
    }
    return r;
  };

  // a survivor killed joins the infected (any cause)
  const _ka = killActor;
  killActor = function (e, t) {
    const was = ours() && inMatch() && isHost() && e && e.alive && surv(e) && !world.over;
    const r = _ka.apply(this, arguments);
    if (was) {
      try {
        make(e, !1);
        send({ ids: [e.id], by: t && t.id });
        say(e, L("감염되었습니다 — 이제 당신도 술래입니다", "Infected — you hunt now"), "#ff3b4e");
        t && t !== e && say(t, L("감염시켰습니다", "Caught one"), "#ff6b3d");
        if (!count() && "live" === world.phase) finish();
      } catch (x) {}
    }
    return r;
  };

  // a loadout is kept: no shop, no buying
  if ("function" == typeof applyPurchase) {
    const _ap = applyPurchase;
    applyPurchase = function (e, t) {
      if (ours() && inMatch() && "weapon" === t) {
        e && "me" === e.ctrl && banner(L("감염에서는 무기가 정해져 있습니다", "Loadouts are fixed in Infection"), "#8a97ab");
        return;
      }
      return _ap.apply(this, arguments);
    };
  }
  if ("function" == typeof openShop) {
    const _os = openShop;
    openShop = function () {
      if (ours() && inMatch()) return;
      return _os.apply(this, arguments);
    };
  }

  // every step the host keeps the infected on the knife and quick
  const _step = step;
  step = function () {
    const r = _step.apply(this, arguments);
    try {
      if (ours() && inMatch()) {
        if (isHost()) {
          for (const a of world.actors)
            if (a.alive && seeker(a)) {
              knifeOnly(a);
              a.speedBuff = Math.max(a.speedBuff || 1, SPEED);
              a.speedBuffT = Math.max(a.speedBuffT || 0, 1);
            }
          const left = count();
          !left && "live" === world.phase && !world.over && world.actors.length > 1 && finish();
        }
        paintHud();
      } else paintHud();
    } catch (e) {}
    return r;
  };

  // the survivors win if the clock runs out with any left, the infected if none
  const _go = gameOver;
  gameOver = function () {
    if (ours() && inMatch() && isHost()) {
      const win = count() > 0;
      world.scoreDef = win ? 1 : 0;
      world.scoreAtk = win ? 0 : 1;
    }
    return _go.apply(this, arguments);
  };

  // bots with a knife: close in and cut (the same as in the knife modes)
  let CUR = null;
  const reach = () => ((WEAPONS.knife && WEAPONS.knife.range) || 3) - 0.2;
  const dist = (e) => {
    const s = e.ai && e.ai.lastSeen;
    return s ? Math.hypot(s.x - e.pos.x, s.z - e.pos.z) : 1e9;
  };
  if ("function" == typeof actorFire) {
    const _af = actorFire;
    actorFire = function (e) {
      if (CUR && CUR === e && ours() && seeker(e) && dist(e) > reach()) return;
      return _af.apply(this, arguments);
    };
  }
  if ("function" == typeof aiThink) {
    const _ai = aiThink;
    aiThink = function (e) {
      CUR = e;
      let r;
      try {
        r = _ai.apply(this, arguments);
      } finally {
        CUR = null;
      }
      try {
        if (ours() && e && e.alive && seeker(e) && e.ai && "fight" === e.ai.state && e.input) {
          const d = dist(e),
            sx = (e.input.mv && e.input.mv[0]) || 0;
          e.input.mv = d > 1.4 ? [0.35 * sx, -1] : [sx, 0];
        }
      } catch (x) {}
      return r;
    };
  }

  // the host's word on who is infected (a guest does not decide it)
  const _oe = NET.onEvent;
  NET.onEvent = function (m) {
    if (m && "inf" === m.t) {
      try {
        if (m.all) for (const a of world.actors || []) ((a.team = m.ids.includes(a.id) ? "atk" : "def"), (a.__inf = a.id === m.first ? 2 : m.ids.includes(a.id) ? 1 : 0));
        else
          for (const id of m.ids || []) {
            const a = "function" == typeof actorById ? actorById(id) : null;
            a && ((a.team = "atk"), (a.__inf = 1));
          }
        // my own speed: a guest moves itself
        const me = "function" == typeof myActor ? myActor() : null;
        me && (me.team === "atk" ? ((me.speedBuff = Math.max(me.speedBuff || 1, SPEED)), (me.speedBuffT = 9999)) : ((me.speedBuff = 1), (me.speedBuffT = 0)));
        paintHud();
      } catch (e) {}
      return;
    }
    return _oe && _oe.apply(this, arguments);
  };

  // ── the bar under the score: who is left, and how long ──
  function paintHud() {
    let el = $("inf-hud");
    const on = ours() && inMatch() && "menu" !== world.phase && "over" !== world.phase;
    if (!on) return void (el && (el.hidden = !0));
    if (!el) {
      el = document.createElement("div");
      el.id = "inf-hud";
      el.style.cssText = "position:absolute;top:86px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;padding:5px 14px;border-radius:999px;background:rgba(10,13,18,.72);border:1px solid rgba(255,59,78,.5);color:#ffb3bb;font:700 12px/1.4 var(--f-display,system-ui);letter-spacing:.05em;white-space:nowrap";
      ($("hud") || document.body).appendChild(el);
    }
    const me = ("function" == typeof myActor && myActor()) || player,
      t = Math.max(0, Math.ceil(world.roundTime || 0)),
      mm = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
    el.hidden = !1;
    el.textContent = `${L("생존자", "Survivors")} ${world.scoreDef | 0} · ${L("감염", "Infected")} ${world.scoreAtk | 0} · ${"live" === world.phase ? mm : L("준비", "Get ready")}${me && seeker(me) ? " · " + L("당신은 감염자", "you are infected") : ""}`;
  }
  const _uh = updateHUD;
  updateHUD = function () {
    const r = _uh.apply(this, arguments);
    try {
      if (ours() && inMatch() && "function" == typeof _hT && $("tb-phase")) _hT($("tb-phase"), "buy" === world.phase ? L("준비", "Ready") : L("감염", "Infection"));
    } catch (e) {}
    return r;
  };

  window.INFECTION = { begin, count, make, first: () => FIRST, SPEED };
})();
