
(() => {
  const MODES = {
    std: { name: "일반전", sub: "13선승 · 12:12면 서든데스" },
    swift: { name: "신속플레이", sub: "5선승 짧은 한 판", win: 5 },
    rush: { name: "스파이크 돌격", sub: "4선승 · 전원 스파이크 · 무작위 총", win: 4, rush: !0 },
    tdm: { name: "팀 데스매치", sub: "먼저 100킬 · 부활 · 모든 무기", respawn: !0, team: !0, kills: 100, time: 570 },
    dm: { name: "데스매치", sub: "개인전 40킬 · 능력 없음", respawn: !0, ffa: !0, kills: 40, time: 540, noAbil: !0 },
    // the two below are run by the knife-fight-and-gun-game module
    knife: { name: "칼 대난투", sub: "개인전 25킬 · 칼만 · 능력 없음", respawn: !0, ffa: !0, kills: 25, time: 420, noAbil: !0, melee: !0 },
    gun: { name: "총기 순환", sub: "개인전 · 킬마다 다음 총 · 마지막은 칼", respawn: !0, ffa: !0, kills: 13, time: 600, noAbil: !0, ladder: !0 },
    // the target range (solo only, not in the mode lists): run by the range module
    range: { name: "표적 사격", sub: "60초 · 움직이는 표적을 쏘세요", respawn: !0, ffa: !0, kills: 9999, time: 60, noAbil: !0, range: !0 },
    // run by the infection module: one infected to start, the caught join them, survive the time to win
    // run by the conquest module: a hill that moves; the side holding it scores
    hill: { name: "점령전", sub: "움직이는 점령 지점 · 지키는 쪽이 초당 1점 · 120점 먼저", respawn: !0, team: !0, kills: 9999, time: 540, hill: !0 },
    // run by the capture-the-flag module: take their flag to your own flag's place; 3 captures win
    ctf: { name: "깃발 탈취", sub: "적 깃발을 우리 깃발 자리로 · 3점 먼저 · 부활", respawn: !0, team: !0, kills: 9999, time: 600, ctf: !0 },
    // run by the shrinking-zone module: free for all, one life, a safe circle that closes; last one standing wins
    zone: { name: "축소전", sub: "개인전 · 한 번뿐인 목숨 · 줄어드는 구역 밖은 피해 · 마지막 한 명", respawn: !0, ffa: !0, kills: 9999, time: 420, noAbil: !0, zone: !0 },
    inf: { name: "감염", sub: "술래 한 명으로 시작 · 잡히면 같은 편 · 3분 버티면 생존자 승리", respawn: !0, kills: 9999, time: 180, noAbil: !0, infect: !0 },
  };
  const ORDER = ["std", "swift", "rush", "tdm", "dm", "knife", "gun", "inf", "hill", "ctf", "zone"];
  room.mode = room.mode || "std";
  const M = () => MODES[room.mode] || MODES.std;
  const inMatch = () => world.actors && world.actors.length > 0;
  const announce = (msg, color) => {
    banner(msg, color);
    "host" === NET.mode && sendEventAll({ t: "round", msg, color });
  };
  const TIER_WEAPONS = [
    ["smg", "vector", "pdw", "shotgun", "autoshot", "slugger", "ripper", "whisper", "burstsmg", "doublebarrel"],
    ["rifle", "carbine", "battle", "burst", "bullpup", "scout"],
    ["marksman", "sniper", "lmg", "hmg", "minigun", "antimat"],
  ];
  const RUSH_WEAPONS = ["smg", "vector", "shotgun", "autoshot", "rifle", "carbine", "battle", "burst", "marksman", "sniper", "lmg", "revolver", "handcan", "ripper", "whisper", "burstsmg", "doublebarrel", "bullpup", "scout", "minigun", "antimat", "stinger"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const MS = { live: !1, liveT: 0, tier: 0, spotT: 0, spotted: new Set() };
  window.GAME_MODES = MODES;
  Object.defineProperty(window, "MODE_STATE", { get: () => ({ tier: MS.tier, liveT: MS.liveT, pickups: PK.map((p) => p.type + (p.active ? "" : "-")) }) });

  function paintModeBody() {
    document.body.classList.toggle("mode-noabil", !!(inMatch() && M().noAbil));
    document.body.dataset.mode = room.mode;
  }

  // ── lobby + solo selectors ──
  function modeButtons(el, cur, enabled, onPick) {
    if (!el) return;
    el.innerHTML = "";
    ORDER.forEach((k) => {
      const b = document.createElement("button");
      b.className = el.dataset.kind === "lobby" ? "lb-obtn" + (cur === k ? " on" : "") : "lb-map" + (cur === k ? " on" : "");
      b.textContent = MODES[k].name;
      b.title = MODES[k].sub;
      b.disabled = !enabled;
      b.onclick = () => onPick(k);
      el.appendChild(b);
    });
  }
  function paintSelModes() {
    const el = $("sel-modes");
    modeButtons(el, room.mode, !0, (k) => {
      room.mode = k;
      paintSelModes();
    });
    const d = $("sel-mode-sub");
    d && (d.textContent = M().sub);
  }
  const _psm = paintSelMaps;
  paintSelMaps = function () {
    _psm.apply(this, arguments);
    paintSelModes();
  };
  const _lso = lobbySetOpt;
  lobbySetOpt = function (e, t) {
    return "mode" === e ? (MODES[t] ? ((room.mode = t), !0) : !1) : _lso.apply(this, arguments);
  };
  const _lsnap = lobbySnapshot;
  lobbySnapshot = function () {
    const s = _lsnap.apply(this, arguments);
    s.mode = room.mode;
    return s;
  };
  const _rl = renderLobby;
  renderLobby = function (e) {
    e && e.mode && MODES[e.mode] && (room.mode = e.mode);
    _rl.apply(this, arguments);
    const el = $("lb-mode");
    el && (el.dataset.kind = "lobby");
    modeButtons(el, room.mode, "client" !== NET.mode, (k) => requestOpt("mode", k));
  };

  // ── match start / sync ──
  const _sea = sendEventAll;
  sendEventAll = function (e) {
    e && "begin" === e.t && (e.mode = room.mode);
    return _sea.apply(this, arguments);
  };
  const _set = sendEventTo;
  sendEventTo = function (p, e) {
    e && "joined" === e.t && (e.mode = room.mode);
    return _set.apply(this, arguments);
  };
  // lobby slots and spawn points only know atk/def: run joins on the lobby teams
  const _jip = joinInProgress;
  joinInProgress = function () {
    if (!M().ffa || !inMatch()) return _jip.apply(this, arguments);
    for (const a of world.actors) a.team = a._baseTeam || a.team;
    try {
      return _jip.apply(this, arguments);
    } finally {
      for (const a of world.actors) a.team = "f" + a.id;
    }
  };
  const _sra = spawnRemoteActor;
  spawnRemoteActor = function (id) {
    const a = _sra.apply(this, arguments);
    a && ((a._baseTeam = a.team), M().ffa && (a.team = "f" + a.id));
    return a;
  };
  const _cbm = clientBeginMatch;
  clientBeginMatch = function (e) {
    room.mode = (e && e.mode) || "std";
    const r = _cbm.apply(this, arguments);
    ffaIntel();
    paintModeBody();
    return r;
  };
  const _sg = startGame;
  startGame = function (e, t) {
    t && "range" !== room.mode && (room.mode = "std");
    return _sg.apply(this, arguments);
  };
  const _ls = lobbyStart;
  lobbyStart = function () {
    const r = _ls.apply(this, arguments);
    MS.live = !1;
    MS.liveT = 0;
    MS.tier = 0;
    for (const a of world.actors) {
      a._baseTeam = a.team;
      a.kills = 0;
      delete a._pick;
      M().ffa && (a.team = "f" + a.id);
    }
    ffaIntel();
    paintModeBody();
    return r;
  };
  function ffaIntel() {
    if ("object" != typeof TEAM_INTEL) return;
    for (const a of world.actors || []) TEAM_INTEL[a.team] || (TEAM_INTEL[a.team] = new Map());
  }

  // ── rounds ──
  const _win = winRounds;
  winRounds = function () {
    return M().win || _win.apply(this, arguments);
  };
  const _sr = startRound;
  startRound = function () {
    const m = M(),
      acts = inMatch() ? world.actors : [];
    // resetActorsForRound only understands atk/def, so run it on the lobby teams
    // (clients get "f<id>" teams straight from the manifest, so fall back to the id's half)
    if (m.ffa) for (const a of acts) a.team = a._baseTeam || (a._baseTeam = a.id < TEAM_SIZE ? "atk" : "def");
    const r = _sr.apply(this, arguments);
    if (m.ffa) for (const a of acts) a.team = "f" + a.id;
    if (!inMatch() || !isHost()) return r;
    clearPickups();
    if (m.respawn) respawnModeStart();
    else {
      m.rush && rushRound();
      const w = winRounds();
      world.scoreAtk === w - 1 && world.scoreDef === w - 1 && setTimeout(() => announce("서든데스 · 이번 라운드로 결판", "#ff3b4e"), 900);
    }
    paintModeBody();
    return r;
  };
  const _cre = checkRoundEnd;
  checkRoundEnd = function () {
    if (M().respawn && inMatch()) return;
    return _cre.apply(this, arguments);
  };

  // ── weapons handed out by the mode: skip the shop lock and tell remote players ──
  let granting = !1;
  const isPeer = (a) => "host" === NET.mode && a.ctrl && "me" !== a.ctrl && "dead" !== a.ctrl && !isAI(a);
  function sendWallet(a) {
    isPeer(a) && sendEventTo(a.ctrl, { t: "wallet", c: a.credits, w: a.weapons, am: a.ammo, ar: a.armor, s: a.slot });
  }
  function grant(a, key) {
    const c = a.credits;
    granting = !0;
    a.credits = 999999;
    try {
      applyPurchase(a, "weapon", key);
    } finally {
      granting = !1;
      a.credits = c;
    }
  }
  const _ap = applyPurchase;
  applyPurchase = function (e, t, o) {
    if (!granting && "weapon" === t && inMatch()) {
      const m = M(),
        w = WEAPONS[o],
        side = w && ("보조" === w.cls || "근접" === w.cls);
      if (m.rush) {
        "me" === e.ctrl && banner("이번 라운드는 무기가 정해져 있습니다", "#8a97ab");
        return;
      }
      // team deathmatch: every gun is open from the start; the one you buy comes back with you
      m.team && w && !side && (e._pick = o);
    }
    return _ap.apply(this, arguments);
  };

  function rushRound() {
    const key = pick(RUSH_WEAPONS);
    const side = "보조" === (WEAPONS[key] || {}).cls;
    for (const a of world.actors) {
      grant(a, key);
      side && a.weapons && (a.weapons.primary = null);
      a.armor = 50;
      sendWallet(a);
    }
    world.roundTime = Math.min(world.roundTime, 5);
    try {
      closeShop();
    } catch (e) {}
    const w = WEAPONS[key];
    setTimeout(() => announce(`이번 라운드 무기 · ${w ? w.name : key}`, "#ffc849"), 400);
    const pts = mapPoints().filter((p) => farFromSpawns(p, 30));
    const types = ["ult", "speed", "armor", "gold"];
    for (let i = 0; i < 4 && pts.length; i++) {
      const p = pts.splice(Math.floor(Math.random() * pts.length), 1)[0];
      spawnPickup(types[i], p.x, p.z, 0);
    }
    syncPickups();
  }

  // ── respawn modes ──
  function respawnModeStart() {
    const m = M(),
      sp = world.spike;
    sp.state = "defused";
    sp.carrier = null;
    sp.mesh && (sp.mesh.visible = !1);
    for (const a of world.actors) {
      a.hasSpike = !1;
      try {
        setCarrierMark(a, !1);
      } catch (e) {}
    }
    world.scoreAtk = 0;
    world.scoreDef = 0;
    world.roundTime = Math.min(world.roundTime, 8);
    MS.live = !1;
    MS.liveT = 0;
    MS.tier = 0;
    for (const a of world.actors) {
      a.kills = 0;
      a.armor = m.ffa ? 50 : 25;
      m.ffa && placeActor(a, ffaSpawn(a));
      m.team && giveTierWeapon(a);
      sendWallet(a);
    }
    if (m.team) {
      const pts = mapPoints().filter((p) => farFromSpawns(p, 28));
      for (let i = 0; i < 4 && pts.length; i++) {
        const p = pts.splice(Math.floor(Math.random() * pts.length), 1)[0];
        spawnPickup(i < 2 ? "ult" : "weapon", p.x, p.z, i < 2 ? 40 : 60);
      }
    }
    syncPickups();
    setTimeout(() => announce(`${m.name} · ${m.ffa ? "개인전 " : ""}${m.kills}킬 먼저`, "#ffc849"), 300);
  }
  function mapPoints() {
    const pts = Object.values(MAP.nodes || {}).map((p) => ({ x: p.x, z: p.z }));
    MAP.sites.forEach((s) => pts.push({ x: s.x, z: s.z }));
    return pts.filter((p) => !collideXZ(p.x, p.z, 0.3, PR + 0.3));
  }
  function farFromSpawns(p, d) {
    return Math.hypot(p.x - MAP.attackSpawn.x, p.z - MAP.attackSpawn.z) > d && Math.hypot(p.x - MAP.defendSpawn.x, p.z - MAP.defendSpawn.z) > d;
  }
  function ffaSpawn(a) {
    const cands = mapPoints().concat([MAP.attackSpawn, MAP.defendSpawn]);
    const foes = world.actors.filter((o) => o !== a && o.alive);
    const scored = cands.map((p) => ({ p, d: foes.length ? Math.min(...foes.map((o) => Math.hypot(o.pos.x - p.x, o.pos.z - p.z))) : 99 }));
    scored.sort((x, y) => y.d - x.d);
    const c = pick(scored.slice(0, 4)).p;
    const x = c.x + rnd(-2, 2),
      z = c.z + rnd(-2, 2);
    const ok = !collideXZ(x, z, 0.3, PR + 0.1);
    return { x: ok ? x : c.x, z: ok ? z : c.z, yaw: Math.atan2(x, z) };
  }
  function teamSpawn(a) {
    const s = spawnPointFor(a.team, Math.floor(Math.random() * TEAM_SIZE));
    return { x: s.x, z: s.z, yaw: s.yaw };
  }
  function placeActor(a, p) {
    a.pos.set(p.x, 0, p.z);
    a.y = 0;
    a.vy = 0;
    a.yaw = p.yaw;
    a.input && (a.input.yaw = p.yaw);
  }
  function giveTierWeapon(a) {
    grant(a, a._pick && WEAPONS[a._pick] ? a._pick : pick(TIER_WEAPONS.flat()));
  }
  function respawnActor(a) {
    const m = M();
    placeActor(a, m.ffa ? ffaSpawn(a) : teamSpawn(a));
    a.onGround = !0;
    a.vel && a.vel.set(0, 0, 0);
    Object.assign(a, { hp: 100, armor: m.ffa ? 50 : 25, alive: !0, blind: 0, root: 0, shielded: 0, invuln: 1.5, slow: 1, silenced: 0, revealed: 0, reloading: 0, fireCd: 0, burstLeft: 0, recoil: 0, recoilY: 0, crouch: !1, ads: !1, planting: 0, defusing: 0, hasSpike: !1, pitch: 0, _respawnT: 0, _landT: 0, _hitT: 0 });
    try {
      clearStatus(a);
    } catch (e) {}
    a.input && ((a.input.mv = [0, 0]), (a.input.btn = 0), (a.input.pitch = 0));
    a.group && ((a.group.visible = !0), (a.group.rotation.x = 0), (a.group.rotation.z = 0));
    delete a._deadT;
    a.model && a.model.hips && ((a.model.hips.rotation.x = 0), (a.model.hips.position.y = 0.92));
    a.model && a.model.gun && (a.model.gun.visible = !0);
    m.team && giveTierWeapon(a);
    for (const k in a.ammo) WEAPONS[k] && ((a.ammo[k] = WEAPONS[k].mag), (a.reserve[k] = 999999));
    topUpReserve(a);
    isAI(a) && (a.ai = freshAIState());
    try {
      syncActorModel(a);
    } catch (e) {}
    sendWallet(a);
    "me" === a.ctrl && localRevived(a);
  }
  const _old = onLocalDeath;
  onLocalDeath = function () {
    if (!M().respawn || !inMatch()) return _old.apply(this, arguments);
    const e = player;
    banner("사망 · 3초 후 부활", "#ff3b4e");
    e.spectateT = 3;
    e.spectate = null;
    e.deathCamYaw = e.yaw;
  };
  const _ka = killActor;
  killActor = function (e, t) {
    const r = _ka.apply(this, arguments);
    if (!isHost() || !inMatch()) return r;
    const m = M();
    t && t !== e && (t.kills = (t.kills || 0) + 1);
    if (m.respawn && !world.over) {
      e._respawnT = 3;
      if (m.team && t && t !== e && t.team !== e.team) "atk" === t.team ? world.scoreAtk++ : world.scoreDef++;
      if (m.ffa) {
        world.scoreAtk = Math.max(0, ...world.actors.map((a) => a.kills || 0));
        spawnPickup("heal", e.pos.x, e.pos.z, -1);
        syncPickups();
      }
      const lead = m.ffa ? world.scoreAtk : Math.max(world.scoreAtk, world.scoreDef);
      lead >= m.kills && finishMatch();
    }
    return r;
  };
  function finishMatch() {
    if (world.over) return;
    world.over = !0;
    world.phase = "end";
    announce("경기 종료", "#ffc849");
    setTimeout(() => gameOver(), 2600);
  }

  // ── results (also shown on clients, which never got a result screen) ──
  const _go = gameOver;
  gameOver = function () {
    const m = M();
    if ("host" === NET.mode) sendEventAll({ t: "over", sa: world.scoreAtk, sd: world.scoreDef, k: world.actors.map((a) => [a.id, a.kills || 0]) });
    if (!m.respawn) return _go.apply(this, arguments);
    world.phase = "over";
    try {
      document.exitPointerLock();
    } catch (e) {}
    const me = myActor() || player;
    let head, score, win;
    if (m.ffa) {
      const ranked = world.actors.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0));
      const rank = ranked.indexOf(me) + 1;
      win = 1 === rank;
      head = rank ? `${rank}위` : "경기 종료";
      score = `${me.kills || 0}킬 · 1위 ${ranked[0] ? ranked[0].kills || 0 : 0}킬`;
    } else {
      const mine = "atk" === me.team ? world.scoreAtk : world.scoreDef,
        theirs = "atk" === me.team ? world.scoreDef : world.scoreAtk;
      win = mine > theirs;
      head = mine === theirs ? "무승부" : win ? "승리" : "패배";
      score = `${mine} : ${theirs}`;
    }
    $("ov-head").textContent = head;
    $("ov-head").style.color = win ? "#4ade80" : "#ff3b4e";
    $("ov-score").textContent = score;
    const st = world.stats || {};
    $("ov-k").textContent = st.kills || me.kills || 0;
    $("ov-d").textContent = st.deaths || 0;
    $("ov-dmg").textContent = st.dmg || 0;
    $("ov-acc").textContent = st.shots ? Math.round((st.hits / st.shots) * 100) + "%" : "0%";
    show("s-over");
  };
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "joined" === e.t && e.mode && MODES[e.mode]) room.mode = e.mode;
    if (e && "pk" === e.t) return clientPickups(e.l);
    if (e && "wallet" === e.t) return applyWallet(e);
    if (e && "buff" === e.t) {
      const me = myActor();
      e.msg && banner(e.msg, e.col);
      if (me && e.sb) {
        me.speedBuff = e.sb;
        clearTimeout(MS.buffTO);
        MS.buffTO = setTimeout(() => (me.speedBuff = 1), 1e3 * e.st);
      }
      return;
    }
    if (e && "over" === e.t) {
      world.scoreAtk = e.sa;
      world.scoreDef = e.sd;
      (e.k || []).forEach(([id, k]) => {
        const a = actorById(id);
        a && (a.kills = k);
      });
      return gameOver();
    }
    return _oe(e);
  };
  // the host already answers purchases with "wallet"; clients never applied it
  function applyWallet(e) {
    const me = myActor();
    if (!me) return;
    null != e.c && (me.credits = e.c);
    e.w && (me.weapons = e.w);
    e.am && Object.assign(me.ammo || (me.ammo = {}), e.am);
    null != e.ar && (me.armor = e.ar);
    e.s && me.weapons[e.s] ? (me.slot = e.s) : me.weapons[me.slot] || (me.slot = me.weapons.primary ? "primary" : "secondary");
    me.reserve || (me.reserve = {});
    for (const k in me.ammo) me.reserve[k] = 999999;
    me.reloading = 0;
    try {
      updateHUD();
    } catch (x) {}
  }
  const _pa = packActor;
  packActor = function (e) {
    const r = _pa.apply(this, arguments);
    r[12] = e.kills || 0;
    return r;
  };
  const _as = applySnapshot;
  applySnapshot = function (e) {
    const me = myActor(),
      was = me ? me.alive : null,
      hp0 = me ? me.hp : 0;
    const r = _as.apply(this, arguments);
    for (const t of e.a) {
      const a = actorById(t[0]);
      a && null != t[12] && (a.kills = t[12]);
    }
    if (!me) return r;
    me.alive && me.hp < hp0 && (me._tagT = 0.3);
    if (M().respawn && was && !me.alive) {
      banner("사망 · 3초 후 부활", "#ff3b4e");
      me.spectateT = 3;
      me.spectate = null;
      me.deathCamYaw = me.yaw;
    } else if (M().respawn && !1 === was && me.alive) localRevived(me);
    return r;
  };
  function localRevived(a) {
    a.spectate = null;
    a.spectateT = 0;
    a.vel && a.vel.set(0, 0, 0);
    a.vy = 0;
    a.pitch = 0;
    a.group && (a.group.visible = !0);
    ["spectate", "scope"].forEach((id) => $(id) && $(id).classList.remove("on"));
    keys.ads = !1;
    $("hud").classList.remove("dead");
    banner("부활", "#4ade80");
  }

  // ── abilities off in deathmatch ──
  const _ua = useAbility;
  useAbility = function () {
    if (M().noAbil && inMatch()) return void banner("데스매치에서는 능력을 쓸 수 없습니다", "#8a97ab");
    return _ua.apply(this, arguments);
  };
  const _ca = castAbility;
  castAbility = function () {
    if (M().noAbil && inMatch()) return;
    return _ca.apply(this, arguments);
  };

  // ── AI roams in respawn modes ──
  const _ag = aiGoal;
  aiGoal = function (e) {
    if (!M().respawn || !inMatch()) return _ag.apply(this, arguments);
    const ai = e.ai || (e.ai = freshAIState());
    const now = world._clock || 0;
    if (!ai._roam || Math.hypot(ai._roam.x - e.pos.x, ai._roam.z - e.pos.z) < 5 || now > (ai._roamAt || 0)) {
      const pts = mapPoints();
      ai._roam = pts.length ? pick(pts) : { x: 0, z: 0 };
      ai._roamAt = now + rnd(12, 24);
    }
    return ai._roam;
  };

  // ── pickups (spike rush buffs, TDM ult orbs / weapon drops, DM health) ──
  const PK_LOOK = { ult: [0xb06bff, "궁극기 충전"], weapon: [0xffc849, "무기 보급"], heal: [0x4ade80, "체력 회복"], speed: [0x22d3ee, "신속"], armor: [0x38bdf8, "방어구"], gold: [0xffd23d, "황금 총 · 피해 2배"] };
  let PK = [],
    pkId = 0;
  function pkMesh(type) {
    const g = new T.Group(),
      c = PK_LOOK[type][0];
    const core = new T.Mesh(new T.OctahedronGeometry(0.34, 0), new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.3 }));
    core.position.y = 1.1;
    g.add(core);
    const glow = glowDot(c, 1.6, 1.4);
    glow.position.y = 1.1;
    g.add(glow);
    const ring = new T.Mesh(new T.RingGeometry(0.7, 0.85, 28), new T.MeshBasicMaterial({ color: c, transparent: !0, opacity: 0.55, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    g.add(ring);
    g.userData.core = core;
    g.userData.keep = !1;
    scene.add(g);
    return g;
  }
  function spawnPickup(type, x, z, respawn) {
    const p = { id: ++pkId, type, x, z, respawn, active: !0, t: 0, life: respawn < 0 ? 20 : 0 };
    p.mesh = pkMesh(type);
    p.mesh.position.set(x, 0, z);
    PK.push(p);
    return p;
  }
  function clearPickups() {
    PK.forEach((p) => p.mesh && scene.remove(p.mesh));
    PK = [];
  }
  function syncPickups() {
    "host" === NET.mode && sendEventAll({ t: "pk", l: PK.map((p) => [p.id, p.type, Q.pos(p.x), Q.pos(p.z), p.active ? 1 : 0]) });
  }
  function clientPickups(l) {
    const keep = new Set(l.map((r) => r[0]));
    PK = PK.filter((p) => (keep.has(p.id) ? !0 : (scene.remove(p.mesh), !1)));
    for (const [id, type, x, z, act] of l) {
      let p = PK.find((q) => q.id === id);
      p || ((p = { id, type, x: Q.unpos(x), z: Q.unpos(z), active: !0 }), (p.mesh = pkMesh(type)), p.mesh.position.set(p.x, 0, p.z), PK.push(p));
      p.active = !!act;
      p.mesh.visible = p.active;
    }
  }
  function applyPickup(a, p) {
    const m = M();
    if ("ult" === p.type) a.ultCharge = m.rush ? a.ultMax || 5 : Math.min(a.ultMax || 5, (a.ultCharge || 0) + 1);
    else if ("weapon" === p.type) grant(a, pick(TIER_WEAPONS[2])), sendWallet(a);
    else if ("heal" === p.type) a.hp = 100;
    else if ("armor" === p.type) (a.hp = 100), (a.armor = 50);
    else if ("speed" === p.type) (a.speedBuff = 1.3), (a.speedBuffT = 10);
    else if ("gold" === p.type) a._goldUntil = (world._clock || 0) + 12;
    const msg = PK_LOOK[p.type][1],
      col = "#" + PK_LOOK[p.type][0].toString(16).padStart(6, "0");
    "me" === a.ctrl && banner(msg, col);
    // clients predict their own movement, so they need the speed buff too
    isPeer(a) && sendEventTo(a.ctrl, { t: "buff", msg, col, sb: "speed" === p.type ? 1.3 : 0, st: 10 });
  }
  function tickPickups(dt) {
    const now = performance.now() / 1e3;
    let changed = !1;
    for (const p of PK) {
      if (p.mesh && p.active) {
        p.mesh.userData.core.rotation.y = now * 1.8;
        p.mesh.userData.core.position.y = 1.1 + 0.12 * Math.sin(now * 2.4 + p.id);
      }
      if (!isHost()) continue;
      if (!p.active) {
        if (p.respawn > 0 && (p.t -= dt) <= 0) (p.active = !0), (p.mesh.visible = !0), (changed = !0);
        continue;
      }
      if (p.life > 0 && (p.life -= dt) <= 0) {
        p.active = !1;
        p.mesh.visible = !1;
        p.respawn = 0;
        changed = !0;
        continue;
      }
      if ("live" !== world.phase && "buy" !== world.phase) continue;
      for (const a of world.actors) {
        if (!a.alive || Math.hypot(a.pos.x - p.x, a.pos.z - p.z) > 1.7) continue;
        if ("heal" === p.type && a.hp >= 100) continue;
        applyPickup(a, p);
        p.active = !1;
        p.mesh.visible = !1;
        p.t = p.respawn;
        changed = !0;
        break;
      }
    }
    if (changed) {
      PK = PK.filter((p) => p.active || p.respawn > 0 || (scene.remove(p.mesh), !1));
      syncPickups();
    }
  }

  // ── damage: gold gun, tagging ──
  const _dd = dealDamage;
  dealDamage = function (e, t, o, a) {
    if ("client" === NET.mode || !e) return _dd.apply(this, arguments);
    a && a._goldUntil && (world._clock || 0) < a._goldUntil && (t *= 2);
    const hp = e.hp;
    const r = _dd.call(this, e, t, o, a);
    e.alive && e.hp < hp && a && a !== e && a.team !== e.team && (e._tagT = 0.3);
    return r;
  };
  const _sm = simMove;
  simMove = function (e, t) {
    if (!(e._tagT > 0)) return _sm.apply(this, arguments);
    e._tagT -= t;
    const s = e.slow;
    e.slow = (s || 1) * 0.45;
    try {
      return _sm.apply(this, arguments);
    } finally {
      e.slow = s;
    }
  };

  // ── per-step mode logic ──
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    tickPickups(dt);
    if (!isHost() || !inMatch()) return r;
    const m = M();
    if (m.ffa) {
      for (const k in TEAM_INTEL) if ("atk" !== k && "def" !== k) for (const [id, v] of TEAM_INTEL[k]) (v.t -= dt) <= 0 && TEAM_INTEL[k].delete(id);
    }
    if (!m.respawn) return r;
    if ("live" === world.phase) {
      if (!MS.live) {
        MS.live = !0;
        world.roundTime = m.time;
      }
      MS.liveT += dt;
      world.roundTime <= 0 && !world.over && finishMatch();
    }
    if (world.over) return r;
    for (const a of world.actors) !a.alive && a._respawnT > 0 && (a._respawnT -= dt) <= 0 && respawnActor(a);
    return r;
  };

  // ── HUD ──
  const _uh = updateHUD;
  updateHUD = function () {
    const r = _uh.apply(this, arguments);
    const m = M();
    if (!inMatch() || !m.respawn) {
      $("mode-board") && ($("mode-board").hidden = !0);
      m.respawn || "live" !== world.phase || _hT($("tb-phase"), `${world.round} 라운드 · ${"atk" === player.team ? "공격" : "수비"}${"std" === room.mode ? "" : " · " + m.name}`);
      return r;
    }
    const me = myActor() || player;
    if (m.ffa) {
      const ranked = world.actors.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0));
      _hT($("tb-def"), me.kills || 0);
      _hT($("tb-atk"), ranked[0] ? ranked[0].kills || 0 : 0);
      const b = $("mode-board");
      if (b) {
        b.hidden = !1;
        const html = ranked.slice(0, 5).map((a, i) => `<div class="mb-row${a === me ? " me" : ""}"><b>${i + 1}</b><span>${a.name || (a.agent ? a.agent.name : "")}</span><em>${a.kills || 0}</em></div>`).join("");
        b.dataset.h !== html && ((b.innerHTML = html), (b.dataset.h = html));
      }
    }
    _hT($("tb-phase"), "buy" === world.phase ? "준비" : `${m.name} · ${m.kills}킬`);
    return r;
  };

  // ── minimap: teammates, shared vision, own footstep ring ──
  function spottedEnemies(me) {
    const now = performance.now();
    if (now - MS.spotT < 200) return MS.spotted;
    MS.spotT = now;
    const s = new Set();
    const mates = world.actors.filter((a) => a.alive && a.team === me.team);
    for (const e of world.actors) {
      if (!e.alive || e.team === me.team) continue;
      if (e.revealed > 0) {
        s.add(e);
        continue;
      }
      for (const a of mates) {
        const d = Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z);
        if (d > 70) continue;
        const ang = ((Math.atan2(-(e.pos.x - a.pos.x), -(e.pos.z - a.pos.z)) - a.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        if (Math.abs(ang) > 0.95 && d > 6) continue;
        if (!rayBlocked(a.pos.x, (a.y || 0) + 1.5, a.pos.z, e.pos.x, (e.y || 0) + 1.2, e.pos.z)) {
          s.add(e);
          break;
        }
      }
    }
    MS.spotted = s;
    return s;
  }
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    if (!inMatch() || "undefined" == typeof mctx) return r;
    const me = myActor() || player;
    if (!me) return r;
    const w = mini.width,
      h = mini.height,
      b = MAP.bounds,
      sx = w / (b.maxX - b.minX),
      sz = h / (b.maxZ - b.minZ),
      X = (x) => (x - b.minX) * sx,
      Z = (z) => (z - b.minZ) * sz;
    for (const p of PK)
      p.active && ((mctx.fillStyle = "#" + PK_LOOK[p.type][0].toString(16).padStart(6, "0")), mctx.beginPath(), mctx.arc(X(p.x), Z(p.z), 4, 0, 7), mctx.fill());
    const running = me.alive && me.vel && Math.hypot(me.vel.x, me.vel.z) > 5.2 && !me.crouch;
    MS.ring = running ? 1 : Math.max(0, (MS.ring || 0) - 0.06);
    if (MS.ring > 0) {
      mctx.strokeStyle = `rgba(255,255,255,${0.35 * MS.ring})`;
      mctx.lineWidth = 1.5;
      mctx.beginPath();
      mctx.arc(X(me.pos.x), Z(me.pos.z), 26 * sx, 0, 7);
      mctx.stroke();
    }
    for (const a of world.actors) {
      if (!a.alive || a === me || a.team !== me.team) continue;
      mctx.fillStyle = "#4ade80";
      mctx.beginPath();
      mctx.arc(X(a.pos.x), Z(a.pos.z), 4.5, 0, 7);
      mctx.fill();
    }
    for (const e of spottedEnemies(me)) {
      mctx.fillStyle = "#ff3b4e";
      mctx.beginPath();
      mctx.arc(X(e.pos.x), Z(e.pos.z), 5, 0, 7);
      mctx.fill();
    }
    return r;
  };
})();
