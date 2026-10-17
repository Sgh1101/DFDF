(() => {
  // A golden chest stands in the middle of every two-storey building's ground floor. Hold F beside it for five
  // seconds and it opens: a golden pistol jumps out and goes into your pistol slot. It has one bullet that hits for
  // 200; once it is fired the pistol is gone and your own pistol is back. Round modes open each chest once a round;
  // respawn modes close it again after a minute. Off in ranked, the range, knife fights and the gun ladder.
  if ("undefined" == typeof BUILDINGS || "undefined" == typeof WEAPONS || "undefined" == typeof loadMap || "undefined" == typeof T || "undefined" == typeof netStep) return;
  const OPEN_S = 5, // how long F is held
    REACH = 2.1, // how close to the chest
    AGAIN_S = 60, // a respawn mode closes it again after this
    KEY = "golden";
  const meA = () => ("function" == typeof myActor && myActor()) || null;
  const mode = () => (window.GAME_MODES && GAME_MODES[room.mode]) || {};
  const live = () => world.actors && world.actors.length > 0 && !["menu", "buy", "end", "over", "fly"].includes(world.phase);
  const on = () => live() && !room.ranked && !(window.RANKED && RANKED.locked) && !mode().melee && !mode().range && !mode().ladder;

  // ── the golden pistol: one bullet, 200 damage; kept out of every list of guns (shop, skins, counts) ──
  const base = WEAPONS.pistol;
  Object.defineProperty(WEAPONS, KEY, { value: Object.assign({}, base, { name: "황금 권총", cls: "보조", cost: 0, dmg: 200, rpm: 60, mag: 1, spread: 0.004, range: 90, auto: !1, hs: 1.5 }), enumerable: !1, configurable: !0, writable: !0 });
  "undefined" != typeof WKEYS && WKEYS.indexOf(KEY) < 0 && WKEYS.push(KEY);
  const GOLD = new T.MeshStandardMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.26, emissive: 0x6b4300, emissiveIntensity: 0.45 });
  GOLD.userData.keep = !0;
  if ("undefined" != typeof GUN_BUILD && GUN_BUILD.pistol)
    GUN_BUILD[KEY] = () => {
      const g = GUN_BUILD.pistol();
      g.traverse((m) => m.isMesh && (m.material = GOLD));
      return g;
    };

  // ── the chests: one per house, in the middle of the ground floor, off the stair ──
  let CH = [],
    clockT = 0,
    prog = 0,
    touchHold = !1;
  const box = (w, h, d, x, y, z, mat) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.userData.noMerge = !0;
    return m;
  };
  function makeMesh(x, z, rot) {
    const g = new T.Group(),
      wood = new T.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.8, metalness: 0.05 }),
      gold = GOLD,
      lidPivot = new T.Group();
    g.add(box(1.0, 0.5, 0.62, 0, 0.25, 0, wood));
    for (const sx of [-0.4, 0.4]) g.add(box(0.08, 0.52, 0.66, sx, 0.26, 0, gold));
    g.add(box(1.04, 0.05, 0.66, 0, 0.5, 0, gold));
    lidPivot.position.set(0, 0.5, -0.31);
    const lid = box(1.0, 0.2, 0.62, 0, 0.1, 0.31, wood);
    lidPivot.add(lid);
    for (const sx of [-0.4, 0.4]) lidPivot.add(box(0.08, 0.22, 0.66, sx, 0.11, 0.31, gold));
    g.add(lidPivot);
    g.add(box(0.14, 0.2, 0.05, 0, 0.42, 0.33, gold));
    const beam = new T.Mesh(new T.CylinderGeometry(0.34, 0.5, 5, 14, 1, !0), new T.MeshBasicMaterial({ color: 0xffd45a, transparent: !0, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: !1, side: T.DoubleSide }));
    beam.position.y = 2.6;
    beam.userData.noMerge = !0;
    g.add(beam);
    const ring = new T.Mesh(new T.RingGeometry(REACH - 0.25, REACH - 0.1, 40), new T.MeshBasicMaterial({ color: 0xffc849, transparent: !0, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: !1, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.userData.noMerge = !0;
    g.add(ring);
    const light = new T.PointLight(0xffc24a, 0.9, 7);
    light.position.y = 1.2;
    g.add(light);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    g.userData.keep = !0;
    g.userData.noMerge = !0;
    scene.add(g);
    return { g, lid: lidPivot, beam, ring, light };
  }
  function clear() {
    for (const c of CH) {
      c.m && scene.remove(c.m.g);
      c.gun && scene.remove(c.gun);
    }
    CH = [];
    prog = 0;
  }
  function place(key) {
    clear();
    const P = BUILDINGS.plan[key];
    if (!P) return;
    P.b.forEach(([cx, cz, L, S, rot, flip], i) => {
      // the middle of the long side; across, clear of the stair strip along the low-v wall
      const v = Math.max(S / 2, 3.8),
        w = BUILDINGS.toWorld([L / 2 - 0.3, L / 2 + 0.3, v - 0.3, v + 0.3, 0, 0.5], cx, cz, L, S, rot, flip),
        x = (w[0] + w[1]) / 2,
        z = (w[4] + w[5]) / 2;
      const c = { i, x, z, open: !1, t: 0, shown: 0, m: makeMesh(x, z, rot ? Math.PI / 2 : 0) };
      CH.push(c);
    });
  }
  const _lm = loadMap;
  loadMap = function (key) {
    const r = _lm.apply(this, arguments);
    if (r !== !1)
      try {
        place(key);
      } catch (e) {
        console.warn("chests", e);
      }
    return r;
  };
  try {
    "undefined" != typeof world && "menu" === world.phase && CUR_MAP_KEY && BUILDINGS.plan[CUR_MAP_KEY] && place(CUR_MAP_KEY);
  } catch (e) {}

  // ── opening: the golden pistol leaps out ──
  const sound = () => {
    try {
      SFX.abilityCast && SFX.abilityCast("hype");
    } catch (e) {}
  };
  function popGun(c) {
    try {
      const g = buildProcWeapon(KEY);
      g.scale.setScalar(1.1);
      g.rotation.set(0, Math.PI / 2, 0);
      g.userData.keep = !0;
      g.userData.noMerge = !0;
      g.position.set(c.x, 0.6, c.z);
      scene.add(g);
      c.gun = g;
      c.gunT = 0;
    } catch (e) {}
  }
  function setOpen(c, open, by) {
    if (c.open === open) return;
    c.open = open;
    c.t = 0;
    if (open) {
      c.age = 0;
      popGun(c);
      sound();
      const me = meA();
      me && by && by === me.id && "function" == typeof banner && banner("황금 권총 획득 · 딱 한 발", "#ffc849");
    }
  }
  function openChest(c, a) {
    if (!c || c.open || !a || !a.alive) return !1;
    setOpen(c, !0, a.id);
    equip(a);
    "host" === NET.mode && sendEventAll({ t: "chest", i: c.i, a: a.id });
    return !0;
  }
  // the pistol slot gets the golden gun: one bullet, none in reserve
  function equip(a) {
    if (!a.weapons || !a.ammo) return;
    if (a.weapons.secondary !== KEY) a._gPrev = a.weapons.secondary || "pistol";
    a.weapons.secondary = KEY;
    a.ammo[KEY] = 1;
    a.reserve = a.reserve || {};
    a.reserve[KEY] = 0;
    a.slot = "secondary";
    a.reloading = 0;
    a._gShot = 0;
    refresh(a);
  }
  function strip(a) {
    if (!a.weapons || a.weapons.secondary !== KEY) return;
    a.weapons.secondary = a._gPrev || "pistol";
    delete a.ammo[KEY];
    a.slot = a.weapons.primary ? "primary" : "secondary";
    a._gShot = 0;
    refresh(a);
    "me" === a.ctrl && a.alive && "function" == typeof banner && banner("황금 권총 소멸", "#c9d1d9");
  }
  function refresh(a) {
    try {
      syncActorModel(a);
    } catch (e) {}
    if ("me" === a.ctrl) {
      try {
        updateViewmodel(!0);
      } catch (e) {}
    } else if ("host" === NET.mode && a.ctrl && "dead" !== a.ctrl && !(typeof isAI == "function" && isAI(a))) sendEventTo(a.ctrl, { t: "wallet", c: a.credits, w: a.weapons, am: a.ammo, ar: a.armor, s: a.slot });
  }

  // ── every frame ──
  const near = (a) => {
    let best = null,
      bd = REACH;
    for (const c of CH) {
      if (c.open) continue;
      const d = Math.hypot(a.pos.x - c.x, a.pos.z - c.z);
      d < bd && Math.abs(a.y - 0) < 1.4 && ((bd = d), (best = c));
    }
    return best;
  };
  let hint = null;
  function ui() {
    if (hint) return hint;
    const st = document.createElement("style");
    st.textContent = "#chest-hint{position:fixed;left:50%;bottom:26%;transform:translateX(-50%);z-index:40;min-width:190px;padding:9px 16px 11px;border-radius:14px;border:1px solid rgba(255,200,73,.6);background:rgba(24,17,4,.8);color:#ffe7a8;font:700 13px/1.2 inherit;text-align:center;pointer-events:none}#chest-hint[hidden]{display:none}#chest-hint i{display:block;height:7px;margin-top:7px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}#chest-hint b{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffb52e,#fff1a6)}body.touching #chest-hint{pointer-events:auto}";
    document.head.appendChild(st);
    hint = document.createElement("div");
    hint.id = "chest-hint";
    hint.hidden = !0;
    hint.innerHTML = "<span></span><i><b></b></i>";
    document.body.appendChild(hint);
    // touch: hold the hint or the F button
    const hold = (el) => {
      if (!el) return;
      el.addEventListener("pointerdown", () => (touchHold = !0));
      for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, () => (touchHold = !1));
    };
    hold(hint);
    hold(document.getElementById("tb-use"));
    return hint;
  }
  function animate(dt) {
    const now = performance.now() / 1e3;
    for (const c of CH) {
      c.t += dt;
      const lid = c.m.lid,
        want = c.open ? Math.min(1, c.t / 0.5) : 0;
      lid.rotation.x = -1.9 * (c.open ? 1 - Math.pow(1 - want, 3) : 0);
      c.m.beam.material.opacity = c.open ? Math.max(0, 0.16 * (1 - c.t / 1.5)) : 0.13 + 0.05 * Math.sin(now * 3 + c.i);
      c.m.ring.visible = !c.open;
      c.m.light.intensity = c.open ? Math.max(0.15, 2.2 - c.t * 1.5) : 0.9 + 0.2 * Math.sin(now * 4 + c.i);
      if (c.gun) {
        c.gunT += dt;
        const k = c.gunT;
        // up out of the chest, spinning, then it is gone into the hand
        c.gun.position.y = 0.6 + 1.3 * Math.sin(Math.min(1, k / 0.9) * Math.PI * 0.5);
        c.gun.rotation.y += dt * 6;
        const s = k > 1.2 ? Math.max(0, 1 - (k - 1.2) / 0.4) : 1.1;
        c.gun.scale.setScalar(Math.max(0.001, s));
        if (k > 1.6) {
          scene.remove(c.gun);
          c.gun = null;
        }
      }
    }
  }
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      dt = dt || 0.016;
      clockT += dt;
      animate(dt);
      step(dt);
    } catch (e) {}
    return r;
  };
  function step(dt) {
    const h = ui(),
      me = meA(),
      bar = h.querySelector("b"),
      txt = h.querySelector("span");
    const c = me && me.alive && on() && "fly" !== world.phase ? near(me) : null;
    const held = !!(keys.f || touchHold);
    if (!c) prog = 0;
    else if (held) prog = Math.min(OPEN_S, prog + dt);
    else prog = Math.max(0, prog - dt * 2);
    h.hidden = !c;
    if (c) {
      const touch = document.body.classList.contains("touching");
      const t = prog > 0 && held ? `황금 상자 여는 중 ${(OPEN_S - prog).toFixed(1)}s` : `${touch ? "길게 눌러" : "F 길게 눌러"} 황금 상자 열기`;
      txt.textContent !== t && (txt.textContent = t);
      bar.style.width = (100 * prog) / OPEN_S + "%";
      if (prog >= OPEN_S) {
        prog = 0;
        "client" === NET.mode ? sendAction({ t: "chest", i: c.i }) : openChest(c, me);
      }
    }
    // the host: a fired golden pistol is gone; one that outlives its owner or its round is taken back
    if (isHost() && world.actors) {
      for (const a of world.actors) {
        if (!a.weapons || a.weapons.secondary !== KEY) continue;
        if (!a.alive || !live() || (a.ammo[KEY] | 0) <= 0) {
          a._gShot = (a._gShot || 0) + dt;
          if (!a.alive || !live() || a._gShot > 0.18) strip(a);
        } else a._gShot = 0;
      }
      // respawn modes: a chest comes back
      if (respawnMode()) for (const q of CH) q.open && (q.age = (q.age || 0) + dt) > AGAIN_S && (setOpen(q, !1), sendEventAll({ t: "chest", i: q.i, a: 0, r: 1 }));
      if ("host" === NET.mode && (sync = (sync || 0) + dt) > 3) {
        sync = 0;
        sendEventAll({ t: "chests", o: CH.filter((q) => q.open).map((q) => q.i) });
      }
    }
  }
  let sync = 0;
  const respawnMode = () => !!mode().respawn;

  // ── a new round: every chest closed again, no golden pistol carried over ──
  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    try {
      for (const c of CH) {
        c.open = !1;
        c.t = 0;
        c.gun && (scene.remove(c.gun), (c.gun = null));
      }
      prog = 0;
      isHost() && world.actors && world.actors.forEach(strip);
      "host" === NET.mode && sendEventAll({ t: "chests", o: [] });
    } catch (e) {}
    return r;
  };

  // ── the network: a guest asks, the host decides and tells everyone ──
  const _oa = NET.onAction;
  NET.onAction = (peer, msg) => {
    if (msg && "chest" === msg.t) {
      const a = world.actors.find((o) => o.ctrl === peer),
        c = CH[msg.i];
      a && c && a.alive && on() && !c.open && Math.hypot(a.pos.x - c.x, a.pos.z - c.z) < REACH + 1.2 && openChest(c, a);
      return;
    }
    return _oa ? _oa(peer, msg) : void 0;
  };
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "chest" === e.t) {
      const c = CH[e.i];
      c && setOpen(c, !e.r, e.a);
      return;
    }
    if (e && "chests" === e.t) {
      const set = new Set(e.o || []);
      for (const c of CH) set.has(c.i) !== c.open && (set.has(c.i) ? ((c.open = !0), (c.t = 9)) : setOpen(c, !1));
      return;
    }
    return _oe ? _oe(e) : void 0;
  };
  window.GOLD_CHESTS = { list: () => CH, open: (i, a) => openChest(CH[i], a || meA()), near, OPEN_S, REACH, key: KEY, strip };
})();
