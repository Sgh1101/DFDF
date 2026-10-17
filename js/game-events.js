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
    cancelAnimationFrame(previewFrame); previewFrame = 0;
    for (const mesh of active) if (mesh.userData.previewScene) {
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
    const skin = GUN_SKINS.list.find((s) => s.id === event.skin);
    if (!skin || skin.id === "default" || SETTINGS.motion === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const pack = SOUNDPACK.skins[skin.id], color = skin.glow || skin.edge || 0x80caff;
    const studio = preview && GUN_SKINS._pv();
    if (preview && !studio) return false;
    const origin = preview ? new T.Vector3(0, 0, 0) : new T.Vector3(event.x, event.y, event.z);
    const group = new T.Group(); group.position.copy(origin);
    const phantom = window.CHAMPIONS_PHANTOM && CHAMPIONS_PHANTOM.isSkin(skin.id) ? CHAMPIONS_PHANTOM.finisher(group, skin) : null;
    const rings = pack === "cosmic" ? 3 : 2;
    for (let i = 0; i < rings; i++) {
      const ring = new T.Mesh(new T.TorusGeometry(0.5 + i * 0.18, 0.018, 5, 36), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.1 + i * 0.3;
      group.add(ring);
    }
    const count = SETTINGS.quality === "fast" || SETTINGS.quality === "low" ? 8 : 16;
    for (let i = 0; i < count; i++) {
      const crystal = pack === "crystal" || pack === "royal";
      const mesh = new T.Mesh(crystal ? new T.OctahedronGeometry(0.09) : new T.TetrahedronGeometry(0.08), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
      mesh.userData.angle = i * Math.PI * 2 / count; mesh.userData.height = i % 4 * 0.18;
      group.add(mesh);
    }
    if (!preview) finishedRound = true;
    active.add(group);
    const animate = (mesh, t) => {
      if (phantom) phantom(t);
      const radius = pack === "cosmic" ? 1.1 * (1 - t) : 0.35 + 0.9 * t;
      mesh.children.forEach((part, i) => {
        if (part.userData.phantom) return;
        part.material.opacity = (1 - t) * 0.8;
        if (part.userData.angle == null) {
          part.rotation.z = t * Math.PI * (i % 2 ? -2 : 2);
          part.scale.setScalar(0.6 + t * 1.3);
          if (pack === "energy") part.rotation.x = Math.PI / 2 + Math.sin(t * 9) * 0.4;
        } else {
          const angle = part.userData.angle + t * (pack === "dragon" ? 9 : 5);
          part.position.set(Math.cos(angle) * radius, part.userData.height + Math.sin(t * Math.PI) * (pack === "dragon" ? 1.5 : 1), Math.sin(angle) * radius);
          part.rotation.set(t * 7, angle, t * 4); part.scale.setScalar(1 - t * 0.7);
        }
      });
      if (t > 0.98 && !preview) active.delete(mesh);
    };
    if (preview) {
      group.userData.previewScene = studio.sc;
      studio.sc.add(group);
      const started = performance.now();
      const frame = () => {
        const t = (performance.now() - started) / 1800;
        if (t >= 1 || !GUN_SKINS.isOpen()) return clearFinishers();
        animate(group, t); previewFrame = requestAnimationFrame(frame);
      };
      previewFrame = requestAnimationFrame(frame);
    } else addFx(group, 1.8, animate);
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
    if (NET.mode === "host" && before !== (actor.ammo && actor.ammo[gun]) && !["knife", "rpg"].includes(gun)) sendEventAll({ t: "shot-sound", actor: actor.id, gun, skin });
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
      event = { t: "kill-detail", id: `${NET.room || "solo"}:${world.round}:${++serial}`, round: world.round, mode: room.mode || "std", killer: killer.id, victim: victim.id, name: victim.name || victim.agent.name, gun, skin, head, kind: head ? "head" : kind, last, ace: last && foes.length >= 3 && victims.size === foes.length, x: victim.pos.x, y: (victim.y || 0) + 0.6, z: victim.pos.z };
      event.finisher = !claimedRound && GAME_RULES.finisher(event);
    }
    const previous = window.KILL_EVENT; window.KILL_EVENT = event;
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
    } finally { window.KILL_EVENT = previous; }
  };
  const input = NET.onInput;
  NET.onInput = function (peer, data) { if (GAME_RULES.validInput(data)) return input.apply(this, arguments); };
  const reconnectKeys = new Map();
  let reconnectCode = "", reconnectSecret = "";
  const send = sendAction;
  sendAction = function (message) {
    if (message && message.t === "hello") {
      if (reconnectCode !== NET.room) { reconnectCode = NET.room; reconnectSecret = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16).padStart(8, "0")).join(""); }
      message = { ...message, reconnect: reconnectSecret };
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
    if (event && event.t === "shot-sound") {
      const actor = actorById(event.actor);
      if (actor && actor !== currentActor()) {
        const previous = window.SKIN_SHOOTER, previousShot = window.SKIN_SHOT; window.SKIN_SHOOTER = actor; window.SKIN_SHOT = event;
        try { SFX.gun(event.gun, Math.min(1, actor.pos.distanceTo(currentActor().pos) / 60)); }
        finally { window.SKIN_SHOOTER = previous; window.SKIN_SHOT = previousShot; }
      }
      return;
    }
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
      if (event.killer === currentActor().id) {
        const previous = window.KILL_EVENT; window.KILL_EVENT = event;
        try { playKillFx(event.name, event.head); } finally { window.KILL_EVENT = previous; }
      }
      visual(event); return;
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
  const round = startRound;
  startRound = function () { clearFinishers(); roundKills.clear(); finishedRound = claimedRound = false; return round.apply(this, arguments); };
  const shutdown = netShutdown;
  netShutdown = function () { clearFinishers(); reconnectKeys.clear(); seen.clear(); pendingKills.clear(); return shutdown.apply(this, arguments); };
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
