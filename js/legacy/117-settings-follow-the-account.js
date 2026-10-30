(() => {
  // The player's settings follow the account (prefs "o" on the server, js/settings-sync.js says which and how they are
  // checked): mouse, aim and touch sensitivity, the crosshair, the graphics preset (once for computers, once for phones),
  // the volumes, the key bindings, the colour-blind mode and the screen-effect switches. Each setting is its own entry with
  // the time it was last changed here; the newer of this device and the account wins, one setting at a time. Taken when
  // the account is known (and again when the tab comes back to the front), sent 1.2 s after the last change.
  // Not kept: the touch controls on/off, dynamic resolution, FPS counter, vibration (they belong to the device), the touch
  // layout (js/legacy/66 keeps it) and aim assist.
  if ("undefined" == typeof SETTINGS || "undefined" == typeof SETTINGS_SYNC || "undefined" == typeof SET_DEF) return;
  const SS = SETTINGS_SYNC,
    AC = () => window.ACCOUNT || null;
  const PHONE = "mobile" === SET_DEF.quality,
    QK = PHONE ? "qualityMobile" : "qualityPc",
    OTHER = PHONE ? "qualityPc" : "qualityMobile";
  const token = () => {
    try {
      const s = AC() && AC().session && AC().session();
      return (s && s.token) || "";
    } catch (e) {
      return "";
    }
  };
  const uid = () => {
    try {
      return AC().session().user.id;
    } catch (e) {
      return "local";
    }
  };
  const online = () => {
    try {
      const o = AC() && AC().online;
      return "function" == typeof o ? !!o() : !!o;
    } catch (e) {
      return !1;
    }
  };
  // what this device has for a setting (undefined: it has none, the other kind of device's graphics preset)
  const DEF = Object.assign({}, SET_DEF, { binds: {} });
  function read(k) {
    if (k === OTHER) return;
    if ("xhair" === k) return window.XHAIR ? SS.clean("xhair", XHAIR.get()) : void 0;
    if (k === QK) return SS.clean(k, SETTINGS.quality);
    if ("binds" === k) return SS.clean(k, SETTINGS.binds);
    return SS.clean(k, SETTINGS[k]);
  }
  const defOf = (k) => ("xhair" === k ? SS.clean("xhair", {}) : k === QK ? SS.clean(k, SET_DEF.quality) : "binds" === k ? {} : SS.clean(k, DEF[k]));
  const canon = (v) => JSON.stringify(v);
  const keys = SS.KEYS.filter((k) => k !== OTHER);

  // when each setting changed on this device (kept per account), what was last seen, what the account has acknowledged
  const metaKey = () => "lgp_set_t:" + uid();
  let T = {},
    known = {},
    acked = {},
    pulled = "",
    busy = !1,
    pushT = 0,
    inited = "";
  const saveT = () => {
    try {
      localStorage.setItem(metaKey(), JSON.stringify(T));
    } catch (e) {}
  };
  function init() {
    // changed settings that never met the account get time 1: any newer value of the account wins, an account with
    // nothing takes this device's
    if (inited === uid()) return;
    inited = uid();
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(metaKey()) || "null");
    } catch (e) {}
    T = {};
    known = {};
    acked = {};
    for (const k of keys) {
      const v = read(k);
      known[k] = canon(v);
      const t = saved && saved[k] && isFinite(+saved[k]) ? +saved[k] : canon(v) === canon(defOf(k)) ? 0 : 1;
      T[k] = t;
    }
    saveT();
  }
  // a change on this device, found by looking: the menus, the key screen and the crosshair each save in their own way
  function watch() {
    init();
    let any = !1;
    for (const k of keys) {
      const c = canon(read(k));
      if (c === known[k]) continue;
      known[k] = c;
      T[k] = Date.now();
      any = !0;
    }
    if (!any) return;
    saveT();
    clearTimeout(pushT);
    pushT = setTimeout(() => {
      pushT = 0;
      push();
    }, 1200);
  }
  // a value from the account onto this device
  function put(k, v) {
    if ("xhair" === k) return window.XHAIR && XHAIR.set(v);
    if (k === QK) return v !== SETTINGS.quality && "function" == typeof setQuality && setQuality(v);
    if ("binds" === k) {
      SETTINGS.binds = v;
      return;
    }
    SETTINGS[k] = v;
  }
  function take(o) {
    if (!o || "object" != typeof o) return;
    let hit = !1;
    for (const k of keys) {
      const e = o[k];
      if (!e || !Array.isArray(e)) continue;
      const v = SS.clean(k, e[0]),
        t = +e[1] || 0;
      if (void 0 === v) continue;
      if (t > (T[k] || 0)) {
        if (canon(v) !== canon(read(k))) {
          put(k, v);
          hit = !0;
        }
        T[k] = t;
        known[k] = canon(read(k));
        acked[k] = t;
      } else if (t === (T[k] || 0)) acked[k] = t;
    }
    if (!hit) return saveT();
    saveT();
    try {
      saveSettings();
      window.GAME_AUDIO && GAME_AUDIO.apply(!0);
      window.CB && CB.apply();
      window.KEYMAP && KEYMAP.notify();
      "function" == typeof paintSettings && paintSettings();
    } catch (e) {}
  }
  async function push() {
    const t = token();
    if (!t || !online() || busy) return;
    init();
    const o = {};
    for (const k of keys) if ((T[k] || 0) > (acked[k] || 0)) {
      const v = read(k);
      void 0 !== v && (o[k] = [v, T[k]]);
    }
    if (!Object.keys(o).length) return;
    busy = !0;
    try {
      const j = await AC().api("prefs", { token: t, set: { opts: o } });
      take(j && j.prefs && j.prefs.o);
    } catch (e) {}
    busy = !1;
  }
  async function sync(force) {
    const t = token();
    if (!t || !online()) return;
    init();
    if (!force && pulled === t) return;
    pulled = t;
    try {
      const j = await AC().api("prefs", { token: t });
      take(j && j.prefs && j.prefs.o);
      push();
    } catch (e) {
      pulled = "";
    }
  }
  setInterval(() => {
    try {
      watch();
      sync(!1);
    } catch (e) {}
  }, 1000);
  const again = () => {
    pulled = "";
  };
  addEventListener("focus", again);
  document.addEventListener("visibilitychange", () => document.hidden || again());
  window.SETTINGS_SYNC_STATE = { T: () => Object.assign({}, T), watch, sync, push };
})();
