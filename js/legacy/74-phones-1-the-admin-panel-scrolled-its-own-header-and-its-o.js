
(() => {
  // Phones. 1) The admin panel scrolled its own header (and its 닫기) off a
  // short landscape screen: the header now stays on top, and a ✕ is always in
  // the corner. 2) Aiming with a thumb is harder, so a touch player's shots
  // count a little wider around the head and the body — only where a shot
  // lands, never how much it hurts. A guest on a phone tells the host so,
  // which judges its shots. 3) No inspect or combat-log buttons on the touch
  // layout. 4) A smaller settings window that leaves the game visible.
  const $ = (id) => document.getElementById(id);
  const touching = () => "undefined" != typeof IS_TOUCH && !!IS_TOUCH;

  // ── looks ──
  const css = document.createElement("style");
  css.textContent = `
#admin .ad-head{position:sticky;top:-10px;z-index:5;background:#0b0f16;padding-top:10px;margin-top:-10px}
#ad-x{display:none;position:fixed;top:8px;right:10px;z-index:76;width:42px;height:42px;border-radius:12px;border:1px solid #3a4558;background:rgba(14,18,26,.96);color:#e8edf4;font-size:20px;line-height:1;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.5)}
body.touching #tb-inspect,body.touching #tb-log,body.touching #hud #tabil #tb-inspect.tab,body.touching #hud #tb-inspect,body.touching #hud #tb-log{display:none!important}
@media (max-height:520px),(pointer:coarse) and (max-width:950px){
  #pause{padding:8px!important}
  #pause .pz-card{width:min(600px,80vw)!important;padding:12px 14px 10px!important;border-radius:16px!important}
  #pause .pz-card>.lbl{display:none!important}
  #pause .pz-title{font-size:15px!important;margin:0 0 8px!important}
  #pause .pz-tabs{margin-bottom:6px!important}
  #pause .pz-tabs button{padding:6px 8px!important;font-size:11.5px!important;min-height:30px}
  #pause .pz-set{max-height:min(46vh,250px)!important;gap:6px!important}
  #pause .pz-row{padding:7px 11px!important}
  #pause .pz-lab{font-size:11.5px!important}
  #pause .pz-sub{font-size:10px!important}
  #pause .pz-sw{width:40px!important;height:22px!important}
  #pause .pz-sw span{width:14px!important;height:14px!important}
  #pause .pz-sw.on span{left:21px!important}
  #pause .pz-btns{margin-top:8px!important;gap:6px!important}
  #pause .pz-btns button{padding:6px 12px!important;font-size:11.5px!important;min-height:34px}
  #admin .ad-wrap{width:min(760px,94vw)!important}
  #ad-x{display:block}
  #admin .ad-head{padding-right:50px}
}
body.touching #ad-x{display:block}
body.touching #admin .ad-head{padding-right:50px}`;
  document.head.appendChild(css);

  // ── 1. the admin panel always has a way out ──
  try {
    const host = $("admin");
    if (host) {
      const x = document.createElement("button");
      x.id = "ad-x";
      x.type = "button";
      x.setAttribute("aria-label", "닫기");
      x.textContent = "✕";
      x.onclick = (e) => {
        e.stopPropagation();
        const c = $("ad-close"),
          p = $("ad-panel"),
          k = $("ad-cancel");
        // the panel's own 닫기 when it is open, the password box's otherwise
        p && !p.hidden && c ? c.click() : k ? k.click() : "function" == typeof closeAdmin && closeAdmin();
        host.hidden = !0;
      };
      host.appendChild(x);
    }
  } catch (e) {}

  // ── 3. extras off the touch layout: after every HUD update (the inspect
  // button sets its own place and display there, inline and !important)
  const hideExtras = () => {
    const on = touching();
    for (const id of ["tb-inspect", "tb-log"]) {
      const e = $(id);
      if (!e) continue;
      if (on) (e.hidden = !0), e.style.setProperty("display", "none", "important");
      else if ("none" === e.style.getPropertyValue("display")) e.style.removeProperty("display");
    }
  };
  if ("function" == typeof updateHUD) {
    const _uh = updateHUD;
    updateHUD = function () {
      const r = _uh.apply(this, arguments);
      try {
        hideExtras();
      } catch (e) {}
      return r;
    };
  }
  setInterval(hideExtras, 500);

  // ── 2. a wider hit for touch players ──
  const MOBP = new Set(); // host: guests playing on a phone
  const GROW = { head: 1.6, body: 1.35, tall: 0.18 };
  const isMob = (e) => !!e && ("me" === e.ctrl ? touching() : MOBP.has(e.ctrl));
  // where a shot from t along o meets q, if at all: a hit on the head, on the body, or null
  function meet(q, t, o, s, g) {
    const K = window.BODY_K || ("undefined" != typeof BODY_K ? BODY_K : 1);
    const hc = q.y + (q.crouch ? 1.47 : 1.86) * K,
      hr = 0.17 * K * (g ? GROW.head : 1);
    // head: the closest the line comes to its centre
    const uh = (q.pos.x - t.x) * o.x + (hc - t.y) * o.y + (q.pos.z - t.z) * o.z;
    if (uh > 0 && uh < s) {
      const dx = t.x + o.x * uh - q.pos.x,
        dy = t.y + o.y * uh - hc,
        dz = t.z + o.z * uh - q.pos.z;
      if (Math.hypot(dx, dy, dz) < hr) return { head: !0, u: uh, x: q.pos.x, y: hc, z: q.pos.z };
    }
    const mid = q.y + (q.crouch ? 0.74 : 0.95) * K,
      half = (q.crouch ? 0.64 : 0.75) * K + (g ? GROW.tall : 0),
      rad = 0.56 * K * (g ? GROW.body : 1),
      u = (q.pos.x - t.x) * o.x + (mid - t.y) * o.y + (q.pos.z - t.z) * o.z;
    if (u < 0 || u > s) return null;
    const ix = t.x + o.x * u,
      iy = t.y + o.y * u,
      iz = t.z + o.z * u;
    if (Math.hypot(ix - q.pos.x, iz - q.pos.z) < rad && Math.abs(iy - mid) < half) {
      const k = 0.75 * K - 0.08;
      return { head: !1, u, x: q.pos.x, y: Math.max(mid - k, Math.min(mid + k, iy)), z: q.pos.z };
    }
    return null;
  }
  const _ah = actorHitscan;
  actorHitscan = function (e, t, o, a) {
    try {
      if (e && isMob(e) && t && o && a && !("function" == typeof isAI && isAI(e))) {
        const s = a.range;
        let exact = !1,
          best = null;
        for (const q of world.actors || []) {
          if (!q.alive || q.team === e.team || q === e) continue;
          if (meet(q, t, o, s, !1)) {
            exact = !0;
            break;
          }
          const m = meet(q, t, o, s, !0);
          m && (!best || m.u < best.u) && (best = m);
        }
        // a near miss within the wider shape: the shot goes to that spot
        if (!exact && best) {
          const d = new T.Vector3(best.x - t.x, best.y - t.y, best.z - t.z).normalize();
          const args = Array.prototype.slice.call(arguments);
          args[2] = d;
          return _ah.apply(this, args);
        }
      }
    } catch (x) {}
    return _ah.apply(this, arguments);
  };
  // a guest on a phone tells the host (now and then, so a new host learns it too)
  const _oa = NET.onAction;
  NET.onAction = function (peer, m) {
    if (m && "mob" === m.t) return void (m.on ? MOBP.add(peer) : MOBP.delete(peer));
    return _oa && _oa.apply(this, arguments);
  };
  let told = null,
    tAt = 0;
  setInterval(() => {
    try {
      if ("client" !== NET.mode || "menu" === world.phase) return void (told = null);
      const on = touching(),
        t = performance.now();
      (on !== told || t - tAt > 8e3) && (sendAction({ t: "mob", on: on ? 1 : 0 }), (told = on), (tAt = t));
    } catch (e) {}
  }, 1e3);

  window.MOBILE = { isMob, meet, grow: GROW, peers: MOBP };
})();
