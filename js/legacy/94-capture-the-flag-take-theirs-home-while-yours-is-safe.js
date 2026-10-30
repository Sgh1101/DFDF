(() => {
  // 깃발 탈취 (capture the flag). Each side has a flag standing at its spawn. Walk into the other
  // side's flag to pick it up and carry it back to your own flag's place to score. The carrier is a little slower and shows to everyone; if they die the
  // flag drops where they fell. A dropped flag goes home when one of its own side touches it, or
  // after 15 s; an enemy touching it picks it up again. First to 3 captures (or more at the end);
  // kills do not score, but the weapons, pickups and 3 s respawns are the team deathmatch's.
  // The host keeps the flags and tells each guest.
  if ("undefined" == typeof killActor || "undefined" == typeof step || !window.GAME_MODES || !GAME_MODES.ctf) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const MODE = "ctf",
    CAPS = 3,
    PICK = 2.3,
    CAPR = 2.8,
    RETURN = 15,
    CARRY_SPEED = 0.9;
  const ours = () => "object" == typeof room && room && MODE === room.mode;
  const inMatch = () => !!(world.actors && world.actors.length);
  const isHost = () => "undefined" == typeof NET || "client" !== NET.mode;
  const COL = { atk: 0xff6b4a, def: 0x38b6f8 };
  const hexs = (n) => "#" + n.toString(16).padStart(6, "0");
  const other = (t) => ("atk" === t ? "def" : "atk");
  const homeOf = (t) => {
    const s = "atk" === t ? MAP.attackSpawn : MAP.defendSpawn;
    return { x: s.x, z: s.z, y: "function" == typeof groundAt ? groundAt(s.x, s.z, 2) : 0 };
  };

  // F[t] is the flag that belongs to team t: home, carried (by the other team) or dropped
  const mkFlag = (t) => {
    const h = homeOf(t);
    return { team: t, st: "home", by: null, x: h.x, z: h.z, y: h.y, t: 0, home: h };
  };
  const F = { atk: mkFlag("atk"), def: mkFlag("def") };
  const caps = { atk: 0, def: 0 };
  let sent = 0,
    last = null;
  function reset() {
    for (const t of ["atk", "def"]) {
      const h = homeOf(t);
      Object.assign(F[t], { st: "home", by: null, x: h.x, z: h.z, y: h.y, t: 0, home: h });
    }
    caps.atk = caps.def = 0;
    world.scoreAtk = 0;
    world.scoreDef = 0;
    last = null;
  }
  const carrying = (a) => (F.atk.by === a.id ? F.atk : F.def.by === a.id ? F.def : null);
  const say = (msg, color) => {
    banner(msg, color);
    "host" === NET.mode && sendEventAll({ t: "round", msg, color });
  };
  const nameOf = (t) => (EN ? ("atk" === t ? "Attackers'" : "Defenders'") : "atk" === t ? "공격팀" : "수비팀");

  // ── the rules (host) ──
  function pickUp(f, a) {
    f.st = "carried";
    f.by = a.id;
    f.t = 0;
    say(L(`${a.name || "누군가"}가 ${nameOf(f.team)} 깃발을 들었습니다`, `${a.name || "Someone"} has the ${nameOf(f.team)} flag`), hexs(COL[a.team]));
  }
  function sendHome(f, why) {
    f.st = "home";
    f.by = null;
    f.x = f.home.x;
    f.z = f.home.z;
    f.y = f.home.y;
    f.t = 0;
    why && say(why, hexs(COL[f.team]));
  }
  function drop(f, x, z) {
    if (f.st !== "carried") return;
    f.st = "dropped";
    f.by = null;
    f.t = 0;
    f.x = x;
    f.z = z;
    f.y = "function" == typeof groundAt ? groundAt(x, z, 2) : 0;
    say(L(`${nameOf(f.team)} 깃발이 떨어졌습니다`, `The ${nameOf(f.team)} flag is down`), "#ffd54f");
  }
  const near = (a, p, r) => a.alive && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) <= r && Math.abs((a.y || 0) - (p.y || 0)) < 3.5;
  function tick(dt) {
    if ("live" !== world.phase || world.over) return;
    for (const t of ["atk", "def"]) {
      const f = F[t],
        e = other(t);
      if (f.st === "carried") {
        const c = actorById(f.by);
        if (!c || !c.alive) {
          drop(f, c ? c.pos.x : f.x, c ? c.pos.z : f.z);
          continue;
        }
        f.x = c.pos.x;
        f.z = c.pos.z;
        f.y = c.y || 0;
        // home with it (their own flag need not be there: a stalled game helps nobody)
        if (near(c, F[e].home, CAPR)) {
          caps[e]++;
          world.scoreAtk = caps.atk;
          world.scoreDef = caps.def;
          say(L(`${nameOf(e)} 득점! ${caps.atk} : ${caps.def}`, `${nameOf(e)} score! ${caps.atk} : ${caps.def}`), hexs(COL[e]));
          sendHome(f);
          if (caps[e] >= CAPS) return void finish();
        }
      } else if (f.st === "dropped") {
        f.t += dt;
        if (f.t >= RETURN) {
          sendHome(f, L(`${nameOf(t)} 깃발이 제자리로 돌아갔습니다`, `The ${nameOf(t)} flag went home`));
          continue;
        }
        for (const a of world.actors) {
          if (!near(a, f, PICK)) continue;
          if (a.team === t) {
            sendHome(f, L(`${nameOf(t)} 깃발을 되찾았습니다`, `The ${nameOf(t)} flag is back`));
            break;
          }
          if (!carrying(a)) {
            pickUp(f, a);
            break;
          }
        }
      } else {
        for (const a of world.actors)
          if (a.team === e && !carrying(a) && near(a, f, PICK)) {
            pickUp(f, a);
            break;
          }
      }
    }
  }
  function finish() {
    if (world.over) return;
    world.over = !0;
    world.phase = "end";
    say(L("경기 종료", "Match over"), "#ffc849");
    scheduleMatchFinish();
  }

  const _sr = startRound;
  startRound = function () {
    const r = _sr.apply(this, arguments);
    if (ours() && inMatch()) {
      if (isHost()) {
        try {
          reset();
          send(!0);
          setTimeout(() => ours() && inMatch() && banner(L(`깃발 탈취 · 적 깃발을 우리 깃발 자리로 · ${CAPS}점 먼저`, `Capture the flag · ${CAPS} first`), "#ffc849"), 500);
        } catch (e) {
          console.warn("ctf", e);
        }
      }
    } else drop_();
    return r;
  };
  // a carrier who dies drops the flag; kills do not score here
  const _ka = killActor;
  killActor = function (v) {
    if (!ours() || !inMatch() || !isHost()) return _ka.apply(this, arguments);
    const f = v && carrying(v);
    const px = v && v.pos.x,
      pz = v && v.pos.z;
    try {
      return _ka.apply(this, arguments);
    } finally {
      world.scoreAtk = caps.atk;
      world.scoreDef = caps.def;
      f && drop(f, px, pz);
      v && (v.speedBuff = 1);
    }
  };

  // ── bots ──
  // one in three stays to guard, the others go for the flag; whoever carries goes home; anyone
  // whose own flag has been taken hunts the carrier (or picks the dropped flag up)
  const spread = (ai, key, p, r) => {
    const k = ai[key];
    if (!k || k.cx !== p.x || k.cz !== p.z || Math.hypot(k.x - ai._me.x, k.z - ai._me.z) < 1.5) {
      const a = Math.random() * 6.28,
        d = Math.random() * r;
      ai[key] = { cx: p.x, cz: p.z, x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
    }
    return ai[key];
  };
  if ("function" == typeof aiGoal) {
    const _ag = aiGoal;
    aiGoal = function (e) {
      if (!ours() || !inMatch()) return _ag.apply(this, arguments);
      const ai = e.ai || (e.ai = freshAIState());
      ai._me = e.pos;
      const t = e.team,
        mine = F[t],
        theirs = F[other(t)];
      if (carrying(e)) {
        // bring it home
        return spread(ai, "_ctfHome", mine.home, 1.2);
      }
      if (mine.st === "carried") {
        const c = actorById(mine.by);
        if (c) return { x: c.pos.x, z: c.pos.z };
      }
      if (mine.st === "dropped") return { x: mine.x, z: mine.z };
      const guard = (e.id + 1) % 3 === 0;
      if (guard) return spread(ai, "_ctfGuard", mine.home, 9);
      if (theirs.st === "carried" && theirs.by !== e.id) {
        // a mate has it: escort; or the foe holds... not possible (a carrier is always the other team)
        const c = actorById(theirs.by);
        if (c) return { x: c.pos.x + rnd(-4, 4), z: c.pos.z + rnd(-4, 4) };
      }
      return { x: theirs.x, z: theirs.z };
    };
  }

  // a bot with the flag runs for home and does not stop to fight (a firefight in the middle would
  // end every run before it started)
  if ("function" == typeof aiThink && "function" == typeof navNext && "function" == typeof steerToward) {
    const _at = aiThink;
    aiThink = function (e, dt) {
      const r = _at.apply(this, arguments);
      try {
        if (ours() && inMatch() && e.alive && e.ai && carrying(e)) {
          const g = aiGoal(e),
            n = navNext(e, g.x, g.z, dt);
          stuckCheck(e, dt, n.x, n.z);
          steerToward(e, n.x, n.z, dt, 6);
          e.input.mv = [0, -1];
        }
      } catch (x) {}
      return r;
    };
  }

  // ── the screen: flags in the world, a bar, the minimap ──
  const G = { atk: null, def: null };
  const mk = (col, op, add) => new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: op, depthWrite: !1, side: T.DoubleSide, blending: add ? T.AdditiveBlending : T.NormalBlending });
  function build() {
    if (G.atk) return;
    for (const t of ["atk", "def"]) {
      const g = new T.Group(),
        col = COL[t];
      const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 3.2, 8), new T.MeshBasicMaterial({ color: 0xeeeeee }));
      pole.position.y = 1.6;
      const cloth = new T.Mesh(new T.PlaneGeometry(1.5, 0.9, 6, 1), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide }));
      cloth.position.set(0.8, 2.7, 0);
      const base = new T.Mesh(new T.RingGeometry(CAPR - 0.4, CAPR, 48), mk(col, 0.85, !0));
      base.rotation.x = -Math.PI / 2;
      base.position.y = 0.07;
      const disc = new T.Mesh(new T.CircleGeometry(CAPR - 0.4, 40), mk(col, 0.14));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.06;
      const beam = new T.Mesh(new T.CylinderGeometry(0.5, 0.9, 16, 16, 1, !0), mk(col, 0.1, !0));
      beam.position.y = 8;
      g.add(pole, cloth, beam);
      g.userData = { pole, cloth, beam, base, disc, t };
      g.traverse((o) => o.material && (o.material.userData.keep = !0));
      scene.add(g, base, disc);
      G[t] = { g, base, disc };
    }
  }
  function dropMeshes() {
    for (const t of ["atk", "def"]) {
      const o = G[t];
      if (!o) continue;
      for (const m of [o.g, o.base, o.disc]) {
        scene.remove(m);
        m.traverse((n) => {
          n.geometry && n.geometry.dispose();
          n.material && n.material.dispose();
        });
      }
      G[t] = null;
    }
  }
  const drop_ = dropMeshes;
  function paint(clock) {
    if (!ours() || !inMatch() || "menu" === world.phase) {
      for (const t of ["atk", "def"]) G[t] && ((G[t].g.visible = !1), (G[t].base.visible = !1), (G[t].disc.visible = !1));
      return;
    }
    build();
    for (const t of ["atk", "def"]) {
      const f = F[t],
        o = G[t],
        u = o.g.userData;
      o.g.visible = o.base.visible = o.disc.visible = !0;
      o.base.position.set(f.home.x, f.home.y + 0.07, f.home.z);
      o.disc.position.set(f.home.x, f.home.y + 0.06, f.home.z);
      let x = f.x,
        y = f.y,
        z = f.z,
        s = 1;
      if (f.st === "carried") {
        const c = actorById(f.by);
        c && ((x = c.pos.x), (z = c.pos.z), (y = (c.y || 0) + 1.9), (s = 0.55));
      }
      o.g.position.set(x, y, z);
      o.g.scale.setScalar(s);
      u.cloth.rotation.y = Math.sin(clock * 4 + (t === "atk" ? 0 : 1.7)) * 0.25;
      u.beam.visible = f.st !== "carried";
      u.beam.material.opacity = f.st === "dropped" ? 0.12 + 0.12 * Math.abs(Math.sin(clock * 6)) : 0.1;
      // the base glows brighter when its flag is home
      o.base.material.opacity = f.st === "home" ? 0.9 : 0.3 + 0.2 * Math.sin(clock * 5);
      o.disc.material.opacity = f.st === "home" ? 0.16 : 0.05;
    }
  }
  const state = (t, mineT) => {
    const f = F[t];
    return f.st === "home" ? L("제자리", "home") : f.st === "carried" ? L("운반 중", "carried") : L(`떨어짐 ${Math.ceil(RETURN - f.t)}s`, `down ${Math.ceil(RETURN - f.t)}s`);
  };
  function hud() {
    let el = $("ctf-hud");
    const on = ours() && inMatch() && "menu" !== world.phase && "over" !== world.phase;
    if (!on) return void (el && (el.hidden = !0));
    if (!el) {
      el = document.createElement("div");
      el.id = "ctf-hud";
      el.style.cssText = "position:absolute;top:86px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:5px;font:700 12px/1.4 var(--f-display,system-ui);letter-spacing:.05em;color:#fff;white-space:nowrap";
      el.innerHTML = `<div style="display:flex;gap:8px"><span id="cf-a" style="padding:4px 12px;border-radius:999px;background:rgba(10,13,18,.72);border:1px solid #ff6b4a"></span><span id="cf-d" style="padding:4px 12px;border-radius:999px;background:rgba(10,13,18,.72);border:1px solid #38b6f8"></span></div><div id="cf-h" style="padding:3px 12px;border-radius:999px;background:rgba(255,200,73,.2);border:1px solid rgba(255,200,73,.6);color:#ffe9a8"></div>`;
      ($("hud") || document.body).appendChild(el);
    }
    const me = ("function" == typeof myActor && myActor()) || player,
      mine = me && me.team;
    el.hidden = !1;
    const mark = (t) => (t === mine ? L("우리 깃발", "Our flag") : L("적 깃발", "Their flag"));
    $("cf-a").textContent = `🚩 ${mark("atk")} · ${state("atk")}`;
    $("cf-d").textContent = `🚩 ${mark("def")} · ${state("def")}`;
    const h = $("cf-h"),
      my = me && carrying(me);
    let hint = "";
    if (my) hint = L("깃발을 들었습니다 — 우리 깃발 자리로!", "You have the flag — run it home!");
    else if (F[mine].st === "carried") hint = L("우리 깃발이 가져가졌습니다 — 운반자를 잡으세요", "They have our flag — stop the carrier");
    else if (F[mine].st === "dropped") hint = L("우리 깃발이 떨어졌습니다 — 닿으면 되돌립니다", "Our flag is down — touch it to return it");
    h.hidden = !hint;
    h.textContent = hint;
  }
  const _uh = updateHUD;
  updateHUD = function () {
    const r = _uh.apply(this, arguments);
    try {
      if (ours() && inMatch() && "function" == typeof _hT && $("tb-phase")) _hT($("tb-phase"), "buy" === world.phase ? L("준비", "Ready") : `${L("깃발 탈취", "CTF")} · ${CAPS}`);
    } catch (e) {}
    return r;
  };
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    try {
      if (ours() && inMatch() && "undefined" != typeof mctx) {
        const b = MAP.bounds,
          X = (x) => ((x - b.minX) * mini.width) / (b.maxX - b.minX),
          Y = (z) => ((z - b.minZ) * mini.height) / (b.maxZ - b.minZ);
        for (const t of ["atk", "def"]) {
          const f = F[t];
          mctx.strokeStyle = hexs(COL[t]);
          mctx.lineWidth = 1.5;
          mctx.beginPath();
          mctx.arc(X(f.home.x), Y(f.home.z), 5, 0, 7);
          mctx.stroke();
          if (f.st !== "home") {
            mctx.fillStyle = hexs(COL[t]);
            mctx.fillRect(X(f.x) - 4, Y(f.z) - 4, 8, 8);
            mctx.strokeStyle = "#fff";
            mctx.strokeRect(X(f.x) - 4, Y(f.z) - 4, 8, 8);
          }
        }
      }
    } catch (e) {}
    return r;
  };

  // ── tell the guests ──
  function send(force) {
    if ("host" !== NET.mode) return;
    const now = performance.now();
    if (!force && now - sent < 200) return;
    sent = now;
    const pack = (f) => [f.st, f.by, Math.round(f.x * 10), Math.round(f.z * 10), Math.round(f.y * 10), Math.round(f.t)];
    try {
      sendStateMsg({ t: "ctf", a: pack(F.atk), d: pack(F.def), c: [caps.atk, caps.def], h: [F.atk.home, F.def.home].map((h) => [Math.round(h.x * 10), Math.round(h.z * 10), Math.round(h.y * 10)]) });
    } catch (e) {}
  }
  const _oe = NET.onEvent;
  NET.onEvent = function (m) {
    if (m && "ctf" === m.t) {
      try {
        for (const [k, p] of [["atk", m.a], ["def", m.d]]) Object.assign(F[k], { st: p[0], by: p[1], x: p[2] / 10, z: p[3] / 10, y: p[4] / 10, t: p[5] });
        m.h && ["atk", "def"].forEach((t, i) => (F[t].home = { x: m.h[i][0] / 10, z: m.h[i][1] / 10, y: m.h[i][2] / 10 }));
        caps.atk = m.c[0];
        caps.def = m.c[1];
      } catch (e) {}
      return;
    }
    return _oe && _oe.apply(this, arguments);
  };

  // ── every step ──
  let clock = 0;
  const _step = step;
  step = function (dt) {
    const r = _step.apply(this, arguments);
    try {
      const d = dt || 0.016;
      clock += d;
      if (ours() && inMatch()) {
        if (isHost() && !world.over) {
          tick(d);
          send();
        }
        // the carrier is a little slower (on every screen: a guest moves its own player)
        for (const a of world.actors) {
          if (carrying(a)) {
            a.speedBuff = CARRY_SPEED;
            a.speedBuffT = 0.3;
            a._ctfSlow = !0;
          } else if (a._ctfSlow) {
            a._ctfSlow = !1;
            a.speedBuff = 1;
            a.speedBuffT = 0;
          }
        }
        paint(clock);
        hud();
      } else {
        G.atk && paint(clock);
        hud();
      }
    } catch (e) {}
    return r;
  };
  const _go = gameOver;
  gameOver = function () {
    if (ours()) {
      world.scoreAtk = caps.atk;
      world.scoreDef = caps.def;
    }
    return _go.apply(this, arguments);
  };

  window.CTF = { F, caps, tick, reset, CAPS, PICK, CAPR, RETURN, carrying, pickUp, drop, sendHome };
})();
