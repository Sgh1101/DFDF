
(() => {
  // one-way teleporters, switch doors, ziplines
  const DEF = {
    market: {
      tp: [
        { a: [-80, 56], b: [56, 4] },
        { a: [80, 56], b: [-56, 4] },
      ],
    },
    garden: {
      door: [
        { x: -42, z: -3, w: 3, d: 14, h: 7, sw: [[-37, -13], [-47, -13]] },
        { x: 42, z: -3, w: 3, d: 14, h: 7, sw: [[37, -13], [47, -13]] },
      ],
    },
    temple: {
      door: [
        { x: 0, z: -44, w: 12, d: 3, h: 7, sw: [[10, -40], [-10, -48]] },
        { x: 0, z: 44, w: 12, d: 3, h: 7, sw: [[10, 40], [-10, 48]] },
      ],
    },
    forge: {
      zip: [
        { a: [-16, -90], b: [16, -90], h: 5.2 },
        { a: [-16, 90], b: [16, 90], h: 5.2 },
      ],
    },
    harbor: { zip: [{ a: [88, 96], b: [88, 6], h: 6.4 }] },
    pogu: { door: [{ x: 18, z: -12, w: 0.6, d: 8, h: 6, sw: [[15.5, -9.5], [20.5, -14.5]] }] },
  };
  const G = { key: null, tp: [], door: [], zip: [], meshes: [] };
  G.DEF = DEF; // maps added by later modules put their own gimmicks here
  window.MAP_GIMMICKS = G;
  function clear() {
    // These nodes and their geometry/materials are created by this module.
    // Textures and other map/character assets remain with their own caches.
    const nodes = new Set(), geometries = new Set(), materials = new Set();
    for (const root of G.meshes) root.traverse((node) => {
      nodes.add(node);
      if (node.geometry) geometries.add(node.geometry);
      const list = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of list) if (material) materials.add(material);
    });
    // Forget overlapping map registrations before the generic cleanup runs.
    for (let i = _mapMeshes.length - 1; i >= 0; i--) if (nodes.has(_mapMeshes[i])) _mapMeshes.splice(i, 1);
    for (const root of G.meshes) root.removeFromParent();
    Object.assign(G, { key: null, tp: [], door: [], zip: [], meshes: [] });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
  G.clear = clear;
  const mat = (c, e) => new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e || 0, roughness: 0.4, metalness: 0.4 });
  const add = (m) => (scene.add(m), G.meshes.push(m), m);
  // decor can land on a chosen point; step outward to the nearest clear spot
  function spot(x, z) {
    const clear = (a, b) => !collideXZ(a, b, 0.3, PR + 0.25);
    if (clear(x, z)) return [x, z];
    for (let r = 0.5; r <= 5; r += 0.5)
      for (let k = 0; k < 16; k++) {
        const a = x + r * Math.cos((k / 16) * 2 * Math.PI),
          b = z + r * Math.sin((k / 16) * 2 * Math.PI);
        if (clear(a, b)) return [+a.toFixed(2), +b.toFixed(2)];
      }
    return [x, z];
  }

  function build(key) {
    clear();
    G.key = key;
    const d = DEF[key];
    if (!d) return;
    (d.tp || []).forEach((t0, i) => {
      const t = { a: spot(...t0.a), b: spot(...t0.b) };
      const ring = (x, z, c, big) => {
        const g = new T.Group();
        const r = new T.Mesh(new T.RingGeometry(big ? 0.9 : 0.6, big ? 1.35 : 0.9, 36), new T.MeshBasicMaterial({ color: c, transparent: !0, opacity: 0.85, side: T.DoubleSide }));
        r.rotation.x = -Math.PI / 2;
        r.position.y = 0.05;
        g.add(r);
        const col = new T.Mesh(new T.CylinderGeometry(big ? 1.3 : 0.85, big ? 1.3 : 0.85, 2.6, 24, 1, !0), new T.MeshBasicMaterial({ color: c, transparent: !0, opacity: 0.12, side: T.DoubleSide, depthWrite: !1 }));
        col.position.y = 1.3;
        g.add(col);
        g.position.set(x, 0, z);
        g.userData.col = col;
        return add(g);
      };
      G.tp.push({ a: { x: t.a[0], z: t.a[1] }, b: { x: t.b[0], z: t.b[1] }, ma: ring(t.a[0], t.a[1], 0x22d3ee, !0), mb: ring(t.b[0], t.b[1], 0x7dd3fc, !1), i });
    });
    (d.door || []).forEach((o0, i) => {
      const o = { ...o0, sw: o0.sw.map((p) => spot(...p)) };
      const col = addBox(o.x, o.z, o.w, o.d, o.h, mat(0x3a4250, 0));
      col.mesh && G.meshes.push(col.mesh);
      const door = { ...o, col, open: !0, k: 1, cd: 0, i, sws: [] };
      o.sw.forEach(([x, z]) => {
        const g = new T.Group();
        const p = new T.Mesh(new T.BoxGeometry(0.4, 1.3, 0.4), mat(0x2a2f38, 0));
        p.position.y = 0.65;
        g.add(p);
        const btn = new T.Mesh(new T.BoxGeometry(0.46, 0.22, 0.46), mat(0x4ade80, 1.4));
        btn.position.y = 1.38;
        g.add(btn);
        g.position.set(x, 0, z);
        g.userData.btn = btn;
        door.sws.push({ x, z, g });
        add(g);
      });
      setDoor(door, !0, !0);
      G.door.push(door);
    });
    (d.zip || []).forEach((z0, i) => {
      const z = { ...z0, a: spot(...z0.a), b: spot(...z0.b) };
      const A = new T.Vector3(z.a[0], z.h, z.a[1]),
        B = new T.Vector3(z.b[0], z.h, z.b[1]);
      const len = A.distanceTo(B);
      const rope = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, len, 6), mat(0x9aa4b2, 0.2));
      rope.position.copy(A).lerp(B, 0.5);
      rope.lookAt(B);
      rope.rotateX(Math.PI / 2);
      add(rope);
      [A, B].forEach((P) => {
        const post = new T.Mesh(new T.CylinderGeometry(0.14, 0.18, z.h + 0.6, 8), mat(0x2a2f38, 0));
        post.position.set(P.x, (z.h + 0.6) / 2, P.z);
        add(post);
        const lamp = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), mat(0xffc849, 1.6));
        lamp.position.set(P.x, z.h + 0.7, P.z);
        add(lamp);
      });
      G.zip.push({ a: { x: z.a[0], z: z.a[1] }, b: { x: z.b[0], z: z.b[1] }, h: z.h, len, i });
    });
  }
  function setDoor(door, open, instant) {
    door.open = open;
    door.col.h = open ? 0 : door.h;
    instant && (door.k = open ? 1 : 0);
    door.sws.forEach((s) => s.g.userData.btn.material.color.setHex(CB.num(open ? "good" : "bad")));
    door.sws.forEach((s) => s.g.userData.btn.material.emissive.setHex(CB.num(open ? "good" : "bad")));
    CHASH.dirty = !0;
    try {
      buildGrid();
    } catch (e) {}
  }
  const _lm = loadMap;
  loadMap = function (key) {
    const r = _lm.apply(this, arguments);
    try {
      build(key);
    } catch (e) {
      console.warn("gimmicks", e);
    }
    return r;
  };

  // actions: F near a switch or a zipline end
  function nearDoor(a) {
    for (const d of G.door) for (const s of d.sws) if (Math.hypot(a.pos.x - s.x, a.pos.z - s.z) < 2.2) return d;
    return null;
  }
  function nearZip(a) {
    for (const z of G.zip)
      for (const [end, dir] of [
        [z.a, 1],
        [z.b, -1],
      ])
        if (Math.hypot(a.pos.x - end.x, a.pos.z - end.z) < 2.2) return { z, dir };
    return null;
  }
  function use(a) {
    if (!a || !a.alive) return !1;
    if (a._zip) return (a._zip = null), !0;
    const z = nearZip(a);
    if (z) return (a._zip = { line: z.z, dir: z.dir, t: 1 === z.dir ? 0 : 1 }), !0;
    if (!isHost()) return !1;
    const d = nearDoor(a);
    if (d && d.cd <= 0) {
      if (d.open && world.actors.some((o) => o.alive && Math.abs(o.pos.x - d.x) < d.w / 2 + 0.8 && Math.abs(o.pos.z - d.z) < d.d / 2 + 0.8)) return !1;
      setDoor(d, !d.open);
      d.cd = 0.8;
      syncDoors();
      return !0;
    }
    return !1;
  }
  function syncDoors() {
    "host" === NET.mode && sendEventAll({ t: "gim", d: G.door.map((d) => (d.open ? 1 : 0)) });
  }
  function tryUse() {
    const me = "function" == typeof myActor ? myActor() : null;
    if (!me || !world.actors || !world.actors.length) return;
    if (!nearZip(me) && !nearDoor(me) && !me._zip) return;
    "client" === NET.mode ? (nearZip(me) || me._zip ? use(me) : 0, sendAction({ t: "gim" })) : use(me);
  }
  let fWas = !1;
  addEventListener("keydown", (e) => {
    if (!KEYMAP.is(e, "use") || KEYMAP.editing(e.target) || fWas) return;
    fWas = !0;
    tryUse();
  });
  addEventListener("keyup", (e) => {
    KEYMAP.is(e, "use") && (fWas = !1);
  });
  // touch: the on-screen F button and the prompt itself both work
  $("tb-use") && $("tb-use").addEventListener("pointerdown", () => tryUse());
  $("gim-hint") &&
    $("gim-hint").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      tryUse();
    });
  const _oa = NET.onAction;
  NET.onAction = (peer, msg) => {
    if (msg && "gim" === msg.t) {
      const a = world.actors.find((o) => o.ctrl === peer);
      return void use(a);
    }
    const r = _oa(peer, msg);
    // late joiners need the current door states
    msg && "hello" === msg.t && G.door.length && syncDoors();
    return r;
  };
  const _oe = NET.onEvent;
  NET.onEvent = (e) => {
    if (e && "gim" === e.t) return void (e.d || []).forEach((o, i) => G.door[i] && setDoor(G.door[i], !!o));
    return _oe(e);
  };

  // movement: zipline ride replaces normal movement; teleporter pads move the actor
  const _sm = simMove;
  simMove = function (a, dt) {
    if (a._zip) {
      const z = a._zip,
        L = z.line;
      z.t += (z.dir * 11 * dt) / L.len;
      const k = Math.max(0, Math.min(1, z.t));
      a.pos.x = L.a.x + (L.b.x - L.a.x) * k;
      a.pos.z = L.a.z + (L.b.z - L.a.z) * k;
      a.y = L.h - 1.85;
      a.vy = 0;
      a.onGround = !1;
      a.vel && a.vel.set((L.b.x - L.a.x) * z.dir * 11 / L.len, 0, (L.b.z - L.a.z) * z.dir * 11 / L.len);
      if (k <= 0 || k >= 1 || !a.alive) a._zip = null;
      return;
    }
    const r = _sm.apply(this, arguments);
    // bots path straight over pads and would bounce forever, so only players use them
    if (a.alive && !isAI(a) && (a._tpCd = (a._tpCd || 0) - dt) <= 0)
      for (const t of G.tp)
        if (Math.hypot(a.pos.x - t.a.x, a.pos.z - t.a.z) < 1.2) {
          a.pos.x = t.b.x + rnd(-0.6, 0.6);
          a.pos.z = t.b.z + rnd(-0.6, 0.6);
          a._tpCd = 1.5;
          a.vel && a.vel.set(0, 0, 0);
          if ("me" === a.ctrl) {
            try {
              SFX.beep && SFX.beep();
            } catch (e) {}
            try {
              edgeFlash("#22d3ee", 0.5);
            } catch (e) {}
          }
          break;
        }
    return r;
  };
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    const now = performance.now() / 1e3;
    for (const d of G.door) {
      d.cd > 0 && (d.cd -= dt);
      d.k += ((d.open ? 1 : 0) - d.k) * Math.min(1, 6 * dt);
      d.col.mesh && (d.col.mesh.position.y = d.h / 2 - d.h * 0.98 * d.k);
    }
    for (const t of G.tp) t.ma.userData.col.material.opacity = 0.1 + 0.08 * Math.sin(now * 3 + t.i);
    const me = "function" == typeof myActor ? myActor() : null;
    if (me && me.alive) {
      const k = document.body.classList.contains("touching") ? "탭 · " : "F · ",
        hint = me._zip ? k + "내리기" : nearZip(me) ? k + "집라인 타기" : nearDoor(me) ? k + "문 " + (nearDoor(me).open ? "닫기" : "열기") : "";
      const h = $("gim-hint");
      h && (h.textContent = hint, (h.hidden = !hint));
    } else $("gim-hint") && ($("gim-hint").hidden = !0);
    return r;
  };
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    if (!G.key || "undefined" == typeof mctx) return r;
    const b = MAP.bounds,
      sx = mini.width / (b.maxX - b.minX),
      sz = mini.height / (b.maxZ - b.minZ),
      X = (x) => (x - b.minX) * sx,
      Z = (z) => (z - b.minZ) * sz;
    mctx.lineWidth = 2;
    for (const t of G.tp) {
      mctx.strokeStyle = "#22d3ee";
      mctx.beginPath();
      mctx.arc(X(t.a.x), Z(t.a.z), 5, 0, 7);
      mctx.stroke();
      mctx.setLineDash([3, 4]);
      mctx.strokeStyle = "rgba(34,211,238,.4)";
      mctx.beginPath();
      mctx.moveTo(X(t.a.x), Z(t.a.z));
      mctx.lineTo(X(t.b.x), Z(t.b.z));
      mctx.stroke();
      mctx.setLineDash([]);
    }
    for (const z of G.zip) {
      mctx.strokeStyle = "#ffc849";
      mctx.beginPath();
      mctx.moveTo(X(z.a.x), Z(z.a.z));
      mctx.lineTo(X(z.b.x), Z(z.b.z));
      mctx.stroke();
    }
    for (const d of G.door) {
      mctx.fillStyle = d.open ? CB.rgba("good", 0.6) : CB.get("bad");
      mctx.fillRect(X(d.x - d.w / 2), Z(d.z - d.d / 2), Math.max(2, d.w * sx), Math.max(2, d.d * sz));
    }
    return r;
  };
  try {
    CUR_MAP_KEY && build(CUR_MAP_KEY);
  } catch (e) {}
})();
