(() => {
  const EN = window.GAME_LANG === "en", L = (ko, en) => EN ? en : ko;
  const seen = new Set(), roundKills = new Map(), active = new Set();
  const pendingKills = new Map();
  let serial = 0, gunDepth = 0, finishedRound = false, claimedRound = false;
  let previewFrame = 0;
  const currentActor = () => myActor() || player;
  const skinOf = (actor, gun) => window.GUN_SKINS && GUN_SKINS.skinOf(actor, gun);
  const remember = (event) => {
    if (!event || typeof event.id !== "string" || seen.has(event.id)) return false;
    seen.add(event.id); if (seen.size > 200) seen.delete(seen.values().next().value);
    return true;
  };
  function clearFinishers() {
    window.CHAMPIONS_AUDIO?.stopMusic();
    cancelAnimationFrame(previewFrame); previewFrame = 0;
    for (const mesh of active) mesh.userData.finisherCleanup?.();
    for (const mesh of active) if (mesh.userData.previewScene) {
      mesh.userData.previewRestore && mesh.userData.previewRestore();
      mesh.userData.previewScene.remove(mesh);
      mesh.traverse((part) => { part.geometry && part.geometry.dispose(); part.material && part.material.dispose(); });
    }
    for (let i = fx.length - 1; i >= 0; i--) if (active.has(fx[i].mesh)) {
      const mesh = fx[i].mesh; scene.remove(mesh);
      mesh.traverse((part) => { part.geometry && part.geometry.dispose(); part.material && part.material.dispose(); });
      fx.splice(i, 1);
    }
    active.clear();
  }
  function visual(event, preview = false) {
    if (!preview && (!GAME_RULES.finisher(event) || finishedRound)) return false;
    const skin = GUN_SKINS.list.find((s) => s.id === GAME_RULES.finisherSkin(event));
    if (skin && GAME_RULES.championsSkin(skin.id)) window.CHAMPIONS_AUDIO?.playMusic("finisher_music", preview, 8 - 3.03, 3.03);
    if (!skin || skin.id === "default" || SETTINGS.motion === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const pack = SOUNDPACK.skins[skin.id], color = skin.glow || skin.edge || 0x80caff;
    // an Epic skin (and a Legendary one without a figure of its own) plays its ring larger and longer, with a
    // flash, shockwaves over the ground, a pillar of light, a fountain of sparks and a turning halo in its colour
    const grand = (skin.rar || 0) >= 3 && !GAME_RULES.championsSkin(skin.id) && !(window.FINISHER_LEGEND && FINISHER_LEGEND.themes[skin.id]);
    const duration = GAME_RULES.championsSkin(skin.id) ? 8 : grand ? 2.8 : 1.8;
    const started = performance.now();
    const studio = preview && GUN_SKINS._pv();
    if (preview && !studio) return false;
    const origin = preview ? new T.Vector3(0, 0, 0) : new T.Vector3(event.x, event.y, event.z);
    const group = new T.Group(); group.position.copy(origin);
    const phantom = window.CHAMPIONS_PHANTOM && CHAMPIONS_PHANTOM.isSkin(skin.id) ? CHAMPIONS_PHANTOM.finisher(group, skin, event) : null;
    if (window.CHAMPIONS_PHANTOM?.isSkin(skin.id) && !phantom) return false;
    if (!phantom) {
      const rings = (pack === "cosmic" ? 3 : 2) + (grand ? 1 : 0);
      for (let i = 0; i < rings; i++) {
        const ring = new T.Mesh(new T.TorusGeometry(0.5 + i * 0.18, grand ? 0.03 : 0.018, 5, 36), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.1 + i * 0.3;
        group.add(ring);
      }
      if (grand) {
        const glow = (c, o) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
        const add = (mesh, kind, data) => { mesh.userData.kind = kind; Object.assign(mesh.userData, data); group.add(mesh); return mesh; };
        add(new T.Mesh(new T.SphereGeometry(0.5, 14, 10), glow(0xffffff, 1)), "flash").position.y = 0.9;
        for (let i = 0; i < 2; i++) add(new T.Mesh(new T.TorusGeometry(1, 0.04, 5, 48), glow(color, 0.9)), "wave", { at: i * 0.12 }).rotation.x = Math.PI / 2;
        const pillar = add(new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 9, 18, 1, true), glow(color, 0.4)), "pillar");
        pillar.geometry.translate(0, 4.5, 0);
        const sparks = Math.round(26 * Math.min(1, GFX.fx)) + 8;
        for (let i = 0; i < sparks; i++) {
          const a = Math.random() * Math.PI * 2, out = 1 + Math.random() * 2.6;
          add(new T.Mesh(new T.TetrahedronGeometry(0.06 + (i % 3) * 0.025), glow(i % 3 ? color : 0xffffff, 1)), "spark", { v: [Math.cos(a) * out, 3.5 + Math.random() * 4, Math.sin(a) * out], spin: 4 + Math.random() * 8 });
        }
        for (let i = 0; i < 6; i++) add(new T.Mesh(new T.OctahedronGeometry(0.13), glow(i % 2 ? 0xffffff : color, 1)), "halo", { a: i * Math.PI / 3 }).scale.set(0.7, 1.4, 0.7);
      }
      const count = Math.max(6, Math.round((grand ? 30 : 16) * Math.min(1, GFX.fx)));
      for (let i = 0; i < count; i++) {
        const crystal = pack === "crystal" || pack === "royal";
        const mesh = new T.Mesh(crystal ? new T.OctahedronGeometry(0.09) : new T.TetrahedronGeometry(0.08), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
        mesh.userData.angle = i * Math.PI * 2 / count; mesh.userData.height = i % 4 * 0.18;
        group.add(mesh);
      }
    }
    if (!preview) finishedRound = true;
    if (!preview && window.FINISHER_LEGEND) try { FINISHER_LEGEND.play(event, skin); } catch (e) {}
    active.add(group);
    const animate = (mesh, t) => {
      if (duration === 8) t = Math.min(1, Math.max(t, (performance.now() - started) / 8000));
      if (phantom) phantom(t);
      const reach = grand ? 1.8 : 1;
      const radius = (pack === "cosmic" ? 1.1 * (1 - t) : 0.35 + 0.9 * t) * reach;
      const sec = t * duration, fade = Math.min(1, t / 0.08) * (1 - t);
      mesh.children.forEach((part, i) => {
        if (part.userData.phantom) return;
        const u = part.userData;
        if (u.kind === "flash") {
          const k = t / 0.1; part.visible = k < 1;
          if (k < 1) { part.scale.setScalar(1 + k * 6); part.material.opacity = 1 - k; }
          return;
        }
        if (u.kind === "wave") {
          const k = (t - u.at) / 0.5; part.visible = k > 0 && k < 1;
          if (part.visible) { part.scale.setScalar(0.4 + k * 5); part.material.opacity = 0.9 * (1 - k); }
          return;
        }
        if (u.kind === "pillar") {
          part.scale.set(0.4 + fade * 1.2, Math.min(1, t / 0.12), 0.4 + fade * 1.2);
          part.material.opacity = 0.4 * fade * (pack === "energy" ? 0.7 + 0.3 * Math.sin(sec * 40) : 1);
          return;
        }
        if (u.kind === "spark") {
          const y = u.v[1] * sec - 6 * sec * sec;
          part.position.set(u.v[0] * sec, Math.max(0.05, y), u.v[2] * sec);
          part.rotation.set(sec * u.spin, sec * 3, 0); part.material.opacity = 1 - t;
          return;
        }
        if (u.kind === "halo") {
          const a = u.a + sec * (pack === "dragon" ? 3 : 1.8);
          part.position.set(Math.cos(a) * 1.4, 2.6 + 0.2 * Math.sin(sec * 3 + u.a), Math.sin(a) * 1.4);
          part.rotation.y = sec * 4; part.material.opacity = fade;
          return;
        }
        part.material.opacity = (1 - t) * 0.8;
        if (part.userData.angle == null) {
          part.rotation.z = t * Math.PI * (i % 2 ? -2 : 2);
          part.scale.setScalar((0.6 + t * 1.3) * reach);
          if (pack === "energy") part.rotation.x = Math.PI / 2 + Math.sin(t * 9) * 0.4;
        } else {
          const angle = part.userData.angle + t * (pack === "dragon" ? 9 : 5);
          part.position.set(Math.cos(angle) * radius, part.userData.height * reach + Math.sin(t * Math.PI) * (pack === "dragon" ? 1.5 : 1) * reach, Math.sin(angle) * radius);
          part.rotation.set(t * 7, angle, t * 4); part.scale.setScalar(1 - t * 0.7);
        }
      });
      if (t > 0.98 && !preview && duration !== 8) active.delete(mesh);
    };
    if (preview) {
      group.userData.previewScene = studio.sc;
      studio.sc.add(group);
      if (phantom) {
        const before = { fit: studio.fit, dist: studio.dist, d: studio.d, ty: studio.ty, tyc: studio.tyc, pitch: studio.pitch, pc: studio.pc, auto: studio.auto }, obj = studio.obj, far = studio.cam.far;
        const box = new T.Box3().setFromObject(group);
        group.traverse(part => { if (part.userData.previewBounds) box.union(part.userData.previewBounds.clone().applyMatrix4(part.matrixWorld)); });
        const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
        group.position.x -= center.x; group.position.z -= center.z;
        studio.fit = { L: Math.max(size.x, size.z), H: size.y, w: 0.8, h: 0.8 };
        studio.ty = studio.tyc = center.y; studio.pitch = studio.pc = 0.1; studio.auto = false;
        const tan = Math.tan(studio.cam.fov * Math.PI / 360);
        studio.dist = studio.d = Math.max(studio.fit.L / (2 * tan * studio.cam.aspect * 0.8), size.y / (2 * tan * 0.8));
        studio.cam.far = Math.max(far, studio.dist * 2 + size.z * 2); studio.cam.updateProjectionMatrix();
        if (obj) obj.visible = false;
        group.userData.previewRestore = () => { studio.cam.far = far; studio.cam.updateProjectionMatrix(); if (studio.obj === obj) { Object.assign(studio, before); if (obj) obj.visible = true; } };
      }
      const frame = () => {
        const t = (performance.now() - started) / (duration * 1000);
        if (t >= 1 || !GUN_SKINS.isOpen()) return clearFinishers();
        animate(group, t); previewFrame = requestAnimationFrame(frame);
      };
      previewFrame = requestAnimationFrame(frame);
    } else addFx(group, duration, animate);
    return true;
  }
  window.FINISHERS = { play: visual, clear: clearFinishers, active, preview(skin) {
    const s = typeof skin === "string" ? skin : skin.id;
    clearFinishers();
    return visual({ skin: s }, true);
  } };

  for (const name of ["actorFire", "hitscan", "actorHitscan"]) {
    const original = window[name];
    if (typeof original !== "function") continue;
    window[name] = function () {
      gunDepth++;
      try { return original.apply(this, arguments); }
      finally { gunDepth--; }
    };
  }
  const fire = actorFire;
  actorFire = function (actor) {
    if (!actor) return fire.apply(this, arguments);
    const gun = actorWeaponKey(actor), before = actor.ammo && actor.ammo[gun];
    const skin = (skinOf(actor, gun) || {}).id || "default";
    const cause = DAMAGE_CAUSE.capture(actor, gun, actor.ultW ? "ability" : gun === "knife" ? "melee" : "gun", world.round, skin);
    const args = arguments, self = this;
    const result = DAMAGE_CAUSE.run(cause, () => fire.apply(self, args));
    // Rockets already carry their launch sound with the arm event.
    if (NET.mode === "host" && before !== (actor.ammo && actor.ammo[gun]) && !["knife", "rpg"].includes(gun)) {
      // the sound rides in the snapshot's effects (FX.SND) with the shooter; a guest that does not read it is sent the event
      const i = WKEYS.indexOf(gun);
      pushFX(FX.SND, 0, 0, 0, i, actor.id, skin === "default" ? 0 : skin, ...(i < 0 ? [gun] : []));
      for (const [peer, c] of NET.conns) c.nv || c.quiet || !c.event || !c.event.open || sendEventTo(peer, { t: "shot-sound", actor: actor.id, gun, skin });
    }
    return result;
  };
  const kill = killActor;
  killActor = function (victim, killer) {
    let event = null;
    if (NET.mode !== "client" && victim && victim.alive && killer && killer !== victim && killer.team !== victim.team) {
      const origin = DAMAGE_CAUSE.get();
      const cause = origin && origin.actor === killer.id && origin.round === world.round ? origin : null;
      const gun = cause ? cause.gun : actorWeaponKey(killer), skin = cause ? cause.skin : (skinOf(killer, gun) || {}).id || "default";
      const foes = world.actors.filter((a) => a.team !== killer.team);
      const victims = new Set(roundKills.get(killer.id) || []); victims.add(victim.id);
      const last = room.mode === "std" && world.phase === "live" && !foes.some((a) => a !== victim && a.alive);
      const kind = cause ? cause.kind : gunDepth ? gun === "knife" ? "melee" : "gun" : "ability";
      const head = kind === "gun" && gun !== "rpg" && !!victim._lastHead;
      event = { t: "kill-detail", id: `${NET.room || "solo"}:${world.round}:${++serial}`, round: world.round, mode: room.mode || "std", killer: killer.id, victim: victim.id, name: victim.name || victim.agent.name, gun, skin, head, finisherYaw: Math.atan2(killer.pos.x - victim.pos.x, killer.pos.z - victim.pos.z), kind: head ? "head" : kind, last, ace: last && foes.length >= 3 && victims.size === foes.length, x: victim.pos.x, y: (victim.y || 0) + 0.6, z: victim.pos.z };
      // a player's round-ending kill plays the finisher of the skin the gun wears (the Champions one only for a Champions skin); a bot's never does
      if (typeof isAI == "function" && isAI(killer)) event.byBot = true;
      event.finisherTick = Math.floor(performance.now() / 50);
      event.distance = Math.round(Math.hypot(killer.pos.x-victim.pos.x,(killer.y||0)-(victim.y||0),killer.pos.z-victim.pos.z));
      event.armorAbsorbed = victim._lastArmorBlocked || 0;
      event.finisher = !claimedRound && GAME_RULES.finisher(event);
    }
    const previous = window.KILL_EVENT, previousDeadline = world.championsFinishUntil;
    const champions = event && event.finisher && GAME_RULES.championsFinisher(event);
    if (champions) world.championsFinishUntil = performance.now() + 8000;
    window.KILL_EVENT = event;
    try {
      const result = kill.apply(this, arguments);
      if (event && !victim.alive && remember(event)) {
        const victims = roundKills.get(killer.id) || new Set(); victims.add(victim.id); roundKills.set(killer.id, victims);
        if (event.finisher) claimedRound = true;
        visual(event);
        dispatchEvent(new CustomEvent("kill-confirmed", { detail: structuredClone(event) }));
        if (NET.mode === "host") sendEventAll(event);
      }
      return result;
    } finally {
      if (champions && victim.alive) world.championsFinishUntil = previousDeadline;
      window.KILL_EVENT = previous;
    }
  };
  const input = NET.onInput;
  NET.onInput = function (peer, data) { if (GAME_RULES.validInput(data)) return input.apply(this, arguments); };
  // a guest says what it can read in its hello (nv 2: the snapshot carries shot sounds and mode state); the host sends the old
  // messages to a guest that says nothing
  const playShot = (id, gun, skin) => {
    const actor = actorById(id);
    if (!gun || !actor || actor === currentActor()) return;
    const previous = window.SKIN_SHOOTER, previousShot = window.SKIN_SHOT; window.SKIN_SHOOTER = actor; window.SKIN_SHOT = { t: "shot-sound", actor: id, gun, skin };
    try { SFX.gun(gun, Math.min(1, actor.pos.distanceTo(currentActor().pos) / 60)); }
    finally { window.SKIN_SHOOTER = previous; window.SKIN_SHOT = previousShot; }
  };
  const remoteFx = playRemoteFX;
  playRemoteFX = function (list) {
    if (!Array.isArray(list) || !list.some((f) => f[0] === FX.SND)) return remoteFx.apply(this, arguments);
    const rest = [];
    for (const f of list) { if (f[0] === FX.SND) try { playShot(f[5], WKEYS[f[4]] || f[7], f[6] || "default"); } catch (e) {} else rest.push(f); }
    return rest.length ? remoteFx.call(this, rest) : undefined;
  };
  const reconnectKeys = new Map(), NETV = 2;
  let reconnectCode = "", reconnectSecret = "";
  const send = sendAction;
  sendAction = function (message) {
    if (message && message.t === "hello") {
      if (reconnectCode !== NET.room) { reconnectCode = NET.room; reconnectSecret = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16).padStart(8, "0")).join(""); }
      message = { ...message, reconnect: reconnectSecret, nv: NETV };
    }
    return send.call(this, message);
  };
  const action = NET.onAction;
  NET.onAction = function (peer, message) {
    if (!message || typeof message !== "object" || typeof message.t !== "string") return;
    if (message.t === "hello") {
      if (message.prev && reconnectKeys.get(message.prev) !== message.reconnect) return;
      if (!/^[a-f0-9]{32}$/.test(message.reconnect || "")) { if (message.prev) return; }
      else reconnectKeys.set(peer, message.reconnect);
      const conn = NET.conns && NET.conns.get(peer); if (conn) conn.nv = Number.isInteger(message.nv) ? message.nv : 0;
    }
    return action.apply(this, arguments);
  };
  const receive = NET.onEvent;
  NET.onEvent = function (event) {
    if (event && event.t === "ability-state") {
      const actor = currentActor(), ability = actor.abilities && actor.abilities[event.i];
      if (ability) { ability.charges = event.charges; ability.cd = event.cd; actor.ultCharge = event.ult; }
      if (!event.ok) banner(L("능력을 사용할 수 없습니다", "Ability unavailable"), "#8a97ab");
      return;
    }
    if (event && event.t === "shot-sound") { playShot(event.actor, event.gun, event.skin); return; }
    if (event && event.t === "kill-detail") {
      if (event.round !== world.round) {
        if (event.round === world.round + 1 && typeof event.id === "string") {
          pendingKills.set(event.id, { event, time: performance.now() });
          if (pendingKills.size > 20) pendingKills.delete(pendingKills.keys().next().value);
        }
        return;
      }
      if (!remember(event)) return;
      event = { ...event, finisher: !claimedRound && GAME_RULES.finisher(event) };
      if (event.finisher) claimedRound = true;
      if (GAME_RULES.championsFinisher(event) && !(world.championsFinishUntil > performance.now())) world.championsFinishUntil = performance.now() + 8000;
      if (event.killer === currentActor().id) {
        const previous = window.KILL_EVENT; window.KILL_EVENT = event;
        try { playKillFx(event.name, event.head); } finally { window.KILL_EVENT = previous; }
      }
      visual(event); dispatchEvent(new CustomEvent('kill-confirmed', {detail:structuredClone(event)})); return;
    }
    return receive.apply(this, arguments);
  };
  const snapshot = NET.onSnapshot;
  NET.onSnapshot = function () {
    const before = world.round, result = snapshot.apply(this, arguments);
    if (world.round !== before) { clearFinishers(); roundKills.clear(); finishedRound = claimedRound = false; }
    for (const [id, item] of pendingKills) {
      if (item.event.round === world.round || item.event.round < world.round || performance.now() - item.time > 4000) {
        pendingKills.delete(id);
        if (item.event.round === world.round && performance.now() - item.time <= 4000) NET.onEvent(item.event);
      }
    }
    return result;
  };
  const build = buildSnapshot, apply = applySnapshot;
  buildSnapshot = function () {
    const result = build.apply(this, arguments);
    result.championsFinishMs = Math.max(0, Math.ceil((world.championsFinishUntil || 0) - performance.now()));
    return result;
  };
  applySnapshot = function (value) {
    const result = apply.apply(this, arguments);
    if (Number.isFinite(value.championsFinishMs)) world.championsFinishUntil = performance.now() + Math.max(0, Math.min(8000, value.championsFinishMs));
    return result;
  };
  const hud = updateHUD;
  updateHUD = function () {
    const result = hud.apply(this, arguments), remaining = (world.championsFinishUntil || 0) - performance.now();
    if (world.phase === "end" && remaining > 0) {
      const final = world.scoreAtk >= winRounds() || world.scoreDef >= winRounds();
      document.getElementById("tb-time").textContent = String(Math.ceil(remaining / 1000));
      document.getElementById("tb-phase").textContent = final ? L("챔피언스 마무리 · 결과 대기", "Champions finisher · Results next") : L("챔피언스 마무리 · 다음 라운드", "Champions finisher · Next round");
    }
    return result;
  };
  const round = startRound;
  startRound = function () { clearFinishers(); roundKills.clear(); finishedRound = claimedRound = false; return round.apply(this, arguments); };
  const shutdown = netShutdown;
  netShutdown = function () { world.championsFinishUntil = 0; clearFinishers(); reconnectKeys.clear(); seen.clear(); pendingKills.clear(); return shutdown.apply(this, arguments); };
  const over = gameOver;
  gameOver = function () {
    const wasOver = world.phase === "over", result = over.apply(this, arguments);
    if (!wasOver && !window.GAME_PRACTICE && window.RESULTS) {
      const match = RESULTS.summary();
      dispatchEvent(new CustomEvent("match-finished", { detail: structuredClone(match) }));
    }
    clearFinishers();
    return result;
  };
  window.GAME_PRACTICE = false;
  const begin = startGame;
  startGame = function (agent, practice) {
    window.GAME_PRACTICE = !!practice;
    clearFinishers(); roundKills.clear(); finishedRound = claimedRound = false;
    return begin.apply(this, arguments);
  };
  for (const name of ["hostStartMatch", "clientBeginMatch"]) {
    const original = window[name];
    window[name] = function () {
      window.GAME_PRACTICE = false;
      clearFinishers(); roundKills.clear(); seen.clear(); pendingKills.clear(); finishedRound = claimedRound = false;
      return original.apply(this, arguments);
    };
  }
  addEventListener("storage", (event) => {
    if (event.key !== "lgp_session" && event.key !== null) return;
    let next = null; try { next = JSON.parse(event.newValue || "null"); } catch (e) {}
    const session = ACCOUNT.session();
    if (!next || next.token !== (session && session.token)) {
      sessionStorage.removeItem("lgp_gate"); resetTouchInput(); netShutdown(); location.replace("./");
    }
  });
})();
