
(() => {
  // Mobile controls, redesigned: a thumb cluster around a big fire button
  // (which also aims while you hold it), a floating joystick, icon buttons,
  // crouch / weapon switch / scoreboard / combat log that phones lacked, and
  // compact vitals. Only applies while touch controls are on.
  const $ = (id) => document.getElementById(id);
  const touchEl = $("touch");
  if (!touchEl) return;
  const I = {
    fire: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
    ads: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 5v4M12 15v4M5 12h4M15 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    jump: '<path d="M6 14l6-6 6 6M6 19l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    crouch: '<path d="M6 6l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 18h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    reload: '<path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 4v4h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    use: '<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-1.5V5a1.5 1.5 0 0 1 3 0v5m0-1a1.5 1.5 0 0 1 3 0v5.5A6.5 6.5 0 0 1 10.5 21 5.5 5.5 0 0 1 5 16l-.8-3.3a1.4 1.4 0 0 1 2.5-1.1L8 13.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    shop: '<path d="M3 4h2.5l2.2 10.5h10.3L20 7H6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="17" cy="19" r="1.5" fill="currentColor"/>',
    board: '<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="2.5" cy="6" r=".1"/>',
    log: '<path d="M5 20V11M10 20V5M15 20v-7M20 20V9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    menu: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    swap: '<path d="M4 8h13l-3-3M20 16H7l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
  const setIcon = (el, k, label) => el && ((el.innerHTML = svg(k) + (label ? `<em>${label}</em>` : "")), el.classList.add("mb"));
  const on = (el, down, up) => {
    if (!el) return;
    el.addEventListener("touchstart", (e) => { if (touch.on) { e.preventDefault(); e.stopPropagation(); down(e); } }, { passive: !1 });
    up && el.addEventListener("touchend", (e) => (e.preventDefault(), up(e)), { passive: !1 });
    up && el.addEventListener("touchcancel", (e) => up(e));
  };
  const buzz = (ms) => {
    try {
      SETTINGS.haptic !== !1 && navigator.vibrate && navigator.vibrate(ms);
    } catch (e) {}
  };

  // existing buttons get icons
  setIcon($("tb-fire"), "fire");
  setIcon($("tb-ads"), "ads", "조준");
  setIcon($("tb-jump"), "jump", "점프");
  setIcon($("tb-rel"), "reload", "장전");
  setIcon($("tb-use"), "use", "F");
  // new buttons
  const mk = (id, icon, label, parent) => {
    const b = document.createElement("button");
    b.id = id;
    b.className = "tb mb";
    b.innerHTML = svg(icon) + (label ? `<em>${label}</em>` : "");
    (parent || $("tbtns") || touchEl).appendChild(b);
    return b;
  };
  const crouch = mk("tb-crouch", "crouch", "앉기");
  const fire2 = mk("tb-fire2", "fire", "", touchEl);
  // fire buttons also aim: dragging from them turns the view like the free area does
  const fireDown = (e) => {
    beginTouchFire(e);
    buzz(6);
    if (!touch.on) return;
    const t = e.changedTouches[0];
    null === touch.lookId && ((touch.lookId = t.identifier), (touch.lookX = t.clientX), (touch.lookY = t.clientY));
  };
  $("tb-fire").addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    null === touch.lookId && ((touch.lookId = t.identifier), (touch.lookX = t.clientX), (touch.lookY = t.clientY));
  });
  on(fire2, fireDown, endTouchFire);
  on(crouch, () => {
    keys.control = !keys.control;
    crouch.classList.toggle("on", !!keys.control);
    buzz(5);
  });
  // top-right utility strip
  const util = document.createElement("div");
  util.id = "mb-util";
  touchEl.appendChild(util);
  const shopB = $("tb-shop"),
    menuB = $("tb-menu");
  shopB && (setIcon(shopB, "shop"), util.appendChild(shopB));
  const boardB = mk("tb-board", "board", "", util),
    logB = mk("tb-log", "log", "", util);
  menuB && (setIcon(menuB, "menu"), util.appendChild(menuB));
  on(boardB, () => window.QOL && QOL.openBoard("sb", !0));
  on(logB, () => window.QOL && QOL.openBoard("cl", !0));
  // tap ammo to switch weapons
  const ammo = $("ammo");
  if (ammo) {
    const sw = document.createElement("span");
    sw.className = "am-swap";
    sw.innerHTML = svg("swap");
    ammo.appendChild(sw);
    ammo.addEventListener(
      "touchstart",
      (e) => {
        if (!document.body.classList.contains("touching")) return;
        e.preventDefault();
        const p = player;
        if (!p || !p.weapons) return;
        p.weapons.primary && switchSlot("primary" === p.slot ? "secondary" : "primary");
        buzz(5);
      },
      { passive: !1 }
    );
  }
  // ability buttons: icon + cooldown ring, refreshed when the agent changes
  let abKey = "";
  function paintAb() {
    const p = player;
    if (!p || !p.abilities) return;
    const key = (p.agent ? p.agent.id : "") + p.abilities.map((x) => x.def.type).join();
    document.querySelectorAll("#tabil .tab").forEach((el, i) => {
      const a = p.abilities[i];
      if (!a) return;
      if (abKey !== key) {
        let ic = el.querySelector(".tab-ic");
        ic || ((ic = document.createElement("span")), (ic.className = "tab-ic"), el.prepend(ic));
        ic.innerHTML = abIcon(a.def.type, "tab-svg");
      }
      const f = a.def.ult ? 1 - Math.min(1, (p.ultCharge || 0) / (p.ultMax || 5)) : a.cd > 0 && a.def.cd ? a.cd / a.def.cd : 0;
      el.style.setProperty("--cd", f.toFixed(3));
    });
    abKey = key;
  }
  document.querySelectorAll("#tabil .tab").forEach((el) => el.addEventListener("touchstart", () => buzz(8)));

  // floating joystick: put the stick under the thumb wherever it lands on the left
  const stick = $("stick"),
    zone = document.createElement("div");
  zone.id = "stick-zone";
  touchEl.insertBefore(zone, touchEl.firstChild);
  zone.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (null != touch.stickId) return;
      const t = e.changedTouches[0],
        r = stick.getBoundingClientRect(),
        host = touchEl.getBoundingClientRect();
      stick.style.left = t.clientX - host.left - r.width / 2 + "px";
      stick.style.top = t.clientY - host.top - r.height / 2 + "px";
      stick.style.bottom = "auto";
      stick.classList.add("float");
      try {
        stick.dispatchEvent(new TouchEvent("touchstart", { changedTouches: [t], touches: [...e.touches], targetTouches: [t], cancelable: !0, bubbles: !0 }));
      } catch (x) {}
    },
    { passive: !1 }
  );
  const home = (e) => {
    for (const t of e.changedTouches || [])
      if (t.identifier === touch.stickId || null == touch.stickId) {
        stick.style.left = stick.style.top = stick.style.bottom = "";
        stick.classList.remove("float");
      }
  };
  addEventListener("touchend", (e) => setTimeout(() => null == touch.stickId && home(e), 0));
  addEventListener("touchcancel", (e) => setTimeout(() => null == touch.stickId && home(e), 0));

  // per-frame bits: shop only in buy phase, crouch state, use button only when useful
  setInterval(() => {
    if (!document.body.classList.contains("touching")) return;
    paintAb();
    shopB && shopB.classList.toggle("hide", "buy" !== world.phase);
    crouch.classList.toggle("on", !!keys.control);
    const p = player;
    ammo && ammo.classList.toggle("can-swap", !!(p && p.weapons && p.weapons.primary));
    const useful = !!(document.querySelector("#gim-hint:not([hidden]),#pick-hint:not([hidden])") || (world.spike && "planted" === world.spike.state && p && "def" === p.team) || (world.spike && "carried" === world.spike.state && p && p.alive && p.hasSpike && "function" == typeof siteAt && siteAt(p.pos.x, p.pos.z)));
    $("tb-use") && $("tb-use").classList.toggle("dim", !useful);
  }, 150);

  // settings: button size and opacity
  const SZ = { s: 1, o: 1 };
  try {
    Object.assign(SZ, JSON.parse(localStorage.getItem("lgp_mb") || "{}"));
  } catch (e) {}
  const applySZ = () => {
    document.documentElement.style.setProperty("--mbs", SZ.s);
    document.documentElement.style.setProperty("--mbo", SZ.o);
  };
  applySZ();
  const pane = document.querySelector('.pz-pane[data-pane="ctl"]');
  if (pane) {
    const row = (k, name, a, b, st) => {
      const d = document.createElement("div");
      d.className = "pz-row mb-set";
      d.innerHTML = `<div class="xh-line"><span>${name}</span><input type="range" min="${a}" max="${b}" step="${st}" value="${SZ[k]}"><b>${Math.round(SZ[k] * 100)}%</b></div>`;
      const inp = d.querySelector("input"),
        v = d.querySelector("b");
      inp.oninput = () => {
        SZ[k] = +inp.value;
        v.textContent = Math.round(SZ[k] * 100) + "%";
        applySZ();
        try {
          localStorage.setItem("lgp_mb", JSON.stringify(SZ));
        } catch (e) {}
      };
      pane.appendChild(d);
    };
    row("s", "터치 버튼 크기", 0.8, 1.3, 0.05);
    row("o", "터치 버튼 투명도", 0.35, 1, 0.05);
  }

  const css = document.createElement("style");
  css.textContent = `
:root{--mbs:1;--mbo:1}
.mb-set .xh-line span{color:var(--ink,#fff)!important;font-weight:700;font-size:13px;white-space:nowrap}
body.touching #hud #touch{position:absolute!important;inset:0!important;pointer-events:none}
body.touching #hud #tbtns,body.touching #hud #tabil{position:absolute!important;inset:0!important;display:block!important;pointer-events:none;width:auto!important;height:auto!important;transform:none!important;gap:0!important}
body.touching #stick-zone{position:absolute;left:0;bottom:0;width:42%;height:64%;pointer-events:auto}
body.touching #hud #stick{position:absolute!important;left:calc(env(safe-area-inset-left) + 6%)!important;bottom:13%!important;top:auto!important;width:calc(124px*var(--mbs))!important;height:calc(124px*var(--mbs))!important;border-radius:50%!important;background:radial-gradient(circle,rgba(255,255,255,.07) 0 58%,rgba(255,255,255,.02) 59%)!important;border:1.5px solid rgba(255,255,255,.2)!important;box-shadow:inset 0 0 22px rgba(0,0,0,.25)!important;opacity:calc(.9*var(--mbo));pointer-events:auto;transition:opacity .2s}
body.touching #hud #stick.float{bottom:auto!important;opacity:1}
body.touching #hud #stick-knob{width:calc(50px*var(--mbs))!important;height:calc(50px*var(--mbs))!important;left:50%!important;top:50%!important;margin:calc(-25px*var(--mbs)) 0 0 calc(-25px*var(--mbs))!important;border-radius:50%!important;background:radial-gradient(circle at 40% 35%,rgba(255,255,255,.95),rgba(210,220,235,.75))!important;box-shadow:0 4px 14px rgba(0,0,0,.35)!important;border:none!important}
body.touching .mb{position:absolute!important;display:grid!important;place-items:center;align-content:center;padding:0!important;border-radius:50%!important;background:rgba(12,16,22,.42)!important;border:1.5px solid rgba(255,255,255,.22)!important;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff!important;pointer-events:auto;font-size:0!important;box-shadow:0 4px 14px rgba(0,0,0,.25)!important;opacity:var(--mbo);transition:transform .08s,background .15s,border-color .15s;-webkit-tap-highlight-color:transparent;min-width:0!important;min-height:0!important;line-height:1!important}
body.touching .mb svg{width:calc(var(--ic,24px)*var(--mbs));height:calc(var(--ic,24px)*var(--mbs));display:block}
body.touching .mb em{position:absolute;bottom:-15px;left:50%;transform:translateX(-50%);font-style:normal;font-size:9.5px;letter-spacing:.06em;color:rgba(255,255,255,.75);white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.9)}
body.touching .mb:active{transform:scale(.92)}
body.touching .mb.on{background:rgba(255,200,73,.3)!important;border-color:#ffc849!important;color:#ffe7a8!important}
body.touching .mb.dim{opacity:calc(.35*var(--mbo))}
body.touching .mb.hide{display:none!important}
body.touching #tb-fire{right:calc(env(safe-area-inset-right) + 86px)!important;bottom:58px!important;width:calc(88px*var(--mbs))!important;height:calc(88px*var(--mbs))!important;background:radial-gradient(circle,rgba(255,70,88,.5),rgba(200,30,50,.35))!important;border:2px solid rgba(255,120,132,.85)!important;top:auto!important;left:auto!important}
body.touching #tb-fire{--ic:38px}body.touching #tb-fire em,body.touching #tb-fire::after{display:none!important}body.touching #tb-jump,body.touching #tb-ads{--ic:26px}body.touching #tb-fire2{--ic:24px}body.touching #mb-util .mb{--ic:19px}
body.touching #tb-fire2{left:calc(env(safe-area-inset-left) + 25%)!important;bottom:52%!important;width:calc(58px*var(--mbs))!important;height:calc(58px*var(--mbs))!important;background:rgba(255,59,78,.3)!important;border-color:rgba(255,120,132,.7)!important;top:auto!important}
body.touching #tb-ads{right:calc(env(safe-area-inset-right) + 18px)!important;bottom:150px!important;width:calc(60px*var(--mbs))!important;height:calc(60px*var(--mbs))!important;top:auto!important;left:auto!important}
body.touching #tb-jump{right:calc(env(safe-area-inset-right) + 18px)!important;bottom:44px!important;width:calc(62px*var(--mbs))!important;height:calc(62px*var(--mbs))!important;top:auto!important;left:auto!important}
body.touching #tb-crouch{right:calc(env(safe-area-inset-right) + 186px)!important;bottom:24px!important;width:calc(54px*var(--mbs))!important;height:calc(54px*var(--mbs))!important;top:auto!important;left:auto!important}
body.touching #tb-rel{right:calc(env(safe-area-inset-right) + 196px)!important;bottom:104px!important;width:calc(52px*var(--mbs))!important;height:calc(52px*var(--mbs))!important;top:auto!important;left:auto!important}
body.touching #tb-use{right:calc(env(safe-area-inset-right) + 104px)!important;bottom:170px!important;width:calc(52px*var(--mbs))!important;height:calc(52px*var(--mbs))!important;top:auto!important;left:auto!important;background:rgba(56,214,255,.22)!important;border-color:rgba(56,214,255,.7)!important}
body.touching #hud #tabil .tab{position:absolute!important;bottom:236px!important;top:auto!important;left:auto!important;width:calc(52px*var(--mbs))!important;height:calc(52px*var(--mbs))!important;border-radius:50%!important;padding:0!important;display:grid!important;place-items:center;background:conic-gradient(rgba(0,0,0,.55) calc(var(--cd,0)*360deg),rgba(12,16,22,.45) 0)!important;border:1.5px solid color-mix(in srgb,var(--ac,#fff) 70%,transparent)!important;box-shadow:0 4px 14px rgba(0,0,0,.25)!important;pointer-events:auto;opacity:var(--mbo);overflow:visible!important}
body.touching #hud #tabil .tab:nth-child(1){right:calc(env(safe-area-inset-right) + 196px)!important}
body.touching #hud #tabil .tab:nth-child(2){right:calc(env(safe-area-inset-right) + 136px)!important}
body.touching #hud #tabil .tab:nth-child(3){right:calc(env(safe-area-inset-right) + 76px)!important}
body.touching #hud #tabil .tab:nth-child(4){right:calc(env(safe-area-inset-right) + 16px)!important;border-width:2px!important}
body.touching #hud #tabil .tab .tab-ic{display:grid;place-items:center;width:calc(26px*var(--mbs));height:calc(26px*var(--mbs));color:var(--ac,#fff)}
body.touching #hud #tabil .tab .tab-svg{width:100%;height:100%;fill:currentColor}
body.touching #hud #tabil .tab b{position:absolute!important;left:-3px;top:-3px;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font-size:9.5px!important;background:rgba(10,13,18,.9);color:#fff!important;border:1px solid rgba(255,255,255,.25);margin:0!important}
body.touching #hud #tabil .tab i{position:absolute!important;right:-4px;bottom:-4px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;display:grid;place-items:center;font-style:normal;font-size:9.5px!important;background:var(--ac,#ffc849);color:#0b0e13!important;font-weight:700;margin:0!important}
body.touching #hud #tabil .tab.off{filter:grayscale(.7);opacity:calc(.6*var(--mbo))}
body.touching #mb-util{position:absolute;right:calc(env(safe-area-inset-right) + 10px);top:8px;display:flex;gap:6px;pointer-events:none}
body.touching #mb-util .mb{position:relative!important;width:38px!important;height:38px!important;border-radius:11px!important;right:auto!important;left:auto!important;top:auto!important;bottom:auto!important}
body.touching #mb-util #tb-shop{background:rgba(255,200,73,.22)!important;border-color:rgba(255,200,73,.7)!important}
body.touching #hud #mini{width:92px!important;height:92px!important;left:calc(env(safe-area-inset-left) + 10px)!important;right:auto!important;top:8px!important;border-radius:12px!important}
body.touching #hud #tacmap{display:none!important}
body.touching #hud #vitals{left:50%!important;right:auto!important;top:auto!important;bottom:8px!important;transform:translateX(calc(-100% - 6px))!important;padding:5px 12px 5px 10px!important;border-radius:12px!important;gap:10px!important;border-left-width:3px!important}
body.touching #hud #vitals .vit-num{font-size:19px!important}
body.touching #hud #vitals .vit-bar{width:58px!important;height:3px!important}
body.touching #hud #ammo{left:50%!important;right:auto!important;top:auto!important;bottom:8px!important;transform:translateX(6px)!important;padding:5px 30px 5px 11px!important;border-radius:12px!important;pointer-events:auto!important;text-align:left!important;border-right:none!important;border-left:3px solid var(--gold)!important;position:absolute!important}
body.touching #hud #am-count{font-size:18px!important}
body.touching #hud #am-credit{display:none!important}
body.touching #hud #ammo .am-swap{display:none;position:absolute;right:7px;top:50%;width:16px;height:16px;margin-top:-8px;color:var(--gold)}
body.touching #hud #ammo.can-swap .am-swap{display:block}
body.touching #hud #ammo .am-swap svg{width:100%;height:100%}
body.touching #hud #tb-menu{position:relative!important}
body.touching #hud #spike{top:66px!important;bottom:auto!important;max-width:44vw!important;padding:4px 12px!important}
body.touching #hud #sp-txt{font-size:9.5px!important}
body.touching #hud #banner{top:34%!important;font-size:16px!important}
body.touching #hud #mode-board{top:106px!important;left:calc(env(safe-area-inset-left) + 10px)!important;right:auto!important;transform:none!important}
body.touching #gim-hint,body.touching #pick-hint,body.touching #plant-hint{bottom:48%!important}
body.touching #hud #tips,body.touching #hud #skills{display:none!important}
body.touching #hud #statfx{top:106px!important}
/* portrait: thumbs are closer together, abilities go up the right edge */
@media (orientation:portrait){
body.touching #stick-zone{width:50%;height:42%}
body.touching #hud #stick{left:4%!important;bottom:7%!important}
body.touching #mb-util{flex-direction:column}
body.touching #tb-fire{right:22px!important;bottom:110px!important}
body.touching #tb-jump{right:122px!important;bottom:36px!important}
body.touching #tb-ads{right:16px!important;bottom:214px!important}
body.touching #tb-crouch{right:196px!important;bottom:28px!important}
body.touching #tb-rel{right:124px!important;bottom:188px!important}
body.touching #tb-use{right:196px!important;bottom:110px!important}
body.touching #tb-fire2{left:12%!important;bottom:32%!important}
body.touching #hud #tabil .tab{bottom:292px!important}
body.touching #hud #vitals{left:calc(env(safe-area-inset-left) + 10px)!important;bottom:auto!important;top:108px!important;transform:none!important}
body.touching #hud #ammo{left:calc(env(safe-area-inset-left) + 10px)!important;bottom:auto!important;top:156px!important;transform:none!important}
body.touching #hud #spike{bottom:auto!important;top:150px!important;left:auto!important;right:10px!important;transform:none!important;max-width:46vw!important}
body.touching #hud #mode-board{top:204px!important}
}
/* short landscape phones */
@media (orientation:landscape) and (max-height:380px){
body.touching #tb-fire{bottom:44px!important}
body.touching #tb-ads{bottom:128px!important}
body.touching #tb-use{bottom:146px!important}
body.touching #hud #tabil .tab{bottom:200px!important}
body.touching #tb-rel{bottom:100px!important}
}`;
  document.head.appendChild(css);
})();
