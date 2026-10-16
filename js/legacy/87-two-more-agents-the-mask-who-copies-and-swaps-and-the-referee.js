(() => {
  // Two more agents (42 in all), each with four abilities that work in a way
  // none of the other 160 does:
  //   가면 — the masked clown: plays back the last ability an enemy used, wears
  //     the other side's face, trades guns, trades lives.
  //   심판 — the referee: a card that makes every shot cost health, a whistle
  //     under which nobody is hurt, a line that weakens whoever crosses it, and
  //     a red card that sends a player back to its own spawn.
  // Same rules as the others: a cast is sent once and played on every screen;
  // only the host decides who is hit, moves people or changes health, and tells
  // the others what happened.
  if ("undefined" == typeof AGENTS || "undefined" == typeof CAST_EXT || !window.AGENTS3) return;
  if (AGENTS.some((a) => "gamyeon" === a.id)) return;

  // ── helpers (the same ones the others use) ──
  const DA = () => window.AB_D || 1;
  const isHost = () => "undefined" == typeof NET || "client" !== NET.mode;
  const aimAt = (d) => aimPoint(d / DA());
  const hurt = (a, dmg, c) => a && a.alive && hurtFighter(a, dmg, !1, c);
  const losOK = (c, a) => !rayBlocked(c.pos.x, (c.y || 0) + 1.5, c.pos.z, a.pos.x, (a.y || 0) + 1.2, a.pos.z);
  const clearLen = (x, z, dx, dz, len, y) => {
    let t = 0;
    while (t < len && !collideXZ(x + dx * (t + 0.4), z + dz * (t + 0.4), (y || 0) + 0.8, 0.15)) t += 0.4;
    return Math.min(t, len);
  };
  const eye = (c) => ({ x: c.pos.x, y: (c.y || 0) + 1.45, z: c.pos.z });
  // the enemy an aimed ability goes to: the one in the line, or the nearest one
  // seen inside a narrow cone around it
  function pick(c, len) {
    const yaw = c.yaw || 0,
      dx = -Math.sin(yaw),
      dz = -Math.cos(yaw),
      e = eye(c),
      L = clearLen(e.x, e.z, dx, dz, len, c.y);
    let hit = null,
      nearest = 1e9;
    for (const a of foesOf(c)) {
      const px = a.pos.x - e.x,
        pz = a.pos.z - e.z,
        t = px * dx + pz * dz,
        off = Math.abs(px * dz - pz * dx);
      t >= -0.5 && t <= L && off <= 0.8 && t < nearest && losOK(c, a) && ((hit = a), (nearest = t));
    }
    if (!hit) {
      let bd = 9;
      for (const a of foesOf(c)) {
        const px = a.pos.x - e.x,
          pz = a.pos.z - e.z,
          d = Math.hypot(px, pz);
        if (d > len || d < 0.5) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, (px * dx + pz * dz) / d)));
        ang < 0.22 && ang < bd && losOK(c, a) && ((bd = ang), (hit = a));
      }
    }
    const end = hit ? { x: hit.pos.x, z: hit.pos.z, y: (hit.y || 0) + 1.1 } : { x: e.x + dx * L, z: e.z + dz * L, y: e.y - 0.2 };
    return { hit, end, e };
  }
  const live = (life, upd, dispose) => {
    let t = 0;
    return abilSpawn({
      update(dt) {
        t += dt;
        const r = upd ? upd(Math.min(t, life), dt) : void 0;
        return r !== !1 && t < life;
      },
      dispose,
    });
  };
  const mat = (col, op, add) => new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: null == op ? 0.8 : op, depthWrite: !1, side: T.DoubleSide, blending: add ? T.AdditiveBlending : T.NormalBlending });
  const drop = (m) => {
    if (!m) return;
    m.parent && m.parent.remove(m);
    m.traverse((o) => {
      o.geometry && o.geometry.dispose();
      o.material && (Array.isArray(o.material) ? o.material.forEach((x) => x.dispose()) : o.material.dispose());
    });
  };
  function sparks(x, y, z, col, n, sp) {
    n = Math.max(3, Math.round((n || 10) * Math.max(0.3, MOT())));
    for (let i = 0; i < n; i++) {
      const g = glowDot(col, 0.22 + 0.25 * Math.random());
      g.position.set(x, y, z);
      const a = Math.random() * 6.28,
        s = (sp || 5) * (0.5 + Math.random()),
        vx = Math.cos(a) * s,
        vz = Math.sin(a) * s;
      let vy = 2 + 4 * Math.random();
      addFx(g, 0.5, (m, t, d) => {
        const dt = d || 0.016;
        m.position.x += vx * dt;
        m.position.z += vz * dt;
        m.position.y += vy * dt;
        vy -= 12 * dt;
        m.material.opacity = 1 - t;
      });
    }
  }
  const beam = (x1, y1, z1, x2, y2, z2, col, w, life) => {
    const dx = x2 - x1,
      dy = y2 - y1,
      dz = z2 - z1,
      L = Math.hypot(dx, dy, dz) || 0.01;
    const m = new T.Mesh(new T.CylinderGeometry(w || 0.05, w || 0.05, 1, 8, 1, !0), mat(col, 0.9, !0));
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.scale.set(1, L, 1);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / L, dy / L, dz / L));
    addFx(m, life || 0.3, (o, t) => (o.material.opacity = 0.9 * (1 - t)));
  };
  const viewer = () => ("function" == typeof myActor && myActor()) || null;
  const byId = (id) => ("function" == typeof actorById ? actorById(id) : (world.actors || []).find((a) => a.id === id)) || null;
  const send = (o) => {
    try {
      "host" === NET.mode && sendEventAll(Object.assign({ t: "y4" }, o));
    } catch (e) {}
  };
  const say = (a, msg, col) => {
    const v = viewer();
    v && a && v === a && bannerMe(msg, col);
  };
  const sfx = (k) => {
    try {
      SFX.abilityCast && SFX.abilityCast(k);
    } catch (e) {}
  };
  // something that hangs over a head for a while, turned to the camera
  function overHead(a, obj, life, y, keep) {
    scene.add(obj);
    live(life, (t) => {
      if (!a.alive || (keep && !keep())) return !1;
      obj.position.set(a.pos.x, (a.y || 0) + (y || 2.6), a.pos.z);
      camera && obj.lookAt(camera.position.x, obj.position.y, camera.position.z);
    }, () => drop(obj));
  }

  // ── shared state ──
  let CLK = 0;
  const LAST = []; // { by, team, type, def, at, x, z } — every cast, the newest last
  const TIMEOUTS = []; // { x, z, y, r, until }
  const LINES = []; // { x, z, nx, nz, tx, tz, half, until, team, by, side }
  const KEYS = ["__disgT", "__cardT", "__weakT"];
  const CREAM = 0xf1e3c2,
    CRIM = 0xe0475b,
    INDIGO = 0x3a3f6b,
    YEL = 0xf5c518,
    RED = 0xe53935,
    CHALK = 0xf4f4ef;

  // ── 가면 — the mask ──
  // a pale wooden mask with smiling eyes, as a little picture on a plane
  let maskTex = null;
  function maskTexture() {
    if (maskTex) return maskTex;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const r = cv.getContext("2d");
    r.fillStyle = "#f1e3c2";
    r.beginPath();
    r.ellipse(64, 66, 46, 56, 0, 0, Math.PI * 2);
    r.fill();
    r.strokeStyle = "#7a5a3a";
    r.lineWidth = 3;
    r.stroke();
    r.strokeStyle = "#1b1b1f";
    r.lineWidth = 5;
    r.lineCap = "round";
    for (const s of [-1, 1]) {
      r.beginPath();
      r.arc(64 + s * 19, 58, 10, Math.PI * 1.1, Math.PI * 1.9);
      r.stroke();
    }
    r.beginPath();
    r.arc(64, 82, 18, Math.PI * 0.15, Math.PI * 0.85);
    r.stroke();
    r.fillStyle = "rgba(224,71,91,.8)";
    for (const s of [-1, 1]) {
      r.beginPath();
      r.arc(64 + s * 28, 76, 7, 0, Math.PI * 2);
      r.fill();
    }
    maskTex = new T.CanvasTexture(cv);
    return maskTex;
  }
  const maskSprite = (sz) => {
    const m = new T.Mesh(new T.PlaneGeometry(sz, sz), new T.MeshBasicMaterial({ map: maskTexture(), transparent: !0, depthWrite: !1, side: T.DoubleSide }));
    m.material.userData.keepMap = !0;
    return m;
  };
  // the mask turns over above a head
  function maskFx(a, col) {
    const m = maskSprite(0.7);
    m.position.set(a.pos.x, (a.y || 0) + 2.3, a.pos.z);
    scene.add(m);
    live(0.8, (t) => {
      m.position.set(a.pos.x, (a.y || 0) + 2.3 + 0.4 * t, a.pos.z);
      camera && m.lookAt(camera.position);
      m.rotateY(t * Math.PI * 4);
      m.material.opacity = Math.min(1, 2.4 * (0.8 - t));
    }, () => {
      scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    sparks(a.pos.x, (a.y || 0) + 1.6, a.pos.z, col || CREAM, 8, 3);
  }

  // every cast is written down (the host acts on it; a guest uses it for the label)
  function defOf(type) {
    for (const ag of AGENTS) for (const d of ag.abilities || []) if (d.type === type) return d;
    return null;
  }
  function lastFoeCast(c) {
    for (let i = LAST.length - 1; i >= 0; i--) {
      const r = LAST[i];
      if (CLK - r.at > 25) break;
      if (!c || r.team === c.team || r.by === c || !c.pos) continue;
      if (Math.hypot(r.x - c.pos.x, r.z - c.pos.z) > 40) continue;
      return r;
    }
    return null;
  }
  const _ca = castAbility;
  castAbility = function (type, def) {
    try {
      const c = player;
      if (c && c.pos && def && !def.ult && "y_mimic" !== type && world.actors && world.actors.indexOf(c) >= 0) {
        LAST.push({ by: c, team: c.team, type, def, at: CLK, x: c.pos.x, z: c.pos.z });
        LAST.length > 48 && LAST.splice(0, LAST.length - 48);
      }
    } catch (e) {}
    return _ca.apply(this, arguments);
  };
  // a guest plays a copied cast too, although it is not on the mask's list
  if ("function" == typeof replayCast) {
    const _rc = replayCast;
    replayCast = function (m) {
      let A = null,
        d = null;
      try {
        const t = m && byId(m.a);
        A = t && t.agent && t.agent.abilities;
        if (A && !A.some((o) => o.type === m.ty) && A.some((o) => "y_mimic" === o.type)) d = defOf(m.ty);
      } catch (e) {}
      if (!d) return _rc.apply(this, arguments);
      A.push(d);
      try {
        return _rc.apply(this, arguments);
      } finally {
        const i = A.indexOf(d);
        i >= 0 && A.splice(i, 1);
      }
    };
  }
  const H = {};
  // 흉내: the last thing an enemy cast near me, cast again as mine
  H.y_mimic = () => {
    const c = player;
    maskFx(c, CREAM);
    if (!isHost()) return;
    const rec = lastFoeCast(c);
    if (!rec) {
      try {
        CAST_REFUND = !0;
      } catch (e) {}
      return say(c, "흉내 낼 능력이 없습니다 — 40m 안에서 적이 능력을 써야 합니다", "#8a97ab");
    }
    try {
      castAbility(rec.type, rec.def);
    } catch (e) {
      console.warn("mimic", e);
    }
    const nm = rec.def.name || rec.type;
    say(c, "흉내 — " + nm, "#f1e3c2");
    c.ctrl && "me" !== c.ctrl && send({ k: "mm", a: c.id, n: nm });
  };

  // 변장: the other side's face for eight seconds
  // On an enemy's screen the mask wears the look of one of that screen's own
  // team (its agent, its colours, its edge glow); a screen on the mask's side
  // sees it as it is.
  const teamHex = (t) => ("atk" === t ? 16739146 : 3718648);
  function costumeOn(a) {
    const v = viewer();
    if (!a || a.__costume || !a.group || !a.alive || !v || v === a || v.team === a.team) return;
    const mate = actorList().find((x) => x && x !== v && x !== a && x.team === v.team && x.agent) || v;
    const ag = (mate && mate.agent) || a.agent;
    let m;
    try {
      m = buildFighter(teamHex(v.team), ag);
    } catch (e) {
      return;
    }
    m.group.userData.actor = !0;
    scene.add(m.group);
    const real = { model: a.model, group: a.group, rev: a._revMark };
    real.group.visible = !1;
    a.model = m;
    a.group = m.group;
    a._revMark = null;
    a.__costume = { real, m, ag: ag && ag.id };
    try {
      syncActorModel(a);
    } catch (e) {}
  }
  function costumeOff(a) {
    const C = a && a.__costume;
    if (!C) return;
    a.__costume = null;
    try {
      scene.remove(C.m.group);
      "function" == typeof chDispose && chDispose(C.m.group);
    } catch (e) {}
    a.model = C.real.model;
    a.group = C.real.group;
    a._revMark = C.real.rev;
    a.group.visible = !!a.alive;
    try {
      syncActorModel(a);
    } catch (e) {}
  }
  function disguiseFx(a) {
    sparks(a.pos.x, (a.y || 0) + 1.2, a.pos.z, CREAM, 12, 3);
    fxColumn(a.pos.x, a.pos.z, CRIM, 3, 0.5);
  }
  H.y_disguise = () => {
    const c = player;
    c.__disgT = 8;
    c.__disgShot = c._shotT || 0;
    maskFx(c, CRIM);
    disguiseFx(c);
    costumeOn(c);
    say(c, "변장 — 8초 · 첫 발 피해 +50%", "#f1e3c2");
  };
  // shooting or being hit gives it away (the host decides, and tells everyone)
  function unmask(a) {
    if (!a) return;
    const was = a.__disgT > 0 || a.__costume;
    a.__disgT = 0;
    costumeOff(a);
    if (was) {
      disguiseFx(a);
      isHost() && send({ k: "ud", a: a.id });
    }
  }

  // 바꿔치기: the guns in our hands change owners
  const sideArm = (k) => WEAPONS[k] && ("보조" === WEAPONS[k].cls || "근접" === WEAPONS[k].cls);
  const gunOf = (a) => (a.weapons && (a.weapons.primary || a.weapons.secondary)) || null;
  function hand(a, slot) {
    a.reloading = 0;
    if ("me" === a.ctrl && "function" == typeof switchSlot) {
      try {
        switchSlot(slot);
      } catch (e) {
        a.slot = slot;
      }
    } else a.slot = slot;
    try {
      syncActorModel(a);
    } catch (e) {}
    try {
      "host" === NET.mode && a.ctrl && "me" !== a.ctrl && "dead" !== a.ctrl && !("function" == typeof isAI && isAI(a)) && sendEventTo(a.ctrl, { t: "wallet", c: a.credits, w: a.weapons, am: a.ammo, ar: a.armor, s: a.slot });
    } catch (e) {}
  }
  function trade(a, give, take) {
    const W = a.weapons;
    if (give) W.primary === give ? (W.primary = null) : W.secondary === give && (W.secondary = null);
    let slot = W.primary ? "primary" : W.secondary ? "secondary" : "knife";
    if (take && WEAPONS[take]) {
      slot = sideArm(take) ? "secondary" : "primary";
      W[slot] = take;
      a.ammo = a.ammo || {};
      a.reserve = a.reserve || {};
      a.ammo[take] = WEAPONS[take].mag;
      a.reserve[take] = Math.max(a.reserve[take] || 0, 2 * (WEAPONS[take].mag || 0));
    }
    hand(a, slot);
  }
  function swapFx(c, e) {
    const p = [c.pos.x, (c.y || 0) + 1.3, c.pos.z, e.pos.x, (e.y || 0) + 1.3, e.pos.z];
    beam(...p, CRIM, 0.05, 0.5);
    beam(p[0], p[1] + 0.25, p[2], p[3], p[4] + 0.25, p[5], CREAM, 0.03, 0.5);
    sparks(p[0], p[1], p[2], CREAM, 8, 3);
    sparks(p[3], p[4], p[5], CRIM, 8, 3);
  }
  H.y_gunswap = () => {
    const c = player,
      s = pick(c, 25);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, CRIM, 0.03, 0.25);
    if (!isHost()) return;
    const e = s.hit,
      mk = gunOf(c),
      ek = e && gunOf(e);
    if (!e || (!mk && !ek)) {
      try {
        CAST_REFUND = !0;
      } catch (x) {}
      return say(c, e ? "바꿀 총이 없습니다" : "바꿔칠 적이 없습니다", "#8a97ab");
    }
    trade(c, mk, ek);
    trade(e, ek, mk);
    swapFx(c, e);
    send({ k: "gs", a: c.id, b: e.id });
    const nm = (k) => (k && WEAPONS[k] ? WEAPONS[k].name : "맨손");
    say(c, `바꿔치기 — ${nm(ek)} 획득`, "#f1e3c2");
    say(e, `가면이 총을 바꿔쳤습니다 — ${nm(mk)}`, "#ff6b6b");
  };

  // 탈바꿈: health and armour change bodies
  function lifeFx(c, e) {
    const a = [c.pos.x, (c.y || 0) + 1.2, c.pos.z],
      b = [e.pos.x, (e.y || 0) + 1.2, e.pos.z];
    for (const [from, to, col] of [
      [a, b, CREAM],
      [b, a, CRIM],
    ]) {
      const g = glowDot(col, 1.1);
      g.position.set(...from);
      addFx(g, 0.7, (m, t) => {
        m.position.set(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 1.2, from[2] + (to[2] - from[2]) * t);
        m.material.opacity = 1 - 0.5 * t;
      });
    }
    fxColumn(a[0], a[2], CRIM, 6, 0.8);
    fxColumn(b[0], b[2], CREAM, 6, 0.8);
    maskFx(c, CRIM);
    maskFx(e, CREAM);
  }
  const giveUltBack = (c) => {
    c.ultCharge = c.ultMax || 7;
  };
  H.y_ult_lifeswap = () => {
    const c = player,
      s = pick(c, 40);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, CRIM, 0.05, 0.35);
    if (!isHost()) return;
    const e = s.hit;
    if (!e) {
      giveUltBack(c);
      return say(c, "맞바꿀 적이 없습니다 — 궁극기를 돌려받습니다", "#8a97ab");
    }
    const hp = c.hp,
      ar = c.armor || 0;
    c.hp = Math.max(1, e.hp);
    c.armor = e.armor || 0;
    e.hp = Math.max(1, hp);
    e.armor = ar;
    lifeFx(c, e);
    send({ k: "ls", a: c.id, b: e.id });
    say(c, `탈바꿈 — 체력 ${Math.round(c.hp)}`, "#f1e3c2");
    say(e, `탈바꿈 — 가면과 체력이 바뀌었습니다 (${Math.round(e.hp)})`, "#ff6b6b");
  };

  // ── 심판 — the referee ──
  function cardMesh(col, n) {
    const g = new T.Group();
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(0.3, 0.42), mat(col, 0.95));
      m.position.x = (i - (n - 1) / 2) * 0.2;
      m.rotation.z = (i - (n - 1) / 2) * -0.25;
      const edge = new T.Mesh(new T.PlaneGeometry(0.34, 0.46), mat(0x101010, 0.6));
      edge.position.set(m.position.x, 0, -0.005);
      edge.rotation.z = m.rotation.z;
      g.add(edge, m);
    }
    return g;
  }
  // 옐로카드: every shot costs health
  function cardFx(e, lvl) {
    const ok = () => e.__cardT > 0 && e.__cardLvl === lvl;
    overHead(e, cardMesh(YEL, lvl), 8, 2.75, ok);
    sparks(e.pos.x, (e.y || 0) + 2.2, e.pos.z, YEL, 8, 2);
    sfx("y_card_tweet");
  }
  function card(e, c) {
    const lvl = e.__cardT > 0 ? 2 : 1;
    e.__cardT = 8;
    e.__cardLvl = lvl;
    e.__cardShot = e._shotT || 0;
    e.__cardTaken = 0;
    e.__cardBy = c;
    cardFx(e, lvl);
    send({ k: "yc", a: e.id, n: lvl, by: c.id });
    say(e, lvl > 1 ? "경고 누적 — 8초간 쏠 때마다 체력 -8" : "옐로카드 — 8초간 쏠 때마다 체력 -4", "#f5c518");
    say(c, lvl > 1 ? "경고 누적!" : "옐로카드", "#f5c518");
  }
  H.y_yellow = () => {
    const c = player,
      s = pick(c, 40);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, YEL, 0.03, 0.25);
    if (!isHost()) return;
    if (!s.hit) {
      try {
        CAST_REFUND = !0;
      } catch (x) {}
      return say(c, "카드를 줄 적이 없습니다", "#8a97ab");
    }
    card(s.hit, c);
  };
  // 타임아웃: nobody inside is hurt or hurts
  const inTimeout = (a) => {
    if (!a || !a.pos) return !1;
    for (const Z of TIMEOUTS) if (Z.until > CLK && Math.hypot(a.pos.x - Z.x, a.pos.z - Z.z) <= Z.r && Math.abs((a.y || 0) - Z.y) < 6) return !0;
    return !1;
  };
  H.y_timeout = () => {
    const c = player,
      Z = { x: c.pos.x, z: c.pos.z, y: c.y || 0, r: 8, until: CLK + 4 };
    TIMEOUTS.push(Z);
    const g = new T.Group();
    const dome = new T.Mesh(new T.SphereGeometry(Z.r, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: CHALK, wireframe: !0, transparent: !0, opacity: 0.28, depthWrite: !1 }));
    const floor = new T.Mesh(new T.RingGeometry(Z.r - 0.35, Z.r, 64), mat(YEL, 0.75, !0));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.07;
    // a T on the ground: time out
    const t1 = new T.Mesh(new T.PlaneGeometry(3.2, 0.5), mat(CHALK, 0.7));
    const t2 = new T.Mesh(new T.PlaneGeometry(0.5, 3), mat(CHALK, 0.7));
    t1.rotation.x = t2.rotation.x = -Math.PI / 2;
    t1.position.set(0, 0.08, -1.2);
    t2.position.set(0, 0.08, 0.3);
    g.add(dome, floor, t1, t2);
    g.position.set(Z.x, Z.y, Z.z);
    g.rotation.y = c.yaw || 0;
    scene.add(g);
    live(4, (t) => {
      dome.material.opacity = 0.2 + 0.1 * Math.sin(t * 6);
      dome.rotation.y = t * 0.3;
      t > 3.4 && g.traverse((o) => o.material && (o.material.opacity *= 0.9));
    }, () => drop(g));
    fxColumn(Z.x, Z.z, CHALK, 5, 0.6);
    sfx("y_timeout");
    const v = viewer();
    v && Math.hypot(v.pos.x - Z.x, v.pos.z - Z.z) <= Z.r + 2 && bannerMe("타임아웃 — 4초간 이 안에서는 아무도 다치지 않습니다", "#f4f4ef");
  };
  // 오프사이드: a line on the ground; an enemy that crosses it toward us is weakened
  function flagMesh() {
    const g = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.1, 6), mat(0xdddddd, 0.95));
    pole.position.y = 0.55;
    const cloth = new T.Mesh(new T.PlaneGeometry(0.45, 0.32), mat(YEL, 0.95));
    cloth.position.set(0.24, 0.92, 0);
    const half = new T.Mesh(new T.PlaneGeometry(0.225, 0.32), mat(RED, 0.95));
    half.position.set(0.355, 0.92, 0.002);
    g.add(pole, cloth, half);
    g.userData.cloth = cloth;
    return g;
  }
  H.y_offside = () => {
    const c = player,
      p = aimAt(25),
      yaw = c.yaw || 0,
      fx = -Math.sin(yaw),
      fz = -Math.cos(yaw),
      y = groundAt(p.x, p.z, (p.y || 0) + 0.5);
    const L = { x: p.x, z: p.z, nx: -fx, nz: -fz, tx: -fz, tz: fx, half: 9, until: CLK + 15, team: c.team, by: c, side: new Map() };
    LINES.push(L);
    const g = new T.Group();
    const chalk = new T.Mesh(new T.PlaneGeometry(2 * L.half, 0.18), mat(CHALK, 0.9));
    chalk.rotation.x = -Math.PI / 2;
    chalk.position.y = 0.06;
    const glow = new T.Mesh(new T.PlaneGeometry(2 * L.half, 0.7), mat(YEL, 0.22, !0));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.055;
    g.add(chalk, glow);
    const flags = [-1, 1].map((s) => {
      const f = flagMesh();
      f.position.x = s * L.half;
      g.add(f);
      return f;
    });
    g.position.set(L.x, y, L.z);
    g.rotation.y = yaw;
    scene.add(g);
    live(15, (t) => {
      if (!(L.until > CLK)) return !1;
      glow.material.opacity = 0.16 + 0.08 * Math.sin(t * 4);
      flags.forEach((f, i) => (f.userData.cloth.rotation.y = 0.35 * Math.sin(t * 5 + i)));
    }, () => drop(g));
    fxColumn(L.x, L.z, YEL, 3, 0.5);
    say(c, "오프사이드 라인 — 넘어오는 적은 5초간 피해 절반", "#f5c518");
  };
  function offsideFx(a) {
    const f = flagMesh();
    f.scale.setScalar(0.7);
    overHead(a, f, 5, 2.4, () => a.__weakT > 0);
    sparks(a.pos.x, (a.y || 0) + 1.6, a.pos.z, YEL, 10, 3);
    sfx("y_card_tweet");
    say(a, "오프사이드! 5초간 주는 피해 절반", "#f5c518");
  }
  function offside(a) {
    a.__weakT = 5;
    offsideFx(a);
    send({ k: "os", a: a.id });
  }
  // 레드카드: back to its own spawn, and no abilities for five seconds
  function homeOf(a) {
    const mates = (world.actors || []).filter((x) => x.team === a.team);
    let p = null;
    if (("atk" === a.team || "def" === a.team) && "function" == typeof spawnPointFor) {
      try {
        p = spawnPointFor(a.team, Math.max(0, mates.indexOf(a)));
      } catch (e) {}
    }
    if (!p) {
      const S = "atk" === a.team ? MAP.attackSpawn : MAP.defendSpawn;
      p = { x: S.x, z: S.z };
    }
    return { x: p.x, z: p.z, y: groundAt(p.x, p.z, 2.5) };
  }
  function redFx(a, from, to) {
    const cm = cardMesh(RED, 1);
    cm.position.set(from[0], from[1] + 2.4, from[2]);
    camera && cm.lookAt(camera.position);
    addFx(cm, 1.1, (m, t) => {
      m.position.y = from[1] + 2.4 + 0.6 * t;
      m.scale.setScalar(1 + 0.6 * t);
      m.traverse((o) => o.material && (o.material.opacity = 0.95 * (1 - t)));
    });
    fxColumn(from[0], from[2], RED, 8, 0.9);
    sparks(from[0], from[1] + 1.2, from[2], RED, 16, 5);
    fxColumn(to[0], to[2], RED, 6, 0.8);
    sfx("y_ult_red");
    say(a, "레드카드 — 퇴장! 시작 지점으로, 5초간 능력 봉인", "#e53935");
    "function" == typeof viewerShake && viewerShake(from[0], from[2], 0.25);
  }
  function sendOff(e) {
    const to = homeOf(e),
      from = [e.pos.x, e.y || 0, e.pos.z];
    e.pos.x = to.x;
    e.pos.z = to.z;
    e.y = to.y;
    e.vel && e.vel.set(0, 0, 0);
    e.vy = 0;
    e.planting = 0;
    e.defusing = 0;
    if (e.ai) {
      e.ai.path = [];
      e.ai.pathIdx = 0;
      e.ai.repathCd = 0;
    }
    statusOn(e, "silenced", 5);
    redFx(e, from, [to.x, to.y, to.z]);
    send({ k: "rd", a: e.id, p: from.concat([to.x, to.y, to.z]).map((v) => Math.round(v * 10)) });
  }
  H.y_ult_red = () => {
    const c = player,
      s = pick(c, 40);
    beam(s.e.x, s.e.y - 0.2, s.e.z, s.end.x, s.end.y, s.end.z, RED, 0.05, 0.35);
    if (!isHost()) return;
    if (!s.hit) {
      giveUltBack(c);
      return say(c, "퇴장시킬 적이 없습니다 — 궁극기를 돌려받습니다", "#8a97ab");
    }
    sendOff(s.hit);
    const v = viewer();
    v && v.team === c.team && v !== s.hit && bannerMe("레드카드 — 퇴장!", "#e53935");
  };

  // ── the rules behind them ──
  const _dd = dealDamage;
  dealDamage = function (e, dmg, head, src) {
    if (!e) return _dd.apply(this, arguments);
    // under the whistle nobody is hurt, and nobody inside hurts anyone
    if (TIMEOUTS.length && (inTimeout(e) || (src && src !== e && inTimeout(src)))) return;
    const foe = src && src !== e && src.team && e.team && src.team !== e.team;
    if (foe) {
      // offside: half
      src.__weakT > 0 && (dmg *= 0.5);
      // the first shot out of a disguise (every pellet of it)
      if (src.__disgT > 0 || src.__ambushT === CLK) {
        dmg *= 1.5;
        if (src.__disgT > 0 && isHost()) {
          src.__ambushT = CLK;
          unmask(src);
        }
      }
    }
    const r = _dd.call(this, e, dmg, head, src);
    isHost() && e.__disgT > 0 && dmg > 0 && src !== e && unmask(e);
    return r;
  };
  // bots do not pick out a disguised enemy unless it is close
  const _pt = aiPickTarget;
  aiPickTarget = function (e) {
    const hid = [];
    try {
      for (const a of world.actors || [])
        if (a.alive && a.team !== e.team && a.__disgT > 0 && Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) > 5) {
          a.alive = !1;
          hid.push(a);
        }
      return _pt.apply(this, arguments);
    } finally {
      hid.forEach((a) => (a.alive = !0));
    }
  };
  // a bot in disguise holds its fire for the first three seconds unless the
  // enemy it saw is close (a disguise that fires at once is no disguise)
  const _af = actorFire;
  actorFire = function (e) {
    if (e && e.__disgT > 5 && "function" == typeof isAI && isAI(e)) {
      const s = e.ai && e.ai.lastSeen;
      if (!s || Math.hypot(s.x - e.pos.x, s.z - e.pos.z) > 10) return;
    }
    return _af.apply(this, arguments);
  };
  // a disguised body keeps the colours of the screen's own side
  const _sm = syncActorModel;
  syncActorModel = function (e) {
    const r = _sm.apply(this, arguments);
    try {
      if (e && e.__costume && e.model && e.alive) {
        const G = window.TEAM_GLOW,
          m = e.model;
        if (G && m._teamMeshes) for (const o of m._teamMeshes) o.material === G.ENEMY && (o.material = G.ALLY);
        const v = viewer();
        v && m.visor && !(e.revealed > 0) && m.visor.material.color.setHex(teamHex(v.team));
      }
    } catch (x) {}
    return r;
  };
  const _ka = killActor;
  killActor = function (e) {
    try {
      if (e) {
        e.__disgT = 0;
        costumeOff(e);
      }
    } catch (x) {}
    return _ka.apply(this, arguments);
  };
  if ("function" == typeof rebuildActorModels) {
    const _rb = rebuildActorModels;
    rebuildActorModels = function () {
      for (const a of world.actors || []) costumeOff(a);
      return _rb.apply(this, arguments);
    };
  }

  // what the host tells the others
  const _oe = NET.onEvent;
  NET.onEvent = function (m) {
    if (m && "y4" === m.t) {
      try {
        const a = byId(m.a),
          b = null != m.b ? byId(m.b) : null;
        if ("ud" === m.k) a && unmask(a);
        else if ("gs" === m.k) {
          if (a && b) {
            swapFx(a, b);
            say(a, "바꿔치기 — 총을 맞바꿨습니다", "#f1e3c2");
            say(b, "가면이 총을 바꿔쳤습니다", "#ff6b6b");
          }
        }
        else if ("ls" === m.k) {
          if (a && b) {
            lifeFx(a, b);
            const v = viewer();
            v === b && bannerMe("탈바꿈 — 가면과 체력이 바뀌었습니다", "#ff6b6b");
            v === a && bannerMe("탈바꿈 — 체력을 맞바꿨습니다", "#f1e3c2");
          }
        } else if ("mm" === m.k) a && say(a, "흉내 — " + m.n, "#f1e3c2");
        else if ("yc" === m.k) {
          if (a) {
            a.__cardT = 8;
            a.__cardLvl = m.n | 0 || 1;
            cardFx(a, a.__cardLvl);
            say(a, a.__cardLvl > 1 ? "경고 누적 — 8초간 쏠 때마다 체력 -8" : "옐로카드 — 8초간 쏠 때마다 체력 -4", "#f5c518");
          }
        } else if ("os" === m.k) {
          if (a) {
            a.__weakT = 5;
            offsideFx(a);
          }
        } else if ("rd" === m.k) {
          const p = (m.p || []).map((v) => v / 10);
          if (a && p.length === 6) {
            // my own body: straight there (a guest's screen runs ahead of the host's)
            if (a === viewer()) {
              a.pos.x = p[3];
              a.pos.z = p[5];
              a.y = p[4];
              a.vel && a.vel.set(0, 0, 0);
              a.vy = 0;
            }
            redFx(a, p.slice(0, 3), p.slice(3));
          }
        }
      } catch (e) {}
      return;
    }
    return _oe && _oe.apply(this, arguments);
  };

  // timers, the card's price, the line, the labels
  let hud = null,
    lbl = 0;
  function drawHud() {
    const v = viewer();
    let txt = "";
    if (v && v.alive) {
      if (v.__disgT > 0) txt = `변장 중 · ${Math.ceil(v.__disgT)}`;
      else if (v.__weakT > 0) txt = `오프사이드 · 주는 피해 절반 · ${Math.ceil(v.__weakT)}`;
      else if (v.__cardT > 0) txt = `${v.__cardLvl > 1 ? "경고 누적" : "옐로카드"} · 쏘면 체력 -${v.__cardLvl > 1 ? 8 : 4} · ${Math.ceil(v.__cardT)}`;
      else if (inTimeout(v)) txt = "타임아웃 · 아무도 다치지 않습니다";
    }
    if (!txt) return void (hud && !hud.hidden && (hud.hidden = !0));
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "y4-hud";
      hud.style.cssText = "position:fixed;top:118px;left:50%;transform:translateX(-50%);z-index:31;pointer-events:none;padding:5px 14px;border-radius:999px;background:rgba(10,13,18,.74);border:1px solid rgba(245,197,24,.5);color:#ffe28a;font:700 12px/1.4 var(--f-display,system-ui);letter-spacing:.05em;white-space:nowrap";
      document.body.appendChild(hud);
    }
    hud.hidden = !1;
    hud.textContent !== txt && (hud.textContent = txt);
  }
  // the mask's Q shows what it would copy now
  function drawMimicLabel() {
    const me = player;
    if (!me || !me.agent || "gamyeon" !== me.agent.id || !me.abilities) return;
    const i = me.abilities.findIndex((x) => x.def && "y_mimic" === x.def.type),
      tile = i >= 0 && $("skills") && $("skills").children[i],
      nm = tile && tile.querySelector(".sk-nm");
    if (!nm) return;
    const rec = lastFoeCast(me),
      txt = rec ? "흉내 · " + (rec.def.name || rec.type) : "흉내";
    nm.textContent !== txt && (nm.textContent = txt);
    tile.classList.toggle("mm-ready", !!rec);
  }
  const _st = step;
  step = function (dt) {
    const r = _st.apply(this, arguments);
    try {
      const d = dt || 0.016;
      CLK += d;
      const host = isHost();
      for (const a of world.actors || []) {
        for (const k of KEYS) a[k] > 0 && (a[k] = Math.max(0, a[k] - d));
        // the disguise: out of time or dead, the face comes off (every screen)
        if ((a.__costume || a.__disgOn) && !(a.__disgT > 0 && a.alive)) costumeOff(a);
        a.__disgOn = a.__disgT > 0;
        if (a.__disgT > 0 && a.alive && !a.__costume) costumeOn(a);
        if (!host || !a.alive) continue;
        // a missed shot gives the disguise away too
        a.__disgT > 0 && (a._shotT || 0) > (a.__disgShot || 0) + 1e-6 && unmask(a);
        // the yellow card's price, shot by shot
        if (a.__cardT > 0 && (a._shotT || 0) > (a.__cardShot || 0) + 1e-6) {
          a.__cardShot = a._shotT;
          const cost = Math.min(a.__cardLvl > 1 ? 8 : 4, 40 - (a.__cardTaken || 0));
          if (cost > 0) {
            a.__cardTaken = (a.__cardTaken || 0) + cost;
            hurt(a, cost, a.__cardBy || a);
            sparks(a.pos.x, (a.y || 0) + 2.1, a.pos.z, YEL, 3, 1.5);
          }
        }
      }
      // the lines: who crossed toward us
      for (let i = LINES.length - 1; i >= 0; i--) {
        const L = LINES[i];
        if (!(L.until > CLK)) {
          LINES.splice(i, 1);
          continue;
        }
        if (!host) continue;
        for (const a of world.actors || []) {
          if (!a.alive || !a.team || a.team === L.team) continue;
          const px = a.pos.x - L.x,
            pz = a.pos.z - L.z,
            along = px * L.tx + pz * L.tz,
            dist = px * L.nx + pz * L.nz;
          if (Math.abs(along) > L.half + 0.4) {
            L.side.delete(a);
            continue;
          }
          const s = dist > 0.15 ? 1 : dist < -0.15 ? -1 : 0;
          if (!s) continue;
          const prev = L.side.get(a);
          L.side.set(a, s);
          prev === -1 && 1 === s && offside(a);
        }
      }
      for (let i = TIMEOUTS.length - 1; i >= 0; i--) TIMEOUTS[i].until > CLK || TIMEOUTS.splice(i, 1);
      while (LAST.length && CLK - LAST[0].at > 30) LAST.shift();
      if ((lbl += d) > 0.2) {
        lbl = 0;
        drawMimicLabel();
      }
      drawHud();
    } catch (e) {}
    return r;
  };
  const _sr = startRound;
  startRound = function () {
    LAST.length = 0;
    TIMEOUTS.length = 0;
    LINES.length = 0;
    for (const a of world.actors || []) {
      costumeOff(a);
      for (const k of KEYS) a[k] = 0;
      a.__disgOn = !1;
    }
    return _sr.apply(this, arguments);
  };

  // ── icons, motions, sounds ──
  Object.assign(AB_ICON_PATH, {
    mask: "M4 5c3-1.3 13-1.3 16 0 0 8-3 14-8 15C7 19 4 13 4 5zM7.5 10.5c1-1.2 2.5-1.2 3.5 0M13 10.5c1-1.2 2.5-1.2 3.5 0M9 15c2 1.6 4 1.6 6 0",
    masks: "M2 6c2-1 7-1 9 0 0 6-2 10-4.5 10S2 12 2 6zM13 8c2-1 7-1 9 0 0 6-2 10-4.5 10S13 14 13 8zM4.5 9.5h2M15.5 11.5h2",
    swapgun: "M3 8h12l2-2h3v4h-3l-1 2h-2l-1 2H9l1-2H3zM20 16H8l3-3M4 19l3-3",
    lifeswap: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10zM9 10.5h6M13 8.5l2 2-2 2",
    card: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 7h6",
    whistle: "M3 11a5 5 0 1 0 10 0h8V8H8.5M8 11a1.2 1.2 0 1 0 .01 0M16 8V5",
    offside: "M5 21V3M5 4h11l-3 4 3 4H5M3 21h18",
    redcard: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9.5 9.5l5 5M14.5 9.5l-5 5",
  });
  if ("undefined" != typeof ABIL_SFX) {
    // a referee's whistle: a high, wavering tone
    ABIL_SFX.y_timeout = { f: 2600, d: 0.42, w: "triangle", slide: 3100, nd: 0.03, nc: 6000, nf: "highpass", f2: 2900, slide2: 2500 };
    ABIL_SFX.y_card_tweet = { f: 2900, d: 0.2, w: "triangle", slide: 3300, nd: 0.02, nc: 6000, nf: "highpass" };
  }
  const LOOK = {
    y_mimic: ["masks", "aura", "mirror_pulse"],
    y_disguise: ["mask", "aura", "blink"],
    y_gunswap: ["swapgun", "point", "charge"],
    y_ult_lifeswap: ["lifeswap", "ult", "ult_mirror"],
    y_yellow: ["card", "point", "y_card_tweet"],
    y_timeout: ["whistle", "place", "y_timeout"],
    y_offside: ["offside", "throw", "mag_anchor"],
    y_ult_red: ["redcard", "ult", "ult_snipe"],
  };
  for (const t in H) {
    CAST_EXT[t] = H[t];
    const l = LOOK[t];
    AB_ICON_OF[t] = l[0];
    "ult" !== l[1] && (CAST_STYLE_OF[t] = l[1]);
    "undefined" != typeof ABIL_SFX && ABIL_SFX[l[2]] && !ABIL_SFX[t] && (ABIL_SFX[t] = ABIL_SFX[l[2]]);
  }
  if ("undefined" != typeof ABIL_SFX) ABIL_SFX.y_ult_red = ABIL_SFX.y_ult_red || ABIL_SFX.y_card_tweet;

  // ── the two ──
  const A = (key, name, type, cost, charges, cd, desc, ult) => Object.assign({ key, name, cost, charges, cd, type, desc, _rs: 1 }, ult ? { ult } : {});
  const NEW = [
    {
      id: "gamyeon", name: "가면", role: "척후대", color: "#e0475b", quote: "탈을 쓰면 누구든 될 수 있지.",
      desc: "남의 능력을 흉내 내고, 적의 얼굴로 섞여 들고, 총과 목숨까지 바꿔치는 탈광대.",
      abilities: [
        A("Q", "흉내", "y_mimic", 200, 1, 0, "40m 안에서 적이 마지막으로 쓴 능력(궁극기 제외, 25초 안)을 그대로 따라 쓴다. 능력 칸에 지금 따라 할 수 있는 능력 이름이 뜬다. 따라 할 것이 없으면 충전이 돌아온다."),
        A("E", "변장", "y_disguise", 0, 1, 28, "8초간 적 팀 요원의 모습으로 변장한다. 적 화면에는 그 팀 사람처럼 보이고(테두리 색까지), 적 봇은 5m 안이 아니면 나를 노리지 않는다. 변장 중 첫 사격은 피해 +50%. 쏘거나 맞으면 풀린다."),
        A("C", "바꿔치기", "y_gunswap", 150, 1, 0, "조준한 적(25m)과 총을 맞바꾼다(주무기가 있으면 주무기, 없으면 보조무기). 받은 총은 탄창이 가득 찬 채로 바로 손에 든다."),
        A("X", "탈바꿈", "y_ult_lifeswap", 0, 1, 0, "궁극기 — 조준한 적(40m)과 체력·방어구를 통째로 맞바꾼다. 맞힐 적이 없으면 궁극기를 돌려받는다.", 7),
      ],
    },
    {
      id: "simpan", name: "심판", role: "감시자", color: "#f5c518", quote: "규칙은 규칙이다.",
      desc: "카드와 휘슬로 전장의 규칙을 정하는 심판. 쏘면 아프고, 선을 넘으면 약해지고, 반칙하면 퇴장이다.",
      abilities: [
        A("Q", "옐로카드", "y_yellow", 150, 2, 0, "조준한 적(40m)에게 옐로카드. 8초 동안 그 적은 총을 쏠 때마다 체력 4를 잃는다(최대 40). 카드를 받은 적에게 한 번 더 주면 경고 누적 — 한 발에 8씩."),
        A("E", "타임아웃", "y_timeout", 0, 1, 32, "휘슬을 분다. 4초 동안 내 자리 8m 안에서는 양 팀 누구도 피해를 주지도 받지도 않는다(총·능력·폭발 모두)."),
        A("C", "오프사이드", "y_offside", 200, 1, 0, "조준한 곳(25m)에 18m 선을 긋는다(15초). 적이 선을 넘어 우리 쪽으로 들어오면 휘슬 — 5초 동안 그 적이 주는 모든 피해가 절반이 된다."),
        A("X", "레드카드", "y_ult_red", 0, 1, 0, "궁극기 — 조준한 적(40m)을 퇴장시킨다. 그 적은 즉시 자기 팀 시작 지점으로 돌아가고 5초간 능력을 쓸 수 없다. 맞힐 적이 없으면 궁극기를 돌려받는다.", 7),
      ],
    },
  ];
  // what each must visibly do in the ability tests
  const EXPECT = {
    y_mimic: "copy", y_disguise: "hide", y_gunswap: "ammo", y_ult_lifeswap: "life",
    y_yellow: "dmg", y_timeout: "block", y_offside: "dmg", y_ult_red: "move",
  };
  for (const a of NEW) {
    a.key = a.id;
    a.accent = "#" + new T.Color(a.color).lerp(new T.Color(0xffffff), 0.55).getHexString();
    for (const d of a.abilities) d.expect = EXPECT[d.type].split(" ");
    AGENTS.push(a);
  }

  // ── their looks ──
  const K = window.CH_KIT,
    PK = window.CH_PAINTKIT;
  if (K && window.CH_DESIGN && "undefined" != typeof CH_OUTFIT) {
    const { HAIR, TOP, LIMB, M, GL, L, gSeg, gArc } = K;
    const PI = Math.PI;
    const DESIGN = {
      gamyeon: {
        face: "none",
        st: { w: 0.94, bulk: 0.92, skin: 0xe8c4a0, hair: 0x1b1b1f, eye: 0x2b2b2b, coat: 0xf3ede0, trim: 0xe0475b },
        base: { top: 0xf3ede0, sleeve: L(0xf3ede0), fore: L(0xf3ede0), hand: L(0xe8c4a0, "skin"), pants: 0x3a3f6b, boot: L(0x2b2420, "leather") },
        make(x) {
          HAIR.topknot(x, 0x1b1b1f);
          // the 탈: a pale wooden face over the whole face, painted crescent eyes,
          // red cheeks and a wide smile
          x.add(x.neck, gSeg(0.136, PI, PI, PI * 0.16, PI * 0.7), M(CREAM, "paint"), 0, 0.22, -0.006, { s: [0.98, 1.12, 1.14] });
          [-1, 1].forEach((s) => {
            x.add(x.neck, gArc(0.026, 0.0065, PI * 0.8, 10), M(0x1b1b1f, "paint"), s * 0.048, 0.236, -0.151, { r: [0, 0, PI * 0.1] });
            x.add(x.neck, G_CYL(0.019, 0.019, 0.004, 14), M(CRIM, "paint"), s * 0.082, 0.196, -0.138, { r: [PI / 2, 0, s * 0.2] });
          });
          x.add(x.neck, gArc(0.046, 0.0065, PI * 0.8, 12), M(0x1b1b1f, "paint"), 0, 0.2, -0.15, { r: [0, 0, PI * 1.1] });
          // a jeogori with wide sleeves, a crimson sash, indigo trousers
          TOP.wideSleeves(x, 0xf3ede0, { cuff: CRIM });
          TOP.sash(x, CRIM);
          TOP.belt(x, INDIGO, { buckle: CRIM, h: 0.06 });
          LIMB.wideLegs(x, INDIGO);
          // a second mask hanging at the hip
          x.add(x.hips, G_CYL(0.07, 0.07, 0.012, 18), M(CRIM, "paint"), 0.2, -0.06, -0.06, { r: [PI / 2, 0.5, 0], s: [1, 1, 1.25] });
          x.add(x.hips, G_SPH(0.012, 8, 6), GL(0xffd54f, 1.6), 0.2, -0.04, -0.075);
        },
      },
      simpan: {
        st: { w: 1.0, bulk: 0.98, skin: 0xd9a77e, hair: 0x2b2420, eye: 0x3e2723, coat: 0xf4f4ef, trim: 0x111111 },
        base: { top: 0xf4f4ef, sleeve: L(0xf4f4ef), fore: L(0xd9a77e, "skin"), hand: L(0x111111, "leather"), pants: 0x15171c, boot: L(0x111111, "leather") },
        make(x) {
          HAIR.short(x, 0x2b2420);
          // a black cap with a peak
          x.add(x.neck, gSeg(0.134, 0, PI * 2, 0, PI * 0.42), M(0x111111, "cloth"), 0, 0.235, 0.0, { s: [1, 0.95, 1.02] });
          x.add(x.neck, G_BOX(0.17, 0.008, 0.09), M(0x111111, "cloth"), 0, 0.282, -0.15, { r: [-0.15, 0, 0] });
          // the striped shirt: black stripes laid on the torso itself (thin slices
          // of the same tapered cylinders, a hair larger)
          const w = (x.S && x.S.w) || 1,
            ink = M(0x111111, "cloth");
          for (let k = 0; k < 12; k++) {
            const a0 = (k * PI) / 6 - 0.09;
            x.add(x.chest, new T.CylinderGeometry(0.19 * w + 0.005, 0.148 * w + 0.005, 0.3, 2, 1, !0, a0, 0.18), ink, 0, 0.19, 0, { s: [1, 1, 0.66] });
            x.add(x.chest, new T.CylinderGeometry(0.148 * w + 0.005, 0.158 * w + 0.005, 0.2, 2, 1, !0, a0, 0.18), ink, 0, -0.02, 0, { s: [1, 1, 0.7] });
          }
          x.add(x.chest, G_TOR(0.1, 0.012, 6, 20), M(0x111111, "cloth"), 0, 0.42, 0, { r: [PI / 2, 0, 0], s: [1, 0.9, 1] });
          // the whistle on its cord, the two cards in the breast pocket
          x.add(x.chest, gArc(0.11, 0.004, PI * 1.1, 14), M(0xd32f2f, "cloth"), 0, 0.33, -0.16, { r: [0, 0, PI * 1.45] });
          x.add(x.chest, G_CYL(0.016, 0.016, 0.06, 10), M(0xcfd8dc, "metal"), 0.0, 0.24, -0.17, { r: [0, 0, PI / 2] });
          x.add(x.chest, G_BOX(0.045, 0.06, 0.004), M(YEL, "paint"), -0.09, 0.32, -0.166, { r: [0, 0, 0.12] });
          x.add(x.chest, G_BOX(0.045, 0.06, 0.004), M(RED, "paint"), -0.075, 0.315, -0.17, { r: [0, 0, -0.1] });
          TOP.belt(x, 0x111111, { buckle: 0xcfd8dc });
          LIMB.tallBoots(x, 0x111111);
        },
      },
    };
    for (const id in DESIGN) {
      const ag = AGENTS.find((a) => a.id === id),
        D = DESIGN[id];
      if (!ag) continue;
      window.CH_DESIGN[id] = D;
      CH_STYLE[id] = Object.assign({}, CH_STYLE._default || {}, D.st);
      const B = D.base;
      CH_BASE_EXTRA[id] = { top: B.top, sleeve: B.sleeve, fore: B.fore, hand: B.hand, pants: B.pants, boot: B.boot };
      CH_OUTFIT[id] = function (x) {
        CH_LOOK.body(x, D);
        D.make(x, K.HX(ag.color));
        [x.hips, x.chest, x.neck, x.armL.arm, x.armL.fore, x.armR.arm, x.armR.fore, x.legL.leg, x.legL.shin, x.legR.leg, x.legR.shin].forEach(CH_LOOK.flatten);
      };
    }
  }
  if (PK) {
    const { PAINT, rgb, cap, bangs, collar } = PK;
    PAINT.gamyeon = {
      face: { eyes: !1, brows: !1, nose: !1, mouth: !1 },
      back(C) {
        const [x, y] = C.P(0, -0.25),
          u = C.u;
        // a ring of red and indigo behind the head, like a drum skin
        C.glow(0xe0475b, 0.6);
        C.ell(x, y, 2.2 * u, 2.2 * u, rgb(0xe0475b, 0.9));
        C.noglow();
        C.ell(x, y, 1.75 * u, 1.75 * u, rgb(0x3a3f6b, 0.95));
        C.ring(x, y, 2.05 * u, 2.05 * u, rgb(0xffd54f, 1.1), 0.08 * u);
      },
      body(C) {
        const u = C.u;
        // the jeogori: white, crossed at the front, a crimson sash
        C.poly([C.Q(-0.95, -0.35), C.Q(0.95, -0.35), C.Q(3.3, 3.2), C.Q(-3.3, 3.2)], rgb(0xf3ede0, 1.02));
        // the collar band crossing left over right, and the 고름 bow hanging from it
        C.line([C.Q(-0.75, -0.25), C.Q(0.55, 1.25)], rgb(0xd9cfbc), 0.22 * u, "butt");
        C.ell(...C.Q(0.55, 1.3), 0.2 * u, 0.15 * u, rgb(0xe0475b, 1.1));
        C.line([C.Q(0.5, 1.35), C.Q(0.25, 3.0)], rgb(0xe0475b, 1.1), 0.24 * u, "butt");
        C.line([C.Q(0.62, 1.35), C.Q(0.95, 2.6)], rgb(0xe0475b, 0.9), 0.16 * u, "butt");
      },
      collar(C) {
        collar(C, 0xf3ede0, 0.45);
      },
      hair(C) {
        cap(C, 0x1b1b1f, 0.3);
        // the topknot
        C.ell(...C.P(0, -1.12), 0.3 * C.u, 0.26 * C.u, rgb(0x1b1b1f, 1.05));
      },
      head(C) {
        const { r, u, cx, ey } = C;
        // the mask over the whole face
        const [mx, my] = C.P(0, 0.08);
        C.ell(mx, my, 0.95 * u, 1.12 * u, "#f1e3c2");
        C.ring(mx, my, 0.95 * u, 1.12 * u, "rgba(122,90,58,.85)", 0.06 * u);
        r.strokeStyle = "#1b1b1f";
        r.lineCap = "round";
        r.lineWidth = 0.075 * u;
        for (const s of [-1, 1]) {
          r.beginPath();
          r.arc(cx + s * 0.36 * u, ey + 0.06 * u, 0.2 * u, Math.PI * 1.1, Math.PI * 1.9);
          r.stroke();
        }
        r.beginPath();
        r.arc(cx, ey + 0.38 * u, 0.36 * u, Math.PI * 0.15, Math.PI * 0.85);
        r.stroke();
        for (const s of [-1, 1]) C.ell(cx + s * 0.58 * u, ey + 0.34 * u, 0.13 * u, 0.13 * u, "rgba(224,71,91,.75)");
      },
    };
    PAINT.simpan = {
      back(C) {
        const u = C.u,
          [x, y] = C.Q(2.0, -1.3);
        // a yellow card and a red one fanned over the shoulder
        C.r.save();
        C.r.translate(x, y);
        C.r.rotate(-0.25);
        C.rr(-0.55 * u, -0.8 * u, 1.1 * u, 1.6 * u, 0.1 * u, rgb(0xf5c518, 1.05));
        C.r.rotate(0.45);
        C.rr(-0.2 * u, -0.8 * u, 1.1 * u, 1.6 * u, 0.1 * u, rgb(0xe53935, 1.05));
        C.r.restore();
      },
      body(C) {
        const u = C.u;
        // the striped shirt
        C.poly([C.Q(-0.95, -0.35), C.Q(0.95, -0.35), C.Q(3.3, 3.2), C.Q(-3.3, 3.2)], "#f4f4ef");
        for (let i = -3; i <= 3; i++) {
          const a = i * 0.24,
            b = i * 0.9;
          C.poly([C.Q(a - 0.08, -0.3), C.Q(a + 0.08, -0.3), C.Q(b + 0.22, 3.2), C.Q(b - 0.22, 3.2)], "#141414");
        }
        // the whistle on its red cord
        C.line([C.Q(-0.55, -0.2), C.Q(0.1, 1.2), C.Q(0.6, -0.2)], rgb(0xd32f2f), 0.06 * u);
        C.rr(...C.Q(-0.15, 1.1), 0.5 * u, 0.22 * u, 0.1 * u, "#cfd8dc");
      },
      collar(C) {
        collar(C, 0x141414, 0.42);
      },
      hair(C) {
        cap(C, 0x2b2420, 0.15);
        bangs(C, 0x2b2420, { n: 7, lo: -0.4, hi: -0.48 });
      },
      head(C) {
        const u = C.u;
        // the black cap and its peak
        C.rr(...C.P(-0.95, -1.12), 1.9 * u, 0.62 * u, 0.32 * u, "#141414");
        C.ell(...C.P(0.1, -0.52), 1.15 * u, 0.2 * u, "#1d1d1d");
      },
    };
  }

  // the roster strip and the picker: draw them again for 42
  try {
    const tr = document.getElementById("title-roster");
    tr && "function" == typeof renderTitleRoster && ((tr.innerHTML = ""), renderTitleRoster());
    "function" == typeof renderSelect && renderSelect();
  } catch (e) {}
  window.AGENTS4 = { ids: NEW.map((a) => a.id), types: Object.keys(H), last: LAST, lastFoeCast, timeouts: TIMEOUTS, lines: LINES, inTimeout, homeOf, costumeOn, costumeOff };
})();
