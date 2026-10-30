(function (root) {
  // The settings the account keeps (A.prefs "o"), shared by the server (what it accepts) and the game (what it takes back).
  // Every setting is its own entry [value, time]; the newer time wins one by one, so a phone changing its touch sensitivity
  // and a computer changing its mouse sensitivity do not undo each other. A value is checked here, never trusted as sent.
  // Not kept on purpose: the touch controls on/off, dynamic resolution, the FPS counter, vibration (they belong to a device),
  // the touch layout (its own entry in the prefs, js/legacy/66) and the aim-assist switch.
  const node = typeof module === "object" && module.exports;
  const KM = node ? require("./keymap.js") : root.KEYMAP;
  const GS = node ? require("./graphics-settings.js") : root.GRAPHICS_SETTINGS;
  const CBM = ["off", "rg", "by"];
  const num = (lo, hi) => (v) => (typeof v === "number" && isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v)) * 1000) / 1000 : void 0);
  const bool = (v) => (typeof v === "boolean" ? v : void 0);
  const pick = (list) => (v) => (typeof v === "string" && list.includes(v) ? v : void 0);
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const int = (lo, hi, v, d) => (typeof v === "number" && isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : d);
  // the crosshair (js/legacy/16): the shape, the colour as #rrggbb, sizes inside the sliders' ranges
  const XD = { style: "cross", color: "#ffffff", len: 5, thick: 2, gap: 3, dot: false, outline: true, dyn: true, alpha: 1 };
  function xhair(v) {
    if (!isObj(v)) return void 0;
    const o = {};
    o.style = ["cross", "dot", "circle", "t"].includes(v.style) ? v.style : XD.style;
    o.color = typeof v.color === "string" && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color.toLowerCase() : XD.color;
    o.len = int(1, 14, v.len, XD.len);
    o.thick = int(1, 5, v.thick, XD.thick);
    o.gap = int(0, 12, v.gap, XD.gap);
    o.alpha = typeof v.alpha === "number" && isFinite(v.alpha) ? Math.round(Math.min(1, Math.max(0.3, v.alpha)) * 100) / 100 : XD.alpha;
    for (const k of ["dot", "outline", "dyn"]) o[k] = typeof v[k] === "boolean" ? v[k] : XD[k];
    return o;
  }
  // key bindings: known actions only, one to two real key codes each, a key on one action
  function binds(v) {
    if (!isObj(v)) return void 0;
    const raw = {};
    for (const a of KM.ACTIONS) if (Array.isArray(v[a.id])) raw[a.id] = v[a.id].filter((c) => typeof c === "string" && /^[A-Za-z0-9]{1,24}$/.test(c));
    return KM.clean(raw);
  }
  const SPEC = {
    sens: num(0.2, 3), adsSens: num(0.2, 1.2), touchSens: num(0.2, 3), motion: num(0, 2),
    volMaster: num(0, 1), volFx: num(0, 1), volSteps: num(0, 1),
    shake: bool, sfx: bool, dmgNums: bool, ultCut: bool, slowMo: bool,
    colorblind: pick(CBM),
    // the graphics preset is kept once for computers and once for phones: a phone must not take a computer's
    qualityPc: pick(GS.order), qualityMobile: pick(GS.order),
    binds, xhair,
  };
  const KEYS = Object.keys(SPEC);
  const clean = (key, v) => (SPEC[key] ? SPEC[key](v) : void 0);
  // a map of { key: [value, time] } from outside: known keys only, valid values, times that are not from the future
  function cleanMap(raw, now) {
    const out = {};
    if (!isObj(raw)) return out;
    for (const k of KEYS) {
      const e = raw[k];
      if (!Array.isArray(e) || e.length !== 2) continue;
      const v = clean(k, e[0]),
        t = Math.floor(+e[1]);
      if (void 0 === v || !isFinite(t) || t < 0) continue;
      out[k] = [v, Math.min(t, now + 6e4)];
    }
    return out;
  }
  // `stored` takes the entries of `incoming` that are newer (an equal time keeps what is stored); returns whether it changed
  function merge(stored, incoming) {
    let changed = false;
    for (const k of Object.keys(incoming)) {
      if (!stored[k] || incoming[k][1] > stored[k][1]) { stored[k] = incoming[k]; changed = true; }
    }
    return changed;
  }
  const API = { KEYS, XD, clean, cleanMap, merge };
  if (node) module.exports = API;
  else root.SETTINGS_SYNC = API;
})(typeof window === "object" ? window : globalThis);
