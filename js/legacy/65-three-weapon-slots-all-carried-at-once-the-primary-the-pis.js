
(() => {
  // Three weapon slots, all carried at once: the primary, the pistol and the
  // knife (1 · 2 · 3, the mouse wheel, or a tap on the ammo counter on a
  // phone). The knife used to take the pistol's place and had to be bought
  // in the shop. A guest's slot now also travels to the host with its
  // input: before, the host kept firing whatever it had last handed the
  // guest, whichever key the guest pressed.
  if ("undefined" == typeof WEAPONS || !WEAPONS.knife || "undefined" == typeof player || "undefined" == typeof NET || "function" != typeof switchSlot || "function" != typeof step) return;
  const EN = "en" === window.GAME_LANG,
    L = (ko, en) => (EN ? en : ko),
    $ = (id) => document.getElementById(id);
  const ORDER = ["primary", "secondary", "knife"];
  const me = () => {
    try {
      return ("function" == typeof myActor && myActor()) || player;
    } catch (e) {
      return player;
    }
  };
  // every body carries a knife
  const ensure = (a) => {
    a && a.weapons && "knife" !== a.weapons.knife && (a.weapons.knife = "knife");
  };
  const _st = step;
  step = function () {
    const r = _st.apply(this, arguments);
    try {
      ensure(player);
      for (const a of world.actors || []) ensure(a);
    } catch (e) {}
    return r;
  };
  ensure(player);
  const has = (s) => {
    const w = (me() && me().weapons) || player.weapons;
    return "knife" === s || !!(w && w[s]);
  };
  const busy = () => !player.alive || !!player.ultW || ("object" == typeof FLY && FLY && FLY.on) || "menu" === world.phase;
  // the next slot that has something in it
  function cycle(dir) {
    const i = Math.max(0, ORDER.indexOf(player.slot));
    for (let k = 1; k <= ORDER.length; k++) {
      const s = ORDER[(i + dir * k + 3 * ORDER.length) % ORDER.length];
      if (has(s)) {
        switchSlot(s);
        return s;
      }
    }
    return player.slot;
  }
  const typing = (e) => {
    const t = e.target;
    return !!(t && ("INPUT" === t.tagName || "TEXTAREA" === t.tagName));
  };
  const inGame = () => "undefined" != typeof locked && locked;
  // 3 draws the knife (1 and 2 are the game's own)
  addEventListener("keydown", (e) => {
    if (e.repeat || "3" !== e.key || typing(e) || !inGame() || busy()) return;
    switchSlot("knife");
  });
  // the wheel runs through the three
  addEventListener(
    "wheel",
    (e) => {
      if (!inGame() || busy() || !e.deltaY) return;
      cycle(e.deltaY > 0 ? 1 : -1);
    },
    { passive: !0 }
  );
  // a phone: a tap on the ammo counter runs through them too (the game's own
  // tap only swapped the two guns)
  const am = $("ammo");
  am &&
    am.addEventListener(
      "touchstart",
      (e) => {
        if (!document.body.classList.contains("touching")) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (busy()) return;
        cycle(1);
        try {
          navigator.vibrate && navigator.vibrate(5);
        } catch (x) {}
      },
      { capture: !0, passive: !1 }
    );
  const css = document.createElement("style");
  css.textContent = "body.touching #hud #ammo .am-swap{display:block}";
  document.head.appendChild(css);
  // the counter says 근접 for the knife instead of 0/0
  if ("function" == typeof updateHUD) {
    const _uh = updateHUD;
    updateHUD = function () {
      const r = _uh.apply(this, arguments);
      try {
        if (!player.ultW && "knife" === curWeaponKey()) {
          const c = $("am-count"),
            h = `—<small>${L("근접", "melee")}</small>`;
          c && c.innerHTML !== h && (c.innerHTML = h);
        }
      } catch (e) {}
      return r;
    };
  }
  // the shop no longer sells it, and a purchase of it changes nothing
  if ("function" == typeof applyPurchase) {
    const _ap = applyPurchase;
    applyPurchase = function (e, t, o) {
      if ("weapon" === t && "knife" === o) return;
      return _ap.apply(this, arguments);
    };
  }
  if ("function" == typeof renderShop) {
    const _rs = renderShop;
    renderShop = function () {
      const r = _rs.apply(this, arguments);
      try {
        document.querySelectorAll("#shop-grid .sitem").forEach((c) => {
          const b = c.querySelector("b");
          b && b.textContent.trim() === WEAPONS.knife.name && c.remove();
        });
      } catch (e) {}
      return r;
    };
  }
  // a guest's slot rides with its input; the host follows it
  if ("function" == typeof gatherInput) {
    const _gi = gatherInput;
    gatherInput = function () {
      const r = _gi.apply(this, arguments);
      try {
        r && (r.sl = Math.max(0, ORDER.indexOf(player.slot)));
      } catch (e) {}
      return r;
    };
  }
  const _oi = NET.onInput;
  NET.onInput = function (peer, m) {
    const r = _oi ? _oi.apply(this, arguments) : undefined;
    try {
      if (m && null != m.sl) {
        const a = (world.actors || []).find((x) => x.ctrl === peer),
          want = ORDER[m.sl | 0];
        if (a && want && a.weapons && ("knife" === want || a.weapons[want]) && a.slot !== want) {
          ensure(a);
          a.slot = want;
          a.reloading = 0;
          a.fireCd = Math.max(a.fireCd || 0, 0.28);
        }
      }
    } catch (e) {}
    return r;
  };
  window.SLOTS = { ORDER, cycle, ensure };
})();
