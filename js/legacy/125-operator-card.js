(() => {
  // The operator's card. An account the owner made an operator (and the owner) carries a playing card in the pistol
  // slot instead of the starting pistol. Left click throws it: the nearest enemy (anyone else in a free-for-all) dies,
  // whatever armour, shield or invulnerability they have. The room's host decides: it gives the card only to its own
  // player when that player is the owner or an operator, and to a guest only once the server has confirmed the guest
  // (HUNTX.OWNP, the same check the owner's panel uses). Off in ranked rooms. Like the golden pistol it is kept out of
  // every list of guns (shop, skins, counts).
  if ("undefined" == typeof WEAPONS || "undefined" == typeof T || "undefined" == typeof actorFire || "undefined" == typeof netStep) return;
  const KEY = "card",
    COOLDOWN = 0.6; // seconds between throws
  const isHost = () => "client" !== NET.mode;
  const ranked = () => !!(room.ranked || (window.RANKED && RANKED.locked));
  const live = () => world.actors && world.actors.length > 0 && !["menu", "end", "over"].includes(world.phase);
  // may this actor carry the card? (asked on the host)
  const allowed = (a) => {
    if (!a || ranked()) return !1;
    if ("me" === a.ctrl) return !!window.IS_OWNER;
    return !!(window.HUNTX && HUNTX.OWNP && a.ctrl && HUNTX.OWNP.has(a.ctrl));
  };

  // ── the weapon: hidden from every list, never runs out ──
  Object.defineProperty(WEAPONS, KEY, {
    value: Object.assign({}, WEAPONS.pistol, { name: "운영자 카드", cls: "보조", cost: 0, dmg: 0, rpm: 60 / COOLDOWN, mag: 1, spread: 0, range: 999, auto: !1, hs: 1 }),
    enumerable: !1,
    configurable: !0,
    writable: !0,
  });
  "undefined" != typeof WKEYS && WKEYS.indexOf(KEY) < 0 && WKEYS.push(KEY);

  // ── the card itself: black, a gold border, a gold spade and "SGH" on the face, a gold pattern on the back ──
  const face = (() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 180;
    const g = c.getContext("2d");
    g.fillStyle = "#0d0f14";
    g.fillRect(0, 0, 128, 180);
    g.strokeStyle = "#e3b54a";
    g.lineWidth = 6;
    g.strokeRect(7, 7, 114, 166);
    g.lineWidth = 2;
    g.strokeRect(15, 15, 98, 150);
    g.fillStyle = "#e3b54a";
    g.font = "bold 22px sans-serif";
    g.textAlign = "center";
    g.fillText("SGH", 64, 158);
    // the spade
    g.beginPath();
    g.moveTo(64, 46);
    g.bezierCurveTo(96, 80, 98, 104, 76, 106);
    g.quadraticCurveTo(70, 106, 66, 100);
    g.lineTo(74, 124);
    g.lineTo(54, 124);
    g.lineTo(62, 100);
    g.quadraticCurveTo(58, 106, 52, 106);
    g.bezierCurveTo(30, 104, 32, 80, 64, 46);
    g.fill();
    g.font = "bold 18px sans-serif";
    g.fillText("A", 28, 36);
    return c;
  })();
  const back = (() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 180;
    const g = c.getContext("2d");
    g.fillStyle = "#7d1420";
    g.fillRect(0, 0, 128, 180);
    g.strokeStyle = "#e3b54a";
    g.lineWidth = 2;
    for (let i = -180; i < 180; i += 12) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 180, 180);
      g.moveTo(i + 180, 0);
      g.lineTo(i, 180);
      g.stroke();
    }
    g.lineWidth = 6;
    g.strokeRect(7, 7, 114, 166);
    return c;
  })();
  const tex = (cv) => {
    const t = new T.CanvasTexture(cv);
    "colorSpace" in t && T.SRGBColorSpace && (t.colorSpace = T.SRGBColorSpace);
    t.anisotropy = 4;
    return t;
  };
  const edge = new T.MeshStandardMaterial({ color: 0xe3b54a, metalness: 0.8, roughness: 0.3 }),
    faceMat = new T.MeshStandardMaterial({ map: tex(face), roughness: 0.35, metalness: 0.1, emissive: 0x2a1d04, emissiveIntensity: 0.6 }),
    backMat = new T.MeshStandardMaterial({ map: tex(back), roughness: 0.4, metalness: 0.05 });
  for (const m of [edge, faceMat, backMat]) m.userData.keep = m.userData.shared = !0;
  // a card 6.4 × 9 cm, held upright with its face toward you (box faces: +x, -x, +y, -y, +z face, -z back)
  const cardMesh = () => {
    const m = new T.Mesh(new T.BoxGeometry(0.064, 0.09, 0.0012), [edge, edge, edge, edge, faceMat, backMat]);
    m.userData.live = !0;
    m.userData.noMerge = !0;
    return m;
  };
  if ("undefined" != typeof GUN_BUILD)
    GUN_BUILD[KEY] = () => {
      // laid like a gun (along -z) so the hands find it, the card standing on it and turned toward the camera
      const g = new T.Group(),
        stand = new T.Mesh(new T.BoxGeometry(0.03, 0.03, 0.12), new T.MeshBasicMaterial({ visible: !1 }));
      g.add(stand);
      const c = cardMesh();
      c.position.set(-0.01, 0.07, -0.05);
      c.rotation.set(-0.15, 0.35, -0.12);
      c.scale.setScalar(1.25);
      g.add(c);
      return g;
    };

  // ── giving it out and taking it back (the host) ──
  function refresh(a) {
    try {
      syncActorModel(a);
    } catch (e) {}
    if ("me" === a.ctrl) {
      try {
        updateViewmodel(!0);
      } catch (e) {}
    } else if ("host" === NET.mode && a.ctrl && "dead" !== a.ctrl) sendEventTo(a.ctrl, { t: "wallet", c: a.credits, w: a.weapons, am: a.ammo, ar: a.armor, s: a.slot });
  }
  function give(a) {
    if (!a.weapons || !a.ammo) return;
    a.weapons.secondary = KEY;
    a.ammo[KEY] = 1;
    a.reserve = a.reserve || {};
    a.reserve[KEY] = 0;
    refresh(a);
  }
  function take(a) {
    if (!a.weapons || a.weapons.secondary !== KEY) return;
    a.weapons.secondary = "pistol";
    delete a.ammo[KEY];
    a.ammo.pistol = a.ammo.pistol || WEAPONS.pistol.mag;
    refresh(a);
  }
  let every = 0;
  function tick(dt) {
    if (!isHost() || !live()) return;
    if ((every += dt) < 0.5) return;
    every = 0;
    for (const a of world.actors) {
      if (!a.weapons) continue;
      const ok = allowed(a) && a.alive;
      // the starting pistol becomes the card; a pistol someone bought is left alone
      if (ok && (!a.weapons.secondary || "pistol" === a.weapons.secondary)) give(a);
      else if (!allowed(a) && a.weapons.secondary === KEY) take(a);
    }
  }

  // ── the throw ──
  const nearest = (a) => {
    let best = null,
      bd = 1 / 0,
      any = null,
      ad = 1 / 0;
    for (const n of world.actors) {
      if (n === a || !n.alive) continue;
      const d = Math.hypot(n.pos.x - a.pos.x, (n.y || 0) - (a.y || 0), n.pos.z - a.pos.z);
      d < ad && ((ad = d), (any = n));
      n.team !== a.team && d < bd && ((bd = d), (best = n));
    }
    // free-for-all modes put everyone on one side: then it is simply the nearest one
    return best || any;
  };
  function kill(target, by) {
    target.invuln = 0;
    target.shielded = 0;
    target.armor = 0;
    try {
      dealDamage(target, 99999, !0, by);
    } catch (e) {}
    if (target.alive)
      try {
        killActor(target, by);
      } catch (e) {}
  }
  // a card flies from the thrower to the target, spinning, with a gold streak behind it (seen by everyone)
  const flights = [];
  function fly(a, b) {
    if (!a || !b) return;
    const m = cardMesh();
    m.scale.setScalar(4);
    const from = new T.Vector3(a.pos.x, ("function" == typeof actorEye ? actorEye(a) : (a.y || 0) + 1.5) - 0.2, a.pos.z),
      to = new T.Vector3(b.pos.x, (b.y || 0) + 1.2, b.pos.z);
    m.position.copy(from);
    scene.add(m);
    flights.push({ m, from, to, t: 0, d: Math.min(0.35, 0.05 + from.distanceTo(to) / 90) });
    try {
      "function" == typeof poolTracer && poolTracer(from.x, from.y, from.z, to.x, to.y, to.z, 0xe3b54a, 0.85, 0.05);
    } catch (e) {}
  }
  function flyTick(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.d);
      f.m.position.lerpVectors(f.from, f.to, k);
      f.m.rotation.set(Math.PI / 2, f.t * 40, 0);
      if (k >= 1) {
        scene.remove(f.m);
        f.m.geometry.dispose();
        flights.splice(i, 1);
      }
    }
  }
  const _fire = actorFire;
  actorFire = function (e) {
    if (!e || e.ultW || "function" != typeof actorWeaponKey || actorWeaponKey(e) !== KEY) return _fire.apply(this, arguments);
    if (!e.alive || e.fireCd > 0 || "end" === world.phase || "buy" === world.phase) return;
    e.fireCd = COOLDOWN;
    e.ammo[KEY] = 1;
    if ("me" === e.ctrl) {
      try {
        viewmodelFireKick();
      } catch (er) {}
      try {
        window.SKIN_PERKS && SKIN_PERKS.swish && SKIN_PERKS.swish();
      } catch (er) {}
    }
    if (!isHost()) return; // a guest's throw is the host's to judge
    if (!allowed(e)) return void take(e);
    const b = nearest(e);
    if (!b) return;
    fly(e, b);
    kill(b, e);
    "host" === NET.mode && sendEventAll({ t: "opcard", a: e.id, b: b.id });
  };
  const _oe = NET.onEvent;
  NET.onEvent = (ev) => {
    if (ev && "opcard" === ev.t) {
      const f = (id) => world.actors.find((x) => String(x.id) === String(id));
      fly(f(ev.a), f(ev.b));
      return;
    }
    return _oe ? _oe(ev) : void 0;
  };
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      tick(dt || 0.016);
      flyTick(dt || 0.016);
    } catch (e) {}
    return r;
  };
  window.OP_CARD = { key: KEY, allowed, nearest, give, take, cooldown: COOLDOWN };
})();
