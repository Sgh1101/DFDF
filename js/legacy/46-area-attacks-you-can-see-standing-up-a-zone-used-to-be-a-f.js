
(() => {
  // Area attacks you can see standing up. A zone used to be a flat ring on
  // the floor (and a faint low wall), which is a thin line at eye height.
  // Every zone now also gets a glowing curtain up to head height that fades
  // upward, and blasts throw a short column of light, so the edge of the
  // danger reads from anywhere.
  if ("undefined" == typeof makeZone || "undefined" == typeof T) return;
  let tex = null;
  function fadeTex() {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 64;
    const g = c.getContext("2d"),
      gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.55, "rgba(255,255,255,.18)");
    gr.addColorStop(0.9, "rgba(255,255,255,.75)");
    gr.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 64);
    tex = new T.CanvasTexture(c);
    return tex;
  }
  const H = 2.3;
  function curtain(r, h, col) {
    const m = new T.Mesh(
      new T.CylinderGeometry(r, r, h, 48, 1, !0),
      new T.MeshBasicMaterial({ map: fadeTex(), color: new T.Color(col).multiplyScalar(1.25), transparent: !0, opacity: 0.6, side: T.DoubleSide, depthWrite: !1, blending: T.AdditiveBlending })
    );
    m.position.y = h / 2;
    m.renderOrder = 2;
    return m;
  }
  const _mz = makeZone;
  makeZone = function () {
    const z = _mz.apply(this, arguments);
    try {
      if (z && z.mesh && z.r > 0.3) {
        const col = arguments[5];
        const c = curtain(z.r, Math.max(H, Math.min(z.h || 0, 3)), null != col ? col : 0xffffff);
        // a brighter, thicker edge on the floor too
        const e = new T.Mesh(new T.RingGeometry(z.r * 0.88, z.r * 1.01, 56), new T.MeshBasicMaterial({ color: new T.Color(null != col ? col : 0xffffff).multiplyScalar(1.4), transparent: !0, opacity: 0.8, side: T.DoubleSide, depthWrite: !1, blending: T.AdditiveBlending }));
        e.rotation.x = -Math.PI / 2;
        e.position.y = 0.06;
        z.mesh.add(c, e);
        z._vis = [c, e];
      }
    } catch (er) {}
    return z;
  };
  if ("function" == typeof animateZone) {
    const _az = animateZone;
    animateZone = function (z, dt) {
      const r = _az.apply(this, arguments);
      if (z && z._vis) {
        const f = Math.max(0, Math.min(1, z.life / Math.max(0.001, z.maxLife))),
          k = Math.min(1, 4 * (z._t || 0)),
          p = 0.5 + 0.12 * Math.sin(3.1 * (z._t || 0));
        // last second: fade out
        const end = Math.min(1, (z.life || 0) / 1);
        z._vis[0].material.opacity = p * k * end * (0.6 + 0.4 * f);
        z._vis[1].material.opacity = 0.8 * k * end;
      }
      return r;
    };
  }
  // blasts: a column of light the size of the hit
  if ("function" == typeof explode && "function" == typeof addFx) {
    const _ex = explode;
    explode = function (x, z, r, dmg, min, col) {
      const out = _ex.apply(this, arguments);
      try {
        if (r > 0.5) {
          const c = curtain(r, 3, null != col ? col : 0xffab40);
          c.position.set(x, 1.5, z);
          addFx(c, 0.55, (m, t) => {
            const s = 0.55 + 0.45 * Math.min(1, t * 3);
            m.scale.set(s, 1 - 0.4 * t, s);
            m.material.opacity = 0.9 * (1 - t);
          });
        }
      } catch (er) {}
      return out;
    };
  }
  window.ZONEVIS = { H };
})();
