(() => {
  // Two free-for-all modes on top of deathmatch (respawn 3 s after a death, no
  // abilities, the shop locked):
  //   칼 대난투 (knife) — knives only, first to 25 kills.
  //   총기 순환 (gun) — everyone starts on the first gun of a ladder of
  //     thirteen; each kill moves you to the next one; the last step is the
  //     knife, and a kill with it wins. Killed by a knife, you drop a step.
  // The host decides every loadout (and tells each guest); bots holding a
  // knife close in and cut instead of backing off and swinging from afar.
  if ("undefined" == typeof WEAPONS || !window.GAME_MODES || "function" != typeof killActor || "function" != typeof step) return;
  const MODES = window.GAME_MODES;
  if (!MODES.knife || !MODES.gun) return;
  // the ladder: mixed classes so it never feels the same twice, ending on the knife
  const LADDER = ["rifle", "vector", "shotgun", "sniper", "lmg", "bullpup", "smg", "autoshot", "marksman", "burst", "revolver", "handcan", "knife"].filter((k) => WEAPONS[k]);
  MODES.gun.kills = LADDER.length;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const mode = () => ("object" == typeof room && room ? room.mode : "");
  const ours = () => "knife" === mode() || "gun" === mode();
  const inMatch = () => !!(world.actors && world.actors.length);
  const isHost = () => "undefined" == typeof NET || "client" !== NET.mode;
  const peerOf = (a) => "undefined" != typeof NET && "host" === NET.mode && a.ctrl && "me" !== a.ctrl && "dead" !== a.ctrl && !("function" == typeof isAI && isAI(a));
  const side = (k) => WEAPONS[k] && ("보조" === WEAPONS[k].cls || "근접" === WEAPONS[k].cls);
  const level = (a) => Math.max(0, Math.min(LADDER.length - 1, a.kills | 0));
  const gunOf = (a) => ("gun" === mode() ? LADDER[level(a)] : "knife");
  // what one fighter should be holding
  function want(a) {
    const k = gunOf(a);
    if ("knife" === k) return { primary: null, secondary: null, slot: "knife", key: "knife" };
    return side(k) ? { primary: null, secondary: k, slot: "secondary", key: k } : { primary: k, secondary: null, slot: "primary", key: k };
  }
  function fit(a) {
    if (!a || !a.alive || !a.weapons) return !1;
    const w = want(a),
      W = a.weapons;
    if (W.primary === w.primary && W.secondary === w.secondary && (a.weapons[a.slot] || "knife" === a.slot)) return !1;
    const changed = W.primary !== w.primary || W.secondary !== w.secondary;
    W.primary = w.primary;
    W.secondary = w.secondary;
    W.knife = "knife";
    a.ammo = a.ammo || {};
    a.reserve = a.reserve || {};
    if (w.key && WEAPONS[w.key]) {
      a.ammo[w.key] = WEAPONS[w.key].mag;
      a.reserve[w.key] = 999999;
    }
    // a new gun comes up in the hand; otherwise only an empty slot is moved off
    const slot = changed || !a.weapons[a.slot] ? w.slot : a.slot;
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
    peerOf(a) && sendEventTo(a.ctrl, { t: "wallet", c: a.credits, w: a.weapons, am: a.ammo, ar: a.armor, s: a.slot });
    return !0;
  }
  // every step the host keeps each loadout what the mode says
  const _step = step;
  step = function () {
    const r = _step.apply(this, arguments);
    try {
      if (ours() && inMatch() && isHost()) for (const a of world.actors) fit(a);
      paintHud();
    } catch (e) {}
    return r;
  };

  // no shop and no buying in these modes
  if ("function" == typeof applyPurchase) {
    const _ap = applyPurchase;
    applyPurchase = function (e, t) {
      if (ours() && inMatch() && "weapon" === t) {
        e && "me" === e.ctrl && banner("knife" === mode() ? L("칼 대난투에서는 칼만 씁니다", "Knives only in Knife Fight") : L("총기 순환에서는 총이 정해져 있습니다", "Guns are set in Gun Game"), "#8a97ab");
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

  // a kill: in gun game the killer has already gone up a step (the kill count is the
  // step); a knife kill also takes a step from the one killed. Nobody drops a gun here.
  const _ka = killActor;
  killActor = function (e, t) {
    if (!ours() || !inMatch() || !isHost() || !e) return _ka.apply(this, arguments);
    const knifed = !!(t && t !== e && t.alive && "function" == typeof actorWeaponKey && "knife" === actorWeaponKey(t)),
      wasAlive = !!e.alive;
    e.weapons && (e.weapons.primary = null);
    const r = _ka.apply(this, arguments);
    try {
      if ("gun" === mode() && wasAlive && t && t !== e) {
        if (knifed && (e.kills | 0) > 0) {
          e.kills = (e.kills | 0) - 1;
          note(e, L("칼에 당해 한 단계 내려갑니다", "Knifed: down one step"), "#ff6b6b");
        }
        if (!world.over && t.alive) {
          fit(t);
          const k = LADDER[level(t)];
          note(t, "knife" === k ? L("마지막 단계 · 칼로 끝내세요", "Last step · finish it with the knife") : L(`다음 총 · ${WEAPONS[k].name} (${level(t) + 1}/${LADDER.length})`, `Next gun · ${WEAPONS[k].name} (${level(t) + 1}/${LADDER.length})`), "#ffc849");
        }
      }
    } catch (x) {}
    return r;
  };
  function note(a, msg, col) {
    if ("me" === a.ctrl) banner(msg, col);
    else if (peerOf(a)) sendEventTo(a.ctrl, { t: "round", msg, color: col });
  }

  // bots with a knife: close in, cut only within reach
  let CUR = null;
  const reach = () => ((WEAPONS.knife && WEAPONS.knife.range) || 3) - 0.2;
  const targetDist = (e) => {
    const s = e.ai && e.ai.lastSeen;
    return s ? Math.hypot(s.x - e.pos.x, s.z - e.pos.z) : 1e9;
  };
  if ("function" == typeof actorFire) {
    const _af = actorFire;
    actorFire = function (e) {
      if (CUR && CUR === e && ours() && "knife" === actorWeaponKey(e) && targetDist(e) > reach()) return;
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
        if (ours() && e && e.alive && e.ai && "fight" === e.ai.state && "knife" === actorWeaponKey(e) && e.input) {
          const d = targetDist(e),
            sx = (e.input.mv && e.input.mv[0]) || 0;
          e.input.mv = d > 1.4 ? [0.35 * sx, -1] : [sx, 0];
        }
      } catch (x) {}
      return r;
    };
  }

  // the HUD: which gun now, which next
  function paintHud() {
    let el = $("gg-hud");
    const on = "gun" === mode() && inMatch() && "menu" !== world.phase && "over" !== world.phase;
    if (!on) return void (el && (el.hidden = !0));
    if (!el) {
      el = document.createElement("div");
      el.id = "gg-hud";
      el.style.cssText = "position:absolute;top:86px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;padding:5px 14px;border-radius:999px;background:rgba(10,13,18,.72);border:1px solid rgba(255,200,73,.45);color:#ffc849;font:700 12px/1.4 var(--f-display,system-ui);letter-spacing:.06em;white-space:nowrap";
      ($("hud") || document.body).appendChild(el);
    }
    const me = ("function" == typeof myActor && myActor()) || player,
      i = level(me),
      k = LADDER[i],
      n = LADDER[i + 1];
    el.hidden = !1;
    el.textContent = `${L("총기 순환", "Gun Game")} ${i + 1}/${LADDER.length} · ${WEAPONS[k] ? WEAPONS[k].name : k}${n ? L(` → 다음 ${WEAPONS[n] ? WEAPONS[n].name : n}`, ` → next ${WEAPONS[n] ? WEAPONS[n].name : n}`) : L(" · 칼로 끝내기", " · finish with the knife")}`;
  }

  window.GUN_GAME = { LADDER, want, fit, level };
})();
