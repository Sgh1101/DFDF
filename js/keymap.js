(function (root) {
  // Keys by their place on the keyboard (event.code), not by what they type (event.key): with the Korean input method in
  // Hangul mode W arrives as "ㅈ" (or "Process" with keyCode 229) but its code is still KeyW. A physical key is bound to an
  // action, and an action sets the same keys.<name> flags the game already reads (Forward is keys.w whatever key it is on).
  // The player's choices are SETTINGS.binds: { action: [codes] }; an action without one has its default keys.
  const A = (id, group, ko, en, def, names) => ({ id, group, ko, en, def, names: names || [] });
  const ACTIONS = [
    A("forward", "move", "앞으로", "Forward", ["KeyW"], ["w"]),
    A("back", "move", "뒤로", "Back", ["KeyS"], ["s"]),
    A("left", "move", "왼쪽", "Left", ["KeyA"], ["a"]),
    A("right", "move", "오른쪽", "Right", ["KeyD"], ["d"]),
    A("jump", "move", "점프", "Jump", ["Space"], ["space"]),
    A("crouch", "move", "앉기", "Crouch", ["ShiftLeft", "ShiftRight"], ["shift"]),
    A("reload", "combat", "재장전", "Reload", ["KeyR"], ["r"]),
    A("slot1", "combat", "주무기", "Primary weapon", ["Digit1", "Numpad1"]),
    A("slot2", "combat", "보조무기", "Sidearm", ["Digit2", "Numpad2"]),
    A("slot3", "combat", "근접무기", "Knife", ["Digit3", "Numpad3"]),
    A("grenade", "combat", "수류탄", "Grenade", ["KeyG"]),
    A("inspect", "combat", "무기 점검", "Inspect weapon", ["KeyY"]),
    A("ability1", "ability", "능력 1", "Ability 1", ["KeyQ"]),
    A("ability2", "ability", "능력 2", "Ability 2", ["KeyE"]),
    A("ability3", "ability", "능력 3", "Ability 3", ["KeyC"]),
    A("ability4", "ability", "궁극기", "Ultimate", ["KeyX"]),
    A("use", "other", "사용 · 해제 · 줍기", "Use / defuse / pick up", ["KeyF"], ["f"]),
    A("plant", "other", "스파이크 설치", "Plant spike", ["Digit4", "Numpad4"], ["4"]),
    A("shop", "other", "상점", "Shop", ["KeyB"]),
    A("scoreboard", "other", "점수판", "Scoreboard", ["Tab"]),
    A("combatlog", "other", "전투 기록", "Combat log", ["KeyN"]),
    A("map", "other", "큰 지도", "Big map", ["KeyM"]),
    A("ping", "other", "핑 찍기", "Ping", ["KeyV"]),
    A("quickchat", "other", "빠른 채팅", "Quick chat", ["KeyZ"]),
  ];
  const BY_ID = {};
  for (const a of ACTIONS) BY_ID[a.id] = a;
  // not offered to the player: Escape (pause), F-keys (F9 is the admin panel, F5 reloads), Ctrl/Alt/Meta (the browser's
  // own: js/legacy/106 never lets them reach the game), the menu key and the keys that are not keys of a game
  const RESERVED = /^(Escape|F\d+|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|OS(Left|Right)|ContextMenu|PrintScreen|ScrollLock|Pause|NumLock|Unidentified|Process|Dead|)$/;
  const bindable = (code) => typeof code === "string" && code.length <= 24 && !RESERVED.test(code);
  // an event with no code (a synthetic one, some soft keyboards) is read by the key it types, as before
  const NAMED = { shift: "ShiftLeft", " ": "Space", spacebar: "Space", tab: "Tab", control: "ControlLeft", alt: "AltLeft", meta: "MetaLeft", escape: "Escape", enter: "Enter", arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight" };
  function codeOf(e) {
    if (e && e.code && e.code !== "Unidentified") return e.code;
    const k = String((e && e.key) || "").toLowerCase();
    if (NAMED[k]) return NAMED[k];
    if (/^[a-z]$/.test(k)) return "Key" + k.toUpperCase();
    if (/^[0-9]$/.test(k)) return "Digit" + k;
    return "";
  }
  // what the player's choices can be: known actions, one to two real codes each
  function clean(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const id of Object.keys(BY_ID)) {
      const v = raw[id];
      if (!Array.isArray(v)) continue;
      const codes = v.filter((c, i) => bindable(c) && v.indexOf(c) === i).slice(0, 2);
      if (codes.length) out[id] = codes;
    }
    // a key can serve one action: the first one in the list keeps it
    const seen = new Set();
    for (const a of ACTIONS) {
      const own = out[a.id];
      if (!own) continue;
      const left = own.filter((c) => !seen.has(c));
      left.length ? (out[a.id] = left, left.forEach((c) => seen.add(c))) : delete out[a.id];
    }
    return out;
  }
  const settings = () => (typeof SETTINGS === "object" && SETTINGS ? SETTINGS : null);
  let cacheFor = null, cache = null;
  // the code -> actions table is rebuilt only when SETTINGS.binds is another object (a reset or a load swaps it)
  function table() {
    const s = settings(), b = s ? s.binds : null;
    if (cache && cacheFor === b) return cache;
    const custom = clean(b), byCode = new Map(), codes = {};
    const claimed = new Set(Object.values(custom).flat());
    for (const a of ACTIONS) {
      // a default key the player gave to another action is no longer this one's
      const own = custom[a.id] || a.def.filter((c) => !claimed.has(c));
      codes[a.id] = own;
      for (const c of own) (byCode.get(c) || byCode.set(c, []).get(c)).push(a.id);
    }
    cacheFor = b; cache = { byCode, codes };
    return cache;
  }
  const codes = (id) => (table().codes[id] || []).slice();
  const actionsOf = (e) => table().byCode.get(codeOf(e)) || [];
  const is = (e, id) => actionsOf(e).includes(id);
  // sets (or clears) the keys.<name> flags of the actions on the key; returns those actions
  function apply(keys, e, down) {
    const list = actionsOf(e);
    for (const id of list) for (const n of BY_ID[id].names) keys[n] = !!down;
    return list;
  }
  // lets go of whatever the key was holding (a key combination the browser takes, a key-up that never came)
  const release = (keys, e) => apply(keys, e, false);
  // an input the player types into: the game must not read the keys that are typed there
  const NON_TEXT = /^(button|checkbox|radio|range|color|file|image|reset|submit)$/i;
  function editing(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return true;
    return t.tagName === "INPUT" && !NON_TEXT.test(t.type || "");
  }
  // whoever shows a key (the hints) is told when the bindings change, here or from the account (settings sync)
  const subs = [];
  function notify() {
    for (const f of subs) try { f(); } catch (e) {}
  }
  function save(next) {
    const s = settings();
    if (!s) return;
    s.binds = next;
    try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    notify();
  }
  // Binds `code` to the action. A key that served another action is taken from it; an action left with no key at all takes
  // the old key of this one (a swap). Returns { ok, reason?, swapped? }.
  function bind(id, code) {
    if (!BY_ID[id]) return { ok: false, reason: "action" };
    if (!bindable(code)) return { ok: false, reason: "reserved" };
    const before = table().codes, next = {};
    for (const a of ACTIONS) next[a.id] = before[a.id].slice();
    const old = next[id].slice();
    let swapped = null;
    for (const a of ACTIONS) {
      if (a.id === id || !next[a.id].includes(code)) continue;
      next[a.id] = next[a.id].filter((c) => c !== code);
      if (!next[a.id].length) { next[a.id] = old.slice(0, 1); swapped = a.id; }
    }
    next[id] = [code];
    // only what differs from the defaults is stored
    const store = {};
    for (const a of ACTIONS) if (next[a.id].join() !== a.def.join()) store[a.id] = next[a.id];
    save(clean(store));
    return { ok: true, swapped };
  }
  const reset = () => save({});
  // the first key of an action as the hints print it (M, Tab, Num 4)
  const name = (id) => label(codes(id)[0]);
  // a key name with the Korean object particle: "F를", "L을", "Tab 키를" (letters and digits by how they are read aloud)
  const eul = (k) => (/^[A-Z0-9]$/.test(k) ? k + (/[LMNR013678]/.test(k) ? "을" : "를") : k + " 키를");
  // a short name for a code on the key caps
  function label(code) {
    const m = /^(Key|Digit|Numpad)(.+)$/.exec(code || "");
    if (m) return (m[1] === "Numpad" ? "Num " : "") + m[2];
    const names = { Space: "Space", ShiftLeft: "Shift (L)", ShiftRight: "Shift (R)", Tab: "Tab", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", CapsLock: "Caps Lock", Enter: "Enter", Backspace: "Backspace" };
    return names[code] || code || "—";
  }
  const KEYMAP = { ACTIONS, codeOf, codes, actionsOf, is, apply, release, editing, bind, reset, label, name, eul, bindable, clean, notify, onChange: (f) => subs.push(f), catcher: null };
  if (typeof module === "object" && module.exports) { module.exports = KEYMAP; return; }
  root.KEYMAP = KEYMAP;
  // the settings screen, while it waits for the key to bind, takes the next key before any other handler of the page
  root.addEventListener("keydown", (e) => { if (KEYMAP.catcher) { e.preventDefault(); e.stopImmediatePropagation(); KEYMAP.catcher(e); } }, !0);
})(typeof window === "object" ? window : globalThis);
