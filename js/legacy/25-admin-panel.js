
(() => {
  // Admin, rebuilt around two tabs.
  //  · Personal (only whoever unlocked it on this device): enemies on the
  //    minimap, enemies through walls, own run speed, cheat mode (arrow keys
  //    swap in any agent's four abilities, looks stay the same, unlimited use),
  //    god / one shot / infinite ammo / no recoil / fire rate.
  //  · Global (the host, for the whole room): run speed, round / buy / match
  //    time, unlimited abilities for everyone, jump, gravity, bots.
  // Personal settings never outlive the page, and nothing is shown to anyone
  // else. A guest's personal settings reach the host, which applies them to
  // that guest's body only.
  const $ = (id) => document.getElementById(id);
  const me = () => ("function" == typeof myActor && myActor()) || player;
  const inMatch = () => "menu" !== world.phase && !!me();
  const isClient = () => "client" === NET.mode;

  const P_DEF = { radar: !1, wall: !1, cheat: !1, god: !1, oneShot: !1, infAmmo: !1, noRecoil: !1, speed: 1, fastFire: 1 };
  const P = Object.assign({}, P_DEF);
  const G_DEF = { roundT: 100, buyT: 0, matchT: 0, infAll: !1 };
  const G = Object.assign({}, G_DEF);
  try {
    Object.assign(G, JSON.parse(localStorage.getItem("lgp_gadm") || "{}"));
  } catch (e) {}
  const saveG = () => {
    try {
      localStorage.setItem("lgp_gadm", JSON.stringify(G));
    } catch (e) {}
  };
  // a password every visit, and personal switches start off
  ADMIN_UNLOCKED = !1;
  Object.assign(ADMIN, { infAbil: !1, infAmmo: !1, god: !1, oneShot: !1, noRecoil: !1, fastFire: 1 });
  try {
    saveAdmin();
  } catch (e) {}
  function applyLocal() {
    ADMIN.god = P.god;
    ADMIN.oneShot = P.oneShot;
    ADMIN.infAmmo = P.infAmmo;
    ADMIN.noRecoil = P.noRecoil;
    ADMIN.fastFire = P.fastFire;
    ADMIN.infAbil = G.infAll; // cheat mode refills on its own clock (hunt module)
  }

  // ── who has what (host side) ──
  const PEERS = new Map();
  const flagsFor = (a) => (a ? ("me" === a.ctrl ? P : PEERS.get(a.ctrl) || null) : null);

  // ── networking ──
  const personalPayload = () => ({ cheat: P.cheat, god: P.god, oneShot: P.oneShot, infAmmo: P.infAmmo, noRecoil: P.noRecoil, speed: P.speed, fastFire: P.fastFire });
  function sendPersonal() {
    isClient() && sendAction({ t: "padm", p: personalPayload() });
  }
  const globalPayload = () => ({ run: ADMIN.run, walk: ADMIN.walk, crouch: ADMIN.crouch, jumpV: ADMIN.jumpV, gravity: ADMIN.gravity, infAll: G.infAll });
  function sendGlobal() {
    "host" === NET.mode && sendEventAll({ t: "gadm", g: globalPayload() });
  }
  const _oa = NET.onAction;
  NET.onAction = (peer, msg) => {
    if (msg && "padm" === msg.t) {
      const was = PEERS.get(peer);
      // only the switches in P_DEF (plus the buff seconds the owner module clamps) are kept
      const q = Object.assign({}, P_DEF),
        src = msg.p && "object" == typeof msg.p ? msg.p : {};
      for (const k in P_DEF)
        null != src[k] && (q[k] = "number" == typeof P_DEF[k] ? (Number.isFinite(+src[k]) ? +src[k] : P_DEF[k]) : !!src[k]);
      null != src.buff && (q.buff = Math.max(0, +src.buff || 0));
      PEERS.set(peer, q);
      // cheat turned off: give the body its own kit back
      if (was && was.cheat && !(msg.p && msg.p.cheat)) {
        const a = world.actors.find((o) => o.ctrl === peer);
        a && a._kit && a.agent && setKit(a, a.agent);
      }
      return;
    }
    if (msg && "kit" === msg.t) {
      const a = world.actors.find((o) => o.ctrl === peer),
        f = PEERS.get(peer),
        ag = AGENTS.find((x) => x.key === msg.key);
      a && ag && f && f.cheat && setKit(a, ag);
      return;
    }
    return _oa(peer, msg);
  };
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "gadm" === e.t) {
      const g = e.g || {};
      for (const k of ["run", "walk", "crouch", "jumpV", "gravity"]) null != g[k] && (ADMIN[k] = g[k]);
      G.infAll = !!g.infAll;
      applyLocal();
      $("admin") && !$("admin").hidden && "global" === TAB && buildAdminUI();
      return;
    }
    return _oe(e);
  };

  // ── personal run speed (the host moves everyone, a guest predicts itself) ──
  const _sm = simMove;
  simMove = function (e) {
    const f = flagsFor(e),
      m = f && f.speed > 1.001 ? f.speed : 1;
    if (1 === m) return _sm.apply(this, arguments);
    const b = e.speedBuff || 1;
    e.speedBuff = b * m;
    try {
      return _sm.apply(this, arguments);
    } finally {
      e.speedBuff === b * m && (e.speedBuff = b);
    }
  };
  // god / one shot for guests (the host's own are handled by the base game)
  const _dd = dealDamage;
  dealDamage = function (v, amt, head, att) {
    if (isHost() && v) {
      const fv = "me" !== v.ctrl && flagsFor(v);
      if (fv && fv.god) return;
      const fa = att && "me" !== att.ctrl && flagsFor(att);
      fa && fa.oneShot && att.team !== v.team && (amt = 9999);
    }
    return _dd.call(this, v, amt, head, att);
  };
  // fire rate / no recoil for guests
  const _af = actorFire;
  actorFire = function (a) {
    const r = _af.apply(this, arguments);
    try {
      const f = a && "me" !== a.ctrl && isHost() && flagsFor(a);
      if (f) {
        f.fastFire > 1.001 && a.fireCd > 0 && (a.fireCd /= f.fastFire);
        f.noRecoil && (a.recoil = 0);
      }
    } catch (e) {}
    return r;
  };

  // ── cheat mode: any agent's four abilities, looks unchanged ──
  const kitOf = (ag) => ag.abilities.map((d) => ({ def: d, cd: 0, charges: d.ult ? 0 : d.charges || 1 }));
  function setKit(a, ag) {
    if (!a || !ag) return;
    a.abilities = kitOf(ag);
    const u = ag.abilities.find((d) => d.ult);
    a.ultMax = u ? u.ult : 5;
    // a set change must not hand out a free ultimate
    a.ultCharge = Math.min(a.ultCharge || 0, a.ultMax);
    a._kit = ag === a.agent ? null : ag.key;
    if (a === me()) {
      $("skills") && ($("skills").dataset.key = "");
      try {
        paintTouchAbil();
      } catch (e) {}
    }
  }
  const kitIdx = (a) => {
    const k = a._kit || (a.agent && a.agent.key);
    return Math.max(0, AGENTS.findIndex((x) => x.key === k));
  };
  function stepKit(d) {
    const a = me();
    if (!a || !P.cheat) return;
    const ag = 0 === d ? a.agent : AGENTS[(kitIdx(a) + d + AGENTS.length) % AGENTS.length];
    setKit(a, ag);
    isClient() && sendAction({ t: "kit", key: ag.key });
    flashChip();
  }
  addEventListener(
    "keydown",
    (e) => {
      if (!P.cheat || !inMatch() || ("object" == typeof FLY && FLY.on)) return;
      if ("ArrowLeft" !== e.code && "ArrowRight" !== e.code && "ArrowDown" !== e.code) return;
      const t = e.target;
      if (t && ("INPUT" === t.tagName || "TEXTAREA" === t.tagName)) return;
      e.preventDefault();
      e.stopPropagation();
      stepKit("ArrowLeft" === e.code ? -1 : "ArrowRight" === e.code ? 1 : 0);
    },
    !0
  );

  // chip above the ability bar, only on this screen
  const chip = document.createElement("div");
  chip.id = "chk-chip";
  chip.hidden = !0;
  chip.innerHTML = '<button class="chk-b" data-d="-1" aria-label="이전 세트">◀</button><span class="chk-t"></span><button class="chk-b" data-d="1" aria-label="다음 세트">▶</button><button class="chk-b chk-r" data-d="0" aria-label="원래 능력">↺</button>';
  ($("hud") || document.body).appendChild(chip);
  chip.querySelectorAll(".chk-b").forEach((b) => {
    const go = (e) => {
      e.preventDefault();
      e.stopPropagation();
      stepKit(+b.dataset.d);
    };
    b.addEventListener("click", go);
    b.addEventListener("touchstart", go, { passive: !1 });
  });
  let chipKey = "",
    flashT = 0;
  function flashChip() {
    flashT = performance.now();
    chip.classList.remove("flash");
    void chip.offsetWidth;
    chip.classList.add("flash");
  }
  function paintChip() {
    const a = me();
    const on = !!(P.cheat && a && inMatch());
    chip.hidden = !on;
    if (!on) return;
    const i = kitIdx(a),
      ag = AGENTS[i],
      k = ag.key + (a._kit ? "" : "·own");
    if (k !== chipKey) {
      chipKey = k;
      chip.style.setProperty("--kc", ag.color);
      chip.querySelector(".chk-t").innerHTML = `<b>${ag.name}</b> 세트 <em>${i + 1}/${AGENTS.length}</em>${a._kit ? "" : " · 내 능력"}<small>←/→ 바꾸기 · ↓ 원래대로</small>`;
    }
  }

  // ── enemies on the minimap ──
  const enemiesOf = (m) => (world.actors && world.actors.length ? world.actors : world.entities || []).filter((a) => a && a.alive && a !== m && a.team !== m.team);
  function dot(ctx, x, y, r) {
    ctx.fillStyle = "#ff2e44";
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    try {
      const m = me();
      if (P.radar && m && "undefined" != typeof mctx) {
        const b = MAP.bounds,
          sx = mini.width / (b.maxX - b.minX),
          sz = mini.height / (b.maxZ - b.minZ);
        for (const a of enemiesOf(m)) dot(mctx, (a.pos.x - b.minX) * sx, (a.pos.z - b.minZ) * sz, 5.5);
      }
    } catch (e) {}
    return r;
  };
  if ("function" == typeof drawTac && "undefined" != typeof tctx && tctx) {
    const _dt = drawTac;
    drawTac = function () {
      const r = _dt.apply(this, arguments);
      try {
        const m = me();
        if (P.radar && m) {
          const n = tac.width / 2 / 52;
          tctx.save();
          tctx.translate(tac.width / 2, tac.height / 2);
          tctx.rotate(m.yaw);
          tctx.translate(-m.pos.x * n, -m.pos.z * n);
          for (const a of enemiesOf(m)) dot(tctx, a.pos.x * n, a.pos.z * n, 4.5);
          tctx.restore();
        }
      } catch (e) {}
      return r;
    };
  }

  // ── enemies through walls: a second pass of enemy bodies drawn on top ──
  const XR_LAYER = 5;
  const XR = new T.MeshBasicMaterial({ color: 0xff2e44, transparent: !0, opacity: 0.5, depthTest: !1, depthWrite: !1, fog: !1 });
  function markLayers() {
    const m = me();
    for (const a of world.actors || []) {
      const g = a.model && a.model.group;
      if (!g) continue;
      const on = !!(P.wall && m && a.alive && a !== m && a.team !== m.team);
      // a fixed-size marker over the head, so far enemies are not lost as specks
      if (on && !g._xrDot) {
        const d = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xff2e44, depthTest: !1, depthWrite: !1, transparent: !0, sizeAttenuation: !1 }));
        d.scale.setScalar(0.065);
        d.position.y = 2.35;
        d.renderOrder = 997;
        d.userData.noMerge = !0;
        // inside its own group: the reveal code resets depthTest on direct children
        const w = new T.Group();
        w.add(d);
        g.add(w);
        g._xrDot = w;
      }
      g._xrDot && (g._xrDot.visible = on);
      if (g._xr === on) continue;
      g._xr = on;
      g.traverse((o) => o.isMesh && (on ? o.layers.enable(XR_LAYER) : o.layers.disable(XR_LAYER)));
    }
  }
  const _rd = render;
  render = function () {
    const r = _rd.apply(this, arguments);
    if (!P.wall || !inMatch()) return r;
    try {
      const ac = renderer.autoClear,
        ov = scene.overrideMaterial,
        bg = scene.background,
        mask = camera.layers.mask,
        rt = renderer.getRenderTarget(),
        sh = renderer.shadowMap.autoUpdate;
      renderer.setRenderTarget(null);
      renderer.autoClear = !1;
      renderer.shadowMap.autoUpdate = !1;
      scene.overrideMaterial = XR;
      scene.background = null;
      camera.layers.set(XR_LAYER);
      renderer.render(scene, camera);
      camera.layers.mask = mask;
      scene.background = bg;
      scene.overrideMaterial = ov;
      renderer.shadowMap.autoUpdate = sh;
      renderer.autoClear = ac;
      renderer.setRenderTarget(rt);
    } catch (e) {}
    return r;
  };

  // ── game time (host) ──
  const respawnMode = () => !!(window.GAME_MODES && GAME_MODES[room.mode] && GAME_MODES[room.mode].respawn);
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    try {
      isHost() && G.buyT > 0 && (world.roundTime = G.buyT);
    } catch (e) {}
    return r;
  };
  let lastPhase = null,
    gAcc = 0,
    pAcc = 0;
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      dt = dt || 0.016;
      if (isHost()) {
        if ("buy" === lastPhase && "live" === world.phase) {
          if (respawnMode()) G.matchT > 0 && (world.roundTime = 60 * G.matchT);
          else world.roundTime = G.roundT;
        }
        // unlimited abilities: everyone (global) or cheaters (personal)
        for (const a of world.actors) {
          if (!a.alive) continue;
          const f = flagsFor(a),
            inf = G.infAll;
          if (inf && a.abilities) {
            for (const x of a.abilities) (x.cd = 0), (x.charges = Math.max(x.charges || 0, x.def.charges || 1));
            a.ultCharge = a.ultMax || 5;
          }
          if (f && f.infAmmo && "me" !== a.ctrl && a.ammo) {
            const k = actorWeaponKey(a);
            WEAPONS[k] && (a.ammo[k] = WEAPONS[k].mag);
          }
        }
        (gAcc += dt) > 2 && ((gAcc = 0), sendGlobal());
      } else {
        const hasP = Object.keys(P_DEF).some((k) => P[k] !== P_DEF[k]);
        hasP && (pAcc += dt) > 3 && ((pAcc = 0), sendPersonal());
      }
      lastPhase = world.phase;
    } catch (e) {}
    return r;
  };

  // ── per frame on this screen ──
  function frame() {
    try {
      markLayers();
      paintChip();
      const a = me();
      if (a && ADMIN.infAbil && a.abilities && inMatch()) {
        for (const x of a.abilities) (x.cd = 0), (x.charges = Math.max(x.charges || 0, x.def.charges || 1));
        a.ultCharge = a.ultMax || 5;
      }
      // the agent was changed some other way: the cheat kit is gone
      if (a && a._kit && a.abilities && a.abilities[0]) {
        const k = AGENTS.find((x) => x.key === a._kit);
        k && k.abilities[0] !== a.abilities[0].def && (a._kit = null);
      }
    } catch (e) {}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ── panel ──
  let TAB = "me";
  const PERSONAL_T = [
    ["radar", "작은 지도에 적 표시", "보이든 안 보이든 모든 적의 위치가 미니맵에 빨간 점으로 뜹니다"],
    ["wall", "벽 너머 적 보기", "벽 뒤에 있는 적도 빨간 발광으로 보입니다"],
    ["cheat", "치트 모드", "능력이 5초마다 다시 찹니다 (궁극기는 그대로). ← → 로 다른 요원의 능력 4개 세트로 바꾸고 ↓ 로 원래대로 (겉모습은 그대로)"],
    ["god", "무적", "어떤 피해도 받지 않습니다"],
    ["oneShot", "한 방 처치", "내가 맞히면 무조건 쓰러집니다"],
    ["infAmmo", "탄약 무제한", "재장전 없이 탄창이 항상 가득"],
    ["noRecoil", "반동 없음", "쏴도 조준이 흔들리지 않습니다"],
  ];
  const PERSONAL_S = [
    ["speed", "내 이동 속도", 1, 3, 0.05, "배", "나만 빨라집니다. 다른 사람과 봇은 그대로"],
    ["fastFire", "내 연사 속도", 1, 10, 0.1, "배", "내 총만 더 빨리 쏩니다"],
  ];
  const RATIO = { walk: 4.3 / 10.6, crouch: 4.7 / 10.6 };
  function item(host, { name, desc, min, max, step, unit, get, set, def, fmt }) {
    const l = document.createElement("div");
    const dec = step < 1 ? (String(step).split(".")[1] || "").length : 0;
    l.className = "ad-item";
    l.innerHTML = `<div class="ad-top"><span class="ad-name">${name}</span><span class="ad-val"><input class="ad-num" type="number" min="${min}" max="${max}" step="${step}"><span class="ad-unit">${unit}</span></span></div><div class="ad-desc">${desc}</div><input type="range" min="${min}" max="${max}" step="${step}"><div class="ad-range"><span>${fmt ? fmt(min) : min}</span><span>기본 ${fmt ? fmt(def) : def}</span><span>${max}</span></div>`;
    const rg = l.querySelector("input[type=range]"),
      nm = l.querySelector(".ad-num");
    const paint = () => {
      const v = get();
      rg.value = v;
      nm.value = (+v).toFixed(dec);
      l.classList.toggle("changed", Math.abs(v - def) > 1e-9);
    };
    const put = (v) => {
      v = Math.max(min, Math.min(max, isFinite(v) ? v : def));
      set(+v.toFixed(dec + 2));
      paint();
      afterChange();
    };
    rg.addEventListener("input", () => put(+rg.value));
    nm.addEventListener("input", () => "" !== nm.value && put(+nm.value));
    nm.addEventListener("blur", paint);
    l.querySelector(".ad-name").ondblclick = () => put(def);
    paint();
    host.appendChild(l);
    return l;
  }
  function toggle(host, { name, desc, get, set }) {
    const n = document.createElement("div");
    n.className = "ad-tg" + (get() ? " on" : "");
    n.innerHTML = `<div><div class="ad-tgname">${name}</div><div class="ad-tgdesc">${desc}</div></div><span class="ad-dot"><i></i></span>`;
    n.onclick = () => {
      if (n.classList.contains("locked")) return;
      set(!get());
      n.classList.toggle("on", !!get());
      afterChange();
    };
    host.appendChild(n);
    return n;
  }
  function afterChange() {
    applyLocal();
    try {
      saveAdmin();
    } catch (e) {}
    saveG();
    sendPersonal();
    sendGlobal();
    updateAdminState();
    updateAdminMark();
  }
  function setPersonal(k, v) {
    const was = P[k];
    P[k] = v;
    if ("cheat" === k && was && !v) {
      const a = me();
      a && a._kit && a.agent && (setKit(a, a.agent), isClient() && sendAction({ t: "kit", key: a.agent.key }));
    }
    "cheat" === k && v && flashChip();
  }
  // tabs + containers, built once into the existing panel
  const panel = $("ad-panel");
  const tabs = document.createElement("div");
  tabs.className = "ad-tabs";
  tabs.innerHTML = '<button data-t="me" class="on">개인 설정 <small>나만</small></button><button data-t="global">전체 설정 <small>방 전체</small></button>';
  const note = document.createElement("div");
  note.className = "ad-note";
  $("ad-presets").before(tabs);
  tabs.after(note);
  tabs.querySelectorAll("button").forEach((b) => (b.onclick = () => ((TAB = b.dataset.t), buildAdminUI())));

  buildAdminUI = function () {
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.t === TAB));
    $("ad-presets").hidden = !0;
    const grid = $("ad-grid"),
      tg = $("ad-toggles");
    grid.innerHTML = "";
    tg.innerHTML = "";
    panel.classList.toggle("ad-locked", !1);
    if ("me" === TAB) {
      note.innerHTML = "이 기기에서 비밀번호를 입력한 나에게만 적용됩니다. 다른 사람 화면에는 아무 표시도 없고, 새로고침하면 모두 꺼집니다.";
      for (const [k, name, desc] of PERSONAL_T) toggle(tg, { name, desc, get: () => P[k], set: (v) => setPersonal(k, v) });
      for (const [k, name, min, max, step, unit, desc] of PERSONAL_S) item(grid, { name, desc, min, max, step, unit, def: P_DEF[k], get: () => P[k], set: (v) => setPersonal(k, v) });
    } else {
      const locked = isClient();
      note.innerHTML = locked ? "<b>방장만 바꿀 수 있습니다.</b> 지금 값은 방장이 정한 설정입니다." : "방 전체(모든 플레이어와 봇)에 적용됩니다. 멀티에서는 방장만 바꿀 수 있습니다.";
      panel.classList.toggle("ad-locked", locked);
      const sec = (s) => (s > 0 ? s : "기본");
      item(grid, {
        name: "이동 속도 (모두)",
        desc: "모든 플레이어와 봇의 달리기 속도. 걷기·앉아 걷기도 같은 비율로 바뀝니다",
        min: 4,
        max: 30,
        step: 0.1,
        unit: "m/s",
        def: ADMIN_DEF.run,
        get: () => ADMIN.run,
        set: (v) => ((ADMIN.run = v), (ADMIN.walk = +(v * RATIO.walk).toFixed(2)), (ADMIN.crouch = +(v * RATIO.crouch).toFixed(2))),
      });
      item(grid, { name: "라운드 시간", desc: "교전 단계 시간. 다음 라운드부터 적용", min: 20, max: 600, step: 5, unit: "초", def: G_DEF.roundT, get: () => G.roundT, set: (v) => (G.roundT = v) });
      item(grid, { name: "구매 시간", desc: "0이면 모드 기본값. 다음 라운드부터 적용", min: 0, max: 90, step: 1, unit: "초", def: 0, fmt: sec, get: () => G.buyT, set: (v) => (G.buyT = v) });
      item(grid, { name: "데스매치 경기 시간", desc: "팀 데스매치·데스매치 한 판의 길이. 0이면 모드 기본값. 다음 판부터 적용", min: 0, max: 30, step: 1, unit: "분", def: 0, fmt: sec, get: () => G.matchT, set: (v) => (G.matchT = v) });
      item(grid, { name: "점프 높이", desc: "모두의 점프 힘", min: 2, max: 40, step: 0.1, unit: "m/s", def: ADMIN_DEF.jumpV, get: () => ADMIN.jumpV, set: (v) => (ADMIN.jumpV = v) });
      item(grid, { name: "중력", desc: "낮출수록 오래 뜹니다", min: 0.2, max: 60, step: 0.1, unit: "m/s²", def: ADMIN_DEF.gravity, get: () => ADMIN.gravity, set: (v) => (ADMIN.gravity = v) });
      item(grid, { name: "봇 속도 배율", desc: "봇 이동 속도", min: 0, max: 5, step: 0.05, unit: "배", def: ADMIN_DEF.aiSpeed, get: () => ADMIN.aiSpeed, set: (v) => (ADMIN.aiSpeed = v) });
      toggle(tg, { name: "모든 능력 무제한", desc: "모든 플레이어와 봇이 충전·쿨다운 없이 능력을 씁니다", get: () => G.infAll, set: (v) => (G.infAll = v) });
      toggle(tg, { name: "봇 정지", desc: "봇이 움직이지 않습니다 (사격은 합니다). 새로고침하면 꺼집니다", get: () => ADMIN.freezeAI, set: (v) => (ADMIN.freezeAI = v) });
      if (locked) panel.querySelectorAll("#ad-grid input, #ad-toggles .ad-tg").forEach((x) => (x.disabled = !0, x.classList.add("locked")));
    }
    updateAdminState();
  };
  updateAdminState = function () {
    const e = $("ad-state");
    if (!e) return;
    const np = Object.keys(P_DEF).filter((k) => P[k] !== P_DEF[k]).length,
      ng = Object.keys(G_DEF).filter((k) => G[k] !== G_DEF[k]).length + ["run", "jumpV", "gravity", "aiSpeed", "freezeAI"].filter((k) => ADMIN[k] !== ADMIN_DEF[k]).length;
    e.textContent = np + ng ? `개인 ${np}개 · 전체 ${ng}개 변경됨` : "전부 기본값";
    e.style.color = np + ng ? "var(--gold)" : "var(--steel-dim)";
  };
  adminActive = function () {
    return Object.keys(P_DEF).some((k) => P[k] !== P_DEF[k]);
  };
  $("ad-default").onclick = () => {
    if ("me" === TAB) {
      for (const k in P_DEF) setPersonal(k, P_DEF[k]);
    } else if (!isClient()) {
      for (const k of ["run", "walk", "crouch", "jumpV", "gravity", "aiSpeed", "freezeAI"]) ADMIN[k] = ADMIN_DEF[k];
      Object.assign(G, G_DEF);
    }
    afterChange();
    buildAdminUI();
  };
  $("ad-lockout").onclick = () => {
    for (const k in P_DEF) setPersonal(k, P_DEF[k]);
    afterChange();
    ADMIN_UNLOCKED = !1;
    closeAdmin();
    banner("관리자 모드를 잠갔습니다", "#8a97ab");
  };
  // joining or taking over a new body: tell the host again
  const _ab = applySnapshot;
  let sentOnce = !1;
  applySnapshot = function () {
    const r = _ab.apply(this, arguments);
    !sentOnce && ((sentOnce = !0), sendPersonal());
    return r;
  };
  window.ADMIN2 = { P, G, PEERS, setKit, stepKit, flagsFor, setPersonal, afterChange };

  const st = document.createElement("style");
  st.textContent = `
#pause.from-menu .pz-admin-link{display:block!important}
.ad-tabs{display:flex;gap:6px;margin:4px 0 10px}
.ad-tabs button{flex:1;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--steel);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}
.ad-tabs button small{font-weight:500;font-size:10px;color:var(--steel-dim);margin-left:4px}
.ad-tabs button.on{border-color:var(--gold);background:rgba(255,200,73,.1);color:var(--ink,#fff)}
.ad-note{font-size:11.5px;line-height:1.55;color:var(--steel);padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--line);margin-bottom:12px}
.ad-note b{color:var(--gold)}
#ad-panel.ad-locked #ad-grid,#ad-panel.ad-locked #ad-toggles{opacity:.45;pointer-events:none}
#chk-chip{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:12px;background:rgba(10,13,18,.72);border:1px solid color-mix(in srgb,var(--kc,#ffc849) 60%,transparent);box-shadow:0 0 18px -6px var(--kc,#ffc849);z-index:9;pointer-events:auto;font-size:12px;color:#e8edf5;white-space:nowrap}
#chk-chip[hidden]{display:none}
#chk-chip .chk-t{display:block;text-align:center;padding:0 6px;line-height:1.3}
#chk-chip .chk-t small{display:block}
#chk-chip .chk-t b{color:var(--kc,#ffc849)}
#chk-chip .chk-t em{font-style:normal;color:#8a97ab;margin-left:2px}
#chk-chip .chk-t small{font-size:9.5px;color:#8a97ab;margin-top:1px}
#chk-chip .chk-b{width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-size:12px;cursor:pointer;display:grid;place-items:center;padding:0}
#chk-chip.flash{animation:chkF .5s ease-out}
@keyframes chkF{0%{transform:translateX(-50%) scale(1.12);box-shadow:0 0 30px 0 var(--kc,#ffc849)}100%{transform:translateX(-50%) scale(1)}}
body.touching #chk-chip{left:auto;right:calc(env(safe-area-inset-right) + 16px);bottom:296px;transform:none}
body.touching #chk-chip .chk-t small{display:none}
body.touching #chk-chip.flash{animation:none}
@media (orientation:portrait){body.touching #chk-chip{bottom:352px}}
@media (orientation:landscape) and (max-height:380px){body.touching #chk-chip{bottom:258px}}`;
  document.head.appendChild(st);
  applyLocal();
})();
