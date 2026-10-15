(() => {
  // Aim assist. While you are aiming (turning, firing, aiming down sights or
  // moving), the view leans a little toward an enemy near the crosshair and
  // follows a little of how that enemy moves across the screen. Only an enemy
  // in sight, in range and close to where you already look; it never turns you
  // round, and your own turning always wins.
  //   phone: free for everyone, a switch in the settings (on unless turned off)
  //   computer: only an account the owner opened it for (owner page), or anyone
  //             in admin mode; off in ranked rooms
  // The owner page also turns each side off for everyone, sets the strength,
  // the range and the cone, and can close the phone side for one account.
  if ("undefined" == typeof player || "function" != typeof step || "function" != typeof otherFighters || "function" != typeof rayBlocked) return;
  const $ = (id) => document.getElementById(id);
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko);
  const DEF = { mobile: !0, pc: !0, strength: 35, range: 45, cone: 8, ranked: !0 };
  const cfg = () => Object.assign({}, DEF, (window.SERVER_CFG && SERVER_CFG.aim) || {});
  // the player's own switches: the phone's on by default, the computer's off until turned on
  const PREF = { mobile: !0, pc: !1, lvl: 1 };
  try {
    const s = JSON.parse(localStorage.getItem("lgp_aim") || "null");
    s && "object" == typeof s && Object.assign(PREF, { mobile: !1 !== s.mobile, pc: !!s.pc, lvl: [0, 1, 2].includes(s.lvl) ? s.lvl : 1 });
  } catch (e) {}
  const save = () => {
    try {
      localStorage.setItem("lgp_aim", JSON.stringify(PREF));
    } catch (e) {}
  };
  const LVL = [0.6, 1, 1.45];
  // a phone: the touch controls on a device that really is touch-first (not a computer switched to touch mode)
  const phone = () => {
    if (window.AIM_ASSIST && null != AIM_ASSIST._phone) return !!AIM_ASSIST._phone;
    try {
      return !!IS_TOUCH && (navigator.maxTouchPoints || 0) > 0 && (!window.matchMedia || matchMedia("(pointer: coarse)").matches);
    } catch (e) {
      return !1;
    }
  };
  const user = () => {
    try {
      const s = window.ACCOUNT && ACCOUNT.session && ACCOUNT.session();
      return (s && s.user) || null;
    } catch (e) {
      return null;
    }
  };
  // what the owner set for this account: { pc, mobile, until } (pc is a grant; mobile is on unless closed)
  const acct = () => {
    const u = user(),
      a = (u && u.aim) || {};
    return { pc: !!a.pc && !(a.until && a.until < Date.now()), mobile: !1 !== a.mobile };
  };
  const ranked = () => !!((window.RANKED && RANKED.locked) || ("undefined" != typeof room && room && room.ranked));
  const admin = () => !!(window.IS_OWNER || window.ADMIN_GRANTED);
  // may this device use it, and why not
  function access() {
    const c = cfg();
    if (phone()) {
      if (!c.mobile) return { ok: !1, side: "mobile", why: L("운영자가 모바일 에임 보정을 꺼 두었습니다", "Turned off by the owner") };
      if (!acct().mobile) return { ok: !1, side: "mobile", why: L("이 계정은 에임 보정이 막혀 있습니다", "Closed for this account") };
      if (ranked() && !c.ranked) return { ok: !1, side: "mobile", why: L("랭크전에서는 꺼집니다", "Off in ranked") };
      return { ok: !0, side: "mobile" };
    }
    if (ranked()) return { ok: !1, side: "pc", why: L("랭크전에서는 컴퓨터 에임 보정이 꺼집니다", "Off in ranked on a computer") };
    if (!c.pc) return { ok: !1, side: "pc", why: L("운영자가 컴퓨터 에임 보정을 꺼 두었습니다", "Turned off by the owner") };
    if (!acct().pc && !admin()) return { ok: !1, side: "pc", why: L("컴퓨터는 운영자에게 권한을 받은 계정만 쓸 수 있습니다", "On a computer only for accounts the owner opened it for") };
    return { ok: !0, side: "pc" };
  }
  const on = () => {
    const a = access();
    return a.ok && ("mobile" === a.side ? PREF.mobile : PREF.pc);
  };

  // ── the assist ──
  const S = { yaw: 0, pitch: 0, init: !1, lookT: 0, tgt: null, tYaw: 0, tPitch: 0, pulls: 0 };
  const wrap = (a) => {
    for (; a > Math.PI; ) a -= 2 * Math.PI;
    for (; a < -Math.PI; ) a += 2 * Math.PI;
    return a;
  };
  function assist(dt) {
    if (!on() || !player.alive || "live" !== world.phase) return (S.init = !1), (S.tgt = null);
    // my own turning since the last step (anything the assist did not do)
    if (S.init && (Math.abs(wrap(player.yaw - S.yaw)) > 1e-5 || Math.abs(player.pitch - S.pitch) > 1e-5)) S.lookT = 0.6;
    else S.lookT -= dt;
    const moving = player.vel && Math.hypot(player.vel.x, player.vel.z) > 0.5;
    const engaged = S.lookT > 0 || keys.fire || player.ads || moving;
    const c = cfg(),
      s = Math.max(0, Math.min(1, (+c.strength || 0) / 100)) * LVL[PREF.lvl],
      range = Math.max(5, +c.range || 45),
      cone0 = (Math.max(1, +c.cone || 8) * Math.PI) / 180;
    let best = null;
    if (engaged && s > 0) {
      const ex = player.pos.x,
        ey = player.y + eyeHeight(),
        ez = player.pos.z,
        cp = Math.cos(player.pitch),
        fx = -Math.sin(player.yaw) * cp,
        fy = Math.sin(player.pitch),
        fz = -Math.cos(player.yaw) * cp;
      for (const o of otherFighters()) {
        if (!o || !o.alive || o.team === player.team || o.invisible || o.hidden) continue;
        const ty = o.y + (o.crouch ? 1.05 : 1.3),
          dx = o.pos.x - ex,
          dy = ty - ey,
          dz = o.pos.z - ez,
          d = Math.hypot(dx, dy, dz);
        if (d < 0.5 || d > range) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy + dz * fz) / d))),
          cone = Math.max(cone0, Math.atan2(0.7, d));
        if (ang > cone || (best && ang >= best.ang)) continue;
        if (rayBlocked(ex, ey, ez, o.pos.x, ty, o.pos.z)) continue;
        best = { o, ang, cone, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
      }
    }
    if (best) {
      // follow a part of how the enemy moved across the view since the last step
      if (S.tgt === best.o) {
        player.yaw += Math.max(-0.05, Math.min(0.05, wrap(best.yaw - S.tYaw))) * s;
        player.pitch += Math.max(-0.05, Math.min(0.05, best.pitch - S.tPitch)) * s;
      }
      // and lean toward it, more the closer it already is to the middle
      const k = Math.min(1, s * 5 * dt) * (0.35 + 0.65 * (1 - best.ang / best.cone));
      player.yaw += wrap(best.yaw - player.yaw) * k;
      player.pitch += (best.pitch - player.pitch) * k;
      player.pitch = Math.max(-1.52, Math.min(1.52, player.pitch));
      S.tgt = best.o;
      S.tYaw = best.yaw;
      S.tPitch = best.pitch;
      S.pulls++;
    } else S.tgt = null;
    S.yaw = player.yaw;
    S.pitch = player.pitch;
    S.init = !0;
  }
  const _step = step;
  step = function (dt) {
    const r = _step.apply(this, arguments);
    try {
      assist(dt || 0.016);
    } catch (e) {
      window.__aimErr = e;
    }
    return r;
  };

  // ── the switch in the settings ──
  function row() {
    const sw = $("st-touch"),
      host = sw && sw.closest(".pz-row");
    if (!host || $("st-aim")) return;
    const r = document.createElement("div");
    r.className = "pz-row pz-toggle";
    r.id = "st-aimrow";
    r.innerHTML = `<div><div class="pz-lab">${L("에임 보정", "Aim assist")}</div><div class="pz-sub" id="st-aim-d"></div></div><button class="pz-sw" id="st-aim"><span></span></button>`;
    host.after(r);
    const r2 = document.createElement("div");
    r2.className = "pz-row";
    r2.id = "st-aimlvl";
    r2.innerHTML = `<div class="pz-lab">${L("보정 세기", "Strength")}</div><div class="pz-qrow">${[L("약하게", "Light"), L("보통", "Normal"), L("강하게", "Strong")].map((t, i) => `<button class="pz-q" data-l="${i}">${t}</button>`).join("")}</div>`;
    r.after(r2);
    $("st-aim").onclick = () => {
      const a = access();
      if (!a.ok) return paint();
      "mobile" === a.side ? (PREF.mobile = !PREF.mobile) : (PREF.pc = !PREF.pc);
      save();
      paint();
    };
    r2.querySelectorAll("button").forEach((b) => (b.onclick = () => ((PREF.lvl = +b.dataset.l), save(), paint())));
    paint();
  }
  function paint() {
    const sw = $("st-aim");
    if (!sw) return;
    const a = access(),
      v = a.ok && ("mobile" === a.side ? PREF.mobile : PREF.pc);
    sw.classList.toggle("on", !!v);
    sw.disabled = !a.ok;
    sw.style.opacity = a.ok ? "" : ".4";
    const d = $("st-aim-d");
    d && (d.textContent = a.ok ? ("mobile" === a.side ? L("조준할 때 가까운 적을 조금 따라갑니다 (모바일 무료)", "The aim follows a nearby enemy a little (free on phones)") : L("운영자 권한으로 켤 수 있습니다", "Opened for this account by the owner")) : a.why);
    const lv = $("st-aimlvl");
    lv && ((lv.hidden = !v), lv.querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.l === PREF.lvl)));
  }

  // ── the switch in the admin panel's own tab (computer) ──
  function adminRow() {
    const tg = $("ad-toggles"),
      me = document.querySelector('.ad-tabs button[data-t="me"].on');
    if (!tg || !me || $("ad-aim")) return;
    const n = document.createElement("div");
    n.className = "ad-tg";
    n.id = "ad-aim";
    n.innerHTML = `<div><div class="ad-tgname">${L("에임 보정", "Aim assist")}</div><div class="ad-tgdesc">${L("조준이 가까운 적을 조금 따라갑니다 (랭크전에서는 꺼짐)", "The aim follows a nearby enemy a little (off in ranked)")}</div></div><span class="ad-dot"><i></i></span>`;
    const p = () => {
      const a = access(),
        v = a.ok && ("mobile" === a.side ? PREF.mobile : PREF.pc);
      n.classList.toggle("on", !!v);
      n.classList.toggle("locked", !a.ok);
    };
    n.onclick = () => {
      const a = access();
      if (!a.ok) return;
      "mobile" === a.side ? (PREF.mobile = !PREF.mobile) : (PREF.pc = !PREF.pc);
      save();
      p();
      paint();
    };
    tg.appendChild(n);
    p();
  }
  if ("function" == typeof buildAdminUI) {
    const _b = buildAdminUI;
    buildAdminUI = function () {
      const r = _b.apply(this, arguments);
      try {
        adminRow();
      } catch (e) {}
      return r;
    };
  }
  row();
  setInterval(() => {
    try {
      row();
      const p = $("pause");
      p && !p.hidden && paint();
    } catch (e) {}
  }, 500);
  addEventListener("server-config", () => paint());

  window.AIM_ASSIST = { on, access, pref: PREF, cfg, state: S, save, paint, _phone: null };
})();
