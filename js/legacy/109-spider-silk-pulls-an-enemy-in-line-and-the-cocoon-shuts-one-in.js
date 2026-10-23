(() => {
  // 거미 (the spider): the E and the C now look at what the web is aimed at first.
  //   E 거미줄 이동: an enemy in the line (30 m, nothing in the way) is wrapped and dragged to me (the old silk pull:
  //     up to 7 m, 40% slower for 2 s). With no enemy in the line it is the web swing as before.
  //   C 고치: an enemy in the line (30 m) is shut in a cocoon and cannot move for 2.5 s, and shows. With no enemy in
  //     the line I go into the cocoon myself as before: 2 s, untouchable and unable to move, 40 health back.
  // Both are the same two casts as before, so cost, cooldown, the cast animation and the network message are
  // unchanged; the choice is made on every screen from the same line, as the silk pull always was.
  if ("undefined" == typeof AGENTS || "undefined" == typeof CAST_EXT || "undefined" == typeof T || "undefined" == typeof scene) return;
  const gm = AGENTS.find((a) => "geomi" === a.id);
  const zip = CAST_EXT.y_webzip,
    pull = CAST_EXT.x_silk_pull,
    cocoon = CAST_EXT.x_cocoon;
  if (!gm || "function" != typeof zip || "function" != typeof pull || "function" != typeof cocoon || CAST_EXT.__spiderSilk) return;
  CAST_EXT.__spiderSilk = !0;

  const SILK_RANGE = 30, // the same line the silk pull always used
    TRAP_RANGE = 30,
    TRAP_TIME = 2.5,
    WEB = 0xf5f5f5;

  // ── the line: the first enemy in it that can be seen, the same hit-scan the silk pull uses ──
  const eye = (c) => ({ x: c.pos.x, y: (c.y || 0) + 1.45, z: c.pos.z });
  const losOK = (c, a) => !rayBlocked(c.pos.x, (c.y || 0) + 1.5, c.pos.z, a.pos.x, (a.y || 0) + 1.2, a.pos.z);
  const clearLen = (x, z, dx, dz, len, y) => {
    let t = 0;
    while (t < len && !collideXZ(x + dx * (t + 0.4), z + dz * (t + 0.4), (y || 0) + 0.8, 0.15)) t += 0.4;
    return Math.min(t, len);
  };
  function foeInLine(c, len, w) {
    const yaw = c.yaw || 0,
      dx = -Math.sin(yaw),
      dz = -Math.cos(yaw),
      e = eye(c),
      L = clearLen(e.x, e.z, dx, dz, len, c.y);
    return (
      foesOf(c)
        .filter((a) => a && a.alive)
        .map((a) => {
          const px = a.pos.x - e.x,
            pz = a.pos.z - e.z;
          return { a, t: px * dx + pz * dz, off: Math.abs(px * dz - pz * dx) };
        })
        .filter((o) => o.t >= -0.5 && o.t <= L && o.off <= w)
        .sort((p, q) => p.t - q.t)
        .map((o) => o.a)
        .find((a) => losOK(c, a)) || null
    );
  }

  // ── E: an enemy in the line is dragged in (the old silk pull), otherwise the web swing ──
  CAST_EXT.y_webzip = function () {
    return foeInLine(player, SILK_RANGE, 1.0) ? pull.apply(this, arguments) : zip.apply(this, arguments);
  };

  // ── C: an enemy in the line is shut in a cocoon, otherwise I am ──
  const mat = (col, op, wire) => new T.MeshBasicMaterial({ color: col, transparent: !0, opacity: op, depthWrite: !1, side: T.DoubleSide, wireframe: !!wire });
  const drop = (m) => {
    if (!m) return;
    scene.remove(m);
    m.traverse((o) => {
      o.geometry && o.geometry.dispose();
      o.material && o.material.dispose();
    });
  };
  function shutIn(c, e) {
    // only a status here: the body is stopped where it is simulated, the host decides nothing else about it
    statusOn(e, "root", TRAP_TIME);
    statusOn(e, "revealed", TRAP_TIME);
    // the strand from my hand to them, then the egg that stays with them until it opens
    const from = eye(c);
    if ("function" == typeof addFx) {
      const m = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1, 6, 1, !0), mat(WEB, 0.9));
      const tx = e.pos.x,
        ty = (e.y || 0) + 1.1,
        tz = e.pos.z,
        dx = tx - from.x,
        dy = ty - (from.y - 0.2),
        dz = tz - from.z,
        L = Math.hypot(dx, dy, dz) || 0.01;
      m.position.set((from.x + tx) / 2, (from.y - 0.2 + ty) / 2, (from.z + tz) / 2);
      m.scale.set(1, L, 1);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / L, dy / L, dz / L));
      scene.remove(m);
      addFx(m, 0.3, (o, t) => (o.material.opacity = 0.9 * (1 - t)));
    }
    const egg = new T.Group();
    egg.add(new T.Mesh(new T.SphereGeometry(1, 18, 14), mat(WEB, 0.5)));
    egg.add(new T.Mesh(new T.IcosahedronGeometry(1.04, 1), mat(0xbdbdbd, 0.7, !0)));
    egg.scale.set(0.95, 1.5, 0.95);
    scene.add(egg);
    let t = 0;
    abilSpawn({
      update(dt) {
        t += dt;
        if (t >= TRAP_TIME || !e.alive) return !1;
        egg.position.set(e.pos.x, (e.y || 0) + 1.0, e.pos.z);
        // it thins out in the last half second, so the end can be seen coming
        const k = Math.min(1, (TRAP_TIME - t) / 0.5);
        egg.children[0].material.opacity = 0.5 * k;
        egg.children[1].material.opacity = 0.7 * k;
        return !0;
      },
      dispose: () => drop(egg),
    });
    "function" == typeof fxRing && fxRing(e.pos.x, e.pos.z, 1.8, WEB, 0.5);
  }
  CAST_EXT.x_cocoon = function () {
    const c = player,
      foe = foeInLine(c, TRAP_RANGE, 0.9);
    return foe ? shutIn(c, foe) : cocoon.apply(this, arguments);
  };

  // ── what the ability card says ──
  const E = gm.abilities.find((d) => "y_webzip" === d.type),
    C = gm.abilities.find((d) => "x_cocoon" === d.type);
  E && (E.desc = "조준선(30m)에 적이 있으면 거미줄로 감아 7m 끌어오고 2초간 40% 둔화시킨다. 적이 없으면 조준한 곳(48m)에 거미줄을 쏴서 그쪽으로 빠르게 끌려간다. 가는 도중 점프하면 줄을 끊고 튕겨 나가고, 벽 옆에 닿으면 4초간 벽에 매달린다. 닿을 곳이 없으면 충전이 돌아온다.");
  C && (C.desc = "조준선(30m)의 적을 고치에 가둬 2.5초간 움직이지 못하게 하고 위치를 드러낸다. 적이 없으면 내가 2초간 고치 속에 들어가 무적이 되고(움직일 수 없음) 체력 40을 회복한다.");
})();
