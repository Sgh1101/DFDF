(() => {
  // When you die, the view goes to the one who killed you for two seconds (it glides there from where you fell and
  // turns slowly round them), their name floats over their head with their title beside it, and the agent and gun
  // they killed with sit under the name. After that the game goes on as before (an ally to watch, a respawn).
  //  · The killer is found where the kill is made (killActor knows who dealt it) and, on a guest's screen, by the
  //    name in the kill message.
  //  · A guest's title travels with the hello message and the actor list, so everyone sees it; the bots have no
  //    account, so each gets a title from the catalogue by its id (the same on every screen). A title that is not
  //    in the catalogue is not shown.
  //  · Nothing about a fight changes: the camera, the plate and the time before you take an ally's place.
  if ("undefined" == typeof deathCam || "undefined" == typeof spectateCam || "undefined" == typeof killActor || "undefined" == typeof pushKill || "undefined" == typeof T) return;

  const KC = 2.0;
  const C = () => window.COSMETICS;
  const me = () => ("function" == typeof myActor && myActor()) || (typeof player !== "undefined" ? player : null);
  const nameOf = (a) => (a ? a.name || (a.agent && a.agent.name) || "" : "");

  // ── titles ──
  const titleItem = (id) => {
    const c = C(),
      it = c && c.by && c.by[id];
    return it && "title" === it.s ? it : null;
  };
  const ownTitle = () => {
    try {
      const u = window.ACCOUNT && ACCOUNT.session() && ACCOUNT.session().user;
      return (u && u.cos && u.cos.eq && u.cos.eq.title) || "";
    } catch (e) {
      return "";
    }
  };
  // a bot's title: most are common, a few are not; it is the same on every screen because only the id goes in
  const botTitle = (a) => {
    const c = C();
    if (!c || !a) return null;
    let h = 7;
    for (const ch of String(a.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const tier = [1, 1, 1, 1, 1, 2, 2, 2, 3, 4][h % 10],
      list = c.items.filter((x) => "title" === x.s && x.r === tier);
    return list.length ? list[(h >>> 4) % list.length] : null;
  };
  const titleOf = (a) => {
    if (!a) return null;
    if (a.__ttl && titleItem(a.__ttl)) return titleItem(a.__ttl);
    if ("me" === a.ctrl) return titleItem(ownTitle());
    // the host: what a guest said in its hello (the guests read it from the actor list, above)
    const said = "string" == typeof a.ctrl ? TTL.get(a.ctrl) : "";
    if (said && titleItem(said)) return titleItem(said);
    return "function" == typeof isAI && isAI(a) ? botTitle(a) : null;
  };
  // a guest says its title; the host puts it in the actor list; the others read it from there
  const TTL = new Map();
  try {
    if ("function" == typeof sendAction) {
      const _sa = sendAction;
      sendAction = function (m) {
        if (m && "hello" === m.t) {
          const t = ownTitle();
          t && (m = Object.assign({}, m, { ttl: t }));
        }
        return _sa.call(this, m);
      };
    }
    if ("undefined" != typeof NET && NET) {
      const _oa = NET.onAction;
      NET.onAction = function (peer, msg) {
        try {
          msg && "hello" === msg.t && "host" === NET.mode && TTL.set(peer, titleItem(msg.ttl) ? msg.ttl : "");
        } catch (e) {}
        return _oa && _oa.apply(this, arguments);
      };
    }
    if ("function" == typeof actorManifest) {
      const _am = actorManifest;
      actorManifest = function () {
        const list = _am.apply(this, arguments);
        try {
          list.forEach((m, i) => {
            const a = world.actors[i],
              t = a && ("me" === a.ctrl ? ownTitle() : TTL.get(a.ctrl));
            t && (m.ttl = t);
          });
        } catch (e) {}
        return list;
      };
    }
    if ("function" == typeof clientBeginMatch) {
      const _cb = clientBeginMatch;
      clientBeginMatch = function (e) {
        const r = _cb.apply(this, arguments);
        try {
          for (const m of (e && e.actors) || []) {
            const a = world.actors.find((x) => x.id === m.id);
            a && m.ttl && titleItem(m.ttl) && (a.__ttl = m.ttl);
          }
        } catch (err) {}
        return r;
      };
    }
  } catch (e) {
    console.warn("killcam titles", e);
  }

  // ── who killed me ──
  let pend = null,
    kc = null;
  const _ka = killActor;
  killActor = function (e, t) {
    try {
      "me" === e.ctrl && t && t !== e && (pend = { actor: t, name: nameOf(t), t0: performance.now() });
    } catch (err) {}
    return _ka.apply(this, arguments);
  };
  const _pk = pushKill;
  pushKill = function (k, v) {
    try {
      const m = me();
      m && v && v === nameOf(m) && "월드" !== k && "아군" !== k && (!pend || performance.now() - pend.t0 > 2500) && (pend = { actor: null, name: k, t0: performance.now() });
    } catch (e) {}
    return _pk.apply(this, arguments);
  };
  const findKiller = (p) => {
    if (p.actor) return p.actor;
    const m = me();
    const c = (world.actors || []).filter((a) => a !== m && nameOf(a) === p.name);
    if (!c.length) return null;
    c.sort((a, b) => Math.hypot(a.pos.x - m.pos.x, a.pos.z - m.pos.z) - Math.hypot(b.pos.x - m.pos.x, b.pos.z - m.pos.z));
    return (c.find((a) => a.team !== m.team) || c[0]);
  };

  // ── the plate over the killer ──
  let plate = null;
  const mount = () => {
    if (plate || "undefined" == typeof document) return plate;
    const st = document.createElement("style");
    st.textContent =
      "#kc-plate{position:fixed;left:0;top:0;z-index:30;pointer-events:none;opacity:0;transform:translate(-50%,-100%);transition:opacity .18s;text-align:center;font-family:inherit}" +
      "#kc-plate.on{opacity:1}" +
      "#kc-plate .kc-in{display:inline-flex;flex-direction:column;align-items:center;gap:3px;padding:7px 16px 8px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(18,24,34,.9),rgba(8,12,18,.88));box-shadow:0 10px 30px -10px #000,inset 0 1px 0 rgba(255,255,255,.07)}" +
      "#kc-plate .kc-tag{font-size:9.5px;font-weight:700;letter-spacing:.2em;color:#ff6b78}" +
      "#kc-plate .kc-row{display:flex;align-items:center;gap:9px;white-space:nowrap}" +
      "#kc-plate .kc-title{font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;border:1px solid currentColor;background:color-mix(in srgb,currentColor 12%,transparent)}" +
      "#kc-plate .kc-name{font-size:19px;font-weight:800;color:#fff;letter-spacing:.01em;text-shadow:0 1px 8px #000}" +
      "#kc-plate .kc-sub{font-size:11px;color:#9aa8bc}" +
      "#kc-plate::after{content:'';position:absolute;left:50%;bottom:-7px;width:2px;height:7px;background:rgba(255,255,255,.35);transform:translateX(-50%)}";
    document.head.appendChild(st);
    plate = document.createElement("div");
    plate.id = "kc-plate";
    plate.setAttribute("aria-hidden", "true");
    document.body.appendChild(plate);
    return plate;
  };
  const hide = () => plate && plate.classList.remove("on");
  const fill = (k) => {
    const el = mount();
    if (!el) return;
    const t = titleOf(k.actor),
      c = C(),
      col = t && c.tier(t.r) ? c.tier(t.r)[2] : "#9aa8bc",
      w = "function" == typeof actorWeaponKey && k.actor ? WEAPONS[actorWeaponKey(k.actor)] : null,
      ag = k.actor && k.actor.agent ? k.actor.agent.name : "";
    const mk = (tag, cls, text) => {
      const n = document.createElement(tag);
      n.className = cls;
      text && (n.textContent = text);
      return n;
    };
    const inner = mk("div", "kc-in"),
      row = mk("div", "kc-row");
    inner.append(mk("span", "kc-tag", "en" === window.GAME_LANG ? "ELIMINATED BY" : "나를 처치"));
    if (t) {
      const chip = mk("span", "kc-title", c.name(t));
      chip.style.color = col;
      row.append(chip);
    }
    row.append(mk("span", "kc-name", k.name || ag || "?"));
    inner.append(row);
    (ag || w) && inner.append(mk("span", "kc-sub", ag + (ag && w ? " · " : "") + (w ? w.name : "")));
    el.replaceChildren(inner);
  };
  const head = new T.Vector3();
  const place = (a) => {
    if (!plate) return;
    head.set(a.pos.x, (a.y || 0) + 2.35 * ("number" == typeof BODY_K ? BODY_K : 1), a.pos.z).project(camera);
    const vis = head.z < 1 && Math.abs(head.x) < 1.1 && Math.abs(head.y) < 1.1;
    plate.style.left = ((head.x * 0.5 + 0.5) * innerWidth).toFixed(1) + "px";
    plate.style.top = ((-head.y * 0.5 + 0.5) * innerHeight).toFixed(1) + "px";
    plate.classList.toggle("on", vis);
  };

  // ── the camera ──
  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const camPos = new T.Vector3(),
    look = new T.Vector3();
  function start(viaSpec) {
    if (!pend || performance.now() - pend.t0 > 4000) return false;
    const k = findKiller(pend);
    pend = null;
    if (!k || !k.pos) return false;
    const m = me();
    kc = { actor: k, name: nameOf(k), t: 0, viaSpec: !!viaSpec, from: camera.position.clone(), ang: 0, dist: 3.6 };
    // from where I fell toward them; the camera sits on the line between us, so the face is turned to me
    kc.dx = m.pos.x - k.pos.x;
    kc.dz = m.pos.z - k.pos.z;
    const L = Math.hypot(kc.dx, kc.dz);
    if (L < 0.5) {
      kc.dx = -Math.sin(k.yaw || 0);
      kc.dz = -Math.cos(k.yaw || 0);
    } else {
      kc.dx /= L;
      kc.dz /= L;
    }
    fill(kc);
    return true;
  }
  function stop() {
    kc = null;
    hide();
  }
  function frame(dt) {
    kc.t += dt;
    const k = kc.actor,
      ty = (k.y || 0) + 1.3;
    kc.ang += 0.3 * dt;
    let dist = 3.6;
    const cx = Math.cos(kc.ang) * kc.dx - Math.sin(kc.ang) * kc.dz,
      cz = Math.sin(kc.ang) * kc.dx + Math.cos(kc.ang) * kc.dz;
    // a wall behind the camera: come closer until it sees them
    for (let i = 0; i < 5; i++) {
      camPos.set(k.pos.x + cx * dist, ty + 0.45, k.pos.z + cz * dist);
      let blocked = !1;
      try {
        blocked = rayBlocked(k.pos.x, ty, k.pos.z, camPos.x, camPos.y, camPos.z);
      } catch (e) {}
      if (!blocked) break;
      dist *= 0.7;
    }
    camera.position.lerpVectors(kc.from, camPos, ease(kc.t / 0.4));
    look.set(k.pos.x, ty, k.pos.z);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    place(k);
    if (kc.t >= KC) stop();
  }
  const _dc = deathCam;
  deathCam = function (dt) {
    try {
      if (!kc && !start(!1)) return _dc.apply(this, arguments);
      if (kc && !kc.viaSpec) return frame(dt);
    } catch (e) {
      console.warn("killcam", e);
      stop();
    }
    return _dc.apply(this, arguments);
  };
  const _sc = spectateCam;
  spectateCam = function (dt) {
    try {
      // the death view was cut short (a key press): the kill view goes too; a guest has no death view, so it starts here
      if (kc && !kc.viaSpec) stop();
      else if (!kc) start(!0);
      if (kc) return frame(dt);
    } catch (e) {
      console.warn("killcam", e);
      stop();
    }
    return _sc.apply(this, arguments);
  };
  // the time before an ally is taken over (and the death view's) lasts as long as the kill view
  if ("function" == typeof onLocalDeath) {
    const _ol = onLocalDeath;
    onLocalDeath = function () {
      const r = _ol.apply(this, arguments);
      try {
        pend && player && !player.alive && (player.spectateT = Math.max(player.spectateT || 0, KC));
      } catch (e) {}
      return r;
    };
  }
  if ("function" == typeof takeOverAlly) {
    const _to = takeOverAlly;
    takeOverAlly = function (a) {
      if (kc && null == a && kc.t < KC) {
        const e = player;
        setTimeout(() => {
          world.over || "live" !== world.phase || player !== e || player.alive || takeOverAlly(null);
        }, Math.max(60, (KC - kc.t) * 1000 + 40));
        return !1;
      }
      return _to.apply(this, arguments);
    };
  }
  // back in the fight: no plate, no kill view
  if ("function" == typeof followCamera) {
    const _fc = followCamera;
    followCamera = function () {
      (kc || (plate && plate.classList.contains("on"))) && stop();
      return _fc.apply(this, arguments);
    };
  }
  window.KILLCAM = { len: KC, active: () => !!kc, titleOf, botTitle };
})();
