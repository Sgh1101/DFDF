
(() => {
  const $ = (id) => document.getElementById(id);
  const inMatch = () => world.actors && world.actors.length > 0 && "menu" !== world.phase;
  const meA = () => ("function" == typeof myActor && myActor()) || null;
  const myPeer = () => (NET.peer && NET.peer.id) || NET.id;
  const nameOf = (a) => (a && (a.name || (a.agent && a.agent.name))) || "?";
  const respawnMode = () => !!(window.GAME_MODES && GAME_MODES[room.mode] && GAME_MODES[room.mode].respawn);

  // ═════════ 1. taking over a teammate bot ═════════
  // After a takeover the old body was left with ctrl "dead" forever, so from
  // the next round it stood frozen. Give such bodies back to the AI.
  function releaseDead() {
    for (const a of world.actors || [])
      if ("dead" === a.ctrl) {
        a.ctrl = "ai";
        a.ai = freshAIState();
        // hand back the bot name it lent the player
        a.name = a._releaseName || (typeof BOT_NAMES !== "undefined" ? BOT_NAMES[a.id % BOT_NAMES.length] : a.name);
        "host" === NET.mode && sendEventAll({ t: "ctrl", id: a.id, ctrl: "ai", name: a.name });
      }
  }
  // Clients used to take over locally only; the host never knew, so nothing
  // moved. Clients now ask the host, which moves control and tells everyone.
  const _toa = takeOverAlly;
  takeOverAlly = function (e) {
    if ("client" === NET.mode) {
      const me = meA();
      if (!me || me.alive) return !1;
      sendAction({ t: "takeover", id: e ? e.id : null });
      return !0;
    }
    const prev = meA(),
      names = new Map((world.actors || []).map((o) => [o.id, o.name])),
      r = _toa.apply(this, arguments);
    const now = meA();
    r && now && prev && now !== prev && (prev._releaseName = names.get(now.id));
    r && "host" === NET.mode && now && sendEventAll({ t: "ctrl", id: now.id, ctrl: NET.id, old: prev && prev.id, name: now.name });
    return r;
  };
  function hostTakeover(peer, want) {
    const a = world.actors.find((o) => o.ctrl === peer);
    if (!a || a.alive || "live" !== world.phase || world.over || respawnMode()) return;
    const cands = world.actors.filter((o) => o.alive && o.team === a.team && isAI(o));
    const t = (null != want && cands.find((o) => o.id === want)) || cands.sort((x, y) => y.hp - x.hp)[0];
    if (!t) return;
    a.ctrl = "dead";
    a._releaseName = t.name;
    takeOver(t.id, peer);
    t.name = a.name;
    try {
      const m = room.members.get(peer);
      m && (m.actorId = t.id);
    } catch (e) {}
    sendEventAll({ t: "ctrl", id: t.id, ctrl: peer, old: a.id, name: t.name });
    sendEventTo(peer, { t: "wallet", c: t.credits, w: t.weapons, am: t.ammo, ar: t.armor, s: t.slot });
  }
  function localBecome(t, name) {
    t.ctrl = "me";
    t.ai = null;
    t.input = { mv: [0, 0], yaw: t.yaw, pitch: t.pitch || 0, btn: 0, seq: 0 };
    name && (t.name = name);
    bindLocalPlayer(t);
    t.agent && document.documentElement.style.setProperty("--ac", t.agent.color);
    try {
      updateViewmodel(!0);
    } catch (e) {}
    const sp = $("spectate");
    sp && sp.classList.remove("on");
    $("hud").classList.remove("dead");
    banner(`${t.agent ? t.agent.name : "아군"} 인계 — 조작 가능`, "#4ade80");
    rosterKey = "";
    $("skills") && ($("skills").dataset.key = "");
    try {
      paintTouchAbil();
    } catch (e) {}
  }
  function onCtrl(e) {
    const t = actorById(e.id),
      o = null != e.old ? actorById(e.old) : null;
    o && "me" !== o.ctrl && (o.ctrl = "dead");
    if (!t) return;
    if (e.ctrl === myPeer()) {
      o && (o.ctrl = "dead");
      localBecome(t, e.name);
    } else {
      t.ctrl = e.ctrl;
      e.name && (t.name = e.name);
    }
    "ai" === e.ctrl && (t.ai = t.ai || freshAIState());
    rosterKey = "";
  }
  // client: ask for a takeover shortly after dying, like the host does
  let wasAlive = null;
  const _as = applySnapshot;
  applySnapshot = function () {
    const me = meA(),
      before = me ? me.alive : null;
    const r = _as.apply(this, arguments);
    const now = meA();
    if (now && before && !now.alive && !respawnMode()) {
      banner("사망 · 아군 인계 대기", "#ff3b4e");
      setTimeout(() => {
        const m = meA();
        m && !m.alive && "live" === world.phase && !world.over && takeOverAlly(null);
      }, 1700);
    }
    return r;
  };

  // ═════════ 2. bots that stop: watchdog + keep the host running in background ═════════
  const WD = new Map();
  function watchdog(dt) {
    if (!isHost() || "live" !== world.phase) return WD.clear();
    for (const a of world.actors) {
      if (!a.alive || !isAI(a) || !a.ai || a.planting > 0 || a.defusing > 0 || "fight" === a.ai.state) {
        WD.delete(a.id);
        continue;
      }
      let w = WD.get(a.id);
      w || WD.set(a.id, (w = { x: a.pos.x, z: a.pos.z, t: 0, n: 0 }));
      w.t += dt;
      if (Math.hypot(a.pos.x - w.x, a.pos.z - w.z) > 1) Object.assign(w, { x: a.pos.x, z: a.pos.z, t: 0, n: 0 });
      if (w.t < 6) continue;
      let g = null;
      try {
        g = aiGoal(a);
      } catch (e) {}
      if (!g || Math.hypot(g.x - a.pos.x, g.z - a.pos.z) < 4) {
        w.t = 0;
        continue;
      }
      // first try a fresh path; if still stuck, step to the nearest open cell
      w.n++;
      Object.assign(a.ai, { path: [], pathIdx: 0, repathCd: 0, detour: null, stuck: 0, lastP: null });
      if (w.n >= 2) {
        try {
          const cx = Math.floor((a.pos.x - GRID.minX) / GRID.cell),
            cz = Math.floor((a.pos.z - GRID.minZ) / GRID.cell),
            [nx, nz] = nearestWalkable(cx, cz),
            c = cellCenter(nx, nz);
          !collideXZ(c.x, c.z, a.y || 0, PR) && a.pos.set(c.x, a.y || 0, c.z);
        } catch (e) {}
        window.BOT_NUDGES = (window.BOT_NUDGES || 0) + 1;
      }
      w.t = 0;
    }
  }
  // Background simulation is owned by the networking loop below.

  // ═════════ 3. stats: damage log, K/D/A, damage per player ═════════
  const ST = new Map(); // id -> {k,d,a,dmg}
  const st = (id) => ST.get(id) || (ST.set(id, { k: 0, d: 0, a: 0, dmg: 0 }), ST.get(id));
  const HITS = new Map(); // victimId -> Map(attackerId -> t) for assists
  let LOG = { round: 1, rows: [] }; // my combat log rows: {from,to,amt,head,kill,round}
  const logRow = (r) => LOG.rows.push(Object.assign({ round: world.round }, r));
  function recordHit(att, vic, amt, head) {
    if (!att || !vic || att === vic || !(amt > 0)) return;
    st(att.id).dmg += amt;
    const m = HITS.get(vic.id) || (HITS.set(vic.id, new Map()), HITS.get(vic.id));
    m.set(att.id, world._clock || 0);
    const ev = { from: att.id, to: vic.id, amt: Math.round(amt), head: !!head };
    const me = meA();
    me && (att === me || vic === me) && logRow(ev);
    // tell remote players about hits they were part of: a shotgun shot is 7-10 pellets, which go out as one event per target
    "host" === NET.mode && queueHit(att, vic, amt, head);
  }
  const HITQ = new Map();
  function queueHit(att, vic, amt, head) {
    const key = att.id + ">" + vic.id;
    let q = HITQ.get(key);
    q || (HITQ.set(key, (q = { att, vic, amt: 0, head: !1 })), 1 === HITQ.size && queueMicrotask(flushHits));
    q.amt += amt;
    q.head = q.head || !!head;
  }
  function flushHits() {
    const list = [...HITQ.values()];
    HITQ.clear();
    if ("host" !== NET.mode) return;
    for (const q of list) {
      const ev = { t: "hit", from: q.att.id, to: q.vic.id, amt: Math.round(q.amt), head: q.head };
      for (const x of [q.att, q.vic]) x.ctrl && "me" !== x.ctrl && "dead" !== x.ctrl && !isAI(x) && sendEventTo(x.ctrl, ev);
    }
  }
  const _dd = dealDamage;
  dealDamage = function (e, t, o, a) {
    if ("client" === NET.mode || !e) return _dd.apply(this, arguments);
    const hp = e.hp + (e.armor || 0);
    const r = _dd.apply(this, arguments);
    try {
      a && a.pos && recordHit(a, e, Math.min(hp, hp - (e.alive ? e.hp + (e.armor || 0) : 0)), o);
    } catch (x) {}
    return r;
  };
  const _ka = killActor;
  killActor = function (e, t) {
    const r = _ka.apply(this, arguments);
    try {
      if (isHost()) {
        st(e.id).d++;
        t && t !== e && t.team !== e.team && st(t.id).k++;
        const m = HITS.get(e.id),
          now = world._clock || 0;
        m && m.forEach((when, id) => id !== (t && t.id) && now - when < 12 && st(id).a++);
        HITS.delete(e.id);
        const me = meA();
        me && t === me && logRow({ from: t.id, to: e.id, amt: 0, kill: !0 });
        me && e === me && t && logRow({ from: t.id, to: e.id, amt: 0, kill: !0 });
        if ("host" === NET.mode) for (const x of [t, e]) x && x.ctrl && "me" !== x.ctrl && !isAI(x) && "dead" !== x.ctrl && sendEventTo(x.ctrl, { t: "hit", from: t ? t.id : -1, to: e.id, amt: 0, kill: !0 });
        dropWeapon(e);
      }
    } catch (x) {}
    return r;
  };
  // a guest's ping in ms (its own reading, sent with its ping message); -1 for the host's player, a bot, or a build without one
  const pingOf = (a) => {
    if ("host" === NET.mode) { const o = a.ctrl && NET.conns.get(a.ctrl); return o && null != o.ping ? o.ping : -1; }
    if ("client" === NET.mode) return "me" === a.ctrl ? NET.latency || -1 : null != st(a.id).p ? st(a.id).p : -1;
    return -1;
  };
  let sbT = 0;
  function syncStats(dt) {
    if ("host" !== NET.mode || (sbT += dt) < 1) return;
    sbT = 0;
    sendEventAll({ t: "sb", r: world.actors.map((a) => { const s = st(a.id); return [a.id, s.k, s.d, s.a, Math.round(s.dmg), pingOf(a)]; }) });
  }

  // ═════════ 4. dropped weapons: pick up / swap ═════════
  let DROPS = [],
    dropId = 0;
  function gunMesh(key) {
    const g = new T.Group();
    let m = null;
    try {
      m = GUN_BUILD[key] ? GUN_BUILD[key]() : null;
    } catch (e) {}
    if (!m) {
      m = new T.Group();
      const b = new T.Mesh(TP_GUN.body, TP_GUN.mBody);
      m.add(b);
      const br = new T.Mesh(TP_GUN.barrel, TP_GUN.mDark);
      br.rotation.x = Math.PI / 2;
      br.position.set(0, 0.012, -0.4);
      m.add(br);
    }
    m.rotation.set(0, 0, Math.PI / 2);
    m.position.y = 0.12;
    g.add(m);
    const ring = new T.Mesh(new T.RingGeometry(0.45, 0.55, 24), new T.MeshBasicMaterial({ color: 0xffc849, transparent: !0, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: !1, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
    g.userData.spin = m;
    scene.add(g);
    return g;
  }
  function addDrop(key, x, z, ammo, id) {
    const d = { id: null != id ? id : ++dropId, key, x, z, ammo: null != ammo ? ammo : (WEAPONS[key] || {}).mag, t: 0 };
    d.mesh = gunMesh(key);
    d.mesh.position.set(x, 0, z);
    DROPS.push(d);
    return d;
  }
  function removeDrop(d) {
    d.mesh && scene.remove(d.mesh);
    DROPS = DROPS.filter((x) => x !== d);
  }
  function clearDrops() {
    DROPS.forEach((d) => d.mesh && scene.remove(d.mesh));
    DROPS = [];
  }
  function syncDrops() {
    "host" === NET.mode && sendEventAll({ t: "drops", l: DROPS.map((d) => [d.id, d.key, Q.pos(d.x), Q.pos(d.z)]) });
  }
  function dropWeapon(a) {
    const k = a.weapons && a.weapons.primary;
    if (!k || !WEAPONS[k]) return;
    addDrop(k, a.pos.x + rnd(-0.3, 0.3), a.pos.z + rnd(-0.3, 0.3), a.ammo[k]);
    // round modes: the gun is gone until you rebuy; respawn modes keep yours
    if (!respawnMode()) {
      a.weapons.primary = null;
      a.slot = "secondary";
    }
    syncDrops();
  }
  function give(a, d) {
    const old = a.weapons.primary;
    if (old && WEAPONS[old]) addDrop(old, a.pos.x, a.pos.z, a.ammo[old]);
    a.weapons.primary = d.key;
    a.ammo[d.key] = null != d.ammo ? d.ammo : WEAPONS[d.key].mag;
    a.reserve[d.key] = 999999;
    a.slot = "primary";
    a.reloading = 0;
    removeDrop(d);
    try {
      syncActorModel(a);
    } catch (e) {}
    // after the model: the gun just put down is given its owner's skin there, and the list carries it
    syncDrops();
    if ("me" === a.ctrl) {
      banner(`${WEAPONS[d.key].name} 획득`, "#ffc849");
      try {
        updateViewmodel(!0);
      } catch (e) {}
    } else if ("host" === NET.mode && a.ctrl && !isAI(a) && "dead" !== a.ctrl) sendEventTo(a.ctrl, { t: "wallet", c: a.credits, w: a.weapons, am: a.ammo, ar: a.armor, s: a.slot });
  }
  const nearDrop = (a, r) => {
    let best = null,
      bd = r || 1.9;
    for (const d of DROPS) {
      const q = Math.hypot(a.pos.x - d.x, a.pos.z - d.z);
      q < bd && ((bd = q), (best = d));
    }
    return best;
  };
  function nearGimmick(a) {
    const G = window.MAP_GIMMICKS;
    if (!G) return !1;
    for (const d of G.door || []) for (const s of d.sws) if (Math.hypot(a.pos.x - s.x, a.pos.z - s.z) < 2.2) return !0;
    for (const z of G.zip || []) for (const p of [z.a, z.b]) if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 2.2) return !0;
    return !!a._zip;
  }
  function tickDrops(dt) {
    const now = performance.now() / 1e3;
    for (const d of DROPS) d.mesh && d.mesh.userData.spin && (d.mesh.userData.spin.rotation.y = now * 0.8, (d.mesh.position.y = 0.05 * Math.sin(now * 2 + d.id)));
    if (!isHost() || !inMatch()) return;
    // anyone without a main weapon grabs one they walk over; old drops fade in respawn modes
    for (const d of DROPS.slice()) {
      d.t += dt;
      if (respawnMode() && d.t > 25) {
        removeDrop(d);
        syncDrops();
        continue;
      }
      for (const a of world.actors)
        if (a.alive && !(a.weapons && a.weapons.primary) && Math.hypot(a.pos.x - d.x, a.pos.z - d.z) < 1.2) {
          give(a, d);
          break;
        }
    }
  }
  function pickHint() {
    const me = meA(),
      h = $("pick-hint");
    if (!h) return;
    const d = me && me.alive && !nearGimmick(me) ? nearDrop(me) : null;
    if (!d) return void (h.hidden = !0);
    const touch = document.body.classList.contains("touching"),
      cur = me.weapons && me.weapons.primary;
    const txt = `${touch ? "탭" : "F"} · ${WEAPONS[d.key].name}${cur ? "(으)로 교체" : " 줍기"}`;
    h.textContent !== txt && (h.textContent = txt);
    h.hidden = !1;
  }
  function tryPickup() {
    const me = meA();
    if (!me || !me.alive || !inMatch() || nearGimmick(me)) return;
    const d = nearDrop(me);
    if (!d) return;
    "client" === NET.mode ? sendAction({ t: "pickup", id: d.id }) : give(me, d);
  }
  addEventListener("keydown", (e) => {
    KEYMAP.is(e, "use") && !KEYMAP.editing(e.target) && !e.repeat && tryPickup();
  });

  // ═════════ 5. network glue ═════════
  const _oa = NET.onAction;
  NET.onAction = (peer, msg) => {
    if (msg && "takeover" === msg.t) return void hostTakeover(peer, msg.id);
    if (msg && "pickup" === msg.t) {
      const a = world.actors.find((o) => o.ctrl === peer),
        d = DROPS.find((x) => x.id === msg.id);
      a && d && a.alive && Math.hypot(a.pos.x - d.x, a.pos.z - d.z) < 2.6 && give(a, d);
      return;
    }
    return _oa(peer, msg);
  };
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (!e) return _oe(e);
    if ("ctrl" === e.t) return void onCtrl(e);
    if ("sb" === e.t) return void e.r.forEach(([id, k, d, a, dmg, p]) => ST.set(id, { k, d, a, dmg, p }));
    if ("hit" === e.t) {
      logRow({ from: e.from, to: e.to, amt: e.amt, head: e.head, kill: e.kill });
      // the host's own hits get their marker, sound and number where the shot is fired; a guest's shot is fired there, so it hears of the hit here
      const me = "client" === NET.mode && meA(), vic = me && !e.kill && e.amt > 0 && e.from === me.id && actorById(e.to);
      if (vic && vic.team === me.team) return;
      if (vic) {
        try { hitMarker(!!e.head); SFX.hit(!!e.head); dmgNumber(vic, e.amt, !!e.head); } catch (x) {}
        world.stats.hits++;
        world.stats.dmg += e.amt;
      }
      return;
    }
    if ("drops" === e.t) {
      const keep = new Set(e.l.map((r) => r[0]));
      DROPS.slice().forEach((d) => keep.has(d.id) || removeDrop(d));
      for (const [id, key, x, z] of e.l) DROPS.some((d) => d.id === id) || addDrop(key, Q.unpos(x), Q.unpos(z), null, id);
      return;
    }
    return _oe(e);
  };

  // ═════════ 6. round / step hooks ═════════
  const _sr = startRound;
  startRound = function () {
    if (isHost()) {
      releaseDead();
      clearDrops();
      syncDrops();
    }
    HITS.clear();
    const r = _sr.apply(this, arguments);
    return r;
  };
  const _lsReset = lobbyStart;
  lobbyStart = function () {
    ST.clear();
    LOG = { round: 1, rows: [] };
    clearDrops();
    return _lsReset.apply(this, arguments);
  };
  const _cbm = clientBeginMatch;
  clientBeginMatch = function () {
    ST.clear();
    LOG = { round: 1, rows: [] };
    clearDrops();
    return _cbm.apply(this, arguments);
  };
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      dt = dt || 0.016;
      watchdog(dt);
      tickDrops(dt);
      syncStats(dt);
      pickHint();
      boardOpen && paintBoard();
    } catch (e) {}
    return r;
  };

  // ═════════ 7. UI: scoreboard (Tab) + combat log (N) ═════════
  const css = document.createElement("style");
  css.textContent = `
#pick-hint{position:absolute;left:50%;bottom:204px;transform:translateX(-50%);padding:7px 15px;border-radius:999px;border:1px solid rgba(255,200,73,.5);background:rgba(20,16,6,.72);color:#ffe7a8;font-size:12.5px;pointer-events:none;white-space:nowrap}
#pick-hint[hidden]{display:none}
body.touching #pick-hint{pointer-events:auto;padding:10px 18px}
#board{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:14px;pointer-events:none}
#board[hidden]{display:none}
.bd-card{pointer-events:auto;width:min(860px,100%);max-height:92vh;overflow:auto;padding:14px 16px 16px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(18,22,30,.94),rgba(10,13,18,.94));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 20px 60px rgba(0,0,0,.55)}
.bd-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.bd-tabs{display:flex;gap:4px;padding:3px;border-radius:12px;background:rgba(255,255,255,.04)}
.bd-tabs button{padding:6px 14px;border-radius:9px;font-size:12.5px;color:var(--steel);border:0;background:none;cursor:pointer;font-family:inherit}
.bd-tabs button.on{background:rgba(255,255,255,.1);color:var(--ink)}
.bd-score{margin-left:auto;font-family:var(--f-display);font-size:14px;letter-spacing:.06em;color:var(--steel)}
.bd-score b{color:var(--ink)}
.bd-x{margin-left:6px;padding:6px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:none;color:var(--steel);cursor:pointer}
.bd-team{margin-top:8px}
.bd-team h4{font-size:11px;letter-spacing:.16em;margin:0 0 4px 4px;font-weight:700}
.bd-team.mine h4{color:#38d6ff}.bd-team.foe h4{color:#ff4a5c}
.bd-row{display:grid;grid-template-columns:34px minmax(0,1.6fr) repeat(4,minmax(0,.6fr)) minmax(0,.5fr) minmax(0,.7fr);align-items:center;gap:6px;padding:5px 6px;border-radius:10px;font-size:12.5px}
.bd-row:nth-child(even){background:rgba(255,255,255,.025)}
.bd-row.hd{font-size:10px;letter-spacing:.14em;color:var(--steel-dim);background:none!important}
.bd-row.me{background:color-mix(in srgb,var(--gold) 12%,transparent)!important}
.bd-row.dead{opacity:.5}
.bd-row img{width:30px;height:30px;border-radius:8px;object-fit:cover}
.bd-row .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bd-row .nm small{display:block;font-size:10px;color:var(--steel)}
.bd-row .n{text-align:center;font-family:var(--f-display);font-size:12px}
.bd-row .ult{text-align:center;font-size:10.5px;color:var(--gold)}
.cl-sec{margin-top:10px}
.cl-sec h4{font-size:11px;letter-spacing:.16em;color:var(--steel);margin:0 0 6px 2px}
.cl-row{display:grid;grid-template-columns:30px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) 54px;gap:8px;align-items:center;padding:6px;border-radius:10px;font-size:12.5px}
.cl-row:nth-child(even){background:rgba(255,255,255,.025)}
.cl-row img{width:28px;height:28px;border-radius:7px;object-fit:cover}
.cl-row .out{color:#ffcf5a}.cl-row .in{color:#ff7a86}
.cl-row small{color:var(--steel);font-size:10.5px}
.cl-row .k{text-align:center;font-size:11px}
.cl-empty{padding:14px;color:var(--steel);font-size:12px;text-align:center}
.cl-sum{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.cl-sum div{flex:1;min-width:120px;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.04)}
.cl-sum b{display:block;font-family:var(--f-display);font-size:18px}
.cl-sum small{font-size:10.5px;color:var(--steel)}
#netping{position:absolute;left:14px;top:40px;z-index:48;pointer-events:none;font-family:var(--f-display);font-weight:700;font-size:12px;letter-spacing:.06em;background:rgba(8,11,16,.6);padding:3px 9px;border-radius:8px;backdrop-filter:blur(4px)}
#netping[hidden],body:has(#shop:not([hidden])) #netping{display:none}
body.touching #netping{left:auto;right:14px;top:80px}
.bd-row .pg{color:var(--steel)}
#board.np .pg{display:none}
#board.np .bd-row{grid-template-columns:34px minmax(0,1.6fr) repeat(4,minmax(0,.6fr)) minmax(0,.7fr)}
@media (max-width:600px){#board.np .bd-row{grid-template-columns:28px minmax(0,1.4fr) repeat(4,minmax(0,.55fr))}.bd-row{grid-template-columns:28px minmax(0,1.4fr) repeat(4,minmax(0,.55fr)) minmax(0,.55fr);font-size:11.5px}.bd-row .ult{display:none}.cl-row{grid-template-columns:26px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);font-size:11.5px}.cl-row .k{display:none}}
`;
  document.head.appendChild(css);
  // ping next to the FPS counter (same setting), guests only
  const np = document.createElement("div");
  np.id = "netping";
  np.hidden = !0;
  ($("fps") && $("fps").parentNode || $("hud") || document.body).appendChild(np);
  setInterval(() => {
    const on = SETTINGS.showFps && "client" === NET.mode && NET.latency > 0;
    np.hidden = !on;
    if (on) {
      np.textContent = NET.latency + " ms";
      np.style.color = NET.latency <= 80 ? "#4ade80" : NET.latency <= 160 ? "#ffc849" : "#ff6b6b";
    }
  }, 500);
  const ph = document.createElement("div");
  ph.id = "pick-hint";
  ph.hidden = !0;
  ($("hud") || document.body).appendChild(ph);
  ph.addEventListener("pointerdown", (e) => (e.preventDefault(), e.stopPropagation(), tryPickup()));
  $("tb-use") && $("tb-use").addEventListener("pointerdown", () => tryPickup());
  const board = document.createElement("div");
  board.id = "board";
  board.hidden = !0;
  board.innerHTML = '<div class="bd-card"><div class="bd-top"><div class="bd-tabs"><button data-v="sb" class="on">점수판</button><button data-v="cl">전투 기록</button></div><div class="bd-score" id="bd-score"></div><button class="bd-x" id="bd-x">닫기</button></div><div id="bd-body"></div></div>';
  document.body.appendChild(board);
  let boardOpen = !1,
    view = "sb",
    boardSticky = !1,
    paintT = 0;
  const PIC = {};
  const pic = (a) => (a && a.agent ? PIC[a.agent.key] || (PIC[a.agent.key] = agentPortrait(a.agent, 72, 88)) : "");
  function openBoard(v, sticky) {
    if (!inMatch()) return;
    view = v;
    boardSticky = !!sticky;
    boardOpen = !0;
    board.hidden = !1;
    board.querySelectorAll(".bd-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.v === view));
    paintT = 0;
    paintBoard(!0);
  }
  function closeBoard() {
    boardOpen = !1;
    board.hidden = !0;
  }
  board.querySelectorAll(".bd-tabs button").forEach((b) => (b.onclick = () => openBoard(b.dataset.v, !0)));
  $("bd-x").onclick = closeBoard;
  function paintBoard(force) {
    const now = performance.now();
    if (!force && now - paintT < 250) return;
    paintT = now;
    board.classList.toggle("np", "solo" === NET.mode);
    const me = meA() || player;
    const ffa = window.GAME_MODES && GAME_MODES[room.mode] && GAME_MODES[room.mode].ffa;
    const mine = "atk" === me.team ? world.scoreAtk : world.scoreDef,
      theirs = "atk" === me.team ? world.scoreDef : world.scoreAtk;
    $("bd-score").innerHTML = ffa ? `데스매치 · <b>${me.kills || 0}</b>킬` : `<b>${mine}</b> : <b>${theirs}</b> · ${world.round} 라운드`;
    $("bd-body").innerHTML = "sb" === view ? sbHTML(me, ffa) : clHTML(me);
  }
  function rowHTML(a, me, showUlt) {
    const s = st(a.id);
    let p;
    return `<div class="bd-row${a === me ? " me" : ""}${a.alive ? "" : " dead"}"><img src="${pic(a)}" alt=""><div class="nm">${String(nameOf(a)).replace(/[&<>"']/g,c=>"&#"+c.charCodeAt(0)+";")}${window.LV_CHIP ? LV_CHIP.html(a) : ""}<small>${a.agent ? a.agent.name : ""}${isAI(a) ? " · AI" : ""}</small></div><div class="n">${s.k}</div><div class="n">${s.d}</div><div class="n">${s.a}</div><div class="n">${Math.round(s.dmg)}</div><div class="n pg">${(p = pingOf(a)) >= 0 ? p : ""}</div><div class="ult">${showUlt ? `궁 ${a.ultCharge || 0}/${a.ultMax || 5}` : ""}</div></div>`;
  }
  const HEAD = '<div class="bd-row hd"><span></span><span>플레이어</span><span class="n">킬</span><span class="n">데스</span><span class="n">도움</span><span class="n">피해</span><span class="n pg">핑</span><span></span></div>';
  function sbHTML(me, ffa) {
    const by = (l) => l.slice().sort((x, y) => st(y.id).k - st(x.id).k || st(y.id).dmg - st(x.id).dmg);
    if (ffa) return `<div class="bd-team mine"><h4>전체</h4>${HEAD}${by(world.actors).map((a) => rowHTML(a, me, !1)).join("")}</div>`;
    const t = me.team;
    return `<div class="bd-team mine"><h4>아군</h4>${HEAD}${by(world.actors.filter((a) => a.team === t)).map((a) => rowHTML(a, me, !0)).join("")}</div><div class="bd-team foe"><h4>적군</h4>${HEAD}${by(world.actors.filter((a) => a.team !== t)).map((a) => rowHTML(a, me, !1)).join("")}</div>`;
  }
  function clHTML(me) {
    // during the buy phase show the round that just ended
    const r = "buy" === world.phase && world.round > 1 ? world.round - 1 : world.round;
    const rows = LOG.rows.filter((x) => x.round === r);
    const per = new Map();
    const add = (id) => per.get(id) || (per.set(id, { out: 0, outN: 0, outH: 0, in: 0, inN: 0, inH: 0, killed: !1, killedBy: !1 }), per.get(id));
    for (const x of rows) {
      if (x.from === me.id && x.to !== me.id) {
        const p = add(x.to);
        x.kill ? (p.killed = !0) : ((p.out += x.amt), p.outN++, x.head && p.outH++);
      } else if (x.to === me.id) {
        const p = add(x.from);
        x.kill ? (p.killedBy = !0) : ((p.in += x.amt), p.inN++, x.head && p.inH++);
      }
    }
    let out = 0,
      inn = 0,
      hits = 0,
      heads = 0;
    per.forEach((p) => ((out += p.out), (inn += p.in), (hits += p.outN), (heads += p.outH)));
    const allOut = LOG.rows.filter((x) => x.from === me.id && !x.kill && x.to !== me.id).reduce((s, x) => s + x.amt, 0);
    const list = [...per.entries()]
      .map(([id, p]) => {
        const a = actorById(id);
        return `<div class="cl-row"><img src="${pic(a)}" alt=""><div>${String(nameOf(a)).replace(/[&<>"']/g,c=>"&#"+c.charCodeAt(0)+";")}<br><small>${a && a.agent ? a.agent.name : ""}</small></div><div class="out">준 피해 ${p.out}<br><small>${p.outN}회 적중${p.outH ? ` · 머리 ${p.outH}` : ""}</small></div><div class="in">받은 피해 ${p.in}<br><small>${p.inN}회 피격${p.inH ? ` · 머리 ${p.inH}` : ""}</small></div><div class="k">${p.killed ? "처치" : p.killedBy ? "사망" : ""}</div></div>`;
      })
      .join("");
    return `<div class="cl-sum"><div><b>${out}</b><small>${r} 라운드 준 피해</small></div><div><b>${inn}</b><small>받은 피해</small></div><div><b>${hits ? Math.round((heads / hits) * 100) : 0}%</b><small>헤드샷 비율 (${heads}/${hits})</small></div><div><b>${Math.round(allOut)}</b><small>경기 전체 준 피해</small></div></div><div class="cl-sec"><h4>${r} 라운드 교전 상대</h4>${list || '<div class="cl-empty">아직 이번 라운드 교전 기록이 없습니다</div>'}</div>`;
  }
  addEventListener(
    "keydown",
    (e) => {
      if (!inMatch() || document.body.classList.contains("mb-editing") || ["pause", "shop", "admin", "armory", "mis"].some((id) => {
        const node = $(id); return node && !node.hidden && node.getClientRects().length > 0;
      })) return;
      if (KEYMAP.editing(e.target) && "Escape" !== e.key) return;
      if (KEYMAP.is(e, "scoreboard")) {
        if (boardOpen && boardSticky) return;
        e.preventDefault();
        e.repeat || boardOpen || openBoard("sb", !1);
      } else if (KEYMAP.is(e, "combatlog") && !e.repeat && !e.ctrlKey && !e.metaKey) {
        boardOpen && "cl" === view ? closeBoard() : openBoard("cl", !0);
      } else if ("Escape" === e.key && boardOpen) {
        closeBoard();
        e.stopImmediatePropagation();
      }
    },
    !0
  );
  addEventListener("keyup", (e) => {
    KEYMAP.is(e, "scoreboard") && boardOpen && !boardSticky && closeBoard();
  });
  // phones: tap the score bar
  $("topbar") && $("topbar").addEventListener("click", () => (boardOpen ? closeBoard() : openBoard("sb", !0)));
  window.QOL = { ST, LOG: () => LOG, DROPS: () => DROPS, openBoard, closeBoard, tryPickup };

  // ═════════ 8. crosshair settings ═════════
  const XD = { style: "cross", color: "#ffffff", len: 5, thick: 2, gap: 3, dot: !1, outline: !0, dyn: !0, alpha: 1 };
  let XH = Object.assign({}, XD);
  try {
    Object.assign(XH, JSON.parse(localStorage.getItem("lgp_xhair") || "{}"));
  } catch (e) {}
  const saveX = () => {
    try {
      localStorage.setItem("lgp_xhair", JSON.stringify(XH));
    } catch (e) {}
  };
  // the account's settings (js/legacy/117) read the crosshair and put a changed one back through here
  window.XHAIR = {
    get: () => Object.assign({}, XH),
    set: (o) => {
      XH = Object.assign({}, XD, o);
      saveX();
      const c = $("cross");
      c && ((c._x = ""), drawCross(c, 0));
    },
  };
  function drawCross(el, spread) {
    if (!el) return;
    const c = XH,
      sh = c.outline ? "0 0 0 1px rgba(0,0,0,.85)" : "none",
      // the bars of a cross sit at the resting gap; the spread of a moving or firing player slides them with a transform
      // (the markup stays, nothing is laid out again), whole pixels so they stay sharp
      sp = c.dyn ? Math.round(spread) : 0,
      g = c.gap + sp,
      L = c.len,
      t = c.thick;
    const parts = [];
    const bar = (x, y, w, h, dx, dy) => parts.push(`<i data-d="${dx},${dy}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${c.color};box-shadow:${sh};opacity:${c.alpha}"></i>`);
    if ("cross" === c.style || "t" === c.style) {
      const g0 = c.gap;
      "t" === c.style || bar(-t / 2, -g0 - L, t, L, 0, -1);
      bar(-t / 2, g0, t, L, 0, 1);
      bar(-g0 - L, -t / 2, L, t, -1, 0);
      bar(g0, -t / 2, L, t, 1, 0);
    }
    if ("circle" === c.style) {
      const r = Math.max(4, g + L / 2);
      parts.push(`<i style="left:${-r}px;top:${-r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:none;border:${t}px solid ${c.color};box-shadow:${c.outline ? "0 0 0 1px rgba(0,0,0,.7), inset 0 0 0 1px rgba(0,0,0,.7)" : "none"};opacity:${c.alpha};box-sizing:border-box"></i>`);
    }
    if (c.dot || "dot" === c.style) {
      const d = Math.max(2, t + ("dot" === c.style ? 1 : 0));
      parts.push(`<i style="left:${-d / 2}px;top:${-d / 2}px;width:${d}px;height:${d}px;border-radius:50%;background:${c.color};box-shadow:${sh};opacity:${c.alpha}"></i>`);
    }
    const html = parts.join("");
    el._x !== html && ((el.innerHTML = html), (el._x = html), (el._sp = null));
    if (el._sp !== sp) {
      el._sp = sp;
      for (const i of el.children) {
        const d = i.dataset.d;
        if (!d) continue;
        const [dx, dy] = d.split(",");
        i.style.transform = sp ? `translate(${dx * sp}px,${dy * sp}px)` : "";
      }
    }
  }
  const crossStyle = document.createElement("style");
  crossStyle.textContent = "#cross.xh{width:0!important;height:0!important}#cross.xh i{position:absolute;transition:none}";
  document.head.appendChild(crossStyle);
  buildCross = function () {
    const el = $("cross");
    el && (el.classList.add("xh"), (el._x = ""), drawCross(el, 0));
  };
  updateCross = function () {
    const el = $("cross");
    if (!el) return;
    el.classList.add("xh");
    const v = player.vel || { x: 0, z: 0 };
    drawCross(el, Math.max(0, 1.5 * Math.hypot(v.x, v.z) + 9 * (player.recoil || 0) + (player.ads ? -1.5 : 0)));
  };
  // settings pane
  (function addPane() {
    const tabs = document.querySelector("#pause .pz-tabs"),
      set = document.querySelector("#pause .pz-set");
    if (!tabs || !set) return;
    const tb = document.createElement("button");
    tb.dataset.tab = "xhair";
    tb.textContent = "조준점";
    tabs.appendChild(tb);
    const pane = document.createElement("div");
    pane.className = "pz-pane";
    pane.dataset.pane = "xhair";
    const COLORS = ["#ffffff", "#4ade80", "#22d3ee", "#ffe14d", "#ff4fd8", "#ff3b4e"];
    const STY = [["cross", "십자"], ["dot", "점"], ["circle", "원"], ["t", "T자"]];
    pane.innerHTML = `<div class="pz-row pz-wide xh-top"><div class="xh-prev"><div id="xh-prev"></div></div><div class="xh-ctl">
      <div class="xh-line"><span>모양</span><div class="xh-seg" id="xh-style">${STY.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join("")}</div></div>
      <div class="xh-line"><span>색</span><div class="xh-seg" id="xh-color">${COLORS.map((c) => `<button data-v="${c}" style="--c:${c}"><i></i></button>`).join("")}<input type="color" id="xh-custom"></div></div>
      </div></div>
      ${[["len", "길이", 1, 14, 1], ["thick", "두께", 1, 5, 1], ["gap", "간격", 0, 12, 1], ["alpha", "불투명도", 0.3, 1, 0.05]].map(([k, n, a, b, s]) => `<div class="pz-row"><div class="xh-line"><span>${n}</span><input type="range" id="xh-${k}" min="${a}" max="${b}" step="${s}"><b id="xh-${k}-v"></b></div></div>`).join("")}
      ${[["dot", "가운데 점"], ["outline", "검은 테두리"], ["dyn", "움직이면 벌어짐"]].map(([k, n]) => `<div class="pz-row"><label class="xh-line xh-chk"><span>${n}</span><input type="checkbox" id="xh-${k}"></label></div>`).join("")}
      <div class="pz-row"><button class="btn" id="xh-reset">조준점 기본값</button></div>`;
    set.appendChild(pane);
    const xs = document.createElement("style");
    xs.textContent = `.xh-top{display:flex;gap:14px;align-items:center}.xh-prev{flex:none;width:96px;height:96px;border-radius:12px;background:repeating-linear-gradient(45deg,#3a4252 0 8px,#2c3340 8px 16px);position:relative;overflow:hidden}.xh-prev #xh-prev{position:absolute;left:50%;top:50%;width:0;height:0}.xh-prev #xh-prev i{position:absolute}.xh-ctl{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}.xh-line{display:flex;align-items:center;gap:10px;width:100%}.xh-line>span{flex:none;width:118px;font-size:12.5px;color:var(--steel)}.xh-line input[type=range]{flex:1}.xh-line b{width:34px;text-align:right;font-size:12px;color:var(--gold)}.xh-seg{display:flex;gap:5px;flex-wrap:wrap;align-items:center}.xh-seg button{padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:var(--ink);font-size:12px;cursor:pointer}.xh-seg button.on{border-color:var(--gold)}.xh-seg button i{display:block;width:14px;height:14px;border-radius:50%;background:var(--c)}#xh-custom{width:34px;height:28px;border:0;background:none;padding:0}.xh-chk{cursor:pointer}.xh-chk input{margin-left:auto}`;
    document.head.appendChild(xs);
    const paint = () => {
      drawCross($("xh-prev"), 0);
      pane.querySelectorAll("#xh-style button").forEach((b) => b.classList.toggle("on", b.dataset.v === XH.style));
      pane.querySelectorAll("#xh-color button").forEach((b) => b.classList.toggle("on", b.dataset.v === XH.color));
      $("xh-custom").value = XH.color;
      for (const k of ["len", "thick", "gap", "alpha"]) ($(`xh-${k}`).value = XH[k]), ($(`xh-${k}-v`).textContent = k === "alpha" ? Math.round(XH[k] * 100) + "%" : XH[k]);
      for (const k of ["dot", "outline", "dyn"]) $(`xh-${k}`).checked = !!XH[k];
      const c = $("cross");
      c && ((c._x = ""), drawCross(c, 0));
    };
    const set1 = (k, v) => ((XH[k] = v), saveX(), paint());
    pane.querySelectorAll("#xh-style button").forEach((b) => (b.onclick = () => set1("style", b.dataset.v)));
    pane.querySelectorAll("#xh-color button").forEach((b) => (b.onclick = () => set1("color", b.dataset.v)));
    $("xh-custom").oninput = (e) => set1("color", e.target.value);
    for (const k of ["len", "thick", "gap", "alpha"]) $(`xh-${k}`).oninput = (e) => set1(k, +e.target.value);
    for (const k of ["dot", "outline", "dyn"]) $(`xh-${k}`).onchange = (e) => set1(k, e.target.checked);
    $("xh-reset").onclick = () => ((XH = Object.assign({}, XD)), saveX(), paint());
    tb.onclick = () => {
      document.querySelectorAll(".pz-tabs button").forEach((x) => x.classList.toggle("on", x === tb));
      document.querySelectorAll(".pz-pane").forEach((p) => p.classList.toggle("on", p === pane));
      paint();
    };
    // the other tabs were bound at load and do not know about this pane
    tabs.querySelectorAll("button").forEach((x) => x !== tb && x.addEventListener("click", () => pane.classList.remove("on")));
    paint();
  })();
})();
