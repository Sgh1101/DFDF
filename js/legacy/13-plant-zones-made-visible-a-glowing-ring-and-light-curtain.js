
(() => {
  // Plant zones made visible: a glowing ring and light curtain on the ground at
  // exactly the radius where planting works, a soft fill inside, both maps
  // shading the zone, and a prompt while you stand in one with the spike.
  const COL = 0xff3b4e;
  const FX = { list: [], t: 0 };
  function gradTex(w, h, stops, radial) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d"),
      gr = radial ? g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2) : g.createLinearGradient(0, h, 0, 0);
    stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  const TEX = {};
  const glowMat = (map, op) =>
    new T.MeshBasicMaterial({ color: COL, map, transparent: !0, opacity: op, blending: T.AdditiveBlending, depthWrite: !1, side: T.DoubleSide });
  function build() {
    FX.list.forEach((s) => s.group.parent && s.group.parent.remove(s.group));
    FX.list = [];
    TEX.curtain || (TEX.curtain = gradTex(4, 64, [[0, 0.9], [0.25, 0.35], [1, 0]]));
    TEX.fill || (TEX.fill = gradTex(128, 128, [[0, 0], [0.62, 0.02], [0.93, 0.22], [1, 0.4]], !0));
    for (const site of MAP.sites || []) {
      const g = new T.Group(),
        r = site.r;
      const ring = new T.Mesh(new T.RingGeometry(r - 0.28, r + 0.04, 120), glowMat(null, 0.9));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      const fill = new T.Mesh(new T.CircleGeometry(r, 72), glowMat(TEX.fill, 0.5));
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = 0.04;
      const cur = new T.Mesh(new T.CylinderGeometry(r, r, 1.8, 120, 1, !0), glowMat(TEX.curtain, 0.45));
      cur.position.y = 0.9;
      [ring, fill, cur].forEach((m) => ((m.renderOrder = 2), (m.userData.noMerge = !0), g.add(m)));
      g.position.set(site.x, 0, site.z);
      g.userData.siteFx = !0;
      scene.add(g);
      FX.list.push({ site, group: g, ring, fill, cur, k: 0.5 });
    }
  }
  const _lm = loadMap;
  loadMap = function () {
    const r = _lm.apply(this, arguments);
    try {
      r !== !1 && build();
    } catch (e) {
      console.warn("sitefx", e);
    }
    return r;
  };
  try {
    build();
  } catch (e) {}

  // prompt while standing in a zone with the spike
  const hint = document.createElement("div");
  hint.id = "plant-hint";
  hint.hidden = !0;
  (document.getElementById("hud") || document.body).appendChild(hint);
  const css = document.createElement("style");
  css.textContent =
    "#plant-hint{position:absolute;left:50%;bottom:204px;transform:translateX(-50%);padding:7px 16px;border-radius:999px;border:1px solid rgba(255,59,78,.55);background:rgba(40,8,14,.72);color:#ffd9dd;font-size:12.5px;letter-spacing:.04em;pointer-events:none;box-shadow:0 0 22px rgba(255,59,78,.35);white-space:nowrap}#plant-hint[hidden]{display:none}#plant-hint b{color:#ff5a6a;margin-right:6px}@media (max-width:700px),(max-height:500px){#plant-hint{bottom:46%;font-size:11.5px}}";
  document.head.appendChild(css);

  const localMe = () => ("function" == typeof myActor && myActor()) || player;
  function tick(dt) {
    FX.t += dt;
    const me = localMe(),
      sp = world.spike,
      carrying = !!(me && me.alive && me.hasSpike && "carried" === sp.state && "atk" === me.team),
      planted = "planted" === sp.state;
    const inSite = me && me.alive ? siteAt(me.pos.x, me.pos.z) : null;
    for (const s of FX.list) {
      const here = inSite === s.site,
        plantedHere = planted && siteAt(sp.x, sp.z) === s.site;
      // brighter while you carry the spike, brightest in the zone you stand in
      let want = planted ? (plantedHere ? 1 : 0.12) : carrying ? (here ? 1.25 : 0.85) : here ? 0.7 : 0.45;
      s.k += (want - s.k) * Math.min(1, 5 * dt);
      const pulse = 0.82 + 0.18 * Math.sin(FX.t * (plantedHere ? 7 : carrying ? 3.2 : 1.6) + s.site.x);
      s.ring.material.opacity = Math.min(1, 0.75 * s.k * pulse);
      s.cur.material.opacity = 0.42 * s.k * pulse;
      s.fill.material.opacity = 0.55 * s.k;
      s.group.visible = s.k > 0.02;
    }
    // the spike plants itself once you are inside a zone; guide the carrier in
    let near = null;
    if (carrying && !inSite && "live" === world.phase)
      for (const s of MAP.sites) {
        const d = Math.hypot(me.pos.x - s.x, me.pos.z - s.z);
        d < s.r + 16 && (!near || d < near.d) && (near = { s, d });
      }
    const show = !!near;
    if (show) {
      const txt = `<b>${near.s.id} 사이트</b>빛나는 원 안으로 들어가면 스파이크가 설치됩니다`;
      hint.dataset.t !== txt && ((hint.innerHTML = txt), (hint.dataset.t = txt));
    }
    hint.hidden = !show;
  }
  const _ns = netStep;
  netStep = function (dt) {
    const r = _ns.apply(this, arguments);
    try {
      tick(dt || 0.016);
    } catch (e) {}
    return r;
  };

  // both maps: shade the plant zone, not just its outline
  function zone(ctx, x, z, rad, here, label, scale) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = here ? "rgba(255,59,78,.34)" : "rgba(255,59,78,.16)";
    ctx.beginPath();
    ctx.arc(x, z, rad, 0, 7);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = here ? "#ff6b78" : "rgba(255,59,78,.9)";
    ctx.lineWidth = (here ? 3.5 : 2.5) * scale;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, z, rad, 0, 7);
    ctx.stroke();
  }
  const _dm = drawMini;
  drawMini = function () {
    const r = _dm.apply(this, arguments);
    if ("undefined" == typeof mctx || !MAP.sites) return r;
    const b = MAP.bounds,
      sx = mini.width / (b.maxX - b.minX),
      sz = mini.height / (b.maxZ - b.minZ),
      me = localMe(),
      inSite = me && me.alive ? siteAt(me.pos.x, me.pos.z) : null;
    for (const s of MAP.sites) {
      const x = (s.x - b.minX) * sx,
        z = (s.z - b.minZ) * sz;
      zone(mctx, x, z, s.r * sx, inSite === s, s.id, 1);
      mctx.fillStyle = "#fff";
      mctx.font = "bold 19px Orbitron, sans-serif";
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      mctx.fillText(s.id, x, z);
    }
    return r;
  };
  if ("function" == typeof drawTac && "undefined" != typeof tctx && tctx) {
    const _dt = drawTac;
    drawTac = function () {
      const r = _dt.apply(this, arguments);
      try {
        const me = player,
          n = tac.width / 2 / 52,
          inSite = me && me.alive ? siteAt(me.pos.x, me.pos.z) : null;
        tctx.save();
        tctx.translate(tac.width / 2, tac.height / 2);
        tctx.rotate(me.yaw);
        tctx.translate(-me.pos.x * n, -me.pos.z * n);
        for (const s of MAP.sites) zone(tctx, s.x * n, s.z * n, s.r * n, inSite === s, s.id, 1);
        tctx.restore();
      } catch (e) {}
      return r;
    };
  }
})();
