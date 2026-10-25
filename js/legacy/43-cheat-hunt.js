
(() => {
  // Cheat code hunt. A four-digit code is painted around one building, ①-④
  // on its sides; at the start of every round it sits on the building nearest
  // the middle of the map. Whoever enters it first gets cheats for the rest of
  // the round, and the code changes and moves whole to another building. The
  // host owns the code: guests ask it, and a guest's cheat switches only count
  // once the host has accepted its code. Admin mode is closed to everyone
  // (it is meant to open with a paid pass, not built yet).
  const $ = (id) => document.getElementById(id);
  const A2 = window.ADMIN2;
  if (!A2 || "undefined" == typeof NET) return;
  const isClient = () => "client" === NET.mode;
  const isHostNet = () => "host" === NET.mode;
  const DEF = { radar: !1, wall: !1, cheat: !1, god: !1, oneShot: !1, infAmmo: !1, noRecoil: !1, speed: 1, fastFire: 1 };
  // r: round token, v: code version, b: wall index of the building
  const HUNT = { r: 0, v: 0, code: "", b: -1, key: "", unlocked: !1 };
  const OK = new Set(); // host: guests whose code was accepted this round
  const GRANT = new Set(); // host: guests the owner gave cheats to (kept between rounds)
  const OWNP = new Set(); // host: guests the server confirmed as the owner
  // the owner, or a player the owner gave cheats to: always open, nothing clamped
  const boss = () => !!window.IS_OWNER || !!HUNT.granted;
  const free2 = (peer) => GRANT.has(peer) || OWNP.has(peer);
  // the owner's rules (admin page → /api/v1 config), with the built-in defaults
  const CDEF = { enabled: !0, codeLength: 4, startAtMiddle: !0, moveAfterUse: !0, resetEachRound: !0, wrongWaitSec: 2, refillSec: 5, ultInfinite: !1, allow: {}, maxSpeed: 3, maxFastFire: 10 };
  const C = () => Object.assign({}, CDEF, (window.SERVER_CFG && window.SERVER_CFG.cheat) || {});
  const allowed = (k) => !1 !== (C().allow || {})[k];
  const LEN = () => Math.max(3, Math.min(6, C().codeLength | 0 || 4));

  const rnd = () => {
    try {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    } catch (e) {
      return (Math.random() * 4294967296) >>> 0;
    }
  };
  const newCode = () => {
    let s = "";
    for (let i = 0; i < LEN(); i++) s += rnd() % 10;
    return s;
  };

  // ── buildings that can carry the digits ──
  const free = (x, z, r) => !MAP.walls.some((w) => Math.abs(x - w.x) < w.w / 2 + r && Math.abs(z - w.z) < w.d / 2 + r);
  function faces(w) {
    const out = [];
    for (const [nx, nz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
      const fx = w.x + (nx * w.w) / 2,
        fz = w.z + (nz * w.d) / 2;
      if (free(fx + nx * 1.8, fz + nz * 1.8, 0.7)) out.push({ fx, fz, nx, nz, ry, len: nz ? w.w : w.d });
    }
    return out;
  }
  // real buildings (5 m and up) when the map has them, smaller blocks if not
  function buildings() {
    for (const [h, size] of [[3.5, 5], [3, 3]]) {
      const l = blocks(h, size);
      if (l.length >= 2) return l;
    }
    return blocks(2.2, 2);
  }
  function blocks(minH, minSize) {
    const B = MAP.bounds,
      out = [];
    MAP.walls.forEach((w, i) => {
      if (w.window || w.deck || w.stair || w.parapet || w.h < minH || w.w < minSize || w.d < minSize) return;
      if (w.x - w.w / 2 <= B.minX + 3 || w.x + w.w / 2 >= B.maxX - 3 || w.z - w.d / 2 <= B.minZ + 3 || w.z + w.d / 2 >= B.maxZ - 3) return;
      const f = faces(w);
      f.length && out.push({ i, w, n: f.length });
    });
    return out;
  }
  // the round's first building: the one nearest the middle (prefer one with
  // room on several sides)
  function middleBuilding() {
    const B = MAP.bounds,
      cx = (B.minX + B.maxX) / 2,
      cz = (B.minZ + B.maxZ) / 2;
    let best = null,
      bd = 1e9;
    for (const c of buildings()) {
      const d = Math.hypot(c.w.x - cx, c.w.z - cz) - 6 * Math.min(c.n, 3);
      d < bd && ((bd = d), (best = c));
    }
    return best ? best.i : -1;
  }
  function otherBuilding(not) {
    const list = buildings().filter((c) => c.i !== not);
    if (!list.length) return not;
    const prev = MAP.walls[not];
    // somewhere else on the map, not next door
    const far = prev ? list.filter((c) => Math.hypot(c.w.x - prev.x, c.w.z - prev.z) > 25) : [];
    const pool = far.length ? far : list;
    return pool[rnd() % pool.length].i;
  }

  // ── the painted digits ──
  let signs = [];
  function removeSigns() {
    for (const m of signs) {
      scene.remove(m);
      m.geometry.dispose();
      m.material.map && m.material.map.dispose();
      m.material.dispose();
    }
    signs = [];
  }
  function texFor(idx, digit) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.globalAlpha = 0.92;
    g.strokeStyle = g.fillStyle = "#ffd54f";
    g.lineWidth = 10;
    g.beginPath();
    g.arc(62, 62, 40, 0, 7);
    g.stroke();
    g.font = "900 54px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(idx), 62, 66);
    g.font = "900 190px sans-serif";
    g.fillText(digit, 158, 150);
    g.globalAlpha = 0.7;
    for (const x of [120, 168, 196]) g.fillRect(x, 208, 6, 26 + ((x * 7) % 20));
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  function placeSigns() {
    removeSigns();
    if (!HUNT.code || !C().enabled || !MAP || !MAP.walls || CUR_MAP_KEY !== HUNT.key || ("object" == typeof FLY && FLY.on)) return;
    const w = MAP.walls[HUNT.b];
    if (!w) return;
    const f = faces(w);
    if (!f.length) return;
    // one digit per side; a building with fewer free sides takes them in a row
    const per = f.map(() => []);
    for (let i = 0; i < HUNT.code.length; i++) per[i % f.length].push(i);
    const y = Math.max(1.2, Math.min(2.2, w.h - 0.95));
    per.forEach((idxs, k) => {
      const s = f[k],
        tx = -s.nz,
        tz = s.nx,
        step = Math.min(1.9, (s.len - 0.4) / idxs.length);
      idxs.forEach((i, j) => {
        const off = (j - (idxs.length - 1) / 2) * step,
          size = Math.min(1.7, step - 0.1);
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(size, size),
          new THREE.MeshBasicMaterial({ map: texFor(i + 1, HUNT.code[i]), transparent: !0, depthWrite: !1, polygonOffset: !0, polygonOffsetFactor: -2 })
        );
        m.position.set(s.fx + s.nx * 0.04 + tx * off, y, s.fz + s.nz * 0.04 + tz * off);
        m.rotation.y = s.ry;
        m.userData.hunt = { i: i + 1, d: HUNT.code[i] };
        m.userData.noMerge = !0;
        scene.add(m);
        signs.push(m);
      });
    });
  }

  // ── host / solo: a fresh code every round, a new one each time it is used ──
  function relock() {
    if (boss()) {
      HUNT.unlocked = !0;
      return refresh();
    }
    HUNT.unlocked = !1;
    const P = A2.P;
    if (Object.keys(DEF).some((k) => P[k] !== DEF[k])) {
      for (const k in DEF) A2.setPersonal(k, DEF[k]);
      A2.afterChange();
    }
    refresh();
  }
  function dropGuests() {
    OK.clear();
    for (const p of [...A2.PEERS.keys()]) free2(p) || A2.PEERS.delete(p);
    for (const a of world.actors || []) "me" !== a.ctrl && !free2(a.ctrl) && a._kit && a.agent && A2.setKit(a, a.agent);
  }
  const sendHunt = () => isHostNet() && HUNT.r && sendEventAll({ t: "hunt", r: HUNT.r, v: HUNT.v, c: HUNT.code, b: HUNT.b, k: HUNT.key });
  let matchNew = !0;
  function newRound() {
    if (!C().resetEachRound && !matchNew && HUNT.code) return;
    matchNew = !1;
    HUNT.r = rnd() || 1;
    HUNT.v = 1;
    HUNT.code = newCode();
    HUNT.key = CUR_MAP_KEY;
    HUNT.b = C().startAtMiddle ? middleBuilding() : otherBuilding(-1);
    dropGuests();
    relock();
    placeSigns();
    sendHunt();
  }
  function rotate() {
    HUNT.v++;
    HUNT.code = newCode();
    HUNT.b = otherBuilding(HUNT.b);
    placeSigns();
    sendHunt();
  }
  const _ls = lobbyStart;
  lobbyStart = function () {
    matchNew = !0;
    return _ls.apply(this, arguments);
  };
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    try {
      isClient() || newRound();
    } catch (e) {}
    return r;
  };
  const _lm = loadMap;
  loadMap = function () {
    const r = _lm.apply(this, arguments);
    try {
      placeSigns();
    } catch (e) {}
    return r;
  };
  if ("function" == typeof enterFly) {
    const _ef = enterFly;
    enterFly = function () {
      const r = _ef.apply(this, arguments);
      removeSigns();
      return r;
    };
  }

  // ── cheats: abilities come back every 5 s, the ultimate never refills ──
  let cheatT = 0;
  function refill(a, full) {
    if (!a || !a.alive || !a.abilities) return;
    for (const x of a.abilities) x.def && (full || !x.def.ult) && ((x.cd = 0), (x.charges = Math.max(x.charges || 0, x.def.charges || 1)));
    (full || C().ultInfinite) && (a.ultCharge = a.ultMax || 5);
  }
  // the owner: everything, ultimate too, back the moment it is used
  const ownerActor = (a) => !!a && (("me" === a.ctrl && !!window.IS_OWNER) || OWNP.has(a.ctrl));
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      if ("menu" !== world.phase) {
        if (!isClient()) for (const a of world.actors || []) { if (!ownerActor(a)) continue; const f = A2.flagsFor(a); f && f.cheat && refill(a, !0); }
        else window.IS_OWNER && A2.P.cheat && refill(myActor(), !0);
      }
    } catch (e) {}
    try {
      if ("menu" !== world.phase && (cheatT += dt || 0) >= Math.max(0, +C().refillSec || 0)) {
        cheatT = 0;
        if (!isClient()) for (const a of world.actors || []) { const f = A2.flagsFor(a); f && f.cheat && !ownerActor(a) && refill(a); }
        else A2.P.cheat && refill(myActor());
      }
    } catch (e) {}
    return r;
  };

  // ── network ──
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "hunt" === e.t) {
      const newR = e.r !== HUNT.r,
        moved = newR || e.v !== HUNT.v;
      Object.assign(HUNT, { r: e.r, v: e.v, code: String(e.c || ""), b: e.b | 0, key: e.k });
      newR && relock();
      (moved || !signs.length) && placeSigns();
      return;
    }
    if (e && "hunt-ans" === e.t) {
      if (e.ok && e.r === HUNT.r) {
        HUNT.unlocked = !0;
        refresh(!0);
        banner(E("치트가 열렸습니다 · 이번 라운드만", "Cheats unlocked · this round only"), "#ffc849");
      } else wrongCode(e.late ? E("한발 늦었습니다. 비밀번호가 다른 곳으로 옮겨졌습니다", "Too late — the code has moved somewhere else") : E("틀렸습니다", "Wrong code"));
      return;
    }
    return _oe(e);
  };
  const _oa = NET.onAction;
  NET.onAction = (peer, msg) => {
    if (msg && "hunt-try" === msg.t) {
      const ok = C().enabled && msg.r === HUNT.r && String(msg.c) === HUNT.code && !!HUNT.code;
      const late = !ok && msg.r === HUNT.r && msg.v !== HUNT.v;
      sendEventTo(peer, { t: "hunt-ans", ok, late, r: HUNT.r });
      if (ok) OK.add(peer), C().moveAfterUse && rotate();
      return;
    }
    // cheat switches from a guest the host has not let in do nothing
    if (msg && ("padm" === msg.t || "kit" === msg.t) && !OK.has(peer) && !free2(peer)) {
      A2.PEERS.delete(peer);
      return;
    }
    if (msg && "padm" === msg.t && msg.p && !free2(peer)) msg = Object.assign({}, msg, { p: tame(Object.assign({}, ...["buff", ...Object.keys(DEF)].filter((k) => k in Object(msg.p)).map((k) => ({ [k]: msg.p[k] })))) });
    return _oa(peer, msg);
  };
  function tame(p) {
    const c = C();
    for (const k in DEF) allowed(k) || (p[k] = DEF[k]);
    null != p.speed && (p.speed = Math.min(+p.speed || 1, c.maxSpeed));
    null != p.fastFire && (p.fastFire = Math.min(+p.fastFire || 1, c.maxFastFire));
    return p;
  }
  // my own switches too (checked every second)
  setInterval(() => {
    try {
      if (boss()) {
        HUNT.unlocked || ((HUNT.unlocked = !0), refresh());
        return;
      }
      const P = A2.P,
        want = tame(Object.assign({}, P));
      let ch = !1;
      for (const k in DEF) P[k] !== want[k] && (A2.setPersonal(k, want[k]), (ch = !0));
      !C().enabled && HUNT.unlocked && relock();
      ch && A2.afterChange();
    } catch (e) {}
  }, 1000);
  let acc = 0;
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      (acc += dt || 0.016) > 3 && ((acc = 0), "menu" !== world.phase && sendHunt());
    } catch (e) {}
    return r;
  };

  // ── the panel: 치트 (code) and 관리자 (closed) ──
  const tabsEl = document.querySelector("#ad-panel .ad-tabs");
  const tabBtn = (t) => tabsEl && tabsEl.querySelector(`button[data-t="${t}"]`);
  const curTab = () => {
    const b = tabsEl && tabsEl.querySelector("button.on");
    return b ? b.dataset.t : "me";
  };
  if (tabBtn("me") && tabBtn("global")) {
    tabBtn("me").innerHTML = "치트 <small>비밀번호</small>";
    tabBtn("global").innerHTML = "관리자 <small>🔒</small>";
  }
  const E = (ko, en) => ("en" === window.GAME_LANG ? en : ko);
  const inMatch = () => "menu" !== world.phase && !!HUNT.code;
  openAdmin = function () {
    $("admin").hidden = !1;
    try {
      document.exitPointerLock();
    } catch (e) {}
    $("ad-lock").hidden = !0;
    $("ad-panel").hidden = !1;
    const b = tabBtn("me");
    b ? b.click() : buildAdminUI();
  };
  tryAdminPass = () => tryCode(($("ht-pass") || {}).value);
  window.adminPassOk = () => !1;
  let waitT = 0;
  function wrongCode(msg) {
    waitT = performance.now() + 1000 * Math.max(0, +C().wrongWaitSec || 0);
    const err = $("ht-err");
    err && ((err.hidden = !1), (err.textContent = msg || "틀렸습니다"));
    const p = $("ht-pass");
    p && ((p.value = ""), p.focus());
  }
  function tryCode(v) {
    v = String(v || "").trim();
    if (performance.now() < waitT || !inMatch() || !v) return;
    if (isClient()) {
      waitT = performance.now() + 800;
      sendAction({ t: "hunt-try", r: HUNT.r, v: HUNT.v, c: v });
      return;
    }
    if (C().enabled && v === HUNT.code) {
      HUNT.unlocked = !0;
      C().moveAfterUse && rotate();
      refresh(!0);
      banner(E("치트가 열렸습니다 · 이번 라운드만", "Cheats unlocked · this round only"), "#ffc849");
    } else wrongCode(E("틀렸습니다", "Wrong code"));
  }
  function lockBox() {
    const d = document.createElement("div");
    d.className = "ht-lock";
    d.innerHTML =
      `<div class="ht-nums">${"①②③④⑤⑥".slice(0, LEN()).split("").map((c) => "<b>" + c + "</b>").join("")}</div><div class="ht-row"><input id="ht-pass" type="password" inputmode="numeric" maxlength="${LEN()}" autocomplete="off" placeholder="${"•".repeat(LEN())}"><button class="btn btn-go" id="ht-go">열기</button></div><div class="ht-err" id="ht-err" hidden>틀렸습니다</div>`;
    const inp = d.querySelector("#ht-pass");
    d.querySelector("#ht-go").onclick = () => tryCode(inp.value);
    inp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      "Enter" === e.key && tryCode(inp.value);
    });
    setTimeout(() => {
      try {
        IS_TOUCH || inp.focus();
      } catch (e) {}
    }, 60);
    return d;
  }
  const _bui = buildAdminUI;
  buildAdminUI = function () {
    const r = _bui.apply(this, arguments);
    try {
      decorate();
    } catch (e) {}
    return r;
  };
  function decorate() {
    const t = curTab(),
      note = document.querySelector("#ad-panel .ad-note"),
      grid = $("ad-grid"),
      tg = $("ad-toggles"),
      out = $("ad-lockout"),
      def = $("ad-default");
    out && ((out.hidden = "me" !== t || !HUNT.unlocked), (out.textContent = "치트 잠그기"));
    def && (def.hidden = "me" !== t || !HUNT.unlocked);
    if ("global" === t && window.ADMIN_GRANTED) {
      note && (note.innerHTML = E("<b>관리자 모드</b> · 운영자가 열어 준 기간 동안 쓸 수 있습니다. ", "<b>Admin mode</b> · open for the period the operator granted. ") + (isClient() ? E("방 설정은 방장만 바꿀 수 있습니다.", "Only the host can change room settings.") : E("방 전체에 적용됩니다.", "Applies to the whole room.")));
      return;
    }
    if ("global" === t) {
      // admin mode: nobody unless the owner opened it for this account
      $("ad-panel").classList.remove("ad-locked");
      grid && (grid.innerHTML = "");
      tg && (tg.innerHTML = "");
      note && (note.innerHTML = E("<b>관리자 모드는 잠겨 있습니다.</b> 운영자가 열어 준 계정만 쓸 수 있습니다.", "<b>Admin mode is locked.</b> Only accounts the operator opened it for can use it."));
      return;
    }
    if (HUNT.unlocked) {
      // switches the owner has not allowed are not offered
      const NAMES = { radar: "작은 지도에 적 표시", wall: "벽 너머 적 보기", cheat: "치트 모드", god: "무적", oneShot: "한 방 처치", infAmmo: "탄약 무제한", noRecoil: "반동 없음", speed: "내 이동 속도", fastFire: "내 연사 속도" };
      for (const k in NAMES) {
        if (allowed(k) || boss()) continue;
        document.querySelectorAll("#ad-toggles .ad-tg, #ad-grid .ad-item").forEach((n) => n.textContent.includes(NAMES[k]) && n.remove());
      }
      if (boss()) {
        note && (note.innerHTML = window.IS_OWNER ? E("<b>운영자</b> · 모든 치트가 항상 열려 있고 제한이 없습니다.", "<b>Owner</b> · every cheat is always open, no limits.") : E("<b>운영자가 치트를 열어 주었습니다.</b> 운영자가 거둘 때까지 열려 있습니다.", "<b>The owner gave you cheats</b> until they take them back."));
        return;
      }
      note && (note.innerHTML = E("<b>이번 라운드에만</b> 열려 있습니다. 나에게만 적용되고 다른 사람 화면에는 아무 표시도 없습니다. 다음 라운드에는 비밀번호를 다시 찾아야 합니다.", "Open <b>for this round only</b>. Only you are affected and nobody else sees anything. Next round you have to find the code again."));
      return;
    }
    grid && (grid.innerHTML = "");
    tg && (tg.innerHTML = "");
    if (!note) return;
    if (!C().enabled) note.innerHTML = E("<b>운영자가 치트를 꺼 두었습니다.</b>", "<b>The operator has switched cheats off.</b>");
    else if (!inMatch()) note.innerHTML = E("경기를 시작하면 맵 한가운데 건물에 <b>치트 비밀번호</b>가 그려집니다.", "Once a match starts, the <b>cheat code</b> is painted on the building in the middle of the map.");
    else {
      note.innerHTML =
        E(
          `치트 비밀번호 ${LEN()}자리는 <b>맵 어딘가의 건물 벽</b>에 ${"①②③④⑤⑥".slice(0, LEN())}로 그려져 있습니다. ` +
            (C().startAtMiddle ? "라운드가 시작되면 맵 한가운데 건물에 있고, " : "") +
            (C().moveAfterUse ? "<b>누가 한 번 쓰면 번호가 바뀌어 다른 건물로 옮겨갑니다.</b> " : "") +
            (C().resetEachRound ? "라운드마다 초기화됩니다." : "경기마다 새로 정해집니다."),
          `The ${LEN()}-digit cheat code is painted as ${"①②③④⑤⑥".slice(0, LEN())} <b>on the walls of a building</b>. ` +
            (C().startAtMiddle ? "Each round it starts on the building in the middle of the map; " : "") +
            (C().moveAfterUse ? "<b>once someone uses it, it changes and moves to another building.</b> " : "") +
            (C().resetEachRound ? "It resets every round." : "It is new every match.")
        );
      grid && grid.appendChild(lockBox());
    }
  }
  function refresh(force) {
    try {
      ADMIN_UNLOCKED = HUNT.unlocked;
      const open = $("admin") && !$("admin").hidden && !$("ad-panel").hidden;
      open && (force || !(document.activeElement && "ht-pass" === document.activeElement.id)) && buildAdminUI();
    } catch (e) {}
  }
  $("ad-lockout") &&
    ($("ad-lockout").onclick = () => {
      relock();
      buildAdminUI();
      banner("치트를 잠갔습니다", "#8a97ab");
    });
  // the settings tab is the way in to cheats now
  setInterval(() => {
    try {
      ADMIN_UNLOCKED = HUNT.unlocked;
      const b = $("pz-adtab");
      b && b.lastChild && 3 === b.lastChild.nodeType && "치트" !== b.lastChild.textContent && (b.lastChild.textContent = "치트");
      // the cheats and 관리자 tabs are only for accounts with admin rights
      const adm = !!(window.ADMIN_GRANTED || window.IS_OWNER);
      b && (b.style.display = adm ? "" : "none");
      const g = tabBtn("global");
      g && (g.style.display = adm ? "" : "none");
      const m = tabBtn("me");
      m && (m.style.display = adm ? "" : "none");
    } catch (e) {}
  }, 500);
  const st = document.createElement("style");
  st.textContent = `
.ht-lock{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 10px 6px}
.ht-nums{display:flex;gap:10px}
.ht-nums b{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;border:2px solid #ffd54f;color:#ffd54f;font-size:15px}
.ht-row{display:flex;gap:8px;align-items:center}
.ht-row input{width:130px;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#2a3140);background:rgba(255,255,255,.04);color:#fff;font-family:inherit;font-size:20px;font-weight:700;letter-spacing:8px;text-align:center}
.ht-err{font-size:12px;color:#ff6b6b}
#ad-lockout[hidden],#ad-default[hidden]{display:none}`;
  document.head.appendChild(st);
  window.HUNTX = { HUNT, OK, GRANT, OWNP, relock, refresh, isClient, E };
  window.HUNT_STATE = () => ({ r: HUNT.r, v: HUNT.v, b: HUNT.b, key: HUNT.key, unlocked: HUNT.unlocked, signs: signs.length, guestsOk: OK.size });
})();
